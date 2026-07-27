import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = path.join(ROOT, "skills", "vibehub");
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
  "凡是用户描述效果、交互、状态或问题时可能缺少恰当技术名词",
  "规范表达",
  "主动术语提示",
  "必须在正常回答中使用“主动术语提示”",
  "Markdown 内联链接",
  "先分析，再查询验证",
  "不要把用户整句原话直接当作搜索词",
  "只有候选术语都没有可靠结果时",
  "不默认第一个结果正确",
  "最多验证三个术语",
  "不要生成学习路线",
  "推荐替代控件或方案时说明适用前提",
  "仍先用通俗语言完成用户当前的表达或解释",
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
if (help.includes("journey") || help.includes("activity")) throw new Error("解析器仍暴露学习路线或练习命令");

process.stdout.write("VibeHub Skill 检查通过：仅保留术语表达与查询能力。\n");
