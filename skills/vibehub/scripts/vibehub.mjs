#!/usr/bin/env node

import { readFileSync } from "node:fs";

const BUNDLED_CONFIG = JSON.parse(
  readFileSync(new URL("../vibehub.config.json", import.meta.url), "utf8"),
);

const HELP = `VibeHub learning resolver

Usage:
  node scripts/vibehub.mjs resolve --query "setting applies immediately or saves later" [options]
  node scripts/vibehub.mjs journey --goal "我想做一个网站" [options]
  node scripts/vibehub.mjs activity --goal "让首页一眼看懂重点" [options]

Options:
  --site-url <url>  VibeHub site origin. Overrides VIBEHUB_SITE_URL and bundled config.
  --limit <1-5>     Number of enriched candidates. Defaults to 3.
  --timeout <ms>    Request timeout. Defaults to 10000.
  --context <text>  Short description of the project surface being improved.
  --focus <name>    hierarchy, spacing, or contrast. Inferred when omitted.
  --modules <list>  Comma-separated activity modules. Defaults to observe,prioritize,tune,verify.
  --help            Show this help.
`;

const ACTIVITY_MODULES = ["observe", "prioritize", "tune", "verify"];
const PRIVATE_VALUE_PATTERNS = [
  /\b(?:bearer\s+)[a-z0-9._~+/-]+=*/gi,
  /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|passwd|token)\s*[:=]\s*["']?[^\s"'&,;]+/gi,
  /\beyJ[a-zA-Z0-9_-]{16,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\b/g,
];

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (key === "help") {
      options.help = true;
      continue;
    }
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    options[key] = value;
    index += 1;
  }
  return { command, options };
}

function normalizeSiteUrl(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("site URL must use http or https");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function configuredSiteUrl(options) {
  const value = options.siteUrl || process.env.VIBEHUB_SITE_URL || BUNDLED_CONFIG.siteUrl;
  if (!value) throw new Error("VibeHub site URL is missing from bundled config");
  return normalizeSiteUrl(value);
}

function sanitizeRemoteText(value, maxLength) {
  let text = String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/[^\s<>"')\]]+/gi, " ")
    .replace(/\b[A-Z]:\\(?:[^\\\s]+\\)*[^\\\s]*/gi, " ")
    .replace(/(?:^|[\s("'`])\/(?:Users|home|var|private|opt|srv|workspace|projects?)\/[^\s"'`)]+/g, " ")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, " ");
  for (const pattern of PRIVATE_VALUE_PATTERNS) text = text.replace(pattern, " ");
  return text.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(code, message) {
  output({ ok: false, error: { code, message } });
  process.exitCode = 1;
}

async function fetchJson(url, { timeout, label }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const apiMessage = payload?.error?.message;
      throw new Error(`${label} returned HTTP ${response.status}${apiMessage ? `: ${apiMessage}` : ""}`);
    }
    if (!payload || typeof payload !== "object") throw new Error(`${label} did not return JSON`);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function requireData(payload, label) {
  if (!payload.data || typeof payload.data !== "object") {
    throw new Error(`${label} response is missing data`);
  }
  return payload.data;
}

function compactCandidate(summary, detail) {
  return {
    id: detail.id || summary.id,
    title: detail.title || summary.title,
    secondaryTitle: detail.secondaryTitle || summary.secondaryTitle || null,
    tagline: detail.tagline || summary.tagline,
    url: detail.url || summary.url,
    learningOutcome: detail.learningOutcome || summary.learningOutcome || detail.learning?.outcome || null,
    learning: detail.learning || null,
    prerequisites: detail.prerequisiteLessons || [],
    distinctions: detail.distinctions || [],
    usage: detail.usage || { use: [], avoid: [], scenarios: [] },
    boundary: detail.boundary || null,
    visualCapabilities: detail.visualCapabilities || [],
    match: {
      score: summary.score,
      fields: summary.matchedFields || [],
    },
  };
}

async function resolveLessons(options) {
  const query = sanitizeRemoteText(options.query, 500);
  if (!query) throw new Error("--query is required");

  const limit = Number(options.limit || 3);
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) {
    throw new Error("--limit must be an integer from 1 to 5");
  }

  const timeout = Number(options.timeout || 10000);
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 60000) {
    throw new Error("--timeout must be an integer from 1000 to 60000");
  }

  const siteUrl = configuredSiteUrl(options);

  const manifestPayload = await fetchJson(`${siteUrl}/.well-known/vibehub.json`, {
    timeout,
    label: "VibeHub manifest",
  });
  const manifest = requireData(manifestPayload, "VibeHub manifest");
  if (!manifest.apiBaseUrl || !manifest.schemaVersion) {
    throw new Error("VibeHub manifest is missing apiBaseUrl or schemaVersion");
  }

  const searchUrl = new URL(`${manifest.apiBaseUrl.replace(/\/$/, "")}/search`);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("limit", String(limit));
  const searchPayload = await fetchJson(searchUrl, { timeout, label: "VibeHub search" });
  const search = requireData(searchPayload, "VibeHub search");
  if (!Array.isArray(search.results)) throw new Error("VibeHub search response is missing results");

  const candidates = await Promise.all(
    search.results.map(async (summary) => {
      const lessonUrl = new URL(
        `${manifest.apiBaseUrl.replace(/\/$/, "")}/lessons/${encodeURIComponent(summary.id)}`,
      );
      try {
        const detailPayload = await fetchJson(lessonUrl, {
          timeout,
          label: `VibeHub lesson ${summary.id}`,
        });
        return compactCandidate(summary, requireData(detailPayload, `VibeHub lesson ${summary.id}`));
      } catch {
        return compactCandidate(summary, summary);
      }
    }),
  );

  return {
    ok: true,
    source: "vibehub",
    schemaVersion: manifest.schemaVersion,
    revision: manifest.revision || manifestPayload.revision || null,
    query,
    count: candidates.length,
    candidates,
  };
}

async function resolveJourneys(options) {
  const goal = sanitizeRemoteText(options.goal, 500);
  if (!goal) throw new Error("--goal is required");

  const limit = Number(options.limit || 3);
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) {
    throw new Error("--limit must be an integer from 1 to 5");
  }

  const timeout = Number(options.timeout || 10000);
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 60000) {
    throw new Error("--timeout must be an integer from 1000 to 60000");
  }

  const siteUrl = configuredSiteUrl(options);

  const manifestPayload = await fetchJson(`${siteUrl}/.well-known/vibehub.json`, {
    timeout,
    label: "VibeHub manifest",
  });
  const manifest = requireData(manifestPayload, "VibeHub manifest");
  if (!manifest.apiBaseUrl || !manifest.schemaVersion) {
    throw new Error("VibeHub manifest is missing apiBaseUrl or schemaVersion");
  }

  const searchUrl = new URL(`${manifest.apiBaseUrl.replace(/\/$/, "")}/journeys`);
  searchUrl.searchParams.set("q", goal);
  searchUrl.searchParams.set("limit", String(limit));
  const searchPayload = await fetchJson(searchUrl, { timeout, label: "VibeHub journey search" });
  const search = requireData(searchPayload, "VibeHub journey search");
  if (!Array.isArray(search.results)) throw new Error("VibeHub journey search response is missing results");

  const candidates = await Promise.all(
    search.results.map(async (summary) => {
      const detailUrl = `${manifest.apiBaseUrl.replace(/\/$/, "")}/journeys/${encodeURIComponent(summary.id)}`;
      try {
        const detailPayload = await fetchJson(detailUrl, {
          timeout,
          label: `VibeHub journey ${summary.id}`,
        });
        const detail = requireData(detailPayload, `VibeHub journey ${summary.id}`);
        return {
          id: detail.id,
          title: detail.title,
          outcome: detail.outcome,
          stageCount: detail.stageCount,
          stages: detail.stages || [],
          match: {
            score: summary.score,
            fields: summary.matchedFields || [],
          },
        };
      } catch {
        return {
          ...summary,
          stages: [],
          match: {
            score: summary.score,
            fields: summary.matchedFields || [],
          },
        };
      }
    }),
  );

  return {
    ok: true,
    source: "vibehub",
    schemaVersion: manifest.schemaVersion,
    revision: manifest.revision || manifestPayload.revision || null,
    goal,
    count: candidates.length,
    candidates,
  };
}

function inferActivityFocus(goal) {
  if (/间距|留白|拥挤|呼吸|spacing|space/i.test(goal)) return "spacing";
  if (/对比|颜色|配色|灰|醒目|contrast|color/i.test(goal)) return "contrast";
  return "hierarchy";
}

function encodeActivitySpec(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function createActivity(options) {
  const goal = sanitizeRemoteText(options.goal, 80);
  if (!goal) throw new Error("--goal is required");

  const siteUrl = configuredSiteUrl(options);
  const context = sanitizeRemoteText(options.context || "当前项目页面", 100) || "当前项目页面";
  const focus = options.focus || inferActivityFocus(goal);
  if (!["hierarchy", "spacing", "contrast"].includes(focus)) {
    throw new Error("--focus must be hierarchy, spacing, or contrast");
  }
  const modules = options.modules
    ? [...new Set(options.modules.split(",").map((value) => value.trim()).filter(Boolean))]
    : [...ACTIVITY_MODULES];
  if (!modules.length || modules.some((moduleId) => !ACTIVITY_MODULES.includes(moduleId))) {
    throw new Error(`--modules must contain only: ${ACTIVITY_MODULES.join(", ")}`);
  }

  const spec = {
    v: 1,
    goal,
    context,
    focus,
    modules,
  };

  return {
    ok: true,
    source: "vibehub",
    activityVersion: 1,
    spec,
    url: `${siteUrl}/skill/lab#spec=${encodeActivitySpec(spec)}`,
  };
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail("invalid_arguments", error.message);
    return;
  }

  if (parsed.options.help || parsed.command === "--help" || !parsed.command) {
    process.stdout.write(HELP);
    return;
  }
  if (!["resolve", "journey", "activity"].includes(parsed.command)) {
    fail("unknown_command", `Unknown command: ${parsed.command}`);
    return;
  }

  try {
    if (parsed.command === "activity") {
      output(createActivity(parsed.options));
    } else {
      output(parsed.command === "journey"
        ? await resolveJourneys(parsed.options)
        : await resolveLessons(parsed.options));
    }
  } catch (error) {
    const code = error.name === "AbortError" ? "request_timeout" : "resolver_failed";
    fail(code, error.message);
  }
}

await main();
