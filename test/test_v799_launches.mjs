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
const rows = [row({ key: "ap_a" }), row({ key: "ap_old", first_seen: "2026-10-20" }), row({ key: "ap_low", confidence: "low" }), row({ key: "ap_bare", area: "", from_aed: null })];
r = launchAngles({ rows }, d, [], today);
ok(r.angles.length === 1 && r.angles[0].fact === "launch:ap_a", "only the fresh medium+ launch with an area or a price");
const rg = launchAngles({ rows: [row({ key: "ap_r", registered: true, status: "registered", confidence: "high", from_aed: null })] }, d, [], today).angles[0];
ok(rg && /new on the Dubai Land Department register/.test(rg.hook) && /Dubai Land Department project register/.test(rg.source), "a registered launch is worded as on the register");
ok(/launches data check: zero rows/.test(launchAngles({ rows: [], qa: ["zero rows from every source today"] }, d, [], today).note), "data-check alert reaches the QA line");
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
const html = launchesPage("k", "", { generated: today, qa: ["no launches run recorded for 2026-11-06 (a missed day)"], rows: [
  row({ key: "ap_a", confidence: "high", pic: "https://azimuth-2.digitalchemy.workers.dev/img/lpic_AAAAAAAAAAA_0", pic_credit: "Some Channel", pic_link: "https://www.youtube.com/watch?v=AAAAAAAAAAA", zone: "Dubai Silicon Oasis Centre", sizes: "650-1,400 sq ft" }),
  row({ key: "ap_b", developer: "Samana", project: "Ocean Crest", first_seen: "2026-10-01", registered: true, status: "registered", kinds: ["dld_register", "youtube"] }),
  row({ key: "ap_bare", project: "Bare", area: "", from_aed: null })] }, today);
ok((html.match(/class=lc /g) || []).length === 2, "one card per launch; a card without area or price is hidden");
ok(/<img src="https:\/\/azimuth-2\.digitalchemy\.workers\.dev\/img\/lpic_AAAAAAAAAAA_0"/.test(html) && /href="https:\/\/www\.youtube\.com\/watch\?v=AAAAAAAAAAA"[^>]*><img/.test(html), "v800: the face-checked video frame, tap opens the video");
ok(/Image: Some Channel/.test(html) && /class="pic none"/.test(html), "credit line; initial tile when there is no picture");
ok(/>On the register</.test(html) && /Not yet registered/.test(html) && !/seen on YouTube/.test(html), "v802: status chip only (registered + YouTube still one card)");
ok(/By Dubai 2040 zone/.test(html) && /data-zone="Dubai Silicon Oasis Centre"/.test(html) && /Dubai 2040: Dubai Silicon Oasis Centre/.test(html), "zone filter and zone on the card");
ok(/New and registered launches &middot; prices as advertised/.test(html) && !/\bDLD\b/.test(html), "v802: one short intro line, no DLD");
ok(/Check: no launches run recorded/.test(html) && /650-1,400 sq ft/.test(html), "QA line and sizes");
ok(/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(html), "2-up cards, not a list");
ok(/data-f=week>This week/.test(html) && /data-f=all>All/.test(html) && /By developer/.test(html), "filters This week / All / By developer");
ok(!/cf-high|class="cf/.test(html) && /data-conf="high"/.test(html) && /from AED 679K/.test(html) && /50\/50 plan/.test(html) && /handover Q4 2028/.test(html) && /2 sources/.test(html) && /seen today/.test(html) && /Video/.test(html), "card fields");
ok(/#FFFDF9/.test(html) && !/#0C1413/.test(html), "light cream");
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html), "icons, never emojis");
ok(!/motherduck/i.test(html) && !/claude|gpt|gemini/i.test(html), "no lake vendor or model names on the card");
ok(launchCards([{ project: "<x>", developer: "a", area: "Arjan" }], today).includes("&lt;x&gt;"), "escaped");

const idx = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/\/momo\/work\/launches" && \["najjuko", "kendall"\]/.test(idx), "route for Kendall and Najjuko only");
ok(/launchAngles\(await briefKvJson\(env, "launches"\)/.test(idx) && /angles\.push\(\.\.\._la\.angles\)/.test(idx), "feed reads img_launches and appends after the five");
ok(/id=card_launches/.test(idx) && /\+ CMP \+ LNC \+ TRIP/.test(idx), "front-door card");
console.log("v799 launches:", n, "checks passed");
