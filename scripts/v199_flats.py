"""The flats on the floor (Kendall, 21 Sep 2026: "the floor plate must define which flat numbers are where ... a blank space
tells me nothing").

What the register gives and what it does not: the DLD units register names every flat and the floor it is on - 1301 is a studio
of 452 sq ft on floor 13 - but nothing in it says where on the plate that flat sits. So the card now lists the flats, with their
number, type and size, and the plate keeps the true outline while saying plainly that the order is not the arrangement. Drawing
them around the outline would be inventing positions; naming them is the most the register can honestly support.

Position comes only from a Revit model or a developer's floor-plan deck - The Symphony, where a unit shows in red on its plate.
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()


def sub(old, new):
    global s
    assert s.count(old) == 1, old[:70]
    s = s.replace(old, new)


sub("export function buildingData(slug, id, stack, umx, bf, anchors, people, districtName, plansIndex) {",
    "export function buildingData(slug, id, stack, umx, bf, anchors, people, districtName, plansIndex, units) {")

sub("    nameId: r.name_id || null, verdict: r.conflict_verdict || null,",
    "    nameId: r.name_id || null, verdict: r.conflict_verdict || null,\n"
    "    flats: units || null,          // { units, registered, cover, floors: { '13': [{u, t, c, sqft, bal, sub}] } }")

# the floor card: the flats themselves, above the plate
sub("""      plateSVG(f) +""",
    """      flatsHtml(f) +
      plateSVG(f) +""")

sub("""  function plateSVG(f) {""",
    """  // every flat the register puts on this floor: its number, what it is, how big. Not where it sits - nothing published says that.
  function flatsHtml(f) {
    const F = D.flats && D.flats.floors ? D.flats.floors[String(f.n)] : null;
    if (!F || !F.length) return "";
    const rows = F.map((x) => '<div class=row><span><b style="color:#E8E4D8">' + esc(x.u || "?") + "</b>" +
      (x.sub && x.sub !== "Flat" ? " <small>" + esc(x.sub) + "</small>" : "") + "</span><span>" + esc(x.t || "") +
      (x.sqft ? " · " + fmt(x.sqft) + " sq ft" : "") + (x.bal ? "<br><small>" + fmt(x.bal) + " sq ft balcony</small>" : "") +
      "</span></div>").join("");
    return "<h3>The flats on this floor · " + F.length + "</h3>" + rows +
      '<div class=src>Dubai Land Department units register: every flat registered on this floor, by its own number. ' +
      (D.flats.cover < 100 ? "It holds " + fmt(D.flats.units) + " of this building's " + fmt(D.flats.registered) + " registered homes (" + D.flats.cover + "%). " : "") +
      "Which side of the floor each one sits on is not published anywhere - that comes from a Revit model or the developer's floor-plan deck.</div>";
  }

  function plateSVG(f) {""")

# the plate's own caption stops apologising for being empty and says what the outline is for
sub('''      '<div class=src>' + esc(label(f)) + " · " + esc(homes) + (f.a ? " · " + fmt(f.a * 10.764) + " sq ft on the floor" : "") +
      ". The outline is this building's own footprint, from the survey the model is built on. Where the walls between those homes " +
      "run is not published: that comes from a Revit model or the developer's floor-plan deck, as on The Symphony.</div>";''',
    '''      '<div class=src>' + esc(label(f)) + " · " + esc(homes) + (f.a ? " · " + fmt(f.a * 10.764) + " sq ft on the floor" : "") +
      ". The outline is this building's own footprint, from the survey the model is built on, at the floor's true size and orientation. " +
      "The walls inside it are not drawn because no register holds them.</div>";''')

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("flats on the floor:", len(s), "chars")
