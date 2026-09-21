"""The building's OWN community, and the transit it can actually walk to.

Two corrections, both from geometry the DDA session cut on 21 Sep 2026 (community polygons and the RTA point layers), applied
in scripts/build_geo_context.py and read here.

1. WHO LIVES HERE WAS KEYED ON THE DISTRICT'S NAME. The resident mix is per DEWA community, and communityMix() found the
   community by string-matching the district slug. Every building in a district therefore got one mix - but a district is not
   a community. Point-in-polygon on each building's own anchor says 78 of JLT North's buildings stand in Al Thanyah Fifth and
   6 stand in Marsa Dubai, so those 6 have been shown the wrong community's residents. The page now prefers the building's
   comm_num and only falls back to the name match where no polygon contains it.

2. "AROUND IT" HAD NO DISTANCES. Nearest metro, mall and landmark came from the Land Department's own nearest-to fields on a
   transaction: the register's opinion about the PROJECT, with no coordinates and no distance. The RTA layers give real points,
   so the nearest metro, tram, marine station and bus stop are measured straight-line from this building. Where the nearest of
   a kind is outside the district it is still shown, with its distance and marked as outside, because "no metro" and "the
   metro is 3.4 km away" are different answers. The register's own fields stay, labelled as the register's.

Never walking minutes: every routed estimate we have checked overstated it (Bellevue, 8-13 minutes quoted against a real 5).

  python scripts/v210_community_and_transit.py
"""
import io, os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def sub(s, old, new):
    assert s.count(old) == 1, old[:90]
    return s.replace(old, new)


P = os.path.join(HERE, "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

# --- the mix follows the building, not the district -------------------------------------------------------------------------
s = sub(s, """function communityMix(people, slug) {
  const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const want = norm(slug);
  const c = ((people && people.communities) || []).find((x) => [x.name, x.label, x.official].concat(x.known || []).some((n) => norm(n) === want));
  if (!c) return null;""",
        """function communityMix(people, slug, comm) {
  const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const want = norm(slug);
  const all = (people && people.communities) || [];
  // v210: the building's own community first, by the number the polygons gave it. The name match is the fallback for a
  // building no polygon contains, and it is what was silently wrong for the ones that straddle a district boundary.
  let c = (comm && comm.num != null) ? all.find((x) => String(x.comm) === String(comm.num)) : null;
  const byNum = !!c;
  if (!c) c = all.find((x) => [x.name, x.label, x.official].concat(x.known || []).some((n) => norm(n) === want));
  if (!c) return null;""")

s = sub(s, """  return { label: c.label || c.official || c.name, accounts: c.accounts || null, unknown: c.noNationalityPct || 0,""",
        """  return { label: c.label || c.official || c.name, byNum, accounts: c.accounts || null, unknown: c.noNationalityPct || 0,""")

s = sub(s, """    people: communityMix(people, stack.district || slug),""",
        """    people: communityMix(people, stack.district || slug, r.community),
    community: r.community || null, transit: r.transit || null,""")

# --- around it, with real distances ------------------------------------------------------------------------------------------
s = sub(s, """      (D.around.length ? "<h3>Around it</h3>" + D.around.map((a) => '<div class=row><span>' + esc(a[0]) + "</span><span>" + esc(a[1]) + "</span></div>").join("") : "") +""",
        """      ((D.transit && D.transit.length) || D.around.length ? "<h3>Around it</h3>" +
        (D.transit || []).map((t) => '<div class=row><span>' + esc(t.kind) +
          (t.outside ? "<br><small>outside this district</small>" : (t.zone ? "<br><small>zone " + esc(t.zone) + "</small>" : "")) +
          "</span><span>" + esc(t.name || "") + " · " + (t.m < 1000 ? t.m + " m" : (t.m / 1000).toFixed(1) + " km") + "</span></div>").join("") +
        D.around.map((a) => '<div class=row><span>' + esc(a[0]) + "<br><small>the register's own</small></span><span>" + esc(a[1]) + "</span></div>").join("") +
        (D.transit && D.transit.length ? '<div class=src>Distances are straight-line from this building, not walking minutes \\u2014 every routed estimate we have checked has overstated them. Stops and stations are the RTA\\'s own layers.</div>' : "") : "") +""")

# --- say whose residents these are ---------------------------------------------------------------------------------------------
s = sub(s, """        '<div class=src>DEWA customer register for the whole community' + (D.people.accounts ? ", " + fmt(D.people.accounts) + " accounts" : "") +""",
        """        '<div class=src>DEWA customer register for the whole community' + (D.people.accounts ? ", " + fmt(D.people.accounts) + " accounts" : "") +
        (D.people.byNum && D.community ? ". This building stands in " + esc(String(D.community.name || "").toLowerCase().replace(/\\b\\w/g, (m) => m.toUpperCase())) + ", which is not always the district it is listed under" : "") +""")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("building page:", len(s), "chars")
