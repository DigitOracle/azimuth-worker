// v734 - the Building Passport neighbourhood from LOCATION, for every plot, built or empty (Kendall, 4 Nov 2026: "we know where the plot is,
// we know the GPS, we know the neighbourhood, we have district DNA, so that all needs to be tied in").
// Data: naj-market-pulse/scripts/plot_passport_neighbourhood.py -> KV pp_nb_<crc32(plot id) % 4096> {plot id: nb} and pp_dna {district: dna}.
// Plot facts (coordinator, 4 Nov): floors (lk_plot_floors, the headline), height (lk_plot_heights, evidence only), project bind (lk_plot_project_bind), zoning (lk_zoning_plot) ride on nb.facts.
// Never invented: anything missing says "Not available yet" and names the source it would come from.
import { ppCrc32 } from "./plot_passport.js";

const int = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const nbDate = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || "")); return m ? +m[3] + " " + MON[+m[2] - 1] + " " + m[1] : ""; };
const KIND = { mall: "mall", school: "school", clinic: "clinic", hospital: "hospital", park: "park", supermarket: "supermarket", beach: "beach", pharmacy: "pharmacy" };
const PROFILE = { default: "overall", family: "families", active: "active lifestyle", metro_commuter: "metro commuters", dog_owner: "dog owners", retiree: "retirees" };
const DIM = { everyday: "everyday shops", mobility: "getting around", outdoors: "outdoors", fitness: "fitness", family: "family and schools", health: "health", food_social: "food and social", maturity: "how established", value: "value" };

async function readJson(env, k) { try { const v = await env.MEETINGS.get(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }

// the neighbourhood record for one plot, plus its district DNA; nulls when not stored yet
export async function nbGet(env, id) {
  if (!id) return { nb: null, dna: null };
  const b = await readJson(env, "pp_nb_" + (ppCrc32(id) % 4096));
  const nb = b && b[id] ? b[id] : null;
  const all = nb && nb.district ? await readJson(env, "pp_dna") : null;
  return { nb, dna: all && nb && all[nb.district] ? all[nb.district] : null };
}

// the pack the passport reads, with the neighbourhood attached; zoning floor-area ratio feeds the developer view (preliminary unless class A)
export function withNb(pack, got) {
  const p = Object.assign({}, pack || {});
  if (got && got.nb) p.nb = got.nb;
  if (got && got.dna) p.dna = got.dna;
  const z = got && got.nb && got.nb.facts && got.nb.facts.zone;
  if (z && z.far != null && !p.zoning) p.zoning = { far: Number(z.far), source: "Dubai Municipality zoning" + (z.far_method ? " (" + z.far_method + ")" : "") + "; DM gives no effective date", date: z.retrieved_at ? String(z.retrieved_at).slice(0, 10) : null, verified: z.evidence_class === "A" };
  return p;
}

// section 10 (neighbourhood) and the Google box when no Google place is matched: lines for DATA, plus the missing items
export function neighbourhoodLines(pack, opts) {
  const L = [], missing = [], nb = (pack || {}).nb, built = !!(opts && opts.built), haveGoogle = !!(opts && opts.google);
  if (!nb || !nb.pt) {
    L.push("Neighbourhood (section 10): Not available yet. No map position is held for this plot (sources tried: parcel outlines, the 2017 parcel map, Dubai Municipality addresses, the DLD area centre).");
    missing.push("plot map position (parcel outline or address point)", "nearest metro station", "nearest mall, school and clinic", "drive times");
    if (!haveGoogle) L.push("Google box ('Live from Google' chip): no Google place is matched to this building yet" + (built ? "" : " (the plot is not built, so it has no reviews of its own)") + ", and nearby places are Not available yet (no map position for this plot); say so, show no rating.");
    return { lines: L, missing };
  }
  const area = /^area centre/.test(nb.pt.basis || "");
  const from = area ? "from the area centre" : "from the plot";
  L.push("Neighbourhood (section 10, chip 'Calculated', from location, not from the tenancy register): position " + nb.pt.lat + ", " + nb.pt.lon + " (" + nb.pt.basis + "). All distances below are straight lines on the map " + from + ", NOT drive times.");
  if (nb.metro) L.push("Nearest metro station (straight line, not a drive time): " + nb.metro.n + (nb.metro.l ? " (" + nb.metro.l + ")" : "") + " about " + nb.metro.km + " km " + from + " (" + (nb.metro.src || "RTA metro station list") + (nb.metro.as_of ? ", as of " + nbDate(nb.metro.as_of) : "") + "). Tram stops: not in the station list we hold.");
  else missing.push("nearest metro station (RTA station list)");
  const nr = nb.near || {}, ks = Object.keys(KIND).filter((k) => nr[k]);
  if (ks.length) L.push("Nearest places of each kind (straight line " + from + "; Google Maps places matched to our amenity lists; rating and review count as retrieved): "
    + ks.map((k) => KIND[k] + " " + nr[k].n + " " + nr[k].km + " km" + (nr[k].r != null ? ", rated " + nr[k].r + " from " + int(nr[k].c) + " reviews" : "") + (nr[k].d ? ", retrieved " + nbDate(nr[k].d) : "")).join("; ") + ". Use the mall as 'nearest mall' and the nearest of these as the landmark.");
  else missing.push("nearest mall, school and clinic (none within 10 km in our Google amenity lists)");
  for (const k of ["mall", "school", "clinic"]) if (ks.length && !nr[k]) missing.push("nearest " + k + " (none within 10 km in our Google amenity lists)");
  if (nb.drive && nb.drive.d && Object.keys(nb.drive.d).length) {
    const d = nb.drive.d;
    L.push("Drive times (Google Routes, measured from " + nb.drive.from + ", our nearest measured community point, about " + nb.drive.km + " km " + from + "; " + (nb.drive.when ? "weekday peak " + nb.drive.when + " / free-flowing" : "peak / free-flowing") + (nb.drive.as_of ? ", as of " + nbDate(nb.drive.as_of) : "") + "): "
      + Object.keys(d).map((k) => k + " " + d[k][0] + " min (" + d[k][1] + " free-flowing)").join(", ") + ".");
  } else missing.push("drive times (no measured community point within 2 km)");
  // v740: our own amenity list (DHA, KHDA, OSM, RTA, DEWA), nearest of each kind within 5 km, labelled by distance band
  const own = nb.own || {}, ok = Object.keys(own);
  if (ok.length) L.push("Amenities from our own lists (DHA clinics and pharmacies, KHDA schools, OpenStreetMap parks, beaches, malls and supermarkets, DEWA charging; positions approximate; straight line " + from + "): "
    + ok.map((k) => k + " " + own[k].n + " " + own[k].km + " km (within " + own[k].band + " km, source " + own[k].src + ")").join("; ") + ".");
  // Google: NEARBY places, never reviews of the plot (an empty plot has no reviews of its own)
  const top = nb.top || [], tb = nb.tb || 1;
  if (!haveGoogle) {
    if (top.length) L.push("Google box, titled 'Nearby places' ('Live from Google' chip; these are places within about " + tb + " km " + from + ", NOT reviews of this " + (built ? "building" : "plot") + "): "
      + top.map((t) => t.n + " (" + t.t + "), rated " + t.r + " from " + int(t.c) + " reviews, " + t.m + " m, retrieved " + nbDate(t.d)).join("; ") + ". Print also: \"Google shows at most 5 reviews per place; this is not every review\".");
    else L.push("Google box ('Live from Google' chip): " + "no Google place is matched to this building yet" + (built ? "" : " (the plot is not built, so it has no reviews of its own)") + ", and " + (nb.swept ? "no well-reviewed place (20+ reviews) lies within 5 km in our Google data" : "our Google place data does not cover this area yet") + "; say so, show no rating.");
  } else if (top.length) L.push("Nearby places (Google, within about " + tb + " km " + from + ", not reviews of this building): " + top.slice(0, 3).map((t) => t.n + " rated " + t.r + " from " + int(t.c) + " reviews, " + t.m + " m").join("; ") + ", retrieved " + nbDate(top[0].d) + ".");
  return { lines: L, missing };
}

// page 3: a compact district profile, labelled district level
export function dnaLines(pack) {
  const d = (pack || {}).dna, nb = (pack || {}).nb, L = [], missing = [];
  if (!d) { missing.push("district profile (district DNA) for " + ((nb && nb.district) || "this plot's district") + ": not covered by our district studies yet"); return { lines: L, missing }; }
  const nm = d.name || (nb && nb.district) || "the district";
  const parts = [];
  // v747: d.live.v is the index VERSION (lk_livability_scores.index_version, e.g. "0.3"), never a score. The scores are the profiles, 0 to 100 rank among the districts studied.
  if (d.live && d.live.p) { const ks = Object.keys(PROFILE).filter((k) => d.live.p[k] != null && isFinite(+d.live.p[k]));
    if (ks.length) parts.push("Najma liveability index (scores 0 to 100, a rank among the districts we study, higher is better; index version " + d.live.v + ", as of " + nbDate(d.live.as_of) + "): " + ks.map((k) => PROFILE[k] + " " + d.live.p[k]).join(", ")); }
  if (d.dims && Object.keys(d.dims).length) parts.push("strengths and gaps (0 to 100): " + Object.keys(DIM).filter((k) => d.dims[k] != null).map((k) => DIM[k] + " " + d.dims[k]).join(", "));
  if (d.pop) parts.push("population about " + int(d.pop) + " (Dubai Statistics Center 2025)");
  if (d.green) parts.push("green cover " + d.green.share + "% (" + d.green.src + ", " + nbDate(d.green.d) + ")");
  if (d.cycle && d.cycle.km != null) parts.push("RTA cycle tracks " + d.cycle.km + " km (as of " + nbDate(d.cycle.as_of) + ")");
  L.push("District profile (page 3 card titled 'District DNA: " + nm + "', chip 'Calculated', labelled DISTRICT LEVEL, not this plot): " + (parts.length ? parts.join("; ") + "." : "no index figures held."));
  for (const x of (d.lines || []).slice(0, 5)) L.push("District DNA line (district level; source " + x.src + ", " + nbDate(x.as_of) + "): " + x.s);
  return { lines: L, missing };
}

// v747: floors from the DLD buildings register in the pack (bldgs, else pp.buildings): "25 floors", or per building on a multi-building plot
export function dldFloors(pack) {
  const bd = ((pack || {}).bldgs || []).length ? pack.bldgs : (((pack || {}).pp || {}).buildings || []);
  const w = bd.filter((b) => +b.floors > 0);
  if (!w.length) return "";
  if (w.length === 1 || w.every((b) => +b.floors === +w[0].floors)) return (+w[0].floors) + " floors" + (w.length > 1 ? " (each of " + w.length + " buildings)" : "");
  return w.map((b) => (b.name || "building " + (b.no || "?")) + " " + (+b.floors) + " floors").join("; ");
}

// v826 - building-level sales (nb.facts.bsales, lk_plot_building_sales) and the project figures (nb.facts.bind, lk_plot_project_bind), kept apart.
// plot: this plot's own figure, from sales bound through the building. project: the project's figures; plot_level=false means a project average, never this plot's.
const tc = (s) => String(s || "").toLowerCase().replace(/(^|[\s\-(\/])([a-z])/g, (m, a, c) => a + c.toUpperCase());
export function bsalesView(facts) {
  const f = facts || {}, s = f.bsales, b = f.bind, out = { plot: null, project: null };
  if (s && +s.sales > 0) {
    const n = Math.round(+s.sales), n12 = s.sales_12m != null ? Math.round(+s.sales_12m) : null, nb = Math.round(+s.building_names_n || 0);
    const med = s.median_aed_per_m2 != null && isFinite(+s.median_aed_per_m2) ? +s.median_aed_per_m2 : null;
    const med12 = n12 != null && n12 >= 5 && s.median_aed_per_m2_12m != null && isFinite(+s.median_aed_per_m2_12m) ? +s.median_aed_per_m2_12m : null;   // hidden under 5 sales
    const names = nb > 1 ? (s.names || []).slice(0, 8).map(tc) : [];
    out.plot = { sales: n, sales_12m: n12, median: med, median_12m: med12, last_sale: s.last_sale || null, buildings: nb, names, more: nb > names.length && names.length ? nb - names.length : 0,
      headline: "Sales in buildings on this plot: " + int(n) + (n12 != null ? " (last 12 months: " + int(n12) + ")" : "") + (med != null ? ", median AED " + int(med) + "/m²" : ""),
      buildings_line: nb > 1 ? int(nb) + " buildings on this plot" : "" };
  }
  if (b && (b.project_sales != null || b.project_median_aed_per_m2 != null)) {
    const own = b.plot_level === true;
    out.project = { plot_level: own, sales: b.project_sales != null ? Math.round(+b.project_sales) : null, sales_12m: b.project_sales_12m != null ? Math.round(+b.project_sales_12m) : null,
      median: b.project_median_aed_per_m2 != null ? +b.project_median_aed_per_m2 : null, last_sale: b.last_sale || null, plots: b.plots_in_project != null ? Math.round(+b.plots_in_project) : null,
      label: own ? "Project on this plot" : "Project average",
      note: own ? "The whole project sits on this plot, so these are this plot's sales." : "Across the whole project" + (b.plots_in_project != null ? " (" + int(b.plots_in_project) + " plots)" : "") + ". A project average, not this plot's own figure." };
  }
  return out;
}

// v826 - the two sales cards for the Plot Passport (cream theme cards, icons not emoji). esc is the page's HTML escaper.
export function bsalesCardsHtml(v, esc) {
  const e = esc || ((x) => String(x == null ? "" : x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])));
  if (!v || (!v.plot && !v.project)) return "";
  const tile = (l, val, sub) => '<div class=f><div class=l>' + e(l) + '</div><div class=v>' + e(val) + "</div>" + (sub ? '<div class=l>' + e(sub) + "</div>" : "") + "</div>";
  let h = "";
  if (v.plot) {
    const p = v.plot;
    h += '<div class="bsc own" data-bsales=plot><h3 class=bh>Sales in buildings on this plot<span class=n>this plot</span></h3><div class=grid2>'
      + tile("Sales, all time", int(p.sales), p.last_sale ? "last sale " + nbDate(p.last_sale) : "")
      + tile("Sales, last 12 months", p.sales_12m != null ? int(p.sales_12m) : "Not recorded", "")
      + (p.median != null ? tile("Median, all time", "AED " + int(p.median) + "/m²", "") : "")
      + (p.median_12m != null ? tile("Median, last 12 months", "AED " + int(p.median_12m) + "/m²", "") : p.sales_12m != null ? tile("Median, last 12 months", "Not shown", "fewer than 5 sales") : "")
      + "</div>"
      + (p.buildings > 1 ? '<p class=cnt><b>' + e(p.buildings_line) + "</b></p>" + (p.names.length ? '<div class=bnm>' + p.names.map((n) => "<span>" + e(n) + "</span>").join("") + (p.more ? "<span class=x>and " + int(p.more) + " more</span>" : "") + "</div>" : "") : "")
      + '<p class=note>' + e(p.headline) + ". Land Department sales linked to this plot through their building (unit sizes registered on this plot, or building name, footprint and register name).</p></div>";
  }
  if (v.project) {
    const q = v.project;
    h += '<div class="bsc ' + (q.plot_level ? "own" : "avg") + '" data-bsales=project><h3 class=bh>' + e(q.label) + '<span class=n>' + (q.plot_level ? "this plot" : "not this plot alone") + "</span></h3><div class=grid2>"
      + (q.sales != null ? tile("Sales, all time", int(q.sales), q.last_sale ? "last sale " + nbDate(q.last_sale) : "") : "")
      + (q.sales_12m != null ? tile("Sales, last 12 months", int(q.sales_12m), "") : "")
      + (q.median != null ? tile(q.plot_level ? "Median, all time" : "Project average median", "AED " + int(q.median) + "/m²", "") : "")
      + '</div><p class=note>' + e(q.note) + "</p></div>";
  }
  return h;
}
export const BSALES_CSS = ".bsc{border:1px solid var(--line);border-radius:12px;padding:10px;margin:0 0 12px}.bsc.own{border-left:3px solid var(--gold)}.bsc.avg{border-style:dashed}.bsc .bh{margin-top:0}.bsc .note{margin:8px 0 0}"
  + ".bnm{display:grid;grid-template-columns:1fr 1fr;gap:6px}.bnm span{background:var(--raise);border-radius:9px;padding:6px 8px;font-size:.78rem;overflow-wrap:anywhere}.bnm .x{color:var(--muted)}";

// plot facts: height, project bind, zoning (display rules from the coordinator, 4 Nov 2026)
export function plotFactLines(pack) {
  const f = ((pack || {}).nb || {}).facts || {}, L = [], missing = [], flags = [];
  // v734 (Kendall): an end user reads FLOORS, never a height. Floors are the headline (lk_plot_floors); height is background evidence only.
  const fl = f.fl;
  const est = fl && fl.floors_source === "estimate";
  const estOk = est && /^(high|medium)$/i.test(String(fl.est_confidence || "")) && /^About\b/.test(String(fl.floors_label || "")) && fl.floors_low != null && fl.floors_high != null;
  // v747 (Kendall, Luma Park Views: page 1 "Floors 25", appendix "floor count not loaded yet"): ONE floors answer per passport. Order: DM record /
  // DLD "at least" (lk_plot_floors) > the DLD buildings register floors (the same figure page 1 shows) > an "About" estimate. "Not loaded" only when no source has floors.
  const reg = dldFloors(pack);
  const flUsable = fl && fl.floors_label && (!est || estOk) && !(est && fl.floors_shown === false);
  if (reg && (!fl || !flUsable || est)) L.push("Floors (section 02 headline; print exactly, the same figure everywhere in the passport): " + reg + " (source: DLD buildings register).");
  else if (flUsable) {
    const dld = /DLD/.test(fl.floors_source || "");
    let lab = String(fl.floors_label);
    if (dld && !/at least/i.test(lab)) lab = "At least " + lab.charAt(0).toLowerCase() + lab.slice(1);
    const xs = [];
    if (est) xs.push("estimate, " + fl.est_confidence + " confidence, likely " + fl.floors_low + " to " + fl.floors_high + " levels");
    if (fl.dm_record_text) xs.push("DM record as written: \"" + fl.dm_record_text + "\"");
    for (const k of ["roof_note", "basement_note", "multi_building_note"]) if (fl[k]) xs.push(fl[k]);
    L.push("Floors (section 02 headline; print the label exactly): " + lab + (fl.floors_source ? " (source: " + fl.floors_source + ")" : "") + (xs.length ? ". " + xs.join(". ") : "") + ".");
  } else if (fl && est) L.push("Floors (section 02 headline): Building present - floors not verified.");
  else if (fl && fl.floors_label) L.push("Floors (section 02 headline; print exactly): " + fl.floors_label + ".");
  else missing.push("floors (floor count not loaded yet)");
  const h = f.h;
  if (h && h.src && h.m != null) {
    L.push("Height evidence (background only, put it in section 12 Evidence, never as a headline or beside the floors): tallest building about " + Math.round(h.m) + " m, " + (h.kind || h.src) + " (source " + h.src + "). Not a Dubai Municipality height; never call it one." + (/towers read low/i.test(h.kind || "") ? " Note: towers read low on this source, check." : ""));
  }
  // v826 (audit fix 4, label half): sales linked to THIS plot through its buildings, printed apart from any project average
  const bv = bsalesView(f);
  if (bv.plot) {
    const p = bv.plot;
    L.push("Sales in buildings on this plot (Land Department sales linked to this plot through their building; this plot's own figure): " + p.headline
      + (p.median_12m != null ? ". Last 12 months median AED " + int(p.median_12m) + "/m²" : p.sales_12m < 5 ? ". No 12-month median: fewer than 5 sales in the last 12 months" : "")
      + (p.last_sale ? ". Last sale " + nbDate(p.last_sale) : "") + (p.buildings_line ? ". " + p.buildings_line + (p.names.length ? " (" + p.names.join(", ") + (p.more ? ", and " + p.more + " more" : "") + ")" : "") : "") + ".");
  }
  const b = f.bind;
  if (b) {
    const lvl = b.plot_level === true ? "plot level" : "project average, project-level (one of " + (b.plots_in_project != null ? int(b.plots_in_project) : "several") + " plots)" + (bv.plot ? "; print it SEPARATELY from 'Sales in buildings on this plot', labelled 'project average'" : "");
    const xs = [];
    if (b.project_sales != null) xs.push(int(b.project_sales) + " sales all time" + (b.project_sales_12m != null ? ", " + int(b.project_sales_12m) + " in the last 12 months" : ""));
    if (b.project_median_aed_per_m2 != null) xs.push("median AED " + int(b.project_median_aed_per_m2) + " per m2");
    if (b.last_sale) xs.push("last sale " + nbDate(b.last_sale));
    if (b.project_ejari != null) xs.push(int(b.project_ejari) + " tenancies all time" + (b.project_ejari_12m != null ? ", " + int(b.project_ejari_12m) + " in the last 12 months" : ""));
    if (xs.length) L.push("Project activity bound to this plot (" + lvl + "; never shown as this plot's own figures unless plot level): " + xs.join(", ") + ".");
    if (b.zoning_authority) L.push("Planning authority for this plot: " + b.zoning_authority + ".");
  }
  const z = f.zone;
  if (z) {
    const xs = [];
    if (z.evidence_class) xs.push("evidence class " + z.evidence_class + (z.class_reason ? " (" + z.class_reason + ")" : ""));
    if (z.height_text_en) xs.push("height rule as written: \"" + z.height_text_en + "\"" + (z.storeys != null && z.storeys_status === "parsed: plain G+N" ? " (" + z.storeys + " storeys)" : ""));
    if (z.far != null) xs.push("floor area ratio " + z.far + (z.far_method ? " (" + z.far_method + ")" : "") + (z.evidence_class === "A" ? "" : ", preliminary"));
    if (z.setback_text) xs.push("setbacks: " + z.setback_text);
    if (z.parking_text) xs.push("parking: " + z.parking_text);
    L.push("Zoning (section 08, Dubai Municipality, retrieved " + (nbDate(z.retrieved_at) || "date not recorded") + "; DM gives no effective date): " + (xs.length ? xs.join("; ") : "no rule text held") + ".");
    if (z.conflicts || z.failures) flags.push("Zoning record needs a review (" + [z.conflicts, z.failures].filter(Boolean).join("; ").slice(0, 160) + "): a review flag, not a finding.");
  } else missing.push("zoning rules: Not verified");
  return { lines: L, missing, flags };
}
