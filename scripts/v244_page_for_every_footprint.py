"""A building page for every footprint the registers know, not only the 3% that have a floor stack.

Kendall, 22 Sep 2026, on the ABOUT THE BUILDING pill: "I need this button to be active for every single building...
prioritize Business Bay... and DAMAC Hills... I need to get this done ASAP."

The button was never conditionally disabled - $("about").onclick is wired unconditionally. "Inactive" meant the PAGE DID
NOT EXIST: buildingData returned null unless the footprint had BOTH a stack record and a unit-mix record, so
/building/<slug>/<i> answered "no register record for this building yet" and the pill had nothing to open.

The unit mix reaches nearly everything. The stack does not. Measured across all 45 districts:

    district            unitmix    stack    NO PAGE
    dubaihills             4264       40       4224
    majan                  4112       46       4066
    jltsouth               3576        1       3575
    jltnorth               3577       84       3493
    ...
    TOTAL                 66714     1996      64718

**3.0%.** Business Bay at 164 of 654 is among the BEST covered districts; DAMAC Hills is 24 of 1,006 and Jumeirah Lake
Towers South has ONE page for 3,576 buildings. So this is not a gap in two districts, it is the normal case everywhere,
and Kendall's two priorities are simply the ones he happened to tap.

Generating 64,718 floor stacks is not a morning's work and would leave the page dead until each one landed. So the page
opens from what the unit mix holds, and the stack upgrades it when it arrives. That is the v223 precedent from the map
panel: render what we hold, say plainly what we do not.

WHAT A FOOTPRINT WITHOUT A STACK ACTUALLY HAS, measured on Business Bay's 490: floors on ALL 490, indicative homes on
460, a name on 96, and status "placeholder". That is enough for an honest page and not enough to pretend to be the full
one.

THE THREE THINGS THIS MUST NOT DO, and they are the whole design:
  * NO EMPTY FLOOR PICKER. The control renders "Floors 0 levels" with an empty dropdown if D.floors is empty, so the
    whole block is now gated on there being floors to pick.
  * NO PROMISED MODEL. A footprint with no stack has no per-floor geometry, so nothing may link to or imply one.
  * NOTHING FROM THE STACK AS A ZERO. Every section already renders only when its data is present - the template
    contract - so absent stays absent rather than becoming 0.

And one taken from the pillars card, which spent two commits learning it: where a section is missing, say WHICH thing is
missing. A gap with a wrong reason is worse than a gap.

  python scripts/v244_page_for_every_footprint.py
"""
import io
import os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

if "noModel" in s:
    print("already applied")
    raise SystemExit(0)


def sub(old, new, where):
    global s
    assert s.count(old) == 1, (where, s.count(old))
    s = s.replace(old, new)


# 1. the gate: the unit mix alone is enough to open a page
sub("""  const r = stack && stack.buildings_by_id && stack.buildings_by_id[String(id)];
  const u = umx && umx.buildings_by_id && umx.buildings_by_id[String(id)];
  if (!r || !u) return null;""",
    """  const u = umx && umx.buildings_by_id && umx.buildings_by_id[String(id)];
  if (!u) return null;
  // The stack is the 3% case. Without it there is no per-floor geometry, so the page is honestly thinner rather than the
  // full page with holes: an empty object means every stack-sourced section is absent, which is the template contract.
  const rr = stack && stack.buildings_by_id && stack.buildings_by_id[String(id)];
  const noModel = !rr;
  const r = rr || {};""",
    "gate")

# 2. the name and the floors the placeholder does hold
sub("""  const facts = [];
  if (u.developer) facts.push(["Developer", u.developer]);""",
    """  const facts = [];
  // a placeholder record carries floors and indicative homes even with no stack - say which they are
  if (noModel) {
    if (u.floors) facts.push(["Floors", u.floors + " levels, from the building register"]);
    if (u.indicative_homes) facts.push(["Homes", fmt(u.indicative_homes) + " indicative"]);
    if (u.registered_homes) facts.push(["Registered homes", fmt(u.registered_homes)]);
  }
  if (u.developer) facts.push(["Developer", u.developer]);""",
    "placeholder facts")

sub("""    slug, id: String(id), name: r.name || a.name || "building", district: districtName || (stack.district || slug),""",
    """    slug, id: String(id), name: r.name || u.name || a.name || "building", district: districtName || (stack.district || slug),
    noModel,""",
    "name and flag")

# 3. no empty floor picker
sub("""      '<div class=grp>Floors <u>' + D.floors.length + ' levels</u></div><select id=fpick class=fsel2><option value="">choose a floor…</option>' +
      D.floors.map((g, k) => '<option value="' + k + '">' + esc(g.n != null ? "Floor " + g.n : (g.l === "G" ? "Ground floor" : g.l)) +
        (g.k ? " · " + g.k + " homes" : " · " + esc({ homes: "homes", office: "offices", retail: "retail", hotel: "hotel", services: "services and parking" }[g.u] || g.u)) +
        "</option>").join("") + "</select>" +""",
    """      (D.floors.length ? '<div class=grp>Floors <u>' + D.floors.length + ' levels</u></div><select id=fpick class=fsel2><option value="">choose a floor…</option>' +
        D.floors.map((g, k) => '<option value="' + k + '">' + esc(g.n != null ? "Floor " + g.n : (g.l === "G" ? "Ground floor" : g.l)) +
          (g.k ? " · " + g.k + " homes" : " · " + esc({ homes: "homes", office: "offices", retail: "retail", hotel: "hotel", services: "services and parking" }[g.u] || g.u)) +
          "</option>").join("") + "</select>" : "") +""",
    "floor picker guard")

# 4. say which thing is missing, on the card, rather than leaving a reader to wonder
sub("""      (D.dossier ? dossierBlock() : "") +""",
    """      (D.noModel ? '<div class=src><b>This building has no floor model yet.</b> The registers know it and what is here ' +
        'comes from them, but the floor-by-floor stack - the picker, the plate and the per-floor layout - is built ' +
        'separately and has not been built for this footprint. Nothing below is missing because the building lacks it; ' +
        'it is missing because we have not measured it.</div>' : "") +
      (D.dossier ? dossierBlock() : "") +""",
    "honest note")

io.open(P, "w", encoding="utf-8", newline="")
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("a page for every footprint:", len(s), "chars")
