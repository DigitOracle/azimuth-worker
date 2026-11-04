// v748 - page 1 of every Building Passport is a one-page DASHBOARD (Kendall, 4 Nov 2026: "the whole answer at a glance, more visuals
// than text, readable on a phone"). Drawn here in the worker from the same plot record and pack the facts came from, like the 03A
// timeline, never by the writer: the writer leaves an empty fixed-height <div class="bpp-dash"> and placeDash fills it.
// Every figure is a register / pack figure or comes from the finance engine (gross yield); nothing is invented, a missing figure
// says "Not available yet".
import { brokerView } from "./passport_finance.js";
import { val, SQM_TO_SQFT } from "./finance/index.js";

export const DASH_H_MM = 186;   // the fixed height the writer reserves on page 1 under the title + photo band
const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const int = (n) => Math.round(n).toLocaleString("en-US");
const aedS = (n) => (n >= 1e6 ? "AED " + (Math.round(n / 1e4) / 100).toFixed(2) + "M" : "AED " + int(Math.round(n / 1000)) + "K");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dS = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? +m[3] + " " + MON[+m[2] - 1] + " " + m[1] : ""; };
const pct = (x) => (x == null || !Number.isFinite(x) ? null : (Math.round(x * 1000) / 10).toFixed(1) + "%");
const T = "#0A4F4A", G = "#C5A56A", GD = "#8A6A2C", INK = "#1C2826", MUT = "#5F6B66", CRE = "#FBF8F1", LINE = "#E4D8BF";
const ICON = {
  price: '<path d="M3 17l5-5 4 4 8-8"/><path d="M14 8h6v6"/>', range: '<path d="M4 12h16"/><path d="M4 8v8M20 8v8"/>',
  rent: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>', yield: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 3"/>',
  pace: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>', homes: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  metro: '<rect x="6" y="3" width="12" height="14" rx="3"/><path d="M6 11h12M9 21l1.5-4M15 21l-1.5-4"/><circle cx="9" cy="14" r=".6"/><circle cx="15" cy="14" r=".6"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  ok: '<path d="M5 12l5 5 9-10"/>', warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>', check: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
};
const ic = (k, s, c) => '<svg viewBox="0 0 24 24" width="' + (s || 16) + '" height="' + (s || 16) + '" fill="none" stroke="' + (c || G) + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none">' + ICON[k] + "</svg>";
const firstSentence = (s) => { const t = String(s || "").trim(); const m = /^(.{20,}?\.)\s+(?=[A-Z])/.exec(t + " "); const u = m ? m[1] : t; return u.length > 180 ? u.slice(0, u.lastIndexOf(" ", 176)) + " ..." : u; };

// the figures, all from the pack (and the finance engine for the yield); exported so tests check them against the stored rows
export function dashFigures(pp, pack, today, f) {
  pp = pp || {}; pack = pack || {}; f = f || {};
  const pj = pack.project || {}, mk = (pack.market && pack.market.kinds) || {};
  const units = (pack.units || []).filter((u) => !/shop|office/i.test(u.type || ""));
  const homes = units.reduce((s, u) => s + (u.n || 0), 0);
  const floors = Math.max(0, ...(pack.bldgs || []).map((b) => +b.floors || 0), ...(pp.buildings || []).map((b) => +b.floors || 0));
  const buildings = (pack.bldgs || []).length || (pp.buildings || []).length;
  // status: Ready / Off-plan x% / Empty plot / Not known
  let status = "Not known", tone = "grey";
  const built = homes > 0 || buildings > 0;
  if (!built && !pj.number) { status = "Empty plot"; tone = "grey"; }
  else if (pj.pct != null && pj.pct < 100 && !(pack.tenancies && pack.tenancies.total)) { status = "Off-plan " + Math.round(pj.pct) + "%"; tone = "gold"; }
  else if ((pack.tenancies && pack.tenancies.total) || (mk.ready && mk.ready.deals_12m) || /complet|finish/i.test(pj.status || "") || pj.pct >= 100) { status = "Ready"; tone = "green"; }
  else if (pj.number) { status = "Off-plan"; tone = "gold"; }
  // the market kind the tiles speak for: ready sales when the building has them in the last 12 months, else off-plan
  const kind = mk.ready && mk.ready.deals_12m ? "ready" : mk.offplan && mk.offplan.deals_12m ? "offplan" : mk.ready ? "ready" : mk.offplan ? "offplan" : null;
  const k = kind ? mk[kind] : null, kl = kind === "offplan" ? "off-plan" : "ready";
  const sqft = (m2) => (m2 ? m2 / SQM_TO_SQFT : null);
  const ytd = pack.sales && pack.sales.kinds && pack.sales.kinds[kind || ""] ? pack.sales.kinds[kind].aed_sqft : null;
  const price = k ? { kind: kl, now: sqft(k.aed_m2_12m || k.aed_m2), all: sqft(k.aed_m2), ytd: ytd || null, deals12: k.deals_12m, first: k.first, to: pack.market.to } : null;
  if (price && price.now && price.all) price.trend = price.now > price.all * 1.02 ? "up" : price.now < price.all * 0.98 ? "down" : "flat";
  const bv = brokerView(pp, pack, today);
  const range = bv.range;
  const ys = bv.classes.map((c) => (c.grossYield ? val(c.grossYield) : null)).filter((x) => Number.isFinite(x));
  const yieldR = ys.length ? { low: Math.min(...ys), high: Math.max(...ys) } : null;
  const beds = pack.tenancies && pack.tenancies.beds ? Object.keys(pack.tenancies.beds).sort().map((b) => ({ b, rent: pack.tenancies.beds[b][0], n: pack.tenancies.beds[b][1] })) : [];
  const pace = k && k.pace ? { perMonth: k.pace["12m"], m3: k.pace["3m"], kind: kl } : null;
  // places: the drive-time solve first (it is a road time); else the straight-line nearest names
  const a = pack.access || {}, nr = pack.near || {}, places = [];
  if (a.metro) places.push({ icon: "metro", name: a.metro + " metro", d: a.metro_min != null ? Math.round(a.metro_min) + " min drive" : "" });
  else if (nr.metro) places.push({ icon: "metro", name: nr.metro, d: "nearest (straight line)" });
  const PN = { dubai_mall: "Dubai Mall", difc: "DIFC", dxb: "DXB airport", marina: "Dubai Marina", expo: "Expo City", dwc: "DWC airport", downtown: "Downtown" };
  Object.entries(a.mins || {}).filter(([, m]) => Number.isFinite(m)).sort((x, y) => x[1] - y[1]).slice(0, 2).forEach(([key, m]) => places.push({ icon: "pin", name: PN[key] || key.replace(/_/g, " "), d: Math.round(m) + " min drive" }));
  if (places.length < 3 && nr.mall) places.push({ icon: "pin", name: nr.mall, d: "nearest mall (straight line)" });
  const asof = pack.asof || {}, src = [];
  for (const key of ["lk_dld_transactions", "pp_dld__rent_contracts", "g_dld__units", "g_dld__projects"]) if (asof[key]) src.push(asof[key].src.replace(/ \(.*\)$/, "") + " " + dS(asof[key].date));
  if (a.solved_on) src.push("drive times " + dS(a.solved_on));
  const verdict = {
    supports: firstSentence((f.opps || [])[0]) || "Not available yet",
    affects: firstSentence((f.risks || [])[0]) || "Not available yet",
    verify: (f.missing || []).length ? "Not available yet: " + f.missing.slice(0, 2).map((x) => String(x).replace(/\s*\(.*$/, "")).join("; ") + "." : "Nothing outstanding in the registers.",
  };
  return { name: f.name || pp.project || "Plot " + (pp.parcel || ""), type: pack.kind || "Not recorded", community: pp.master || pp.area_name || "Dubai", area: pp.area_name || "", status, tone, price, range, yieldR, beds, pace, homes, floors, buildings, places, src, verdict, plot: pp.plot_no || pp.parcel || "" };
}

const tile = (icon, label, big, sub, extra) => '<div style="background:#fff;border:0.3mm solid ' + LINE + ';border-radius:3mm;padding:3mm 3.4mm;display:flex;flex-direction:column;gap:1mm;min-width:0;overflow:hidden">'
  + '<div style="display:flex;align-items:center;gap:1.6mm;font:600 9.6pt Inter,sans-serif;color:' + T + ';letter-spacing:.02em">' + ic(icon, 15) + esc(label) + "</div>"
  + '<div style="font:600 20pt Fraunces,Georgia,serif;color:' + INK + ';line-height:1.05;white-space:nowrap">' + big + "</div>"
  + (extra || "") + '<div style="font:500 8pt Inter,sans-serif;color:' + MUT + ';line-height:1.25">' + esc(sub) + "</div></div>";
const NA = '<span style="font:600 13pt Inter,sans-serif;color:#8C918E">Not available yet</span>';

function rentBars(beds) {
  if (!beds.length) return "";
  const mx = Math.max(...beds.map((b) => b.rent));
  return '<div style="display:flex;flex-direction:column;gap:.8mm;margin:.5mm 0">' + beds.slice(0, 4).map((b) => '<div style="display:flex;align-items:center;gap:1.4mm;font:600 8.4pt Inter,sans-serif;color:' + INK + '">'
    + '<span style="width:11mm;white-space:nowrap">' + esc(b.b) + " bed</span>"
    + '<span style="flex:1;height:2.6mm;background:#EFE7D6;border-radius:1.3mm;overflow:hidden"><span style="display:block;height:100%;width:' + Math.max(8, Math.round(b.rent / mx * 100)) + '%;background:' + T + '"></span></span>'
    + '<span style="width:11mm;text-align:right">' + esc(int(b.rent / 1000)) + "K</span></div>").join("") + "</div>";
}
// the price line: the three medians the pack holds (all records, last 12 months, this year); a monthly series is not in the pack yet
function priceSpark(p) {
  const pts = [["All records", p.all], ["Last 12 months", p.now], ["2026 so far", p.ytd]].filter((x) => Number.isFinite(x[1]));
  if (pts.length < 2) return "";
  const W = 170, H = 30, lo = Math.min(...pts.map((x) => x[1])), hi = Math.max(...pts.map((x) => x[1])), sp = hi - lo || 1;
  const xy = pts.map((x, i) => [16 + i * ((W - 32) / (pts.length - 1)), 11 + (1 - (x[1] - lo) / sp) * (H - 16)]);
  return '<svg viewBox="0 0 ' + W + " " + (H + 12) + '" width="100%" height="20mm" style="display:block">'
    + '<polyline points="' + xy.map((q) => q.join(",")).join(" ") + '" fill="none" stroke="' + T + '" stroke-width="1.6"/>'
    + xy.map((q, i) => '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="2.4" fill="' + (i === 1 ? G : T) + '"/><text x="' + q[0] + '" y="' + (q[1] - 3.6) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="6.4" font-weight="600" fill="' + INK + '">' + int(pts[i][1]) + "</text>"
      + '<text x="' + q[0] + '" y="' + (H + 10) + '" text-anchor="middle" font-family="Inter,sans-serif" font-size="5.6" fill="' + MUT + '">' + esc(pts[i][0]) + "</text>").join("") + "</svg>";
}

export function dashBlock(pp, pack, today, f) {
  const d = dashFigures(pp, pack, today, f);
  const toneC = { green: ["#E3F0EA", "#0F5A3F"], gold: ["#F6EBD3", GD], grey: ["#ECEDEC", "#5F6B66"] }[d.tone];
  const chip = (t, c) => '<span style="display:inline-flex;align-items:center;gap:1.2mm;padding:1.2mm 3mm;border-radius:5mm;font:600 10pt Inter,sans-serif;background:' + c[0] + ";color:" + c[1] + '">' + t + "</span>";
  const arrow = d.price && d.price.trend ? (d.price.trend === "up" ? '<span style="color:#0F5A3F;font-size:15pt"> &#9650;</span>' : d.price.trend === "down" ? '<span style="color:#A4462E;font-size:15pt"> &#9660;</span>' : '<span style="color:' + MUT + ';font-size:15pt"> &#9654;</span>') : "";
  const p = d.price;
  const tiles = [
    tile("price", "Median price per sq ft", p && p.now ? "AED " + int(p.now) + arrow : NA, p ? p.kind + " sales, last 12 months (" + int(p.deals12 || 0) + " deals)" + (p.trend ? "; arrow vs the all-records median" : "") : "sales register"),
    tile("range", "Value range", d.range ? '<span style="font-size:16pt">' + aedS(d.range.low) + " to " + aedS(d.range.high).replace("AED ", "") + "</span>" : NA, "typical home by bedroom: price per m2 x median size"),
    tile("rent", "Registered rent a year", d.beds.length ? "" : NA, d.beds.length ? "AED, median by bedroom (tenancy register)" : "tenancy register", rentBars(d.beds)),
    tile("yield", "Gross yield", d.yieldR ? pct(d.yieldR.low) + (d.yieldR.high - d.yieldR.low > 0.0005 ? " to " + pct(d.yieldR.high) : "") : NA, "registered rent / price, before costs"),
    tile("pace", "Sales pace", d.pace && d.pace.perMonth != null ? (Math.round(d.pace.perMonth * 10) / 10).toFixed(1) + '<span style="font:600 11pt Inter,sans-serif;color:' + MUT + '"> a month</span>' : NA, d.pace ? d.pace.kind + " sales, last 12 months; last 3 months " + (Math.round((d.pace.m3 || 0) * 10) / 10).toFixed(1) + " a month" : "sales register"),
    tile("homes", "Homes and floors", d.homes ? int(d.homes) + '<span style="font:600 11pt Inter,sans-serif;color:' + MUT + '"> homes</span>' : NA, (d.floors ? d.floors + " floors" : "floors not recorded") + (d.buildings > 1 ? " · " + d.buildings + " buildings" : "") + " (units register)"),
  ];
  const places = d.places.length ? d.places.slice(0, 3).map((q) => '<div style="display:flex;align-items:center;gap:2mm;min-width:0">' + ic(q.icon, 20, T)
    + '<div style="min-width:0"><div style="font:600 10pt Inter,sans-serif;color:' + INK + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(q.name) + '</div><div style="font:500 8.4pt Inter,sans-serif;color:' + MUT + '">' + esc(q.d) + "</div></div></div>").join("")
    : '<div style="font:500 9pt Inter,sans-serif;color:' + MUT + '">Places: Not available yet</div>';
  const vrow = (icon, c, h, t) => '<div style="display:flex;gap:2.4mm;align-items:flex-start">' + ic(icon, 17, c) + '<div style="font:500 10pt Inter,sans-serif;color:' + INK + ';line-height:1.3"><b style="font-weight:700;color:' + c + '">' + esc(h) + ":</b> " + esc(t) + "</div></div>";
  return '<div class="bpp-dash-in" style="width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;gap:3mm;box-sizing:border-box">'
    + '<div style="display:flex;flex-wrap:wrap;gap:2mm;align-items:center">' + chip(esc(d.status), toneC) + chip(esc(d.type), ["#E6EFEE", T]) + chip(ic("pin", 13, GD) + esc(d.community + (d.area && d.area !== d.community ? " · " + d.area : "")), ["#F6EBD3", GD]) + (d.plot ? chip("Plot " + esc(d.plot), ["#ECEDEC", "#5F6B66"]) : "") + "</div>"
    + '<div style="display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:36mm;gap:2.6mm">' + tiles.join("") + "</div>"
    + '<div style="display:grid;grid-template-columns:1.05fr 1fr;gap:2.6mm">'
    + '<div style="background:#fff;border:0.3mm solid ' + LINE + ';border-radius:3mm;padding:2.4mm 3mm"><div style="font:600 9.6pt Inter,sans-serif;color:' + T + '">Price per sq ft over time</div>' + (p ? priceSpark(p) || '<div style="font:500 9pt Inter,sans-serif;color:' + MUT + '">Not available yet</div>' : '<div style="font:500 9pt Inter,sans-serif;color:' + MUT + '">Not available yet</div>') + "</div>"
    + '<div style="background:#fff;border:0.3mm solid ' + LINE + ';border-radius:3mm;padding:2.6mm 3mm;display:flex;flex-direction:column;justify-content:center;gap:2mm">' + places + "</div></div>"
    + '<div style="background:' + CRE + ";border:0.4mm solid " + G + ';border-radius:3mm;padding:3mm 3.6mm;display:flex;flex-direction:column;gap:2mm;flex:none">'
    + '<div style="font:600 11pt Fraunces,Georgia,serif;color:' + T + '">The verdict</div>'
    + vrow("ok", "#0F5A3F", "What the evidence supports", d.verdict.supports) + vrow("warn", GD, "What could affect the decision", d.verdict.affects) + vrow("check", T, "What to verify next", d.verdict.verify) + "</div>"
    + '<div style="font:500 7.4pt Inter,sans-serif;color:' + MUT + ';line-height:1.3">Sources: ' + esc(d.src.join(" · ") || "Not available yet") + ". Detail and evidence on pages 2 and 3.</div>"
    + "</div>";
}

const DASH_RE = /(<div[^>]*class=(["'])[^"']*\bbpp-dash\b[^"']*\2[^>]*>)\s*<\/div>/i;
export const hasDash = (html) => DASH_RE.test(String(html || ""));
export function placeDash(html, block) { if (!block) return html; return String(html).replace(DASH_RE, (m, open) => open + block + "</div>"); }
