// v764: meeting Sync - proposals are checked against the stored planner and tasks, nothing is written until apply, sheet items are queued
import { workRoute } from "../src/work_log.js";
import { checkChanges, meetingLines, syncApply, pendingList, pendingDone } from "../src/meeting_sync.js";
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("ok", m); };
const store = new Map();
const env = { MEETINGS: { get: async (k) => store.has(k) ? store.get(k) : null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) }, INSIDER_KEY: "ins_najjuko_TESTKEY0123456789abcd" };
const t0 = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10), add = (n) => { const x = new Date(t0 + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const items = [{ code: "FD-12", kind: "feed", date: add(2), time: "19:00", format: "Reel", topic: "DAMAC Lagoons launch reel", developer: "DAMAC", done: {}, log: [] },
  { code: "ST-03", kind: "story", date: add(1), time: "10:00", topic: "Market update", done: {}, log: [] }];
items.forEach((i) => store.set("cp_item_" + i.code, JSON.stringify(i)));
store.set("cp_index", JSON.stringify(items.map((i) => i.code)));
store.set("cp_sheetmap", JSON.stringify({ ref: { "FD-12": { tab: "November", row: 14 } }, maps: {} }));
const entry = { id: "m1", date: t0, type: "Meeting", title: "Weekly content huddle", summary: "We are moving the DAMAC reel to Thursday at 18:00. Drop the market update story. Add a carousel on Sobha Hartland next week.", text: "", works: ["Brochure refresh"], progress: [{ work: "Brochure refresh", status: "In progress", percent: 40, owners: [] }], kpis: [], people: [], deliverables: [], external: [], created: t0 + "T08:00:00Z" };
store.set("work_naj_" + t0 + "_m1", JSON.stringify(entry));

// 1. lines and the checks
const lines = meetingLines({ kind: "entry", entry });
ok(lines.length >= 3 && lines.some((l) => /DAMAC reel/.test(l)), "the meeting is read as numbered lines");
const ln = (re) => lines.findIndex((l) => re.test(l)) + 1;
const blank = { code: "", task: "", field: "", value: "", date: "", time: "", status: "", percent: 0, item_kind: "", format: "", topic: "", question: "" };
const raw = [
  { ...blank, type: "planner_move", code: "FD-12", date: add(4), time: "18:00", line: ln(/DAMAC reel/), quote: "moving the DAMAC reel to Thursday", certain: true },
  { ...blank, type: "planner_move", code: "FD-99", date: add(5), line: ln(/DAMAC reel/), quote: "moving the DAMAC reel", certain: true },
  { ...blank, type: "planner_hold", code: "ST-03", line: ln(/Drop the market/), quote: "Drop the market update story", certain: true },
  { ...blank, type: "planner_new", item_kind: "feed", format: "Carousel", topic: "Sobha Hartland", line: ln(/Sobha/), quote: "carousel on Sobha Hartland", certain: true, question: "Which day next week?" },
  { ...blank, type: "task_update", task: "brochure refresh", status: "Done", percent: 100, line: 1, quote: "nothing like this", certain: true },
];
const C = checkChanges(raw, lines, items, [{ name: "Brochure refresh", status: "In progress", percent: 40 }]);
ok(C[0].certain && C[0].match && /FD-12/.test(C[0].match) && C[0].from, "a move on a real code is certain and shows the match and the old slot");
ok(!C[1].certain && !C[1].ok && C[1].code === "", "an invented code is refused, never applied");
ok(C[2].certain, "a hold on a real code is certain");
ok(!C[3].certain && !C[3].ok && C[3].problems.some((p) => /Which day/.test(p)) && C[3].problems.some((p) => /No date/.test(p)),"vague timing is a question, not ticked");
ok(!C[4].certain && C[4].task === "Brochure refresh", "a quote not on its line is not pre-ticked; the task name is matched to the stored one");

// 2. nothing written by proposing; apply writes the ticked ones and queues the sheet item
const before = store.get("cp_item_FD-12");
const H = { taskUpdate: async () => [200, {}], taskNew: async () => [200, {}] };
const r = await syncApply(env, [C[0], C[2]], "“Weekly content huddle” " + t0, H);
const fd = JSON.parse(store.get("cp_item_FD-12")), st = JSON.parse(store.get("cp_item_ST-03"));
ok(before !== store.get("cp_item_FD-12") && fd.date === add(4) && fd.time === "18:00", "apply moves the post");
ok(/From meeting/.test(fd.log[0].who), "the item log says it came from the meeting");
ok(/^ON HOLD/.test(st.note), "hold is written as a note, never a delete");
ok(r.pending.includes("FD-12") && !r.pending.includes("ST-03"), "only the item from the sheet is queued for the sheet");
const pl = await pendingList(env); ok(pl[0] && pl[0].tab === "November" && pl[0].row === 14 && pl[0].item.date === add(4), "the bridge list carries the tab, row and new values");
ok((await pendingDone(env, "FD-12"))[0] === 200 && (await pendingList(env)).length === 0, "her Claude Code marks it done");

// 3. the served page script parses and has the Sync button
const url = new URL("https://x/momo/work.js?key=ins_najjuko_TESTKEY0123456789abcd");
const deps = { isNaj: () => true, isAny: () => true, person: () => "najjuko", page: (k, r, b) => b };
const js = await (await workRoute(new Request(url), env, url, deps)).text();
let parsed = true; try { new Function(js); } catch (e) { parsed = false; console.log(e.message); }
ok(parsed, "the Work script parses with Sync");
ok(js.includes('data-sy="') && js.includes("e.type===\"Meeting\"") && js.includes("sync_propose"), "a Sync button on Meeting entries");

// 4. the route: propose writes nothing, apply needs the tick list
const papi = new URL("https://x/momo/work/api?key=ins_najjuko_TESTKEY0123456789abcd");
const fake = { ...deps, claudeJSON: async () => ({ changes: raw }), model: "x" };
const snap = JSON.stringify([...store.entries()]);
const pr = await (await workRoute(new Request(papi, { method: "POST", body: JSON.stringify({ action: "sync_propose", src: { entry: t0 + "_m1" } }) }), env, papi, fake)).json();
ok(pr.ok && pr.changes.length === 5 && JSON.stringify([...store.entries()]) === snap, "propose returns the checked list and writes nothing");
const ap = await (await workRoute(new Request(papi, { method: "POST", body: JSON.stringify({ action: "sync_apply", src: { entry: t0 + "_m1" }, changes: [{ ...pr.changes[3], date: add(8), type: "task_new", task: "Sobha carousel brief" }] }) }), env, papi, fake)).json();
const e2 = JSON.parse(store.get("work_naj_" + t0 + "_m1"));
ok(ap.ok && e2.works.includes("Sobha carousel brief"), "a new task rides on the meeting entry, the existing task path");
process.exit(fail ? 1 : 0);
