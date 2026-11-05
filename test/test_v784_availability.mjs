// v784: developer availability on passports, with the REAL records exported by naj-market-pulse scripts/export_avail_kv.py
import fs from "fs";
import { avFor, avCommunity, availCardPdf, availCardWeb, availRollupWeb, avSourceLine, avPlotKeys } from "../src/avail_view.js";
import { dpRoute } from "../src/district_passport.js";
import { bppBody } from "../src/building_passports.js";
let fail = 0; const ok = (c, m, x) => { if (!c) { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("ok", m); };
const bulk = JSON.parse(fs.readFileSync("C:/Dev/naj-market-pulse/data/avail/kv_avail_bulk.json", "utf8"));
const store = Object.fromEntries(bulk.map((x) => [x.key, x.value]));
const env = { MEETINGS: { get: async (k, t) => (t === "arrayBuffer" ? null : store[k] ?? null), put: async () => {}, list: async () => ({ keys: [] }) } };
const NOW = Date.parse("2026-11-05T12:00:00Z");

// Select, Artistry One (plot stored without the dash)
const sel = await avFor(env, "naj:plot:3370875");
ok(sel.length === 1 && sel[0].developer === "Select" && sel[0].units === 32, "Select Artistry One found on its plot", sel.map((r) => [r.developer, r.units]));
ok(avPlotKeys("naj:plot:337-875").includes("naj:plot:3370875"), "dashed plot id also finds the undashed record");
const card = availCardPdf(sel, 2600, NOW);
ok(/Available now/.test(card) && /From Select\u2019s availability sheet \u00b7 sheet from 17 Sep 2026/.test(card), "card names the developer and the sheet date");
ok(/may have changed, ask Najjuko/.test(card), "a sheet older than 30 days says so");
ok(/asking/.test(card) && /Land Department register: median <b>AED 2,600\/sq ft<\/b> paid/.test(card), "asking prices and register prices are labelled separately");
ok(!/to confirm/i.test(card) && !/[\u{1F300}-\u{1FAFF}]/u.test(card), "no 'to confirm', no emoji");

// Binghatti Spectre (offices + retail)
const sp = await avFor(env, "naj:plot:3265633");
ok(sp.length === 1 && sp[0].project === "Binghatti Spectre" && sp[0].units === 174, "Binghatti Spectre: 174 units", sp.map((r) => [r.project, r.units]));
ok(sp[0].beds.some((b) => b.type === "Office" && b.n === 161), "Spectre offices counted by type");

// no record -> nothing drawn
ok(availCardPdf(await avFor(env, "naj:plot:676-8698"), null, NOW) === "", "a plot with no developer sheet gets no section");

// Beyond on an area page (Dubai Maritime City, fresh 4 Nov sheet)
const C = await avCommunity(env, ["Dubai Maritime City"]);
ok(C && C.projects.some((p) => p.developer === "Beyond"), "Dubai Maritime City roll-up has Beyond", C && C.projects.map((p) => p.project));
const roll = availRollupWeb(C, { now: NOW });
ok(/From Beyond\u2019s availability sheet \u00b7 4 Nov 2026/.test(roll) && !/Beyond[^<]*may have changed/.test(roll), "Beyond sheet is fresh (no stale note on it)");
const u = new URL("https://x/dp/area/dubai_maritime_city");
const r = await dpRoute(new Request(u), env, u);
const h = r ? await r.text() : "";
ok(r && r.status === 200 && /Available now/.test(h) && /Kanyon/.test(h) && /only light/.test(h), "area page renders, light only", r && r.status);
const u2 = new URL("https://x/dp/area/nowhere_at_all"), r2 = await dpRoute(new Request(u2), env, u2);
ok(r2 && r2.status === 404, "unknown area is a 404");

// web card + search chip script
ok(/avw-c/.test(availCardWeb(sel, { now: NOW })), "web card draws bedroom cards");
const page = bppBody("k", "", {}, [], "https://x", "kendall");
let parsed = true; for (const m of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) { try { new Function(m[1]); } catch (e) { parsed = false; console.log(e.message); } }
ok(parsed && /avchip/.test(page) && /available/.test(page), "search script parses and has the N available chip");
process.exit(fail ? 1 : 0);
