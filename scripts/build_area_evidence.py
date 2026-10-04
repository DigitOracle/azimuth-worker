"""v322 - the EVIDENCE behind every price the Developers-by-area page shows: per area and per developer, price per sq m by year (2019 to the latest complete month),
for the last 12 months, ready vs off-plan, apartments vs villas, the size range, and the last-12-month cells that let the page switch its window.
Read-only on the lake (one short query). Writes ONE local file. Run it AFTER the index builder has written its project-to-developer map:
  node scripts/build_devmap_index.mjs ... --out <first pass> --projdev-out <projdev.json>
  python scripts/build_area_evidence.py --geo <img_districts_geo json> --projdev <projdev.json> --out <area_evidence.json>
  node scripts/build_devmap_index.mjs ... --evidence <area_evidence.json> --out <final index>

THE SAME FILTERS AS THE TIER ANALYSIS (scratchpad tier_bounds_report.md): sales de-duplicated by transaction id; ordinary sale procedures only (Sell, Sell - Pre registration,
Delayed Sell, Sell Development, Sale On Payment Plan); usage Residential; type Unit or Villa; sub-type Flat / Villa / Hotel Apartment / Stacked Townhouses / blank; price at
least AED 100,000 and size 15 to 2,500 sq m; AED 3,000 to 150,000 per sq m. Window: 1 Jan 2019 to the end of the latest COMPLETE month. Last 12 months = the 12 months before that end.
A sale is OFF-PLAN when the register type starts with "Off", otherwise READY. Villa = property type Villa (the register size can be the plot, so a villa's price per sq m reads low).
Developer of a sale: the project name is looked up in the index builder's own map (building cards, then the Ejari projects list); not found = "_" (developer not recorded).
The 3-sales rule: a median over fewer than 3 sales is written null, never a number.
A shared register area (one DLD area behind two app districts) goes to the FIRST district only, marked shared."""
import argparse, datetime as dt, json, os, re, sys
import numpy as np
sys.path.insert(0, r"C:\Dev\naj-market-pulse\scripts")
from dld_rent_buildings import DLD_AREA
from lake import connect

ap = argparse.ArgumentParser(); ap.add_argument("--geo", required=True); ap.add_argument("--projdev", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--top", type=int, default=4); ap.add_argument("--min-dev", type=int, default=10); a = ap.parse_args()
SQFT = 10.7639
geo = [d["slug"] for d in json.load(open(a.geo, encoding="utf-8"))["districts"]]
PD = json.load(open(a.projdev, encoding="utf-8"))
slug_areas = {}
for ar, ss in DLD_AREA.items():
    ss = [s for s in ss if s in geo]
    if ss: slug_areas.setdefault(ss[0], []).append((ar, len(ss) > 1))     # first district only
area_slug = {ar: (s, sh) for s, lst in slug_areas.items() for ar, sh in lst}
con = connect()
last = con.execute("select max(instance_date) from g_dld__transactions where trans_group_en='Sales'").fetchone()[0]
end = (last.replace(day=1) - dt.timedelta(days=1)) if (last + dt.timedelta(days=1)).day != 1 else last          # latest complete month end
l12_from = dt.date(end.year - 1, end.month + 1, 1) if end.month < 12 else dt.date(end.year, 1, 1)       # the 12 months ending at `end`
since = dt.date(2019, 1, 1)
names = list(area_slug)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import devattr_register as R                 # v325 - the register developer of a project_number
RD = R.register_devs(con)
CUR = R.CUR                                  # curated brands (src/devcross.js ids)
rows = con.execute("""select transaction_id, any_value(instance_date), any_value(actual_worth), any_value(procedure_area), any_value(reg_type_en), any_value(property_type_en),
  any_value(area_name_en), any_value(project_name_en), any_value(rooms_en), any_value(project_number)
 from g_dld__transactions where trans_group_en='Sales'
  and procedure_name_en in ('Sell','Sell - Pre registration','Delayed Sell','Sell Development','Sale On Payment Plan')
  and property_usage_en='Residential' and property_type_en in ('Unit','Villa') and coalesce(property_sub_type_en,'Flat') in ('Flat','Villa','Hotel Apartment','Stacked Townhouses')
  and actual_worth>=100000 and procedure_area between 15 and 2500 and actual_worth/procedure_area between 3000 and 150000
  and instance_date between ? and ? and area_name_en in (%s) group by transaction_id""" % ",".join("?" * len(names)), [since, end] + names).fetchall()
nk = lambda s: re.sub(r"[^a-z0-9]+", " ", str(s or "").lower()).strip()
def bedof(r):
    t = str(r or "").lower().strip()
    if t == "studio": return 0
    m = re.match(r"^(\d+)\s*(?:bed|br|b/r)", t)
    return min(int(m.group(1)), 5) if m else 6          # 6 = not stated (penthouse, villas without a room count): counted in every total, matches no bedroom filter

def pick(slug, pname, pnum):      # v325 - the REGISTER first (project_number -> developer_id), then the index builder name map; see devattr_register.pick
    return R.pick(RD, PD, slug, pname, pnum, nk)
S = {}   # slug -> list of sale tuples
NAMES = {}   # canonical id -> register company name, for developers the crosswalk does not know as a brand
for tid, d, w, ar, rt, pt, an, pn, rooms, pnum in rows:
    slug, sh = area_slug[an]
    dev, q = pick(slug, pn, pnum)
    if q == "v" and dev not in CUR and pnum is not None and int(pnum) in RD: NAMES[dev] = RD[int(pnum)]["name_en"]
    S.setdefault(slug, []).append((d, float(w), float(ar), str(rt or "").startswith("Off"), pt == "Villa", dev, pn or "", bedof(rooms), sh, q))
def med(v): return float(np.median(v)) if len(v) >= 3 else None
def sqm_to(x): return None if x is None else int(round(x))
def W(sub):      # sub: list of sale tuples -> one summary
    if not sub: return [0] * 13
    pp = [s[1] / s[2] for s in sub]
    o = [len(sub), sqm_to(med(pp)) or 0]
    for flt in (lambda s: not s[3], lambda s: s[3], lambda s: not s[4], lambda s: s[4]):      # ready, off-plan, apartments, villas
        x = [s[1] / s[2] for s in sub if flt(s)]
        o += [len(x), sqm_to(med(x)) or 0]
    sz = [s[2] for s in sub]
    o += [int(round(np.percentile(sz, p))) for p in (10, 50, 90)] if len(sub) >= 3 else [0, 0, 0]
    return o
def years(sub):
    y = {}
    for s in sub: y.setdefault(s[0].year, []).append(s[1] / s[2])
    return [[yr, len(v), sqm_to(med(v))] for yr, v in sorted(y.items())]
def cells(sub):  # building x bedroom cells like the unit-mix cards: [n, ppsm, aed, bed]
    g = {}
    for s in sub: g.setdefault((s[6], s[7]), []).append(s)
    out = []
    for (pn, bed), x in g.items():
        ma = float(np.median([s[1] for s in x])); ms = float(np.median([s[2] for s in x]))
        out.append([len(x), int(round(ma / ms)), int(round(ma)), bed])
    return sorted(out, key=lambda c: -c[0])
def block(sub, l12, deep=True):
    o = {"all": W(sub), "l12": W(l12)}
    if deep: o["y"] = years(sub)
    return o
out = {"meta": {"as_of": str(end), "since": str(since), "l12_from": str(l12_from), "l12_to": str(end), "source_as_of": str(last),
                "sales": len(rows),
                "filters": "Land Department sales register: ordinary sales of homes (flats, villas, hotel apartments, stacked townhouses), price from AED 100,000, size 15 to 2,500 sq m, AED 3,000 to 150,000 per sq m, one row per transaction.",
                "layout": "W = [sales, median AED per sq m, ready sales, ready median, off-plan sales, off-plan median, apartment sales, apartment median, villa sales, villa median, size 10th, 50th, 90th percentile in sq m]; a median of 0 means under 3 sales. all / l12 = all years / last 12 months. y: [year, sales, median per sq m]. c12: cells [sales, per sq m, AED, bedrooms] for the last 12 months (bedrooms 6 = not stated). top: [project, sales, median, sales last 12 months, median last 12 months, off-plan sales last 12 months]."}, "areas": {}}
tot_att = {}
for slug, sub in S.items():
    l12 = [s for s in sub if s[0] >= l12_from]
    A = {"dld": [ar for ar, _ in slug_areas[slug]], "shared": any(sh for _, sh in slug_areas[slug]), "ev": block(sub, l12), "devs": {}}
    A["ev"]["first"] = str(min(s[0] for s in sub)); A["ev"]["last"] = str(max(s[0] for s in sub))
    byd = {}
    for s in sub: byd.setdefault(s[5], []).append(s)
    for dk, x in byd.items():
        x12 = [s for s in x if s[0] >= l12_from]
        e = block(x, x12, len(x) >= 50)
        pj = {}
        for s in x: pj.setdefault(s[6], []).append(s)
        top = []
        for pn, px in sorted(pj.items(), key=lambda kv: -len(kv[1]))[:a.top]:
            p12 = [s for s in px if s[0] >= l12_from]
            if len(px) < 5 or not str(pn).strip(): continue       # a blank project name cannot be shown
            top.append([pn, len(px), sqm_to(med([s[1] / s[2] for s in px])), len(p12), sqm_to(med([s[1] / s[2] for s in p12])), sum(1 for s in p12 if s[3])])
        if top and len(x) >= 50: e["top"] = top
        pj12 = {}
        for s in x12: pj12.setdefault(s[6], []).append(s)
        b12 = [[len(px), sqm_to(med([s[1] / s[2] for s in px])), str(pn)] for pn, px in pj12.items() if len(px) >= 3 and str(pn).strip()]   # v323: a project = a building with 3 or more sales in the window
        A["devs"][dk] = {"c12": cells(x12), "b12": b12}
        if dk != "_":
            A["devs"][dk]["q12"] = [sum(1 for s in x12 if s[9] == "v"), sum(1 for s in x12 if s[9] != "v")]      # v325: last-12-month sales [verified by the register, inferred from a name]
            if dk in NAMES: A.setdefault("names", {})[dk] = NAMES[dk]
        if len(x) >= a.min_dev: A["devs"][dk]["ev"] = e       # a developer with fewer sales has no drawer: the page says so
    out["areas"][slug] = A
    tot_att[slug] = (len(sub), sum(len(v) for k, v in byd.items() if k != "_"), len(l12), sum(len([s for s in v if s[0] >= l12_from]) for k, v in byd.items() if k != "_"))
json.dump(out, open(a.out, "w", encoding="utf-8"), separators=(",", ":"))
print("as of", end, "| last 12 months from", l12_from, "| sales", len(rows), "| areas", len(out["areas"]))
for s, (n, na, n12, na12) in sorted(tot_att.items(), key=lambda kv: -kv[1][0])[:12]: print("  %-22s all %6d (developer known %3d%%)  last 12 months %5d (developer known %3d%%)" % (s, n, 100 * na // n, n12, (100 * na12 // n12) if n12 else 0))
