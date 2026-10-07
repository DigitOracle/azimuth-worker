// v379 - investor-PDF facts for EVERY project: pure helpers (no I/O, no clock): the schema validator, the storage layout (one shard per district plus a small index) and the
// button matching rules. The records themselves are built offline by scripts/build_investor_facts.py; nothing in this file writes KV.
//   KV img_investor_tiers_index            {as_of, count, projects:[{id, name, brand_name, district, project_number}]}   district = the shard's suffix
//   KV img_investor_tiers_facts_<district> {projects:{<id>: facts}}                                                         one district, so no single key is large
//   KV img_investor_tiers_facts            the v376 single key (Chelsea only); still read as the fallback so nothing live breaks
import { lintText, LABEL_TEXT } from "./investor_tiers.js";

export const INDEX_KEY = "investor_tiers_index";
export const SHARD_PREFIX = "investor_tiers_facts_";
export const LEGACY_KEY = "investor_tiers_facts";
export const shardKey = (district) => SHARD_PREFIX + String(district || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
export const districtSlug = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

// ---------------------------------------------------------------------------------------------------------- the schema (what src/investor_tiers.js consumes)
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isNum = (x) => typeof x === "number" && isFinite(x);
const str = (x) => typeof x === "string" && x.trim().length > 0;
// a placeholder is never a value: unknown stays unknown, and the page says so in one plain line
const PLACEHOLDER = /^\s*(null|undefined|nan|n\/a|na|tbd|todo|unknown|-|–|\?+)\s*$|lorem ipsum|\bTBD\b|\bTODO\b|\bundefined\b|\bNaN\b/i;
const numsIn = (t) => (String(t || "").match(/\d+(?:\.\d+)?/g) || []).map(Number);
function walkStrings(o, fn, path) {
  if (typeof o === "string") fn(o, path);
  else if (Array.isArray(o)) o.forEach((x, i) => walkStrings(x, fn, path + "[" + i + "]"));
  else if (o && typeof o === "object") for (const k of Object.keys(o)) walkStrings(o[k], fn, path + "." + k);
}
// validateFacts(f) -> [error strings]; empty = the record may be published
export function validateFacts(f) {
  const e = [];
  if (!f || typeof f !== "object") return ["not an object"];
  if (f.schema !== 1) e.push("schema must be 1");
  const P = f.project || {};
  if (!/^[a-z0-9_-]{1,60}$/.test(String(P.id || ""))) e.push("project.id missing or not a simple id of 60 characters or fewer");
  if (!str(P.name)) e.push("project.name missing");
  if (!str(P.brand_name)) e.push("project.brand_name missing");
  if (!str(P.area)) e.push("project.area missing");
  if (P.off_register) { if (P.project_number != null) e.push("an off-register project has no register project number"); if (!str(P.off_register_note)) e.push("an off-register project must say it is not on the project register"); }
  else if (!(Number.isInteger(P.project_number) && P.project_number > 0)) e.push("project.project_number must be the register project number");
  const A = f.as_of || {};
  if (!DATE.test(String(A.sales || ""))) e.push("as_of.sales missing");
  if (!DATE.test(String(A.built || ""))) e.push("as_of.built missing");
  if (!P.off_register && !DATE.test(String(A.register || ""))) e.push("as_of.register missing");
  if (!f.window || !DATE.test(String(f.window.from || "")) || !DATE.test(String(f.window.to || ""))) e.push("window.from / window.to missing");
  // developer: a registered company with its evidence label and basis, or an unknown one with its reason. Never a name without evidence.
  const D = f.developer;
  if (!D || typeof D !== "object") e.push("developer missing (use {legal_entity:null, reason} when it cannot be named)");
  else if (D.legal_entity == null) { if (!str(D.reason)) e.push("developer unknown but no reason is given"); }
  else {
    if (!str(D.legal_entity)) e.push("developer.legal_entity is empty");
    if (!Object.prototype.hasOwnProperty.call(LABEL_TEXT, D.evidence)) e.push("developer.evidence must be one of " + Object.keys(LABEL_TEXT).join(", "));
    if (!str(D.basis)) e.push("developer.basis missing: the evidence for the name must be stated");
    if (D.brand != null && !str(D.brand)) e.push("developer.brand is empty");
    if (D.brand_line != null && !str(D.brand_line)) e.push("developer.brand_line is empty");
  }
  // status: the register row, or null with its reason
  const S = f.status;
  if (S == null) { if (!str(f.status_reason)) e.push("status unknown but status_reason missing"); }
  else {
    if (!str(S.code) || !str(S.text)) e.push("status.code / status.text missing");
    if (S.percent != null && !(isNum(S.percent) && S.percent >= 0 && S.percent <= 100)) e.push("status.percent must be 0 to 100 or null");
    for (const k of ["start", "planned_end", "completion"]) if (S[k] != null && !DATE.test(String(S[k]))) e.push("status." + k + " is not a date");
    if (!str(S.source)) e.push("status.source missing");
  }
  // sales: a figure with its source, zero stated as zero
  const X = f.sales;
  if (X != null) {
    if (!(Number.isInteger(X.all_time) && X.all_time >= 0)) e.push("sales.all_time must be a count (zero is a figure)");
    if (!Number.isInteger(X.l12) || X.l12 < 0) e.push("sales.l12 must be a count");
    if (!str(X.source)) e.push("sales.source missing");
    if (X.all_time === 0) { if (X.first != null || X.last != null || X.median_price != null) e.push("a project with zero sales carries no date range or price"); }
    else {
      if (!DATE.test(String(X.first || "")) || !DATE.test(String(X.last || ""))) e.push("sales date range missing");
      if (!(isNum(X.median_price) && X.median_price > 0)) e.push("sales.median_price missing for a project with sales");
      if (X.l12 > 0 && !(isNum(X.l12_median_price) && isNum(X.l12_median_psf))) e.push("sales.l12 > 0 but the 12-month price figures are missing");
      if (X.l12 > X.all_time) e.push("sales.l12 exceeds sales.all_time");
      if (!Array.isArray(X.by_year)) e.push("sales.by_year missing");
    }
  }
  // price and payment plan: the plan is the developer's own words with its source; no amount comes from a printed code
  const PP = f.price_plan;
  if (!PP || typeof PP !== "object") e.push("price_plan missing");
  else {
    const pl = PP.payment_plan;
    if (pl == null) { if (!str(PP.payment_plan_reason)) e.push("no payment plan and no reason"); }
    else if (typeof pl !== "object") e.push("payment_plan must be an object or null");
    else {
      if (!str(pl.text)) e.push("payment_plan.text missing");
      if (pl.evidence !== "DEVELOPER_CLAIMED") e.push("payment_plan.evidence must be DEVELOPER_CLAIMED");
      if (!pl.source || !str(pl.source.file) || !str(pl.source.quote)) e.push("payment_plan.source (file and the developer's own words) missing");
      const ms = Array.isArray(pl.milestones) ? pl.milestones : null;
      if (!ms) e.push("payment_plan.milestones must be a list (empty when the developer gives options)");
      else if (ms.length) {
        const q = new Set(numsIn(pl.source && pl.source.quote));
        for (const m of ms) {
          if (!str(m.label) || !isNum(m.pct) || typeof m.before_handover !== "boolean") e.push("a milestone needs label, pct and before_handover");
          else if (!q.has(m.pct)) e.push("milestone '" + m.label + "' shows " + m.pct + "%, which is not a figure in the developer's own words (an amount may not come from a printed code)");
        }
        if (ms.reduce((a, m) => a + (isNum(m.pct) ? m.pct : 0), 0) > 100.0001) e.push("milestones add up to more than 100%");
      }
    }
    if (PP.payment_plan_label != null && typeof PP.payment_plan_label !== "string") e.push("payment_plan_label is a printed code and must stay text");
  }
  // delivery
  const DL = f.delivery;
  if (DL == null) { if (!str(f.delivery_reason) && D && D.legal_entity != null) e.push("no delivery record and no delivery_reason"); }
  else {
    if (!DL.entity || !Number.isInteger(DL.entity.projects) || !DL.entity.by_status) e.push("delivery.entity needs projects and by_status");
    if (DL.record) { if (!(DL.record.n >= 3)) e.push("a handover record needs 3 or more projects"); if (!str(DL.record.source)) e.push("delivery.record.source missing"); }
  }
  // rents only where contracts exist, with the count and how they were linked
  if (f.rents != null && f.rents.project_contracts > 0 && !str(f.rents.basis)) e.push("rents.project_contracts > 0 needs rents.basis (how the contracts were linked)");
  if (f.amenities != null && !(Array.isArray(f.amenities) && f.amenities.length && f.amenities.every(str) && str(f.amenities_source))) e.push("amenities need a non-empty list of text and amenities_source (the developer source)");
  if (f.amenities == null && !str(f.amenities_reason)) e.push("amenities unknown but no amenities_reason");
  if (f.resales && f.resales.separable === true) e.push("the register cannot separate a first sale from a resale; resales.separable must be false");
  // the written words: no forecast wording, no emoji, no placeholder
  walkStrings(f, (s, p) => { const l = lintText(s); if (l.length) e.push(p + ": " + l.join("; ")); if (PLACEHOLDER.test(s)) e.push(p + ": placeholder text '" + s.slice(0, 40) + "'"); }, "facts");
  return e;
}

// ---------------------------------------------------------------------------------------------------------- loading (kv = (name) => Promise<json|null>; the caller passes kvJson)
export async function loadFactsSharded(kv, project) {
  const idx = await kv(INDEX_KEY);
  const list = idx && Array.isArray(idx.projects) ? idx.projects : null;
  const hit = list ? list.find((x) => x && x.id === project) : null;
  if (hit && hit.district) {
    const sh = await kv(shardKey(hit.district));
    const f = sh && sh.projects ? sh.projects[project] : null;
    if (f) return f;
  }
  const all = await kv(LEGACY_KEY);                        // the v376 single key: Chelsea, and the fall-back if a shard is missing
  return all && all.projects ? all.projects[project] || null : null;
}

// the compact index for the browser: arrays, no object keys, no facts. brand is "" when it is the same as the name.
export const INDEX_COLS = ["id", "name", "brand", "pn"];
export function compactIndex(idx, legacy) {
  const rows = [], seen = new Set(), extra = [];
  for (const x of (idx && Array.isArray(idx.projects) ? idx.projects : [])) {
    if (!x || !x.id || seen.has(x.id)) continue; seen.add(x.id);
    rows.push([x.id, x.name || x.id, x.brand_name && x.brand_name !== x.name ? x.brand_name : "", x.project_number == null ? 0 : x.project_number]);
  }
  for (const id of Object.keys(legacy && legacy.projects ? legacy.projects : {})) {   // the v376 key: add what the index does not hold
    if (seen.has(id)) continue; seen.add(id);
    const f = legacy.projects[id] || {}, pr = f.project || {};
    extra.push({ id, name: pr.name || id, brand: pr.brand_name || pr.name || id, pn: pr.project_number == null ? 0 : pr.project_number });   // the v376 answer shape: objects
  }
  return { cols: INDEX_COLS, rows, projects: extra };
}

// ---------------------------------------------------------------------------------------------------------- button matching (the same rule the page script uses; kept here so it is tested)
export const pkey = (n) => String(n || "").toLowerCase().replace(/\s+by\s+.*$/, "").replace(/[^a-z0-9؀-ۿ]+/g, "");
// rows: compactIndex rows. proj: {name, p} where p is the register project number from the v373 evidence (bx[i].p) or null.
// 1) a register project number that is in the index wins; 2) a project number that is NOT in the index never falls back to a name; 3) with no number, the exact normalised name, only if it names one project.
export function matchProject(rows, proj) {
  const byPn = {}, byName = {};
  for (const r of rows) { if (r[3]) byPn[r[3]] = r; for (const k of new Set([pkey(r[1]), pkey(r[2])])) if (k) (byName[k] = byName[k] || []).push(r); }
  if (proj.p != null && proj.p !== 0) return byPn[proj.p] || null;
  const c = byName[pkey(proj.name)] || [];
  const u = [...new Set(c)];
  return u.length === 1 ? u[0] : null;
}
