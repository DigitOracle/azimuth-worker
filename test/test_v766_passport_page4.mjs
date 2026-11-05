// v766: page 4 of the Building Passport is the community nationality mix (donut + every nationality listed), from priv_community_resident_mix
import { page4, communityMix, placePages, BPP_PAGES } from "../src/passport_pages.js";
import { fitsPages } from "../src/building_passports.js";
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("ok", m); };

const FILE = { communities: [
  { comm: "676", name: "AL HEBIAH THIRD", label: "DAMAC HILLS", official: "Al Hebiah Third", mix: [["United Kingdom", 13], ["India", 11], ["Egypt", 9]], other: 57, noNationalityPct: 8,
    regions: [{ name: "Arab world", pct: 30, others: 2, countries: [["Egypt", 9], ["Lebanon", 5], ["Jordan", 3]] }, { name: "Europe", pct: 26, others: 4, countries: [["United Kingdom", 13], ["France", 3]] }] },
  { comm: "999", name: "EMPTY", label: "Empty", official: "Empty", mix: [], regions: [] } ] };

ok(BPP_PAGES === 4, "the passport is 4 pages");
const C = communityMix(FILE, "naj:plot:676-8698");
ok(C && C.label === "DAMAC HILLS", "plot 676-8698 -> community 676, DAMAC HILLS (first three digits of the plot number)");
ok(communityMix(FILE, "676-8698") && communityMix(FILE, "naj:plot:123-1") === null, "plain plot number works; an unknown community is null, never a guess");
const h = page4(C, "DAMAC Hills - Orchid A", "5 Nov 2026");
ok(/data-bpp-det="4"/.test(h) && /page 4 of 4/.test(h), "page 4 with its own footer, page 4 of 4");
ok(/<svg[^>]*bd-donut4/.test(h) && ((h.match(/<svg[^>]*bd-donut4[\s\S]*?<\/svg>/) || [""])[0].match(/<circle /g) || []).length === 2, "a donut with one slice per region");
for (const n of ["United Kingdom", "India", "Egypt", "Lebanon", "Jordan", "France"]) ok(h.includes(n), "lists " + n);
ok(/Others, each under 5%/.test(h) && /57%/.test(h), "the under-5% slice is shown with its share");
ok(/account holders, not every resident/i.test(h) && /never for recommending a home/i.test(h), "caveat in plain words");
ok(/From DEWA accounts/.test(h) && /8% of accounts record no nationality/.test(h), "source chip and the no-nationality share");
ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(h), "no emoji");
const e = page4(communityMix(FILE, "naj:plot:999-1"), "X", "5 Nov 2026"), n = page4(null, "Y", "5 Nov 2026");
ok(/too few residential accounts/.test(e) && !/bd-donut4/.test(e) && /too few residential accounts/.test(n) && /page 4 of 4/.test(n), "no mix -> a plain sentence, no chart, still page 4");
const w = placePages('<html><head></head><body><section class="page">p1 · page 1 of 3</section><section class="page">old</section></body></html>', '<section class="page">P2</section>', '<section class="page">P3</section>', h);
ok(/page 1 of 4/.test(w) && w.indexOf("P3") < w.indexOf('data-bpp-det="4"') && !/>old</.test(w), "page 4 placed after page 3; the writer's page 1 footer says of 4");
ok(fitsPages(4, [{ over_mm: 0 }], 4) && !fitsPages(3, [], 4) && !fitsPages(4, [{ over_mm: 3 }], 4), "4 pages and no overflow = fits");
process.exit(fail ? 1 : 0);
