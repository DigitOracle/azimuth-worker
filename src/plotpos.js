// v386 - PLOT POSITIONS: the server side of the plot-centre marker on the Developers-by-area page (the page logic is src/plotpos_page.js).
// The file (KV img_plot_positions, built offline by scripts/build_plot_positions.py, published by scripts/publish_plot_positions.py) holds, per register project number,
// the centre of the registered plot(s) of a project that has no building outline on our map: {lon, lat, parcels, n_plots, basis, evidence DERIVED, link REGISTER_VERIFIED, label, as_of}.
// The project-to-parcel link is REGISTER_VERIFIED (Land Department land registry); the position is DERIVED (centre of the Dubai Municipality outline, computed by us). It is never a building.
// The route (GET /developers_map_api?what=plotpos) returns the stored value when it has the shape the page needs, otherwise {} - and the page then changes nothing. Nothing here writes KV.
export const PLOTPOS_KV_NAME = "plot_positions";            // read through kvJson(env, "plot_positions") = KV key img_plot_positions

// the shape check: every entry a real position inside Dubai, derived, with its label. A malformed entry is dropped; nothing valid left = absent.
export function cleanPlotPos(d) {
  if (!d || typeof d !== "object" || !d.p || typeof d.p !== "object") return null;
  const p = {};
  for (const k of Object.keys(d.p)) {
    const e = d.p[k];
    if (!e || typeof e !== "object") continue;
    if (!(e.lon >= 54.5 && e.lon <= 56.6 && e.lat >= 24 && e.lat <= 25.6)) continue;
    if (e.evidence !== "DERIVED" || typeof e.label !== "string" || !e.label) continue;
    p[k] = e;
  }
  if (!Object.keys(p).length) return null;
  return { meta: d.meta && typeof d.meta === "object" ? { as_of: d.meta.as_of || null } : {}, p };
}
