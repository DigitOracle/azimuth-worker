"""A plan project whose name IS the building's name must beat one that is merely inside it.

Kendall, 25 Sep 2026: "fix the plans gap." The audit put The plans at 4% across 1,996 buildings - the thinnest
section in the Symphony standard by a wide margin. Measured before changing anything:

    plans held for Dubai projects        145
    of those, reaching a building         53   (36.6%)
    unbound                               92
    buildings with plans                  73   (3.7% of 1,996)

**MOST OF THE GAP IS NOT A BUG AND CANNOT BE PATCHED.** We hold plans for twelve developers. 145 Dubai projects
against 1,996 buildings puts the ceiling near 7% even with perfect matching, and the 92 unbound are overwhelmingly
unbindable for good reasons: districts we do not model (The Oasis, Arabian Ranches III), off-plan towers with no
footprint yet, and junk the harvest picked up - one is a development in SHEFFIELD. Forcing them would be the v242
mistake again: a token-subset match offers "Binghatti Elite" -> Elite Residence (different tower, different
district) and collapses four separate Riverside Crescent towers onto one Crescent C. Wrong plans are far worse than
no plans, because a broker acts on them.

SO THIS FIXES THE PART THAT IS REAL, and it turns out to be a ranking bug rather than a missing rule.

**THE LOOP RETURNED THE FIRST MATCH, NOT THE BEST ONE.** For the building "Samana Boulevard Heights", Emaar's
"Boulevard Heights" (Downtown Dubai, 60 plans) matches by CONTAINMENT - the string sits inside the building's name -
and Emaar is earlier in the index than Samana. So it wins, and Samana's own "SAMANA Boulevard Heights" (Dubailand,
3 plans), which matches EXACTLY, is never reached. That is one of the five known-wrong live matches, and it was not a
missing guard - the right answer was in the list, further down.

**AND WORD ORDER IS NOT IDENTITY.** "Binghatti Dusk" and the twin's "Dusk by Binghatti" normalise to "binghatti dusk"
and "dusk binghatti" - the same two words, so the same building, and string equality says no. Token-set equality
says yes, and it is stricter than the containment rule already in use, not looser.

Both changes are the same idea: rank the candidates and take the strongest.

    3   the normalised names are equal
    3   the normalised TOKEN SETS are equal - same words, any order
    1   one name contains the other, developer agreeing

MEASURED AS BOUNDED. Across all 1,996 buildings, exact token-set equality finds exactly TWO matches among the 92
unbound - Binghatti Dusk and Samana Boulevard Heights - and changes no binding that is already correct, because an
exact match can only ever outrank the containment hit it replaces. 32 plans reach a building that had none, and one
building stops being served another developer's layouts.

WHAT REMAINS AFTER THIS IS A HARVEST PROBLEM, and no amount of matching will move it. Twelve developers of the
hundreds building in Dubai. That is the number to raise.

  python scripts/v256_exact_beats_containment.py
"""
import io
import os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

if "bestPlan" in s:
    print("already applied")
    raise SystemExit(0)


def sub(old, new, where):
    global s
    assert s.count(old) == 1, (where, s.count(old))
    s = s.replace(old, new)


# 1. token sets, so "Binghatti Dusk" and "Dusk by Binghatti" are one building
sub("""  const mine = [norm(name), norm(project)].filter((x) => x.length > 3);""",
    """  const mine = [norm(name), norm(project)].filter((x) => x.length > 3);
  // Word order is not identity: "Binghatti Dusk" and the twin's "Dusk by Binghatti" normalise to the same two words
  // in a different order. Set equality is STRICTER than the containment rule below, not looser - it requires every
  // word on both sides, where containment only requires one name to sit inside the other.
  const tset = (x) => { const s2 = new Set(String(x || "").split(" ").filter((t) => t.length > 1)); return s2; };
  const setsEqual = (a, b) => a.size > 1 && a.size === b.size && [...a].every((t) => b.has(t));
  const mineSets = mine.map(tset);""",
    "token sets")

# 2. rank instead of returning the first hit
sub("""      const plans = (p.plans || []).filter((x) => x.url).slice(0, 12)
        .map((x) => ({ label: x.label || x.kind || "plan", url: x.url, source: x.source || null }));
      if (plans.length) return { developer: d.name || developer || null, project: p.name, note: p.note || null, plans };
    }
  }
  return null;
}""",
    """      const plans = (p.plans || []).filter((x) => x.url).slice(0, 12)
        .map((x) => ({ label: x.label || x.kind || "plan", url: x.url, source: x.source || null }));
      if (!plans.length) continue;
      // RANK, do not take the first. "Samana Boulevard Heights" was served Emaar's Downtown "Boulevard Heights"
      // because that matched by containment and Emaar sits earlier in the index than Samana, whose project matches
      // the name exactly. The right answer was in the list, further down; nothing was guarding it.
      const rank = exact ? 3 : (mineSets.some((ms) => setsEqual(ms, tset(pn))) ? 3 : 1);
      if (!bestPlan || rank > bestRank) {
        bestRank = rank;
        bestPlan = { developer: d.name || developer || null, project: p.name, note: p.note || null, plans };
        if (rank === 3) return bestPlan;   // nothing can beat an exact name; stop looking
      }
    }
  }
  return bestPlan;
}""",
    "rank")

# 3. the accumulator, and let a token-set match satisfy the guards an exact name satisfies
sub("""  const OTHER_EMIRATE = /umm al quwain|uaq|siniya|abu dhabi|sharjah|ajman|ras al khaimah|rak\\b|fujairah/;""",
    """  const OTHER_EMIRATE = /umm al quwain|uaq|siniya|abu dhabi|sharjah|ajman|ras al khaimah|rak\\b|fujairah/;
  let bestPlan = null, bestRank = 0;""",
    "accumulator")

sub("""      const exact = mine.some((m) => m === pn);""",
    """      // the same words in a different order are the same name, and pass every guard an identical string passes
      const exact = mine.some((m) => m === pn) || mineSets.some((ms) => setsEqual(ms, tset(pn)));""",
    "exact includes set equality")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("exact beats containment:", len(s), "chars")
