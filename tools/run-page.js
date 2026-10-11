// Executes a page's inline scripts against a stub DOM and a stub MapLibre, so a
// runtime error in the map code fails here instead of in front of a reader.
const fs = require("fs"), path = require("path");
const file = process.argv[2], root = path.dirname(path.resolve(file));
const h = fs.readFileSync(file, "utf8");
const markup = h.replace(/<script>[\s\S]*?<\/script>/g, "");
const ids = new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));

const errors = [], warned = new Set();
function mkEl(id) {
  const el = {
    id, _html: "", textContent: "", value: "0", hidden: false, className: "", style: {},
    children: [], options: [], selectedOptions: [{ text: "" }], dataset: {},
    clientWidth: 900, clientHeight: 520, checked: false,
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {},
    getAttribute: () => null, appendChild(c) { this.children.push(c); }, remove() {},
    insertAdjacentHTML(_, v) { this._html += v; }, querySelector: () => null,
    querySelectorAll: () => [], closest: () => null, scrollIntoView() {}, after() {},
    getContext: () => ctx2d, focus() {}, click() {},
  };
  return el;
}
const ctx2d = { createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, beginPath() {}, ellipse() {}, arc() {}, fill() {}, set fillStyle(v) {} };
const pool = {};
global.document = {
  getElementById(id) {
    if (pool[id]) return pool[id];
    if (!ids.has(id) && !warned.has(id)) { warned.add(id); errors.push(`getElementById("${id}") is not in the markup`); }
    return (pool[id] = mkEl(id));
  },
  createElement: () => mkEl("new"),
  querySelector: () => mkEl("q"), querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {}, body: mkEl("body"), documentElement: mkEl("html"),
};
global.window = global; global.devicePixelRatio = 1;
global.addEventListener = () => {}; global.removeEventListener = () => {};
global.matchMedia = () => ({ matches: false });
global.performance = { now: () => 0 };
global.requestAnimationFrame = () => {};
global.location = { hash: "", href: "" };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const mapHandlers = {};
class StubMap {
  constructor(o) { this.o = o; this._src = {}; }
  on(ev, a, b) { (mapHandlers[ev] = mapHandlers[ev] || []).push(typeof a === "function" ? a : b); }
  addControl() {} addSource(id, s) { this._src[id] = { setData(d) { this.d = d; } }; }
  addLayer(l) { if (!l.id || !l.source) errors.push("addLayer without id/source"); if (!this._src[l.source]) errors.push(`layer ${l.id} uses missing source ${l.source}`); }
  getSource(id) { if (!this._src[id]) { errors.push(`getSource("${id}") does not exist`); return null; } return this._src[id]; }
  getCanvas() { return { style: {} }; }
  setCenter() {} setZoom() {} flyTo() {} easeTo() {} remove() {} resize() {}
}
global.maplibregl = { Map: StubMap, NavigationControl: class {}, Popup: class { setLngLat() { return this } setHTML() { return this } addTo() { return this } remove() {} } };
global.THREE = null;
global.fetch = async (u) => {
  const rel = String(u).replace(/^.*?(data\/)/, "$1");
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => null };
  return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(p, "utf8")) };
};
process.on("unhandledRejection", e => errors.push("unhandled rejection: " + (e && e.message)));

// load the page's external assets, then its inline scripts
for (const src of [...h.matchAll(/<script src="(assets\/[^"]+)"><\/script>/g)].map(m => m[1])) {
  try { new Function(fs.readFileSync(path.join(root, src), "utf8"))(); }
  catch (e) { errors.push(`${src}: ${e.message}`); }
}
for (const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
  try { new Function(m[1])(); } catch (e) { errors.push(`inline script threw: ${e.message}`); }
}
(async () => {
  await new Promise(r => setTimeout(r, 400));
  (mapHandlers.load || []).forEach(fn => { try { fn(); } catch (e) { errors.push("map load handler threw: " + e.message); } });
  await new Promise(r => setTimeout(r, 400));
  console.log(file + ":");
  if (!errors.length) console.log("  clean");
  else errors.forEach(e => console.log("  ERROR " + e));
  process.exit(errors.length ? 1 : 0);
})();
