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
import { labelledName, communitiesOf, projectAreaLabel } from "../src/community_labels.js";   // v307; v373 projectAreaLabel: a project is labelled by its own area
import { decide, isGenericName, looseKeyOf, evidenceOf, LABEL_CODE, EVIDENCE_LABELS } from "../src/devattr.js";   // v325 - the attribution rules: the register first, a bare common word is not evidence
import { canonicalOf, displayOf, aliasesOf, isCurated } from "../src/devcross.js";   // developer CROSSWALK (4 Oct 2026): one id per developer, however the sources spell it
export const DM = new Function(DEVMAP_CORE_JS + "; return DM;")();

const bedOf = (t) => { t = String(t || "").toLowerCase(); if (t === "studio") return 0; const m = t.match(/^(\d+)\s*(?:bed|br|b\/r)/); return m ? Math.min(+m[1], 5) : null; };
const LEGAL = /\s*\(?\b(l\.?\s*l\.?\s*c|p\.?\s*j\.?\s*s\.?\s*c|fz[ce]?|llc|ltd|limited|co)\b\.?\)?/gi;   // legal-form suffixes are not part of the name shown
const titleCase = (s) => { s = s.replace(LEGAL, "").replace(/\s+/g, " ").trim(); return /[a-z]/.test(s) && /[A-Z]/.test(s) ? s : s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()); };
const nameKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// one district's unit-mix cards -> cells per developer. projDev: {nameKey(project): developer}, priceDev: {"d:i": developer}
// v373 - districtName: the app district's own name (for the project area label); claims: optional {nameKey: [canonical developer ids]} of projects a developer's own web site lists (a CLAIM, never evidence).
//   Every slot also carries `ce` (one evidence code per entry of `c`: V verified by the register, N name only, D developer claimed, U unverified) and `bx` (one evidence record per
//   entry of `b`): {p register project number, di register developer_id, dn registered developer name, m match basis, e label, a area shown, as area source, h homes}. Additive only.
export function buildArea(U, slug, projDev, priceDev, rentItems, rentDevByP, nameDev, trace, regDev, districtName, claims, dldAreas) {
  const B = (U && U.buildings_by_id) || {}, devs = {}, names = {};
  const slot = (dev) => {
    const k = dev ? canonicalOf(dev) : "_";
    const kk = k || "_";
    if (!devs[kk]) devs[kk] = { n: kk === "_" ? "Developer not recorded" : "", h: 0, c: [], r: [], b: [], ce: [], bx: [] };
    if (kk !== "_") { names[kk] = names[kk] || {}; names[kk][dev] = (names[kk][dev] || 0) + 1; }
    return devs[kk];
  };
  const devOfCard = {};
  for (const id of Object.keys(B)) {
    const c = B[id];
    // v325 - ATTRIBUTION: a candidate from the old order (card field, Ejari list by name, price list), then src/devattr.js decides with the REGISTER first
    const cand = c.developer || (c.dld && projDev[nameKey(c.dld.project)]) || projDev[nameKey(c.name)] || priceDev[slug + ":" + id] || null;
    const route = c.developer ? (c.synthetic ? "card_register:" + String(c.developer_basis || "") : "card_field") : (c.dld && projDev[nameKey(c.dld.project)]) ? "ejari_name:dld_project" : projDev[nameKey(c.name)] ? "ejari_name:card_name" : priceDev[slug + ":" + id] ? "price_index" : "none";
    const bnames = [c.dld && c.dld.project, c.name, c.dld_sales && c.dld_sales.project];
    // the register's answer for this building: every name the card carries is looked up; two names that lead to DIFFERENT register developers (a footprint named "The Portman"
    // linked to the DLD project "DANA TOWER") mean the link itself is doubtful, so the register stays silent rather than override on a guess
    let regd = null, how = "exact", areaEv = null; if (regDev) { const found = [], hows = []; for (const nm of bnames) { if (!nm) continue; const rx = regDev[nameKey(nm)] || null, r = rx || regDev[looseKeyOf(nm)] || null; if (r) { found.push(r); hows.push(rx ? "exact" : "loose"); } if (!areaEv) areaEv = regDev["@" + nameKey(nm)] || regDev["@" + looseKeyOf(nm)] || null; } if (found.length && found.every((r) => r.c === found[0].c)) { regd = found[0]; how = hows.indexOf("exact") >= 0 ? "exact" : "loose"; } }
    const D = decide({ names: bnames, cand: cand || "", candDisplay: cand ? (displayOf(canonicalOf(cand)) || cand) : "", nameOnly: !!cand && (route !== "card_field"), regd });
    const dev = D.dev || null, q = D.q;
    devOfCard[id] = dev;
    if (nameDev && dev) for (const nm of [c.name, c.dld && c.dld.project, c.dld_sales && c.dld_sales.project]) if (nm) nameDev[nameKey(nm)] = canonicalOf(dev) || "_";   // v322
    const sold = (c.dld_sales && c.dld_sales.sold_by_type) || {};
    const soldOf = (t) => { for (const k of Object.keys(sold)) if (k.toLowerCase() === String(t).toLowerCase()) return sold[k]; return 0; };
    let added = false; const mine = [];
    // v373 - the evidence behind this building's developer and the area it is shown under
    const ev = evidenceOf({ D, cand: cand || "", route, regd, how, claimed: claims ? new Set(bnames.filter(Boolean).flatMap((nm) => claims[nameKey(nm)] || [])) : null, basisText: c.developer_basis });
    const own = projectAreaLabel({ slug, districtName: districtName || slug, salesArea: areaEv && areaEv.ar, masterCommunity: (areaEv && areaEv.ms) || (regd && regd.ms), dldAreas });
    const code = LABEL_CODE[ev.e];
    for (const r of c.rows || []) {
      if (!r.median_aed || !r.median_sqm) continue;                 // an estimate (est_aed) is never a sale price
      const n = soldOf(r.type), bed = bedOf(r.type);
      if (!n || bed == null) continue;
      slot(dev).c.push([n, Math.round(r.median_aed / r.median_sqm), Math.round(r.median_aed), bed]); added = true; mine.push([n, Math.round(r.median_aed / r.median_sqm)]); slot(dev).ce.push(code);
    }
    if (added && dev) { const sq = slot(dev); (sq.q = sq.q || [0, 0])[ev.e === "REGISTER_VERIFIED" ? 0 : 1] += mine.reduce((a, x) => a + x[0], 0); }   // v325 - sales by confidence: [verified by the register, inferred from a name]
    if (added && trace) trace.push({ slug, id, name: String(c.name || ""), project: String((c.dld_sales && c.dld_sales.project) || (c.dld && c.dld.project) || ""), dev: dev || null, q, why: D.why, cand: cand || null, route, evidence: ev.e, basis: ev.m, area: own.label, area_source: own.source, n: mine.reduce((a, x) => a + x[0], 0), aed: (c.rows || []).reduce((a, r) => a + ((r.median_aed && r.median_sqm && soldOf(r.type) && bedOf(r.type) != null) ? soldOf(r.type) * r.median_aed : 0), 0) });
    if (added) slot(dev).b.push([mine.reduce((a, x) => a + x[0], 0), Math.round(DM.wmedian(mine.map((x) => [x[1], x[0]]))), String(c.name || (c.dld && c.dld.project) || "")]);   // v321 - one project (building) = its sales and its median price per sq m
    if (added) slot(dev).bx.push({ p: ev.p, di: ev.di, dn: ev.dn, m: ev.m, e: ev.e, a: own.label, as: own.source, h: Number(c.registered_homes || (c.dld && c.dld.units_registered) || c.total_units || 0) });   // v373 - parallel to b
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
      if (!d) { d = A.devs[dk] = { n: dk === "_" ? "Developer not recorded" : (displayOf(dk) || known[dk] || (E.names && E.names[dk] ? titleCase(E.names[dk]) : "") || titleCase(dk.replace(/-/g, " "))), h: 0, c: [], r: [] }; }
      if (E.devs[dk].ev) d.ev = E.devs[dk].ev;
      d.c12 = E.devs[dk].c12;
      if (E.devs[dk].q12) d.q12 = E.devs[dk].q12;   // v325 - last-12-month sales [verified by the register, inferred from a name]
      if (E.devs[dk].b12) d.b12 = E.devs[dk].b12;   // v323 - projects with 3 or more sales in the last 12 months, so a profile can follow the window
      // v373 - evidence for the window: b12x is parallel to b12 (the evidence builder gives p, di, dn, m, e and the project's raw sales area `ar` / master `ms`; the area LABEL is made here, by the one rule in community_labels.js); c12e is parallel to c12
      if (E.devs[dk].b12x) d.b12x = E.devs[dk].b12x.map((x) => { const o = projectAreaLabel({ slug: s, districtName: A.name, salesArea: x.ar, masterCommunity: x.ms, dldAreas: E.dld }); return { p: x.p == null ? null : x.p, di: x.di == null ? null : x.di, dn: x.dn || "", m: x.m || "none", e: x.e || "UNVERIFIED", a: o.label, as: o.source }; });
      if (E.devs[dk].c12e) d.c12e = E.devs[dk].c12e;
    }
  }
}
export function buildIndex({ umDir, prices, rent, geo, projectsCsv, ejariProjects, outAsOf, shares, offplanDir, offplanSlugs, register, evidence, projdevOut, traceOut, regdev, claims }) {
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
    if ((!U || !U.buildings_by_id) && evidence && evidence.areas && evidence.areas[g.slug]) U = { buildings_by_id: {} };   // v322: a district with register sales but no card file still gets its evidence
    if (!U || !U.buildings_by_id) continue;
    const nameDev = {};
    const devs = buildArea(U, g.slug, projDev, priceDev, (rent.items || []).filter((i) => i.d === g.slug), rentDevByP, nameDev, traceOut, regdev && regdev[g.slug], g.name, claims, register && register[g.slug] && register[g.slug].areas);
    if (projdevOut) projdevOut.slugs[g.slug] = nameDev;
    if (!Object.keys(devs).length && !(evidence && evidence.areas && evidence.areas[g.slug])) continue;
    areas[g.slug] = { name: g.name, corridor: g.corridor, bbox: g.bbox, centre: g.centre, devs };
    if (op && op.added) areas[g.slug].offplan = { projects: op.added, sales: op.sales, share_pct: op.offplan_share, note: "Includes off-plan sales built from the Land Department register by project (" + op.added + " projects, " + op.sales + " sales). Off-plan prices are contract values agreed with the developer, not resale prices. Where the developer is not recorded the register names only the land owner." };
    if (op && op.added && !(op.offplan_share > 0)) areas[g.slug].offplan.note = "Includes sales built from the Land Department register by project (" + op.added + " projects, " + op.sales + " sales) that the building records did not hold. Where the developer is not recorded it is shown as not recorded.";
    if (register && register[g.slug]) { const r = register[g.slug]; if (r.sales_all_time != null && !r.shared) { areas[g.slug].register_sales_all_time = r.sales_all_time; areas[g.slug].register_sales_12m = r.sales_12m; } }
    if (communitiesOf(g.slug).length && labelledName(g.slug, g.name) !== g.name) { areas[g.slug].label = labelledName(g.slug, g.name); areas[g.slug].community = communitiesOf(g.slug); }   // v307 - community label next to the DLD name; v373 - only a district that IS one community, never a combined or borrowed label
    for (const k of Object.keys(devs)) all.push(...devs[k].c);
  }
  if (projdevOut) for (const k of Object.keys(projDev)) { const c = canonicalOf(projDev[k]); if (c && !isGenericName(k)) projdevOut.global[k] = c; }   // v325: a bare common-word name ("symphony", "park central") never carries a developer Dubai-wide
  if (evidence && evidence.areas) attachEvidence(areas, evidence);
  const bounds = (DM.TIER_CFG.bounds && DM.TIER_CFG.bounds.slice()) || DM.percentileBounds(all, DM.TIER_CFG.percentiles);
  const devList = {};
  for (const s of Object.keys(areas)) for (const k of Object.keys(areas[s].devs)) {
    if (k === "_") continue;
    const d = areas[s].devs[k];
    if (!d.c.length && !(d.c12 || []).length && !(d.r || []).length) { delete areas[s].devs[k]; continue; }   // v322: a slot with nothing to show; v327: and it is not left in the area either (a named developer with no sales and no rental contracts)
    const e = devList[k] || (devList[k] = { name: d.n, areas: 0, n: 0, profile: { projects: 0, homes: 0 } });
    e.areas++; e.profile.projects += (d.b || []).length; e.profile.homes += d.h || 0; e.n += DM.wmedian ? (d.c.length ? d.c : (d.c12 || [])).reduce((a, c) => a + c[0], 0) : 0;   // v321: project count and homes; v322: sales total, falling back to the last 12 months slot
  }
  // alias: DM.devKey(any spelling the page may be given) -> canonical id, for curated developers only (the page cannot import devcross.js)
  const alias = {};
  for (const k of Object.keys(devList)) if (isCurated(k)) for (const nm of [displayOf(k)].concat(aliasesOf(k))) { const dk = DM.devKey(nm); if (dk && dk !== k && !alias[dk]) alias[dk] = k; }
  // v373 - a count of the evidence labels over every project under a named developer, written into the index so the page and the quality gate can say what share is confirmed
  const lc = { REGISTER_VERIFIED: 0, NAME_ONLY: 0, DEVELOPER_CLAIMED: 0, UNVERIFIED: 0 };
  for (const s of Object.keys(areas)) for (const k of Object.keys(areas[s].devs)) { if (k === "_") continue; for (const x of areas[s].devs[k].bx || []) lc[x.e] = (lc[x.e] || 0) + 1; }
  return {
    as_of: outAsOf || null, generated: new Date().toISOString().slice(0, 10),
    source: "Dubai Land Department sales register (settled sales, unit-mix cards) and Ejari tenancy contracts; developers from the register and the developers' own sheets",
    cuts: { bounds, percentiles: DM.TIER_CFG.percentiles, shares: shares || null, typical_sqft: DM.TYPICAL_SQFT, rule: DM.TIER_CFG.bounds ? "Dubai-wide, value-weighted: each tier holds about a quarter of the money spent in the last 12 months of Land Department sales. A price band, not a judgement of any developer." : "Dubai-wide: BUDGET is the cheapest half of settled sales by price per sq m, PREMIUM the next 30%, LUXURY the next 15%, ULTRA-LUXURY the top 5%. A price band, not a judgement of any developer." },
    devs: devList, alias, areas,
    scale: DM.scaleCuts({ devs: devList }),   // v321 - the project-count cut-offs behind Boutique / Mid-size / Large-scale, written into the data
    ...(evidence && evidence.meta ? { ev: evidence.meta } : {}),   // v322
    attr: { version: 373, labels: EVIDENCE_LABELS, projects: lc,
      layout: "per developer per area: bx[i] = evidence of b[i] {p register project number, di register developer_id, dn registered developer name, m match basis (project_id | exact_name | partial_name | website_only | none), e label (REGISTER_VERIFIED | NAME_ONLY | DEVELOPER_CLAIMED | UNVERIFIED), a area shown, as area source (sales_area | register_master | district), h homes}; ce[i] = label code of c[i] (V N D U); the evidence builder adds the same for the 12-month lists",
      rule: "The Land Department register is the authority. A developer's own web site is a claim. Totals, scale, price bands and 'where it sells' count REGISTER_VERIFIED projects only." },   // v373
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const a = {}; for (let i = 2; i < process.argv.length; i += 2) a[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
  const rd = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
  const prices = rd(a.prices);
  const projdevOut = a["projdev-out"] ? { slugs: {}, global: {} } : null;
  const idx = buildIndex({ umDir: a.um, prices, rent: rd(a.rent), geo: rd(a.geo), ejariProjects: a.ejari ? rd(a.ejari) : null, projectsCsv: a.projects ? fs.readFileSync(a.projects, "utf8") : null, outAsOf: String(prices.generated || "").slice(0, 10), shares: a.shares ? rd(a.shares) : null, offplanDir: a.offplan || null, offplanSlugs: String(a["offplan-slugs"] || "").split(",").filter(Boolean), register: a.register ? rd(a.register) : null, evidence: a.evidence ? rd(a.evidence) : null, regdev: a.regdev ? rd(a.regdev) : null, claims: a.claims ? rd(a.claims) : null, projdevOut });
  if (projdevOut) fs.writeFileSync(a["projdev-out"], JSON.stringify(projdevOut));
  fs.writeFileSync(a.out, JSON.stringify(idx));
  console.log("areas", Object.keys(idx.areas).length, "developers", Object.keys(idx.devs).length, "bounds", idx.cuts.bounds, "bytes", fs.statSync(a.out).size);
}
