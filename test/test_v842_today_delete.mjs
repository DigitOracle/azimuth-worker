// v842 (Najjuko 20 Nov 2026): "if I have said remove the task, do not bring it back up" + a Delete button on the Today rows.
// Deleted tasks stay gone even when new work is logged under the same name; Delete on a Today post / task / call removes it for good.
import assert from "node:assert/strict";
import { workRoute, todayData } from "../src/work_log.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
function kv() { const m = new Map(); return { m, get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => m.delete(k), list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix || "")).map((name) => ({ name })), list_complete: true }) }; }
const store = kv(), env = { MEETINGS: store };
const today = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10), later = new Date(Date.now() + 4 * 3600e3 + 60e3).toISOString();
const deps = { isNaj: () => true, isAny: () => true, person: () => "najjuko", page: (k, r, b) => "<html><body>" + b + "</body></html>" };
const req = (method, body) => { const u = new URL("https://x/momo/work/api?key=K"); return workRoute(new Request(u, method === "GET" ? {} : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), env, u, deps).then((x) => x.json()); };
const tasks = async () => (await req("GET")).tasks.map((t) => t.name);

// 1 a task deleted from the drawer stays gone when a later entry (a meeting read, a recording) logs work under the same name
await store.put("work_naj_" + today + "_e1", JSON.stringify({ id: "e1", date: today, created: "2026-11-01T08:00:00Z", title: "Prep", type: "Deliverable", works: ["Weekly market video"], progress: [{ work: "Weekly market video", status: "In progress", percent: 20 }] }));
ok((await tasks()).includes("Weekly market video"), "the task is on her list");
let r = await req("POST", { action: "task_delete", name: "Weekly market video" }); ok(r.ok, "task_delete ok");
ok(!(await tasks()).includes("Weekly market video"), "gone after Delete");
await store.put("work_naj_" + today + "_e2", JSON.stringify({ id: "e2", date: today, created: later, title: "Recording read", type: "Meeting", works: ["Weekly market video"], progress: [{ work: "Weekly market video", status: "Started", percent: 0 }] }));
ok(!(await tasks()).includes("Weekly market video"), "a newer entry naming it no longer brings it back (it did before v842)");

// 2 Delete on a Today task row
await store.put("work_naj_" + today + "_e3", JSON.stringify({ id: "e3", date: today, created: later, title: "x", type: "Organising", works: ["Call the printer"], progress: [{ work: "Call the printer", status: "Stuck", percent: 10 }] }));
ok((await tasks()).includes("Call the printer"), "second task listed");
r = await req("POST", { action: "today_delete", what: "task", name: "Call the printer" }); ok(r.ok && r.saved === "Task deleted", "today_delete task");
ok(!(await tasks()).includes("Call the printer"), "Today: task gone");

// 3 Delete on a Today post row: the planner item is soft-deleted and drops off Today
await store.put("cp_index", JSON.stringify(["FD-TEST-1"]));
await store.put("cp_item_FD-TEST-1", JSON.stringify({ code: "FD-TEST-1", kind: "feed", date: today, time: "", format: "", topic: "[Flex: only if content is ready]", done: {}, log: [] }));
ok((await todayData(env)).posts.some((p) => p.code === "FD-TEST-1"), "post on Today");
r = await req("POST", { action: "today_delete", what: "post", code: "FD-TEST-1" }); ok(r.ok, "today_delete post " + JSON.stringify(r));
ok(!(await todayData(env)).posts.some((p) => p.code === "FD-TEST-1"), "post gone from Today");
const it = JSON.parse(store.m.get("cp_item_FD-TEST-1")); ok(it.deleted && it.log[0].what === "deleted" && /Najjuko/.test(it.log[0].who), "kept as a deleted record with who did it");

// 4 Delete on a Today call row: the follow-up is closed and its "Call ..." task is dismissed
await store.put("camp_handover_index", JSON.stringify([{ kind: "follow_up", cid: "c1", d: "971500000001", name: "Kendall Wilson", status: "open" }, { kind: "follow_up", cid: "c1", d: "971500000002", name: "Najjuko", status: "open" }]));
await store.put("camp_task_c1_971500000001", "work_naj_" + today + "_cf1");
await store.put("work_naj_" + today + "_cf1", JSON.stringify({ id: "cf1", date: today, created: later, title: "Call Kendall Wilson (+971 ••• 0001), Test", type: "Follow-up", works: ["Call Kendall Wilson (+971 ••• 0001), Test"], progress: [{ work: "Call Kendall Wilson (+971 ••• 0001), Test", status: "Started", percent: 0 }] }));
let td = await todayData(env); ok(td.followups.length === 2 && td.followups[0].d === "971500000001", "two calls on Today, each with its number key");
ok((await tasks()).includes("Call Kendall Wilson (+971 ••• 0001), Test"), "its task is listed");
r = await req("POST", { action: "today_delete", what: "call", cid: "c1", d: "971500000001" }); ok(r.ok && r.saved === "Call deleted", "today_delete call");
td = await todayData(env); ok(td.followups.length === 1 && td.followups[0].name === "Najjuko", "only the other call is left");
ok(!(await tasks()).includes("Call Kendall Wilson (+971 ••• 0001), Test"), "its task is gone too");
r = await req("POST", { action: "today_delete", what: "call", cid: "c1", d: "nope" }); ok(r.error, "unknown call: an error, nothing changed");
r = await req("POST", { action: "today_delete", what: "x" }); ok(r.error, "unknown kind refused");

// 5 the page carries the Delete buttons
const { TODAY_CLIENT } = await import("../src/today_full.js").catch(() => ({}));
const src = (await import("node:fs")).readFileSync(new URL("../src/work_log.js", import.meta.url), "utf-8");
ok(src.includes('tddel:"post"') && src.includes('tddel:"task"') && src.includes('tddel:"call"') && src.includes("It will not come back."), "Work page Today card: Delete on post, task and call rows");
const tf = (await import("node:fs")).readFileSync(new URL("../src/today_full.js", import.meta.url), "utf-8");
ok((tf.match(/data-del=/g) || []).length >= 4, "full Today page: Delete on calls, tasks and posts");
// 6 a deleted log entry stays gone even when a feature writes the same entry again (the campaign follow-up rewrites its entry on every tap)
const { workHomeTop } = await import("../src/work_log.js");
const key = "work_naj_" + today + "_e9";
await store.put(key, JSON.stringify({ id: "e9", date: today, created: later, title: "Follow-up from the campaign", type: "Follow-up", works: [] }));
let wk = await req("GET"); ok(wk.entries.some((e) => e.id === "e9"), "entry in the log");
r = await req("POST", { action: "delete", id: "e9", date: today }); ok(r.ok, "entry deleted");
await store.put(key, JSON.stringify({ id: "e9", date: today, created: later, title: "Follow-up from the campaign", type: "Follow-up", works: [] }));
wk = await req("GET"); ok(!wk.entries.some((e) => e.id === "e9"), "written again by a feature: still not shown");

// 7 home: a task with a date shows from 2 days before it; tasks and meetings are accordions with Delete
const d = (n) => new Date(Date.now() + 4 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
for (const [nm, due] of [["Due in five days", d(5)], ["Due tomorrow", d(1)], ["No date at all", ""]]) {
  await store.put("work_naj_" + today + "_" + nm.replace(/\W/g, "").toLowerCase(), JSON.stringify({ id: nm.replace(/\W/g, "").toLowerCase(), date: today, created: later, title: nm, type: "Organising", works: [nm], progress: [{ work: nm, status: "Started", percent: 0, due }] }));
}
const h = await workHomeTop(env, "K"), now = h.split("data-acc=home_later")[0];
ok(now.includes(">Due tomorrow<") && now.includes(">No date at all<"), "near and undated tasks show now");
ok(!now.includes(">Due in five days<") && h.includes(">Due in five days<"), "a task 5 days away waits in 'with a later date'");
ok(/details class=acc data-acc=home_tasks/.test(h) && /details class=acc data-acc=home_meet/.test(h), "MY TASKS and MEETINGS are accordions");
ok(/<details class='htk acc1/.test(h) && h.includes(">Delete</button></details>"), "each task is an accordion row with Delete");
ok(src.includes("INNAV") && /details class=\\"tdc acc\\" data-acc=w_today/.test(src) && src.includes('details class="ent acc1"'), "leave-page prompt skipped inside Momo; Today and log entries are accordions");
console.log("test_v842_today_delete: " + n + " checks passed");
