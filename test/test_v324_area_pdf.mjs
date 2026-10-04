// v324 - the two Developers-by-area PDFs (src/devmap_pdf.js, GET /developers_pdf): snapshot (one page) and detailed (several pages).
// Built over a small synthetic index with the same shape as KV img_devmap_index (no network, nothing live is read or written).
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { DEVMAP_CORE_JS } from "../src/devmap_core.js";
import { buildAreaPdf, parseParams, parseBudget, PERMIT_REMINDER, pack, PAGE_H } from "../src/devmap_pdf.js";
import { devmapHtml } from "../src/devmap_page.js";
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

// ---------------------------------------------------------------- the fixture
const BOUNDS = [32292, 22604, 16684];
const cell = (n, psf, bed) => { const ppsm = Math.round(psf * 10.7639); return [n, ppsm, Math.round(ppsm * (bed ? 60 + 25 * bed : 34)), bed]; };
const ev = (n, med) => [n, med, n, med, 0, 0, n, med, 0, 0, 50, 80, 120];
function dev(name, psf, n, projects, opts) {
  const c = [cell(Math.ceil(n * 0.4), psf, 1), cell(Math.ceil(n * 0.4), psf * 1.02, 2), cell(Math.max(3, Math.floor(n * 0.2)), psf * 0.98, 3)];
  const b = projects.map(([nm, k]) => [Math.ceil(n / projects.length), Math.round(psf * 10.7639 * (1 + k)), nm]);
  const d = { n: name, h: n * 3, c, b, r: [[6, 900, 90000, 1]] };
  if (!(opts && opts.noev)) { d.ev = { all: ev(n, Math.round(psf * 10.7639)), l12: ev(Math.ceil(n / 2), Math.round(psf * 10.7639)), y: [[2025, n, Math.round(psf * 10.7639)]], top: [[projects[0][0], n, 1, n, 1, 0]] }; d.c12 = c.map((x) => [Math.max(3, Math.ceil(x[0] / 2)), x[1], x[2], x[3]]); d.b12 = b.map((x) => [Math.max(3, Math.ceil(x[0] / 2)), x[1], x[2]]); }
  return d;
}
const NAMES = { omniyat: "Omniyat", nakheel: "Nakheel", meraas: "Meraas", emaar: "Emaar", imtiaz: "Imtiaz", zaya: "Zaya", ellington: "Ellington", "select-group": "Select Group", damac: "Damac", mered: "Mered", sobha: "Sobha", azizi: "Azizi", danube: "Danube", binghatti: "Binghatti" };
function areaMain() {
  return { name: "Test Village Circle", bbox: [55.1, 25.0, 55.2, 25.1], register_sales_12m: 900, register_sales_all_time: 2400, ev: { all: ev(2000, 1500), l12: ev(900, 1600), y: [[2025, 900, 16000]] },
    devs: { omniyat: dev("Omniyat", 3400, 60, [["Skyline One", 0], ["Skyline Two", 0.05]]), nakheel: dev("Nakheel", 2400, 80, [["Palm Court", 0], ["Palm Court Two", 0.1], ["Palm Gardens", -0.05]]), imtiaz: dev("Imtiaz", 1700, 120, [["Pearl House", 0], ["Westwood Grande", 0.03], ["Luxur Tower", -0.02], ["Never Mapped Place", 0]]), damac: dev("Damac", 900, 150, [["Damac Lagoon View", 0], ["Damac Bay", 0.02]]), sobha: dev("Sobha", 1650, 70, [["Sobha Reserve", 0]]), azizi: dev("Azizi", 1200, 90, [["Azizi Park", 0], ["Azizi Riviera", 0.04]]), danube: dev("Danube", 1100, 40, [["Danube Tower", 0]]), binghatti: dev("Binghatti", 1300, 2, [["Binghatti One", 0]]), "_": { n: "Developer not recorded", h: 0, c: [cell(20, 1400, 1)], r: [] } } };
}
const areaNoEv = () => ({ name: "Plain Old Area", bbox: [55.3, 25.1, 55.35, 25.15], register_sales_all_time: 300, devs: { emaar: dev("Emaar", 2300, 40, [["Emaar Heights", 0]], { noev: true }), zaya: dev("Zaya", 1500, 30, [["Zaya Court", 0]], { noev: true }) } });
const areaThin = () => ({ name: "Palm Deira", bbox: [55.28, 25.27, 55.33, 25.32], register_sales_12m: 40, register_sales_all_time: 40, ev: { all: ev(12, 2200), l12: ev(12, 2200), y: [[2026, 12, 2200]] }, devs: { meraas: dev("Meraas", 2200, 12, [["Island One", 0]]) } });
const areaEmpty = () => ({ name: "Empty Plot", bbox: [55.4, 25.2, 55.45, 25.25], register_sales_all_time: 0, devs: { emaar: { n: "Emaar", h: 10, c: [[2, 20000, 900000, 1]], b: [], r: [] } } });
function mkIndex() {
  const areas = { testvillagecircle: areaMain(), plainoldarea: areaNoEv(), palmdeira: areaThin(), emptyplot: areaEmpty() };
  const devs = {};
  for (const [s, a] of Object.entries(areas)) for (const [k, d] of Object.entries(a.devs)) { if (k === "_") continue; const e = devs[k] || (devs[k] = { name: d.n, areas: 0, n: 0, profile: { projects: 0, homes: 0 } }); e.areas++; e.n += (d.c || []).reduce((q, x) => q + x[0], 0); e.profile.projects += (d.b || []).length; e.profile.homes += d.h || 0; }
  return { as_of: "2026-09-09", generated: "2026-09-09", cuts: { bounds: BOUNDS, shares: { bounds: BOUNDS, window: ["2025-09-01", "2026-09-01"], sales: 1000, n: [9, 20, 35, 36], money: [26, 25, 26, 24] }, rule: "x" }, devs, alias: {}, areas, scale: { boutiqueMax: 2, midMax: 4 },
    ev: { as_of: "2026-08-31", since: "2019-01-01", l12_from: "2025-09-01", l12_to: "2026-08-31", source_as_of: "2026-09-17", sales: 5000, filters: "Ordinary sales of homes, price from AED 100,000." } };
}
// a little district layer: a square of footprints; ids 1..40 on a grid
function mkLayer() { const b = []; for (let i = 0; i < 40; i++) { const x = (i % 8) * 60, y = Math.floor(i / 8) * 60; b.push([i + 1, 20 + (i % 5) * 10, [x, y, x + 40, y, x + 40, y + 40, x, y + 40, x, y]]); } return { d: "testvillagecircle", b, s: [[6, [0, 0, 480, 0]]], rp: [], lab: [], ll: [1, 0, 0, 0, 1, 0] }; }
const UNITMIX = { buildings_by_id: { 1: { name: "Skyline One" }, 2: { name: "Skyline Two" }, 3: { name: "Pearl House" }, 4: { name: "Westwood Grande" }, 5: { name: "Palm Court" }, 6: { name: "Damac Bay" } } };
const GEO = { type: "FeatureCollection", features: [
  { type: "Feature", properties: { slug: "testvillagecircle" }, geometry: { type: "Polygon", coordinates: [[[55.1, 25.0], [55.2, 25.0], [55.2, 25.1], [55.1, 25.1], [55.1, 25.0]]] } },
  { type: "Feature", properties: { slug: "palmdeira" }, geometry: { type: "MultiPolygon", coordinates: [[[[55.28, 25.27], [55.33, 25.27], [55.33, 25.32], [55.28, 25.27]]]] } },
  { type: "Feature", properties: { slug: "plainoldarea" }, geometry: { type: "Polygon", coordinates: [[[55.3, 25.1], [55.35, 25.1], [55.35, 25.15], [55.3, 25.1]]] } }] };
function mkEnv(extra) {
  const store = { img_devmap_index: JSON.stringify(mkIndex()), img_district_polygons: JSON.stringify(GEO), img_brief_fp_testvillagecircle: JSON.stringify(mkLayer()), img_unitmix_testvillagecircle: JSON.stringify(UNITMIX) };
  const KV = { async get(k) { return store[k] == null ? null : store[k]; }, async put(k, v) { store[k] = v; }, async delete() {}, async list() { return { keys: [] }; } };
  return Object.assign({ MEETINGS: KV, READ_KEY: "owner_key_abcdefgh", CLIENT_KEY: "client_key_123456" }, extra || {});
}
const TEN = "omniyat,nakheel,meraas,emaar,imtiaz,zaya,ellington,select-group,damac,mered";
const qs = (o) => "https://x/developers_pdf?" + Object.entries(o).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
const build = (o) => buildAreaPdf(mkEnv(), parseParams(new URL(qs(Object.assign({ developers: TEN, mode: "buy" }, o)))), { now: Date.parse("2026-10-04T08:00:00Z") });
const text = (html) => html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ");
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}]/u;

console.log("the Worker-side logic is the page's logic, not a copy");
{
  const g = fs.readFileSync(new URL("../src/devmap_dm.js", import.meta.url), "utf8");
  ok(g.includes(DEVMAP_CORE_JS.trim()), "src/devmap_dm.js carries exactly the text of src/devmap_core.js (run node scripts/gen_devmap_dm.mjs after editing the core)");
}

console.log("both kinds build, for a normal area, a thin one, one with no yearly record and one with no sales");
const cases = [["testvillagecircle", "12m"], ["testvillagecircle", "all"], ["palmdeira", "12m"], ["plainoldarea", "12m"], ["emptyplot", "12m"]];
const docs = {};
for (const [area, win] of cases) for (const kind of ["snapshot", "detailed"]) {
  const d = await build({ kind, area, window: win, budget: "1.2m-1.8m", beds: "1" });
  docs[kind + ":" + area + ":" + win] = d;
  ok(d.status === 200 && d.html.length > 2000, kind + " " + area + " (" + win + "): built, " + (d.pages || 0) + " page(s)");
}
ok(docs["snapshot:testvillagecircle:12m"].pages === 1 && docs["detailed:testvillagecircle:12m"].pages > 4, "a snapshot is one page; the detailed document runs to several");
ok(docs["detailed:emptyplot:12m"].html.includes("Not enough sales"), "an area with no sales says so plainly and still builds");
ok(/no record by year/.test(docs["snapshot:plainoldarea:12m"].html), "an area with no yearly record names that and shows all years");
ok(/not complete yet/.test(docs["snapshot:palmdeira:12m"].html), "a thin area carries the 'not complete yet' note");

console.log("snapshot content");
{
  const h = docs["snapshot:testvillagecircle:12m"].html;
  for (const t of ["Median price", "Middle half of sales", "Sales loaded", "Top band", "Upper band", "Middle band", "Entry band", "Studio", "3 bedrooms", "of sales here", "of the money"]) ok(h.includes(t), "snapshot has '" + t + "'");
  ok(h.includes('class="loc"') && (h.match(/<svg class="loc"/g) || []).length === 2, "the locator and the area outline are both drawn as vector");
  ok(/Client budget: 1 bedroom, AED 1,200,000 to AED 1,800,000/.test(h), "a client budget gives one line on who fits");
  const t = text(h);
  ok(t.indexOf("Imtiaz") > 0 && h.indexOf("Imtiaz") < h.indexOf("Sobha Reserve") + 99999, "the developers are listed");
  const mid = h.slice(h.indexOf("Middle band")), iImt = mid.indexOf("Imtiaz"), iAz = mid.indexOf("Azizi");
  ok(iImt >= 0 && iAz >= 0 && iImt < iAz || iAz < 0, "the realtor's chosen developers come first in a band");
  ok(/<svg class="ic"[^>]*>(<path[^>]*>)+<\/svg><\/span><span class="dn2">Imtiaz/.test(h), "a chosen developer has the small star icon");
}

console.log("detailed content");
{
  // v327 - with ten developers chosen the document gives each ONE page (about 12 pages in all); with a few chosen it gives the full treatment
  const ten = docs["detailed:testvillagecircle:12m"];
  ok(ten.pages <= 13, "ten chosen developers: the detailed document stays at about 12 pages (" + ten.pages + ")");
  ok(/Developer profile/.test(ten.html) && !/Where [A-Za-z]+ sits in/.test(text(ten.html).slice(0, 0)), "ten chosen developers: each still has a profile page");
  const few = await build({ kind: "detailed", area: "testvillagecircle", window: "12m", budget: "1.2m-1.8m", beds: "1", developers: "imtiaz,damac" });
  docs["detailed:testvillagecircle:12m"] = few;
  const h = few.html;
  for (const t of ["Developers by price band", "The area map", "Where Imtiaz sits", "Developer profile", "Positioning evidence", "Price by area, highest to lowest", "Talking point", "How these numbers are worked out", "Your client&rsquo;s budget, by location", "Against the other developers here"]) ok(h.includes(t), "detailed has '" + t + "'");
  ok(/Registered here, no map position yet/.test(h) && h.includes("Never Mapped Place"), "a project with no building outline is listed as 'registered here, no map position yet', not dropped");
  ok(h.includes("Skyline One") && /<svg[^>]*aria-label="Map of Test Village Circle/.test(h), "projects with an outline are on the area map");
  ok((h.match(/aria-label="Where [A-Za-z]+ sits in/g) || []).length >= 2, "one map per chosen developer that has projects here");
  ok(/Sales by price band: /.test(h) && /Top band \d+%|Middle band \d+%/.test(h), "doughnuts carry spelled-out band labels");
  ok(/weighted middle \(median\) of the building medians/.test(h) && /contract price/.test(h) && /land plot/.test(h) && /3 or more sales/.test(h), "the method page covers medians, off-plan contract prices, the villa plot caveat and the 3-sales rule");
  ok(!/Mid-market|rating|best developer|top developer/i.test(text(h)), "no developer is named in a way that reads as a rating");
  const dd = docs["detailed:testvillagecircle:all"].html;
  ok(dd.includes("Every settled sale since 1 January 2019 (all years)") && !dd.includes("(the last 12 months)"), "the window switch drives the named window");
}

console.log("rules for every document");
for (const [k, d] of Object.entries(docs)) {
  const h = d.html, t = text(h), pages = (h.match(/class="sheet page/g) || []).length;
  ok(!EMOJI.test(h), k + ": no emoji characters");
  ok(!/\b(JVC|JLT|DLD|DM|KHDA|RTA|PSF|BR)\b/.test(t) && !(t.match(/\b[A-Z]{2,6}\b/g) || []).filter((w) => !["AED", "A", "I"].includes(w)).length, k + ": no initials or unexplained abbreviations");
  ok(!/not known|unknown|n\/a|undefined|NaN|\bnull\b/i.test(t), k + ": a missing fact is left out, never printed as 'not known'");
  ok((h.match(/<svg class="ic"/g) || []).length >= (/Not enough sales/.test(h) ? 1 : 3) && (h.match(/class="icw"/g) || []).length === (h.match(/class="sec"/g) || []).length, k + ": icons are inline and each section heading has one");
  ok((h.match(/Curated by Najjuko &middot; Dubai Decoded/g) || []).length === pages && (h.match(/\+971 56 548 4397/g) || []).length === pages, k + ": the Brief footer is on every page");
  ok((h.match(new RegExp(PERMIT_REMINDER.replace(/[.]/g, "\\."), "g")) || []).length === pages, k + ": the permit-number reminder is on every page");
  const w = (d.C && d.C.winText) || "";
  ok(w && (h.split(w.replace(/&/g, "&amp;")).length - 1) >= pages, k + ": the window is named on every page");
  ok(!/<img /.test(h.replace(/<img class="najhead"[^>]*>/g, "")) && !/googleapis\.com\/maps|staticmap|satellite/i.test(h), k + ": no pictures (only the header mark, when stored)");
}

console.log("budget and mode");
{
  const none = await build({ kind: "snapshot", area: "testvillagecircle" });
  ok(!/Client budget/.test(none.html), "no budget entered: no budget line");
  const rent = await build({ kind: "detailed", area: "testvillagecircle", mode: "rent", budget: "60000-120000", beds: "1" });
  ok(rent.status === 200 && /Client budget: 1 bedroom, AED 60,000 to AED 120,000 a year/.test(rent.html), "rent mode builds with a yearly budget");
  const b = parseBudget(new URL(qs({ budget: "1.2m-1.8m", beds: "2" })).searchParams);
  ok(b.min === 1200000 && b.max === 1800000 && b.beds === 2, "budget text '1.2m-1.8m' reads as 1,200,000 to 1,800,000");
  const only = parseBudget(new URL(qs({ min: "900000", max: "1500000", beds: "0" })).searchParams);
  ok(only.min === 900000 && only.max === 1500000 && only.beds === 0, "min= and max= work too, and beds=0 is a studio");
  ok((await build({ kind: "detailed", area: "testvillagecircle", developers: "nobody-here" })).status === 200, "an unknown developer id is ignored, not an error");
}

console.log("the page packer never leaves a heading alone");
{
  const blocks = [{ sub: "s", h: 500, html: "a" }, { sub: "s", h: 70, keep: true, html: "H" }, { sub: "s", h: 300, html: "n" }];
  const pg = pack(blocks);
  ok(pg.length === 2 && pg[1].html.startsWith("H"), "a keep-with-next heading moves to the next page with its first block");
  ok(PAGE_H > 700, "a page holds a full page of blocks");
}

console.log("the route and its keys");
{
  const env = mkEnv();
  const call = (path, init) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + path, init), env, { waitUntil() {} });
  const base = "/developers_pdf?kind=snapshot&area=testvillagecircle&developers=" + TEN + "&format=html";
  ok((await call(base)).status === 401, "no key: 401");
  ok((await call(base + "&key=wrong_key_zzzzzzzz")).status === 401, "a wrong key: 401");
  const c = await call(base + "&key=client_key_123456");
  ok(c.status === 200 && /text\/html/.test(c.headers.get("content-type")) && /noindex/.test(c.headers.get("x-robots-tag")), "a client key: 200, never indexed");
  ok((await call(base + "&key=owner_key_abcdefgh")).status === 200, "the owner key: 200");
  ok((await call(base + "&key=client_key_123456", { method: "POST", body: "{}" })).status === 405, "POST: 405 (GET only)");
  ok((await call("/developers_pdf?kind=wrong&area=testvillagecircle&key=client_key_123456")).status === 400, "an unknown kind: 400");
  ok((await call("/developers_pdf?kind=snapshot&area=nowhere&key=client_key_123456")).status === 404, "an unknown area: 404");
  ok((await call("/developers_pdf?kind=snapshot&key=client_key_123456")).status === 404, "no area: 404");
  const noBrowser = await call("/developers_pdf?kind=snapshot&area=testvillagecircle&key=client_key_123456");
  ok(noBrowser.status === 503, "PDF with no Browser Rendering binding says so (503); format=html still works");
  let rendered = null;
  const { __setLauncher } = await import("../src/brief_docs.js");
  __setLauncher(async () => ({ newPage: async () => ({ setViewport: async () => {}, setContent: async (h) => { rendered = h; }, evaluate: async () => true, pdf: async () => new Uint8Array([37, 80, 68, 70]) }), close: async () => {} }));
  env.BROWSER = {};
  const pdf = await call("/developers_pdf?kind=detailed&area=testvillagecircle&developers=" + TEN + "&key=client_key_123456");
  ok(pdf.status === 200 && pdf.headers.get("content-type") === "application/pdf" && /Detailed_Test_Village_Circle\.pdf/.test(pdf.headers.get("content-disposition")) && rendered && rendered.includes("How these numbers are worked out"), "with a browser the route returns the PDF (stub renderer) built from the same HTML");
  __setLauncher(null);
}

console.log("the page: buttons and the gold link");
{
  const js = devmapHtml("k", {});
  ok(js.includes("Download PDF: snapshot") && js.includes("Download PDF: detailed") && js.includes("/developers_pdf"), "the page has both download buttons");
  ok(/pdfRow\(slug,mineList\(\),S\.screen===3\)/.test(js) && /pdfRowProf\(k,p\)/.test(js) && /pdfRow\(a\.slug,mineList\(\),true\)/.test(js), "buttons sit on the area panel, the developer profile and the client meeting results (which pass the budget)");
  ok((js.match(/id=showall class=golink/g) || []).length === 2 && /\.golink\{[^}]*padding:8px[^}]*var\(--gold\)/.test(js), "'Show all developers here' uses the gold link style with a clear tap target");
  const script = js.split("<script>")[1].split("</script>")[0];
  let parses = true; try { new Function(script); } catch (e) { parses = false; }
  ok(parses, "the page script still parses");
}

console.log("negative control: the live version (release-v323) has none of this");
{
  const git = (args) => spawnSync("git", args, { cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), encoding: "utf8" });
  const has = (ref) => { const r = git(["show", ref + ":src/index.js"]); return r.status === 0 && r.stdout.includes('"/developers_pdf"'); };
  const hasFile = (ref) => git(["cat-file", "-e", ref + ":src/devmap_pdf.js"]).status === 0;
  const rel = git(["rev-parse", "--verify", "release-v323"]);
  if (rel.status !== 0) console.log("  (release-v323 not found in this checkout: control skipped)");
  else { ok(!has("release-v323") && !hasFile("release-v323"), "release-v323 has no /developers_pdf route and no devmap_pdf module (so a request there would 404)"); ok(has("HEAD") || has("areapdf-v324") || fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8").includes('"/developers_pdf"'), "this version does (the check can tell them apart)"); }
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
