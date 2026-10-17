// v605 - INSIDE THIS CENTRE (restaurants, parks, gyms, schools, supermarkets, clinics, and the next year's pipeline) in the right panel of the Developers-by-area page.
// Offline: the module's own script is evaluated, the route is called with a fake KV, the page text is checked for its wiring and parsed. No network, no KV, no deploy.
// Section E runs the module over the REAL built file (market-pulse data/board/devmap_venues.json, built from the lake table through MotherDuck) when it is on this machine.
//   node test/test_v605_venues.mjs
import { readFileSync, existsSync } from "node:fs";
import { devmapHtml, devmapRoutes } from "../src/devmap_page.js";
import { VENUES_JS, VENUES_CSS, VENUES_KV_NAME, cleanVenues } from "../src/devmap_venues.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const strip = (h) => String(h).replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

const FIX = {
  v: 1, built: "2026-10-16", google_date: "2026-10-16",
  centres: {
    1: { name: "Deira and Bur Dubai", communities: 48, km2: 222.5,
         tiles: [{ k: "restaurants", n: 5613, src: "google", also: [["cafes", 1779], ["bars", 514]] }, { k: "parks", n: 34, src: "register", alt: 173 }, { k: "gyms", n: 320, src: "google" },
                 { k: "schools", n: 73, src: "register", alt: 411 }, { k: "supermarkets", n: 74, src: "register", alt: 1868 }, { k: "clinics", n: 553, src: "register", alt: 1258 }],
         pipeline: { year: 2027, active: { p: 20, u: 4713 }, not_started: { p: 34, u: 2829 }, pending: { p: 13, u: 227 } } },
    4: { name: "Expo 2020 Centre", communities: 15, km2: 744.8, tiles: [{ k: "restaurants", n: 690, src: "google", also: [] }, { k: "clinics", n: 72, src: "register" }], pipeline: { year: 2027, active: { p: 1, u: 10 } } },
    5: { name: "Dubai Silicon Oasis Centre", communities: 20, km2: 270.3, tiles: [{ k: "gyms", n: 129, src: "google" }], pipeline: { year: 2027 } },
    3: { name: "Empty", communities: 1, km2: 1, tiles: [] },
  },
};

console.log("A - the shape check (cleanVenues)");
ok(VENUES_KV_NAME === "devmap_venues", "reads KV img_devmap_venues through kvJson");
ok(cleanVenues(FIX) === FIX, "the built file's shape passes");
ok([null, 5, "x", {}, { v: 2 }, { v: 1 }, { v: 1, centres: [] }, { v: 1, centres: 7 }].every((x) => cleanVenues(x) === null), "anything else is treated as not on file");

console.log("B - the block (VENUES.block)");
const V = new Function(VENUES_JS + "; return VENUES;")();
ok(V.block("1", "Centre 1") === "" && !V.has(), "no data loaded: no block");
ok(V.load(FIX) && V.has() && !V.load({ v: 9 }) && !V.has() && V.block("1", "x") === "", "load accepts the built shape and drops a bad one");
V.load(FIX);
const h1 = V.block("1", "Centre 1: Deira and Bur Dubai"); const t1 = strip(h1);
ok(/Inside this centre/.test(t1) && /Centre 1: Deira and Bur Dubai/.test(t1), "heading and the centre's name", t1);
ok(/the 48 communities we group into it, about 223 km²/.test(t1), "the communities and the area are stated", t1);
ok((h1.match(/class=vnb>/g) || []).length === 6 + 3, "six place tiles and three pipeline boxes");
ok(/Restaurants\s+5,613\s+operating, Google\s+plus 1,779 cafes, 514 bars/.test(t1), "restaurants: Google count with cafes and bars beside it, not in it", t1);
ok(/Parks\s+34\s+in our register\s+Google lists 173, a wider net/.test(t1), "parks: our register count, Google's wider count shown beside it", t1);
ok(/Gyms\s+320\s+operating, Google/.test(t1) && !/Gyms[^A-Z]*Google lists/.test(t1.split("Schools")[0]), "gyms: Google count, no 'Google lists' line when there is no alt");
ok(/Schools\s+73\s+in our register/.test(t1) && /Supermarkets\s+74\s+in our register\s+Google lists 1,868/.test(t1) && /Clinics\s+553\s+in our register\s+Google lists 1,258/.test(t1), "schools, supermarkets and clinics: register counts with Google's wider counts");
ok(/Pipeline: register end date in 2027/.test(t1) && /67 projects, 7,769 planned homes\./.test(t1), "the pipeline total is the sum of the three statuses", t1);
ok(/Active\s+4,713\s+planned homes\s+20 projects/.test(t1) && /Not started\s+2,829\s+planned homes\s+34 projects/.test(t1) && /Pending\s+227\s+planned homes\s+13 projects/.test(t1), "each status: homes and projects", t1);
ok(/on 16 Oct 2026/.test(t1) && /OpenStreetMap and Dubai Municipality/.test(t1) && /not the plan’s boundaries/.test(t1) && /not a handover/.test(t1) && /Land Department’s own/.test(t1), "the basis, the date, the grouping and the handover caveat are on the block", t1);
ok(!/hotel/i.test(t1), "hotels are not shown (Google's lodging type includes holiday homes)");
const h4 = V.block("4", "Centre 4"); const t4 = strip(h4);
ok(/Restaurants\s+690/.test(t4) && !/plus/.test(t4) && /1 project\b/.test(t4) && /Not started\s+0\s+no projects/.test(t4) && /Pending\s+0\s+no projects/.test(t4), "a centre with one project says '1 project' and shows an empty status as 'no projects', never blank", t4);
ok(/No project in the register has an end date in 2027 here\./.test(strip(V.block("5", "Centre 5"))), "a centre with no project due says so");
ok(V.block("3", "Empty") === "" && V.block("9", "Nowhere") === "", "a centre with no tiles, or an unknown key, is no block, not a crash");
ok(V.block("1", "x", "vnside").includes("vncard vnside") && !h1.includes("vnside"), "the narrow-screen copy carries the vnside class, the right-panel copy does not");
ok(V.block("1", "<b>x</b>").includes("&lt;b&gt;x&lt;/b&gt;"), "names are escaped");

console.log("C - the route (what=venues)");
const store = {};
const env = { MEETINGS: { async get(k) { return store[k] == null ? null : JSON.stringify(store[k]); } } };
const deps = { clientOk: () => true, najNav: () => "", NAJ_NAV_CSS: "", NAJ_FONTS: "" };
const callR = async (what) => { const u = "https://x/developers_map_api?what=" + what + "&key=k"; const r = await devmapRoutes(new Request(u), env, new URL(u), deps); return { status: r.status, body: await r.json() }; };
let r0 = await callR("venues");
ok(r0.status === 200 && JSON.stringify(r0.body) === "{}", "not on file: {} with status 200 (the page shows no block)");
store.img_devmap_venues = FIX; r0 = await callR("venues");
ok(r0.status === 200 && r0.body.v === 1 && r0.body.centres["1"].tiles[0].n === 5613, "on file: the whole value");
store.img_devmap_venues = { v: 1, centres: [] }; r0 = await callR("venues");
ok(r0.status === 200 && JSON.stringify(r0.body) === "{}", "malformed: {}");
store.img_devmap_bedmed = null; r0 = await callR("bedmed");
ok(r0.status === 200 && JSON.stringify(r0.body) === "{}", "the bedroom route beside it is untouched");

console.log("D - the page");
const html = devmapHtml("k", deps);
ok(html.includes("var VENUES=(function(){") && html.includes('api("bedmed").catch(function(){return null}),api("venues").catch(function(){return null})') && html.includes("VENUES.load(r[15])"), "the page carries the module, asks for what=venues as the sixteenth call and loads it");
ok(html.includes('VENUES.block(String(e.id),"Centre "+e.id+": "+e.name)') && html.includes('VENUES.block(String(e.id),"Centre "+e.id+": "+e.name,"vnside")') && html.includes("function venHtml()"), "block under the right panel's bedroom boxes and a copy in the centre card");
ok(/bedHtml\(\)\+venHtml\(\)\+/.test(html), "the right panel shows the block only on the branch with no area chosen");
ok(html.includes(".vncard.vnside{display:none}") && html.includes("@media(max-width:1100px){.vncard.vnside{display:block}}"), "the left-sheet copy shows only where the right panel is hidden (1100 px)");
ok(html.includes("var BEDMED=(function(){") && html.includes('BEDMED.boxes("centre",String(e.id),S.win,"Centre "+e.id+": "+e.name,"bmside")') && html.includes("BEDMED.load(r[14])"), "the v604 bedroom boxes are still wired as they were");
ok(!VENUES_JS.includes("`") && !VENUES_JS.includes("${") && !VENUES_CSS.includes("`"), "no backticks or substitutions in the injected text (the page's String.raw rule)");
ok(!EMOJI.test(VENUES_JS) && !EMOJI.test(VENUES_CSS), "no emoji");
const px = [...VENUES_CSS.matchAll(/(?:^|[;{\s])(?:min-)?width:\s*(\d+)px/g)].map((m) => Number(m[1]));
ok(px.every((n) => n <= 375), "no fixed width over 375 px in the new styles", px.join());
ok(/@media\(max-width:480px\)\{\.vng\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/.test(VENUES_CSS), "phones: two tiles across");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
let parsed = 0, perr = ""; for (const s of scripts) { try { new Function(s); parsed++; } catch (e) { perr = e.message; } }
ok(scripts.length > 0 && parsed === scripts.length, "every inline script in the page parses (" + parsed + " of " + scripts.length + ")", perr);

console.log("E - the real built file");
const REAL = "C:\\Dev\\naj-market-pulse\\data\\board\\devmap_venues.json";
if (existsSync(REAL)) {
  const real = JSON.parse(readFileSync(REAL, "utf8"));
  ok(cleanVenues(real) === real && Object.keys(real.centres).length === 5, "the built file passes the route's check and holds five centres");
  const W = new Function(VENUES_JS + "; return VENUES;")(); W.load(real);
  for (const [id, c] of Object.entries(real.centres)) {
    const tx = strip(W.block(id, "Centre " + id + ": " + c.name));
    const first = c.tiles[0], n0 = Math.round(first.n).toLocaleString("en-US");
    ok(c.tiles.length === 6 && tx.includes(n0) && c.pipeline && c.pipeline.year === 2027, "centre " + id + " (" + c.name + "): six tiles, first figure " + n0 + " on the block, a 2027 pipeline");
    const tp = ["active", "not_started", "pending"].reduce((a, s) => a + ((c.pipeline[s] || {}).p || 0), 0), tu = ["active", "not_started", "pending"].reduce((a, s) => a + ((c.pipeline[s] || {}).u || 0), 0);
    ok(tx.includes(tp.toLocaleString("en-US") + " projects, " + tu.toLocaleString("en-US") + " planned homes."), "centre " + id + ": block total " + tp + " projects, " + tu + " planned homes", tx.slice(0, 300));
  }
  const sum = Object.values(real.centres).reduce((a, c) => a + ["active", "not_started", "pending"].reduce((b, s) => b + ((c.pipeline[s] || {}).p || 0), 0), 0);
  ok(sum === 349, "the five centres add to 349 projects (the figure ChatGPT's table checked against)", String(sum));
} else {
  console.log("  skipped - " + REAL + " is not on this machine");
}

console.log(fail ? "\n" + fail + " FAILED, " + pass + " passed" : "\nall " + pass + " passed");
process.exit(fail ? 1 : 0);
