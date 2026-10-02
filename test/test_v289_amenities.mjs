// v289 - the amenity facts file in the Brief (Kendall, 2 Oct 2026: a DAMAC Hills brief came back "not known" for pool, pets and gym on
// every home - "we need to know if they have it, 99% do").
//
// naj-market-pulse scripts/build_amenities.py writes data/amenities/amenities_<district>.json, published as KV img_amenities_<district>
// (plain or gzipped). src/brief.js reads it (amenIndex / amenFor / applyAmen inside criteriaOf) for /brief_api, and src/brief_docs.js
// reads the same file for the PDFs. What this proves, through the real worker.fetch and the real document loader:
//   A1 a gzipped file is read; pets, community pool, gym and parking are answered with the level and the source in the words
//      ("... - a community fact, per DAMAC's own DAMAC Hills page (2026-09-18): “...”")
//   A2 a building fact says "a building fact"; an answer the brochure or the unit-mix record already gave stands, and says it is a
//      building fact
//   A3 a home is matched by our key, then by the rent record's DLD key, then by an exact name; a name two homes share answers neither
//   A4 a file "no" is a definite no: a must leaves the building out; "not known" (nothing in the file) still never does
//   A5 the reasons (why) name the level and the source of each must met; the notes say where the facts come from
//   A6 the PDF loader gives the SAME answers and source text as the list, from the same gzipped key; the one-sheet card says the facts
//      by level instead of "Amenities to follow", and a cluster with no map position gives the file's metro fact
//   A7 NEGATIVE CONTROL in the test: with the KV key removed, the same query answers "not known" for pets, community pool and gym
//   A8 against the real file and the real rent index (NAJ_DATA), DAMAC Hills: every result answers pets, community pool, gym and parking
// NEGATIVE CONTROL (run by hand, 2 Oct 2026): make applyAmen() return before reading the file (`if (!af || !af.facts) return out;` ->
// `return out;`) - 13 fail (A1, A1b, A1c, A3, A3c, A4b, A5, A6, A6b, A6c, A7b, A8 at pets 0/18 gym 0/18, A8b); restored - 23 pass.
// (A6d, the metro line, reads the file directly and is not behind applyAmen, so it passes either way.)
//
//   node test/test_v289_amenities.mjs
import worker from "../src/index.js";
import { amenIndex, amenFor, amenSrc, criteriaOf } from "../src/brief.js";
import { loadContext, parseQuery, criteriaRows, oneSheetHtml } from "../src/brief_docs.js";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const NAJ = process.env.NAJ_DATA || "C:/Dev/naj-market-pulse/data";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 600) : "")); } };

const READ = "client_read_key_in_links_123", CLIENT = "a_client_key_for_links_456";
const store = new Map();
const KV = {
  async get(k, t) {
    if (!store.has(k)) return null;
    const v = store.get(k);
    if (t === "arrayBuffer") return typeof v === "string" ? new TextEncoder().encode(v).buffer : v;
    return typeof v === "string" ? v : new TextDecoder().decode(v);
  },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; },
};
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const call = (p) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p), env, { waitUntil() {} });
const brief = async (qs) => { const r = await call("/brief_api?" + qs + "&key=" + CLIENT); return r.status === 200 ? r.json() : { status: r.status, text: await r.text() }; };
const gz = (o) => { const b = zlib.gzipSync(Buffer.from(JSON.stringify(o))); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const crit = (r, k) => (r.criteria || []).find((c) => c.k === k);

// ---- a small DAMAC Hills, in the real shapes --------------------------------------------------------------------------------------
const S = (n, nn, m) => ({ n, nn, nr: n - nn, m, q1: m - 5000, q3: m + 5000, ...(nn ? { mn: m, q1n: m - 5000, q3n: m + 5000 } : {}), s: 200, last: "2026-09-28" });
const D = "damachills";
const RI = { generated: "2026-10-01", as_of: "2026-10-01", window: ["2026-08-01", "2026-09-30"], items: [
  { p: "damachillsrichmond", n: "DAMAC HILLS -  RICHMOND", area: "Al Hebiah Third", d: D, last: "2026-09-18", v: { "3": S(8, 6, 230000) } },
  { p: "damachillstopanga", n: "DAMAC HILLS -  TOPANGA", area: "Al Hebiah Third", d: D, last: "2026-09-25", v: { "3": S(6, 4, 220000) } },
  { p: "damachillscarson", n: "DAMAC HILLS - CARSON", area: "Al Hebiah Third", d: D, i: 1003, lon: 55.243558, lat: 25.024697, last: "2026-09-30", b: { "2": S(12, 9, 120000) } },
  { p: "damachillstwin", n: "DAMAC HILLS - TWIN", area: "Al Hebiah Third", d: D, last: "2026-09-30", b: { "2": S(5, 5, 118000) } },
  { p: "damachillsorchid", n: "DAMAC HILLS - ORCHID", area: "Al Hebiah Third", d: D, i: 20, last: "2026-09-30", b: { "2": S(7, 7, 110000) } },
] };
const UMX = { district: D, buildings_by_id: { "1003": { status: "verified", name: "DAMAC Hills - Carson", rows: [], pools: 3, car_parks: 400 }, "20": { status: "verified", name: "DAMAC Hills - Orchid", rows: [] } } };
const COMM = (k, say, src, name, as_of, quote) => ({ v: true, level: "community", say, src, source_name: name, as_of, ...(quote ? { quote } : {}) });
const PETS = COMM("pets", "Pet-friendly community (DAMAC Hills, with dedicated pet parks)", "dev_damac_carson_blog", "DAMAC's own DAMAC Hills page", "2026-09-18", "With dedicated pet parks, DAMAC Hills is a haven for pet owners");
const POOL = COMM("community_pool", "Community pools (DAMAC Hills: temperature-controlled swimming pools)", "dev_damac_carson_blog", "DAMAC's own DAMAC Hills page", "2026-09-18", "temperature-controlled swimming pools");
const GYM = COMM("gym", "Community gyms (DAMAC Hills)", "dev_damac_carson_blog", "DAMAC's own DAMAC Hills page", "2026-09-18");
const vparks = { v: true, level: "building", say: "Parking on the plot (118 of 118 villas carry car parks on the register)", src: "dld_buildings", source_name: "the Land Department buildings register", as_of: "2026-09-25" };
const AMF = { district: D, schema: 1, homes: [
  { key: "dld:damachillsrichmond", keys: ["dld:damachillsrichmond"], names: ["DAMAC HILLS -  RICHMOND"], community: "damac_hills", community_name: "DAMAC Hills", facts: { metro: { v: false, level: "community", say: "No metro nearby (DAMAC Hills)", src: "research:damachills.json", source_name: "DAMAC Properties - DAMAC Hills Area Guide (developer site)", as_of: "2026-10-02" }, pets: { ...PETS, detail: "inside DAMAC Hills on OpenStreetMap: 9 parks, 2 playgrounds, 1 dog park" }, community_pool: POOL, gym: GYM, parking: vparks } },
  { key: "dld:damachillstopanga", keys: ["dld:damachillstopanga"], names: ["DAMAC HILLS -  TOPANGA"], community: "damac_hills", facts: { pets: PETS, community_pool: POOL, gym: GYM, parking: vparks } },
  { key: "damachills:1003", keys: ["damachills:1003", "dld:damachillscarson"], names: ["DAMAC HILLS - CARSON"], community: "damac_hills",
    facts: { pets: PETS, community_pool: { v: true, level: "building", say: "Swimming pool in the building (3 pools on 3 of its 4 building records)", src: "dld_buildings", source_name: "the Land Department buildings register", as_of: "2026-09-25" }, gym: GYM,
             balcony: { v: false, level: "building", say: "No balcony area on any of its 120 flats in the units register", src: "dld_units", source_name: "the Land Department units register", as_of: "2026-09-25" } } },
  // two homes carrying the same name: the name answers neither (only the keys do, and "dld:damachillstwin" is neither home's key)
  { key: "x:1", keys: ["x:1"], names: ["DAMAC HILLS - TWIN"], facts: { pets: PETS } },
  { key: "x:2", keys: ["x:2"], names: ["DAMAC HILLS - TWIN"], facts: { pets: PETS } },
  // Orchid: found by its exact name only (no key in the file)
  { key: "zz:9", keys: ["zz:9"], names: ["DAMAC Hills - Orchid"], facts: { gym: { v: true, level: "building", say: "Gym in the building (1 gymnasium unit in the units register)", src: "dld_units", source_name: "the Land Department units register", as_of: "2026-09-25" } } },
] };
store.set("img_rent_index", JSON.stringify(RI));
store.set("img_unitmix_" + D, JSON.stringify(UMX));
store.set("img_districts_geo", JSON.stringify({ districts: [{ slug: D, name: "DAMAC Hills" }] }));
store.set("img_amenities_" + D, gz(AMF));

console.log("v289 amenity facts in the Brief");
const Q = "mode=rent&beds=2,3&type=any&max=240000&areas=" + D + "&musts=pets,community_pool,gym,parking&nice=private_pool&limit=20";
const j = await brief(Q);
const by = {}; for (const r of j.results || []) by[r.name] = r;
const rich = by["DAMAC HILLS -  RICHMOND"];
ok(!!rich && crit(rich, "pets").v === true && crit(rich, "pets").level === "community"
  && crit(rich, "pets").src === "Pet-friendly community (DAMAC Hills, with dedicated pet parks) - a community fact, per DAMAC's own DAMAC Hills page (2026-09-18): “With dedicated pet parks, DAMAC Hills is a haven for pet owners”",
  "A1 gzipped file read: pets answered yes, a community fact, with DAMAC's page and the quote", JSON.stringify(rich && crit(rich, "pets")));
ok(rich && /Community pools \(DAMAC Hills/.test(crit(rich, "community_pool").src) && /a community fact, per DAMAC's own DAMAC Hills page/.test(crit(rich, "community_pool").src)
  && crit(rich, "gym").v === true && crit(rich, "parking").v === true && crit(rich, "parking").level === "building" && /a building fact, per the Land Department buildings register \(2026-09-25\)/.test(crit(rich, "parking").src),
  "A1b community pool and gym are community facts; villa parking is a building fact from the buildings register", JSON.stringify(rich && rich.criteria));
ok(rich && /9 parks, 2 playgrounds, 1 dog park/.test(crit(rich, "pets").detail || ""), "A1c the dog-walking facts ride along as detail");
ok(rich && crit(rich, "private_pool").v === null && /^Not known/.test(crit(rich, "private_pool").src), "A1d private pool: nothing says, so still NOT KNOWN");
const carson = by["DAMAC HILLS - CARSON"];
ok(carson && crit(carson, "community_pool").v === true && /3 swimming pools \(a building fact\)$/.test(crit(carson, "community_pool").src) && crit(carson, "community_pool").level === "building",
  "A2 an answer the unit-mix record already gave stands, and says it is a building fact", JSON.stringify(carson && crit(carson, "community_pool")));
ok(carson && crit(carson, "pets").v === true && crit(carson, "pets").level === "community", "A3 matched by our key (damachills:1003)");
const twin = by["DAMAC HILLS - TWIN"];
ok(twin && crit(twin, "pets").v === null, "A3b a name two homes in the file share answers neither", JSON.stringify(twin && crit(twin, "pets")));
const orchid = by["DAMAC HILLS - ORCHID"];
ok(orchid && crit(orchid, "gym").v === true && crit(orchid, "gym").level === "building", "A3c matched by the exact name when the key is not in the file (Orchid: a gymnasium unit)");
ok(Object.keys(by).length === 5, "A4a not known never leaves a home out: all five listed with four musts", Object.keys(by).join(" | "));
const jb = await brief("mode=rent&beds=2&type=apartment&max=240000&areas=" + D + "&musts=balcony&limit=20");
ok(!(jb.results || []).some((r) => r.name === "DAMAC HILLS - CARSON") && (jb.results || []).some((r) => r.name === "DAMAC HILLS - ORCHID") && (jb.notes || []).some((n) => /1 building left out because a source says a must-have is missing/.test(n)),
  "A4b a file NO is definite: balcony a must leaves Carson out (units register: no balcony area on its flats); not-known Orchid stays", JSON.stringify((jb.results || []).map((r) => r.name)));
ok(rich && /pet-friendly \(dog walks, play areas\): yes \(a community fact, per DAMAC's own DAMAC Hills page\)/.test(rich.why) && /parking: yes \(a building fact, per the Land Department buildings register\)/.test(rich.why),
  "A5 the reasons name the level and the source of each must met", rich && rich.why);
ok((j.notes || []).some((n) => /amenity facts file for DAMAC Hills/.test(n) && /building fact/.test(n) && /community fact/.test(n)), "A5b the notes say where the facts come from and what the levels mean");

// ---- A6 the PDF loader: the same answers and words, from the same key -------------------------------------------------------------
const pq = parseQuery(new URL("https://x/brief_pdf?kind=onesheet&keys=dld:damachillsrichmond,damachills:1003&mode=rent&beds=3&type=villa&max=240000&musts=pets,community_pool,gym,parking&nice=private_pool"));
const C = await loadContext(env, pq, { need: { avail: false } });
const rr = C.recs.find((r) => r.key === "dld:damachillsrichmond"), rc = C.recs.find((r) => r.key === "damachills:1003");
const rows = rr ? criteriaRows(rr, pq) : [];
ok(rows.length === 5 && rows.find((x) => x[0].startsWith("pet")) && rows.find((x) => x[0].startsWith("pet"))[2].src === crit(rich, "pets").src
  && rows.find((x) => x[0] === "parking")[2].src === crit(rich, "parking").src && rows.find((x) => x[0] === "community pool")[2].v === true,
  "A6 the PDF rows give the same answers and the same source words as the list", JSON.stringify(rows.map((x) => [x[0], x[2].v, x[2].src])));
ok(rc && rc.crit.pets.v === true && rc.crit.community_pool.level === "building", "A6b the PDF reaches a bound building by its key too");
// the one-sheet card (Kendall's screenshot, 2 Oct: "Amenities to follow" and "community pool: not known · pet-friendly: not known")
const sheet = oneSheetHtml(C, pq);
const card1 = sheet.split('class="bcard"')[1] || "";
ok(!/Amenities to follow/.test(card1) && /Community \(DAMAC Hills\): community pool, pet-friendly, gym &middot; This building: parking/.test(card1)
  && /&#10003; pet-friendly/.test(card1) && /&#10003; community pool/.test(card1) && !/pet-friendly[^&<]*: not known/.test(card1) && !/community pool: not known/.test(card1),
  "A6c the one-sheet card: no 'Amenities to follow', no 'not known' for pool or pets - the facts by level", card1.replace(/<img[^>]*>/g, "").slice(0, 1500));
ok(/No metro nearby \(DAMAC Hills\) - a community fact, per DAMAC Properties - DAMAC Hills Area Guide/.test(card1) && !/Metro distance to follow/.test(card1),
  "A6d a villa cluster with no map position: the card gives the file's metro fact, not 'Metro distance to follow'");

// ---- A7 NEGATIVE CONTROL: no file -> not known ------------------------------------------------------------------------------------
store.delete("img_amenities_" + D);
const j0 = await brief(Q);
const r0 = (j0.results || []).find((r) => r.name === "DAMAC HILLS -  RICHMOND");
ok(r0 && crit(r0, "pets").v === null && crit(r0, "community_pool").v === null && crit(r0, "gym").v === null && !(j0.notes || []).some((n) => /amenity facts file/.test(n)),
  "A7 NEGATIVE CONTROL: with img_amenities_damachills removed, pets, community pool and gym go back to NOT KNOWN", JSON.stringify(r0 && r0.criteria));
store.set("img_amenities_" + D, JSON.stringify(AMF));                            // plain JSON works too
const jp = await brief(Q);
ok(((jp.results || []).find((r) => r.name === "DAMAC HILLS -  RICHMOND") || {}).criteria?.find((c) => c.k === "pets")?.v === true, "A7b the same file stored as plain JSON is read");

// unit: amenSrc wording and the OSM attribution
ok(amenSrc({ say: "Community pool (X): 1 pool mapped", level: "community", source_name: "OpenStreetMap", as_of: "2026-10-02", src: "osm" }) === "Community pool (X): 1 pool mapped - a community fact, per OpenStreetMap (2026-10-02). © OpenStreetMap contributors",
  "A1e an OpenStreetMap answer carries its attribution");
ok(amenFor(amenIndex(null), { key: "a:1" }) === null && criteriaOf({ c: { name: "x" }, card: null, brochure: null, AM: null, musts: {}, villa: false, s: null, af: null }).pets.v === null, "A3d no file, no answer (never a guess)");

// ---- A8 the real file and the real rent index ------------------------------------------------------------------------------------
const realA = path.join(NAJ, "amenities", "amenities_damachills.json"), realRI = path.join(NAJ, "board", "rent_index.json");
if (fs.existsSync(realA) && fs.existsSync(realRI)) {
  store.set("img_rent_index", fs.readFileSync(realRI, "utf8"));
  const um = path.join(NAJ, "board", "unitmix_damachills.json"); if (fs.existsSync(um)) store.set("img_unitmix_damachills", fs.readFileSync(um, "utf8"));
  store.set("img_amenities_damachills", gz(JSON.parse(fs.readFileSync(realA, "utf8"))));
  const k = await brief("mode=rent&beds=1,2,3&type=any&max=400000&areas=damachills&musts=pets,community_pool,gym,parking&nice=private_pool&limit=50");
  const R = k.results || [];
  console.log("  REAL DAMAC Hills: " + R.length + " results of " + k.total_matched + " matched");
  const ans = (kk) => R.filter((r) => crit(r, kk) && crit(r, kk).v != null).length;
  ok(R.length >= 10 && ["pets", "community_pool", "gym", "parking"].every((kk) => ans(kk) === R.length),
    "A8 REAL: every DAMAC Hills result answers pets, community pool, gym and parking (" + ["pets", "community_pool", "gym", "parking"].map((kk) => kk + " " + ans(kk) + "/" + R.length).join(", ") + ")",
    JSON.stringify(R.filter((r) => ["pets", "community_pool", "gym", "parking"].some((kk) => crit(r, kk).v == null)).map((r) => r.name + ": " + r.criteria.map((c) => c.k + "=" + c.v).join(","))));
  ok(R.every((r) => ["pets", "community_pool", "gym", "parking"].every((kk) => / - a (building|community|cluster) fact, per /.test(crit(r, kk).src) || /\(a building fact\)$/.test(crit(r, kk).src))),
    "A8b REAL: every answer says its level and its source");
  ok(R.every((r) => !/propertyfinder|bayut|dubizzle/i.test(JSON.stringify(r.criteria))), "A8c REAL: no listing portal anywhere in the answers");
} else console.log("  (A8 skipped: no " + realA + ")");

console.log((fail ? "FAIL" : "PASS") + " - v289 amenities: " + pass + " ok, " + fail + " failed");
process.exit(fail ? 1 : 0);
