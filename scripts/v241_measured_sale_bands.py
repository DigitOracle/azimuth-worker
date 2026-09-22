"""The sale-count bands on the building page, set from a measured error curve instead of a guessed floor.

v240 used a floor of five and said in its own commit message that the number was crude. The DDA session then measured it:
3,198 building-years carrying 60 or more sales, each one's full-year median treated as the truth, random subsamples of
size n drawn from it. How far a median of n sales sits from that truth:

      n     typical error    p90 error    within 10% of truth
      1         5.8%           22.3%            67.9%
      2         4.6%           16.6%            77.1%
      3         3.6%           14.8%            80.9%
      5         2.8%           11.9%            86.5%
      8         2.2%            8.9%            91.9%
     12         1.7%            7.3%            94.6%
     30         0.9%            4.2%            98.2%

A single sale is out by more than 10% A THIRD OF THE TIME, which is worse than the word "median" implies by any reading.
The curve then flattens after about 12, so past that you suppress a lot of buildings to buy very little accuracy.

So the bands are theirs, because they measured them:

    1-2   never carries the word median at all
    3-4   "Indicative", with the count
    5-11  "Median of N sales", the count kept on the label
    12+   "Median", allowed to stand on its own

Across every district: 13 buildings at 1-2, 4 at 3-4, 16 at 5-11, 953 at 12+. So this changes 33 pages and leaves 96.7%
untouched - a small surface, but the small surface is exactly where a reader is most likely to be misled, because a
median from two sales looks identical to a median from two thousand.

WHAT THIS STILL CANNOT SEE, stated because the next person will assume it does: count is only half of it. Business Bay
2006 has FOUR sales with a dispersion of 0.001 - four near-identical flats, where the median is almost certainly sound
despite failing every count test. Business Bay 2026 has 4,774 sales at dispersion 0.524, a genuinely wide market where
the median hides more than it shows. data/board/sales_depth_<slug>.json now carries p25, p75 and dispersion per
district-year for whoever takes that step; this change does not.

  python scripts/v241_measured_sale_bands.py
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

if "saleBand" in s:
    print("already applied")
    raise SystemExit(0)


def sub(old, new, where):
    global s
    assert s.count(old) == 1, (where, s.count(old))
    s = s.replace(old, new)


sub("""        (D.sold.psf ? '<div class=row><span>' + (D.sold.n === 1 ? "The one sale on record" :
          (D.sold.n < 5 ? "Median of " + D.sold.n + " sales" : "Median")) + '</span><span>AED ' + fmt(D.sold.psf) + " per sq ft</span></div>" : "") +""",
    """        (D.sold.psf ? '<div class=row><span>' + saleBand(D.sold.n) + '</span><span>AED ' + fmt(D.sold.psf) + " per sq ft</span></div>" : "") +""",
    "label")

sub("""        (D.sold.psf && D.sold.n < 5 ? " <b>Too few sales to describe a market:</b> this is what " + (D.sold.n === 1 ? "a single transaction" : "these " + D.sold.n + " transactions") + " happened to fetch, not a price level for the building." : "") +""",
    """        (D.sold.psf ? saleBandNote(D.sold.n) : "") +""",
    "note")

# the bands themselves, beside the card builder
sub("""  $("about").onclick = () => {""",
    """  // Bands measured, not chosen: subsampling 3,198 building-years of 60+ sales against their own full-year medians,
  // one sale lands within 10% of the truth only 67.9% of the time, five 86.5%, twelve 94.6%, and the curve flattens
  // after that. So 1-2 never says median, 3-4 is indicative, 5-11 keeps the count on the label, 12+ stands alone.
  function saleBand(n) {
    if (n === 1) return "The one sale on record";
    if (n === 2) return "What the two sales fetched";
    if (n < 5) return "Indicative &middot; " + n + " sales";
    if (n < 12) return "Median of " + n + " sales";
    return "Median";
  }
  function saleBandNote(n) {
    if (n < 3) return " <b>Too few sales to describe a market:</b> this is what " + (n === 1 ? "a single transaction" : "two transactions") +
      " happened to fetch, not a price level for the building. Measured against full-year medians, a single sale is out by more than 10% a third of the time.";
    if (n < 5) return " <b>Indicative only:</b> on " + n + " sales the figure lands within 10% of a full year's median about 81% of the time.";
    if (n < 12) return " On " + n + " sales this lands within 10% of a full year's median around 87-92% of the time.";
    return "";
  }

  $("about").onclick = () => {""",
    "bands")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("measured sale bands:", len(s), "chars")
