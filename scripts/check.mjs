import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = path.join(ROOT, "skills", "vibehub");
const REQUIRED = [
  "SKILL.md",
  "agents/openai.yaml",
  "vibehub.config.json",
  "scripts/vibehub.mjs",
  "scripts/vibehub-lab.mjs",
  "references/browser-protocol.md",
  "references/lab-authoring.md",
  "references/lesson-authoring.md",
  "assets/lab-kit/index.html",
  "assets/lab-kit/lab.css",
  "assets/lab-kit/lab.js",
  "assets/lab-kit/vibehub-logo.png",
];

for (const file of REQUIRED) {
  if (!existsSync(path.join(SKILL, file))) throw new Error(`缺少文件：${file}`);
}

const skillSource = readFileSync(path.join(SKILL, "SKILL.md"), "utf8");
if (!/^---\nname: vibehub\n/m.test(skillSource)) throw new Error("SKILL.md 缺少正确的 name");
if (!/^description: .+/m.test(skillSource)) throw new Error("SKILL.md 缺少 description");
if (!skillSource.includes("看不懂 Agent 回复里的术语并要求通俗解释")) {
  throw new Error("SKILL.md description 没有覆盖开发中解释 Agent 术语的触发场景");
}
if (!skillSource.includes("VibeHub 只负责五件事")) throw new Error("SKILL.md 没有说明五项核心能力");
if (!skillSource.includes("通俗解释 Agent 的说法")) {
  throw new Error("SKILL.md 没有解释 Agent 术语的独立流程");
}
if (!skillSource.includes("它为什么会在当前任务中出现")) {
  throw new Error("Agent 术语解释没有联系当前任务");
}
if (!skillSource.includes("可以怎样继续判断或回复 Agent")) {
  throw new Error("Agent 术语解释没有给用户可执行的下一步");
}
if (!skillSource.includes("首次使用：直接给方向")) throw new Error("SKILL.md 没有直接的首次使用流程");
if (!skillSource.includes("你不需要先知道课程名称")) {
  throw new Error("首次使用仍要求用户先理解课程体系");
}
if (!skillSource.includes("不问“你想学什么”或“你想做什么”")) {
  throw new Error("首次使用仍可能把选择重新推给用户");
}
if (!skillSource.includes("不是通用网页制作、截图还原、代码修复或项目开发 Skill")) {
  throw new Error("SKILL.md 没有说明学习能力边界");
}
if (!skillSource.includes("不要让用户判断何时该看页面")) {
  throw new Error("SKILL.md 仍把教学形式的选择交给用户");
}
if (!skillSource.includes("不要默认第一条候选正确")) {
  throw new Error("SKILL.md 仍可能盲用第一条搜索结果");
}
if (!skillSource.includes("内联链接")) throw new Error("SKILL.md 没有要求返回官方页面链接");
if (!skillSource.includes("课程提供准确知识，练习让用户形成判断")) {
  throw new Error("SKILL.md 仍把课程和练习拆成不同模式");
}
if (!skillSource.includes("立即给出一个能回答、能观察或能操作的第一步")) {
  throw new Error("学习路线仍等待用户再次选择主题");
}
if (!skillSource.includes("不要无解释地打开第一课")) {
  throw new Error("宽泛目标可能直接跳进课程");
}

const readmeSource = readFileSync(path.join(ROOT, "README.md"), "utf8");
if (!readmeSource.includes("看不懂 Agent 回复时")) {
  throw new Error("README 没有介绍开发中解释 Agent 术语的核心场景");
}

const browserProtocol = readFileSync(path.join(SKILL, "references", "browser-protocol.md"), "utf8");
if (!browserProtocol.includes("不需要先说“打开页面”")) {
  throw new Error("浏览器规范仍要求用户主动选择页面");
}
if (!browserProtocol.includes("不要用打开页面代替主动推荐")) {
  throw new Error("浏览器规范没有区分首次推荐与主题学习");
}
if (!browserProtocol.includes("内置浏览器可用时必须使用")) {
  throw new Error("浏览器规范没有强制使用可用的内置浏览器");
}
if (!browserProtocol.includes("不使用基于 URL 的自动选择作为第一步")) {
  throw new Error("浏览器规范仍可能让通用 URL 路由选择外部浏览器");
}
if (!browserProtocol.includes("检查阶段不要传入目标 URL")) {
  throw new Error("浏览器能力检查仍可能触发 URL 自动路由");
}
if (!browserProtocol.includes("不得静默启动外部浏览器")) {
  throw new Error("内置浏览器不可用时仍可能静默打开外部浏览器");
}
if (!browserProtocol.includes("不得用字符图")) throw new Error("浏览器规范仍可能用字符图代替课程");

const labAuthoring = readFileSync(path.join(SKILL, "references", "lab-authoring.md"), "utf8");
if (!labAuthoring.includes("把课程与练习结合")) {
  throw new Error("本地互动没有使用课程作为知识依据");
}
if (!labAuthoring.includes("用户不需要先说出主题名称")) {
  throw new Error("本地互动仍要求用户先知道学习主题");
}
if (!labAuthoring.includes("concepts.label")) {
  throw new Error("课程浮窗没有可区分的标签要求");
}
if (!labAuthoring.includes("完成后回复我一声")) {
  throw new Error("本地互动没有给用户简单的完成方式");
}
if (!labAuthoring.includes("不要要求用户复制 URL、转述选择")) {
  throw new Error("本地互动仍可能要求用户手动汇报机器可读结果");
}
if (!labAuthoring.includes("完成后读取它的当前 URL")) {
  throw new Error("本地互动没有在生成前确认结果可由 Agent 读取");
}
if (!skillSource.includes("不让用户复述选择或结果")) {
  throw new Error("SKILL.md 没有要求 Agent 主动读取练习结果");
}

const labRuntime = readFileSync(path.join(SKILL, "assets", "lab-kit", "lab.js"), "utf8");
if (!labRuntime.includes("attachShadow")) throw new Error("项目预览没有与框架样式隔离");
if (labRuntime.includes("document.head.append(style)")) throw new Error("项目预览样式仍会污染框架");
if (!labRuntime.includes("aria-modal=\"false\"")) throw new Error("概念页没有使用无蒙层浮窗");
if (labRuntime.includes("本地互动 · 由 Agent 为当前项目生成")) throw new Error("本地互动顶部仍有多余说明");
if (!labRuntime.includes("scenario.previewMode === \"flush\"")) throw new Error("预览没有统一的留白模式");

const labStyles = readFileSync(path.join(SKILL, "assets", "lab-kit", "lab.css"), "utf8");
if (!labStyles.includes("--lab-font-body: 15px")) throw new Error("练习框架缺少可读的正文字号基准");
if (!labStyles.includes(".lab-option b {\n  color: var(--lab-text);\n  font-size: var(--lab-font-body)")) {
  throw new Error("练习选项标题字号过小或没有使用统一字号");
}
if (!labStyles.includes("font-size: var(--lab-font-meta)")) {
  throw new Error("练习框架缺少统一的辅助文字字号");
}
if (/font-size:\s*(?:9|10|10\.5|11|11\.5)px/.test(labStyles)) {
  throw new Error("练习框架仍包含低于 12px 的文字");
}

const labHtml = readFileSync(path.join(SKILL, "assets", "lab-kit", "index.html"), "utf8");
if (!labHtml.includes("frame-src https://vibe-hub.org")) throw new Error("本地互动没有允许嵌入 VibeHub 概念页");

const config = JSON.parse(readFileSync(path.join(SKILL, "vibehub.config.json"), "utf8"));
if (config.schemaVersion !== 1) throw new Error("不支持的配置版本");
if (!/^https:\/\//.test(config.siteUrl)) throw new Error("siteUrl 必须使用 HTTPS");
if (!/^https:\/\/github\.com\//.test(config.repositoryUrl)) throw new Error("repositoryUrl 必须指向 GitHub");

execFileSync(process.execPath, [path.join(SKILL, "scripts", "vibehub.mjs"), "--help"], {
  stdio: "ignore",
});

const labDirectory = await mkdtemp(path.join(os.tmpdir(), "vibe-hub-skill-check-"));
try {
  execFileSync(process.execPath, [
    path.join(SKILL, "scripts", "vibehub-lab.mjs"),
    "create",
    "--output",
    path.join(labDirectory, "lab"),
  ], { stdio: "ignore" });
  const generatedLab = path.join(labDirectory, "lab");
  if (!existsSync(path.join(generatedLab, "vibehub-logo.png"))) {
    throw new Error("生成目录缺少 VibeHub Logo");
  }
  execFileSync(process.execPath, [
    path.join(SKILL, "scripts", "vibehub-lab.mjs"),
    "asset",
    "--dir",
    generatedLab,
    "--file",
    path.join(SKILL, "assets", "lab-kit", "vibehub-logo.png"),
    "--name",
    "project-logo.png",
  ], { stdio: "ignore" });
  if (!existsSync(path.join(generatedLab, "project-assets", "project-logo.png"))) {
    throw new Error("项目素材没有复制到生成目录");
  }
  const importedLogo = await readFile(path.join(generatedLab, "project-assets", "project-logo.png"));
  const sourceLogo = await readFile(path.join(SKILL, "assets", "lab-kit", "vibehub-logo.png"));
  if (!importedLogo.equals(sourceLogo)) throw new Error("项目素材复制后的内容不一致");

  let duplicateRejected = false;
  try {
    execFileSync(process.execPath, [
      path.join(SKILL, "scripts", "vibehub-lab.mjs"),
      "asset",
      "--dir",
      generatedLab,
      "--file",
      path.join(SKILL, "assets", "lab-kit", "vibehub-logo.png"),
      "--name",
      "project-logo.png",
    ], { stdio: "ignore" });
  } catch {
    duplicateRejected = true;
  }
  if (!duplicateRejected) throw new Error("项目素材不应覆盖同名文件");

  const invalidAsset = path.join(labDirectory, "secret.txt");
  await writeFile(invalidAsset, "not an image", "utf8");
  let invalidTypeRejected = false;
  try {
    execFileSync(process.execPath, [
      path.join(SKILL, "scripts", "vibehub-lab.mjs"),
      "asset",
      "--dir",
      generatedLab,
      "--file",
      invalidAsset,
    ], { stdio: "ignore" });
  } catch {
    invalidTypeRejected = true;
  }
  if (!invalidTypeRejected) throw new Error("项目素材应拒绝非法扩展名");

  const outsideDirectory = path.join(labDirectory, "outside");
  const assetDirectory = path.join(generatedLab, "project-assets");
  await mkdir(outsideDirectory);
  await rm(assetDirectory, { recursive: true });
  await symlink(outsideDirectory, assetDirectory, "dir");
  let linkedDirectoryRejected = false;
  try {
    execFileSync(process.execPath, [
      path.join(SKILL, "scripts", "vibehub-lab.mjs"),
      "asset",
      "--dir",
      generatedLab,
      "--file",
      path.join(SKILL, "assets", "lab-kit", "vibehub-logo.png"),
      "--name",
      "escaped.png",
    ], { stdio: "ignore" });
  } catch {
    linkedDirectoryRejected = true;
  }
  if (!linkedDirectoryRejected) throw new Error("项目素材目录为符号链接时必须拒绝导入");
  if (existsSync(path.join(outsideDirectory, "escaped.png"))) {
    throw new Error("项目素材逃逸到生成目录之外");
  }
  await unlink(assetDirectory);
} finally {
  await rm(labDirectory, { recursive: true, force: true });
}

process.stdout.write("VibeHub Skill 检查通过。\n");
