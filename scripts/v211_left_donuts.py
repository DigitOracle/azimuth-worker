"""What is left, as a row of rings - one per bedroom type (Kendall, 21 Sep 2026).

"I think that the what's left should be like donut charts. So for studio, one bedroom, two bedroom, three bedroom, four
bedroom, or whatever the case may be, these should be in a horizontal row. And they should be donut charts. So you can see
very quickly what's left in each of those."

What it replaces: one ring for the whole building, which answers "how much of this building has gone" - not the question a
broker is actually asked, which is "can I still get a two-bed". That took reading five rows.

Rules the row keeps:
  * the count LEFT in the middle, the type under it, the launched total small. Not a percentage: "3 of 16" is the answer.
  * each ring in its own type's colour, the same palette the model is painted with when a building is selected, so the row
    reads against the tower.
  * a sold-out type still gets its ring, full, with 0 in the middle. The absence is information, and dropping it would change
    the row's shape from building to building.
  * a type the register does not count gets no ring at all rather than an empty one - the contract, everywhere: omit, never
    fill.
  * tapping a ring still drills in and still filters the tower, which is what the old ring's segments did.

  python scripts/v211_left_donuts.py
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

OLD = """    if (!only) {
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
    }"""

NEW = """    if (!only) {
      const rows = D.register.filter((r) => r.launched);
      const left = rows.reduce((t, r) => t + Math.max(0, (r.launched || 0) - (r.sold || 0)), 0);
      const units = rows.reduce((t, r) => t + (r.launched || 0), 0);
      if (tag) tag.textContent = fmt(left) + " left of " + fmt(units);
      // one ring per type, left against launched. A full ring is sold out; a gap is something to sell.
      const R = 19, C = 2 * Math.PI * R;
      host.innerHTML = '<div class=drow>' + rows.map((r, i) => {
        const all = r.launched || 0, rest = Math.max(0, all - (r.sold || 0));
        const frac = all ? rest / all : 0;
        return '<a class=dcell data-dt="' + i + '"><svg viewBox="0 0 48 48">' +
          '<circle cx=24 cy=24 r="' + R + '" fill=none stroke="rgba(232,228,216,.14)" stroke-width=5.5></circle>' +
          (frac > 0 ? '<circle cx=24 cy=24 r="' + R + '" fill=none stroke="' + col(r.c) + '" stroke-width=5.5 stroke-linecap=round ' +
            'stroke-dasharray="' + (frac * C).toFixed(1) + " " + C.toFixed(1) + '" transform="rotate(-90 24 24)"></circle>'
            : '<circle cx=24 cy=24 r="' + R + '" fill=none stroke="' + col(r.c) + '" stroke-width=5.5 stroke-opacity=".35"></circle>') +
          '<text x=24 y=28 text-anchor=middle class=dnum>' + fmt(rest) + "</text></svg>" +
          "<b>" + esc(r.type) + "</b><small>of " + fmt(all) + "</small></a>";
      }).join("") + "</div>";
      host.querySelectorAll("[data-dt]").forEach((el) => {
        const r = rows[+el.dataset.dt];
        el.onclick = () => { state.on = new Set([r.c]); state.use = new Set();
          document.querySelectorAll("[data-t]").forEach((b) => b.classList.toggle("off", b.dataset.t !== r.c));
          document.querySelectorAll("[data-u]").forEach((b) => b.classList.add("off"));
          hideLabel(); paint(); drawSold(r); };
      });
      return;
    }"""
assert s.count(OLD) == 1
s = s.replace(OLD, NEW)

# chrome: five rings fit a 375 px phone at about 64 px each, and wrap below that rather than squeezing the numbers
OLD2 = """#tab{display:none}"""
NEW2 = """#tab{display:none}
.drow{display:flex;flex-wrap:wrap;gap:6px 4px;justify-content:space-between;margin:4px 0 2px}
.dcell{flex:1 1 56px;min-width:52px;max-width:78px;text-align:center;cursor:pointer;text-decoration:none;color:inherit}
.dcell svg{display:block;width:100%;height:auto}
.dcell .dnum{font:600 15px 'IBM Plex Mono',monospace;fill:var(--text)}
.dcell b{display:block;font:600 .5rem 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--text);margin-top:2px}
.dcell small{display:block;font:400 .46rem 'IBM Plex Mono',monospace;color:var(--mut)}
.dcell:hover .dnum{fill:var(--gold)}"""
assert s.count(OLD2) == 1
s = s.replace(OLD2, NEW2)

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("what is left, as a row of rings:", len(s), "chars")
