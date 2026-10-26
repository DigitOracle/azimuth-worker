// v635 - Momo Jobs: best match score, Not for me + duplicate merging, follow-up and the Did-you-apply bar. Record v2 gains `hidden`, `fit` and object-form `applied`. FAKE data only (public repo).
import fs from "node:fs";
const worker = (await import("../src/index.js")).default;
const { JOBS_JS } = await import("../src/work_jobs_page.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [], list_complete: true }) };
const NAJ = "ins_najjuko_TESTKEY0123456789abcd", OWNER = "ins_owner_0123456789abcdefghijk";
const env = { MEETINGS: KV, INSIDER_KEY: NAJ + "," + OWNER }, ctx = { waitUntil() {}, passThroughOnException() {} };
const post = (body, key) => worker.fetch(new Request("https://w/momo/work/jobs/api?key=" + (key || NAJ), { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), env, ctx).then((r) => r.json());
const U1 = "https://example.com/a", U2 = "https://example.org/b", U3 = "https://example.net/c";

// ---- server: object-form applied, follow-up, hidden, fit, legacy string form ----
let j = await post({ action: "mark_applied", url: U1, c: "Example Co", t: "Marketing Manager", g: "MKT", date: "2026-10-20" });
ok(j.rec.applied[U1].d === "2026-10-20" && j.rec.applied[U1].c === "Example Co" && j.rec.applied[U1].g === "MKT", "applied is an object", j.rec.applied);
j = await post({ action: "mark_applied", url: U1, on: true, date: "2026-10-25" }); ok(j.rec.applied[U1].d === "2026-10-20" && j.rec.applied[U1].t === "Marketing Manager", "re-marking keeps the first date and the details", j.rec.applied);
j = await post({ action: "mark_followed", url: U1, date: "2026-10-23" }); ok(j.rec.applied[U1].f === "2026-10-23", "follow-up date set", j.rec.applied);
j = await post({ action: "mark_followed", url: U3 }); ok(j.error, "follow-up on a role never applied to is refused", j);
j = await post({ action: "mark_applied", url: U1, on: false }); ok(!j.rec.applied[U1], "un-applying removes it");
j = await post({ action: "set_hidden", urls: [U1, U2, "javascript:alert(1)"], on: true }); ok(j.rec.hidden[U1] && j.rec.hidden[U2] && Object.keys(j.rec.hidden).length === 2, "hidden holds only http(s) links", j.rec.hidden);
j = await post({ action: "set_hidden", urls: [U2], on: false }); ok(!j.rec.hidden[U2] && j.rec.hidden[U1], "bring back removes one", j.rec.hidden);
j = await post({ action: "save_fit", fit: ["Alpha", " beta ", "", "x".repeat(80)] }); ok(j.rec.fit.length === 3 && j.rec.fit[0] === "alpha" && j.rec.fit[1] === "beta" && j.rec.fit[2].length === 30, "fit words trimmed, lower-cased, capped", j.rec.fit);
// an old record with plain date strings still reads, junk is dropped
store.set("jobs_rec_najjuko", JSON.stringify({ v: 2, applied: { [U3]: "2026-10-01", "ftp://bad": "2026-10-01", [U2]: "not a date" }, hidden: { [U3]: "2026-10-02" } }));
const rec = await (await worker.fetch(new Request("https://w/momo/work/jobs/rec?key=" + NAJ), env, ctx)).json();
ok(rec.applied[U3] && rec.applied[U3].d === "2026-10-01" && Object.keys(rec.applied).length === 1, "old string form is read as an object, junk dropped", rec.applied);
ok(rec.hidden[U3] === "2026-10-02" && Array.isArray(rec.fit), "hidden and fit come back with the record", rec);
for (const k of ["", "wrong"]) { const r = await worker.fetch(new Request("https://w/momo/work/jobs/api?key=" + k, { method: "POST", body: "{}" }), env, ctx); ok(r.status === 401 || r.status === 404, "refused with key '" + k + "'", r.status); }

// ---- page logic, run against stubs (no DOM): fitScore, normKey, dedupe ----
const start = JOBS_JS.indexOf("var GFIT="), end = JOBS_JS.indexOf("var SRCN=");
const code = JOBS_JS.slice(start, end);
const REC = { fit: [] }, today = () => "2026-10-26", srcKey = (j) => (j.s === "LinkedIn" ? "li" : j.s === "Bayt" ? "bayt" : "co");
const L = new Function("REC", "today", "srcKey", code + "; return { fitScore, normKey, dedupe, fitWords, apOf: function(){} };")(REC, today, srcKey);
const head = L.fitScore({ t: "Head of Marketing", d: "2026-10-26" }, "MKT"), mgr = L.fitScore({ t: "Marketing Manager", d: "2026-01-01" }, "MKT"), jr = L.fitScore({ t: "Marketing Assistant", d: "2026-01-01" }, "MKT");
ok(head >= 5 && mgr < 5 && mgr > jr && jr <= 2, "score: head of > manager > assistant", [head, mgr, jr]);
ok(L.fitScore({ t: "Head of Marketing", d: "2026-10-26" }, "MKT") <= 6 && L.fitScore({ t: "intern", d: "" }, "MKT") >= 1, "score stays between 1 and 6");
const base = L.fitScore({ t: "Marketing Manager zebra", d: "2026-01-01" }, "MKT"); REC.fit = ["zebra"];
ok(L.fitScore({ t: "Marketing Manager zebra", d: "2026-01-01" }, "MKT") > base, "her own fit words (from the record) raise the score");
ok(L.normKey({ c: "Example LLC", t: "Marketing Manager (Dubai)" }) === L.normKey({ c: "Example Ltd", t: "Marketing Manager - Dubai" }), "same role on two boards shares a key");
ok(L.normKey({ c: "Confidential", t: "Sales", u: "https://x.example/1" }) === "https://x.example/1", "Confidential employers never merge");
const merged = L.dedupe([{ j: { c: "Example Co", t: "Sales Manager", u: "https://li.example/1", s: "LinkedIn" }, i: 0, g: "BD" }, { j: { c: "Example Co", t: "Sales Manager", u: "https://co.example/1", s: "" }, i: 1, g: "BD" }, { j: { c: "Other", t: "Sales Manager", u: "https://b.example/2", s: "Bayt" }, i: 2, g: "BD" }]);
ok(merged.length === 2 && merged[0].j.u === "https://co.example/1" && merged[0].urls.length === 2 && merged[0].srcs.join() === "co,li", "duplicates merge to one row, company site wins", merged);

// ---- the page carries the new pieces, and her own words are NOT in the repo ----
for (const w of ["Best matches", "Not for me", "Follow up today", "Did you apply to", "data-fucopy", "data-hide"]) ok(JOBS_JS.includes(w) || fs.readFileSync(new URL("../src/work_jobs_page.js", import.meta.url), "utf8").includes(w), "page has " + w);
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
