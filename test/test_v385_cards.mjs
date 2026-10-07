// v385 - EVERY project card opens something. A card with a map position shows it and opens the building snapshot (now with a Project details section);
// a card with NO map position is a button that opens the PROJECT DETAIL panel (one component, pjDetailHtml). Offline: the page script runs on a hand-worked fixture; no network, no KV, no deploy.
//   node test/test_v385_cards.mjs
import fs from "node:fs";
import { devmapHtml } from "../src/devmap_page.js";
import { DM } from "../scripts/build_devmap_index.mjs";
import { PHOSPHOR_LIGHT } from "../src/devmap_icons.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
const text = (h) => h.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
DM.TIER_CFG.bounds = [30000, 20000, 12000];
const IDX = { as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] }, devs: { x: { name: "X", areas: 1, n: 40, profile: { projects: 5, homes: 0 } } }, areas: {
  dist: { name: "Fixture District", devs: { x: { n: "X", h: 0, c: [[40, 21000, 1e6, 1]], b: [[10, 35000, "Tower One"], [8, 21000, "Not Yet Tower"], [7, 22000, "Built Tower"], [6, 20000, "Parcelless"], [5, 19000, "Unknown Tower"]], r: [] } } } } };
const EV = {
  tower: { p: 100, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "project_id", e: "REGISTER_VERIFIED", a: "Fixture District", h: 120 },
  notyet: { p: 3719, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "project_id", e: "REGISTER_VERIFIED", a: "Fixture District", as: "Dubai Land Department project register", h: 703, st: "NOT_STARTED", pl: 1 },
  built: { p: 777, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "project_id", e: "REGISTER_VERIFIED", a: "Fixture District", h: 55, st: "ACTIVE", pc: 62, pe: "2027-03", mix: "1 bed: 30, 2 bed: 25" },
  noparcel: { p: 5, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "exact_name", e: "REGISTER_VERIFIED", a: "Fixture District", st: "NOT_STARTED", pl: 0 },
  claimed: { p: null, di: null, dn: "", m: "", e: "DEVELOPER_CLAIMED", a: "Fixture District" }
};
const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
const body = "var $=function(id){return document.getElementById(id)};var KEY=\"k\";var fetch=function(){return new Promise(function(){})};" + s0 + s1
  + cut("function clipName", "function devHead(") + cut("function icoSvg", "function evidenceHtml")
  + cut("var BLK={}", "var PULSE=0") + cut("function showSnap(p,pin)", "function focusProject") + cut("function tipHtml", "function drillHtml")
  + cut("function invFromApi", "function invProjRow")
  + "; return {BLK:BLK,PJ:PJ,PDET:PDET,pjCard:pjCard,pjFeatures:pjFeatures,showSnap:showSnap,pdOpen:pdOpen,pdClose:pdClose,pdWhy:pdWhy,invIndex:invIndex,pjDetailHtml:pjDetailHtml,locate:locate};";
const mkEl = (id) => ({ id, innerHTML: "", style: {}, className: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() { this.focused = true; } });
const els = {}, keys = [];
const doc = { getElementById: (i) => els[i] || null, createElement: () => mkEl(""), body: { appendChild: (e) => { els[e.id] = e; } }, addEventListener: (t, f) => keys.push(f) };
const S = { evOpen: false, sel: "dist", unit: "sqft", win: "all", inv: null };
const fn = new Function("DM", "IDX", "S", "TC", "document", "renderDetail", "updatePj", "EVI", "innerWidth", body);
const P = fn(DM, IDX, S, ["#c5a56a", "#2f8a7f", "#3987e5", "#8a9a96"], doc, () => {}, () => {}, PHOSPHOR_LIGHT, 375);

// a district blocks file with one footprint named Tower One
const sq = (x) => ({ type: "Polygon", coordinates: [[[55.1 + x, 25.1], [55.1 + x + 0.001, 25.1], [55.1 + x + 0.001, 25.101], [55.1 + x, 25.101], [55.1 + x, 25.1]]] });
P.BLK.dist = { state: "ok", feats: [{ type: "Feature", geometry: sq(0), properties: { i: 0, n: "Tower One", k: "towerone", a: 9000 } }, { type: "Feature", geometry: sq(0.01), properties: { i: 1, n: "", k: "", a: 5000 } }] };
S.inv = [{ id: "INV-BUILT", name: "Built Tower", brand: "Built Tower", pn: 777 }]; P.invIndex();
const card = (name, ppsm, n, ev, nd) => P.pjCard("dist", name, ppsm, n, "<span class=note style=\"display:block;margin:0\">Fixture District</span>", nd || "name not in the data yet", ev);
const dkOf = (h) => (h.match(/data-pd="([^"]+)"/) || [])[1];

console.log("A - every card is a button");
const cards = { tower: card("Tower One", 35000, 10, EV.tower), notyet: card("Not Yet Tower", 21000, 8, EV.notyet), built: card("Built Tower", 22000, 7, EV.built), noparcel: card("Parcelless", 20000, 6, EV.noparcel), unknown: card("Unknown Tower", 19000, 5, null), anon: card(null, 18000, 4, null, "Project name not recorded"), claimed: card("Claimed Tower", 17000, 3, EV.claimed) };
const all = Object.values(cards).join("");
ok(!/<div class="pjc/.test(all), "no card is a plain div (a dead end)");
ok(Object.values(cards).every((h) => /^(<div class=pjw>)?<button type=button class="pjc (loc|noloc)"/.test(h)), "all seven cards, with and without a position and with no name, start with a button");
ok(/class="pjc loc" data-pj="dist\|towerone"/.test(cards.tower) && /Show on the map/.test(cards.tower) && !/Project details/.test(cards.tower), "a card with a position still reads 'Show on the map' (unchanged)");
ok(["notyet", "built", "noparcel", "unknown", "anon", "claimed"].every((k) => /class="pjc noloc" data-pd="[^"]+"/.test(cards[k]) && /Project details/.test(cards[k]) && !/No map position yet/.test(cards[k])), "a card with no position carries 'Project details', not the dead 'No map position yet'");
ok(["notyet", "built"].every((k) => /aria-label="Project details for /.test(cards[k])) && /aria-label="Show Tower One on the map"/.test(cards.tower), "each button has an accessible name (keyboard focusable: a real button, no tabindex tricks)");
ok(/<svg class="chev"/.test(cards.notyet) && /<svg class="evi mu"/.test(cards.notyet), "no-position card keeps the muted icon and shows a chevron from the existing icon set");
ok(new Set(["notyet", "built", "noparcel", "unknown", "anon", "claimed"].map((k) => dkOf(cards[k]))).size === 6, "six distinct detail keys (a nameless card does not collide)");

console.log("B - tapping a card with no position opens the project detail panel, with the right 'why' line");
const open = (k) => { P.pdOpen(dkOf(cards[k]), mkEl("from")); return els.pjdet.innerHTML; };
let p1 = open("notyet");
ok(els.pjdet && els.pjdet.attrs.role === "dialog" && els.pjdet.style.display === "block", "the panel is a dialog and is shown");
ok(text(p1).includes("Not built yet, so there is no building to show on the map. The register holds its land parcel."), "NOT_STARTED: 'Not built yet...' line, exact words");
ok(text(open("built")).includes("The building outline is not on our map yet.") && !/Not built yet/.test(text(els.pjdet.innerHTML)), "ACTIVE, no outline matched: 'The building outline is not on our map yet.'");
ok(text(open("noparcel")).includes("The register has no land parcel for this project.") && !/Not built yet/.test(text(els.pjdet.innerHTML)), "no parcel in the register: 'The register has no land parcel for this project.' (even when NOT_STARTED)");
const pu = text(open("unknown"));
ok(/No building outline of this name is on our map yet\./.test(pu) && !/Not built yet|no land parcel/.test(pu), "register facts not in the index: a neutral line that claims no building and no parcel fact");
ok(["Not built yet, so there is no building to show on the map. The register holds its land parcel.", "The building outline is not on our map yet.", "The register has no land parcel for this project."].every((s) => js.includes(s)), "the three fixed lines are in the page script verbatim");

console.log("C - what the panel shows, each line with its source and evidence label");
p1 = open("built"); const t1 = text(p1);
ok(/Project\s+Built Tower/.test(t1) && /Register project number\s+777/.test(t1), "project name and register project number");
ok(/Registered developer\s+FIXTURE DEVELOPMENT L\.L\.C/.test(t1) && /Registered developer per DLD register: FIXTURE DEVELOPMENT L\.L\.C \s*REGISTER_VERIFIED/.test(t1), "registered developer (legal entity), plain source line, and the v373 evidence label");
ok(/Register status\s+Active, 62% complete, planned end 2027-03/.test(t1), "status, percent complete and planned end date where known");
ok(/Registered units\s+55 units; 1 bed: 30, 2 bed: 25/.test(t1), "registered units and unit mix where known");
ok(/Sales in the window\s+7 sales; median AED 2,0\d\d per sq ft/.test(t1) && /settled sales register, all years\s+DATA/.test(t1), "sales count and median price per sq ft, labelled DATA with the window", t1);
S.unit = "sqm"; const tsq = text(open("built")); S.unit = "sqft";
ok(/median AED 22,000 per sq m/.test(tsq), "the median follows the chosen unit (sq m)");
ok(/Area\s+Fixture District/.test(t1), "the project's own area label");
ok(/href="\/developers_pdf\?kind=investor_selector&amp;project=INV-BUILT&amp;format=html&amp;key=k"/.test(p1) && /Investor PDF/.test(t1), "Investor PDF link when a facts record exists (same href as the card link)");
{ const h = open("notyet"); ok(!/href="[^"]*investor_selector/.test(h) && /pdoff[^>]*aria-disabled=true[^>]*>[^<]*<svg[\s\S]*?<\/svg>Investor PDF/.test(h), "no Investor PDF link when no facts record exists (v389: a disabled button with its reason, not a link)"); }
ok(["Project", "Register project number", "Registered developer", "Registered units", "Sales in the window", "Area", "Map position"].every((l) => new RegExp(l + "[^]*?Source: ").test(text(open("built")))) && (p1.match(/Source: /g) || []).length >= 6 && (p1.match(/class=tag>/g) || []).length >= 6, "every line carries 'Source:' and an evidence tag");
const tc = text(open("claimed"));
ok(/Registered developer\s+Not recorded/.test(tc) && /Developer says \(website\); the register has no record of it/.test(tc) && /NOT_AVAILABLE/.test(tc), "no developer on the register: said plainly, with the developer's-own-website line");
ok(/Project\s+Project name not recorded/.test(text(open("anon"))), "a nameless card opens a panel that says so");
ok(!EMOJI.test(p1) && !EMOJI.test(all) && !EMOJI.test(cut("// v385 - EVERY card", "function pjFeatures")) && !EMOJI.test(cut("#pjdet{", "</style>")), "no emoji in the panel, the cards or the v385 code and CSS (the pre-existing star glyphs of the my-developer button are not touched)");
ok(/id=pdx aria-label="Close project details"/.test(p1) && els.pdx === undefined, "a close button with a name");
const fromEl = mkEl("from"); P.pdOpen(dkOf(cards.notyet), fromEl); P.pdClose();
ok(els.pjdet.style.display === "none" && fromEl.focused === true, "closing hides the panel and returns focus to the card");
P.pdOpen(dkOf(cards.notyet), null); keys.forEach((f) => f({ key: "Escape" }));
ok(els.pjdet.style.display === "none", "Escape closes it");
ok(!/lat|lng|lon|center|coordinates/i.test(text(open("notyet"))) && /function pjPlotHook\(d\)\{return typeof PLOTPOS!=="undefined"\?PLOTPOS\.rows\(d\.ev,pdRow\):""\}/.test(js), "no position is drawn or stated without plot data; the v386 plot-centre hook answers empty when PLOTPOS is absent (v386 replaced the empty v385 hook)");

console.log("D - the snapshot and the 'Show on the map' path are unchanged");
const feats = P.pjFeatures(false);
ok(feats.length === 1 && feats[0].properties.key === "dist|towerone", "only the project with a real footprint is drawn on the map (no invented position)", JSON.stringify(feats.map((f) => f.properties.key)));
ok(P.pjFeatures(true).length === 1, "and one pin");
ok(P.locate("dist", "Not Yet Tower") === null && P.locate("dist", "Built Tower") === null && P.locate("dist", "Tower One").length === 1, "locate() is unchanged: names only, no match for the unbound ones");
ok(js.includes('var k=b.getAttribute("data-pj"),dk=b.getAttribute("data-dk");if(dk&&PJ[k])PJ[k].dk=dk;focusProject(k.split("|")[0],k)'), "tapping a located card still calls focusProject(slug,key)");
ok(js.includes('showSnap(Object.assign({key:key},info),true)'), "focusProject still opens the pinned snapshot");
els.bsnap = mkEl("bsnap"); P.showSnap(Object.assign({ key: "dist|towerone" }, P.PJ["dist|towerone"]), true);
const st = text(els.bsnap.innerHTML);
ok(/Project details/.test(st) && /Registered developer\s+FIXTURE DEVELOPMENT L\.L\.C/.test(st) && /Tower One/.test(st) && els.bsnap.className === "pin", "the pinned snapshot has a 'Project details' section (same component) and takes taps");
ok(!/Map position/.test(st), "a located project does not say why it has no position");
P.showSnap(Object.assign({ key: "dist|towerone" }, P.PJ["dist|towerone"]), false);
ok(!/Project details/.test(els.bsnap.innerHTML) && els.bsnap.className === "", "a hover tooltip stays small (no details, no pointer capture)");

console.log("E - the whole page");
let parses = true; try { new Function(js); } catch (e) { parses = e.message; }
ok(parses === true, "the page script parses", parses);
const css = html.slice(html.indexOf("<style"), html.indexOf("</style>"));
ok(/\.pjc\.noloc\{[^}]*min-height:44px/.test(css) && /\.pjc\.loc\{min-height:44px\}/.test(css) && /\.pdh button\{[^}]*min-height:44px/.test(css), "44 px tap targets on both card kinds and the close button");
const base = css.slice(css.indexOf("#pjdet{"), css.indexOf("@media(min-width:761px){#pjdet"));
ok(/left:0;right:0;bottom:0/.test(base) && !/[^-]width:\d+px/.test(base) && /max-height:78vh;overflow:auto/.test(base) && /@media\(min-width:761px\)\{#pjdet\{[^}]*width:420px/.test(css), "375 px: the panel is a full-width bottom sheet that scrolls; the 420 px width exists only from 761 px up");
ok(/\.pdr\{[^}]*overflow-wrap:anywhere/.test(css) && /\.pdr>div\{min-width:0\}/.test(css), "long names and legal entities wrap instead of overflowing");
ok(/\.pjc\.noloc\{opacity:\.7/.test(css) && /\.pjc\.loc\{display:block;width:100%/.test(css), "the muted style of a no-position card and the gold style of a located one are both kept");
ok(!/<div class="pjc noloc"/.test(js), "the page script no longer builds the div version");
ok(["lockchips", "id=aopen", "fbar", "chipdev"].every((s) => js.includes(s)), "the v371 lock chips and the v380 filter bar code are untouched");
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
