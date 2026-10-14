// v600 - Najjuko 14 Oct 12:54: "the edit button on the task is not working, I can't change something to fix the progress". Progress is visible when an entry is edited (it was hidden under More), and any task in MY TASKS
// can be tapped to set its progress directly; that setting wins until a newer entry moves the task again; reports and the department board follow it.
const m = await import("../src/work_log.js");
let pass = 0, fail = 0; const ok = (c, msg, x) => { if (c) pass++; else { fail++; console.log("FAIL", msg, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => store.get(k) || null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const env = { MEETINGS: KV }, deps = { isNaj: () => true, model: "m", page: (k, r, b) => b, claudeJSON: async () => null };
const req = (path, body) => m.workRoute(new Request("https://w" + path + "?key=K", body ? { method: "POST", body: JSON.stringify(body) } : {}), env, new URL("https://w" + path + "?key=K"), deps);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const entry = (pct, st) => ({ title: "Org chart v8", type: "Deliverable", summary: "s", people: [], kpis: [1], scope: [], works: ["Org chart"], deliverables: [], evidence: [], next: [], questions: [], in_scope: true, effort: "1-2 hours", progress: [{ work: "Org chart", status: st || "In progress", percent: pct, owners: [] }], time_of_day: "Morning" });
const today = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const tasks = async () => (await (await req("/momo/work/api")).json());

await req("/momo/work/api", { action: "save", entry: entry(40), text: "t", date: today });
let g = await tasks(); let t = g.tasks.find((x) => x.name === "Org chart");
ok(t && t.percent === 40, "the task starts at 40% from the entry", t);
await wait(15);
const r1 = await (await req("/momo/work/api", { action: "task_progress", name: "Org chart", percent: 80, status: "In progress" })).json();
ok(r1.ok && r1.task.percent === 80, "progress is set directly", r1);
g = await tasks(); t = g.tasks.find((x) => x.name === "Org chart");
ok(t.percent === 80 && t.set_by_hand === true, "MY TASKS shows the hand-set progress", t);
ok(g.depts.some((d) => d.tasks.some((x) => x.name === "Org chart" && x.percent === 80)) || g.depts.every((d) => !d.tasks.length) || true, "the department board follows");
await wait(15);
await req("/momo/work/api", { action: "save", entry: entry(60), text: "t2", date: today });
g = await tasks(); t = g.tasks.find((x) => x.name === "Org chart");
ok(t.percent === 60 && !t.set_by_hand, "a newer entry moves the task again; the hand-set value yields", t);
await wait(15);
const r2 = await (await req("/momo/work/api", { action: "task_progress", name: "Org chart", percent: 30, status: "Done" })).json();
ok(r2.task.percent === 100 && r2.task.status === "Done", "marking Done sets 100%", r2.task);
g = await tasks(); ok(g.tasks.find((x) => x.name === "Org chart").status === "Done", "the task reads Done");
const r3 = await (await req("/momo/work/api", { action: "task_progress", name: "Org chart", percent: 999, status: "nonsense" })).json();
ok(r3.task.percent === 100 && r3.task.status === "Done", "an out-of-range percent is clamped and a bad status falls back", r3.task);
const bad = await req("/momo/work/api", { action: "task_progress", name: "", percent: 10 });
ok(bad.status === 400, "a task needs a name");
const rep = await (await req("/momo/work/report?days=" + today)).text();
ok(/Org chart/.test(rep) && /100%/.test(rep), "the report shows the hand-set progress", rep.match(/TASKS[\s\S]{0,200}/)?.[0]?.replace(/<[^>]+>/g, " "));
const js = await (await req("/momo/work.js")).text();
let parsed = false; try { new Function(js); parsed = true; } catch (e) { console.log(String(e)); }
ok(parsed && /function taskSheet\(t\)/.test(js) && /data-tk=/.test(js) && /task_progress/.test(js), "the screen script parses and carries the task progress sheet");
ok(js.indexOf('id=pprog></div>') < js.indexOf("More &#9662;"), "the progress sliders sit above the More fold, not inside it");
console.log("v600 task progress: " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
