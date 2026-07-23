# In-app browser protocol

Use this protocol whenever opening a VibeHub lesson or teaching page.

## Preferred behavior

1. Resolve and verify the exact lesson URL.
2. Inspect the tools, skills, plugins, or capabilities exposed by the Agent host for browser or in-app-browser control.
3. If a browser-control skill is listed, load and follow it before deciding that browser control is unavailable.
4. Prefer the Agent host's built-in, in-app, or embedded browser capability.
5. Before naming an unfamiliar concept, describe the everyday behavior or contrast the learner should notice.
6. Open or navigate the page inside the current Agent workspace.
7. Use a verified section anchor when it removes irrelevant reading.
8. Give the learner one short observation, interaction, prediction, or choice grounded in the current project.
9. Leave learner-facing exercises for the learner; do not click through and answer them on the learner's behalf.
10. Introduce the formal term after the learner has experienced the distinction, unless the term is required to operate the page.
11. Return to the project, apply the choice, and let the learner verify the same behavior there.

Treat opening the in-app page as the default action when a lesson materially helps the active task. Do not merely print a URL and ask the user to switch applications.

Catalog or source inspection verifies that a lesson exists; it does not replace opening the lesson for a learn-in-context workflow. Do not use a clickable-link fallback until browser capability discovery has been attempted.

## Fallback order

Use this order when capabilities differ across Agent hosts:

1. In-app browser navigation or browser-control tool.
2. Embedded web preview or webview.
3. A direct clickable link to the exact lesson.

Never launch a system browser with shell commands such as `open`, `start`, or `xdg-open`. Do not assume a tool name; discover the browser capability available in the current host.

## Local development

When working inside the VibeHub repository:

- Reuse a running development server when available.
- Otherwise start the project using its documented development command when doing so is within the user's requested task.
- Read the local URL and port from the server's runtime output or another direct runtime check.
- Do not assume a fixed port: development servers may select a different one when the preferred port is occupied.
- Verify that the exact route loads before presenting it as a lesson.

## Interaction discipline

- Do not open a lesson for every unfamiliar word.
- Do not navigate away from a page the learner is actively using without a task-relevant reason.
- Do not open several lesson tabs at once; move through a learning path one decision at a time.
- Do not ask “Which one is a Switch?” before the learner knows what the two behaviors mean.
- Do not use correct terminology as evidence of understanding; require an observable project decision.
- Do not block urgent fixes, destructive-action warnings, or security work behind a lesson.
- If the user declines teaching or asks to continue directly, continue the project work.
- Preserve accessibility: do not rely only on color, animation, hover, or audio when explaining what to observe.
