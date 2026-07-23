# 编写本地互动

需要围绕用户当前项目生成比较、选择、调整或验收页面时，先运行：

```text
node "<skill-root>/scripts/vibehub-lab.mjs" create
```

程序会创建临时目录并返回 `scenario.js` 路径。只修改这个文件，不修改运行时文件。

## 框架与 Agent 的边界

框架固定提供互动外壳、预览容器、标准 `choice` / `tune` / `verify` 组件、状态管理、结果编码和本地服务。Agent 负责这次学习判断的目标、文案、步骤组合、项目专属 `preview`、语义化 `result`，以及预览确有需要时的 `styles`。

多数场景应组合标准步骤组件，不要重写运行时。`preview(state)` 可以由 Agent 按真实项目自由设计，但只承担当前判断所需的视觉和交互反馈。`result(state)` 负责说明用户选择对项目意味着什么，框架负责把结果编码进 URL；不要在 Agent 侧重复解析或实现传输协议。

需要把真实项目素材放进临时实验室时，使用 Skill 目录下的脚本导入，并把返回的 `url` 传给 `scenario.preview` 使用：

```text
node "<skill-root>/scripts/vibehub-lab.mjs" asset --dir "<generated-directory>" --file "<project-asset>" [--name "logo.png"]
```

只导入完成当前判断所需的素材，不上传源代码、配置、凭据或其他敏感项目数据。不得仿造真实 Logo；没有可用素材时，使用文字或中性占位符。

## 场景接口

在 `window.VIBEHUB_LAB` 中提供：

- `title`：这次要完成的真实判断。
- `context`：正在修改的项目位置。
- `description`：用自然语言说明接下来会做什么。
- `brand`：从项目中取得的主题色。
- `previewMode`：默认使用 `inset`，由框架为卡片、表单和局部组件预留呼吸空间；只有模拟完整网页时使用 `flush`。
- `concepts`：可选的 VibeHub 概念页。每项提供 `id`、`label`、`title` 和经过解析器验证的 `url`；框架会用无蒙层浮窗打开。
- `steps`：按顺序组合 `choice`、`tune`、`verify`。
- `preview(state)`：返回当前项目的定制 HTML。根据答案和参数展示变化。
- `result(state)`：把用户选择整理成 Agent 可以执行的修改要求。
- `styles`：只写当前预览需要的 CSS。

`choice` 使用 `id`、`title` 和 `options`。每个选项提供 `id`、`label`、`description`。

`tune` 使用 `controls`。每项提供 `id`、`label`、`min`、`max`、`step`、`value`。

`verify` 使用 `items`。每项提供 `id` 和可以从页面直接判断的 `label`。

预览函数接收：

```text
state.answers   用户的选项
state.controls  用户调整的数值
state.checks    用户完成的检查
```

## 编写原则

- 先检查真实项目，再写预览和题目。
- 从 VibeHub 获取知识、误区和验收依据，不照抄通用题目。
- 不要在预览根节点重复补整块外边距。用 `previewMode` 让框架统一处理内容与容器边缘的距离，也不要写“右侧”“上方”等依赖当前布局的提示。
- 只有概念页能直接帮助当前判断时才加入 `concepts`，通常保留一到两个；不要把浮窗做成第二套导航。
- 让所有步骤围绕同一个项目判断。
- 选项放在预览之后，让用户先看再选。
- 只提供完成判断所需的步骤，通常使用 2–4 步。
- 不把生成目录放进用户仓库。

完成 `scenario.js` 后运行：

```text
node "<skill-root>/scripts/vibehub-lab.mjs" serve --dir "<generated-directory>"
```

在 Agent 内置浏览器打开返回的本地地址。互动结果保存在 URL 中，VibeHub 不接收用户数据。

用户完成后，读取浏览器当前地址并运行：

```text
node "<skill-root>/scripts/vibehub-lab.mjs" result --url "<completed-lab-url>"
```

使用返回的 `result.summary` 修改真实项目。不要让 Agent 自己解析结果编码。
