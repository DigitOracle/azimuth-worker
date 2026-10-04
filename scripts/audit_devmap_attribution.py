"""v325 - AUDIT of developer attribution in the Developers map. READ-ONLY (the lake, local files). Writes local files only.
  python scripts\\audit_devmap_attribution.py --trace <trace.json from trace_devmap_attribution.mjs> --register <area_register.json> --projdev <projdev.json> --geo <districts_geo_all.json>
         --out <prefix> [--max-contradicted-share 0.02] [--max-contradicted-12m 0.03]
Two paths are audited, because the page uses both:
  A  BUILDINGS   every building in the index (unit-mix cards + register-built cards): how its developer was assigned (route) and whether the register agrees.
  B  EVIDENCE    every residential sale in the last 12 months (the numbers behind c12 / the drawer's "last 12 months"): the developer the evidence builder gave it
                 (projdev map by project NAME) against the developer of its DLD project_number.
register truth: g_dld__transactions.project_number -> g_dld__projects.developer_id -> developers register (devattr_register.py). Where a building cannot be tied to
a project_number (no unique name match in the same DLD area) the register is silent: it neither confirms nor contradicts.
Exit 1 when contradicted attributions exceed the thresholds (the monthly guard).
"""
import argparse, collections, csv, datetime as dt, json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, r"C:\Dev\naj-market-pulse\scripts")
import devattr_register as R
from lake import connect
from dld_rent_buildings import DLD_AREA

ap = argparse.ArgumentParser()
ap.add_argument("--trace", required=True); ap.add_argument("--register", required=True); ap.add_argument("--projdev", required=True); ap.add_argument("--geo", required=True)
ap.add_argument("--out", required=True); ap.add_argument("--legacy-evidence", action="store_true", help="audit the v322 evidence logic (name map only) instead of the register-first logic")
ap.add_argument("--max-contradicted-share", type=float, default=None); ap.add_argument("--max-contradicted-12m", type=float, default=None)
a = ap.parse_args()
TEN = ["omniyat", "nakheel", "meraas", "emaar", "imtiaz", "zaya", "ellington", "select-group", "damac", "mered"]
COMMON = "symphony marina park tower residence heights creek bay gate vista horizon sky grand palm beach boulevard central sunset pearl cove wynwood westwood".split()
STEM = re.compile(r"\b(by|the|tower|towers|residences?|residence|building|bldg|apartments?)\b")
nk = lambda s: re.sub(r"[^a-z0-9]+", " ", str(s or "").lower()).strip()
nkey = lambda s: re.sub(r"\s+", "", STEM.sub("", nk(s)))      # the app's own name key: 'Symphony on the Park' and 'Symphony' stay different, 'X Tower' = 'X'

trace = json.load(open(a.trace, encoding="utf-8"))
areas_of = {k: v.get("areas") or [] for k, v in json.load(open(a.register, encoding="utf-8")).items()}
PD = json.load(open(a.projdev, encoding="utf-8"))
geo = [d["slug"] for d in json.load(open(a.geo, encoding="utf-8"))["districts"]]
con = connect()
RD = R.register_devs(con)
last = con.execute("select max(instance_date) from g_dld__transactions where trans_group_en='Sales'").fetchone()[0]
end = (last.replace(day=1) - dt.timedelta(days=1)) if (last + dt.timedelta(days=1)).day != 1 else last
l12_from = dt.date(end.year - 1, end.month + 1, 1) if end.month < 12 else dt.date(end.year, 1, 1)

# ------------------------------------------------------------------ A. buildings -> project_number
all_areas = sorted({x for v in areas_of.values() for x in v})
HOME = "trans_group_en='Sales' and property_usage_en='Residential' and property_type_en in ('Unit','Villa') and coalesce(property_sub_type_en,'Flat') in ('Flat','Villa','Hotel Apartment','Stacked Townhouses')"
rows = con.execute("""select area_name_en, project_number, coalesce(building_name_en,''), coalesce(project_name_en,''), count(*)
  from g_dld__transactions where %s and area_name_en in (%s) group by all""" % (HOME, ",".join("?" * len(all_areas))), all_areas).fetchall()
idx = collections.defaultdict(collections.Counter)       # (area, namekey) -> Counter(pn)
for an, pn, bn, pjn, n in rows:
    for nm in (bn, pjn):
        k = nkey(nm)
        if k: idx[(an, k)][None if pn is None else int(pn)] += n
def match(slug, names):
    c = collections.Counter()
    for an in areas_of.get(slug, []):
        for nm in names:
            k = nkey(nm)
            if k and (an, k) in idx: c.update(idx[(an, k)])
    c.pop(None, None)
    if not c: return None, 0.0
    pn, top = c.most_common(1)[0]
    return pn, top / sum(c.values())

MASTER_LIKE = {"nakheel", "meydan", "dubai-properties", "dubai-hills-estate"}          # the register names a land owner / master developer, not the delivery partner: never a contradiction
CURATED = set(R.X.BY_ID)
def judge(att, reg):
    """status of one attribution against the register developer of its project_number.
    CONTRADICTS = the register developer is a CURATED BRAND (reviewed crosswalk id) and is not the attributed one.
    project company = the register names a company the crosswalk does not know as a brand (an SPV such as THE LAGOONS PHASE ONE L.L.C): its relation to the
    attributed brand is not established either way, so it is reported separately and is NOT counted as an error."""
    if att == "_": return "not recorded"
    if reg is None: return "register silent"
    if reg["canon"] == att: return "register confirms"
    if reg["land_owner"] or reg["canon"] in MASTER_LIKE: return "land owner ambiguous"
    if reg["canon"] in CURATED: return "register CONTRADICTS"
    return "project company (not a brand)"
def route_class(r):
    if r.startswith("card_register:register developer of record"): return "verified: project_number"
    if r.startswith("card_register:crosswalk project_developer"): return "inferred: project name in crosswalk table"
    if r.startswith("card_register:inferred from the project name suffix"): return "inferred: 'by X' suffix"
    if r.startswith("card_register"): return "inferred: " + r
    if r == "card_field": return "inferred: card developer field"
    if r.startswith("ejari_name"): return "inferred: project name in Ejari list"
    if r == "price_index": return "inferred: price index"
    return "no developer"
B = []
for t in trace:
    pn, share = match(t["slug"], [t["name"], t["project"]])
    reg = RD.get(pn) if pn is not None and share >= 0.6 else None
    att = t["canon"] or "_"
    cls = "no developer" if not t.get("dev") else (("verified: register project_number" if t.get("q") == "v" else "inferred: " + route_class(t["route"]).split(": ", 1)[-1]) if "q" in t else route_class(t["route"]))
    st = judge(att, reg)
    B.append({**t, "att": att, "cls": cls, "pn": pn, "share": round(share, 2), "reg": reg["canon"] if reg else "", "reg_name": reg["name_en"] if reg else "", "status": st})

def agg(rows_, keyf):
    d = collections.defaultdict(lambda: [0, 0, 0.0])
    for r in rows_: x = d[keyf(r)]; x[0] += 1; x[1] += r["n"]; x[2] += r["aed"]
    return d
ST = ["register confirms", "register CONTRADICTS", "project company (not a brand)", "land owner ambiguous", "register silent", "not recorded"]
by_route = {}
for c in sorted({b["cls"] for b in B}):
    sub = [b for b in B if b["cls"] == c]
    o = {"buildings": len(sub), "sales": sum(b["n"] for b in sub), "value": sum(b["aed"] for b in sub)}
    for s in ST:
        ss = [b for b in sub if b["status"] == s]; o[s] = {"buildings": len(ss), "sales": sum(b["n"] for b in ss), "value": sum(b["aed"] for b in ss)}
    ck = o["register confirms"]["sales"] + o["register CONTRADICTS"]["sales"]
    o["error_rate_checked_sales"] = o["register CONTRADICTS"]["sales"] / ck if ck else None
    by_route[c] = o
tot = {"buildings": len(B), "sales": sum(b["n"] for b in B), "value": sum(b["aed"] for b in B)}
for s in ST:
    ss = [b for b in B if b["status"] == s]; tot[s] = {"buildings": len(ss), "sales": sum(b["n"] for b in ss), "value": sum(b["aed"] for b in ss)}
ckt = tot["register confirms"]["sales"] + tot["register CONTRADICTS"]["sales"]
tot["error_rate_checked_sales"] = tot["register CONTRADICTS"]["sales"] / ckt if ckt else None
tot["contradicted_share_of_all_sales"] = tot["register CONTRADICTS"]["sales"] / tot["sales"] if tot["sales"] else None

conf = collections.defaultdict(lambda: [0, 0, 0.0])
for b in B:
    if b["status"] == "register CONTRADICTS": x = conf[(b["att"], b["reg"])]; x[0] += 1; x[1] += b["n"]; x[2] += b["aed"]
confusion = sorted(([k[0], k[1], v[0], v[1], round(v[2])] for k, v in conf.items()), key=lambda r: -r[3])
top40 = sorted([b for b in B if b["status"] == "register CONTRADICTS"], key=lambda b: -b["n"])[:40]

ten = {}
for d in TEN:
    mine = [b for b in B if b["att"] == d]
    o = {"sales": sum(b["n"] for b in mine), "value": sum(b["aed"] for b in mine), "buildings": len(mine)}
    ver = [b for b in mine if b["cls"].startswith("verified")]; inf = [b for b in mine if not b["cls"].startswith("verified")]
    o["verified_sales"] = sum(b["n"] for b in ver); o["inferred_sales"] = sum(b["n"] for b in inf)
    o["inferred_confirmed"] = sum(b["n"] for b in inf if b["status"] == "register confirms")
    o["inferred_contradicted"] = sum(b["n"] for b in inf if b["status"] == "register CONTRADICTS")
    o["inferred_silent"] = sum(b["n"] for b in inf if b["status"] in ("register silent", "land owner ambiguous", "project company (not a brand)"))
    o["inferred_contradicted_value"] = sum(b["aed"] for b in inf if b["status"] == "register CONTRADICTS")
    o["leak_out_sales"] = sum(b["n"] for b in B if b["reg"] == d and b["att"] != d and b["status"] == "register CONTRADICTS")   # the register says d, the map says somebody else
    ten[d] = o

# ------------------------------------------------------------------ B. evidence: every residential sale in the last 12 months
names = [ar for ss_ in DLD_AREA for ar in [ss_]]
slug_areas = {}
for ar, ss in DLD_AREA.items():
    ss = [s for s in ss if s in geo]
    if ss: slug_areas.setdefault(ss[0], []).append(ar)
area_slug = {ar: s for s, lst in slug_areas.items() for ar in lst}
ev_rows = con.execute("""select any_value(area_name_en), any_value(project_name_en), any_value(project_number), any_value(actual_worth)
 from g_dld__transactions where trans_group_en='Sales'
  and procedure_name_en in ('Sell','Sell - Pre registration','Delayed Sell','Sell Development','Sale On Payment Plan')
  and property_usage_en='Residential' and property_type_en in ('Unit','Villa') and coalesce(property_sub_type_en,'Flat') in ('Flat','Villa','Hotel Apartment','Stacked Townhouses')
  and actual_worth>=100000 and procedure_area between 15 and 2500 and actual_worth/procedure_area between 3000 and 150000
  and instance_date between ? and ? and area_name_en in (%s) group by transaction_id""" % ",".join("?" * len(area_slug)), [l12_from, end] + list(area_slug)).fetchall()
E = collections.defaultdict(lambda: [0, 0.0])            # (route, att, reg, status) -> n, value
ev_proj = collections.defaultdict(lambda: [0, 0.0])      # (slug, project, att, reg) -> n, value
for an, pn_, pnum, w in ev_rows:
    slug = area_slug[an]; k = nk(pn_)
    att, qq = R.pick(RD, PD, slug, pn_, pnum, nk, legacy=a.legacy_evidence)
    rt = "verified: register project_number" if qq == "v" else ("inferred: project name map" if qq == "i" else "none")
    reg = RD.get(int(pnum)) if pnum is not None else None
    regc = reg["canon"] if reg else ""
    st = judge(att, reg)
    x = E[(rt, att, regc, st)]; x[0] += 1; x[1] += w
    if st == "register CONTRADICTS": y = ev_proj[(slug, pn_ or "", att, regc)]; y[0] += 1; y[1] += w
ev_tot = sum(v[0] for v in E.values()); ev_val = sum(v[1] for v in E.values())
ev_by_status = {s: [sum(v[0] for k, v in E.items() if k[3] == s), sum(v[1] for k, v in E.items() if k[3] == s)] for s in ST}
ev_by_route = {}
for rt in sorted({k[0] for k in E}):
    o = {s: [sum(v[0] for k, v in E.items() if k[0] == rt and k[3] == s), sum(v[1] for k, v in E.items() if k[0] == rt and k[3] == s)] for s in ST}
    ev_by_route[rt] = o
ev_ten = {}
for d in TEN:
    o = {s: sum(v[0] for k, v in E.items() if k[1] == d and k[3] == s) for s in ST}
    o["attributed"] = sum(o.values())
    o["leak_out"] = sum(v[0] for k, v in E.items() if k[2] == d and k[1] != d and k[3] == "register CONTRADICTS")
    o["register_total"] = sum(v[0] for k, v in E.items() if k[2] == d)
    o["attributed_value"] = sum(v[1] for k, v in E.items() if k[1] == d)
    o["contradicted_value"] = sum(v[1] for k, v in E.items() if k[1] == d and k[3] == "register CONTRADICTS")
    ev_ten[d] = o
ev_conf = collections.defaultdict(lambda: [0, 0.0])
for (rt, att, regc, st), v in E.items():
    if st == "register CONTRADICTS": ev_conf[(att, regc)][0] += v[0]; ev_conf[(att, regc)][1] += v[1]
ev_confusion = sorted(([k[0], k[1], v[0], round(v[1])] for k, v in ev_conf.items()), key=lambda r: -r[2])
ev_top40 = sorted(([k[0], k[1], k[2], k[3], v[0], round(v[1])] for k, v in ev_proj.items()), key=lambda r: -r[4])[:40]

# ------------------------------------------------------------------ common-word collisions (path B names)
words = {}
for w in COMMON:
    hit = [(k, v) for k, v in ev_proj.items() if re.search(r"\b%s\b" % w, nk(k[1]))]
    reg_names = collections.defaultdict(collections.Counter)
    for an, pn_, pnum, wv in ev_rows:
        if re.search(r"\b%s\b" % w, nk(pn_)):
            rr = RD.get(int(pnum)) if pnum is not None else None
            reg_names[nk(pn_)][rr["canon"] if rr else "?"] += 1
    ambiguous = {nm: dict(c) for nm, c in reg_names.items() if len([x for x in c if x != "?"]) >= 2}
    words[w] = {"contradicted_projects": len(hit), "contradicted_sales": sum(v[0] for k, v in hit), "names_seen_with_2plus_register_developers": len(ambiguous),
                "names_attributed_by_global_list": sum(1 for k in PD["global"] if re.search(r"\b%s\b" % w, k)),
                "building_rows": sum(1 for b in B if re.search(r"\b%s\b" % w, nk(b["name"] + " " + b["project"]))),
                "building_rows_contradicted": sum(1 for b in B if re.search(r"\b%s\b" % w, nk(b["name"] + " " + b["project"])) and b["status"] == "register CONTRADICTS")}
# project NAMES shared by two or more register developers (the collision set), with the sales the name route would hand to one of them
shared = collections.defaultdict(lambda: collections.defaultdict(int))
for an, pn_, pnum, wv in ev_rows:
    rr = RD.get(int(pnum)) if pnum is not None else None
    if rr and pn_: shared[(area_slug[an], nk(pn_))][rr["canon"]] += 1
coll = [(k, dict(v)) for k, v in shared.items() if len(v) >= 2]

res = {"generated": dt.datetime.now().isoformat(timespec="seconds"), "window_12m": [str(l12_from), str(end)], "register_projects": len(RD),
       "A_buildings": {"total": tot, "by_route": by_route, "confusion": confusion[:80], "top40": [{k: b[k] for k in ("slug", "id", "name", "project", "att", "reg", "reg_name", "route", "n", "aed", "pn", "share")} for b in top40], "ten": ten},
       "B_evidence_12m": {"sales": ev_tot, "value": ev_val, "by_status": ev_by_status, "by_route": ev_by_route, "confusion": ev_confusion[:80], "top40": ev_top40, "ten": ev_ten,
                          "error_rate_checked": ev_by_status["register CONTRADICTS"][0] / max(1, ev_by_status["register CONTRADICTS"][0] + ev_by_status["register confirms"][0]),
                          "contradicted_share_of_all": ev_by_status["register CONTRADICTS"][0] / max(1, ev_tot)},
       "common_words": words, "name_collisions_in_scope": {"names_with_2plus_register_developers": len(coll), "sample": [[list(k), v] for k, v in sorted(coll, key=lambda x: -sum(x[1].values()))[:25]]}}
json.dump(res, open(a.out + ".json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
with open(a.out + "_buildings.csv", "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f); w.writerow(["area", "card_id", "building", "register_project_name", "attributed_developer", "route", "route_class", "index_sales_all_years", "index_sales_value_aed", "matched_project_number", "match_share", "register_developer", "register_developer_name_en", "status"])
    for b in sorted(B, key=lambda b: -b["n"]): w.writerow([b["slug"], b["id"], b["name"], b["project"], b["att"], b["route"], b["cls"], b["n"], round(b["aed"]), b["pn"] or "", b["share"], b["reg"], b["reg_name"], b["status"]])
json.dump(B, open(a.out + "_buildings.json", "w", encoding="utf-8"))
A = res["A_buildings"]["total"]; Bt = res["B_evidence_12m"]
print("A buildings %d, sales %d: confirms %d, CONTRADICTS %d (%.2f%% of all, %.2f%% of checked), project company %d, land-owner %d, silent %d, not recorded %d" % (A["buildings"], A["sales"], A["register confirms"]["sales"], A["register CONTRADICTS"]["sales"], 100 * A["contradicted_share_of_all_sales"], 100 * A["error_rate_checked_sales"], A["project company (not a brand)"]["sales"], A["land owner ambiguous"]["sales"], A["register silent"]["sales"], A["not recorded"]["sales"]))
print("B 12m sales %d: confirms %d, CONTRADICTS %d (%.2f%% of all, %.2f%% of checked), silent %d, not recorded %d" % (Bt["sales"], Bt["by_status"]["register confirms"][0], Bt["by_status"]["register CONTRADICTS"][0], 100 * Bt["contradicted_share_of_all"], 100 * Bt["error_rate_checked"], Bt["by_status"]["register silent"][0], Bt["by_status"]["not recorded"][0]))
bad = []
if a.max_contradicted_share is not None and A["contradicted_share_of_all_sales"] > a.max_contradicted_share: bad.append("buildings: contradicted %.2f%% > %.2f%%" % (100 * A["contradicted_share_of_all_sales"], 100 * a.max_contradicted_share))
if a.max_contradicted_12m is not None and Bt["contradicted_share_of_all"] > a.max_contradicted_12m: bad.append("12-month evidence: contradicted %.2f%% > %.2f%%" % (100 * Bt["contradicted_share_of_all"], 100 * a.max_contradicted_12m))
if bad: print("GUARD FAILED:", "; ".join(bad)); sys.exit(1)
