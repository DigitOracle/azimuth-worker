// v812: Momo prepares the huddle, last week's actions first, one input three outputs; draft tasks from meetings; the overall meeting summary
// (glossary, check-name, corrections, Confidential HR); debrief and daily-report fixes; the meetings list, transcript and Work home.
// Made-up values only: no real names beyond the roster constants, no HR content (the HR flag is set by a stub with neutral text).
import assert from "node:assert/strict";
import * as Hd from "../src/huddle.js";
import { draftTasksFrom, attachDraftTasks, matchOwner } from "../src/draft_tasks.js";
import { summarySys, glossary, applyNameFix, CHECK_NAME, shareSafeEntry, HR_LINE } from "../src/meeting_summary.js";
import { workRoute, PEOPLE, debriefHtml } from "../src/work_log.js";
import { bridgeRoute } from "../src/work_bridge.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const LOGS = [], realLog = console.log;
for (const lv of ["log", "info", "warn", "error"]) { const o = console[lv]; console[lv] = (...a) => { LOGS.push(a.map(String).join(" ")); if (process.env.V) o(...a); }; }
function kv() {
  const m = new Map();
  return { m, get: async (k, t) => { if (!m.has(k)) return null; const v = m.get(k); if (t === "arrayBuffer") return v.buffer; return typeof v === "string" ? v : new TextDecoder().decode(v); },
    put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); },
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix || "")).sort().map((name) => ({ name })), list_complete: true }) };
}
const NAJ = "naj_" + "x".repeat(40), store = kv(), env = { MEETINGS: store, MOMO_BRIDGE_KEYS: "najjuko:" + NAJ };
const R = PEOPLE.map((p) => p[0]), A = R[1], B = R[2];   // two roster names (constants already in the repo)

// ===== 1. MOMO PREPARES THE HUDDLE =====
// last week's card (23 Nov) with actions, and work-log entries for the week before 30 Nov
const prev = await Hd.createCard(env, "2026-11-23"); prev.status = "Closed"; prev.form = { tip_text: "x" };
prev.actions = [{ id: "a1", text: "Send the launch list", owner: A, status: "open" }, { id: "a2", text: "Book the venue", owner: "", status: "open" }, { id: "a3", text: "Done thing", owner: A, status: "done" }];
prev.presenter = { done: {}, notes: { "06": "Can we move viewings to mornings? Action: check the rota @" + B } }; prev.momo_snap = { camp_replies: 10 };
await store.put("hud_card_2026-11-23", JSON.stringify(prev));
const ent = (id, date, o) => store.put("work_naj_" + date + "_" + id, JSON.stringify(Object.assign({ id, date, title: "t", type: "Outreach", people: [A], broker_tasks: [] }, o)));
await ent("e1", "2026-11-24", { broker_tasks: ["viewing"], people: [A, B] }); await ent("e2", "2026-11-25", { broker_tasks: ["offer"] }); await ent("e3", "2026-11-26", { type: "Meeting", people: [B] });
await store.put("camp_index", JSON.stringify(["c1"])); await store.put("camp_stats_c1", JSON.stringify({ replies: 14 }));
const calls = [];
const cal = async (e, d) => { calls.push(d); return { connected: true, events: d === "2026-11-30" ? [{ time: "09:00", title: "Huddle" }] : [] }; };
const c = await Hd.createCard(env, "2026-11-30", undefined, { cal });
const M = c.momo;
ok(M.recognition && /1 deal step logged, 1 viewing, 1 meeting/.test(M.recognition.lines[0]), "recognition counts from the work log");
ok(M.recognition.lines.some((l) => /^4 campaign replies this week/.test(l)), "campaign replies since last week's card");
ok(M.recognition.lines.some((l) => l.startsWith("Worked with most: ")), "first names already in her Momo");
ok(M.celebrations && M.celebrations.lines.some((l) => /Commemoration Day/.test(l)) && M.celebrations.lines.some((l) => /National Day/.test(l)) && /paste them yourself/.test(M.celebrations.note), "UAE days of the week; birthdays left to her");
ok(M.schedule && M.schedule.lines.length === 4 && calls.length === 4 && /09:00 Huddle/.test(M.schedule.lines[0]), "schedule from her read-only calendar, Mon-Thu");
ok(M.theme.lines.length === 3 && M.theme.lines.some((l) => /2 open actions/.test(l)) && M.theme.lines.some((l) => /move viewings to mornings\?/.test(l)), "three theme directions from last week's notes and numbers");
ok((await Hd.createCard(env, "2026-12-07", undefined, {})).momo.notes.some((x) => /Calendar not read/.test(x)), "no calendar: schedule skipped and noted");
ok(c.last_actions.length === 2 && !c.last_actions.some((x) => x.id === "a3"), "last week's open actions come forward (done ones do not)");

// market: Claude supplies topics through the bridge, Momo ranks and pre-ticks 4 with a why; she accepts with one tap
const B0 = "https://x.test/momo/bridge/v1/", call = (p, o) => bridgeRoute(new Request(B0 + p, Object.assign({ headers: Object.assign({ "Content-Type": "application/json", Authorization: "Bearer " + NAJ }, o && o.h) }, o)), env, new URL(B0 + p));
const topics = Array.from({ length: 16 }, (_, i) => ({ id: "t" + i, line: i % 3 ? "Rents in area " + i + " rose " + i + "%" : "Area " + i + " steady", table: ["v_gov_sales", "v_gov_rents", "v_offplan", "v_area"][i % 4], as_of: i < 8 ? "2026-11-26" : "2026-11-12", provisional: i === 1 }));
let r = await call("huddle/2026-11-30/form", { method: "PUT", h: { "Idempotency-Key": "v812-topics-1" }, body: JSON.stringify({ market_topics: topics }) });
let j = await r.json();
ok(j.data.market.picked.length === 4 && j.data.market.momo_pending && Object.keys(j.data.market.why).length === 4, "Momo pre-ticks the top 4 with a why");
ok(new Set(j.data.market.picked.map((id) => topics.find((t) => t.id === id).table)).size === 4 && !j.data.market.picked.includes("t1"), "ranking: one per table, provisional not first choice");
ok(!j.data.sections.find((s) => s.id === "market").done && j.data.market_for_pdf.length === 0, "pre-ticked is not done until she accepts");
const act = (b) => Hd.cardAction(env, Object.assign({ date: "2026-11-30" }, b));
let a = await act({ action: "accept_momo", section: "market" });
ok(a[0] === 200 && a[1].card.sections.find((s) => s.id === "market").done, "one tap accepts Momo's 4");
const cp = [...store.m.keys()].filter((k) => k.startsWith("cp_item_")).map((k) => JSON.parse(store.m.get(k)));
ok(cp.length === 1 && cp[0].date === "2026-11-30" && cp[0].series === "Market research" && /DRAFT/.test(cp[0].note) && !(cp[0].done || {}).Live && !(cp[0].done || {}).Approved, "a DRAFT Monday market-research item in her Content Planner, never published");
j = await (await call("huddle/2026-11-30", {})).json();
ok(j.data.market_for_pdf.length === 4 && j.data.market_for_pdf.every((t) => t.table && t.as_of), "market_for_pdf on the bridge for the team market PDF");
a = await act({ action: "pick", ids: j.data.market.picked.slice(0, 3).concat(["t9"]) });
ok([...store.m.keys()].filter((k) => k.startsWith("cp_item_")).length === 1, "re-picking updates the same planner draft, no duplicate");
a = await act({ action: "accept_momo", section: "recognition" });
ok(a[1].card.sections.find((s) => s.id === "recognition").state === "momo" && a[1].card.momo.recognition.accepted, "accepting a Momo draft marks that section done");

// last week's actions first: done / not done / carry; carried join this week; no owner -> owner needed (page shows it)
a = await act({ action: "review", id: "a1", verdict: "carry" }); a = await act({ action: "review", id: "a2", verdict: "notdone" });
ok(a[1].card.actions.length === 1 && a[1].card.actions[0].from === "carried" && a[1].card.last_actions.find((x) => x.id === "a2").review === "notdone", "carried items join this week's actions");
a = await act({ action: "action_add", text: "Call the printer" });
ok(a[1].card.actions.length === 2 && a[1].card.actions[1].owner === "", "an action without an owner");
const cc = await Hd.getCard(env, "2026-11-30"); cc.status = "Approved"; cc.build = { slides: 0 }; cc.presenter.notes["03"] = "Action: Update the board @" + A; await store.put("hud_card_2026-11-30", JSON.stringify(cc));
const html = Hd.presenterPage(cc, "k");
ok(/"n":"00","name":"Last week's actions"/.test(html) && /owner needed/.test(html), "presenter opens on last week's actions; unassigned flagged");
a = await act({ action: "close" });
ok(a[0] === 200, "close: " + JSON.stringify(a[1]).slice(0, 120));
const rec = JSON.parse(store.m.get("recw_" + (await Hd.getCard(env, "2026-11-30")).record_id));
ok(rec.draft_tasks.length === 3 && rec.draft_tasks.every((d) => d.state === "draft"), "Close: the actions become DRAFT tasks on the meeting record");
ok(rec.draft_tasks.find((d) => /printer/.test(d.text)).owner_needed && rec.draft_tasks.find((d) => /Update the board/.test(d.text)).owner === A, "owner needed flagged; a roster owner kept");

// ===== 2. DRAFT TASKS FROM MINUTES =====
ok(matchOwner(A.split(" ")[0], R) === A && matchOwner("TBC", R) === "" && matchOwner("Someone Else", R) === "", "owner matching against her roster");
// the model stub: the minutes come back from the existing minutes call; extraction is their actions
const stubMinutes = { title: "Planning", purpose: "p", decisions: [], discussion: [], open_questions: [], actions: [{ action: "Send the brochure", owner: A, due: "2026-12-02" }, { action: "Fix the sign", owner: "", due: "" }] };
const mrec = { id: "20261201abcde", date: "2026-12-01", title: "Planning", status: "filed", secs: 1900, minutes: stubMinutes, entry_keys: [] };
attachDraftTasks(mrec, R);
ok(mrec.draft_tasks.length === 2 && mrec.draft_tasks[1].owner_needed && mrec.draft_tasks[0].due === "2026-12-02", "minutes actions -> draft_tasks (owner needed flagged)");
await store.put("recw_" + mrec.id, JSON.stringify(mrec));
ok(![...store.m.keys()].some((k) => k.startsWith("work_naj_task_") && /brochure/.test(k)), "nothing becomes a task without her tap (no auto-add)");
const deps = { isNaj: () => true, isAny: () => true, person: () => "najjuko", page: (k, rr, b) => "<html>" + b + "</html>",
  claudeJSON: async (e, sys, user, schema) => { deps.lastSys = sys; return deps.nextModel; }, model: "stub" };
const post = (path, body) => { const u = new URL("https://x" + path + "?key=ins_najjuko_TESTKEY"); return workRoute(new Request(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), env, u, deps).then((x) => x.json()); };
const get = (path) => { const u = new URL("https://x" + path + (path.includes("?") ? "&" : "?") + "key=ins_najjuko_TESTKEY"); return workRoute(new Request(u), env, u, deps); };
let d1 = mrec.draft_tasks[0].id, d2 = mrec.draft_tasks[1].id;
j = await post("/momo/work/api", { action: "draft_task", id: mrec.id, did: d1, op: "save", start: "2026-12-01" });   // v814: both dates before Add
j = await post("/momo/work/api", { action: "draft_task", id: mrec.id, did: d1, op: "add" });
const task = JSON.parse(store.m.get([...store.m.keys()].find((k) => k.startsWith("work_naj_task_") && /brochure/.test(k))));
ok(j.ok && task.quick && task.owners[0] === A && task.due === "2026-12-02" && task.name === "Send the brochure", "Add makes a real task in the same store and shape as a quick task");
j = await post("/momo/work/api", { action: "draft_task", id: mrec.id, did: d2, op: "dismiss" });
ok(j.drafts.find((d) => d.id === d2).state === "dismissed" && j.drafts.find((d) => d.id === d1).state === "added", "Dismiss");
const again = draftTasksFrom(stubMinutes.actions, R, j.drafts);
ok(again.find((d) => d.id === d2).state === "dismissed", "a dismissed draft stays dismissed when the minutes are re-read");

// ===== 3. THE MEETING SUMMARY =====
const g = await glossary(env, R, [{ people: ["Guest Person"] }], { speakers: [{ name: "Spoken Name" }] });
ok(g.names.includes("Guest Person") && g.names.includes("Spoken Name") && g.names.includes(A), "glossary: roster, entry people and named speakers");
ok(summarySys(g, 1900).includes(g.line) && summarySys(g, 1900).includes(CHECK_NAME) && /about 13 bullets/.test(summarySys(g, 1920)), "the glossary and the check-name rule are passed; sized to the meeting");
await store.put("recs_" + mrec.id + "_000", JSON.stringify({ n: 0, secs: 1900, text: "Line one of the meeting. ".repeat(10) }));
deps.nextModel = { paragraphs: ["The team met about the week."], bullets: ["Point one", CHECK_NAME + " asked about the schedule"], topics: ["Week"], decisions: ["Go ahead"], figures: ["12 viewings"], open_questions: [], unclear: [CHECK_NAME + " asked about the schedule"], hr: true,
  actions: [{ action: "Follow up with " + CHECK_NAME, owner: "", due: "" }] };
j = await post("/momo/work/rec/api", { action: "summary_full", id: mrec.id });
let mr = JSON.parse(store.m.get("recw_" + mrec.id));
ok(j.ok && mr.summary_full.hr && mr.summary_full.bullets.length === 2 && deps.lastSys.includes("Guest Person") === false && deps.lastSys.includes(A), "summary_full stored from the model path with the glossary in its prompt");
ok(mr.summary_full.unclear[0].includes(CHECK_NAME), "an unclear speaker gives 'check name'");
mr.draft_tasks.push({ id: "dz", text: "Follow up with " + CHECK_NAME, owner: "", owner_said: CHECK_NAME, owner_needed: true, state: "draft" }); await store.put("recw_" + mrec.id, JSON.stringify(mr));
j = await post("/momo/work/rec/api", { action: "name_fix", id: mrec.id, from: CHECK_NAME, to: B });
mr = JSON.parse(store.m.get("recw_" + mrec.id));
ok(mr.summary_full.bullets[1].startsWith(B) && mr.draft_tasks.find((d) => d.id === "dz").owner === B && !mr.draft_tasks.find((d) => d.id === "dz").owner_needed, "a name correction propagates to the summary and the draft tasks");
j = await post("/momo/work/rec/api", { action: "name_fix", id: mrec.id, from: "Point one", to: "Point 1" });
ok(JSON.parse(store.m.get("rec_namefix"))["Point one"] === "Point 1", "a correction is remembered for later meetings");
j = await post("/momo/work/rec/api", { action: "summary_edit", id: mrec.id, paragraphs: ["Her own wording."], hr: true });
ok(JSON.parse(store.m.get("recw_" + mrec.id)).summary_full.paragraphs[0] === "Her own wording.", "Edit summary");

// HR stays out of the debrief and the daily report by default
await store.put("work_naj_2026-12-01_rplan0", JSON.stringify({ id: "rplan0", date: "2026-12-01", title: "Planning meeting", type: "Meeting", summary: "Sensitive line.", rec: mrec.id, hr: true, people: [] }));
let page = await (await get("/momo/work/debrief?date=2026-12-01&id=rplan0")).text();
ok(!page.includes("Sensitive line.") && !page.includes("Her own wording.") && page.includes("Confidential · HR"), "HR-flagged meeting: left out of the debrief by default");
page = await (await get("/momo/work/debrief?date=2026-12-01&id=rplan0&hr=1")).text();
ok(page.includes("Her own wording."), "she can choose to include it");
page = await (await get("/momo/work/report?from=2026-12-01&to=2026-12-01")).text();
ok(!page.includes("Sensitive line.") && !page.includes("Planning meeting") && page.includes("Meeting (Confidential · HR)"), "HR-flagged entry left out of the daily report by default (title and summary)");
page = await (await get("/momo/work/report?from=2026-12-01&to=2026-12-01&hr=1")).text();
ok(page.includes("Planning meeting"), "the report includes it when she chooses (hr=1)");
ok(shareSafeEntry({ summary: "x" }, null, false).summary === "x", "ordinary entries are untouched");

// the debrief: Back is reachable (not stacked under the PDF tools), and it opens the entry's OWN meeting, never the newest
ok(/\.btn\{background:#1F2B44/.test(page = debriefHtml({ title: "T", date: "2026-12-01", summary: "s" })) && !/\.btn\{position:fixed/.test(page) && /id=bk>&#8592; Back/.test(page), "debrief Back button is not hidden under the PDF tools");
const other = { id: "20261202zzzzz", date: "2026-12-02", title: "A different newer meeting", status: "filed", secs: 60, minutes: stubMinutes };
await store.put("recw_" + other.id, JSON.stringify(other));
const mine = { id: "20261201mmmmm", date: "2026-12-01", title: "Her own meeting", status: "filed", secs: 600, minutes: stubMinutes, draft_tasks: [] };
await store.put("recw_" + mine.id, JSON.stringify(mine));
await store.put("work_naj_2026-12-01_rmine0", JSON.stringify({ id: "rmine0", date: "2026-12-01", title: "Her own meeting", type: "Meeting", summary: "s", rec: mine.id, people: [] }));
page = await (await get("/momo/work/debrief?date=2026-12-01&id=rmine0")).text();
ok(page.includes("THE MEETING: Her own meeting") && !page.includes("A different newer meeting") && page.includes("Full minutes"), "a meeting's debrief opens that meeting's own record, with Full minutes");

// the meeting page: Meeting summary first, Daily report for the MEETING'S date; an empty day says so
page = await (await get("/momo/work/rec/view?id=" + mine.id)).text();
ok(page.indexOf("Meeting summary") < page.indexOf("Daily report") && page.includes("&from=2026-12-01&to=2026-12-01") && page.indexOf("<h2>Actions</h2>") < page.indexOf("Full minutes"), "meeting page: Summary, then Actions, then Minutes; Daily report on the meeting's date");
page = await (await get("/momo/work/report?from=2026-12-05&to=2026-12-05")).text();
ok(/Nothing logged on Saturday 5 December 2026/.test(page) && /id=bk/.test(page), "an empty Daily report says so, with Back");
page = await (await get("/momo/work/rec/transcript?id=" + mrec.id)).text();
ok(page.includes("Make minutes from this") && page.includes("Summarise this") && page.includes("Line one of the meeting.") && page.includes("Save as PDF"), "transcript: verbatim, PDF, two actions");

// meetings list: archive (soft), archive older than N days, Archived filter
await store.put("recw_20261001oldmt", JSON.stringify({ id: "20261001oldmt", date: "2026-10-01", title: "An old meeting", status: "filed", secs: 60 }));
const nRec = [...store.m.keys()].filter((k) => k.startsWith("recw_")).length;
j = await post("/momo/work/rec/api", { action: "archive_older", days: 14 });
ok(j.ok && j.archived === 1 && JSON.parse(store.m.get("recw_20261001oldmt")).archived && [...store.m.keys()].filter((k) => k.startsWith("recw_")).length === nRec, "bulk archive hides old meetings, deletes nothing");
j = await post("/momo/work/rec/api", { action: "archive_one", id: mine.id });
page = await (await get("/momo/work/meetings?archived=1")).text();
if (process.env.DBG) (await import("node:fs")).writeFileSync(process.env.DBG, page + "\n\nARCH=" + JSON.stringify(j));
ok(page.includes("Her own meeting") && page.includes("Bring back"), "Archived filter shows them");
j = await post("/momo/work/rec/api", { action: "archive_one", id: mine.id, on: false });
page = await (await get("/momo/work/meetings")).text();
ok(page.includes("Her own meeting") && page.includes("Minutes (PDF)") && page.includes("Transcript"), "brought back; the card has Summary / Minutes (PDF) / Transcript");

// Work home: MY TASKS first, quick actions, meetings, draft chip; the post queue no longer pops up
page = await (await get("/momo/work")).text();
ok(page.indexOf("MY TASKS") < page.indexOf("What did you do?") && /\d+ open · \d+ due today/.test(page) && page.includes("+ Quick task") && page.includes("All meetings"), "Work home order");
j = await post("/momo/work/api", { action: "task_snooze", name: "Send the brochure" });
ok(j.ok && j.task.due > "2026-11-08", "Tomorrow snoozes a task by a day");
const ms = (await import("node:fs")).readFileSync(new URL("../src/meeting_sync.js", import.meta.url), "utf8");
ok(ms.includes("setTimeout(function(){autoRun(false)},1200)") && ms.includes("to sort</span>"), "the post queue waits in a collapsed card");

// every finished recording keeps ALL forms, whichever button she tapped first
const { recEnsureForms } = await import("../src/work_log.js");
const today = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10), tc = today.replace(/-/g, "");
const smart = { claudeJSON: async (e, sys, user, schema) => { const p = (schema && schema.properties) || {};
  if (p.paragraphs) return { paragraphs: ["Made by the sweep."], bullets: ["b"], topics: [], decisions: [], figures: [], open_questions: [], unclear: [], hr: false, actions: [{ action: "Call back the client", owner: A, due: "" }] };
  if (p.discussion || (p.decisions && p.purpose)) return Object.assign({}, stubMinutes, { title: "Swept" });
  if (p.summary) return { summary: "Notes.", topics: [], decisions: [], actions: [], people: [] };
  return {}; }, model: "stub" };
for (const [rid, first] of [[tc + "minfirst", "minutes"], [tc + "sumfirst", "summary"]]) {
  const m0 = { id: rid, date: today, title: "Forms " + first, status: "drafted", secs: 600, started: new Date().toISOString(), stopped_at: new Date().toISOString(), expect_parts: 1 };
  if (first === "minutes") m0.minutes = stubMinutes; else m0.summary_full = { paragraphs: ["Her summary."], bullets: [], topics: [], decisions: [], figures: [], open_questions: [], unclear: [], actions: [], hr: false };
  await store.put("recw_" + rid, JSON.stringify(m0)); await store.put("recs_" + rid + "_000", JSON.stringify({ n: 0, secs: 600, text: "Plenty of words spoken in this meeting. ".repeat(6) }));
}
for (let i = 0; i < 8; i++) await recEnsureForms(env, smart, Date.now());
const mf = JSON.parse(store.m.get("recw_" + tc + "minfirst")), sf2 = JSON.parse(store.m.get("recw_" + tc + "sumfirst"));
ok(mf.minutes && mf.summary_full && mf.summary_full.paragraphs[0] === "Made by the sweep.", "minutes tapped first: the summary is still made and kept");
ok(sf2.summary_full.paragraphs[0] === "Her summary." && sf2.minutes && sf2.minutes.title === "Swept", "summary first: the minutes are still made; her summary untouched");
ok((await (await get("/momo/work/rec/transcript?id=" + tc + "minfirst")).text()).includes("Plenty of words spoken"), "the transcript stays available too");
await store.put("recw_" + tc + "prep", JSON.stringify({ id: tc + "prep", date: today, title: "Prep", status: "recording", secs: 0 }));
page = await (await get("/momo/work/rec/minutes?id=" + tc + "prep")).text();
ok(page.includes("Preparing the minutes"), "a form still being made says preparing (never disappears)");

// a recording stuck in "recording" (no part for 10 minutes) is finished by the sweep and marked Recovered; unfinished ones lead the Meetings list
const { recSweep, REC_IDLE_MS, withRoster, rosterFix, rosterMatch } = await import("../src/work_log.js");
ok(REC_IDLE_MS === 600e3, "idle limit is 10 minutes");
const stuckId = tc + "stuck1";
const t0 = Date.now() - 30 * 60e3;
await store.put("recw_" + stuckId, JSON.stringify({ id: stuckId, date: today, title: "Informal meeting", status: "recording", secs: 0, started: new Date(t0).toISOString(), started_hm: "13:31" }));
await store.put("recs_" + stuckId + "_000", JSON.stringify({ n: 0, secs: 0, text: "Some words were heard in this informal meeting. ".repeat(3) }));
page = await (await get("/momo/work/meetings")).text();
ok(page.indexOf("Unfinished: tap to finish or resume") > -1 && page.indexOf("Unfinished") < page.indexOf("Her own meeting"), "an unfinished recording sits at the top of Meetings, never vanishes");
let nowS = Date.now(); while (Math.floor(nowS / 60000) % 15 !== 7) nowS += 60000;
await recSweep(env, smart, nowS);
const st = JSON.parse(store.m.get("recw_" + stuckId));
ok(st.status !== "recording" && st.recovered === true, "the sweep finishes it and marks it Recovered");
page = await (await get("/momo/work/meetings")).text();
ok(page.includes("Informal meeting") && page.includes("Recovered"), "it shows in Meetings with a Recovered note");

// the "what I did" tick is a labelled Save, says why when it cannot save, and leaving unsaved text warns
const wl = (await import("node:fs")).readFileSync(new URL("../src/work_log.js", import.meta.url), "utf8");
ok(wl.includes('aria-label="Save to my work log"') && wl.includes("<span>Save</span></button><p id=pvwhy"), "the tick is a labelled Save button");
ok(wl.includes('why("tap which part of your role this counts towards') && !/\$\("pv"\)\.onclick=function\(\)\{PREV\.summary=\$\("ps"\)\.value;if\([^{]*\)\{alert\(/.test(wl), "a refusal is shown on the page, not an alert that can be missed");
ok(wl.includes('addEventListener("beforeunload"') && wl.includes('localStorage.getItem("momo_work_draft")'), "leaving with typed, unsaved text warns (the draft is kept)");

// the organogram: Liam (her roster) is recognised, spelling variants match, never asked "who is Liam?"
await store.put("work_naj_people", JSON.stringify({ people: [{ name: "Liam Carter", role: "Videographer", status: "Current" }] }));
const P = await withRoster(env, (await import("../src/work_log.js")).NAJ_PROF);
ok(P.people.some((x) => x[0] === "Liam Carter"), "her organogram joins the names Momo recognises");
ok(rosterMatch("Liam", P.people) === "Liam Carter" && rosterMatch("Leam", P.people) === "Liam Carter" && rosterMatch("Rose", P.people) === "Ruzanna Avanyan (Rose)", "first name, a one-letter variant and a nickname match");
const fixed = rosterFix([{ people: [], external: [{ name: "Liam" }, { name: "Gulf News" }] }], P);
ok(fixed[0].people.includes("Liam Carter") && fixed[0].external.length === 1 && fixed[0].external[0].name === "Gulf News", "a roster person is never asked about as an outsider");

// every Momo screen has Back or Home: the guard adds both where a page has none
const { needsNav, navGuard } = await import("../src/nav_guard.js");
ok(needsNav("/momo/work/plan/week", "<html><body>x</body></html>") && !needsNav("/momo/work/x", "<body><button id=bk>Back</button></body>") && !needsNav("/momo", "<body></body>") && !needsNav("/momo/checkin/abc", "<body></body>"), "the guard finds pages with no navigation");
const gr = await navGuard(new Request("https://x/momo/work/plan/week?key=K1"), new URL("https://x/momo/work/plan/week?key=K1"), new Response("<html><body>Week</body></html>", { headers: { "Content-Type": "text/html" } }));
const gh = await gr.text();
ok(gr.headers.get("X-Momo-Nav") === "added" && gh.includes("&#8592; Back") && gh.includes('href="/momo?key=K1"') && gh.includes(">Home</a>"), "Back and Home (keeping the key) added");

ok(!LOGS.join("\n").includes("Sensitive line.") && !LOGS.join("\n").includes("Her own wording."), "no summary content in any log line");
console.log = realLog; console.log("test_v812_huddle: " + n + " checks passed");
