"""v786a: developer briefing data -> KV dbr_<slug> (one JSON each) + dbr_index. Same rules as the approved mock-up (NOTES.md)."""
import duckdb, json, re
c = duckdb.connect(r"C:\Dev\naj-market-pulse\data\graph\najma.duckdb", read_only=True)
q = lambda s, *a: c.execute(s, list(a)).fetchall()
OUT = r"C:\Users\kwils\AppData\Local\Temp\claude\69ae2f9f80320527\dfdba7aa-873b-4c5f-b88e-7ca4eb14469d\scratchpad\dbr_bulk.json"
SALE = "(t.procedure_name_en ilike 'sell%')"
base = f"""from gov_dld__transactions t where cast(t.instance_date as varchar) >= '2026-01-01' and {SALE}
  and try_cast(t.actual_worth as double) > 50000 and try_cast(t.procedure_area as double) > 10"""
psf = "median(try_cast(t.actual_worth as double)/(try_cast(t.procedure_area as double)*10.7639))"
pnum = "cast(cast(t.project_number as bigint) as varchar)"
MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
maxd = q("select max(cast(instance_date as varchar)) from gov_dld__transactions")[0][0][:10]
half = int(maxd[8:10]) < 25  # the last month is part-month
BR = {
  "Sobha": ["sobha%", "%by sobha%", "skyvue%", "skyscape%"], "Beyond": ["%by beyond%", "kanyon%", "talea%", "soulever%", "passo %", "le chateau%", "hado%"],
  "Nakheel": ["%nakheel%"], "Emaar": ["%emaar%"], "DAMAC": ["damac%", "%by damac%"], "Meraas": ["%meraas%"], "Meydan": ["meydan%"], "Dubai Properties": ["%dubai properties%"],
  "Azizi": ["azizi%"], "Binghatti": ["binghatti%"], "Arada": ["%arada%", "masaar%", "aljada%"], "Imtiaz": ["imtiaz%"], "Fakhruddin": ["%fakhruddin%", "treppan%"],
  "Prestige One": ["%prestige one%"], "Object 1": ["%object 1%", "%object one%"], "Select": ["%select group%", "peninsula%"], "Ellington": ["%ellington%"],
  "Danube": ["%danube%"], "Samana": ["samana%"], "Omniyat": ["%omniyat%"], "Aldar": ["%aldar%"], "Deyaar": ["%deyaar%"],
}
slug = lambda s: re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")
bulk, idx = [], {}
for brand, names in BR.items():
    namecond = " or ".join("t.project_name_en ilike '%s'" % n for n in names)
    own = f"({pnum} in (select cast(project_number as varchar) from dev_project_map where brand='{brand}') or {namecond})"
    w = " and " + own
    tot = q(f"select count(*), {psf}, avg(case when t.reg_type_en ilike 'off%' then 1.0 else 0 end), count(distinct t.project_name_en) {base}{w}")[0]
    if not tot[0] or tot[0] < 20: print("skip", brand, tot[0]); continue
    top = q(f"select t.project_name_en, any_value(t.area_name_en), any_value({pnum}), count(*) n, {psf} {base}{w} and t.project_name_en is not null group by 1 order by n desc limit 5")
    proj, areas = [], []
    for name, area, pno, n, p in top:
        if area not in areas: areas.append(area)
        months = q(f"select cast(strftime(cast(t.instance_date as date), '%m') as int) m, count(*) {base}{w} and t.project_name_en=? group by 1 order by 1", name)
        reg = q("select cast(completion as varchar) from dev_project_map where cast(project_number as varchar)=? and completion is not null limit 1", pno)
        hand = ""
        if reg and reg[0][0] and re.match(r"\d{4}-\d{2}", reg[0][0]): hand = MON[int(reg[0][0][5:7]) - 1] + " " + reg[0][0][:4]
        proj.append({"name": name, "area": area, "sales": n, "psf": round(p or 0), "months": [[m, k] for m, k in months], "handover": hand})
    rivals = {}
    for area in areas[:3]:
        rivals[area] = [{"name": r[0], "sales": r[1], "psf": round(r[2] or 0)} for r in q(f"select t.project_name_en, count(*) n, {psf} {base} and t.area_name_en=? and not {own} and t.project_name_en is not null group by 1 order by n desc limit 2", area)]
    av = [{"project": a[0], "units": a[1], "psf": round(a[2] or 0) if a[2] else None, "sheet_date": str(a[3])[:10]} for a in
          q("select project, units, median_aed_sqft, sheet_date from dev_avail_map where developer ilike ? or brand ilike ? order by units desc limit 8", "%" + brand + "%", "%" + brand + "%")]
    # what they may not know (worked from the numbers only)
    ins = []
    for p in proj[:2]:
        rv = rivals.get(p["area"]) or []
        if rv and rv[0]["psf"] and p["psf"]:
            r = rv[0]; ratio = p["psf"] / r["psf"]
            word = "about twice" if ratio >= 1.8 else ("above" if ratio > 1.05 else ("below" if ratio < 0.95 else "in line with"))
            ins.append({"b": f"{p['name']} sells {word} its neighbours in {p['area']}.", "t": f"{p['sales']:,} sales at AED {p['psf']:,} per sq ft, against {r['name']} ({r['sales']:,} sales, AED {r['psf']:,}).", "src": "reg"})
    p = proj[0]
    if len(p["months"]) >= 3:
        pk = max(p["months"], key=lambda x: x[1]); last = p["months"][-1]
        if pk[0] != last[0] and last[1] < pk[1] * 0.5:
            lab = ("the first half of " if half else "") + MON[last[0] - 1]
            ins.append({"b": f"The launch rush at {p['name']} has passed.", "t": f"{pk[1]:,} sales in {MON[pk[0]-1]}, {last[1]:,} in {lab}. A good moment to ask about the next release and buyer offers.", "src": "reg"})
    for a in av:
        m = next((x for x in proj if a["psf"] and a["project"].split()[0].lower() in x["name"].lower()), None)
        if m and m["psf"] and a["psf"] < m["psf"] * 0.97:
            ins.append({"b": f"{a['project']} is listed below what {m['name']} has sold for.", "t": f"Their sheet asks AED {a['psf']:,} per sq ft ({a['units']} units left); the register shows a median of AED {m['psf']:,} this year ({m['sales']:,} sales).", "src": "both"}); break
    rec = {"brand": brand, "sales": tot[0], "psf": round(tot[1] or 0), "offplan": round((tot[2] or 0) * 100), "projects_selling": tot[3], "top": proj, "rivals": rivals, "avail": av, "insights": ins[:3], "reg_to": maxd, "built": "2026-11-05"}
    bulk.append({"key": "dbr_" + slug(brand), "value": json.dumps(rec, ensure_ascii=False, default=str)}); idx[brand] = slug(brand)
    print(brand, tot[0], len(proj), len(av), len(ins))
bulk.append({"key": "dbr_index", "value": json.dumps(idx)})
json.dump(bulk, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
