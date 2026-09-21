"""Percent complete is the developer's own reporting, and it goes stale - so the page must not print it as fact.

The Najma video session flagged it on 21 Sep 2026 from a sample; checked against the whole project register it is worse than
their sample suggested: 125 live projects are due before January 2027 and sit under 10% built (32,086 homes), and 329 ACTIVE
projects still carry a due date that has already passed. A buyer reading "12% complete, due Oct 2026" off our page would take
it for a measurement. It is a filing.

So the construction card gains two things: a line under the bar whenever the register contradicts itself - still building, due
date gone - and a source line saying whose number it is. Nothing is hidden and nothing is recomputed; the register is shown
saying what it says, with its own date against it.

  python scripts/v206_progress_caveat.py
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

OLD = """        (D.project.pct != null ? '<div class=row><span>Percent complete</span><span>' + D.project.pct + "%</span></div>" +
          '<div class=bar style="margin:2px 0 6px"><i style="width:' + Math.max(0, Math.min(100, D.project.pct)) + '%"></i></div>' : "") +"""
NEW = """        (D.project.pct != null ? '<div class=row><span>Percent complete</span><span>' + D.project.pct + "%</span></div>" +
          '<div class=bar style="margin:2px 0 6px"><i style="width:' + Math.max(0, Math.min(100, D.project.pct)) + '%"></i></div>' +
          (D.project.pct < 100 && D.project.end && D.project.end < new Date().toISOString().slice(0, 10)
            ? '<div class=src style="margin:-2px 0 6px">The register still has it building, against a due date that has passed. Percent complete is the developer\\'s own filing, not a survey, and this one has not been updated.</div>' : "") : "") +"""
assert s.count(OLD) == 1
s = s.replace(OLD, NEW)

OLD2 = """        (D.project.units ? '<div class=row><span>Units in the project</span><span>' + fmt(D.project.units) +
          (D.project.registered ? " · " + fmt(D.project.registered) + " registered" : "") + "</span></div>" : "") +"""
NEW2 = OLD2 + """
        '<div class=src>Status, percent complete, dates and the escrow account are the Land Department project register, joined to this building by property id. Percent complete and the due date are the developer\\'s own reporting: across Dubai hundreds of live schemes still show a due date that has gone by.</div>' +"""
assert s.count(OLD2) == 1
s = s.replace(OLD2, NEW2)

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("construction caveat in:", len(s), "chars")
