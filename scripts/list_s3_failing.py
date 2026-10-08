"""v401 - list the register projects that fail S3 (developer page card) today, grouped by cause. READ-ONLY (live /img through the completeness core, or local layer files).

  python scripts/list_s3_failing.py [--out <csv>] [--nosales f --notconf f --announced f --regcards f] [--cache dir]

Causes: A_in42_sales   the project has registered sales and its area is one of the 42 districts the developer page has (needs a card under its area)
        B_out42_sales  registered sales, area outside the 42 districts
        C_no_sales     no registered sale (not this item; reported so the count adds up)
        D_not_in_lake  not on the project register extract we hold (named only by sales or the building register)
"""
import argparse, collections, csv, os, re, sys, tempfile

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import completeness_core as C
import check_completeness as K


def dslug(s):
    return re.sub(r"[^a-z0-9]+", "", str(s or "").lower()) or "unknown"


def failing(kv, rows):
    S = C.build_surfaces(kv)
    areas = set(kv["devmap_index"]["areas"])
    out = []
    for r in rows:
        if not str(r["source"]).startswith(K.BASE_SOURCES):
            continue
        f = C.project_flags(r, S, {})
        if f["F"]["S3"]:
            continue
        sales = int(float(r.get("sales_all") or 0))
        in42 = dslug(r.get("area")) in areas
        cause = "C_no_sales" if sales == 0 else ("A_in42_sales" if in42 else "B_out42_sales")
        out.append(dict(r, _cause=cause, _in42=in42, _district=dslug(r.get("area"))))
    return out


def main(argv=None):
    ap = K.build_parser()
    ap.add_argument("--out", default="")
    a = ap.parse_args(argv)
    rows = K.load_universe(a.universe)
    kv = C.load_live(a.cache, a.max_age, fast=True)
    K.apply_overrides(kv, a)
    bad = failing(kv, rows)
    cnt = collections.Counter(x["_cause"] for x in bad)
    print("S3 failing (base register projects): %d" % len(bad))
    for k, v in sorted(cnt.items()):
        print("  %-15s %d" % (k, v))
    dev = collections.Counter(x["developer_canon"] or "(none)" for x in bad if x["_cause"].startswith(("A", "B")))
    print("  distinct developers (A+B): %d; top: %s" % (len(dev), dev.most_common(6)))
    if a.out:
        with open(a.out, "w", encoding="utf-8-sig", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["source", "project_number", "name", "developer_register", "developer_canon", "area", "district", "in42", "status", "reg_units", "sales_all", "cause"])
            for x in bad:
                w.writerow([x["source"], x["project_number"], x["name"], x["developer_register"], x["developer_canon"], x["area"], x["_district"], int(x["_in42"]), x["status"], x["reg_units"], x["sales_all"], x["_cause"]])
        print("wrote " + a.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
