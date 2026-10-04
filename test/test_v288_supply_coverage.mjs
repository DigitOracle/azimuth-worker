// v288 - Advertised supply: "covers N of M" and adverts by home type (Kendall, 1 Oct 2026: DAMAC Hills showed 41 adverts in 2
// buildings; its villa and townhouse clusters were not bound to the listing site's locations).
//
// The crawler's pf_supply_<district> now carries two ADDITIVE keys: `coverage` {register_total, register_bound, community_adverts
// {total, captured, community_name}, ...} and `home_types` {Villa: n, Townhouse: n, Apartment: n}. Through the real worker over a
// stubbed KV this proves:
//   C1 the district page says "Covers 35 of 46 registered projects" and "1,180 of the 1,433 adverts the listing site shows for Damac Hills"
//   C2 the home types are drawn, most first, in plain words (Villas, Townhouses, Apartments)
//   C3 a file WITHOUT the new keys (Business Bay as published today) draws exactly as before: no coverage line, no home-type chips
//   C4 nonsense coverage (bound > total, total 0, a string) is dropped rather than drawn
//   C5 still owner only: a client key gets 404 on the district page
// NEGATIVE CONTROL: in src/supply_page.js supplyPageHtml, delete `+ homeTypesHtml(D.homeTypes) + coverageHtml(D.coverage)` - C1 and C2 fail.
//
//   node test/test_v288_supply_coverage.mjs
import worker from "../src/index.js";
import { supplyDoc, supplyCoverage, supplyHomeTypes, coverageHtml } from "../src/supply_page.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };

const READ = "owner_read_key_v288", CLIENT = "client_key_v288";
const store = new Map();
const KV = {
  async get(k, type) { if (!store.has(k)) return null; const v = store.get(k); return type === "arrayBuffer" ? new TextEncoder().encode(v).buffer : v; },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; }
};
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const call = (p) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p), env, { waitUntil() {} });
const page = async (p) => { const r = await call(p); return { status: r.status, html: await r.text() }; };
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const K = "key=" + encodeURIComponent(READ);

const rows = [
  { key: "damachills:1003", dld_project: "DAMAC HILLS - CARSON", building_slug: "damac-hills-carson", beds_band: "1", listings_live: 140, median_price: 70000 },
  { key: "dld:damachillsrichmond", dld_project: "DAMAC HILLS - RICHMOND", building_slug: "damac-hills-richmond", beds_band: "3+", listings_live: 64, median_price: 260000 }
];
store.set("img_pf_supply_damachills", JSON.stringify({
  as_of: "2026-10-01", district: "damachills", measure: "advertised supply", buildings: 2, listings_live: 204, rows,
  home_types: { Apartment: 140, Villa: 36, Townhouse: 28 },
  coverage: { unit: "DLD projects in the district register", register_total: 46, register_bound: 35, register_with_adverts: 33, bound_locations: 42,
    bound_locations_outside_register: 7, say: "covers 35 of 46 DLD projects",
    community_adverts: { total: 1433, captured: 1180, community_name: "Damac Hills", by_kind: { villas: 347, townhouses: 305, apartments: 781 } } }
}));
const bbDoc = { as_of: "2026-10-01", district: "businessbay", measure: "advertised supply", buildings: 1, listings_live: 12,
  rows: [{ key: "businessbay:12", dld_project: "THE OPUS", building_slug: "business-bay-the-opus", beds_band: "2", listings_live: 12 }] };
store.set("img_pf_supply_businessbay", JSON.stringify(bbDoc));

console.log("C1 coverage line");
{
  const r = await page("/supply?d=damachills&" + K), v = visible(r.html);
  ok(r.status === 200, "C1.1 the owner opens the DAMAC Hills district page", r.status);
  ok(/Covers 35 of 46 registered projects in this district/.test(v), "C1.2 'Covers 35 of 46 registered projects'", v.slice(0, 600));
  ok(/1,180 of the 1,433 adverts the listing site shows for Damac Hills/.test(v), "C1.3 adverts captured against the site's own count");
  ok(!/\bDLD\b/.test(v.replace(/Dubai Land Department/g, "")), "C1.4 no bare acronym on the page: 'Dubai Land Department' is spelled out");
}
console.log("C2 home types");
{
  const v = visible((await page("/supply?d=damachills&" + K)).html);
  const i = v.indexOf("Apartments 140"), j = v.indexOf("Villas 36"), k = v.indexOf("Townhouses 28");
  ok(i >= 0 && j > i && k > j, "C2.1 Apartments 140, Villas 36, Townhouses 28 - most first, plain words", v.slice(0, 600));
  ok(JSON.stringify(supplyHomeTypes({ Villa: 3, Apartment: 0, "": 4, Townhouse: "x" })) === JSON.stringify([{ type: "Villa", n: 3 }]), "C2.2 zero, unnamed and non-numeric home types are dropped");
}
console.log("C3 a file without the new keys draws as before");
{
  const html = (await page("/supply?d=businessbay&" + K)).html, v = visible(html);
  ok(/12 adverts, in 1 building/.test(v) && !/0 sites?/.test(v) && !/id=sucov/.test(html) && !/id=suhome/.test(html) && !/Covers/.test(v), "C3.1 Business Bay: the adverts line, no coverage line, no home-type chips");
  const d = supplyDoc(bbDoc);
  ok(d.coverage === null && Array.isArray(d.homeTypes) && d.homeTypes.length === 0 && d.rows.length === 1, "C3.2 supplyDoc: coverage null, home types empty, rows unchanged");
}
console.log("C4 nonsense coverage is dropped");
{
  ok(supplyCoverage({ register_total: 10, register_bound: 11 }) === null, "C4.1 bound above total: dropped");
  ok(supplyCoverage({ register_total: 0, register_bound: 0 }) === null, "C4.2 total 0: dropped");
  ok(supplyCoverage("covers 3 of 4") === null && supplyCoverage([1, 2]) === null, "C4.3 a string or a list: dropped");
  const c = supplyCoverage({ register_total: 4, register_bound: 2, community_adverts: { total: 0, captured: 5 } });
  ok(c && c.siteTotal === null && !/adverts the listing site shows/.test(coverageHtml(c)), "C4.4 a zero community total: the project count is shown, the advert share is not");
  ok(/Covers <b>2<\/b> of 4/.test(coverageHtml(c)), "C4.5 ... and the project count reads 2 of 4");
}
console.log("C5 still owner only");
{
  ok((await call("/supply?d=damachills&key=" + encodeURIComponent(CLIENT))).status === 404 && (await call("/supply?d=damachills")).status === 404, "C5.1 a client key, or none, gets 404");
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
