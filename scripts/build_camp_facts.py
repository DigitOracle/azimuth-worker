"""v724 - campaign facts for the Palm Jebel Ali owners flow, as DATA: camp_facts_pja, camp_brief_palm-springs, camp_brief_palm-central.

Every fact is {"value", "source", "as_of"}. A fact the sources do not state is "to confirm". Nothing is estimated, rounded up or inferred.

Sources, in order:
  1. MotherDuck governed views (najma_gateway_transactions etc.) - only after `python scripts/md_methodology.py qa` passes in naj-market-pulse.
  2. The LOCAL extract C:\\Dev\\naj-market-pulse\\naj.duckdb (DLD gateway: transactions, rents, projects) when MotherDuck is unavailable.
     Same definitions as the methodology: sale = Sales group with procedure Sale / Sell - Pre registration / Delayed Sell, usage Residential;
     medians trimmed to AED 100k-500M; counts never trimmed; windows anchored on the data's own as-of date.
  3. The developer documents captured from the DEVELOPER AVAILABILITY group (listener docs dirs): the newest PDF matching each project.

  python scripts/build_camp_facts.py --out <dir>            writes the three JSON files, prints them
  python scripts/build_camp_facts.py --out <dir> --store    ALSO writes them to KV (azimuth-2, MEETINGS) with wrangler. Kendall's call.
"""
import argparse, datetime, json, os, re, subprocess, sys

sys.path.insert(0, os.path.dirname(__file__))
from build_camp_brief import extract, pdf_text, TBC  # noqa: E402

NAJ_DB = r"C:\Dev\naj-market-pulse\naj.duckdb"
DOC_DIRS = [r"C:\Dev\azimuth-listener-dev\docs\developer_availability", r"C:\Dev\azimuth-listener-naj\docs\developer_availability"]
SALE = "GROUP_EN='Sales' and PROCEDURE_EN in ('Sale','Sell - Pre registration','Delayed Sell') and USAGE_EN='Residential'"
SQFT = 10.7639


def F(value, source, as_of):
    if value is None or value == "" or value == []:
        return {"value": TBC, "source": source, "as_of": as_of}
    return {"value": value, "source": source, "as_of": as_of}


def tbc(why):
    return {"value": TBC, "source": why, "as_of": ""}


def newest_doc(name_key):
    hits = []
    for d in DOC_DIRS:
        if os.path.isdir(d):
            for f in os.listdir(d):
                if f.lower().endswith(".pdf") and name_key in re.sub(r"[^a-z0-9]", "", f.lower()):
                    hits.append((f, d))
    hits.sort(reverse=True)   # file names start with the capture time in ms
    return hits


def cap_date(f):
    m = re.match(r"^(\d{13})_", f)
    return datetime.datetime.fromtimestamp(int(m.group(1)) / 1000, datetime.timezone.utc).strftime("%Y-%m-%d") if m else ""


def aed(x):
    return "AED " + format(int(round(x)), ",")


def local_facts():
    import duckdb
    c = duckdb.connect(NAJ_DB, read_only=True)
    q = lambda s: c.execute(s).fetchall()
    asof = str(q("select max(INSTANCE_DATE) from transactions")[0][0])[:10]
    first = str(q("select min(INSTANCE_DATE) from transactions")[0][0])[:10]
    src = "DLD gateway extract (local naj.duckdb, " + first + " to " + asof + "); Najma methodology definitions"
    w = "AREA_EN='Palm Jabal Ali' and " + SALE
    val = "try_cast(TRANS_VALUE as double)"
    psf = val + "/(try_cast(PROCEDURE_AREA as double)*" + str(SQFT) + ")"
    trim = val + " between 100000 and 500000000"
    n_all, n_off, n_ready = q("select count(*), count(*) filter (where IS_OFFPLAN_EN='Off-Plan'), count(*) filter (where IS_OFFPLAN_EN='Ready') from transactions where " + w)[0]
    med = q("select median(" + psf + "), median(" + val + ") from transactions where " + w + " and " + trim)[0]
    months = q("select substr(INSTANCE_DATE,1,7) m, count(*), median(" + psf + ") from transactions where " + w + " and " + trim + " group by 1 order by 1")
    projs = q("select PROJECT_EN, count(*) from transactions where " + w + " group by 1 order by 2 desc")
    beds = q("select PROJECT_EN, ROOMS_EN, count(*), median(" + val + ") from transactions where " + w + " and " + trim + " group by all order by 1, 2")
    reg = q("select PROJECT_EN, DEVELOPER_EN, PROJECT_STATUS, PERCENT_COMPLETED, START_DATE, END_DATE, CNT_UNIT, CNT_VILLA from projects where AREA_EN='Palm Jabal Ali' order by PROJECT_EN")
    rents_pja = q("select count(*) from rents where AREA_EN='Palm Jabal Ali'")[0][0]
    rasof = str(q("select max(REGISTRATION_DATE) from rents")[0][0])[:10]
    rcomp = q("select PROP_SUB_TYPE_EN, count(*), median(try_cast(ANNUAL_AMOUNT as double)) from rents where AREA_EN='Palm Jumeirah' and PROP_SUB_TYPE_EN in ('Villa','Flat') and try_cast(ANNUAL_AMOUNT as double) between 8000 and 3000000 group by 1")
    rsrc = "DLD Ejari rents extract (local naj.duckdb, to " + rasof + ")"
    regsrc = "DLD project register (local naj.duckdb projects table, read " + asof + ")"
    f = {
        "pja_home_sales": F("%d home sales registered on Palm Jebel Ali from %s to %s (%d off-plan, %d ready)" % (n_all, first, asof, n_off, n_ready), src, asof),
        "pja_median_psf": F(aed(med[0]) + " per sq ft (median, home sales)" if med[0] else None, src, asof),
        "pja_median_price": F(aed(med[1]) + " (median home sale)" if med[1] else None, src, asof),
        "pja_psf_by_month": F([{"month": m, "sales": n, "median_psf": int(round(p))} for m, n, p in months], src, asof),
        "pja_projects_selling": F([{"project": p, "sales": n} for p, n in projs], src, asof),
        "pja_register": F([{"project": r[0], "developer": r[1], "status": r[2], "percent_complete": r[3], "start": str(r[4])[:10], "planned_end": str(r[5])[:10], "units": r[6], "villas": r[7]} for r in reg], regsrc, asof),
        "pja_units_registered": F("%s units across %d registered projects" % (format(sum(int(r[6] or 0) for r in reg), ","), len(reg)) if reg else None, regsrc, asof),
        "pja_rents": F("No Ejari rent contracts on Palm Jebel Ali yet (%d)" % rents_pja if rents_pja == 0 else "%d contracts" % rents_pja, rsrc, rasof),
        "comparable_rents_palm_jumeirah": F([{"type": t, "contracts": n, "median_annual": aed(m)} for t, n, m in rcomp], rsrc + "; Palm Jumeirah shown as the nearest comparable, NOT Palm Jebel Ali", rasof),
        "pja_supply_pipeline": F([{"project": r[0], "units": r[6], "planned_end": str(r[5])[:10]} for r in reg], regsrc, asof),
        "nakheel_track_record": tbc("lk_developer_brand is in MotherDuck, which was not available for this build"),
        "dubai_2040_context": tbc("not computed in this build"),
        "drive_times": tbc("not computed in this build"),
        "schools_amenities": tbc("not computed in this build"),
    }
    bedmed = {}
    for p, rm, n, m in beds:
        bedmed.setdefault(p, []).append({"rooms": rm, "sales": n, "median_price": aed(m)})
    return f, bedmed, reg, src, regsrc, asof


def doc_facts(key, project):
    hits = newest_doc(key)
    if not hits:
        return {}, None
    f, d = hits[0]
    b = extract(pdf_text(os.path.join(d, f)), project)
    return b, (f, cap_date(f))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--store", action="store_true")
    ap.add_argument("--source", choices=["local", "motherduck"], default="local")
    a = ap.parse_args()
    if a.source == "motherduck":
        sys.exit("MotherDuck path: run `python scripts/md_methodology.py qa` in naj-market-pulse first; on 3 Nov it crashed (GIL error) and the daily compute limit was hit, so this build uses --source local")
    facts, bedmed, reg, src, regsrc, asof = local_facts()
    facts["_meta"] = {"built": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "source_mode": "local naj.duckdb (MotherDuck unavailable 3 Nov)"}

    # Palm Springs: the one-pager only (not yet in the DLD register)
    ps, psrc = doc_facts("palmsprings", "Palm Springs")
    dsrc = ("developer one-pager " + psrc[0]) if psrc else "no document captured"
    dd = psrc[1] if psrc else ""
    springs = {"slug": "palm-springs", "project": "Palm Springs",
               "developer": F(ps.get("developer"), dsrc, dd), "location": F(ps.get("location"), dsrc, dd),
               "price": F(ps.get("price"), dsrc, dd), "payment_plan": F(ps.get("payment_plan"), dsrc, dd), "handover": F(ps.get("handover"), dsrc, dd),
               "unit_types": F(ps.get("unit_types"), dsrc, dd), "unit_sizes": F(ps.get("unit_sizes"), dsrc, dd),
               "highlights": F(ps.get("highlights"), dsrc, dd), "nearby": F(ps.get("nearby"), dsrc, dd),
               "dld_register": tbc("not in the DLD project register extract (" + asof + ")"),
               "compare_pja": F("Palm Jebel Ali home sales so far are apartments at Palm Central: " + facts["pja_median_price"]["value"] + "; Palm Springs is townhouses and villas, so the two are not like for like", src, asof),
               "images": [], "caveat": ps.get("caveat", ""), "source": {"file": psrc[0] if psrc else TBC, "captured_at": dd}}
    # Palm Central: the brochure, the floor plans and the DLD register + sales
    pc, csrc = doc_facts("palmcentralbrochure", "Palm Central")
    fp = newest_doc("palmcentralfloorplans")
    bsrc = ("developer brochure " + csrc[0]) if csrc else "no document captured"
    bd = csrc[1] if csrc else ""
    btxt = re.sub(r"\s+", " ", pdf_text(os.path.join(newest_doc("palmcentralbrochure")[0][1], newest_doc("palmcentralbrochure")[0][0]))) if csrc else ""
    m = re.search(r"collection of (\d+)[\s\S]{0,60}?across (\w+)[\s\S]{0,20}?buildings", btxt)
    homes = ("%s homes across %s buildings, between Fronds M and N" % (m.group(1), m.group(2))) if m and "Fronds M and N" in btxt.replace("\n", " ") else (("%s homes across %s buildings" % (m.group(1), m.group(2))) if m else None)
    types_doc = None
    if fp:
        u = pdf_text(os.path.join(fp[0][1], fp[0][0]))
        kinds = sorted(set(re.sub(r"\s+", " ", k).title() for k in re.findall(r"\d-BEDROOM\s+(?:APARTMENT|TOWNHOUSE|PENTHOUSE)", u)))
        types_doc = (", ".join(kinds), "developer floor plans " + fp[0][0], cap_date(fp[0][0]))
    amen = []   # the brochure's numbered amenity keys ("1. Padel Court 2. Outdoor Co-working ..."), capitalised words only
    for x in re.findall(r"\b\d{1,2}\.\s+((?:(?:[A-Z][\w’'&-]*|with|and|&)\s?){1,6})", btxt):
        x = re.sub(r"\s+(?:with|and|&)$", "", x.strip())
        if len(x) > 3 and not x.isupper() and x not in amen:
            amen.append(x)
    pcreg = [r for r in reg if r[0].startswith("Palm Central")]
    central = {"slug": "palm-central", "project": "Palm Central Private Residences",
               "developer": F(pc.get("developer") or ("Nakheel" if "Nakheel is one of" in btxt else None), bsrc, bd),
               "developer_register": F("; ".join(sorted(set(r[1] for r in pcreg))), regsrc, asof),
               "location": F("Palm Jebel Ali, between Fronds M and N" if "Fronds M and N" in btxt.replace("\n", " ") else None, bsrc, bd),
               "homes": F(homes, bsrc, bd),
               "units_register": F("; ".join("%s: %s units" % (r[0].replace("Palm Central Private Residences - ", ""), r[6]) for r in pcreg), regsrc, asof),
               "unit_types": F(types_doc[0], types_doc[1], types_doc[2]) if types_doc else tbc("no floor plans captured"),
               "unit_types_brochure": F("one- to three-bedroom apartments" if re.search(r"one- to three-bedroom", btxt) else None, bsrc, bd),
               "price": F([x for p in bedmed for x in bedmed[p] if p.startswith("Palm Central")] and
                          "; ".join("%s %s median %s (%d sales)" % (p.replace("Palm Central Private Residences - ", ""), x["rooms"], x["median_price"], x["sales"]) for p in bedmed if p.startswith("Palm Central") for x in bedmed[p]), src, asof),
               "price_list": tbc("no developer price list captured"),
               "payment_plan": F(pc.get("payment_plan"), bsrc, bd),
               "handover": F("; ".join("%s planned end %s (%s%% complete)" % (r[0].replace("Palm Central Private Residences - ", ""), str(r[5])[:10], r[3]) for r in pcreg), regsrc, asof),
               "highlights": F(amen[:12], bsrc, bd), "nearby": F(["Community Centre & Mosque", "Sports & Wellness Centre", "Park"] if "Community Centre & Mosque" in btxt else None, bsrc, bd),
               "images": [], "caveat": "Floor plans and visuals are approximate and for marketing only (developer disclaimer). Sale figures are DLD registrations, not the developer's price list.",
               "source": {"file": csrc[0] if csrc else TBC, "captured_at": bd}}
    os.makedirs(a.out, exist_ok=True)
    out = {"camp_facts_pja": facts, "camp_brief_palm-springs": springs, "camp_brief_palm-central": central}
    for k, v in out.items():
        p = os.path.join(a.out, k + ".json")
        json.dump(v, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("wrote", p)
        cmd = ["npx", "wrangler", "kv", "key", "put", "--env", "azimuth2", "--binding", "MEETINGS", k, "--path", p]
        if a.store:
            subprocess.run(cmd, check=True, shell=(os.name == "nt"))
        else:
            print("  to store (NOT run): " + " ".join(cmd))


if __name__ == "__main__":
    main()
