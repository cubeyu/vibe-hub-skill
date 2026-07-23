#!/usr/bin/env node

import { constants, createReadStream, existsSync } from "node:fs";
import { copyFile, lstat, mkdir, mkdtemp, realpath, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const KIT_DIR = path.resolve(SCRIPT_DIR, "../assets/lab-kit");
const KIT_FILES = ["index.html", "lab.css", "lab.js", "vibehub-logo.png"];
const ALLOWED_ASSET_EXTENSIONS = new Set([".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const MAX_ASSET_BYTES = 5 * 1024 * 1024;
const HELP = `VibeHub local lab

Usage:
  node scripts/vibehub-lab.mjs create [--output <directory>]
  node scripts/vibehub-lab.mjs asset --dir <directory> --file <project-asset> [--name <filename>]
  node scripts/vibehub-lab.mjs serve --dir <directory> [--port <number>]
  node scripts/vibehub-lab.mjs result --url <completed-lab-url>

Commands:
  create  Copy the local lab runtime and create scenario.js in a new directory.
  asset   Copy one real project image into the generated lab.
  serve   Serve one generated lab on 127.0.0.1. The default port is selected automatically.
  result  Decode the completed local URL for the Agent.
`;

const SCENARIO_STARTER = `window.VIBEHUB_LAB = {
  title: "让这个页面先说清楚一件事",
  context: "当前项目",
  description: "这个文件由 Agent 根据当前项目改写。",
  brand: "#3f62df",
  previewLabel: "项目预览",
  previewHint: "根据你的选择实时变化",
  previewMode: "inset",
  concepts: [],
  steps: [
    {
      id: "direction",
      type: "choice",
      label: "选择方向",
      title: "哪一种更接近你想要的结果？",
      options: [
        { id: "a", label: "方案 A", description: "由 Agent 写出这个方案的真实差别。" },
        { id: "b", label: "方案 B", description: "由 Agent 写出这个方案的真实差别。" }
      ]
    },
    {
      id: "verify",
      type: "verify",
      label: "检查结果",
      title: "回到页面本身检查",
      items: [
        { id: "goal", label: "页面已经达到这次调整的目标" }
      ]
    }
  ],
  preview(state) {
    const choice = state.answers.direction || "a";
    return \`<div style="min-height:320px;display:grid;place-items:center">
      <strong>Agent 在这里编写当前项目的 \${choice === "a" ? "方案 A" : "方案 B"} 预览</strong>
    </div>\`;
  },
  result(state) {
    return \`用户选择了 \${state.answers.direction || "未选择"}，请把这个判断应用到真实项目。\`;
  }
};
`;

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    options[token.slice(2)] = value;
    index += 1;
  }
  return { command, options };
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function createLab(options) {
  const directory = options.output
    ? path.resolve(options.output)
    : await mkdtemp(path.join(os.tmpdir(), "vibehub-lab-"));

  await mkdir(directory, { recursive: true });
  const destinations = [...KIT_FILES, "scenario.js", "project-assets"].map((file) => path.join(directory, file));
  if (destinations.some((file) => existsSync(file))) {
    throw new Error(`lab directory already contains generated files: ${directory}`);
  }

  await Promise.all(KIT_FILES.map((file) => copyFile(path.join(KIT_DIR, file), path.join(directory, file))));
  await mkdir(path.join(directory, "project-assets"));
  await writeFile(path.join(directory, "scenario.js"), SCENARIO_STARTER, "utf8");
  return {
    ok: true,
    command: "create",
    directory,
    scenario: path.join(directory, "scenario.js"),
  };
}

function safeAssetName(sourcePath, requestedName) {
  const sourceExtension = path.extname(sourcePath).toLowerCase();
  const requestedExtension = path.extname(requestedName || "").toLowerCase();
  if (requestedExtension && requestedExtension !== sourceExtension) {
    throw new Error("--name must keep the source file extension");
  }
  const sourceStem = path.basename(sourcePath, sourceExtension);
  const requestedStem = requestedExtension
    ? path.basename(requestedName, requestedExtension)
    : requestedName || sourceStem;
  const stem = requestedStem
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 80);
  return `${stem || "project-asset"}${sourceExtension}`;
}

async function addAsset(options) {
  if (!options.dir) throw new Error("--dir is required");
  if (!options.file) throw new Error("--file is required");

  const directory = await realpath(path.resolve(options.dir)).catch(() => null);
  if (!directory) throw new Error("generated lab directory does not exist");
  const scenarioStat = await stat(path.join(directory, "scenario.js")).catch(() => null);
  if (!scenarioStat?.isFile()) throw new Error("directory is not a generated VibeHub lab");

  const source = await realpath(path.resolve(options.file)).catch(() => null);
  if (!source) throw new Error("project asset does not exist");
  const sourceStat = await stat(source);
  if (!sourceStat.isFile()) throw new Error("project asset must be a file");
  if (sourceStat.size > MAX_ASSET_BYTES) throw new Error("project asset must be 5 MB or smaller");

  const extension = path.extname(source).toLowerCase();
  if (!ALLOWED_ASSET_EXTENSIONS.has(extension)) {
    throw new Error(`project asset must be one of: ${[...ALLOWED_ASSET_EXTENSIONS].join(", ")}`);
  }

  const assetDirectory = path.join(directory, "project-assets");
  const assetDirectoryStat = await lstat(assetDirectory).catch(() => null);
  if (!assetDirectoryStat?.isDirectory() || assetDirectoryStat.isSymbolicLink()) {
    throw new Error("generated lab asset directory is invalid");
  }
  const resolvedAssetDirectory = await realpath(assetDirectory);
  if (resolvedAssetDirectory !== assetDirectory) {
    throw new Error("generated lab asset directory must stay inside the lab");
  }

  const filename = safeAssetName(source, options.name);
  const destination = path.join(assetDirectory, filename);
  try {
    await copyFile(source, destination, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error(`project asset already exists: ${filename}`);
    throw error;
  }

  return {
    ok: true,
    command: "asset",
    filename,
    path: destination,
    url: `./project-assets/${filename}`,
  };
}

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".gif": "image/gif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

async function serveLab(options) {
  if (!options.dir) throw new Error("--dir is required");
  const directory = path.resolve(options.dir);
  for (const file of [...KIT_FILES, "scenario.js"]) {
    const fileStat = await stat(path.join(directory, file)).catch(() => null);
    if (!fileStat?.isFile()) throw new Error(`missing generated file: ${file}`);
  }
  const realDirectory = await realpath(directory);

  const port = Number(options.port || 0);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("--port must be an integer from 0 to 65535");
  }

  const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    let relative;
    try {
      relative = requestUrl.pathname === "/" ? "index.html" : decodeURIComponent(requestUrl.pathname.slice(1));
    } catch {
      response.writeHead(400).end("Bad request");
      return;
    }
    const candidatePath = path.resolve(realDirectory, relative);
    const filePath = await realpath(candidatePath).catch(() => null);
    if (!filePath) {
      response.writeHead(404).end("Not found");
      return;
    }
    if (filePath !== realDirectory && !filePath.startsWith(`${realDirectory}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    const fileStat = await stat(filePath).catch(() => null);
    if (!fileStat?.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    createReadStream(filePath).pipe(response);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  const address = server.address();
  output({
    ok: true,
    command: "serve",
    directory,
    url: `http://127.0.0.1:${address.port}`,
  });
}

function readResult(options) {
  if (!options.url) throw new Error("--url is required");
  const url = new URL(options.url);
  const encoded = new URLSearchParams(url.hash.slice(1)).get("result");
  if (!encoded) throw new Error("completed lab URL is missing result");
  if (encoded.length > 8192) throw new Error("completed lab result is too large");
  const result = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (result?.v !== 1 || typeof result.answers !== "object" || typeof result.summary !== "string") {
    throw new Error("completed lab result is invalid");
  }
  return {
    ok: true,
    command: "result",
    result,
  };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.command || parsed.command === "help" || parsed.command === "--help") {
    process.stdout.write(HELP);
    return;
  }
  if (parsed.command === "create") {
    output(await createLab(parsed.options));
    return;
  }
  if (parsed.command === "asset") {
    output(await addAsset(parsed.options));
    return;
  }
  if (parsed.command === "serve") {
    await serveLab(parsed.options);
    return;
  }
  if (parsed.command === "result") {
    output(readResult(parsed.options));
    return;
  }
  throw new Error(`Unknown command: ${parsed.command}`);
}

main().catch((error) => {
  output({ ok: false, error: { message: error.message } });
  process.exitCode = 1;
});
