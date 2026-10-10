// The Threshold Atlas API: anonymous submissions, suppressed aggregates, moderation.
// Rules: no accounts, no email, no IP stored. Country + region only. k=5 suppression on
// every public cell. Raw story text is never served; only a redacted copy, and only when
// the author ticked "publish" and a moderator approved it.

const ITEMS = ["time", "thoughts", "review", "understanding", "peace", "joy", "unity", "light", "senses", "aware", "future", "obe", "world", "presence", "beings", "border"];
const AGE = ["Under 18", "18-29", "30-44", "45-59", "60-74", "75+"];
const SEX = ["Female", "Male", "Other or prefer not to say"];
const CAUSE = ["Cardiac arrest", "Accident or trauma", "Drowning", "Surgery or anaesthesia", "Illness", "Childbirth", "Overdose or poisoning", "Suicide attempt", "Other"];
const TONE = ["Wonderful", "Mixed", "Frightening"];
const RELIGION = ["Christian", "Jewish", "Muslim", "Hindu", "Buddhist", "Spiritual, not religious", "No religion", "Other", "Prefer not to say"];
const AFTER = ["less_fear", "more_fear", "more_spiritual", "less_religious", "values_changed", "relationships_changed", "sensitivity", "none"];
const K = 5;

const json = (data, status = 200, origin = "*") => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "access-control-allow-origin": origin, "cache-control": "no-store" } });

async function sha(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
function code() { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const r = crypto.getRandomValues(new Uint8Array(10)); return [...r].map(x => a[x % a.length]).join("").replace(/(.{5})/, "$1-"); }

// Remove things that could identify someone: emails, phone numbers, URLs, long digit runs, @handles.
function redact(t) {
  return (t || "").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email removed]").replace(/https?:\/\/\S+|www\.\S+/gi, "[link removed]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[number removed]").replace(/@\w{3,}/g, "[handle removed]").trim();
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), origin = env.ALLOWED_ORIGIN;
    if (req.method === "OPTIONS") return new Response(null, { headers: { "access-control-allow-origin": origin, "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" } });
    try {
      if (url.pathname === "/api/submit" && req.method === "POST") return await submit(req, env, origin);
      if (url.pathname === "/api/stats") return json(await stats(env), 200, origin);
      if (url.pathname === "/api/stories") return json(await stories(env, url), 200, origin);
      if (url.pathname === "/api/delete" && req.method === "POST") return await del(req, env, origin);
      if (url.pathname.startsWith("/admin")) return await admin(req, env, url);
      return json({ ok: true, site: env.SITE_URL }, 200, origin);
    } catch (e) {
      return json({ error: "Something went wrong on our side. Please try again." }, 500, origin);
    }
  }
};

async function submit(req, env, origin) {
  const b = await req.json().catch(() => null);
  if (!b) return json({ error: "Bad request." }, 400, origin);
  if (b.website) return json({ ok: true, id: "ok" }, 200, origin); // honeypot: bots fill it, people never see it
  if (typeof b.elapsed !== "number" || b.elapsed < 20000) return json({ error: "Please take a moment with the form before sending." }, 400, origin);
  if (!b.adult) return json({ error: "This form is for adults (18+). Childhood experiences are welcome from adults describing them." }, 400, origin);
  if (!b.consent_count) return json({ error: "Please tick the box that lets us count your experience." }, 400, origin);
  const pick = (v, list) => list.includes(v) ? v : null;
  const age = pick(b.age_band, AGE), sex = pick(b.sex, SEX), cause = pick(b.cause, CAUSE), tone = pick(b.tone, TONE) || "Mixed", religion = pick(b.religion, RELIGION) || "Prefer not to say";
  const country = typeof b.country === "string" && b.country.length <= 60 ? b.country.trim() : null;
  const region = typeof b.region === "string" && b.region.length <= 60 ? b.region.trim() || null : null;
  if (!age || !sex || !cause || !country) return json({ error: "Please answer the age, sex, country and cause questions." }, 400, origin);
  const items = {}; let score = 0;
  for (const k of ITEMS) { const v = [0, 1, 2].includes(b.items?.[k]) ? b.items[k] : 0; items[k] = v; score += v; }
  const after = Array.isArray(b.after) ? b.after.filter(a => AFTER.includes(a)).slice(0, 8) : [];
  const decade = /^\d{4}s$/.test(b.decade || "") ? b.decade : null;
  const story = typeof b.story === "string" ? b.story.slice(0, 2000) : "";
  const consent_publish = b.consent_publish && story ? 1 : 0, consent_research = b.consent_research ? 1 : 0;
  const id = crypto.randomUUID(), c = code(), delete_hash = await sha(c);
  await env.DB.prepare(`INSERT INTO submissions (id, created, status, age_band, sex, country, region, cause, decade, tone, religion, items, score, after, story, story_public, consent_publish, consent_research, delete_hash)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, Date.now(), story ? "pending" : "approved", age, sex, country, region, cause, decade, tone, religion, JSON.stringify(items), score, JSON.stringify(after), story || null, story ? redact(story) : null, consent_publish, consent_research, delete_hash).run();
  return json({ ok: true, id, delete_code: c, score, pending_story: !!story }, 200, origin);
}

// Aggregates with k-anonymity: any cell with fewer than K people is dropped.
async function stats(env) {
  const { results } = await env.DB.prepare("SELECT age_band, sex, country, region, cause, tone, religion, items, score, after FROM submissions WHERE status != 'rejected'").all();
  const rows = results.map(r => ({ ...r, items: JSON.parse(r.items), after: JSON.parse(r.after || "[]") }));
  const n = rows.length;
  const rate = (rs, k) => rs.length ? Math.round(1000 * rs.filter(r => r.items[k] > 0).length / rs.length) / 10 : null;
  const pct = (rs) => Object.fromEntries(ITEMS.map(k => [k, rate(rs, k)]));
  const group = (field) => { const g = {}; rows.forEach(r => { (g[r[field] || "Unknown"] = g[r[field] || "Unknown"] || []).push(r); }); return Object.fromEntries(Object.entries(g).filter(([, rs]) => rs.length >= K).map(([key, rs]) => [key, { n: rs.length, pct: pct(rs), mean_score: Math.round(10 * rs.reduce((a, r) => a + r.score, 0) / rs.length) / 10 }])); };
  // Map: one point per country (and per region once it has K or more); smaller regions roll up to the country.
  const geo = {}; rows.forEach(r => { const ck = r.country; geo[ck] = geo[ck] || { country: ck, n: 0, regions: {} }; geo[ck].n++; if (r.region) geo[ck].regions[r.region] = (geo[ck].regions[r.region] || 0) + 1; });
  const map = Object.values(geo).filter(g => g.n >= K).map(g => ({ country: g.country, n: g.n, regions: Object.fromEntries(Object.entries(g.regions).filter(([, c]) => c >= K)) }));
  const scores = rows.map(r => r.score);
  return {
    n, k: K, generated: Date.now(),
    overall: n >= 10 ? { pct: pct(rows), mean_score: n ? Math.round(10 * scores.reduce((a, b) => a + b, 0) / n) / 10 : null, nde_share: n ? Math.round(1000 * scores.filter(s => s >= 7).length / n) / 10 : null, tone: Object.fromEntries(TONE.map(t => [t, Math.round(1000 * rows.filter(r => r.tone === t).length / n) / 10])) } : null,
    by: n >= 10 ? { age_band: group("age_band"), sex: group("sex"), cause: group("cause"), country: group("country"), religion: group("religion") } : {},
    after: n >= 10 ? Object.fromEntries(AFTER.map(a => [a, Math.round(1000 * rows.filter(r => r.after.includes(a)).length / n) / 10])) : null,
    map, items: ITEMS
  };
}

async function stories(env, url) {
  const limit = Math.min(50, +(url.searchParams.get("limit") || 20));
  const { results } = await env.DB.prepare("SELECT id, created, age_band, sex, country, cause, tone, score, story_public FROM submissions WHERE status='approved' AND consent_publish=1 AND story_public IS NOT NULL ORDER BY created DESC LIMIT ?").bind(limit).all();
  return { stories: results };
}

async function del(req, env, origin) {
  const b = await req.json().catch(() => ({}));
  const h = await sha(String(b.code || "").toUpperCase().trim());
  const r = await env.DB.prepare("DELETE FROM submissions WHERE delete_hash=?").bind(h).run();
  return json({ ok: true, deleted: r.meta.changes > 0 }, 200, origin);
}

// Moderation: a private page behind a secret key (ADMIN_KEY). Approve or reject pending stories.
async function admin(req, env, url) {
  const key = url.searchParams.get("key") || req.headers.get("x-admin-key");
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return new Response("Not found", { status: 404 });
  if (req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    if (["approved", "rejected"].includes(b.status) && b.id) await env.DB.prepare("UPDATE submissions SET status=? WHERE id=?").bind(b.status, b.id).run();
    if (b.story_public !== undefined && b.id) await env.DB.prepare("UPDATE submissions SET story_public=? WHERE id=?").bind(String(b.story_public).slice(0, 2000), b.id).run();
    return json({ ok: true });
  }
  const { results } = await env.DB.prepare("SELECT id, created, status, age_band, sex, country, region, cause, tone, score, consent_publish, story, story_public FROM submissions ORDER BY (status='pending') DESC, created DESC LIMIT 200").all();
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const rows = results.map(r => `<article class="s ${r.status}"><header><b>${r.status.toUpperCase()}</b> · ${new Date(r.created).toISOString().slice(0, 10)} · ${esc(r.age_band)}, ${esc(r.sex)} · ${esc(r.country)}${r.region ? ", " + esc(r.region) : ""} · ${esc(r.cause)} · ${esc(r.tone)} · score ${r.score} · ${r.consent_publish ? "may publish" : "count only"}</header>
    ${r.story ? `<details><summary>Original text (never public)</summary><pre>${esc(r.story)}</pre></details><label>Public version (edit if anything identifying slipped through)<textarea data-id="${r.id}" class="pub">${esc(r.story_public)}</textarea></label>` : "<p>No story, counted only.</p>"}
    <div class="acts"><button data-id="${r.id}" data-status="approved">Approve</button> <button data-id="${r.id}" data-status="rejected">Reject</button> <button data-id="${r.id}" class="save">Save public text</button></div></article>`).join("");
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Moderation</title><style>body{font:15px/1.5 system-ui;background:#0c0b16;color:#efe9dc;margin:0;padding:20px;max-width:900px;margin-inline:auto}.s{border:1px solid #2a2742;border-radius:8px;padding:12px;margin:12px 0;background:#16142a}.s.pending{border-color:#d8a84a}.s.rejected{opacity:.5}header{color:#a79f91;font-size:13px}pre{white-space:pre-wrap;background:#0c0b16;padding:8px;border-radius:6px}textarea{width:100%;min-height:90px;background:#0c0b16;color:#efe9dc;border:1px solid #2a2742;border-radius:6px;padding:8px}label{display:block;font-size:13px;color:#a79f91;margin-top:8px}button{font:600 14px system-ui;padding:8px 12px;border-radius:6px;border:1px solid #2a2742;background:#0c0b16;color:#efe9dc;cursor:pointer}.acts{margin-top:8px}</style>
  <h1>Moderation</h1><p>${results.filter(r => r.status === "pending").length} waiting. Approve publishes the public version of a story; reject keeps it out of the public page and out of the statistics. Never copy the original text anywhere.</p>${rows}
  <script>const KEY=${JSON.stringify(key)};document.addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;const id=b.dataset.id;const body=b.classList.contains("save")?{id,story_public:document.querySelector('textarea[data-id="'+id+'"]').value}:{id,status:b.dataset.status};b.disabled=true;await fetch("/admin",{method:"POST",headers:{"content-type":"application/json","x-admin-key":KEY},body:JSON.stringify(body)});b.textContent="Done";setTimeout(()=>location.reload(),400)})</script>`;
  return new Response(html, { headers: { "content-type": "text/html;charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
