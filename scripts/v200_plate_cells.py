"""A plate with the flats on it (Kendall, 21 Sep 2026: "the floor plate must define which flat numbers are where ... still blank").

What is true and what is drawn, kept apart on purpose:
  TRUE   the outline (this building's surveyed footprint, at its real size and orientation), the number of flats on the floor,
         each flat's own number, its type and its registered area, and the core sitting in the middle of the plate.
  DRAWN  how those flats are arranged around the core. The DLD units register has no view, facing, side or orientation column -
         all 47 were checked - and the plan library holds unit-type drawings, not numbered plates. So the wedges are ordered by
         unit number and sized by registered area: the SIZES are to scale, the SIDES are not known.

The drawing says so in the plate itself and in the caption, and the wedges are dashed to read as a schematic rather than a
survey. Where a Revit model or a developer's numbered plate exists - The Symphony - that replaces this entirely.
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

start = s.index("  function plateSVG(f) {")
end = s.index("  function pick(j) {")
new = '''  function plateSVG(f) {
    const hull = plateOutline();
    if (!hull || hull.length < 3) return "";
    const xs = hull.map((p) => p[0]), zs = hull.map((p) => p[1]);
    const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), z0 = Math.min.apply(null, zs), z1 = Math.max.apply(null, zs);
    const w = Math.max(1, x1 - x0), h = Math.max(1, z1 - z0), pad = Math.max(w, h) * 0.14, S = Math.max(w, h);
    const P2 = hull.map((p) => [p[0] - x0 + pad, p[1] - z0 + pad]);
    const ring = P2.map((p) => p.join(",")).join(" ");
    const cx = P2.reduce((t, p) => t + p[0], 0) / P2.length, cy = P2.reduce((t, p) => t + p[1], 0) / P2.length;
    const F = (D.flats && D.flats.floors ? D.flats.floors[String(f.n)] : null) || [];
    const homes = f.k ? f.k + (f.k === 1 ? " home" : " homes") : (USEN[f.u] || f.u);
    // where a ray from the middle of the plate meets its edge
    const edge = (ang) => {
      const dx = Math.cos(ang), dy = Math.sin(ang);
      let best = null;
      for (let i = 0; i < P2.length; i++) {
        const a = P2[i], b = P2[(i + 1) % P2.length];
        const ex = b[0] - a[0], ey = b[1] - a[1];
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((a[0] - cx) * ey - (a[1] - cy) * ex) / den;
        const u = ((a[0] - cx) * dy - (a[1] - cy) * dx) / den;
        if (t > 0 && u >= 0 && u <= 1 && (best === null || t < best)) best = t;
      }
      return best === null ? [cx, cy] : [cx + dx * best, cy + dy * best];
    };
    let cells = "", labels = "";
    if (F.length) {
      const tot = F.reduce((t, x) => t + (x.sqft || 1), 0) || F.length;
      const core = Math.min(w, h) * 0.17;
      let a0 = -Math.PI / 2;                              // start due north, go clockwise, so the drawing reads with the compass
      F.forEach((x, i) => {
        const span = 2 * Math.PI * ((x.sqft || tot / F.length) / tot);
        const a1 = a0 + span, mid = (a0 + a1) / 2;
        const pts = [[cx + Math.cos(a0) * core, cy + Math.sin(a0) * core], edge(a0)];
        for (let k = 0; k <= 6; k++) pts.push(edge(a0 + span * (k / 6)));
        pts.push(edge(a1), [cx + Math.cos(a1) * core, cy + Math.sin(a1) * core]);
        const col = COL[x.c] || COL.other;
        cells += '<polygon points="' + pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ") +
          '" fill="' + col + '" fill-opacity=".30" stroke="' + col + '" stroke-width="' + (S / 260).toFixed(2) +
          '" stroke-dasharray="' + (S / 90).toFixed(1) + " " + (S / 150).toFixed(1) + '"/>';
        const lx = cx + Math.cos(mid) * (core + (edgeDist(mid, core) * 0.45)), ly = cy + Math.sin(mid) * (core + (edgeDist(mid, core) * 0.45));
        if (span > 0.28) labels += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle" style="fill:#0C1413;font-weight:700" font-size="' +
          (S / 26).toFixed(1) + '">' + esc(x.u) + "</text>";
      });
      cells += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + core.toFixed(1) +
        '" fill="rgba(12,20,19,.75)" stroke="rgba(197,165,106,.5)" stroke-width="' + (S / 300).toFixed(2) + '"/>' +
        '<text x="' + cx.toFixed(1) + '" y="' + (cy + S / 60).toFixed(1) + '" text-anchor="middle" style="fill:#8FA39B" font-size="' +
        (S / 30).toFixed(1) + '">core</text>';
    }
    function edgeDist(ang, core) { const e = edge(ang); return Math.max(core, Math.hypot(e[0] - cx, e[1] - cy)) - core; }
    return "<h3>The floor plate</h3>" +
      '<svg class=plate viewBox="0 0 ' + (w + 2 * pad).toFixed(1) + " " + (h + 2 * pad).toFixed(1) + '">' +
      '<polygon points="' + ring + '" fill="rgba(197,165,106,.10)" stroke="#C5A56A" stroke-width="' + (S / 160).toFixed(2) + '"/>' +
      cells + labels +
      '<text x="' + ((w + 2 * pad) / 2).toFixed(1) + '" y="' + (pad * 0.66).toFixed(1) + '" text-anchor="middle" style="fill:#8FA39B" font-size="' +
      (S / 24).toFixed(1) + '">N &#8593;</text>' +
      (F.length ? '<text x="' + ((w + 2 * pad) / 2).toFixed(1) + '" y="' + (h + 2 * pad - pad * 0.28).toFixed(1) +
        '" text-anchor="middle" style="fill:rgba(143,163,155,.85)" font-size="' + (S / 30).toFixed(1) +
        '">sizes to scale · sides not published</text>' : "") + "</svg>" +
      '<div class=src>' + esc(label(f)) + " · " + esc(homes) + (f.a ? " · " + fmt(f.a * 10.764) + " sq ft on the floor" : "") +
      ". The outline is this building's own footprint from the survey the model is built on, at its true size and orientation" +
      (F.length ? ", and each flat is drawn at its registered size in unit-number order around the core. Which SIDE of the floor a flat sits on is not published in any register - the units register has no view, facing or orientation column - so the arrangement is a schematic, not a survey. A numbered plate comes from a Revit model or a developer's floor-plan deck, as on The Symphony."
        : ". No flat numbers are held for this floor.") + "</div>";
  }

'''
s = s[:start] + new + s[end:]
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("plate cells in:", len(s), "chars")
