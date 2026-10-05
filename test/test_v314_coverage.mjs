// v314 - COVERAGE: "no page should drop a registered project; if the app says nothing while the register has the data, that is our failure" (Kendall, 4 Oct 2026).
// The coverage audit (scratchpad coverage_audit.md) found 197 of 410 live Brief query cells empty although the register held >= 10 records in each.
//   A  FIX 1  an area search (areas=) reaches rent-index records that carry no district, by their Land Department area name, case-folded; no false matches
//   B  FIX 2  the area figure: where an area was asked for and no building has 3 lettings of that size, the AREA's own figure is shown, labelled as the area's
//   C  FIX 3  Buy for areas with sales but no Buy cards: register-built cards + Brief-only items (img_buy_extra); no building page, flags carried
//   D  MERGE  scripts/merge_cov_cards.mjs rules (rebuild replaces, no double count, no id collision, map_prices keeps every other field)
//   E  CELLS  six of the audit's false-empty cells replayed from real fixtures: empty on release-v312, answered now
//   N  NEGATIVE CONTROLS against release-v312 (git archive): the same data and queries give nothing there
// Fixtures are REAL: records cut from a live read of img_rent_index (4 Oct 2026) and cards built from the Land Department register (test/fixtures/v314_*.json).
//   node test/test_v314_coverage.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import * as NEW from "../src/brief.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const here = path.dirname(fileURLToPath(import.meta.url)), repo = path.join(here, "..");
const RENT = JSON.parse(fs.readFileSync(path.join(here, "fixtures", "v314_rent.json"), "utf8"));
const BUY = JSON.parse(fs.readFileSync(path.join(here, "fixtures", "v314_buy.json"), "utf8"));

// release-v312 source, for the negative controls
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "v314-"));
execFileSync("tar", ["-x"], { cwd: tmp, input: execFileSync("git", ["archive", "release-v312", "src"], { cwd: repo, maxBuffer: 128 * 1024 * 1024 }) });
const OLD = await import(pathToFileURL(path.join(tmp, "src", "brief.js")).href);

const GEO = { districts: [{ slug: "jumeirahvillagecircle", name: "Jumeirah Village Circle" }, { slug: "alsatwa", name: "Al Satwa" }, { slug: "alyelayiss1", name: "Al Yelayiss 1" }, { slug: "palmdeira", name: "Palm Deira" }, { slug: "liwan1", name: "Wadi Al Safa 2" }] };
function mkEnv(files) {
  const store = new Map(Object.entries(files).map(([k, v]) => ["img_" + k, JSON.stringify(v)]));
  return { MEETINGS: { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" || (t && t.type === "arrayBuffer") ? new TextEncoder().encode(v).buffer : v; }, async list() { return { keys: [], list_complete: true }; } } };
}
const rentEnv = (ri) => mkEnv({ rent_index: ri || RENT, districts_geo: GEO });
const run = async (mod, env, q, opts) => { mod.__resetKvMemo && mod.__resetKvMemo(); const r = await mod.briefSearch(env, new URLSearchParams(q), Object.assign({ owner: false, live: false }, opts || {})); return r.body; };
const rentQ = (areas, bed, type, extra) => Object.assign({ mode: "rent", beds: String(bed), type: type || "apartment", areas, limit: "50" }, extra || {});

// ================= A. FIX 1: the area search reaches records with no district =================
console.log("A - an area search reaches rent-index records that carry no district");
{
  const nod = RENT.items.filter((it) => !it.d);
  ok(nod.length >= 60 && nod.every((it) => it.area), "the fixture holds real district-less records (" + nod.length + "), each with its Land Department area", nod.length);
  ok(NEW.searchAreaOf({ d: null, area: "Al Warsan First" }) === "alwarsanfirst" && NEW.searchAreaOf({ d: "alsatwa", area: "Al Satwa" }) === "alsatwa" && NEW.searchAreaOf({ d: null, area: "Wadi Al Safa 7" }) === "wadialsafa7" && NEW.searchAreaOf({}) === null,
    "searchAreaOf: the district where there is one, else the case-folded area with spaces dropped, else null");
  ok(NEW.searchAreaOf({ d: null, area: "AL WARSAN FIRST" }) === "alwarsanfirst", "case-folded: AL WARSAN FIRST and Al Warsan First are one area");
  const b = await run(NEW, rentEnv(), rentQ("alwarsanfirst", 1, "apartment"));
  ok(b.results.length >= 5 && b.results.every((r) => r.dld_area === "Al Warsan First" && r.district === null), "areas=alwarsanfirst finds Al Warsan First's records (" + b.results.length + "), all from that area, none with a district", JSON.stringify(b.results.map((r) => r.dld_area)));
  ok(b.results.every((r) => r.evidence.n >= 3 && !r.area_figure), "the 3-record rule still holds on every building row", JSON.stringify(b.results.map((r) => r.evidence.n)));
  ok(b.results.every((r, i, a) => i === 0 || (({ within: 0, stretch: 1, a_little_above: 2, above: 3 })[a[i - 1].verdict] <= ({ within: 0, stretch: 1, a_little_above: 2, above: 3 })[r.verdict])), "ranking is unchanged: verdict tiers in order");
  ok(/Al Warsan First/.test(JSON.stringify(b.summary || [])) || b.empty == null, "the district-less area is named from its own record, not shown as a raw slug");
  ok(!b.notes.length, "a client key gets no notes (owner-only), as before");
  const bw = await run(NEW, rentEnv(), rentQ("warsanfourth", 1, "apartment"));
  ok(bw.results.length >= 3 && bw.results.every((r) => r.dld_area === "Warsan Fourth"), "areas=warsanfourth finds Warsan Fourth only - no Al Warsan First record leaks in (no false match)", JSON.stringify(bw.results.map((r) => r.dld_area)));
  for (const wrong of ["alwarsan", "warsan", "alwarsanfirs", "alwarsanfirstx", "mirdi"]) {
    const bn = await run(NEW, rentEnv(), rentQ(wrong, 1, "apartment"));
    ok(bn.results.length === 0, "areas=" + wrong + " (a prefix or a near spelling) finds nothing - no prefix or fuzzy match", bn.results.length);
  }
  const both = await run(NEW, rentEnv(), rentQ("alwarsanfirst,warsanfourth", 1, "apartment"));
  ok(both.results.length === b.results.length + bw.results.length, "two areas together return both lists (" + both.results.length + ")", both.results.length + " vs " + (b.results.length + bw.results.length));
  // a district search and an all-Dubai search are NOT changed by this fix
  const d1 = await run(NEW, rentEnv(), rentQ("jumeirahvillagecircle", 1, "apartment")), d0 = await run(OLD, rentEnv(), rentQ("jumeirahvillagecircle", 1, "apartment"));
  ok(d1.results.length > 0 && JSON.stringify(d1.results.map((r) => [r.key, r.rank, r.evidence.median])) === JSON.stringify(d0.results.map((r) => [r.key, r.rank, r.evidence.median])), "a district search (JVC) returns exactly what release-v312 returns, in the same order (" + d1.results.length + " rows)");
  const e1 = await run(NEW, rentEnv(), { mode: "rent", beds: "1", type: "apartment", limit: "50" }), e0 = await run(OLD, rentEnv(), { mode: "rent", beds: "1", type: "apartment", limit: "50" });
  ok(JSON.stringify(e1.results.map((r) => r.key)) === JSON.stringify(e0.results.map((r) => r.key)), "an all-Dubai search (no areas=) returns the same records as release-v312");
  const n0 = await run(OLD, rentEnv(), rentQ("alwarsanfirst", 1, "apartment"));
  ok(n0.results.length === 0, "NEGATIVE CONTROL: release-v312 returns NOTHING for areas=alwarsanfirst on the same data", n0.results.length);
  // compare=1 (the area comparison) now has a column for a district-less area
  const cmp = await run(NEW, rentEnv(), rentQ("alwarsanfirst,warsanfourth", 1, "apartment", { compare: "1" }));
  ok(cmp.comparison && cmp.comparison.length === 2 && cmp.comparison[0].rent.v === true && /Al Warsan First/.test(cmp.comparison[0].name) && cmp.comparison[0].matches.total >= 1, "compare=1 gives Al Warsan First its own column with a rent figure and its matches", JSON.stringify(cmp.comparison && cmp.comparison.map((c) => [c.name, c.rent.v, c.matches.total])));
}

// ================= B. FIX 2: the area figure =================
console.log("B - the area figure where no building can be listed");
{
  const b = await run(NEW, rentEnv(), rentQ("alwarsanfirst", 3, "apartment"));
  const ar = b.results[0];
  ok(b.results.length === 1 && ar.area_figure === true, "Al Warsan First 3-bed apartments: no building has 3 lettings, so ONE area-figure row is offered", JSON.stringify(b.results.map((r) => [r.name, r.area_figure])));
  ok(ar.name === "Al Warsan First (whole area)" && ar.district === null && ar.building_url === null && ar.app_id === null && ar.key === "area:alwarsanfirst", "it is named for the whole area, with no district, building page, app id - and its own key", JSON.stringify([ar.name, ar.district, ar.building_url, ar.app_id, ar.key]));
  const rowA = RENT.areas.find((a) => a.area === "Al Warsan First");
  ok(ar.evidence.basis === "ejari_area" && ar.evidence.scope === "area" && ar.evidence.n === rowA.b["3"].n && ar.evidence.median === (rowA.b["3"].nn >= 3 ? rowA.b["3"].mn : rowA.b["3"].m), "its figure and contract count are the AREA's own (n " + ar.evidence.n + "), never a building's", JSON.stringify(ar.evidence));
  ok(/Area figure, not one building/.test(ar.why) && /all of Al Warsan First/.test(ar.why) && /15 registered lettings/.test(ar.why), "the label says it is the area's, with the count and the window", ar.why);
  ok(!/not known/i.test(JSON.stringify(ar)), "no 'not known' anywhere on the row (client text stays plain)");
  ok(ar.completeness.record === null && !ar.estimated_left && !ar.estimated_left_withheld && ar.criteria.length === 0, "no building completeness, no estimated-left, no criteria are claimed for it");
  ok(b.summary.length && !b.empty, "the page has a list, not an empty state");
  const bo = await run(NEW, rentEnv(), rentQ("alwarsanfirst", 3, "apartment"), { owner: true });
  ok(bo.notes.some((n) => /area figure/.test(n) && /never a building's figure/.test(n)), "the owner's notes explain the area figure");
  // a building that qualifies: no area row is added next to it
  const bb = await run(NEW, rentEnv(), rentQ("alwarsanfirst", 1, "apartment"));
  ok(bb.results.length > 0 && !bb.results.some((r) => r.area_figure), "where buildings can be listed, no area row is added");
  // the replay flag (areaFigure: false) is the 'before' of this fix
  const off = await run(NEW, rentEnv(), rentQ("alwarsanfirst", 3, "apartment"), { areaFigure: false });
  ok(off.results.length === 0, "areaFigure: false turns it off (the coverage replay's 'fix 1 alone' run)");
  // thresholds
  const thin = JSON.parse(JSON.stringify(RENT)); thin.areas.find((a) => a.area === "Al Warsan First").b["3"].n = NEW.AREA_FIGURE_MIN - 1;
  const bt = await run(NEW, rentEnv(thin), rentQ("alwarsanfirst", 3, "apartment"));
  ok(bt.results.length === 0, "an area with fewer than " + NEW.AREA_FIGURE_MIN + " contracts of that size gets no area row");
  const lo = await run(NEW, rentEnv(), rentQ("alwarsanfirst", 3, "apartment", { min: "150000", max: "200000" }));
  ok(lo.results.length === 0, "the budget still decides: an area figure of AED 100,000 is not offered to a 150-200k brief (the minimum is a hard floor)");
  // villas read the register's own bedroom count where it gives 3+ (vr), as for buildings
  const v = await run(NEW, rentEnv(), rentQ("mirdif", 3, "villa"));
  ok(v.results.length === 1 && v.results[0].area_figure && v.results[0].evidence.home === "villa" && v.results[0].evidence.n === 215, "Mirdif 3-bed villa: the area figure, with the villa home type and its 215 contracts", JSON.stringify(v.results.map((r) => [r.name, r.evidence.n])));
  // an area with no records at all is still an honest empty
  const ne = await run(NEW, rentEnv(), rentQ("atlantis", 2, "apartment"));
  ok(ne.results.length === 0 && ne.empty && /atlantis/i.test(ne.empty.title + ne.empty.reasons.join(" ")), "an area the index does not hold says so (empty state), it is not invented");
  const n0 = await run(OLD, rentEnv(), rentQ("alsatwa", 3, "apartment"));
  const n1 = await run(NEW, rentEnv(), rentQ("alsatwa", 3, "apartment"));
  ok(n0.results.length === 0 && n1.results.length === 1 && n1.results[0].area_figure, "Al Satwa (a district): release-v312 has NO 3-bed answer; now the area figure answers (NEGATIVE CONTROL)", n0.results.length + "/" + n1.results.length);
  // the area-row's key never resolves as a building
  ok(!/^dld:/.test(ar.key) && ar.key === ar.key.replace(/[^a-z0-9_:-]/g, ""), "its key is [a-z0-9_:-] only and not a dld: building key");
}

// ================= C. FIX 3: Buy for areas the Brief could not see =================
console.log("C - Buy cards built from the register");
{
  const MPLIVE = { generated: "2026-09-09 14:58", count: 2, items: [{ p: "other", n: "Other Tower", d: "palmjumeirah", i: 5, lon: 55.1, lat: 25.1, st: "verified", u: 100, b: { "2": 2000000 }, fl: 20 }] };
  const cardsOf = (d) => ({ district: d, buildings_by_id: BUY.cards[d] || {} });
  const files = { map_prices: MPLIVE, districts_geo: GEO, unitmix_alyelayiss1: cardsOf("alyelayiss1"), unitmix_palmdeira: cardsOf("palmdeira"), unitmix_wadialsafa7: cardsOf("wadialsafa7"), buy_extra: { generated: "x", items: BUY.items } };
  const env = mkEnv(files);
  const say = (b) => JSON.stringify(b.results.map((r) => [r.name, r.evidence.n, r.evidence.median]));
  const q = (a, bed, type) => ({ mode: "buy", beds: String(bed), type, areas: a, limit: "50" });
  const ay = BUY.items.filter((x) => x.d === "alyelayiss1");
  ok(ay.length >= 2 && ay.every((x) => x.x === 1 && x.syn === 1 && x.i >= 900000 && x.lon === undefined), "the Brief-only items are marked (x, syn), carry ids from 900000 and no map position", JSON.stringify(ay[0]));
  const bed = Math.max(...Object.keys(ay[0].b).map(Number));
  const b = await run(NEW, env, q("alyelayiss1", Math.min(bed, 3), "villa,townhouse"));
  ok(b.results.length >= 1, "Al Yelayiss 1 (DAMAC Islands) Buy now answers (" + b.results.length + " projects)", say(b));
  const r0 = b.results[0];
  ok(b.results.every((r) => r.building_url === null && r.app_id === null && r.completeness.record === false && r.district === "alyelayiss1"), "no register-built project claims a building page, an app id or a building record", JSON.stringify([r0.building_url, r0.app_id, r0.completeness]));
  ok(b.results.every((r) => r.evidence.scope === "project" && r.evidence.n >= 3 && r.evidence.window_from && Array.isArray(r.evidence.caveats)), "each carries its project scope, n >= 3, the window date and its caveats");
  ok(b.results.every((r) => r.evidence.caveats.some((c) => /plot size/.test(c)) && r.evidence.caveats.some((c) => /Bedrooms are as the Land Department register records them/.test(c))), "villa caveats: the register's area is the plot size (no price per sq ft), bedroom basis flagged", JSON.stringify(r0.evidence.caveats));
  ok(b.results.every((r) => r.evidence.sqm === null), "no size or price per sq ft is given for a villa (the register's area is its plot)");
  ok(/Registered|Off-plan/.test(r0.why) && /since 20/.test(r0.why) && /no building page in the app yet/.test(r0.why), "the 'why' states the sales window and that there is no building page", r0.why);
  ok(!/not known/i.test(JSON.stringify(b.results.map((r) => [r.why, r.evidence.caveats]))), "no 'not known' in the client text");
  const bo = await run(NEW, env, q("alyelayiss1", Math.min(bed, 3), "villa,townhouse"), { owner: true });
  ok(bo.notes.some((n) => /built from the Land Department sales register/.test(n) && /no building page, building outline or map position/.test(n)), "the owner's notes say what these rows are");
  const a0 = await run(OLD, env, q("alyelayiss1", Math.min(bed, 3), "villa,townhouse"));
  ok(a0.results.length === 0, "NEGATIVE CONTROL: release-v312 returns NOTHING for the same Buy query (the cards are in KV; no item reaches them)", a0.results.length);
  // off-plan: contract values, said so
  const pdItems = BUY.items.filter((x) => x.d === "palmdeira"), pbed = Math.min(3, Math.max(...Object.keys(pdItems[0].b).map(Number)));
  const bp = await run(NEW, env, q("palmdeira", pbed, "apartment"));
  ok(bp.results.length >= 1 && bp.results.every((r) => /contract value/i.test(r.evidence.price_basis) && /contract value/i.test(r.why)), "Palm Deira (all off-plan): every row says the price is a contract value", say(bp) + " " + (bp.results[0] && bp.results[0].evidence.price_basis));
  ok((await run(OLD, env, q("palmdeira", pbed, "apartment"))).results.length === 0, "NEGATIVE CONTROL: release-v312 returns nothing for Palm Deira");
  // Arabian Ranches (EXTRA_AREAS): Buy now answers where cards exist; the old 'no cards' note stays where they do not
  const w7 = BUY.items.filter((x) => x.d === "wadialsafa7"), w7bed = Math.min(3, Math.max(...Object.keys(w7[0].b).map(Number)));
  const bw = await run(NEW, env, q("wadialsafa7", w7bed, w7[0].fl <= 3 ? "villa,townhouse" : "apartment"), { owner: true });
  ok(bw.results.length >= 1 && !bw.notes.some((n) => /holds no unit-mix cards/.test(n)), "Wadi Al Safa 7 Buy answers and the 'holds no unit-mix cards' note is gone", say(bw));
  const b6 = await run(NEW, env, q("wadialsafa6", 3, "villa,townhouse"), { owner: true });
  ok(b6.results.length === 0 && b6.notes.some((n) => /holds no unit-mix cards/.test(n)), "Wadi Al Safa 6 without cards: the honest note is kept (nothing invented)");
  // a map_prices item with the same (district, id) wins over the extra one: no duplicate row
  const dupItem = Object.assign({}, ay[0], { n: "Map Wins", lon: 55.2, lat: 25.0 });
  const bd = await run(NEW, mkEnv({ ...files, map_prices: { ...MPLIVE, items: MPLIVE.items.concat([dupItem]) } }), q("alyelayiss1", Math.min(bed, 3), "villa,townhouse"));
  ok(bd.results.filter((r) => r.app_id === ay[0].i || r.key === "alyelayiss1:" + ay[0].i).length <= 1 && bd.results.length === b.results.length, "the same (district, id) in map_prices and img_buy_extra is listed once");
  // buyPrelim skips an extra item without a district or id (no crash, no row)
  const bad = await run(NEW, mkEnv({ ...files, buy_extra: { items: [{ n: "no district", i: 900001, b: { "3": 1000000 } }, { n: "no id", d: "alyelayiss1", b: { "3": 1000000 } }, null] } }), q("alyelayiss1", 3, "villa,townhouse"));
  ok(bad.results.length === 0 && (bad.error == null), "extra items with no district or no id are skipped, not listed and not fatal");
  // a real, priced Liwan card published as a map_prices item answers Buy (the 'publish' fix)
  if (BUY.liwan) {
    const L = BUY.liwan, LB = Math.min(...Object.keys(L.item.b).map(Number));
    const lf = { map_prices: { generated: "x", count: 2, items: MPLIVE.items.concat([L.item]) }, districts_geo: GEO, unitmix_liwan1: { district: "liwan1", buildings_by_id: { [L.id]: L.card } } };
    const lb = await run(NEW, mkEnv(lf), q("liwan1", LB, "apartment")), l0 = await run(NEW, mkEnv({ ...lf, map_prices: MPLIVE }), q("liwan1", LB, "apartment"));
    ok(lb.results.length === 1 && lb.results[0].name === L.card.name && lb.results[0].building_url === "/building/liwan1/" + L.id, "Liwan (Wadi Al Safa 2): the card's map-price item makes the building answer Buy, with its real building page", say(lb));
    ok(l0.results.length === 0, "NEGATIVE CONTROL: the same card without its map-price item gives nothing (what the live app does today)");
  }
}

// ================= D. the merge rules =================
console.log("D - scripts/merge_cov_cards.mjs");
{
  const d = fs.mkdtempSync(path.join(tmp, "merge-")), cards = path.join(d, "cards"), live = path.join(d, "live"), out = path.join(d, "out");
  for (const x of [cards, live]) fs.mkdirSync(x);
  const card = (name, syn, extra) => Object.assign({ name, rows: [{ type: "3 bedroom", median_aed: 3000000, units: 5 }], dld_sales: { sold_by_type: { "3 bedroom": 5 }, project: name }, synthetic: syn || undefined }, extra || {});
  fs.writeFileSync(path.join(cards, "unitmix_alyelayiss1.synthetic.json"), JSON.stringify({ district: "alyelayiss1", buildings_by_id: { 900101: card("Brand New Villas", true), 900102: card("Already Priced Place", true) } }));
  fs.writeFileSync(path.join(cards, "buy_extra.json"), JSON.stringify({ generated: "x", items: [{ p: "brandnewvillas", n: "Brand New Villas", d: "alyelayiss1", i: 900101, syn: 1, x: 1, b: { 3: 3000000 } }, { p: "alreadypricedplace", n: "Already Priced Place", d: "alyelayiss1", i: 900102, syn: 1, x: 1, b: { 3: 3000000 } }, { p: "k", n: "Karma", d: "liwan1", i: 174, x: 1, b: { 1: 1 } }] }));
  fs.writeFileSync(path.join(cards, "map_prices_add.json"), JSON.stringify({ items: [{ p: "mazaya14", n: "Mazaya 14", d: "liwan1", i: 572, lon: 55.3, lat: 25.1, b: { 1: 830000 } }, { p: "dup", n: "Dup", d: "liwan1", i: 579, lon: 55.3, lat: 25.1, b: { 1: 1 } }] }));
  fs.writeFileSync(path.join(live, "unitmix_alyelayiss1.json"), JSON.stringify({ district: "alyelayiss1", generated: "g", buildings_by_id: { 5: card("Real Tower"), 6: card("Already Priced Place"), 900050: card("Old Synthetic", true), 7: { name: "Unpriced", rows: [{ type: "1 bedroom" }] } } }));
  fs.writeFileSync(path.join(live, "map_prices.json"), JSON.stringify({ generated: "2026-09-09", count: 2, note: "keep me", items: [{ d: "liwan1", i: 579, n: "Binghatti Jewels", b: { 2: 1 } }, { d: "x", i: 1, n: "x", b: {} }] }));
  const run1 = spawnSync(process.execPath, [path.join(repo, "scripts", "merge_cov_cards.mjs"), "--cards", cards, "--live", live, "--out", out], { encoding: "utf8" });
  ok(run1.status === 0, "the merge runs", run1.stderr);
  const um = JSON.parse(fs.readFileSync(path.join(out, "unitmix_alyelayiss1.json"), "utf8")).buildings_by_id;
  ok(um["5"] && um["6"] && um["7"], "every existing card is kept untouched");
  ok(um["900101"] && !um["900050"], "a previous run's synthetic card is replaced (a rebuild never duplicates), the new one is added");
  ok(!um["900102"], "a register-built card whose name matches a PRICED live card is dropped (not counted twice)");
  const bx = JSON.parse(fs.readFileSync(path.join(out, "buy_extra.json"), "utf8")).items;
  ok(bx.some((x) => x.i === 900101) && !bx.some((x) => x.i === 900102) && bx.some((x) => x.d === "liwan1" && x.i === 174), "buy_extra keeps the items of surviving cards and the real position-less cards, and drops the dropped card's item");
  const mp = JSON.parse(fs.readFileSync(path.join(out, "map_prices.json"), "utf8"));
  ok(mp.items.length === 3 && mp.items.some((x) => x.i === 572) && mp.items.filter((x) => x.i === 579).length === 1 && mp.note === "keep me" && mp.count === 3 && mp.generated === "2026-09-09", "map_prices: the new item is added once, the one already live is not duplicated, every other field is kept");
  fs.writeFileSync(path.join(live, "unitmix_alyelayiss1.json"), JSON.stringify({ buildings_by_id: { 900101: card("A Real Card Holds This Id") } }));
  const run2 = spawnSync(process.execPath, [path.join(repo, "scripts", "merge_cov_cards.mjs"), "--cards", cards, "--live", live, "--out", path.join(d, "out2")], { encoding: "utf8" });
  ok(run2.status !== 0 && /refusing to overwrite/.test(run2.stderr), "an id held by a card that is not register-built stops the run (no overwrite)", run2.stderr.slice(0, 200));
}

// ================= E. six of the audit's false-empty cells, replayed from the real fixture =================
console.log("E - the audit's false-empty cells (live matrix, 4 Oct 2026)");
{
  // [area, slug asked, beds, type, min, max, what the audit found live]
  const CELLS = [
    ["Al Warsan First", "alwarsanfirst", 1, "apartment", 21500, 64500, "R0b: rent records outside districts"],
    ["Warsan Fourth", "warsanfourth", 1, "apartment", 31000, 93000, "R0b"],
    ["Mirdif", "mirdif", 3, "villa,townhouse", 62500, 187500, "R0b"],
    ["Jumeirah First", "jumeirahfirst", 2, "apartment", 86000, 258000, "R0b"],
    ["Trade Center First", "tradecenterfirst", 3, "apartment", 100000, 300000, "R0b + thin"],
    ["Al Satwa", "alsatwa", 3, "apartment", 90000, 270000, "R2: below the 3-record rule in the 2-month window"],
  ];
  for (const [area, slug, bed, type, min, max, why] of CELLS) {
    const qq = { mode: "rent", beds: String(bed), type, areas: slug, min: String(min), max: String(max), limit: "50" };
    const o = await run(OLD, rentEnv(), qq), n = await run(NEW, rentEnv(), qq);
    ok(o.results.length === 0 && n.results.length >= 1, area + " rent " + bed + "-bed " + type + " (" + why + "): empty on release-v312, " + n.results.length + " answer(s) now", o.results.length + "/" + n.results.length);
  }
}

console.log("\n" + pass + " passed, " + fail + " failed");
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
process.exit(fail ? 1 : 0);
