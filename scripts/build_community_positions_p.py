"""v397c - COMMUNITY-CENTRE RUNG FOR EVERY REGISTERED PROJECT (not only the cards of the developer index).
OFFLINE, deterministic, re-runnable. Read-only on the completeness universe, the audit's entity table, the sales and lands registers, the Dubai Municipality community polygons.
Writes (by default) only, in this repo:
  data/community_positions/community_positions_projects.json   the compact file the page reads (what=commposp; KV img_community_positions_p via scripts/publish_community_positions_p.py)
  data/community_positions/community_positions_projects_audit.csv   one row per project of the universe: its rung before, what it got and why
and, with --report-dir, the reports (counts by rung before and after, by district, outside the 42 districts, the projects still without a position and why).

THE LADDER (unchanged): 1 building outline > 2 plot centre > 3 community centre > none.
v387 filled rung 3 for the cards of the developer index (keys district|pkey(name), scripts/build_community_positions.py, those keys are NOT touched here). This file fills rung 3 for
EVERY project of the 3,915-project completeness universe that has no building outline and no plot centre, keyed by REGISTER PROJECT NUMBER: "p:<number>". The page reads it only for a
project that has no card of its own (no-sales group, facts, search results) or whose card has no community entry. Additive: absent file = v395.

THE COMMUNITY OF A PROJECT (first that names exactly ONE of the 223 Dubai Municipality community polygons; two polygons = ambiguous = next candidate):
  1 the project's sales area (AREA_EN of its settled sales, the modal one, used only when the project name is unique in the universe)
  2 the register's master community
  3 the register's own area (the Land Department area, which IS the Dubai Municipality community name)
  4 the project's own land records (PROJECT_NUMBER on the lands register carries DM_ZIP_CODE = the community number), only when ALL its land rows name one polygon
  Each label is matched by name to the register master communities, our app districts and the Dubai Municipality names (scripts/build_community_positions.py resolve()), then ALIASES_P.
The point is the polygon's REPRESENTATIVE POINT (inside the polygon, in its largest part; never the centroid): the middle of the community, NOT of the project and NOT the building. Evidence DERIVED.
Label: 'Community centre: <community>. The exact plot is not in our data yet.'
No polygon, an ambiguous name, or no register project number to key by = NO entry, listed with the reason. Nothing is guessed.

ALIASES_P: spelling variants and register abbreviations of a label with no table entry. THE EVIDENCE RULE: at least two independent pieces of evidence, both re-checked on every run (verify_aliases):
  (a) the spelling / abbreviation is the same name as the polygon's (difflib ratio of the folded names >= 0.80) and
  (b) the Land Department lands register (data/lands-2026-08-25.csv) ties ALL (>= 98%, at least 20) parcels whose AREA_EN is that label to that one Dubai Municipality community number (DM_ZIP_CODE).
A label whose land register code has no polygon in our file (Nad Al Shiba, Jabal Ali, Al Ruwayyah) gets no alias: listed as 'no polygon'.

Run:  python scripts/build_community_positions_p.py [--propose-aliases] [--report-dir D] [--out F] [--audit F]
"""
import argparse, collections, csv, difflib, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _cardlib as L
import build_community_positions as B

NMP = L.NMP
UNIVERSE = r"C:\Dev\_complete393\scripts\completeness_universe.csv"
ENTITIES = os.path.join(NMP, "docs", "COMPLETENESS_AUDIT_07OCT2026", "ENTITIES_projects.csv")
SALES = os.path.join(L.DATA, "transactions-ytd-2026-09-01.csv")
LANDS = os.path.join(L.DATA, "lands-2026-08-25.csv")
OUT = os.path.join(L.REPO, "data", "community_positions", "community_positions_projects.json")
AUDIT_CSV = os.path.join(L.REPO, "data", "community_positions", "community_positions_projects_audit.csv")
LABEL = B.LABEL
PKEY = "p:"

# (None, fold(label)) -> (table label it stands for, evidence). Every entry is re-verified by verify_aliases() against the lands register.
ALIASES_P = {}


def A(label, table_label, why):
    ALIASES_P[(None, L.fold(label))] = (table_label, why)


A("Um Suqaim Third", "UMM SUQEIM THIRD", "'Um Suqaim' is the register's spelling of 'Umm Suqeim'; the lands register ties its parcels labelled 'Um Suqaim Third' to community 366")
A("Um Suqaim Second", "UMM SUQEIM SECOND", "'Um Suqaim' is the register's spelling of 'Umm Suqeim'; the lands register ties its parcels labelled 'Um Suqaim Second' to community 362")
A("Nad Al Shiba First", "NADD AL SHIBA FIRST", "'Nad' is the register's spelling of 'Nadd'; the lands register ties its parcels labelled 'Nad Al Shiba First' to community 618")
A("Jumeirah Second", "JUMEIRA SECOND", "'Jumeirah' is the register's spelling of 'Jumeira'; the lands register ties its parcels labelled 'Jumeirah Second' to community 342")
A("Al Yelayiss 5", "AL YALAYIS 5", "'Yelayiss' is the register's spelling of 'Yalayis'; the lands register ties its parcels labelled 'Al Yelayiss 5' to community 925")
A("Al Yelayiss 4", "AL YALAYIS 4", "'Yelayiss' is the register's spelling of 'Yalayis'; the lands register ties its parcels labelled 'Al Yelayiss 4' to community 924")
A("Al Yelayiss 2", "AL YALAYIS 2", "'Yelayiss' is the register's spelling of 'Yalayis'; the lands register ties its parcels labelled 'Al Yelayiss 2' to community 922")
A("Ras Al Khor Industrial First", "RAS AL KHOR IND. FIRST", "'Industrial' is the register's spelling of the Municipality's 'IND.'; the lands register ties its parcels labelled 'Ras Al Khor Industrial First' to community 612")
A("Al Qusais Industrial Fourth", "AL QUSAIS IND. FOURTH", "'Industrial' is the register's spelling of the Municipality's 'IND.'; the lands register ties its parcels labelled 'Al Qusais Industrial Fourth' to community 247")
A("Nad Al Hamar", "NADD AL HAMAR", "'Nad' is the register's spelling of 'Nadd'; the lands register ties its parcels labelled 'Nad Al Hamar' to community 416")
A("Al Goze Fourth", "AL QOUZ FOURTH", "'Goze' is the register's spelling of 'Qouz'; the lands register ties its parcels labelled 'Al Goze Fourth' to community 359")
A("Al Thanayah Fourth", "AL THANYAH  FOURTH", "'Thanayah' is the register's spelling of 'Thanyah'; the lands register ties its parcels labelled 'Al Thanayah Fourth' to community 394")
A("Al Barshaa South Third", "AL BARSHA SOUTH THIRD", "'Barshaa' is a doubled-letter spelling of 'Barsha'; the lands register ties its parcels labelled 'Al Barshaa South Third' to community 673")
A("Al Warsan First", "WARSAN FIRST", "the register writes 'Al Warsan First' for the Municipality's 'Warsan First'; the lands register ties its parcels labelled 'Al Warsan First' to community 621")
A("Al Khairan First", "AL KHEERAN FIRST", "'Khairan' is the register's spelling of 'Kheeran'; the lands register ties its parcels labelled 'Al Khairan First' to community 415")
A("Jumeirah First", "JUMEIRA FIRST", "'Jumeirah' is the register's spelling of 'Jumeira'; the lands register ties its parcels labelled 'Jumeirah First' to community 332")
A("Um Hurair Second", "UMM HURAIR SECOND", "'Um' is the register's spelling of 'Umm'; the lands register ties its parcels labelled 'Um Hurair Second' to community 315")


def title(s):
    return B.title(s)


def read_csv(path):
    return list(csv.DictReader(open(path, encoding="utf-8-sig", errors="replace")))


def lands_tables(path=LANDS):
    """label (AREA_EN) -> Counter of DM_ZIP_CODE; project number -> Counter of DM_ZIP_CODE"""
    by_label, by_pn = collections.defaultdict(collections.Counter), collections.defaultdict(collections.Counter)
    if not path or not os.path.exists(path):
        return by_label, by_pn
    for r in csv.DictReader(open(path, encoding="utf-8-sig", errors="replace")):
        z = (r.get("DM_ZIP_CODE") or "").strip()
        by_label[(r.get("AREA_EN") or "").strip()][z] += 1
        pn = (r.get("PROJECT_NUMBER") or "").strip()
        if pn:
            by_pn[pn][z] += 1
    return by_label, by_pn


def sales_areas(names, path=SALES):
    """pkey(project name) -> Counter of AREA_EN, for the project names asked for"""
    out = collections.defaultdict(collections.Counter)
    if not path or not os.path.exists(path):
        return out
    for r in csv.DictReader(open(path, encoding="utf-8-sig", errors="replace")):
        k = L.pkey(r.get("PROJECT_EN"))
        if k in names and r.get("AREA_EN"):
            out[k][r["AREA_EN"].strip()] += 1
    return out


def spelling(a, b):
    return difflib.SequenceMatcher(None, L.fold(a), L.fold(b)).ratio()


def label_evidence(label, polys, by_label):
    """(zip, rows, total, purity, polygon name) of the lands register for a label, or None"""
    c = by_label.get(label) or by_label.get(re.sub(r"\s+", " ", label))
    if not c:
        return None
    z, n = c.most_common(1)[0]
    tot = sum(c.values())
    return z, n, tot, n / tot, (polys[z]["name"] if z in polys else None)


def verify_aliases(polys, by_label, aliases=None):
    """every alias must keep both pieces of evidence; returns a list of failures (empty = all verified)"""
    bad = []
    names = {L.fold(p["name"]): cn for cn, p in polys.items()}
    for (slug, f), (tl, why) in sorted((aliases or ALIASES_P).items()):
        cn = names.get(L.fold(tl))
        label = None
        for lab in by_label:
            if L.fold(lab) == f:
                label = lab
                break
        if cn is None:
            bad.append((f, "the table label '%s' is not a Dubai Municipality community" % tl))
            continue
        if spelling(f, tl) < 0.80:
            bad.append((f, "spelling ratio %.2f is under 0.80" % spelling(f, tl)))
        if not by_label:
            continue
        ev = label_evidence(label, polys, by_label) if label else None
        if not ev or ev[0] != cn or ev[3] < 0.98 or ev[2] < 20:
            bad.append((f, "the lands register does not tie '%s' to community %s (%s)" % (label, cn, ev)))
    return bad


def propose(labels, polys, by_label):
    out = []
    for lab in sorted(labels):
        ev = label_evidence(lab, polys, by_label)
        if not ev:
            out.append((lab, "no land rows with this label"))
            continue
        z, n, tot, pur, pn = ev
        if pn is None:
            out.append((lab, "the lands register code %s (%d of %d rows) has no polygon in our 223 communities" % (z, n, tot)))
        else:
            out.append((lab, "-> %s (%s) lands %d of %d rows, purity %.2f, spelling %.2f" % (pn, z, n, tot, pur, spelling(lab, pn))))
    return out


def district_of(cn, dist):
    """app district slugs whose polygon list holds this community"""
    return sorted(s for s, cns in dist.items() if cn in cns)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--universe", default=UNIVERSE)
    ap.add_argument("--entities", default=ENTITIES)
    ap.add_argument("--sales", default=SALES)
    ap.add_argument("--lands", default=LANDS)
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--audit", default=AUDIT_CSV)
    ap.add_argument("--report-dir", default=None)
    ap.add_argument("--aliases-json", default=None, help="TEST ONLY: a json list of [label, table label, why] that replaces the built-in ALIASES_P (verified the same way)")
    ap.add_argument("--geo", default=B.GEO)
    ap.add_argument("--mapping", default=B.MAP)
    ap.add_argument("--dpoly", default=B.DPOLY)
    a = ap.parse_args()

    polys = B.load_polygons(a.geo)
    tables = B.load_tables(polys, a.mapping, a.dpoly)
    dist = tables[3]
    km2 = B.area_km2(a.geo)
    by_label, by_pn = lands_tables(a.lands)
    if a.aliases_json:
        ALIASES_P.clear()
        for lab, tl, why in json.load(open(a.aliases_json, encoding="utf8")):
            A(lab, tl, why)
    bad = verify_aliases(polys, by_label)
    if bad:
        for f, why in bad:
            print("ALIAS FAILS ITS EVIDENCE: %s: %s" % (f, why))
        sys.exit("an alias lost its evidence: nothing written")
    B.ALIASES.update(ALIASES_P)                      # the card builder's own ALIASES stay as they are; these only apply here

    uni = {r["key"]: r for r in read_csv(a.universe)}
    ent = {r["key"]: r for r in read_csv(a.entities)}
    names = collections.Counter(L.pkey(r["name"]) for r in uni.values())
    sa = sales_areas(set(k for k, v in names.items() if v == 1 and k), a.sales)

    rows, P, C = [], {}, {}
    cnt = collections.Counter()
    unmatched = collections.Counter()
    for key in sorted(uni):
        r = uni[key]
        en = ent.get(key, {})
        before = en.get("position_level") or "none"
        pn = (r.get("project_number") or "").strip()
        nk = L.pkey(r["name"])
        sales_area = ""
        if names[nk] == 1 and sa.get(nk):
            sales_area = sa[nk].most_common(1)[0][0]
        lz = by_pn.get(pn) if pn else None
        lz_cn = None
        if lz and len(lz) == 1 and next(iter(lz)) in polys:
            lz_cn = next(iter(lz))
        row = {"key": key, "project_number": pn, "project": r["name"], "source": r["source"], "register_area": r.get("area", ""), "master": r.get("master", ""), "sales_area": sales_area,
               "before": before, "after": before, "dm_community_no": "", "community": "", "matched_via": "", "app_district": "", "why": ""}
        # which community (for the by-district report, for every project; the entry itself only for those with nothing better)
        cn, via, mtext, src = None, "", "", ""
        reasons = []
        for lab, lsrc in ((sales_area, "sales area"), (r.get("master", ""), "register master community"), (r.get("area", ""), "register area")):
            if not lab:
                continue
            c1, v1, t1 = B.resolve(lab, tables)
            if c1:
                cn, via, mtext, src = c1, v1, t1, lsrc
                break
            reasons.append("%s '%s': %s" % (lsrc, lab, v1))
            unmatched[(lsrc, lab)] += 1
        if cn is None and lz_cn:
            cn, via, mtext, src = lz_cn, "the register's land records of this project (DM_ZIP_CODE %s)" % lz_cn, polys[lz_cn]["name"], "land register"
        if cn and lz_cn and lz_cn != cn:
            # the project's own land records (every parcel of it, one polygon) outrank a label: a master community or an island name can span or straddle communities
            row["why"] = "land records say community %s, not the %s that the %s '%s' gives: land records win" % (lz_cn, cn, src, mtext)
            cnt["lands_override"] += 1
            cn, via, mtext, src = lz_cn, "the register's land records of this project (DM_ZIP_CODE %s)" % lz_cn, polys[lz_cn]["name"], "land register"
        if cn:
            row["app_district"] = ",".join(district_of(cn, dist)) or "(outside the 42 districts)"
            row["dm_community_no"] = cn
            if lz_cn:
                cnt["lands_agree"] += 1
            else:
                cnt["lands_none"] += 1
        if before in ("building", "plot centre"):
            cnt["before_" + before] += 1
            row["why"] = "already has a %s: nothing to add" % before
            rows.append(row)
            continue
        if not pn:
            row["after"] = "none"
            row["why"] = "no register project number (%s): a project-number key cannot be made" % r["source"]
            cnt["none_no_project_number"] += 1
            rows.append(row)
            continue
        if cn is None:
            row["after"] = "none"
            row["why"] = "; ".join(reasons) or "no area on record"
            cnt["none_no_polygon"] += 1
            rows.append(row)
            continue
        pol = polys[cn]
        if cn not in C:
            C[cn] = {"n": title(pol["name"]), "lon": pol["lon"], "lat": pol["lat"], "bb": pol["bbox"], "area_km2": km2.get(cn), "evidence": "DERIVED", "basis": B.BASIS}
        P[PKEY + pn] = {"c": cn, "l": LABEL % B.display(mtext, pol["name"]), "m": via, "a": {"sales area": sales_area, "register master community": r.get("master", ""), "register area": r.get("area", "")}.get(src, "") or r.get("area", "")}
        row["after"] = "community centre"
        row["community"] = title(pol["name"])
        row["matched_via"] = src + ": " + via
        if before == "community centre":
            row["why"] = "already a community centre on the card (district|name key); the project-number entry lets pages without a card use it too"
            cnt["before_community centre"] += 1
        else:
            cnt["added_new"] += 1
            row["why"] = row["why"] or "the middle of the project's own community; the exact plot is not in our data yet"
        cnt["via " + src] += 1
        rows.append(row)

    used = sorted(set(e["c"] for e in P.values()))
    C = {k: C[k] for k in used}
    before_c, after_c = collections.Counter(r["before"] for r in rows), collections.Counter(r["after"] for r in rows)
    outside = sum(1 for r in rows if r["after"] == "community centre" and r["before"] != "community centre" and r["app_district"] == "(outside the 42 districts)")
    meta = {"as_of": "2026-10-07", "universe": len(uni), "projects": len(P), "communities": len(C), "counts": dict(sorted(cnt.items())), "before": dict(before_c), "after": dict(after_c),
            "outside_42_new": outside, "keys": "p:<register project number>", "ladder": "building outline > plot centre > community centre",
            "basis": "Dubai Municipality community outline (docs/DUBAI_2040_CENTRES_PROPOSED.geojson); the point is the representative point of the community polygon, computed by us: DERIVED. "
                     "It is the middle of the community, not of the project and not the building.",
            "rule": "An entry exists only for a project with no building outline and no plot centre whose own area matches exactly one Dubai Municipality community polygon, and that has a register project number. No match, no entry."}
    d = {"meta": meta, "c": C, "p": P}
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(d, f, separators=(",", ":"), sort_keys=True, ensure_ascii=False)
    os.makedirs(os.path.dirname(a.audit), exist_ok=True)
    with open(a.audit, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(sorted(rows, key=lambda r: (r["after"], r["project_number"].zfill(8), r["project"])))
    print("universe", len(uni), "before", dict(before_c), "after", dict(after_c))
    print("entries", len(P), "communities", len(C), "bytes", os.path.getsize(a.out), "counts", dict(cnt), "new outside the 42:", outside)
    if True:
        lab = sorted(set(l for (s, l) in unmatched))
        print("labels that matched no polygon (%d):" % len(lab))
        for l, w in propose(lab, polys, by_label):
            print("  %-34s %s" % (l, w))
    if a.report_dir:
        report(a.report_dir, rows, d, dist, polys)


def report(rd, rows, d, dist, polys):
    os.makedirs(rd, exist_ok=True)

    def w(name, header, data):
        with open(os.path.join(rd, name), "w", newline="", encoding="utf-8-sig") as fh:
            cw = csv.writer(fh)
            cw.writerow(header)
            cw.writerows(data)
    n = len(rows)
    lv = ["building", "plot centre", "community centre", "none"]
    bc, ac = collections.Counter(r["before"] for r in rows), collections.Counter(r["after"] for r in rows)
    w("RUNG_COUNTS.csv", ["rung", "projects_before", "share_before_pct", "projects_after", "share_after_pct"],
      [[x, bc[x], round(100.0 * bc[x] / n, 1), ac[x], round(100.0 * ac[x] / n, 1)] for x in lv] + [["any position", n - bc["none"], round(100.0 * (n - bc["none"]) / n, 1), n - ac["none"], round(100.0 * (n - ac["none"]) / n, 1)]])
    byd = collections.defaultdict(lambda: [collections.Counter(), collections.Counter()])
    for r in rows:
        dd = r["app_district"] or "(community not matched)"
        byd[dd][0][r["before"]] += 1
        byd[dd][1][r["after"]] += 1
    w("RUNG_BY_DISTRICT.csv", ["app_district_of_the_community", "projects"] + ["before_" + x for x in lv] + ["after_" + x for x in lv],
      [[k, sum(v[0].values())] + [v[0][x] for x in lv] + [v[1][x] for x in lv] for k, v in sorted(byd.items(), key=lambda kv: -sum(kv[1][0].values()))])
    newr = [r for r in rows if r["after"] == "community centre" and r["before"] != "community centre"]
    out42 = [r for r in rows if r["app_district"] == "(outside the 42 districts)"]
    w("OUTSIDE_42_DISTRICTS.csv", ["project_number", "project", "before", "after", "dm_community_no", "community", "register_area"],
      [[r["project_number"], r["project"], r["before"], r["after"], r["dm_community_no"], r["community"], r["register_area"]] for r in sorted(out42, key=lambda r: (r["community"], r["project"]))])
    none = [r for r in rows if r["after"] == "none"]
    w("STILL_WITHOUT_POSITION.csv", ["key", "project_number", "project", "source", "register_area", "master", "sales_area", "why"],
      [[r["key"], r["project_number"], r["project"], r["source"], r["register_area"], r["master"], r["sales_area"], r["why"]] for r in sorted(none, key=lambda r: (r["why"], r["project"]))])
    why = collections.Counter(re.sub(r"'[^']*'", "'..'", r["why"])[:110] for r in none)
    with open(os.path.join(rd, "SUMMARY.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write("v397c community-centre rung for every register project, 7 Oct 2026\n")
        f.write("universe %d projects\n" % n)
        for x in lv:
            f.write("  %-17s before %5d (%4.1f%%)  after %5d (%4.1f%%)\n" % (x, bc[x], 100.0 * bc[x] / n, ac[x], 100.0 * ac[x] / n))
        f.write("coverage of the universe: before %.1f%%, after %.1f%%\n" % (100.0 * (n - bc["none"]) / n, 100.0 * (n - ac["none"]) / n))
        f.write("new project-number community entries %d (of which outside the 42 app districts: %d); entries in file %d\n" % (len(newr), sum(1 for r in newr if r["app_district"] == "(outside the 42 districts)"), len(d["p"])))
        f.write("still without a position: %d\n" % len(none))
        for k, v in why.most_common():
            f.write("  %4d  %s\n" % (v, k))


if __name__ == "__main__":
    main()
