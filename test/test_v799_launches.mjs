// v799: the launches block of the 05:00 feed and the Momo "New launches" card (Kendall 7 Nov 2026).
import assert from "node:assert/strict";
import fs from "node:fs";
import { launchAngles, launchArea } from "../src/feed_ledger.js";
import { launchCards, launchesPage } from "../src/launches_card.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

const today = "2026-11-07";
const d = { transactions: { periodFrom: "2026-09-12", periodTo: "2026-11-06", medianResidentialAedSqft: 1650 },
  areaIntel: { areas: [{ area: "WADI AL SAFA", medianAedSqft: 1190, byRoom: { "1 B/R": { medianAed: 880000, sales: 140 } } }, { area: "BUSINESS BAY", medianAedSqft: 2300, byRoom: {} }] } };
const row = (o) => Object.assign({ key: "ap_" + Math.random().toString(36).slice(2, 10), project: "Kore", developer: "Imtiaz", area: "Dubailand", from_aed: 679000, units: "Studio, 1BR",
  plan: "50/50", handover: "Q4 2028", confidence: "medium", status: "announced", first_seen: "2026-11-06", last_seen: "2026-11-07", kinds: ["youtube"], sources_n: 2, links: ["https://www.youtube.com/watch?v=x"] }, o);

// quiet day: nothing, and the QA line says so
let r = launchAngles({ rows: [] }, d, [], today);
ok(r.angles.length === 0 && /^no new launches/.test(r.note), "quiet day adds nothing and says no new launches");
ok(/no img_launches/.test(launchAngles(null, d, [], today).note), "missing snapshot noted");

// never old, never low, never registered, never padded
const rows = [row({ key: "ap_a" }), row({ key: "ap_old", first_seen: "2026-10-20" }), row({ key: "ap_low", confidence: "low" }), row({ key: "ap_reg", status: "registered" })];
r = launchAngles({ rows }, d, [], today);
ok(r.angles.length === 1 && r.angles[0].fact === "launch:ap_a", "only the fresh medium+ unregistered launch");
const a = r.angles[0];
ok(/as advertised/.test(a.hook) && /price as advertised/i.test(a.source), "price as advertised wording");
ok(/AED 679,000/.test(a.figure) && /AED 880,000/.test(a.hook) && /DLD Open Data/.test(a.source), "tied to the register: 1-bedroom median in the area");
ok(a.launch === true && a.family === "developer", "flagged as a launch angle");

// up to five
r = launchAngles({ rows: Array.from({ length: 9 }, (_, i) => row({ key: "ap_" + i })) }, d, [], today);
ok(r.angles.length === 5, "capped at five");

// 14-day repeat guard via famhist ids
r = launchAngles({ rows: [row({ key: "ap_a" })] }, d, [{ d: "2026-11-01", id: "launch:ap_a" }], today);
ok(r.angles.length === 0 && /already sent/.test(r.note), "a launch sent in the last 14 days is held back");
r = launchAngles({ rows: [row({ key: "ap_a" })] }, d, [{ d: "2026-10-10", id: "launch:ap_a" }], today);
ok(r.angles.length === 1, "older than 14 days may run again");

// area falls back to the city median when the area is not on the register
r = launchAngles({ rows: [row({ key: "ap_z", area: "Nowhere" })] }, d, [], today);
ok(/Across Dubai/.test(r.angles[0].hook), "city median fallback");
ok(launchArea(d, "Business Bay").area === "BUSINESS BAY" && launchArea(d, "") === null, "area matcher");

// the Momo card
const html = launchesPage("k", "", { generated: today, rows: [row({ key: "ap_a", confidence: "high" }), row({ key: "ap_b", developer: "Samana", project: "Ocean Crest", first_seen: "2026-10-01" })] }, today);
ok((html.match(/class=lc /g) || []).length === 2, "one card per launch");
ok(/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(html), "2-up cards, not a list");
ok(/data-f=week>This week/.test(html) && /data-f=all>All/.test(html) && /By developer/.test(html), "filters This week / All / By developer");
ok(/cf-high/.test(html) && /from AED 679,000/.test(html) && /50\/50 plan/.test(html) && /handover Q4 2028/.test(html) && /2 sources/.test(html) && /seen today/.test(html) && /Video/.test(html), "card fields");
ok(/#FFFDF9/.test(html) && !/#0C1413/.test(html), "light cream");
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html), "icons, never emojis");
ok(!/motherduck/i.test(html) && !/claude|gpt|gemini/i.test(html), "no lake vendor or model names on the card");
ok(launchCards([{ project: "<x>", developer: "a" }], today).includes("&lt;x&gt;"), "escaped");

const idx = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/\/momo\/work\/launches" && \["najjuko", "kendall"\]/.test(idx), "route for Kendall and Najjuko only");
ok(/launchAngles\(await briefKvJson\(env, "launches"\)/.test(idx) && /angles\.push\(\.\.\._la\.angles\)/.test(idx), "feed reads img_launches and appends after the five");
ok(/id=card_launches/.test(idx) && /\+ CMP \+ LNC \+ TRIP/.test(idx), "front-door card");
console.log("v799 launches:", n, "checks passed");
