// v782b - planner checks: window, levels, skip/hold, Monday market deadline, next step only, trial reel, on camera, minimum a week
import { plannerChecks, isPlaceholder } from "../src/planner_checks.js";
let fail = 0; const ok = (c, m, x) => { if (!c) { fail++; console.log("FAIL", m, x ? JSON.stringify(x).slice(0, 300) : ""); } else console.log("ok", m); };
const S = { best_from: "10:00", best_to: "14:00", story_times: ["08:00", "13:00", "15:00"], on_camera_limit: 1, pro_video_allowance: 10, trial_hours: 72, feed_min_week: 4, posting_days: [2, 3, 4, 5, 6], market_deadline: "18:00", skip_days: [] };
const it = (o) => Object.assign({ kind: "feed", format: "Reel", topic: "Real topic", who: "AI", how: "AI video", time: "11:00", steps: ["Planned", "Who & how", "Brief", "Made", "Caption", "Approved", "Scheduled", "Live"], done: {} }, o);
const today = "2026-11-05";   // Thu
const items = [
  it({ code: "A", date: "2026-11-06", time: "" }),                                   // tomorrow, no time -> fix
  it({ code: "B", date: "2026-11-07", topic: "[Flex: only if content is ready]" }), // placeholder within 2 days -> fix
  it({ code: "C", date: "2026-11-12", topic: "[Project] collab" }),                   // placeholder 7 days out -> check
  it({ code: "D", date: "2026-11-07", time: "19:00" }),                                // outside window -> fix
  it({ code: "E", date: "2026-11-11", who: "Liam" }), it({ code: "F", date: "2026-11-12", who: "Liam" }),   // Liam twice in a week -> check
  it({ code: "G", date: "2026-11-10", note: "ON HOLD from meeting" , time: "" }),      // held -> never flagged
  it({ code: "M", kind: "story", story_type: "Market", date: "2026-11-09", topic: "[Market stat or news]", steps: ["Planned", "Who & how", "Made", "Approved", "Posted"] }),
  it({ code: "T", date: "2026-11-08", trial: { date: "2026-11-05", time: "11:00" } }), // trial today, not Made -> fix
];
const r = plannerChecks(items, S, today, { nowHm: "16:00", popups: { "2026-11-06": 2 } });
const has = (code, rx, lvl) => (r.items[code] || []).some((p) => rx.test(p.what) && (!lvl || p.lvl === lvl));
ok(r.from === "2026-11-06" && r.to === "2026-11-13", "window = tomorrow + 7 days", [r.from, r.to]);
ok(has("A", /No time/, "fix"), "no time -> fix");
ok(has("B", /placeholder/, "fix") && has("C", /placeholder/, "check"), "placeholder: fix within 2 days, check later");
ok(has("D", /outside/, "fix"), "time outside the best window -> fix");
ok(has("F", /Liam is on camera 2 times/, "check"), "on camera twice in a week -> check");
ok(!r.items.G, "held item never flagged");
ok(has("M", /Monday market update has no topic/, "check"), "Monday market: check before Sunday 18:00");
const r2 = plannerChecks(items, S, "2026-11-08", { nowHm: "18:30" });
ok((r2.items.M || []).some((p) => p.lvl === "fix" && /Monday market/.test(p.what)), "Monday market: fix after Sunday 18:00");
ok(has("T", /Trial Reel goes out/, "fix"), "trial reel not Made by its date -> fix");
ok((r.days["2026-11-06"] || []).some((p) => /meeting change/.test(p.what)), "unanswered meeting pop-ups flagged on the day");
const r3 = plannerChecks(items, Object.assign({}, S, { skip_days: ["2026-11-06"] }), today, {});
ok(!(r3.days["2026-11-06"] || []).length, "skipped day never flagged");
ok(/to check for tomorrow/.test(r.line) && !/fix/i.test(r.line), "summary line", r.line);   // v791: to check, never to fix
// only the next step is checked for being overdue
const late = it({ code: "L", date: "2026-11-06", done: { Planned: { done: 1 }, "Who & how": { done: 1 }, Brief: { done: 1 } } });
const r4 = plannerChecks([late], S, today, {});
ok((r4.items.L || []).filter((p) => /was due/.test(p.what)).length === 1 && has.call(null, "L", /x/) === false, "one overdue step only (the next one)", r4.items.L);
ok(isPlaceholder({ topic: "[Advisor]'s story" }) && !isPlaceholder({ topic: "Ali Kalhor: 3 numbers" }), "placeholder detection");
process.exit(fail ? 1 : 0);
