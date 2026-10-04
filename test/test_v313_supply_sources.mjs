// v313 - Advertised supply says where the data come from, never "0 sites", and lists the registered projects with no advert location.
// (Kendall, 4 Oct 2026, DAMAC Hills card: "where does it come from"; "1,259 adverts across 0 sites"; "why are some projects not listed".)
//
//   S1 a district file WITH source_say prints that line on the district page, the building page and the START summary
//   S2 an OLD file (no sources, no sites) says "Property Finder rental adverts, fetched <crawl time>" and never "0 sites"
//   S3 a file with sources[] but no source_say builds the sentence from sources[]
//   S4 with the optional key img_pf_unbound_<district> the district page shows 'Registered here, no advert location matched', each
//      project in plain words; without the key the section is absent
//   S5 owner only: a client key and no key get 404 on the page, the summary and the unbound data never reach them
// NEGATIVE CONTROL: run this file against the release-v312 src (git archive release-v312) - S1, S2, S4 fail.
//
//   node test/test_v313_supply_sources.mjs
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };

const READ = "owner_read_key_v313", CLIENT = "client_key_v313";
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
const K = "key=" + encodeURIComponent(READ), CK = "key=" + encodeURIComponent(CLIENT);

const SAY = "Property Finder rental adverts, fetched 2026-10-04, matched to Dubai Land Department projects; one site. Not vacancy; research only.";
const mk = (extra) => JSON.stringify(Object.assign({ as_of: "2026-10-04", measure: "advertised supply", rows: [
  { key: "damachills:1003", dld_project: "DAMAC HILLS - CARSON", building_slug: "damac-hills-carson", beds_band: "1", listings_live: 140, median_price: 70000, crawled_at: "2026-10-04T05:40:00Z" },
  { key: "dld:rich", dld_project: "DAMAC HILLS - RICHMOND", building_slug: "damac-hills-richmond", beds_band: "3+", listings_live: 64, median_price: 260000, crawled_at: "2026-10-04T05:40:00Z" }] }, extra));
// the old shape: no sites, no sources
store.set("img_pf_supply_damachills", mk({}));
store.set("img_pf_supply_businessbay", JSON.stringify({ as_of: "2026-10-04", rows: [{ key: "bb:1", dld_project: "THE OPUS", building_slug: "business-bay-the-opus", beds_band: "2", listings_live: 12, crawled_at: "2026-10-04T05:40:00Z" }] }));
store.set("img_pf_supply_jvc", mk({ sources: [{ site: "Property Finder", url: "https://www.propertyfinder.ae", what: "public rental search pages", fetched: "2026-10-03", method: "research crawler" }], sites: 1 }));
store.set("img_pf_supply_dubaimarina", mk({ source_say: SAY, sites: 1 }));

console.log("S2 old file: honest source line, no '0 sites'");
{
  const r = await page("/supply?d=damachills&" + K), v = visible(r.html);
  ok(r.status === 200, "S2.1 owner opens the district page", r.status);
  ok(/Source: Property Finder rental adverts, fetched 4 Oct, 09:40/.test(v), "S2.2 source line from the crawl time", v.slice(0, 500));
  ok(!/\b0 sites?\b/.test(v), "S2.3 no '0 sites'");
  ok(/204 adverts, in 2 buildings/.test(v), "S2.4 headline carries no site count when none is known", v);
  const sm = await (await call("/supply/summary?" + K)).json();
  ok(sm.ok && typeof sm.source_say === "string", "S2.5 summary answers with a source line", JSON.stringify(sm));
}
console.log("S1 file with source_say");
{
  const v = visible((await page("/supply?d=dubaimarina&" + K)).html);
  ok(v.includes("Source: " + SAY), "S1.1 district page prints source_say", v.slice(0, 600));
  ok(/204 adverts across 1 site, in 2 buildings/.test(v), "S1.2 'across 1 site' now that the file says one");
  const b = visible((await page("/supply?d=dubaimarina&b=" + encodeURIComponent("damachills:1003") + "&" + K)).html);
  ok(b.includes("Source: " + SAY), "S1.3 building page prints it too", b.slice(0, 400));
  const sm = await (await call("/supply/summary?" + K)).json();
  ok(typeof sm.source_say === "string" && sm.source_say.length > 10, "S1.4 START summary carries a source line", JSON.stringify(sm));
}
console.log("S3 sources[] only");
{
  const v = visible((await page("/supply?d=jvc&" + K)).html);
  ok(/Source: Property Finder rental adverts, fetched 2026-10-03; public rental search pages\. Not vacancy; research only\./.test(v), "S3.1 sentence built from sources[]", v.slice(0, 500));
}
console.log("S4 unbound section");
{
  const without = visible((await page("/supply?d=damachills&" + K)).html);
  ok(!/no advert location matched/i.test(without), "S4.1 omitted when the key is absent");
  store.set("img_pf_unbound_damachills", JSON.stringify({ as_of: "2026-10-04", why_not_listed: "x", projects: [
    { project: "DAMAC HILLS - BROOKFIELD-2", land_plots: 76, sales_all_time: 224, sales_last_12m: 3, sales_median_price_last_12m: 6000000, ejari_contracts_all_time: 359, ejari_new_lettings_last_12m: 19, ejari_new_median_annual_rent_last_12m: 300000 },
    { project: "DAMAC DISTRICT", land_plots: 1, sales_all_time: 662, sales_last_12m: 662, sales_median_price_last_12m: 1277500, ejari_contracts_all_time: 0, ejari_new_lettings_last_12m: 0, ejari_new_median_annual_rent_last_12m: null }] }));
  const v = visible((await page("/supply?d=damachills&" + K)).html);
  ok(/Registered here, no advert location matched/.test(v), "S4.2 section shown with the key", v.slice(-900));
  ok(v.includes("224 sales recorded, 3 in the last 12 months at a median AED 6.0m; 19 new lettings in 12 months at a median AED 300,000"), "S4.3 plain words for Brookfield-2", v.slice(-900));
  ok(/662 sales recorded, 662 in the last 12 months at a median AED 1\.3m; no lettings recorded/.test(v), "S4.4 zero lettings said plainly");
  ok(!/\bEjari\b/.test(v.slice(v.indexOf("Registered here"))), "S4.5 no unexplained portal name in the section");
  store.set("img_pf_unbound_damachills", new TextEncoder().encode("not json{"));
  const bad = await page("/supply?d=damachills&" + K);
  ok(bad.status === 200 && !/no advert location matched/i.test(visible(bad.html)), "S4.6 a broken key is ignored, the page still draws");
  store.set("img_pf_unbound_damachills", JSON.stringify({ projects: [{ project: "A", sales_all_time: 1, sales_last_12m: 0, ejari_contracts_all_time: 5, ejari_new_lettings_last_12m: 0 }] }));
  const one = visible((await page("/supply?d=damachills&" + K)).html);
  ok(/1 sale recorded, none in the last 12 months; no new lettings in the last 12 months \(5 rental contracts on record\)/.test(one), "S4.7 singular and zero wording", one.slice(-400));
}
console.log("S5 owner only");
{
  for (const q of ["/supply?d=damachills&" + CK, "/supply?d=damachills", "/supply/summary?" + CK, "/img/pf_supply_damachills?" + CK, "/img/pf_unbound_damachills?" + CK]) {
    const r = await call(q);
    ok(r.status === 404, "S5 404 for " + q.replace(/key=.*/, "key=..."), r.status);
  }
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
