// v291 - THE DAMAC HILLS CHECKLIST (owner only). Kendall, 2 Oct 2026: "I want to get 100% of DAMAC Hills done, correct, before moving to
// another community."
//
//   GET  /checklist?d=damachills&key=<owner key>   the list: every Land Department sub-community of the district, one row each, with
//                                                  what a report would show today (mapped / picture / amenities / render) and a
//                                                  progress bar. Tap a row: its homes on the district map (tap footprints to add or
//                                                  remove, then Save), the broker's facts form, and own photos (phone camera works).
//   GET  /checklist/layer?d=                       the district layer (img_brief_fp_<d>) for the map          - key in X-Owner-Key
//   POST /checklist/save                           JSON {d, kind: "map", cluster, ids} | {d, kind: "facts", cluster, facts}
//                                                  -> img_anchor_overrides_<d> | img_broker_facts_<d>            - key in X-Owner-Key
//   POST /checklist/photo?d=&c=<cluster>           image/jpeg body, <= 5 MB, <= 1600 px (the page resizes first)
//                                                  -> img_ownphoto_<d>_<slug>_<n> + img_ownphotos_<d>             - key in X-Owner-Key
//
// SECURITY. The OWNER key only (keyTier === "admin"); a client key, or none, gets 401 on every route. The page is opened once with the
// key in its URL; the server never writes the key into the page, and the page script takes it from its own address at load, keeps it
// in memory, removes it from the address bar (history.replaceState) and sends it in the X-Owner-Key header. Writes are POST with the
// key in that header only (a key in the URL of a POST is ignored), JSON or image/jpeg bodies only, and refused when the browser says
// the request came from another site (Origin / Sec-Fetch-Site): a cross-site form cannot set the header, and a cross-site script
// would need a CORS preflight this route never answers.
//
// The figures are computed by the SAME functions the Brief documents use (loadContext, blocksKind, svTarget, areaIndex in
// src/brief_docs.js; criteriaOf, amenFor in src/brief.js), so the list says what a report would print, not an estimate of it.
import { loadContext, parseQuery, areaIndex, blocksKind, svTarget, jpegSize } from "./brief_docs.js";
import { kvJson, amenIndex, amenFor, criteriaOf, candidateKey, areaSlugOf } from "./brief.js";
import { normName, communitySlug, applyBrokerFacts, brokerFor, cleanBrokerFacts, overrideFor, ownPhotoFor, ownPhotoKey, OWNPHOTO, BROKER_FIELDS, brokerSay, longDate } from "./checklist_data.js";

export const CHECK_DISTRICTS = { damachills: "DAMAC Hills" };
export const OWNER_HEADER = "X-Owner-Key";
const MAX_SAVE_BYTES = 32 * 1024;
const AMEN_ITEMS = [["pets", "Pets"], ["community_pool", "Community pool"], ["gym", "Gym"], ["parking", "Parking"], ["private_pool", "Private pool"], ["home_type", "Home type"]];
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const jsonInScript = (o) => JSON.stringify(o).replace(/</g, "\\u003c").split(String.fromCharCode(0x2028)).join("\\u2028").split(String.fromCharCode(0x2029)).join("\\u2029");
const tidy = (s) => String(s || "").replace(/\s+/g, " ").trim();
const dubaiToday = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const NOSTORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };
const J = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, NOSTORE) });

// ---- who may use it ---------------------------------------------------------------------------------------------------------------
// The owner key from the X-Owner-Key header (every route), or - for the page itself only - from the URL it was opened with.
export function ownerOk(env, url, request, keyTier, allowUrlKey) {
  if (typeof keyTier !== "function") return false;
  const hk = request.headers.get(OWNER_HEADER) || "";
  if (hk) { const u = new URL(url.origin + "/checklist"); u.searchParams.set("key", hk); return keyTier(env, u) === "admin"; }
  return !!allowUrlKey && keyTier(env, url) === "admin";
}
function crossSite(request, url) {
  const o = request.headers.get("Origin");
  if (o && o !== url.origin) return true;
  const s = request.headers.get("Sec-Fetch-Site");
  return !!(s && s !== "same-origin" && s !== "none");
}
const districtOf = (url) => (String(url.searchParams.get("d") || "damachills").toLowerCase().replace(/[^a-z0-9]/g, "") || "damachills").slice(0, 40);

// ---- the data -----------------------------------------------------------------------------------------------------------------------
// how a footprint came to be filed under its sub-community: "" (by its own name), "family" (from a shared place whose name is only a
// prefix of the sub-community's: "Brookfield" for Brookfield-2) or "community" (from the whole Land Department area's name)
export function attributionOf(a, clusterSlug) {
  if (!a) return "";
  if (a.place_basis === "community") return "community";
  const lab = String(a.place_label || "").replace(/,.*$/, "").replace(/\s+(villas?|townhouses?|apartments?|homes?)$/i, "");
  const nb = normName(lab);
  return nb && nb !== clusterSlug && clusterSlug.startsWith(nb) ? "family" : "";
}
function renderSet(RIDX, d) {
  if (!RIDX) return null;
  const xs = Array.isArray(RIDX) ? RIDX : Array.isArray(RIDX.slugs) ? RIDX.slugs : Object.keys(RIDX.dirs || RIDX).filter((k) => !/^(as_of|generated|source|note)$/.test(k));
  return new Set(xs.map((x) => String(x).toLowerCase().replace(new RegExp("^" + d + "_"), "")));
}
const PIC = {
  own_photo: "Own photo (Photo: Najjuko)", photo: "Developer's photo", street_view: "Street View, else satellite (Google, at print time)",
  blocks: "Blocks view (a render of the district model)", district: "District map - nothing picked out", none: "Nothing (no district layer)",
};
export const PIC_OK = new Set(["own_photo", "photo", "street_view"]);

export async function checklistData(env, d, opts) {
  const o = opts || {};
  const [RI, anchors, ovRaw, units, layer, BFraw, OWNraw, RIDX, amenDoc, geo] = await Promise.all([
    kvJson(env, "rent_index"), kvJson(env, "anchors_" + d), kvJson(env, "anchor_overrides_" + d), kvJson(env, "units_" + d), kvJson(env, "brief_fp_" + d),
    kvJson(env, "broker_facts_" + d), kvJson(env, "ownphotos_" + d), kvJson(env, "render_index_" + d), kvJson(env, "amenities_" + d), kvJson(env, "districts_geo")]);
  const ov = ovRaw && typeof ovRaw === "object" ? ovRaw : {}, BF = BFraw && typeof BFraw === "object" ? BFraw : {}, OWN = OWNraw && typeof OWNraw === "object" ? OWNraw : {};
  const dname = CHECK_DISTRICTS[d] || ((((geo && geo.districts) || []).find((x) => x.slug === d) || {}).name) || d;
  const idx = areaIndex(anchors, ov) || new Map();
  const list = anchors && Array.isArray(anchors.anchors) ? anchors.anchors : [];
  const anchorById = new Map(); for (const a of list) if (a && a.i != null) anchorById.set(a.i, a);
  const layerIds = new Set(layer && Array.isArray(layer.b) ? layer.b.map((b) => b[0]) : []);

  // every sub-community: the rent index, the units register names and the anchors' clusters (and any cluster the owner corrected)
  const rows = new Map();
  const row = (name, src) => { const k = normName(name); if (!k) return null; if (!rows.has(k)) rows.set(k, { name: tidy(name), k, sources: [] }); const r = rows.get(k); if (!r.sources.includes(src)) r.sources.push(src); return r; };
  for (const it of (RI && RI.items) || []) if (areaSlugOf(it) === d && it.n) { const r = row(it.n, "rent index"); if (!r.it) { r.it = it; r.key = candidateKey(it); } }
  for (const [id, b] of Object.entries((units && units.buildings_by_id) || {})) if (b && b.name) { const r = row(b.name, "units register"); if (r.appId == null && !r.it) r.appId = +id; }
  for (const a of list) if (a && a.cluster) row(a.cluster, "district model");
  for (const n of Object.keys(ov)) row(n, "owner's map");

  // the rent records through the Brief's own loader (no Google call: Street View is judged by whether it COULD be aimed)
  const recs = new Map();
  const keyed = [...rows.values()].filter((r) => r.key);
  if (keyed.length) {
    const q = parseQuery(new URL("https://x/?kind=onesheet&beds=all&type=any&keys=" + keyed.map((r) => encodeURIComponent(r.key)).join(",")));
    const C = await loadContext(Object.assign({}, env, { GOOGLE_MAPS_KEY: "" }), q, { need: { map: true, amen: false, avail: false }, origin: o.origin });
    for (const rec of C.recs || []) recs.set(rec.key, rec);
  }
  const AX = amenIndex(amenDoc);
  const google = !!(env && env.GOOGLE_MAPS_KEY);
  const RS = renderSet(RIDX, d);

  const out = [];
  for (const r of rows.values()) {
    const slug = communitySlug(r.name, d);
    let rec = r.key ? recs.get(r.key) : null;
    if (!rec) {   // a community with no rent record: the same functions over a register-only record
      const ids = idx.get(r.k);
      rec = { it: { i: r.appId != null ? r.appId : null, n: r.name, a: [] }, name: r.name, pos: null, areaIds: r.appId == null && ids ? ids : undefined, kind: r.appId != null ? "b" : "v" };
      rec.picSource = blocksKind(rec, layer);
      const own = ownPhotoFor(OWN, [r.name], d);
      if (own) rec.ownPic = { src: (o.origin || "") + "/img/" + own.key, at: own.at };
      const c = { name: r.name, aliases: [] };
      rec.crit = criteriaOf({ c, card: null, brochure: null, AM: null, musts: {}, villa: rec.kind === "v", s: null,
        af: amenFor(AX, { key: r.appId != null ? d + ":" + r.appId : null, d, i: r.appId, name: r.name, aliases: [] }) });
      applyBrokerFacts(rec.crit, brokerFor(BF, [r.name]));
    }
    // mapped
    const o1 = overrideFor(ov, r.name);
    let ids = [], how = "community";
    if (rec.it && rec.it.i != null) { const want = [rec.it.i].concat(rec.it.is || []); ids = want.filter((i) => layerIds.has(i)); how = "building"; }
    else ids = (idx.get(r.k) || []).slice();
    let warn = null;
    if (how === "community" && ids.length && !o1) {
      const cs = communitySlug(r.name, d), n = { family: 0, community: 0 }; let fam = "";
      for (const i of ids) { const a = anchorById.get(i), t = attributionOf(a, cs); if (t) { n[t]++; if (t === "family" && !fam) fam = String(a.place_label || "").replace(/,.*$/, "").replace(/\s+(villas?|townhouses?|apartments?|homes?)$/i, ""); } }
      if (n.family) warn = n.family + " of " + ids.length + " homes were filed from the shared place “" + fam + "”, not " + r.name.replace(/^.*? - /, "") + " itself (family-level) - check on the map";
      else if (n.community) warn = n.community + " of " + ids.length + " homes were filed from the whole area's name, not this sub-community's (community-level) - check on the map";
    }
    // picture: what a report would show
    let pic = rec.ownPic ? "own_photo" : rec.picSource === "photo" ? "photo" : null;
    if (!pic && google && layer && svTarget(rec, layer)) pic = "street_view";
    if (!pic) pic = /^blocks/.test(rec.picSource || "") ? "blocks" : rec.picSource === "district" ? "district" : "none";
    // amenities
    const crit = rec.crit || {}, bf = brokerFor(BF, [r.name].concat(rec.it && rec.it.n ? [rec.it.n] : []));
    const amen = AMEN_ITEMS.map(([k, label]) => {
      if (k === "home_type") {
        if (crit.home_type) return { k, label, v: crit.home_type.say, ok: true, src: crit.home_type.src };
        if (crit.townhouse && crit.townhouse.v != null) return { k, label, v: crit.townhouse.v ? "townhouses" : "not townhouses", ok: true, src: crit.townhouse.src };
        if (rec.kind === "b") return { k, label, v: "apartments", ok: true, src: "the Land Department register files its homes as flats" };
        return { k, label, v: null, ok: false, src: "Not known: the register files villas and townhouses alike" };
      }
      const c = crit[k];
      return { k, label, v: c ? c.v : null, ok: !!(c && c.v != null), src: c ? c.src : "Not known", broker: !!(c && c.broker) };
    });
    const ownE = OWN[slug];
    const photos = ownE && Array.isArray(ownE.photos) ? ownE.photos.filter((p) => p && p.key).map((p) => ({ key: p.key, url: "/img/" + p.key, at: p.at || null })) : [];
    const render = RS ? RS.has(slug) : null;
    const missing = [];
    if (!ids.length) missing.push("mapped"); else if (warn) missing.push("mapping to check");
    if (!PIC_OK.has(pic)) missing.push("picture");
    const amenGap = amen.filter((a) => !a.ok).map((a) => a.label.toLowerCase());
    if (amenGap.length) missing.push("amenities: " + amenGap.join(", "));
    if (render === false) missing.push("render");
    out.push({
      name: r.name, slug, key: r.key || null, sources: r.sources, how,
      mapped: { n: ids.length, ids, warn, override: o1 ? { add: (o1.add || []).length, remove: (o1.remove || []).length, at: o1.at || null } : null },
      picture: { kind: pic, label: PIC[pic] },
      amen, broker: bf ? Object.assign({}, bf, { say: brokerSay(bf) }) : null,
      photos, render, complete: !missing.length, missing,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  const done = out.filter((r) => r.complete).length;
  return { d, dname, as_of: dubaiToday(), rows: out, done, total: out.length, renderIndex: !!RS, google };
}

// ---- the routes -----------------------------------------------------------------------------------------------------------------
export async function checklistRoutes(request, env, url, h) {
  const p = url.pathname;
  if (p !== "/checklist" && p.indexOf("/checklist/") !== 0) return null;
  const keyTier = h && h.keyTier;
  const isPage = p === "/checklist";
  if (!ownerOk(env, url, request, keyTier, isPage && (request.method === "GET" || request.method === "HEAD"))) return new Response("unauthorized", { status: 401, headers: NOSTORE });
  const d = districtOf(url);
  if (isPage) {
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("method not allowed", { status: 405 });
    const data = await checklistData(env, d, { origin: url.origin });
    return new Response(checklistPageHtml(data), { headers: Object.assign({ "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "frame-ancestors 'none'" }, NOSTORE) });
  }
  if (p === "/checklist/layer") {
    if (request.method !== "GET") return new Response("method not allowed", { status: 405 });
    const layer = await kvJson(env, "brief_fp_" + d);
    return layer ? J({ ok: true, d, b: layer.b || [], rp: layer.rp || [] }) : J({ ok: false, reason: "no district layer (img_brief_fp_" + d + ")" }, 404);
  }
  if (p === "/checklist/save") {
    if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
    if (crossSite(request, url)) return J({ ok: false, reason: "cross-site request refused" }, 403);
    if (!/^application\/json\b/i.test(request.headers.get("Content-Type") || "")) return J({ ok: false, reason: "JSON only" }, 415);
    const txt = await request.text();
    if (txt.length > MAX_SAVE_BYTES) return J({ ok: false, reason: "too large" }, 413);
    let b; try { b = JSON.parse(txt); } catch (e) { return J({ ok: false, reason: "not JSON" }, 400); }
    return saveRoute(env, url, b && typeof b === "object" ? b : {});
  }
  if (p === "/checklist/photo") {
    if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
    if (crossSite(request, url)) return J({ ok: false, reason: "cross-site request refused" }, 403);
    return photoRoute(request, env, url, d);
  }
  return new Response("not found", { status: 404 });
}

async function rowNamed(env, d, name, origin) {
  const data = await checklistData(env, d, { origin });
  return { data, row: data.rows.find((r) => r.name && normName(r.name) === normName(name)) || null };
}

async function saveRoute(env, url, b) {
  const d = String(b.d || districtOf(url)).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
  const cluster = String(b.cluster || "").slice(0, 160);
  if (!d || !normName(cluster)) return J({ ok: false, reason: "d and cluster are required" }, 400);
  const { row } = await rowNamed(env, d, cluster, url.origin);
  if (!row) return J({ ok: false, reason: "not a sub-community of " + d + ": " + cluster }, 404);
  const at = new Date().toISOString();
  if (b.kind === "map") {
    if (row.how !== "community") return J({ ok: false, reason: "a building is placed by its own footprint, not by the map" }, 400);
    if (!Array.isArray(b.ids) || b.ids.length > 3000) return J({ ok: false, reason: "ids: a list of footprint ids" }, 400);
    const layer = await kvJson(env, "brief_fp_" + d);
    const have = new Set(layer && Array.isArray(layer.b) ? layer.b.map((x) => x[0]) : []);
    const want = [...new Set(b.ids.map(Number).filter((i) => Number.isInteger(i) && have.has(i)))];
    if (want.length !== new Set(b.ids.map(Number)).size) return J({ ok: false, reason: "some ids are not footprints of the district layer" }, 400);
    const base = (areaIndex(await kvJson(env, "anchors_" + d)) || new Map()).get(normName(cluster)) || [];
    const baseS = new Set(base), wantS = new Set(want);
    const add = want.filter((i) => !baseS.has(i)).sort((x, y) => x - y), remove = base.filter((i) => !wantS.has(i)).sort((x, y) => x - y);
    const ov = (await kvJson(env, "anchor_overrides_" + d)) || {};
    for (const n of Object.keys(ov)) if (normName(n) === normName(cluster)) delete ov[n];
    if (add.length || remove.length) ov[row.name] = { add, remove, by: "owner", at };
    await env.MEETINGS.put("img_anchor_overrides_" + d, JSON.stringify(ov));
  } else if (b.kind === "facts") {
    const f = cleanBrokerFacts(b.facts || {}, dubaiToday());
    const BF = (await kvJson(env, "broker_facts_" + d)) || {};
    for (const n of Object.keys(BF)) if (normName(n) === normName(cluster)) delete BF[n];
    if (f) BF[row.name] = f;
    await env.MEETINGS.put("img_broker_facts_" + d, JSON.stringify(BF));
  } else return J({ ok: false, reason: "kind: map or facts" }, 400);
  const again = await rowNamed(env, d, cluster, url.origin);
  return J({ ok: true, row: again.row, done: again.data.done, total: again.data.total });
}

export async function photoRoute(request, env, url, d) {
  const ct = String(request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (ct !== "image/jpeg") return J({ ok: false, reason: "a JPEG only (image/jpeg); the page converts the photo first" }, 415);
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > OWNPHOTO.maxBytes) return J({ ok: false, reason: "over 5 MB" }, 413);
  const cluster = String(url.searchParams.get("c") || "").slice(0, 160);
  if (!normName(cluster)) return J({ ok: false, reason: "c (the sub-community) is required" }, 400);
  const buf = await request.arrayBuffer();
  if (!buf.byteLength) return J({ ok: false, reason: "empty" }, 400);
  if (buf.byteLength > OWNPHOTO.maxBytes) return J({ ok: false, reason: "over 5 MB" }, 413);
  const dim = jpegSize(buf);
  if (!dim) return J({ ok: false, reason: "not a JPEG" }, 415);
  if (Math.max(dim.w, dim.h) > OWNPHOTO.maxSide) return J({ ok: false, reason: "over " + OWNPHOTO.maxSide + " px on its long side" }, 413);
  const { row } = await rowNamed(env, d, cluster, url.origin);
  if (!row) return J({ ok: false, reason: "not a sub-community of " + d + ": " + cluster }, 404);
  const slug = row.slug;
  if (!/^[a-z0-9]{1,40}$/.test(slug)) return J({ ok: false, reason: "no name to file it under" }, 400);
  const IX = (await kvJson(env, "ownphotos_" + d)) || {};
  const e = IX[slug] || { name: row.name, photos: [] };
  if (e.photos.length >= OWNPHOTO.maxPerCommunity) return J({ ok: false, reason: "already " + OWNPHOTO.maxPerCommunity + " photos for this community" }, 409);
  const n = e.photos.reduce((m, p) => Math.max(m, Number(String(p.key).split("_").pop()) || 0), 0) + 1;
  const key = ownPhotoKey(d, slug, n);
  await env.MEETINGS.put("img_" + key, buf);
  await env.MEETINGS.put("img_ct_" + key, "image/jpeg");
  e.name = row.name; e.photos.push({ key, at: dubaiToday(), w: dim.w, h: dim.h, bytes: buf.byteLength, by: "Najjuko" });
  IX[slug] = e;
  await env.MEETINGS.put("img_ownphotos_" + d, JSON.stringify(IX));
  const again = await rowNamed(env, d, cluster, url.origin);
  return J({ ok: true, key, url: "/img/" + key, row: again.row, done: again.data.done, total: again.data.total });
}

// ---- the page ---------------------------------------------------------------------------------------------------------------------
export const CHECK_CSS = ':root{color-scheme:dark}*{box-sizing:border-box}body{background:#0C1413;color:#E8E4D8;font-family:"IBM Plex Sans",system-ui,sans-serif;margin:0;padding:14px 16px 40px;max-width:640px;margin-inline:auto;-webkit-text-size-adjust:100%}'
  + 'h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.35rem;margin:4px 0 2px;color:#E8E4D8}.sub{color:#8FA39B;font-size:.8rem;margin:0 0 12px}'
  + '.prog{background:#101D1B;border:1px solid #24352F;border-left:3px solid #C5A56A;border-radius:12px;padding:12px 13px;margin:0 0 14px}.prog b{color:#C5A56A}.bar{height:8px;background:#24352F;border-radius:4px;overflow:hidden;margin-top:8px}.bar i{display:block;height:100%;background:linear-gradient(90deg,#0A4F4A,#3E8A7E)}'
  + '.row{display:block;width:100%;text-align:left;color:inherit;font:inherit;background:#101D1B;border:1px solid #24352F;border-radius:12px;padding:11px 12px;margin:0 0 9px;cursor:pointer;-webkit-tap-highlight-color:transparent}.row.done{border-left:3px solid #3E8A7E}.row.todo{border-left:3px solid #C5A56A}'
  + '.rn{display:flex;justify-content:space-between;gap:8px;font-weight:600;font-size:.95rem}.rn span{min-width:0;overflow-wrap:anywhere}.rn small{font-weight:400;color:#8FA39B;font-size:.68rem;text-align:right;max-width:42%;flex:0 0 auto}'
  + '.chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.c{font-size:.68rem;border-radius:999px;padding:3px 8px;border:1px solid #2E4540;color:#C8D3CE;font-family:"IBM Plex Mono",monospace}.c.ok{background:#12302A;border-color:#3E8A7E;color:#8FD3B9}.c.no{background:#2A1F12;border-color:#7A6230;color:#E8C27A}.c.bad{background:#3A1A1A;border-color:#7A3A3A;color:#E89A9A}.c.unk{opacity:.75}'
  + '.miss{font-size:.72rem;color:#8FA39B;margin-top:6px}'
  + '#sheet{position:fixed;inset:0;background:#0C1413;z-index:20;overflow:auto;padding:12px 16px 90px;display:none}#sheet.on{display:block}.sh{display:flex;justify-content:space-between;align-items:center;gap:8px;max-width:640px;margin:0 auto}.sh h2{font-family:Fraunces,Georgia,serif;font-size:1.15rem;margin:0}'
  + '.x{background:none;border:1px solid #2E4540;border-radius:999px;color:#C8D3CE;min-width:40px;min-height:40px;font-size:1.1rem;cursor:pointer}.box{max-width:640px;margin:12px auto 0;background:#101D1B;border:1px solid #24352F;border-radius:12px;padding:12px 13px}.box h3{margin:0 0 8px;font-size:.72rem;letter-spacing:.1em;color:#C5A56A;font-family:"IBM Plex Mono",monospace;font-weight:500}'
  + '.am{font-size:.8rem;line-height:1.4;margin:0 0 6px}.am b{color:#E8E4D8}.am span{color:#8FA39B}'
  + '.q{margin:0 0 10px}.q p{margin:0 0 5px;font-size:.82rem}.seg{display:flex;gap:6px;flex-wrap:wrap}.seg button{flex:1 1 auto;min-height:40px;border:1px solid #2E4540;background:#0E1918;color:#E8E4D8;border-radius:9px;padding:6px 8px;font-size:.8rem;cursor:pointer}.seg button.on{background:#C5A56A;border-color:#C5A56A;color:#0C1413;font-weight:600}'
  + '.in{width:100%;min-height:44px;background:#0E1918;border:1px solid #2E4540;border-radius:9px;color:#E8E4D8;padding:9px 11px;font-size:16px;font-family:inherit}'
  + '.go{display:block;width:100%;min-height:48px;margin:10px 0 0;border:0;border-radius:10px;background:#C5A56A;color:#0C1413;font-family:"IBM Plex Mono",monospace;font-size:.8rem;letter-spacing:.06em;font-weight:600;cursor:pointer}.go.soft{background:#0E1918;color:#C8D3CE;border:1px solid #2E4540}'
  + '.ph{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.ph img{width:88px;height:66px;object-fit:cover;border-radius:6px;border:1px solid #2E4540}.cred{font-size:.68rem;color:#8FA39B}'
  + '#map{position:fixed;inset:0;z-index:30;background:#0A1110;display:none}#map.on{display:block}#map svg{width:100%;height:100%;touch-action:none;display:block}'
  + '#map .mb{position:absolute;left:0;right:0;bottom:0;background:rgba(12,20,19,.94);border-top:1px solid #24352F;padding:10px 14px calc(10px + env(safe-area-inset-bottom));display:flex;gap:8px;align-items:center}#map .mb span{flex:1;font-size:.78rem;color:#C8D3CE}#map .mb button{min-height:44px;border-radius:9px;padding:0 14px;font-size:.8rem;cursor:pointer;border:1px solid #2E4540;background:#0E1918;color:#E8E4D8}#map .mb .p{background:#C5A56A;color:#0C1413;border-color:#C5A56A;font-weight:600}'
  + '#map .mt{position:absolute;top:10px;left:12px;right:12px;display:flex;gap:6px;align-items:center}#map .mt b{flex:1;font-size:.85rem;background:rgba(12,20,19,.85);padding:6px 10px;border-radius:8px}#map .mt button{min-width:40px;min-height:40px;border-radius:999px;border:1px solid #2E4540;background:#0E1918;color:#E8E4D8;font-size:1.1rem}'
  + '.fp{fill:#22312E;stroke:#3A4C47;stroke-width:.8}.fp.oth{fill:#2E4A55}.fp.sel{fill:#C5A56A;stroke:#7A6230}.rd{fill:none;stroke:#1C2725;stroke-width:3}'
  + '#toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#C5A56A;color:#0C1413;border-radius:999px;padding:9px 16px;font-size:.8rem;z-index:50;display:none}';

export function checklistPageHtml(data) {
  const pct = data.total ? Math.round(100 * data.done / data.total) : 0;
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="theme-color" content="#0C1413">'
    + '<title>' + esc(data.dname) + ' checklist · Najma</title>'
    + '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap">'
    + '<style>' + CHECK_CSS + '</style></head><body>'
    + '<h1>' + esc(data.dname) + ' checklist</h1><p class="sub">Owner only &middot; every Land Department sub-community &middot; ' + esc(longDate(data.as_of)) + '</p>'
    + '<div class="prog" id="prog"><div><b>' + esc(data.dname) + ' 100% check:</b> <span id="pn">' + data.done + ' of ' + data.total + '</span> communities complete</div><div class="bar"><i id="pb" style="width:' + pct + '%"></i></div>'
    + '<div class="miss">Complete = homes mapped (no family-level warning), a real picture (own photo, developer photo or Street View), all six amenity answers, and the render folder' + (data.renderIndex ? "" : " (render index not published: shown as unknown, not counted)") + '.</div></div>'
    + '<div id="list"></div>'
    + '<div id="sheet" role="dialog" aria-modal="true"></div>'
    + '<div id="map" role="dialog" aria-modal="true"><svg id="msvg" xmlns="http://www.w3.org/2000/svg"></svg><div class="mt"><b id="mtt"></b><button id="zin" type="button" aria-label="Zoom in">+</button><button id="zout" type="button" aria-label="Zoom out">&minus;</button></div>'
    + '<div class="mb"><span id="mstat"></span><button id="mcancel" type="button">Cancel</button><button id="msave" class="p" type="button">Save</button></div></div>'
    + '<div id="toast"></div>'
    + '<script type="application/json" id="cdata">' + jsonInScript(data) + '</script>'
    + '<script>' + CHECK_JS + '</script></body></html>';
}

// The page script: a plain string (no template holes), node --check-able on its own.
export const CHECK_JS = String.raw`(function(){
"use strict";
var K="";
try{var u0=new URL(location.href);K=u0.searchParams.get("key")||"";if(u0.searchParams.has("key")){u0.searchParams.delete("key");history.replaceState(null,"",u0.pathname+(u0.search||"")+u0.hash)}}catch(e){}
var D=JSON.parse(document.getElementById("cdata").textContent);
var FIELDS={private_pool:[["all","Yes, all"],["some","Some"],["none","None"],["","Not sure"]],home_type:[["villa_detached","Villa detached"],["semi_detached","Semi-detached"],["townhouse_row","Townhouse row"],["apartments","Apartments"],["","Not sure"]],gym:[["yes","Yes"],["no","No"],["","Not sure"]],furnished:[["often","Often"],["sometimes","Sometimes"],["rarely","Rarely"],["","Not sure"]]};
var QS={private_pool:"Private pool",home_type:"Home type",gym:"Gym in the cluster",furnished:"Furnished homes available"};
function $(i){return document.getElementById(i)}
function h(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function toast(t){var e=$("toast");e.textContent=t;e.style.display="block";clearTimeout(toast.t);toast.t=setTimeout(function(){e.style.display="none"},2600)}
function api(path,body,ct){var hd={"X-Owner-Key":K};if(ct)hd["Content-Type"]=ct;return fetch(path,{method:body==null?"GET":"POST",headers:hd,body:body==null?undefined:body,credentials:"same-origin",cache:"no-store"}).then(function(r){return r.json().catch(function(){return {ok:false,reason:"HTTP "+r.status}}).then(function(j){if(!r.ok&&j.ok!==false)j.ok=false;if(!j.reason&&!r.ok)j.reason="HTTP "+r.status;return j})})}
function chip(cls,t){return '<span class="c '+cls+'">'+h(t)+'</span>'}
function chips(r){var o="";
  o+=r.mapped.n?chip(r.mapped.warn?"no":"ok","mapped "+r.mapped.n+(r.mapped.warn?" ⚠":"")):chip("bad","not mapped");
  var pk=r.picture.kind;o+=chip(pk==="own_photo"||pk==="photo"||pk==="street_view"?"ok":pk==="blocks"?"no":"bad",{own_photo:"own photo",photo:"photo",street_view:"Street View",blocks:"render only",district:"district map",none:"no picture"}[pk]||pk);
  var a=r.amen.filter(function(x){return x.ok}).length;o+=chip(a===r.amen.length?"ok":"no","amenities "+a+"/"+r.amen.length);
  o+=r.render===true?chip("ok","render"):r.render===false?chip("no","no render"):chip("unk","render ?");
  return o}
function list(){var o="";D.rows.forEach(function(r,i){o+='<button type="button" class="row '+(r.complete?"done":"todo")+'" data-i="'+i+'"><div class="rn"><span>'+(r.complete?"✓ ":"")+h(r.name)+'</span><small>'+h(r.sources.join(" · "))+'</small></div><div class="chips">'+chips(r)+'</div>'+(r.missing.length?'<div class="miss">To do: '+h(r.missing.join("; "))+'</div>':"")+'</button>'});
  $("list").innerHTML=o;$("pn").textContent=D.done+" of "+D.total;$("pb").style.width=(D.total?Math.round(100*D.done/D.total):0)+"%";
  Array.prototype.forEach.call(document.querySelectorAll(".row"),function(b){b.onclick=function(){open(+b.getAttribute("data-i"))}})}
var CUR=-1,FORM={};
function open(i){CUR=i;var r=D.rows[i];FORM={};var bf=r.broker||{};Object.keys(FIELDS).forEach(function(k){FORM[k]=bf[k]||""});FORM.notes=bf.notes||"";sheet();$("sheet").classList.add("on");$("sheet").scrollTop=0}
function sheet(){var r=D.rows[CUR];var o='<div class="sh"><h2>'+h(r.name)+'</h2><button class="x" type="button" id="sx" aria-label="Close">×</button></div>';
  o+='<div class="box"><div class="chips">'+chips(r)+'</div>'+(r.missing.length?'<div class="miss">To do: '+h(r.missing.join("; "))+'</div>':'<div class="miss">Complete.</div>')+'</div>';
  o+='<div class="box"><h3>MAPPED</h3><div class="am">'+(r.how==="building"?"Placed by its own building footprint ("+r.mapped.n+").":r.mapped.n+" homes attributed.")+'</div>'+(r.mapped.warn?'<div class="am" style="color:#E8C27A">⚠ '+h(r.mapped.warn)+'</div>':"")+(r.mapped.override?'<div class="am"><span>Owner corrections: +'+r.mapped.override.add+' / −'+r.mapped.override.remove+(r.mapped.override.at?" ("+h(String(r.mapped.override.at).slice(0,10))+")":"")+'</span></div>':"")+(r.how==="community"?'<button class="go" type="button" id="omap">Open the map and fix the homes</button>':"")+'</div>';
  o+='<div class="box"><h3>PICTURE A REPORT WOULD SHOW</h3><div class="am"><b>'+h(r.picture.label)+'</b></div><div class="ph">'+r.photos.map(function(p){return '<img src="'+h(p.url)+'" alt="Own photo">'}).join("")+'</div>'+(r.photos.length?'<div class="cred">Photo: Najjuko · the newest is the card picture</div>':"")+'<label class="go soft" style="display:flex;align-items:center;justify-content:center">Add a photo (camera or library)<input id="pf" type="file" accept="image/*" hidden></label></div>';
  o+='<div class="box"><h3>AMENITIES</h3>'+r.amen.map(function(a){return '<div class="am"><b>'+h(a.label)+': '+(a.ok?(a.v===true?"yes":a.v===false?"no":h(a.v)):"not known")+'</b> <span>'+h(a.src||"")+'</span></div>'}).join("")+'</div>';
  o+='<div class="box"><h3>FACTS FROM THE BROKER</h3>'+(r.broker?'<div class="am"><span>Saved: '+h(r.broker.by)+', '+h(r.broker.say)+'</span></div>':"");
  Object.keys(FIELDS).forEach(function(k){o+='<div class="q"><p>'+QS[k]+'</p><div class="seg">'+FIELDS[k].map(function(v){return '<button type="button" data-f="'+k+'" data-v="'+v[0]+'" class="'+(FORM[k]===v[0]?"on":"")+'">'+h(v[1])+'</button>'}).join("")+'</div></div>'});
  o+='<div class="q"><p>Notes</p><input class="in" id="fnotes" maxlength="300" value="'+h(FORM.notes)+'"></div><div class="miss">Saved as Najjuko (RERA licensed broker), checked on site today. Not sure saves nothing.</div><button class="go" type="button" id="fsave">Save the facts</button></div>';
  $("sheet").innerHTML=o;
  $("sx").onclick=function(){$("sheet").classList.remove("on");list()};
  if($("omap"))$("omap").onclick=mapOpen;
  Array.prototype.forEach.call(document.querySelectorAll("[data-f]"),function(b){b.onclick=function(){FORM[b.getAttribute("data-f")]=b.getAttribute("data-v");FORM.notes=$("fnotes").value;sheet()}});
  $("fsave").onclick=saveFacts;$("pf").onchange=function(ev){var f=ev.target.files&&ev.target.files[0];if(f)upload(f)}}
function took(j){if(!j.ok){toast("Not saved: "+(j.reason||"error"));return false}if(j.row)D.rows[CUR]=j.row;if(j.total!=null){D.done=j.done;D.total=j.total}list();sheet();return true}
function saveFacts(){FORM.notes=$("fnotes").value;var f={};Object.keys(FORM).forEach(function(k){if(FORM[k])f[k]=FORM[k]});
  api("/checklist/save",JSON.stringify({d:D.d,kind:"facts",cluster:D.rows[CUR].name,facts:f}),"application/json").then(function(j){if(took(j))toast("Facts saved")})}
function resize(file){return new Promise(function(res,rej){var img=new Image(),u=URL.createObjectURL(file);img.onload=function(){var s=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement("canvas");c.width=Math.max(1,Math.round(img.naturalWidth*s));c.height=Math.max(1,Math.round(img.naturalHeight*s));c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);
  var q=0.85;(function go(){c.toBlob(function(b){if(!b)return rej(new Error("could not make a JPEG"));if(b.size>5*1024*1024&&q>0.4){q-=0.15;return go()}res(b)},"image/jpeg",q)})()};img.onerror=function(){rej(new Error("this phone could not read that picture"))};img.src=u})}
function upload(f){toast("Uploading…");resize(f).then(function(b){return api("/checklist/photo?d="+encodeURIComponent(D.d)+"&c="+encodeURIComponent(D.rows[CUR].name),b,"image/jpeg")}).then(function(j){if(took(j))toast("Photo saved")},function(e){toast(e.message)})}
// ---- the map: tap footprints to add or remove them, then Save
var LAYER=null,SEL={},OWNER={},VB=null;
function mapOpen(){var r=D.rows[CUR];SEL={};r.mapped.ids.forEach(function(i){SEL[i]=1});OWNER={};D.rows.forEach(function(x,k){if(k!==CUR&&x.how==="community")x.mapped.ids.forEach(function(i){OWNER[i]=1})});
  $("mtt").textContent=r.name;$("map").classList.add("on");if(LAYER)draw();else{$("mstat").textContent="Loading the map…";api("/checklist/layer?d="+encodeURIComponent(D.d)).then(function(j){if(!j.ok){$("mstat").textContent="No map: "+(j.reason||"");return}LAYER=j;draw()})}}
function pts(f){var o=[];for(var k=0;k+1<f.length;k+=2)o.push(f[k]+","+(-f[k+1]));return o.join(" ")}
function draw(){var s="",bx=[1e9,1e9,-1e9,-1e9],ax=[1e9,1e9,-1e9,-1e9];
  (LAYER.rp||[]).forEach(function(f){s+='<polyline class="rd" points="'+pts(f)+'"/>'});
  LAYER.b.forEach(function(b){var f=b[2];for(var k=0;k+1<f.length;k+=2){var x=f[k],y=-f[k+1];ax=[Math.min(ax[0],x),Math.min(ax[1],y),Math.max(ax[2],x),Math.max(ax[3],y)];if(SEL[b[0]])bx=[Math.min(bx[0],x),Math.min(bx[1],y),Math.max(bx[2],x),Math.max(bx[3],y)]}
    s+='<polygon data-i="'+b[0]+'" class="fp'+(SEL[b[0]]?" sel":OWNER[b[0]]?" oth":"")+'" points="'+pts(f)+'"/>'});
  var b=bx[0]<1e9?bx:ax,p=Math.max(80,(b[2]-b[0])*0.25,(b[3]-b[1])*0.25);VB=[b[0]-p,b[1]-p,b[2]-b[0]+2*p,b[3]-b[1]+2*p];
  $("msvg").innerHTML=s;view();stat()}
function view(){$("msvg").setAttribute("viewBox",VB.join(" "))}
function stat(){var n=Object.keys(SEL).length,was=D.rows[CUR].mapped.n;$("mstat").textContent=n+" homes in gold (was "+was+"). Tap to add or remove; blue = another community's."}
function zoom(f,cx,cy){if(!VB)return;if(cx==null){cx=VB[0]+VB[2]/2;cy=VB[1]+VB[3]/2}VB=[cx-(cx-VB[0])*f,cy-(cy-VB[1])*f,VB[2]*f,VB[3]*f];view()}
$("zin").onclick=function(){zoom(0.7)};$("zout").onclick=function(){zoom(1/0.7)};
$("mcancel").onclick=function(){$("map").classList.remove("on")};
$("msave").onclick=function(){var ids=Object.keys(SEL).map(Number);$("mstat").textContent="Saving…";
  api("/checklist/save",JSON.stringify({d:D.d,kind:"map",cluster:D.rows[CUR].name,ids:ids}),"application/json").then(function(j){if(took(j)){$("map").classList.remove("on");toast("Map saved")}else stat()})};
(function(){var sv=$("msvg"),P={},down=null,pinch=null;
  function sc(){var r=sv.getBoundingClientRect();return Math.max(VB[2]/r.width,VB[3]/r.height)}
  sv.addEventListener("pointerdown",function(e){sv.setPointerCapture(e.pointerId);P[e.pointerId]=[e.clientX,e.clientY];var ks=Object.keys(P);if(ks.length===1)down={x:e.clientX,y:e.clientY,vb:VB.slice(),moved:false,t:e.target};else if(ks.length===2){var a=P[ks[0]],b=P[ks[1]];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),vb:VB.slice()};down=null}});
  sv.addEventListener("pointermove",function(e){if(!P[e.pointerId]||!VB)return;P[e.pointerId]=[e.clientX,e.clientY];var ks=Object.keys(P);
    if(pinch&&ks.length===2){var a=P[ks[0]],b=P[ks[1]],dd=Math.hypot(a[0]-b[0],a[1]-b[1]);if(dd>10){var f=pinch.d/dd,v=pinch.vb,cx=v[0]+v[2]/2,cy=v[1]+v[3]/2;VB=[cx-v[2]*f/2,cy-v[3]*f/2,v[2]*f,v[3]*f];view()}return}
    if(down){var dx=e.clientX-down.x,dy=e.clientY-down.y;if(Math.abs(dx)+Math.abs(dy)>8)down.moved=true;if(down.moved){var s=sc();VB=[down.vb[0]-dx*s,down.vb[1]-dy*s,down.vb[2],down.vb[3]];view()}}});
  function up(e){var t=down&&!down.moved?down.t:null;delete P[e.pointerId];if(Object.keys(P).length<2)pinch=null;down=null;
    if(t&&t.getAttribute&&t.getAttribute("data-i")!=null){var i=+t.getAttribute("data-i");if(SEL[i]){delete SEL[i];t.setAttribute("class","fp"+(OWNER[i]?" oth":""))}else{SEL[i]=1;t.setAttribute("class","fp sel")}stat()}}
  sv.addEventListener("pointerup",up);sv.addEventListener("pointercancel",function(e){delete P[e.pointerId];pinch=null;down=null});
  sv.addEventListener("wheel",function(e){e.preventDefault();var r=sv.getBoundingClientRect(),s=sc();zoom(e.deltaY>0?1.15:1/1.15,VB[0]+(e.clientX-r.left)*s,VB[1]+(e.clientY-r.top)*s)},{passive:false})})();
list();
})();`;
