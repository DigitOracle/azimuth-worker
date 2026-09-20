"""The plan, and where the floor sits (Kendall, 20 Sep 2026: the Symphony unit card's "THE PLAN" and "WHERE IT SITS ON THE
FLOOR" - "this should be part of about the building as well").

Two halves, and only one of them can be honest for every building:

  THE PLANS - the app already holds 4,094 floor plans by developer and project (plans_index). Where this building's project is
  in that library, its plans belong on its page. Where it is not, nothing is drawn - a plan cannot be invented.

  THE FLOOR PLATE - Symphony's plate shows each unit outlined and the chosen one in red, because a Revit model knows where every
  flat is. For everyone else we know the plate's true SHAPE (the ArcGIS footprint the model is extruded from) and how many homes
  the register puts on that floor, but not one internal wall. So the plate is drawn from the building's own footprint, with the
  floor's home count beside it, and it says plainly that the division between homes is not held.
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()


def sub(old, new):
    global s
    assert s.count(old) == 1, old[:70]
    s = s.replace(old, new)


# 1. the data: the project's plans from the library the /plans page uses
sub("export function buildingData(slug, id, stack, umx, bf, anchors, people, districtName) {",
    "export function buildingData(slug, id, stack, umx, bf, anchors, people, districtName, plansIndex) {")

sub("""    developer: u.developer || null,""",
    """    plans: plansFor(plansIndex, r.name, (u.dld || {}).project, u.developer),
    developer: u.developer || null,""")

sub("// ---- the page -------",
    """// The floor plans this building's project has in the library. Matched on the project name, both ways, so "Bay Square - 02"
// finds "Bay Square" and "The Symphony" finds "The Symphony by Imtiaz". Nothing is guessed: no match, no plans.
function plansFor(index, name, project, developer) {
  const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\\b(the|by|tower|towers|residences|residence|building)\\b/g, " ").replace(/\\s+/g, " ").trim();
  const mine = [norm(name), norm(project)].filter((x) => x.length > 3);
  if (!mine.length) return null;
  for (const d of ((index && index.developers) || [])) {
    for (const p of (d.projects || [])) {
      const pn = norm(p.name);
      if (!pn) continue;
      if (!mine.some((m) => m === pn || (m.length > 5 && pn.indexOf(m) >= 0) || (pn.length > 5 && m.indexOf(pn) >= 0))) continue;
      const plans = (p.plans || []).filter((x) => x.url).slice(0, 12)
        .map((x) => ({ label: x.label || x.kind || "plan", url: x.url, source: x.source || null }));
      if (plans.length) return { developer: d.name || developer || null, project: p.name, note: p.note || null, plans };
    }
  }
  return null;
}

// ---- the page -------""")

# 2. the About card: the plans
sub("""      (D.around.length ? "<h3>Around it</h3>" ""","""      (D.plans ? "<h3>The plans · " + esc(D.plans.project) + "</h3>" +
        '<div class=plans>' + D.plans.plans.map((p) => '<a href="' + esc(p.url) + '" target=_blank rel=noopener><img loading=lazy src="' +
          esc(p.url) + '" alt="' + esc(p.label) + '"><b>' + esc(p.label) + "</b></a>").join("") + "</div>" +
        '<div class=src>' + (D.plans.note ? esc(D.plans.note) + ". " : "") +
        "Developer material from the app's plan library, shown to the broker who sells it; each plan names its source on the PLANS page.</div>" : "") +
      (D.around.length ? "<h3>Around it</h3>" """)

# 3. the floor card: the plate, drawn from the building's own footprint
sub("""      (ts.length ? "<h3>The types the register puts on this floor</h3>\"""",
    """      plateSVG(f) +
      (ts.length ? "<h3>The types the register puts on this floor</h3>\"""")

sub("""  function pick(j) {""",
    """  // the plate: the true outline of the building at its base, from the model's own geometry, with the floor's homes beside it.
  // No internal division is drawn, because none is held - only a Revit model or a developer's deck knows where the walls are.
  let PLATE = null;
  function plateOutline() {
    if (PLATE !== null || !MESH.length) return PLATE;
    const pts = [];
    for (const m of MESH) {
      const g = m.geometry, pos = g.attributes && g.attributes.position;
      if (!pos) continue;
      g.computeBoundingBox();
      const lowY = g.boundingBox.min.y + Math.max(0.5, (g.boundingBox.max.y - g.boundingBox.min.y) * 0.02);
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y <= lowY) pts.push([pos.getX(i), pos.getZ(i)]);
      }
    }
    if (pts.length < 3) { PLATE = false; return PLATE; }
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);                      // monotone chain hull: the plate's outline
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [], upper = [];
    for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    PLATE = lower.slice(0, -1).concat(upper.slice(0, -1));
    return PLATE;
  }
  function plateSVG(f) {
    const hull = plateOutline();
    if (!hull || hull.length < 3) return "";
    const xs = hull.map((p) => p[0]), zs = hull.map((p) => p[1]);
    const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), z0 = Math.min.apply(null, zs), z1 = Math.max.apply(null, zs);
    const w = Math.max(1, x1 - x0), h = Math.max(1, z1 - z0), pad = Math.max(w, h) * 0.12;
    const pts = hull.map((p) => (p[0] - x0 + pad).toFixed(1) + "," + (p[1] - z0 + pad).toFixed(1)).join(" ");
    const homes = f.k ? f.k + (f.k === 1 ? " home" : " homes") : (USEN[f.u] || f.u);
    return "<h3>The floor plate</h3>" +
      '<svg class=plate viewBox="0 0 ' + (w + 2 * pad).toFixed(1) + " " + (h + 2 * pad).toFixed(1) + '">' +
      '<polygon points="' + pts + '" fill="rgba(197,165,106,.14)" stroke="#C5A56A" stroke-width="' + (Math.max(w, h) / 160).toFixed(2) + '"/>' +
      '<text x="' + ((w + 2 * pad) / 2).toFixed(1) + '" y="' + (pad * 0.72).toFixed(1) + '" text-anchor="middle" style="fill:#8FA39B" font-size="' +
      (Math.max(w, h) / 22).toFixed(1) + '">N &#8593;</text></svg>' +
      '<div class=src>' + esc(label(f)) + " · " + esc(homes) + (f.a ? " · " + fmt(f.a * 10.764) + " sq ft on the floor" : "") +
      ". The outline is this building's own footprint, from the survey the model is built on. Where the walls between those homes " +
      "run is not published: that comes from a Revit model or the developer's floor-plan deck, as on The Symphony.</div>";
  }

  function pick(j) {""")

# 4. the chrome for both
sub("#tab{display:none}",
    "#tab{display:none}\n"
    ".plans{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}\n"
    ".plans a{display:block;text-decoration:none;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:rgba(12,20,19,.5)}\n"
    ".plans img{display:block;width:100%;height:92px;object-fit:cover;background:#F6F3EC}\n"
    ".plans b{display:block;padding:5px 7px;font-size:.55rem;letter-spacing:.08em;text-transform:uppercase;color:var(--gold)}\n"
    ".plate{display:block;width:100%;max-height:190px;margin:6px 0 2px}")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("plans and plate in:", len(s), "chars")
