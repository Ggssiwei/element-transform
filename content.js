(() => {
  if (window.__elementTransformLoaded) return;
  window.__elementTransformLoaded = true;

  const HOST_ID = "element-transform-host";
  const STYLE_ID = "element-transform-style";
  const MIN_SCALE = 0.05;
  const MAX_SCALE = 10;
  const DEFAULT_TRANSFORM = {
    rotate: 0,
    scale: 1,
    flipH: false,
    flipV: false,
    flipAxis: 0,
    flipAlongAxis: false,
  };

  const transforms = new WeakMap();
  const tracked = new Set();

  let pickMode = false;
  let selected = null;
  let hoverEl = null;
  let host = null;
  let shadow = null;
  let dragging = null;

  function defaultTransform() {
    return { ...DEFAULT_TRANSFORM };
  }

  function getTransform(el) {
    if (!transforms.has(el)) transforms.set(el, defaultTransform());
    return transforms.get(el);
  }

  function clampScale(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, n));
  }

  function clampAngle(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return n;
  }

  function buildCss(t) {
    const hx = t.flipH ? -1 : 1;
    const hy = t.flipV ? -1 : 1;
    const ay = t.flipAlongAxis ? -1 : 1;
    return `rotate(${t.rotate}deg) scale(${t.scale}) rotate(${t.flipAxis}deg) scale(1, ${ay}) rotate(${-t.flipAxis}deg) scale(${hx}, ${hy})`;
  }

  function tokenFor(el) {
    if (!el.dataset.etToken) {
      el.dataset.etToken = `et-${Math.random().toString(36).slice(2, 10)}`;
    }
    return el.dataset.etToken;
  }

  function ensureStyleTag() {
    let tag = document.getElementById(STYLE_ID);
    if (!tag) {
      tag = document.createElement("style");
      tag.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(tag);
    }
    return tag;
  }

  function rewriteStylesheet() {
    const tag = ensureStyleTag();
    const rules = [];
    for (const el of tracked) {
      if (!el.isConnected) continue;
      const token = el.dataset.etToken;
      if (!token) continue;
      const css = buildCss(getTransform(el));
      const sel = `[data-et-token="${token}"]`;
      rules.push(
        `${sel}, ${sel}:fullscreen, ${sel}:-webkit-full-screen, ${sel}:-moz-full-screen { transform: ${css} !important; transform-origin: 50% 50% !important; }`
      );
    }
    tag.textContent = rules.join("\n");
  }

  function rememberOriginal(el) {
    if (el.dataset.etOrigReady === "1") return;
    el.dataset.etOrigReady = "1";
    el.dataset.etOrigTransform = el.style.transform || "";
    el.dataset.etOrigOrigin = el.style.transformOrigin || "";
  }

  function applyTransform(el) {
    if (!el) return;
    rememberOriginal(el);
    const t = getTransform(el);
    const css = buildCss(t);
    tokenFor(el);
    tracked.add(el);
    el.style.setProperty("transform", css, "important");
    el.style.setProperty("transform-origin", "50% 50%", "important");
    rewriteStylesheet();
    syncFullscreenTarget();
  }

  function clearTransform(el) {
    if (!el) return;
    transforms.delete(el);
    tracked.delete(el);
    if (el.dataset.etOrigReady === "1") {
      el.style.transform = el.dataset.etOrigTransform;
      el.style.transformOrigin = el.dataset.etOrigOrigin;
    } else {
      el.style.removeProperty("transform");
      el.style.removeProperty("transform-origin");
    }
    delete el.dataset.etToken;
    delete el.dataset.etOrigReady;
    delete el.dataset.etOrigTransform;
    delete el.dataset.etOrigOrigin;
    rewriteStylesheet();
  }

  function isOurHost(node) {
    return Boolean(node && (node === host || (host && host.contains(node))));
  }

  function pickFromPoint(x, y) {
    const stack = document.elementsFromPoint(x, y);
    const usable = [];
    for (const el of stack) {
      if (!(el instanceof Element)) continue;
      if (isOurHost(el)) continue;
      if (el === document.documentElement || el === document.body) continue;
      usable.push(el);
    }
    const video = usable.find((el) => el.tagName === "VIDEO");
    if (video) return video;
    return usable[0] || null;
  }

  function describeElement(el) {
    if (!el) return "未选中";
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
      : "";
    const extra = `${id}${cls}`.slice(0, 42);
    return extra ? `${el.tagName.toLowerCase()}${extra}` : el.tagName.toLowerCase();
  }

  function ensureUi() {
    if (host && document.documentElement.contains(host)) return;
    host = document.createElement("div");
    host.id = HOST_ID;
    host.setAttribute(
      "style",
      "all:initial;position:fixed;inset:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none;"
    );
    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
        .overlay {
          position: fixed;
          pointer-events: none;
          border: 2px solid #4ea1ff;
          background: rgba(78, 161, 255, 0.14);
          border-radius: 4px;
          z-index: 1;
          display: none;
        }
        .overlay.selected {
          border-color: #7bffb3;
          background: rgba(123, 255, 179, 0.10);
        }
        .banner {
          position: fixed;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          background: #111827;
          color: #e5edff;
          border: 1px solid #334155;
          border-radius: 999px;
          padding: 8px 16px;
          font-size: 13px;
          z-index: 2;
          display: none;
          pointer-events: none;
          box-shadow: 0 10px 30px rgba(0,0,0,.28);
        }
        .panel {
          position: fixed;
          top: 72px;
          right: 20px;
          width: 320px;
          background: #0f172a;
          color: #e2e8f0;
          border: 1px solid #334155;
          border-radius: 14px;
          box-shadow: 0 18px 50px rgba(0,0,0,.38);
          pointer-events: auto;
          z-index: 3;
          display: none;
          overflow: hidden;
        }
        .head {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: #1e293b;
          cursor: move;
          user-select: none;
        }
        .head h1 {
          margin: 0;
          font-size: 13px;
          font-weight: 650;
          flex: 1;
        }
        .target {
          padding: 0 12px 8px;
          font-size: 12px;
          color: #93c5fd;
          word-break: break-all;
        }
        .body { padding: 0 12px 12px; }
        .row { margin-top: 10px; }
        .label {
          font-size: 12px;
          color: #94a3b8;
          margin-bottom: 6px;
        }
        .controls { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        button, input {
          height: 30px;
          border-radius: 8px;
          border: 1px solid #334155;
          background: #0b1220;
          color: #e2e8f0;
          font-size: 12px;
        }
        button {
          cursor: pointer;
          padding: 0 10px;
          white-space: nowrap;
        }
        button:hover { background: #1e293b; }
        button.active {
          background: #1d4ed8;
          border-color: #3b82f6;
        }
        button.ghost { background: transparent; }
        input {
          width: 72px;
          padding: 0 8px;
          outline: none;
        }
        input:focus { border-color: #60a5fa; }
        .unit { font-size: 12px; color: #94a3b8; }
        .hint { margin-top: 8px; font-size: 11px; color: #64748b; line-height: 1.4; }
      </style>
      <div class="overlay hover" id="hoverBox"></div>
      <div class="overlay selected" id="selectedBox"></div>
      <div class="banner" id="banner">点击页面元素以选中 · Esc 取消</div>
      <div class="panel" id="panel">
        <div class="head" id="dragHandle">
          <h1>元素变换</h1>
          <button class="ghost" id="btnParent" title="选中父元素">父级</button>
          <button class="ghost" id="btnReselect">重选</button>
          <button class="ghost" id="btnClose">关闭</button>
        </div>
        <div class="target" id="targetLabel">未选中</div>
        <div class="body">
          <div class="row">
            <div class="label">旋转</div>
            <div class="controls">
              <button data-rotate="-90">-90°</button>
              <button data-rotate="-15">-15°</button>
              <input id="rotateInput" type="number" step="1" value="0" />
              <span class="unit">°</span>
              <button data-rotate="15">+15°</button>
              <button data-rotate="90">+90°</button>
            </div>
          </div>
          <div class="row">
            <div class="label">翻转</div>
            <div class="controls">
              <span class="unit">轴</span>
              <input id="axisInput" type="number" step="1" value="0" />
              <span class="unit">°</span>
              <button id="btnFlipH">水平</button>
              <button id="btnFlipV">垂直</button>
              <button id="btnFlipAxis">按轴翻转</button>
            </div>
            <div class="hint">0° 为水平轴（上下镜像），90° 为垂直轴（左右镜像），也可输入任意角度。</div>
          </div>
          <div class="row">
            <div class="label">缩放</div>
            <div class="controls">
              <button id="btnScaleDown">−</button>
              <input id="scaleInput" type="number" min="0.05" max="10" step="0.1" value="1" />
              <button id="btnScaleUp">+</button>
              <button id="btnReset">重置变换</button>
            </div>
          </div>
        </div>
      </div>
    `;
    (document.documentElement || document.body).appendChild(host);
    bindUi();
  }

  function $(id) {
    return shadow.getElementById(id);
  }

  function bindUi() {
    $("btnClose").addEventListener("click", () => {
      exitPickMode();
      hidePanel();
      selected = null;
      hoverEl = null;
      updateOverlays();
    });
    $("btnReselect").addEventListener("click", () => enterPickMode());
    $("btnParent").addEventListener("click", selectParent);
    $("btnReset").addEventListener("click", () => {
      if (!selected) return;
      clearTransform(selected);
      transforms.set(selected, defaultTransform());
      syncPanelValues();
      updateOverlays();
    });
    $("btnFlipH").addEventListener("click", () => toggleFlag("flipH"));
    $("btnFlipV").addEventListener("click", () => toggleFlag("flipV"));
    $("btnFlipAxis").addEventListener("click", () => toggleFlag("flipAlongAxis"));
    $("btnScaleDown").addEventListener("click", () => nudgeScale(-0.1));
    $("btnScaleUp").addEventListener("click", () => nudgeScale(0.1));

    shadow.querySelectorAll("[data-rotate]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!selected) return;
        const t = getTransform(selected);
        t.rotate = clampAngle(t.rotate + Number(btn.dataset.rotate));
        applyTransform(selected);
        syncPanelValues();
      });
    });

    ["rotateInput", "axisInput", "scaleInput"].forEach((id) => {
      $(id).addEventListener("input", () => commitInputs());
      $(id).addEventListener("change", () => commitInputs());
    });

    const handle = $("dragHandle");
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      const panel = $("panel");
      const rect = panel.getBoundingClientRect();
      dragging = {
        dx: e.clientX - rect.left,
        dy: e.clientY - rect.top,
      };
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const panel = $("panel");
      panel.style.left = `${Math.max(8, e.clientX - dragging.dx)}px`;
      panel.style.top = `${Math.max(8, e.clientY - dragging.dy)}px`;
      panel.style.right = "auto";
    });
    handle.addEventListener("pointerup", () => {
      dragging = null;
    });
  }

  function commitInputs() {
    if (!selected) return;
    const rotate = parseLooseNumber($("rotateInput").value);
    const axis = parseLooseNumber($("axisInput").value);
    const scale = parseLooseNumber($("scaleInput").value);
    if (rotate === null || axis === null || scale === null) return;
    const t = getTransform(selected);
    t.rotate = clampAngle(rotate);
    t.flipAxis = clampAngle(axis);
    t.scale = clampScale(scale);
    applyTransform(selected);
    syncPanelValues();
  }

  function parseLooseNumber(value) {
    const raw = String(value).trim();
    if (raw === "" || raw === "-" || raw === "." || raw === "-.") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function toggleFlag(key) {
    if (!selected) return;
    const t = getTransform(selected);
    t[key] = !t[key];
    applyTransform(selected);
    syncPanelValues();
  }

  function nudgeScale(delta) {
    if (!selected) return;
    const t = getTransform(selected);
    t.scale = clampScale(Number((t.scale + delta).toFixed(2)));
    applyTransform(selected);
    syncPanelValues();
  }

  function syncPanelValues() {
    if (!selected) return;
    const t = getTransform(selected);
    $("rotateInput").value = String(t.rotate);
    $("axisInput").value = String(t.flipAxis);
    $("scaleInput").value = String(t.scale);
    $("btnFlipH").classList.toggle("active", t.flipH);
    $("btnFlipV").classList.toggle("active", t.flipV);
    $("btnFlipAxis").classList.toggle("active", t.flipAlongAxis);
    $("targetLabel").textContent = describeElement(selected);
    $("btnParent").disabled = !selected.parentElement || selected.parentElement === document.documentElement;
  }

  function placeOverlay(box, el) {
    if (!el || !el.getBoundingClientRect) {
      box.style.display = "none";
      return;
    }
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) {
      box.style.display = "none";
      return;
    }
    box.style.display = "block";
    box.style.left = `${r.left}px`;
    box.style.top = `${r.top}px`;
    box.style.width = `${r.width}px`;
    box.style.height = `${r.height}px`;
  }

  function updateOverlays() {
    if (!shadow) return;
    placeOverlay($("hoverBox"), pickMode ? hoverEl : null);
    placeOverlay($("selectedBox"), selected);
  }

  function showPanel() {
    $("panel").style.display = "block";
  }

  function hidePanel() {
    $("panel").style.display = "none";
  }

  function enterPickMode() {
    ensureUi();
    pickMode = true;
    $("banner").style.display = "block";
    document.documentElement.style.cursor = "crosshair";
  }

  function exitPickMode() {
    pickMode = false;
    hoverEl = null;
    if (shadow) $("banner").style.display = "none";
    document.documentElement.style.cursor = "";
    updateOverlays();
  }

  function selectElement(el) {
    if (!el) return;
    selected = el;
    getTransform(el);
    exitPickMode();
    showPanel();
    syncPanelValues();
    updateOverlays();
    try {
      chrome.runtime.sendMessage({ type: "et-frame-selected" });
    } catch (_) {
      /* ignore */
    }
  }

  function selectParent() {
    if (!selected) return;
    let parent = selected.parentElement;
    while (parent && (parent === document.body || isOurHost(parent))) {
      parent = parent.parentElement;
    }
    if (parent && parent !== document.documentElement) selectElement(parent);
  }

  function onPointerMove(e) {
    if (!pickMode) return;
    hoverEl = pickFromPoint(e.clientX, e.clientY);
    updateOverlays();
  }

  let suppressClick = false;

  function onPickPointer(e) {
    if (e.type === "click" && suppressClick) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      suppressClick = false;
      return;
    }
    if (!pickMode) return;
    if (isOurHost(e.target)) return;
    const el = pickFromPoint(e.clientX, e.clientY);
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (e.type === "pointerdown") suppressClick = true;
    selectElement(el);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      if (pickMode) {
        exitPickMode();
        if (!selected) hidePanel();
      }
    }
  }

  function syncFullscreenTarget() {
    if (!selected || !tracked.has(selected)) return;
    applyInline(selected);

    const fs =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement;
    if (fs && selected.tagName === "VIDEO") {
      const videos = new Set();
      if (fs.tagName === "VIDEO") videos.add(fs);
      if (typeof fs.querySelectorAll === "function") {
        fs.querySelectorAll("video").forEach((video) => videos.add(video));
      }
      const source = getTransform(selected);
      for (const video of videos) {
        if (video === selected) continue;
        transforms.set(video, { ...source });
        rememberOriginal(video);
        tokenFor(video);
        tracked.add(video);
        applyInline(video);
      }
    }
    rewriteStylesheet();
  }

  function applyInline(el) {
    rememberOriginal(el);
    const css = buildCss(getTransform(el));
    el.style.setProperty("transform", css, "important");
    el.style.setProperty("transform-origin", "50% 50%", "important");
  }

  function onFullscreenChange() {
    syncFullscreenTarget();
    updateOverlays();
  }

  function onTogglePick() {
    ensureUi();
    if (pickMode) {
      exitPickMode();
      return;
    }
    enterPickMode();
  }

  document.addEventListener("et:toggle-pick", onTogglePick, true);
  document.addEventListener("et:exit-pick", () => exitPickMode(), true);
  document.addEventListener("pointermove", onPointerMove, true);
  document.addEventListener("pointerdown", onPickPointer, true);
  document.addEventListener("click", onPickPointer, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("fullscreenchange", onFullscreenChange, true);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange, true);
  window.addEventListener("resize", updateOverlays);
  window.addEventListener("scroll", updateOverlays, true);

  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === "et:toggle-pick") onTogglePick();
      if (msg?.type === "et:exit-pick") exitPickMode();
    });
  }

  let observerTimer = 0;
  const observer = new MutationObserver(() => {
    if (host && selected && !document.documentElement.contains(host)) {
      host = null;
      shadow = null;
      ensureUi();
      showPanel();
      syncPanelValues();
    }
    window.clearTimeout(observerTimer);
    observerTimer = window.setTimeout(() => {
      if (selected && !selected.isConnected) {
        selected = null;
        hidePanel();
      }
      for (const el of [...tracked]) {
        if (!el.isConnected) tracked.delete(el);
      }
      rewriteStylesheet();
      updateOverlays();
    }, 80);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
