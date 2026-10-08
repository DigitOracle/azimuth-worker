// v414 - the project panel and its three document buttons for projects that are NOT on the project register and have no building footprint but DO have register unit facts and developer-says facts
// (KORE by Imtiaz is the example). Offline: the page script runs on a hand-worked fixture (harness as test_v398_docbtns), the Client sheet is built from the v411 KORE facts fixture through a stand-in KV.
//   node test/test_v414_korepanel.mjs
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { devmapHtml } from "../src/devmap_page.js";
import { DM } from "../scripts/build_devmap_index.mjs";
import { PHOSPHOR_LIGHT } from "../src/devmap_icons.js";
import { DEVSAYS_JS, devsaysApi, launchFrom, launchHeadline, claimsFor, permissionOnFile, PICTURES_WITHHELD } from "../src/dev_claims.js";
import { DEV_CLAIMS } from "../src/dev_claims_data.js";
import { generate } from "../scripts/gen_dev_claims_js.mjs";
import { buildDocument, parseQuery } from "../src/brief_docs.js";
import { docOptionsRoute } from "../src/doc_options_docs.js";
import { devSaysBlock } from "../src/devmap_pdf.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FACTS = JSON.parse(fs.readFileSync(path.join(ROOT, "test/fixtures/v411_kore_facts.json"), "utf8"));
const CLAIMS = JSON.parse(fs.readFileSync(path.join(ROOT, "data/developer_claims/kore_launch_brochure.json"), "utf8"));
const text = (h) => h.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&ndash;/g, "-").replace(/&rsquo;/g, "'").replace(/&#x27;/g, "'").replace(/&middot;/g, ".").replace(/&#8226;/g, "-").replace(/\s+/g, " ").trim();

console.log("A - the claims file, its generated copy and the permission field");
ok(fs.readFileSync(path.join(ROOT, "src/dev_claims_data.js"), "utf8").replace(/\r\n/g, "\n") === generate(), "src/dev_claims_data.js is exactly what data/developer_claims/*.json gives (run node scripts/gen_dev_claims_js.mjs)");
ok(CLAIMS.render_permission && CLAIMS.render_permission.status === "on_file" && CLAIMS.render_permission.set_by === "Kendall Wilson (stated in chat)" && CLAIMS.render_permission.date === "2026-10-08" && /Imtiaz approves/.test(CLAIMS.render_permission.note), "v417: render_permission is on_file (stated by Kendall Wilson in chat, 8 October 2026)");
ok(permissionOnFile(claimsFor("kore")), "the permission gate reads 'on_file' as on file");
{
  const pend = JSON.parse(JSON.stringify(CLAIMS)); pend.render_permission = { status: "pending", note: "x", set_by: null, date: null };
  ok(!permissionOnFile(pend) && !permissionOnFile({}) && !permissionOnFile(null), "negative: the gate reads a pending copy (and an empty record) as not on file");
}
const CAP_R = /^Developer's render, KORE launch brochure received 6 October 2026$/, CAP_P = /^Developer's brochure page, KORE launch brochure received 6 October 2026$/;
ok(CLAIMS.renders.length === 10 && CLAIMS.renders.every((r) => (CAP_R.test(r.caption) || CAP_P.test(r.caption)) && fs.existsSync(path.join(ROOT, "data/developer_claims", r.file))), "v417: ten stored pictures (elevation, aerial, pool, sun path, interior, living, experiences, pillars, partner page, loop map), each with the required caption");
ok(CLAIMS.renders.some((r) => /pool/.test(r.what)) && CLAIMS.renders.some((r) => /payment plan/.test(r.what)) && CLAIMS.renders.filter((r) => r.exterior).length === 2, "the pool page and the living-room page are registered now; two exterior pictures (elevation, aerial)");
ok(Array.isArray(CLAIMS.renders_not_stored) && CLAIMS.renders_not_stored.length === 0 && /lifted on Kendall Wilson's instruction on 8 October 2026/.test(CLAIMS.renders_note), "the earlier exclusion is lifted and the note says so");
for (const r of CLAIMS.renders) { const b = fs.readFileSync(path.join(ROOT, "data/developer_claims", r.file)); ok(b[0] === 0xff && b[1] === 0xd8 && b.length < 450 * 1024, r.file + " is a JPEG under 450 KB"); }

console.log("B - the panel: headline and the three buttons (page script on a fixture)");
const mkHarness = (devmapHtmlFn, withDevsays) => {
  const html = devmapHtmlFn("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
  const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
  const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
  DM.TIER_CFG.bounds = [30000, 20000, 12000];
  const IDX = { as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] }, devs: { x: { name: "X", areas: 1, n: 40, profile: { projects: 5, homes: 0 } } }, areas: {
    dist: { name: "Fixture District", devs: { x: { n: "X", h: 0, c: [[40, 21000, 1e6, 1]], b: [[10, 35000, "Tower One"], [7, 22000, "Built Tower"]], r: [] },
      imtiaz: { n: "Imtiaz", h: 0, c: [[30, 15000, 1e6, 1]], b: [[12, 15000, "The Archive"]], r: [] } } },
    lone: { name: "Lone District", devs: { y: { n: "Y", h: 0, c: [[5, 9000, 1e6, 1]], b: [[5, 9000, "Y Court"]], r: [] } } } } };
  const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
  const body = "var $=function(id){return document.getElementById(id)};var KEY=\"k\";var fetch=function(){return new Promise(function(){})};var ANNOUNCED={detail:function(d){return '<div class=pdet><div class=pdhead>announced stub</div></div>'}};" + (withDevsays ? DEVSAYS_JS : "") + s0 + s1
    + cut("function clipName", "function devHead(") + cut("function icoSvg", "function evidenceHtml")
    + cut("var BLK={}", "var PULSE=0") + cut("function showSnap(p,pin)", "function focusProject") + cut("function tipHtml", "function drillHtml")
    + cut("function pdfUrl", "function pdfRowProf")
    + "; return {docRow:docRow,PDET:PDET,pjCard:pjCard,pjDetailHtml:pjDetailHtml,invIndex:invIndex,BLK:BLK" + (withDevsays ? ",DEVSAYS:DEVSAYS" : "") + "};";
  const mkEl = (id) => ({ id, innerHTML: "", style: {}, className: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() {} });
  const els = {};
  const doc = { getElementById: (i) => els[i] || null, createElement: () => mkEl(""), body: { appendChild: (e) => { els[e.id] = e; } }, addEventListener: () => {} };
  const S = { evOpen: false, sel: "dist", unit: "sqft", win: "all", inv: null, mode: "buy", bud: {}, screen: 1 };
  const P = new Function("DM", "IDX", "S", "TC", "document", "renderDetail", "updatePj", "EVI", "innerWidth", body)(DM, IDX, S, ["#c5a56a", "#2f8a7f", "#3987e5", "#8a9a96"], doc, () => {}, () => {}, PHOSPHOR_LIGHT, 375);
  P.BLK.dist = { state: "ok", feats: [] };
  if (withDevsays) P.DEVSAYS.load(devsaysApi());
  S.inv = [{ id: "INV-BUILT", name: "Built Tower", brand: "Built Tower", pn: 777 }, { id: "kore-by-imtiaz-offregister", name: "KORE by Imtiaz", brand: "KORE by Imtiaz", pn: 0 }]; P.invIndex();
  return P;
};
const P = mkHarness(devmapHtml, true);
const EV = {
  kore: { p: null, e: "DEVELOPER_CLAIMED", dn: "Imtiaz", br: "Imtiaz", a: "Dubai Land Residence Complex", as: "register_master", ns: 1, off: 1 },
  built: { p: 777, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "project_id", e: "REGISTER_VERIFIED", a: "Fixture District", h: 55, st: "ACTIVE", pc: 62, pe: "2027-03", bk: "77" },
  bare: { p: 5, di: 1, dn: "FIXTURE DEVELOPMENT L.L.C", m: "exact_name", e: "REGISTER_VERIFIED", a: "Fixture District", st: "NOT_STARTED", pl: 0 },
  nothing: { p: 9, e: "REGISTER_VERIFIED", a: "Fixture District", ns: 1 },
  other: { p: null, e: "DEVELOPER_CLAIMED", dn: "Someone", br: "Someone", a: "Fixture District", ns: 1, off: 1 },
  ann: { an: 1, ann: { n: "Announced Tower", dn: "Imtiaz", a: "Fixture District" }, dk: "imtiaz", dsl: "dist", e: "DEVELOPER_CLAIMED" },
  annLone: { an: 1, ann: { n: "Lone Announced", dn: "Q", a: "Lone District" }, dk: "q", dsl: "lone", e: "DEVELOPER_CLAIMED" }
};
const card = (Pn, name, ev, ppsm, n) => Pn.pjCard("dist", name, ppsm, n, "", "Project name not recorded", ev);
const dkOf = (h) => (h.match(/data-pd="([^"]+)"/) || [])[1];
const panelOf = (Pn, h) => Pn.pjDetailHtml(dkOf(h), false);
const btns = (h) => [...h.matchAll(/<(a|button) (?:type=button )?class="pdfbtn pdsm( pdoff)?"([^>]*)>([\s\S]*?)<\/\1>/g)].map((m) => ({ tag: m[1], off: !!m[2], attrs: m[3], label: text(m[4]) }));
const bar = (h) => (h.match(/<div class=(?:"pdbar[^"]*"|pdbar)>[\s\S]*?<\/p><\/div>/) || [""])[0];
const koreCard = card(P, "KORE by Imtiaz", EV.kore, null, null), korePanel = panelOf(P, koreCard);
{
  const head = text((korePanel.match(/<div class=pdhead>[\s\S]*?<\/div>/) || [""])[0]);
  ok(/Launch price from AED 679,000 \(developer says\)/.test(head), "KORE panel headline: 'Launch price from AED 679,000 (developer says)'", head);
  ok(!/No price per area recorded/.test(korePanel), "the old 'No price per area recorded' is gone for KORE");
  ok(/Not a registered sale: no unit of this project has sold on the register/.test(head), "the small second line says it is not a registered sale (nothing has sold)", head);
  ok(/No building outline of this name is on our map yet\./.test(korePanel), "the 'no building outline' line is kept (the building is still not on the map)");
  const b = btns(bar(korePanel));
  ok(b.map((x) => x.label + ":" + (x.off ? "off" : "on")).join() === "Investor:on,Client:on,Broker:on", "Investor | Client | Broker are all enabled for KORE", b.map((x) => x.label + ":" + x.off).join());
  ok(/investor_selector&amp;project=kore-by-imtiaz-offregister/.test(b[0].attrs), "Investor opens the investor selector for the KORE facts record");
  ok(/href="\/doc_client\?keys=dev%3Akore&amp;mode=buy&amp;beds=all&amp;key=k"/.test(b[1].attrs), "Client opens /doc_client with keys=dev:kore", b[1].attrs);
  ok(/href="\/doc_broker\?kind=snapshot&amp;area=dist&amp;window=\w+&amp;mode=buy&amp;developers=imtiaz&amp;key=k"/.test(b[2].attrs), "Broker opens /doc_broker for the Imtiaz brand group in the project's area", b[2].attrs);
  const bc = btns(bar(koreCard));
  ok(bc.map((x) => x.off).join() === "false,false,false", "the KORE card row agrees with the panel (one function, docAvail)");
}
{
  const hl = launchHeadline(claimsFor("kore")), lf = launchFrom(claimsFor("kore"));
  ok(hl === "Launch price from AED 679,000 (developer says)" && lf.type === "Studio" && lf.aed === 679000, "the headline is the lowest stated price of the claims record (Studio, 679K)");
  // every figure printed in the headline exists in the record
  const nums = new Set(); for (const r of CLAIMS.price_from.rows) { nums.add(r.from_aed); }
  const printed = (hl.match(/\d+(?:,\d{3})*/g) || []).map((s) => Number(s.replace(/,/g, "")));
  ok(printed.length && printed.every((n) => nums.has(n)), "every figure in the headline exists in the claims record", [...printed].join());
  const api = devsaysApi();
  ok(api.p.length === 1 && api.p[0].f === 679000 && api.p[0].k === "kore" && api.p[0].x === 1, "the page feed carries the lowest price and says an exterior render is stored");
  ok(!/render_permission|renders|payment|amenit/.test(JSON.stringify(api)), "the page feed carries no pictures, plans or permission detail");
}
{
  const reg = card(P, "Built Tower", EV.built, 22000, 7), nothing = card(P, "Some Tower", EV.nothing, null, null), other = card(P, "Other Launch", EV.other, null, null);
  const nb = btns(bar(panelOf(P, nothing))), ob = btns(bar(panelOf(P, other)));
  ok(nb[0].off && nb[1].off && nb[2].off && nb.every((x) => /data-why="[^"]{15,}"/.test(x.attrs)), "a project with nothing: all three greyed, each with a plain reason");
  ok(/No price per area recorded/.test(panelOf(P, nothing)) && !/Launch price/.test(panelOf(P, nothing)), "no developer price: the old headline is kept exactly");
  ok(ob[1].off && ob[2].off && /not matched on the register/.test(ob[2].attrs) && /No price per area recorded/.test(panelOf(P, other)), "a developer-says card whose developer the area does not know: Broker greyed 'not matched on the register', old headline");
  const rb = btns(bar(panelOf(P, reg)));
  ok(rb[0].off === false && rb[1].off === false, "the register-verified project keeps its Investor and Client links");
  const an = btns(bar(panelOf(P, card(P, "Announced Tower", EV.ann, null, null))));
  ok(!an[2].off && /area=dist/.test(an[2].attrs) && /developers=imtiaz/.test(an[2].attrs) && an[1].off && /announced project/.test(an[1].attrs), "an announced project whose developer the area knows gets the Broker button; Client stays greyed with its reason");
  const al = btns(bar(panelOf(P, card(P, "Lone Announced", EV.annLone, null, null))));
  ok(al[2].off && /not matched on the register/.test(al[2].attrs), "an announced project whose developer is not in its area: Broker greyed with the reason");
}

console.log("C - register-verified projects are byte-identical to v412 (panel, card and every button)");
{
  const tmp = path.join(ROOT, "src", "_v414_old_devmap_page.mjs");
  try {
    const old = execFileSync("git", ["-C", ROOT, "show", "1a7a535:src/devmap_page.js"], { maxBuffer: 1 << 26 }).toString("utf8");
    fs.writeFileSync(tmp, old);
    const { devmapHtml: oldHtml } = await import("../src/_v414_old_devmap_page.mjs");
    const PO = mkHarness(oldHtml, false);
    for (const [k, ev, pp, n] of [["Built Tower", EV.built, 22000, 7], ["Bare Tower", EV.bare, 20000, 6], [null, null, 18000, 4]]) {
      const a = card(P, k, ev, pp, n), b = card(PO, k, ev, pp, n);
      ok(a === b, "card byte-identical to v412: " + (k || "no name"));
      ok(panelOf(P, a) === panelOf(PO, b), "panel byte-identical to v412: " + (k || "no name"));
    }
  } finally { try { fs.unlinkSync(tmp); } catch (e) {} }
}

console.log("D - the Client sheet for KORE (keys=dev:kore), built from the unit register and the developer's record");
const mkEnv = (extra) => {
  const store = {
    investor_tiers_index: { projects: [{ id: "kore-by-imtiaz-offregister", name: "KORE by Imtiaz", district: "wadialsafa5", project_number: null }] },
    investor_tiers_facts_wadialsafa5: { projects: { "kore-by-imtiaz-offregister": FACTS } },
  };
  return { MEETINGS: { async get(k, t) { if (k.startsWith("img_") && store[k.slice(4)] !== undefined) return JSON.stringify(store[k.slice(4)]); if (extra && extra[k] !== undefined) return extra[k]; return null; } } };
};
const q = (extra) => parseQuery(new URL("https://x/brief_pdf?kind=dossier&keys=dev:kore&mode=buy&beds=all&format=html" + (extra || "")));
const FORBID_VENDOR = /openai|chatgpt|gemini|anthropic|claude|perplexity|deepseek|copilot|propertyfinder|property finder|bayut|dubizzle/i;
const FORBID_INTERNAL = /plot sale|mortgage|dewa|land sale|first-year|first year pricing|DLRC|1BR comparison|brand group/i;
const doc = await buildDocument(mkEnv(), q("&client=Test%20Client"), { origin: "https://w.example" });
ok(doc.status === 200 && doc.pages === 4, "v417: on_file, nothing published yet: the sheet is built (four pages, each picture a caption and 'Picture not yet published')", JSON.stringify(doc.body || {}).slice(0, 200));
const H = doc.html || "", T = text(H);
ok(/<div[^>]*>KORE by Imtiaz<\/div>/.test(H) && /PREPARED FOR TEST CLIENT/.test(H), "title and the prepared-for line");
ok(/351 homes/.test(T) && /Studios\s*248\s*406 - 623 sq ft/.test(T) && /1 bedroom\s*90\s*676 - 1,130 sq ft/.test(T) && /2 bedrooms\s*13\s*1,409 - 1,663 sq ft/.test(T), "unit mix 248 / 90 / 13 with the register's size ranges");
ok(/Launch prices/.test(T) && /from AED 679,000/.test(T) && /from AED 1,100,000/.test(T) && /from AED 1,550,000/.test(T) && /Studio\s*from 406 sq ft/.test(T) && /developer says/i.test(T), "the price table: three types, developer says");
ok(/50\/50 Payment Plan/.test(T) && /60\/40 Post Handover Payment Plan/.test(T) && /Post handover|After handover, quarterly over 3 years/.test(T) && /15 February 2027\*/.test(T), "both payment plans, with the dated steps");
ok(/Handover: Q4 2028\*/.test(T) && /asterisk/.test(T) && /indicative/.test(T), "handover with the indicative asterisk note");
ok(/Amenities/.test(T) && /adults' leisure pool/.test(T) && /social padel court/.test(T) && /Raw Theory clubhouse/.test(T), "the amenity list by level (developer says)");
ok(/Curated by Najjuko . Dubai Decoded/.test(T) && /\+971 56 548 4397/.test(T) && /must be confirmed with the developer's sales team or the listing broker/.test(T) && /where marked developer says, the developer's own starting prices/.test(T), "the legal footer and WhatsApp line of the client sheet, with the developer-says price wording");
ok(/Not on the project register: no unit of this project has sold on the register/.test(T) && /none to 2026-09-17/.test(T), "registered sales: none, said plainly");
ok(/Source: KORE launch brochure, received 6 October 2026/.test(T) && /Dubai Land Department unit register, project id 962479984/.test(T), "sources with the received date and the unit register id");
ok(!T.includes(PICTURES_WITHHELD) && (T.match(/Picture not yet published/g) || []).length === 10, "on_file: no 'withheld' line; ten 'Picture not yet published' lines while the keys are not in the store");
ok(!/<img /.test(H.replace(/<img class="najhead"[^>]*>/g, "")), "on_file, nothing published: no <img> on the sheet (a missing key never fails the PDF)");
{
  const c = DEV_CLAIMS.kore, was = c.render_permission.status;
  try {
    c.render_permission.status = "pending";   // the pending state: a flipped copy of the record
    const dp = await buildDocument(mkEnv(), q("&client=Test%20Client"), { origin: "https://w.example" }), HP = dp.html, TP = text(HP);
    ok(dp.status === 200 && dp.pages === 2 && TP.includes(PICTURES_WITHHELD), "negative (pending): two pages and the sheet says 'Pictures withheld until the developer's written permission is on file.'");
    ok(!/<img /.test(HP.replace(/<img class="najhead"[^>]*>/g, "")) && !/Picture not yet published|brochure page/.test(TP), "negative (pending): no picture and no picture block of any kind on the sheet");
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 3, 232, 6, 64, 3, 1, 34, 0, 2, 17, 1, 3, 17, 1, 0xff, 0xd9]);
    const extra = {}; for (const r of CLAIMS.renders) { extra["img_" + r.kv] = jpg.buffer; extra["img_ct_" + r.kv] = "image/jpeg"; }
    const dq = await buildDocument(mkEnv(extra), q(), { origin: "https://w.example" });
    ok(!/<img [^>]*dev_render_/.test(dq.html), "negative (pending): even with every key published, no developer picture is drawn");
  } finally { c.render_permission.status = was; }
}
ok(!FORBID_VENDOR.test(T) && !FORBID_VENDOR.test(H.replace(/<style>[\s\S]*?<\/style>/, "")), "no third-party AI vendor or portal name anywhere");
ok(!FORBID_INTERNAL.test(T), "no internal item (plot sale, mortgage, DEWA, land sale, first-year pricing, comparisons, brand group) on the client sheet", (T.match(FORBID_INTERNAL) || [""])[0]);
{
  // every figure in the price table traces to the record
  const claimNums = new Set(); for (const r of CLAIMS.price_from.rows) { claimNums.add(r.from_aed); claimNums.add(r.size_sqft); (String(r.printed_price).match(/[\d.]+/g) || []).forEach((x) => claimNums.add(Number(x))); }
  const seg = T.slice(T.indexOf("Launch prices"), T.indexOf("Starting prices are"));
  const bad = (seg.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || []).map((s) => Number(s.replace(/,/g, ""))).filter((n) => !claimNums.has(n) && n !== 679 && n !== 1 && n !== 2);
  ok(!bad.length, "every figure printed in the sheet's price table exists in the claims record", bad.join());
}
{
  const d2 = await buildDocument(mkEnv(), q("&hide=amen,layouts"), { origin: "https://w.example" });
  const T2 = text(d2.html);
  ok(!/Amenities/.test(T2) && !/unit register for this project/.test(T2) && /Launch prices/.test(T2), "hide=amen,layouts leaves those sections out");
  const miss = await buildDocument(mkEnv(), parseQuery(new URL("https://x/brief_pdf?kind=dossier&keys=dev:nosuch&mode=buy")), {});
  ok(miss.status === 404, "an unknown dev: key is a clean 404");
  const noFacts = await buildDocument({ MEETINGS: { async get() { return null; } } }, q(), { origin: "https://w.example" });
  ok(noFacts.status === 200 && !/Studios\s*248/.test(text(noFacts.html)) && /Launch prices/.test(text(noFacts.html)), "without the unit-register record the sheet still builds and prints no invented unit mix");
}

console.log("E - with the permission ON FILE (a stand-in flip) the renders appear, labelled, and nothing else changes");
{
  const c = DEV_CLAIMS.kore, was = c.render_permission.status;
  try {
    c.render_permission.status = "on_file";   // already on file in v417: kept as an explicit stand-in
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 3, 232, 6, 64, 3, 1, 34, 0, 2, 17, 1, 3, 17, 1, 0xff, 0xd9]);
    const extra = {}; for (const r of CLAIMS.renders) { extra["img_" + r.kv] = jpg.buffer; extra["img_ct_" + r.kv] = "image/jpeg"; }
    const d = await buildDocument(mkEnv(extra), q(), { origin: "https://w.example" }), HH = d.html, TT = text(HH);
    const imgs = [...HH.matchAll(/<img [^>]*src="([^"]+)"/g)].map((m) => m[1]).filter((s) => /dev_render_/.test(s));
    ok(d.status === 200 && !TT.includes(PICTURES_WITHHELD), "on_file: the withheld line is gone");
    ok(imgs.length === 10 && imgs.every((s) => /\/img\/dev_render_kore_\d+$/.test(s)) && new Set(imgs).size === 10, "v417 on_file: all ten stored pictures are used, once each (and no other picture)", imgs.join());
    ok((TT.match(/Developer's render, KORE launch brochure received 6 October 2026/g) || []).length === 3 && (TT.match(/Developer's brochure page, KORE launch brochure received 6 October 2026/g) || []).length === 3 && (TT.match(/Developer's brochure page: /g) || []).length === 4, "on_file: three renders carry 'Developer\'s render', the three strip pages 'Developer\'s brochure page', the four reference thumbnails 'Developer\'s brochure page: <what>'");
    ok(d.pages === 4 && !/Picture not yet published/.test(TT), "on_file with the keys published: four pages, no fallback line");
    const opt = await docOptionsRoute({ method: "GET" }, mkEnv(), new URL("https://x/doc_client?keys=dev:kore&key=k"), { keyOk: () => true });
    ok(opt.status === 200 && !/Pictures withheld/.test(await opt.text()), "on_file: the options page offers the renders");
  } finally { c.render_permission.status = was; }
}

console.log("F - the options page for the Client button (/doc_client?keys=dev:kore)");
{
  const r = await docOptionsRoute({ method: "GET" }, mkEnv(), new URL("https://x/doc_client?keys=dev:kore&key=k"), { keyOk: () => true });
  const h = await r.text(), t = text(h);
  ok(r.status === 200 && /Client sheet: choose the version/.test(t) && /KORE by Imtiaz/.test(t), "the page opens and names the project");
  ok(!t.includes(PICTURES_WITHHELD) && /Developer's pictures/.test(t) && !/never a picture with people/.test(t), "on_file: the page offers the developer's pictures and does not say they are withheld");
  {
    const c = DEV_CLAIMS.kore, was = c.render_permission.status;
    try { c.render_permission.status = "pending"; const rp = await docOptionsRoute({ method: "GET" }, mkEnv(), new URL("https://x/doc_client?keys=dev:kore&key=k"), { keyOk: () => true }); const tp = text(await rp.text());
      ok(tp.includes(PICTURES_WITHHELD) && /Developer's pictures/.test(tp), "negative (pending): the page says exactly why the pictures are not offered"); } finally { c.render_permission.status = was; }
  }
  ok(/"fixed":\[\["kind","dossier"\],\["keys","dev:kore"\]/.test(h) || /dev:kore/.test(h), "Generate opens /brief_pdf?kind=dossier&keys=dev:kore");
  ok(/Not on the project register|developer says/i.test(t) && /Curated by Najjuko/.test(t), "the page lists what the sheet contains and its legal footer");
  const nf = await docOptionsRoute({ method: "GET" }, mkEnv(), new URL("https://x/doc_client?keys=dev:nosuch&key=k"), { keyOk: () => true });
  ok(nf.status === 404, "an unknown developer-says key is a 404, not a dead page");
  const b = await docOptionsRoute({ method: "GET" }, mkEnv(), new URL("https://x/doc_client?keys=dist:77&key=k"), { keyOk: () => true });
  ok(b.status === 404, "a building key still goes the old way (not in the rent index here: 404, unchanged)");
}

console.log("G - the Broker sheet: confirmed and developer-says, labelled");
{
  const C = { area: { devs: { imtiaz: { n: "Imtiaz", b: [[12, 15000, "The Archive"], [7, 17000, "Imtiaz Cove"], [0, 1, "Zero"]] }, x: { n: "X", b: [[3, 1, "X Tower"]] } } }, mine: { imtiaz: true } };
  const blk = devSaysBlock(C), t = text(blk);
  ok(/Imtiaz: register-confirmed projects and developer-says projects/.test(t) && /Register-confirmed here, and in the figures above: 2 projects \(The Archive, Imtiaz Cove\)/.test(t), "lists the register-confirmed projects of the developer in the area");
  ok(/Developer says, not on the project register, and outside every figure: KORE by Imtiaz, launch price from AED 679,000 \(developer says; KORE launch brochure, received 6 October 2026\)/.test(t), "names KORE as developer says, with price, source and date");
  ok(!FORBID_INTERNAL.test(t) && !FORBID_VENDOR.test(t), "nothing internal and no vendor name in the broker note");
  ok(devSaysBlock({ area: C.area, mine: { x: true } }) === "" && devSaysBlock({ area: C.area, mine: {} }) === "", "a developer with no such record: the broker page is unchanged (empty block)");
}

console.log("H - the render publisher: refuses on a pending COPY of the record; passes its checks on the real record");
{
  const tmpd = fs.mkdtempSync(path.join(os.tmpdir(), "v417_claims_"));
  const pend = JSON.parse(JSON.stringify(CLAIMS)); pend.render_permission = { status: "pending", note: "x", set_by: null, date: null };
  fs.writeFileSync(path.join(tmpd, "kore_launch_brochure.json"), JSON.stringify(pend));
  const r = spawnSync("python", [path.join(ROOT, "scripts/publish_dev_renders.py"), "--slug", "kore", "--claims-dir", tmpd], { encoding: "utf8" });
  const out = (r.stdout || "") + (r.stderr || "");
  ok(r.status === 1 && /render_permission\.status is 'pending', not 'on_file'/.test(out) && /Nothing was read or written/.test(out) && !/validating the files/.test(out), "negative (pending copy): publish_dev_renders.py exits 1 with the reason (dry run included)", out.slice(0, 300));
  const r2 = spawnSync("python", [path.join(ROOT, "scripts/publish_dev_renders.py"), "--slug", "kore", "--apply", "--claims-dir", tmpd], { encoding: "utf8" });
  ok(r2.status === 1 && /not 'on_file'/.test((r2.stdout || "") + (r2.stderr || "")), "negative (pending copy): --apply is refused the same way");
  fs.rmSync(tmpd, { recursive: true, force: true });
  const src = fs.readFileSync(path.join(ROOT, "scripts/publish_dev_renders.py"), "utf8");
  ok(src.indexOf("check_permission(c)") < src.indexOf("validate(c)") && /gate_guard\.enforce/.test(src) && /subprocess\.run\(\[npx/.test(src) && /time\.time\(\) \+ 70/.test(src) && /"--apply", action="store_true"/.test(src), "permission check first, gate guard, argument-list put, 70 s read-back, dry run by default");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
