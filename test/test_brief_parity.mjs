// THE BRIEF - parity between the /brief list (GET /brief_api, src/brief.js) and the documents (GET /brief_pdf, src/brief_docs.js),
// on REAL data: the real rent index, districts, JVC unit-mix and tenancy files (naj-market-pulse data/board) + the REAL register file
// data/dld/beds_left/beds_left_jumeirahvillagecircle.json as img_beds_left_jumeirahvillagecircle.
//
// v277 (Kendall, 1 Oct 2026): the register "left" estimate is OFF THE CLIENT FACE. Kendall found "Still filling: most of its 1-beds have
// no running tenancy on the government register" unhelpful. So parity now means:
//   1. the API STILL returns estimated_left for the ten JVC buildings (estimateLeft() in src/brief.js is kept, the data code untouched:
//      Binghatti Amber about 380 of 502, Binghatti Nova about 140 of 178, as before)
//   2. NONE of it reaches a document: no ESTIMATED ONE-BEDROOMS LEFT box on any dossier's page 2, no "Still filling" on any one-sheet
//      card, no "an estimate, not a count", no T/R figures - for every one of the ten, with the register ON FILE
//   3. where a developer's own sheet names a building, the list row and the dossier's page 2 carry the SAME developer availability
//      (developer, date, count), and no other row or page carries anything
// NEGATIVE CONTROL (run by hand, see the commit message): put the "Still filling" line back in oneSheetCards (src/brief_docs.js) and this
// file fails on check 2.
//
//   node test/test_brief_parity.mjs      (skips, passing, when the naj-market-pulse data is not on this machine; set NAJ_DATA)
import worker from "../src/index.js";
import { __setLauncher } from "../src/brief_docs.js";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 600) : "")); } };

const NAJ = process.env.NAJ_DATA || "C:/Dev/naj-market-pulse/data";
const JVC = "jumeirahvillagecircle";
const REG = path.join(NAJ, "dld", "beds_left", "beds_left_" + JVC + ".json");
const need = [path.join(NAJ, "board", "rent_index.json"), path.join(NAJ, "board", "unitmix_" + JVC + ".json"), REG];
if (need.some((f) => !fs.existsSync(f))) { console.log("  skip - the naj-market-pulse data is not here (" + need.filter((f) => !fs.existsSync(f)).join(", ") + ")\nPASS - brief parity: skipped"); process.exit(0); }

const store = new Map();
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); if (t === "arrayBuffer") return typeof v === "string" ? new TextEncoder().encode(v).buffer : v; return typeof v === "string" ? v : new TextDecoder().decode(v); },
  async put(k) { writes.push(k); }, async delete() {},
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })) }; },
};
let writes = [];
const rd = (f) => fs.readFileSync(f, "utf8");
store.set("img_rent_index", rd(path.join(NAJ, "board", "rent_index.json")));
for (const f of ["districts_geo", "amenities", "unitmix_" + JVC, "tenancy_" + JVC]) { const p = path.join(NAJ, "board", f + ".json"); if (fs.existsSync(p)) store.set("img_" + f, rd(p)); }
const REGISTER = JSON.parse(rd(REG));
store.set("img_beds_left_" + JVC, JSON.stringify(REGISTER));

let printed = [];
__setLauncher(async () => ({ async newPage() { return { async setViewport() {}, async setContent(h) { printed.push(h); }, async evaluate() { return true; }, async pdf() { return new TextEncoder().encode("%PDF-1.7 stub"); } }; }, async close() {} }));
const READ = "read_key_for_the_owner_1234567890", CLIENT = "client_key_in_links_12345", ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: ORIGIN, BROWSER: { fetch() {} } };
globalThis.fetch = async () => new Response("{}", { status: 200 });
const call = (p) => worker.fetch(new Request(ORIGIN + p), env, { waitUntil() {} });
const Q = "mode=rent&beds=1&min=60000&max=68000";   // the reference question of test_brief_api.mjs (Binghatti Amber ranks first)
const api = async (qs) => (await call("/brief_api?" + qs + "&key=" + CLIENT)).json();
async function pdfHtml(qs) { printed = []; const r = await call("/brief_pdf?" + qs + "&" + Q + "&key=" + CLIENT); return { status: r.status, html: printed[0] || "" }; }
// anything of the old estimate: the box, its label, its wording, the card line, the asterisk small print
const ESTIMATE_RX = /ESTIMATED [A-Z -]*LEFT|class="leftbox"|an estimate, not a count|No estimate yet|no running tenancy|Still filling|rounded to the nearest ten|owners living in their own flat|\*Dubai Land Department units list/i;
const abox = (h) => { const m = /<div class="availbox"[\s\S]*?<\/div><\/div>/.exec(h); return m ? m[0] : ""; };

// ---- 1. the API still carries the estimate --------------------------------------------------------------------------------
const list = await api(Q + "&areas=" + JVC + "&limit=10");
const rows = list.results || [];
ok(rows.length === 10, "/brief_api lists ten JVC buildings for 1-bed AED 60-68K", rows.length);
const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
const amber = byKey[JVC + ":1503"], nova = rows.find((r) => r.name === "Binghatti Nova");
ok(amber && amber.name === "Binghatti Amber" && amber.estimated_left && amber.estimated_left.about === 380 && amber.estimated_left.of === 502, "the API still returns estimated_left for Binghatti Amber: about 380 of 502 (the data code is untouched)", JSON.stringify(amber && amber.estimated_left));
ok(nova && nova.estimated_left && nova.estimated_left.about === 140 && nova.estimated_left.of === 178, "and for Binghatti Nova: about 140 of 178", JSON.stringify(nova && nova.estimated_left));
ok(rows.filter((r) => r.estimated_left).length >= 8, "the register gives most of the ten an estimate in the JSON", rows.filter((r) => r.estimated_left).length);

// ---- 2. none of it reaches a document ------------------------------------------------------------------------------------
for (const r of rows) {
  const { status, html } = await pdfHtml("kind=dossier&keys=" + encodeURIComponent(r.key));
  const m = ESTIMATE_RX.exec(html);
  ok(status === 200 && !m && !new RegExp("about " + (r.estimated_left ? r.estimated_left.about : 0) + "<").test(html), r.name + " (" + r.key + "): the dossier prints no estimate" + (r.estimated_left ? " although the API says about " + r.estimated_left.about + " of " + r.estimated_left.of : ""), m && m[0]);
}
const { html: os } = await pdfHtml("kind=onesheet&keys=" + rows.map((r) => encodeURIComponent(r.key)).join(","));
const cards = os.split('<div class="bcard"').slice(1);
ok(cards.length === 10, "the one-sheet has ten cards", cards.length);
ok(!ESTIMATE_RX.test(os), "and not one card carries 'Still filling', nor the sheet its asterisk small print", (ESTIMATE_RX.exec(os) || [""])[0]);
const { html: pk } = await pdfHtml("kind=pack&keys=" + rows.slice(0, 3).map((r) => encodeURIComponent(r.key)).join(","));
ok(!ESTIMATE_RX.test(pk), "nor the full pack anywhere (sheet, map, three dossiers, appendix)", (ESTIMATE_RX.exec(pk) || [""])[0]);

// ---- 3. developer availability: the same on the list row and on page 2, and nowhere else ---------------------------------------
// a developer's sheet naming Binghatti Nova, in the shape build_avail_index.py publishes (img_avail_index -> img_drill_<d>.claimed)
store.set("img_avail_index", JSON.stringify({ updated: "2026-09-30", sheets: [{ sheet: "Binghatti 2026-09-08", note: "3 units · 1 project", mapped: true, d: "binghatti" }] }));
store.set("img_drill_binghatti", JSON.stringify({ title: "Binghatti (all projects)", claimed: { as_of: "2026-09-08", source: "Binghatti sheets", rooms: [], detail: [
  { p: "Binghatti Nova", as_of: "2026-09-08", units: [["BN-1203", "1 B/R", 741.1, 1250000, "Pool"], ["BN-1403", "1 B/R", 741.1, 1262000, ""], ["BN-0801", "2 B/R", 1100, 1900000, ""]] } ] } }));
const list2 = (await api(Q + "&areas=" + JVC + "&limit=10")).results || [];
const nv = list2.find((r) => r.name === "Binghatti Nova");
ok(nv && nv.developer_availability && nv.developer_availability.developer === "Binghatti" && nv.developer_availability.as_of === "2026-09-08" && nv.developer_availability.count === 2, "the list row: Binghatti's sheet of 2026-09-08, 2 one-bedrooms", JSON.stringify(nv && nv.developer_availability));
ok(list2.filter((r) => r.developer_availability).length === 1, "and no other row carries one");
const nvDoc = (await pdfHtml("kind=dossier&keys=" + nv.key)).html, nb = abox(nvDoc);
ok(nb.includes("Available now, per Binghatti&rsquo;s sheet of 8 September 2026: 2 one-bedrooms.") && nb.includes("BN-1203") && nb.includes("BN-1403") && !nb.includes("BN-0801"), "its dossier's page 2 says the same: Binghatti, 8 September 2026, 2 one-bedrooms, with those two rows", nb.slice(0, 400));
ok(!ESTIMATE_RX.test(nvDoc), "and still no estimate beside it: the two sources are never mixed");
for (const r of list2.filter((x) => x.key !== nv.key).slice(0, 3)) {
  const h = (await pdfHtml("kind=dossier&keys=" + encodeURIComponent(r.key))).html;
  ok(!abox(h) && !/availab/i.test(h.replace(/Availability, the rent and the actual flat/g, "")), r.name + ": no sheet names it, so page 2 shows no availability at all - no placeholder, no 'to follow'");
}
store.delete("img_avail_index"); store.delete("img_drill_binghatti");

// ---- 4. v285: the screen and the PDF give the SAME figures, on real rent-index rows ------------------------------------------------
// Kendall, 1 Oct 2026, filming: Capital Bay A's card said "typical rent AED 50k, middle half 49k-51k, 9 lettings (4 new)" and the PDF of
// the same brief said "AED 55,000, middle half 50,000-55,650". The PDF read every contract (m, q1, q3), the list the new lettings
// (mn, q1n, q3n - 3 or more of them). Now both read rentFigure() in src/brief.js. For EVERY building of two real briefs (the Business
// Bay studio brief Kendall filmed, and the JVC reference brief), the compare PDF's card and the dossier's page 1 must carry exactly the
// list row's typical rent, middle half and count; and every card must have a picture (the developer's photograph or the building's
// Blocks view), never "photos to follow" for a building with a footprint.
// NEGATIVE CONTROL (run by hand, see the commit message): in loadContext (src/brief_docs.js) set `st = pick.s` (the raw all-contracts
// figures) and Capital Bay A and every row with fewer new lettings than contracts fail here.
{
  const BB = "businessbay";
  const LAY = process.env.BRIEF_LAYERS || path.join(tmpdir(), "brief_layers");   // scripts/brief_map_layers.py's dry-run output
  const bbFiles = [path.join(NAJ, "board", "unitmix_" + BB + ".json"), path.join(NAJ, "dld", "beds_left", "beds_left_" + BB + ".json")];
  if (bbFiles.some((f) => !fs.existsSync(f))) console.log("  skip - Business Bay data not here: " + bbFiles.filter((f) => !fs.existsSync(f)).join(", "));
  else {
    store.set("img_unitmix_" + BB, rd(bbFiles[0])); store.set("img_beds_left_" + BB, rd(bbFiles[1]));
    for (const f of ["tenancy_" + BB, "units_" + BB]) { const p = path.join(NAJ, "board", f + ".json"); if (fs.existsSync(p)) store.set("img_" + f, rd(p)); }
    const haveLayers = [BB, JVC].every((d) => fs.existsSync(path.join(LAY, "brief_fp_" + d + ".json")));
    if (haveLayers) for (const d of [BB, JVC]) store.set("img_brief_fp_" + d, rd(path.join(LAY, "brief_fp_" + d + ".json")));
    else console.log("  skip (pictures only) - no district layers in " + LAY + " (python scripts/brief_map_layers.py --district " + BB + " " + JVC + ")");
    const money = (s) => Number(String(s).replace(/,/g, ""));
    const BRIEFS = [["Business Bay studios AED 50-70K, must: metro", "mode=rent&beds=studio&min=50000&max=70000&areas=" + BB + "&musts=metro&type=apartment"], ["JVC one-bedrooms AED 60-68K", Q + "&areas=" + JVC]];
    for (const [label, bq] of BRIEFS) {
      const rows4 = (await api(bq + "&limit=10")).results || [];
      ok(rows4.length === 10, label + ": the list has ten buildings", rows4.length);
      printed = [];
      const r4 = await call("/brief_pdf?kind=compare&keys=" + rows4.map((x) => encodeURIComponent(x.key)).join(",") + "&" + bq + "&key=" + CLIENT);
      const cards4 = (printed[0] || "").split('<div class="bcard"').slice(1).map((c) => c.split('class="sheet page')[0]);   // the last card ends where the map page starts
      ok(r4.status === 200 && cards4.length === rows4.length, label + ": the compare PDF has one card per row", r4.status + " " + cards4.length);
      let same = 0, pics = 0;
      for (let k = 0; k < rows4.length; k++) {
        const row = rows4[k], e = row.evidence, c = cards4[k] || "";
        const m = /AED ([\d,]+)<\/span><span[^>]*>typical a year/.exec(c), mh = /Middle half AED ([\d,]+)&ndash;([\d,]+)/.exec(c), n = /(\d+) \((\d+) new\) recent lettings/.exec(c);
        const cardOk = m && mh && n && money(m[1]) === e.median && money(mh[1]) === e.q1 && money(mh[2]) === e.q3 && +n[1] === e.n && +n[2] === e.n_new;
        printed = [];
        await call("/brief_pdf?kind=dossier&keys=" + encodeURIComponent(row.key) + "&" + bq + "&key=" + CLIENT);
        const dh = printed[0] || "";
        const dm = /RENT A YEAR<\/div><div class="serif"[^>]*>AED ([\d,]+)<\/div>/.exec(dh), dmh = /<div[^>]*>AED ([\d,]+) &ndash; ([\d,]+)<\/div><\/div>/.exec(dh), dn = />(\d+) \((\d+) new\)<\/div>/.exec(dh);
        const dosOk = dm && dmh && dn && money(dm[1]) === e.median && money(dmh[1]) === e.q1 && money(dmh[2]) === e.q3 && +dn[1] === e.n && +dn[2] === e.n_new;
        ok(cardOk && dosOk, label + " - " + row.name + " (" + row.key + "): card and dossier = the list row: AED " + e.median + ", " + e.q1 + "-" + e.q3 + ", " + e.n + " (" + e.n_new + " new), " + e.median_of,
          "card " + (m && m[1]) + " " + (mh && mh.slice(1).join("-")) + " " + (n && n.slice(1).join("/")) + " | dossier " + (dm && dm[1]) + " " + (dmh && dmh.slice(1).join("-")) + " " + (dn && dn.slice(1).join("/")));
        if (cardOk && dosOk) same++;
        if (haveLayers) {
          const kind = /<img [^>]*\/img\/bph_/.test(c) ? "photo" : ((/<div class="blocksview" data-kind="(\w+)"/.exec(c) || [])[1] || "none");
          const footprinted = row.app_id != null;
          ok(kind !== "none" && !/photos<br>to follow/i.test(c) && (!footprinted || kind === "photo" || kind === "blocks") && (row.app_id != null || !/class="hiblock"/.test(c)),
            label + " - " + row.name + ": the card's picture is " + kind + (footprinted ? " (footprinted)" : " (no app building: never another building's footprint)"), c.slice(0, 200));
          if (kind !== "none") pics++;
        }
      }
      ok(same === rows4.length, label + ": all " + rows4.length + " buildings agree between the screen and the PDF", same + " of " + rows4.length);
      if (haveLayers) ok(pics === rows4.length, label + ": every card has a picture", pics + " of " + rows4.length);
    }
    // the building Kendall saw, by name
    const cb = ((await api(BRIEFS[0][1] + "&limit=10")).results || []).find((x) => /^CAPITAL BAY/i.test(x.name));
    printed = [];
    await call("/brief_pdf?kind=compare&keys=" + encodeURIComponent(cb ? cb.key : "dld:capitalbaya") + "&" + BRIEFS[0][1] + "&key=" + CLIENT);
    ok(cb && cb.evidence.median === 50000 && (printed[0] || "").includes("AED 50,000</span>") && (printed[0] || "").includes("Middle half AED 48,750&ndash;50,500") && (printed[0] || "").includes("9 (4 new) recent lettings") && !(printed[0] || "").includes("55,650"),
      "Capital Bay A on the PDF: AED 50,000, middle half 48,750-50,500, 9 (4 new) - what the screen shows, not the all-contracts 55,000 / 50,000-55,650", cb && JSON.stringify(cb.evidence));
  }
}

ok(writes.length === 0, "nothing is written to KV");
console.log((fail ? "FAIL" : "PASS") + " - brief parity: " + pass + " ok, " + fail + " failed");
process.exit(fail ? 1 : 0);
