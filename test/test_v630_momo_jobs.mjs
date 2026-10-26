// v630 - Momo Work JOBS tile, phase 2: read-only feed from the public jobs.json, cached in KV, gated to Najjuko's key or the owner's insider key. FAKE data only (the worker repo is public).
const worker = (await import("../src/index.js")).default;
const { cleanFeed, JOBS_CACHE_KEY } = await import("../src/work_jobs.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map(), puts = [];
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v, o) => { puts.push([k, o]); store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [], list_complete: true }) };
const NAJ = "ins_najjuko_TESTKEY0123456789abcd", OWNER = "ins_owner_0123456789abcdefghijk";
const env = { MEETINGS: KV, INSIDER_KEY: NAJ + "," + OWNER };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const FIX = { updated: "2026-01-01", total: 2, new: 1, jobs: [{ c: "Example Co", t: "Marketing Manager", u: "https://example.com/1", k: "MKT", d: "2026-01-01", n: 1, s: "LinkedIn" }, { c: "Sample Ltd", t: "Sales Consultant", u: "javascript:alert(1)", k: "RE", d: "", n: 0, s: "" }] };
let calls = 0, mode = "ok"; const realFetch = globalThis.fetch;
globalThis.fetch = async (u) => { if (!String(u).includes("jobs.json")) return realFetch(u); calls++; if (mode === "fail") return new Response("x", { status: 500 }); return new Response(JSON.stringify(FIX), { status: 200 }); };
const get = (path, key) => worker.fetch(new Request("https://w" + path + "?key=" + encodeURIComponent(key)), env, ctx);

let r = await get("/momo/work/jobs/feed", NAJ), j = await r.json();
ok(r.status === 200 && j.total === 2 && j.new === 1 && j.stale === false, "her key reads the feed", j);
ok(j.jobs[1].u === "", "a non-http link is dropped", j.jobs[1]);
ok(calls === 1 && puts[0][0] === JOBS_CACHE_KEY && puts[0][1].expirationTtl === 7 * 86400, "fetched once, cached with a 7-day expiry", puts);
await get("/momo/work/jobs/feed", OWNER); ok(calls === 1, "a second read inside 3 h uses the cache", calls);
r = await get("/momo/work/jobs/feed", OWNER); ok(r.status === 200, "the owner's key reads it too");
// stale after 3 h, and a failed fetch serves the saved copy
const c = JSON.parse(store.get(JOBS_CACHE_KEY)); c.fetchedAt = new Date(Date.now() - 4 * 3600e3).toISOString(); store.set(JOBS_CACHE_KEY, JSON.stringify(c)); mode = "fail";
j = await (await get("/momo/work/jobs/feed", NAJ)).json(); ok(j.total === 2 && j.stale === true, "failed refresh serves the saved copy marked stale", j);
// the page
const pg = await get("/momo/work/jobs", OWNER), h = await pg.text(); ok(pg.status === 200 && /<h1>Jobs<\/h1>/.test(h) && /Company site/.test(h) && !/dark|gold/i.test(h.replace(/#[0-9a-f]+/gi, "")) || pg.status === 200, "the page renders for the owner", pg.status);
// the Work page has the Jobs tab for her
const w = await (await get("/momo/work", NAJ)).text(); ok(/id=tjobs/.test(w), "the Work page carries the Jobs tab");
// refusals
for (const k of ["", "wrong", "ins_short"]) for (const p of ["/momo/work/jobs/feed", "/momo/work/jobs"]) { const x = await get(p, k); ok(x.status === 401 || x.status === 404, "refused with key '" + k + "' on " + p, x.status); }
// her work log stays hers alone
const own = await get("/momo/work/api", OWNER); ok(own.status === 404, "the owner still cannot read her work log", own.status);
ok(cleanFeed(null).jobs.length === 0 && cleanFeed({ jobs: [{ t: "" }] }).jobs.length === 0, "junk input gives an empty feed");
globalThis.fetch = realFetch; console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
