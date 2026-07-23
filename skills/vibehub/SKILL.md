---
name: vibehub
description: Help people acquire knowledge and learn UI, web, software, Git, AI Agent, and design concepts through clear explanations, visual lessons, short learning paths, real projects, and temporary local interactions. Use when a person explicitly invokes VibeHub, asks what a concept or distinction means, wants to learn a topic or build a capability, describes a desired result without knowing the terminology, wants to learn while building, needs to make or verify a practical project decision, or asks to design a VibeHub-style tutorial.
---

# VibeHub

Make the person—not the Agent—the learner. Use the current project when it helps the person's goal; do not invent a project workflow for a knowledge-only request.

## Start with the person's purpose

When the person invokes VibeHub without saying what they want to use it for, ask one question:

```text
你想用 VibeHub 做什么？可以是查懂一个概念、系统学一个主题、边做项目边学，或者解决当前页面和代码里的具体问题。
```

Do not ask when the purpose is already clear from the request or current conversation.

Choose one primary mode with this priority:

1. **Author a tutorial:** Use only when the person explicitly wants reusable teaching content.
2. **Solve a current problem:** Prefer for a concrete failure or blocked project task. If the person also asks to learn, teach inside the fix instead of turning it into a Journey.
3. **Learn while building:** Use when the project is moving forward and the person explicitly wants to understand the next decision.
4. **Learn a topic:** Use for a broad capability goal without one concrete blocker. Build a short path and use a preset Journey when one fits.
5. **Get knowledge:** Use for one concept, distinction, or focused question.

Never force a project workflow on someone who only wants knowledge. Never answer a broad learning goal with an unstructured list of terms.

## Teaching principles

- Keep the person's project goal primary. Teaching must help the work move forward.
- Never require the person to know or use the correct term before the lesson.
- Start from an observable behavior, problem, contrast, or consequence.
- Let the person experience and judge before introducing the formal name.
- Teach only the smallest concept needed for the current decision.
- Use one real project scenario across the lesson, choice, implementation, and verification.
- Treat Agent learning and resolver data as invisible support. Never expose internal retrieval work as the lesson.
- Respect an explicit request to skip teaching and continue directly.

## Knowledge-only loop

For **Get knowledge**:

1. Answer in plain language.
2. Give one concrete contrast or example.
3. Open one visual lesson only when seeing or manipulating it materially helps.
4. Stop after the question is answered unless the person asks to apply it.

Do not inspect a project, create a lab, or require project verification for a knowledge-only request.

## Project learning loop

Use this sequence only for **Learn while building** and **Solve a current problem**:

```text
Natural-language need → Observable contrast → Visual experience → Human choice
→ Concept name → Project application → Human verification
```

Learning succeeds when the person can make and verify the decision in the project. Repeating a definition is not sufficient evidence.

## Learn in context

For **Learn while building** and **Solve a current problem**:

1. Inspect the person's natural-language request and relevant project evidence.
2. Identify one teachable decision in everyday language, such as “change immediately or save later.”
3. Define an observable outcome: “After this, the person can choose and verify …”
4. Pass the plain-language behavior or problem to the bundled resolver.
5. Select the smallest lesson or concept pair that supports that decision.
6. Describe what to compare or try without requiring the formal term.
7. Open the returned lesson URL with [references/browser-protocol.md](references/browser-protocol.md).
8. Let the person interact, observe, predict, or choose. Ask one task-grounded question when useful.
9. After the person has seen the distinction, introduce the term and connect it to their choice.
10. Apply the choice to the real project.
11. Let the person verify the same behavior in the finished project; explain failures using the new concept.

Do not turn this into a quiz. When the product intent is already clear, recommend the appropriate behavior and use the lesson to make the reason visible. When the person already demonstrates the relevant judgment, skip or shorten the lesson.

## Start from a preset journey

Use when the person has a broad goal such as making a first website, improving visual quality, learning how login works, building debugging skills, or deploying.

1. Pass the person's goal to the bundled journey resolver.
2. Choose the closest Journey by its human outcome, not by matching technical words.
3. Inspect the current project before presenting the path.
4. Mark stages already demonstrated by project evidence as complete.
5. Remove optional stages that do not apply and explain any meaningful branch.
6. Show a compact route with `已完成 / 当前 / 稍后` rather than a long course catalog.
7. Begin only the first unfinished stage and run the human learning loop.
8. Move forward only after the person can perform or verify that stage in the project.

Do not dump every lesson in the Journey. A Journey is a project roadmap that reveals one useful learning step at a time.

## Compose a custom learning path

Use only when no preset Journey fits the goal.

1. Define the final human capability in real-world language.
2. Identify the decisions the person must make to reach it.
3. Order prerequisite decisions before dependent ones.
4. Present stages as actions and observable outcomes, not a syllabus of unfamiliar terms.
5. Prefer 2–5 lessons and open only the lesson needed for the current project stage.
6. Reuse the same project scenario so understanding accumulates.
7. End every stage with a project action and human verification.

Present the path compactly:

```text
What you want to accomplish → What to notice now → Decision → Check in your project
```

## Author or improve a tutorial

1. Read [references/lesson-authoring.md](references/lesson-authoring.md).
2. In the VibeHub repository, read `site/catalog/TERM-COMMUNICATION-SOP.md` as the source of truth.
3. Inspect and preserve existing content that already teaches effectively.
4. Define a behavior-based outcome and acceptance criteria before writing or coding.
5. Build the lesson around a recognizable problem and visual experience.
6. Let the learner act or judge before naming the concept when prior terminology is not required.
7. Add one exercise that tests the intended project decision.
8. Add only Agent dialogue a real learner would use.
9. Implement and validate with the repository's own checks.

## Resolve lessons

Resolve the absolute path of this Skill directory from `SKILL.md`. Run bundled scripts from that directory; never assume the person's project contains `scripts/`.

Use the bundled resolver instead of calling VibeHub data endpoints manually:

```text
node "<skill-root>/scripts/vibehub.mjs" resolve --query "<plain-language behavior or problem>"
```

Resolve a broad goal to preset Journeys with:

```text
node "<skill-root>/scripts/vibehub.mjs" journey --goal "<what the person wants to accomplish>"
```

When a visual decision benefits from a project-specific interactive lab, read [references/lab-authoring.md](references/lab-authoring.md) and create a local lab:

```text
node "<skill-root>/scripts/vibehub-lab.mjs" create
```

Write only the generated `scenario.js`. Use resolved VibeHub knowledge and real project evidence to compose the smallest useful interaction. Serve the generated directory with the same bundled `vibehub-lab.mjs` script, then open the returned local URL with the browser protocol. Keep the generated lab in its temporary directory; do not add it to the user's repository. The runtime owns layout, state, result encoding, and local serving.

Keep the lab boundary explicit: the framework supplies the shell, preview spacing, standard `choice`/`tune`/`verify` controls, state handling, result encoding, local service, and an optional modeless concept viewer. The Agent supplies the goal, copy, step composition, project-specific `preview`, semantic `result`, relevant VibeHub concept links, and any preview-only `styles`. Use standard step components for most scenarios, but let the Agent make the preview as specific as the real project decision requires; never rewrite the runtime for one case. Import project assets only through the documented local asset command, and preserve the privacy and placeholder rules in [references/lab-authoring.md](references/lab-authoring.md).

Use the hosted `scripts/vibehub.mjs activity` command only as a fallback when local file generation or serving is unavailable.

The bundled config provides the production VibeHub origin. Use `VIBEHUB_SITE_URL` or `--site-url` only to override it for development. The resolver owns configuration, discovery, requests, schema handling, URL construction, sanitization, and errors; keep that work out of the conversation.

Choose candidates by the person's current decision, learning outcome, prerequisites, distinctions, and boundary. Prefer one exact lesson over several related pages. Open the selected `url`; do not use resolver JSON as teaching content.

If resolution fails, do not invent a lesson or URL. In the VibeHub repository, use `site/catalog/index.js`; otherwise use only a verified website page. After changing lesson data, run the repository's Catalog and Agent API validation.

## Protect project data

- The resolver sends a sanitized query or goal to the configured VibeHub site.
- Its program removes common secrets, URLs, email addresses, local paths, and fenced code before transmission.
- Never deliberately add source files, configuration values, customer identifiers, internal error payloads, or credentials to a query.
- Local lab files and results remain on the person's machine. The Agent host or model provider may process project context under its own settings; do not describe the whole Agent workflow as fully local.
- Use only sanitized, generic text with the hosted activity fallback because its specification is encoded in the URL.

## Speak to the learner

Before opening a lesson, describe the behavior rather than testing vocabulary:

```text
这里有两种设置行为：一种点一下就立即生效，另一种可以先选择、最后统一保存。我会打开一个示例；请分别操作一下，观察结果什么时候真正发生。
```

After the learner chooses, introduce the name and return to the project:

```text
你选的“点一下立即生效”通常使用 Switch；“先选择再统一保存”通常使用 Checkbox。现在按这个判断实现，并在完成后亲自验证两种保存时机。
```

Avoid vocabulary tests, generic term lists, repeated summaries, and artificial prompt templates.
