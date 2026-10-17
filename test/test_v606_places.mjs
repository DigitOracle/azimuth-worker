// v606 - CLICKABLE PLACES: the venue tiles and a neighbourhood block become cards; tapping one draws that kind's places on the map for the centre or neighbourhood.
// Offline: the module's script runs against a fake map and a fake page (no maplibre, no network), the route is called with a fake KV, the page text is checked for its wiring and parsed.
// Section F runs over the REAL built files (market-pulse data/board/devmap_places.json and devmap_venues.json) when they are on this machine.
//   node test/test_v606_places.mjs
import { readFileSync, existsSync } from "node:fs";
import { devmapHtml, devmapRoutes } from "../src/devmap_page.js";
import { PLACES_JS, PLACES_CSS, PLACES_KV_NAME, cleanPlaces } from "../src/devmap_places.js";
import { VENUES_JS } from "../src/devmap_venues.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const strip = (h) => String(h).replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

const FP = {
  v: 1, built: "2026-10-17", extracted: "2026-10-17", areas: ["businessbay", "burjkhalifa", "althanyahfifth"], alias: { jltnorth: "althanyahfifth", jltsouth: "althanyahfifth" },
  kinds: {
    parks: { label: "Parks", src: "register", pts: [[55.27, 25.18, "Bay Park", 2, 0], [55.28, 25.19, "", 2, 1], [55.31, 25.12, "JLT Park", 1, 2]] },
    schools: { label: "Schools", src: "register", pts: [] },
    restaurants: { label: "Restaurants", src: "google", partial: true, totals: { businessbay: 593 }, pts: [[55.265, 25.185, "Kitchen6", 0, 0, 4.5], [55.266, 25.186, "<b>x</b>", 0, 0]] },
  },
};

const mkEnv = (o) => {
  const opts = o || {}, cap = { layers: [], sources: {}, fit: [], ease: [], on: {}, popups: [], sheet: 0 };
  const src = { data: null, setData(d) { this.data = d; } };
  const map = opts.noMap ? undefined : { getSource: (id) => (id === "plpts" ? src : undefined), addSource(id, x) { cap.sources[id] = x; }, addLayer(l) { cap.layers.push(l.id); }, on(t, l, f) { cap.on[t + ":" + l] = f; }, fitBounds(b, x) { cap.fit.push([b, x]); }, easeTo(x) { cap.ease.push(x); }, getCanvas: () => ({ style: {} }), queryRenderedFeatures: () => cap.hits || [] };
  const buttons = [];
  const mkBtn = (k, sc) => ({ a: { "data-k": k, "data-sc": sc, "aria-pressed": "false" }, getAttribute(n) { return this.a[n]; }, setAttribute(n, v) { this.a[n] = v; } });
  const mapEl = { kids: [], appendChild(el) { this.kids.push(el); } };
  const chipRef = { el: null };
  const sideEl = { classList: { remove() { cap.sheet++; } } }, grabEl = { setAttribute() {}, textContent: "" };
  const document = { getElementById: (id) => (id === "map" ? mapEl : id === "side" ? sideEl : id === "grab" ? grabEl : null), createElement: () => { const el = { id: "", style: {}, innerHTML: "", setAttribute() {} }; chipRef.el = el; return el; }, querySelectorAll: () => buttons, addEventListener(t, f) { cap.on["document:" + t] = f; } };
  function Popup(x) { this.o = x; cap.popups.push(this); } Popup.prototype.setLngLat = function (c) { this.c = c; return this; }; Popup.prototype.setHTML = function (h) { this.h = h; return this; }; Popup.prototype.addTo = function () { return this; }; Popup.prototype.remove = function () { this.removed = true; return this; };
  const P = new Function("document", "maplibregl", "innerWidth", "innerHeight", PLACES_JS + "; return PLACES;")(document, { Popup }, opts.width || 1400, 900);
  if (!opts.noLayers) P.addLayers(map, ["Open Sans Regular"]);          // the page hands the module its map through addLayers; the module cannot see the page's private variable
  return { P, cap, src, buttons, mkBtn, mapEl, chipRef, document, map };
};

console.log("A - the shape check (cleanPlaces)");
ok(PLACES_KV_NAME === "devmap_places", "reads KV img_devmap_places through kvJson");
ok(cleanPlaces(FP) === FP, "the built file's shape passes");
ok([null, 5, "x", {}, { v: 2 }, { v: 1 }, { v: 1, kinds: [], areas: [], alias: {} }, { v: 1, kinds: {}, areas: {}, alias: {} }, { v: 1, kinds: {}, areas: [] }].every((x) => cleanPlaces(x) === null), "anything else is treated as not on file");

console.log("B - the cards and the map (PLACES)");
let E = mkEnv();
ok(!E.P.has() && E.P.areaBlock("businessbay", "Business Bay") === "" && E.P.attrs("a:businessbay", "parks") === "" && !E.P.can("a:businessbay", "parks"), "no data loaded: no cards, no attributes");
ok(E.P.load(FP) && E.P.has() && !E.P.load({ v: 9 }) && !E.P.has() && E.P.areaBlock("businessbay", "x") === "", "load accepts the built shape and drops a bad one");
E.P.load(FP);
ok(E.P.can("c:2", "parks") && E.P.can("a:businessbay", "parks") && !E.P.can("c:2", "schools") && !E.P.can("c:3", "parks") && !E.P.can("c:2", "nothing"), "a card is possible only where points exist for that scope and kind");
ok(/data-k="parks" data-sc="c:2" aria-pressed=false/.test(E.P.attrs("c:2", "parks")) && /--kc:#5fb36b/.test(E.P.attrs("c:2", "parks")) && E.P.attrs("c:2", "schools") === "", "attributes for a possible card carry kind, scope, state and the kind's colour");
const bb = E.P.areaBlock("businessbay", "Business Bay"), tb = strip(bb);
ok(/Around here/.test(tb) && /Business Bay/.test(tb) && /Tap a card to see them on the map/.test(tb), "the neighbourhood block has a heading, the name and the instruction", tb);
ok((bb.match(/<button type=button class="vnb vnk"/g) || []).length === 2 && /Parks\s+1\s+in our register/.test(tb), "two cards (parks, restaurants), each a real button; parks counts its one point here", tb);
ok(/Restaurants\s+2\s+mapped from Google\s+Google counts 593 here; the rest are not mapped yet/.test(tb), "a partial Google kind says how many are mapped and what Google counts", tb);
ok(/Show on map/.test(tb) && /not proof that it does not exist/.test(tb) && /at most 20 places per search circle/.test(tb), "the hint and both caveats are on the block");
ok(bb.indexOf("Parks") < bb.indexOf("Restaurants"), "cards follow the fixed order (register kinds before Google kinds)");
ok(strip(E.P.areaBlock("jltnorth", "JLT North")).includes("Parks") && /data-sc="a:althanyahfifth"/.test(E.P.areaBlock("jltsouth", "JLT South")), "an alias slug shows its canonical neighbourhood's places");
ok(E.P.areaBlock("nowhere", "Nowhere") === "" && E.P.areaBlock("burjkhalifa", "<b>x</b>").includes("&lt;b&gt;x&lt;/b&gt;"), "an unknown neighbourhood is no block; names are escaped");
E.buttons.push(E.mkBtn("parks", "c:2"), E.mkBtn("parks", "a:businessbay"));
E.P.toggle("c:2", "parks");
ok(E.src.data && E.src.data.features.length === 2 && E.src.data.features.every((f) => f.properties.c === "#5fb36b" && f.properties.k === "parks"), "tapping a centre card puts that centre's points on the map (2), in the kind's colour", JSON.stringify(E.src.data));
ok(E.cap.fit.length === 1 && E.cap.fit[0][0][0][0] === 55.27 && E.cap.fit[0][0][1][0] === 55.28 && E.cap.fit[0][1].maxZoom === 15.5, "the map fits the points", JSON.stringify(E.cap.fit));
ok(E.buttons[0].a["aria-pressed"] === "true" && E.buttons[1].a["aria-pressed"] === "false" && JSON.stringify(E.P.state()) === '{"sc":"c:2","k":"parks"}', "only the tapped card is pressed");
ok(/Parks: 2 shown/.test(strip(E.chipRef.el.innerHTML)) && E.chipRef.el.style.display === "flex" && /aria-label="Hide these places"/.test(E.chipRef.el.innerHTML) && E.mapEl.kids.length === 1, "a chip on the map says what is shown and has a hide button");
E.P.toggle("c:2", "parks");
ok(E.src.data.features.length === 0 && E.P.state() === null && E.chipRef.el.style.display === "none" && E.buttons[0].a["aria-pressed"] === "false", "tapping the same card again clears the map, the chip and the pressed state");
E.buttons.push(E.mkBtn("restaurants", "a:businessbay"));
E.P.toggle("a:businessbay", "restaurants");
ok(E.src.data.features.length === 2 && /Restaurants: 2 of 593 on Google shown/.test(strip(E.chipRef.el.innerHTML)), "a partial kind's chip says 2 of 593 on Google", strip(E.chipRef.el.innerHTML));
ok(E.cap.ease.length === 0 && E.cap.fit.length === 2, "two or more points fit bounds; no single-point zoom");
E.P.toggle("a:businessbay", "parks");
ok(E.cap.ease.length === 1 && E.cap.ease[0].zoom === 15 && JSON.stringify(E.P.state()) === '{"sc":"a:businessbay","k":"parks"}', "tapping another card switches kind; one point is a zoom, not a fit");
E.buttons.length = 0; E.P.sync();
ok(E.P.state() === null && E.src.data.features.length === 0, "when the pressed card is no longer on the page (another area chosen) the points are cleared");
E.buttons.push(E.mkBtn("parks", "c:2"));
E.cap.hits = [{}]; E.P.toggle("c:2", "parks");
ok(E.P.hit({ point: { x: 1, y: 1 } }) === true, "a tap on a drawn dot is reported as a hit (so the area underneath is not selected)");
E.cap.hits = []; ok(E.P.hit({ point: { x: 1, y: 1 } }) === false, "a tap elsewhere is not");
E.P.clear(); E.cap.hits = [{}]; ok(E.P.hit({ point: { x: 1, y: 1 } }) === false && E.P.hit(null) === false, "with nothing drawn a tap is never a hit; a missing event does not throw");
const ph = mkEnv({ width: 400 }); ph.P.load(FP); ph.P.toggle("c:2", "parks");
ok(ph.cap.sheet === 1 && ph.cap.fit[0][1].padding.bottom > 100, "on a phone the sheet is lowered and the fit leaves room under the points");
const nm = mkEnv({ noMap: true }); nm.P.load(FP); let thr = false; try { nm.P.toggle("c:2", "parks"); nm.P.clear(); nm.P.sync(); } catch (e) { thr = true; }
ok(!thr && nm.P.state() === null, "before the map exists nothing throws");
const L = mkEnv(); L.P.load(FP);
ok(L.cap.sources.plpts && L.cap.layers.join() === "pl-halo,pl-pts,pl-lab" && !!L.cap.on["click:pl-pts"] && !!L.cap.on["mouseenter:pl-pts"], "addLayers adds the source, three layers and the dot handlers");
L.cap.on["click:pl-pts"]({ features: [{ properties: { n: "<b>Kitchen6</b>", k: "restaurants", r: 4.5 }, geometry: { coordinates: [55.26, 25.18] } }] });
ok(L.cap.popups.length === 1 && L.cap.popups[0].h.includes("&lt;b&gt;Kitchen6&lt;/b&gt;") && /Restaurants/.test(strip(L.cap.popups[0].h)) && /\u2605 4\.5/.test(strip(L.cap.popups[0].h)) && L.cap.popups[0].o.className === "plp", "a dot opens a popup with its name (escaped), kind and rating");
L.cap.on["click:pl-pts"]({ features: [{ properties: { n: "", k: "parks", r: 0 }, geometry: { coordinates: [55.26, 25.18] } }] });
ok(/Unnamed/.test(L.cap.popups[1].h) && !/rated/.test(L.cap.popups[1].h), "an unnamed register point says Unnamed and shows no rating");
ok(L.cap.popups[0].removed === true && !L.cap.popups[1].removed, "opening a second popup closes the first");
L.P.clear();
ok(L.cap.popups[1].removed === true, "hiding the places closes the open popup");
L.P.init();
ok(typeof L.cap.on["document:click"] === "function", "init listens for taps on cards");
const click = L.cap.on["document:click"]; let prevented = 0; L.P.load(FP); L.buttons.push(L.mkBtn("parks", "c:2"));
click({ target: { closest: () => ({ getAttribute: (n) => (n === "data-sc" ? "c:2" : "parks") }) }, preventDefault() { prevented++; } });
ok(prevented === 1 && JSON.stringify(L.P.state()) === '{"sc":"c:2","k":"parks"}', "a tap on a card toggles its places");
click({ target: { closest: () => null }, preventDefault() { prevented++; } });
ok(prevented === 1, "a tap anywhere else is left alone");

console.log("C - the venue tiles become cards (VENUES with PLACES)");
const FV = { v: 1, google_date: "2026-10-16", centres: { 2: { name: "Downtown and Business Bay", communities: 30, km2: 173.1, tiles: [{ k: "restaurants", n: 3680, src: "google", also: [["cafes", 1378]] }, { k: "parks", n: 2, src: "register", alt: 208 }], pipeline: { year: 2027, active: { p: 1, u: 10 } } } } };
const doc = { querySelectorAll: () => [], getElementById: () => null, addEventListener() {} };
const CV = new Function("document", "map", VENUES_JS + PLACES_JS + "; return {V: VENUES, P: PLACES};")(doc, undefined);
CV.V.load(FV); CV.P.load(FP);
const vb = CV.V.block("2", "Centre 2: Downtown and Business Bay");
ok(/<button type=button class="vnb vnk" data-k="parks" data-sc="c:2"/.test(vb) && /Show on map/.test(strip(vb)), "a centre tile with points is a button with its scope");
ok(/<div class=vnb><small>Restaurants/.test(vb) && !/data-k="restaurants"/.test(vb), "a Google tile with no centre points stays a plain count, not a card");
ok(/Tap a tile marked “Show on map”/.test(strip(vb)) && /Restaurants and gyms are mapped for Business Bay only so far/.test(strip(vb)), "the block says which tiles are cards and where restaurants and gyms are mapped");
const CV2 = new Function("document", "map", VENUES_JS + "; return {V: VENUES};")(doc, undefined); CV2.V.load(FV);
ok(!/vnk/.test(CV2.V.block("2", "x")) && !/Show on map/.test(strip(CV2.V.block("2", "x"))), "without the places data the venue block is exactly the v605 block (no cards, no hint)");

console.log("D - the route (what=places)");
const store = {};
const env = { MEETINGS: { async get(k) { return store[k] == null ? null : JSON.stringify(store[k]); } } };
const deps = { clientOk: () => true, najNav: () => "", NAJ_NAV_CSS: "", NAJ_FONTS: "" };
const callR = async (what) => { const u = "https://x/developers_map_api?what=" + what + "&key=k"; const r = await devmapRoutes(new Request(u), env, new URL(u), deps); return { status: r.status, body: await r.json() }; };
let r0 = await callR("places");
ok(r0.status === 200 && JSON.stringify(r0.body) === "{}", "not on file: {} with status 200 (the page shows no cards)");
store.img_devmap_places = FP; r0 = await callR("places");
ok(r0.status === 200 && r0.body.v === 1 && r0.body.kinds.parks.pts.length === 3, "on file: the whole value");
store.img_devmap_places = { v: 1, kinds: [], areas: [], alias: {} }; r0 = await callR("places");
ok(r0.status === 200 && JSON.stringify(r0.body) === "{}", "malformed: {}");
store.img_devmap_venues = null; r0 = await callR("venues");
ok(JSON.stringify(r0.body) === "{}", "the venues route beside it is untouched");

console.log("E - the page");
const html = devmapHtml("k", deps);
ok(html.includes("var PLACES=(function(){") && html.includes('api("venues").catch(function(){return null}),api("places").catch(function(){return null})])') && html.includes("PLACES.load(r[16])"), "the page carries the module, asks for what=places as the seventeenth call and loads it");
ok(html.includes("PLACES.addLayers(map,font)") && html.includes("PLACES.areaBlock(slug,area.name)") && html.includes("PLACES.init();"), "layers are added with the map, the neighbourhood block is in the area panel, taps are listened for");
ok(html.includes('(typeof PLACES!=="undefined"&&PLACES&&PLACES.hit(e))||(typeof CF!==') && html.includes('if(!fillMode()||(typeof PLACES!=="undefined"&&PLACES&&PLACES.hit(e)))return;'), "a tap on a dot cannot select the area or the centre under it (both map click handlers)");
ok(/function renderDetail\(\)\{if\(typeof PLACES!=="undefined"&&PLACES\)setTimeout\(PLACES\.sync,0\);/.test(html), "after every redraw of the right panel the pressed state and the points are brought in line");
ok(html.includes("button.vnk[aria-pressed=true]") && html.includes("#plchip{position:absolute"), "card, pressed and chip styles are in the page");
ok(html.includes("var VENUES=(function(){") && html.includes("var PANELS=(function(){") && html.includes("var BEDMED=(function(){") && html.includes("VENUES.load(r[15])"), "the venue block, the panels and the bedroom boxes are still wired");
ok(!PLACES_JS.includes("`") && !PLACES_JS.includes("${") && !PLACES_CSS.includes("`"), "no backticks or substitutions in the injected text");
ok(!EMOJI.test(PLACES_JS) && !EMOJI.test(PLACES_CSS), "no emoji");
const px = [...PLACES_CSS.matchAll(/(?:^|[;{\s])(?:min-)?width:\s*(\d+)px/g)].map((m) => Number(m[1]));
ok(px.every((n) => n <= 375), "no fixed width over 375 px in the new styles", px.join());
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
let parsed = 0, perr = ""; for (const s of scripts) { try { new Function(s); parsed++; } catch (e) { perr = e.message; } }
ok(scripts.length > 0 && parsed === scripts.length, "every inline script in the page parses (" + parsed + " of " + scripts.length + ")", perr);

console.log("F - the real built files");
const RP = "C:\\Dev\\naj-market-pulse\\data\\board\\devmap_places.json", RV = "C:\\Dev\\naj-market-pulse\\data\\board\\devmap_venues.json", RG = "C:\\Dev\\naj-market-pulse\\data\\board\\district_polygons.geojson";
if (existsSync(RP) && existsSync(RV)) {
  const real = JSON.parse(readFileSync(RP, "utf8")), ven = JSON.parse(readFileSync(RV, "utf8"));
  ok(cleanPlaces(real) === real && Object.keys(real.kinds).length === 15, "the built file passes the route's check and holds 15 kinds");
  const W = mkEnv(); W.P.load(real);
  let bad = [];
  for (const [cid, c] of Object.entries(ven.centres)) for (const t of c.tiles) {
    if (t.src !== "register") continue;
    const n = real.kinds[t.k] ? real.kinds[t.k].pts.filter((p) => p[3] === Number(cid)).length : -1;
    if (n !== t.n) bad.push("centre " + cid + " " + t.k + ": map " + n + " vs tile " + t.n);
    if ((t.n > 0) !== W.P.can("c:" + cid, t.k)) bad.push("centre " + cid + " " + t.k + ": can() disagrees with the count");
  }
  ok(bad.length === 0, "every register tile's count equals the points the card would draw, for all five centres", bad.join("; "));
  const allPts = Object.values(real.kinds).flatMap((k) => k.pts);
  ok(allPts.every((p) => p[0] > 54.7 && p[0] < 55.7 && p[1] > 24.6 && p[1] < 25.5), "every point is inside Dubai's bounding box (" + allPts.length + " points)");
  ok(allPts.every((p) => p[4] === -1 || (p[4] >= 0 && p[4] < real.areas.length)) && Object.values(real.alias).every((a) => real.areas.includes(a)), "every area index and every alias target exists");
  const bbIx = real.areas.indexOf("businessbay");
  ok(bbIx >= 0 && ["restaurants", "cafes", "bars", "gyms"].every((k) => real.kinds[k].partial && real.kinds[k].pts.length > 0 && real.kinds[k].pts.length <= real.kinds[k].totals.businessbay + 5 && real.kinds[k].pts.every((p) => p[4] === bbIx && p[3] === 0)), "Business Bay's Google kinds are partial, carry Google's total, sit in that area and have no centre");
  const bb2 = strip(W.P.areaBlock("businessbay", "Business Bay"));
  ok(/Parks\s+\d+\s+in our register/.test(bb2) && /Restaurants\s+\d+\s+mapped from Google\s+Google counts 593 here/.test(bb2) && /Gyms\s+\d+\s+mapped from Google\s+Google counts 34 here/.test(bb2), "the real Business Bay block shows register cards and the four partial Google cards", bb2.slice(0, 500));
  if (existsSync(RG)) {
    const slugs = JSON.parse(readFileSync(RG, "utf8")).features.map((f) => f.properties.slug);
    ok(real.areas.every((s) => slugs.includes(s)) && Object.keys(real.alias).every((s) => slugs.includes(s)), "every neighbourhood slug in the file is a district in the polygon file");
  }
  const sizeKB = Buffer.byteLength(JSON.stringify(real)) / 1024;
  ok(sizeKB < 600, "the file is small enough to load with the page (" + Math.round(sizeKB) + " KB)");
} else {
  console.log("  skipped - the built files are not on this machine");
}

console.log(fail ? "\n" + fail + " FAILED, " + pass + " passed" : "\nall " + pass + " passed");
process.exit(fail ? 1 : 0);
