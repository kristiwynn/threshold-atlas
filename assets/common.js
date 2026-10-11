// Shared helpers: data loading, Wilson confidence intervals, bar charts.
window.TA = (() => {
  const API = "https://threshold-atlas-api.thresholdatlas.workers.dev";
  const cache = {};
  async function data(name) {
    if (!cache[name]) cache[name] = fetch(`data/${name}.json`).then(r => r.json());
    return cache[name];
  }
  // Wilson 95% interval for a proportion p (0..1) with sample size n. Returns [lo, hi] in percent.
  function wilson(p, n) {
    if (!n) return [null, null];
    const z = 1.96, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
    return [100 * (c - m) / d, 100 * (c + m) / d];
  }
  // rows: [label, pct, {n, color, note}]
  function bars(el, rows) {
    el.innerHTML = rows.map(([lab, val, o = {}]) => {
      const [lo, hi] = o.n ? wilson(val / 100, o.n) : [null, null];
      const ci = lo != null ? `<span class="ci" style="left:${lo}%;width:${Math.max(0, hi - lo)}%"></span>` : "";
      const vtxt = val == null ? "–" : `<b>${Math.round(val * 10) / 10}%</b>` + (lo != null ? ` <span title="95% confidence interval">${Math.round(lo)}–${Math.round(hi)}</span>` : "") + (o.n ? ` <span title="sample size">n=${o.n}</span>` : "");
      return `<div class="bar"><span class="lab">${lab}</span><span class="track"><span class="fill" style="width:${Math.max(0, Math.min(100, val || 0))}%;background:var(--${o.color || "c1"})"></span>${ci}</span><span class="val">${vtxt}</span></div>`;
    }).join("");
  }
  function nav(current) {
    const links = [["index.html", "Map"], ["patterns.html", "Patterns"], ["accounts.html", "Accounts"], ["stories.html", "Shared here"], ["world.html", "World"], ["share.html", "Share yours"], ["sources.html", "Sources"]];
    return `<nav class="top"><a class="brand" href="index.html">The Threshold Atlas</a>${links.map(([h, t]) => `<a href="${h}" ${h === current ? 'aria-current="page"' : ""}>${t}</a>`).join("")}</nav>`;
  }
  function footer() {
    return `<footer>Every number on this site is taken from a published study and cited on the <a href="sources.html">Sources</a> page. Community accounts, when they arrive, are shown separately and never mixed into the research figures. <a href="https://github.com/kristiwynn/threshold-atlas">Source code</a>.</footer>`;
  }
  async function stats() { try { const r = await fetch(API + "/api/stats"); return r.ok ? await r.json() : null; } catch (e) { return null; } }

  // ------------------------------------------------------------------ the fork
  // Shown when a walk runs out of account. One side is what the source says
  // happened; the other leaves the evidence behind, and says so on every card.
  let BEYOND = null;
  async function beyond() { if (!BEYOND) BEYOND = await data("beyond"); return BEYOND; }

  const esc = x => String(x ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // box: the element the scene sits in. scene: the TAScene handle.
  // afterText: what this source reports happened on the return.
  async function fork(box, scene, afterText, onNote) {
    const b = await beyond(); if (!b) return;
    box.querySelector(".fork")?.remove();
    const el = document.createElement("div"); el.className = "fork";
    el.innerHTML = `<div class="forkin">
      <div class="forkeyebrow">The evidence ends</div>
      <h3>${esc(b.heading)}</h3>
      <p>${esc(b.lede)}</p>
      <div class="forkbtns">
        <button class="primary" data-go="back">${esc(b.back_label)}</button>
        <button class="ghostb" data-go="on">${esc(b.on_label)}</button>
      </div>
      <p class="forkfine"><b>${esc(b.back_label)}:</b> ${esc(b.back_note)} &nbsp;·&nbsp; <b>${esc(b.on_label)}:</b> ${esc(b.on_note)}</p>
    </div>`;
    box.appendChild(el);

    el.addEventListener("click", e => {
      const go = e.target.closest("[data-go]")?.dataset.go;
      if (go === "back") {
        el.querySelector(".forkin").innerHTML = `<div class="forkeyebrow">Reported</div><h3>${esc(b.back_label)}</h3>
          <p>${esc(afterText || "The source records the return and stops there.")}</p>
          <div class="forkbtns"><button class="primary" data-go="again">Walk it again</button><button class="ghostb" data-go="on">${esc(b.on_label)}</button></div>`;
      } else if (go === "on") {
        el.querySelector(".forkin").innerHTML = `<div class="forkeyebrow" style="color:var(--c4)">Past the evidence</div>
          <h3>What has been proposed</h3>
          ${b.groups.map(g => `<div class="forkgroup"><div class="fglabel">${esc(g.name)}</div>
            <p class="fgnote">${esc(g.note)}</p>
            <div class="fgrow">${b.paths.filter(p => p.group === g.id).map(p =>
              `<button data-path="${esc(p.id)}"><b>${esc(p.name)}</b><span>${esc(p.who)}</span></button>`).join("")}</div></div>`).join("")}
          <div class="forkbtns"><button class="ghostb" data-go="again">Walk the account again instead</button></div>`;
      } else if (go === "again") {
        el.remove(); scene.pause(false); scene.next();
      }
      const pid = e.target.closest("[data-path]")?.dataset.path;
      if (pid) {
        const path = b.paths.find(x => x.id === pid); if (!path) return;
        el.remove();
        scene.extend(path.stages);
        onNote && onNote(path, b.groups.find(g => g.id === path.group));
      }
    });
  }

  return { data, wilson, bars, nav, footer, stats, fork, beyond, API };
})();
