"""Floor plans: when the register binds a building to a project by ID, the id wins and no name is compared.

Every guard written today (v226, v227, v229, v235, v242) makes a name comparison less wrong. None of them makes it right,
because the names do not carry what distinguishes the buildings. This is the first route that does not compare names at
the point of display at all.

scripts/bind_plans.py already binds each harvested plan project to a DLD register project ONCE, and publishes the
register's property_ids for it (data/board/plans_bind.json, 77 projects, 1,627 plans, 57.3% of Dubai's). A building
carries its own dld.property_id. That is a join on an identifier the registers issued, not on a string either side
happened to spell.

MEASURED against every district, using only rule == "exact" bindings:

    agree with the name match          20
    DISAGREE                            1   <- Samana Boulevard Heights
    id-bound where names found none     0
    still name-only                    52

The single disagreement is the defect the question-bank session warned about weeks ago and that v242 could not touch,
because neither name carries a number: Samana Boulevard Heights was being served EMAAR's "Boulevard Heights". The id says
"SAMANA Boulevard Heights" and the id is right.

WHY ONLY rule == "exact", and this is the part that matters. plans_bind's own binding is BY NAME - it just happens once,
upstream, instead of on every page view. Its prefix and contains rules inherit exactly the hazard we are trying to escape,
and they demonstrably misfire: "The Crest" is bound by prefix to the register's "the crestmark", which are different
buildings, and "Golf Grand at Dubai Hills Estate" reaches Golfville Block A the same way. Taking the id route wholesale
would import those errors while looking more rigorous than the thing it replaced. 52 of the 77 bindings are exact; the
other 25 are not trusted here.

The field is read only if the index carries it. Nothing changes until bind_plans.py publishes property_ids and bind_rule
onto each project in plans_index - the same shape as emirate and exact_only, which is their lane. Absent the field this
patch is inert, so it cannot break the live page while we wait.

  python scripts/v243_plans_bind_by_id.py
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

if "boundById" in s:
    print("already applied")
    raise SystemExit(0)


def sub(old, new, where):
    global s
    assert s.count(old) == 1, (where, s.count(old))
    s = s.replace(old, new)


# the building's own register id reaches the matcher
sub("""function plansFor(index, name, project, developer) {""",
    """function plansFor(index, name, project, developer, propertyId) {""", "signature")

sub("""    plans: plansFor(plansIndex, r.name, (u.dld || {}).project, u.developer),""",
    """    plans: plansFor(plansIndex, r.name, (u.dld || {}).project, u.developer, (u.dld || {}).property_id),""", "call")

# the id route, tried first and returning before any name is looked at
sub("""  if (!mine.length) return null;""",
    """  // THE ID ROUTE. bind_plans.py joins a plan project to a DLD register project once and publishes its property_ids;
  // a building carries its own. Where both exist and the binding was exact, that is an identifier the registers issued
  // and it settles the question outright - no name is compared. Only "exact": the binding is itself made by name, and
  // its prefix rule already mis-binds "The Crest" to the register's "the crestmark".
  const boundById = (() => {
    if (propertyId === undefined || propertyId === null) return null;
    const want = [String(propertyId), String(Math.trunc(Number(propertyId)))];
    for (const d of ((index && index.developers) || [])) {
      for (const p of (d.projects || [])) {
        if (p.bind_rule !== "exact" || !p.property_ids) continue;
        if (!p.property_ids.some((x) => want.indexOf(String(x)) >= 0)) continue;
        const plans = (p.plans || []).filter((x) => x.url).slice(0, 12)
          .map((x) => ({ label: x.label || x.kind || "plan", url: x.url, source: x.source || null }));
        if (plans.length) return { developer: d.name || developer || null, project: p.name, note: p.note || null, plans, byId: true };
      }
    }
    return null;
  })();
  if (boundById) return boundById;
  if (!mine.length) return null;""", "id route")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("id-first binding:", len(s), "chars")
