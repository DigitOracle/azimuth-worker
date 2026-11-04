// v758: FN Content Planner - maker derivation, status, trial date, QA/QC on the 4 Nov plan, on-camera limit, page script parses, actions, bridge
import { makerOf, statusOf, trialOf, qaOf, qaLevel, onCamera, report, applyAction, plannerBody, plannerRoute, rowsToItems, DEFAULT_SETTINGS, stepsOf, plannerBridgeGet, plannerBridgePost } from "../src/content_planner.js";
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("ok", m); };

ok(makerOf({ how: "Design (carousel / graphic)" }) === "Monaza" && makerOf({ how: "AI video" }) === "Vishant" && makerOf({ how: "In-house video (office)" }) === "Liam"
  && makerOf({ how: "Professional video" }) === "Kareem" && makerOf({ how: "Edit of existing footage" }) === "Vishant" && makerOf({ how: "Repost / photo / text card" }) === "Sousan", "how it's made sets the maker");
const reel = { kind: "feed", format: "Reel", date: "2026-11-05", time: "11:00", done: { Planned: { done: true } } };
ok(statusOf(reel).step === "Who & how" && statusOf(reel).owner === "Najjuko", "status = first unticked step (Who & how, Najjuko)");
ok(statusOf(Object.assign({}, reel, { who: "Yusuf", how: "Professional video" })).step === "Brief", "Who & how ticks itself when both are chosen");
ok(statusOf(Object.assign({}, reel, { who: "Yusuf", how: "Professional video", done: { Planned: { done: true }, Brief: { done: true } } })).owner === "Kareem", "Made waits on the derived maker");
ok(statusOf({ kind: "feed", format: "Reel", done: { Caption: { done: true } } }).step === "Planned", "steps tick in any order; status is still the first unticked");
ok(stepsOf({ kind: "feed", format: "Carousel" }).indexOf("Trial") < 0 && stepsOf(reel).indexOf("Trial") > 0 && stepsOf({ kind: "story" }).join() === "Planned,Who & how,Made,Approved,Posted", "Trial only on Reels; story steps");
ok(trialOf(reel).date === "2026-11-02" && trialOf(reel).time === "11:00" && trialOf({ kind: "feed", format: "Carousel", date: "2026-11-05" }) === null, "trial = live - 3 days, same time");

// the 4 Nov plan: 1 fix (Thu 5 Nov FIRST LOOK Reel, trial not ticked), 1 check (Tue 3 Nov Flag Day Reel, trial 31 Oct)
const firstLook = { code: "FEED-W1-04", kind: "feed", format: "Reel", date: "2026-11-05", time: "11:00", topic: "FIRST LOOK", pillar: "Trust", done: {} };
const flagDay = { code: "FEED-W1-02", kind: "feed", format: "Reel", date: "2026-11-03", time: "11:00", topic: "Flag Day", pillar: "Trust", done: {} };
const clearOne = { code: "FEED-W1-06", kind: "feed", format: "Reel", date: "2026-11-07", time: "12:00", topic: "Palm Central", pillar: "Trust", done: {} };
const T = "2026-11-04";
ok(qaLevel(qaOf(firstLook, {}, T)) === "fix" && qaOf(firstLook, {}, T).some((x) => /passed and not ticked/.test(x[1])), "FIRST LOOK: fix, trial passed and not ticked");
ok(qaLevel(qaOf(flagDay, {}, T)) === "check" && qaOf(flagDay, {}, T).some((x) => /before the plan start/.test(x[1])), "Flag Day: check, trial 31 Oct before the plan start");
ok(qaLevel(qaOf(clearOne, {}, T)) === "clear", "a Saturday midday Reel is clear");
const rep = report([firstLook, flagDay, clearOne], DEFAULT_SETTINGS, "2026-11-02", "2026-11-08", T);
ok(rep.totals.qa_fix === 1 && rep.totals.qa_check === 1, "report: 1 fix and 1 check on the 4 Nov plan");
ok(qaLevel(qaOf({ kind: "feed", format: "Static", date: "2026-11-07", time: "18:00" }, {}, T)) === "fix", "static or evening post is a fix");
ok(qaOf({ kind: "feed", format: "Carousel", date: "2026-11-07", time: "11:00" }, { best_from: "12:00" }, T).some((x) => x[0] === "check"), "thresholds are settings");
ok(qaOf({ kind: "story", date: "2026-11-02" }, {}, T).length === 0, "stories are not checked");

const oc = onCamera([{ who: "Yusuf", date: "2026-11-03" }, { who: "Yusuf, Sarah", date: "2026-11-10" }, { who: "AI", date: "2026-11-11" }, { who: "Yusuf", date: "2026-12-01" }], "2026-11");
ok(oc.Yusuf === 2 && oc.Sarah === 1 && oc.AI === undefined, "on camera this month: per person, AI not counted");

// actions on a KV double
const store = new Map(); const env = { MEETINGS: { get: async (k) => store.has(k) ? store.get(k) : null, put: async (k, v) => store.set(k, v), delete: async (k) => store.delete(k) } };
let [s, o] = await applyAction(env, { action: "save", kind: "feed", date: "2026-11-05", time: "11:00", format: "Reel", topic: "FIRST LOOK", who: "Yusuf", how: "Professional video" }, "Najjuko");
ok(s === 200 && o.item.code === "ADD-1" && o.item.added === true && o.item.maker === "Kareem", "add: ADD-1, added outside the plan, maker Kareem");
[s, o] = await applyAction(env, { action: "tick", code: "ADD-1", step: "Planned" }, "Vishant");
ok(s === 200 && o.item.status.step === "Brief" && o.item.log[0].what === "ticked Planned" && o.item.log[0].who === "Vishant", "tick is logged with who");
[s] = await applyAction(env, { action: "tick", code: "ADD-1", step: "Approved" }, "Vishant"); ok(s === 403, "only Najjuko ticks Approved");
[s, o] = await applyAction(env, { action: "save", code: "ADD-1", date: "2026-11-07" }, "Najjuko"); ok(s === 200 && /date: 2026-11-05 → 2026-11-07/.test(o.item.log[0].what), "move logged old → new");
[s, o] = await applyAction(env, { action: "save", kind: "story", date: "2026-11-05", topic: "x" }, "Najjuko"); ok(o.item.time === "08:00", "a story defaults to the first story time");

// sheet rows: header row 5, data from row 6, week bands skipped
const vals = [[], [], [], [], ["Code", "Date", "Time", "Format", "Pillar", "Topic / idea", "Trial date", "Who's in it", "How it's made"],
  ["WEEK 1 · 2–8 Nov"], ["FEED-W1-02", "03/11/2026", "11:00", "Reel", "Trust", "Flag Day", "31/10/2026", "", ""], ["FEED-W1-04", "5 Nov 2026", "11:00 am", "Reel", "Trust", "FIRST LOOK", "=B8-3", "Yusuf", "Professional video"]];
const rr = rowsToItems(vals, "feed", "Feed (posts)");
ok(rr.items.length === 2 && rr.items[0].date === "2026-11-03" && rr.items[1].how === "Professional video" && rr.items[1]._ref.row === 8 && rr.map.code === 0, "import: rows mapped by header, week band skipped");
ok(Object.values(rr.map).indexOf(6) < 0, "the trial-date column is protected (never mapped, never written)");

// the page script parses; route gate; bridge
const html = plannerBody("k", "", true), js = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
let parsed = true; try { new Function(js); } catch (e) { parsed = false; console.log(e.message); } ok(parsed, "the planner script parses");
ok(["Day", "Week", "Month", "Queue", "Workflow", "Reports"].every((v) => html.includes(">" + v + "</button>")), "six views");
const page = (k, r, b) => b, url = new URL("https://x/momo/work/planner/data?key=k");
const res = await plannerRoute(new Request(url), env, url, { page, person: () => "najjuko" }); const d = await res.json();
ok(d.ok && d.items.length === 2 && d.connected === false, "data route: items, not connected to the sheet");
const nf = await plannerRoute(new Request(url), env, url, { page, person: () => "" }); ok(nf.status === 404, "anyone else: not found");
const imp = await plannerRoute(new Request("https://x/momo/work/planner/api?key=k", { method: "POST", body: JSON.stringify({ action: "import" }) }), env, new URL("https://x/momo/work/planner/api?key=k"), { page, person: () => "najjuko" });
ok(imp.status === 409 && (await imp.json()).error === "not_connected", "import is inert until the sheet is connected");
const bg = await plannerBridgeGet(env, new URL("https://x/momo/bridge/v1/planner/items?step=Brief"), "planner/items"); ok(bg.ok && bg.data.length === 1, "bridge: items by step");
const bp = await plannerBridgePost(env, { code: "ADD-1", step: "Brief" }, "najjuko", "post:planner/tick"); ok(bp[0] === 200 && bp[1].data.status.step !== "Brief", "bridge: tick");
process.exit(fail ? 1 : 0);
