// v401 - REGISTER-BUILT CARDS for projects that have registered sales but no card on the developer page (the server side; the page logic is src/regcards_page.js).
// KV img_devmap_regcards (built offline by scripts/build_regcards.py, published by scripts/publish_regcards.py) holds d[<developer id> | "_"][<district slug>] = [entry, ...]: register projects the
// completeness audit of 7 Oct 2026 found with no developer-page card (their sales are not homes with a bedroom count and a size, or the project is newer than the cards). Every fact on an entry comes from the
// Land Department registers. They are NEVER counted: not in a total, a price band, the scale word or an area count. Label on the page: 'Built from the Land Department register; no price card yet'.
// A developer id files the entry in that developer's group; "_" files it in the AREA card's group (one of the 42 districts) or in the 'Other Dubai areas' card (any other district).
// The route (GET /developers_map_api?what=regcards) returns the stored value when it has the shape the page needs, otherwise {} - and the page then changes nothing (v399 exactly). Nothing here writes KV.
export const REGCARDS_KV_NAME = "devmap_regcards";            // read through kvJson(env, "devmap_regcards") = KV key img_devmap_regcards
export const REGCARDS_LABEL = "Built from the Land Department register; no price card yet";
export const REGCARDS_MIN_PRICED = 5;                         // a price range only where this many sales carry a price
const LABELS = ["REGISTER_VERIFIED", "NAME_ONLY", "DEVELOPER_CLAIMED", "UNVERIFIED"];
const STR = ["n", "e", "de", "br", "a", "as", "st", "pe", "sf", "sl"];
const NUM = ["p", "pc", "u", "sc", "so", "np"];

const isInt = (x) => typeof x === "number" && isFinite(x) && x >= 0 && Math.floor(x) === x;

// the shape check: every entry has a name, a known evidence label and a register project number; unknown fields are dropped; a price range without five priced sales is dropped; nothing valid = absent (null).
export function cleanRegcards(d) {
  if (!d || typeof d !== "object" || !d.d || typeof d.d !== "object") return null;
  const out = {}; let n = 0;
  for (const dev of Object.keys(d.d)) {
    const ds = d.d[dev]; if (!ds || typeof ds !== "object") continue;
    for (const dist of Object.keys(ds)) {
      const list = Array.isArray(ds[dist]) ? ds[dist] : [];
      const ok = [];
      for (const e of list) {
        if (!e || typeof e !== "object" || typeof e.n !== "string" || !e.n || LABELS.indexOf(e.e) < 0 || !isInt(e.p) || e.p < 1) continue;
        const c = { p: e.p };
        for (const k of STR) if (typeof e[k] === "string" && e[k]) c[k] = e[k].slice(0, 160);
        for (const k of NUM) if (k !== "p" && typeof e[k] === "number" && isFinite(e[k])) c[k] = e[k];
        if (!isInt(c.sc)) c.sc = 0;
        if (isInt(e.pmin) && isInt(e.pmax) && e.pmin <= e.pmax && isInt(c.np) && c.np >= REGCARDS_MIN_PRICED) { c.pmin = e.pmin; c.pmax = e.pmax; }
        if (e.k === "plot" || e.k === "comm") c.k = e.k;
        if (e.o) c.o = 1;
        ok.push(c);
      }
      if (ok.length) { (out[dev] = out[dev] || {})[dist] = ok; n += ok.length; }
    }
  }
  return n ? { meta: d.meta && typeof d.meta === "object" ? { built: d.meta.built || null, count: n } : { count: n }, d: out } : null;
}
