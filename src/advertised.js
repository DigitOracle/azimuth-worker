// v444 ADVERTISED NOW (Property Finder) - Kendall, 9 Oct 2026. A SECOND availability signal per building, shown beside
// "Available (developer)" (the developer's own sheet) and NEVER added to it. Owner key only, like every advert figure.
//
// Source: the `advertised` block naj-market-pulse scripts/pf_advert_engine.py adds to img_pf_supply_<district> each night:
//   {v, label, note, as_of, buildings: {pf_slug: {key, flats, adverts, crawls, bands: {band: {flats, adverts, pmin, pmax,
//    med_days, new_wk, gone_wk}}, pos?}}}
// An advert gone from two crawls running is off the list ("gone": withdrawn or let - never claimed let). Same bedrooms, size
// within 2 % and price within 3 % = one flat with several adverts. An OLDER file has no block: the card then shows the advert
// counts it has (rows) and says flats are not counted yet - it still renders.

export const ADV_LABEL = "Advertised now (Property Finder)";
export const ADV_NOTE = "Adverts are not vacancy: one flat can carry several brokers’ adverts, and an advert can outlive its letting.";
const BANDS = ["studio", "1", "2", "3+"];
const BAND_SAY = { studio: "Studio", "1": "1 bedroom", "2": "2 bedrooms", "3+": "3+ bedrooms", unknown: "Bedrooms not stated" };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (x) => (typeof x === "number" && isFinite(x) ? x : null);
const fmt = (n) => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));
const kAed = (n) => (n == null ? "" : n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(Math.round(n)));

const svg = (d) => '<svg viewBox="0 0 24 24" width=14 height=14 fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true>' + d + "</svg>";
export const IC_ADV = svg('<path d="M4 10v4l11 5V5z"/><path d="M15 9a3 3 0 0 1 0 6"/><path d="M7 14l1.5 5h3"/>');
const IC_HOME = svg('<path d="M4 11l8-6 8 6v8H4z"/><path d="M10 19v-5h4v5"/>');
const IC_TAG = svg('<path d="M3 12l9-9h8v8l-9 9z"/><circle cx="16" cy="8" r="1.5"/>');
const IC_CLOCK = svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>');
const IC_UP = svg('<path d="M12 19V5M6 11l6-6 6 6"/>');
const IC_DOWN = svg('<path d="M12 5v14M6 13l6 6 6-6"/>');
export const IC_PERMIT = svg('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>');

// the advert's own DLD permit-check page: https on a dubailand.gov.ae host, else nothing (never constructed)
export function permitLink(u) {
  if (typeof u !== "string" || u.length > 600) return "";
  let p; try { p = new URL(u); } catch (e) { return ""; }
  const h = p.hostname.toLowerCase();
  return p.protocol === "https:" && (h === "dubailand.gov.ae" || h.endsWith(".dubailand.gov.ae")) ? p.href : "";
}

function band(x) {
  if (!x || typeof x !== "object") return null;
  return { flats: num(x.flats), adverts: num(x.adverts) || 0, pmin: num(x.pmin), pmax: num(x.pmax), days: num(x.med_days), newWk: num(x.new_wk) || 0, goneWk: num(x.gone_wk) || 0 };
}
// doc.advertised -> {asOf, buildings: {slug: {key, bands}}} or null (an older file)
export function advertisedDoc(doc) {
  const a = doc && doc.advertised;
  if (!a || typeof a !== "object" || !a.buildings || typeof a.buildings !== "object") return null;
  const buildings = {};
  for (const slug of Object.keys(a.buildings)) {
    const b = a.buildings[slug]; if (!b || typeof b !== "object") continue;
    const bands = {};
    for (const k of Object.keys(b.bands || {})) { const x = band(b.bands[k]); if (x) bands[k] = x; }
    buildings[slug] = { key: typeof b.key === "string" ? b.key : null, bands };
  }
  return { asOf: typeof a.as_of === "string" ? a.as_of : "", buildings };
}
// one building's figure across its site slugs (a building can group several). Falls back to the old rows' advert counts.
export function advertisedFor(A, slugs, oldBands) {
  const out = { asOf: A ? A.asOf : "", bands: {}, counted: !!A };
  if (A) for (const s of slugs || []) {
    const b = A.buildings[s]; if (!b) continue;
    for (const k in b.bands) {
      const x = b.bands[k], o = out.bands[k] || (out.bands[k] = { flats: 0, adverts: 0, pmin: null, pmax: null, days: null, newWk: 0, goneWk: 0 });
      o.flats += x.flats || 0; o.adverts += x.adverts; o.newWk += x.newWk; o.goneWk += x.goneWk;
      if (x.pmin != null) o.pmin = o.pmin == null ? x.pmin : Math.min(o.pmin, x.pmin);
      if (x.pmax != null) o.pmax = o.pmax == null ? x.pmax : Math.max(o.pmax, x.pmax);
      if (x.days != null) o.days = o.days == null ? x.days : Math.round((o.days + x.days) / 2);
    }
  }
  if (!Object.keys(out.bands).length && oldBands) {             // an older file: advert counts only, flats not counted
    out.counted = false;
    for (const k in oldBands) { const x = oldBands[k]; if (x && x.live) out.bands[k] = { flats: null, adverts: x.live, pmin: null, pmax: null, days: x.days != null ? Math.round(x.days) : null, newWk: 0, goneWk: 0 }; }
  }
  out.adverts = Object.values(out.bands).reduce((s, x) => s + x.adverts, 0);
  out.flats = out.counted ? Object.values(out.bands).reduce((s, x) => s + (x.flats || 0), 0) : null;
  out.goneWk = Object.values(out.bands).reduce((s, x) => s + x.goneWk, 0);
  return out.adverts || out.goneWk ? out : null;
}
// in the Brief: the row's building key '<district>:<id>' -> every slug bound to it
export function advertisedForKey(A, key) {
  if (!A || !key) return null;
  return advertisedFor(A, Object.keys(A.buildings).filter((s) => A.buildings[s].key === key), null);
}

const pl = (n, one, many) => fmt(n) + " " + (n === 1 ? one : many);
function bandCard(k, x, counted) {
  const price = x.pmin == null ? "" : x.pmin === x.pmax ? "AED " + kAed(x.pmin) : "AED " + kAed(x.pmin) + "–" + kAed(x.pmax);
  return '<div class=avc><div class=avk>' + IC_HOME + esc(BAND_SAY[k] || k) + "</div>"
    + '<div class=avn><b>' + (counted ? fmt(x.flats) : "—") + "</b><small>" + (counted ? (x.flats === 1 ? "flat" : "flats") : "flats not counted yet") + " · " + pl(x.adverts, "advert", "adverts") + "</small></div>"
    + (price ? '<div class=avf>' + IC_TAG + esc(price) + "<small> a year</small></div>" : "")
    + (x.days != null ? '<div class=avf>' + IC_CLOCK + fmt(x.days) + " days listed (median)</div>" : "")
    + (counted ? '<div class=avf>' + IC_UP + fmt(x.newWk) + " new · " + IC_DOWN + fmt(x.goneWk) + " gone this week</div>" : "") + "</div>";
}
// a closed-by-default accordion; cards (2 up, 1 up under 360 px), never a plain list
export function advertisedHtml(a) {
  if (!a) return "";
  const ks = BANDS.filter((k) => a.bands[k]).concat(Object.keys(a.bands).filter((k) => !BANDS.includes(k)));
  const head = a.counted ? pl(a.flats, "flat", "flats") + " · " + pl(a.adverts, "advert", "adverts") : pl(a.adverts, "advert", "adverts");
  return '<details class=avd><summary>' + IC_ADV + "<span>" + esc(ADV_LABEL) + "</span><b>" + esc(head) + "</b></summary>"
    + '<div class=avg>' + ks.map((k) => bandCard(k, a.bands[k], a.counted)).join("") + "</div>"
    + '<div class=avt>' + esc(ADV_NOTE) + " Shown beside the developer’s availability, never added to it." + (a.counted ? " An advert missing from two crawls running counts as gone (withdrawn or let)." : "")
    + (a.asOf ? " As of " + esc(a.asOf) + "." : "") + "</div></details>";
}
export const ADV_CSS = ".avd{margin-top:8px;border:1px solid #24352F;border-radius:12px;background:#0E1918}"
  + ".avd>summary{display:flex;align-items:center;gap:7px;padding:9px 11px;cursor:pointer;list-style:none;font-size:13px;color:#E9E3D6}"
  + ".avd>summary::-webkit-details-marker{display:none}.avd>summary b{margin-left:auto;color:#C5A56A;font-weight:600;white-space:nowrap}"
  + ".avd>summary svg,.avc svg{flex:none;color:#C5A56A}"
  + ".avg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:0 10px 8px}@media(max-width:360px){.avg{grid-template-columns:1fr}}"
  + ".avc{border:1px solid #24352F;border-radius:10px;padding:8px;min-width:0}.avk{display:flex;gap:5px;align-items:center;font-size:12px;color:#B9B2A3}"
  + ".avn b{font-size:20px;color:#E9E3D6;margin-right:4px}.avn small{font-size:11px;color:#8FA39B}"
  + ".avf{display:flex;gap:4px;align-items:center;flex-wrap:wrap;font-size:11.5px;color:#B9B2A3;margin-top:3px}.avf svg{width:12px;height:12px}"
  + ".avt{font-size:11px;color:#8FA39B;padding:0 11px 10px}"
  + ".ck{display:inline-flex;gap:4px;align-items:center;font-size:12px;color:#7FA8C9;margin-top:4px}";
