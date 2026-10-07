// v373 - ATTRIBUTION EVIDENCE, the developer page's source lines and "Not confirmed" group, project area labels, and the quality gate (with a negative control). Offline: stubs only.
//   Kendall, 7 Oct 2026: the page showed Vento Tower and The Pad under Beyond; the register says ANAX Developments and Pad Properties Nine. The register is the authority; a developer's
//   own web site is a claim; every card says where its attribution came from; the check is a deterministic join; there is an audit trail.
//   node test/test_v373_attribution.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { devmapHtml } from "../src/devmap_page.js";
import { DM, buildIndex } from "../scripts/build_devmap_index.mjs";
import { PHOSPHOR_LIGHT } from "../src/devmap_icons.js";
import { evidenceOf, sourceLine, LABEL_CODE } from "../src/devattr.js";
import { COMMUNITY_LABELS, labelledName, singleCommunity, projectAreaLabel, areaDisplay } from "../src/community_labels.js";
import { runGate, auditCsv, projectRows, FIXTURES } from "../scripts/check_attribution_gate.mjs";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1").replace(/%20/g, " "));

// ---------------------------------------------------------------- stub inputs (the shapes the real builders write)
const card = (name, developer, n, salesName, extra) => ({ name, ...(developer ? { developer } : {}), registered_homes: 100, dld_sales: { project: salesName || name, sold_by_type: { "1 bedroom": n } }, rows: [{ type: "1 bedroom", median_aed: 1500000, median_sqm: 75 }], ...(extra || {}) });
const reg = (c, d, p, di, sp, s) => ({ c, d, p, s: s == null ? 1 : s, lo: false, di, sp: sp || [] });
const slugsGeo = [["businessbay", "Business Bay"], ["dubaimarina", "Dubai Marina"], ["bukadra", "Bukadra"], ["wadialsafa5", "Wadi Al Safa 5"], ["jebelali", "Jebel Ali"], ["madinatalmataar", "Dubai South"]];
const geo = { districts: slugsGeo.map(([slug, name]) => ({ slug, name, corridor: "x", bbox: [0, 0, 1, 1], centre: [0, 0] })) };
const registerAreas = { businessbay: { areas: ["Business Bay"] }, dubaimarina: { areas: ["Marsa Dubai"] }, bukadra: { areas: ["Bukadra"] }, wadialsafa5: { areas: ["Wadi Al Safa 5"] }, jebelali: { areas: ["Jabal Ali First"] } };
const UM = {
  businessbay: { 1: card("Vento Tower", "Beyond", 54, "VENTO TOWER"), 2: card("The Pad by Beyond", null, 534, "THE PAD"), 3: card("Kanyon", "Beyond", 40, "KANYON"), 4: card("Opus", "Omniyat", 20, "OPUS") },
  dubaimarina: { 1: card("Marina Vista", "Emaar", 300, "MARINA VISTA"), 2: card("Jumeirah Living Marina Gate", "Select Group", 200, "JUMEIRAH LIVING MARINA GATE"), 3: card("Ocean Heights", "DAMAC", 150, "OCEAN HEIGHTS"), 4: card("Marina Promenade", "Emaar", 120, "MARINA PROMENADE") },
  bukadra: { 1: card("Imtiaz Symphony Tower", "Imtiaz", 978, "IMTIAZ SYMPHONY TOWER"), 2: card("Wynwood Horizon by Imtiaz", "Imtiaz", 135, "WYNWOOD HORIZON BY IMTIAZ") },
  wadialsafa5: { 1: card("Cove Grand Residence by Imtiaz", "Imtiaz", 90, "COVE GRAND RESIDENCE BY IMTIAZ"), 2: card("Cove Edition Residence 1 by Imtiaz", "Imtiaz", 70, "COVE EDITION RESIDENCE 1 BY IMTIAZ") },
  jebelali: { 1: card("Westwood by Imtiaz", "Imtiaz", 182, "WESTWOOD BY IMTIAZ") },
  madinatalmataar: { 1: card("Mystery Heights", null, 10, "MYSTERY HEIGHTS"), 2: card("Claimed Heights", "Azizi", 12, "CLAIMED HEIGHTS") },
};
const REGDEV = {
  businessbay: { "vento tower": reg("anax-developments", "ANAX DEVELOPMENTS L.L.C", 2776, 428642006), "@vento tower": { ar: "BUSINESS BAY", ms: "Business Bay" },
    "the pad": reg("pad-properties-nine", "PAD PROPERTIES NINE LIMITED", 1173, 22103305, ["omniyat"]), "@the pad": { ar: "BUSINESS BAY", ms: "Business Bay" },
    kanyon: reg("cobia-real-estate", "COBIA REAL ESTATE L.L.C", 2001, 111, ["beyond"]), opus: reg("omniyat", "OMNIYAT PROPERTIES L.L.C", 2002, 112, ["omniyat"]) },
  dubaimarina: { "marina vista": reg("emaar", "EMAAR DEVELOPMENT P.J.S.C.", 2094, 137044480, ["emaar"]), "jumeirah living marina gate": reg("select-group", "SELECT GLOBAL DEVELOPMENT L.L.C", 1743, 10706845, ["select-group"]), "ocean heights": reg("damac", "DAMAC PROPERTIES CO (L.L.C)", 431, 260, ["damac"]), "marina promenade": reg("emaar", "EMAAR DEVELOPMENT P.J.S.C.", 2095, 137044480, ["emaar"]) },
  bukadra: { "imtiaz symphony tower": reg("imtiaz", "IMTIAZ GI REAL ESTATE DEVELOPMENT L.L.C", 4193, 748565993, ["imtiaz"]), "@imtiaz symphony tower": { ar: "HORIZON" },
    "wynwood horizon by imtiaz": reg("imtiaz", "IMTIAZ GI REAL ESTATE DEVELOPMENT L.L.C", 4133, 748565993, ["imtiaz"]), "@wynwood horizon by imtiaz": { ar: "HORIZON" } },
  wadialsafa5: { "cove grand residence by imtiaz": reg("imtiaz", "IMTIAZ COVE REAL ESTATE DEVELOPMENT L.L.C", 3774, 733293217, ["imtiaz"]), "@cove grand residence by imtiaz": { ar: "DUBAI LAND RESIDENCE COMPLEX", ms: "Dubai Land Residence Complex" },
    "cove edition residence 1 by imtiaz": reg("imtiaz", "IMTIAZ REAL ESTATE INVESTMENT & DEVELOPMENT L.L.C", 3248, 29075838, ["imtiaz"]), "@cove edition residence 1 by imtiaz": { ar: "Wadi Al Safa 5", ms: "Dubai Land Residence Complex" } },   // the sales area is only the land area: the register master community is used
  jebelali: { "westwood by imtiaz": reg("imtiaz", "IMTIAZ REAL ESTATE INVESTMENT & DEVELOPMENT L.L.C", 2431, 29075838, ["imtiaz"]), "@westwood by imtiaz": { ar: "AL FURJAN", ms: "Al Furjan" } },
  madinatalmataar: {},
};
const EJARI = { index: { a: { name_en: "The Pad by Beyond", developer: "Beyond" } } };
const mk = (over) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dm373_"));
  for (const [s, u] of Object.entries(UM)) fs.writeFileSync(path.join(dir, "um_" + s + ".raw"), JSON.stringify({ buildings_by_id: u }));
  const idx = buildIndex({ umDir: dir, prices: { items: [] }, rent: { items: [] }, geo, ejariProjects: EJARI, outAsOf: "2026-09-09", register: registerAreas, regdev: REGDEV, ...(over || {}) });
  fs.rmSync(dir, { recursive: true, force: true });
  return idx;
};
const idx = mk();
const proj = (index, name) => { const out = []; for (const s of Object.keys(index.areas)) for (const k of Object.keys(index.areas[s].devs)) { const d = index.areas[s].devs[k]; (d.b || []).forEach((b, i) => { if (b[2] === name) out.push({ slug: s, dev: k, b, x: (d.bx || [])[i], ce: (d.ce || [])[i], d }); }); } return out; };

console.log("A - the builder carries the evidence for every project");
const vento = proj(idx, "Vento Tower")[0], pad = proj(idx, "The Pad by Beyond")[0], kan = proj(idx, "Kanyon")[0], mv = proj(idx, "Marina Vista")[0];
ok(vento && vento.dev === "beyond" && vento.x.e === "NAME_ONLY" && vento.x.p === 2776 && vento.x.di === 428642006 && /ANAX/.test(vento.x.dn), "Vento Tower: shown under Beyond, NAME_ONLY, the register project number 2776, developer id 428642006 and ANAX Developments are carried", JSON.stringify(vento && vento.x));
ok(pad && pad.x.e === "NAME_ONLY" && pad.x.p === 1173 && /PAD PROPERTIES NINE/.test(pad.x.dn), "The Pad by Beyond: NAME_ONLY, the register names Pad Properties Nine Limited (an Omniyat project company, not a Beyond one)", JSON.stringify(pad && pad.x));
ok(kan && kan.x.e === "REGISTER_VERIFIED" && kan.x.m === "project_id", "Kanyon: the register company is an SPV of Beyond (its register web page / the developer file names the brand): REGISTER_VERIFIED by project number", JSON.stringify(kan && kan.x));
ok(mv && mv.dev === "emaar" && mv.x.e === "REGISTER_VERIFIED" && mv.x.m === "project_id" && mv.x.p === 2094, "Marina Vista stays verified under Emaar by project number 2094");
ok(proj(idx, "Jumeirah Living Marina Gate")[0].x.e === "REGISTER_VERIFIED" && proj(idx, "Ocean Heights")[0].x.e === "REGISTER_VERIFIED", "Jumeirah Living Marina Gate and Ocean Heights stay verified");
const myst = proj(idx, "Mystery Heights"), claimed = proj(idx, "Claimed Heights")[0];
ok(myst.length === 1 && myst[0].dev === "_" && myst[0].x.e === "UNVERIFIED" && myst[0].x.m === "none", "no developer and no register row: UNVERIFIED, basis none");
ok(claimed && claimed.dev === "azizi" && claimed.x.e === "DEVELOPER_CLAIMED" && claimed.x.m === "website_only" && claimed.x.dn === "", "the developer sheet names it and the register has no row: DEVELOPER_CLAIMED (a claim, not evidence)", JSON.stringify(claimed && claimed.x));
ok(Object.values(idx.areas).every((a) => Object.values(a.devs).every((d) => d.ce.length === d.c.length && d.bx.length === d.b.length)), "ce is parallel to c and bx is parallel to b in every slot");
ok(idx.attr && idx.attr.version === 373 && idx.attr.projects.REGISTER_VERIFIED > 0 && idx.attr.projects.NAME_ONLY === 2 && /authority/.test(idx.attr.rule), "the index says what it holds: counts per label, the rule and the layout", JSON.stringify(idx.attr && idx.attr.projects));
// backwards compatible: the old keys and their values are untouched
const bm = idx.areas.dubaimarina.devs.emaar;
ok(bm.n === "Emaar" && bm.h === 200 && JSON.stringify(bm.c[0]) === JSON.stringify([300, 20000, 1500000, 1]) && JSON.stringify(bm.b[0]) === JSON.stringify([300, 20000, "Marina Vista"]) && Array.isArray(bm.r) && JSON.stringify(bm.q) === JSON.stringify([420, 0]), "old keys n, h, c, r, b, q are unchanged in shape and value (the v372 worker ignores ce and bx)");
ok(Object.keys(idx).every((k) => ["as_of", "generated", "source", "cuts", "devs", "alias", "areas", "scale", "attr", "ev"].includes(k)), "the only new top-level key is attr", Object.keys(idx).join());
// the basis when the register is reached only by a loose name, and when the project number is given in a register-built card
const loose = evidenceOf({ D: { dev: "Emaar", q: "v", why: "register agrees" }, cand: "Emaar", route: "card_field", regd: reg("emaar", "EMAAR", 7, 1, ["emaar"]), how: "loose" });
ok(loose.e === "NAME_ONLY" && loose.m === "partial_name", "a register row reached only through a loose (partial) name is NAME_ONLY, not verified");
const rb = evidenceOf({ D: { dev: "Arada", q: "i", why: "x" }, cand: "Arada", route: "card_register:register developer of record", regd: null, how: "exact", basisText: "register developer of record (developer_id of project_number 3344)" });
ok(rb.e === "REGISTER_VERIFIED" && rb.p === 3344 && rb.m === "project_id", "a register-built card carries its project number and is verified");
ok(LABEL_CODE.REGISTER_VERIFIED === "V" && LABEL_CODE.NAME_ONLY === "N" && LABEL_CODE.DEVELOPER_CLAIMED === "D" && LABEL_CODE.UNVERIFIED === "U", "label codes");

console.log("B - area labels: a project is labelled by its own area, never by a neighbouring community");
const areaOf = (slug, name) => proj(idx, name)[0].x.a;
ok(areaOf("bukadra", "Imtiaz Symphony Tower") === "Meydan Horizon" && areaOf("bukadra", "Wynwood Horizon by Imtiaz") === "Meydan Horizon", "Imtiaz Symphony Tower and Wynwood Horizon (sales area HORIZON): Meydan Horizon, not Sobha Hartland II (Bukadra)");
ok(areaOf("wadialsafa5", "Cove Grand Residence by Imtiaz") === "Dubai Land Residence Complex", "Cove Grand (sales area DUBAI LAND RESIDENCE COMPLEX): Dubai Land Residence Complex, not Arabian Ranches III");
ok(areaOf("wadialsafa5", "Cove Edition Residence 1 by Imtiaz") === "Dubai Land Residence Complex" && proj(idx, "Cove Edition Residence 1 by Imtiaz")[0].x.as === "register_master", "where the sales area is only the land area (Wadi Al Safa 5), the register master community is used, and the source says so");
ok(areaOf("jebelali", "Westwood by Imtiaz") === "Al Furjan" && proj(idx, "Westwood by Imtiaz")[0].x.as === "sales_area", "Westwood By Imtiaz (sales area AL FURJAN): Al Furjan, not Jebel Ali");
ok(areaOf("businessbay", "Vento Tower") === "Business Bay" && vento.x.as === "district", "a project whose own area is only the district's DLD name shows the district name (source: district)");
ok(labelledName("bukadra", "Bukadra") === "Bukadra" && labelledName("wadialsafa5", "Wadi Al Safa 5") === "Wadi Al Safa 5" && labelledName("madinatalmataar", "Dubai South") === "Dubai South" && labelledName("dubaiinvestmentparksecond", "DIP 2") === "DIP 2" && labelledName("rasalkhor", "Ras Al Khor") === "Ras Al Khor", "a district with several communities or other projects beside the one community shows only its DLD name: no ' / ' joins, no borrowed Sobha / Arabian Ranches label");
ok(labelledName("alhebiahfifth", "x") === "DAMAC Lagoons (Al Hebiah Fifth)" && labelledName("palmdeira", "x") === "Dubai Islands (Palm Deira)" && labelledName("majan", "x") === "Majan (Wadi Al Safa 3)", "a district that IS one community keeps its label");
ok(Object.keys(COMMUNITY_LABELS).every((s) => !/ \/ /.test(labelledName(s, "name"))) && singleCommunity("bukadra") === null && singleCommunity("alyufrah1") && singleCommunity("alyufrah1").labels[0] === "The Valley", "no labelled name anywhere carries a ' / ' join; the area PDF's market-name line uses only single-community districts");
ok(idx.areas.bukadra.label === undefined && idx.areas.wadialsafa5.label === undefined && idx.areas.madinatalmataar.label === undefined, "the index no longer writes a combined or borrowed district label");
ok(projectAreaLabel({ slug: "bukadra", districtName: "Bukadra", salesArea: "Bukadra", masterCommunity: "" }).label === "Bukadra" && projectAreaLabel({ slug: "x", districtName: "Some District", salesArea: "", masterCommunity: "" }).source === "district" && areaDisplay("JUMEIRAH LAKES TOWERS") === "Jumeirah Lakes Towers" && areaDisplay("Meydan One") === "Meydan One", "own-area rule: land area is not a community; nothing known falls back to the district; spelling is cleaned");

console.log("C - the evidence builder side (the 12-month window) goes through the same area rule");
const evd = { meta: { l12_to: "2026-08-31" }, areas: { bukadra: { dld: ["Bukadra"], shared: false, ev: { all: [10, 20000, 0, 0, 10, 20000, 10, 20000, 0, 0, 50, 70, 120], l12: [4, 21000, 0, 0, 4, 21000, 4, 21000, 0, 0, 50, 70, 120], y: [], first: "2024-03-19", last: "2026-08-27" },
  devs: { imtiaz: { c12: [[40, 26000, 2e6, 1], [10, 20000, 1.5e6, 1]], c12e: ["V", "N"], b12: [[40, 26000, "Imtiaz Symphony Tower"], [10, 20000, "Doubtful Place"]], b12x: [{ p: 4193, di: 748565993, dn: "IMTIAZ GI REAL ESTATE DEVELOPMENT L.L.C", m: "project_id", e: "REGISTER_VERIFIED", ar: "HORIZON", ms: "" }, { p: 77, di: 5, dn: "SOME OTHER CO", m: "project_id", e: "NAME_ONLY", ar: "Bukadra", ms: "" }], q12: [40, 10] } } } } };
const idx2 = mk({ evidence: evd });
const di2 = idx2.areas.bukadra.devs.imtiaz;
ok(di2.b12x && di2.b12x.length === 2 && di2.b12x[0].a === "Meydan Horizon" && di2.b12x[0].as === "sales_area" && di2.b12x[1].a === "Bukadra" && di2.b12x[1].as === "district" && di2.c12e.join() === "V,N", "b12x and c12e arrive in the index, the area label made by the one rule");

console.log("D - the developer page: source lines, only register-verified projects in the numbers, the rest apart");
const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
const harness = (IDXX, S) => {
  const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
  const s4 = cut("var STATS={},IXC={};", "function features()") + cut("var MON=", "function barsSvg(");
  const s3 = cut("var DRILLSET=null", "function devTier(k)");
  const fn = new Function("DM", "IDX", "S", "TC", "DEFAULT_NAMES", "setSheet", "renderDetail", "refreshMap", "EVI", "innerWidth", "var fetch=function(){return new Promise(function(){})};" + s0 + s1 + s4 + cut("function clipName", "function devHead(") + cut("function bar(arr", "function devRow(") + s3 + "; return {profileHtml:profileHtml,areaProjs:areaProjs,lockProjs:lockProjs,ncHtml:ncHtml,areaPanelHtml:areaPanelHtml,prof:prof,srcLine:srcLine};");
  return fn(DM, IDXX, S, ["#c5a56a", "#2f8a7f", "#3987e5", "#8a9a96"], {}, () => {}, () => {}, () => {}, PHOSPHOR_LIGHT, 1200);
};
const text = (h) => h.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const IDX = JSON.parse(JSON.stringify(idx));
const beforeSplit = { projects: Object.values(IDX.devs).reduce((a, d) => a + d.profile.projects, 0) };
const st = DM.attrSplit(IDX);
ok(st && st.hidden === 3 && st.kept === beforeSplit.projects - 3, "attrSplit hides the projects the register does not confirm (Vento Tower, The Pad by Beyond, and Claimed Heights, a developer claim) and keeps the rest", JSON.stringify(st));
ok(DM.attrSplit(IDX) === null, "and is idempotent");
ok(!IDX.devs.beyond || IDX.devs.beyond.profile.projects === 1, "Beyond's project count is its confirmed projects only (Kanyon)", JSON.stringify(IDX.devs.beyond));
ok(IDX.areas.businessbay.devs.beyond.b.length === 1 && IDX.areas.businessbay.devs.beyond.b[0][2] === "Kanyon" && IDX.areas.businessbay.devs.beyond.c.length === 1 && IDX.areas.businessbay.devs.beyond.c[0][0] === 40, "Beyond in Business Bay: one project and one cell, 40 sales (Vento Tower's 54 and The Pad's 534 are outside the numbers)");
ok(!IDX.areas.madinatalmataar || !IDX.areas.madinatalmataar.devs.azizi, "a developer whose only project is a claim has no slot in the numbers");
const S = { evOpen: false, prof: null, drill: null, parea: null, sel: "businessbay", unit: "sqft", win: "all" };
const P = harness(IDX, S);
const hb = P.profileHtml("beyond");
ok(/id=nconf/.test(hb) && /Not confirmed by the register/.test(hb) && /<details/.test(hb) && !/<details[^>]*open/.test(hb), "Beyond's page has a collapsed group 'Not confirmed by the register'");
const nc = hb.slice(hb.indexOf("id=nconf"), hb.indexOf("</details>"));
ok(/Vento Tower/.test(nc) && /The Pad by Beyond/.test(nc) && /2 projects, outside the numbers/.test(text(nc)), "Vento Tower and The Pad sit in it, counted as outside the numbers");
ok(/Matched by name only, not confirmed by the register/.test(nc) && /Register names: ANAX DEVELOPMENTS/.test(text(nc)) && /Register names: PAD PROPERTIES NINE/.test(text(nc)), "each says where the attribution came from and what the register names instead");
const outside = hb.slice(0, hb.indexOf("id=nconf")) + hb.slice(hb.indexOf("</details>"));
ok(!/Vento Tower|The Pad/.test(outside), "neither appears anywhere else on Beyond's page (area counts, project lists, price bands)");
const p = P.prof("beyond");
ok(p.projects === 1 && /1 project/.test(text(hb.slice(hb.indexOf("id=acards"), hb.indexOf("id=nconf")))), "the area card counts one project (Kanyon), not three");
S.parea = "businessbay";
const pn = P.profileHtml("beyond"), ap = pn.slice(pn.indexOf("id=aprojs"), pn.indexOf("id=nconf"));
ok(/Kanyon/.test(ap) && !/Vento|The Pad/.test(ap) && /Registered developer per DLD register: COBIA REAL ESTATE L\.L\.C/.test(text(ap)), "the area's project list shows Kanyon with 'Registered developer per DLD register: <name>'", text(ap));
S.parea = null;
S.sel = "dubaimarina";
const he = P.profileHtml("emaar");
ok(/Registered developer per DLD register: EMAAR DEVELOPMENT/.test(text(he)) && !/id=nconf/.test(he), "Emaar: every project card has a source line and there is no 'Not confirmed' group when nothing is unconfirmed");
const allImtiaz = P.lockProjs(P.prof("imtiaz"), "imtiaz");
const byName = Object.fromEntries(allImtiaz.map((q) => [q.name, q]));
ok(byName["Imtiaz Symphony Tower"].ev.a === "Meydan Horizon" && byName["Westwood by Imtiaz"].ev.a === "Al Furjan" && byName["Cove Grand Residence by Imtiaz"].ev.a === "Dubai Land Residence Complex", "Imtiaz's project cards: Symphony Tower in Meydan Horizon, Westwood in Al Furjan, Cove Grand in Dubai Land Residence Complex");
const cardHtml = P.profileHtml("imtiaz");
ok(/Meydan Horizon/.test(text(cardHtml)) && /Al Furjan/.test(text(cardHtml)) && !/Sobha Hartland II \(Bukadra\)|Arabian Ranches III/.test(text(cardHtml)), "and the words Meydan Horizon and Al Furjan are on the page, the borrowed labels are not");
ok(DM.sourceLine({ e: "REGISTER_VERIFIED", dn: "X" }) === sourceLine({ e: "REGISTER_VERIFIED", dn: "X" }) && ["NAME_ONLY", "DEVELOPER_CLAIMED", "UNVERIFIED"].every((e) => [{ e, dn: "" }, { e, dn: "Z" }].every((ev) => DM.sourceLine(ev, "D") === sourceLine(ev, "D"))), "the page's source lines and the module's are the same four sentences");
ok(DM.sourceLine({ e: "NAME_ONLY" }) === "Matched by name only, not confirmed by the register" && DM.sourceLine({ e: "UNVERIFIED" }) === "Not confirmed" && DM.sourceLine({ e: "DEVELOPER_CLAIMED", dn: "X" }) === "Developer says (website); the register names another developer", "the four sentences Kendall asked for");

console.log("E - an index WITHOUT evidence renders exactly as today");
const OLD = { as_of: "2026-09-09", cuts: { bounds: [30000, 20000, 12000] }, devs: { x: { name: "X", areas: 1, n: 30, profile: { projects: 2, homes: 0 } } }, areas: { a: { name: "Area A", devs: { x: { n: "X", h: 0, c: [[30, 21000, 1e6, 1]], b: [[10, 35000, "Tower One"], [20, 15000, "Tower Two"]], r: [] } } } } };
const OLD0 = JSON.stringify(OLD);
ok(DM.attrSplit(OLD) === null && JSON.stringify(OLD) === OLD0, "attrSplit leaves an old index untouched");
const So = { evOpen: false, prof: null, drill: null, parea: null, sel: "a", unit: "sqft", win: "all" };
const Po = harness(OLD, So);
let ho = ""; try { ho = Po.profileHtml("x"); } catch (e) { ho = "THROW " + e.message; }
ok(!/THROW/.test(ho) && /Tower One/.test(ho) && !/id=nconf/.test(ho) && !/srcl/.test(ho) && !/Registered developer per DLD register/.test(ho), "no crash, no source line, no 'Not confirmed' group, the project cards are as before", ho.slice(0, 200));
So.parea = "a";
ok(/2 projects, biggest first/.test(text(Po.profileHtml("x"))), "and the v371 area cards and project list still work");
ok(Po.ncHtml("x") === "" && Po.srcLine(null, "X") === "", "no group and no line without evidence");
ok(/DM\.attrSplit\(IDX\)/.test(js) && /id=nconf/.test(js) && /areaCardsHtml\(p,k\);h\+=ncHtml\(k\)/.test(js), "the page applies the split once, at load, and places the group after the area cards");
// the 12-month window uses b12 / b12x / c12e
const S12 = { evOpen: false, prof: null, drill: null, parea: "bukadra", sel: "bukadra", unit: "sqft", win: "l12" };
const I2 = JSON.parse(JSON.stringify(idx2));
I2.ev = evd.meta; I2.areas.bukadra.ev = { ...evd.areas.bukadra.ev, dld: ["Bukadra"], shared: false };
DM.attrSplit(I2);
const P12 = harness(I2, S12);
const h12 = P12.profileHtml("imtiaz");
ok(I2.areas.bukadra.devs.imtiaz.b12.length === 1 && I2.areas.bukadra.devs.imtiaz.c12.length === 1, "last-12-month window: the NAME_ONLY project and cell are out of b12 and c12");
ok(/Imtiaz Symphony Tower/.test(h12) && /Meydan Horizon/.test(text(h12)) && !/Doubtful Place/.test(h12.slice(0, h12.indexOf("id=nconf"))) && /Doubtful Place/.test(h12.slice(h12.indexOf("id=nconf"))), "and it is listed in the not-confirmed group instead (with its own window list)");

console.log("F - the quality gate");
const cfg = JSON.parse(fs.readFileSync(path.join(HERE, "..", "scripts", "attribution_gate.json"), "utf8"));
ok(cfg.max_not_verified_share === 0.22, "the threshold is read from a small config file, starting at the audit's 22%");
const clone = (o) => JSON.parse(JSON.stringify(o));
const good = runGate(idx, cfg, { now: new Date("2026-10-07T10:00:00Z") });
ok(good.ok && good.failures.length === 0 && good.share > 0 && good.share <= 0.22, "the built index passes: " + (100 * good.share).toFixed(1) + "% not register-verified, every fixture holds", JSON.stringify(good.failures));
const csv = auditCsv(good.rows);
const lines = csv.trim().split("\r\n");
ok(lines[0].replace("﻿", "") === "timestamp,window,area_slug,developer_shown,developer_id_shown,project,sales,register_project_number,register_developer,register_developer_id,match_basis,evidence_label,area_shown,area_source" && lines.length === 1 + good.rows.length, "the audit trail has one row per project, with developer shown, register developer, basis, label, area shown, area source and a timestamp");
ok(lines.some((l) => /Vento Tower/.test(l) && /ANAX DEVELOPMENTS/.test(l) && /NAME_ONLY/.test(l) && /2026-10-07T10:00:00/.test(l)), "e.g. the Vento Tower row names ANAX, NAME_ONLY, and the time");
ok(!runGate(idx, { ...cfg, max_not_verified_share: 0.05 }).ok, "the threshold is live: 5% fails the same index");
console.log("   negative controls: the gate must FAIL a deliberately corrupted index");
const neg = (m, mut, expect, c2) => { const x = clone(idx); mut(x); const r = runGate(x, c2 || cfg); ok(!r.ok && r.failures.some((f) => expect.test(f)), "negative control - " + m, JSON.stringify(r.failures)); };
neg("Vento Tower marked REGISTER_VERIFIED under Beyond", (x) => { const d = x.areas.businessbay.devs.beyond; d.bx[d.b.findIndex((b) => b[2] === "Vento Tower")].e = "REGISTER_VERIFIED"; }, /Vento Tower is REGISTER_VERIFIED under beyond/);
neg("The Pad marked REGISTER_VERIFIED under Beyond", (x) => { const d = x.areas.businessbay.devs.beyond; d.bx[d.b.findIndex((b) => b[2] === "The Pad by Beyond")].e = "REGISTER_VERIFIED"; }, /The Pad by Beyond is REGISTER_VERIFIED under beyond/);
neg("most projects demoted to NAME_ONLY (share above the limit)", (x) => { for (const a of Object.values(x.areas)) for (const d of Object.values(a.devs)) (d.bx || []).forEach((b, i) => { if (i % 2 === 0) b.e = "NAME_ONLY"; }); }, /share not REGISTER_VERIFIED/);
neg("Marina Vista demoted", (x) => { x.areas.dubaimarina.devs.emaar.bx[0].e = "NAME_ONLY"; }, /marina vista is not REGISTER_VERIFIED under emaar/);
neg("Ocean Heights moved to another developer", (x) => { const a = x.areas.dubaimarina.devs; a.zzz = a.damac; delete a.damac; }, /ocean heights is not REGISTER_VERIFIED under damac/);
neg("Imtiaz Symphony Tower back under the borrowed Sobha label", (x) => { x.areas.bukadra.devs.imtiaz.bx[0].a = "Sobha Hartland II (Bukadra)"; }, /Imtiaz Symphony Tower is shown in "Sobha Hartland II \(Bukadra\)", expected Meydan Horizon/);
neg("Westwood By Imtiaz under Jebel Ali", (x) => { x.areas.jebelali.devs.imtiaz.bx[0].a = "Jebel Ali"; }, /Westwood by Imtiaz is shown in "Jebel Ali", expected Al Furjan/);
neg("Cove Grand under Arabian Ranches III", (x) => { x.areas.wadialsafa5.devs.imtiaz.bx[0].a = "Arabian Ranches III / Dubai Land Residence Complex (Wadi Al Safa 5)"; }, /Cove Grand Residence by Imtiaz is shown in/);
neg("evidence stripped (an index built without v373)", (x) => { for (const a of Object.values(x.areas)) for (const d of Object.values(a.devs)) { delete d.bx; delete d.ce; delete d.b12x; } }, /no attribution evidence/);
neg("a fixture project missing from the index", (x) => { delete x.areas.dubaimarina.devs.damac; }, /ocean heights is not in the index/);
neg("an index with no areas", (x) => { x.areas = null; }, /no areas/);
const lenient = clone(idx); delete lenient.areas.dubaimarina.devs.damac;
ok(runGate(lenient, { ...cfg, require_fixtures: false, max_not_verified_share: 0.5 }).ok, "with require_fixtures false a project that is simply absent is not a failure (a partial index)");
// the CLI: exit codes and the CSV file
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dm373gate_"));
fs.writeFileSync(path.join(dir, "good.json"), JSON.stringify(idx));
const badIdx = clone(idx); badIdx.areas.businessbay.devs.beyond.bx[0].e = "REGISTER_VERIFIED"; badIdx.areas.businessbay.devs.beyond.bx[1].e = "REGISTER_VERIFIED";
fs.writeFileSync(path.join(dir, "bad.json"), JSON.stringify(badIdx));
const gate = path.join(HERE, "..", "scripts", "check_attribution_gate.mjs");
const r1 = spawnSync(process.execPath, [gate, path.join(dir, "good.json"), "--audit-csv", path.join(dir, "good.csv")], { encoding: "utf8" });
const r2 = spawnSync(process.execPath, [gate, path.join(dir, "bad.json"), "--audit-csv", path.join(dir, "bad.csv")], { encoding: "utf8" });
const r3 = spawnSync(process.execPath, [gate, path.join(dir, "nope.json")], { encoding: "utf8" });
ok(r1.status === 0 && /ATTRIBUTION GATE: PASS/.test(r1.stdout) && fs.existsSync(path.join(dir, "good.csv")), "CLI: the good index exits 0 and writes the audit CSV", r1.stdout + r1.stderr);
ok(r2.status === 1 && /ATTRIBUTION GATE: FAIL/.test(r2.stdout) && fs.existsSync(path.join(dir, "bad.csv")), "CLI: the corrupted index exits 1 (and still writes the audit trail)", r2.stdout + r2.stderr);
ok(r3.status === 2, "CLI: a missing file exits 2");
fs.rmSync(dir, { recursive: true, force: true });
ok(FIXTURES.notVerifiedUnder.length === 2 && FIXTURES.verifiedUnder.length === 3 && FIXTURES.areaIs.length === 4, "all nine fixtures are in the script");
const { rows } = projectRows(idx);
ok(rows.some((r) => r.dev_id === "_" && r.e === "UNVERIFIED") && rows.filter((r) => r.window === "all").length === Object.values(idx.areas).reduce((a, ar) => a + Object.values(ar.devs).reduce((b, d) => b + d.b.length, 0), 0), "the audit rows cover every project, including those under 'Developer not recorded'");

console.log("G - the evidence builder (python) keeps its end of the contract");
const pyDir = path.join(HERE, "..", "scripts");
const read = (f) => fs.readFileSync(path.join(pyDir, f), "utf8");
ok(/b12x/.test(read("build_area_evidence.py")) && /c12e/.test(read("build_area_evidence.py")) && /REGISTER_VERIFIED/.test(read("build_area_evidence.py")), "build_area_evidence.py writes b12x and c12e and builds its drawer on register-verified sales only");
ok(/spv_of/.test(read("devattr_register.py")) && /"sp"/.test(read("devattr_register.py")) && /"@"/.test(read("devattr_register.py")) && /sales_area_index/.test(read("devattr_register.py")), "devattr_register.py resolves the SPV-to-brand link and the project's own area; regdev carries di, sp and the @ area entries");

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
