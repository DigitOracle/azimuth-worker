// Builds the Developers Map index (KV img_devmap_index) from files the app already publishes. READ-ONLY on KV; writes ONE local file.
//   node scripts/build_devmap_index.mjs --um <dir> --prices <img_map_prices json> --rent <img_rent_index json> --geo <img_districts_geo json>
//        [--ejari <img_ejari_projects_index json>] [--projects <DLD projects csv>] --out <devmap_index.json>
// <dir> holds one file per district named um_<slug>.raw (or img_unitmix_<slug>), each the KV value of img_unitmix_<slug> (plain JSON).
// To fetch them (read only), from C:\Dev\azimuth-worker-dewa:
//   npx wrangler kv key get img_unitmix_<slug> --text --env azimuth2 --namespace-id 2cdf36a27f834b5f9c726294d36770fb > <dir>/um_<slug>.raw
// Then publish (Kendall only):
//   npx wrangler kv key put img_devmap_index --path devmap_index.json --env azimuth2 --namespace-id 2cdf36a27f834b5f9c726294d36770fb --remote
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEVMAP_CORE_JS } from "../src/devmap_core.js";
export const DM = new Function(DEVMAP_CORE_JS + "; return DM;")();

const bedOf = (t) => { t = String(t || "").toLowerCase(); if (t === "studio") return 0; const m = t.match(/^(\d+)\s*(?:bed|br|b\/r)/); return m ? Math.min(+m[1], 5) : null; };
const LEGAL = /\s*\(?\b(l\.?\s*l\.?\s*c|p\.?\s*j\.?\s*s\.?\s*c|fz[ce]?|llc|ltd|limited|co)\b\.?\)?/gi;   // legal-form suffixes are not part of the name shown
const titleCase = (s) => { s = s.replace(LEGAL, "").replace(/\s+/g, " ").trim(); return /[a-z]/.test(s) && /[A-Z]/.test(s) ? s : s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()); };
const nameKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// one district's unit-mix cards -> cells per developer. projDev: {nameKey(project): developer}, priceDev: {"d:i": developer}
export function buildArea(U, slug, projDev, priceDev, rentItems, rentDevByP) {
  const B = (U && U.buildings_by_id) || {}, devs = {}, names = {};
  const slot = (dev) => {
    const k = dev ? DM.devKey(dev) : "_";
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
  for (const k of Object.keys(devs)) if (k !== "_") { const o = names[k] || {}; const best = Object.keys(o).sort((a, b) => o[b] - o[a])[0]; devs[k].n = titleCase(best || k); }
  for (const k of Object.keys(devs)) if (!devs[k].c.length && !devs[k].r.length) delete devs[k];
  return devs;
}

export function buildIndex({ umDir, prices, rent, geo, projectsCsv, ejariProjects, outAsOf }) {
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
    if (!U || !U.buildings_by_id) continue;
    const devs = buildArea(U, g.slug, projDev, priceDev, (rent.items || []).filter((i) => i.d === g.slug), rentDevByP);
    if (!Object.keys(devs).length) continue;
    areas[g.slug] = { name: g.name, corridor: g.corridor, bbox: g.bbox, centre: g.centre, devs };
    for (const k of Object.keys(devs)) all.push(...devs[k].c);
  }
  const bounds = DM.percentileBounds(all, DM.TIER_CFG.percentiles);
  const devList = {};
  for (const s of Object.keys(areas)) for (const k of Object.keys(areas[s].devs)) {
    if (k === "_") continue;
    const d = areas[s].devs[k]; const e = devList[k] || (devList[k] = { name: d.n, areas: 0, n: 0 });
    e.areas++; e.n += DM.wmedian ? d.c.reduce((a, c) => a + c[0], 0) : 0;
  }
  return {
    as_of: outAsOf || null, generated: new Date().toISOString().slice(0, 10),
    source: "Dubai Land Department sales register (settled sales, unit-mix cards) and Ejari tenancy contracts; developers from the register and the developers' own sheets",
    cuts: { bounds, percentiles: DM.TIER_CFG.percentiles, rule: "Dubai-wide: BUDGET is the cheapest half of settled sales by price per sq m, PREMIUM the next 30%, LUXURY the next 15%, ULTRA-LUXURY the top 5%. A price band, not a judgement of any developer." },
    devs: devList, areas,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const a = {}; for (let i = 2; i < process.argv.length; i += 2) a[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
  const rd = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
  const prices = rd(a.prices);
  const idx = buildIndex({ umDir: a.um, prices, rent: rd(a.rent), geo: rd(a.geo), ejariProjects: a.ejari ? rd(a.ejari) : null, projectsCsv: a.projects ? fs.readFileSync(a.projects, "utf8") : null, outAsOf: String(prices.generated || "").slice(0, 10) });
  fs.writeFileSync(a.out, JSON.stringify(idx));
  console.log("areas", Object.keys(idx.areas).length, "developers", Object.keys(idx.devs).length, "bounds", idx.cuts.bounds, "bytes", fs.statSync(a.out).size);
}
