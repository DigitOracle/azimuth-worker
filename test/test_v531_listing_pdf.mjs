// v531 - a PDF of one listing, next to Call and WhatsApp (Kendall 12 Oct 2026, option A)
import { listingSheetHtml, advertsHtml } from "../src/supply_page.js";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : String(x).slice(0, 300)); } };
const a = { price: 90000, sqft: 696, type: "Apartment", listed: "2026-09-08", url: "https://www.propertyfinder.ae/en/plp/rent/x.html", agent: "Aman Verma", agency: "Guild Real Estate", phone: "+971500000000", wa: "+971500000000" };
const h = listingSheetHtml(a, { name: "Peninsula Five" }, "1", { slug: "businessbay", asOf: "2026-10-11" });
ok(/Peninsula Five/.test(h) && /AED 90,000/.test(h) && /696 sq ft/.test(h) && /8 Sep 2026/.test(h), "building, rent, size, listed date");
ok(/Curated by Najjuko &middot; Dubai Decoded/.test(h) && /WhatsApp/.test(h), "the Najjuko footer");
ok(!/Aman Verma|Guild Real Estate|\+971500000000/.test(h), "the listing broker's name and number are left off");
ok(!/vacan/i.test(h) && /<img class="najhead"/.test(h), "never 'vacant'; our mark in the header");
const card = advertsHtml({ name: "Peninsula Five", district: "businessbay", id: "businessbay:615", ads: { "1": [a] }, bands: { "1": { live: 1 } } });
ok(/class="ao lpdf" href="\/supply\/listing_pdf\?d=businessbay&b=businessbay%3A615&k=1&i=0"/.test(card), "the PDF button on the card", card.match(/lpdf[^>]*/));
console.log(`v531 listing pdf: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
