// v611 - ASKING NOW: a neighbourhood's bedroom boxes carry one grey line with the median rent advertised on Property Finder in the last 14 days, kept apart from the registered median.
// Offline: the module's script is evaluated, the route is called with a fake KV, the page text is checked for its wiring. Section D runs over the real built file when it is on this machine.
//   node test/test_v611_asking.mjs
import { readFileSync, existsSync } from "node:fs";
import { devmapHtml, devmapRoutes } from "../src/devmap_page.js";
import { BEDMED_JS, BEDMED_CSS, ASKING_KV_NAME, cleanAsking } from "../src/devmap_bedmed.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const strip = (h) => String(h).replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const cell = (n, median, extra) => Object.assign({ n, median, thin: n < 30 }, extra || {});
const FIX = { v: 1, built: "2026-10-16", min_n: 10, thin_n: 30, windows: { sale: { l12: ["2025-10-13", "2026-10-13"], all_to: "2026-10-13" }, rent: { l12: ["2025-10-10", "2026-10-10"], all_to: "2026-10-10" } },
  centres: { 2: { l12: { sale: { 1: cell(9484, 1899282) }, rent: { 1: cell(16238, 90000), 2: cell(10848, 140000) } } } },
  areas: { businessbay: { l12: { sale: { 1: cell(2713, 2000000), 2: cell(1578, 3055744) }, rent: { 1: cell(4978, 90000), 2: cell(2534, 135000), 3: cell(631, 185000) } } }, alwasl: { l12: { sale: { 1: cell(12, 1400000) }, rent: { 1: cell(40, 80000) } } } },
  city: { l12: { sale: { 1: cell(58053, 1252746) }, rent: { 1: cell(97342, 67000) } } } };
const ASK = { v: 1, built: "2026-10-17", from: "2026-10-03", to: "2026-10-17", areas: { businessbay: { rent: { 1: { median: 105000, n: 412 }, 2: { median: 150000, n: 230 }, 3: { median: 199000, n: 9 } } }, alwasl: { rent: { 1: { median: 95000, n: 15 } }, sale: { 1: { median: 1500000, n: 12 } } } } };

console.log("A - the shape check (cleanAsking)");
ok(ASKING_KV_NAME === "devmap_asking", "reads KV img_devmap_asking through kvJson");
ok(cleanAsking(ASK) === ASK && [null, 5, {}, { v: 2 }, { v: 1 }, { v: 1, areas: [] }].every((x) => cleanAsking(x) === null), "the built shape passes; anything else is not on file");

console.log("B - the line in the boxes");
const B = new Function(BEDMED_JS + "; return BEDMED;")();
B.load(FIX);
const before = strip(B.boxes("area", "businessbay", "l12", "Business Bay"));
ok(!/asking now/.test(before), "without asking data the boxes are exactly the v604 boxes");
ok(B.loadAsk(ASK) && !B.loadAsk({ v: 9 }) && B.loadAsk(ASK), "loadAsk accepts the built shape and drops a bad one");
const h = B.boxes("area", "businessbay", "l12", "Business Bay"), t = strip(h);
ok(/1 bed AED 90,000 4,978 contracts asking now AED 105,000 ?, 412 adverts/.test(t) && /2 bed AED 135,000 2,534 contracts asking now AED 150,000 ?, 230 adverts/.test(t), "the rent boxes carry the asking line under the registered figure, with the advert count", t);
ok(/3 bed AED 185,000 631 contracts/.test(t) && !/199,000/.test(t), "under 10 adverts: no line (3 bed has 9)");
ok(!/AED 2M.{0,40}asking/.test(t) && (h.match(/class=bma/g) || []).length === 2, "sale boxes carry no asking line here; exactly two lines in all");
ok(/“Asking now” is the median rent advertised by agents in the last 14 days \(3 Oct 2026 to 17 Oct 2026\)/.test(t) && /never part of the registered median/.test(t) && !/Property Finder/.test(t), "the note explains the line, with the window, and names no portal", t);
const aw = strip(B.boxes("area", "alwasl", "l12", "Al Wasl"));
ok(/asking now AED 95,000 ?, 15 adverts/.test(aw) && /asking now AED 1\.5M ?, 12 adverts/.test(aw), "a sale asking line, if the data ever holds one, formats in millions", aw);
ok(!/asking now/i.test(strip(B.boxes("centre", "2", "l12", "Centre 2"))) && !/asking now/i.test(strip(B.boxes("city", "", "l12", "All of Dubai"))), "no asking line and no note on a centre or on all of Dubai");
ok(!/asking now/i.test(strip(B.boxes("area", "nowhere", "l12", "Nowhere"))), "an unknown area: no line, no crash");

console.log("C - the route and the page");
const store = {};
const env = { MEETINGS: { async get(k) { return store[k] == null ? null : JSON.stringify(store[k]); } } };
const deps = { clientOk: () => true, najNav: () => "", NAJ_NAV_CSS: "", NAJ_FONTS: "" };
const callR = async (what) => { const u = "https://x/developers_map_api?what=" + what + "&key=k"; const r = await devmapRoutes(new Request(u), env, new URL(u), deps); return { status: r.status, body: await r.json() }; };
let r0 = await callR("asking");
ok(r0.status === 200 && JSON.stringify(r0.body) === "{}", "not on file: {} with status 200");
store.img_devmap_asking = ASK; r0 = await callR("asking");
ok(r0.body.v === 1 && r0.body.areas.businessbay.rent["1"].median === 105000, "on file: the whole value");
store.img_devmap_asking = { v: 1, areas: [] }; r0 = await callR("asking");
ok(JSON.stringify(r0.body) === "{}", "malformed: {}");
const html = devmapHtml("k", deps);
ok(html.includes('api("places").catch(function(){return null}),api("asking").catch(function(){return null})])') && html.includes("BEDMED.loadAsk(r[17])"), "the page asks for what=asking as the eighteenth call and loads it into the bedroom module");
ok(html.includes(".bmb .bma{") && html.includes("function loadAsk(d)"), "the style and the loader are in the page");
ok(!BEDMED_JS.includes("`") && !BEDMED_JS.includes("${") && !BEDMED_CSS.includes("`"), "no backticks or substitutions in the injected text");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
let parsed = 0, perr = ""; for (const s of scripts) { try { new Function(s); parsed++; } catch (e) { perr = e.message; } }
ok(scripts.length > 0 && parsed === scripts.length, "every inline script in the page parses (" + parsed + " of " + scripts.length + ")", perr);

console.log("D - the real built file");
const RA = "C:\\Dev\\naj-market-pulse\\data\\board\\devmap_asking.json";
if (existsSync(RA)) {
  const real = JSON.parse(readFileSync(RA, "utf8"));
  ok(cleanAsking(real) === real && Object.keys(real.areas).length >= 5, "the built file passes the route's check (" + Object.keys(real.areas).length + " neighbourhoods)");
  const cells = Object.values(real.areas).flatMap((a) => Object.values(a).flatMap((t) => Object.values(t)));
  ok(cells.every((c) => c.n >= 10 && c.median > 0), "every cell has at least 10 adverts and a positive median (" + cells.length + " cells)");
  ok(Object.values(real.areas).every((a) => Object.values(a.rent || {}).every((c) => c.median >= 15000 && c.median <= 2000000)), "every asking rent is between AED 15,000 and 2,000,000 a year");
  const slugs = JSON.parse(readFileSync("C:\\Dev\\naj-market-pulse\\data\\board\\district_polygons.geojson", "utf8")).features.map((f) => f.properties.slug);
  ok(Object.keys(real.areas).every((s) => slugs.includes(s)), "every neighbourhood key is a district on the map");
  ok(real.from < real.to && real.to <= real.built, "the window ends on or before the build date");
} else console.log("  skipped - the built file is not on this machine");

console.log(fail ? "\n" + fail + " FAILED, " + pass + " passed" : "\nall " + pass + " passed");
process.exit(fail ? 1 : 0);
