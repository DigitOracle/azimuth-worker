"""Who lives here as a doughnut you can drill into (Kendall, 20 Sep 2026: "can this be a doughnut chart, clickable for the
drill down into"). Click a region and the ring becomes that region's countries; click the middle to come back."""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()


def sub(old, new):
    global s
    assert s.count(old) == 1, old[:70]
    s = s.replace(old, new)


# the region block in the About card becomes the doughnut
old = s[s.index('      (D.people ? "<h3>Who lives here'):s.index('      (D.around.length ? "<h3>Around it</h3>" ')]
new = '''      (D.people ? "<h3>Who lives here · " + esc(D.people.label) + "</h3>" +
        '<div id=donut></div>' +
        (D.people.unknown ? '<div class=src style="margin-top:2px">A further ' + D.people.unknown +
          "% of accounts carry no nationality at all and are not in the ring.</div>" : "") +
        '<div class=src>DEWA customer register for the whole community' + (D.people.accounts ? ", " + fmt(D.people.accounts) + " accounts" : "") +
        ", of the residents whose nationality it holds. There is no building-level figure: a region is shown at any size, a country inside it from " +
        D.people.cfloor + "%, and smaller groups stay pooled so nobody can be identified by subtraction. It is context about an area, not a reason to choose one.</div>" : "") +
'''
s = s.replace(old, new)

# the doughnut itself, drawn and redrawn in place
sub("""  function open_(html) {""",
    """  // Who lives here: a ring of regions, click one to drill into its countries, click the middle to come back
  const RING = ["#C5A56A", "#8FC7B9", "#7FA8C9", "#B9A6C9", "#D9A441", "#D98C6A", "#9FB0A8", "#7E8A86", "#6F8A99"];
  function arc(cx, cy, r, a0, a1) {
    const p = (a) => [cx + r * Math.cos((a - 90) * Math.PI / 180), cy + r * Math.sin((a - 90) * Math.PI / 180)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return "M " + x0.toFixed(2) + " " + y0.toFixed(2) + " A " + r + " " + r + " 0 " + (a1 - a0 > 180 ? 1 : 0) + " 1 " + x1.toFixed(2) + " " + y1.toFixed(2);
  }
  function drawDonut(region) {
    const host = $("donut");
    if (!host || !D.people) return;
    const P = D.people;
    const slices = region
      ? (region.countries || []).map((c, k) => ({ name: c[0], pct: c[1], k: k })).concat(region.others ? [{ name: "others here", pct: region.others, k: 9 }] : [])
      : P.regions.map((r, k) => ({ name: r.name, pct: r.pct, k: k, region: r }));
    const total = slices.reduce((t, x) => t + x.pct, 0) || 1;
    let a = 0;
    const R = 62, IR = 40, C = 74;
    const paths = slices.map((x, i) => {
      const span = 360 * x.pct / total, a0 = a, a1 = a + span;
      a = a1;
      const mid = (a0 + a1) / 2;
      return '<path d="' + arc(C, C, (R + IR) / 2, a0, Math.max(a0 + 0.4, a1 - 0.8)) + '" stroke="' + RING[x.k % RING.length] +
        '" stroke-width="' + (R - IR) + '" fill="none" data-s="' + i + '" style="cursor:' + (x.region ? "pointer" : "default") + '"><title>' +
        esc(x.name) + " " + x.pct + "%</title></path>";
    });
    const centre = region
      ? '<text x="' + C + '" y="' + (C - 4) + '" text-anchor="middle" style="font:600 13px Fraunces,Georgia,serif;fill:#E8E4D8">' + esc(region.name) + "</text>" +
        '<text x="' + C + '" y="' + (C + 12) + '" text-anchor="middle" style="font:500 9px \\'IBM Plex Mono\\',monospace;fill:#C5A56A;cursor:pointer" id=dback>&#8592; all regions</text>'
      : '<text x="' + C + '" y="' + (C + 1) + '" text-anchor="middle" style="font:600 15px Fraunces,Georgia,serif;fill:#E8E4D8">' + P.regions.length + "</text>" +
        '<text x="' + C + '" y="' + (C + 13) + '" text-anchor="middle" style="font:500 8px \\'IBM Plex Mono\\',monospace;fill:#8FA39B">regions</text>";
    const legend = slices.map((x, i) => '<div class=row data-s="' + i + '" style="cursor:' + (x.region ? "pointer" : "default") + '"><span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;background:' +
      RING[x.k % RING.length] + '"></i>' + esc(x.name) + "</span><span>" + x.pct + "%</span></div>").join("");
    host.innerHTML = '<svg viewBox="0 0 148 148" style="width:148px;height:148px;display:block;margin:2px auto 8px">' + paths.join("") + centre + "</svg>" + legend;
    host.querySelectorAll("[data-s]").forEach((el) => {
      el.onclick = () => { const x = slices[+el.dataset.s]; if (x && x.region) drawDonut(x.region); };
    });
    const back = host.querySelector("#dback");
    if (back) back.onclick = () => drawDonut(null);
  }

  function open_(html) {""")

# draw it whenever the About card opens
sub("""  function open_(html) { const c = $("card"); c.innerHTML = '<span class=x>&times;</span>' + html; c.style.display = "block"; c.scrollTop = 0; c.querySelector(".x").onclick = close_; }""",
    """  function open_(html) { const c = $("card"); c.innerHTML = '<span class=x>&times;</span>' + html; c.style.display = "block"; c.scrollTop = 0;
    c.querySelector(".x").onclick = close_; if ($("donut")) drawDonut(null); }""")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("doughnut in:", len(s), "chars")
