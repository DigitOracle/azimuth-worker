"""When the building filled up - DEWA connections on the building page.

Everything else on this page is a transaction: what sold, what was let, what a developer filed. None of it says anyone lives
there. A meter connected in someone's name is the closest any Dubai register gets to occupancy, and the first and last
connection months give a building's filling history. Prive by DAMAC: 790 connections, first October 2020, 407 of them in 2025
- a building that opened in 2020 and filled hardest five years later. No portal can say that.

The four rules travel into the copy, not into a footnote:

  * A connection is not a household. One home relet three times is three connections. The card says so, because the first
    thing anyone will do is divide it by the unit count and call it an occupancy rate.
  * Buildings under the disclosure floor are withheld entirely, so the section simply does not render for them - it never
    says "no connections", which would both be wrong and, for a villa, publish that a single household lives there.
  * No rows means not recorded. The district line carries how many buildings were withheld so the page can say so.
  * Months, never days.

  python scripts/v225_occupancy.py
"""
import io, os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NL = chr(10)


def sub(s, old, new, where):
    assert s.count(old) == 1, (where, s.count(old))
    return s.replace(old, new)


P = os.path.join(HERE, "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

# carry it onto the page's data
s = sub(s, """    community: r.community || null, transit: r.transit || null,""",
        """    community: r.community || null, transit: r.transit || null,
    occupancy: r.occupancy || null, districtOccupancy: stack.district_occupancy || null,
    team: r.team || null, stage: r.stage || null,""",
        "data")

# the card section, after "what has sold here"
OLD = """      (D.rent ? "<h3>What it lets for</h3>" +"""
NEW = ("""      (D.occupancy ? "<h3>When it filled up</h3>" +
        '<div class=row><span>Meters connected</span><span>' + fmt(D.occupancy.connections) + "</span></div>" +
        (D.occupancy.first ? '<div class=row><span>First connection</span><span>' + esc(D.occupancy.first) + "</span></div>" : "") +
        (D.occupancy.last ? '<div class=row><span>Most recent</span><span>' + esc(D.occupancy.last) + "</span></div>" : "") +
        (D.occupancy.y2025 ? '<div class=row><span>In 2025</span><span>' + fmt(D.occupancy.y2025) +
          (D.occupancy.y2024 ? " &middot; " + fmt(D.occupancy.y2024) + " in 2024" : "") + "</span></div>" : "") +
        (D.occupancy.residential ? '<div class=row><span>Homes / commercial</span><span>' + fmt(D.occupancy.residential) +
          " / " + fmt(D.occupancy.commercial || 0) + "</span></div>" : "") +
        '<div class=src>DEWA meter connections for this building, matched to it by its own entrance. <b>A connection is not a home:</b> one home let three times is three connections, so this cannot be divided by the number of homes to give an occupancy rate. It is the only thing any register says about a building being lived in rather than sold or let. Months only.' +
        (D.districtOccupancy && D.districtOccupancy.withheld ? " Smaller buildings in this district - " + fmt(D.districtOccupancy.withheld) +
          " of them - are withheld entirely: below " + esc(D.districtOccupancy.floor) + " connections the figure stops being a statistic and becomes a household." : "") +
        "</div>" : "") +
"""
       + OLD)
s = sub(s, OLD, NEW, "card")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("occupancy on the building page:", len(s), "chars")
