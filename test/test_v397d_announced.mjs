// v397d - PROJECTS THE DEVELOPER ANNOUNCES THAT ARE IN NO REGISTER. Offline: the built files, hand-worked fixtures, a stubbed browser; no network, no KV, no deploy.
//   node test/test_v397d_announced.mjs
import fs from "node:fs";
import { devmapHtml } from "../src/devmap_page.js";
import { DM } from "../scripts/build_devmap_index.mjs";
import { PHOSPHOR_LIGHT } from "../src/devmap_icons.js";
import { NOSALES_JS } from "../src/nosales_page.js";
import { ANNOUNCED_JS } from "../src/announced_page.js";
import { PLOTPOS_JS } from "../src/plotpos_page.js";
import { cleanAnnounced, mergeSearchItems } from "../src/announced.js";
import { mergePlots } from "../src/nosales.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const FILE = JSON.parse(rd("../data/announced/announced.json"));
const SRCH = JSON.parse(rd("../data/search_extra/announced_search.json"));
const csvRows = (t) => t.replace(/^﻿/, "").trim().split("\n").slice(1).map((l) => l.split(",")); // first columns only (project, developer, rule)
const MATCHED = csvRows(rd("../data/announced/announced_matched.csv"));
const all = []; for (const dev of Object.keys(FILE.d)) for (const ds of Object.keys(FILE.d[dev])) for (const e of FILE.d[dev][ds]) all.push({ dev, ds, e });
const nk = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

console.log("A - the builder's file");
{
  const m1 = MATCHED.find((r) => r[2].startsWith("M1")), m2 = MATCHED.find((r) => r[2].startsWith("M2"));
  ok(m1 && m2, "the matched list holds a registered project matched by exact name + developer and one matched by the source's register binding", JSON.stringify([m1, m2]));
  ok(!all.some((x) => nk(x.e.n) === nk(m1[0]) && nk(x.e.dn) === nk(m1[1])) && !all.some((x) => nk(x.e.n) === nk(m2[0])), "matched projects (" + m1[0] + ", " + m2[0] + ") are NOT in the announced file");
  ok(MATCHED.length === FILE.meta.matched && MATCHED.length > 100, "matched count " + MATCHED.length + " is the one the file states");
  ok(all.length === FILE.meta.count && all.length === FILE.meta.shown && all.length > 200, "the file holds " + all.length + " announced projects and says so");
  ok(all.every((x) => x.e.e === "DEVELOPER_CLAIMED"), "every entry is DEVELOPER_CLAIMED");
  ok(all.every((x) => !("p" in x.e) && !("pp" in x.e) && !("sales" in x.e) && !("ppsm" in x.e) && !("key" in x.e)), "no entry carries a project number, a position, a sales or a price field");
  ok(all.every((x) => x.e.n && x.e.dn && (x.e.f || x.e.t)), "every entry has a name, a developer and a page date");
  ok(all.filter((x) => x.e.t === "p").every((x) => /^https?:\/\//.test(x.e.url || "")), "every web-page entry carries its URL");
  ok(fs.statSync(new URL("../data/announced/announced.json", import.meta.url)).size < 250 * 1024, "under 250 KB");
  ok(!EMOJI.test(JSON.stringify(FILE)) && !EMOJI.test(JSON.stringify(SRCH)), "no emoji in the data");
  ok(FILE.meta.label === "Announced by the developer, not yet registered", "the label text is the agreed one");
  ok(Object.keys(FILE.d).some((k) => k === "emaar") && !Object.keys(FILE.d).some((k) => k.startsWith("~")) === (FILE.meta.without_profile === 0), "developer keys are index slugs; '~name' keys only for developers without a profile");
}

console.log("B - the server: clean, search merge");
{
  const c = cleanAnnounced(JSON.parse(JSON.stringify(FILE)));
  ok(c && c.meta.count === all.length, "cleanAnnounced keeps a valid file whole");
  ok(cleanAnnounced(null) === null && cleanAnnounced({}) === null && cleanAnnounced({ d: { x: { y: [{ n: "A", e: "REGISTER_VERIFIED" }] } } }) === null && cleanAnnounced({ d: { x: { y: [{ n: "", e: "DEVELOPER_CLAIMED" }] } } }) === null, "absent, malformed or any other label = null");
  const dirty = cleanAnnounced({ d: { x: { _: [{ n: "A", e: "DEVELOPER_CLAIMED", p: 1234, pp: { lon: 55, lat: 25 }, sales: 3, ppsm: 9 }] } } });
  ok(dirty && Object.keys(dirty.d.x._[0]).sort().join() === "e,n", "a project number, position, sales or price field is stripped on the way out");
  const idx = JSON.stringify({ generated: "x", n: 2, items: [{ n: "Existing Tower", t: "building" }, { n: SRCH.items[0].n, t: "development", dev: SRCH.items[0].dev }] });
  const mg = JSON.parse(mergeSearchItems(idx, JSON.stringify(SRCH)));
  ok(mg.items[0].n === "Existing Tower" && mg.items.length === 2 + SRCH.items.length - 1 && mg.n === mg.items.length, "the index order is kept; an item already there (same name and developer) is not duplicated; n is updated");
  ok(mg.items.slice(2).every((i) => i.ann === 1 && i.t === "development"), "added items are flagged ann:1 developments");
  ok(mergeSearchItems(idx, null) === null && mergeSearchItems(null, JSON.stringify(SRCH)) === null && mergeSearchItems(idx, JSON.stringify({ items: [] })) === null, "no extra, no index or nothing new: null (the caller serves the index untouched)");
  ok(SRCH.items.length === all.length && SRCH.features.length === 0, "one search item per announced project; no plot feature (no position is ever invented)");
  const plots = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [55.3, 25.1] }, properties: { plot: "1-1", name: "A", district: "d" } }] });
  const ex1 = JSON.stringify(JSON.parse(rd("../data/search_extra/search_extra.json")));
  const step1 = mergePlots(plots, ex1), step2 = mergePlots(step1 || plots, JSON.stringify(SRCH));
  ok(step1 && JSON.parse(step1).features.length > 1 && step2 === null, "img_search_extra merges, then the announced key adds nothing to plots (it holds no features) and returns null");
  const idxjs = rd("../src/index.js");
  ok(/nm === "plots" \|\| nm === "search_index"/.test(idxjs) && /readSearchExtra\(env\.MEETINGS\)/.test(idxjs) && /mergeSearchIndex\(_pt, _xtra\)/.test(idxjs) && /get\(SEARCH_EXTRA_ANNOUNCED_KV\)/.test(idxjs) && /mergeSearchItems\(_pt, _ax\)/.test(idxjs), "the worker merges BOTH img_search_extra (v397b parts and sx) and img_search_extra_announced, in that order, for plots and search_index");
  ok(/if\(r\.ann\)w\.push\(r\.od\?[\s\S]*?r\.lw\?"listed by the developer, no register entry found":"announced by the developer, not yet registered"\)/.test(idxjs), "the Find row says 'announced ... not yet registered' or, for a listed project, 'listed by the developer, no register entry found'");
  ok(SRCH.items.filter((i) => i.lw === 1).length === FILE.meta.listed_wording && FILE.meta.listed_wording > 0, "the search items carry the same listed flag as the data (" + FILE.meta.listed_wording + ")");
  const lwItem = SRCH.items.find((i) => i.lw === 1), mg2 = JSON.parse(mergeSearchItems(JSON.stringify({ items: [] }), JSON.stringify({ items: [lwItem] })));
  ok(mg2.items[0].lw === 1 && mg2.items[0].ann === 1, "the merge keeps the listed flag");
  const lwAll = all.filter((x) => x.e.lw);
  ok(lwAll.length === FILE.meta.listed_wording && lwAll.every((x) => /\b(20\d\d)\b/.test(x.e.ho || "") && Number((x.e.ho.match(/\b(20\d\d)\b/) || [])[1]) <= 2025 || /\b(hotel|resort|mall|staff accommodation)\b/i.test(x.e.n)), "listed wording only for handover 2025 or earlier, or a hotel / resort / mall / staff-accommodation name");
  ok(all.filter((x) => !x.e.lw).every((x) => !/\b(hotel|resort|mall|staff accommodation)\b/i.test(x.e.n) && !(x.e.ho && Number((String(x.e.ho).match(/\b(20\d\d)\b/) || [])[1]) <= 2025)), "every other entry keeps the 'announced, not yet registered' wording");
}

console.log("C - the page");
{
  const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
  const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
  const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
  let parses = true; try { new Function(js); } catch (e) { parses = false; console.log(String(e)); } ok(parses, "the whole page script parses");
  ok(!EMOJI.test(ANNOUNCED_JS) && !EMOJI.test(rd("../src/announced.js")), "no emoji in the new code");
  ok(!/\$\{|`/.test(ANNOUNCED_JS), "the new module has no backtick or substitution (String.raw)");
  ok(/h\+=nsHtml\(k\);h\+=anHtml\(k\);/.test(js) && /if\(!p\.areas\)return h\+nsHtml\(k\)\+anHtml\(k\)\+/.test(js), "the group sits after 'Registered, no unit sales yet'; a developer with no priced area gets it too");
  ok(/typeof ANNOUNCED==="undefined"\)return ""/.test(js) && /api\("announced"\)\.catch/.test(js) && /e\.an&&typeof ANNOUNCED!=="undefined"/.test(js), "every hook is guarded (absent file = v395)");
  const core = rd("../src/devmap_core.js");
  ok(!/ANNOUNCED|announced/i.test(core) && !/ANNOUNCED|announced/i.test(rd("../scripts/build_devmap_index.mjs")), "the numbers (core and index builder) never read the file: not in totals, price bands or scale");
  const text = (h) => h.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&middot;/g, "-").replace(/\s+/g, " ").trim();
  DM.TIER_CFG.bounds = [30000, 20000, 12000];
  const IDX = { as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] }, devs: { emaar: { name: "Emaar", areas: 1, n: 40, profile: { projects: 2, homes: 0 } } }, areas: {
    alkhairanfirst: { name: "Dubai Creek Harbour", comms: [], devs: { emaar: { n: "Emaar", h: 0, c: [[40, 21000, 1e6, 1]], b: [[10, 21000, "Creek Palace"]], r: [] } } },
    alyufrah1: { name: "The Valley", devs: {} } } };
  const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
  const body = NOSALES_JS + ANNOUNCED_JS + PLOTPOS_JS + "var $=function(id){return document.getElementById(id)};var KEY=\"k\";var fetch=function(){return new Promise(function(){})};" + s0 + s1
    + cut("function clipName", "function devHead(") + cut("function icoSvg", "function evidenceHtml")
    + cut("var BLK={}", "var PULSE=0") + cut("function showSnap(p,pin)", "function focusProject") + cut("function tipHtml", "function drillHtml")
    + cut("function nsHtml", "// v375 - DELIVERY RECORD card") + cut("function pdfUrl", "function invProjRow")
    + "; return {pdOpen:pdOpen,PDET:PDET,nsHtml:nsHtml,anHtml:anHtml,invIndex:invIndex,ANNOUNCED:ANNOUNCED,BLK:BLK};";
  const mkEl = (id) => ({ id, innerHTML: "", style: {}, className: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() {} });
  const els = {}, doc = { getElementById: (i) => els[i] || null, createElement: () => mkEl(""), body: { appendChild: (e) => { els[e.id] = e; } }, addEventListener: () => {} };
  const S = { evOpen: false, sel: "alkhairanfirst", unit: "sqft", win: "all", inv: null, mode: "buy", bud: {}, screen: 1, parea: null };
  const map = { getSource: () => null, flyTo() {}, isStyleLoaded: () => false };
  const P = new Function("DM", "IDX", "S", "TC", "document", "renderDetail", "updatePj", "EVI", "innerWidth", "map", "setSheet", body)(DM, IDX, S, ["#c5a56a"], doc, () => {}, () => {}, PHOSPHOR_LIGHT, 1200, map, () => {});
  const emaar = all.filter((x) => x.dev === "emaar"), inCh = emaar.filter((x) => x.ds === "alkhairanfirst");
  ok(emaar.length > 50 && inCh.length >= 1, "fixture: Emaar has " + emaar.length + " announced projects, " + inCh.length + " in Dubai Creek Harbour");
  ok(P.anHtml("emaar") === "", "no data loaded: the group is empty (v395 page)");
  P.ANNOUNCED.load(cleanAnnounced(JSON.parse(JSON.stringify(FILE))));
  const g = P.anHtml("emaar");
  ok(/<details class="card nconf announced" id=announced>/.test(g) && !/<details[^>]*\bopen\b/.test(g), "the group is a collapsed details element");
  ok(text(g).startsWith("Announced by the developer, not yet registered (" + emaar.length + ")"), "titled 'Announced by the developer, not yet registered (N)' with the count", text(g).slice(0, 120));
  ok((g.match(/class="pjc /g) || []).length === emaar.length, "one card per announced project of THAT developer");
  ok(/not on any register we hold/i.test(text(g)) && /not in the totals/i.test(text(g)) && !/Register project number|AED/.test(text(g)), "cards say 'not on any register we hold'; no project number, no price");
  ok(P.anHtml("nobody") === "" && P.anHtml("fakhruddin") !== "" === (all.some((x) => x.dev === "fakhruddin")), "another developer sees only its own");
  S.parea = "alkhairanfirst"; const g2 = P.anHtml("emaar");
  ok((g2.match(/class="pjc /g) || []).length === inCh.length && /\(\d+\)/.test(text(g2)), "an area card selected: filtered to that area (" + inCh.length + " of " + emaar.length + "); projects with no stated area are left out");
  S.parea = null;
  const plain = emaar.find((x) => !x.e.lw && !x.e.pm && !x.e.od).e.n.replace(/&/g, "&amp;");
  const m = g.match(new RegExp('<button[^>]*data-pd="([^"]+)"[^>]*aria-label="Project details for ' + plain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"')); ok(m, "each card is a button that opens Project details");
  P.pdOpen(m[1], mkEl("f")); const t = text(els.pjdet.innerHTML);
  ok(/Announced by the developer, not yet registered/.test(t) && /DEVELOPER_CLAIMED/.test(t) && /developer says it is by/i.test(t), "panel: the developer-says label and the DEVELOPER_CLAIMED tag");
  ok(/Not on any register we hold/.test(t) && !/Register project number [0-9]/.test(t) && !/PN[0-9]/.test(t), "panel: 'not on any register we hold', never a project number");
  ok(/Source: The developer's own web page \(emaar\.com\), page date 2026-09-07/.test(t), "panel: the source line with the page date", t);
  ok(/Not counted/.test(t) && !EMOJI.test(els.pjdet.innerHTML) && !EMOJI.test(g), "panel: not counted; no emoji");
  // listed wording: a completed / non-residential entry says so on its card and in its panel, and is still outside the numbers
  const lwDev = all.find((x) => x.e.lw && !x.e.pm && !x.e.od), nlw = all.filter((x) => x.dev === lwDev.dev);
  const lwFx = { meta: { built: "x", count: 2 }, d: { [lwDev.dev]: { _: [lwDev.e, Object.assign({}, nlw.find((x) => !x.e.lw && !x.e.pm && !x.e.od).e)] } } };
  P.ANNOUNCED.load(cleanAnnounced(JSON.parse(JSON.stringify(lwFx))));
  const gl = P.anHtml(lwDev.dev);
  ok(/Listed, no register entry found, not on any register we hold/.test(text(gl)) && /Announced, not on any register we hold/.test(text(gl)), "mixed group: the listed card and the announced card each carry their own wording");
  ok(text(gl).startsWith("Announced by the developer, not yet registered (2)"), "mixed group keeps the main title");
  const lwName = lwDev.e.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m3 = gl.match(new RegExp('data-pd="([^"]+)"[^>]*aria-label="Project details for ' + lwName.replace(/&/g, "&amp;")));
  ok(m3, "the listed card is a button");
  if (m3) { P.pdOpen(m3[1], mkEl("f")); const t3 = text(els.pjdet.innerHTML); ok(/^Listed by the developer, no register entry found/.test(t3.replace(/^.*?Project details\s*/, "")) || /Listed by the developer, no register entry found/.test(t3), "listed panel: 'Listed by the developer, no register entry found'"); ok(/DEVELOPER_CLAIMED/.test(t3) && !/Register project number [0-9]/.test(t3) && /Not counted/.test(t3), "listed panel: still DEVELOPER_CLAIMED, no project number, not counted"); }
  P.ANNOUNCED.load(cleanAnnounced(JSON.parse(JSON.stringify({ meta: { built: "x", count: 1 }, d: { [lwDev.dev]: { _: [lwDev.e] } } }))));
  ok(text(P.anHtml(lwDev.dev)).startsWith("Listed by the developer, no register entry found (1)"), "a group of listed projects only takes the listed title");
  P.ANNOUNCED.load(cleanAnnounced(JSON.parse(JSON.stringify(FILE))));
  const pn = Object.values(P.PDET).every((d) => d.ev && d.ev.p === null && d.ev.e === "DEVELOPER_CLAIMED");
  ok(pn, "every card record is DEVELOPER_CLAIMED with no project number");
}
console.log("D - the accounting: every candidate in exactly one bucket");
{
  const parse = (t) => t.replace(/^﻿/, "").trim().split(/\r?\n/).slice(1).map((l) => { const m = l.match(/^(c\d+),([^,]*),(".*?"|[^,]*),(.*),(matched|shown-outside-Dubai|shown-possible-match|shown|skipped-duplicate|skipped-malformed),(.*)$/); return m ? { id: m[1], bucket: m[5] } : null; });
  const rows = parse(rd("../data/announced/announced_accounting.csv"));
  ok(rows.every(Boolean), "every accounting row parses");
  const ids = new Set(rows.map((r) => r.id));
  ok(rows.length === FILE.meta.candidates && ids.size === rows.length && FILE.meta.candidates === 673, "673 candidates, each listed once in announced_accounting.csv (" + rows.length + ", " + ids.size + " distinct)");
  const cnt = {}; for (const r of rows) cnt[r.bucket] = (cnt[r.bucket] || 0) + 1;
  const sum = Object.values(cnt).reduce((a, b) => a + b, 0);
  ok(sum === 673 && Object.keys(cnt).every((k) => ["matched", "shown", "shown-outside-Dubai", "shown-possible-match", "skipped-duplicate", "skipped-malformed"].includes(k)), "the six buckets sum to 673 and there is no other bucket", JSON.stringify(cnt));
  const srt = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
  ok(srt(cnt) === srt(FILE.meta.buckets), "the file's own bucket counts equal the accounting file", JSON.stringify([cnt, FILE.meta.buckets]));
  ok(cnt.matched === MATCHED.length, "matched bucket equals announced_matched.csv (" + MATCHED.length + ")");
  ok(cnt.shown + cnt["shown-outside-Dubai"] + cnt["shown-possible-match"] === all.length, "every shown bucket is in the announced file and nothing else is (" + all.length + ")");
  ok(all.filter((x) => x.e.od).length === cnt["shown-outside-Dubai"] && all.filter((x) => x.e.pm).length === cnt["shown-possible-match"], "outside-Dubai entries carry od, possible-match entries carry pm");
  ok(all.filter((x) => x.e.od).every((x) => x.ds === "_" && !x.e.a), "outside-Dubai entries have no district and no area");
  ok(all.filter((x) => x.e.pm).every((x) => x.e.pm.n && /^(PN\d+|[A-Za-z0-9_-]+)$/.test(x.e.pm.k)), "possible-match entries name the register project and its number");
  const sk = rd("../data/announced/announced_skipped.csv").trim().split("\n").length - 1;
  ok(sk === cnt["skipped-duplicate"] + cnt["skipped-malformed"], "announced_skipped.csv lists every skipped candidate with its reason (" + sk + ")");
  // pages for outside-Dubai and possible-match entries (labels and panels)
  const odE = all.find((x) => x.e.od), pmE = all.find((x) => x.e.pm);
  const lab = { od: "Announced by the developer, outside Dubai: " + odE.e.od, pm: "Listed by the developer; the register holds a project with this name but we could not confirm it is the same one" };
  const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
  const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
  const A = new Function(ANNOUNCED_JS + "; return ANNOUNCED;")();
  A.load(cleanAnnounced({ meta: { built: "x" }, d: { x: { _: [odE.e, pmE.e] } } }));
  const cards = []; const api = { esc: (s) => String(s), pjCard: (slug, n, a, b, extra) => { cards.push(n + " :: " + extra); return "<button>" + n + "</button>"; }, areaNames: () => [], BLK: {} };
  const grp = A.html("x", null, api);
  ok(/Announced by the developer, not yet registered \(2\)/.test(grp.replace(/<[^>]*>/g, "")), "a mixed group keeps the main title");
  ok(cards.some((c) => c.includes("Announced, outside Dubai: " + odE.e.od)) && cards.some((c) => c.includes("Listed, the register holds a project with this name")), "the cards carry the outside-Dubai place and the register-holds-a-project wording");
  const pr = (ic, l, v, s, t) => "[" + l + ": " + v + " | " + s + " | " + t + "]", ps = (ic, t, r) => "<sec>" + t + r + "</sec>";
  const dOd = A.detail({ ev: { ann: odE.e } }, { pdRow: pr, pdSec: ps, esc: (s) => String(s), icoSvg: () => "" }), dPm = A.detail({ ev: { ann: pmE.e } }, { pdRow: pr, pdSec: ps, esc: (s) => String(s), icoSvg: () => "" });
  ok(dOd.includes(lab.od) && /Outside Dubai: /.test(dOd) && /no district, no map position/.test(dOd) && /DEVELOPER_CLAIMED/.test(dOd), "outside-Dubai panel: 'Announced by the developer, outside Dubai: <place>', no district, no map position");
  ok(dPm.includes(lab.pm) && dPm.includes(pmE.e.pm.n) && dPm.includes(pmE.e.pm.k) && /We could not confirm it is the same one/.test(dPm) && !/Not on any register we hold/.test(dPm), "possible-match panel: the agreed wording, the register project name and number as a plain line, no 'not on any register'");
  const odS = SRCH.items.filter((i) => i.od === 1).length, pmS = SRCH.items.filter((i) => i.pm === 1).length;
  ok(odS === cnt["shown-outside-Dubai"] && pmS === cnt["shown-possible-match"], "the search items carry the od and pm flags");
  const idxjs = rd("../src/index.js");
  ok(/r\.od\?"announced by the developer, outside Dubai":r\.pm\?"listed by the developer; the register holds a project with this name"/.test(idxjs), "the Find row wording covers outside-Dubai and possible-match items");
  ok(!EMOJI.test(grp + dOd + dPm) && !EMOJI.test(rd("../data/announced/announced_accounting.csv")), "no emoji");
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
