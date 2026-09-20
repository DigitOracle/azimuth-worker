"""Sold so far as a doughnut in the filter panel, drilling into sold vs left, and filtering the tower as it goes.
(Kendall, 20 Sep 2026: "826 sold out of 1034 ... put that in a donut chart with the filter being one bedroom two bedroom three
bedroom ... that reads much easier".)

The ring drawing is shared with Who lives here, so both behave the same: click a slice to drill, click the middle to come back.
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()


def sub(old, new):
    global s
    assert s.count(old) == 1, old[:70]
    s = s.replace(old, new)


# 1. the panel: the table becomes a ring (the source line stays)
sub("""      (D.register.length ? '<div class=grp>Sold so far</div><table class=reg><tr><th>type</th><th>sold</th><th>of</th><th>settles at</th></tr>' + regRows + "</table>" +
        '<div class=src>Dubai Land Department units register. Counts by type, not by unit number: which homes are sold is not published.</div>' : "") +""",
    """      (D.register.length ? '<div class=grp>Sold so far <u id=soldtag></u></div><div id=sold></div>' +
        '<div class=src>Dubai Land Department units register. Counts by type, not by unit number: which homes are sold is not published.</div>' : "") +""")

# 2. one ring drawer for both charts
sub("""  function drawDonut(region) {""",
    """  // one ring, two uses: slices = [{name, pct, col, sub, on}], centre = [big, small, backLabel]
  function ring(host, slices, centre, back) {
    if (!host) return;
    const total = slices.reduce((t, x) => t + x.pct, 0) || 1;
    let a = 0;
    const R = 62, IR = 40, C = 74;
    const paths = slices.map((x, i) => {
      const span = 360 * x.pct / total, a0 = a, a1 = a + span;
      a = a1;
      return '<path d="' + arc(C, C, (R + IR) / 2, a0, Math.max(a0 + 0.4, a1 - 0.8)) + '" stroke="' + x.col +
        '" stroke-width="' + (R - IR) + '" fill="none" data-s="' + i + '" style="cursor:' + (x.on ? "pointer" : "default") +
        '"><title>' + esc(x.name) + " " + x.pct + (x.sub ? " · " + esc(x.sub) : "") + "</title></path>";
    });
    const mid = '<text x="' + C + '" y="' + (C - 2) + '" text-anchor="middle" style="font:600 14px Fraunces,Georgia,serif;fill:#E8E4D8">' + esc(centre[0]) + "</text>" +
      '<text x="' + C + '" y="' + (C + 11) + '" text-anchor="middle" style="font:500 8px \\'IBM Plex Mono\\',monospace;fill:#8FA39B">' + esc(centre[1]) + "</text>" +
      (back ? '<text x="' + C + '" y="' + (C + 24) + '" text-anchor="middle" style="font:500 8px \\'IBM Plex Mono\\',monospace;fill:#C5A56A;cursor:pointer" data-back="1">&#8592; back</text>' : "");
    const legend = slices.map((x, i) => '<div class=row data-s="' + i + '" style="cursor:' + (x.on ? "pointer" : "default") +
      '"><span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;background:' + x.col + '"></i>' +
      esc(x.name) + (x.sub ? "<br><small>" + esc(x.sub) + "</small>" : "") + "</span><span>" + x.label + "</span></div>").join("");
    host.innerHTML = '<svg viewBox="0 0 148 148" style="width:140px;height:140px;display:block;margin:2px auto 6px">' + paths.join("") + mid + "</svg>" + legend;
    host.querySelectorAll("[data-s]").forEach((el) => { const x = slices[+el.dataset.s]; if (x && x.on) el.onclick = () => x.on(); });
    const b = host.querySelector("[data-back]");
    if (b && back) b.onclick = back;
  }

  // Sold so far: the register's units by type, drilling into sold against what is left, and filtering the tower with it
  function drawSold(only) {
    const host = $("sold");
    if (!host || !D.register.length) return;
    const tag = $("soldtag");
    const col = (c) => COL[c] || COL.other;
    if (!only) {
      const left = D.register.reduce((t, r) => t + Math.max(0, (r.launched || 0) - (r.sold || 0)), 0);
      const units = D.register.reduce((t, r) => t + (r.launched || 0), 0);
      if (tag) tag.textContent = fmt(left) + " left";
      ring(host, D.register.filter((r) => r.launched).map((r) => ({
        name: r.type, pct: r.launched, col: col(r.c), label: fmt(r.launched),
        sub: fmt(Math.max(0, r.launched - (r.sold || 0))) + " left of " + fmt(r.launched),
        on: () => { state.on = new Set([r.c]); state.use = new Set();
          document.querySelectorAll("[data-t]").forEach((b) => b.classList.toggle("off", b.dataset.t !== r.c));
          document.querySelectorAll("[data-u]").forEach((b) => b.classList.add("off"));
          hideLabel(); paint(); drawSold(r); },
      })), [fmt(units), "homes registered"], null);
      return;
    }
    const sold = only.sold || 0, all = only.launched || 0, rest = Math.max(0, all - sold);
    if (tag) tag.textContent = fmt(rest) + " left";
    ring(host, [
      { name: "sold", pct: sold || 0.001, col: col(only.c), label: fmt(sold) + " · " + Math.round(100 * sold / (all || 1)) + "%" },
      { name: "still to sell", pct: rest || 0.001, col: "rgba(232,228,216,.16)", label: fmt(rest) },
    ], [fmt(rest), "left of " + fmt(all)], () => { drawSold(null); });
    const note = document.createElement("div");
    note.className = "src";
    note.innerHTML = esc(only.type) + (only.median ? " · settles at " + (only.est ? "~" : "") + aed(only.median) : "") +
      (only.sqm ? " · " + fmt(only.sqm * 10.764) + " sq ft median" : "") +
      (only.yield ? " · " + only.yield + "% yield" : "");
    host.appendChild(note);
  }

  function drawDonut(region) {""")

# 3. the people chart uses the shared ring too
old = s[s.index("  function drawDonut(region) {"):s.index("  function open_(html) {")]
new = '''  function drawDonut(region) {
    const host = $("donut");
    if (!host || !D.people) return;
    const P = D.people;
    const slices = region
      ? (region.countries || []).map((c, k) => ({ name: c[0], pct: c[1], col: RING[k % RING.length], label: c[1] + "%" }))
          .concat(region.others ? [{ name: "others here", pct: region.others, col: "rgba(232,228,216,.16)", label: region.others + "%" }] : [])
      : P.regions.map((r, k) => ({ name: r.name, pct: r.pct, col: RING[k % RING.length], label: r.pct + "%",
          sub: (r.countries || []).slice(0, 2).map((c) => c[0] + " " + c[1] + "%").join(" · "),
          on: () => drawDonut(r) }));
    ring(host, slices, region ? [region.pct + "%", esc(region.name)] : [String(P.regions.length), "regions"], region ? () => drawDonut(null) : null);
  }

'''
s = s.replace(old, new)

# 4. draw the sold ring once the panel exists
sub("""  hideLabel(); count();
}""", """  hideLabel(); count(); drawSold(null);
}""")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("sold doughnut in:", len(s), "chars")
