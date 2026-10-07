"""v392 - PROJECTS WITH NO REGISTERED SALES YET, for the Developers-by-area page (Kendall, 7 Oct 2026: 'KORE and The Archive by Imtiaz are not on the developer page').
OFFLINE, DETERMINISTIC, RE-RUNNABLE. Reads the published lake (read-only), the register facts already in this repo and the position files; writes ONE file (default data/nosales/nosales.json).
Nothing is deployed, nothing is written to KV (scripts/publish_nosales.py does that, and only Kendall runs it).

  python scripts/build_nosales.py [--out data/nosales/nosales.json] [--naj C:\\Dev\\naj-market-pulse] [--plots <plots.json>]

WHO IS IN IT: every Dubai Land Department project-register project that has ZERO unit sales in the sales register (the same test as the investor facts: unit sales, land excluded, by register
project number), a registered developer (project row developer_id resolved through the developers register to its legal entity) and an area (the project's OWN area, as v382). PLUS KORE by
Imtiaz as an explicit entry: it is not on the project register we hold, the 351 units are on the unit register under building project id 962479984, and its plot (648-8592) is in the plots file.
The two 'KORE BY IMTIAZ' rows in the daily sales files are the developer's LAND purchase and its mortgage (commercial, 3,843.86 sq m = the plot), NOT unit sales: KORE has no registered unit sales.

KEYING: d[<developer slug>][<district slug>] = [entry, ...]. The developer slug is the crosswalk id of the REGISTERED legal entity (the slug the index uses). A registered company that is its own
slug (an SPV such as ROSEWELL PARK REAL ESTATE DEVELOPMENT, the registered developer of The Archive by Imtiaz) is filed under the brand only when the project's own name says 'by <brand>' and the
brand is a curated developer: that is a NAME link (evidence NAME_ONLY, 'br' = the brand, 'de' = the registered company, both shown). A project whose registered company is the curated brand is REGISTER_VERIFIED.
The district slug is the facts shard slug (register area, letters and digits only), the one the index and the position files use.

ENTRY (compact keys): p register project number (null for KORE), id the Investor-PDF facts id, n name, st register status code, pc percent complete, pe planned end, sd start date, u registered units where known,
  a area label, as area source, de registered legal entity, br brand (developer says), e evidence label, k position kind (plot | comm | bld) where one exists, off 1 = not on the project register, no sales ever counted.
SORT: most recent launch (start date) first, then project number descending.
"""
import argparse, collections, datetime as dt, json, os, re, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
sys.path.insert(0, HERE)
import build_investor_facts as F  # noqa: E402  (area, slug, title and status helpers: one rule, not two copies)

KORE_NOTES = [
    "Not on the project register we hold (extract of 1 Sep 2026, the newest we hold). The Land Department building and unit registers hold it as project id 962479984 (351 units).",
    "A third-party site (dubairealestatedata.com, unverified) lists it as registered, active, 351 units, start 15 Nov 2026, 0% complete: UNVERIFIED until a fresh Land Department project register pull.",
    "No registered unit sales yet. The two rows named KORE BY IMTIAZ in the daily sales files (10 Jul 2026) are the developer's land purchase and its mortgage, not sales of homes.",
]


def pkey(n):
    return re.sub(r"[^a-z0-9]+", "", re.sub(r"\s+by\s+.*$", "", str(n or "").lower()))


def build(naj, plots_path, built):
    sys.path.insert(0, os.path.join(naj, "scripts"))
    from lake import connect  # noqa: E402
    import build_developer_crosswalk as X  # noqa: E402
    import devattr_register as DR  # noqa: E402
    con = connect()
    SA = DR.sales_area_index()

    def rows(sql):
        r = con.execute(sql)
        cols = [d[0] for d in r.description]
        return [dict(zip(cols, x)) for x in r.fetchall()]

    tx_max = con.execute("select max(instance_date) from g_dld__transactions").fetchone()[0]
    projs = rows("""select p.project_number pn, p.project_id pid, p.developer_id did, p.project_status st, p.percent_completed pc, p.project_start_date sd, p.project_end_date ed,
        p.no_of_units units, p.area_name_en area, p.master_project_en master, lp.name_en name_en
        from g_dld__projects p left join lk_d_project lp on lp.project_number=p.project_number order by p.project_number""")
    devs = {int(r["developer_id"]): r for r in rows("select * from lk_d_developer where developer_id is not null")}
    with_sales = {int(r["pn"]) for r in rows("select distinct cast(project_number as bigint) pn from g_dld__transactions where trans_group_en='Sales' and property_type_en='Unit' and project_number is not null")}
    brand_name = {int(r["pn"]): r["nm"] for r in rows("""select pn, nm from (select cast(project_number as bigint) pn, trim(project_name_en) nm, count(*) c from g_dld__transactions
        where project_name_en is not null and project_number is not null group by 1,2) qualify row_number() over (partition by pn order by c desc, nm)=1""")}
    umix = {int(r["pn"]): int(r["n"]) for r in rows("select p.project_number pn, count(*) n from g_dld__units u join g_dld__projects p on p.project_id=cast(u.project_id as hugeint) where u.property_type_en='Unit' group by 1")}

    # positions that exist (by register project number)
    pp = json.load(open(os.path.join(ROOT, "data", "plot_positions", "plot_positions.json"), encoding="utf-8")).get("p", {})
    cp = json.load(open(os.path.join(ROOT, "data", "community_positions", "community_positions.json"), encoding="utf-8")).get("p", {})
    comm_key = {}
    for k, v in sorted(cp.items()):
        if v.get("pn"):
            comm_key.setdefault(str(v["pn"]), k)
    plots = json.load(open(plots_path, encoding="utf-8"))["features"]
    bld = {(f["properties"].get("district"), pkey(f["properties"].get("name"))) for f in plots if f["properties"].get("i") is not None and f["properties"].get("name")}

    out = collections.defaultdict(lambda: collections.defaultdict(list))
    cnt = collections.Counter()
    for r in projs:
        pn = int(r["pn"])
        cnt["register_projects"] += 1
        if pn in with_sales:
            continue
        cnt["zero_sales"] += 1
        did = int(r["did"]) if r["did"] is not None else None
        dv = devs.get(did) if did is not None else None
        if not (dv and dv["name_en"]):
            cnt["no_registered_developer"] += 1
            continue
        if not (r["area"] or r["master"]):
            cnt["no_area"] += 1
            continue
        legal = dv["name_en"].strip()
        nm_en = r["name_en"] or brand_name.get(pn)
        bname = F.title_case(brand_name.get(pn) or nm_en) if (brand_name.get(pn) or nm_en) else "Registered project " + str(pn)
        name = F.title_case(nm_en) if nm_en else bname
        area, asrc = F.own_area(r["area"], F.clean(r["master"]), [nm_en, brand_name.get(pn)], SA, DR.is_generic_name)
        dslug = F.district_slug(r["area"])
        canon = X.canonical_of(legal)[0]
        curated = canon in X.BY_ID
        key, ev, brand = canon, "REGISTER_VERIFIED", None
        sfx = re.search(r"\bby\s+(.+)$", nm_en or "", re.I)
        if not curated and sfx:
            bc = X.canonical_of(F.title_case(sfx.group(1)))[0]
            if bc in X.BY_ID:
                key, ev, brand = bc, "NAME_ONLY", X.BY_ID[bc]["display"]
                cnt["filed_under_brand_by_name"] += 1
        elif curated:
            brand = X.BY_ID[canon]["display"] if False else None
        units = int(r["units"] or 0) or umix.get(pn, 0)
        pid = F.LEGACY_IDS.get(pn) or ((F.slug(bname) or "project") + "-" + str(pn))
        e = {"p": pn, "id": pid, "n": name, "st": r["st"], "pc": None if r["pc"] is None else round(float(r["pc"]), 1), "pe": F.iso(r["ed"]), "sd": F.iso(r["sd"]),
             "u": units or None, "a": area, "as": asrc, "de": legal, "e": ev}
        if brand:
            e["br"] = brand
        gs = dslug      # the slug the PAGE uses for this card: the position files' own district where they hold the project, else the register district
        if str(pn) in pp:
            e["k"] = "plot"
            gs = pp[str(pn)].get("d") or dslug
        elif (dslug, pkey(name)) in bld:
            e["k"] = "bld"
        elif str(pn) in comm_key and comm_key[str(pn)].split("|")[1] == pkey(name):
            e["k"] = "comm"
            gs = comm_key[str(pn)].split("|")[0]
        e = {k: v for k, v in e.items() if v is not None}
        out[key][gs].append(e)
        cnt["entries"] += 1

    # KORE by Imtiaz: explicit, off the project register
    kp = next(f for f in plots if f["properties"].get("plot") == "648-8592")
    lon, lat = kp["geometry"]["coordinates"]
    kore = {"p": None, "key": "kore", "id": "kore-by-imtiaz-offregister", "n": "KORE by Imtiaz", "u": 351, "a": "Dubai Land Residence Complex", "as": "register_master", "br": "Imtiaz",
            "e": "DEVELOPER_CLAIMED", "off": 1, "k": "plot", "plot": "648-8592", "notes": KORE_NOTES,
            "pp": {"lon": lon, "lat": lat, "parcels": ["6488592"], "n_plots": 1, "basis": "makani_plot_outline", "evidence": "DERIVED", "link": "REGISTER_VERIFIED",
                   "label": "Plot position (centre of the registered plot); the building outline is not on our map yet", "as_of": "2026-10-06"}}
    out["imtiaz"]["wadialsafa5"].append(kore)
    cnt["entries"] += 1

    def sortk(e):
        return (0 if e.get("off") else 1, "".join(chr(255 - ord(c)) for c in (e.get("sd") or "0000-00-00")), -(e.get("p") or 0))
    d = {}
    for k in sorted(out):
        d[k] = {}
        for ds in sorted(out[k]):
            d[k][ds] = sorted(out[k][ds], key=sortk)
    return {"meta": {"built": built, "sales_to": F.iso(tx_max), "count": cnt["entries"], "counters": dict(cnt),
                     "rule": "Projects with no registered unit sales: never counted in any total, price band or scale. Developer = the register's developer id resolved to its legal entity (a brand filed by project name is labelled NAME_ONLY).",
                     "source": "Dubai Land Department project register, developers register, unit register; KORE: building register, plots file, developer says"}, "d": d}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--naj", default=r"C:\Dev\naj-market-pulse")
    ap.add_argument("--plots", default=None)
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "nosales", "nosales.json"))
    ap.add_argument("--built", default="2026-10-07")
    a = ap.parse_args()
    res = build(a.naj, a.plots or os.path.join(a.naj, "data", "board", "plots.json"), a.built)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(res, fh, ensure_ascii=False, separators=(",", ":"))
    print(json.dumps(res["meta"]["counters"]), "bytes", os.path.getsize(a.out))
    im = res["d"].get("imtiaz", {})
    print("imtiaz", sum(len(v) for v in im.values()), "wadialsafa5", len(im.get("wadialsafa5", [])))


if __name__ == "__main__":
    main()
