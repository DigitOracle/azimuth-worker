// v528 - the project card's footer is the "Available to rent now · N flats" strip (it opens the pop-up; no listings = no strip), and each bedroom
// card in the pop-up links to its cheapest live listing (Kendall 12 Oct 2026).
import fs from "node:fs";
import { advertisedDoc, advertisedForKey, advertisedHtml } from "../src/advertised.js";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const dm = fs.readFileSync(new URL("../src/devmap_page.js", import.meta.url), "utf8");
ok(/">'\+inner\+pfStrip\(slug,name,ev\)\+'<\/button>'\}/.test(dm) && !/'Show on the map<\/span><\/button>'\}/.test(dm), "a located card ends in the strip, not 'Show on the map'");
ok(/function pfStrip\(slug,name,ev\)\{var k=pdBldKey\(\{slug:slug\},ev\|\|\{\}\);if\(!k\)return '';setTimeout\(pfFill,0\);return '<span class="pfbtn pfstrip" role=button tabindex=0 data-pfk="'/.test(dm), "the strip uses the building key and the same fill and pop-up as the button; no key, no strip");
ok(/if\(!j\|\|!j\.covered\|\|\(!j\.flats&&!j\.adverts\)\)\{b\.remove\(\)\}else/.test(dm), "nothing listed: the strip goes");
const doc = { advertised: { as_of: "2026-10-11", buildings: { s: { key: "businessbay:1", bands: { studio: { flats: 3, adverts: 5, f_pmed: 90000, f_p25: 85000, f_p75: 95000, f_days: 10 } } } } } };
const a = advertisedForKey(advertisedDoc(doc), "businessbay:1");
const h = advertisedHtml(a, { summary: true, links: { studio: "https://www.propertyfinder.ae/en/plp/rent/x.html" } });
ok(/<a class=avl href="https:\/\/www\.propertyfinder\.ae\/en\/plp\/rent\/x\.html" target=_blank rel="noopener noreferrer">Cheapest &#8599;<\/a>/.test(h), "the bedroom card links to its cheapest listing");
ok(!/class=avl/.test(advertisedHtml(a, { summary: true })), "no link on file, no link drawn");
const cb = fs.readFileSync(new URL("../src/city_bldg.js", import.meta.url), "utf8");
ok(/\/\^https:\\\/\\\/www\\\.propertyfinder\\\.ae\\\/\[\^\\s"'<>\]\*\$\/\.test\(a\.u\)/.test(cb), "only propertyfinder.ae pages become links");
ok(/function mapLegend\(\)\{var el=\$\("maplg"\);if\(!el\)return;el\.style\.display="none";return;/.test(dm), "the price-band legend is withdrawn");
console.log(`v528 strip and links: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
