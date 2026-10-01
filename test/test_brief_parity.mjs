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

ok(writes.length === 0, "nothing is written to KV");
console.log((fail ? "FAIL" : "PASS") + " - brief parity: " + pass + " ok, " + fail + " failed");
process.exit(fail ? 1 : 0);
