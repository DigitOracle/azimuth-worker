// v289 - every card in every Brief document carries a picture of THAT building, on a REAL DAMAC Hills brief.
//
// Kendall, 2 Oct 2026: Naj ran START -> the Brief for DAMAC Hills, to rent, must-haves pool and pets, and the PDF had "no pictures".
// v285 had promised a picture on every card (developer photo, else the Blocks view, else a district view) and test_brief_parity.mjs
// counted the district view as "a picture". It is not one: every DAMAC Hills villa and townhouse result is a "dld:" register community
// (DAMAC HILLS - TOPANGA, - PELHAM, ...) with no app building and no position, so EVERY card was the same whole-district view with
// nothing picked out, and the overview map said "Map to follow". The communities' footprints were in KV all along: the district model
// (img_anchors_damachills) tags each footprint with its Land Department sub-community, and the layer's footprint ids are the anchors' i.
//
// What this proves, on the real rent index, anchors and district layer (naj-market-pulse data + scripts/brief_map_layers.py output):
//   1. for every row of two real DAMAC Hills briefs (villas/townhouses 3+ beds, and 2-3 beds any type; both must: pool, pets), the
//      Compare 10 card, the Full pack card and the Individual dossier's page 1 show the picture the data allows - a developer photo or
//      the building's own Blocks view where it has an app building; the community's own homes (blocks_area) where the district model
//      names its sub-community EXACTLY; the district view ONLY where neither exists - never "photos to follow"
//   2. the gold footprints of a community card are exactly the anchors whose sub-community is the record's own name (never a sibling:
//      Brookfield-1 does not borrow Brookfield-2's homes), and a "dld:" key /brief_api unbound from an app building borrows nothing
//   3. the overview map and the dossier's page-2 map are drawn (no "Map to follow") and say "approximate area"
//   4. a district layer stored gzipped still reads (the layer now goes through the gzip-aware kvJson)
// NEGATIVE CONTROL (against the live source): NEG_LIVE=1 node test/test_v289_brief_pictures.mjs fetches the same Compare 10 from the
// LIVE worker as HTML (owner key from C:/Dev/azimuth-listener-naj/.env, never printed) and requires that the same checker REJECTS it
// while the live worker is v288 or older. Offline negative control: in markOf (src/brief_docs.js) drop the areaIds branch, and checks
// 1-3 fail.
//
//   node test/test_v289_brief_pictures.mjs   (skips, passing, when the naj-market-pulse data or the layer is not on this machine)
import worker from "../src/index.js";
import { __setLauncher, buildDocument, parseQuery } from "../src/brief_docs.js";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { tmpdir } from "node:os";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 600) : "")); } };

const NAJ = process.env.NAJ_DATA || "C:/Dev/naj-market-pulse/data";
const LAY = process.env.BRIEF_LAYERS || path.join(tmpdir(), "brief_layers");
const DH = "damachills";
const F = { ri: path.join(NAJ, "board", "rent_index.json"), anchors: path.join(NAJ, "names", "anchors_" + DH + ".json"), layer: path.join(LAY, "brief_fp_" + DH + ".json") };
const missing = Object.values(F).filter((f) => !fs.existsSync(f));
if (missing.length) { console.log("  skip - real data not here: " + missing.join(", ") + "\nPASS - v289 brief pictures: skipped"); process.exit(0); }

const store = new Map();
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); if (t === "arrayBuffer") return typeof v === "string" ? new TextEncoder().encode(v).buffer : v; return typeof v === "string" ? v : new TextDecoder().decode(v); },
  async put(k) { writes.push(k); }, async delete() {},
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })) }; },
};
let writes = [];
const rd = (f) => fs.readFileSync(f, "utf8");
store.set("img_rent_index", rd(F.ri));
store.set("img_anchors_" + DH, rd(F.anchors));
store.set("img_brief_fp_" + DH, rd(F.layer));
for (const f of ["districts_geo", "amenities", "unitmix_" + DH, "units_" + DH, "tenancy_" + DH]) { const p = path.join(NAJ, "board", f + ".json"); if (fs.existsSync(p)) store.set("img_" + f, rd(p)); }

let printed = [];
__setLauncher(async () => ({ async newPage() { return { async setViewport() {}, async setContent(h) { printed.push(h); }, async evaluate() { return true; }, async pdf() { return new TextEncoder().encode("%PDF-1.7 stub"); } }; }, async close() {} }));
const READ = "read_key_for_the_owner_1234567890", CLIENT = "client_key_in_links_12345", ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: ORIGIN, BROWSER: { fetch() {} } };
const realFetch = globalThis.fetch;
globalThis.fetch = async () => new Response("{}", { status: 200 });
const call = (p) => worker.fetch(new Request(ORIGIN + p), env, { waitUntil() {} });
const api = async (qs) => (await call("/brief_api?" + qs + "&key=" + CLIENT)).json();
async function pdfHtml(qs) { printed = []; const r = await call("/brief_pdf?" + qs + "&key=" + CLIENT); return { status: r.status, html: printed[0] || "" }; }

// ---- the expectation, worked out from the data independently of src/brief_docs.js ---------------------------------------------
const norm = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const ANCH = JSON.parse(rd(F.anchors)).anchors;
const byCommunity = new Map();
for (const a of ANCH) if (a.cluster) { const k = norm(a.cluster); if (!byCommunity.has(k)) byCommunity.set(k, []); byCommunity.get(k).push(a.i); }
const expected = (row) => row.app_id != null ? ["photo", "blocks"] : byCommunity.has(norm(row.name)) ? ["blocks_area"] : ["district"];
const kindOf = (c) => /<img [^>]*\/img\/bph_/.test(c) ? "photo" : ((/<div class="blocksview" data-kind="(\w+)"/.exec(c) || [])[1] || "none");
const cardsOf = (html) => html.split('<div class="bcard"').slice(1).map((c) => c.split('class="sheet page')[0]);
// the checker: one message per card whose picture is not the one the data allows
function checkCards(html, rows) {
  const cards = cardsOf(html), bad = [];
  if (cards.length !== rows.length) bad.push("cards " + cards.length + " for " + rows.length + " rows");
  rows.forEach((row, k) => {
    const c = cards[k] || "", kind = kindOf(c), want = expected(row);
    if (!want.includes(kind) || /photos<br>to follow/i.test(c)) bad.push(row.name + ": " + kind + ", wanted " + want.join("/"));
  });
  return bad;
}

const BRIEFS = [
  ["DAMAC Hills villas/townhouses 3+ beds, must: pool, pets", "mode=rent&beds=3&min=0&type=villa,townhouse&furnished=either&musts=community_pool,pets&areas=" + DH],
  ["DAMAC Hills 2-3 beds any type, must: pool, pets", "mode=rent&beds=2,3&min=0&type=apartment,villa,townhouse&furnished=either&musts=community_pool,pets&areas=" + DH],
];
const tally = {};
let wantArea = 0;
let firstCompare = null;
for (const [label, bq] of BRIEFS) {
  const rows = ((await api(bq + "&limit=10")).results || []).slice(0, 10);
  ok(rows.length >= 5, label + ": the list has " + rows.length + " buildings");
  const keys = rows.map((x) => encodeURIComponent(x.key)).join(",");
  if (!firstCompare) firstCompare = { bq, rows };

  // Compare 10 (and Compare 5 is the same page with fewer cards)
  const cmp = await pdfHtml("kind=compare&keys=" + keys + "&" + bq);
  const bad = checkCards(cmp.html, rows);
  ok(cmp.status === 200 && !bad.length, label + ": Compare " + rows.length + " - every card has the picture its data allows", bad.join(" | "));
  const c5 = await pdfHtml("kind=compare&keys=" + rows.slice(0, 5).map((x) => encodeURIComponent(x.key)).join(",") + "&" + bq);
  ok(c5.status === 200 && !checkCards(c5.html, rows.slice(0, 5)).length, label + ": Compare 5 likewise", checkCards(c5.html, rows.slice(0, 5)).join(" | "));
  for (const row of rows) { const k = kindOf(cardsOf(cmp.html)[rows.indexOf(row)] || ""); tally[k] = (tally[k] || 0) + 1; if (expected(row)[0] === "blocks_area") wantArea++; }
  const anyArea = rows.some((r) => expected(r)[0] === "blocks_area");
  const mapPage = cmp.html.split('class="sheet page land"').slice(2).join("");
  ok(!/Map to follow/.test(mapPage) && /<svg[^>]*viewBox="0 0 1500 1000"/.test(mapPage) && (!anyArea || /approximate area/.test(mapPage)),
    label + ": the overview map is drawn" + (anyArea ? " and marks the communities as an approximate area" : ""), mapPage.slice(0, 200));

  // Full pack: the one-sheet cards AND each building's dossier page 1
  const pk = await pdfHtml("kind=pack&keys=" + keys + "&" + bq);
  const pbad = checkCards(pk.html, rows);
  ok(pk.status === 200 && !pbad.length, label + ": Full pack - every card has the picture its data allows", pbad.join(" | "));
  ok(!/Photos to follow/.test(pk.html), label + ": Full pack - no dossier page 1 says \"Photos to follow\"");

  // Individual PDFs: one dossier per building
  const dbad = [];
  for (const row of rows) {
    const d = await pdfHtml("kind=dossier&keys=" + encodeURIComponent(row.key) + "&" + bq);
    const hero = (/<div class="blocksview" data-kind="(\w+)" style="width:702px;height:300px;/.exec(d.html) || [])[1] || (/<img [^>]*\/img\/bph_/.test(d.html) ? "photo" : "none");
    const want = expected(row);
    if (d.status !== 200 || !want.includes(hero) || /Photos to follow/.test(d.html)) dbad.push(row.name + ": " + hero);
    if (want[0] === "blocks_area" && (/Map to follow/.test(d.html) || !/approximate area/.test(d.html))) dbad.push(row.name + ": page 2 map missing or unlabelled");
  }
  ok(!dbad.length, label + ": Individual PDFs - every dossier's page 1 picture (and a community's page-2 map)", dbad.join(" | "));
}
console.log("  # DAMAC Hills Compare cards by picture: " + JSON.stringify(tally));
// on the 2 Oct data: 9 of the 20 cards are communities the district model names (live v288: all 9 were the bare district view)
ok(wantArea >= 9 && tally.blocks_area === wantArea, "the communities now carry their own homes (" + (tally.blocks_area || 0) + " of " + wantArea + " community cards across the two briefs)");

// ---- 2. never another building ---------------------------------------------------------------------------------------------------
{
  const q = parseQuery(new URL("https://x/brief_pdf?kind=compare&keys=dld:damachillstopanga,dld:damachillsbrookfield1,dld:damachillsbrookfield2,dld:damachillsartesia&" + BRIEFS[0][1]));
  const doc = await buildDocument(env, q, {});
  const R = Object.fromEntries(doc.C.recs.map((r) => [r.key, r]));
  const same = (a, b) => JSON.stringify([...(a || [])].sort((x, y) => x - y)) === JSON.stringify([...(b || [])].sort((x, y) => x - y));
  const top = R["dld:damachillstopanga"];
  ok(top && top.picSource === "blocks_area" && same(top.areaIds, byCommunity.get(norm("DAMAC HILLS -  TOPANGA"))),
    "Topanga's gold homes are exactly the " + (byCommunity.get(norm("DAMAC HILLS -  TOPANGA")) || []).length + " footprints the district model files under DAMAC HILLS - TOPANGA");
  ok(top && top.areaIds.every((i) => norm((ANCH.find((a) => a.i === i) || {}).cluster) === norm(top.it.n)), "and every one of them is filed under Topanga, none under another community");
  const b1 = R["dld:damachillsbrookfield1"], b2 = R["dld:damachillsbrookfield2"];
  ok(b1 && !b1.areaIds && b1.picSource === "district" && b2 && b2.picSource === "blocks_area",
    "Brookfield-1 does not borrow Brookfield-2's homes (exact name only: the district model files none under Brookfield-1)", b1 && b1.picSource);
  const art = R["dld:damachillsartesia"];
  ok(art && art.it.unbound && !art.areaIds && art.picSource === "district", "a dld: key /brief_api unbound from its app building (Artesia, app 679) borrows no footprint", art && art.picSource);
}

// ---- 4. a gzipped layer still reads -------------------------------------------------------------------------------------------
{
  store.set("img_brief_fp_" + DH, new Uint8Array(zlib.gzipSync(Buffer.from(rd(F.layer)))).buffer);
  const r = await pdfHtml("kind=compare&keys=" + encodeURIComponent("dld:damachillstopanga") + ",damachills:679&" + BRIEFS[1][1]);
  ok(/data-kind="blocks_area"/.test(r.html) && /data-kind="blocks"/.test(r.html), "a district layer stored gzipped still gives the Blocks views");
  store.set("img_brief_fp_" + DH, rd(F.layer));
}

// ---- NEGATIVE CONTROL against the live source (opt-in) ------------------------------------------------------------------------
if (process.env.NEG_LIVE === "1") {
  let key = process.env.BRIEF_LIVE_KEY || "";
  try { if (!key) key = ((/^READ_KEY=(.*)$/m.exec(fs.readFileSync("C:/Dev/azimuth-listener-naj/.env", "utf8")) || [])[1] || "").trim().replace(/^["']|["']$/g, ""); } catch (e) {}
  if (!key) console.log("  skip - NEG_LIVE: no owner key");
  else {
    const { bq, rows } = firstCompare;
    const u = ORIGIN + "/brief_pdf?kind=compare&format=html&keys=" + rows.map((x) => encodeURIComponent(x.key)).join(",") + "&" + bq + "&key=" + encodeURIComponent(key);
    const res = await realFetch(u);
    const html = await res.text();
    const bad = checkCards(html, rows);
    ok(res.status === 200 && bad.length > 0, "NEGATIVE CONTROL: the LIVE worker's Compare " + rows.length + " fails this checker (" + bad.length + " cards wrong, e.g. " + (bad[0] || "-") + ")",
      "live status " + res.status + "; if the fix is deployed this control is expected to flip");
  }
}

ok(writes.length === 0, "nothing is written to KV");
console.log((fail ? "FAIL" : "PASS") + " - v289 brief pictures: " + pass + " ok, " + fail + " failed");
process.exit(fail ? 1 : 0);
