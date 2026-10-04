// v306 (Kendall, 4 Oct 2026): the BUY documents (mode=buy) and the client-wording fixes found by the pilot audit.
// Built on REAL values read from the KV (test/fixtures/v306_real_kv.json: Emaar in Dubai Marina and Downtown, DAMAC in Business Bay); Google is not called.
// NEGATIVE CONTROL: against release-v305 every buy document is a 501 (section A fails there); the audit fixes (section D) fail there too.
//   node test/test_v306_buy_pdf.mjs
import fs from "node:fs";
import { buildDocument, parseQuery, buyFig, buyOf, wquant, tierOfPpsm, TIER_BOUNDS } from "../src/brief_docs.js";
import { ratingOf } from "../src/brief.js";
import { __resetKvMemo } from "../src/brief.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const FX = JSON.parse(fs.readFileSync(new URL("./fixtures/v306_real_kv.json", import.meta.url), "utf8"));
const store = new Map();
const J = (k, o) => store.set("img_" + k, JSON.stringify(o));
for (const [d, u] of Object.entries(FX.unitmix)) J("unitmix_" + d, u);
J("map_prices", { generated: "2026-10-04", items: FX.map_prices });
J("districts_geo", { districts: FX.districts });
J("amenities", { items: [{ k: "metro", n: "Test Metro Station", lat: 25.0725, lon: 55.1361 },
  { k: "school", n: "Alpha School", x: "Not inspected due to COVID 19", lat: 25.0735, lon: 55.137 }, { k: "school", n: "Fresh School", x: "not yet inspected", lat: 25.0736, lon: 55.137 }, { k: "school", n: "Good School", x: "Good · British", lat: 25.074, lon: 55.14 },
  { k: "clinic", n: "LIFE PHARMACY EXPRESS CLINIC", lat: 25.0726, lon: 55.1362 }, { k: "clinic", n: "Real Family Clinic", lat: 25.0745, lon: 55.14 }] });
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async list() { return { keys: [] }; } };
const env = { MEETINGS: KV };
const build = async (qs) => { __resetKvMemo(); return buildDocument(env, parseQuery(new URL("https://x/brief_pdf?mode=buy&" + qs)), { origin: "" }); };
const text = (h) => h.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ").replace(/&middot;/g, "·").replace(/&ndash;/g, "-").replace(/&rsquo;/g, "'").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const BANNED = [/not known/i, /not yet verified/i, /to follow/i, /unknown/i, /not inspected/i, /not yet inspected/i, /\b0\.0 km/, /No lettings/i, /\brent(s|al|ed|ing)?\b/i, /ejari/i, /estimate/i, /available now/i, /still filling/i, /\bleft\b/i,
  /satellite/i, /bayut|propertyfinder|dubizzle/i, /damacproperties|ctfassets/i, /claude|gpt|gemini|anthropic|openai|hexagon/i, /contact@|\+971 58|\+971 56 227/];
const scan = (label, h) => { const t = text(h); const hit = BANNED.map((r) => r.exec(t)).filter(Boolean).map((m) => m[0] + " ... " + t.slice(Math.max(0, m.index - 40), m.index + 50)); ok(h.length > 500 && !hit.length, "banned-phrase scan: " + label, hit.join(" || ")); };

// ---- A. the documents exist ------------------------------------------------------------------------------------------------------
const VIDA = "dubaimarina:10", RES = "burjkhalifa:67";
const dmar = await build("kind=dossier&keys=" + VIDA + "&beds=2&min=1800000&max=2500000&num=1&of=3");
ok(dmar.status === 200 && dmar.pages === 2, "A1 an Emaar Dubai Marina buy dossier builds: 2 pages (v307) (not a 501)", dmar.status + " " + JSON.stringify(dmar.body || ""));
const dres = await build("kind=dossier&keys=" + RES + "&beds=2&min=4000000&max=5500000");
ok(dres.status === 200 && dres.pages === 2, "A2 an Emaar Downtown buy dossier builds");
// a DAMAC Business Bay option: the card carries no developer, the name does (devcross project rule)
const bbKey = "businessbay:" + Object.keys(FX.unitmix.businessbay.buildings_by_id).find((i) => /paramount/i.test(FX.unitmix.businessbay.buildings_by_id[i].name));
const ddam = await build("kind=dossier&keys=" + bbKey + "&beds=1&min=1500000&max=2600000");
ok(ddam.status === 200 && ddam.pages === 2, "A3 a DAMAC Business Bay buy dossier builds", ddam.status + JSON.stringify(ddam.body || ""));
const cmp = await build("kind=compare&keys=" + [VIDA, RES].join(",") + "&beds=2&min=1800000&max=5500000&compare=1&areas=dubaimarina,burjkhalifa");
ok(cmp.status === 200 && /The areas side by side/.test(cmp.html) && cmp.pages === 4, "A4 a buy compare: the areas side by side + the one-sheet + a map per area = 4 pages", cmp.pages);
const one = await build("kind=onesheet&keys=" + [VIDA, RES, bbKey].join(",") + "&beds=2&min=1000000&max=6000000");
ok(one.status === 200 && /options to buy in/.test(one.html), "A5 a buy one-sheet builds (several options)", one.status + JSON.stringify(one.body || ""));
const pack = await build("kind=pack&keys=" + [VIDA, RES].join(",") + "&beds=2&min=1800000&max=5500000");
ok(pack.status === 200 && pack.pages >= 2 + 2 * 3 - 1 && pack.pages <= 2 + 6, "A6 a buy pack: one-sheet, map(s), 2 or 3 pages per option (v307), no rent appendix", pack.pages);

// ---- B. the numbers: price per sq ft, n >= 3, never an estimate --------------------------------------------------------------------
const vida = FX.unitmix.dubaimarina.buildings_by_id["10"], row2 = vida.rows.find((r) => r.type === "2 bedroom");
const f = buyFig(vida, "2 bedroom");
const psf = Math.round(row2.median_aed / row2.median_sqm / 10.7639);
ok(f && f.aed === Math.round(row2.median_aed) && f.psf === psf && f.n === vida.dld_sales.sold_by_type["2 bedroom"], "B1 price per sq ft = typical price / typical size / 10.7639 (" + psf + "), n = the 2-bedroom sales count", JSON.stringify(f));
const t = text(dmar.html);
ok(t.includes("AED " + row2.median_aed.toLocaleString("en-US")) && t.includes("AED " + psf.toLocaleString("en-US") + " per sq ft") && t.includes("SALES RECORDED".replace("RECORDED", "RECORDED")) && new RegExp("\\b" + f.n + "\\b").test(t), "B2 the dossier prints the price, the price per sq ft and the sales count", t.slice(0, 700));
ok(/Sales recorded at the Land Department, not asking prices/.test(t) && /sales recorded at the Land Department, not asking prices/i.test(t), "B3 'sales recorded at the Land Department, not asking prices' is on the page");
ok(buyFig({ rows: [{ type: "2 bedroom", median_aed: 2e6, median_sqm: 100 }], dld_sales: { sold_by_type: { "2 bedroom": 2 } } }, "2 bedroom") === null, "B4 two sales is not enough: no figure (n >= 3)");
ok(buyFig({ rows: [{ type: "2 bedroom", est_aed: 2e6, median_sqm: 100 }], dld_sales: { sold_by_type: { "2 bedroom": 50 } } }, "2 bedroom") === null, "B5 an estimate (est_aed, no median_aed) is never a sale price");
ok(buyFig({ rows: [{ type: "2 bedroom", median_aed: 2e6, median_sqm: 100 }], dld_sales: { sold_by_type: {} } }, "2 bedroom") === null, "B6 no sale count on the card: no figure");
ok(wquant([[1, 1], [2, 1], [3, 1], [4, 1]], 0.25) === 1 && wquant([[1, 1], [2, 1], [3, 1], [4, 1]], 0.5) === 2 && wquant([[10, 5], [20, 1]], 0.5) === 10, "B7 the sale-weighted quantile is devmap_core's");
ok(/AED 1,298 &ndash; 2,907|AED [\d,]+ - [\d,]+/.test(text(dmar.html).replace(/&ndash;/g, "-")) && /Emaar's \d+ buildings in Dubai Marina/i.test(t), "B8 the middle half is across the developer's buildings in the community, and says so", t.match(/ACROSS[^.]*\./i));
ok(/DEVELOPER Emaar/.test(t) && /DEVELOPER DAMAC/.test(text(ddam.html)), "B9 the developer is shown by its devcross canonical name (Emaar, DAMAC - the DAMAC card has no developer field; its name gives it)");
// tier floors parity with src/devmap_core.js
const core = fs.readFileSync(new URL("../src/devmap_core.js", import.meta.url), "utf8");
const bounds = /TIER_CFG=\{bounds:\[(\d+),(\d+),(\d+)\]/.exec(core).slice(1).map(Number);
ok(JSON.stringify(bounds) === JSON.stringify(TIER_BOUNDS), "B10 the tier floors are TIER_CFG.bounds of devmap_core.js", bounds.join());
ok(tierOfPpsm(32292) === 0 && tierOfPpsm(32291) === 1 && tierOfPpsm(22604) === 1 && tierOfPpsm(16684) === 2 && tierOfPpsm(16683) === 3, "B11 the tier edges (3,000 / 2,100 / 1,550 per sq ft)");
ok(/PRICE TIER Premium · AED 1,550 to 2,100 per sq ft/.test(t), "B12 VIDA 2-bed (AED " + psf + " per sq ft) is Premium, with the band", t.match(/PRICE TIER[^.]*\./));

// ---- C. the budget is a total price; the minimum is a hard floor; fit shown ----------------------------------------------------------
ok(/Within the budget/.test(dmar.html), "C1 AED 1.8m-2.5m: the 2-bedroom (AED 2,223,444) is within the budget");
const under = await build("kind=dossier&keys=" + VIDA + "&beds=2&min=2300000&max=3000000");
ok(under.status === 422 && !under.html, "C2 minimum 2.3m: the 2.22m option is under the hard floor, so there is no document (422)", under.status);
const stretch = await build("kind=dossier&keys=" + VIDA + "&beds=2&min=1500000&max=2100000&stretch=2300000");
ok(stretch.status === 200 && /In the stretch/.test(stretch.html) && /inside the stretch of AED 2,300,000/.test(text(stretch.html)), "C3 above the target but inside the stretch: said so");
const above = await build("kind=dossier&keys=" + VIDA + "&beds=2&min=1500000&max=2150000");
ok(above.status === 200 && /A little over the budget/.test(above.html), "C4 5% over the top: 'a little over the budget'");
const far = await build("kind=dossier&keys=" + VIDA + "&beds=2&min=1000000&max=1500000");
ok(far.status === 422, "C5 more than 15% over the top: not offered (422)");
const none = await build("kind=dossier&keys=" + VIDA + "&beds=2");
ok(none.status === 200 && !/What the budget buys/.test(none.html) && !/class="fit"/.test(none.html), "C6 no budget given: no fit line");
const mixed = await build("kind=onesheet&keys=" + [VIDA, RES].join(",") + "&beds=2&min=1800000&max=2500000");
ok(mixed.status === 200 && mixed.C.recs.length === 1 && mixed.C.noEvidence.length === 1, "C7 a one-sheet leaves out the option that does not fit the budget floor/window (1 of 2 kept)", mixed.C && mixed.C.recs.length);
const three = await build("kind=dossier&keys=" + VIDA + "&beds=3&min=3000000&max=4000000");
ok(three.status === 200 && /three-bedroom/.test(text(three.html)), "C8 beds=3 reads the 3-bedroom row (AED 3.42m)");

// ---- D. no availability, no gaps, no rent, the house footer ---------------------------------------------------------------------------
for (const [l, d] of [["Marina dossier", dmar], ["Downtown dossier", dres], ["DAMAC dossier", ddam], ["compare", cmp], ["one-sheet", one], ["pack", pack]]) scan(l, d.html);
ok(!/DEVELOPER AVAILABILITY|availbox|for sale now|Available now/.test(dmar.html + one.html), "D1 no availability claim anywhere");
const cur = [...dmar.html.matchAll(/<div class="curator"[^>]*>([\s\S]*?)<\/div>/g)].map((m) => m[1].replace(/<svg[\s\S]*?<\/svg>/, "[WA]"));
ok(cur.length === 2 && cur.every((c) => c === "Curated by Najjuko &middot; Dubai Decoded [WA] +971 56 548 4397"), "D2 the footer is only 'Curated by Najjuko · Dubai Decoded' + WhatsApp +971 56 548 4397");
// the audit fixes
const nb = text(dmar.html);
ok(!/not (yet )?inspected|COVID/i.test(nb) && /Good School/.test(nb), "D3 school inspection lines ('Not inspected due to COVID 19', 'not yet inspected') are omitted", nb.match(/Schools:[^C]*/));
ok(ratingOf("Not inspected due to COVID 19") === "" && ratingOf("not yet inspected") === "" && ratingOf("Good · British") === "Good" && ratingOf("Outstanding") === "Outstanding", "D4 ratingOf keeps a rating, drops the inspection lines");
ok(/Real Family Clinic/.test(nb) && !/PHARMACY|Pharmacy/.test(nb), "D5 a pharmacy is not listed as a clinic", nb.match(/Clinics:[^.]*/));
ok(!/0\.0 km/.test(nb + text(one.html)), "D6 no '0.0 km'");

// ---- E. the rent documents: gaps are left out, "0.0 km" is "on site" only when exact ------------------------------------------------------
store.set("img_rent_index", JSON.stringify({ as_of: "2026-09-30", items: [
  { p: "emptyone", n: "Empty One", d: "dubaimarina", i: 10, lon: 55.1361, lat: 25.0725, area: "Marsa Dubai", b: {} },
  { p: "emptytwo", n: "Empty Two", d: "dubaimarina", lon: 55.1361, lat: 25.0725, area: "Marsa Dubai", b: {} }] }));
const rentOne = async (key, extra) => { __resetKvMemo(); return buildDocument(env, parseQuery(new URL("https://x/brief_pdf?kind=dossier&mode=rent&beds=1&keys=" + key + (extra || ""))), { origin: "" }); };
const re = await rentOne("dubaimarina:10");
ok(re.status === 200 && !/No (one-bedroom )?lettings|in the latest pull|none let recently/i.test(text(re.html)), "E1 a rent dossier with no lettings: no 'No lettings in the latest pull' (the row is omitted)", text(re.html).match(/No[^.]*lettings[^.]*/));
ok(/Nearest metro: Test, on site/.test(text(re.html)) && !/0\.0 km/.test(text(re.html)), "E2 a metro within 50 m of an exactly placed building reads 'on site', never '0.0 km'", text(re.html).match(/Nearest metro[^.]*/));
const re2 = await rentOne("dld:emptytwo");
ok(re2.status === 200 && !/Nearest metro/.test(text(re2.html)) && !/0\.0 km/.test(text(re2.html)), "E3 an approximately placed building: the under-50 m distance is omitted", text(re2.html).match(/WHERE IT IS[^.]*/));

console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
