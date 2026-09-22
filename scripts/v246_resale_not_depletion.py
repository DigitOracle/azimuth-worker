""""8 LEFT OF 772" is an artefact of subtracting resales from units. 38% of buildings show it; 304 read as sold out.

Found by the question-bank session, who were about to build an episode on the number and read it the way any viewer
would. Marina Pinnacle shows SOLD SO FAR - 8 LEFT OF 772 with rings at 0 of 420, 0 of 168, 0 of 176, 1 of 1, 7 of 7.

The register for that tower:

    units   1-bed 420 · 2-bed 168 · 3-bed 176 · office 1 · retail 7   =   772
    sales   1-bed 1,305 · 2-bed 504 · 3-bed 469                       = 2,278   first 2009-04, last 2026-08

**2,278 sales across 772 homes, because homes RESELL.** Each one-bed has changed hands about three times in seventeen
years. The page computed `left = max(0, launched - sold)` per type, which floors all three bedroom types to zero and
leaves 1 office + 7 retail, reproducing the on-screen 8 exactly.

Both halves mislead, in opposite directions:
  * the ZEROS do not mean sold out. They mean the register holds more transactions than units - what a seventeen-year-old
    building looks like.
  * the 1 and 7 do not mean an office and seven shops are for sale. They mean neither has a RECORDED transaction:
    developer-held, traded before the register began, or never traded. The data cannot tell those apart.

And the building's own record already says so - unitmix carries `needs: ["developer availability sheet for what is on
offer now"]`. The data knew its limit and the page printed a confident figure over the top of it.

MEASURED across every district: 1,942 buildings show this block. **737 (38%) have at least one type where sales exceed
units. 304 have EVERY type over, so the whole tower reads as sold out.** 765 have a type with zero recorded sales. The
worst are the oldest: TAT RESIDENCE, 41 units and 416 sales, x10.1.

The failure is the same one as the flooring itself: `Math.max(0, ...)` turns "this subtraction is meaningless here" into
a confident zero, and a zero looks exactly like a measurement. So the arithmetic is only done where it means something:

    sales > units   ->  no "left" claim at all. The ring shows the TURNOVER ("x3.1", "traded") because that is the true
                        and more interesting fact, and the header says "2,278 sales across 772 homes".
    sales == 0      ->  "not recorded", never a count implying availability.
    0 < sales <= units  ->  unchanged. This is the new-launch case the block was designed for and it is correct there.

  python scripts/v246_resale_not_depletion.py
"""
import io
import os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

if "resell" in s:
    print("already applied")
    raise SystemExit(0)


def sub(old, new, where):
    global s
    assert s.count(old) == 1, (where, s.count(old))
    s = s.replace(old, new)


sub("""      const rows = D.register.filter((r) => r.launched && r.c !== "other");
      const left = rows.reduce((t, r) => t + Math.max(0, (r.launched || 0) - (r.sold || 0)), 0);
      const units = rows.reduce((t, r) => t + (r.launched || 0), 0);
      if (tag) tag.textContent = fmt(left) + " left of " + fmt(units);""",
    """      const rows = D.register.filter((r) => r.launched && r.c !== "other");
      const units = rows.reduce((t, r) => t + (r.launched || 0), 0);
      const salesN = rows.reduce((t, r) => t + (r.sold || 0), 0);
      // A home resells. Where the register holds more transactions than units, units-minus-sales is not "what is left",
      // it is an artefact, and flooring it at zero turns a meaningless subtraction into a confident sold-out.
      const resell = rows.some((r) => (r.sold || 0) > (r.launched || 0));
      const left = rows.reduce((t, r) => t + Math.max(0, (r.launched || 0) - (r.sold || 0)), 0);
      if (tag) tag.textContent = resell ? fmt(salesN) + " sales across " + fmt(units) + " homes"
        : fmt(left) + " left of " + fmt(units);""",
    "header")

sub("""        const all = r.launched || 0, rest = Math.max(0, all - (r.sold || 0));
        const frac = all ? rest / all : 0;""",
    """        const all = r.launched || 0, sld = r.sold || 0;
        const over = sld > all;                       // resold more times than there are homes
        const none = !sld;                            // no transaction on record at all
        const rest = Math.max(0, all - sld);
        const frac = over || none ? 0 : (all ? rest / all : 0);""",
    "cell maths")

sub("""          '<text x=24 y=28 text-anchor=middle class=dnum>' + fmt(rest) + "</text></svg>" +
          "<b>" + esc(r.type) + "</b><small>of " + fmt(all) + "</small></a>";""",
    """          '<text x=24 y=28 text-anchor=middle class=dnum>' + (over ? "\\u00d7" + (sld / all).toFixed(1) : none ? "\\u2014" : fmt(rest)) + "</text></svg>" +
          "<b>" + esc(r.type) + "</b><small>" + (over ? "traded, " + fmt(all) + " homes" : none ? "not recorded" : "of " + fmt(all)) + "</small></a>";""",
    "cell label")

# the drill-down on one type has the same flaw
sub("""    const sold = only.sold || 0, all = only.launched || 0, rest = Math.max(0, all - sold);
    if (tag) tag.textContent = fmt(rest) + " left";""",
    """    const sold = only.sold || 0, all = only.launched || 0, rest = Math.max(0, all - sold);
    const overOne = sold > all;
    if (tag) tag.textContent = overOne ? fmt(sold) + " sales, " + fmt(all) + " homes" : sold ? fmt(rest) + " left" : "not recorded";""",
    "drill tag")

sub("""    ], [fmt(rest), "left of " + fmt(all)], () => { drawSold(null); });""",
    """    ], overOne ? ["\\u00d7" + (sold / all).toFixed(1), "each home, on average"] : [fmt(rest), sold ? "left of " + fmt(all) : "not recorded"],
      () => { drawSold(null); });""",
    "drill centre")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("resale is no longer read as depletion:", len(s), "chars")
