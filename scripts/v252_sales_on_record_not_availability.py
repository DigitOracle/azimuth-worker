"""The SOLD SO FAR block cannot say what is for sale, and it is written as though it can.

Kendall, 25 Sep 2026, looking at The Palm Tower: "this is very confusing why are these numbers here... if I look at
this this does not tell me if there's any one bedroom two bedrooms available."

He is right, and the honest answer is that **no arrangement of these numbers can tell him that.** The DLD units
register records COMPLETED TRANSACTIONS. It does not record listings, and we hold no availability feed from any
developer. So "what is available" is not a question this data can answer, and the block has been dressed as though
it were answering it - the heading says SOLD SO FAR, the rings look like fuel gauges, and v246 left a header that
reads as a remainder.

THE PALM TOWER, exactly as it renders today:

    header    "741 sales across 792 homes"     <- reads as 51 left
    rings     Studio x1.9 · 1 BHK x1.6 · 2 BHK x1.7 · 3 BHK x5.0 · Retail —

Two separate wrongs in one card:

  1. **362 of those 792 "homes" are SHOPS.** The Palm Tower's register rows are Studio 194, 1-bed 224, 2-bed 11,
     3-bed 1, Retail 362. The block sums every non-"other" row and calls the total homes. The building has 430 homes.
  2. **741 sales across 430 homes is not 741 of 430 sold.** Every residential type here has traded MORE times than
     there are units - that is what the x1.9 and x1.6 mean - and retail has no recorded transaction at all. The
     figure is seventeen years of turnover, and it is printed where a reader looks for stock.

MEASURED ACROSS THE ESTATE, which is what makes this worth rebuilding rather than rewording. 1,942 of 1,996
buildings show this block:

    plain, sales <= units  1,002   51.6%   <- the only case the block was designed for
    some types resold        449   23.1%
    EVERY type resold        348   17.9%   <- the whole tower reads as sold out
    no sales at all          143    7.4%
    counting retail or office as "homes": 642 buildings, 50,821 units

So it is misleading on 48% of buildings and counts shops as homes on a third of them.

WHAT THIS CHANGES:

  * the heading becomes SALES ON RECORD, because that is what the register holds
  * homes and commercial are counted separately - a shop is never summed into a home count
  * one plain sentence, always shown, saying the register records completed sales and not listings, so the block
    cannot say what is for sale. Said once, in the card, rather than left for a reader to work out
  * the rings say which of three things they are: "N of M sold" where sales are within the unit count and the
    arithmetic means something; "x1.9 changed hands" where the type has resold; "none on record" where there is no
    transaction. The same ring cannot carry all three meanings silently
  * the drill-down on one type follows the same three cases

WHAT IT DOES NOT DO: invent an availability number, or hide the turnover. Turnover is genuinely interesting - a
one-bed at The Palm Tower has changed hands nearly twice - it is simply not stock, and the card now says which it is.

  python scripts/v252_sales_on_record_not_availability.py
"""
import io
import os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

if "SALES ON RECORD" in s or "homeRows" in s:
    print("already applied")
    raise SystemExit(0)


def sub(old, new, where):
    global s
    assert s.count(old) == 1, (where, s.count(old))
    s = s.replace(old, new)


# 1. the heading and the standing caveat
sub("""      (D.register.length ? '<div class=grp>Sold so far <u id=soldtag></u></div><div id=sold></div>' +
        '<div class=src>Dubai Land Department units register. Counts by type, not by unit number: which homes are sold is not published.</div>' : "") +""",
    """      (D.register.length ? '<div class=grp>Sales on record <u id=soldtag></u></div><div id=sold></div>' +
        '<div class=src><b>This is the transaction history, not what is for sale.</b> The Dubai Land Department ' +
        'register records completed sales, by type and not by unit number. It does not hold listings, so neither ' +
        'this building page nor anyone reading it can tell from here whether a particular home is available.</div>' : "") +""",
    "heading and caveat")

# 2. homes and shops are not the same thing, and the three ring states are named
sub("""      const rows = D.register.filter((r) => r.launched && r.c !== "other");
      const units = rows.reduce((t, r) => t + (r.launched || 0), 0);
      const salesN = rows.reduce((t, r) => t + (r.sold || 0), 0);
      // A home resells. Where the register holds more transactions than units, units-minus-sales is not "what is left",
      // it is an artefact, and flooring it at zero turns a meaningless subtraction into a confident sold-out.
      const resell = rows.some((r) => (r.sold || 0) > (r.launched || 0));
      const left = rows.reduce((t, r) => t + Math.max(0, (r.launched || 0) - (r.sold || 0)), 0);
      if (tag) tag.textContent = resell ? fmt(salesN) + " sales across " + fmt(units) + " homes"
        : fmt(left) + " left of " + fmt(units);""",
    """      const rows = D.register.filter((r) => r.launched && r.c !== "other");
      // A SHOP IS NOT A HOME. The Palm Tower's 792 "homes" were 430 homes and 362 retail units; 642 buildings across
      // the estate summed 50,821 commercial units into a home count. They are counted, and counted separately.
      const COMM = /^(retail|shop|office|showroom|warehouse)/i;
      const homeRows = rows.filter((r) => !COMM.test(String(r.type || "")));
      const commRows = rows.filter((r) => COMM.test(String(r.type || "")));
      const units = homeRows.reduce((t, r) => t + (r.launched || 0), 0);
      const salesN = homeRows.reduce((t, r) => t + (r.sold || 0), 0);
      const commU = commRows.reduce((t, r) => t + (r.launched || 0), 0);
      // The register counts transactions, so sales above units is turnover and not depletion, and the difference is
      // not "what is left" at all. Neither number answers "is one available", which is why the card no longer implies it.
      if (tag) tag.textContent = fmt(salesN) + (salesN === 1 ? " sale" : " sales") + " across " + fmt(units) +
        (units === 1 ? " home" : " homes") + (commU ? " \\u00b7 " + fmt(commU) + " retail or office units, counted apart" : "");""",
    "header maths")

sub("""      host.innerHTML = '<div class=drow>' + rows.map((r, i) => {""",
    """      host.innerHTML = '<div class=drow>' + homeRows.map((r, i) => {""",
    "rings use homes")

# 3. every ring says which of the three things it is
sub("""          '<text x=24 y=28 text-anchor=middle class=dnum>' + (over ? "\\u00d7" + (sld / all).toFixed(1) : none ? "\\u2014" : fmt(rest)) + "</text></svg>" +
          "<b>" + esc(r.type) + "</b><small>" + (over ? "traded, " + fmt(all) + " homes" : none ? "not recorded" : "of " + fmt(all)) + "</small></a>";""",
    """          '<text x=24 y=28 text-anchor=middle class=dnum>' + (over ? "\\u00d7" + (sld / all).toFixed(1) : none ? "\\u2014" : fmt(sld)) + "</text></svg>" +
          "<b>" + esc(r.type) + "</b><small>" + (over ? "changed hands, " + fmt(all) + " homes"
            : none ? "none on record" : "of " + fmt(all) + " sold") + "</small></a>";""",
    "ring labels")

# 4. the drill-down on one type tells the same three stories
sub("""    const sold = only.sold || 0, all = only.launched || 0, rest = Math.max(0, all - sold);
    const overOne = sold > all;
    if (tag) tag.textContent = overOne ? fmt(sold) + " sales, " + fmt(all) + " homes" : sold ? fmt(rest) + " left" : "not recorded";""",
    """    const sold = only.sold || 0, all = only.launched || 0, rest = Math.max(0, all - sold);
    const overOne = sold > all;
    if (tag) tag.textContent = overOne ? fmt(sold) + " sales across " + fmt(all) + (all === 1 ? " home" : " homes")
      : sold ? fmt(sold) + " of " + fmt(all) + " sold" : "no sale on record";""",
    "drill tag")

sub("""    ], overOne ? ["\\u00d7" + (sold / all).toFixed(1), "each home, on average"] : [fmt(rest), sold ? "left of " + fmt(all) : "not recorded"],
      () => { drawSold(null); });""",
    """    ], overOne ? ["\\u00d7" + (sold / all).toFixed(1), "times each home has traded"]
      : [fmt(sold), sold ? "sold of " + fmt(all) : "none on record"],
      () => { drawSold(null); });""",
    "drill centre")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("sales on record, not availability:", len(s), "chars")
