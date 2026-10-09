// v414 - Advertised supply: per-bedroom drill-down of individual adverts (link to the advert on Property Finder + mini map).
// Run: node test/test_v414_supply_adverts.mjs
import { readFileSync } from "node:fs";
import { supplyDoc, supplyBuildings, attachAdverts, advertsHtml, supplyAdverts } from "../src/supply_page.js";

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("ok  ", m); };

const base = { as_of: "2026-10-01", rows: [
  { key: "dld:A", dld_project: "A TOWER", building_slug: "bb-a", beds_band: "1", listings_live: 3, median_price: 90000 },
  { key: "dld:A", dld_project: "A TOWER", building_slug: "bb-a", beds_band: "studio", listings_live: 1, median_price: 60000 }] };

// old file, no adverts: renders nothing extra
{
  const d = supplyDoc(base), bs = supplyBuildings(d.rows, "businessbay", null);
  attachAdverts(bs, d.adverts);
  ok(advertsHtml(bs[0]) === "", "old file without adverts renders no drill-down");
}
// new file
{
  const doc = Object.assign({}, base, { adverts: { "bb-a": {
    "1": [{ id: "2", p: 95000, sq: 800, t: "Apartment", f: "YES", d: "2026-09-20", lat: 25.186, lon: 55.27, u: "https://www.propertyfinder.ae/en/plp/rent/apartment-for-rent-dubai-business-bay-a-2.html" },
          { id: "1", p: 88000, lat: 25.19, lon: 55.28 },
          { id: "3", p: 99000, u: "javascript:alert(1)" }],
    studio: [{ id: "9", p: 60000, lat: 25.18, lon: 55.26, u: "https://evil.example/x" }] } } });
  const d = supplyDoc(doc), bs = supplyBuildings(d.rows, "businessbay", null);
  const frame = attachAdverts(bs, d.adverts); bs.forEach((b) => (b.frame = frame));
  const h = advertsHtml(bs[0]);
  ok(frame && frame.s === 25.18 && frame.e === 55.28, "district frame spans all advert positions");
  ok((h.match(/<details class=adg>/g) || []).length === 2 && !/<details[^>]*open/.test(h), "two bands, all closed by default");
  ok(h.indexOf("Studio") < h.indexOf("1 bed") || h.indexOf(">Studio<") >= 0, "studio band listed");
  ok(h.includes('href="https://www.propertyfinder.ae/en/plp/rent/apartment-for-rent-dubai-business-bay-a-2.html"'), "advert link to propertyfinder.ae");
  ok(!h.includes("javascript:") && !h.includes("evil.example"), "non-Property-Finder or unsafe links dropped");
  ok(h.includes("No link stored for this advert yet"), "advert without url says so");
  ok(h.indexOf("AED 88,000") >= 0 && h.indexOf("AED 88,000") < h.indexOf("AED 95,000"), "cheapest first");
  // v446: one real street map per building (Property Finder gives one position per building), not a blank frame on every advert
  ok((h.match(/class=smap/g) || []).length === 1 && /class=smap data-lat="\d+\.\d+" data-lon="\d+\.\d+"/.test(h) && !/rastertiles/.test(h) && /google\.com\/maps\/search/.test(h) && !/<svg class=mm/.test(h), "one street map for the building, with tiles and a Google Maps link");
  ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(h), "no emoji characters");
  // v442 (Kendall 9 Oct 2026): the broker's name, agency, phone and WhatsApp ARE carried now; never an email or an id
  ok(!/email|agent_id|broker_id|user_id/i.test(JSON.stringify(supplyAdverts(doc.adverts))), "no broker email or ids carried (name, agency, phone and WhatsApp only)");
}
// the sample file built from the lake, if present
try {
  const p = process.env.PF_SAMPLE; if (p) {
    const d = supplyDoc(JSON.parse(readFileSync(p, "utf8"))), bs = supplyBuildings(d.rows, "businessbay", null);
    const frame = attachAdverts(bs, d.adverts); bs.forEach((b) => (b.frame = frame));
    const h = advertsHtml(bs[0]);
    ok(h.length > 0, "sample: top building renders a drill-down (" + bs[0].name + ", " + h.length + " chars)");
  }
} catch (e) { ok(false, "sample: " + e.message); }
console.log(fail ? fail + " failed" : "all passed");
process.exit(fail ? 1 : 0);
