(() => {
  const scenario = window.VIBEHUB_LAB;
  const root = document.querySelector("#vibehub-lab");

  if (!scenario || !root || !Array.isArray(scenario.steps) || typeof scenario.preview !== "function") {
    document.body.innerHTML = "<p class=\"lab-error\">互动场景不完整，请让 Agent 重新生成。</p>";
    return;
  }

  const state = {
    answers: {},
    controls: {},
    checks: {},
    activeStep: 0,
    completed: false,
    openConcept: "",
  };

  for (const step of scenario.steps) {
    if (step.type !== "tune") continue;
    for (const control of step.controls || []) {
      state.controls[control.id] = Number(control.value ?? control.min ?? 0);
    }
  }

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function encodeResult(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
  }

  function decodeResult(value) {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function restoreResult() {
    try {
      const payload = new URLSearchParams(location.hash.slice(1)).get("result");
      if (!payload || payload.length > 8192) return;
      const restored = decodeResult(payload);
      if (restored?.v !== 1) return;
      Object.assign(state.answers, restored.answers || {});
      Object.assign(state.controls, restored.controls || {});
      Object.assign(state.checks, restored.checks || {});
      state.activeStep = Math.max(0, scenario.steps.length - 1);
      state.completed = true;
    } catch {
      history.replaceState(null, "", location.pathname);
    }
  }

  function progressMarkup() {
    return scenario.steps.map((step, index) => {
      const classes = [
        index === state.activeStep && !state.completed ? "is-current" : "",
        index < state.activeStep || state.completed ? "is-done" : "",
      ].filter(Boolean).join(" ");
      return `<li class="${classes}">${escapeHtml(step.label || `第 ${index + 1} 步`)}</li>`;
    }).join("");
  }

  function conceptUrl(value) {
    try {
      const url = new URL(value);
      const isVibeHub = url.protocol === "https:"
        && (url.hostname === "vibe-hub.org" || url.hostname === "www.vibe-hub.org");
      const isLocal = url.protocol === "http:"
        && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
      return isVibeHub || isLocal ? url.href : "";
    } catch {
      return "";
    }
  }

  function embeddedConceptUrl(value) {
    const safeUrl = conceptUrl(value);
    if (!safeUrl) return "";
    const url = new URL(safeUrl);
    url.searchParams.set("embed", "1");
    return url.href;
  }

  function conceptsMarkup() {
    const concepts = (scenario.concepts || []).filter((concept) => conceptUrl(concept.url));
    if (!concepts.length) return "";
    return `
      <div class="lab-concepts" aria-label="相关概念">
        <span>${escapeHtml(scenario.conceptsLabel || "需要时再看")}</span>
        ${concepts.map((concept) => `
          <button type="button" data-action="open-concept" data-concept="${escapeHtml(concept.id)}">
            ${escapeHtml(concept.label || concept.title)}
            <i aria-hidden="true">↗</i>
          </button>
        `).join("")}
      </div>
    `;
  }

  function conceptPanelMarkup() {
    const concept = (scenario.concepts || []).find((item) => item.id === state.openConcept);
    const sourceUrl = conceptUrl(concept?.url);
    const frameUrl = embeddedConceptUrl(concept?.url);
    if (!concept || !frameUrl) return "";
    return `
      <aside class="lab-concept-panel" role="dialog" aria-modal="false" aria-label="${escapeHtml(concept.title || concept.label)}">
        <header>
          <div>
            <small>${escapeHtml(concept.eyebrow || "VibeHub 概念")}</small>
            <b>${escapeHtml(concept.title || concept.label)}</b>
          </div>
          <nav>
            <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">新标签打开</a>
            <button type="button" data-action="close-concept" aria-label="关闭概念浮窗">×</button>
          </nav>
        </header>
        <iframe
          src="${escapeHtml(frameUrl)}"
          title="${escapeHtml(concept.title || concept.label)}"
          loading="eager"
          referrerpolicy="no-referrer"
          sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
        ></iframe>
      </aside>
    `;
  }

  function choiceMarkup(step, index) {
    const answer = state.answers[step.id];
    const options = (step.options || []).map((option) => `
      <button
        class="lab-option ${answer === option.id ? "is-active" : ""}"
        type="button"
        data-action="choose"
        data-step="${index}"
        data-step-id="${escapeHtml(step.id)}"
        data-value="${escapeHtml(option.id)}"
        aria-pressed="${answer === option.id}"
      >
        <i aria-hidden="true">✓</i>
        <b>${escapeHtml(option.label)}</b>
        <span>${escapeHtml(option.description || "")}</span>
      </button>
    `).join("");

    return `
      <section class="lab-step" data-step-section="${index}">
        <header>
          <small>${escapeHtml(step.eyebrow || "做一个选择")}</small>
          <h2>${escapeHtml(step.title)}</h2>
          ${step.description ? `<p>${escapeHtml(step.description)}</p>` : ""}
        </header>
        <div class="lab-options">${options}</div>
        ${index < state.activeStep && step.insight ? `<p class="lab-insight">${escapeHtml(step.insight)}</p>` : ""}
        <div class="lab-step-action">
          <span>${answer ? "已经选好，可以继续。" : "先选择一个更符合当前目标的方向。"}</span>
          <button type="button" data-action="next" data-step="${index}" ${answer ? "" : "disabled"}>
            ${escapeHtml(step.nextLabel || "继续")}
            <i aria-hidden="true">→</i>
          </button>
        </div>
      </section>
    `;
  }

  function tuneMarkup(step, index) {
    const controls = (step.controls || []).map((control) => {
      const value = Number(state.controls[control.id] ?? control.value ?? control.min ?? 0);
      return `
        <label class="lab-control">
          <span>${escapeHtml(control.label)}</span>
          <output data-output="${escapeHtml(control.id)}">${value}</output>
          <input
            type="range"
            min="${Number(control.min ?? 0)}"
            max="${Number(control.max ?? 100)}"
            step="${Number(control.step ?? 1)}"
            value="${value}"
            aria-label="${escapeHtml(control.label)}"
            data-control="${escapeHtml(control.id)}"
            data-step="${index}"
          />
        </label>
      `;
    }).join("");

    return `
      <section class="lab-step" data-step-section="${index}">
        <header>
          <small>${escapeHtml(step.eyebrow || "自己调一调")}</small>
          <h2>${escapeHtml(step.title)}</h2>
          ${step.description ? `<p>${escapeHtml(step.description)}</p>` : ""}
        </header>
        <div class="lab-controls">${controls}</div>
        <div class="lab-step-action">
          <span>以页面里的真实感受为准，不需要追求某个固定数值。</span>
          <button type="button" data-action="next" data-step="${index}">
            ${escapeHtml(step.nextLabel || "调好了，继续")}
            <i aria-hidden="true">→</i>
          </button>
        </div>
      </section>
    `;
  }

  function verifyMarkup(step, index) {
    const items = (step.items || []).map((item) => `
      <button
        class="lab-check ${state.checks[item.id] ? "is-active" : ""}"
        type="button"
        data-action="check"
        data-step="${index}"
        data-value="${escapeHtml(item.id)}"
        aria-pressed="${Boolean(state.checks[item.id])}"
      >
        <i aria-hidden="true">✓</i>
        <span>${escapeHtml(item.label)}</span>
      </button>
    `).join("");
    const ready = (step.items || []).length > 0 && (step.items || []).every((item) => state.checks[item.id]);

    return `
      <section class="lab-step" data-step-section="${index}">
        <header>
          <small>${escapeHtml(step.eyebrow || "最后检查")}</small>
          <h2>${escapeHtml(step.title)}</h2>
          ${step.description ? `<p>${escapeHtml(step.description)}</p>` : ""}
        </header>
        <div class="lab-checks">${items}</div>
        <div class="lab-step-action">
          <span>${ready ? "已经通过你的检查。" : "只选择你在页面里真正感受到的结果。"}</span>
          <button type="button" data-action="finish" data-step="${index}" ${ready ? "" : "disabled"}>
            ${escapeHtml(step.nextLabel || "完成这次练习")}
            <i aria-hidden="true">→</i>
          </button>
        </div>
      </section>
    `;
  }

  function stepMarkup(step, index) {
    if (step.type === "choice") return choiceMarkup(step, index);
    if (step.type === "tune") return tuneMarkup(step, index);
    if (step.type === "verify") return verifyMarkup(step, index);
    return "";
  }

  function resultMarkup() {
    if (!state.completed) return "";
    const summary = typeof scenario.result === "function"
      ? scenario.result(state)
      : "请按照这次选择修改当前项目，并让用户重新验收。";
    return `
      <section class="lab-result" aria-live="polite">
        <div>
          <small>本地互动已经完成</small>
          <h2>${escapeHtml(scenario.resultTitle || "现在可以回到真实项目了")}</h2>
          <p>${escapeHtml(scenario.resultDescription || "结果只保存在当前链接中。")}</p>
        </div>
        <button type="button" data-action="copy-result" data-copy="${escapeHtml(summary)}">复制给 Agent</button>
      </section>
    `;
  }

  function renderPreview() {
    const preview = document.querySelector("[data-preview]");
    if (!preview) return;
    const shadow = preview.shadowRoot || preview.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          display: block;
          color: var(--lab-text);
          font: inherit;
        }
        *, *::before, *::after { box-sizing: border-box; }
        button, input, select, textarea { font: inherit; }
        ${scenario.styles || ""}
      </style>
      <div class="vibehub-preview-root">${scenario.preview(state)}</div>
    `;
  }

  function render() {
    document.documentElement.style.setProperty("--lab-brand", scenario.brand || "#3f62df");
    document.title = `${scenario.title}｜VibeHub 本地互动`;

    root.innerHTML = `
      <header class="lab-topbar">
        <a href="${escapeHtml(scenario.projectUrl || "#")}" ${scenario.projectUrl ? "" : "aria-disabled=\"true\""}>
          <img class="lab-logo" src="./vibehub-logo.png" alt="" width="24" height="24">
          <b>VibeHub</b>
        </a>
        <button type="button" data-action="reset">重新开始</button>
      </header>
      <main class="lab-shell">
        <section class="lab-intro">
          <small>${escapeHtml(scenario.context || "当前项目")}</small>
          <h1>${escapeHtml(scenario.title)}</h1>
          <p>${escapeHtml(scenario.description || "")}</p>
          ${conceptsMarkup()}
          <ol>${progressMarkup()}</ol>
        </section>
        <section class="lab-preview" aria-label="${escapeHtml(scenario.previewLabel || "项目预览")}">
          <header>
            <span>${escapeHtml(scenario.previewLabel || "项目预览")}</span>
            <b>${escapeHtml(scenario.previewHint || "根据你的选择实时变化")}</b>
          </header>
          <div
            class="lab-preview-stage ${scenario.previewMode === "flush" ? "is-flush" : "is-inset"}"
            data-preview
          ></div>
        </section>
        <div class="lab-steps">
          ${scenario.steps.map((step, index) => index <= state.activeStep ? stepMarkup(step, index) : "").join("")}
        </div>
        ${resultMarkup()}
      </main>
      ${conceptPanelMarkup()}
    `;
    renderPreview();
  }

  function clearAfter(stepIndex) {
    state.completed = false;
    for (let index = stepIndex + 1; index < scenario.steps.length; index += 1) {
      const step = scenario.steps[index];
      if (step.type === "choice") delete state.answers[step.id];
      if (step.type === "verify") {
        for (const item of step.items || []) delete state.checks[item.id];
      }
    }
    history.replaceState(null, "", location.pathname);
  }

  function moveNext(stepIndex) {
    state.activeStep = Math.min(scenario.steps.length - 1, stepIndex + 1);
    render();
    requestAnimationFrame(() => {
      document.querySelector(`[data-step-section="${state.activeStep}"]`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  root.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const stepIndex = Number(button.dataset.step || 0);

    if (action === "choose") {
      clearAfter(stepIndex);
      state.activeStep = stepIndex;
      state.answers[button.dataset.stepId] = button.dataset.value;
      render();
      return;
    }

    if (action === "check") {
      clearAfter(stepIndex);
      state.activeStep = stepIndex;
      const itemId = button.dataset.value;
      state.checks[itemId] = !state.checks[itemId];
      render();
      return;
    }

    if (action === "next") {
      moveNext(stepIndex);
      return;
    }

    if (action === "finish") {
      state.completed = true;
      const summary = typeof scenario.result === "function" ? scenario.result(state) : "";
      const payload = encodeResult({
        v: 1,
        answers: state.answers,
        controls: state.controls,
        checks: state.checks,
        summary,
      });
      history.replaceState(null, "", `${location.pathname}#result=${payload}`);
      render();
      return;
    }

    if (action === "copy-result") {
      try {
        await navigator.clipboard.writeText(button.dataset.copy || "");
        button.textContent = "已复制";
      } catch {
        button.textContent = "复制失败";
      }
      return;
    }

    if (action === "open-concept") {
      state.openConcept = button.dataset.concept || "";
      render();
      return;
    }

    if (action === "close-concept") {
      state.openConcept = "";
      render();
      return;
    }

    if (action === "reset") {
      location.hash = "";
      location.reload();
    }
  });

  root.addEventListener("input", (event) => {
    const input = event.target.closest("input[data-control]");
    if (!input) return;
    const stepIndex = Number(input.dataset.step || 0);
    clearAfter(stepIndex);
    state.activeStep = stepIndex;
    state.controls[input.dataset.control] = Number(input.value);
    document.querySelector(`[data-output="${input.dataset.control}"]`).textContent = input.value;
    renderPreview();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !state.openConcept) return;
    state.openConcept = "";
    render();
  });

  restoreResult();
  render();
})();
