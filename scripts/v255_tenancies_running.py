"""The building card can finally say something true about whether people live there.

Kendall, 25 Sep 2026: "join it to the buildings so we can have some truth in what we say."

The sales block says how often homes here have CHANGED HANDS. It cannot say whether anyone is in them, and v252 made
it stop pretending otherwise. Ejari can: it records tenancies with start and end dates, so a building can say how many
of its homes had a contract running on a known date. Built by scripts/build_ejari_building.py, published as
tenancy_<slug>, 1,198 buildings across 43 districts.

WHAT IT RENDERS:

    Homes let
    At least 53 homes here had a tenancy running on 9 Sep 2026
    31 one-bed · 21 studio · 1 three-bed

WHAT IT DELIBERATELY NEVER RENDERS, and the reasons are measured rather than cautious:

  * **NO DENOMINATOR AND NO PERCENTAGE.** Only 42.4% of live tenancies reach a building at all - 40.5% are registered
    without a project name and can never bind, the rest are lost to name mismatches. The Palm Tower shows 53 against
    500 homes, which would read as a 90% empty tower and is a naming gap. "At least 53 homes" is true; "53 of 500"
    is an invitation to conclude something false.
  * **NOTHING BELOW HALF COVERAGE.** Each district carries share_bound - how much of its tenancy data reaches a
    building. It runs from 0.76 in Sobha Heartland to 0.01 in Al Hebiah Fifth, and a card cannot show the reader
    which they are looking at. Below 0.5 the block does not render at all: 13 districts and 590 buildings qualify.
    A number that is right in one district and a tenth of the truth in the next is not a number to publish estate-wide.
  * **NEVER "AVAILABLE", NEVER "VACANT".** An owner-occupied home has no Ejari contract either. Not let is not for
    sale, and the card says so in the source line rather than leaving a reader to assume the remainder is empty.
  * **NEVER "TODAY".** The export is dated. The date is in the sentence, not a footnote.

A PROJECT COVERING SEVERAL TOWERS GETS ONE FIGURE, because Ejari has no unit identity. Where that happens the card
says "across the 4 buildings of DAMAC TOWERS BY PARAMOUNT" instead of attributing it to the tower on screen. 377 of
the 1,198 are in that state and dividing the number between them would be invention.

WHERE A BULK REGISTRATION WAS FOUND the count is already withheld by the builder - a hotel registering 27,359 rooms
on one contract is not 27,359 tenancies - and the card says the figure is incomplete for that reason rather than
silently showing a smaller number.

  python scripts/v255_tenancies_running.py
"""
import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = os.path.join(ROOT, "src", "index.js")
BP = os.path.join(ROOT, "src", "building_page.js")


def patch(path, pairs, guard):
    s = io.open(path, encoding="utf-8").read()
    if guard in s:
        print(os.path.basename(path), "already applied")
        return
    for old, new, where in pairs:
        assert s.count(old) == 1, (os.path.basename(path), where, s.count(old))
        s = s.replace(old, new)
    io.open(path, "w", encoding="utf-8", newline="").write(s)
    print(os.path.basename(path), "patched:", len(s), "chars")


# 1. the worker loads the district's tenancy file and hands it to buildingData
patch(IDX, [
    ('''        const [_st, _um, _bf, _ac] = await Promise.all([_get("stack_" + _bs), _get("unitmix_" + _bs), _get("bldgfacts_" + _bs), _get("anchors_" + _bs)]);''',
     '''        const [_st, _um, _bf, _ac, _tn] = await Promise.all([_get("stack_" + _bs), _get("unitmix_" + _bs), _get("bldgfacts_" + _bs), _get("anchors_" + _bs), _get("tenancy_" + _bs)]);''',
     "fetch"),
    ('''        const _bd = (_st && _um && _bi) ? buildingData(_bs, _bi, _st, _um, _bf, _ac, _pp, _bn, _px, _uu, _pl) : null;''',
     '''        const _bd = (_st && _um && _bi) ? buildingData(_bs, _bi, _st, _um, _bf, _ac, _pp, _bn, _px, _uu, _pl, _tn) : null;''',
     "pass"),
], "tenancy_" )

# 2. the page reads it, gated on the district's own coverage
patch(BP, [
    ('''export function buildingData(slug, id, stack, umx, bf, anchors, people, districtName, plansIndex, units, plate) {''',
     '''export function buildingData(slug, id, stack, umx, bf, anchors, people, districtName, plansIndex, units, plate, tenancy) {''',
     "signature"),

    ('''  const floors = r.floors || [];''',
     '''  // Ejari tenancies, and the whole reason this is gated: only 42.4% of live contracts reach a building, unevenly -
  // 0.76 of them in Sobha Heartland, 0.01 in Al Hebiah Fifth. A card cannot show which of those it is standing in, so
  // below half coverage the block does not render at all rather than print a tenth of the truth as though it were all.
  let let_ = null;
  {
    const tc = tenancy && tenancy.coverage, tr = tenancy && tenancy.buildings_by_id && tenancy.buildings_by_id[String(id)];
    if (tr && tc && (tc.share_bound || 0) >= 0.5) {
      let_ = {
        live: tr.live, byType: tr.by_type || {}, asAt: tr.as_at,
        project: tr.scope === "project" ? tr.project : null,
        buildings: tr.buildings_in_project || 1,
        partial: !!tr.bulk_registration,
      };
    }
  }
  const floors = r.floors || [];''',
     "read"),

    ('''    slug, id: String(id), name: r.name || u.name || a.name || "Unnamed building", unnamed: !(r.name || u.name || a.name),''',
     '''    let_,
    slug, id: String(id), name: r.name || u.name || a.name || "Unnamed building", unnamed: !(r.name || u.name || a.name),''',
     "expose"),

    # 3. render it directly above the sales block, because "who is in it" reads before "how often it sold"
    ('''      (D.register.length ? '<div class=grp>Sales on record <u id=soldtag></u></div><div id=sold></div>' +''',
     '''      (D.let_ && D.let_.live ? '<div class=grp>Homes let</div>' +
        '<div class=letn><b>At least ' + fmt(D.let_.live) + '</b> ' + (D.let_.live === 1 ? "home" : "homes") +
        (D.let_.project ? ' across the ' + D.let_.buildings + ' buildings of ' + esc(D.let_.project) : " here") +
        ' had a tenancy running on ' + esc(D.let_.asAt) + '</div>' +
        (Object.keys(D.let_.byType).length > 1 ? '<div class=lett>' + Object.keys(D.let_.byType).sort((x, y) => D.let_.byType[y] - D.let_.byType[x])
          .map((t) => fmt(D.let_.byType[t]) + " " + esc(String(t).toLowerCase())).join(" \\u00b7 ") + "</div>" : "") +
        '<div class=src><b>At least</b>, because a tenancy registered without its project name never reaches the ' +
        'building. This is not availability: a home with no tenancy may be owner-occupied, so the rest are not ' +
        'vacant and are not for sale.' + (D.let_.partial ? ' Part of this project is registered in bulk on single ' +
        'contracts, which are excluded, so the real figure is higher still.' : "") + '</div>' : "") +
      (D.register.length ? '<div class=grp>Sales on record <u id=soldtag></u></div><div id=sold></div>' +''',
     "render"),

    ('''#panel h1{margin:0;font-size:.6rem;font-weight:600;letter-spacing:.14em;color:var(--gold);text-transform:uppercase}''',
     '''#panel h1{margin:0;font-size:.6rem;font-weight:600;letter-spacing:.14em;color:var(--gold);text-transform:uppercase}
.letn{font-family:Fraunces,Georgia,serif;font-size:.92rem;line-height:1.35;margin:2px 0 4px}
.letn b{color:var(--gold)}
.lett{font-family:"IBM Plex Mono",monospace;font-size:.58rem;letter-spacing:.05em;color:var(--mut);margin:0 0 4px}''',
     "styles"),
], "let_")
