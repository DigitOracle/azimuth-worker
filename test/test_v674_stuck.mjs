// v674 - Stuck replaces "Waiting on others"; the stuck record, its timing, the report line and the 6 pm check (Kendall 30 Oct 2026)
import { STATUS, normStatus, taskRecord, applyOverrides, stuckPeriods, stuckMinutes, blockedLine, eodCandidates, eodText, taskCheckTemplateDef, workEveningCheck } from "../src/work_log.js";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL " + m); } };

// statuses
ok(STATUS.includes("Stuck") && !STATUS.includes("Waiting on others"), "Stuck replaces Waiting on others in STATUS");
ok(normStatus("Waiting on others") === "Stuck" && normStatus("Done") === "Done", "old status reads as Stuck");

// her sheet: Stuck needs a reason, control, and a note for Other
const T0 = "2026-10-30T10:00:00.000Z", T1 = "2026-10-30T13:00:00.000Z", T2 = "2026-10-30T15:00:00.000Z";
ok(taskRecord(null, { name: "A", status: "Stuck", percent: 40 }, T0, true).error === "Pick what is blocking it.", "sheet: no reason refused");
ok(taskRecord(null, { name: "A", status: "Stuck", reason: "System glitch" }, T0, true).error === "Say whether it was in your control.", "sheet: no control refused");
ok(/what happened/.test(taskRecord(null, { name: "A", status: "Stuck", reason: "Other", control: "No" }, T0, true).error), "sheet: Other needs a note");
const s1 = taskRecord(null, { name: "A", status: "Stuck", percent: 40, reason: "System glitch", control: "No", note: "area page timing out" }, T0, true).rec;
ok(s1.status === "Stuck" && s1.stuck_since === T0 && s1.stuck_reason === "System glitch" && s1.stuck_control === "No" && s1.percent === 40, "stuck record carries reason, control, since");
const s2 = taskRecord(s1, { name: "A", status: "Stuck", percent: 50, reason: "Waiting on someone", control: "No" }, T1, true).rec;
ok(s2.stuck_since === T0 && s2.stuck_reason === "Waiting on someone", "re-saving Stuck keeps since, takes the new reason");
const u1 = taskRecord(s2, { name: "A", status: "In progress", percent: 60 }, T2, true).rec;
ok(u1.status === "In progress" && !u1.stuck_since && u1.stuck_log.length === 1 && u1.stuck_log[0].from === T0 && u1.stuck_log[0].to === T2, "leaving Stuck closes the period into stuck_log");
const d1 = taskRecord(u1, { name: "A", status: "Done", percent: 10 }, T2, true).rec;
ok(d1.percent === 100 && d1.stuck_log.length === 1, "Done is 100% and keeps the history");

// the bridge: no reason needed; "Waiting on others" arrives as Stuck / Waiting on someone; a re-sent Stuck keeps her reason
const b1 = taskRecord(null, { name: "TASK-004 Org chart", status: "Waiting on others", percent: 50 }, T0, false).rec;
ok(b1.status === "Stuck" && b1.stuck_reason === "Waiting on someone", "bridge: legacy status becomes Stuck, Waiting on someone");
const b2 = taskRecord(s1, { name: "A", status: "Stuck", percent: 40 }, T1, false).rec;
ok(b2.stuck_reason === "System glitch" && b2.stuck_since === T0 && b2.stuck_note === "area page timing out", "bridge: re-sent Stuck keeps her reason, note and since");

// overrides: Stuck holds while she logs more work; an entry marking Done releases it
const task = { name: "A", status: "In progress", percent: 30, last: "2026-10-30", lastc: "2026-10-30T16:00:00Z", owners: [], touched: [] };
const held = applyOverrides([task], [s1])[0];
ok(held.status === "Stuck" && held.stuck_reason === "System glitch", "Stuck holds over a newer entry");
const rel = applyOverrides([{ ...task, status: "Done", percent: 100 }], [s1])[0];
ok(rel.status === "Done", "an entry marking Done releases Stuck");
ok(applyOverrides([task], [{ name: "A", status: "Waiting on others", percent: 50, updated: "2026-10-31T00:00:00Z" }])[0].status === "Stuck", "an old Waiting on others override shows as Stuck");

// timing and the report line
const per = stuckPeriods({ ...u1 }, T2);
ok(stuckMinutes(per, Date.parse(T0), Date.parse(T2)) === 300, "5 h stuck timed from stuck_log");
const line = blockedLine([{ ...u1 }], ["2026-10-30"], T2);
ok(/Time lost to blockers: 5 h/.test(line) && /outside her control/.test(line) && /Waiting on someone 5 h/.test(line), "report line: total, outside control, by reason");
ok(blockedLine([{ name: "B", status: "Done" }], ["2026-10-30"], T2) === "", "no blockers, no line");

// 6 pm check
const ts = [
  { name: "TASK-007 Log new listings", status: "In progress", last: "2026-10-29" },
  { name: "Done one", status: "Done", last: "2026-10-29" },
  { name: "Stuck one", status: "Stuck", last: "2026-10-29" },
  { name: "Moved today", status: "In progress", last: "2026-10-30" },
  { name: "Old", status: "In progress", last: "2026-10-01" }];
const c = eodCandidates(ts, "2026-10-30");
ok(c.length === 1 && c[0].name === "TASK-007 Log new listings", "6 pm: only open tasks that moved this week but not today");
const txt = eodText(["Log new listings"], "https://x/momo?key=k");
ok(/^6 pm check: this task did not move today/.test(txt) && /• Log new listings/.test(txt) && /https:\/\/x\/momo\?key=k$/.test(txt), "6 pm text");
const td = taskCheckTemplateDef(), body = td.components[0].text;
ok(td.category === "UTILITY" && !/^\{\{/.test(body) && !/\}\}$/.test(body.trim()), "template body neither starts nor ends with a variable");

// 6 pm check: off on any instance without WORK_EOD, once a day, free-form only with the window open
const kv = new Map(); const env = { WA_ALLOWED: "971500000000", WORK_EOD: "on", MEETINGS: { get: async (k) => kv.get(k) || null, put: async (k, v) => { kv.set(k, v); }, list: async () => ({ keys: [], list_complete: true }) } };
const at = Date.parse("2026-10-30T14:05:00Z");   // 18:05 Dubai
const sent = []; const deps = { ownerWindowOpen: async () => true, waSend: async (e, to, t) => { sent.push(t); return { ok: true }; }, link: "L" };
ok((await workEveningCheck({ ...env, WORK_EOD: undefined }, deps, at)) === "off", "6 pm: off without WORK_EOD");
ok((await workEveningCheck(env, deps, Date.parse("2026-10-30T13:00:00Z"))) === "not now", "6 pm: not at 17:00");
ok((await workEveningCheck(env, deps, at)) === "nothing" && sent.length === 0, "6 pm: nothing to check sends nothing");
ok((await workEveningCheck(env, deps, at)) === "done today", "6 pm: once a day");

// wrangler: WORK_EOD only in her instance's vars
const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
const i = toml.indexOf("WORK_EOD"), v = toml.indexOf("[env.azimuth2.vars]"), t2 = toml.indexOf("[env.azimuth2.triggers]");
ok(i > v && i < t2 && toml.indexOf("WORK_EOD", i + 1) < 0, "WORK_EOD is set once, inside [env.azimuth2.vars]");

console.log("v674 stuck: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
