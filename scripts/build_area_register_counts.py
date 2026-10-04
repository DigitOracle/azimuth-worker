"""v314 - the register's own count of home sales per app district, so the Developers-by-area panel can say "X of about Y settled sales are loaded".
Read-only on the lake (one short query). Writes ONE local file: {slug: {areas, sales_12m, sales_all_time, shared, window_from, as_of}}.
  python scripts\\build_area_register_counts.py --geo <img_districts_geo json> --out <file>
Home sales = flats and villas (property type Unit with sub type Flat, or Villa), every sale procedure except leases and land adds - the same definition build_coverage_cards.py uses.
A DLD area shared by two app districts (Nad Al Shiba First: Meydan One / Golden Symphony; Al Thanyah Fifth: JLT North / JLT) cannot be split, so those carry shared: true
and the index omits them."""
import argparse, collections, datetime as dt, json, sys
sys.path.insert(0, r"C:\Dev\naj-market-pulse\scripts")
from dld_rent_buildings import DLD_AREA
from lake import connect
ap = argparse.ArgumentParser(); ap.add_argument("--geo", required=True); ap.add_argument("--out", required=True); a = ap.parse_args()
geo = [d["slug"] for d in json.load(open(a.geo, encoding="utf-8"))["districts"]]
con = connect()
last = con.execute("select max(instance_date) from g_dld__transactions where trans_group_en='Sales'").fetchone()[0]
since = last - dt.timedelta(days=365)
rows = con.execute("""select area_name_en, count(*), count(*) filter (where instance_date > ?) from g_dld__transactions
  where trans_group_en='Sales' and procedure_name_en not like 'Lease%' and procedure_name_en not like 'Adding Land%' and actual_worth>0
    and property_type_en in ('Unit','Villa') and (property_type_en='Villa' or property_sub_type_en='Flat') group by 1""", [since]).fetchall()
by = {r[0]: (r[1], r[2]) for r in rows}
claims = collections.Counter(s for ar, ss in DLD_AREA.items() for s in ss if s in geo)
share_area = collections.Counter(ar for ar, ss in DLD_AREA.items() if len([s for s in ss if s in geo]) > 1)
out = {}
for s in geo:
    ars = [ar for ar, ss in DLD_AREA.items() if s in ss]
    if not ars: continue
    out[s] = {"areas": ars, "sales_all_time": sum(by.get(x, (0, 0))[0] for x in ars), "sales_12m": sum(by.get(x, (0, 0))[1] for x in ars), "shared": any(share_area[x] for x in ars), "window_from": str(since), "as_of": str(last)}
json.dump(out, open(a.out, "w", encoding="utf-8"))
print(len(out), "districts;", sum(1 for v in out.values() if v["shared"]), "shared; majan:", out.get("majan"))
