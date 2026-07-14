// AI Governance concept overlay with a guided step-by-step tour state machine.
(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const isTour = params.get("tour") === "1";
  const stepIdx = Math.max(0, parseInt(params.get("step") || "0", 10) - 1); // 0-based index

  const PAGE = window.__OVERLAY_PAGE__ || "list";
  const FILE = {
    list: "/real/list.html",
    overview: "/real/overview.html",
    logs: "/real/logs.html",
    analytics: "/real/analytics.html",
    firewall: "/real/firewall.html",
    "provider-keys": "/real/providerkeys.html",
    "dynamic-routes": "/real/routes.html",
    "routes-editor": "/real/routes-editor.html",
    "routes-versions": "/real/routes-versions.html",
    settings: "/real/settings.html",
    deploy: "/#connectCard",
    spa: "/",
  };
  const TAB_NAV = {
    Overview: "overview",
    Logs: "logs",
    Analytics: "analytics",
    Firewall: "firewall",
    "Provider Keys": "provider-keys",
    "Dynamic Routes": "dynamic-routes",
    Settings: "settings",
  };
  const tabRegion = (r) => r.top >= 55 && r.top <= 150 && r.left > 250;
  const sideRegion = (r) => r.left < 260;

  // ---- Tour Steps Definition ----
  const STEPS = [
    {
      page: "list",
      find: "skyflash-ai",
      exact: true,
      side: "left",
      tone: "good",
      tag: "Gateway List",
      title: "Active Sanctioned Gateways",
      body: "This is your active gateway list, a portfolio overview of your AI applications with realistic traffic data patched in. Use Next Step to walk through the primary support gateway.",
    },
    {
      page: "analytics",
      find: "Requests",
      exact: true,
      region: (r) => r.top >= 150 && r.top <= 330,
      side: "below",
      tone: "good",
      tag: "Analytics",
      title: "Real-time Metrics",
      body: "Your analytics dashboard aggregates requests, tokens, costs, and cache status in real-time. Notice how our 37% cache hit rate directly avoids provider spend.",
    },
    {
      page: "analytics",
      find: "Cost",
      exact: true,
      region: (r) => r.top >= 150 && r.top <= 330,
      side: "above",
      tone: "good",
      tag: "FinOps",
      title: "Cost Avoided",
      body: "Our custom charts visualize billed cost versus what was saved by caching, giving you a measurable FinOps outcome to report directly to finance."
    },
    {
      page: "logs",
      find: "Model",
      exact: true,
      region: (r) => r.top >= 250 && r.top <= 285 && r.left > 300,
      side: "below",
      tone: "risk",
      tag: "Logs",
      title: "The Compliance Audit Trail",
      body: "Every request is captured in this log table with its full metadata: timestamp, model, status, tokens, cost, and any DLP action taken. Expanding a row reveals the prompt, response, and policy enforcement, satisfying your audit obligations under the EU AI Act."
    },
    {
      page: "firewall",
      find: "Guardrails",
      exact: true,
      side: "left",
      tone: "good",
      tag: "Safety",
      title: "Active Content Guardrails",
      body: "Guardrails scan prompts and responses for hate speech, violence, and injection attacks in real-time, blocking unsafe interactions before they occur."
    },
    {
      page: "firewall",
      find: "Data Loss Prevention (DLP)",
      exact: false,
      side: "left",
      tone: "risk",
      tag: "DLP",
      title: "Data Loss Prevention (DLP)",
      body: "DLP scans both input and output content, preventing names, SSNs, secrets, and credentials from escaping to external models."
    },
    {
      page: "routes-editor",
      find: "usergroup == c-level",
      exact: false,
      side: "left",
      tone: "good",
      tag: "Routing",
      title: "Policy-Based Routing",
      body: "Enforce cost and compliance policies programmatically. Here we split traffic: premium models are granted only to C-level users, while others route to cost-capped models on Workers AI."
    },
    {
      page: "routes-editor",
      find: "100 US",
      exact: false,
      side: "right",
      tone: "good",
      tag: "Routing",
      title: "Spend Caps & Budgets",
      body: "A hard cap on the fallback model enforces budgets automatically, preventing cost runaways from agentic loops."
    },
    {
      page: "routes-editor",
      find: "Versions",
      exact: true,
      region: (r) => r.top < 170 && r.left > 250,
      side: "below",
      tone: "info",
      tag: "Audit",
      title: "Policy Versioning",
      body: "Every routing-policy change is versioned with deploy / rollback — providing an auditable record of who changed enforcement and when."
    }
  ];

  // ---- find an element by visible text ----
  function findEl(text, exact, region) {
    const all = document.querySelectorAll("a,button,span,div,h1,h2,h3,p,td,th,li");
    let best = null, bestLen = Infinity;
    for (const el of all) {
      if (el.closest("#gov-layer") || el.closest("#gov-panel") || el.closest("#gov-tour-panel")) continue;
      const t = (el.textContent || "").trim();
      if (!t) continue;
      const ok = exact ? t === text : t.includes(text);
      if (!ok) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (region && !region(r)) continue;
      if (t.length < bestLen) { best = el; bestLen = t.length; }
    }
    return best;
  }

  let layer, svg, panel, on = true;
  const items = [];

  function build() {
    layer = document.createElement("div");
    layer.id = "gov-layer";
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "gov-lines";
    layer.appendChild(svg);
    document.body.appendChild(layer);

    if (!isTour) {
      // Non-tour mode: build static sidebar hotspots for Rung 3 and Rung 1
      const sidebarHots = [
        { find: "Models", exact: true, region: sideRegion, to: "spa", label: "Governance" },
        { find: "AI Gateway", exact: true, region: sideRegion, to: "list", label: "Real UI" },
        { find: "Workers AI", exact: true, region: sideRegion, to: "deploy", label: "Provision" },
      ];
      // Map tabs on details page
      const tabs = Object.entries(TAB_NAV).filter(([, pg]) => pg !== PAGE).map(([txt, pg]) => ({ find: txt, exact: true, region: tabRegion, to: pg, label: "Tab" }));
      const listHots = PAGE === "list" ? [{ find: "skyflash-ai", exact: true, to: "overview", label: "Open" }, { find: "Create Gateway", exact: false, to: "deploy", label: "Deploy" }] : [];
      const dRouteHots = PAGE === "dynamic-routes" ? [{ find: "execs", exact: false, to: "routes-editor", label: "Open route" }] : [];
      const rEditorHots = PAGE === "routes-editor" ? [{ find: "Dynamic Routes", exact: true, region: (r) => r.top < 150, to: "dynamic-routes", label: "Back" }, { find: "Versions", exact: true, region: (r) => r.top < 170 && r.left > 250, to: "routes-versions", label: "Versions" }] : [];
      const rVersHots = PAGE === "routes-versions" ? [{ find: "Editor", exact: true, region: (r) => r.top < 170 && r.left > 250, to: "routes-editor", label: "Editor" }, { find: "Dynamic Routes", exact: true, region: (r) => r.top < 150, to: "dynamic-routes", label: "Back" }] : [];

      const hots = sidebarHots.concat(tabs).concat(listHots).concat(dRouteHots).concat(rEditorHots).concat(rVersHots);

      for (const hreq of hots) {
        const anchor = findEl(hreq.find, hreq.exact, hreq.region);
        if (!anchor) continue;
        const hot = document.createElement("div");
        hot.className = "gov-hot";
        hot.innerHTML = `<span class="hl">${hreq.label || "Click"}</span>`;
        hot.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); location.href = FILE[hreq.to]; });
        layer.appendChild(hot);
        items.push({ cfg: hreq, type: "hot", anchor, hot });
      }
      layout();
      return;
    }

    // Tour mode: Find the active step
    const step = STEPS[stepIdx];
    if (step && step.page === PAGE) {
      const anchor = findEl(step.find, step.exact, step.region);
      if (anchor) {
        const bubble = document.createElement("div");
        bubble.className = "gov-bubble " + (step.tone === "risk" ? "risk" : step.tone === "good" ? "good" : "");
        bubble.innerHTML = `<div class="gh">${step.title}<span class="tag">${step.tag || "Concept"}</span></div><div class="gb">${step.body}</div>`;
        layer.appendChild(bubble);

        const ring = document.createElement("div");
        ring.className = "gov-anchor " + (step.tone === "risk" ? "risk" : "");
        layer.appendChild(ring);

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("stroke", step.tone === "risk" ? "#dc2626" : step.tone === "good" ? "#059669" : "#7c3aed");
        line.setAttribute("stroke-width", "1.5");
        line.setAttribute("stroke-dasharray", "4 3");
        svg.appendChild(line);

        items.push({ cfg: step, type: "ann", anchor, bubble, ring, line });
      }

      // If the step has a hotspot trigger
      if (step.hotspot) {
        const hAnchor = findEl(step.hotspot.find, step.hotspot.exact);
        if (hAnchor) {
          const hot = document.createElement("div");
          hot.className = "gov-hot";
          hot.innerHTML = `<span class="hl">${step.hotspot.label || "Click"}</span>`;
          hot.style.zIndex = "9900";
          hot.addEventListener("click", (e) => {
            e.preventDefault(); e.stopPropagation();
            location.href = FILE[step.hotspot.to] + "?tour=1&step=" + step.hotspot.step;
          });
          layer.appendChild(hot);
          items.push({ cfg: step.hotspot, type: "hot", anchor: hAnchor, hot });
        }
      }
    }

    buildTourPanel();
    layout();
  }

  function layout() {
    const W = window.innerWidth, H = window.innerHeight;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    for (const it of items) {
      const r = it.anchor.getBoundingClientRect();
      if (it.type === "hot") {
        const pad = 4;
        it.hot.style.left = r.left - pad + "px";
        it.hot.style.top = r.top - pad + "px";
        it.hot.style.width = r.width + pad * 2 + "px";
        it.hot.style.height = r.height + pad * 2 + "px";
        continue;
      }
      it.ring.style.left = r.left - 3 + "px";
      it.ring.style.top = r.top - 3 + "px";
      it.ring.style.width = r.width + 6 + "px";
      it.ring.style.height = r.height + 6 + "px";

      const BW = 250;
      const side = it.cfg.side || "right";
      let left, top;
      const bh = it.bubble.offsetHeight || 90;
      if (side === "right") { left = r.right + 30; top = r.top - 4; }
      else if (side === "left") { left = r.left - 30 - BW; top = r.top - 4; }
      else if (side === "below") { left = r.left; top = r.bottom + 24; }
      else { left = r.left; top = r.top - 24 - bh; } // above
      left = Math.max(8, Math.min(left, W - BW - 8));
      top = Math.max(8, Math.min(top, H - bh - 8));
      it.bubble.style.left = left + "px";
      it.bubble.style.top = top + "px";

      const ax = side === "right" ? r.right : side === "left" ? r.left : r.left + r.width / 2;
      const ay = r.top + r.height / 2;
      const bx = side === "right" ? left : side === "left" ? left + BW : left + 24;
      const by = top + Math.min(bh / 2, 24);
      it.line.setAttribute("x1", ax); it.line.setAttribute("y1", ay);
      it.line.setAttribute("x2", bx); it.line.setAttribute("y2", by);
    }
  }

  function buildTourPanel() {
    const cur = stepIdx + 1;
    const tot = STEPS.length;
    const step = STEPS[stepIdx];

    const p = document.createElement("div");
    p.id = "gov-tour-panel";
    p.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 280px;
      background: #1c1130;
      color: #fff;
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 12px 30px rgba(28,17,48,0.4);
      z-index: 9999;
      pointer-events: auto;
      font-family: var(--font);
    `;

    let prevBtn = cur > 1 ? `<button class="btn secondary" id="tourPrev" style="padding:6px 12px;font-size:12px;border-color:rgba(0,0,0,0.15);color:#3b2d5e">Prev</button>` : "";
    let nextBtn = "";
    if (cur < tot) {
      if (step && step.hotspot) {
        nextBtn = `<span style="font-size:11px;color:#c4b5fd;font-weight:600">Click the green hotspot</span>`;
      } else {
        nextBtn = `<button class="btn btn-primary" id="tourNext" style="padding:6px 12px;font-size:12px">Next Step</button>`;
      }
    } else {
      nextBtn = `<button class="btn" id="tourEnd" style="padding:6px 12px;font-size:12px;background:var(--orange);color:#fff;border-color:var(--orange)">Deploy (Step 3)</button>`;
    }

    p.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:11px;font-weight:700;color:#c4b5fd;text-transform:uppercase;letter-spacing:0.5px">Interactive Guide · Step ${cur} of ${tot}</span>
        <button id="tourExit" title="Exit to portal" style="flex:0 0 auto;background:transparent;border:1px solid rgba(255,255,255,0.25);color:#ddd6fe;font-size:10.5px;font-weight:600;line-height:1;cursor:pointer;padding:4px 8px;border-radius:6px">Exit &times;</button>
      </div>
      <div style="font-size:13.5px;font-weight:600;margin-bottom:4px;color:#fff">${step ? step.title : "Walkthrough"}</div>
      <div style="font-size:12px;color:#ddd6fe;line-height:1.45;margin-bottom:14px">Use this walkthrough to learn how AI Gateway controls safety, costs, and compliance.</div>
      <div class="row" style="justify-content:space-between;border-top:1px solid rgba(255,255,255,0.12);padding-top:10px">
        ${prevBtn}
        ${nextBtn}
      </div>
    `;
    document.body.appendChild(p);

    p.querySelector("#tourExit").onclick = () => { location.href = "/"; };

    if (cur > 1) {
      p.querySelector("#tourPrev").onclick = () => {
        const prevIdx = stepIdx - 1;
        const prevStep = STEPS[prevIdx];
        location.href = FILE[prevStep.page] + "?tour=1&step=" + (prevIdx + 1);
      };
    }
    if (cur < tot && !(step && step.hotspot)) {
      p.querySelector("#tourNext").onclick = () => {
        const nextIdx = stepIdx + 1;
        const nextStep = STEPS[nextIdx];
        location.href = FILE[nextStep.page] + "?tour=1&step=" + (nextIdx + 1);
      };
    } else if (cur === tot) {
      p.querySelector("#tourEnd").onclick = () => {
        location.href = "/deploy.html";
      };
    }
  }

  function buildPanel() {
    if (isTour) return; // Hide standard toggle panel during tour
    panel = document.createElement("div");
    panel.id = "gov-panel";
    panel.innerHTML = `
      <div class="pt"><span class="dotv"></span>AI Governance overlay</div>
      <div class="ps">Interactive visual overlay describing policy, compliance, and cost outcomes.</div>
      <div class="prow"><span>Show overlay</span><span class="gov-switch on" id="govSwitch"></span></div>
      <div class="legend">
        <div class="lg"><span class="sw concept"></span>Governance insight (concept)</div>
        <div class="lg"><span class="sw hot"></span>Clickable in this demo</div>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector("#govSwitch").addEventListener("click", toggle);
  }

  function toggle() {
    on = !on;
    layer.classList.toggle("gov-hidden", !on);
    panel.querySelector("#govSwitch").classList.toggle("on", on);
  }

  function neutralise() {
    document.addEventListener("click", (e) => {
      const t = e.target.closest("a,button");
      if (!t) return;
      if (t.closest("#gov-layer") || t.closest("#gov-panel") || t.closest("#gov-tour-panel")) return;
      e.preventDefault();
    }, true);
  }

  // ===== inject the synthetic sample data into the real backdrop =====
  const MODEL_COLORS = { "gpt-4o-mini": "#f6821f", "gpt-4o": "#4a7ef0", "claude-3-5-sonnet": "#8a7cf0", "@cf/meta/llama-3.3-70b": "#14b8a6" };
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  const NUMRE = /^\$?[\d.,]+\s*[%kKmMbB]?$/;
  function setMetric(label, val, region) {
    const lab = findEl(label, true, region);
    if (!lab) return false;
    let node = lab;
    for (let up = 0; up < 4 && node; up++, node = node.parentElement) {
      const cands = [...node.querySelectorAll("*")].filter((e) => {
        const t = (e.textContent || "").trim();
        return e !== lab && !e.contains(lab) && e.children.length === 0 && NUMRE.test(t);
      });
      if (cands.length) { cands[0].textContent = val; return true; }
    }
    return false;
  }
  function replaceLeaf(oldText, newText) {
    for (const e of document.querySelectorAll("span,div,td,p,b,strong")) {
      if (e.children.length === 0 && (e.textContent || "").trim() === oldText) { e.textContent = newText; return true; }
    }
    return false;
  }
  function patchRow(anchorText, replacements) {
    const el = findEl(anchorText, true);
    if (!el) return;
    let container = el;
    // climb to the gateway row card container
    for (let i = 0; i < 5 && container; i++, container = container.parentElement) {
      const rect = container.getBoundingClientRect();
      if (rect.height > 50 && rect.height < 240 && container.querySelectorAll) {
        break;
      }
    }
    if (!container) return;
    for (const [oldVal, newVal] of Object.entries(replacements)) {
      for (const node of container.querySelectorAll("*")) {
        if (node.children.length === 0 && (node.textContent || "").trim() === oldVal) {
          node.textContent = newVal;
        }
      }
    }
  }

  function chartScales(money, small) {
    return {
      x: { stacked: true, grid: { display: false }, ticks: { maxTicksLimit: small ? 4 : 8, font: { size: 9 }, color: "#a1a1aa" } },
      y: { stacked: true, beginAtZero: true, grid: { color: "#f0f0f2" }, ticks: { maxTicksLimit: 5, font: { size: 9 }, color: "#a1a1aa", callback: (v) => (money ? "$" + v : v >= 1e6 ? v / 1e6 + "M" : v >= 1e3 ? v / 1e3 + "k" : v) } },
    };
  }
  function specFor(metric, sx) {
    const labels = sx.labels;
    let datasets = [];
    if (metric === "cached") {
      const miss = sx.labels.map((_, i) => sx.models.reduce((a, m) => a + sx.series[m.id].cacheMiss[i], 0));
      const hit = sx.labels.map((_, i) => sx.models.reduce((a, m) => a + sx.series[m.id].cacheHit[i], 0));
      datasets = [{ label: "Miss", data: miss, backgroundColor: "#f6821f", stack: "s" }, { label: "Hit", data: hit, backgroundColor: "#18a957", stack: "s" }];
    } else if (metric === "errors") {
      datasets = [{ label: "Errors", data: sx.labels.map((_, i) => sx.models.reduce((a, m) => a + sx.series[m.id].errors[i], 0)), backgroundColor: "#f3766a", stack: "s" }];
    } else {
      const key = metric;
      datasets = sx.models.map((m) => ({ label: m.label, data: sx.series[m.id][key], backgroundColor: MODEL_COLORS[m.id] || "#999", stack: "s" }));
    }
    return { type: "bar", data: { labels, datasets }, options: { responsive: false, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: chartScales(metric === "cost", true) } };
  }
  function headerEl(text, minTop) {
    let best = null, len = 1e9;
    for (const e of document.querySelectorAll("div,span,h2,h3,p")) {
      if ((e.textContent || "").trim() === text) {
        const r = e.getBoundingClientRect();
        if (r.top > minTop && (e.textContent || "").length < len) { best = e; len = (e.textContent || "").length; }
      }
    }
    return best;
  }
  function climbToPanel(hd) {
    let n = hd;
    const anc = [];
    for (let i = 0; i < 7 && n; i++, n = n.parentElement) {
      const wc = n.querySelectorAll ? n.querySelectorAll(".recharts-wrapper").length : 0;
      const r = n.getBoundingClientRect();
      anc.push({ el: n, wc, area: r.width * r.height, h: r.height });
    }
    const one = anc.filter((a) => a.wc === 1).sort((a, b) => a.area - b.area);
    if (one.length) return { panel: one[0].el, wrap: one[0].el.querySelector(".recharts-wrapper") };
    const zero = anc.filter((a) => a.wc === 0 && a.h > 120 && a.h < 540).sort((a, b) => a.area - b.area);
    if (zero.length) return { panel: zero[0].el, wrap: null };
    return { panel: hd.parentElement, wrap: null };
  }
  function mountCharts(sx) {
    const order = [["requests", "Requests"], ["tokens", "Tokens"], ["cost", "Cost"], ["errors", "Errors"], ["cached", "Cached"]];
    for (const [metric, header] of order) {
      const hd = headerEl(header, 280);
      if (!hd) continue;
      const { panel, wrap } = climbToPanel(hd);
      let host, w, h;
      if (wrap) {
        const svg = wrap.querySelector("svg");
        w = (svg ? svg.clientWidth : wrap.clientWidth) || 340;
        h = (svg ? svg.clientHeight : wrap.clientHeight) || 168;
        wrap.querySelectorAll("svg").forEach((s) => (s.style.opacity = "0"));
        wrap.style.position = "relative";
        host = wrap;
      } else {
        const err = [...panel.querySelectorAll("div")].find((e) => /error fetching/i.test(e.textContent || "") && e.children.length <= 3);
        w = Math.min((panel.clientWidth || 380) - 32, 360);
        h = 168;
        host = document.createElement("div");
        host.style.cssText = `position:relative;height:${h}px;margin:10px 16px 16px;`;
        if (err) err.replaceWith(host); else panel.appendChild(host);
      }
      const cv = document.createElement("canvas");
      cv.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;`;
      cv.width = w; cv.height = h;
      host.appendChild(cv);
      try { new window.Chart(cv, specFor(metric, sx)); } catch (e) {}
    }
    for (const e of document.querySelectorAll("span,div,p")) {
      const t = (e.textContent || "").trim();
      if (e.children.length === 0 && /^(workers-ai|@cf|.*moonshotai|.*kimi-k2|.*llama-guard|Miss|Hit)/i.test(t) && t.length < 40) {
        (e.parentElement || e).style.visibility = "hidden";
      }
    }
    replaceLeaf("Miss 140", "Miss 1.37M");
    replaceLeaf("Hit 0", "Hit 828k");
  }

  async function injectData() {
    try {
      if (PAGE === "list") {
        setMetric("Requests", "2.41M", (r) => r.top < 320);
        setMetric("Tokens", "1.76B", (r) => r.top < 320);
        setMetric("Costs", "$3.14k", (r) => r.top < 320);
        setMetric("Logs stored", "4.88M", (r) => r.top < 320);
        [["140", "1.36M"], ["464.78k", "898M"], ["$0.38", "$1.31k"], ["45.71% Errors", "0.30% Errors"], ["3.21k Logs", "1.36M Logs"]].forEach(([o, n]) => replaceLeaf(o, n));
        
        // patch other gateways to look busy and active (Rung 2 index)
        patchRow("are-you-ai-demo", { "0": "28.4k", "0% Errors": "0.14% Errors", "8.68k Logs": "28.4k Logs" });
        patchRow("beyond-rag", { "0": "392.1k", "$0.00": "$514.80", "35 Logs": "392.1k Logs" });
        patchRow("northwind-agent-gateway", { "0": "18.4k", "61 Logs": "18.4k Logs" });
        patchRow("music-store-llm-assistant", { "0": "2.1k", "26 Logs": "2.1k Logs" });
        patchRow("developer-demos", { "4": "48.2k", "325 Logs": "48.2k Logs" });
      } else if (PAGE === "overview") {
        const topReg = (r) => r.top < 340;
        setMetric("Requests", "84.6k", topReg);
        setMetric("Tokens", "42.1M", topReg);
        setMetric("Cost", "$108.40", topReg);
        setMetric("Errors", "26", topReg);
      } else if (PAGE === "analytics") {
        const tabReg = (r) => r.top >= 150 && r.top <= 330;
        setMetric("Requests", "2.20M", tabReg);
        setMetric("Tokens", "1.76B", tabReg);
        setMetric("Cost", "$3.14k", tabReg);
        setMetric("Errors", "6.8k", tabReg);
        setMetric("Cached", "828k", tabReg);
        const sx = await fetch("/api/analytics-series?range=30d").then((r) => r.json());
        await loadScript("https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js");
        setTimeout(() => mountCharts(sx), 100);
      }
    } catch (e) { /* non-fatal */ }
  }

  function start() {
    neutralise();
    buildPanel();
    build();
    injectData();
    let raf = 0;
    const relayout = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); };
    window.addEventListener("scroll", relayout, { passive: true });
    window.addEventListener("resize", relayout);
    setTimeout(layout, 300);
    setTimeout(layout, 900);
    // trigger a clean transition once the DOM patches and charts settle
    setTimeout(() => {
      document.body.classList.add("gov-loaded");
    }, 150);
  }

  if (document.readyState === "complete" || document.readyState === "interactive") setTimeout(start, 50);
  else window.addEventListener("DOMContentLoaded", start);
})();
