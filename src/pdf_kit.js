// v486 - THE SHARED PDF LOOK (Kendall, 11 Oct 2026: "these are incredibly boring and these should pop ... get away from as many
// words as possible and get into lots of icons"; mock-up of the Atria dossier approved the same day). One place for every client
// PDF: an outline icon set (inline SVG, never emoji - his 4 Oct rule), figure cards (icon + big number + one-line label, the
// CBRE / Knight Frank snapshot pattern), bar rows in place of tables, and a small-print line for what used to be paragraphs.
// Pure string builders: safe in the worker and in any page renderer. Colours are the brief's own (teal ink, gold accent).
export const PK = { teal: "#0A4F4A", gold: "#C5A56A", ink: "#16302B", muted: "#5F6B66", line: "#E2DCCB", card: "#FFFFFF" };

const P = {
  tower: '<path d="M5 21V4l7-2 7 2v17"/><path d="M9 21v-4h6v4M8.5 7h1M14.5 7h1M8.5 11h1M14.5 11h1M8.5 15h1M14.5 15h1"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  car: '<path d="M5 15l1.6-5h10.8L19 15"/><rect x="3" y="15" width="18" height="4" rx="1.2"/><circle cx="7" cy="19.5" r="1.1"/><circle cx="17" cy="19.5" r="1.1"/>',
  train: '<rect x="6" y="3" width="12" height="13" rx="3"/><path d="M6 10h12M9 20l-2 2M15 20l2 2M9 16v3M15 16v3"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
  school: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
  clinic: '<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z"/><path d="M12 9v5M9.5 11.5h5"/>',
  gym: '<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>',
  city: '<path d="M3 21V10h5v11M8 21V4h7v17M15 21v-8h6v8"/><path d="M11 8h1M11 12h1M11 16h1"/>',
  sea: '<path d="M3 17c2 0 2-1.5 4.5-1.5S10 17 12 17s2.5-1.5 4.5-1.5S19 17 21 17"/><path d="M6 13l6-9 6 9z"/>',
  media: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M10 9.5l5 2.5-5 2.5z"/>',
  balcony: '<path d="M4 12h16M6 12v8M10 12v8M14 12v8M18 12v8M4 20h16"/><path d="M7 12V5h10v7"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  builder: '<path d="M6 21V4h2v17M4 21h8M8 5h12M18 5v4"/><path d="M16 9h4v2h-4z"/>',
  pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  cross: '<path d="M6 6l12 12M18 6L6 18"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3 3 0 0 1 0 6M18 14c2 .8 3 3 3 6"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  dot: '<circle cx="12" cy="12" r="3"/>',
  cart: '<path d="M3 4h2l2.4 10.2a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.1L20 8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  bag: '<path d="M5.6 7.8h12.8l-1.1 12.4H6.7L5.6 7.8z"/><path d="M9.2 7.8V6.2a2.8 2.8 0 0 1 5.6 0v1.6"/>',
  tree: '<path d="M12 3l-6 8h3.5l-4 6h13l-4-6H18z"/><path d="M12 17v4"/>',
  cross: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
};
export const PK_ICON_NAMES = Object.keys(P);
export function pkIcon(name, size, color) {
  const s = size || 20;
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="' + (color || PK.gold) + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;flex:none;">' + (P[name] || P.dot) + "</svg>";
}
// one figure card: icon on top, the big figure, a one-line label (and an optional tiny second line)
export function pkFig(icon, big, label, sub) {
  return '<div style="background:' + PK.card + ";border:1px solid " + PK.line + ';border-radius:12px;padding:10px 8px;display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;">'
    + pkIcon(icon, 22) + '<div style="font-size:19px;font-weight:600;color:' + PK.teal + ';line-height:1.1;white-space:nowrap;">' + big + "</div>"
    + '<div style="font-size:10.5px;color:' + PK.muted + ';line-height:1.25;">' + label + "</div>"
    + (sub ? '<div style="font-size:9px;color:' + PK.muted + ';opacity:.85;line-height:1.2;">' + sub + "</div>" : "") + "</div>";
}
export function pkGrid(cards, cols, gap) {
  const c = cards.filter(Boolean);
  if (!c.length) return "";
  return '<div style="display:grid;grid-template-columns:repeat(' + (cols || Math.min(4, c.length)) + ',minmax(0,1fr));gap:' + (gap || 8) + 'px;">' + c.join("") + "</div>";
}
// a small left-aligned icon card: icon + title on one line, the figure under it (for "Schools 1.6 km, nearest of 3")
export function pkTile(icon, title, big, sub) {
  return '<div style="background:' + PK.card + ";border:1px solid " + PK.line + ';border-radius:12px;padding:9px 10px;">'
    + '<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:' + PK.teal + ';">' + pkIcon(icon, 17) + title + "</div>"
    + (big ? '<div style="font-size:17px;font-weight:600;color:' + PK.ink + ';margin-top:4px;line-height:1.15;">' + big + "</div>" : "")
    + (sub ? '<div style="font-size:9.5px;color:' + PK.muted + ';line-height:1.3;margin-top:1px;">' + sub + "</div>" : "") + "</div>";
}
// bar rows: [label, value (number), right-hand text]
export function pkBars(rows, opts) {
  const r = rows.filter((x) => x && x[1] > 0);
  if (!r.length) return "";
  const mx = Math.max(...r.map((x) => x[1])), lw = (opts && opts.labelW) || 80, rw = (opts && opts.rightW) || 130;
  return '<div style="display:flex;flex-direction:column;gap:7px;">' + r.map((x) =>
    '<div style="display:grid;grid-template-columns:' + lw + "px 1fr " + rw + 'px;align-items:center;gap:9px;font-size:11.5px;color:' + PK.ink + ';">'
    + "<span>" + x[0] + '</span><div style="height:13px;border-radius:3px;background:' + PK.gold + ";width:" + Math.max(4, Math.round(100 * x[1] / mx)) + '%;"></div>'
    + '<span style="text-align:right;white-space:nowrap;">' + x[2] + "</span></div>").join("") + "</div>";
}
// a boxed section with an icon heading
export function pkBox(icon, title, inner, foot) {
  return '<div style="background:' + PK.card + ";border:1px solid " + PK.line + ';border-radius:12px;padding:11px 14px 10px;display:flex;flex-direction:column;gap:8px;">'
    + '<div style="display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:' + PK.teal + ';">' + pkIcon(icon, 18) + title + "</div>"
    + inner + (foot ? '<div style="font-size:9.5px;color:' + PK.muted + ';line-height:1.35;">' + foot + "</div>" : "") + "</div>";
}

// v500 (Kendall 11 Oct: "it should have the map ... as the crow flies ... what the closest things were within half a kilometer, one
// kilometer ... you still need this map on every .pdf") - WHAT'S CLOSE: the building at the centre, rings at 500 m and 1 km, the nearest
// place of each kind plotted where it is, and a numbered list with the straight-line distance. items: [{k, n, lat, lon}] (the brief's
// amenity file). A rough point (both coordinates on a 0.01 grid) is never drawn: it would put a place hundreds of metres off.
// v503 (Kendall 11 Oct: "prefer icons instead of colored dots") - each kind has its own line icon, white on its colour
export const PK_NEAR_KINDS = [["metro", "Metro", "#0A4F4A", "train"], ["school", "School", "#B8862B", "school"], ["hospital", "Hospital", "#9B3D3D", "cross"], ["clinic", "Clinic", "#9B3D3D", "clinic"],
  ["supermarket", "Supermarket", "#3D6B9B", "cart"], ["mall", "Mall", "#3D6B9B", "bag"], ["park", "Park", "#4F7A3A", "tree"], ["beach", "Beach", "#2E7FA0", "sea"]];
// a register name in capitals reads as shouting: "EDEN DERMA CLINIC" -> "Eden Derma Clinic" (mixed-case names are left alone)
const pkCase = (n) => (/[a-z]/.test(n) ? n : n.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Llc|Fzc|Fze|Dmcc)\b/g, (m) => m.toUpperCase()));
const pkBadge = (icon, col, x, y, r) => '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r + '" fill="' + col + '" stroke="#FFFFFF" stroke-width="1.3"/>' +
  '<g transform="translate(' + (x - r * 0.62).toFixed(2) + " " + (y - r * 0.62).toFixed(2) + ") scale(" + (r * 1.24 / 24).toFixed(3) + ')" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' + (P[icon] || P.dot) + "</g>";
const pkRough = (i) => [i.lat, i.lon].every((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9);
const pkEsc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export function pkNearest(pos, items, maxM) {
  if (!pos || !isFinite(pos[0]) || !isFinite(pos[1])) return [];
  const [lat, lon] = pos, out = [], lim = maxM || 1500;
  for (const [k, label, col, icon] of PK_NEAR_KINDS) {
    const c = [];
    for (const i of items || []) {
      if (i.k !== k || !isFinite(i.lat) || !isFinite(i.lon) || i.ap || pkRough(i)) continue;
      if (k === "clinic" && /pharmac|chemist/i.test(String(i.n || "") + " " + String(i.x || ""))) continue;
      const dy = (i.lat - lat) * 111320, dx = (i.lon - lon) * 111320 * Math.cos(lat * Math.PI / 180), d = Math.hypot(dx, dy);
      if (d <= lim) c.push({ d, dx, dy, i });
    }
    c.sort((a, b) => a.d - b.d);
    for (const x of c.slice(0, k === "school" || k === "supermarket" ? 2 : 1)) out.push({ label, col, icon, name: String(x.i.n || "").replace(/\s*[-,]?\s*\b(L\.?L\.?C\.?|FZ-?LLC|FZE)\s*$/i, "").slice(0, 44), m: Math.round(x.d / 10) * 10, dx: x.dx, dy: x.dy });
  }
  return out.sort((a, b) => a.m - b.m).slice(0, 8);
}
export function pkNearMap(pos, items, opts) {
  const P = pkNearest(pos, items, 1500);
  if (!P.length) return "";
  const S = (opts && opts.size) || 210, C = S / 2, R = (S * 0.44) / 1000;
  let svg = '<svg width="' + S + '" height="' + S + '" viewBox="0 0 ' + S + " " + S + '" xmlns="http://www.w3.org/2000/svg" style="display:block;flex:none;">' +
    '<rect width="' + S + '" height="' + S + '" rx="12" fill="#F4F1EA"/>' +
    '<circle cx="' + C + '" cy="' + C + '" r="' + (1000 * R).toFixed(1) + '" fill="none" stroke="' + PK.gold + '" stroke-width="1.1" stroke-dasharray="4 4"/>' +
    '<circle cx="' + C + '" cy="' + C + '" r="' + (500 * R).toFixed(1) + '" fill="rgba(197,165,106,0.12)" stroke="' + PK.gold + '" stroke-width="1.1"/>' +
    '<text x="' + C + '" y="' + (C - 500 * R + 10).toFixed(1) + '" font-size="8.5" fill="#8A6A35" text-anchor="middle">500 m</text>' +
    '<text x="' + C + '" y="' + (C - 1000 * R + 10).toFixed(1) + '" font-size="8.5" fill="#8A6A35" text-anchor="middle">1 km</text>' +
    '<text x="' + (S - 8) + '" y="14" font-size="9.5" fill="#626B78" text-anchor="end">N &#8593;</text>';
  P.forEach((q, k) => {
    const x = Math.max(9, Math.min(S - 9, C + q.dx * R)), y = Math.max(9, Math.min(S - 9, C - q.dy * R));
    svg += pkBadge(q.icon, q.col, x, y, 9);
  });
  svg += '<rect x="' + (C - 7) + '" y="' + (C - 7) + '" width="14" height="14" rx="3" fill="#A8814A" stroke="#FFFFFF" stroke-width="2"/></svg>';
  const rows = P.map((q, k) => '<div style="display:flex;align-items:center;gap:7px;font-size:11px;color:' + PK.ink + ';line-height:1.2;">' +
    '<svg width="20" height="20" viewBox="0 0 20 20" style="flex:none;display:block;">' + pkBadge(q.icon, q.col, 10, 10, 9) + "</svg>" +
    '<span style="flex:1;"><b>' + q.label + "</b> &middot; " + pkEsc(pkCase(q.name)) + '</span><span style="font-weight:600;white-space:nowrap;">' + (q.m < 1000 ? q.m + " m" : (q.m / 1000).toFixed(1) + " km") + "</span></div>").join("");
  return '<div style="display:flex;flex-direction:column;gap:8px;"><div style="display:flex;align-items:baseline;gap:10px;"><div class="serif" style="font-size:19px;color:' + PK.teal + ';">What&rsquo;s close, as the crow flies</div>' +
    '<div style="font-size:10px;color:' + PK.muted + ';">straight-line distances, not walking times &middot; rings at 500 m and 1 km</div></div>' +
    '<div style="display:flex;gap:16px;align-items:center;">' + svg + '<div style="flex:1;display:flex;flex-direction:column;gap:5px;">' + rows + "</div></div></div>";
}
