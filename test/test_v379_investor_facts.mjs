// v379 - investor-PDF facts for EVERY project: the district shards and the index, the loader and its fall-back, the compact index route, the button matching (by register project number and by name),
// the schema validator and the gate script, and no regression of the earlier investor, button, area-card and attribution tests. Offline: stubs and inline fixtures only, nothing live.
//   node test/test_v379_investor_facts.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { devmapRoutes, devmapHtml } from "../src/devmap_page.js";
import { buildInvestorTiersPdf, loadFacts } from "../src/investor_tiers_page.js";
import { buildPlan, SEGMENTS, PRESETS } from "../src/investor_tiers.js";
import { buildTiersHtml } from "../src/investor_tiers_page.js";
import { INDEX_KEY, LEGACY_KEY, shardKey, districtSlug, validateFacts, loadFactsSharded, compactIndex, matchProject, pkey } from "../src/investor_facts.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clone = (o) => JSON.parse(JSON.stringify(o));

// ------------------------------------------------------------------------------------------------ fixtures: three records in two districts, plus a v376-style legacy Chelsea record
const REG = { schema: 1,
  project: { id: "alpha-tower-1001", name: "Alpha Tower", brand_name: "Alpha Tower by Acme", area: "Test District One", register_area: "Test District One", master_project: "Test Park", project_number: 1001 },
  as_of: { sales: "2026-09-17", register: "2026-06-15", rents: null, built: "2026-10-07" }, window: { from: "2025-09-18", to: "2026-09-17" },
  developer: { brand: "Acme", legal_entity: "ACME DEVELOPMENT L.L.C", evidence: "REGISTER_VERIFIED", basis: "project number 1001 on the project register names developer id 7", brand_line: "Brand name: Acme (matched to the registered company by its name, a name rule; the register records no brands).", registered: "2018-01-01", licence_number: "123", licence_authority: "DED", licence_expires: "2027-01-01" },
  delivery: { entity: { projects: 5, by_status: { FINISHED: 3, ACTIVE: 2 }, source: "Dubai Land Department project register, by developer id" }, record: { n: 3, late: 1, months: [4.5, 4.5], source: "Dubai Land Department project register, finished projects with both dates, delivery record built 2026-10-07" } },
  status: { code: "ACTIVE", text: "Under construction", percent: 55, start: "2024-01-01", planned_end: "2027-12-31", completion: null, units: 120, buildings: 1, escrow: "Test Bank P.J.S.C.", zoning: "Trakhees", source: "Dubai Land Department project register" },
  sales: { all_time: 200, first: "2024-03-01", last: "2026-09-10", l12: 80, l12_median_price: 1500000, l12_median_psf: 1900, median_price: 1400000, by_year: [{ year: 2024, n: 70, psf: 1700 }, { year: 2025, n: 90, psf: 1850 }, { year: 2026, n: 40, psf: 1900 }],
    by_beds: [{ beds: "1 B/R", n: 120, sqft: 700, median_price: 1100000, psf: 1700 }, { beds: "2 B/R", n: 80, sqft: 1100, median_price: 2000000, psf: 1900 }], land_registrations_excluded: 0, all_off_plan: true, source: "Dubai Land Department sales register (unit sales, land excluded) to 2026-09-17" },
  price_plan: { payment_plan: { text: "20% on booking, 40% in instalments before handover, 40% on handover", evidence: "DEVELOPER_CLAIMED", as_of: "2026-09-02", linked_by: "exact project name, and the register company is the same brand (company-name rule)",
      milestones: [{ label: "On booking", pct: 20, before_handover: true }, { label: "Instalments before handover", pct: 40, before_handover: true }, { label: "On handover", pct: 40, before_handover: false }],
      source: { file: "data/dev_meta/acme_portfolio.json", url: "https://acme.example/alpha", quote: "20% on booking, 40% in instalments and 40% on completion" } },
    fees: [{ label: "Dubai Land Department registration fee", rate: 0.04, source: "published fixed fee on a sale" }], fees_unknown: "agent commission, trustee and registration charges, and service charges are not held for this project" },
  market: { area_by_year: [{ year: 2024, n: 900, psf: 1700 }, { year: 2025, n: 1200, psf: 1800 }, { year: 2026, n: 600, psf: 1850 }], dubai_by_year: [{ year: 2024, n: 144000, psf: 1621 }, { year: 2025, n: 175000, psf: 1728 }] },
  city: { l12_sales: 158000, l12_psf: 1742, offplan_share: 0.74, area_l12_sales: 2100, area_l12_psf: 1800 }, supply: { ACTIVE: { projects: 4, homes: 900 }, NOT_STARTED: { projects: 1, homes: 200 } },
  unit_register: { source: "Dubai Land Department unit register, project number 1001, joined by register project id (units to 2026-09-18)", single: { name: "Alpha Tower", project_number: 1001, units: 120, studio: 0, b1: 70, b2: 50, b3: 0, b4plus: 0, other: 0 }, left_for_sale: "not known: the register does not record which homes are still for sale" },
  resales: { separable: false, reason: "the register records every off-plan sale under one procedure, 'Sell - Pre registration'; it does not say whether the seller is the developer or an earlier owner", project_rows: 200, project_resale_procedure_rows: 0, project_by_month: [{ month: "2026-07", n: 10 }, { month: "2026-08", n: 12 }], district_window: { from: "2025-09-18", to: "2026-09-17", pre_registration: 900, existing_property_sell: 40 } },
  amenities: ["Pool", "Gym"], amenities_source: "the developer's own web site https://acme.example, fetched 2026-09-03" };
const ZERO = clone(REG); ZERO.project = { ...ZERO.project, id: "beta-court-1002", name: "Beta Court", brand_name: "Beta Court", register_area: "Test District Two", area: "Test District Two", project_number: 1002 };
Object.assign(ZERO.sales, { all_time: 0, first: null, last: null, l12: 0, l12_median_price: null, l12_median_psf: null, median_price: null, by_year: [], by_beds: [] }); delete ZERO.resales;
ZERO.price_plan = { payment_plan: null, payment_plan_reason: "the developer prints a code (60/40) that does not say which payments fall before or after handover, so no plan is stated; ask the developer", payment_plan_label: "60/40", fees: [], fees_unknown: "x" };
ZERO.status = { ...ZERO.status, code: "NOT_STARTED", text: "Not started", percent: 0 }; ZERO.amenities = null; ZERO.amenities_reason = "no developer source on file";
const OFFREG = { schema: 1, project: { id: "gamma-offregister", name: "Gamma", brand_name: "Gamma by Acme", area: "Test District Two", register_area: "Test District Two", master_project: null, project_number: null, off_register: true, off_register_note: "Gamma is not on the Dubai Land Department project register" },
  as_of: { sales: "2026-09-17", register: null, rents: null, built: "2026-10-07" }, window: { from: "2025-09-18", to: "2026-09-17" },
  developer: { brand: "Acme", legal_entity: null, evidence: "DEVELOPER_CLAIMED", reason: "The developer's own material names Acme as the brand (developer says); the project register has no record of Gamma" },
  delivery: null, delivery_reason: "the project is not on the project register", status: null, status_reason: "Gamma is not on the project register, so no registered status can be given", handover_claim: "Q4 2028",
  sales: { all_time: 0, first: null, last: null, l12: 0, l12_median_price: null, l12_median_psf: null, median_price: null, by_year: [], by_beds: [], land_registrations_excluded: 0, all_off_plan: false, source: "Dubai Land Department sales register to 2026-09-17; no sale row names Gamma" },
  price_plan: { payment_plan: null, payment_plan_reason: "no developer sheet or offer for this project is on file", fees: [], fees_unknown: "x" }, amenities: null, amenities_reason: "none held",
  unit_register: { source: "Dubai Land Department unit register, project id 5 (units to 2026-09-18)", single: { name: "Gamma", project_number: null, units: 30, studio: 20, b1: 10, b2: 0, b3: 0, b4plus: 0, other: 0 }, left_for_sale: "not known: the register does not record which homes are still for sale" } };
const LEGACY_CHELSEA = clone(REG); LEGACY_CHELSEA.project = { ...LEGACY_CHELSEA.project, id: "chelsea-residences-by-damac", name: "Chelsea Residences", brand_name: "Chelsea Residences by DAMAC", project_number: 3719, register_area: "Madinat Dubai Almelaheyah", area: "Dubai Maritime City" };
const D1 = districtSlug("Test District One"), D2 = districtSlug("Test District Two");
const INDEX = { as_of: { sales: "2026-09-17" }, count: 3, projects: [
  { id: REG.project.id, name: REG.project.name, brand_name: REG.project.brand_name, district: D1, project_number: 1001 },
  { id: ZERO.project.id, name: ZERO.project.name, brand_name: ZERO.project.brand_name, district: D2, project_number: 1002 },
  { id: OFFREG.project.id, name: OFFREG.project.name, brand_name: OFFREG.project.brand_name, district: D2, project_number: null }] };
const mkStore = (o) => { const m = new Map(); for (const [k, v] of Object.entries(o)) m.set("img_" + k, JSON.stringify(v)); return m; };
const envOf = (m) => ({ MEETINGS: { async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { throw new Error("nothing may write KV: " + k); } }, READ_KEY: "RK" });
const SHARDS = { [shardKey(D1)]: { projects: { [REG.project.id]: REG } }, [shardKey(D2)]: { projects: { [ZERO.project.id]: ZERO, [OFFREG.project.id]: OFFREG } } };

// ------------------------------------------------------------------------------------------------ the keys
ok(shardKey("Madinat Dubai Almelaheyah") === "investor_tiers_facts_madinatdubaialmelaheyah" && shardKey(D1) === "investor_tiers_facts_testdistrictone", "shard key = prefix + the district slug (lower case, letters and digits)", shardKey(D1));
ok(INDEX_KEY === "investor_tiers_index" && LEGACY_KEY === "investor_tiers_facts", "index key and the v376 single key names");
{
  const py = spawnSync("python", ["-c", "import re,sys;f=lambda s:re.sub(r'[^a-z0-9]+','',str(s or '').lower()) or 'unknown';print(f('Madinat Dubai Almelaheyah'),f('Al Barsha South Fourth'),f(\"Me'Aisem First\"))"], { encoding: "utf8" });
  ok(py.status !== 0 || py.stdout.trim() === [districtSlug("Madinat Dubai Almelaheyah"), districtSlug("Al Barsha South Fourth"), districtSlug("Me'Aisem First")].join(" "), "the builder's district slug (python) and the Worker's (js) agree", py.stdout + py.stderr);
}

// ------------------------------------------------------------------------------------------------ the schema
ok(validateFacts(REG).length === 0 && validateFacts(ZERO).length === 0 && validateFacts(OFFREG).length === 0, "the three fixture records pass the validator", [REG, ZERO, OFFREG].map((f) => validateFacts(f).join("|")).join(" // "));
const must = (name, f, rx) => { const e = validateFacts(f); ok(e.length > 0 && (!rx || rx.test(e.join(" | "))), "rejected: " + name, e.join(" | ")); };
{ const f = clone(REG); delete f.developer.evidence; must("developer without its evidence label", f, /evidence/); }
{ const f = clone(REG); delete f.developer.basis; must("developer without a basis", f, /basis/); }
{ const f = clone(REG); f.price_plan.payment_plan.milestones[1].pct = 55; must("an invented plan amount", f, /not a figure in the developer's own words/); }
{ const f = clone(REG); f.price_plan.payment_plan.source.quote = "payment plan 60/40"; must("a printed code turned into milestones", f, /milestone/); }
{ const f = clone(REG); f.amenities = ["Pool", "returns are guaranteed"]; must("banned wording", f, /forecast wording|guaranteed/); }
{ const f = clone(REG); f.price_plan.payment_plan = null; f.price_plan.payment_plan_reason = "TBD"; must("a placeholder for unknown", f, /placeholder/); }
{ const f = clone(ZERO); f.sales.median_price = 5; must("zero sales that carry a price", f, /zero sales/); }
{ const f = clone(OFFREG); f.project.project_number = 99; must("an off-register project with a register project number", f, /off-register/); }
{ const f = clone(REG); f.resales.separable = true; must("a claim that a resale can be told from a first sale", f, /separable/); }

// ------------------------------------------------------------------------------------------------ the loader: index -> district shard; fall-back to the single key
const kvOf = (m) => async (name) => { const v = m.get("img_" + name); return v == null ? null : JSON.parse(v); };
{
  const m = mkStore({ [INDEX_KEY]: INDEX, ...SHARDS });
  ok((await loadFactsSharded(kvOf(m), "alpha-tower-1001")).project.project_number === 1001, "loader: the index names the district and the shard holds the record");
  ok((await loadFactsSharded(kvOf(m), "beta-court-1002")).project.project_number === 1002 && (await loadFactsSharded(kvOf(m), "gamma-offregister")).project.off_register === true, "loader: two records in the same shard, off-register included");
  ok((await loadFactsSharded(kvOf(m), "no-such-project")) === null, "loader: an unknown project is null (the page answers 404)");
  const reads = []; const kv2 = async (n) => { reads.push(n); return kvOf(m)(n); };
  await loadFactsSharded(kv2, "alpha-tower-1001");
  ok(reads.length === 2 && reads[0] === INDEX_KEY && reads[1] === shardKey(D1), "loader: reads the index and ONE shard, nothing else", reads.join(","));
  const m2 = mkStore({ [INDEX_KEY]: INDEX, [LEGACY_KEY]: { projects: { "chelsea-residences-by-damac": LEGACY_CHELSEA } } });
  ok((await loadFactsSharded(kvOf(m2), "chelsea-residences-by-damac")).project.project_number === 3719, "fall-back: Chelsea is found in the v376 single key when the index does not know it");
  const m3 = mkStore({ [LEGACY_KEY]: { projects: { "chelsea-residences-by-damac": LEGACY_CHELSEA } } });
  ok((await loadFactsSharded(kvOf(m3), "chelsea-residences-by-damac")).project.project_number === 3719, "fall-back: no index at all (today's live state): the single key still serves Chelsea");
  const m4 = mkStore({ [INDEX_KEY]: INDEX, [LEGACY_KEY]: { projects: { "alpha-tower-1001": LEGACY_CHELSEA } } });
  ok((await loadFactsSharded(kvOf(m4), "alpha-tower-1001")).project.project_number === 3719, "fall-back: an index entry whose shard is missing falls back to the single key rather than failing");
  const m5 = mkStore({ [INDEX_KEY]: INDEX, ...SHARDS, [LEGACY_KEY]: { projects: { "alpha-tower-1001": LEGACY_CHELSEA } } });
  ok((await loadFactsSharded(kvOf(m5), "alpha-tower-1001")).project.project_number === 1001, "the shard wins over the single key when both hold the project");
  ok((await loadFacts(envOf(m), "beta-court-1002")).project.id === "beta-court-1002", "loadFacts(env, project) (the page's loader) goes through the same path");
}

// ------------------------------------------------------------------------------------------------ the page route reads the sharded store: HTML for a record in a shard, 404 for an unknown, Chelsea from the single key
{
  const m = mkStore({ [INDEX_KEY]: INDEX, ...SHARDS, [LEGACY_KEY]: { projects: { "chelsea-residences-by-damac": LEGACY_CHELSEA } } }), env = envOf(m);
  const inv = (id, tier) => ({ kind: "investor_tiers", key: "k", inv: { project: id, tier, type: "", segs: null, flags: [], lang: "en" } });
  const r1 = await buildInvestorTiersPdf(env, inv("alpha-tower-1001", "full"));
  ok(r1.status === 200 && /Alpha Tower/.test(r1.html) && r1.audit.project_number === 1001, "a project in a shard gives its report", r1.status);
  const r2 = await buildInvestorTiersPdf(env, inv("gamma-offregister", "standard"));
  ok(r2.status === 200 && /not on the project register yet/.test(r2.html), "the off-register project gives its report with the unknown stated");
  ok((await buildInvestorTiersPdf(env, inv("nobody", "full"))).status === 404, "an unknown project is 404");
  ok((await buildInvestorTiersPdf(env, inv("chelsea-residences-by-damac", "full"))).status === 200, "Chelsea (single key only) still gives its report");
  const sel = await buildInvestorTiersPdf(env, { kind: "investor_selector", key: "k", inv: { project: "beta-court-1002" } });
  ok(sel.status === 200 && sel.htmlOnly, "the selector page opens for a project in a shard");
}

// ------------------------------------------------------------------------------------------------ the compact index route (what=inv)
const deps = { clientOk: () => true, keyTier: () => "owner", najNav: () => "", NAJ_NAV_CSS: "", NAJ_FONTS: "", clientResp: (e, u, b, o) => new Response(b, o) };
const callInv = async (m) => { const u = "https://x/developers_map_api?key=RK&what=inv"; const r = await devmapRoutes(new Request(u), envOf(m), new URL(u), deps); return { j: await r.json(), r }; };
{
  let { j } = await callInv(new Map());
  ok(Array.isArray(j.projects) && j.projects.length === 0 && (j.rows || []).length === 0, "route: nothing published gives an empty list");
  ({ j } = await callInv(mkStore({ [INDEX_KEY]: INDEX })));
  ok(j.cols.join() === "id,name,brand,pn" && j.rows.length === 3 && Array.isArray(j.rows[0]) && j.rows[0][0] === "alpha-tower-1001" && j.rows[0][3] === 1001 && j.rows[2][3] === 0, "route: the index as compact arrays [id, name, brand, project number] (0 = none)", JSON.stringify(j).slice(0, 300));
  ok(j.rows[1][2] === "" && j.rows[0][2] === "Alpha Tower by Acme", "route: the brand is empty when it is the name, so the answer stays small");
  ok(!/investor_tiers_facts_|"sales"|"developer"|payment_plan/.test(JSON.stringify(j)), "route: no facts body and no shard is returned, only names and numbers");
  const big = { ...INDEX, projects: Array.from({ length: 3040 }, (_, i) => ({ id: "project-name-number-" + i + "-" + (1000 + i), name: "Project Name Number " + i, brand_name: "Project Name Number " + i + " by Some Brand", district: "d" + (i % 70), project_number: 1000 + i })) };
  const { j: jb } = await callInv(mkStore({ [INDEX_KEY]: big }));
  const bytes = JSON.stringify(jb).length;
  ok(jb.rows.length === 3040 && bytes < 330000, "route: 3,040 projects answer in " + Math.round(bytes / 1024) + " KB (compact arrays, no keys)", bytes);
  ({ j } = await callInv(mkStore({ [LEGACY_KEY]: { projects: { "chelsea-residences-by-damac": { project: { id: "chelsea-residences-by-damac", name: "Chelsea Residences", brand_name: "Chelsea Residences by DAMAC", project_number: 3719 }, big: "x".repeat(5000) } } } })));
  ok(j.rows.length === 0 && j.projects.length === 1 && j.projects[0].id === "chelsea-residences-by-damac" && j.projects[0].brand === "Chelsea Residences by DAMAC" && !JSON.stringify(j).includes("xxxx"), "route: today's live state (single key only) answers as v378 did");
  ({ j } = await callInv(mkStore({ [INDEX_KEY]: { ...INDEX, projects: [...INDEX.projects, { id: "chelsea-residences-by-damac", name: "Chelsea Residences", brand_name: "Chelsea Residences by DAMAC", district: "x", project_number: 3719 }] }, [LEGACY_KEY]: { projects: { "chelsea-residences-by-damac": LEGACY_CHELSEA } } })));
  ok(j.rows.filter((r) => r[0] === "chelsea-residences-by-damac").length === 1 && j.projects.length === 0, "route: a project in both the index and the single key is offered once");
  ok(compactIndex(null, null).rows.length === 0, "compactIndex copes with no index and no single key");
}

// ------------------------------------------------------------------------------------------------ the matching rule (shared logic) and the page script that applies it
const ROWS = [["alpha-tower-1001", "Alpha Tower", "Alpha Tower by Acme", 1001], ["alpha-tower-2-2002", "Alpha Tower 2", "Alpha Tower 2 by Acme", 2002], ["twin-1-3001", "Twin", "Twin", 3001], ["twin-2-3002", "Twin", "Twin", 3002], ["solo-4001", "Solo", "Solo by Acme", 4001]];
ok(matchProject(ROWS, { name: "whatever", p: 2002 })[0] === "alpha-tower-2-2002", "match: by register project number");
ok(matchProject(ROWS, { name: "Alpha Tower", p: 4001 })[0] === "solo-4001", "match: the project number decides even when the name says another project");
ok(matchProject(ROWS, { name: "Alpha Tower", p: 9999 }) === null, "match: a project number that is not in the index never falls back to the name");
ok(matchProject(ROWS, { name: "ALPHA TOWER by Someone", p: null })[0] === "alpha-tower-1001" && matchProject(ROWS, { name: "Solo", p: 0 })[0] === "solo-4001", "match: with no number, the exact normalised name");
ok(matchProject(ROWS, { name: "Twin", p: null }) === null, "match: a name that is two projects in the index matches none");
ok(matchProject(ROWS, { name: "Alpha Tow", p: null }) === null && matchProject(ROWS, { name: "Alpha", p: null }) === null, "match: no partial names");
ok(pkey("Chelsea Residences by DAMAC") === pkey("Chelsea Residences"), "pkey: the 'by <brand>' suffix is dropped on both sides");

const html = devmapHtml("k", deps);
const js = (html.match(/<script>([\s\S]*?)<\/script>/g) || []).map((s) => s.replace(/^<script>|<\/script>$/g, "")).sort((a, b) => b.length - a.length)[0];
const grab = (name) => { const m = new RegExp("^function " + name + "\\(.*$", "m").exec(js); return m ? m[0] : ""; };
const fnNames = ["pkey", "invFromApi", "invIndex", "invFind", "invHref"];   // v398: invCardLink and invProjRow (dead since v383) are gone; every surface uses docRow, matching stays in invFind
ok(fnNames.every((n) => grab(n)), "the page script carries the matching and button functions", fnNames.filter((n) => !grab(n)).join());
ok(html.includes("function pjCard0") && /function pjCard\(slug,name,ppsm,n,extra,nameDef,ev\)/.test(js), "project cards: pjCard wraps the unchanged card (pjCard0) and takes the evidence");
{
  const scriptsParse = (html.match(/<script>([\s\S]*?)<\/script>/g) || []).every((s) => { const body = s.replace(/^<script>|<\/script>$/g, ""); if (body.length < 2000) return true; try { new Function(body); return true; } catch (e) { console.log(String(e)); return false; } });
  ok(scriptsParse, "the page script still parses");
}
const mk = (apiJson, areas) => {
  const S = { inv: null }, IDX = { areas };
  const src = fnNames.map(grab).join("\n") + "\nS.inv=invFromApi(API);invIndex();return {S:S, invFind:invFind, invHref:invHref};";
  return new Function("S", "IDX", "API", "esc", "icoSvg", "KEY", src)(S, IDX, apiJson, (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;"), () => "<svg/>", "KEY1");
};
const API = { cols: ["id", "name", "brand", "pn"], rows: ROWS.map((r) => [r[0], r[1], r[2] === r[1] ? "" : r[2], r[3]]), projects: [] };
const AREAS = { one: { devs: { acme: {
  b: [[10, 1000, "Alpha Tower by Acme"], [10, 1000, "Alpha Tower 2"], [10, 1000, "Twin"], [10, 1000, "Solo"]],
  bx: [{ p: 1001 }, { p: 7777 }, { p: null }, { p: 4001 }],
  b12: [[5, 1000, "Alpha Tower by Acme"]], b12x: [{ p: 1001 }] } } } };
{
  const g = mk(API, AREAS), d = AREAS.one.devs.acme;
  const ids = d.b.map((x, i) => { const q = g.invFind(x[2], d.bx[i]); return q ? q.id : ""; }).filter(Boolean);
  ok(ids.join() === "alpha-tower-1001,solo-4001", "matching per project: by number (Alpha Tower, Solo); 'Alpha Tower 2' with number 7777 (not in the index) and 'Twin' (two projects) get none", ids.join());
  const hr = g.invHref("alpha-tower-1001");
  ok(/kind=investor_selector/.test(hr) && /key=KEY1/.test(hr), "the link opens the selector with the same page key");
}
{
  const AREAS2 = { one: { devs: { acme: { b: [[10, 1000, "Alpha Tower"], [10, 1000, "Solo"]] } } } };    // an older index: no evidence at all, names only
  const g = mk(API, AREAS2), idOf = (n, e) => { const q = g.invFind(n, e); return q ? q.id : ""; };
  ok(idOf("Alpha Tower", null) === "alpha-tower-1001" && idOf("Solo", null) === "solo-4001", "an index without the v373 evidence falls back to the exact normalised name");
  ok(idOf("Solo", { p: 4001 }).includes("solo-4001") && idOf("Solo", { p: 1001 }).includes("alpha-tower-1001") && idOf("Twin", null) === "" && idOf("Solo", { p: 12345 }) === "" && idOf("", null) === "", "project card: the match follows the project number first, then the unique name, otherwise nothing");
  const empty = mk({ cols: [], rows: [], projects: [] }, AREAS2);
  ok(empty.S.inv === null && empty.invFind("Solo", null) === null, "nothing published: no match anywhere");
  const legacy = mk({ rows: [], projects: [{ id: "chelsea-residences-by-damac", name: "Chelsea Residences", brand: "Chelsea Residences by DAMAC" }] }, { one: { devs: { damac: { b: [[10, 1000, "Chelsea Residences by DAMAC"]] } } } });
  ok((legacy.invFind("Chelsea Residences by DAMAC", null) || {}).id === "chelsea-residences-by-damac", "v378 behaviour kept: Chelsea from the single key still matches by name");
}

// ------------------------------------------------------------------------------------------------ every tier and preset builds from the fixtures; the text guard and the locked core hold
{
  let n = 0, bad = [];
  const segAll = SEGMENTS.map((s) => s.id);
  for (const f of [REG, ZERO, OFFREG, LEGACY_CHELSEA]) {
    for (const j of [...["summary", "standard", "full"].map((t) => ({ tier: t, type: null, segments: segAll })), ...PRESETS.map((p) => ({ tier: p.tier, type: p.id, segments: undefined }))]) {
      const plan = buildPlan({ facts: f, type: j.type, tier: j.tier, segments: j.segments }), d = buildTiersHtml(f, plan, {});
      n++; const t = d.text.replace(/\s+/g, " ");
      if (d.lint.length || !/Who is the registered developer/.test(t) || !/Sales so far/.test(t) || !/What this report cannot tell you/.test(t) || /\bundefined\b|\bNaN\b|\bnull\b/.test(t)) bad.push(f.project.id + " " + (j.type || j.tier));
    }
  }
  ok(n > 40 && bad.length === 0, n + " documents (all tiers, every preset, four records) pass the text guard and keep the locked core", bad.join(", "));
  const zt = buildTiersHtml(ZERO, buildPlan({ facts: ZERO, tier: "summary" }), {}).text.replace(/\s+/g, " ");
  ok(/Registered sales: none\. No sale of any home in this project is on the Dubai Land Department register to 17 September 2026/.test(zt), "zero registered sales are stated plainly in the core");
  ok(/prints a code \(60\/40\)/.test(zt) && !/Cash before handover|Share of the price due before handover/.test(buildTiersHtml(ZERO, buildPlan({ facts: ZERO, tier: "full", segments: segAll }), {}).text), "a printed code stays a code: it is named, and no cash figure comes from it");
  const ot = buildTiersHtml(OFFREG, buildPlan({ facts: OFFREG, tier: "summary" }), {}).text.replace(/\s+/g, " ");
  ok(/not on the register yet/.test(ot) && /developer says handover is Q4 2028/.test(ot) && /no project register record/.test(buildTiersHtml(OFFREG, buildPlan({ facts: OFFREG, tier: "summary" }), {}).text.replace(/\s+/g, " ")), "off-register: the developer, the status and the register are said to be unknown, with the developer's own handover claim labelled");
  const rt = buildTiersHtml(REG, buildPlan({ facts: REG, tier: "summary" }), {}).text.replace(/\s+/g, " ");
  ok(/Brand name: Acme \(matched to the registered company by its name/.test(rt) && /Registered developer: ACME DEVELOPMENT L\.L\.C \(confirmed by the Dubai Land Department register/.test(rt), "the brand and the registered company are two lines with two labels");
  ok(/Handover record on the register: of 3 finished projects/.test(rt) && /history, not a forecast/.test(rt), "the handover record shows with its caveat");
}

// ------------------------------------------------------------------------------------------------ the gate script runs on a folder of shards and fails on a corrupted one
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "invfacts_"));
  const write = (shards, index) => { for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f)); fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(index)); for (const [k, v] of Object.entries(shards)) fs.writeFileSync(path.join(dir, k + ".json"), JSON.stringify(v)); };
  write(SHARDS, INDEX);
  const run = () => spawnSync(process.execPath, [path.join(ROOT, "scripts", "check_investor_facts.mjs"), dir], { encoding: "utf8" });
  const good = run();
  ok(good.status === 0 && /ALL GATES PASS/.test(good.stdout) && /negative controls: \d+ of \d+ behave as required/.test(good.stdout), "check_investor_facts.mjs passes a clean folder and reports the negative controls", good.stdout.split(String.fromCharCode(10)).filter((l) => /negative|VIOL|^  - /.test(l)).join(" | ") + good.stderr.slice(0, 300));
  const badShards = clone(SHARDS); badShards[shardKey(D1)].projects["alpha-tower-1001"].price_plan.payment_plan.milestones[0].pct = 33;
  write(badShards, INDEX);
  const bad = run();
  ok(bad.status === 1 && /VIOLATIONS/.test(bad.stdout), "it fails a folder that holds an invented plan amount", bad.stdout.slice(-300));
  const badIdx = clone(INDEX); badIdx.projects[0].district = "elsewhere"; write(SHARDS, badIdx);
  ok(run().status === 1, "it fails when the index points to a shard that does not hold the record");
  fs.rmSync(dir, { recursive: true, force: true });
}

// ------------------------------------------------------------------------------------------------ the builder and the publish script exist, and the publish script has its guards
{
  const py = fs.readFileSync(path.join(ROOT, "scripts", "build_investor_facts.py"), "utf8");
  ok(/def main\(\)/.test(py) && /KV|kv/.test(py) && !/wrangler|\.put\(|kv key put/.test(py.replace(/Nothing is deployed, nothing is written to KV\./, "")), "the builder is offline: it never calls wrangler or writes KV");
  const ps = fs.readFileSync(path.join(ROOT, "scripts", "publish_investor_facts.ps1"), "utf8");
  ok(/\[switch\]\$Replace/.test(ps) && /DryRun/.test(ps) && /04:00|240/.test(ps) && /protected_keys/.test(ps) && /Rollback|rollback|roll back/.test(ps) && /Verify|read.*back/i.test(ps), "publish script: dry run by default, -Replace, backup, protected keys, the 04:00-06:15 window, read-back, rollback line");
  ok(/DryRun\s*=\s*-not\s+\$Apply|\[switch\]\$Apply/.test(ps), "publish script: nothing is put unless -Apply is given");
}

// ------------------------------------------------------------------------------------------------ no regression
for (const t of ["test_v376_investor_tiers.mjs", "test_v376_button.mjs", "test_v375_gaps.mjs", "test_v373_attribution.mjs", "test_v371_areacards.mjs"]) {
  const r = spawnSync(process.execPath, [path.join(ROOT, "test", t)], { encoding: "utf8", maxBuffer: 64e6 });
  ok(r.status === 0, "no regression: " + t, (r.stdout || "").split("\n").filter((l) => /FAIL/.test(l)).slice(0, 3).join(" | ") + (r.stderr || "").slice(0, 200));
}
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
