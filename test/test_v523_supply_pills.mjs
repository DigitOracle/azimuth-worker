// v523 - "What's advertised where": the home-type pills filter the buildings (Kendall 11 Oct 2026: "these pills should filter").
import fs from "node:fs";
import { homeTypesHtml, supplyPageHtml, SUPPLY_JS } from "../src/supply_page.js";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };

const pills = homeTypesHtml([{ type: "Apartment", n: 4509 }, { type: "Penthouse", n: 8 }]);
ok(/<button type=button class=htp data-ht="Apartment" aria-pressed=false>/.test(pills) && /data-ht="Penthouse"/.test(pills) && /<div class=dk id=suhsay hidden><\/div>/.test(pills), "the pills are buttons, with a line for the result");
const b = (i, types) => ({ id: "k" + i, matched: true, key: "businessbay:" + i, slug: "s" + i, name: "Tower " + i, district: "businessbay", live: 100 - i, sources: {}, urls: {}, bandRows: [], slugs: ["s" + i], types, crawled: "" });
const D = { slug: "businessbay", crawled: "", sites: 1, homeTypes: [{ type: "Apartment", n: 40 }, { type: "Penthouse", n: 2 }], buildings: Array.from({ length: 34 }, (_, i) => b(i, i === 32 ? ["Apartment", "Penthouse"] : ["Apartment"])) };
const h = supplyPageHtml({ view: "district", d: D, key: "k" });
ok((h.match(/class="card[^"]*" data-b=/g) || []).length === 34, "every building is in the page (not only the first 30)");
ok((h.match(/class="card htx htmore"/g) || []).length === 4, "past the first 30 they wait, hidden, for a filter");
ok(/data-b="k32" data-types="Apartment\|Penthouse"/.test(h), "each card says which home types its adverts are");
ok(/v523 - the home-type pills filter the buildings/.test(SUPPLY_JS) && /hit=!on\.length\?!c\.classList\.contains\("htmore"\):on\.some/.test(SUPPLY_JS), "the filter: none on = the 30 as before; on = any building with one of the chosen types");
ok(/show all<\/a>/.test(SUPPLY_JS), "a 'show all' clears it");

// the filter, run on a stand-in page
const cards = D.buildings.map((x, i) => ({ more: i >= 30, types: x.types.join("|"), cls: new Set(i >= 30 ? ["htx", "htmore"] : []) }));
const mkCls = (s) => ({ contains: (c) => s.has(c), toggle: (c, v) => (v ? s.add(c) : s.delete(c)), add: (c) => s.add(c), remove: (c) => s.delete(c) });
const pillEls = ["Apartment", "Penthouse"].map((t) => { const s = new Set(); return { s, attrs: { "data-ht": t }, classList: mkCls(s), getAttribute(k) { return this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; }, firstChild: { textContent: t === "Penthouse" ? "Penthouses " : "Apartments " } }; });
const cardEls = cards.map((c) => ({ classList: mkCls(c.cls), getAttribute: () => c.types }));
const say = { hidden: true, innerHTML: "" };
const document = { querySelectorAll: (q) => (q.indexOf(".htp") === 0 ? Object.assign(pillEls.slice(), { forEach: Array.prototype.forEach }) : cardEls), getElementById: (id) => (id === "suhsay" ? say : null) };
const js = SUPPLY_JS.slice(SUPPLY_JS.indexOf("// v523 - the home-type pills"), SUPPLY_JS.indexOf("})();", SUPPLY_JS.indexOf("// v523 - the home-type pills")) + 5);
new Function("document", js)(document);
pillEls[1].onclick();
const shown = cardEls.map((c, i) => !c.classList.contains("htx") ? i : -1).filter((i) => i >= 0);
ok(shown.length === 1 && shown[0] === 32 && /1 building with Penthouses/.test(say.innerHTML), "Penthouses on: the one building with a penthouse advert - found past the first 30", { shown, say: say.innerHTML });
pillEls[1].onclick();
ok(cardEls.filter((c) => !c.classList.contains("htx")).length === 30 && say.hidden, "off again: the 30 most advertised, the line gone");

console.log(`v523 supply pills: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
