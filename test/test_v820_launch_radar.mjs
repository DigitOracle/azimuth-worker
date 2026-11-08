// v820 - Launch Radar reported events on New launches (Kendall 8 Nov 2026). Lines start with the evidence word; no invented time;
// a broker-reported venue says so; an unnamed BEYOND event says "name not given"; no section when KV img_launch_radar is absent.
import assert from "node:assert/strict";
import { radarLine, radarSection, radarEvents, launchesPage } from "../src/launches_card.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; }; const eq = (a, b, m) => { assert.equal(a, b, m); n++; };
const TODAY = "2026-11-08";
const ps = { id: "lc_1", project: "Palm Springs", name_unknown: false, developer: "Nakheel", event_type: "unveiling", date: "2026-11-09", time_window: "afternoon", event_at: null,
  venue: "Jumeirah Beach Hotel", venue_basis: "as reported", registration_required: true, registration_url: null, marketing: "L1", register: null, sales: null, evidence_n: 1, first_seen: "2026-11-08T13:20:00+04:00", names_elsewhere: [] };
const by = Object.assign({}, ps, { id: "lc_2", project: "Beyond new launch", name_unknown: true, developer: "Beyond", venue: "Beyond sales centre", names_elsewhere: ["Shione"] });
eq(radarLine(ps), "Reported: unveiling 9 Nov · afternoon · registration needed", "the card line");
eq(radarLine(Object.assign({}, ps, { time_window: null })), "Reported: unveiling 9 Nov · time not given · registration needed", "no time -> says so, never invents one");
eq(radarLine(Object.assign({}, ps, { event_at: "2026-11-09T16:00:00+04:00" })), "Reported: unveiling 9 Nov · 16:00 · registration needed", "a written time is shown");
eq(radarLine(Object.assign({}, ps, { marketing: "L2" })).split(":")[0], "Multiple sources report", "L2 word");
eq(radarLine(Object.assign({}, ps, { marketing: "L3" })).split(":")[0], "Developer-announced", "L3 word");
const h = radarSection({ events: [ps, by] }, TODAY);
ok(h.includes("Reported events &middot; not verified"), "section is labelled not verified");
ok(h.includes("Jumeirah Beach Hotel (as reported)"), "venue as reported");
ok(h.includes("name not given") && h.includes("Named elsewhere as Shione (unconfirmed)"), "unnamed BEYOND event");
ok(h.includes("not yet confirmed by the developer") && h.includes("no registration link yet") && h.includes("not on the Land Department register yet"), "unknowns listed");
ok(!/sold out/i.test(h) && !/DLD-verified/i.test(h), "no sold-out or verified claim");
eq(radarEvents({ events: [Object.assign({}, ps, { date: "2026-11-01" }), ps] }, TODAY).length, 1, "past events drop off");
eq(radarSection(null, TODAY), "", "no KV -> no section");
eq(radarSection({ events: [] }, TODAY), "", "empty -> no section");
const page = launchesPage("k", "", { generated: TODAY, rows: [] }, TODAY, { events: [ps] });
ok(page.indexOf("Reported events") > 0 && page.indexOf("Reported events") < page.indexOf('id=lg'), "section sits above the launches grid");
ok(!launchesPage("k", "", { generated: TODAY, rows: [] }, TODAY).includes("Reported events"), "old call (4 args) unchanged");
// negative control: the assertion on the time really can fail
ok(radarLine(ps).indexOf("15:00") === -1 && radarLine(Object.assign({}, ps, { event_at: "2026-11-09T15:00:00+04:00" })).includes("15:00"), "control: the time check can see a time");
console.log(`v820 launch radar: ${n} checks passed`);
