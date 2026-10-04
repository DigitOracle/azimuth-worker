// DEVELOPERS MAP (v301) - /developers_map: an area click shows its developers grouped into four price tiers, with each developer's median
// price per sq ft, the sales behind it and its homes; per-realtor shortlist; budget; developer view; two-area compare; rent.
//
// What this proves:
//   1. the aggregation (src/devmap_core.js, the SAME text the page runs): weighted medians, the n >= 3 gate ("not enough sales", never a
//      number), the per-developer split, the four tiers and the rule "the tier where most of a developer's sales fall" (+ the second tier),
//      tier mix by count and by value, the shortlist filter, the budget filter (per sq ft and total with bedrooms), the developer view,
//      the two-area compare, the rent evidence rule, WHERE (my developers per area), the client meeting and "not one of my developers"
//   2. the index builder turns unit-mix cards into cells (estimates never, no sale count never, one developer however it is spelled)
//   3. through the real worker (worker.fetch, KV stubbed): the key gate, the page parses, the footer, no portal / LLM names, the START
//      card, the index route, and the shortlist stored per client key (a hash, never the key; keys do not share a list)
//   4. optionally the REAL index when DEVMAP_INDEX points at a built file (checked for shape and the gate on real data)
// NEGATIVE CONTROLS: (a) the core with its gate set to 0 must show the 2-sale developer a number (so check 1 can fail);
//   (b) put src/index.js back to release-v300 (git show release-v300:src/index.js > src/index.js) and run this file: /developers_map falls to
//   the keyed catch-all and the route checks fail.
//
//   node test/test_v301_devmap.mjs
import worker from "../src/index.js";
import { DEVMAP_CORE_JS } from "../src/devmap_core.js";
import { devmapHtml, shortlistName, cleanShortlist, DEVMAP_FOOTER } from "../src/devmap_page.js";
import { DM, buildArea } from "../scripts/build_devmap_index.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d !== undefined ? "\n         " + String(typeof d === "object" ? JSON.stringify(d) : d).slice(0, 400) : "")); } };
const parses = (code) => { const f = path.join(os.tmpdir(), "devmap_" + Math.random().toString(36).slice(2) + ".js"); fs.writeFileSync(f, code); try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); return true; } catch (e) { console.log(String(e.stderr || e.message).slice(0, 600)); return false; } finally { try { fs.unlinkSync(f); } catch (e) {} } };

// ---- 1. the aggregation, on a fixture worked out by hand -----------------------------------------------------------------------
const B = [30000, 20000, 12000];   // AED per sq m: ultra-luxury from 30,000, luxury from 20,000, premium from 12,000, below = budget
const DEVS = {
  alpha: { n: "Alpha", h: 400, c: [[10, 35000, 3500000, 2], [5, 25000, 2500000, 2]], r: [[3, 700, 70000, 1]] },
  beta: { n: "Beta", h: 120, c: [[4, 15000, 900000, 1], [2, 22000, 1500000, 2]], r: [[2, 600, 50000, 1]] },
  gamma: { n: "Gamma", h: 10, c: [[2, 8000, 500000, 0]], r: [] },
  _: { n: "Developer not recorded", h: 0, c: [[10, 9000, 600000, 0]], r: [] },
};
const IDX = { as_of: "2026-09-29", cuts: { bounds: B }, devs: { alpha: { name: "Alpha", areas: 2, n: 15 }, beta: { name: "Beta", areas: 1, n: 6 }, gamma: { name: "Gamma", areas: 1, n: 2 } },
  areas: { testville: { name: "Testville", devs: DEVS }, otherton: { name: "Otherton", devs: { alpha: { n: "Alpha", h: 5, c: [[6, 14000, 800000, 1]], r: [] } } } } };
const st = DM.areaStats(IDX.areas.testville, IDX);
ok(JSON.stringify(DM.TIER_NAMES) === JSON.stringify(["ULTRA-LUXURY", "LUXURY", "PREMIUM", "BUDGET"]), "the four tier names, in that order (BUDGET, not standard)");
ok(st.n === 33 && st.enough, "area n counts every sale incl. the developer-not-recorded ones", st.n);
ok(st.median === 22000 && st.medianSqft === 2044, "area median per sq m 22,000 = 2,044 per sq ft (weighted median)", [st.median, st.medianSqft]);
ok(st.q1 === 9000 && st.q3 === 35000, "middle range q1..q3 from the same weights", [st.q1, st.q3]);
ok(st.mixN.join("/") === "30/21/12/36", "tier mix by count 30/21/12/36", st.mixN);
const vsum = st.mixValue, vtot = (10*3500000+5*2500000+4*900000+2*1500000+2*500000+10*600000);
ok(vsum[0] === Math.round(100 * 10 * 3500000 / vtot) && vsum[3] === Math.round(100 * (2 * 500000 + 10 * 600000) / vtot), "tier mix by value (count x median price) worked out by hand", vsum);
ok(st.tiers[0].devs.length === 1 && st.tiers[0].devs[0].k === "alpha" && st.tiers[2].devs[0].k === "beta" && st.tiers[1].devs.length === 0, "alpha sits in ULTRA-LUXURY (10 of 15 sales), beta in PREMIUM (4 of 6); LUXURY is empty");
ok(st.tiers[0].devs[0].second && st.tiers[0].devs[0].second.tier === 1 && st.tiers[0].devs[0].second.share === 33, "alpha also shows 33% LUXURY (a second tier of 20%+ is stated)", st.tiers[0].devs[0].second);
ok(st.tiers[0].devs[0].median === 35000 && st.tiers[0].devs[0].medianSqft === 3252 && st.tiers[0].devs[0].n === 15 && st.tiers[0].devs[0].homes === 400, "a developer row: median per sq m and per sq ft, n sales, homes");
ok(st.tiers[0].median === 35000 && st.tiers[0].nDevs === 1 && /30,000 per sq m \(AED 2,787 and above per sq ft\)|AED 30,000 and above per sq m/.test(st.tiers[0].band), "a tier header: band, number of developers, median", st.tiers[0].band);
ok(/under AED 12,000 per sq m/.test(st.tiers[3].band), "BUDGET band reads 'under' the premium floor", st.tiers[3].band);
// the gate
ok(st.notEnough.length === 1 && st.notEnough[0].k === "gamma" && st.notEnough[0].median === null && st.notEnough[0].medianSqft === null, "gamma has 2 sales: 'not enough sales', and NO number");
ok(!st.tiers.some((t) => t.devs.some((d) => d.k === "gamma")), "a developer under 3 sales is in no tier");
ok(st.unknown && st.unknown.n === 10, "sales with no developer recorded are counted, not given to anyone", st.unknown);
const thin = DM.areaStats({ name: "Thin", devs: { z: { n: "Z", h: 0, c: [[2, 20000, 1, 1]] } } }, IDX);
ok(!thin.enough && thin.median === null, "an area under 3 sales shows no median");
// negative control (a): the same text with the gate at 0 would print a number for gamma
const DM0 = new Function(DEVMAP_CORE_JS.replace("EVIDENCE_MIN=3", "EVIDENCE_MIN=0") + "; return DM;")();
const st0 = DM0.areaStats(IDX.areas.testville, IDX);
ok(st0.notEnough.length === 0 && st0.tiers[3].devs.some((d) => d.k === "gamma" && d.median === 8000), "NEGATIVE CONTROL: with the gate removed gamma gets a number - so the gate check above can fail");
// shortlist
const sl = DM.shortlistFilter(st, { alpha: true }, IDX.areas.testville);
ok(sl.tiers[0].devs.length === 1 && sl.tiers[2].devs.length === 0 && sl.notEnough.length === 0 && st.tiers[2].devs.length === 1 && sl.tiers[2].median === null && sl.tiers[0].median === 35000, "shortlist keeps only my developers and leaves the full stats untouched");
// budget
const sd = (k) => st.tiers.flatMap((t) => t.devs).find((d) => d.k === k);
let f = DM.budgetFit(DEVS.alpha, sd("alpha"), { mode: "sqft", max: 2000 }, B);
ok(f.fit === false && f.median === 3252, "budget AED 2,000 per sq ft: alpha (3,252) is out", f);
f = DM.budgetFit(DEVS.beta, sd("beta"), { mode: "sqft", max: 2000 }, B);
ok(f.fit === true && f.median === 1394, "budget AED 2,000 per sq ft: beta (1,394) fits", f);
f = DM.budgetFit(DEVS.beta, sd("beta"), { mode: "sqft", min: 1500, max: 2000 }, B);
ok(f.fit === false, "a minimum drops the developer below it");
f = DM.budgetFit(DEVS.beta, sd("beta"), { mode: "total", max: 1000000, beds: 1 }, B);
ok(f.fit === true && f.median === 900000 && f.n === 4, "total budget AED 1m, 1 bedroom: beta's 1-bed median 900,000 fits", f);
f = DM.budgetFit(DEVS.beta, sd("beta"), { mode: "total", max: 2000000, beds: 2 }, B);
ok(f.fit === null && /not enough sales/.test(f.why), "total budget, 2 bedrooms: beta has 2 such sales -> 'not enough sales', not a guess", f);
f = DM.budgetFit(DEVS.gamma, st.notEnough[0], { mode: "sqft", max: 9999 }, B);
ok(f.fit === null, "a developer under 3 sales never 'fits'");
// developer view and compare
let v = DM.developerView(st, { ppsm: 26000 });
ok(v.ok && v.tier === 1 && v.tierName === "LUXURY" && v.shareN === 21 && /21% of settled sales in Testville/.test(v.say) && /No developer with 3\+ sales sits in that tier/.test(v.say), "developer view: 26,000 per sq m lands in LUXURY; 21% of sales; no competitor there", v.say);
v = DM.developerView(st, { tier: 0 });
ok(v.ok && v.shareN === 30 && v.competitors.length === 1 && v.competitors[0].k === "alpha", "developer view by tier: ULTRA-LUXURY, 30% of sales, alpha is the competitor");
ok(!DM.developerView(thin, { ppsm: 20000 }).ok, "developer view on an area with too few sales says so, no number");
const cmp = DM.compareAreas(DM.areaStats(IDX.areas.testville, IDX), DM.areaStats(IDX.areas.otherton, IDX), { ppsm: 14000 });
ok(cmp.a.ok && cmp.b.ok && cmp.a.tier === 2 && cmp.b.tier === 2 && cmp.a.shareN === 12 && cmp.b.shareN === 100, "compare two areas for the same price: Testville 12% premium, Otherton 100%", [cmp.a.shareN, cmp.b.shareN]);
// where / client meeting
const mine = { alpha: true, gamma: true };
const wm = DM.whereMine(IDX, mine);
ok(wm.testville === 2 && wm.otherton === 1, "WHERE: my developers active per area", wm);
let cm = DM.clientMeeting(IDX, { alpha: true, beta: true }, { mode: "sqft", max: 2000 }, "Zeta Builders");
const tv = cm.areas.find((x) => x.slug === "testville"), ot = cm.areas.find((x) => x.slug === "otherton");
ok(cm.areas.length === 2 && tv.devs.length === 1 && tv.devs[0].k === "beta" && ot.devs[0].k === "alpha", "client meeting, AED 2,000 per sq ft: Testville has beta only (alpha 3,252 is out); Otherton fits alpha (1,301)", cm.areas.map((x) => x.slug + ":" + x.devs.map((d) => d.k)));
ok(cm.named && cm.named.mine === false && cm.named.known === false, "a developer the client names that is not on my list is shown plainly as not mine");
cm = DM.clientMeeting(IDX, { alpha: true }, { mode: "sqft" }, "ALPHA DEVELOPMENTS L.L.C");
ok(cm.named.mine === true && cm.named.known === true, "the same developer however the register spells it is recognised as mine");
const cr = DM.clientMeetingRent(IDX, { alpha: true, beta: true }, { max: 100000, beds: 1 });
ok(cr.length === 1 && cr[0].devs.length === 1 && cr[0].devs[0].k === "alpha" && cr[0].devs[0].rpsf === 65, "rental: alpha has 3 contracts (fits, AED 65 per sq ft a year); beta has 2 -> left out", JSON.stringify(cr));
ok(DM.rentStats(DEVS.beta).enough === false && DM.rentStats(DEVS.alpha).enough === true, "rent: the same n >= 3 rule");
ok(DM.devKey("IMTIAZ DEVELOPMENTS L.L.C") === "imtiaz" && DM.devKey("Imtiaz") === "imtiaz" && DM.devKey("Prestige One Developments") === "prestige one", "one developer however the register spells it");
ok(DM.TIER_CFG.bounds === null && DM.percentileBounds([[50, 100], [50, 200], [50, 300], [50, 400]], [75, 50, 25]).join() === "300,200,100", "tier bounds: one config object, null = Dubai-wide percentiles; percentileBounds works");
const own = DM.areaStats(IDX.areas.testville, IDX, { bounds: [40000, 30000, 20000] });
ok(own.mixN.join("/") !== st.mixN.join("/") && own.bounds.join() === "40000,30000,20000", "Kendall's own bounds in the config object change the bands");

// ---- 2. the index builder ------------------------------------------------------------------------------------------------------
const cards = { buildings_by_id: {
  1: { name: "One", developer: "Imtiaz", registered_homes: 50, rows: [{ type: "1 bedroom", median_sqm: 50, median_aed: 1000000 }, { type: "2 bedroom", median_sqm: 80, est_aed: 1500000 }], dld_sales: { sold_by_type: { "1 bedroom": 7, "2 bedroom": 4 } } },
  2: { name: "Two", developer: "imtiaz", registered_homes: 100, rows: [{ type: "1 bedroom", median_sqm: 60, median_aed: 1200000 }], dld_sales: { sold_by_type: { "1 bedroom": 3 } } },
  3: { name: "Three", rows: [{ type: "Studio", median_sqm: 30, median_aed: 600000 }], dld_sales: { sold_by_type: { Studio: 5 } } },
  4: { name: "Four", developer: "Zed", rows: [{ type: "1 bedroom", median_sqm: 50, median_aed: 900000 }] },
} };
const bd = buildArea(cards, "x", {}, {}, [], {});
ok(bd.imtiaz && JSON.stringify(bd.imtiaz.c) === JSON.stringify([[7, 20000, 1000000, 1], [3, 20000, 1200000, 1]]), "builder: cells = sales x price per sq m x price x bedrooms; an est_aed row is never a sale price", bd.imtiaz && bd.imtiaz.c);
ok(bd.imtiaz.h === 150 && bd.imtiaz.n === "Imtiaz", "builder: 'Imtiaz' and 'imtiaz' are one developer; homes summed", [bd.imtiaz.h, bd.imtiaz.n]);
ok(bd._ && bd._.c.length === 1 && bd._.c[0][3] === 0, "builder: a building with no developer goes to 'not recorded'");
ok(!bd.zed, "builder: a card with no sale count makes no cell (nothing guessed)");

// ---- 3. through the worker ------------------------------------------------------------------------------------------------------
const READ = "owner_read_key_abcdefghijklmnop", CLIENT = "client_key_current_abcdefghij", CLIENT2 = "client_key_second_abcdefghi";
const store = new Map();
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); const ty = typeof t === "string" ? t : t && t.type;
    if (ty === "arrayBuffer") return typeof v === "string" ? new TextEncoder().encode(v).buffer : v;
    if (ty === "json") return JSON.parse(typeof v === "string" ? v : new TextDecoder().decode(v));
    return typeof v === "string" ? v : new TextDecoder().decode(v); },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })) }; },
};
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT + "," + CLIENT2, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const call = (p, init) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p, init), env, { waitUntil() {} });
const scripts = (html) => [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/\bsrc=/.test(m[1])).map((m) => m[2]);

let r = await call("/developers_map");
ok(r.status === 401, "/developers_map with no key: 401");
r = await call("/developers_map?key=not_a_key_at_all_xx");
ok(r.status === 401, "/developers_map with a wrong key: 401");
r = await call("/developers_map_api?what=index");
ok(r.status === 401, "/developers_map_api with no key: 401");
r = await call("/developers_map_api?what=shortlist", { method: "POST", body: JSON.stringify({ devs: ["alpha"] }) });
ok(r.status === 401 && ![...store.keys()].some((k) => k.startsWith("devmap_shortlist_")), "a POST with no key: 401 and nothing written");
r = await call("/developers_map?key=" + CLIENT);
const html = await r.text();
ok(r.status === 200 && /text\/html/.test(r.headers.get("Content-Type") || ""), "/developers_map opens with the normal CLIENT key (it is Land Department data, like /brief)");
r = await call("/developers_map?key=" + READ);
ok(r.status === 200, "and with the owner key");
const sc = scripts(html);
ok(sc.length === 1 && parses(sc[0]), "the page script parses (node --check)");
ok(sc[0].includes("var DM=(function(){") && sc[0].indexOf("var DM=") < sc[0].indexOf("function sideHtml"), "the page runs the SAME core text the tests ran");
ok(html.includes(DEVMAP_FOOTER) || sc[0].includes("Curated by Najjuko \\u00b7 Dubai Decoded") || sc[0].includes("Curated by Najjuko · Dubai Decoded"), "footer: Curated by Najjuko · Dubai Decoded + WhatsApp +971 56 548 4397", DEVMAP_FOOTER);
ok(/\+971 56 548 4397/.test(sc[0]) && !/58 |\+971 ?58/.test(DEVMAP_FOOTER), "the WhatsApp number is the canonical 56 line");
ok(!/bayut|propertyfinder|property finder|dubizzle|zoopla/i.test(html), "no listing portal is named anywhere on the page");
ok(!/\b(claude|chatgpt|gpt-?\d|openai|gemini|anthropic)\b/i.test(html), "no LLM is named on the page");
ok(/Dubai Land Department sales register, /.test(sc[0]), "the sources line names the Dubai Land Department sales register with its as-of date");
ok(/ULTRA-LUXURY/.test(sc[0]) && /BUDGET/.test(sc[0]) && !/STANDARD/.test(sc[0]), "the page uses ULTRA-LUXURY / LUXURY / PREMIUM / BUDGET");
ok(!/dewa|owner data|residents key|rk=/i.test(html), "no DEWA / residents / owner data on the page");
ok(html.indexOf('data-s=1>1 MY DEVELOPERS') > 0 || sc[0].includes("1 MY DEVELOPERS"), "the three screens: MY DEVELOPERS, WHERE, CLIENT MEETING");

r = await call("/developers_map_api?what=index&key=" + CLIENT);
ok(r.status === 503, "no index published yet: 503, said plainly");
store.set("img_devmap_index", JSON.stringify(IDX));
r = await call("/developers_map_api?what=index&key=" + CLIENT);
const got = await r.json();
ok(r.status === 200 && got.areas.testville && got.cuts.bounds.length === 3, "the published index is served to a client key");
r = await call("/developers_map_api?what=geo&key=" + CLIENT);
ok(r.status === 200 && (await r.json()).type === "FeatureCollection", "geo: an empty collection when no polygons are published (the page falls back to boxes)");

// the shortlist, per client key
r = await call("/developers_map_api?what=shortlist&key=" + CLIENT);
ok(r.status === 200 && (await r.json()).devs.length === 0, "a new realtor key: an empty shortlist");
r = await call("/developers_map_api?what=shortlist&key=" + CLIENT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ devs: ["Alpha", "beta", "alpha", "  Gamma  ", ""] }) });
const pj = await r.json();
ok(r.status === 200 && pj.devs.join() === "alpha,beta,gamma", "POST stores a cleaned, de-duplicated shortlist", pj);
r = await call("/developers_map_api?what=shortlist&key=" + CLIENT);
ok((await r.json()).devs.join() === "alpha,beta,gamma", "and the same key reads it back");
r = await call("/developers_map_api?what=shortlist&key=" + CLIENT2);
ok((await r.json()).devs.length === 0, "a DIFFERENT client key has its own, empty, list (not shared)");
const slKeys = [...store.keys()].filter((k) => k.startsWith("devmap_shortlist_"));
ok(slKeys.length === 1 && slKeys[0] === (await shortlistName(CLIENT)) && !slKeys[0].includes(CLIENT) && !store.get(slKeys[0]).includes(CLIENT), "stored under a hash of the key; the key itself is in no KV name or value", slKeys);
r = await call("/developers_map_api?what=shortlist&key=" + CLIENT, { method: "POST", body: "not json" });
ok(r.status === 400, "a bad body: 400, nothing overwritten");
ok(cleanShortlist(Array.from({ length: 200 }, (_, i) => "d" + i)).length === 60, "the shortlist is capped (60)");

// START: the card
r = await call("/start?key=" + CLIENT);
const sh = await r.text();
ok(r.status === 200 && sh.includes("/developers_map?key=") && /DEVELOPERS BY AREA/.test(sh), "/start carries the DEVELOPERS BY AREA card");

// ---- 4. the real index, if built ------------------------------------------------------------------------------------------------
const RP = process.env.DEVMAP_INDEX;
if (RP && fs.existsSync(RP)) {
  const RI = JSON.parse(fs.readFileSync(RP, "utf8"));
  const ds = DM.areaStats(RI.areas.madinatalmataar, RI);
  ok(ds.enough && ds.tiers.length === 4 && ds.tiers.every((t) => t.devs.every((d) => d.n >= 3 && d.median > 0)), "REAL index: Dubai South has a median and four tiers; every listed developer has 3+ sales", [ds.n, ds.devCount]);
  ok(Object.values(RI.areas).every((a) => a.name && a.devs), "REAL index: every area has a name and developers");
} else console.log("  note - DEVMAP_INDEX not set: real-index checks skipped (scripts/build_devmap_index.mjs writes the file)");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
