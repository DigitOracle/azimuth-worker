// v681 - Momo Work fixes from the 1 Nov 2026 audit: Kendall's report cover, the report labels, the 6 pm check retry, the recording sweep.
import { reportHtml, workEveningCheck, recSweep, REC_IDLE_MS } from "../src/work_log.js";
import { swapPage } from "../src/work_person.js";
import { FN_LOGO_B64 } from "../src/fn_logo.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL " + m); } };
const E = (d) => ({ date: d, created: d + "T08:00:00Z", title: "x", type: "Update", summary: "s", people: [], scope: [], deliverables: [], next: [], works: [], progress: [] });
const kind = (h) => (h.match(/<div class=kick>[^<]*<\/div><h1>([A-Z]+)<span>/) || [])[1] || "";
const range = (a, b) => { const o = []; for (let d = new Date(a + "T00:00:00Z"); d.toISOString().slice(0, 10) <= b; d.setUTCDate(d.getUTCDate() + 1)) o.push(d.toISOString().slice(0, 10)); return o; };

// 1. labels: Monthly = consecutive days from the 1st; Weekly = seven consecutive days; anything else Activity
const rep = (a, b, picked) => reportHtml([E(a)], a, b, [], picked);
ok(kind(rep("2026-10-14", "2026-10-14")) === "DAILY", "one day is Daily");
ok(kind(rep("2026-10-01", "2026-10-31")) === "MONTHLY", "the whole of October is Monthly");
ok(kind(rep("2026-10-01", "2026-10-19")) === "MONTHLY", "October to date is Monthly");
ok(kind(rep("2026-10-10", "2026-10-19")) === "ACTIVITY", "a 10-day range inside October is Activity, not Monthly");
ok(/<title>FN Activity report 10 Oct 2026 to 19 Oct 2026|FN Activity report 10 Oct 2026 to 19 Oct 2026/.test(rep("2026-10-10", "2026-10-19")), "its document title says Activity with both dates");
ok(kind(rep("2026-10-26", "2026-11-01")) === "WEEKLY", "Mon-Sun across the month end is Weekly");
ok(kind(rep("2026-10-15", "2026-10-21")) === "WEEKLY", "Thu-Wed, seven consecutive days, is Weekly");
const picked = ["2026-10-01", "2026-10-03", "2026-10-06", "2026-10-08", "2026-10-10", "2026-10-13", "2026-10-15"];
ok(kind(reportHtml([E("2026-10-01")], picked[0], picked[6], [], picked)) === "ACTIVITY", "seven picked days are Activity, not Weekly");
ok(/7 selected days/.test(reportHtml([E("2026-10-01")], picked[0], picked[6], [], picked)), "the cover still says 7 selected days");
ok(/26 Oct 2026 to 1 Nov 2026 · 7 days/.test(rep("2026-10-26", "2026-11-01")), "the cover date line is unchanged");

// 2. Kendall's cover: his organisation in the kicker, his role, no empty logo slot; hers is untouched
const her = rep("2026-10-26", "2026-11-01");
ok(/<div class=kick>FN REALTY<\/div>/.test(her) && /Strategic Lead – Marketing, PR &amp; Business Development/.test(her), "her cover keeps FN REALTY and her role");
const his = swapPage(her, { name: "Dr. Test Person", org: "Example & Co", role: "Founder <CEO>" }, [FN_LOGO_B64 && FN_LOGO_B64.length > 40 ? FN_LOGO_B64 : ""]);
ok(/<div class=kick>EXAMPLE &amp; CO<\/div>/.test(his), "his kicker is his organisation, escaped");
const coverHead = his.slice(his.indexOf("<section class=cover>"), his.indexOf("</header>"));   // the cover and the page header (the body's role groups come from each person's own labels)
ok(coverHead.length > 200 && !/FN REALTY|FN Realty|Strategic Lead|Najjuko/.test(coverHead), "no FN Realty, her role or her name on his cover or header");
ok(!/FN REALTY|FN Realty|Najjuko/.test(his), "no FN Realty or her name anywhere on his report");
ok(/Founder &lt;CEO&gt;/.test(his), "his role is escaped into the cover and header");
ok(/<img class=mark style="display:none"/.test(his) || !/<img class=mark/.test(his), "his cover hides the blanked mark instead of an empty slot");

// 3. the 6 pm check: a failed send is retried on the next tick, at most three times
const kv = new Map();
const KV = { get: async (k) => kv.has(k) ? kv.get(k) : null, put: async (k, v) => { kv.set(k, v); }, delete: async (k) => { kv.delete(k); },
  list: async (o = {}) => ({ keys: [...kv.keys()].filter((k) => k.startsWith(o.prefix || "")).sort().map((name) => ({ name })), list_complete: true }) };
kv.set("work_naj_2026-10-29_a", JSON.stringify({ ...E("2026-10-29"), works: ["TASK-001 Brief"], progress: [{ work: "TASK-001 Brief", status: "In progress", percent: 30 }] }));
const env = { WA_ALLOWED: "971500000000", WORK_EOD: "on", MEETINGS: KV };
let calls = 0, okNext = false;
const deps = { ownerWindowOpen: async () => true, waSend: async () => { calls++; return { ok: okNext }; }, link: "L" };
const at = (m) => Date.parse("2026-10-30T14:" + String(m).padStart(2, "0") + ":00Z");   // 18:mm Dubai
ok((await workEveningCheck(env, deps, at(0))) === "send failed" && kv.get("wl_eod_naj_2026-10-30") === "failed:1", "a failed send is recorded as failed:1");
ok((await workEveningCheck(env, deps, at(1))) === "send failed" && kv.get("wl_eod_naj_2026-10-30") === "failed:2", "the next tick tries again");
okNext = true;
ok((await workEveningCheck(env, deps, at(2))) === "sent" && kv.get("wl_eod_naj_2026-10-30") === "sent", "a send that works marks the day sent");
ok((await workEveningCheck(env, deps, at(3))) === "done today" && calls === 3, "and nothing more is sent that day");
kv.set("wl_eod_naj_2026-10-31", "failed:3"); okNext = false;
ok((await workEveningCheck(env, deps, Date.parse("2026-10-31T14:05:00Z"))) === "gave up" && calls === 3, "after three failures it stops trying");
const thrower = { ...deps, waSend: async () => { throw new Error("network"); } };
kv.delete("wl_eod_naj_2026-11-01"); kv.set("work_naj_2026-10-31_b", JSON.stringify({ ...E("2026-10-31"), works: ["TASK-002 Plan"], progress: [{ work: "TASK-002 Plan", status: "In progress", percent: 10 }] }));
ok((await workEveningCheck(env, thrower, Date.parse("2026-11-01T14:05:00Z"))) === "send failed" && kv.get("wl_eod_naj_2026-11-01") === "failed:1", "a send that throws counts as failed, not sent");

// 4. the recording sweep: only on its quarter-hour minute; finishes a recording idle an hour, for each person; leaves live ones alone
const NOW = Date.parse("2026-11-01T06:07:00Z");   // minute 7 of the quarter
ok(Math.floor(NOW / 60000) % 15 === 7, "test clock sits on the sweep minute");
const rk = new Map();
const RK = { get: async (k, t) => rk.has(k) ? rk.get(k) : null, put: async (k, v) => { rk.set(k, v); }, delete: async (k) => { rk.delete(k); },
  list: async (o = {}) => ({ keys: [...rk.keys()].filter((k) => k.startsWith(o.prefix || "")).sort().map((name) => ({ name })), list_complete: true }) };
const iso = (ms) => new Date(ms).toISOString();
const rec = (id, startedMs, status) => JSON.stringify({ id, date: "2026-11-01", title: "t", started_hm: "08:00", started: iso(startedMs), status, secs: 0 });
const seg = (n, secs, text) => JSON.stringify({ n, secs, text, engine: "x" });
rk.set("recw_20261101old", rec("20261101old", NOW - 3 * 3600e3, "recording")); rk.set("recs_20261101old_000", seg(0, 300, "a long enough piece of speech to count as a real transcript here"));
rk.set("recw_20261101live", rec("20261101live", NOW - 20 * 60e3, "recording")); rk.set("recs_20261101live_000", seg(0, 300, "still going"));
rk.set("recw_20261101edge", rec("20261101edge", NOW - REC_IDLE_MS - 10 * 60e3, "recording")); rk.set("recs_20261101edge_000", seg(0, 900, "fifteen minutes of audio, idle only 55 minutes"));
rk.set("recw_20261101done", rec("20261101done", NOW - 9 * 3600e3, "transcribed"));
rk.set("kendall_recw_20261029k", rec("20261029k", NOW - 50 * 3600e3, "recording")); rk.set("kendall_recs_20261029k_000", seg(0, 60, "his false start"));
const renv = { MEETINGS: RK };
ok((await recSweep(renv, null, NOW + 60000)).length === 0, "the sweep does nothing off its quarter-hour minute");
const swept = await recSweep(renv, null, NOW);
const ids = swept.map((x) => x.person + ":" + x.id).sort().join(",");
ok(ids === "kendall:20261029k,najjuko:20261101old", "it finishes her idle recording and his, and nothing else (" + ids + ")");
const o = JSON.parse(rk.get("recw_20261101old"));
ok(o.status === "transcribed" && o.auto_finished === iso(NOW) && o.parts === 1 && o.chars > 40 && o.secs === 300, "the swept recording is transcribed, marked auto_finished, with parts, chars and secs");
ok(o.ended_hm === new Date(NOW - 3 * 3600e3 + 300e3 + 4 * 3600e3).toISOString().slice(11, 16), "its end time is when the audio stopped, not when the sweep ran");
ok(JSON.parse(rk.get("recw_20261101live")).status === "recording" && JSON.parse(rk.get("recw_20261101edge")).status === "recording", "a live recording and one idle under an hour are left alone");
ok(JSON.parse(rk.get("kendall_recw_20261029k")).status === "transcribed" && !rk.has("recw_20261029k"), "his is finished under his own keys");
ok((await recSweep(renv, null, NOW)).length === 0, "a second sweep finds nothing left to finish");

console.log("v681 momo fixes: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
