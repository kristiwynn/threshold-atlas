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
  return { data, wilson, bars, nav, footer, stats, API };
})();
