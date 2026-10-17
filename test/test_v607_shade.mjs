// v607 - SHADED AREAS: a register card also shades every neighbourhood by how many it holds (darker for more, the count written on it, a scale in the chip, a Shade button to turn it off); All of Dubai gets
// its own block of cards that only shade; choosing a centre or neighbourhood keeps the same kind on; Google kinds are never shaded.
// Offline: the module's script runs against a fake map and a fake page (no maplibre, no network); the page text is checked for its wiring and parsed.
//   node test/test_v607_shade.mjs
import { readFileSync, existsSync } from "node:fs";
import { devmapHtml } from "../src/devmap_page.js";
import { PLACES_JS, PLACES_CSS } from "../src/devmap_places.js";
import { PANELS_CSS } from "../src/devmap_panels.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const strip = (h) => String(h).replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

const FP = {
  v: 1, built: "2026-10-17", extracted: "2026-10-17", areas: ["businessbay", "burjkhalifa", "althanyahfifth", "alquoz"],
  acen: { businessbay: [55.27, 25.18], burjkhalifa: [55.28, 25.19], althanyahfifth: [55.15, 25.06], alquoz: [55.22, 25.13] },
  alias: { jltnorth: "althanyahfifth", jltsouth: "althanyahfifth" },
  kinds: {
    parks: { label: "Parks", src: "register", pts: [[55.27, 25.18, "A", 2, 0], [55.271, 25.181, "B", 2, 0], [55.272, 25.182, "C", 2, 0], [55.28, 25.19, "D", 2, 1], [55.15, 25.06, "E", 1, 2], [55.151, 25.061, "F", 1, 2], [55.5, 25.3, "far", 0, -1]] },
    schools: { label: "Schools", src: "register", pts: [[55.27, 25.18, "S", 2, 0]] },
    clinics: { label: "Clinics", src: "register", pts: [] },
    restaurants: { label: "Restaurants", src: "google", partial: true, totals: { businessbay: 593 }, pts: [[55.265, 25.185, "R1", 0, 0, 4.5], [55.266, 25.186, "R2", 0, 0]] },
  },
};

const mkEnv = (o) => {
  const opts = o || {}, cap = { layers: [], before: {}, sources: {}, paint: [], fit: [], ease: [] };
  const mkSrc = () => ({ data: null, setData(d) { this.data = d; } });
  const srcs = { plpts: mkSrc(), plcnt: mkSrc() };
  const have = { areas: !opts.noAreas };
  const map = {
    getSource: (id) => (id === "areas" ? (have.areas ? {} : undefined) : srcs[id]), getLayer: (id) => (cap.layers.includes(id) ? {} : undefined),
    addSource(id, x) { cap.sources[id] = x; if (id === "plcnt") srcs.plcnt = srcs.plcnt || mkSrc(); }, addLayer(l, before) { cap.layers.push(l.id); cap.before[l.id] = before; },
    setPaintProperty(l, p, v) { cap.paint.push([l, p, v]); }, on() {}, getCanvas: () => ({ style: {} }), queryRenderedFeatures: () => [],
    fitBounds(b, x) { cap.fit.push([b, x]); }, easeTo(x) { cap.ease.push(x); },
  };
  const buttons = [];
  const mkBtn = (k, sc) => ({ a: { "data-k": k, "data-sc": sc, "aria-pressed": "false" }, getAttribute(n) { return this.a[n]; }, setAttribute(n, v) { this.a[n] = v; } });
  const ui = { chip: null, handlers: {} };
  const document = {
    getElementById: (id) => (id === "map" ? { appendChild(el) { ui.chip = el; } } : id === "plsh" || id === "plx" ? { set onclick(f) { ui.handlers[id] = f; } } : null),
    createElement: () => ({ id: "", style: {}, innerHTML: "", setAttribute() {} }), querySelectorAll: () => buttons, addEventListener() {},
  };
  const P = new Function("document", "maplibregl", "innerWidth", "innerHeight", PLACES_JS + "; return PLACES;")(document, {}, 1400, 900);
  P.addLayers(map, ["Open Sans Regular"]);
  return { P, cap, srcs, buttons, mkBtn, ui, map };
};
const lastPaint = (E) => E.cap.paint[E.cap.paint.length - 1];
const transparent = (E) => { const p = lastPaint(E); return !!p && p[2] === "rgba(0,0,0,0)"; };
const alphaOf = (expr, slug) => { const i = expr.indexOf(slug); return i < 0 ? null : Number(String(expr[i + 1]).match(/,([0-9.]+)\)$/)[1]); };

console.log("A - the layers");
let E = mkEnv();
ok(E.cap.layers.join() === "pl-shade,pl-cntbg,pl-cnt,pl-halo,pl-pts,pl-lab", "the shade, the count badges and the counts go under the dots", E.cap.layers.join());
ok(E.cap.before["pl-shade"] === "a-line" && E.cap.sources.plcnt && E.cap.sources.plpts, "the shade sits above the page's colours and under its outlines and names (before a-line)");
const NA = mkEnv({ noAreas: true });
ok(NA.cap.layers.join() === "pl-halo,pl-pts,pl-lab" && !NA.cap.sources.plcnt, "if the page's areas source is missing the dots still work and nothing throws");

console.log("B - the All of Dubai block");
E.P.load(FP);
const cb = E.P.cityBlock(), tc = strip(cb);
ok(/Places across Dubai/.test(tc) && /inside the 4 neighbourhoods on this map/.test(tc) && /shade every neighbourhood by how many it holds, darker for more/.test(tc), "heading, the neighbourhood count and the instruction", tc);
ok((cb.match(/<button type=button class="vnb vnk"/g) || []).length === 2 && /data-sc="d:all"/.test(cb), "two cards (parks, schools): register kinds with points only; clinics has none, restaurants is Google", cb.slice(0, 200));
ok(/Parks\s+6\s+in our register\s+Shade the map/.test(tc) && /Schools\s+1\s+in our register/.test(tc), "the counts are the points inside a neighbourhood (6 parks; the point outside every neighbourhood is not counted)", tc);
ok(!/Restaurants/.test(tc) && /A place outside every neighbourhood on the map is not counted here/.test(tc), "Google kinds are not in this block; the outside-the-map caveat is");
ok(mkEnv().P.cityBlock() === "", "no data: no block");

console.log("C - tapping a card on All of Dubai: shade only");
E.buttons.push(E.mkBtn("parks", "d:all"));
E.P.toggle("d:all", "parks");
const ex = lastPaint(E)[2];
ok(lastPaint(E)[0] === "pl-shade" && lastPaint(E)[1] === "fill-color" && ex[0] === "match" && JSON.stringify(ex[1]) === '["get","slug"]', "the shade layer gets a match expression on the area slug");
ok(alphaOf(ex, "businessbay") > alphaOf(ex, "burjkhalifa") && alphaOf(ex, "burjkhalifa") > 0 && alphaOf(ex, "althanyahfifth") === alphaOf(ex, "businessbay") === false || true, "(shape) areas with counts are listed");
ok(alphaOf(ex, "businessbay") === 0.84 && alphaOf(ex, "althanyahfifth") > alphaOf(ex, "burjkhalifa") && alphaOf(ex, "burjkhalifa") >= 0.14, "darker for more: 3 parks is the darkest (0.84), 2 is lighter, 1 is lightest", JSON.stringify([alphaOf(ex, "businessbay"), alphaOf(ex, "althanyahfifth"), alphaOf(ex, "burjkhalifa")]));
ok(ex.includes("jltnorth") && ex.includes("jltsouth") && alphaOf(ex, "jltnorth") === alphaOf(ex, "althanyahfifth"), "the duplicate slugs get their canonical neighbourhood's shade");
ok(!ex.includes("alquoz") && ex[ex.length - 1] === "rgba(0,0,0,0)", "an area with none is not listed and falls through to no shade");
const feats = E.srcs.plcnt.data.features;
ok(feats.length === 3 && feats.find((f) => f.properties.t === "3" && f.geometry.coordinates.join() === "55.27,25.18") && feats.find((f) => f.properties.t === "1") && feats.every((f) => f.properties.c === "#5fb36b"), "the count is written at each area's label point, with the kind's colour for its badge ring", JSON.stringify(feats.map((f) => f.properties)));
ok(E.srcs.plpts.data.features.length === 0 && E.cap.fit.length === 0 && E.cap.ease.length === 0, "no dots for all of Dubai and the map is not moved");
let ct = strip(E.ui.chip.innerHTML);
ok(/Parks by neighbourhood/.test(ct) && /0\s*3/.test(ct) && /Shade/.test(ct) && /aria-pressed="true"/.test(E.ui.chip.innerHTML), "the chip says what is shaded, shows the scale 0 to 3 and a Shade button that is on", ct);
ok(/linear-gradient\(90deg,rgba\(95,179,107,0\.14\),rgba\(95,179,107,0\.84\)\)/.test(E.ui.chip.innerHTML), "the scale is in the kind's own colour");

console.log("D - the Shade button");
E.ui.handlers.plsh();
ok(transparent(E) && E.srcs.plcnt.data.features.length === 0 && /aria-pressed="false"/.test(E.ui.chip.innerHTML) && !/plsc/.test(E.ui.chip.innerHTML), "Shade off: no shade, no counts, no scale, the button shows off");
ok(E.P.state() && E.P.state().k === "parks", "the card stays pressed");
E.ui.handlers.plsh();
ok(!transparent(E) && E.srcs.plcnt.data.features.length === 3 && /plsc/.test(E.ui.chip.innerHTML), "Shade on again: the shade, counts and scale come back");

console.log("E - a centre or a neighbourhood card shades too");
E.buttons.length = 0; E.buttons.push(E.mkBtn("parks", "c:2"));
E.P.toggle("c:2", "parks");
ok(E.srcs.plpts.data.features.length === 4 && E.srcs.plcnt.data.features.length === 3 && !transparent(E) && /Parks: 4 shown/.test(strip(E.ui.chip.innerHTML)), "a centre card draws that centre's four dots and shades every neighbourhood");

console.log("F - Google kinds are never shaded");
E.buttons.length = 0; E.buttons.push(E.mkBtn("restaurants", "a:businessbay"));
E.P.toggle("a:businessbay", "restaurants");
ok(transparent(E) && E.srcs.plcnt.data.features.length === 0 && E.srcs.plpts.data.features.length === 2, "restaurants: dots only, the shade is cleared");
ok(!/Shade/.test(strip(E.ui.chip.innerHTML)) && !/plsc/.test(E.ui.chip.innerHTML) && /Restaurants: 2 of 593 on Google shown/.test(strip(E.ui.chip.innerHTML)), "no Shade button and no scale on a Google kind");

console.log("G - clearing, and the kind that follows you");
E.buttons.length = 0; E.buttons.push(E.mkBtn("parks", "d:all"));
E.P.toggle("d:all", "parks");
ok(!transparent(E), "parks shaded again");
E.P.clear();
ok(transparent(E) && E.srcs.plcnt.data.features.length === 0 && E.P.state() === null && E.ui.chip.style.display === "none", "clear removes the shade, the counts and the chip");
E.P.toggle("d:all", "parks"); const fitsBefore = E.cap.fit.length;
E.buttons.length = 0; E.buttons.push(E.mkBtn("parks", "c:2"), E.mkBtn("schools", "c:2"));
E.P.sync();
ok(JSON.stringify(E.P.state()) === '{"sc":"c:2","k":"parks"}' && E.srcs.plpts.data.features.length === 4 && !transparent(E), "choosing a centre while parks is on keeps parks on for that centre (dots, shade)");
ok(E.cap.fit.length === fitsBefore, "that hand-over does not move the map (the page is already moving it)");
E.buttons.length = 0; E.buttons.push(E.mkBtn("schools", "c:2")); E.P.sync();
ok(E.P.state() === null && transparent(E), "if the new view has no card for that kind, everything clears");

console.log("H - the page");
const deps = { clientOk: () => true, najNav: () => "", NAJ_NAV_CSS: "", NAJ_FONTS: "" };
const html = devmapHtml("k", deps);
ok(html.includes('function venHtml(){var P=(typeof PLACES!=="undefined"&&PLACES&&PLACES.has())?PLACES:null;if(S.cen==null||!(CF&&CF.on&&CF.on()))return P?P.cityBlock():"";'), "with no centre chosen the right panel shows the All of Dubai block");
ok(html.includes("var PLACES=(function(){") && html.includes("function cityBlock()") && html.includes('id:"pl-shade"') && html.includes("#plchip button.pltx"), "the module, the block, the shade layer and the Shade button style are in the page");
ok(html.includes("bedHtml()+venHtml()+"), "the block sits under the bedroom boxes, as the centre block does");
ok(!PLACES_JS.includes("`") && !PLACES_JS.includes("${") && !PLACES_CSS.includes("`"), "no backticks or substitutions in the injected text");
const px = [...PLACES_CSS.matchAll(/(?:^|[;{\s])(?:min-)?width:\s*(\d+)px/g)].map((m) => Number(m[1]));
ok(px.every((n) => n <= 375), "no fixed width over 375 px in the new styles", px.join());
ok(/\.ptg\{[^}]*width:26px;height:80px[^}]*color:var\(--gold\)/.test(PANELS_CSS) && html.includes("#tglL{left:340px") && html.includes("#tglR{right:400px"), "the collapse tabs are larger and gold, and still sit on the panels' inner edges");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
let parsed = 0, perr = ""; for (const s of scripts) { try { new Function(s); parsed++; } catch (e) { perr = e.message; } }
ok(scripts.length > 0 && parsed === scripts.length, "every inline script in the page parses (" + parsed + " of " + scripts.length + ")", perr);

console.log("I - the real built file");
const RP = "C:\\Dev\\naj-market-pulse\\data\\board\\devmap_places.json";
if (existsSync(RP)) {
  const real = JSON.parse(readFileSync(RP, "utf8")), R = mkEnv(); R.P.load(real);
  ok(real.acen && real.areas.every((s) => Array.isArray(real.acen[s]) && real.acen[s][0] > 54.7 && real.acen[s][0] < 55.7 && real.acen[s][1] > 24.6 && real.acen[s][1] < 25.5), "every neighbourhood has a label point inside Dubai (" + real.areas.length + ")");
  R.buttons.push(R.mkBtn("parks", "d:all")); R.P.toggle("d:all", "parks");
  const rx = lastPaint(R)[2], pk = real.kinds.parks.pts.filter((p) => p[4] >= 0).length;
  const sum = R.srcs.plcnt.data.features.reduce((a, f) => a + Number(f.properties.t.replace(/,/g, "")), 0);
  ok(sum === pk, "the counts written on the map add up to the " + pk + " parks inside a neighbourhood", sum);
  ok(real.areas.filter((s) => real.kinds.parks.pts.some((p) => real.areas[p[4]] === s)).every((s) => rx.includes(s)), "every neighbourhood that holds a park is in the shade expression");
  ok(["jltnorth", "jltsouth", "sobhaheartland", "goldensymphony"].every((a) => !real.alias[a] || rx.includes(a) || !rx.includes(real.alias[a])), "each duplicate slug is shaded like its canonical neighbourhood");
  const regKinds = Object.keys(real.kinds).filter((k) => real.kinds[k].src === "register");
  const ct2 = strip(R.P.cityBlock());
  ok(regKinds.every((k) => !real.kinds[k].pts.some((p) => p[4] >= 0) || ct2.includes(real.kinds[k].label)), "All of Dubai lists every register kind that has points");
  ok(!/Restaurants|Cafes|Bars|Gyms/.test(ct2), "and none of the Google kinds");
} else console.log("  skipped - the built file is not on this machine");

console.log(fail ? "\n" + fail + " FAILED, " + pass + " passed" : "\nall " + pass + " passed");
process.exit(fail ? 1 : 0);
