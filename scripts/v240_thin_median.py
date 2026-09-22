"""A median of one sale is not a median, and the building page must not call it one.

Prompted 22 Sep 2026 by the DDA session, which put REIDIN (the series UBS builds its bubble index from, via the BIS) beside
the Land Department register and found them 0.6% apart in 2024 - 16,973 against 16,409 AED/m2 - having been 69% apart in
2003. Nothing was reconciled between them; the register simply grew from 1,821 sales a year to 179,021. Their conclusion
travels down to this page unchanged: A MEDIAN FROM A THIN SAMPLE IS NOT A MARKET, it is a sample.

Measured across every district: 986 buildings show a median price per square foot, and 17 of them stand on fewer than five
sales. EIGHT stand on exactly ONE. That page currently prints "Median  AED x per sq ft" for a single transaction, which is
not a median at all - it is that one sale's price, wearing a word that implies a distribution.

So the label now says what the figure is:
  * one sale  -> "The one sale on record", no median claimed
  * 2-4 sales -> "Median of N sales", with the thinness said in the source line rather than left for the reader to infer
  * 5+        -> unchanged

The count was always displayed directly above, so nothing was hidden - but a reader takes a labelled median at face value
and does not audit it against the line above. The fix is in the label because that is where the claim is made.

  python scripts/v240_thin_median.py
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

if "thinSale" in s:
    print("already applied")
    raise SystemExit(0)

OLD = """        (D.sold.psf ? '<div class=row><span>Median</span><span>AED ' + fmt(D.sold.psf) + " per sq ft</span></div>" : "") +"""
NEW = """        (D.sold.psf ? '<div class=row><span>' + (D.sold.n === 1 ? "The one sale on record" :
          (D.sold.n < 5 ? "Median of " + D.sold.n + " sales" : "Median")) + '</span><span>AED ' + fmt(D.sold.psf) + " per sq ft</span></div>" : "") +"""
assert s.count(OLD) == 1
s = s.replace(OLD, NEW)

OLD2 = """        ". The transaction register carries no building id, only a name, so these are that name's sales rather than provably this footprint's. Settled prices, not asking.</div>" : "") +"""
NEW2 = """        ". The transaction register carries no building id, only a name, so these are that name's sales rather than provably this footprint's. Settled prices, not asking." +
        (D.sold.psf && D.sold.n < 5 ? " <b>Too few sales to describe a market:</b> this is what " + (D.sold.n === 1 ? "a single transaction" : "these " + D.sold.n + " transactions") + " happened to fetch, not a price level for the building." : "") +
        "</div>" : "") +"""
assert s.count(OLD2) == 1
s = s.replace(OLD2, NEW2)

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("thin medians labelled:", len(s), "chars")
