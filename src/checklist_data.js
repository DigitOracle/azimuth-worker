// v291 - THE DAMAC HILLS CHECKLIST, the shared data rules (no imports, no storage: pure functions over what the callers read).
//
// Kendall, 2 Oct 2026: "I want to get 100% of DAMAC Hills done, correct, before moving to another community." The owner-only page
// (src/checklist.js, /checklist) lets the owner and Naj correct three things on site; THIS file is how every reader applies those
// corrections, so the checklist, the Brief documents (src/brief_docs.js), the Brief list (src/brief.js) and the Blocks page
// (src/blocks_page.js) can never disagree:
//
//   img_anchor_overrides_<d>  {cluster_name: {add: [footprint ids], remove: [ids], by, at}}  - which homes belong to a sub-community.
//                             Merged over the district model's attribution (img_anchors_<d>): an add puts the footprint in that
//                             cluster (and takes it out of the cluster the anchors file put it in, unless that cluster's own override
//                             adds it too); a remove takes it out. Overrides win over the anchors file.
//   img_broker_facts_<d>      {cluster_name: {private_pool, home_type, gym, furnished, notes, by: "Najjuko (RERA licensed broker)",
//                             checked_on: "YYYY-MM-DD"}} - what the broker checked on site. A SOURCE, ranked BELOW every register,
//                             developer page and amenity-file answer and ABOVE "not known": it fills only an answer still open, and
//                             always says "per Najjuko, checked on site <date>".
//   img_ownphotos_<d>         {slug: {name, photos: [{key, at, w, h, bytes, by}]}} - Najjuko's own photographs (img_ownphoto_<d>_<slug>_<n>).
//                             Her own pictures, so fine on a client document: the card picture FIRST, above the developer's photo,
//                             credited "Photo: Najjuko".

export const BROKER_BY = "Najjuko (RERA licensed broker)";
export const PHOTO_CREDIT = "Photo: Najjuko";

// the same normalisation brief_docs.js uses for the register attribution (exact name, case, spacing and punctuation folded)
export const normName = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
// "DAMAC HILLS - BROOKFIELD-2" in damachills -> "brookfield2": the folder name data/brand/renders/damachills_<slug> already uses
export function communitySlug(name, d) {
  const n = normName(name), dd = normName(d);
  const s = dd && n.startsWith(dd) && n.length > dd.length ? n.slice(dd.length) : n;
  return s.slice(0, 40);
}

const ints = (xs) => [...new Set((Array.isArray(xs) ? xs : []).map((x) => Number(x)).filter((x) => Number.isInteger(x) && x >= 0 && x < 1e7))];

// map: normalised cluster name -> [footprint ids] (areaIndex in brief_docs.js). Returns a NEW map with the overrides applied.
export function applyAnchorOverrides(map, overrides) {
  const out = new Map();
  if (map) for (const [k, ids] of map) out.set(k, ids.slice());
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return map || (out.size ? out : null);
  const ex = new Map();
  for (const [name, o] of Object.entries(overrides)) {
    const k = normName(name);
    if (!k || !o || typeof o !== "object") continue;
    const e = ex.get(k) || { add: new Set(), remove: new Set() };
    for (const i of ints(o.add)) e.add.add(i);
    for (const i of ints(o.remove)) e.remove.add(i);
    ex.set(k, e);
  }
  const moved = new Set(); for (const e of ex.values()) for (const i of e.add) moved.add(i);
  for (const [k, ids] of out) { const e = ex.get(k); out.set(k, ids.filter((i) => !moved.has(i) || (e && e.add.has(i)))); }
  for (const [k, e] of ex) {
    const cur = new Set(out.get(k) || []);
    for (const i of e.add) cur.add(i);
    for (const i of e.remove) cur.delete(i);
    out.set(k, [...cur]);
  }
  for (const [k, ids] of [...out]) if (!ids.length) out.delete(k);
  return out;
}

// the override entry for a cluster (exact normalised name), or null
export function overrideFor(overrides, name) {
  if (!overrides || typeof overrides !== "object") return null;
  const k = normName(name);
  for (const [n, o] of Object.entries(overrides)) if (normName(n) === k) return o;
  return null;
}

// ---- broker facts ---------------------------------------------------------------------------------------------------------------
export const BROKER_FIELDS = {
  private_pool: { all: "every home has a private pool", some: "some homes have a private pool, not all - confirm per home", none: "no homes have a private pool" },
  home_type: { villa_detached: "detached villas", semi_detached: "semi-detached villas", townhouse_row: "townhouses in rows", apartments: "apartments" },
  gym: { yes: "a gym in the cluster", no: "no gym in the cluster" },
  furnished: { often: "furnished homes come up often", sometimes: "furnished homes come up sometimes", rarely: "furnished homes come up rarely" },
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function longDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? (+m[3]) + " " + MONTHS[+m[2] - 1] + " " + m[1] : String(iso || "");
}
// "per Najjuko, checked on site 2 October 2026" - the words the list and the PDF carry for every broker answer
export const brokerSay = (bf) => "per Najjuko, checked on site " + longDate(bf && bf.checked_on);

// the broker's record for a community: the first of the names that matches a stored cluster name exactly (normalised)
export function brokerFor(BF, names) {
  if (!BF || typeof BF !== "object") return null;
  const want = new Set((names || []).map(normName).filter(Boolean));
  for (const [n, f] of Object.entries(BF)) if (f && typeof f === "object" && want.has(normName(n))) return f;
  return null;
}

// clean a submitted form into a stored record: unknown values and "not sure" are dropped (a "not sure" saves nothing)
export function cleanBrokerFacts(input, today) {
  const out = {};
  for (const [k, vals] of Object.entries(BROKER_FIELDS)) { const v = String((input && input[k]) || ""); if (Object.prototype.hasOwnProperty.call(vals, v)) out[k] = v; }
  const notes = String((input && input.notes) || "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
  if (notes) out.notes = notes;
  if (!Object.keys(out).length) return null;
  out.by = BROKER_BY;
  out.checked_on = /^\d{4}-\d{2}-\d{2}$/.test(String(today || "")) ? today : new Date().toISOString().slice(0, 10);
  return out;
}

// Fill the criteria the registers left open (v null) from the broker's record. NEVER changes an answer a source already gave.
// crit: the criteriaOf() result (src/brief.js), mutated and returned.
export function applyBrokerFacts(crit, bf) {
  if (!crit || !bf || typeof bf !== "object") return crit;
  const say = brokerSay(bf), lead = BROKER_BY + ": ";
  const put = (k, v, what) => {
    const cur = crit[k];
    if (cur && cur.v != null) return;                                   // a register / developer / amenity-file answer stands
    crit[k] = { v, src: lead + what + " - " + say, level: "cluster", source: BROKER_BY, broker: true, checked_on: bf.checked_on || null,
      ...(cur && cur.detail ? { detail: cur.detail } : {}) };
  };
  if (bf.private_pool === "all") put("private_pool", true, BROKER_FIELDS.private_pool.all);
  else if (bf.private_pool === "some") put("private_pool", true, BROKER_FIELDS.private_pool.some);
  else if (bf.private_pool === "none") put("private_pool", false, BROKER_FIELDS.private_pool.none);
  if (bf.gym === "yes") put("gym", true, BROKER_FIELDS.gym.yes);
  else if (bf.gym === "no") put("gym", false, BROKER_FIELDS.gym.no);
  if (bf.home_type && BROKER_FIELDS.home_type[bf.home_type]) {
    const what = BROKER_FIELDS.home_type[bf.home_type];
    // the townhouse question (villa records only): yes for a row of townhouses, no for detached villas or apartments; a semi-detached
    // villa is neither, so it answers the home type without answering "townhouse"
    if (crit.townhouse && crit.townhouse.v == null) {
      if (bf.home_type === "townhouse_row") put("townhouse", true, what);
      else if (bf.home_type === "villa_detached" || bf.home_type === "apartments") put("townhouse", false, what);
    }
    if (!crit.home_type) crit.home_type = { v: null, say: what, src: lead + what + " - " + say, source: BROKER_BY, broker: true };
  }
  if (bf.furnished && BROKER_FIELDS.furnished[bf.furnished] && !(crit.furnished && crit.furnished.v != null))
    crit.furnished = { v: null, src: "Not known for this home: the Ejari register does not record furnishing. " + lead + BROKER_FIELDS.furnished[bf.furnished] + " in this community - " + say + ".", source: BROKER_BY, broker: true };
  return crit;
}

// ---- own photos -------------------------------------------------------------------------------------------------------------------
export const OWNPHOTO = { maxBytes: 5 * 1024 * 1024, maxSide: 1600, maxPerCommunity: 20 };
export const ownPhotoKey = (d, slug, n) => "ownphoto_" + d + "_" + slug + "_" + n;   // stored as img_<this> with img_ct_<this> = image/jpeg
// the newest own photo for a record (by any of its names), or null
export function ownPhotoFor(index, names, d) {
  if (!index || typeof index !== "object") return null;
  for (const n of names || []) {
    const e = index[communitySlug(n, d)];
    const ps = e && Array.isArray(e.photos) ? e.photos.filter((p) => p && p.key) : [];
    if (ps.length) return ps[ps.length - 1];
  }
  return null;
}
