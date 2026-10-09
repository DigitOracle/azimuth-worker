// v442 - Property Finder advert cards: Call and WhatsApp to the listing broker (Kendall 9 Oct 2026).   node test/test_v442_broker.mjs
import { supplyAdverts, brokerHtml, advertsHtml } from "../src/supply_page.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
const ads = supplyAdverts({ "al-habtour-tower": { "1": [
  { id: "1", p: 95000, u: "https://www.propertyfinder.ae/en/plp/rent/x-1.html", an: "Sara Test", ag: "Test Realty", ph: "+971500000001", wa: "+971500000002", lat: 25.18, lon: 55.27 },
  { id: "2", p: 99000, ph: "0500000003", wa: "javascript:alert(1)" },
  { id: "3", p: 101000 }] } });
const a = ads["al-habtour-tower"]["1"];
ok(a[0].phone === "+971500000001" && a[0].wa === "+971500000002" && a[0].agency === "Test Realty", "contact fields read from the short keys");
ok(a[1].phone === "" && a[1].wa === "", "a malformed number or a script is never a button");
const h = brokerHtml(a[0], { building: "Al Habtour Tower", band: "1 bedroom" });
ok(/href="tel:\+971500000001"/.test(h) && /href="https:\/\/wa\.me\/971500000002\?text=/.test(h), "tap to call and WhatsApp links", h);
const t = decodeURIComponent(h.match(/text=([^"]+)/)[1].replace(/&amp;/g, "&"));
ok(/Hello Sara/.test(t) && /1 bedroom in Al Habtour Tower/.test(t) && /AED 95,000 a year/.test(t) && /propertyfinder\.ae/.test(t), "the WhatsApp line names the advert", t);
ok(/Listed by Sara Test · Test Realty/.test(h) && /<svg/.test(h) && !/[\u{1F300}-\u{1FAFF}]/u.test(h), "who listed it, with icons, no emojis");
ok(brokerHtml(a[2], {}) === "", "no contact stored: no buttons");
const page = advertsHtml({ name: "Al Habtour Tower", ads: ads["al-habtour-tower"], frame: { w: 55.26, e: 55.28, s: 25.17, n: 25.19 } });
ok(/tel:\+971500000001/.test(page) && (page.match(/class=abk/g) || []).length === 1, "the drill-down carries the buttons only where a contact exists");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
