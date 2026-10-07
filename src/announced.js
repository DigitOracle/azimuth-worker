// v397d - PROJECTS THE DEVELOPER ANNOUNCES THAT ARE IN NO REGISTER: the server side (the page logic is src/announced_page.js).
// KV img_devmap_announced (built offline by scripts/build_announced.py, published by scripts/publish_announced.py) holds d[<developer slug, or '~<name>' when the developer has no profile>][<district slug, or '_'>] = [entry, ...].
// Every entry is DEVELOPER_CLAIMED, carries no project number, no position and no sales figure, and is never counted in a total, a price band or the scale word.
// The route (GET /developers_map_api?what=announced) returns the stored value when it has the shape the page needs, otherwise {} - and the page then changes nothing (v395 exactly).
// KV img_search_extra_announced (data/search_extra/announced_search.json) holds Find-page items for the same projects; mergeSearchItems() adds them to /img/search_index and never replaces or reorders an item
// the index already has. Nothing here writes KV.
export const ANNOUNCED_KV_NAME = "devmap_announced";                 // read through kvJson(env, "devmap_announced") = KV key img_devmap_announced
export const SEARCH_EXTRA_ANNOUNCED_KV = "img_search_extra_announced";   // the raw key (read with env.MEETINGS.get)

const nk = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, "");

// the shape check: every entry has a name and the one evidence label DEVELOPER_CLAIMED; a project number, a position or a sales field is stripped; a bad entry is dropped; nothing valid = absent (null).
export function cleanAnnounced(d) {
  if (!d || typeof d !== "object" || !d.d || typeof d.d !== "object") return null;
  const out = {}; let n = 0;
  for (const dev of Object.keys(d.d)) {
    const ds = d.d[dev]; if (!ds || typeof ds !== "object") continue;
    for (const dist of Object.keys(ds)) {
      const list = Array.isArray(ds[dist]) ? ds[dist] : [];
      const ok = [];
      for (const e of list) {
        if (!e || typeof e !== "object" || typeof e.n !== "string" || !e.n || e.e !== "DEVELOPER_CLAIMED") continue;
        for (const k of ["p", "pp", "key", "pn", "sales", "ppsm", "n_sales", "price"]) delete e[k];
        if (e.pm && !(typeof e.pm === "object" && typeof e.pm.n === "string" && typeof e.pm.k === "string")) delete e.pm;   // v397d - the register project of the same name (a possible match), shown as a plain line
        if (e.od != null && typeof e.od !== "string") delete e.od;                                                        // v397d - outside Dubai: the place the developer gives
        ok.push(e);
      }
      if (ok.length) { (out[dev] = out[dev] || {})[dist] = ok; n += ok.length; }
    }
  }
  return n ? { meta: d.meta && typeof d.meta === "object" ? { built: d.meta.built || null, count: n } : { count: n }, d: out } : null;
}

// the Find page reads KV img_search_index {items:[{n,t,dev,a,...}]}. extra = KV img_search_extra_announced {items:[...]}. Returns the merged JSON TEXT, or null when there is nothing to add
// (the caller then serves img_search_index untouched). An item of the same normalised name and the same developer, or an announced item already there, is skipped; the index order is kept.
export function mergeSearchItems(indexText, extraText) {
  let ix = null, ex = null;
  try { ix = JSON.parse(indexText || "null"); } catch (e) { ix = null; }
  try { ex = JSON.parse(extraText || "null"); } catch (e) { ex = null; }
  if (!ix || !Array.isArray(ix.items) || !ex || !Array.isArray(ex.items)) return null;
  const have = new Set();
  for (const it of ix.items) if (it && it.n) have.add(nk(it.n) + "|" + (it.dev || ""));
  const add = [];
  for (const it of ex.items) {
    if (!it || typeof it.n !== "string" || !it.n || it.ann !== 1 || it.t !== "development") continue;
    const k = nk(it.n) + "|" + (it.dev || "");
    if (have.has(k)) continue;
    have.add(k);
    add.push({ n: it.n, t: "development", ann: 1, lw: it.lw === 1 ? 1 : undefined, od: it.od === 1 ? 1 : undefined, pm: it.pm === 1 ? 1 : undefined, dev: it.dev || undefined, a: typeof it.a === "string" ? it.a : undefined, units: typeof it.units === "number" ? it.units : undefined });
  }
  if (!add.length) return null;
  return JSON.stringify(Object.assign({}, ix, { n: (ix.n || ix.items.length) + add.length, items: ix.items.concat(add) }));
}
