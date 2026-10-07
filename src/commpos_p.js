// v397c - COMMUNITY POSITIONS BY REGISTER PROJECT NUMBER: the server side of the community-centre rung for every registered project, card or no card (page logic: src/commpos_p_page.js).
// The file (KV img_community_positions_p, built offline by scripts/build_community_positions_p.py, published by scripts/publish_community_positions_p.py) is
//   {meta, c: {<community no>: {n, lon, lat, bb, area_km2, evidence DERIVED, basis community_polygon}}, p: {"p:<register project number>": {c, l, m, a}}}
// and covers every project of the completeness universe that has no building outline and no plot centre and whose own area matches exactly one Dubai Municipality community polygon.
// The card file (img_community_positions, v387, keys district|name) is untouched. The point is the representative point of the community polygon, computed by us: DERIVED. It is never the building.
// The route (GET /developers_map_api?what=commposp) returns the stored value when it has the shape the page needs, otherwise {} - and the page then changes nothing (v395). Nothing here writes KV.
export const COMMPOSP_KV_NAME = "community_positions_p";        // read through kvJson(env, "community_positions_p") = KV key img_community_positions_p

const inDubai = (lon, lat) => lon >= 54.5 && lon <= 56.6 && lat >= 24 && lat <= 25.6;

export function cleanCommPosP(d) {
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
    if (!/^p:\d+$/.test(k) || !e || typeof e !== "object" || !c[e.c] || typeof e.l !== "string" || !/^Community centre: /.test(e.l)) continue;
    p[k] = e;
  }
  if (!Object.keys(p).length) return null;
  return { meta: d.meta && typeof d.meta === "object" ? { as_of: d.meta.as_of || null } : {}, c, p };
}
