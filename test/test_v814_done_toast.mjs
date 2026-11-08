// v814: one-tap actions on Work home and Meetings confirm with a toast and an Undo, show an error and keep the card when the save fails,
// and Done really persists after a reload (Najjuko tested "90 plate plan" and "AI voice cloning", 8 Nov).
import assert from "node:assert/strict";
import { workRoute, workHomeTop } from "../src/work_log.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
function kv() { const m = new Map(); return { m, get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => m.delete(k), list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix || "")).sort().map((name) => ({ name })), list_complete: true }) }; }
const store = kv(), env = { MEETINGS: store };
const today = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const deps = { isNaj: () => true, isAny: () => true, person: () => "najjuko", page: (k, r, b) => "<html><body>" + b + "</body></html>" };
const post = (path, body) => { const u = new URL("https://x" + path + "?key=K"); return workRoute(new Request(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), env, u, deps).then((x) => x.json()); };
const home = async () => workHomeTop(env, "K");

// a task that lives in her work log (from entries) and a quick task: both on the home cards
await store.put("work_naj_" + today + "_e1", JSON.stringify({ id: "e1", date: today, title: "Worked on the plates", type: "Deliverable", works: ["90 plate plan"], progress: [{ work: "90 plate plan", status: "In progress", percent: 40 }], people: [] }));
let r = await post("/momo/work/api", { action: "task_quick", text: "AI voice cloning", due: today });
ok(r.ok, "quick task made");
let h = await home();
ok(h.includes("90 plate plan") && h.includes("AI voice cloning"), "both tasks on the home cards");

// Done persists after a reload (a fresh read of the page)
for (const name of ["90 plate plan", "AI voice cloning"]) {
  r = await post("/momo/work/api", { action: "task_progress", name, status: "Done", percent: 100 });
  ok(!r.error, "Done saved: " + name + " " + JSON.stringify(r).slice(0, 80));
}
h = await home();
ok(!h.includes(">90 plate plan<") && !h.includes(">AI voice cloning<"), "after a reload both stay done (gone from the cards)");

// Undo restores the task exactly as it was
const before = JSON.parse(store.m.get([...store.m.keys()].find((k) => k.startsWith("work_naj_task_") && k.includes("voice"))));
ok(r.prev !== undefined, "Done returns what it replaced, so Undo can put it back");
const rv = await post("/momo/work/api", { action: "task_restore", name: "AI voice cloning", rec: r.prev });
ok(rv.ok, "Undo saved");
h = await home();
ok(h.includes(">AI voice cloning<"), "Undo brings the task back to the cards");
const p1 = await post("/momo/work/api", { action: "task_progress", name: "90 plate plan", status: "In progress", percent: 40 });
ok(!p1.error, "the other one can be reopened too");

// Tomorrow: moves the date, Undo puts the old date back
r = await post("/momo/work/api", { action: "task_snooze", name: "AI voice cloning" });
ok(r.ok && r.task.due > today && r.prev && r.prev.due === today, "Tomorrow returns the old record for Undo");
await post("/momo/work/api", { action: "task_restore", name: "AI voice cloning", rec: r.prev });
ok(JSON.parse(store.m.get([...store.m.keys()].find((k) => k.startsWith("work_naj_task_") && k.includes("voice")))).due === today, "Undo puts the old date back");
ok((await post("/momo/work/api", { action: "task_restore", name: "Other", rec: { name: "Not the same" } })).error, "Undo only restores the same task");

// the page script: a toast with the title and Undo for about 5 s; on failure an error toast and the card stays
ok(/Done ✓ /.test(h) || /"Done \\u2713 "|Done \\u2713 |Done &#10003; /.test(h) || h.includes("Done ✓ "), "the confirmation reads Done ✓ <title>");
ok(h.includes("momoToast(") && /5000/.test(h) && h.includes("Undo"), "toast with Undo for about 5 seconds");
ok(/Not saved/.test(h) && !/c\.remove\(\)\}\)\}\}\);/.test(h.replace(/\s/g, "")), "a failed save shows an error toast and keeps the card");
const { MOMO_TOAST_JS } = await import("../src/momo_toast.js");
new Function(MOMO_TOAST_JS); ok(true, "the toast script parses");

// Meetings: Archive / Bring back toast with Undo
await store.put("recw_20261101abcde", JSON.stringify({ id: "20261101abcde", date: "2026-11-01", title: "An old meeting", status: "filed", secs: 60 }));
const u = new URL("https://x/momo/work/meetings?key=K"), page = await (await workRoute(new Request(u), env, u, deps)).text();
ok(page.includes("momoToast(") && page.includes("Archived: ") && page.includes("Undo") && !/archive_one[^;]*location\.reload\(\)/.test(page.slice(page.indexOf("data-arc"))), "Archive confirms with a toast and Undo, no silent reload");
// ---- Later (Tomorrow / Next week / Pick date), Set date, no date never overdue ----
r = await post("/momo/work/api", { action: "task_snooze", name: "AI voice cloning", days: 7 });
ok(r.ok && r.task.due === new Date(Date.parse(today + "T00:00:00Z") + 7 * 864e5).toISOString().slice(0, 10), "Next week");
r = await post("/momo/work/api", { action: "task_snooze", name: "AI voice cloning", to: "2026-12-24" });
ok(r.ok && r.task.due === "2026-12-24", "Pick date");
h = await home();
ok(!h.includes("data-hsnz") && (await import("node:fs")).readFileSync(new URL("../src/work_log.js", import.meta.url), "utf8").includes("Later &#9662;") && h.includes("data-days=7>Next week") && h.includes("Pick date"), "Tomorrow is now Later: Tomorrow / Next week / Pick date");
const undated = h.slice(h.indexOf(">90 plate plan<"), h.indexOf(">90 plate plan<") + 700);
ok(undated.includes("No date") && undated.includes("Set date") && !undated.includes("overdue") && !undated.includes("due today"), "a task with no date reads No date with Set date, never overdue");

// ---- Remove: soft, Undo, never re-created; meeting tasks labelled and listed for review ----
await store.put("work_naj_" + today + "_rmt0", JSON.stringify({ id: "rmt0", date: today, title: "Strategy meeting with Ali", type: "Meeting", auto: true, rec: "20261108xyz", works: ["Business development needs proposal"], progress: [{ work: "Business development needs proposal", status: "Started", percent: 0 }], people: [] }));
h = await home();
ok(h.includes("from meeting Strategy meeting with Ali") && h.includes("made by meetings before drafts: review"), "a task an older meeting made is labelled and listed for review");
r = await post("/momo/work/api", { action: "task_remove", name: "Business development needs proposal" });
const rmKey = [...store.m.keys()].find((k) => k.startsWith("work_naj_task_") && k.includes("business"));
ok(r.ok && JSON.parse(store.m.get(rmKey)).dismissed === true, "Remove is soft: the record is kept, marked dismissed");
h = await home();
ok(!h.includes(">Business development needs proposal<"), "removed from the cards");
await store.put("work_naj_" + today + "_rmt1", JSON.stringify({ id: "rmt1", date: today, title: "Strategy meeting again", type: "Meeting", auto: true, rec: "20261108xyz", works: ["Business development needs proposal"], progress: [{ work: "Business development needs proposal", status: "Started", percent: 10 }], people: [], created: new Date(Date.now() + 60000).toISOString() }));
ok(!(await home()).includes(">Business development needs proposal<"), "a removed meeting task is not re-created when the meeting is filed again");
r = await post("/momo/work/api", { action: "task_restore", name: "Business development needs proposal", rec: r.prev });
ok((await home()).includes(">Business development needs proposal<"), "Undo brings it back");
r = await post("/momo/work/api", { action: "task_keep", name: "Business development needs proposal" });
ok(r.ok && !(await home()).includes("made by meetings before drafts: review"), "Keep takes it off the review card");
ok(h.includes("momoToast('Removed: '") && h.includes("task_restore"), "Remove confirms with a toast and Undo");

// ---- why meeting points became live tasks: auto-filed entries carried works; from v814 they become drafts on the meeting ----
const { recAutoFile } = await import("../src/work_log.js");
const rid = today.replace(/-/g, "") + "auto1";
await store.put("recw_" + rid, JSON.stringify({ id: rid, date: today, title: "Auto meeting", status: "transcribed", secs: 600, started: new Date(Date.now() - 3600e3).toISOString(), stopped_at: new Date().toISOString(), expect_parts: 1,
  minutes: { title: "t", purpose: "p", decisions: [], discussion: [], open_questions: [], actions: [] }, notes: { summary: "Notes.", topics: [], decisions: [], actions: [], people: [] },
  summary_full: { paragraphs: ["x"], bullets: [], topics: [], decisions: [], figures: [], open_questions: [], unclear: [], actions: [], hr: false }, draft_tasks: [] }));
await store.put("recs_" + rid + "_000", JSON.stringify({ n: 0, secs: 600, text: "Words of the meeting here. ".repeat(8) }));
const stub = { claudeJSON: async (e, sys, user, schema) => (schema && schema.properties && schema.properties.entries ? { entries: [{ title: "Auto meeting", type: "Meeting", summary: "s", works: ["Send the media kit to Sousan"], progress: [{ work: "Send the media kit to Sousan", status: "Started", percent: 0 }] }] } : null), model: "stub" };
for (let i = 0; i < 3; i++) await recAutoFile(env, stub, Date.now());
const autoE = [...store.m.keys()].filter((k) => k.startsWith("work_naj_" + today + "_r") && k.includes(rid.slice(-10).slice(0, 4))).map((k) => JSON.parse(store.m.get(k)));
const autoM = JSON.parse(store.m.get("recw_" + rid));
if (process.env.DBG) console.error(JSON.stringify({ st: autoM.status, dt: autoM.draft_tasks, tries: autoM.auto_file_tries, last: store.m.get("rec_autofile_last") }));
ok(autoM.status === "filed" && (autoM.draft_tasks || []).some((d) => d.text === "Send the media kit to Sousan" && d.state === "draft"), "an auto-filed meeting's tasks wait as drafts on the meeting");
ok(!(await home()).includes(">Send the media kit to Sousan<"), "and never become live tasks without her tap");

// ---- TASK QUALITY: verb + what (+ for whom), a start and a due date ----
r = await post("/momo/work/api", { action: "task_quick", text: "Create the footprint plan for Sultan" });
ok(r.error && /due date/.test(r.error), "a quick task without a due date is refused");
r = await post("/momo/work/api", { action: "task_quick", text: "Create the footprint plan for Sultan", due: "2026-11-20" });
ok(r.ok && r.task.start === today && r.task.due === "2026-11-20", "start defaults to today, due required");
const qs = (await import("node:fs")).readFileSync(new URL("../src/quick_task.js", import.meta.url), "utf8");
ok(qs.includes('id="qt_start"') && qs.includes("Add a due date before saving.") && qs.includes("Start with a verb and say for whom"), "the Quick task form asks for start, due and a verb");
const { draftTasksFrom, splitActions, taskGaps, isAction } = await import("../src/draft_tasks.js");
ok(isAction("Create the digital footprint plan for Sultan") && !isAction("Brand and digital footprint") && !isAction("Business development needs proposal"), "a topic label is not a task");
ok(taskGaps("December campaign UAE National Day", "2026-11-10", "2026-12-02").join() === "verb", "a dated label still needs a verb");
const dts = draftTasksFrom([{ action: "Send the brochure to Faez", owner: "", due: "2026-12-02", due_stated: true }, { action: "Book the venue", owner: "", due: "2026-12-05", due_stated: false }, { action: "Brand and digital footprint", owner: "", due: "" }], [], null);
ok(dts.length === 2 && dts[0].due === "2026-12-02" && dts[0].needs_dates && dts[1].due === "" && dts[1].needs_dates, "dates only when the meeting said them; never invented; Set dates otherwise");
ok(splitActions([{ action: "Brand and digital footprint" }]).topics[0] === "Brand and digital footprint", "a point that is not an action goes to Topics discussed");
const { attachDraftTasks } = await import("../src/draft_tasks.js");
const mt = attachDraftTasks({ minutes: { actions: [{ action: "Brand and digital footprint" }, { action: "Call the printer", due_stated: false }] } }, []);
ok(mt.topics_discussed.includes("Brand and digital footprint") && mt.draft_tasks.length === 1, "the meeting keeps its topics; only the action is a draft");
const recQ = { id: today.replace(/-/g, "") + "qual1", date: today, title: "Q", status: "filed", secs: 60, draft_tasks: draftTasksFrom([{ action: "Call the printer for the brochure", owner: "" }], [], null) };
await store.put("recw_" + recQ.id, JSON.stringify(recQ));
r = await post("/momo/work/api", { action: "draft_task", id: recQ.id, did: recQ.draft_tasks[0].id, op: "add" });
ok(r.error && /start and due/.test(r.error), "a draft cannot be added until both dates are set");
await post("/momo/work/api", { action: "draft_task", id: recQ.id, did: recQ.draft_tasks[0].id, op: "save", start: "2026-11-10", due: "2026-11-12" });
r = await post("/momo/work/api", { action: "draft_task", id: recQ.id, did: recQ.draft_tasks[0].id, op: "add" });
ok(r.ok && JSON.parse(store.m.get([...store.m.keys()].find((k) => k.includes("call-the-printer")))).start === "2026-11-10", "with both dates it becomes a real task with start and due");
await store.put("work_naj_task_brand-and-digital-footprint", JSON.stringify({ name: "Brand and digital footprint", quick: true, status: "Started", percent: 0, created: today + "T08:00:00Z", owners: [], due: "" }));
h = await home();
const card = h.slice(h.indexOf(">Brand and digital footprint<") - 40, h.indexOf(">Brand and digital footprint<") + 400);
ok(card.includes("Needs detail · Edit"), "an existing open task that fails the rule shows Needs detail with Edit");
ok(store.m.has("work_naj_task_brand-and-digital-footprint") && JSON.parse(store.m.get("work_naj_task_brand-and-digital-footprint")).name === "Brand and digital footprint", "it is neither deleted nor rewritten");
r = await post("/momo/work/api", { action: "task_detail", name: "Brand and digital footprint", wording: "Brand and footprint", start: "2026-11-10", due: "2026-11-20" });
ok(r.error && /verb/.test(r.error), "Edit still asks for a verb");
r = await post("/momo/work/api", { action: "task_detail", name: "Brand and digital footprint", wording: "Create the digital footprint plan for Sultan", start: "2026-11-10", due: "2026-11-20" });
ok(r.ok && !(await home()).slice((await home()).indexOf("Create the digital footprint plan for Sultan") - 40).slice(0, 400).includes("Needs detail"), "with verb, start and due the badge goes; her wording shows");
console.log("test_v814_done_toast: " + n + " checks passed");
