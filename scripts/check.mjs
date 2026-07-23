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
if (!skillSource.includes("只做好四件事")) throw new Error("SKILL.md 没有说明四项核心能力");
if (!skillSource.includes("第一次使用要主动")) throw new Error("SKILL.md 没有主动的首次使用流程");
if (!skillSource.includes("严格控制内置浏览器")) throw new Error("SKILL.md 没有内置浏览器边界");
if (!skillSource.includes("不要自动打开第一课")) throw new Error("宽泛目标仍可能自动打开课程");

const browserProtocol = readFileSync(path.join(SKILL, "references", "browser-protocol.md"), "utf8");
if (!browserProtocol.includes("打开前必须通过门槛")) throw new Error("浏览器规范缺少打开门槛");
if (!browserProtocol.includes("不要用打开页面代替主动推荐")) {
  throw new Error("浏览器规范没有区分首次推荐与主题学习");
}

const labRuntime = readFileSync(path.join(SKILL, "assets", "lab-kit", "lab.js"), "utf8");
if (!labRuntime.includes("attachShadow")) throw new Error("项目预览没有与框架样式隔离");
if (labRuntime.includes("document.head.append(style)")) throw new Error("项目预览样式仍会污染框架");
if (!labRuntime.includes("aria-modal=\"false\"")) throw new Error("概念页没有使用无蒙层浮窗");
if (labRuntime.includes("本地互动 · 由 Agent 为当前项目生成")) throw new Error("本地互动顶部仍有多余说明");
if (!labRuntime.includes("scenario.previewMode === \"flush\"")) throw new Error("预览没有统一的留白模式");

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
