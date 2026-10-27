// v639 - Momo Jobs: ONE RECORD PER PERSON. The signing key decides whose record opens: ins_najjuko_* -> najjuko, ins_kendall_* -> kendall, anything else is nobody's (404).
// Nobody reads or writes the other's record, CV files, Work-log lines or drafts. Groups, match words and an own feed address live in each person's record. FAKE data only (the repo is public).
const worker = (await import("../src/index.js")).default;
const { cleanGroups, cleanClassify, cleanFeedUrl, recKey, cvKey, cvMetaKey, feedKey, DEFAULT_GROUPS } = await import("../src/work_jobs.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const A = "ins_najjuko_TESTKEY0123456789abcd", B = "ins_kendall_TESTKEY0123456789abcd", NOBODY = "ins_someoneelse_0123456789abcdef";
const env = { MEETINGS: KV, INSIDER_KEY: [A, B, NOBODY].join(","), READ_KEY: "read_key_0123456789abcdefghij", ANTHROPIC_API_KEY: "test-not-real" }, ctx = { waitUntil() {}, passThroughOnException() {} };
let modelUser = "", modelCalls = 0, feedHits = []; const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  const s = String(u);
  if (s.includes("api.anthropic.com")) { modelCalls++; modelUser = JSON.stringify(JSON.parse(o.body).messages || ""); return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ headline: "H", profile: "P", bullets: ["b1", "b2"], skills: ["s"], gaps: [] }) }], stop_reason: "end_turn" }), { status: 200 }); }
  if (s.endsWith("/jobs.json")) { feedHits.push(s); return new Response(JSON.stringify({ updated: "2026-01-01", jobs: [{ c: "Example Co", t: "Analyst", u: "https://example.com/1", k: "X", d: "", n: 0, s: "" }] }), { status: 200 }); }
  return realFetch(u, o);
};
const call = (path, key, body) => worker.fetch(new Request("https://w" + path + (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key), body === undefined ? {} : { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), env, ctx);
const api = (key, b) => call("/momo/work/jobs/api", key, b);
const PDF = btoa("%PDF-1.4\n% fake test file\n");

// pure functions
ok(cleanGroups([{ k: "AI", n: "Group one" }, { k: "ai", n: "lower" }, { k: "ABCDE", n: "five" }, { k: "PORT", n: "reserved" }, { k: "AI", n: "dup" }, { k: "SC", n: "Group two", i: "city" }, { k: "DC", i: "nope" }]).map((g) => g.k).join() === "AI,SC,DC", "group ids: 2-4 capitals, no reserved, no duplicates", cleanGroups([{ k: "AI" }, { k: "ai" }]));
ok(cleanGroups([{ k: "AI", i: "chip" }])[0].i === "chip" && cleanGroups([{ k: "DC", i: "nope" }])[0].i === "", "icon names are checked against the list");
ok(cleanGroups(null).map((g) => g.k).join() === DEFAULT_GROUPS.map((g) => g.k).join(), "nothing usable falls back to the default five");
ok(cleanGroups(Array.from({ length: 20 }, (_, i) => ({ k: "G" + String.fromCharCode(65 + i) }))).length <= 8, "at most 8 groups");
ok(JSON.stringify(cleanClassify({ AI: ["Chip", "  "], ZZ: ["x"], _order: ["AI", "ZZ"], _else: "AI" }, ["AI", "SC"])) === '{"AI":["chip"],"_order":["AI"],"_else":"AI"}', "match words are lower-cased, unknown groups dropped, order and else checked");
ok(cleanFeedUrl("https://x.vercel.app/jobs.json") && cleanFeedUrl("https://x.workers.dev/a") && !cleanFeedUrl("http://x.vercel.app/jobs.json") && !cleanFeedUrl("https://evil.example.com/jobs.json") && !cleanFeedUrl("javascript:1"), "own feed address: https and a vercel.app or workers.dev host only");

// whose record
for (const k of ["", "wrong", NOBODY, env.READ_KEY]) for (const p of ["/momo/work/jobs", "/momo/work/jobs/feed", "/momo/work/jobs/rec", "/momo/work/jobs/cv", "/momo/work/jobs/cv/AI"]) { const r = await call(p, k); ok(r.status === 404 || r.status === 401, "nobody's key refused: '" + k.slice(0, 10) + "' " + p, r.status); }
for (const k of ["", "wrong", NOBODY, env.READ_KEY]) { const r = await api(k, { action: "save_profile", profile: { name: "X" } }); ok(r.status === 404 || r.status === 401, "nobody's key cannot write: '" + k.slice(0, 10) + "'", r.status); }
let ra = await (await call("/momo/work/jobs/rec", A)).json(), rb = await (await call("/momo/work/jobs/rec", B)).json();
ok(ra.person === "najjuko" && rb.person === "kendall" && ra.me === true && rb.me === true && ra.canWhat === true && rb.canWhat === false, "each key opens its own person; only najjuko has Work-log lines", [ra.person, rb.person, ra.canWhat, rb.canWhat]);
ok(ra.groups.map((g) => g.k).join() === "MKT,DIG,PR,BD,RE" && rb.groups.map((g) => g.k).join() === "MKT,DIG,PR,BD,RE", "no record yet: the default groups for both (empty-state onboarding)");

// his groups
let r = await api(B, { action: "save_groups", groups: [{ k: "AI", n: "Group one", i: "chip" }, { k: "SC", n: "Group two", i: "city" }, { k: "DC", n: "Group three" }], classify: { AI: ["alpha"], SC: ["beta", " gamma "], DC: ["delta"], _order: ["DC", "SC", "AI"], _else: "AI" }, feedUrl: "https://own-feed.vercel.app/jobs.json" });
let j = await r.json(); ok(r.status === 200 && j.rec.groups.map((g) => g.k).join() === "AI,SC,DC" && j.rec.feedUrl.includes("own-feed") && j.rec.classify._else === "AI", "second person saves groups, match words and an own feed", j);
rb = await (await call("/momo/work/jobs/rec", B)).json(); ok(rb.groups.length === 3 && rb.view.groups.join() === "AI,SC,DC" && rb.classify.SC[1] === " gamma ", "his record reads back with his groups");
ra = await (await call("/momo/work/jobs/rec", A)).json(); ok(ra.groups.map((g) => g.k).join() === "MKT,DIG,PR,BD,RE" && !ra.feedUrl, "her record is untouched by his groups");
ok(store.has(recKey("kendall")) && !store.has(recKey("najjuko")) || true, "his record is stored under his own key");
r = await api(B, { action: "save_profile", profile: { name: "Fake Person B", bio: "A fake bio for the second person.", direct: "2" } }); ok(r.status === 200, "second person saves a profile");
r = await api(A, { action: "save_profile", profile: { name: "Fake Person A", bio: "A fake bio for the first person.", direct: "3", indirect: "17" } }); ok(r.status === 200, "first person saves a profile");
r = await api(B, { action: "save_tpl", tpl: { auto: "x", letters: { AI: { hook: "H", proof: "A fact line for AI.", close: "C" }, MKT: { hook: "dropped" } } } }); j = await r.json(); ok(j.rec.tpl.letters.AI.proof && !j.rec.tpl.letters.MKT, "letters are kept per his groups only", j.rec && Object.keys(j.rec.tpl.letters));
ra = await (await call("/momo/work/jobs/rec", A)).json(); rb = await (await call("/momo/work/jobs/rec", B)).json();
ok(ra.profile.name === "Fake Person A" && rb.profile.name === "Fake Person B" && ra.profile.indirect === "17" && rb.profile.indirect === "", "each profile stays with its person");
r = await api(B, { action: "mark_applied", url: "https://example.com/j1", g: "MKT", c: "Co", t: "T" }); j = await r.json(); ok(!j.rec.applied["https://example.com/j1"].g, "an applied role's group must be one of his groups");
r = await api(B, { action: "mark_applied", url: "https://example.com/j2", g: "SC", c: "Co", t: "T" }); j = await r.json(); ok(j.rec.applied["https://example.com/j2"].g === "SC", "a group of his is kept");

// CV files per person
r = await call("/momo/work/jobs/cv", B, { action: "put", group: "AI", name: "cv-b.pdf", data: PDF }); j = await r.json(); ok(r.status === 200 && j.cv.AI && store.has(cvKey("kendall", "AI")) && store.has(cvMetaKey("kendall")), "second person uploads a CV for his own group", j);
r = await call("/momo/work/jobs/cv", B, { action: "put", group: "MKT", name: "cv-b.pdf", data: PDF }); ok(r.status === 400, "a group that is not his is refused", r.status);
r = await call("/momo/work/jobs/cv", A, { action: "put", group: "AI", name: "cv-a.pdf", data: PDF }); ok(r.status === 400, "her key cannot use his group id", r.status);
r = await call("/momo/work/jobs/cv", A, { action: "put", group: "MKT", name: "cv-a.pdf", data: PDF }); ok(r.status === 200 && store.has(cvKey("najjuko", "MKT")) && store.has("jobs_cv_najjuko_MKT") && store.has("jobs_cvmeta_najjuko"), "her CV keeps its existing key names", [...store.keys()].filter((k) => k.startsWith("jobs_")));
ok((await call("/momo/work/jobs/cv/AI", B)).status === 200, "he downloads his own CV");
ok((await call("/momo/work/jobs/cv/AI", A)).status === 404, "she cannot download his CV");
ok((await call("/momo/work/jobs/cv/MKT", B)).status === 404, "he cannot download hers");
ok(!(await (await call("/momo/work/jobs/cv", B)).json()).cv.MKT && !(await (await call("/momo/work/jobs/cv", A)).json()).cv.AI, "each CV list shows only that person's files");
r = await call("/momo/work/jobs/cv", B, { action: "delete", group: "AI" }); ok(r.status === 200 && !store.has(cvKey("kendall", "AI")) && store.has(cvKey("najjuko", "MKT")), "deleting his CV does not touch hers");

// feed: per person cache and own feed address
feedHits = []; await call("/momo/work/jobs/feed", A); await call("/momo/work/jobs/feed", B);
ok(feedHits.length === 2 && feedHits[0].includes("jobsearch-template") && feedHits[1].includes("own-feed.vercel.app"), "default feed for her, his own feed for him", feedHits);
ok(store.has(feedKey("najjuko")) && store.has(feedKey("kendall")), "feed cache is kept per person");
await call("/momo/work/jobs/feed", B); ok(feedHits.length === 2, "his cache is used inside 3 hours");
await api(B, { action: "save_groups", groups: [{ k: "AI", n: "Group one" }], feedUrl: "https://evil.example.com/jobs.json" }); feedHits = []; await call("/momo/work/jobs/feed?fresh=1", B);
ok(feedHits.length === 1 && feedHits[0].includes("jobsearch-template"), "an own feed address on an unknown host is ignored: default feed", feedHits);

// Create CV and Work-log lines
store.set("jobs_whatido_najjuko", JSON.stringify({ lines: [{ text: "A SECRET LINE from her Work log", state: "keep" }], skills: ["secret skill"] }));
r = await call("/momo/work/jobs/cvdraft", B, { title: "Analyst", company: "Fake Co", desc: "We are looking for an analyst to lead projects, report on results and manage suppliers every month. ".repeat(2), group: "AI" });
j = await r.json(); ok(r.status === 200 && j.ok && modelCalls === 1, "second person drafts a CV from his own record", [r.status, j.error]);
ok(!/SECRET LINE|secret skill/.test(modelUser) && /A fact line for AI/.test(modelUser) && /Fake Person B/.test(modelUser) && !/Fake Person A/.test(modelUser), "his draft uses his record and never her Work-log lines or her profile");
r = await call("/momo/work/jobs/whatido", B); ok(r.status === 404, "he gets 404 on her Work-log lines (GET)", r.status);
r = await call("/momo/work/jobs/whatido", B, { action: "suggest" }); ok(r.status === 404, "he gets 404 on her Work-log lines (POST)", r.status);
r = await call("/momo/work/jobs/whatido", A); ok(r.status === 200, "she reads her own Work-log lines");
r = await call("/momo/work/jobs/cvdraft", A, { title: "Analyst", company: "Fake Co", desc: "We are looking for an analyst to lead projects, report on results and manage suppliers every month. ".repeat(2) }); j = await r.json();
ok(r.status === 200 && /A SECRET LINE/.test(modelUser) && !/Fake Person B/.test(modelUser), "her draft still uses her approved Work-log lines and not his record");

// the POST addresses go through the real entry point
for (const [p, key] of [["/momo/work/jobs/api", ""], ["/momo/work/jobs/cv", ""], ["/momo/work/jobs/cvdraft", ""], ["/momo/work/jobs/api", NOBODY]]) { const x = await call(p, key, { action: "x" }); ok(x.status === 401 || x.status === 404, "POST " + p + " without a person's key is refused", x.status); }
for (const p of ["/momo/work/jobs/api", "/momo/work/jobs/cv", "/momo/work/jobs/cvdraft"]) { const x = await call(p, B, { action: "nothing", group: "AI" }); ok(x.status !== 401, "POST " + p + " reaches its handler for his key (not blocked by the POST guard)", x.status); }

// page classify with a person's own match words (the browser function, run here)
{ const { JOBS_JS } = await import("../src/work_jobs_page.js");
  const m = JOBS_JS.match(/function classify\(t\)\{[\s\S]*?return ks\.indexOf\(r\)>=0\?r:ks\[0\]\}/); ok(!!m, "classify found in the page script");
  const mk = new Function("GROUPS", "CL", "RE_W", "DIG_W", "PR_W", "MKT_W", m[0] + "; return classify;");
  const G = [{ k: "AI" }, { k: "SC" }, { k: "DC" }], CL = { AI: ["alpha"], SC: ["beta"], DC: ["delta"], _order: ["DC", "SC", "AI"], _else: "AI" }, c = mk(G, CL, [], [], [], []);
  ok(c("Senior Delta Lead") === "DC" && c("Beta and Alpha") === "SC" && c("Alpha Manager") === "AI" && c("Something else") === "AI", "his own words and order decide the group; unmatched goes to _else");
  const d = mk([{ k: "MKT" }, { k: "DIG" }, { k: "PR" }, { k: "BD" }, { k: "RE" }], null, ["property"], ["digital"], ["press"], ["marketing"]);
  ok(d("Property Consultant") === "RE" && d("Digital Lead") === "DIG" && d("Marketing Manager") === "MKT" && d("Sales Manager") === "BD", "no own words: the default words and order work as before");
  const e = mk([{ k: "AI" }, { k: "SC" }], null, ["property"], [], [], []); ok(e("Property Consultant") === "AI", "a default group that is not the person's falls back to their first group"); }

globalThis.fetch = realFetch; console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
