// v773: proactive Sync - a meeting that mentions content is read once when Work opens; each certain change is asked one at a time;
// Yes applies through the Sync apply path, No is remembered, a meeting with no content mention asks nothing; nothing applies without Yes.
import { workRoute } from "../src/work_log.js";
import { contentHit, meetingLines } from "../src/meeting_sync.js";
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("ok", m); };
const store = new Map();
const env = { MEETINGS: { get: async (k) => store.has(k) ? store.get(k) : null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) }, INSIDER_KEY: "ins_najjuko_TESTKEY0123456789abcd" };
const t0 = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10), add = (n) => { const x = new Date(t0 + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const items = [{ code: "FD-12", kind: "feed", date: add(2), time: "19:00", format: "Reel", topic: "DAMAC Lagoons launch reel", developer: "DAMAC", done: {}, log: [] },
  { code: "ST-03", kind: "story", date: add(1), time: "10:00", topic: "Market update", done: {}, log: [] }];
items.forEach((i) => store.set("cp_item_" + i.code, JSON.stringify(i)));
store.set("cp_index", JSON.stringify(items.map((i) => i.code)));
const m1 = { id: "m1", date: t0, type: "Meeting", title: "Weekly content huddle", summary: "We are moving the DAMAC reel to Thursday at 18:00. Drop the market update story.", text: "", works: [], progress: [], created: t0, updated: t0 };
const m2 = { id: "m2", date: t0, type: "Meeting", title: "Budget review", summary: "We went through the office budget. Rent is due on the 10th. The printer needs fixing.", text: "", works: [], progress: [], created: t0, updated: t0 };
store.set("work_naj_" + t0 + "_m1", JSON.stringify(m1)); store.set("work_naj_" + t0 + "_m2", JSON.stringify(m2));

// 1. the detector
ok(contentHit(meetingLines({ kind: "entry", entry: m1 }), items, []).length > 0, "a meeting about the reel is content");
ok(contentHit(meetingLines({ kind: "entry", entry: m2 }), items, []).length === 0, "a budget meeting is not content");
ok(contentHit(["Vishant will send it Thursday."], [], [{ name: "Vishant" }]).includes("vishant"), "a team member's name counts");
ok(contentHit(["Sort out FD-12 please"], items, []).includes("FD-12") && contentHit(["Sort out FD-99"], items, []).length === 0, "a real planner code counts, an unknown one does not");

// 2. the route: sync_auto reads m1 (one writer call), not m2, writes nothing to the planner
const lines = meetingLines({ kind: "entry", entry: m1 }), ln = (re) => lines.findIndex((l) => re.test(l)) + 1;
const blank = { code: "", task: "", field: "", value: "", date: "", time: "", status: "", percent: 0, item_kind: "", format: "", topic: "", question: "" };
const raw = [{ ...blank, type: "planner_move", code: "FD-12", date: add(4), time: "18:00", line: ln(/DAMAC reel/), quote: "moving the DAMAC reel to Thursday", certain: true },
  { ...blank, type: "planner_hold", code: "ST-03", line: ln(/Drop the market/), quote: "Drop the market update story", certain: true },
  { ...blank, type: "planner_new", item_kind: "feed", topic: "Sobha", line: 1, quote: "x", certain: true, question: "Which day?" }];
let calls = 0;
const deps = { isNaj: () => true, isAny: () => true, person: () => "najjuko", page: (k, r, b) => b, claudeJSON: async () => { calls++; return { changes: raw }; }, model: "x" };
const papi = new URL("https://x/momo/work/api?key=ins_najjuko_TESTKEY0123456789abcd");
const post = async (b) => (await workRoute(new Request(papi, { method: "POST", body: JSON.stringify(b) }), env, papi, deps)).json();
const before = store.get("cp_item_FD-12");
const a1 = await post({ action: "sync_auto" });
ok(a1.ok && calls === 1, "only the content meeting is read (one writer call)");
ok(a1.open.length === 2 && a1.open.every((x) => x.meeting === t0 + "_m1"), "two certain changes are waiting; the uncertain one is not asked");
ok(store.get("cp_item_FD-12") === before, "nothing is applied by reading");
ok(a1.badges[t0 + "_m1"] === 2, "the meeting carries a badge with the count");
const a2 = await post({ action: "sync_auto" });
ok(calls === 1 && a2.open.length === 2, "a meeting is read once, the questions stay until answered");

// 3. Yes applies (planner log says From meeting), No is remembered, answering twice changes nothing
const mv = a1.open.find((x) => x.change.type === "planner_move"), hd = a1.open.find((x) => x.change.type === "planner_hold");
const y = await post({ action: "sync_auto_answer", meeting: mv.meeting, id: mv.change.id, answer: "yes" });
const fd = JSON.parse(store.get("cp_item_FD-12"));
ok(y.ok && fd.date === add(4) && fd.time === "18:00" && /From meeting/.test(fd.log[0].who), "Yes moves the post through the Sync apply path");
const n = await post({ action: "sync_auto_answer", meeting: hd.meeting, id: hd.change.id, answer: "no" });
ok(n.ok && !/^ON HOLD/.test(JSON.parse(store.get("cp_item_ST-03")).note || ""), "No changes nothing");
const a3 = await post({ action: "sync_auto" });
ok(a3.open.length === 0 && !a3.badges[t0 + "_m1"], "answered questions are never asked again");
const y2 = await post({ action: "sync_auto_answer", meeting: mv.meeting, id: mv.change.id, answer: "yes" });
ok(y2.already === "yes" && JSON.parse(store.get("cp_item_FD-12")).log.length === fd.log.length, "a second Yes does not apply twice");

// 4. not on anyone else's Work; the served script parses and carries the pop-up
const kdeps = { ...deps, person: () => "kendall", isNaj: () => false };
const kr = await workRoute(new Request(papi, { method: "POST", body: JSON.stringify({ action: "sync_auto" }) }), env, papi, kdeps);
ok(kr.status === 403 || kr.status === 404, "sync_auto is Najjuko's Work only");
const url = new URL("https://x/momo/work.js?key=ins_najjuko_TESTKEY0123456789abcd");
const js = await (await workRoute(new Request(url), env, url, deps)).text();
let parsed = true; try { new Function(js); } catch (e) { parsed = false; console.log(e.message); }
ok(parsed && js.includes("sync_auto") && js.includes("Yes, update the calendar") && js.includes("During the meeting you said"), "the Work script parses and carries the one-at-a-time questions");
process.exit(fail ? 1 : 0);
