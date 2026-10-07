// v392 - PROJECTS WITH NO REGISTERED SALES YET: the server side (the page logic is src/nosales_page.js).
// KV img_devmap_nosales (built offline by scripts/build_nosales.py, published by scripts/publish_nosales.py) holds d[<developer slug>][<district slug>] = [entry, ...]: register projects with
// ZERO registered unit sales (and the one off-register project KORE by Imtiaz). They are never counted in a total, a price band or the scale word.
// The route (GET /developers_map_api?what=nosales) returns the stored value when it has the shape the page needs, otherwise {} - and the page then changes nothing (v390 exactly).
// KV img_search_extra (scripts/build_search_extra.py, scripts/publish_nosales.py --what search) holds plot features for the Najma map search; mergePlots() adds them to the plots list the
// map search reads (/img/plots) and never replaces or reorders a feature the list already has. Nothing here writes KV.
export const NOSALES_KV_NAME = "devmap_nosales";            // read through kvJson(env, "devmap_nosales") = KV key img_devmap_nosales
export const SEARCH_EXTRA_KV = "img_search_extra";          // the raw key (read with env.MEETINGS.get)

const inDubai = (lon, lat) => lon >= 54.5 && lon <= 56.6 && lat >= 24 && lat <= 25.6;
const LABELS = ["REGISTER_VERIFIED", "NAME_ONLY", "DEVELOPER_CLAIMED", "UNVERIFIED"];

// the shape check: every entry has a name and a known evidence label; a position block is kept only inside Dubai; a bad entry is dropped; nothing valid = absent (null).
export function cleanNosales(d) {
  if (!d || typeof d !== "object" || !d.d || typeof d.d !== "object") return null;
  const out = {}; let n = 0;
  for (const dev of Object.keys(d.d)) {
    const ds = d.d[dev]; if (!ds || typeof ds !== "object") continue;
    for (const dist of Object.keys(ds)) {
      const list = Array.isArray(ds[dist]) ? ds[dist] : [];
      const ok = [];
      for (const e of list) {
        if (!e || typeof e !== "object" || typeof e.n !== "string" || !e.n || LABELS.indexOf(e.e) < 0) continue;
        if (e.pp && !(typeof e.pp.lon === "number" && typeof e.pp.lat === "number" && inDubai(e.pp.lon, e.pp.lat))) delete e.pp;
        ok.push(e);
      }
      if (ok.length) { (out[dev] = out[dev] || {})[dist] = ok; n += ok.length; }
    }
  }
  return n ? { meta: d.meta && typeof d.meta === "object" ? { built: d.meta.built || null, count: n } : { count: n }, d: out } : null;
}

// entries that carry their own plot position (KORE: not on the project register, so no project number to look the position up by) are added to the plot-position answer under the key the card uses
export function addNosalesPlots(pp, ns) {
  if (!ns || !ns.d) return pp;
  const p = pp && pp.p ? Object.assign({}, pp.p) : {}; let add = 0;
  for (const dev of Object.keys(ns.d)) for (const dist of Object.keys(ns.d[dev])) for (const e of ns.d[dev][dist]) {
    if (!e.pp || !e.key || p[e.key]) continue;
    p[e.key] = { lon: e.pp.lon, lat: e.pp.lat, parcels: e.pp.parcels || [], n_plots: e.pp.n_plots || 1, basis: e.pp.basis || "plot_outline", evidence: "DERIVED", link: e.pp.link || "REGISTER_VERIFIED", label: e.pp.label || "Plot position (centre of the registered plot)", as_of: e.pp.as_of || null, d: dist };
    add++;
  }
  if (!add) return pp;
  return { meta: (pp && pp.meta) || {}, p };
}

const nk = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, "");
// the map search reads KV img_plots (a FeatureCollection). extra = KV img_search_extra {features:[...]}. Returns the merged JSON TEXT, or null when there is nothing to add (the caller then serves img_plots untouched).
export function mergePlots(plotsText, extraText) {
  let pl = null, ex = null;
  try { pl = JSON.parse(plotsText || "null"); } catch (e) { pl = null; }
  try { ex = JSON.parse(extraText || "null"); } catch (e) { ex = null; }
  if (!pl || !Array.isArray(pl.features) || !ex || !(Array.isArray(ex.features) || Array.isArray(ex.sx))) return null;
  const haveId = new Set(), haveName = new Set();
  for (const f of pl.features) { const p = (f && f.properties) || {}; if (p.plot != null) haveId.add(String(p.plot)); if (p.name) haveName.add(nk(p.name)); }
  const add = [];
  for (const f of (Array.isArray(ex.features) ? ex.features : [])) {
    const p = f && f.properties, g = f && f.geometry && f.geometry.coordinates;
    if (!p || !p.name || !Array.isArray(g) || !(typeof g[0] === "number" && typeof g[1] === "number" && inDubai(g[0], g[1]))) continue;
    if ((p.plot != null && haveId.has(String(p.plot))) || haveName.has(nk(p.name))) continue;
    add.push(f);
  }
  const sxAdd = cleanSx(ex.sx, 2, new Set(Array.from(haveName).concat(add.map((f) => nk(f.properties.name)))), pl.sx);
  if (!add.length && !sxAdd.length) return null;
  const out = Object.assign({}, pl, { features: pl.features.concat(add) });
  if (sxAdd.length) out.sx = (Array.isArray(pl.sx) ? pl.sx : []).concat(sxAdd);   // v397b - search-only entries: never drawn, the page reads them in searchAll
  return JSON.stringify(out);
}

// v397b - every register project is findable. img_search_extra carries sx: compact entries (name, Arabic name, project number, area, developer, position) for the projects the lists lack.
// They are added to /img/plots as 'sx' (the Najma map search, flag 2) and to /img/search_index as development rows (the Find page, flag 1). Never replaces or reorders; a name already in the list is skipped.
const nkx = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, "");
function cleanSx(sx, flag, have, already) {
  const out = [], seen = new Set(have || []);
  for (const x of (Array.isArray(already) ? already : [])) if (x && x.n) seen.add(nkx(x.n));
  for (const x of (Array.isArray(sx) ? sx : [])) {
    if (!x || typeof x.n !== "string" || !x.n || !((Number(x.s) || 3) & flag)) continue;
    const k = nkx(x.n) + "|" + (x.pn || ""); const kn = nkx(x.n);
    if (!kn || seen.has(kn) || seen.has(k)) continue;
    seen.add(kn); seen.add(k);
    const y = Object.assign({}, x);
    if (!(typeof y.lo === "number" && typeof y.la === "number" && inDubai(y.lo, y.la))) { delete y.lo; delete y.la; delete y.k; delete y.pl; }
    out.push(y);
  }
  return out;
}

// the Find page's list (KV img_search_index): the sx entries it lacks are appended as development rows (off = in the register, not yet on the twin). Null = nothing to add.
export function mergeSearchIndex(idxText, extraText) {
  let ix = null, ex = null;
  try { ix = JSON.parse(idxText || "null"); } catch (e) { ix = null; }
  try { ex = JSON.parse(extraText || "null"); } catch (e) { ex = null; }
  if (!ix || !Array.isArray(ix.items) || !ex || !Array.isArray(ex.sx)) return null;
  const have = new Set(); for (const it of ix.items) if (it && it.n) have.add(nkx(it.n));
  const add = cleanSx(ex.sx, 1, have).map((x) => {
    const r = { n: x.n, t: "development", off: 1 };
    if (x.a) r.a = x.a; if (x.d) r.d = x.d; if (x.u != null) r.units = x.u; if (x.dv) { r.lg = x.dv; r.ev = x.ev || "UNVERIFIED"; }
    if (x.ar) r.ar = x.ar; if (x.pn) r.pn = x.pn; if (x.st) r.rs = x.st;
    return r;
  });
  if (!add.length) return null;
  return JSON.stringify(Object.assign({}, ix, { items: ix.items.concat(add), n: (Number(ix.n) || ix.items.length) + add.length }));
}

// reads img_search_extra; when it is split (parts) the per-district keys img_search_extra_<d> are joined into one sx. Null = nothing published.
export async function readSearchExtra(kv) {
  const main = await kv.get(SEARCH_EXTRA_KV);
  if (!main) return null;
  let o = null; try { o = JSON.parse(main); } catch (e) { return null; }
  if (!o || !o.parts || typeof o.parts !== "object") return main;
  const ds = Object.keys(o.parts).filter((d) => /^[a-z0-9]+$/.test(d));
  const got = await Promise.all(ds.map((d) => kv.get(SEARCH_EXTRA_KV + "_" + d).catch(() => null)));
  const sx = Array.isArray(o.sx) ? o.sx.slice() : [];
  for (const t of got) { try { const j = JSON.parse(t || "null"); if (j && Array.isArray(j.sx)) for (const x of j.sx) sx.push(x); } catch (e) {} }
  return JSON.stringify(Object.assign({}, o, { sx }));
}
