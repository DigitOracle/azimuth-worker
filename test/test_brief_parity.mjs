// THE BRIEF - the "one-bedrooms left" estimate is IDENTICAL on the /brief list (GET /brief_api, src/brief.js) and in the documents
// (GET /brief_pdf, src/brief_docs.js). Kendall, 30 Sep 2026: the list reads the beds-left register (img_beds_left_<district>) first; the
// PDFs had re-implemented only the old gated tenancy path, so every JVC PDF said "No estimate yet" while the list showed figures.
// Both now call estimateLeft() in src/brief.js. This test proves it on REAL data:
//   KV = the real rent index, districts, JVC unit-mix and tenancy files (naj-market-pulse data/board) + the REAL register file
//   data/dld/beds_left/beds_left_jumeirahvillagecircle.json as img_beds_left_jumeirahvillagecircle.
//   1. the ten JVC buildings /brief_api lists for "1-bed, AED 60-68K" (the reference question): each dossier's page-2 box prints exactly the /brief_api row's
//      {about, of} (Binghatti Amber jumeirahvillagecircle:1503 "about 380" of 502; Binghatti Nova "about 140" of 178), or - where the row
//      withholds - "No estimate yet for this building"
//   2. the one-sheet card carries "Still filling" exactly where there is an estimate AND T - R > T / 2 (T=100, R=60: no line)
//   3. a building genuinely not in the register: the list withholds and the PDF says "No estimate yet for this building"
// NEGATIVE CONTROL (run by hand, see the commit message): make brief_docs.js compute its own estimate again and this file fails.
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
const box = (h) => { const m = /<div class="leftbox"[\s\S]*?<\/div><\/div>/.exec(h); return m ? m[0] : ""; };
const boxSays = (b) => { const m = /about (\d+)<\/span><span[^>]*>of (\d+) one-bedroom flats/.exec(b); return m ? [+m[1], +m[2]] : /No estimate yet for this building/.test(b) ? "none" : "?"; };

// ---- 1. the ten JVC keys: the list row and the dossier agree -------------------------------------------------------------------
const list = await api(Q + "&areas=" + JVC + "&limit=10");
const rows = list.results || [];
ok(rows.length === 10, "/brief_api lists ten JVC buildings for 1-bed AED 60-68K", rows.length);
const said = {};
for (const r of rows) {
  const want = r.estimated_left ? [r.estimated_left.about, r.estimated_left.of] : "none";
  const { status, html } = await pdfHtml("kind=dossier&keys=" + encodeURIComponent(r.key));
  const got = boxSays(box(html));
  said[r.name + " " + r.key] = JSON.stringify(got);
  ok(status === 200 && JSON.stringify(got) === JSON.stringify(want), r.name + " (" + r.key + "): the PDF box says " + JSON.stringify(got) + ", the list row " + JSON.stringify(want), box(html).slice(0, 400));
  if (r.estimated_left) ok(html.includes("contracts running on " + r.estimated_left.as_at) && /An estimate, not a count\./.test(box(html)), r.name + ": the dossier dates it to the register (" + r.estimated_left.as_at + ") and labels it an estimate, not a count");
}
console.log("  dossier boxes: " + JSON.stringify(said));
const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
const amber = byKey[JVC + ":1503"];
ok(amber && amber.name === "Binghatti Amber" && amber.estimated_left && amber.estimated_left.about === 380 && amber.estimated_left.of === 502, "Binghatti Amber (jumeirahvillagecircle:1503) is in the ten, listed as about 380 of 502", JSON.stringify(amber && amber.estimated_left));
ok(JSON.stringify(boxSays(box((await pdfHtml("kind=dossier&keys=" + JVC + ":1503")).html))) === "[380,502]", "and its dossier prints \"about 380\" of 502");
const nova = rows.find((r) => r.name === "Binghatti Nova");
ok(nova && nova.estimated_left && nova.estimated_left.about === 140 && nova.estimated_left.of === 178, "Binghatti Nova is listed as about 140 of 178", JSON.stringify(nova && nova.estimated_left));
ok(nova && JSON.stringify(boxSays(box((await pdfHtml("kind=dossier&keys=" + nova.key)).html))) === "[140,178]", "and its dossier prints \"about 140\" of 178");
ok(rows.filter((r) => r.estimated_left).length >= 8, "the register gives most of the ten an estimate (it is no longer 'No estimate yet' on every JVC PDF)", rows.filter((r) => r.estimated_left).length);

// ---- 2. the one-sheet: "Still filling" on exactly the buildings with an estimate --------------------------------------------------
const { html: os } = await pdfHtml("kind=onesheet&keys=" + rows.map((r) => encodeURIComponent(r.key)).join(","));
const cards = os.split('<div class="bcard"').slice(1);
ok(cards.length === 10, "the one-sheet has ten cards", cards.length);
const FILL_RX = /Still filling: most of its 1-beds have no running tenancy on the government register\*/;
const fillWant = rows.map((r) => !!r.estimated_left && r.estimated_left.of - r.estimated_left.running > r.estimated_left.of / 2), fillGot = cards.map((c) => FILL_RX.test(c));
ok(JSON.stringify(fillWant) === JSON.stringify(fillGot), "\"Still filling\" shows on every card whose building has an estimate with more than half its flats untenanted, and on no other", JSON.stringify({ fillWant, fillGot }));
ok(!fillGot.some(Boolean) || /\*Dubai Land Department units list and tenancy register/.test(os), "and the asterisk's small print is there");
// the sentence says "most": T = 100, R = 60 has an estimate (about 40 of 100) but most flats DO have a tenancy -> no line; R = 40 -> the line
const withNova = async (T, R) => {
  store.set("img_beds_left_" + JVC, JSON.stringify(Object.assign({}, REGISTER, { rows: REGISTER.rows.map((r) => r.key === nova.key && String(r.beds) === "1" ? Object.assign({}, r, { T, R }) : r) })));
  const row = ((await api(Q + "&areas=" + JVC + "&limit=10")).results || []).find((r) => r.key === nova.key);
  const card = (await pdfHtml("kind=onesheet&keys=" + nova.key)).html.split('<div class="bcard"')[1] || "";
  const b = box((await pdfHtml("kind=dossier&keys=" + nova.key)).html);
  store.set("img_beds_left_" + JVC, JSON.stringify(REGISTER));
  return { est: row && row.estimated_left, fill: FILL_RX.test(card), box: boxSays(b) };
};
const r60 = await withNova(100, 60);
ok(r60.est && r60.est.about === 40 && JSON.stringify(r60.box) === "[40,100]" && !r60.fill, "T=100, R=60: list and dossier both say about 40 of 100, and the card has NO 'Still filling' line", JSON.stringify(r60));
const r40 = await withNova(100, 40);
ok(r40.est && r40.est.about === 60 && JSON.stringify(r40.box) === "[60,100]" && r40.fill, "T=100, R=40: about 60 of 100, and the card says 'Still filling'", JSON.stringify(r40));

// ---- 3. a building genuinely not in the register -------------------------------------------------------------------------------
const drop = nova.key, dropName = nova.name;
store.set("img_beds_left_" + JVC, JSON.stringify(Object.assign({}, REGISTER, { rows: REGISTER.rows.filter((r) => r.key !== drop && r.app_key !== drop && !/binghatti nova/i.test(String(r.dld_project) + " " + String(r.name))) })));
const gone = ((await api(Q + "&areas=" + JVC + "&limit=10")).results || []).find((r) => r.key === drop);
ok(gone && !gone.estimated_left && /not in the beds-left register/.test(gone.estimated_left_withheld || ""), dropName + " taken out of the register: the list withholds it, and says why", JSON.stringify(gone && gone.estimated_left_withheld));
const nb = box((await pdfHtml("kind=dossier&keys=" + drop)).html);
ok(/No estimate yet for this building/.test(nb) && /not in the beds-left register/.test(nb) && !/about \d/.test(nb), "and the dossier says \"No estimate yet for this building\" - never the old gated figure, never a zero", nb.slice(0, 400));
store.set("img_beds_left_" + JVC, JSON.stringify(REGISTER));

ok(writes.length === 0, "nothing is written to KV");
console.log((fail ? "FAIL" : "PASS") + " - brief parity: " + pass + " ok, " + fail + " failed");
process.exit(fail ? 1 : 0);
