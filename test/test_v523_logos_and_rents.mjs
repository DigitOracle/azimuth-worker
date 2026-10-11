// v523 - (1) every Worker PDF header carries the Najma brand mark, never the word "Najma" (Kendall 11 Oct 2026: "audit all .pdf every single
// one and it should have this logo"); the investor report loads it like every other document. (2) the broker building sheet's rent cards take
// the window rollup (Peninsula Four: "these sections should not be blank"), and the reason under a card is true. (3) /adv_bldg never caches
// an answer with no listings.
import fs from "node:fs";
import { BRIEF_KIT } from "../src/brief_docs.js";
import { BRAND_MARK_JPG } from "../src/brand_mark.js";
import { rentFigures } from "../src/broker_building.js";
import { ejariRow } from "../src/ejari_page.js";
import { advBldgRoute } from "../src/city_bldg.js";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };

// 1. the mark
ok(/^data:image\/jpeg;base64,\/9j\//.test(BRAND_MARK_JPG) && BRAND_MARK_JPG.length > 10000, "the built-in mark is a real JPEG");
const noLogo = BRIEF_KIT.logo({}, 112), withLogo = BRIEF_KIT.logo({ logo: "data:image/jpeg;base64,AAAA" }, 112);
ok(noLogo.includes(BRAND_MARK_JPG) && !/>Najma</.test(noLogo), "no stored picture: the header carries the built-in mark, never the word", noLogo.slice(0, 120));
ok(withLogo.includes("data:image/jpeg;base64,AAAA"), "a stored picture is still preferred");
const it = fs.readFileSync(new URL("../src/investor_tiers_page.js", import.meta.url), "utf8");
ok(/const logo = \(await BRIEF_KIT\.kvDataUrl\(env, HEADER_JPG_KEY/.test(it) && /figures: opts && opts\.figures, logo \}/.test(it), "the investor report loads the mark and hands it to its header");
const src = fs.readdirSync(new URL("../src/", import.meta.url)).filter((f) => f.endsWith(".js")).map((f) => [f, fs.readFileSync(new URL("../src/" + f, import.meta.url), "utf8")]);
const textLogo = src.filter(([f, t]) => /class="serif"[^>]*>Najma<\/div>/.test(t)).map(([f]) => f);
ok(!textLogo.length, "no source prints the word 'Najma' as a header logo", textLogo);

// 2. the rent cards: the window rollup
const roll = [["2", 13, 225000], ["3+", 9, 300000], ["studio", 23, 80000], ["1", 63, 130000], ["retail", 1, null]].map(([beds, n, med]) =>
  ejariRow({ window: "12m", date: "2026-10-11", district: "businessbay", dld_project: "PENINSULA FOUR", dld_project_number: 2461, key: "businessbay:647", beds, sub_type: beds === "retail" ? "Shop" : "Flat", contracts: n, rent_median: med }));
const R = Object.assign(rentFigures(roll.filter(Boolean), { from: "0000-00-00", to: "9999-99-99" }), { pooled: true });
const b2 = R.bands.find((b) => b.band === "2"), b3 = R.bands.find((b) => b.band === "3+");
ok(b2 && b2.n === 13 && b2.rent === 225000, "2 bedrooms: 13 contracts give a typical rent (AED 225,000)", b2);
ok(b3 && b3.n === 9 && b3.rent === 300000, "3+ bedrooms: 9 contracts give a typical rent (AED 300,000)", b3);
const bb = fs.readFileSync(new URL("../src/broker_building.js", import.meta.url), "utf8");
ok(/function rentWhy\(b, R\)/.test(bb) && /plural\(b\.n, "contract"\) \+ rentWhy\(b, R\)/.test(bb), "the reason under a card comes from rentWhy");
const rentWhy = new Function("MIN_PRICED", "plural", bb.slice(bb.indexOf("function rentWhy(b, R)"), bb.indexOf("function rentBlock(B)")) + "; return rentWhy;")(5, (n, w) => n + " " + w + (n === 1 ? "" : "s"));
ok(rentWhy({ n: 1, rent: null }, { pooled: true }) === ", fewer than 5 to set a typical rent", "1 contract: 'fewer than 5' is true");
ok(rentWhy({ n: 13, rent: null }, { pooled: true }) === ", fewer than 5 of them record a rent" && rentWhy({ n: 13, rent: null }, {}) === ", too few days with 3 or more contracts to set a typical rent", "13 contracts and no figure: never 'fewer than 5', the true reason");
ok(rentWhy({ n: 23, priced: 6, rent: 80000 }, {}) === ", typical rent from 6 contracts with a daily figure", "the older daily path discloses how many contracts set the figure");
ok(/const wk = \/12\/\.test\(String\(p\.win \|\| ""\)\) \? "12m" : "all";/.test(bb) && /edRaw\.rollup\.filter\(\(r\) => r && r\.window === wk\)/.test(bb), "the sheet takes the rollup for its own window");

// 3. no listings, no cache
const env = { MEETINGS: { get: async () => null } };
const r = await advBldgRoute(env, new URL("https://w.example/adv_bldg?k=businessbay:647&key=c"), { tier: () => "client" });
ok(r.headers.get("Cache-Control") === "no-store", "an answer without listings is never cached");

console.log(`v523 logos and rents: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
