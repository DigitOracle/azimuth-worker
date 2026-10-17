// v609 - THE RICHER POPUP: hover shows name and rating; a tap shows the rating line, price, today's hours, address, Call / Website / Maps buttons, tags and the Google credit; the details are
// fetched once on the first tap through a loader the page hands in. Offline: fake map, fake maplibre Popup, fake document; the page text is checked for its wiring and parsed.
//   node test/test_v609_popup.mjs
import { readFileSync, existsSync } from "node:fs";
import { devmapHtml, devmapRoutes } from "../src/devmap_page.js";
import { PLACES_JS, PLACES_CSS, PLACEINFO_KV_NAME, cleanPlaceInfo } from "../src/devmap_places.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const strip = (h) => String(h).replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

const FP = { v: 1, areas: ["businessbay"], acen: { businessbay: [55.27, 25.18] }, alias: {}, kinds: {
  restaurants: { label: "Restaurants", src: "google", partial: true, totals: { businessbay: 593 }, pts: [[55.265, 25.185, "Kitchen6", 0, 0, 4.5, 1203, 0], [55.266, 25.186, "Nameless", 0, 0, 0, 0, 1]] },
  clinics: { label: "Clinics", src: "register", pts: [[55.27, 25.18, "Aster Clinic", 2, 0, 4.2, 310, 2], [55.271, 25.181, "Sure Clinic", 2, 0, 4.0, 12, 3]] },
  pharmacies: { label: "Pharmacies", src: "register", pts: [[55.272, 25.182, "Life Pharmacy", 2, 0, 0, 0, -1]] } } };
const INFO = { v: 1, items: [
  { n: "Kitchen6", r: 4.5, rc: 1203, pr: "Moderate", st: "OPERATIONAL", ad: "Business Bay - Dubai", mu: "https://maps.google.com/?cid=1", ph: "+971 4 123 4567", ws: "https://kitchen6.ae/", h: ["8:00 AM – 11:00 PM", "8:00 AM – 11:00 PM", "8:00 AM – 11:00 PM", "8:00 AM – 11:00 PM", "8:00 AM – 1:00 AM", "8:00 AM – 1:00 AM", "Closed"], fl: ["Outdoor seating", "Delivery"], src: "sweep", lo: 0 },
  { n: "Nameless", r: 0, rc: 0, pr: "", st: "CLOSED_TEMPORARILY", ad: "", mu: "javascript:alert(1)", ph: "none", ws: "ftp://x", h: null, fl: [], src: "sweep", lo: 0 },
  { n: "Aster Clinic - Business Bay", r: 4.2, rc: 310, pr: "", st: "OPERATIONAL", ad: "Bay Avenue", mu: "https://maps.google.com/?cid=2", ph: "", ws: "", h: null, fl: [], src: "match", lo: 1 },
  { n: "Sure Clinic", r: 4.0, rc: 12, pr: "", st: "OPERATIONAL", ad: "", mu: "https://maps.google.com/?cid=3", ph: "", ws: "", h: null, fl: [], src: "match", lo: 0 } ] };

const mkEnv = (o) => {
  const opts = o || {}, cap = { on: {}, popups: [], loads: 0 };
  const src = { data: null, setData(d) { this.data = d; } };
  const map = { getSource: (id) => (id === "plpts" ? src : undefined), getLayer: () => undefined, addSource() {}, addLayer() {}, on(t, l, f) { cap.on[t + ":" + l] = f; }, getCanvas: () => ({ style: {} }), queryRenderedFeatures: () => [], fitBounds() {}, easeTo() {}, setPaintProperty() {} };
  const els = {}; const mapEl = { kids: [], appendChild(el) { this.kids.push(el); els[el.id] = el; } };
  const document = { getElementById: (id) => (id === "map" ? mapEl : els[id] || null), createElement: () => ({ id: "", style: {}, innerHTML: "", setAttribute() {} }), querySelectorAll: () => [], addEventListener() {} };
  function Popup(x) { this.o = x; this.htmls = []; this.removed = false; cap.popups.push(this); }
  Popup.prototype.setLngLat = function (c) { this.c = c; return this; }; Popup.prototype.setHTML = function (h) { this.htmls.push(h); return this; }; Popup.prototype.addTo = function () { return this; }; Popup.prototype.remove = function () { this.removed = true; };
  const matchMedia = opts.touch ? () => ({ matches: false }) : () => ({ matches: true });
  const P = new Function("document", "maplibregl", "innerWidth", "innerHeight", "matchMedia", PLACES_JS + "; return PLACES;")(document, { Popup }, 1400, 900, matchMedia);
  P.addLayers(map, ["Open Sans Regular"]); P.load(FP);
  P.setInfoLoader(opts.noLoader ? null : () => { cap.loads++; return opts.failLoader ? Promise.reject(new Error("x")) : Promise.resolve(opts.badInfo ? { v: 9 } : INFO); });
  return { P, cap, src, els, map };
};
const feat = (k, idx) => { const p = FP.kinds[k].pts[idx]; return { features: [{ geometry: { coordinates: [p[0], p[1]] }, properties: { n: p[2], c: "#fff", r: p[5], rc: p[6], i: p[7], k } }], point: { x: 100, y: 200 } }; };
const tick = () => new Promise((r) => setTimeout(r, 5));
const dubaiDay = (new Date(Date.now() + 4 * 3600 * 1000).getUTCDay() + 6) % 7;

console.log("A - the shape check (cleanPlaceInfo)");
ok(PLACEINFO_KV_NAME === "devmap_placeinfo", "reads KV img_devmap_placeinfo through kvJson");
ok(cleanPlaceInfo(INFO) === INFO && [null, 5, {}, { v: 1 }, { v: 1, items: {} }, { v: 2, items: [] }].every((x) => cleanPlaceInfo(x) === null), "the built shape passes; anything else is not on file");

console.log("B - hover");
let E = mkEnv(); E.P.toggle("a:businessbay", "restaurants");
E.cap.on["mousemove:pl-pts"](feat("restaurants", 0));
const hv = E.els.plhov;
ok(hv && hv.style.display === "block" && /Kitchen6/.test(strip(hv.innerHTML)) && /Restaurants \u00b7 \u2605 4\.5 \(1,203\)/.test(strip(hv.innerHTML)) && hv.style.left === "114px" && hv.style.top === "214px", "a hover shows the name, the kind, the rating and the review count beside the cursor", strip(hv.innerHTML));
E.cap.on["mousemove:pl-pts"](feat("pharmacies", 0));
ok(/Life Pharmacy/.test(strip(hv.innerHTML)) && /Pharmacies/.test(strip(hv.innerHTML)) && !/\u2605/.test(hv.innerHTML), "a place with no rating hovers as name and kind only");
E.cap.on["mouseleave:pl-pts"]();
ok(hv.style.display === "none", "leaving the dot hides the hover");
const T = mkEnv({ touch: true }); T.P.toggle("a:businessbay", "restaurants"); T.cap.on["mousemove:pl-pts"](feat("restaurants", 0));
ok(!T.els.plhov || T.els.plhov.style.display !== "block", "on a touch device there is no hover tooltip");

console.log("C - the tap, before and after the details arrive");
E = mkEnv(); E.P.toggle("a:businessbay", "restaurants");
E.cap.on["click:pl-pts"](feat("restaurants", 0));
let p0 = E.cap.popups[0], first = strip(p0.htmls[0]);
ok(p0.o.maxWidth === "290px" && p0.o.className === "plp" && /Kitchen6/.test(first) && /\u2605 4\.5 from 1,203 reviews/.test(first) && /Loading details/.test(first), "the popup opens at once with the name and the rating the point carries, and says details are loading", first);
await tick(); await tick();
const full = strip(p0.htmls[1]);
ok(p0.htmls.length === 2 && E.cap.loads === 1, "the details are fetched once and the popup is refilled");
ok(/\u2605 4\.5 from 1,203 reviews \u00b7 Moderate/.test(full), "rating, reviews and price level", full);
ok(new RegExp("Today: " + INFO.items[0].h[dubaiDay].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(full), "today's hours, on the Dubai day (" + dubaiDay + ")", full);
ok(/Business Bay - Dubai/.test(full) && /Call/.test(full) && /Website/.test(full) && /Open in Google Maps/.test(full), "address and the three buttons", full);
ok(/href="tel:\+97141234567"/.test(p0.htmls[1]) && /href="https:\/\/kitchen6\.ae\/" target=_blank rel="noopener noreferrer"/.test(p0.htmls[1]) && /href="https:\/\/maps\.google\.com\/\?cid=1"/.test(p0.htmls[1]), "the phone is digits only, the links open in a new tab");
ok(/Outdoor seating/.test(full) && /Delivery/.test(full) && /Rating, hours and contact from Google/.test(full), "tags and the Google credit");
E.cap.on["click:pl-pts"](feat("restaurants", 1)); await tick(); await tick();
const p1 = E.cap.popups[1], nl = strip(p1.htmls[1]);
ok(E.cap.loads === 1 && p0.removed, "a second tap does not fetch again and closes the first popup");
ok(/No Google rating yet/.test(nl) && /Temporarily closed/.test(nl) && !/Call/.test(nl) && !/Website/.test(nl) && !/Open in Google Maps/.test(nl) && !/javascript:/.test(p1.htmls[1]) && !/ftp:/.test(p1.htmls[1]), "no rating says so; a closed place says so; bad links and a bad phone are not linked", nl);
E.cap.on["click:pl-pts"](feat("clinics", 0)); await tick(); await tick();
const c0 = strip(E.cap.popups[2].htmls[1]);
ok(/Aster Clinic/.test(c0) && /Google: Aster Clinic - Business Bay \(likely match\)/.test(c0) && /\u2605 4\.2 from 310 reviews/.test(c0) && /Bay Avenue/.test(c0) && /Open in Google Maps/.test(c0) && !/Today:/.test(c0), "a register place keeps our name, shows Google's where it differs with 'likely match' under 0.8, and has no hours line", c0);
E.cap.on["click:pl-pts"](feat("clinics", 1)); await tick(); await tick();
const c1 = strip(E.cap.popups[3].htmls[1]);
ok(!/Google:/.test(c1) && !/likely/i.test(c1) && /\u2605 4\.0 from 12 reviews/.test(c1), "a sure match with the same name shows no Google line and no 'likely'", c1);
E.cap.on["click:pl-pts"](feat("pharmacies", 0)); await tick();
const ph = E.cap.popups[4];
ok(ph.htmls.length === 1 && /Life Pharmacy/.test(strip(ph.htmls[0])) && /Pharmacies/.test(strip(ph.htmls[0])) && /No Google record for this place/.test(strip(ph.htmls[0])) && !/Loading/.test(ph.htmls[0]), "a place with no Google record: name, kind and a plain statement, no fetch, no loading line", strip(ph.htmls[0]));
ok(E.P.popHtml({ n: "<b>x</b>", k: "clinics", r: 0, rc: 0, i: -1 }, null, false).includes("&lt;b&gt;x&lt;/b&gt;") && E.P.popHtml({ n: "x", k: "clinics", r: 0, rc: 0, i: 0 }, { n: "<i>y</i>", r: 0, rc: 0, pr: "", st: "", ad: "<u>z</u>", mu: "", ph: "", ws: "", h: null, fl: ["<s>t</s>"], src: "match", lo: 0 }, true).indexOf("<i>") < 0, "names, addresses and tags are escaped");

console.log("D - loader failures");
const F = mkEnv({ failLoader: true }); F.P.toggle("a:businessbay", "restaurants"); F.cap.on["click:pl-pts"](feat("restaurants", 0)); await tick(); await tick();
ok(F.cap.popups[0].htmls.length === 2 && /No Google rating yet|\u2605 4\.5/.test(strip(F.cap.popups[0].htmls[1])) && !/Loading/.test(F.cap.popups[0].htmls[1]), "a failed fetch still refills the popup from what the point carries, without the loading line", strip(F.cap.popups[0].htmls[1]));
const Bd = mkEnv({ badInfo: true }); Bd.P.toggle("a:businessbay", "restaurants"); Bd.cap.on["click:pl-pts"](feat("restaurants", 0)); await tick(); await tick();
ok(Bd.cap.popups[0].htmls.length === 2 && !/Loading/.test(Bd.cap.popups[0].htmls[1]), "a malformed details file is treated as empty");
const N = mkEnv({ noLoader: true }); N.P.toggle("a:businessbay", "restaurants"); N.cap.on["click:pl-pts"](feat("restaurants", 0)); await tick(); await tick();
ok(N.cap.popups[0].htmls.length === 2 && /\u2605 4\.5 from 1,203 reviews/.test(strip(N.cap.popups[0].htmls[1])), "with no loader the popup settles on the point's own figures");

console.log("E - the route (what=placeinfo)");
const store = {};
const env = { MEETINGS: { async get(k) { return store[k] == null ? null : JSON.stringify(store[k]); } } };
const deps = { clientOk: () => true, najNav: () => "", NAJ_NAV_CSS: "", NAJ_FONTS: "" };
const callR = async (what) => { const u = "https://x/developers_map_api?what=" + what + "&key=k"; const r = await devmapRoutes(new Request(u), env, new URL(u), deps); return { status: r.status, body: await r.json() }; };
let r0 = await callR("placeinfo");
ok(r0.status === 200 && JSON.stringify(r0.body) === "{}", "not on file: {} with status 200");
store.img_devmap_placeinfo = INFO; r0 = await callR("placeinfo");
ok(r0.status === 200 && r0.body.v === 1 && r0.body.items.length === 4, "on file: the whole value");
store.img_devmap_placeinfo = { v: 1, items: "x" }; r0 = await callR("placeinfo");
ok(JSON.stringify(r0.body) === "{}", "malformed: {}");
store.img_devmap_places = null; r0 = await callR("places");
ok(JSON.stringify(r0.body) === "{}", "the places route beside it is untouched");

console.log("F - the page");
const html = devmapHtml("k", deps);
ok(html.includes('PLACES.setInfoLoader(function(){return api("placeinfo")})') && html.includes("PLACES.load(r[16])"), "the page hands the module a loader that asks for what=placeinfo with the page's own key");
ok(html.includes("#plhov{position:absolute") && html.includes(".plp .plbtn a{") && html.includes("function popHtml(pr,it,loaded)"), "hover, button and popup styles and the renderer are in the page");
ok(!PLACES_JS.includes("`") && !PLACES_JS.includes("${") && !PLACES_CSS.includes("`"), "no backticks or substitutions in the injected text");
ok(!EMOJI.test(PLACES_JS) && !EMOJI.test(PLACES_CSS), "no emoji (the star is U+2605, a text symbol)");
const px = [...PLACES_CSS.matchAll(/(?:^|[;{\s])(?:min-)?width:\s*(\d+)px/g)].map((m) => Number(m[1]));
ok(px.every((n) => n <= 375), "no fixed width over 375 px in the new styles", px.join());
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
let parsed = 0, perr = ""; for (const s of scripts) { try { new Function(s); parsed++; } catch (e) { perr = e.message; } }
ok(scripts.length > 0 && parsed === scripts.length, "every inline script in the page parses (" + parsed + " of " + scripts.length + ")", perr);

console.log("G - the real built files");
const RP = "C:\\Dev\\naj-market-pulse\\data\\board\\devmap_places.json", RI = "C:\\Dev\\naj-market-pulse\\data\\board\\devmap_placeinfo.json";
if (existsSync(RP) && existsSync(RI)) {
  const real = JSON.parse(readFileSync(RP, "utf8")), info = JSON.parse(readFileSync(RI, "utf8"));
  ok(cleanPlaceInfo(info) === info && info.items.length > 1000, "the details file passes the route's check (" + info.items.length + " items)");
  const all = Object.values(real.kinds).flatMap((k) => k.pts);
  ok(all.every((p) => p.length === 8 && p[7] >= -1 && p[7] < info.items.length), "every point carries rating, reviews and a valid details index (" + all.length + " points)");
  const withI = all.filter((p) => p[7] >= 0);
  ok(withI.every((p) => info.items[p[7]].r === p[5] && info.items[p[7]].rc === p[6]), "the rating and review count on each point equal its details record");
  ok(info.items.every((it) => (!it.mu || /^https?:\/\//.test(it.mu)) && (!it.ws || /^https?:\/\//.test(it.ws)) && (!it.h || it.h.length === 7)), "every link is http(s) and every hours record has seven days");
  ok(["pharmacies", "ev", "fuel", "metros"].every((k) => real.kinds[k].pts.every((p) => p[7] === -1)), "pharmacies, EV charging, petrol and metro stations carry no Google details (we hold none)");
  ok(real.kinds.restaurants.pts.every((p) => p[7] >= 0 && info.items[p[7]].src === "sweep"), "every Business Bay restaurant has its sweep record");
  const lo = info.items.filter((it) => it.src === "match" && it.lo).length, sure = info.items.filter((it) => it.src === "match" && !it.lo).length;
  ok(sure > 0 && lo > 0, "register matches split into sure (" + sure + ") and likely (" + lo + ")");
  ok(Buffer.byteLength(JSON.stringify(info)) / 1024 < 1500, "the details file is under 1.5 MB (" + Math.round(Buffer.byteLength(JSON.stringify(info)) / 1024) + " KB)");
} else console.log("  skipped - the built files are not on this machine");

console.log(fail ? "\n" + fail + " FAILED, " + pass + " passed" : "\nall " + pass + " passed");
process.exit(fail ? 1 : 0);
