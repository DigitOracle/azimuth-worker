"""What it lets for, and the schools around it (DDA session's cuts, 20 Sep 2026).

Ejari registers per SCHEME, so the rent shown is the scheme's and the card says so - "AL HABTOOR CITY, the scheme this building
belongs to" - never "this tower lets for". It also says what an Ejari contract is: a letting newly registered or renewed since
2024, not occupancy. Where price and rent both exist for a type, the gross yield is worked out here rather than quoted, and
labelled as the scheme's rent against the register's price.

Schools and health are within 5 km of the DISTRICT centre, not measured from this building's door. The card says which it is.
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()


def sub(old, new):
    global s
    assert s.count(old) == 1, old[:70]
    s = s.replace(old, new)


# the data the page carries
sub("export function buildingData(slug, id, stack, umx, bf, anchors, people, districtName, plansIndex) {",
    "export function buildingData(slug, id, stack, umx, bf, anchors, people, districtName, plansIndex) {\n"
    "  const amen = stack.district_amenities || null;")

sub("""    plans: plansFor(plansIndex, r.name, (u.dld || {}).project, u.developer),""",
    """    plans: plansFor(plansIndex, r.name, (u.dld || {}).project, u.developer),
    rent: r.rent || null,
    schools: amen ? (amen.schools || []).slice(0, 8) : null,
    schoolsAll: amen ? (amen.schools || []).length : 0,
    healthN: amen ? amen.health_n || 0 : 0,
    amenKm: amen ? amen.radius_km || 5 : 0,""")

# the About card: what it lets for, then the schools
sub("""      (D.plans ? "<h3>The plans · \"""",
    """      (D.rent ? "<h3>What it lets for</h3>" +
        '<div class=src style="margin:0 0 6px">Ejari registers a letting against the SCHEME, not the tower: these are ' +
        fmt(D.rent.n) + " contracts registered against " + esc(D.rent.scheme) + " since 2024, the scheme this building belongs to." +
        (esc(D.rent.scheme).toLowerCase() !== esc(D.name).toLowerCase() ? " They are not this building's alone." : "") + "</div>" +
        Object.keys(D.rent.by_type).map((t) => { const v = D.rent.by_type[t];
          const price = (D.register.find((x) => String(x.type).toLowerCase().replace(/[^a-z0-9]/g, "") === String(t).toLowerCase().replace(/[^a-z0-9]/g, "")) || {}).median;
          const y = (price && v.aed) ? Math.round(1000 * v.aed / price) / 10 : null;
          return '<div class=row><span>' + esc(t) + "<br><small>" + fmt(v.n) + " contracts" +
            (v.new != null ? " · " + fmt(v.new) + " new, " + fmt(v.renew) + " renewed" : "") + "</small></span><span>" +
            aed(v.aed) + " a year" + (y ? "<br><small>" + y + "% on the register price</small>" : "") + "</span></div>"; }).join("") +
        '<div class=src>A contract is a letting newly registered or renewed, not a measure of how much of the building is occupied. ' +
        "Where a yield is shown it is the scheme's rent against this building's register price, worked out here, not quoted.</div>" : "") +
      (D.schools && D.schools.length ? "<h3>Schools · " + esc(D.district) + "</h3>" +
        D.schools.map((x) => '<div class=row><span>' + esc(x.name) + "<br><small>" + esc([x.curriculum, x.rating].filter(Boolean).join(" · ")) +
          "</small></span><span>" + (x.km != null ? x.km + " km" : "") + "</span></div>").join("") +
        '<div class=src>' + D.schoolsAll + " KHDA schools and " + fmt(D.healthN) + " DHA health facilities within " + D.amenKm +
        " km of the district centre, nearest first. Measured from the centre of " + esc(D.district) + ", not from this building's door.</div>" : "") +
      (D.plans ? "<h3>The plans · \"""")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("rent and schools in:", len(s), "chars")
