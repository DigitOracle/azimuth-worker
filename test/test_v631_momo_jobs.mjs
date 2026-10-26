// v631 - Momo Work JOBS: the feed (phase 2) and the shared record (phase 3), through the REAL worker entry. FAKE data only (the worker repo is public).
const worker = (await import("../src/index.js")).default;
const { cleanFeed, JOBS_CACHE_KEY, JOBS_REC_KEY, readRec } = await import("../src/work_jobs.js");
const { JOBS_JS, JOBS_BODY } = await import("../src/work_jobs_page.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map(), puts = [];
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v, o) => { puts.push([k, o]); store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [], list_complete: true }) };
const NAJ = "ins_najjuko_TESTKEY0123456789abcd", OWNER = "ins_owner_0123456789abcdefghijk";
const env = { MEETINGS: KV, INSIDER_KEY: NAJ + "," + OWNER };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const FIX = { updated: "2026-01-01", at: "07:35", jobs: [{ c: "Example Co", t: "Marketing Manager", u: "https://example.com/1", k: "MKT", d: "2026-01-01", n: 1, s: "LinkedIn", l: "Dubai" }, { c: "Sample Ltd", t: "Sales Consultant", u: "javascript:alert(1)", k: "RE", d: "", n: 0, s: "", l: "x".repeat(90) }] };
let calls = 0, mode = "ok"; const realFetch = globalThis.fetch;
globalThis.fetch = async (u) => { if (!String(u).includes("jobs.json")) return realFetch(u); calls++; if (mode === "fail") return new Response("x", { status: 500 }); return new Response(JSON.stringify(FIX), { status: 200 }); };
const get = (path, key) => worker.fetch(new Request("https://w" + path + (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key)), env, ctx);
const post = (path, key, body) => worker.fetch(new Request("https://w" + path + "?key=" + encodeURIComponent(key), { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), env, ctx);

// ---- feed ----
let r = await get("/momo/work/jobs/feed", NAJ), j = await r.json();
ok(r.status === 200 && j.total === 2 && j.new === 1 && j.at === "07:35" && j.stale === false, "her key reads the feed with its scan time", j);
ok(j.jobs[1].u === "" && j.jobs[1].l.length === 48, "a non-http link is dropped and a location is cut to 48", j.jobs[1]);
ok(calls === 1 && puts[0][0] === JOBS_CACHE_KEY && puts[0][1].expirationTtl === 7 * 86400, "fetched once, cached with a 7-day expiry", puts);
await get("/momo/work/jobs/feed", OWNER); ok(calls === 1, "a second read inside 3 h uses the cache");
await get("/momo/work/jobs/feed?fresh=1", OWNER); ok(calls === 2, "Refresh (fresh=1) fetches again at once", calls);
const c = JSON.parse(store.get(JOBS_CACHE_KEY)); c.fetchedAt = new Date(Date.now() - 4 * 3600e3).toISOString(); store.set(JOBS_CACHE_KEY, JSON.stringify(c)); mode = "fail";
j = await (await get("/momo/work/jobs/feed", NAJ)).json(); ok(j.total === 2 && j.stale === true, "a failed refresh serves the saved copy marked stale", j);
ok(cleanFeed({ jobs: new Array(400).fill({ t: "T", u: "https://e.com" }) }).jobs.length === 300, "the feed holds up to 300 roles");
ok(cleanFeed(null).jobs.length === 0, "junk input gives an empty feed");

// ---- page ----
for (const k of [NAJ, OWNER]) { const pg = await get("/momo/work/jobs", k), h = await pg.text(); ok(pg.status === 200 && /Today's jobs/.test(h) && /Mark as applied/.test(h), "the page renders for " + k.slice(0, 8), pg.status); }
ok(!/\$\{/.test(JOBS_JS) && !/`/.test(JOBS_JS), "the client script has no back-tick or dollar-brace");
try { new Function(JOBS_JS); ok(true, ""); } catch (e) { ok(false, "client script parses", e.message); }
ok(!/(openai|chatgpt|claude|anthropic|gemini)/i.test(JOBS_BODY + JOBS_JS), "no model or vendor name in the page text");
ok(!/#0A4F4A|#C5A56A|dark/i.test(JOBS_BODY), "cream and green only: no gold, no dark theme");
const w = await (await get("/momo/work", NAJ)).text(); ok(/id=tjobs/.test(w), "the Work page carries the Jobs tab");

// ---- the record ----
let rec = await (await get("/momo/work/jobs/rec", NAJ)).json();
ok(rec.v === 2 && rec.profile.name === "" && rec.view.groups.length === 5 && rec.tpl.letters && Object.keys(rec.applied).length === 0, "a new record is empty and v2", rec);
const prof = { name: "Test Person", headline: "Test headline", phone: "000", cvPrefix: "Test_CV", direct: "3", indirect: "17" };
r = await post("/momo/work/jobs/api", NAJ, { action: "save_profile", profile: prof }); j = await r.json(); ok(r.status === 200 && j.ok && j.rec.profile.indirect === "17", "her key saves the profile through the real entry point", [r.status, j]);
r = await post("/momo/work/jobs/api", OWNER, { action: "save_docs", docs: { MKT: "https://example.com/cv-mkt", BD: "javascript:x", ZZ: "https://example.com/z" } }); j = await r.json();
ok(r.status === 200 && j.rec.docs.MKT === "https://example.com/cv-mkt" && !j.rec.docs.BD && !j.rec.docs.ZZ, "the owner's key saves CV links; bad links and unknown keys are dropped", j.rec && j.rec.docs);
ok((await (await get("/momo/work/jobs/rec", OWNER)).json()).profile.name === "Test Person", "the owner reads what she saved: one shared record");
await post("/momo/work/jobs/api", NAJ, { action: "save_view", view: { groups: ["MKT", "ZZ"], cities: ["Dubai", "Mars"], avoid: "intern" } });
const vw = (await (await get("/momo/work/jobs/rec", OWNER)).json()).view; ok(vw.groups.join() === "MKT" && vw.cities.join() === "Dubai" && vw.avoid === "intern", "view is cleaned", vw);
await post("/momo/work/jobs/api", NAJ, { action: "save_tpl", tpl: { auto: "Shared line.", letters: { MKT: { hook: "Opening.", proof: "Proof.", close: "Close." } }, headlines: ["H1"], why: ["W1"] } });
const tp = (await (await get("/momo/work/jobs/rec", NAJ)).json()).tpl; ok(tp.letters.MKT.hook === "Opening." && tp.letters.PR.hook === "" && tp.auto === "Shared line.", "letter templates are saved per group", tp);
r = await post("/momo/work/jobs/api", OWNER, { action: "mark_applied", url: "https://example.com/1", on: true, date: "2026-10-26" }); j = await r.json(); ok(j.rec.applied["https://example.com/1"].d === "2026-10-26", "mark applied (object form)", j.rec && j.rec.applied);
j = await (await post("/momo/work/jobs/api", NAJ, { action: "mark_applied", url: "https://example.com/1", on: false })).json(); ok(!j.rec.applied["https://example.com/1"], "undo applied");
ok((await post("/momo/work/jobs/api", NAJ, { action: "mark_applied", url: "nope" })).status === 400 && (await post("/momo/work/jobs/api", NAJ, { action: "wat" })).status === 400, "bad requests answer 400");
ok(JSON.parse(store.get(JOBS_REC_KEY)).v === 2, "stored as one v2 document");

// ---- refusals ----
for (const k of ["", "wrong", "ins_short"]) {
  for (const p of ["/momo/work/jobs/feed", "/momo/work/jobs", "/momo/work/jobs/rec"]) { const x = await get(p, k); ok(x.status === 401 || x.status === 404, "GET " + p + " refused with key '" + k + "'", x.status); }
  const x = await post("/momo/work/jobs/api", k, { action: "save_profile", profile: { name: "Intruder" } }); ok(x.status === 401 || x.status === 404, "POST jobs/api refused with key '" + k + "'", x.status);
}
ok((await readRec(env)).profile.name === "Test Person", "no refused request changed the record");
ok((await get("/momo/work/api", OWNER)).status === 404, "the owner still cannot read her work log");
globalThis.fetch = realFetch; console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
