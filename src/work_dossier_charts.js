// v658 - BRIEFING CARDS AT A GLANCE (Kendall, 27 Oct 2026: "her card needs to open everything, inclusive of charts, graphs ... so she can see in an instant, and
// bullet points, no long sentences"). A briefing record may carry KPI tiles and charts; both are drawn HERE as plain SVG from numbers in the record: no chart
// library, no script, every label escaped, every number checked. THIS REPO IS PUBLIC: the figures live in KV, the code holds only the shapes and the drawing.
//   kpis    [{label, value, sub}]
//   charts  [{id, type, title, unit, note, source, ref:{value, label}, items:[{label, sub, value, ghost, highlight, muted, low, base, high}], series:[{name, points:[[x, y]]}]}]
// Types: bar (optional highlight, muted, a ghost bar for "could reach" and a dashed reference line), range (low to high with a base dot and an entry tick),
// line (up to four series by year; a gap of more than one year is drawn dashed) and distance (minutes along a track).
const NAVY = "#1F2B44", GOLD = "#C9A97A", BLUSH = "#F9F1EF", MUTE = "#B9C0CC", INK = "#202020", GREY = "#8A8F99", W = 340;
export const CHART_TYPES = ["bar", "range", "line", "distance"];
const S = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, n);
const num = (v) => { if (v === null || v === undefined || v === "" || typeof v === "boolean") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const fmt = (n) => (n == null ? "" : Math.round(n).toLocaleString("en-US"));
const ex = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const idOk = (v) => { const s = S(v, 40).toLowerCase(); return /^[a-z0-9][a-z0-9-]{0,39}$/.test(s) ? s : ""; };

export function cleanGlance(g) {
  const x = g && typeof g === "object" ? g : {};
  const kpis = (Array.isArray(x.kpis) ? x.kpis : []).slice(0, 12).map((k) => ({ label: S(k && k.label, 60).trim(), value: S(k && k.value, 40).trim(), sub: S(k && k.sub, 90).trim() }))
    .filter((k) => k.label && k.value);
  const charts = (Array.isArray(x.charts) ? x.charts : []).slice(0, 12).filter((c) => c && CHART_TYPES.includes(c.type)).map((c, i) => {
    const o = { id: idOk(c.id) || ("c" + i), type: c.type, title: S(c.title, 100).trim() || "Chart", unit: S(c.unit, 30).trim(), note: S(c.note, 240).trim(), source: S(c.source, 240).trim() };
    const rv = num(c.ref && c.ref.value); if (rv != null) o.ref = { value: rv, label: S(c.ref.label, 60).trim() };
    o.items = (Array.isArray(c.items) ? c.items : []).slice(0, 30).map((t) => ({ label: S(t && t.label, 40).trim(), sub: S(t && t.sub, 40).trim(), value: num(t && t.value),
      ghost: num(t && t.ghost), low: num(t && t.low), base: num(t && t.base), high: num(t && t.high), highlight: !!(t && t.highlight), muted: !!(t && t.muted) }))
      .filter((t) => t.label && (c.type === "range" ? t.low != null && t.high != null && t.high >= t.low : t.value != null && t.value >= 0));
    o.series = (Array.isArray(c.series) ? c.series : []).slice(0, 4).map((s) => ({ name: S(s && s.name, 40).trim(),
      points: (Array.isArray(s && s.points) ? s.points : []).slice(0, 80).map((p) => [num(p && p[0]), num(p && p[1])]).filter((p) => p[0] != null && p[1] != null && p[1] >= 0).sort((a, b) => a[0] - b[0]) }))
      .filter((s) => s.points.length);
    return o;
  }).filter((c) => (c.type === "line" ? c.series.length > 0 : c.items.length > 0));
  return { kpis, charts };
}

const svg = (c, h, body) => '<svg viewBox="0 0 ' + W + " " + Math.ceil(h) + '" width="100%" role="img" aria-label="' + ex(c.title) + '">' + body + "</svg>";
const txt = (x, y, size, t, more) => '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" font-size="' + size + '"' + (more || "") + ">" + t + "</text>";

function barSvg(c) {
  const its = c.items, L = 116, R = 292, rowH = 25, top = c.ref ? 16 : 4, h = top + its.length * rowH + 2;
  const max = Math.max(1, ...its.map((t) => Math.max(t.value, t.ghost || 0)), c.ref ? c.ref.value : 0), X = (v) => L + (Math.max(0, v) / max) * (R - L);
  let s = "";
  if (c.ref) { const rx = X(c.ref.value); s += '<line x1="' + rx.toFixed(1) + '" y1="' + (top - 2) + '" x2="' + rx.toFixed(1) + '" y2="' + h + '" stroke="#8A6F3E" stroke-dasharray="3 3"/>'   // drawn first: bars and values sit on top
    + txt(Math.max(L + 40, Math.min(rx, R - 40)), 10, 9, ex(c.ref.label || fmt(c.ref.value)), ' text-anchor="middle" fill="#8A6F3E" font-weight="700"'); }
  its.forEach((t, i) => {
    const y = top + i * rowH, fill = t.highlight ? GOLD : t.muted ? MUTE : NAVY, ghost = t.ghost != null && t.ghost > t.value, b = t.highlight ? ' font-weight="700"' : "";
    s += txt(L - 6, y + (t.sub ? 9 : 13), 10.5, ex(t.label), ' text-anchor="end" fill="' + INK + '"' + b);
    if (t.sub) s += txt(L - 6, y + 19, 8, ex(t.sub), ' text-anchor="end" fill="' + GREY + '"');
    if (ghost) s += '<rect x="' + L + '" y="' + (y + 4) + '" width="' + (X(t.ghost) - L).toFixed(1) + '" height="13" rx="3" fill="' + BLUSH + '" stroke="' + GOLD + '" stroke-dasharray="3 2"/>'
      + txt(X(t.ghost) + 4, y + 14, 9.5, fmt(t.ghost), ' fill="#8A6F3E" font-weight="700"');
    s += '<rect x="' + L + '" y="' + (y + 4) + '" width="' + Math.max(2, X(t.value) - L).toFixed(1) + '" height="13" rx="3" fill="' + fill + '"/>';
    s += ghost ? txt(L + 4, y + 14, 9.5, fmt(t.value), ' fill="#fff" font-weight="700"') : txt(X(t.value) + 4, y + 14, 10, fmt(t.value), ' fill="' + INK + '"' + b);
  });
  return svg(c, h, s);
}

function distanceSvg(c) {
  const its = c.items, L = 116, R = 262, rowH = 21, h = its.length * rowH + 4, max = Math.max(1, ...its.map((t) => t.value)), X = (v) => L + (v / max) * (R - L);
  let s = "";
  its.forEach((t, i) => {
    const y = i * rowH + 11, col = t.highlight ? GOLD : NAVY;
    s += txt(L - 6, y + 4, 10.5, ex(t.label), ' text-anchor="end" fill="' + INK + '"')
      + '<line x1="' + L + '" y1="' + y + '" x2="' + R + '" y2="' + y + '" stroke="#EEE7DB" stroke-width="3" stroke-linecap="round"/>'
      + '<line x1="' + L + '" y1="' + y + '" x2="' + X(t.value).toFixed(1) + '" y2="' + y + '" stroke="' + col + '" stroke-width="3" stroke-linecap="round"/>'
      + '<circle cx="' + X(t.value).toFixed(1) + '" cy="' + y + '" r="4.5" fill="' + col + '"/>' + txt(R + 8, y + 4, 10, fmt(t.value) + (c.unit ? " " + ex(c.unit) : ""), ' fill="' + INK + '"');
  });
  return svg(c, h, s);
}

function rangeSvg(c) {
  const its = c.items, L = 92, R = 322, rowH = 42, h = its.length * rowH + 20;
  const lo = Math.min(...its.map((t) => Math.min(t.low, t.value == null ? t.low : t.value))), hi = Math.max(...its.map((t) => t.high));
  const a = Math.floor(lo / 1000) * 1000, b = Math.max(a + 1000, Math.ceil(hi / 1000) * 1000), X = (v) => L + ((v - a) / (b - a)) * (R - L);
  let s = "";
  for (let v = a; v <= b; v += 1000) s += '<line x1="' + X(v).toFixed(1) + '" y1="4" x2="' + X(v).toFixed(1) + '" y2="' + (h - 14) + '" stroke="#EEE7DB"/>' + txt(X(v), h - 3, 8.5, fmt(v), ' text-anchor="middle" fill="' + GREY + '"');
  its.forEach((t, i) => {
    const y = i * rowH + 20, hl = t.highlight, b2 = hl ? ' font-weight="700"' : "";
    s += txt(L - 6, y + 4, 10.5, ex(t.label), ' text-anchor="end" fill="' + INK + '"' + b2);
    if (t.sub) s += txt(L - 6, y + 14, 8, ex(t.sub), ' text-anchor="end" fill="' + GREY + '"');
    s += '<rect x="' + X(t.low).toFixed(1) + '" y="' + (y - 6) + '" width="' + Math.max(2, X(t.high) - X(t.low)).toFixed(1) + '" height="12" rx="6" fill="' + (hl ? "#F3E6D2" : BLUSH) + '" stroke="' + (hl ? GOLD : NAVY) + '"/>'
      + txt(X(t.low), y - 9, 8.5, fmt(t.low), ' text-anchor="middle" fill="#5F6B66"') + txt(X(t.high), y - 9, 8.5, fmt(t.high), ' text-anchor="middle" fill="#5F6B66"');
    if (t.value != null) s += '<line x1="' + X(t.value).toFixed(1) + '" y1="' + (y - 9) + '" x2="' + X(t.value).toFixed(1) + '" y2="' + (y + 9) + '" stroke="' + INK + '" stroke-width="1.6"/>';
    if (t.base != null) s += '<circle cx="' + X(t.base).toFixed(1) + '" cy="' + y + '" r="5" fill="' + (hl ? GOLD : NAVY) + '"/>' + txt(X(t.base), y + 19, 9, fmt(t.base), ' text-anchor="middle" font-weight="700" fill="' + INK + '"');
  });
  return svg(c, h, s);
}

function lineSvg(c) {
  const L = 40, R = 328, T = 24, B = 158, h = 176, cols = [GOLD, NAVY, "#7D8FB0", "#8A6F3E"], all = c.series.flatMap((s) => s.points);
  const x0 = Math.min(...all.map((p) => p[0])), x1 = Math.max(...all.map((p) => p[0])), yMax = Math.max(1000, Math.ceil(Math.max(...all.map((p) => p[1])) / 1000) * 1000);
  const X = (v) => L + ((v - x0) / (x1 - x0 || 1)) * (R - L), Y = (v) => B - (v / yMax) * (B - T);
  let s = "";
  for (let k = 0; k <= 4; k++) { const v = (yMax / 4) * k; s += '<line x1="' + L + '" y1="' + Y(v).toFixed(1) + '" x2="' + R + '" y2="' + Y(v).toFixed(1) + '" stroke="#EEE7DB"/>' + txt(L - 4, Y(v) + 3, 8.5, fmt(v), ' text-anchor="end" fill="' + GREY + '"'); }
  const step = Math.max(1, Math.ceil((x1 - x0) / 6)); for (let v = x0; v <= x1; v += step) s += txt(X(v), B + 13, 8.5, String(Math.round(v)), ' text-anchor="middle" fill="' + GREY + '"');
  c.series.forEach((se, i) => {
    const col = cols[i % cols.length], pts = se.points;
    for (let k = 1; k < pts.length; k++) { const p = pts[k - 1], q = pts[k]; s += '<line x1="' + X(p[0]).toFixed(1) + '" y1="' + Y(p[1]).toFixed(1) + '" x2="' + X(q[0]).toFixed(1) + '" y2="' + Y(q[1]).toFixed(1) + '" stroke="' + col + '" stroke-width="2.2"' + (q[0] - p[0] > 1 ? ' stroke-dasharray="4 3"' : "") + "/>"; }
    pts.forEach((p) => { s += '<circle cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="2.6" fill="' + col + '"/>'; });
    const lp = pts[pts.length - 1]; s += txt(Math.min(X(lp[0]), R) - 4, Y(lp[1]) - 6, 9.5, fmt(lp[1]), ' font-weight="700" text-anchor="end" fill="' + col + '"');
    s += '<rect x="' + (L + i * 120) + '" y="5" width="12" height="4" rx="2" fill="' + col + '"/>' + txt(L + 16 + i * 120, 10, 9.5, ex(se.name), ' fill="' + INK + '"');
  });
  return svg(c, h, s);
}

export function chartSvg(c) { return c.type === "bar" ? barSvg(c) : c.type === "range" ? rangeSvg(c) : c.type === "line" ? lineSvg(c) : distanceSvg(c); }

// The hero tiles and the chart cards, in record order. Called with a record already cleaned by cleanGlance.
export function glanceHtml(g) {
  const tiles = (g.kpis || []).map((k) => "<div class=kt><small>" + ex(k.label) + "</small><b>" + ex(k.value) + "</b>" + (k.sub ? "<span>" + ex(k.sub) + "</span>" : "") + "</div>").join("");
  const charts = (g.charts || []).map((c) => '<div class=dc id="c-' + ex(c.id) + '"><h3>' + ex(c.title) + (c.unit ? " <em>" + ex(c.unit) + "</em>" : "") + "</h3>" + chartSvg(c)
    + (c.note ? "<p>" + ex(c.note) + "</p>" : "") + (c.source ? "<p class=src>Source: " + ex(c.source) + "</p>" : "") + "</div>").join("");
  return (tiles ? "<div class=kg>" + tiles + "</div>" : "") + (charts ? "<div class=gl>At a glance</div>" + charts : "");
}

export const GLANCE_CSS = "<style>.kg{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 12px}.kt{background:#1F2B44;color:#F9F1EF;border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;min-width:0}"
  + ".kt small{color:#C9A97A;font-size:.66rem;letter-spacing:.05em;text-transform:uppercase}.kt b{font:400 1.25rem Anton,Impact,Inter,sans-serif;letter-spacing:.02em;word-break:break-word}.kt span{font-size:.72rem;opacity:.85;line-height:1.25}"
  + ".dc{border:1px solid #E6DED2;border-radius:16px;background:#fff;margin:0 0 10px;padding:12px 10px 8px}.dc h3{margin:0 0 6px;font-size:.92rem;color:#1F2B44}.dc h3 em{font-style:normal;font-weight:400;color:#8A6F3E;font-size:.78rem}"
  + ".dc svg{display:block;font-family:Inter,'IBM Plex Sans',Arial,sans-serif}.dc p{margin:4px 2px 0;font-size:.75rem;color:#5F6B66;line-height:1.3}.dc p.src{color:#8A8F99;font-size:.68rem}"
  + ".dx ul{list-style:none;padding-left:0}.dx ul li{position:relative;padding-left:16px}.dx ul li:before{content:'';position:absolute;left:2px;top:.62em;width:6px;height:6px;border-radius:50%;background:#C9A97A}.dx ol{padding-left:20px}"
  + ".gl{font:600 .72rem Inter,sans-serif;color:#8A6F3E;letter-spacing:.08em;text-transform:uppercase;margin:16px 2px 8px}</style>";
