"""v325 - MONTHLY GUARD for developer attribution in the LIVE Developers-by-area index. Read-only. Exit 1 when the register contradicts too much of it.
  python scripts\\guard_devmap_attribution.py --index <img_devmap_index json> --register <area_register.json> [--max-contradicted 0.01] [--max-project-contradicted 0.02] [--out report.json]
For every project the live index lists under a developer (b = all years, b12 = last 12 months, each [sales, price per sq m, project name]) the project name is tied to a
DLD project_number inside that area, and the register's developer (developer_id) is compared with the developer the page shows. Counts SALES, not projects.
  CONTRADICTS  the register names a developer the crosswalk knows as a brand, and it is not the one the page shows (the Town Square 'Symphony' = Imtiaz case).
  project company / land owner / register silent are reported but are not errors.
Thresholds (defaults): contradicted sales over 1% of the sales the guard could check, or any single developer with more than 2% of its listed sales contradicted.
Run it through scripts\\guard_devmap_attribution.ps1 (it reads the live index and the quiet-window rule), monthly after the register refresh.
"""
import argparse, collections, json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, r"C:\Dev\naj-market-pulse\scripts")
import devattr_register as R
from lake import connect

ap = argparse.ArgumentParser(); ap.add_argument("--index", required=True); ap.add_argument("--register", required=True)
ap.add_argument("--max-contradicted", type=float, default=0.01); ap.add_argument("--max-project-contradicted", type=float, default=0.02); ap.add_argument("--out", default=None)
a = ap.parse_args()
idx = json.load(open(a.index, encoding="utf-8"))
areas_of = {k: v.get("areas") or [] for k, v in json.load(open(a.register, encoding="utf-8")).items()}
con = connect()
RD = R.register_devs(con)
ni = R.NameIndex(con, sorted({x for v in areas_of.values() for x in v}))
tot = collections.Counter(); per_dev = collections.defaultdict(collections.Counter); bad = []
for slug, A in idx["areas"].items():
    for dk, d in A["devs"].items():
        if dk == "_": continue
        for lst in (d.get("b") or [], d.get("b12") or []):      # all years, then the last 12 months (each project counted in both windows it appears in)
            for n, _p, name in lst:
                pn, share = ni.match(areas_of.get(slug, []), [name])
                rd = RD.get(pn) if pn is not None and share >= 0.6 else None
                st = R.judge(dk, rd)
                tot[st] += n; per_dev[dk][st] += n
                if st == "register CONTRADICTS": bad.append([slug, dk, rd["canon"], name, n])
checked = tot["register confirms"] + tot["register CONTRADICTS"]
share = tot["register CONTRADICTS"] / checked if checked else 0
worst = sorted(((k, c["register CONTRADICTS"], c["register CONTRADICTS"] / max(1, c["register confirms"] + c["register CONTRADICTS"])) for k, c in per_dev.items() if c["register CONTRADICTS"]), key=lambda x: -x[1])[:15]
rep = {"checked_sales": checked, "contradicted_sales": tot["register CONTRADICTS"], "contradicted_share": share, "totals": dict(tot), "worst_developers": worst, "top_contradictions": sorted(bad, key=lambda r: -r[4])[:25]}
if a.out: json.dump(rep, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("checked %d listed sales: confirms %d, CONTRADICTS %d (%.2f%%), project company %d, land owner %d, register silent %d" % (checked, tot["register confirms"], tot["register CONTRADICTS"], 100 * share, tot["project company (not a brand)"], tot["land owner ambiguous"], tot["register silent"]))
for r in rep["top_contradictions"][:10]: print("   %-22s shows %-18s register says %-18s %-34s %d sales" % (r[0], r[1], r[2], r[3][:34], r[4]))
fail = []
if share > a.max_contradicted: fail.append("contradicted %.2f%% of checked sales is over the %.2f%% limit" % (100 * share, 100 * a.max_contradicted))
for k, nbad, sh in worst:
    if sh > a.max_project_contradicted and nbad >= 50: fail.append("%s: %.1f%% of its listed sales contradicted (%d)" % (k, 100 * sh, nbad))
if fail: print("GUARD FAILED:"); [print("  - " + f) for f in fail]; sys.exit(1)
print("GUARD OK")
