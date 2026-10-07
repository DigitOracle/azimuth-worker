"""DELIVERY RECORD, per registered developer company, from the Dubai Land Department project register (v375, Gap 3, 7 Oct 2026).

For every finished project that has BOTH a planned end date and a completion date, was not cancelled and was completed on or before the day
this runs: was it finished later than the planned end date, and by how many months. The register is read through the published lake
(g_dld__projects, read-only; same store scripts/lake.py in naj-market-pulse opens). Nothing is written to KV, nothing is published.

Output (default this repo's data/delivery_record/):
  delivery_record.json   { by: { "<developer_id>": { name, n, late, m: [months late of each late project, sorted] } }, rule, caveat, ... }
  delivery_record_audit.csv   one row per developer company with 3 or more projects having both dates (the numbers the page can show)

THE KEY IS THE REGISTER'S DEVELOPER ID, because that is what "register-verified" means: the project row names its developer company by id.
The developer page joins its own register-confirmed projects (the v373 evidence, attribution REGISTER_VERIFIED, with the developer id on
each) to this file; the page counts the whole record of those companies and shows nothing under 3 projects.

CAVEAT, printed with every figure: a developer can revise the planned end date on the register, so a project that moved its own date
may not show as late. This is history, not a forecast.

  python scripts/build_delivery_record.py [--naj C:\\Dev\\naj-market-pulse] [--out-dir DIR]
"""
import argparse, csv, datetime as dt, json, os, statistics, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
MONTH_DAYS = 30.4375
MIN_PROJECTS = 3


def months_late(end, done):
    return (done - end).days / MONTH_DAYS


def summarise(rows, today):
    """rows: [(project_number, end_date, completion_date)] -> {n, late, m}; the rules are exactly these two lines."""
    n, m = 0, []
    for pn, end, done in rows:
        if end is None or done is None or done > today:
            continue
        n += 1
        if done > end:
            m.append(round(months_late(end, done), 2))
    return {"n": n, "late": len(m), "m": sorted(m)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--naj", default=r"C:\Dev\naj-market-pulse")
    ap.add_argument("--out-dir", default=os.path.join(ROOT, "data", "delivery_record"))
    a = ap.parse_args()
    sys.path.insert(0, os.path.join(a.naj, "scripts"))
    from lake import connect  # noqa: E402
    con = connect()
    today = dt.date.today()
    rows = con.execute(
        "select cast(developer_id as bigint), project_number, project_end_date, completion_date from g_dld__projects "
        "where project_status = 'FINISHED' and project_end_date is not null and completion_date is not null and cancellation_date is null "
        "and developer_id is not null").fetchall()
    names = dict(con.execute("select developer_id, name_en from lk_d_developer").fetchall())
    loaded = con.execute("select max(load_timestamp) from g_dld__projects").fetchone()[0]
    by_dev = {}
    for di, pn, end, done in rows:
        by_dev.setdefault(int(di), []).append((pn, end, done))
    by = {}
    for di, rs in sorted(by_dev.items()):
        s = summarise(rs, today)
        if s["n"]:
            by[str(di)] = {"name": names.get(di) or "", **s}
    doc = {"version": 1, "generated": dt.datetime.now().strftime("%Y-%m-%d %H:%M"), "label": "DERIVED",
           "source": "Dubai Land Department project register (g_dld__projects: project_status, project_end_date, completion_date, cancellation_date, developer_id), register rows loaded to " + str(loaded)[:10],
           "rule": "FINISHED projects with a planned end date and a completion date on or before " + str(today) + ", not cancelled. Late = completion date after the planned end date. Months = days / 30.4375, over the late projects only.",
           "caveat": "A developer can revise the planned end date on the register, so a project that moved its own date may not show as late. This is history, not a forecast.",
           "min_projects": MIN_PROJECTS, "by": by}
    os.makedirs(a.out_dir, exist_ok=True)
    p = os.path.join(a.out_dir, "delivery_record.json")
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    ap_ = os.path.join(a.out_dir, "delivery_record_audit.csv")
    shown = [(k, v) for k, v in by.items() if v["n"] >= MIN_PROJECTS]
    shown.sort(key=lambda kv: (-kv[1]["late"] / kv[1]["n"], -kv[1]["n"]))
    with open(ap_, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["developer_id", "register_name", "projects_with_both_dates", "finished_late", "share_late_pct", "median_months_late_of_the_late"])
        for k, v in shown:
            w.writerow([k, v["name"], v["n"], v["late"], round(100 * v["late"] / v["n"]), round(statistics.median(v["m"]), 1) if v["m"] else ""])
    print("wrote", p, len(by), "developer companies;", len(shown), "with 3 or more projects;", sum(v["n"] for v in by.values()), "projects;", sum(v["late"] for v in by.values()), "late")
    for k, v in shown[:12]:
        print(k, v["name"], v["n"], v["late"], round(statistics.median(v["m"]), 1) if v["m"] else "")


if __name__ == "__main__":
    main()
