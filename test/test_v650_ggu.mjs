// v650 - Momo GGU card: Kendall's key only; record ggu_rec_kendall; import/merge, tasks, candidate due, notes; next-due chip; front door. FAKE data only (public repo).
const worker = (await import("../src/index.js")).default;
const { cleanGgu, nextDue, candidateChip, chipFor, GGU_JS, gguReport } = await import("../src/work_ggu.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [], list_complete: true }) };
const KEN = "ins_kendall_TESTKEY0123456789abcd", NAJ = "ins_najjuko_TESTKEY0123456789abcd", OTH = "ins_other_TESTKEY0123456789abcdef";
const env = { MEETINGS: KV, INSIDER_KEY: [KEN, NAJ, OTH].join(",") }, ctx = { waitUntil() {}, passThroughOnException() {} };
const get = (p, k) => worker.fetch(new Request("https://w" + p + (p.includes("?") ? "&" : "?") + "key=" + k), env, ctx);
const post = (b, k) => worker.fetch(new Request("https://w/momo/work/ggu/api?key=" + k, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }), env, ctx);
const cards = (h) => (h.match(/class=card/g) || []).length;

// gate
for (const p of ["/momo/work/ggu", "/momo/work/ggu/rec", "/momo/work/ggu/report"]) {
  ok((await get(p, KEN)).status === 200, "Kendall opens " + p);
  for (const k of [NAJ, OTH, "", "wrong"]) { const r = await get(p, k); ok(r.status === 404 || r.status === 401, "refused " + p + " for '" + k.slice(0, 12) + "'", r.status); }
}
for (const k of [NAJ, OTH, ""]) { const r = await post({ action: "import", rec: {} }, k); ok(r.status === 404 || r.status === 401, "POST refused for '" + k.slice(0, 12) + "'", r.status); }

// front door: GGU for Kendall only
const door = async (k) => (await (await get("/momo?door=1", k)).text());
const hk = await door(KEN); ok(/<b>GGU<\/b>/.test(hk) && /\/momo\/work\/ggu\?key=/.test(hk) && cards(hk) === 5, "GGU card on Kendall's front door (5 cards)", cards(hk));
ok(!/<b>GGU<\/b>/.test(await door(NAJ)) && !/<b>GGU<\/b>/.test(await door(OTH)), "no GGU card for Najjuko or others");

// import + merge
const seed = { roles: [{ title: "Adjunct faculty, Example University", detail: "Fake detail", source: "FILE" }],
  candidates: [{ id: "cand-a", name: "Alex Example", cohort: "9 (0000)", mode: "Business Plan", topic: "A fake topic", stage: "Allocated", nextMilestone: "Intro call", due: [{ what: "Intro call", by: "2026-10-29" }, { what: "Topic proposal", by: "2027-01-13" }] }],
  deadlines: [{ date: "2026-11-09", what: "Immersion 1", confirmed: false }, { date: "2026-10-01", what: "Old thing", confirmed: true }],
  documents: [{ label: "Playbook", path_or_url: "C:\\fake\\Playbook.md" }, { label: "Site", path_or_url: "https://example.com/x" }],
  portals: [{ label: "Portal", url: "https://example.com/p" }, { label: "Bad", url: "javascript:alert(1)" }],
  contacts: [{ name: "Pat Example", role: "Director, pat@example.com" }],
  tasks: [{ what: "Nudge decision", by: "2026-10-27" }, { what: "Reset passwords" }],
  ownDba: { cohort: "0000", mode: "Business Plan", completed: "2026", notes: "fake" } };
let r = await (await post({ action: "import", rec: seed }, KEN)).json();
ok(r.ok && r.added === 1 && r.rec.candidates.length === 1 && r.rec.tasks.length === 2 && r.rec.deadlines.length === 2, "import stores the record", r);
ok(r.rec.contacts[0].role.indexOf("@") < 0 && /email removed/.test(r.rec.contacts[0].role), "emails are stripped from the card", r.rec.contacts[0]);
ok(r.rec.portals[1].url === "", "non-http portal link dropped");
r = await (await post({ action: "import", rec: { candidates: [{ id: "cand-a", stage: "Topic proposal drafting" }, { name: "Blake Example", cohort: "9" }] } }, KEN)).json();
ok(r.added === 1 && r.merged === 1 && r.rec.candidates[0].stage === "Topic proposal drafting" && r.rec.candidates[0].topic === "A fake topic" && r.rec.tasks.length === 2, "merge keeps unsent fields and lists", r.rec.candidates[0]);

// tasks, stage, note, due
r = await (await post({ action: "set_task_done", index: 0, done: true }, KEN)).json(); ok(r.rec.tasks[0].done === true, "task ticked");
ok((await post({ action: "set_task_done", index: 9, done: true }, KEN)).status === 404, "bad task index refused");
r = await (await post({ action: "set_candidate_stage", id: "cand-a", stage: "Immersion 1", nextMilestone: "Topic proposal" }, KEN)).json(); ok(r.rec.candidates[0].stage === "Immersion 1" && r.rec.candidates[0].nextMilestone === "Topic proposal", "stage set");
r = await (await post({ action: "add_note", id: "cand-a", text: "Call went well" }, KEN)).json(); ok(/Call went well/.test(r.rec.candidates[0].notes), "note added");
ok((await post({ action: "add_note", id: "nobody", text: "x" }, KEN)).status === 404, "note on unknown candidate refused");
r = await (await post({ action: "toggle_due", id: "cand-a", index: 0, done: true }, KEN)).json(); ok(r.rec.candidates[0].due[0].done === true, "candidate due toggled");
ok((await post({ action: "nope" }, KEN)).status === 400, "unknown action refused");

// chips with a fixed today
const T = "2026-10-27";
ok(chipFor("2026-10-27", T) === "red" && chipFor("2026-10-29", T) === "red" && chipFor("2026-10-30", T) === "amber" && chipFor("2026-10-01", T) === "red" && chipFor("", T) === "amber", "chip thresholds");
const rec0 = cleanGgu({ tasks: [{ what: "A", by: "2026-11-20" }, { what: "B", by: "2026-10-28" }], deadlines: [{ date: "2026-10-01", what: "past", confirmed: true }] });
let n = nextDue(rec0, T); ok(n.cls === "red" && /B/.test(n.text), "next due is the soonest open item, red within 2 days", n);
n = nextDue(cleanGgu({ tasks: [{ what: "A", by: "2026-12-01" }] }), T); ok(n.cls === "amber", "amber when further out", n);
n = nextDue(cleanGgu({ tasks: [{ what: "A", done: true }], deadlines: [{ date: "2026-01-01", what: "old" }] }), T); ok(n.cls === "ok", "green when nothing is open (past deadlines ignored)", n);
ok(candidateChip({ due: [{ what: "x", by: "2027-01-13" }, { what: "y", by: "2026-10-28" }] }, T).cls === "red", "candidate chip uses its soonest open item");
ok(candidateChip({ due: [] }, T).cls === "ok", "candidate with nothing due is green");

// page and report
ok(GGU_JS.startsWith("var __name=function(f){return f};"), "page script defines __name first (v647 rule)");
try { new Function(GGU_JS); ok(true, "page script parses"); } catch (e) { ok(false, "page script parses", e.message); }
const page = await (await get("/momo/work/ggu", KEN)).text(); ok(/<h1>GGU<\/h1>/.test(page) && /Candidates/.test(page) && /My DBA/.test(page), "page renders sections");
const rep = await (await get("/momo/work/ggu/report", KEN)).text(); ok(/Save as PDF/.test(rep) && /Alex Example/.test(rep) && /A4/.test(rep) && !/@example\.com/.test(rep), "report renders, no emails");
ok(/Nothing due/.test(gguReport(cleanGgu({}), T)), "empty report says nothing due");

console.log("v650 ggu: " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
