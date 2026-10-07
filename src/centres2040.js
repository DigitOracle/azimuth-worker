// v380 - DUBAI 2040 CENTRES: the server side of the Developers-by-area opening (the page logic is src/centres2040_page.js).
// The file (KV img_centres2040, built offline by scripts/build_centres2040.py) holds OUR OWN grouping of Dubai Municipality communities
// into the five centres of the Dubai 2040 Urban Master Plan (the plan names the centres and their roles, it publishes no boundaries),
// the sixth layer (sea coast within 500 m, Najma's addition, never part of the plan) and the registered-home stock per centre.
// The route (GET /developers_map_api?what=centres) returns the stored value when it has the shape the page needs, otherwise {} -
// and the page then falls back to the old opening (price bands). Nothing here writes KV.
export const CENTRES_KV_NAME = "centres2040";            // read through kvJson(env, "centres2040") = KV key img_centres2040
export const CENTRES_SOURCE = "Dubai 2040 Urban Master Plan, UAE Government, 13 Mar 2021";
export const CENTRES_GROUPING = "Our grouping of districts; the plan names the centres, not their boundaries";

// the shape check: five centres, communities, the slug table and drawn polygons. Anything else is treated as absent.
export function cleanCentres(d) {
  if (!d || typeof d !== "object") return null;
  if (!Array.isArray(d.centres) || d.centres.length !== 5) return null;
  if (!Array.isArray(d.comms) || !d.comms.length || !d.sl || typeof d.sl !== "object") return null;
  if (!d.geo || !Array.isArray(d.geo.features) || !d.geo.features.length) return null;
  for (const c of d.centres) { if (!c || !(c.id >= 1 && c.id <= 5) || !c.name || !c.colour || !Array.isArray(c.lab)) return null; }
  return d;
}
