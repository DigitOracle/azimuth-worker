// Builds the Developers Map index (KV img_devmap_index) from files the app already publishes. READ-ONLY on KV; writes ONE local file.
//   node scripts/build_devmap_index.mjs --um <dir> --prices <img_map_prices json> --rent <img_rent_index json> --geo <img_districts_geo json>
//        [--register <area_register.json from scripts/build_area_register_counts.py>] [--offplan <dir of unitmix_<slug>.synthetic.json from scripts/build_coverage_cards.py> --offplan-slugs palmdeira] [--ejari <img_ejari_projects_index json>] [--projects <DLD projects csv>] [--shares <dld_tier_shares.py json>] --out <devmap_index.json>
// <dir> holds one file per district named um_<slug>.raw (or img_unitmix_<slug>), each the KV value of img_unitmix_<slug> (plain JSON).
// To fetch them (read only), from C:\Dev\azimuth-worker-dewa:
//   npx wrangler kv key get img_unitmix_<slug> --text --env azimuth2 --namespace-id 2cdf36a27f834b5f9c726294d36770fb > <dir>/um_<slug>.raw
// v322 - EVIDENCE (optional, backward compatible): --projdev-out <file> also writes the project-to-developer map the evidence builder needs;
//   --evidence <file from scripts/build_area_evidence.py> adds, per area and per developer, `ev` (price per sq m by year, last 12 months, ready / off-plan, apartments / villas, size)
//   and `c12` (last-12-month cells: the page's window toggle swaps `c` for `c12`). An index built without --evidence is byte-for-byte the old format.
// Then publish (Kendall only):
//   npx wrangler kv key put img_devmap_index --path devmap_index.json --env azimuth2 --namespace-id 2cdf36a27f834b5f9c726294d36770fb --remote
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEVMAP_CORE_JS } from "../src/devmap_core.js";
import { labelledName, communitiesOf } from "../src/community_labels.js";   // v307
import { canonicalOf, displayOf, aliasesOf, isCurated } from "../src/devcross.js";   // developer CROSSWALK (4 Oct 2026): one id per developer, however the sources spell it
export const DM = new Function(DEVMAP_CORE_JS + "; return DM;")();

const bedOf = (t) => { t = String(t || "").toLowerCase(); if (t === "studio") return 0; const m = t.match(/^(\d+)\s*(?:bed|br|b\/r)/); return m ? Math.min(+m[1], 5) : null; };
const LEGAL = /\s*\(?\b(l\.?\s*l\.?\s*c|p\.?\s*j\.?\s*s\.?\s*c|fz[ce]?|llc|ltd|limited|co)\b\.?\)?/gi;   // legal-form suffixes are not part of the name shown
const titleCase = (s) => { s = s.replace(LEGAL, "").replace(/\s+/g, " ").trim(); return /[a-z]/.test(s) && /[A-Z]/.test(s) ? s : s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()); };
const nameKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// one district's unit-mix cards -> cells per developer. projDev: {nameKey(project): developer}, priceDev: {"d:i": developer}
export function buildArea(U, slug, projDev, priceDev, rentItems, rentDevByP, nameDev) {
  const B = (U && U.buildings_by_id) || {}, devs = {}, names = {};
  const slot = (dev) => {
    const k = dev ? canonicalOf(dev) : "_";
    const kk = k || "_";
    if (!devs[kk]) devs[kk] = { n: kk === "_" ? "Developer not recorded" : "", h: 0, c: [], r: [] };
    if (kk !== "_") { names[kk] = names[kk] || {}; names[kk][dev] = (names[kk][dev] || 0) + 1; }
    return devs[kk];
  };
  const devOfCard = {};
  for (const id of Object.keys(B)) {
    const c = B[id];
    const dev = c.developer || (c.dld && projDev[nameKey(c.dld.project)]) || projDev[nameKey(c.name)] || priceDev[slug + ":" + id] || null;
    devOfCard[id] = dev;
    if (nameDev && dev) for (const nm of [c.name, c.dld && c.dld.project, c.dld_sales && c.dld_sales.project]) if (nm) nameDev[nameKey(nm)] = canonicalOf(dev) || "_";   // v322
    const sold = (c.dld_sales && c.dld_sales.sold_by_type) || {};
    const soldOf = (t) => { for (const k of Object.keys(sold)) if (k.toLowerCase() === String(t).toLowerCase()) return sold[k]; return 0; };
    let added = false;
    for (const r of c.rows || []) {
      if (!r.median_aed || !r.median_sqm) continue;                 // an estimate (est_aed) is never a sale price
      const n = soldOf(r.type), bed = bedOf(r.type);
      if (!n || bed == null) continue;
      slot(dev).c.push([n, Math.round(r.median_aed / r.median_sqm), Math.round(r.median_aed), bed]); added = true;
    }
    if (added && dev) slot(dev).h += Number(c.registered_homes || (c.dld && c.dld.units_registered) || c.total_units || 0);
  }
  for (const it of rentItems || []) {                                // Ejari contracts, community-level labelled on the page
    const dev = (it.i != null && devOfCard[it.i]) || rentDevByP[it.p] || null;
    for (const set of [it.b, it.v]) for (const bk of Object.keys(set || {})) {
      const s = set[bk]; if (!s || !s.n || !s.m || !s.s) continue;
      const bed = bk === "3+" ? 3 : Number(bk); if (!isFinite(bed)) continue;
      slot(dev).r.push([s.n, Math.round(s.m / s.s), Math.round(s.m), bed]);
    }
  }
  for (const k of Object.keys(devs)) if (k !== "_") { const o = names[k] || {}; const best = Object.keys(o).sort((a, b) => o[b] - o[a])[0]; devs[k].n = displayOf(k) || titleCase(best || k); }
  for (const k of Object.keys(devs)) if (!devs[k].c.length && !devs[k].r.length) delete devs[k];
  return devs;
}

// v314 - register-built (off-plan) cards for areas whose unit-mix cards hold almost none of the register's sales (Palm Deira: 17 of 9,145). They are ADDED to the
// district's cards under ids 900000+; a project already on a priced card is skipped (nothing counted twice). Off-plan prices are contract values, and the area says so.
const projKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function addOffplan(U, file) {
  const syn = JSON.parse(fs.readFileSync(file, "utf8")).buildings_by_id || {}, B = U.buildings_by_id = U.buildings_by_id || {};
  const have = new Set(); for (const c of Object.values(B)) if ((c.rows || []).some((r) => r.median_aed)) for (const n of [c.name, c.dld && c.dld.project, c.dld_sales && c.dld_sales.project]) if (n) have.add(projKey(n));
  let added = 0, offSales = 0, all = 0;
  for (const [id, c] of Object.entries(syn)) {
    const k = projKey(c.name); if (!k || have.has(k) || B[id]) continue;
    B[id] = c; added++; const n = (c.dld_sales && c.dld_sales.sold_total) || 0; all += n; offSales += n * (c.offplan_share || 0);
  }
  return { added, sales: all, offplan_share: all ? Math.round(100 * offSales / all) : 0 };
}
// v322 - the evidence file (scripts/build_area_evidence.py) onto the built areas. A developer that has sales in the last 12 months but no building card in the area gets a slot with
// c: [] (the page drops a slot with nothing in the window it shows). Names for those slots come from the crosswalk, else from any other area that already holds the developer.
function attachEvidence(areas, evidence) {
  const known = {};
  for (const s of Object.keys(areas)) for (const k of Object.keys(areas[s].devs)) if (areas[s].devs[k].n && !known[k]) known[k] = areas[s].devs[k].n;
  for (const s of Object.keys(areas)) {
    const E = evidence.areas[s]; if (!E) continue;
    const A = areas[s]; A.ev = { ...E.ev, dld: E.dld, shared: !!E.shared };
    for (const dk of Object.keys(E.devs)) {
      let d = A.devs[dk];
      if (!d) { d = A.devs[dk] = { n: dk === "_" ? "Developer not recorded" : (displayOf(dk) || known[dk] || titleCase(dk.replace(/-/g, " "))), h: 0, c: [], r: [] }; }
      if (E.devs[dk].ev) d.ev = E.devs[dk].ev;
      d.c12 = E.devs[dk].c12;
    }
  }
}
export function buildIndex({ umDir, prices, rent, geo, projectsCsv, ejariProjects, outAsOf, shares, offplanDir, offplanSlugs, register, evidence, projdevOut }) {
  const projDev = {};
  // the Ejari projects index: every project Dubai-wide with its developer (KV img_ejari_projects_index)
  if (ejariProjects && ejariProjects.index) for (const k of Object.keys(ejariProjects.index)) { const p = ejariProjects.index[k]; if (p.name_en && p.developer) projDev[nameKey(p.name_en)] = p.developer; }
  if (projectsCsv) {
    const lines = projectsCsv.replace(/^\uFEFF/, "").split(/\r?\n/), head = lines[0].split(",");
    const ip = head.indexOf("PROJECT_EN"), idv = head.indexOf("DEVELOPER_EN");
    for (const ln of lines.slice(1)) { const f = ln.split(","); if (f[ip] && f[idv]) projDev[nameKey(f[ip])] = f[idv].trim(); }
  }
  const priceDev = {}, rentDevByP = {};
  for (const it of (prices.items || [])) if (it.dev) { priceDev[it.d + ":" + it.i] = it.dev; rentDevByP[it.p] = it.dev; }
  const areas = {}, all = [];
  for (const g of geo.districts) {
    const f = [path.join(umDir, "um_" + g.slug + ".raw"), path.join(umDir, "img_unitmix_" + g.slug)].find((p) => fs.existsSync(p));
    let U = null; if (f) { try { U = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { U = null; } }
    let op = null;
    const opf = offplanDir && (offplanSlugs || []).includes(g.slug) ? path.join(offplanDir, "unitmix_" + g.slug + ".synthetic.json") : null;
    if (opf && fs.existsSync(opf)) { U = U || { buildings_by_id: {} }; op = addOffplan(U, opf); }
    if (!U || !U.buildings_by_id) continue;
    const nameDev = {};
    const devs = buildArea(U, g.slug, projDev, priceDev, (rent.items || []).filter((i) => i.d === g.slug), rentDevByP, nameDev);
    if (projdevOut) projdevOut.slugs[g.slug] = nameDev;
    if (!Object.keys(devs).length && !(evidence && evidence.areas && evidence.areas[g.slug])) continue;
    areas[g.slug] = { name: g.name, corridor: g.corridor, bbox: g.bbox, centre: g.centre, devs };
    if (op && op.added) areas[g.slug].offplan = { projects: op.added, sales: op.sales, share_pct: op.offplan_share, note: "Includes off-plan sales built from the Land Department register by project (" + op.added + " projects, " + op.sales + " sales). Off-plan prices are contract values agreed with the developer, not resale prices. Where the developer is not recorded the register names only the land owner." };
    if (op && op.added && !(op.offplan_share > 0)) areas[g.slug].offplan.note = "Includes sales built from the Land Department register by project (" + op.added + " projects, " + op.sales + " sales) that the building records did not hold. Where the developer is not recorded it is shown as not recorded.";
    if (register && register[g.slug]) { const r = register[g.slug]; if (r.sales_all_time != null && !r.shared) { areas[g.slug].register_sales_all_time = r.sales_all_time; areas[g.slug].register_sales_12m = r.sales_12m; } }
    if (communitiesOf(g.slug).length) { areas[g.slug].label = labelledName(g.slug, g.name); areas[g.slug].community = communitiesOf(g.slug); }   // v307 - community label next to the DLD name
    for (const k of Object.keys(devs)) all.push(...devs[k].c);
  }
  if (projdevOut) for (const k of Object.keys(projDev)) { const c = canonicalOf(projDev[k]); if (c) projdevOut.global[k] = c; }
  if (evidence && evidence.areas) attachEvidence(areas, evidence);
  const bounds = (DM.TIER_CFG.bounds && DM.TIER_CFG.bounds.slice()) || DM.percentileBounds(all, DM.TIER_CFG.percentiles);
  const devList = {};
  for (const s of Object.keys(areas)) for (const k of Object.keys(areas[s].devs)) {
    if (k === "_") continue;
    const d = areas[s].devs[k];
    if (!d.c.length && !(d.c12 || []).length && !(d.r || []).length) continue;   // v322: a slot with nothing to show
    const e = devList[k] || (devList[k] = { name: d.n, areas: 0, n: 0 });
    e.areas++; e.n += DM.wmedian ? (d.c.length ? d.c : (d.c12 || [])).reduce((a, c) => a + c[0], 0) : 0;
  }
  // alias: DM.devKey(any spelling the page may be given) -> canonical id, for curated developers only (the page cannot import devcross.js)
  const alias = {};
  for (const k of Object.keys(devList)) if (isCurated(k)) for (const nm of [displayOf(k)].concat(aliasesOf(k))) { const dk = DM.devKey(nm); if (dk && dk !== k && !alias[dk]) alias[dk] = k; }
  return {
    as_of: outAsOf || null, generated: new Date().toISOString().slice(0, 10),
    source: "Dubai Land Department sales register (settled sales, unit-mix cards) and Ejari tenancy contracts; developers from the register and the developers' own sheets",
    cuts: { bounds, percentiles: DM.TIER_CFG.percentiles, shares: shares || null, typical_sqft: DM.TYPICAL_SQFT, rule: DM.TIER_CFG.bounds ? "Dubai-wide, value-weighted: each tier holds about a quarter of the money spent in the last 12 months of Land Department sales. A price band, not a judgement of any developer." : "Dubai-wide: BUDGET is the cheapest half of settled sales by price per sq m, PREMIUM the next 30%, LUXURY the next 15%, ULTRA-LUXURY the top 5%. A price band, not a judgement of any developer." },
    devs: devList, alias, areas,
    ...(evidence && evidence.meta ? { ev: evidence.meta } : {}),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const a = {}; for (let i = 2; i < process.argv.length; i += 2) a[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
  const rd = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
  const prices = rd(a.prices);
  const projdevOut = a["projdev-out"] ? { slugs: {}, global: {} } : null;
  const idx = buildIndex({ umDir: a.um, prices, rent: rd(a.rent), geo: rd(a.geo), ejariProjects: a.ejari ? rd(a.ejari) : null, projectsCsv: a.projects ? fs.readFileSync(a.projects, "utf8") : null, outAsOf: String(prices.generated || "").slice(0, 10), shares: a.shares ? rd(a.shares) : null, offplanDir: a.offplan || null, offplanSlugs: String(a["offplan-slugs"] || "").split(",").filter(Boolean), register: a.register ? rd(a.register) : null, evidence: a.evidence ? rd(a.evidence) : null, projdevOut });
  if (projdevOut) fs.writeFileSync(a["projdev-out"], JSON.stringify(projdevOut));
  fs.writeFileSync(a.out, JSON.stringify(idx));
  console.log("areas", Object.keys(idx.areas).length, "developers", Object.keys(idx.devs).length, "bounds", idx.cuts.bounds, "bytes", fs.statSync(a.out).size);
}
