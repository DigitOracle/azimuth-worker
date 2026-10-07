// v387 - COMMUNITY POSITIONS: the server side of the community-centre marker on the Developers-by-area page (page logic: src/commpos_page.js).
// The file (KV img_community_positions, built offline by scripts/build_community_positions.py, published by scripts/publish_community_positions.py) gives a project card that has neither a
// building outline nor a plot centre the middle of its own community: {c: {<community no>: {n, lon, lat, bb, area_km2, evidence DERIVED, basis community_polygon}}, p: {"<district>|<pkey(name)>": {c, l, m, a, pn?}}}.
// The point is the representative point of a Dubai Municipality community polygon, computed by us: DERIVED. It is never the building and never the project.
// The route (GET /developers_map_api?what=commpos) returns the stored value when it has the shape the page needs, otherwise {} - and the page then changes nothing. Nothing here writes KV.
export const COMMPOS_KV_NAME = "community_positions";        // read through kvJson(env, "community_positions") = KV key img_community_positions

const inDubai = (lon, lat) => lon >= 54.5 && lon <= 56.6 && lat >= 24 && lat <= 25.6;

// the shape check: a community is a real point inside Dubai (derived, community_polygon); a card entry points at a known community and carries its label. A bad entry is dropped; nothing valid = absent.
export function cleanCommPos(d) {
  if (!d || typeof d !== "object" || !d.c || typeof d.c !== "object" || !d.p || typeof d.p !== "object") return null;
  const c = {};
  for (const k of Object.keys(d.c)) {
    const e = d.c[k];
    if (!e || typeof e !== "object" || !(typeof e.lon === "number" && typeof e.lat === "number" && inDubai(e.lon, e.lat))) continue;
    if (e.evidence !== "DERIVED" || e.basis !== "community_polygon") continue;
    c[k] = e;
  }
  const p = {};
  for (const k of Object.keys(d.p)) {
    const e = d.p[k];
    if (!e || typeof e !== "object" || !c[e.c] || typeof e.l !== "string" || !/^Community centre: /.test(e.l)) continue;
    p[k] = e;
  }
  if (!Object.keys(p).length) return null;
  return { meta: d.meta && typeof d.meta === "object" ? { as_of: d.meta.as_of || null } : {}, c, p };
}
