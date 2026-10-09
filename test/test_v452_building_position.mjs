// v452 - the BUILDING POSITION CHECK on the map (Kendall 9 Oct 2026: "Make sure you utilize all the sources ... you're depending on one maybe").
// img_bldg_pos_<district> holds per register key the point the sources agree on. Offline fixtures only.   node test/test_v452_building_position.mjs
import { positionOf, positionLine, placement } from "../src/building_position.js";
import { advertsHtml, streetMap } from "../src/supply_page.js";
import { loadBuilding, buildingHtml } from "../src/broker_building.js";
import { parseParams } from "../src/devmap_pdf.js";
import { __resetKvMemo } from "../src/brief.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{FE0F}]/u;
const textOf = (h) => h.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");

const POS = { district: "testdist", b: {
  "testdist:42": { lat: 25.0505, lon: 55.1505, sources_agree: ["makani", "plot", "footprint"], disagree: [{ source: "pf", metres: 240 }], footprint_index: 42 },
  "testdist:44": { lat: 25.0505, lon: 55.1525, sources_agree: ["makani", "plot"], disagree: [{ source: "footprint", metres: 220 }], footprint_index: 43, moved_to: 43 },
  "testdist:9": { lat: 25.05, lon: 55.15, sources_agree: ["makani", "plot", "footprint"], disagree: [], footprint_index: 9 },
  "testdist:bad": { lat: "x", lon: 1, sources_agree: [] } } };

console.log("A - the record and the line");
{
  const p = positionOf(POS, "testdist:42");
  ok(p && p.lat === 25.0505 && p.index === 42 && !p.moved, "a stored record is read and checked");
  ok(positionOf(POS, "testdist:bad") === null && positionOf(null, "testdist:42") === null && positionOf(POS, "testdist:1") === null, "malformed, missing file or missing key: nothing (old behaviour)");
  ok(positionLine(p) === "Property Finder's pin is 240 m off; using Makani, the plot and our footprint.", "Property Finder off: says how far and what is used", positionLine(p));
  ok(positionLine(p, true) === "Position: Makani, plot and footprint agree.", "without Property Finder (PDF): the agreement only", positionLine(p, true));
  ok(positionLine(positionOf(POS, "testdist:9")) === "Position: Makani, plot and footprint agree.", "all agree: one quiet line");
  const m = placement(positionOf(POS, "testdist:44"), 44);
  ok(m.bk === 43 && m.flagged && /Our first outline sat 220 m off/.test(m.line), "our footprint disagrees: the footprint nearest the agreed point is drawn, and flagged", m.line);
  ok(placement(null, 7) === null, "no record: no placement");
}

console.log("B - the advert card map (supply page)");
{
  const fp = { c: [[55.15, 25.05], [55.151, 25.05], [55.151, 25.051], [55.15, 25.05]], h: 120, ll: [25.0505, 55.1505] };
  const ads = { "1": [{ price: 100000, lat: 25.0527, lon: 55.1505, url: "" }] };
  const pl = placement(positionOf(POS, "testdist:42"), 42);
  const h = advertsHtml({ name: "Creek Heights", ads, bands: {}, fp, pos: pl });
  ok(/data-lat="25\.050500" data-lon="55\.150500"/.test(h), "the map is centred on the agreed point, not Property Finder's pin");
  ok(/class=spl>Property Finder's pin is 240 m off; using Makani, the plot and our footprint\.<\/div>/.test(h) && h.indexOf("class=spl") > h.indexOf("class=smap"), "one quiet line under the map");
  ok(/data-fp='/.test(h), "the gold footprint rides along");
  const old = advertsHtml({ name: "Creek Heights", ads, bands: {}, fp });
  ok(!/class=spl/.test(old) && /data-lat="25\.050500"/.test(old), "a district with no positions file: today's behaviour (footprint centre, no line)");
  const bare = advertsHtml({ name: "X", ads, bands: {} });
  ok(/data-lat="25\.052700"/.test(bare) && !/class=spl/.test(bare), "no footprint and no positions: Property Finder's point as before");
  ok(!EMOJI.test(h) && !/\b(PF|DLD|ID|KV)\b/.test(textOf(h)), "no emojis, no unexplained abbreviations");
  ok(streetMap(99, 1, "x") === "", "an impossible point draws no map");
}

console.log("C - the broker sheet");
{
  const store = new Map();
  const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" || (t && t.type === "arrayBuffer") ? new TextEncoder().encode(v).buffer : v; }, async put() {}, async delete() {}, async list() { return { keys: [] }; } };
  const J = (k, o) => store.set("img_" + k, JSON.stringify(o));
  const BOUNDS = [32292, 22604, 16684];
  const evv = (n, med) => [n, med, n, med, 0, 0, n, med, 0, 0, 50, 80, 120];
  const cell = (n, psf, bed) => { const ppsm = Math.round(psf * 10.7639); return [n, ppsm, Math.round(ppsm * (60 + 25 * bed)), bed]; };
  const dev = (name, psf, n, projects) => { const c = [cell(Math.ceil(n / 2), psf, 1), cell(Math.ceil(n / 2), psf * 1.02, 2)]; return { n: name, h: n * 3, c, c12: c, b: projects.map((nm) => [Math.ceil(n / projects.length), Math.round(psf * 10.7639), nm]), r: [], ev: { all: evv(n, Math.round(psf * 10.7639)), l12: evv(n, Math.round(psf * 10.7639)), y: [[2026, n, 1]], top: [] } }; };
  const IDX = { as_of: "2026-10-01", generated: "2026-10-01", cuts: { bounds: BOUNDS, shares: { bounds: BOUNDS, window: ["2025-10-01", "2026-10-01"], sales: 1000, n: [9, 20, 35, 36], money: [26, 25, 26, 24] }, rule: "x" }, devs: {}, alias: {},
    areas: { testdist: { name: "Test Heartland", bbox: [55.1, 25.0, 55.2, 25.1], register_sales_12m: 400, register_sales_all_time: 900, ev: { all: evv(900, 20000), l12: evv(400, 21000), y: [[2026, 400, 21000]] }, devs: { sobha: dev("Sobha", 2000, 120, ["Creek Heights"]) } } },
    scale: {}, ev: { as_of: "2026-09-30", since: "2019-01-01", l12_from: "2025-10-01", l12_to: "2026-09-30", source_as_of: "2026-10-01", sales: 5000, filters: "Ordinary sales." } };
  for (const a of Object.values(IDX.areas)) for (const [k, d] of Object.entries(a.devs)) { const e = IDX.devs[k] || (IDX.devs[k] = { name: d.n, areas: 0, n: 0, profile: { projects: 0, homes: 0 } }); e.areas++; e.n += d.c.reduce((q, c) => q + c[0], 0); e.profile.projects += d.b.length; }
  J("devmap_index", IDX);
  const row = (date, prices, psm) => ({ date, district: "testdist", area: "Al Test", dld_project: "Creek Heights", dld_project_number: 2717, key: "dld:creekheights", developer: "SOBHA L.L.C", kind: "sale", stage: "offplan", beds: "1", sales: prices.length, price_n: prices.length, prices, psm });
  J("sales_filed_testdist", { as_of: "2026-10-06", district: "testdist", rows: [row("2026-09-01", [1e6, 1.1e6, 1.2e6, 1.3e6, 1.4e6], [20000, 21000, 22000, 23000, 24000])] });
  const sq = (x, y, s) => [x, y, x + s, y, x + s, y + s, x, y + s, x, y];
  J("brief_fp_testdist", { ll: [1, 0, 0, 0, 1, 0], b: [[42, 120, sq(55.15, 25.05, 0.001)], [43, 60, sq(55.152, 25.05, 0.001)], [44, 30, sq(55.15, 25.052, 0.001)]], s: [] });
  const env = { MEETINGS: KV, READ_KEY: "owner_key_abcdefgh" };
  const P = (bk, q) => parseParams(new URL("https://x/developers_pdf?kind=building&area=testdist&project=2717&name=Creek%20Heights&bk=" + bk + "&" + q));

  __resetKvMemo();
  let L = await loadBuilding(env, P(42, "format=html"), { owner: true });
  ok(L.status === 200 && !L.B.posLine && L.B.bk === 42, "no positions file: today's behaviour (our footprint, no line)", JSON.stringify(L.body));
  J("bldg_pos_testdist", POS);
  __resetKvMemo();
  L = await loadBuilding(env, P(42, "format=html"), { owner: true });
  let page = buildingHtml(L.B, L.B.C.p).html;
  ok(/class="smap" data-lat="25\.050500" data-lon="55\.150500"/.test(page), "web page: centred on the agreed point");
  ok(/Property Finder\W+s pin is 240 m off; using Makani, the plot and our footprint\./.test(textOf(page)), "owner web page: the quiet line names Property Finder's pin");
  __resetKvMemo();
  L = await loadBuilding(env, P(42, ""), { owner: true });
  const pdf = buildingHtml(L.B, L.B.C.p).html;
  ok(!/Property Finder/.test(pdf) && /Position: Makani, plot and footprint agree\./.test(textOf(pdf)), "PDF: never names Property Finder; the agreement line only");
  __resetKvMemo();
  L = await loadBuilding(env, P(44, "format=html"), { owner: true });
  page = buildingHtml(L.B, L.B.C.p).html;
  ok(L.B.bk === 43 && /data-fp='\{"c":\[\[55\.152/.test(page) && /Our first outline sat 220 m off/.test(textOf(page)), "our footprint disagrees: the gold is the footprint at the agreed point, and the line says so", L.B.bk);
  ok(!EMOJI.test(page), "no emojis");
}

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
