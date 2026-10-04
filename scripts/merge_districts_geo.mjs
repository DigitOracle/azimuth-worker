// v322 - THE DISTRICT LIST for the Developers map = the districts in KV img_districts_geo PLUS every district that has a Dubai Municipality community polygon (KV img_district_polygons)
// but is not in that list. Why: img_districts_geo is the twin's list of districts with building footprints, and it had no entry for rasalkhor (Sobha One / Ras Al Khor), bukadra
// (Sobha Hartland II) and liwan1, so the index builder, which walks that list, never looked at their unit-mix cards or their register sales although both exist.
// The polygon file already carries each one's slug and name, so the missing fields (bounding box, centre) are worked out from its outline. Nothing is guessed.
//   node scripts/merge_districts_geo.mjs <img_districts_geo json> <img_district_polygons json> <out json>
import fs from "node:fs";
export function mergeDistricts(geo, polygons) {
  const have = new Set((geo.districts || []).map((d) => d.slug)), added = [];
  for (const f of (polygons && polygons.features) || []) {
    const slug = f.properties && f.properties.slug; if (!slug || have.has(slug) || !f.geometry) continue;
    let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
    const walk = (c) => { if (typeof c[0] === "number") { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); } else c.forEach(walk); };
    walk(f.geometry.coordinates);
    if (x1 < x0) continue;
    const r = (v) => Math.round(v * 1e5) / 1e5;
    added.push({ slug, name: f.properties.name || slug, corridor: "", bbox: [r(x0), r(y0), r(x1), r(y1)], centre: [r((x0 + x1) / 2), r((y0 + y1) / 2)], from_polygons: true });
    have.add(slug);
  }
  return { ...geo, districts: (geo.districts || []).concat(added), added: added.map((d) => d.slug) };
}
const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("merge_districts_geo.mjs");
if (isMain) {
  const [g, p, out] = process.argv.slice(2);
  const m = mergeDistricts(JSON.parse(fs.readFileSync(g, "utf8")), JSON.parse(fs.readFileSync(p, "utf8")));
  fs.writeFileSync(out, JSON.stringify(m));
  console.log("districts " + (m.districts.length - m.added.length) + " + " + m.added.length + " from the polygon file (" + m.added.join(", ") + ") = " + m.districts.length);
}
