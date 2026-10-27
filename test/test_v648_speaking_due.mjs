// v648 - Speaking: what is due per engagement (defaults by type, chip colours, set_due / toggle_due, the owner key only). Fake data only.
import { dueOf, dueChip, dueQuestion, cleanDue, spkReport, SPK_JS } from "../src/work_speaking.js";
const worker = (await import("../src/index.js")).default;
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };

// defaults by type
ok(dueOf({ type: "panel" }).length === 0, "panel: nothing due by default");
ok(dueOf({ type: "judge" }).length === 0 && dueOf({ type: "award" }).length === 0, "judge and award: nothing due");
for (const t of ["talk", "keynote", "masterclass", "lecture", "webinar"]) ok(dueOf({ type: t })[0].what === "Slides / presentation", t + ": slides implied");
ok(dueOf({ type: "talk", due: [] }).length === 0, "an explicit empty list means nothing due");

// chips with a fixed today
const T = "2026-01-10";
ok(dueChip({ type: "panel", date: "2026-01-11" }, T).cls === "ok" && /just show up/.test(dueChip({ type: "panel", date: "2026-01-11" }, T).text), "panel tomorrow: green, just show up");
ok(dueChip({ type: "talk", due: [], date: "2026-01-11" }, T).text === "Nothing due", "explicit empty: Nothing due");
let c = dueChip({ type: "talk", date: "2026-01-30" }, T); ok(c.cls === "amber" && c.text === "Due: Slides / presentation", "talk in 20 days: amber", c);
c = dueChip({ type: "talk", date: "2026-01-12" }, T); ok(c.cls === "red" && /^Due soon: /.test(c.text), "talk in 2 days: red", c);
c = dueChip({ type: "talk", date: "2026-02-20", due: [{ what: "Send bio", by: "2026-01-10", done: false }, { what: "Slides", by: "", done: false }] }, T);
ok(c.cls === "red" && c.text === "Due soon: Send bio +1 more", "by-date today: red, +n more", c);
c = dueChip({ type: "talk", date: "2026-01-11", due: [{ what: "Slides", by: "", done: true }] }, T); ok(c.cls === "ok", "all done: green", c);
ok(dueQuestion({ type: "talk", date: "2026-01-11" }, T) === "Presentation tomorrow. Slides / presentation ready?", "banner question", dueQuestion({ type: "talk", date: "2026-01-11" }, T));
ok(dueQuestion({ type: "panel", date: "2026-01-11" }, T) === "Panel tomorrow. Nothing due, just show up.", "banner for a panel");
ok(dueQuestion({ type: "lecture", date: "2026-01-15", due: [{ what: "Send title and bio", by: "", done: false }] }, T) === "Presentation in 5 days. Send title and bio done?", "non-slide item asks 'done?'");

// sanitising
const cd = cleanDue([{ what: "x".repeat(200), by: "2026-13-99", done: 1 }, { what: "" }, ...Array(12).fill({ what: "a" })]);
ok(cd.length === 8 && cd[0].what.length === 80 && cd[0].by === "" && cd[0].done === true, "cleanDue caps, bad date dropped, empty removed", cd.slice(0, 2));
ok(cleanDue(null) === null, "non-array: no list");

// API through the worker
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [], list_complete: true }) };
const KEN = "ins_kendall_TESTKEY0123456789abcd", NAJ = "ins_najjuko_TESTKEY0123456789abcd";
const env = { MEETINGS: KV, INSIDER_KEY: KEN + "," + NAJ }, ctx = { waitUntil() {}, passThroughOnException() {} };
const post = (k, b) => worker.fetch(new Request("https://w/momo/work/speaking/api?key=" + k, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }), env, ctx);
let r = await (await post(KEN, { action: "import_items", items: [{ id: "t1", title: "Example talk", type: "talk", date: "2030-01-01" }, { id: "p1", title: "Example panel", type: "panel", date: "2030-01-02" }] })).json();
ok(r.ok && r.added === 2, "import two items", r);
r = await (await post(KEN, { action: "toggle_due", id: "t1", index: 0, done: true })).json();
ok(r.ok && r.rec.items.find((i) => i.id === "t1").due[0].what === "Slides / presentation" && r.rec.items.find((i) => i.id === "t1").due[0].done === true, "toggle on the implied slides item materialises it", r.rec && r.rec.items[0]);
r = await (await post(KEN, { action: "set_due", id: "p1", due: [{ what: "Bring the panel questions", by: "2029-12-30" }] })).json();
ok(r.ok && r.rec.items.find((i) => i.id === "p1").due.length === 1, "set_due on a panel", r);
r = await (await post(KEN, { action: "toggle_due", id: "p1", index: 5 })).json();
ok(r.error === "No such item.", "bad index refused", r);
ok((await post(NAJ, { action: "set_due", id: "p1", due: [] })).status === 404, "her key refused");
ok((await post("wrong", { action: "set_due", id: "p1", due: [] })).status >= 400, "wrong key refused");

// report shows the due list; page script keeps the __name shim and parses
const rec = JSON.parse(store.get("speaking_rec_kendall"));
const html = spkReport(rec, "p1"); ok(/What is due/.test(html) && /Bring the panel questions/.test(html) && /open/.test(html), "brief shows the due list");
ok(SPK_JS.startsWith("var __name=function(f){return f};") && /dueChip/.test(SPK_JS), "page keeps the shim and embeds dueChip");
try { new Function(SPK_JS); ok(true, "page script parses"); } catch (e) { ok(false, "page script parses", e.message); }
console.log("v648 speaking due: " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
