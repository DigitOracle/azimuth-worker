// v767: One-pager (instant) beside Full passport - one A4 page from stored facts only, stored 24 h, listed as One-pager, never supersedes the full passport
import { onePage, ONE_CSS } from "../src/passport_pages.js";
import * as B from "../src/building_passports.js";
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("ok", m); };

const F = { identity: { name: "Orchid", area: "Al Hebiah Third", master: "DAMAC HILLS", tenure: "Freehold", plot: "676-8698", parcel: null, land: "Residential", sqm: 5000 },
  physical: { homes: 120, floors: 8, buildings: 2 }, construction: null, kind: null, developer: null,
  sales: { years: [{ y: "2026", v: { "1": { aed: 1200000, n: 14 } } }], src: "Land Department sales register" }, rentals: { rows: [] } };
const C = { label: "DAMAC HILLS", mix: [["United Kingdom", 13], ["India", 11], ["Egypt", 9], ["Lebanon", 5]] };
const h = onePage(F, C, "5 Nov 2026", "DAMAC Hills - Orchid A", "DAMAC HILLS › Al Hebiah Third · one-pager");
ok(/DAMAC Hills - Orchid A/.test(h) && /676-8698/.test(h), "title and plot number");
ok(/one-pager<\/span>/.test(h) && !/page 1 of/.test(h), "footer says one-pager, not page 1 of 4");
ok(/United Kingdom 13%/.test(h) && /Egypt 9%/.test(h) && !/Lebanon/.test(h), "nationality line: top 3 only");
ok(/AED 1\.2M|AED 1,200K|AED 1\.20M/.test(h) && /14 sales/.test(h), "registered price from the stored record");
ok(!/Completion/.test(h) && !/Developer/.test(h) && !/Registered rents/.test(h), "missing facts are left out, not filled");
ok(/@page\{size:A4;margin:0\}/.test(ONE_CSS) && /@media print\{\.o1-bar\{display:none\}\}/.test(ONE_CSS), "print-ready A4; the Save as PDF bar never prints");
ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(h), "no emoji");
ok(B.bppKeyOf({ plot_id: "naj:plot:676-8698", one: true }) !== B.bppKeyOf({ plot_id: "naj:plot:676-8698" }), "a one-pager never replaces the full passport for the same plot");
ok(B.cleanEntry({ slug: "orchid-a-1p", title: "Orchid A", one: true }).one === true, "the entry keeps its one-pager flag");
const page = B.bppBody("k", "", [{ slug: "orchid-a-1p", title: "Orchid A", one: true, html: true, date: "2026-11-05", made: new Date().toISOString() }], [], "https://x", "kendall");
ok(/One-pager \(instant\)/.test(page) && />Full passport</.test(page), "the form has One-pager (instant) and Full passport");
ok(/One-pager · /.test(page) || /<i>One-pager/.test(page), "Ready to download labels it One-pager");
let parsed = true; for (const x of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) { try { new Function(x[1]); } catch (e) { parsed = false; console.log(e.message); } }
ok(parsed, "the served page script parses");
ok(/"One-pager"/.test(page) && /"Full passport"/.test(page) && /op:"onepager"/.test(page), "every search row gets both buttons; One-pager posts op onepager");
process.exit(fail ? 1 : 0);
