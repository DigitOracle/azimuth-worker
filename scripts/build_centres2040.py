"""v380 - build data/centres2040/centres2040.json (KV img_centres2040) from the approved Dubai 2040 centres grouping.

OFFLINE. Reads (never writes) the approved grouping in the shared market-pulse repo:
  docs/DUBAI_2040_CENTRES_PROPOSED.geojson   (Dubai Municipality community polygons, tiers, coastal flags)
  docs/DUBAI_2040_CENTRES_MAPPING.csv        (per community / master community / app district: centre, tier, evidence, units)
  data/board/district_polygons.geojson       (the 44 app districts and the Dubai Municipality community number each stands on)
Writes (here):
  data/centres2040/centres2040.json          the compact file the page reads (what=centres)
  data/centres2040/centres2040_audit.csv     one row per community: what was decided and why

  python scripts/build_centres2040.py [--tol-m 30] [--docs <dir>] [--out <file>] [--audit <file>]

The plan (Dubai 2040 Urban Master Plan, UAE Government, 13 Mar 2021) names five centres and their roles; it publishes no boundaries.
The grouping is OUR OWN and every output says so. The sixth layer (coastal) is Najma's addition and is never part of the plan.

JUDGEMENT RULES applied here (documented again in the report):
  1. Display tier: CORE and ADJACENT communities are drawn solid, PERIPHERAL communities in a lighter tint ("peripheral in our grouping"),
     OUTSIDE (beyond the 4 km cut-off) neutral, OFFSHORE (no land stock) not grouped and not drawn.
  2. Centre 4: the one polygon the plan's text can stand on is Madinat Al Mataar (Expo City, Dubai South and the airport district).
     The 13 communities that only touch it (Jebel Ali Industrial, Dubai Investment Park, Saih Shuaib and so on) are industrial and
     investment land, not Expo, so they are shown in the lighter tint (display tier p) although the distance rule made them adjacent.
     The distance tier is kept beside it (t0) so nothing is hidden.
  3. A community between two centres belongs to the nearer one; the second-nearest centre and its distance travel with it (c2, d2).
  4. Dubai Land Residence Complex is NOT one of the five (it sits in Wadi Al Safa 5, adjacent to centre 5); its caption says so.
  5. Per-centre stock = Land Department project-register homes (units_register) of the solid communities (headline) and with the lighter ones (all).
"""
import argparse, csv, json, os, re, sys
from collections import defaultdict
from pyproj import Transformer
from shapely.geometry import shape, mapping
from shapely.ops import unary_union, transform
from shapely import make_valid

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DOCS = r"C:\Dev\naj-market-pulse\docs"
BOARD = r"C:\Dev\naj-market-pulse\data\board\district_polygons.geojson"

SOURCE = "Dubai 2040 Urban Master Plan, UAE Government, 13 Mar 2021"
GROUPING = "Our grouping of districts; the plan names the centres, not their boundaries"

CENTRES = {
    1: dict(name="Deira and Bur Dubai", status="Existing", role="Historic: tradition and heritage, museums and traditional markets", colour="#c98500"),
    2: dict(name="Downtown and Business Bay", status="Existing", role="The business and financial heart", colour="#c5a56a"),
    3: dict(name="Dubai Marina and JBR", status="Existing", role="Hospitality and leisure hub for international tourism", colour="#2f8a7f"),
    4: dict(name="Expo 2020 Centre", status="New", role="Economic growth zone: affordable housing, exhibitions, tourism and logistics", colour="#3987e5"),
    5: dict(name="Dubai Silicon Oasis Centre", status="New", role="Technology and innovation hub", colour="#b48bd8"),
}
# captions travel with the one community they describe (Dubai Municipality community number)
CAPTIONS = {
    521: "One Dubai Municipality area that holds Expo City, Dubai South and the airport district. Expo City itself is about 3.5 square km of it, so the whole area is not Expo.",
    626: "One Dubai Municipality area that holds Dubai Silicon Oasis and Academic City.",
    648: "Dubai Land Residence Complex stands here. It is not one of the five centres; it lies next to the Silicon Oasis centre in our grouping.",
    415: "Dubai Creek Harbour. The plan does not name it; we group it by distance.",
}
CENTRE4_DEMOTE_TIER = "ADJACENT"   # rule 2


def fold(s):
    return re.sub(r"[^a-z0-9]+", "", str(s or "").lower())


def nice(s):
    s = re.sub(r"\s+", " ", str(s or "").strip())
    s = s.title()
    s = s.replace("Int'L", "International").replace("Dubai Int'l", "Dubai International")
    s = re.sub(r"\bInd\.\s*", "Industrial ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s.replace("Downtown", "Downtown").replace("Downtown Dubai", "Downtown Dubai")


TIER = {"CORE": "c", "ADJACENT": "a", "PERIPHERAL": "p", "OUTSIDE": "o", "OFFSHORE": "x"}
EVID = {"OFFICIAL_NAMED": "N", "DERIVED_NEAREST": "D", "UNASSIGNED": "U"}
# spelling differences between the Dubai Municipality community names and the Land Department area names (used as area keys by the page)
VARIANTS = [("yalayis", "yelayiss"), ("kheeran", "khairan"), ("sheikhmohammedbinrashid", "shmohammedbinrashid")]


def slug_variants(f):
    out = {f}
    for a, b in VARIANTS:
        if a in f:
            out.add(f.replace(a, b))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tol-m", type=float, default=15.0, help="Douglas-Peucker tolerance in metres (default 15)")
    ap.add_argument("--docs", default=DOCS)
    ap.add_argument("--board", default=BOARD)
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "centres2040", "centres2040.json"))
    ap.add_argument("--audit", default=os.path.join(ROOT, "data", "centres2040", "centres2040_audit.csv"))
    a = ap.parse_args()
    tol = a.tol_m

    gj = json.load(open(os.path.join(a.docs, "DUBAI_2040_CENTRES_PROPOSED.geojson"), encoding="utf8"))
    rows = list(csv.DictReader(open(os.path.join(a.docs, "DUBAI_2040_CENTRES_MAPPING.csv"), encoding="utf-8-sig")))
    board = json.load(open(a.board, encoding="utf8"))
    to_m = Transformer.from_crs(4326, 32640, always_xy=True).transform
    to_ll = Transformer.from_crs(32640, 4326, always_xy=True).transform

    geoms = {}
    for f in gj["features"]:
        p = f["properties"]
        if p.get("kind") == "dm_community":
            g = make_valid(shape(f["geometry"]))
            geoms[int(p["comm_num"])] = transform(to_m, g)

    dm = [r for r in rows if r["level"].startswith("DM community")]
    master = [r for r in rows if r["level"].startswith("master community")]
    total_units = sum(float(r["units_register"] or 0) for r in dm)
    master_by = defaultdict(list)
    for r in master:
        u = float(r["units_register"] or 0)
        if u > 0:
            master_by[int(r["dm_comm_num"])].append((u, nice(r["name"]).replace("Downtown Dubai", "Downtown Dubai")))
    for k in master_by:
        master_by[k].sort(reverse=True)

    comms, idx_by_num = [], {}
    audit = []
    for r in sorted(dm, key=lambda x: int(x["dm_comm_num"])):
        num = int(r["dm_comm_num"])
        t0 = TIER[r["tier"]]
        c = int(r["centre_id"]) if r["centre_id"] else 0
        t = t0
        note = r["reason"]
        if c == 4 and r["tier"] == CENTRE4_DEMOTE_TIER:
            t = "p"
            note = "distance rule says adjacent; shown as peripheral because it is industrial and investment land beside the Expo and Dubai South polygon, not Expo (rule 2)"
        units = int(float(r["units_register"] or 0))
        rec = dict(n=nice(r["dm_community"]), f=fold(r["dm_community"]), cn=num, c=c, t=t, t0=t0,
                   e=EVID[r["evidence"]], u=units, pr=int(float(r["projects_register"] or 0)))
        if r["coast_sea_rec_500m"]:
            rec["sea"] = 1
        if r["waterfront_inland_rec_250m"]:
            rec["wf"] = 1
        if "between two centres" in r["uncertain_flags"] and r["second_centre_id"]:
            rec["c2"] = int(r["second_centre_id"])
            rec["d2"] = round(int(float(r["second_distance_m"] or 0)) / 1000.0, 1)
        if r["distance_to_centre_core_m"] and c:
            rec["d"] = round(float(r["distance_to_centre_core_m"]) / 1000.0, 1)
        m = [x[1] for x in master_by.get(num, [])[:3]]
        if m:
            rec["m"] = m
        if num in CAPTIONS:
            rec["cap"] = CAPTIONS[num]
        idx_by_num[num] = len(comms)
        comms.append(rec)
        audit.append(dict(comm_num=num, name=rec["n"], centre=c or "", centre_name=CENTRES[c]["name"] if c else "", display_tier=t, distance_tier=t0,
                          evidence=r["evidence"], registered_homes=units, sea_coast_500m="Y" if rec.get("sea") else "", waterfront_250m="Y" if rec.get("wf") else "",
                          second_centre=rec.get("c2", ""), second_km=rec.get("d2", ""), note=note, drawn="", in_data="Y"))

    # slug -> community index (app districts by the number they stand on, then every community by its folded name and spelling variants)
    sl = {}
    for f in board["features"]:
        p = f["properties"]
        nums = p.get("comm_nums") or []
        if nums and int(nums[0]) in idx_by_num:
            sl[p["slug"]] = idx_by_num[int(nums[0])]
    for num, i in idx_by_num.items():
        for v in slug_variants(comms[i]["f"]):
            sl.setdefault(v, i)

    # geometry: drawn when the community belongs to a centre (c,a,p) or touches the sea within 500 m (the coastal layer); outside and offshore are not drawn
    feats, drawn_idx = [], []
    for num, i in idx_by_num.items():
        rec = comms[i]
        grouped = rec["c"] and rec["t"] in ("c", "a", "p")
        if not (grouped or rec.get("sea")):
            continue
        g = geoms.get(num)
        if g is None or g.is_empty:
            continue
        gs = g.simplify(tol, preserve_topology=True)
        if gs.is_empty:
            gs = g
        ll = transform(to_ll, gs)
        gm = mapping(ll)
        def rnd(co):
            return [round(x, 5) if isinstance(x, float) else rnd(x) for x in co] if isinstance(co, (list, tuple)) else co
        gm = {"type": gm["type"], "coordinates": rnd(json.loads(json.dumps(gm["coordinates"])))}
        feats.append({"type": "Feature", "properties": {"i": i}, "geometry": gm})
        drawn_idx.append(i)
    for row in audit:
        row["drawn"] = "Y" if idx_by_num[row["comm_num"]] in drawn_idx else ""

    # per-centre figures, outline of the solid area and a label point
    centres, outl = [], []
    for cid in range(1, 6):
        mem = [(i, comms[i]) for i in range(len(comms)) if comms[i]["c"] == cid]
        solid = [x for x in mem if x[1]["t"] in ("c", "a")]
        per = [x for x in mem if x[1]["t"] == "p"]
        core = [x for x in mem if x[1]["t"] == "c"]
        su = sum(x[1]["u"] for x in solid)
        au = su + sum(x[1]["u"] for x in per)
        sp = sum(x[1]["pr"] for x in solid)
        ap_ = sp + sum(x[1]["pr"] for x in per)
        allg = unary_union([geoms[x[1]["cn"]] for x in mem if x[1]["cn"] in geoms])
        solidg = unary_union([geoms[x[1]["cn"]] for x in solid if x[1]["cn"] in geoms])
        cg = unary_union([geoms[x[1]["cn"]] for x in core if x[1]["cn"] in geoms])
        lp = cg.centroid
        if not cg.buffer(0).contains(lp):
            lp = cg.representative_point()
        lpll = transform(to_ll, lp)
        b = transform(to_ll, allg).bounds
        ol = solidg.buffer(40).buffer(-40).simplify(tol * 1.5, preserve_topology=True)
        om = mapping(transform(to_ll, ol))
        def rnd2(co):
            return [round(x, 5) if isinstance(x, float) else rnd2(x) for x in co] if isinstance(co, (list, tuple)) else co
        outl.append({"type": "Feature", "properties": {"o": cid}, "geometry": {"type": om["type"], "coordinates": rnd2(json.loads(json.dumps(om["coordinates"])))}})
        top = sorted(solid, key=lambda x: -x[1]["u"])[:3]
        centres.append(dict(id=cid, name=CENTRES[cid]["name"], status=CENTRES[cid]["status"], role=CENTRES[cid]["role"], colour=CENTRES[cid]["colour"],
                            units=su, share=round(100.0 * su / total_units, 1), units_all=au, share_all=round(100.0 * au / total_units, 1),
                            projects=sp, projects_all=ap_, ncomm=len(solid), nper=len(per),
                            core=[x[1]["n"] for x in core], lab=[round(lpll.x, 4), round(lpll.y, 4)],
                            bbox=[round(b[0], 4), round(b[1], 4), round(b[2], 4), round(b[3], 4)],
                            top=[[x[1]["n"] + (" (" + x[1]["m"][0] + ")" if x[1].get("m") else ""), x[1]["u"]] for x in top if x[1]["u"] > 0]))
    cov_u = sum(c["units_all"] for c in centres)
    out = dict(v=1, generated=__import__("datetime").datetime.now().strftime("%Y-%m-%d"), source=SOURCE, grouping=GROUPING, tol_m=tol,
               basis="Land Department project register, registered homes (units_register), all Dubai " + format(int(total_units), ","),
               total_units=int(total_units), outside_units=int(total_units - cov_u),
               centres=centres, comms=comms, sl=sl,
               geo={"type": "FeatureCollection", "features": feats}, ol={"type": "FeatureCollection", "features": outl})
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    txt = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    open(a.out, "w", encoding="utf8", newline="\n").write(txt)
    with open(a.audit, "w", encoding="utf8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(audit[0].keys()))
        w.writeheader()
        w.writerows(audit)
    print("wrote %s (%d bytes, polygons %d, simplification %.0f m, 5-decimal coordinates)" % (a.out, len(txt.encode("utf8")), len(feats), tol))
    print("wrote %s (%d rows)" % (a.audit, len(audit)))
    for c in centres:
        print("  centre %d %-28s solid %6d homes (%.1f%%)  with outskirts %6d (%.1f%%)  communities %d + %d peripheral" % (c["id"], c["name"], c["units"], c["share"], c["units_all"], c["share_all"], c["ncomm"], c["nper"]))
    print("  outside / not grouped: %d homes" % out["outside_units"])
    sea = sum(1 for c in comms if c.get("sea")); wf = sum(1 for c in comms if c.get("wf"))
    print("  sea coast communities %d, waterfront %d, slug keys %d" % (sea, wf, len(sl)))
    if len(txt.encode("utf8")) > 600 * 1024:
        print("WARNING: over 600 KB", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
