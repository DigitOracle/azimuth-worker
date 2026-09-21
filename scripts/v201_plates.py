"""The indicative floor plate on the building page (video session's handover, 21 Sep 2026; Kendall asked for it directly).

Replaces the wedge schematic with the real thing: every home a cell laid round the facade at its registered size, lifts and
stairs where the plate has cores, the podium drawn dashed with the floor inside it, and the floors that cannot be drawn saying
why. Unit numbers come from labels[floor] by the cell's run index - cells can be SHORTER than labels, so a missing one falls back
to the type letter and nothing is ever renumbered.

Every plate carries its caveat on screen, in the handover's words: the outline is surveyed, the sizes are the register's, and
where each home sits is NOT published for this building. That is the line that makes it defensible.
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

# the plate comes with the page, per building
s = s.replace("export function buildingData(slug, id, stack, umx, bf, anchors, people, districtName, plansIndex, units) {",
              "export function buildingData(slug, id, stack, umx, bf, anchors, people, districtName, plansIndex, units, plate) {", 1)
s = s.replace("    flats: units || null,",
              "    flats: units || null,\n    plate: (plate && plate.building) || null, plateNote: (plate && plate.note) || null,", 1)

start = s.index("  function plateSVG(f) {")
end = s.index("  function pick(j) {")
new = r'''  // The plate, from the handover: cells round the facade at the register's sizes, cores where the plate has them, the podium
  // dashed with the floor inside it. Positions are indicative and the caveat under it says so.
  const SHORT = { studio: "S", "1": "1", "2": "2", "3": "3", "4": "4", office: "O", retail: "R", other: "" };
  const USEN2 = { homes: "homes", hotel: "hotel", office: "offices", retail: "retail", services: "services" };
  const LIFT = "#5B6662", STAIR = "#9A95D6", PLATE = "#2B3532", INK = "#0E1613";
  function plateFor(f) {
    const b = D.plate;
    if (!b || !b.floors) return null;
    const ix = b.floors[String(f.l)];
    if (ix === undefined || !b.plates || !b.plates[ix]) return null;
    return { b: b, p: b.plates[ix], labels: (b.labels || {})[String(f.l)] };
  }
  function plateDraw(b, p, labels) {
    const o = b.outline, xs = [], ys = [];
    for (let i = 0; i < o.length; i += 2) { xs.push(o[i]); ys.push(o[i + 1]); }
    const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    const pad = Math.max(3, (x1 - x0) * 0.03), W = 1000, k = W / (x1 - x0 + 2 * pad), H = (y1 - y0 + 2 * pad) * k;
    const T = (a) => { let t = ""; for (let i = 0; i < a.length; i += 2) t += ((a[i] - x0 + pad) * k).toFixed(1) + "," + ((y1 - a[i + 1] + pad) * k).toFixed(1) + " "; return t; };
    let h = '<svg class=plate viewBox="0 0 ' + W + " " + H.toFixed(0) + '">';
    if (p.tower)
      h += '<polygon points="' + T(o) + '" fill="' + PLATE + '" fill-opacity=".3" stroke="#C5A56A" stroke-opacity=".45" stroke-width="1.4" stroke-dasharray="7 6"/>' +
           '<polygon points="' + T(p.tower) + '" fill="' + PLATE + '" stroke="#C5A56A" stroke-opacity=".6" stroke-width="1.8"/>';
    else
      h += '<polygon points="' + T(o) + '" fill="' + (p.cells.length ? PLATE : (COL[p.use] || PLATE)) + '" fill-opacity="' +
           (p.cells.length ? 1 : 0.35) + '" stroke="#C5A56A" stroke-opacity=".6" stroke-width="1.8"/>';
    for (const cell of p.cells) {
      const c = cell[0], a = cell[1], idx = cell[2];
      const lab = labels && labels[idx] !== undefined ? labels[idx] : (SHORT[c] || "");
      h += '<polygon points="' + T(a) + '" fill="' + (COL[c] || COL.other) + '" stroke="' + INK + '" stroke-width="1.5" stroke-linejoin="round"/>';
      let cx = 0, cy = 0, mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
      for (let i = 0; i < a.length; i += 2) { cx += a[i]; cy += a[i + 1];
        mnx = Math.min(mnx, a[i]); mxx = Math.max(mxx, a[i]); mny = Math.min(mny, a[i + 1]); mxy = Math.max(mxy, a[i + 1]); }
      cx /= a.length / 2; cy /= a.length / 2;
      if (Math.max(mxx - mnx, mxy - mny) * k > 16 && Math.min(mxx - mnx, mxy - mny) * k > 9)
        h += '<text x="' + ((cx - x0 + pad) * k).toFixed(1) + '" y="' + ((y1 - cy + pad) * k + 4).toFixed(1) + '" font-size="' +
             (labels ? Math.min(12, Math.max(7.5, k * 1.5)) : Math.min(15, Math.max(9, k * 2.2))).toFixed(1) +
             '" font-weight="600" text-anchor="middle" fill="' + INK + '" fill-opacity=".8">' + esc(lab) + "</text>";
    }
    for (const bl of p.blocks || [])
      h += '<polygon points="' + T(bl[1]) + '" fill="' + (bl[0] === "lift" ? LIFT : STAIR) + '" stroke="' + INK + '" stroke-width="1.3"/>';
    if (!p.cells.length)
      h += '<text x="' + W / 2 + '" y="' + (H / 2 + 5).toFixed(1) + '" font-size="17" letter-spacing="3" text-anchor="middle" fill="#E8E4D8" fill-opacity=".8">' +
           esc((USEN2[p.use] || p.use).toUpperCase()) + "</text>";
    h += '<g transform="translate(' + (W - 40) + ',38) rotate(' + (-b.north).toFixed(1) + ')"><circle r="17" fill="' + INK +
         '" fill-opacity=".6" stroke="#C5A56A" stroke-opacity=".6"/><path d="M0,-12 L5,7 L0,3 L-5,7 Z" fill="#C5A56A"/>' +
         '<text y="-21" font-size="11" fill="#C5A56A" text-anchor="middle">N</text></g></svg>';
    return h;
  }
  // the words that make it defensible - the handover's, verbatim
  function plateSays(b, p) {
    const basis = { units: "The unit numbers, types and sizes are the Land Department units register's, one row per unit; they are laid round the facade in unit-number order.",
      municipality: "How many homes this floor carries is the Municipality's count for the floor, shared between the types the Land Department register puts on it.",
      register: "How many homes of each type this floor carries is the Land Department register's units for the type, spread evenly over the floors the register gives it." }[p.basis] || "";
    let extra = "";
    if (p.basis !== "units") extra += " No unit numbers are shown: the units register does not cover this building well enough.";
    if (p.dm_use) extra += " The Municipality records this floor as " + esc(p.dm_use) + "; the Land Department register lists these homes on it, so they are drawn.";
    if (p.tower) extra += " The footprint (dashed) is far larger than the floor the register describes, so it is read as a podium: the floor is drawn inside it at the size the register implies.";
    return "<b>Indicative layout.</b> The outline is this building's surveyed footprint; the sizes of the homes against each other are the register's. " +
      basis + extra + " Where each home sits, and where the lifts and stairs are, is not published for this building — that comes from a Revit model or the developer's stacking plan, as on The Symphony.";
  }
  function plateSVG(f) {
    const got = plateFor(f);
    if (!got) return "";
    const b = got.b, p = got.p;
    if (p.skip)
      return "<h3>The floor plate</h3><div class=src>" +
        (p.skip === "small"
          ? "Not drawn: the register puts more homes on this floor than this footprint can hold — several buildings are probably bound to one record."
          : "Not drawn: too many units on one floor to draw.") + "</div>";
    const legend = (p.counts || []).map((c) => '<span class=lg><i style="background:' + (COL[c[0]] || COL.other) + '"></i>' +
      esc({ studio: "Studio", "1": "1 bed", "2": "2 bed", "3": "3 bed", "4": "4 bed +", office: "Office", retail: "Retail" }[c[0]] || c[0]) +
      " · " + c[1] + (c[2] ? " · " + fmt(c[2] * 10.7639) + " sq ft" : "") + "</span>").join("") +
      ((p.blocks || []).length ? '<span class=lg><i style="background:' + LIFT + '"></i>lifts' + (b.lifts ? " · " + b.lifts : "") + "</span>" +
        '<span class=lg><i style="background:' + STAIR + '"></i>stairs</span>' : "");
    return "<h3>The floor plate</h3>" +
      '<div class=lvl>LEVEL ' + esc(f.l) + "</div>" + plateDraw(b, p, got.labels) +
      (legend ? '<div class=lgs>' + legend + "</div>" : "") +
      '<div class=src>' + plateSays(b, p) + "</div>";
  }

'''
s = s[:start] + new + s[end:]

# chrome for the legend and the level line
s = s.replace("#tab{display:none}",
              "#tab{display:none}\n"
              ".lvl{font:600 .62rem 'IBM Plex Mono',monospace;letter-spacing:.24em;color:var(--gold);text-align:center;margin:4px 0 2px}\n"
              ".lgs{display:flex;flex-wrap:wrap;gap:4px 10px;margin:6px 0 2px}\n"
              ".lg{display:inline-flex;align-items:center;gap:5px;font-size:.55rem;letter-spacing:.04em;color:rgba(232,228,216,.8)}\n"
              ".lg i{width:9px;height:9px;border-radius:2px;display:inline-block}", 1)
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("plates in:", len(s), "chars")
