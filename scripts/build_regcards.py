"""v401 - REGISTER-BUILT CARDS for the projects that have registered SALES but no developer-page card (completeness audit 7 Oct 2026, build plan item 6).
OFFLINE, DETERMINISTIC, RE-RUNNABLE. Reads the published lake (read-only), the live store through /img (read-only, for the list and the developer profiles) and the position files in this repo;
writes ONE file (default data/regcards/regcards.json). Nothing is deployed, nothing is written to KV (scripts/publish_regcards.py does that, and only Kendall runs it).

  python scripts/build_regcards.py [--out data/regcards/regcards.json] [--naj C:\\Dev\\naj-market-pulse] [--failing <csv from scripts/list_s3_failing.py>] [--built 2026-10-08]

WHO IS IN IT: exactly the register projects the completeness gate reports as failing S3 (no developer-page card in the index, the no-sales group, the not-confirmed group or the announced group).
The list is read from --failing, or computed with the same rule (scripts/list_s3_failing.py: the live /img layers plus any local layer files named on its command line).

WHAT A CARD HOLDS (register facts only, never invented): the register project number and name, the REGISTERED developer company (project row developer_id resolved through the developers register; label
REGISTER_VERIFIED, or NAME_ONLY when the project name says 'by <brand>' and that brand is a curated developer with a profile page), the area, the register status / percent complete / planned end /
registered units, the number of unit sales in the sales register and the date range of those sales, a price range ONLY where five or more sales carry a price, and the best position rung.
A card is NEVER counted: not in a total, a price band, the scale word or an area count. Label on the page: 'Built from the Land Department register; no price card yet'.

KEYING: d[<key>][<district slug>] = [entry, ...]. <key> is the developer's crosswalk id when that developer has a profile page in the live index (devmap_index.devs), else "_" (the area card's
group in one of the 42 districts, the 'Other Dubai areas' card elsewhere). The district slug is the position file's district where it holds the project, else the register district (letters and digits).

ENTRY (compact keys): p register project number, n name, e evidence label, de registered company, br brand (NAME_ONLY filing), a area label, as area source, st/pc/pe/u register facts,
  sc unit and villa sales (Sales group, homes), so other registered sales (land or whole buildings; no price shown), sf first and sl last sale date, np sales that carry a price, pmin/pmax lowest and highest sale price in AED (only when np >= 5), k best position rung (plot | comm; a building
  outline is found by the page itself), o 1 when the district is NOT one of the 42 the developer page has.
"""
import argparse, collections, csv, datetime as dt, json, os, re, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
sys.path.insert(0, HERE)
import build_investor_facts as F  # noqa: E402  (area, slug, title helpers: one rule, not two copies)
import completeness_core as C  # noqa: E402
import list_s3_failing as L  # noqa: E402

MIN_PRICED = 5


def build(naj, failing_rows, idx, built):
    sys.path.insert(0, os.path.join(naj, "scripts"))
    from lake import connect  # noqa: E402
    import build_developer_crosswalk as X  # noqa: E402
    import devattr_register as DR  # noqa: E402
    con = connect()
    SA = DR.sales_area_index()
    pns = sorted({int(r["project_number"]) for r in failing_rows})
    inl = ",".join(str(p) for p in pns)

    def rows(sql):
        r = con.execute(sql)
        cols = [d[0] for d in r.description]
        return [dict(zip(cols, x)) for x in r.fetchall()]

    tx_max = con.execute("select max(instance_date) from g_dld__transactions").fetchone()[0]
    proj = {int(r["pn"]): r for r in rows("""select cast(project_number as bigint) pn, name_en, status, percent_completed pc, end_date ed, registered_units ru, planned_units pu,
        area_name_en area, master_project_en master, developer_id did from lk_d_project where project_number in (%s)""" % inl)}
    devs = {int(r["developer_id"]): r["name_en"] for r in rows("select developer_id, name_en from lk_d_developer where developer_id is not null")}
    sales = {int(r["pn"]): r for r in rows("""select cast(project_number as bigint) pn, count(*) sc, min(instance_date) sf, max(instance_date) sl,
        count(*) filter (where actual_worth > 0) np, min(actual_worth) filter (where actual_worth > 0) pmin, max(actual_worth) filter (where actual_worth > 0) pmax
        from g_dld__transactions where trans_group_en='Sales' and property_type_en in ('Unit','Villa') and project_number in (%s) group by 1""" % inl)}
    other = {int(r["pn"]): int(r["n"]) for r in rows("""select cast(project_number as bigint) pn, count(*) n from g_dld__transactions
        where trans_group_en='Sales' and property_type_en not in ('Unit','Villa') and project_number in (%s) group by 1""" % inl)}
    brand_name = {int(r["pn"]): r["nm"] for r in rows("""select pn, nm from (select cast(project_number as bigint) pn, trim(project_name_en) nm, count(*) c from g_dld__transactions
        where project_name_en is not null and project_number in (%s) group by 1,2) qualify row_number() over (partition by pn order by c desc, nm)=1""" % inl)}
    pp = json.load(open(os.path.join(ROOT, "data", "plot_positions", "plot_positions.json"), encoding="utf-8")).get("p", {})
    cpp = json.load(open(os.path.join(ROOT, "data", "community_positions", "community_positions_projects.json"), encoding="utf-8")).get("p", {})
    prof = {k for k, v in (idx.get("devs") or {}).items() if v.get("profile")}
    areas42 = set((idx.get("areas") or {}))

    out = collections.defaultdict(lambda: collections.defaultdict(list))
    cnt = collections.Counter()
    notes = []
    for r in failing_rows:
        pn = int(r["project_number"])
        pr = proj.get(pn) or {}
        sa = sales.get(pn) or {}
        sc = int(sa.get("sc") or 0)
        so = other.get(pn, 0)
        legal = (devs.get(int(pr["did"])) if pr.get("did") is not None else None) or ""
        legal = legal.strip()
        nm_en = pr.get("name_en") or brand_name.get(pn) or r.get("name")
        name = F.title_case(nm_en) if nm_en else "Registered project " + str(pn)
        rd = F.district_slug(pr.get("area") or r.get("area"))
        area, asrc = F.own_area(pr.get("area") or r.get("area"), F.clean(pr.get("master")), [nm_en, brand_name.get(pn)], SA, DR.is_generic_name)
        gs = (pp.get(str(pn)) or {}).get("d") or rd
        canon = X.canonical_of(legal)[0] if legal else ""
        key, ev, brand = "_", ("REGISTER_VERIFIED" if legal else "UNVERIFIED"), None
        if canon and canon in prof:
            key = canon
        else:
            sfx = re.search(r"\bby\s+(.+)$", nm_en or "", re.I)
            if legal and sfx:
                bc = X.canonical_of(F.title_case(sfx.group(1)))[0]
                if bc in X.BY_ID and bc in prof:
                    key, ev, brand = bc, "NAME_ONLY", X.BY_ID[bc]["display"]
                    cnt["filed_under_brand_by_name"] += 1
        units = int(pr.get("ru") or 0) or int(pr.get("pu") or 0) or int(float(r.get("reg_units") or 0))
        e = {"p": pn, "n": name, "e": ev, "a": area, "as": asrc, "st": pr.get("status") or r.get("status") or None,
             "pc": None if pr.get("pc") is None else round(float(pr["pc"]), 1), "pe": F.iso(pr.get("ed")), "u": units or None, "sc": sc}
        if legal:
            e["de"] = legal
        if brand:
            e["br"] = brand
        if sc:
            e["sf"], e["sl"] = F.iso(sa.get("sf")), F.iso(sa.get("sl"))
            e["np"] = int(sa.get("np") or 0)
            if e["np"] >= MIN_PRICED and sa.get("pmin") is not None:
                e["pmin"], e["pmax"] = int(round(float(sa["pmin"]))), int(round(float(sa["pmax"])))
                cnt["with_price_range"] += 1
        if so:
            e["so"] = so
        if str(pn) in pp:
            e["k"] = "plot"
        elif "p:%d" % pn in cpp:
            e["k"] = "comm"
        if gs not in areas42:
            e["o"] = 1
            cnt["outside_42"] += 1
        e = {k: v for k, v in e.items() if v is not None}
        out[key][gs].append(e)
        cnt["entries"] += 1
        cnt["unit_sales" if sc else ("land_or_building_sales_only" if so else "no_sale_at_all")] += 1
        cnt["developer_page" if key != "_" else "no_developer_page"] += 1
        cnt["rung_" + e.get("k", "none")] += 1
    d = {}
    for k in sorted(out):
        d[k] = {}
        for ds in sorted(out[k]):
            d[k][ds] = sorted(out[k][ds], key=lambda e: (-(e.get("sc") or 0), e["n"], e["p"]))
    return {"meta": {"built": built, "sales_to": F.iso(tx_max), "count": cnt["entries"], "counters": dict(cnt), "min_priced_sales_for_a_range": MIN_PRICED,
                     "label": "Built from the Land Department register; no price card yet",
                     "rule": "Register projects with no developer-page card: shown in a group outside every total, price band, scale word and area count. Facts only from the project register, the developers register and the sales register; a price range only where five or more sales carry a price.",
                     "source": "Dubai Land Department project register, developers register, sales register (unit sales, land excluded)"}, "d": d}, notes


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--naj", default=r"C:\Dev\naj-market-pulse")
    ap.add_argument("--failing", default="", help="the csv written by scripts/list_s3_failing.py --out (default: computed now from the live layers)")
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "regcards", "regcards.json"))
    ap.add_argument("--built", default=dt.date.today().isoformat())
    ap.add_argument("--cache", default=os.path.join(os.environ.get("TEMP", "."), "completeness_cache"))
    a = ap.parse_args()
    idx = C.kv_get("devmap_index", a.cache, 900)
    if a.failing:
        rows = list(csv.DictReader(open(a.failing, encoding="utf-8-sig")))
    else:
        rows = L.failing(C.load_live(a.cache, 900, fast=True), L.K.load_universe(L.K.DEF_UNIVERSE))
    res, notes = build(a.naj, rows, idx, a.built)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(res, fh, ensure_ascii=False, separators=(",", ":"))
    print(json.dumps(res["meta"]["counters"]), "bytes", os.path.getsize(a.out), "input rows", len(rows))
    if notes:
        print("sales count differs from the universe file for %d project(s), e.g. %s" % (len(notes), "; ".join(notes[:5])))


if __name__ == "__main__":
    main()
