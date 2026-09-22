"""Floor plans: two names that carry DIFFERENT phase numbers are different buildings.

Found 22 Sep 2026 while measuring developer coverage. Three live wrong matches share one shape - the names agree on every
word and disagree on the number, which is the only part that distinguishes the buildings:

    Belgravia Heights II (JVC)  ->  Belgravia Heights I     phase II was being served phase I's layouts

THAT IS THE ONLY ONE THIS RULE FIXES, and the docstring said three before it was measured. The other two wrong matches
found in the same pass carry no numbers at all, so nothing here touches them and they are STILL LIVE:

    Samana Boulevard Heights    ->  Boulevard Heights       the exact pair the question-bank session warned about
    Dubai Creek Tower           ->  ARLO at Dubai Creek Harbour
    The Dubai Creek Residences  ->  ARLO at Dubai Creek Harbour
    Golfville Block A           ->  Golf Grand at Dubai Hills Estate
    The Crescent A / B / C      ->  310 Riverside Crescent

They need the id-based binding (plans_bind.json), not another name heuristic.

A number in a Dubai project name is never decoration: Glitz 1 and Glitz 2 are different towers, Belgravia Heights I and II
are different phases with different layouts. So when BOTH names carry a number and the numbers DISAGREE, the match is
refused outright - no developer check, because the developer is usually the same firm building both phases and agreeing on
it proves nothing.

Deliberately NOT refused: a number on one side only. "Binghatti Flare 01" -> "Binghatti Flare" and "Starz Tower 1" ->
"Starz by Danube Properties" are correct, and the project simply does not carry the unit number. Requiring both sides to
number themselves is what makes this safe.

WHY NOT A BROADER RULE. I tried two and measured both against every district before discarding them. A one-word-either-
side test cost 21 buildings their plans and at least four were RIGHT (Miraclz Tower -> Miraclz by Danube, Resortz, Jewelz
- coined brand names that are one word and perfectly unambiguous). A token-ambiguity test does not separate either:
Binghatti Flare 01 -> Binghatti Flare scores 17 and is correct, while Golfville Block A -> Golf Grand scores 5 and is
wrong. Name-shape heuristics are at their limit here; what actually distinguishes these cases is knowledge the names do
not carry. The number conflict is the one signal that is unambiguous on its own, so it is the only one taken.

  python scripts/v242_phase_number_conflict.py
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

if "phaseNums" in s:
    print("already applied")
    raise SystemExit(0)

OLD = """  const sameDev = (a, b) => {"""
NEW = """  // A number in a project name is never decoration - Glitz 1 and Glitz 2 are different towers, Belgravia Heights I and
  // II different phases. Roman numerals included, because Dubai uses both. Leading zeros normalised: 01 is 1.
  const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
  const phaseNums = (x) => {
    const out = [];
    for (const t of String(x || "").toLowerCase().split(/[^a-z0-9]+/)) {
      if (!t) continue;
      if (/^[0-9]{1,3}$/.test(t)) out.push(parseInt(t, 10));
      else if (ROMAN[t] !== undefined) out.push(ROMAN[t]);
    }
    return out;
  };
  const numbersConflict = (a, b) => {
    const A = phaseNums(a), B = phaseNums(b);
    if (!A.length || !B.length) return false;          // a number on one side only says nothing
    return !A.some((n) => B.indexOf(n) >= 0);          // both numbered and sharing none: different buildings
  };
  const sameDev = (a, b) => {"""
assert s.count(OLD) == 1
s = s.replace(OLD, NEW)

OLD2 = """      const exact = mine.some((m) => m === pn);"""
NEW2 = """      // both sides numbered and the numbers disagree: a different phase or tower, whoever built it
      if (numbersConflict(name + " " + (project || ""), p.name)) continue;
      const exact = mine.some((m) => m === pn);"""
assert s.count(OLD2) == 1
s = s.replace(OLD2, NEW2)

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("phase-number conflict guard:", len(s), "chars")
