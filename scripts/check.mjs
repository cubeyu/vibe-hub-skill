import { execFile, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = path.join(ROOT, "skills", "vibehub");
const execFileAsync = promisify(execFile);
const REQUIRED = [
  "SKILL.md",
  "agents/openai.yaml",
  "vibehub.config.json",
  "scripts/vibehub.mjs",
];
const REMOVED = [
  "scripts/vibehub-lab.mjs",
  "references/browser-protocol.md",
  "references/lab-authoring.md",
  "references/lesson-authoring.md",
  "assets/lab-kit",
];

for (const file of REQUIRED) {
  if (!existsSync(path.join(SKILL, file))) throw new Error(`缺少文件：${file}`);
}
for (const file of REMOVED) {
  if (existsSync(path.join(SKILL, file))) throw new Error(`公开 Skill 不应再包含：${file}`);
}

const skillSource = readFileSync(path.join(SKILL, "SKILL.md"), "utf8");
if (!/^---\nname: vibehub\n/m.test(skillSource)) throw new Error("SKILL.md 缺少正确的 name");
if (!/^description: .+/m.test(skillSource)) throw new Error("SKILL.md 缺少 description");
for (const phrase of [
  "任何 Vibe Coding 编程任务及其后续补充",
  "已经让 Agent 完成了一部分代码",
  "规范表达",
  "每轮都检查",
  "不要因为前几轮已经开始编程",
  "一次查询候选",
  "一个命令批量验证",
  "不要把用户整句原话直接当作搜索词",
  "高置信度时只传一个候选",
  "最多三个",
  "不要生成学习路线",
  "推荐替代控件或方案时说明适用前提",
  "仍先完成当前任务",
]) {
  if (!skillSource.includes(phrase)) throw new Error(`SKILL.md 缺少规则：${phrase}`);
}
if (skillSource.split("\n").length > 120) throw new Error("SKILL.md 重新变得过长");
if (skillSource.includes("vibehub-lab.mjs")) throw new Error("SKILL.md 仍引用本地练习");
if (skillSource.includes(" journey ")) throw new Error("SKILL.md 仍引用学习路线命令");

const readmeSource = readFileSync(path.join(ROOT, "README.md"), "utf8");
for (const phrase of [
  "两个核心功能",
  "把模糊描述改成准确需求",
  "主动提示相关术语",
  "它不提供学习路线",
]) {
  if (!readmeSource.includes(phrase)) throw new Error(`README 缺少说明：${phrase}`);
}

const config = JSON.parse(readFileSync(path.join(SKILL, "vibehub.config.json"), "utf8"));
if (config.schemaVersion !== 1) throw new Error("不支持的配置版本");
if (!/^https:\/\//.test(config.siteUrl)) throw new Error("siteUrl 必须使用 HTTPS");
if (!/^https:\/\/github\.com\//.test(config.repositoryUrl)) throw new Error("repositoryUrl 必须指向 GitHub");

const help = execFileSync(
  process.execPath,
  [path.join(SKILL, "scripts", "vibehub.mjs"), "--help"],
  { encoding: "utf8" },
);
if (!help.includes("VibeHub terminology resolver")) throw new Error("解析器帮助信息不正确");
if (!help.includes("resolve --query")) throw new Error("解析器缺少 resolve 命令");
if (!help.includes("Repeat up to 3 times")) throw new Error("解析器缺少批量候选说明");
if (!help.includes("--compact")) throw new Error("解析器缺少紧凑输出");
if (!help.includes("Defaults to 1")) throw new Error("解析器默认结果数不是 1");
if (help.includes("journey") || help.includes("activity")) throw new Error("解析器仍暴露学习路线或练习命令");

const requests = [];
const server = createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  requests.push(url.pathname);
  response.setHeader("Content-Type", "application/json");

  if (url.pathname === "/.well-known/vibehub.json") {
    response.end(JSON.stringify({
      data: {
        apiBaseUrl: `http://${request.headers.host}/api`,
        schemaVersion: 1,
      },
    }));
    return;
  }

  if (url.pathname === "/api/search") {
    const query = url.searchParams.get("q");
    const entry = query === "Tooltip"
      ? { id: "tooltip", title: "文字提示", secondaryTitle: "Tooltip" }
      : { id: "hover", title: "悬停", secondaryTitle: "Hover" };
    response.end(JSON.stringify({
      data: {
        results: [{
          ...entry,
          tagline: `${entry.title} definition`,
          url: `https://vibe-hub.org/${entry.id}`,
          score: 500,
          matchedFields: ["id"],
        }],
      },
    }));
    return;
  }

  response.statusCode = 404;
  response.end(JSON.stringify({ error: { message: "not found" } }));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  const siteUrl = `http://127.0.0.1:${address.port}`;
  const { stdout } = await execFileAsync(process.execPath, [
    path.join(SKILL, "scripts", "vibehub.mjs"),
    "resolve",
    "--query",
    "Tooltip",
    "--query",
    "Hover",
    "--compact",
    "--site-url",
    siteUrl,
  ], { encoding: "utf8" });
  const batch = JSON.parse(stdout);
  if (batch.mode !== "compact" || batch.results?.length !== 2) {
    throw new Error("解析器批量紧凑输出不正确");
  }
  if (requests.filter((pathname) => pathname === "/.well-known/vibehub.json").length !== 1) {
    throw new Error("批量查询重复请求 manifest");
  }
  if (requests.filter((pathname) => pathname === "/api/search").length !== 2) {
    throw new Error("批量查询没有逐个验证候选");
  }
  if (requests.some((pathname) => pathname.includes("/lessons/"))) {
    throw new Error("紧凑查询不应请求术语详情");
  }
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

process.stdout.write("VibeHub Skill 检查通过：仅保留术语表达与查询能力。\n");
