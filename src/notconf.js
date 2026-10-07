// v397a - PROJECTS A RULE KEPT OFF THE DEVELOPER CARDS, shown in the 'Not confirmed by the register' group (the server side; the page logic is src/notconf_page.js).
// KV img_devmap_notconf (built offline by scripts/build_notconf.py, published by scripts/publish_notconf.py) holds d[<developer id> | "_"][<district slug>] = [entry, ...]: register projects that a
// rule dropped (offices and shops, a sale with no size, a card that carries another name, a name shared with another project). They are NEVER counted: not in a total, a price band, the scale word or an area count.
// A developer id files the entry in that developer's group; "_" files it in the AREA card's group 'Projects whose developer is not recorded here' (collapsed, per district).
// The route (GET /developers_map_api?what=notconf) returns the stored value when it has the shape the page needs, otherwise {} - and the page then changes nothing (v395 exactly). Nothing here writes KV.
export const NOTCONF_KV_NAME = "devmap_notconf";            // read through kvJson(env, "devmap_notconf") = KV key img_devmap_notconf
export const NOTCONF_REASONS = ["non_residential_sales", "no_sales_by_type", "no_size", "no_sales", "other_name", "same_name"];
const LABELS = ["REGISTER_VERIFIED", "NAME_ONLY", "DEVELOPER_CLAIMED", "UNVERIFIED"];

// the shape check: every entry has a name, a known evidence label and a known reason; a bad entry is dropped; nothing valid = absent (null).
export function cleanNotconf(d) {
  if (!d || typeof d !== "object" || !d.d || typeof d.d !== "object") return null;
  const out = {}; let n = 0;
  for (const dev of Object.keys(d.d)) {
    const ds = d.d[dev]; if (!ds || typeof ds !== "object") continue;
    for (const dist of Object.keys(ds)) {
      const list = Array.isArray(ds[dist]) ? ds[dist] : [];
      const ok = [];
      for (const e of list) {
        if (!e || typeof e !== "object" || typeof e.n !== "string" || !e.n || LABELS.indexOf(e.e) < 0 || NOTCONF_REASONS.indexOf(e.r) < 0) continue;
        ok.push(e);
      }
      if (ok.length) { (out[dev] = out[dev] || {})[dist] = ok; n += ok.length; }
    }
  }
  return n ? { meta: d.meta && typeof d.meta === "object" ? { built: d.meta.built || null, count: n } : { count: n }, d: out } : null;
}
