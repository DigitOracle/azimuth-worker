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
