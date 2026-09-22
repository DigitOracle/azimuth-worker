"""Floor plans: for a name the index calls too generic, the developer has to be positively known and agree.

The question-bank session now stamps each project with exact_only (the name is one word, or sits inside more than one
register project), plus name_tokens and register_collisions. 29 of 168 projects, 1,220 plans. The examples are the argument:
Sobha has 'Waves', inside SIX register projects, and Emaar has projects called 'May' and 'JUNE'. As substrings those match
almost anything with a date or a coastline in its name.

The flag is advisory, so what to do with it was decided by measuring. Honouring it bluntly - flagged means exact name only -
was tried first and is WRONG. It costs four buildings their plans and only one of the four is a bad match:

    Six Senses Residences Dubai Marina  <- Six Senses Residences (Select Group)   building developer 'Select Group'  RIGHT
    SOBHA SEAHAVEN - TOWER A            <- Sobha SeaHaven (Sobha Realty)          building developer 'Sobha'         RIGHT
    Binghatti Flare 01                  <- Binghatti Flare (Binghatti)            building developer None            RIGHT
    Condor Golf Links 18                <- Golf Links (Emaar)                     building developer None            WRONG

Three correct matches destroyed to remove one wrong one is a bad trade, and an invisible one: a missing plan looks like a
plan we never had. What actually separates them is whether the developer is POSITIVELY known to agree. v227 lets an unknown
developer through, which is right in general - most buildings have no developer recorded and a loose hit is the only plans
they will ever have - but a flagged name is exactly the case where unknown must stop being good enough.

So for a flagged project only: the developer must be known on both sides and share a word. Binghatti Flare 01 has no
recorded developer and still passes, because the brand is in the building's OWN NAME - which is the same evidence, just
written somewhere else. Condor Golf Links 18 carries no trace of Emaar anywhere and is dropped.

Measured citywide through the real buildingData: 84 buildings with plans -> 83. Condor Golf Links 18 lost, nothing else.

  python scripts/v229_plans_exact_only.py
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

if "exact_only" in s:
    print("already applied")
    raise SystemExit(0)


def sub(old, new, where):
    global s
    assert s.count(old) == 1, (where, s.count(old))
    s = s.replace(old, new)


# positive agreement: not merely "no disagreement". The building's own name counts as evidence of its developer, because
# for the flagged names the unitmix often records none and the brand is sitting in the name instead.
sub("""  const sameDev = (a, b) => {""",
    r"""  const knownDev = (a, b, bname) => {
    const B = dtok(b);
    if (!B.length) return false;
    if (dtok(a).some((t) => B.indexOf(t) >= 0)) return true;
    const nm = " " + String(bname || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim() + " ";
    return B.some((t) => t.length > 3 && nm.indexOf(" " + t + " ") >= 0);
  };
  const sameDev = (a, b) => {""", "knownDev")

sub("""      const exact = mine.some((m) => m === pn);""",
    """      const exact = mine.some((m) => m === pn);
      // a name the index calls too generic to match by substring: Sobha's 'Waves' is inside six register projects. For
      // those, a containment hit needs the developer positively known and agreeing - unknown is no longer good enough.
      if (!exact && p.exact_only && !knownDev(developer, d.name, name)) continue;""", "exact_only")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("plans: exact_only needs a known, agreeing developer,", len(s), "chars")
