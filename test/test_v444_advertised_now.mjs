// v444 - "Advertised now (Property Finder)": distinct flats + adverts per building and band, beside developer availability,
// never added to it; closed accordion; older pf_supply files still render; "Check permit" only for the advert's own dubailand URL.
// Run: node test/test_v444_advertised_now.mjs
import { existsSync, readFileSync } from "node:fs";
import { advertisedDoc, advertisedFor, advertisedForKey, advertisedHtml, permitLink, ADV_LABEL } from "../src/advertised.js";
import { supplyDoc, supplyBuildings, attachAdverts, advertsHtml } from "../src/supply_page.js";

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("ok  ", m); };

const rows = [{ key: "jumeirahvillagecircle:7", dld_project: "A", building_slug: "jvc-a", beds_band: "1", listings_live: 5, median_price: 70000, median_days_listed: 12 },
  { key: "jumeirahvillagecircle:7", dld_project: "A", building_slug: "jvc-a", beds_band: "2", listings_live: 2, median_price: 95000 }];
const advertised = { v: 1, label: ADV_LABEL, as_of: "2026-10-09", buildings: {
  "jvc-a": { key: "jumeirahvillagecircle:7", flats: 3, adverts: 7, bands: {
    "1": { flats: 2, adverts: 5, pmin: 65000, pmax: 72000, med_days: 12, new_wk: 1, gone_wk: 2 },
    "2": { flats: 1, adverts: 2, pmin: 95000, pmax: 95000, med_days: 3, new_wk: 0, gone_wk: 0 } } },
  "jvc-a2": { key: "jumeirahvillagecircle:7", bands: { "1": { flats: 1, adverts: 1, pmin: 60000, pmax: 60000, med_days: 40, new_wk: 0, gone_wk: 1 } } } } };

// new file
{
  const A = advertisedDoc({ advertised });
  const a = advertisedFor(A, ["jvc-a", "jvc-a2"], null);
  ok(a.flats === 4 && a.adverts === 8 && a.goneWk === 3, "slugs of one building merge: 4 flats, 8 adverts, 3 gone");
  ok(a.bands["1"].pmin === 60000 && a.bands["1"].pmax === 72000, "price range spans the slugs");
  const h = advertisedHtml(a);
  ok(/<details class=avd>/.test(h) && !/<details[^>]*open/.test(h), "accordion closed by default");
  ok(h.includes("Advertised now (Property Finder)") && h.includes("4 flats") && h.includes("8 adverts"), "label + flats + adverts in the summary");
  ok(h.includes("Adverts are not vacancy"), "the one-line caveat is shown");
  ok(h.includes("never added to it"), "says it is never added to developer availability");
  ok((h.match(/class=avc/g) || []).length === 2 && h.includes("<svg"), "one card per band, inline SVG icons");
  ok(!/<ul|<li/.test(h), "cards, not a plain list");
  const k = advertisedForKey(A, "jumeirahvillagecircle:7");
  ok(k && k.flats === 4, "Brief: found by our building key");
  ok(advertisedForKey(A, "jumeirahvillagecircle:8") === null, "no figure for a building with no adverts");
}
// older file (no advertised block) still renders, adverts only
{
  const d = supplyDoc({ as_of: "2026-10-01", rows });
  ok(d && d.advertised === null, "old file: no advertised block, doc still parses");
  const bs = supplyBuildings(d.rows, "jumeirahvillagecircle", null);
  attachAdverts(bs, d.adverts);
  const a = advertisedFor(d.advertised, bs[0].slugs, Object.fromEntries(bs[0].bandRows.map((r) => [r.band, { live: r.live, days: r.days }])));
  ok(a && a.counted === false && a.adverts === 7 && a.flats === null, "old file: 7 adverts, flats not counted");
  const h = advertisedHtml(a);
  ok(h.includes("7 adverts") && h.includes("flats not counted yet") && !h.includes("gone this week"), "old file renders without flat/gone figures");
  ok(advertisedHtml(null) === "", "nothing at all renders nothing");
}
// permit link: only the advert's own https dubailand.gov.ae URL
{
  ok(permitLink("https://trakheesi.dubailand.gov.ae/rev/madmoun/listing/validation?khevJujtDig=abc") !== "", "dubailand https kept");
  ok(permitLink("http://dubailand.gov.ae/x") === "", "http refused");
  ok(permitLink("https://dubailand.gov.ae.evil.example/x") === "", "look-alike host refused");
  ok(permitLink("javascript:alert(1)") === "" && permitLink(null) === "", "junk refused");
  const doc = { as_of: "2026-10-09", rows, advertised, adverts: { "jvc-a": { "1": [
    { id: "1", p: 65000, fl: 1, ck: "https://trakheesi.dubailand.gov.ae/rev/madmoun/listing/validation?x=1" },
    { id: "2", p: 66000, fl: 1, ck: "https://evil.example/permit" }] } } };
  const d = supplyDoc(doc), bs = supplyBuildings(d.rows, "jumeirahvillagecircle", null);
  attachAdverts(bs, d.adverts);
  const h = advertsHtml(bs[0]);
  ok((h.match(/Check permit/g) || []).length === 1 && h.includes("trakheesi.dubailand.gov.ae"), "one Check permit link, only for the dubailand URL");
}
// the real local file, if present (built by naj-market-pulse report): parses and renders
{
  const p = "C:/Dev/naj-market-pulse/data/listings/pf_supply_jumeirahvillagecircle.json";
  if (existsSync(p)) {
    const raw = JSON.parse(readFileSync(p, "utf8")), d = supplyDoc(raw);
    const bs = supplyBuildings(d.rows, "jumeirahvillagecircle", null);
    attachAdverts(bs, d.adverts);
    const b = bs[0], a = advertisedFor(d.advertised, b.slugs, Object.fromEntries(b.bandRows.map((r) => [r.band, { live: r.live, days: r.days }])));
    ok(a && advertisedHtml(a).includes("Advertised now"), "local pf_supply file renders (" + (raw.advertised ? "new" : "old") + " shape)");
  }
}
console.log(fail ? fail + " FAILED" : "all ok");
process.exit(fail ? 1 : 0);
