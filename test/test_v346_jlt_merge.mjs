// v346 - (1) no developer row runs "sales" into "projects"; (2) Jumeirah Lakes Towers is ONE area (althanyahfifth is an alias of jltnorth; jltsouth is Jumeirah Islands and stays).
import { buildAreaPdf, parseParams } from "../src/devmap_pdf.js";
import { devmapHtml } from "../src/devmap_page.js";
import { DM } from "../src/devmap_dm.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const SQFT = 10.7639, sqm = (psf) => Math.round(psf * SQFT);
const cell = (n, psf, bed) => [n, sqm(psf), Math.round(sqm(psf) * (60 + 25 * bed)), bed];
const W = (n, med, rn, rm, on, om) => [n, sqm(med), rn, sqm(rm), on, sqm(om), n, sqm(med), 0, 0, 45, 75, 130];
const devRec = (name) => { const c = [cell(1303, 1500, 1), cell(200, 1450, 2), cell(40, 1400, 0), cell(30, 1350, 3)]; return { n: name, h: 500, c, b: [[100, sqm(1500), "Acme Tower"]], c12: c, b12: [[100, sqm(1500), "Acme Tower"]], r: [], ev: { all: W(1200, 1400, 0, 1400, 400, 1450), l12: W(570, 1500, 0, 1520, 200, 1480), y: [[2024, 300, sqm(1200)], [2025, 100, sqm(1300)]] } }; };
const mkArea = (name, withEv) => { const a = { name, bbox: [55.13, 25.05, 55.17, 25.08], centre: [55.15, 25.06], devs: { acme: devRec("Acme Developments"), beta: devRec("Beta Homes") } }; if (withEv) a.ev = { all: W(5000, 1100, 0, 1100, 2000, 1100), l12: W(1500, 1200, 0, 1210, 500, 1180), y: [[2024, 1100, sqm(1150)], [2025, 1000, sqm(1200)]] }; return a; };
const mkIndex = () => ({ as_of: "2026-09-09", generated: "2026-09-09", cuts: { bounds: [32292, 22604, 16684], shares: { bounds: [32292, 22604, 16684], window: ["2025-09-01", "2026-09-01"], sales: 1000, n: [9, 20, 35, 36], money: [26, 25, 26, 24] }, rule: "x" },
  devs: { acme: { name: "Acme Developments", areas: 3, n: 570, profile: { projects: 1, homes: 500 } }, beta: { name: "Beta Homes", areas: 3, n: 570, profile: { projects: 1, homes: 500 } } }, alias: {},
  areas: { jltnorth: mkArea("Jumeirah Lake Towers", true), jltsouth: mkArea("Jumeirah Islands", true), althanyahfifth: mkArea("JLT / Al Thanyah 5", false) }, scale: { boutiqueMax: 2, midMax: 4 },
  ev: { as_of: "2026-08-31", since: "2019-01-01", l12_from: "2025-09-01", l12_to: "2026-08-31", source_as_of: "2026-09-17", sales: 5000, filters: "Ordinary sales of homes." } });
const mkEnv = () => { const store = { img_devmap_index: JSON.stringify(mkIndex()) }; const KV = { async get(k) { return store[k] == null ? null : store[k]; }, async put() {}, async delete() {}, async list() { return { keys: [] }; } }; return { MEETINGS: KV, READ_KEY: "owner_key_abcdefgh", CLIENT_KEY: "client_key_123456" }; };
const build = (area, kind) => buildAreaPdf(mkEnv(), parseParams(new URL("https://x/developers_pdf?kind=" + kind + "&window=all&area=" + area + "&developers=acme,beta")), { now: Date.parse("2026-10-04T08:00:00Z") });
const plain = (h) => h.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, "").replace(/&middot;/g, "·");

console.log("job 1 - developer rows keep their figures apart");
for (const kind of ["snapshot", "detailed"]) {
  const d = await build("jltnorth", kind);
  ok(d.status === 200, kind + " builds");
  const rows = d.html.match(/<div class="dl">[\s\S]*?<\/div>/g) || [];
  ok(rows.length > 0, kind + ": developer rows rendered (" + rows.length + ")");
  ok(rows.every((r) => !/sales?\d/.test(plain(r))), kind + ": no developer row contains sale(s)<digit>");
  ok(rows.some((r) => /sales <span>(?:&middot;|·) \d/.test(r.replace(/<\/span>\s*<span>/g, " <span>").replace(/sales<\/span> <span>/g, "sales <span>"))), kind + ": a row with projects has a real separator between sales and projects");
}
ok(/grid-template-columns:12px minmax\(0,1fr\) 78px 62px 66px/.test((await build("jltnorth", "snapshot")).html), "row columns are wide enough for '1,303 sales' and '62 projects'");

console.log("job 2 - Jumeirah Lakes Towers is one area");
{
  const a = await build("althanyahfifth", "snapshot"), b = await build("jltnorth", "snapshot");
  ok(a.status === 200 && a.C.slug === "jltnorth", "the old slug althanyahfifth opens the merged area");
  ok(/Jumeirah Lakes Towers/.test(a.html) && !/Al Thanyah 5/.test(a.html) && !/Jumeirah Lake Towers/.test(a.html), "the PDF says Jumeirah Lakes Towers only");
  ok(plain(a.html) === plain(b.html), "the PDF for the old slug equals the PDF for the new one");
  const s = await build("jltsouth", "snapshot");
  ok(s.status === 200 && s.C.slug === "jltsouth" && /Jumeirah Islands/.test(s.html), "jltsouth is a different area (Jumeirah Islands) and still opens as itself");
  const idx = mkIndex(); DM.mergeAreas(idx);
  ok(Object.keys(idx.areas).sort().join() === "jltnorth,jltsouth" && idx.areas.jltnorth.name === "Jumeirah Lakes Towers", "mergeAreas leaves one Jumeirah Lakes Towers (and Jumeirah Islands), none under the old slug");
  ok(DM.resolveArea("althanyahfifth") === "jltnorth" && DM.resolveArea("AlThanyah-Fifth") === "jltnorth" && DM.resolveArea("jltsouth") === "jltsouth" && DM.resolveArea("jltnorth") === "jltnorth", "resolveArea: old slug to jltnorth, others untouched");
  const only = { areas: { althanyahfifth: mkArea("JLT / Al Thanyah 5", false) } }; DM.mergeAreas(only);
  ok(Object.keys(only.areas).join() === "jltnorth", "an index holding only the old slug still shows one area under the merged slug");
}
console.log("the page script");
{
  const js = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
  ok(js.includes("DM.mergeAreas(IDX)") && js.includes('DM.resolveArea(new URLSearchParams(location.search).get("area"))'), "the page merges the areas and resolves ?area= through the alias");
  ok(/althanyahfifth:"jltnorth"/.test(js), "the alias is in the page script");
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
