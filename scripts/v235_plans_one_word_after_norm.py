"""Floor plans: a project name that becomes ONE WORD after normalising needs a positively known developer.

Found 22 Sep 2026 by the question-bank session, minutes before filming Marina Pinnacle: /building/dubaimarina/444 was
serving "The Pinnacle" (Sobha Realty, Sheikh Zayed Road) - 12 layouts of a different tower, by a different developer, in a
different part of the city, on an Emaar-era Dubai Marina building.

It walked through all three existing guards, and the reason is a seam between two pieces of correct code:

  * the emirate guard cannot help - both are Dubai.
  * the developer guard let it through BY DESIGN. Marina Pinnacle has no developer in the unitmix, and an unknown developer
    is deliberately not treated as a disagreement, because most buildings have none recorded and a loose hit is often the
    only plans they will ever have. That rule is right and is not changed here.
  * exact_only did not flag it. Their rule is "one token, or inside more than one register project", and "The Pinnacle" is
    TWO tokens with zero collisions. Correct on the name as written.

The seam: norm() strips the, by, tower, towers, residences, residence, building before matching. So "The Pinnacle" is two
tokens when their flag is computed and ONE token - "pinnacle" - by the time it is compared. I create the danger after they
have finished measuring it. That is not a gap in their flag; it is my normaliser, and it is mine to answer.

So the same rule they apply to a one-word name is applied to a name that BECOMES one word here: a containment hit on it
needs the developer positively known and agreeing, with the building's own name accepted as evidence (v229's knownDev).
Marina Pinnacle has no developer anywhere and carries no trace of Sobha, so it is refused.

The list norm() strips is what makes this class: "The Residences" -> residences -> stripped to nothing, "Sobha Tower" ->
sobha. Anything that reduces to a single common noun is a trap of exactly this shape.

  python scripts/v235_plans_one_word_after_norm.py
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

if "oneWordAfterNorm" in s:
    print("already applied")
    raise SystemExit(0)

OLD = """      if (!exact && p.exact_only && !knownDev(developer, d.name, name)) continue;"""
NEW = """      // the index's flag is computed on the name AS WRITTEN; norm() strips the/by/tower/residences before comparing, so
      // "The Pinnacle" is two tokens to them and one token - "pinnacle" - to me. Marina Pinnacle matched it on 22 Sep and
      // was served Sobha's Sheikh Zayed Road layouts. A name that REDUCES to one word is the same danger, measured here.
      const oneWordAfterNorm = pn.indexOf(" ") < 0;
      if (!exact && (p.exact_only || oneWordAfterNorm) && !knownDev(developer, d.name, name)) continue;"""
assert s.count(OLD) == 1, s.count(OLD)
s = s.replace(OLD, NEW)
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("plans: a name that reduces to one word needs a known developer,", len(s), "chars")
