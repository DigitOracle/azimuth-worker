// v791 (Kendall 6 Nov 2026, promised to Najjuko on their call): "to check" not "to fix"; the responsible person of a planner step can be
// changed; the report says "assigned to X, done by Najjuko"; a Quick task (typed or spoken) is on the task list at once from any Work screen.
import { applyAction, ownerOf, report, derive, DEFAULT_SETTINGS } from "../src/content_planner.js";
import { plannerChecks, CHECK_DEFAULTS } from "../src/planner_checks.js";
import { quickTaskRecord, applyOverrides, tasksOf } from "../src/work_log.js";
import { QUICK_TASK_JS } from "../src/quick_task.js";
import fs from "fs";
let fail = 0, n = 0; const ok = (c, m, x) => { n++; if (!c) { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 500)); } else console.log("ok", m); };
const store = new Map();
const env = { MEETINGS: { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, String(v)); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [], list_complete: true }) } };

// ---- responsible person on a step ----
let [st, o] = await applyAction(env, { action: "save", kind: "feed", format: "Reel", date: "2026-11-10", time: "14:00", topic: "Ellington video", who: "Najjuko", how: "AI video" }, "Najjuko");
const code = o.item.code;
ok(st === 200 && o.item.step_owner && o.item.step_owner.Caption === "Sousan" && o.item.step_owner.Made === "Vishant", "an item carries the owner of every step (the usual ones to begin with)", o.item.step_owner);
[st, o] = await applyAction(env, { action: "owner", code, step: "Caption", name: "  Liam  " }, "Najjuko");
ok(st === 200 && o.item.step_owner.Caption === "Liam" && o.item.owners.Caption === "Liam" && /Caption responsible: Sousan → Liam/.test(o.item.log[0].what), "the responsible person of one step is changed and logged", o.item && o.item.log && o.item.log[0]);
ok(ownerOf(o.item, "Caption") === "Liam" && ownerOf(o.item, "Scheduled") === "Rouba", "only that step changes");
[st, o] = await applyAction(env, { action: "owner", code, step: "Made", name: "Monaza" }, "Najjuko");
ok(st === 200 && o.item.step_owner.Made === "Monaza", "the maker can be changed for this item too");
[st, o] = await applyAction(env, { action: "owner", code, step: "Nonsense", name: "Liam" }, "Najjuko"); ok(st === 400, "a step the item does not have is refused");
[st, o] = await applyAction(env, { action: "owner", code, step: "Caption", name: "<b>x" }, "Najjuko"); ok(st === 400, "a name must be a name");
[st, o] = await applyAction(env, { action: "owner", code, step: "Made", name: "" }, "Najjuko");
ok(st === 200 && o.item.step_owner.Made === "Vishant" && !o.item.owners.Made, "an empty name puts the usual person back");

// ---- "assigned to X, done by Najjuko" ----
[st, o] = await applyAction(env, { action: "tick", code, step: "Caption" }, "Najjuko");
ok(st === 200 && o.item.done.Caption.assigned === "Liam" && o.item.done.Caption.by === "Najjuko", "a tick records who it was assigned to and who did it", o.item.done.Caption);
[st, o] = await applyAction(env, { action: "tick", code, step: "Brief" }, "Najjuko");
const items = [JSON.parse(store.get("cp_item_" + code))];
const rp = report(items, DEFAULT_SETTINGS, "2026-11-09", "2026-11-15", "2026-11-06");
ok(rp.handovers.length === 1 && rp.handovers[0].step === "Caption" && rp.handovers[0].assigned === "Liam" && rp.handovers[0].by === "Najjuko", "the report lists the step she did for someone else, and not the step that was hers", rp.handovers);
const old = { code: "FD-1", kind: "feed", format: "Reel", date: "2026-11-11", topic: "Old", done: { Caption: { done: true, by: "Najjuko", at: "2026-11-05T08:00:00Z" } } };
ok(report([old], DEFAULT_SETTINGS, "2026-11-09", "2026-11-15", "2026-11-06").handovers[0].assigned === "Sousan", "a tick made before this release falls back to the usual owner");

// ---- wording ----
const late = { code: "FD-2", kind: "feed", format: "Reel", date: "2026-11-07", time: "", topic: "No time", who: "Najjuko", how: "AI video", done: {} };
const ch = plannerChecks([derive(late, DEFAULT_SETTINGS, "2026-11-06")], Object.assign({}, DEFAULT_SETTINGS, CHECK_DEFAULTS), "2026-11-06", {});
ok(!/fix/i.test(ch.line) && /to check|Nothing to check/.test(ch.line), "the summary line says to check, never to fix", ch.line);
const pg = fs.readFileSync(new URL("../src/content_planner.js", import.meta.url), "utf8") + fs.readFileSync(new URL("../src/today_full.js", import.meta.url), "utf8");
ok(!/'Fix'|Fix now|QA\/QC fix|No fixes/.test(pg), "no Fix label is left on the planner or the Today card");

// ---- quick task ----
const names = ["Vishant Rao", "Sousan"];
let q = quickTaskRecord({ text: "  Call   the Ellington  rep about the brochure ", who: "Sousan", due: "2026-11-12" }, names, "2026-11-06T09:00:00.000Z", "Najjuko");
ok(q.rec && q.rec.name === "Call the Ellington rep about the brochure" && q.rec.quick && q.rec.status === "Started" && q.rec.percent === 0 && q.rec.owners[0] === "Sousan" && q.rec.due === "2026-11-12" && q.rec.by === "Najjuko", "a quick task record from typed or spoken words", q.rec);
ok(quickTaskRecord({ text: " a " }, names, "x", "Najjuko").error && quickTaskRecord({ text: "Book the studio", who: "A stranger", due: "2026-11-09" }, names, "2026-11-06T09:00:00Z", "Najjuko").rec.owners.length === 0, "nothing typed is refused; an unknown person is dropped");
ok(/due date/.test(quickTaskRecord({ text: "Book the studio", due: "soon" }, names, "2026-11-06T09:00:00Z", "Najjuko").error || ""), "v814: a bad or missing due date is refused (a task needs a due date)");
const long = quickTaskRecord({ text: "x".repeat(200), due: "2026-11-20" }, names, "2026-11-06T09:00:00Z", "Najjuko").rec;
ok(long.name.length === 80 && long.detail.length === 200, "long words are kept in full behind a short name");
const entries = [{ date: "2026-11-05", created: "2026-11-05T08:00:00Z", works: ["Brochure refresh"], progress: [{ work: "Brochure refresh", status: "In progress", percent: 40, owners: [] }], effort: "1-2 hours" }];
let list = applyOverrides(tasksOf(entries), [q.rec]);
const qt = list.find((t) => t.name === q.rec.name);
ok(list.length === 2 && qt && qt.quick && qt.hours === 0 && qt.entries === 0 && qt.status === "Started" && qt.due === "2026-11-12" && qt.owners[0] === "Sousan", "the quick task is on the list at once, with no hours and no log entry", qt);
list = applyOverrides(tasksOf(entries), [Object.assign({}, q.rec, { status: "Done", percent: 100, updated: "2026-11-07T09:00:00Z" })]);
ok(list.find((t) => t.name === q.rec.name).status === "Done", "her progress on a quick task shows");
list = applyOverrides(tasksOf(entries), [Object.assign({}, q.rec, { deleted: true })]);
ok(list.length === 1, "a deleted quick task is gone");
list = applyOverrides(tasksOf(entries), [{ name: "Brochure refresh", quick: true, percent: 0, status: "Started", updated: "2026-11-01T00:00:00Z", created: "2026-11-01T00:00:00Z" }]);
ok(list.length === 1 && list[0].entries === 1, "once work is logged on it, it is the same one task, not two");
ok(/Quick task/.test(QUICK_TASK_JS) && /task_quick/.test(QUICK_TASK_JS) && /SpeechRecognition/.test(QUICK_TASK_JS) && !/`/.test(QUICK_TASK_JS.slice(1)) && /\/momo\/work/.test(QUICK_TASK_JS), "the button script: Work screens only, type or speak");
try { new Function("window", "document", "location", "URLSearchParams", "fetch", QUICK_TASK_JS); ok(true, "the button script parses"); } catch (e) { ok(false, "the button script parses", String(e)); }
const idx = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/<script>' \+ QUICK_TASK_JS \+ '<\/script><\/body>/.test(idx), "the shared Momo page loads it");
console.log("test_v791_najjuko_call: " + (n - fail) + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
