"""Floor plans: trust the index's own emirate field, and stop a loose name match crossing developer brands.

Two fixes to plansFor, both about the same weakness. The match is two-way CONTAINMENT on collapsed names, and Dubai project
names are generic, so a short name walks into a longer one belonging to somebody else entirely.

1. EMIRATE, BY FIELD. v226 guessed the emirate from a regex over the area string because there was nothing else to read.
   The question-bank session has since put an 'emirate' on all 168 projects (Dubai 146, Umm Al Quwain 17, Abu Dhabi 4,
   Ras Al Khaimah 1), derived once in scripts/bind_plans.py. The field is read first; the regex stays behind it, because a
   page should not depend on an upstream file being clean to avoid showing a buyer the wrong layout, and their field
   defaults to Dubai for an unrecognised area - which fails towards showing plans, the direction the regex catches.

2. DEVELOPER, ON LOOSE MATCHES ONLY. The emirate field cannot help when both buildings are in Dubai. Measured against the
   live stacks, five Dubai buildings are being handed another DEVELOPER's plans today:

     Creek Horizon               Emaar   <- The Horizon           Sobha Realty       47 plans
     Grande                      Emaar   <- Creek Vistas Grande   Sobha Realty       19 plans
     (unnamed, Dubai Hills)      Emaar   <- The Horizon           Sobha Realty       47 plans
     Serene Gardens 2            Iman    <- The Serene            Sobha Realty       36 plans
     Golf Views Block B          Emaar   <- SAMANA Golf Views     Samana Developers   2 plans

   Every one of them is a containment hit, never an exact name. So an exact name still matches on its own - it is strong
   evidence - and a containment hit now also has to agree on the developer. Agreement is deliberately loose: a shared word
   is enough, so 'Emaar' meets 'Emaar Properties', and an unknown developer on either side still matches, because most of
   the correct loose hits are the only plans that building will ever have. Corporate furniture (Properties, Developers,
   Realty, Group, LLC...) is stripped first, or 'Damac Properties' would agree with 'Deyaar Properties'. On today's data it
   removes those five and no others.

  python scripts/v227_plans_emirate_field_and_developer.py
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

if "sameDev" in s:
    print("already applied")
    raise SystemExit(0)


def sub(old, new, where):
    global s
    assert s.count(old) == 1, (where, s.count(old))
    s = s.replace(old, new)


# a developer comparison that is generous about how a name is written, but not about who it is
sub("""  const mine = [norm(name), norm(project)].filter((x) => x.length > 3);""",
    """  const mine = [norm(name), norm(project)].filter((x) => x.length > 3);
  const CORP = /^(properties|property|developers|developer|development|developments|realty|real|estate|estates|group|holding|holdings|llc|pjsc|llp|fz|fze|international|investment|investments|co|company|the|and)$/;
  const dtok = (x) => (String(x || "").toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 1 && !CORP.test(t));
  const sameDev = (a, b) => {
    const A = dtok(a), B = dtok(b);
    if (!A.length || !B.length) return true;   // unknown on either side is not a disagreement
    return A.some((t) => B.indexOf(t) >= 0);
  };""", "sameDev")

# the emirate, from the field the index now carries, with v226's regex left in place behind it
sub("""      if (OTHER_EMIRATE.test(String((p.area || "") + " " + (p.name || "")).toLowerCase())) continue;""",
    """      // the index's own answer first (bind_plans.py emirate_of), the regex second - two independent checks, and the
      // field defaults to Dubai for an unrecognised area, so it fails in the direction the regex is there to catch.
      if (p.emirate && String(p.emirate).toLowerCase().indexOf("dubai") < 0) continue;
      if (OTHER_EMIRATE.test(String((p.area || "") + " " + (p.name || "")).toLowerCase())) continue;""", "emirate")

# an exact name stands alone; a containment hit has to agree on who built it
sub("""      if (!mine.some((m) => m === pn || (m.length > 5 && pn.indexOf(m) >= 0) || (pn.length > 5 && m.indexOf(pn) >= 0))) continue;""",
    """      const exact = mine.some((m) => m === pn);
      if (!exact && !mine.some((m) => (m.length > 5 && pn.indexOf(m) >= 0) || (pn.length > 5 && m.indexOf(pn) >= 0))) continue;
      // containment is how Creek Horizon reached Sobha's The Horizon. A name inside a name has to agree on the developer.
      if (!exact && !sameDev(developer, d.name)) continue;""", "developer guard")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("plans: emirate field + developer guard,", len(s), "chars")
