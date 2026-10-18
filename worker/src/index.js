// The Threshold Atlas API: anonymous submissions, suppressed aggregates, moderation.
// Rules: no accounts, no email, no IP stored. Country + region only. k=5 suppression on
// every public cell of shared experiences (archive accounts are already public, so theirs is 1). Raw story text is never served; only a redacted copy, and only when
// the author ticked "publish" and a moderator approved it.

const ITEMS = ["time", "thoughts", "review", "understanding", "peace", "joy", "unity", "light", "senses", "aware", "future", "obe", "world", "presence", "beings", "border"];
const AGE = ["Under 18", "18-29", "30-44", "45-59", "60-74", "75+"];
const SEX = ["Female", "Male", "Other or prefer not to say"];
const CAUSE = ["Cardiac arrest", "Accident or trauma", "Drowning", "Surgery or anaesthesia", "Illness", "Childbirth", "Overdose or poisoning", "Suicide attempt", "Other"];
const TONE = ["Wonderful", "Mixed", "Frightening"];
const RELIGION = ["Christian", "Jewish", "Muslim", "Hindu", "Buddhist", "Spiritual, not religious", "No religion", "Other", "Prefer not to say"];
const AFTER = ["less_fear", "more_fear", "more_spiritual", "less_religious", "values_changed", "relationships_changed", "sensitivity", "none"];
const K = 5;
// Archive coding: accounts often leave a question unanswered, so every field also takes "Not stated".
const NS = "Not stated";
const SOURCES = ["NDERF", "IANDS", "Other"];
const NEAR = ["Clinical", "Perceived", "No", NS];
const CODEBOOK = "v1";
// The map's own kinds of experience, so coded accounts sit on it as ordinary bubbles.
const KINDS = ["tunnel", "guided", "summoned", "journey", "calm", "distressing"];

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
    if (req.method === "OPTIONS") return new Response(null, { headers: { "access-control-allow-origin": origin, "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type, x-admin-key" } });
    try {
      if (url.pathname === "/api/submit" && req.method === "POST") return await submit(req, env, origin);
      if (url.pathname === "/api/suggest" && req.method === "POST") return await suggest(req, env, origin);
      if (url.pathname === "/api/stats") return json(await stats(env), 200, origin);
      if (url.pathname === "/api/stories") return json(await stories(env, url), 200, origin);
      if (url.pathname === "/api/delete" && req.method === "POST") return await del(req, env, origin);
      if (url.pathname === "/api/archive-pins") return json(await archivePins(env), 200, origin);
      if (url.pathname === "/api/archive-stats") return json(await archiveStats(env), 200, origin);
      if (url.pathname.startsWith("/admin/archive")) return await archive(req, env, url, origin);
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

// Read a written account and propose a score for each Greyson item, with the words that
// prompted it. Nothing is saved here; the person reviews and corrects every answer first.
const ITEM_Q = {
  time: "time seemed to speed up or slow down",
  thoughts: "thoughts were speeded up",
  review: "scenes from their past came back (a life review)",
  understanding: "a sudden sense of understanding everything",
  peace: "a feeling of peace, calm or relief",
  joy: "a feeling of joy or happiness",
  unity: "a sense of harmony or unity with the universe",
  light: "a brilliant or unearthly light",
  senses: "senses more vivid than usual",
  aware: "awareness of things happening elsewhere, as if by ESP",
  future: "scenes from the future",
  obe: "separation from the body, or watching from outside it",
  world: "entering another, unearthly world or place",
  presence: "a mystical being, presence, or an unidentifiable voice",
  beings: "deceased people or religious figures",
  border: "a border, barrier or point of no return"
};
async function suggest(req, env, origin, max = 3000, body) {
  const b = body || await req.json().catch(() => ({}));
  const story = String(b.story || "").slice(0, max).trim();
  if (story.length < 40) return json({ error: "Write a little more first, then we can suggest answers." }, 400, origin);
  if (!env.AI) return json({ error: "Suggestions are not available right now. Please answer the questions yourself." }, 503, origin);
  const list = Object.entries(ITEM_Q).map(([k, q]) => `${k}: ${q}`).join("\n");
  const prompt = `You are helping someone fill in the Greyson Near-Death Experience Scale from an account they wrote about their own experience. For each item, score ONLY what the account actually says.

Scoring: 2 = clearly and strongly described; 1 = mentioned, partly, or mildly; 0 = not mentioned.
Never infer from what is typical of near-death experiences. If the account does not mention something, it is 0. Do not invent quotes.

Items:
${list}

Account:
"""${story}"""

Reply with ONLY a JSON object, no other text, in this shape:
{"items":{"time":0,"thoughts":0,"review":0,"understanding":0,"peace":0,"joy":0,"unity":0,"light":0,"senses":0,"aware":0,"future":0,"obe":0,"world":0,"presence":0,"beings":0,"border":0},"evidence":{"peace":"the exact words from the account that support this"},"tone":"Wonderful|Mixed|Frightening"}
Include an evidence entry only for items you scored 1 or 2, quoting the account word for word.`;
  let out;
  try {
    out = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages: [{ role: "user", content: prompt }], max_tokens: 1200, temperature: 0 });
  } catch (e) {
    return json({ error: "Suggestions are busy right now. Please answer the questions yourself.", detail: String(e && e.message || e).slice(0, 200) }, 503, origin);
  }
  // the reply arrives as a string, as {response: ...}, or in OpenAI shape; response may already be an object
  const r = out?.response ?? out?.choices?.[0]?.message?.content ?? out;
  let parsed = null;
  if (r && typeof r === "object" && r.items) parsed = r;
  else {
    const m = String(typeof r === "string" ? r : JSON.stringify(r)).match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch { parsed = null; } }
  }
  if (!parsed || !parsed.items) return json({ error: "We couldn't read that as answers. Please fill the questions in yourself." }, 502, origin);
  const items = {}, evidence = {};
  const low = story.toLowerCase();
  for (const k of ITEMS) {
    const v = parsed.items?.[k];
    items[k] = [0, 1, 2].includes(v) ? v : 0;
    const q = typeof parsed.evidence?.[k] === "string" ? parsed.evidence[k].trim().slice(0, 240) : "";
    // keep a quote only if it really appears in what they wrote
    if (q && low.includes(q.toLowerCase().replace(/^["']|["']$/g, "").slice(0, 40))) evidence[k] = q.replace(/^["']|["']$/g, "");
    else if (items[k] > 0) evidence[k] = "";
  }
  const tone = ["Wonderful", "Mixed", "Frightening"].includes(parsed.tone) ? parsed.tone : null;
  return json({ ok: true, items, evidence, tone, score: Object.values(items).reduce((a, c) => a + c, 0) }, 200, origin);
}

// Aggregates with k-anonymity: any cell with fewer than K people is dropped.
async function stats(env) {
  const { results } = await env.DB.prepare("SELECT age_band, sex, country, region, cause, tone, religion, items, score, after FROM submissions WHERE status != 'rejected'").all();
  const rows = results.map(r => ({ ...r, items: JSON.parse(r.items), after: JSON.parse(r.after || "[]") }));
  const pend = await env.DB.prepare("SELECT COUNT(*) AS c FROM submissions WHERE status='pending' AND consent_publish=1").first();
  const pub = await env.DB.prepare("SELECT COUNT(*) AS c FROM submissions WHERE status='approved' AND consent_publish=1 AND story_public IS NOT NULL").first();
  return { ...aggregate(rows), stories: { published: pub?.c || 0, awaiting_review: pend?.c || 0 } };
}

// The same suppressed aggregates over any list of coded rows.
// k: the smallest group or place shown; minCharts: how many rows before any chart. Shared
// experiences are private, so they keep K and 10. Archive accounts are already public: 1 and 1.
function aggregate(rows, extra = [], k = K, minCharts = 10) {
  const n = rows.length;
  const rate = (rs, k) => rs.length ? Math.round(1000 * rs.filter(r => r.items[k] > 0).length / rs.length) / 10 : null;
  const pct = (rs) => Object.fromEntries(ITEMS.map(k => [k, rate(rs, k)]));
  const group = (field) => { const g = {}; rows.forEach(r => { (g[r[field] || "Unknown"] = g[r[field] || "Unknown"] || []).push(r); }); return Object.fromEntries(Object.entries(g).filter(([, rs]) => rs.length >= k).map(([key, rs]) => [key, { n: rs.length, pct: pct(rs), mean_score: Math.round(10 * rs.reduce((a, r) => a + r.score, 0) / rs.length) / 10 }])); };
  // Map: one point per country (and per region once it has K or more); smaller regions roll up to the country.
  const geo = {}; rows.forEach(r => { const ck = r.country; geo[ck] = geo[ck] || { country: ck, n: 0, regions: {} }; geo[ck].n++; if (r.region) geo[ck].regions[r.region] = (geo[ck].regions[r.region] || 0) + 1; });
  const map = Object.values(geo).filter(g => g.n >= k).map(g => ({ country: g.country, n: g.n, regions: Object.fromEntries(Object.entries(g.regions).filter(([, c]) => c >= k)) }));
  const scores = rows.map(r => r.score);
  const places = {}; rows.forEach(r => { places[r.country] = (places[r.country] || 0) + 1; });
  const hidden = Object.values(places).filter(c => c < k).reduce((a, c) => a + c, 0);
  return {
    n, k, generated: Date.now(),
    map_hidden: hidden, min_for_charts: minCharts,
    overall: n >= minCharts ? { pct: pct(rows), mean_score: n ? Math.round(10 * scores.reduce((a, b) => a + b, 0) / n) / 10 : null, nde_share: n ? Math.round(1000 * scores.filter(s => s >= 7).length / n) / 10 : null, tone: Object.fromEntries(TONE.map(t => [t, Math.round(1000 * rows.filter(r => r.tone === t).length / n) / 10])) } : null,
    by: n >= minCharts ? Object.fromEntries(["age_band", "sex", "cause", "country", "religion", ...extra].map(f => [f, group(f)])) : {},
    after: n >= minCharts ? Object.fromEntries(AFTER.map(a => [a, Math.round(1000 * rows.filter(r => r.after.includes(a)).length / n) / 10])) : null,
    map, items: ITEMS
  };
}

// Archive accounts, coded here. Only coded rows exist; there is no text to serve.
async function archiveStats(env) {
  const { results } = await env.DB.prepare("SELECT source, language, near_death, age_band, sex, country, region, cause, decade, tone, religion, items, score, after FROM archive_codes").all();
  const rows = results.map(r => ({ ...r, items: JSON.parse(r.items), after: JSON.parse(r.after || "[]") }));
  const sources = {}; rows.forEach(r => { sources[r.source] = (sources[r.source] || 0) + 1; });
  return { ...aggregate(rows, ["source", "near_death", "decade", "language"], 1, 1), sources, codebook: CODEBOOK };
}

// Archive accounts as map bubbles: one per place, kind, cause, religion and decade, with
// how often each Greyson item came up, so the bubble can be walked like a study.
async function archivePins(env) {
  const { results } = await env.DB.prepare("SELECT source, country, region, experience_type, cause, religion, decade, items FROM archive_codes WHERE experience_type IS NOT NULL AND country != ?").bind(NS).all();
  const g = {};
  for (const r of results) {
    const key = [r.source, r.country, r.region || "", r.experience_type, r.cause, r.religion || NS, r.decade || ""].join("|");
    const p = g[key] = g[key] || { source: r.source, country: r.country, region: r.region, experience_type: r.experience_type, cause: r.cause, religion: r.religion || NS, decade: r.decade, n: 0, hits: {} };
    p.n++; const it = JSON.parse(r.items); for (const k of ITEMS) if (it[k] > 0) p.hits[k] = (p.hits[k] || 0) + 1;
  }
  const pins = Object.values(g).map(({ hits, ...p }) => ({ ...p, pct: Object.fromEntries(ITEMS.map(k => [k, Math.round(1000 * (hits[k] || 0) / p.n) / 10])) }));
  return { pins, codebook: CODEBOOK };
}

// Coding archive accounts: same key as moderation. Saves codes only; any text sent for
// suggestions is read by the model and dropped, never written anywhere.
async function archive(req, env, url, origin) {
  const key = url.searchParams.get("key") || req.headers.get("x-admin-key");
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return json({ error: "Not found" }, 404, origin);
  const b = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  if (url.pathname === "/admin/archive/suggest") return await suggest(req, env, origin, 12000, b);
  if (url.pathname === "/admin/archive/check") {
    const ref = normRef(b.source, b.source_ref);
    const r = ref && await env.DB.prepare("SELECT coded FROM archive_codes WHERE source=? AND source_ref=?").bind(b.source, ref).first();
    return json({ ok: true, ref, coded: r ? r.coded : null }, 200, origin);
  }
  if (url.pathname === "/admin/archive" && req.method === "POST") {
    const source = SOURCES.includes(b.source) ? b.source : null, ref = normRef(source, b.source_ref);
    if (!source || !ref) return json({ error: "Choose the archive and give the account's ID or link." }, 400, origin);
    if (!KINDS.includes(b.experience_type)) return json({ error: "Choose the kind of experience, so it can go on the map." }, 400, origin);
    const pick = (v, list) => v === NS ? NS : list.includes(v) ? v : NS;
    const items = {}; let score = 0;
    for (const k of ITEMS) { const v = [0, 1, 2].includes(b.items?.[k]) ? b.items[k] : 0; items[k] = v; score += v; }
    const after = Array.isArray(b.after) ? b.after.filter(a => AFTER.includes(a)).slice(0, 8) : [];
    const short = v => typeof v === "string" && v.trim() && v.length <= 60 ? v.trim() : null;
    const row = [crypto.randomUUID(), source, ref, Date.now(), CODEBOOK, b.method === "ai-assisted" ? "ai-assisted" : "manual", short(b.language),
      pick(b.near_death, NEAR), b.experience_type, pick(b.age_band, AGE), pick(b.sex, SEX), short(b.country) || NS, short(b.region), pick(b.cause, CAUSE),
      /^(\d{4}s|Before 1960)$/.test(b.decade || "") ? b.decade : null, TONE.includes(b.tone) ? b.tone : null, pick(b.religion, RELIGION),
      JSON.stringify(items), score, JSON.stringify(after)];
    const r = await env.DB.prepare(`INSERT OR IGNORE INTO archive_codes (id, source, source_ref, coded, codebook, method, language, near_death, experience_type, age_band, sex, country, region, cause, decade, tone, religion, items, score, after)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(...row).run();
    if (!r.meta.changes) return json({ error: "That account is already coded." }, 409, origin);
    const c = await env.DB.prepare("SELECT COUNT(*) AS c FROM archive_codes").first();
    return json({ ok: true, score, total: c.c }, 200, origin);
  }
  if (url.pathname === "/admin/archive" && req.method === "DELETE") {
    const r = await env.DB.prepare("DELETE FROM archive_codes WHERE source=? AND source_ref=?").bind(url.searchParams.get("source"), normRef(url.searchParams.get("source"), url.searchParams.get("ref"))).run();
    return json({ ok: true, deleted: r.meta.changes > 0 }, 200, origin);
  }
  const { results } = await env.DB.prepare("SELECT source, source_ref, coded, method, near_death, country, cause, score FROM archive_codes ORDER BY coded DESC LIMIT 50").all();
  const c = await env.DB.prepare("SELECT COUNT(*) AS c FROM archive_codes").first();
  return json({ ok: true, total: c.c, recent: results }, 200, origin);
}

// An NDERF link becomes its path (e.g. /Experiences/1jane_d_nde.html), so the same account
// pasted twice, with or without www or https, is caught as a duplicate.
function normRef(source, ref) {
  ref = String(ref || "").trim().slice(0, 300); if (!ref) return null;
  return ref.replace(/#.*$/, "").replace(/^[a-z]+:\/\//i, "").replace(/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(?=\/)/i, "").replace(/\/+$/, "").toLowerCase();
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
