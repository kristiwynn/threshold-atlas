// Every id a page's script reaches for must exist in that page, or be one the
// script creates itself. A missing id throws at load and kills everything after
// it, which is how the map's filters silently died once.
const fs = require("fs");
const files = process.argv.slice(2);
let bad = 0;
for (const f of files) {
  const h = fs.readFileSync(f, "utf8");
  const scripts = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
  const markup = h.replace(/<script>[\s\S]*?<\/script>/g, "");
  const present = new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  // ids the script itself writes into the DOM
  [...scripts.matchAll(/\bid="([^"]+)"/g)].forEach(m => present.add(m[1]));
  [...scripts.matchAll(/\bid = "([^"]+)"/g)].forEach(m => present.add(m[1]));
  [...scripts.matchAll(/\.id = "([^"]+)"/g)].forEach(m => present.add(m[1]));
  // ids built at runtime, e.g. "g" + i or "n-" + g
  const dynamic = [...scripts.matchAll(/\$\("([a-zA-Z0-9_-]*)" \+ /g)].map(m => m[1]);
  const wanted = new Map();
  for (const m of scripts.matchAll(/(?:\$|document\.getElementById)\(\s*"([^"]+)"\s*\)/g)) {
    const id = m[1];
    const line = scripts.slice(0, m.index).split("\n").length;
    if (!wanted.has(id)) wanted.set(id, line);
  }
  const missing = [...wanted].filter(([id]) => !present.has(id) && !dynamic.some(d => id.startsWith(d)));
  if (missing.length) {
    bad += missing.length;
    console.log(`  ${f}`);
    missing.forEach(([id, line]) => console.log(`     MISSING #${id}  (first used on script line ${line})`));
  }
}
console.log(bad ? `\n${bad} missing element id${bad > 1 ? "s" : ""}` : "every element id resolves");
process.exit(bad ? 1 : 0);
