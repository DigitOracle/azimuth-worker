// v529 - "What's advertised where": the headline follows the filter, and a budget slider (rent a year) narrows the buildings
// (Kendall 12 Oct 2026: "why does it still show 1279 with the filter on? and there needs to be a slider there for budget").
import fs from "node:fs";
import { supplyPageHtml, SUPPLY_JS, BUDGET_STEPS } from "../src/supply_page.js";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const b = (i, types, pmin) => ({ id: "k" + i, matched: true, key: "d:" + i, slug: "s" + i, name: "T" + i, district: "d", live: 100 - i, sources: {}, urls: {}, bandRows: [], slugs: ["s" + i], types, tc: Object.fromEntries(types.map((t) => [t, 1])), pmin, crawled: "" });
const D = { slug: "d", crawled: "", sites: 1, homeTypes: [{ type: "Apartment", n: 40 }], buildings: [b(0, ["Apartment"], 45000), b(1, ["Apartment"], 120000)] };
const h = supplyPageHtml({ view: "district", d: D, key: "k" });
ok(/<div class=hl id=suhl>/.test(h) && /<input type=range id=subudr min=0 max=17 value=17 aria-label="Budget a year">/.test(h), "the headline can change; the budget slider starts at 'any'");
ok(/data-pmin="45000"/.test(h) && /from <b>AED 45,000<\/b> a year/.test(h), "each card carries and shows its cheapest asking rent");
ok(BUDGET_STEPS[BUDGET_STEPS.length - 1] === null && /var STEPS=\[40000,/.test(SUPPLY_JS), "the steps reach the page; the last is 'any'");
ok(/okB=bmax==null\|\|\(pm>0&&pm<=bmax\)/.test(SUPPLY_JS) && /\(!on\.length\|\|on\.some\(function\(t\)\{return ts\.indexOf\(t\)>=0\}\)\)&&okB/.test(SUPPLY_JS), "the filter is home types AND budget");
ok(/hl\.innerHTML=\(on\.length\?"<b>"\+tot\.toLocaleString\("en-US"\)\+"<\/b> "\+names\.join\(" or "\)\+" adverts &middot; ":""\)/.test(SUPPLY_JS) && /else hl\.innerHTML=hl0/.test(SUPPLY_JS), "the headline counts the chosen types' adverts and the matching buildings; back to the total when nothing is chosen");
console.log(`v529 supply budget: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);