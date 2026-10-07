"""v387 - COMMUNITY-CENTRE FALLBACK: a map position for every project card that has neither a building outline nor a plot centre.
OFFLINE, deterministic, re-runnable. Read-only on the index, the blocks files, the plot positions and the shared market-pulse repo. Writes (by default) only:
  data/community_positions/community_positions.json    the compact file the page reads (what=commpos; KV img_community_positions via scripts/publish_community_positions.py)
  data/community_positions/community_positions_audit.csv   one row per card the build looked at: what it got and why

THE LADDER (the page applies it at run time, this file only fills the lowest rung):
  1 building outline (the page's own name match)  >  2 plot centre (data/plot_positions, by register project number)  >  3 community centre (this file)  >  none.
  A card gets an entry here only when it has NEITHER of the first two today. When an outline or a plot centre arrives later, re-run this and the card drops out of the file; the page also
  lets the better rung win without waiting for this file.

WHAT A COMMUNITY CENTRE IS (and is not)
  The card's own area label is the community its project record carries (index field bx.a: the Land Department register's master community or sales area; a card with no such record
  uses its district). That label is matched, by name, to a Dubai Municipality community polygon (docs/DUBAI_2040_CENTRES_PROPOSED.geojson, 223 communities), through the register's
  master-community table and our app-district table (docs/DUBAI_2040_CENTRES_MAPPING.csv) and the district polygons (data/board/district_polygons.geojson).
  The point is that polygon's REPRESENTATIVE POINT (a point guaranteed inside the polygon, taken in its largest part; never the centroid, which can fall in the sea or outside a crescent).
  It is the middle of the community, NOT of the project and NOT the building: evidence DERIVED, basis community_polygon, and the label says so.
  A label that matches no polygon, or matches two different ones, gets NO position (listed in the audit CSV with the reason). Nothing is guessed.

Keyed by card key = district|pkey(name) (96 cards have no register project number), plus the project number (pn) when there is one.
File: {"meta":{...}, "c":{"<DM community no>":{n,lon,lat,bb,area_km2,evidence,basis}}, "p":{"<district>|<pkey>":{"c":"<DM community no>","l":label,"m":via,"pn":"<project no>"?,"a":"<own area label>"}}}
Run:  python scripts/build_community_positions.py [--index F] [--blocks-dir D] [--plots F] [--live] [--out F] [--audit F]
"""
import argparse, collections, csv, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _cardlib as L

try:
    from shapely.geometry import shape
    from shapely.geometry import Point
except ImportError:
    sys.exit("shapely is needed (pip install shapely)")

DOCS = os.path.join(L.NMP, "docs")
GEO = os.path.join(DOCS, "DUBAI_2040_CENTRES_PROPOSED.geojson")
MAP = os.path.join(DOCS, "DUBAI_2040_CENTRES_MAPPING.csv")
DPOLY = os.path.join(L.DATA, "board", "district_polygons.geojson")
OUT = os.path.join(L.REPO, "data", "community_positions", "community_positions.json")
AUDIT_CSV = os.path.join(L.REPO, "data", "community_positions", "community_positions_audit.csv")
PLOTS = os.path.join(L.REPO, "data", "plot_positions", "plot_positions.json")
BASIS = "community_polygon"
LABEL = "Community centre: %s. The exact plot is not in our data yet."


def title(s):
    return " ".join(w.capitalize() if not re.match(r"^\d", w) else w for w in str(s).lower().split())


def load_polygons(geo=GEO):
    """DM community number -> {name, geom (largest part), bbox, point, area_km2}"""
    g = L.J(geo)
    if not g:
        sys.exit("cannot read " + geo)
    out = {}
    for f in g["features"]:
        q = f["properties"]
        if q.get("kind") != "dm_community" or not f.get("geometry"):
            continue
        geom = shape(f["geometry"])
        if not geom.is_valid:
            geom = geom.buffer(0)
        parts = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]
        big = max(parts, key=lambda p: p.area)
        pt = big.representative_point()                   # a point ON the surface, in the largest part
        assert big.covers(pt)
        b = geom.bounds
        out[str(q["comm_num"])] = {"name": q["name"], "bbox": [round(b[0], 5), round(b[1], 5), round(b[2], 5), round(b[3], 5)], "lon": round(pt.x, 5), "lat": round(pt.y, 5)}
    return out


def area_km2(geom_json_path=GEO):
    """planar area per community in km2 (local metres frame at its own latitude)"""
    import math
    g = L.J(geom_json_path)
    r = {}
    for f in g["features"]:
        q = f["properties"]
        if q.get("kind") != "dm_community" or not f.get("geometry"):
            continue
        geom = shape(f["geometry"])
        lat = geom.centroid.y
        r[str(q["comm_num"])] = round(geom.area * (111320.0 * math.cos(math.radians(lat))) * 110574.0 / 1e6, 2)
    return r


def load_tables(polys, mapping=MAP, dpoly=DPOLY):
    """fold(name) -> set of DM community numbers, for three kinds of name. A name that points at two communities is ambiguous and matches nothing."""
    master, appd, dm = collections.defaultdict(set), collections.defaultdict(set), collections.defaultdict(set)
    for cn, p in polys.items():
        dm[L.fold(p["name"])].add(cn)
    for r in csv.DictReader(open(mapping, encoding="utf-8-sig")):
        cn = str(r["dm_comm_num"]).strip()
        if not cn or cn not in polys:
            continue
        lv = r["level"]
        if lv.startswith("master"):
            master[L.fold(r["name"])].add(cn)
        elif lv.startswith("app district"):
            appd[L.fold(r["name"])].add(cn)
    dist = {}
    for f in (L.J(dpoly) or {}).get("features", []):
        q = f["properties"]
        cns = [str(c) for c in q.get("comm_nums") or [] if str(c) in polys]
        if q.get("slug") and cns:
            dist[q["slug"]] = cns
            appd[L.fold(q.get("name"))].add(cns[0])
    return master, appd, dm, dist


def candidates(a):
    """the label itself, then the text inside brackets, then the text before them ('Dubai Islands (Palm Deira)' tries all three)"""
    a = str(a or "").strip()
    out = [a]
    m = re.match(r"^(.*?)\s*\((.*)\)\s*$", a)
    if m:
        out += [m.group(2).strip(), m.group(1).strip()]
    return [x for x in out if x]


# Spelling variants and abbreviations of a label that IS in the tables, each with the evidence for it. (district or None, fold(label)) -> (the table label it stands for, evidence).
# Nothing else is aliased: a label with no table entry and no entry here has no position.
ALIASES = {
    (None, L.fold("Sobha Heartland")): ("Sobha Hartland", "spelling variant of 'Sobha Hartland', a register master community in the tables"),
    (None, L.fold("Mbr District 1")): ("Mohammed Bin Rashid AL Maktoum City -District -1 Community", "'Mbr' is the register's own abbreviation of Mohammed Bin Rashid; the long label is in the tables"),
    ("liwan1", L.fold("Liwan")): ("Liwan1", "the card sits in our district Liwan1 (sales area name 'Liwan1'); a Liwan card with a register area ties to the same polygon (Wadi Al Safa 2)"),
    (None, L.fold("Expo City")): ("Madinat Al Mataar", "Expo City stands inside the Dubai Municipality community Madinat Al Mataar (our centres file, caption of community 521)"),
}


def resolve(a, tables, slug=None, reg_area=None):
    """(community number, via, matched text) or (None, reason, None). The first candidate that names exactly ONE community wins; a candidate naming two is ambiguous.
    Order: the card's own area label (and the text inside / before its brackets) against the register's master communities, our app districts and the Dubai Municipality names;
    then the alias table; then the Land Department register's own AREA_EN of the card's project, when it names exactly one community."""
    master, appd, dm, _ = tables
    seen_amb = None
    cands = candidates(a)
    for ci, cand in enumerate(cands):
        f = L.fold(cand)
        if not f:
            continue
        for via, t in (("register master community", master), ("app district", appd), ("Dubai Municipality community name", dm)):
            s = t.get(f)
            if s and len(s) == 1:
                return next(iter(s)), via + (" (text inside brackets)" if ci == 1 else (" (text before brackets)" if ci == 2 else "")), cand
            if s and len(s) > 1:
                seen_amb = "the name '%s' points at %d communities" % (cand, len(s))
    for cand in cands:
        al = ALIASES.get((slug, L.fold(cand))) or ALIASES.get((None, L.fold(cand)))
        if al:
            for via, t in (("register master community", master), ("app district", appd), ("Dubai Municipality community name", dm)):
                s = t.get(L.fold(al[0]))
                if s and len(s) == 1:
                    return next(iter(s)), "alias (%s)" % al[1], al[0]
    if reg_area:
        s = dm.get(L.fold(reg_area))
        if s and len(s) == 1:
            return next(iter(s)), "the register's area of the card's project (%s)" % reg_area, reg_area
    return None, seen_amb or "no Dubai Municipality community, register master community or app district is called '%s'" % a, None


def display(text, pol_name):
    """the community as a reader knows it, with the Dubai Municipality polygon it was matched to when that is a different name"""
    t, p = str(text or "").strip(), title(pol_name)
    return p if not t or L.fold(t) == L.fold(p) else "%s (%s)" % (t, p)


def build(index, blocks_dir, plots_path, live=False, polys=None, tables=None, areas_km2=None, geo=GEO, mapping=MAP, dpoly=DPOLY, data=L.DATA):
    idx, idx_path = L.load_index(index, live=live)
    slugs = sorted(idx["areas"])
    blocks, missing, blocks_dir = L.load_blocks(slugs, blocks_dir, live=live)
    cards = L.enumerate_cards(idx)
    L.project_numbers_from_register(cards, data)
    polys = polys or load_polygons(geo)
    tables = tables or load_tables(polys, mapping, dpoly)
    km2 = areas_km2 if areas_km2 is not None else area_km2(geo)
    pp = (L.J(plots_path) or {}).get("p", {}) if plots_path and os.path.exists(plots_path) else {}
    rows, P, C = [], {}, {}
    cnt = collections.Counter()
    for key in sorted(cards):
        c = cards[key]
        slug = c["slug"]
        hit = L.locate(blocks.get(slug, []), c["name"])
        plot = [p for p in sorted(c["p"]) if p in pp]
        ck = L.card_key(slug, c["name"])
        row = {"district": slug, "district_name": idx["areas"][slug]["name"], "project": c["name"], "card_key": ck, "project_no": ";".join(sorted(c["p"])), "register_status": c.get("st", ""),
               "sales_all": c["n_all"], "sales_l12": c["n_l12"], "own_area": "", "own_area_source": "", "state": "", "community": "", "dm_community_no": "", "matched_via": "", "why": ""}
        if hit:
            row.update(state="building", why="a building outline of this name is on the map (%d footprint%s)" % (len(hit), "" if len(hit) == 1 else "s"))
            cnt["building"] += 1
            rows.append(row)
            continue
        if plot:
            row.update(state="plot centre", why="a plot centre exists for register project %s" % plot[0])
            cnt["plot centre"] += 1
            rows.append(row)
            continue
        a, asrc = L.card_area(c)
        via_card = False
        if not a:
            a, asrc, via_card = idx["areas"][slug]["name"], "district_of_card", True
        row["own_area"], row["own_area_source"] = a, asrc or ""
        cn, via, mtext = resolve(a, tables, slug=slug, reg_area=c.get("reg_area"))
        if cn is None and via_card:
            dc = tables[3].get(slug)
            if dc and len(dc) >= 1:
                cn, via, mtext = dc[0], "app district polygon of the card's own district", a
        if cn is None:
            row.update(state="none", why="community not matched to any polygon: " + via)
            cnt["none"] += 1
            cnt["none_" + ("district" if via_card else "area")] += 1
            rows.append(row)
            continue
        pol = polys[cn]
        if cn not in C:
            C[cn] = {"n": title(pol["name"]), "lon": pol["lon"], "lat": pol["lat"], "bb": pol["bbox"], "area_km2": km2.get(cn), "evidence": "DERIVED", "basis": BASIS}
        ent = {"c": cn, "l": LABEL % display(mtext, pol["name"]), "m": via + (" (the card's district)" if via_card else ""), "a": a}
        if c["p"]:
            ent["pn"] = ";".join(sorted(c["p"]))
        if ck in P and P[ck] != ent:
            # two cards share one key (spelling variants of one name): keep the first, they point at the same place unless the areas differ
            if P[ck]["c"] != ent["c"]:
                row.update(state="none", why="two cards with the same key '%s' match different communities; neither gets a position" % ck)
                cnt["none"] += 1
                cnt["none_conflict"] += 1
                del P[ck]
                rows.append(row)
                continue
        P[ck] = ent
        row.update(state="community centre", community=ent["l"][len("Community centre: "):-len(". The exact plot is not in our data yet.")], dm_community_no=cn, matched_via=ent["m"], why="the middle of the card's own community; the exact plot is not in our data yet")
        cnt["community centre"] += 1
        cnt["community_via_card_district" if via_card else "community_via_own_area"] += 1
        if not c["p"]:
            cnt["community_no_project_no"] += 1
        rows.append(row)
    used = sorted(set(e["c"] for e in P.values()))
    C = {k: C[k] for k in used}
    by_d = collections.Counter(r["district"] for r in rows if r["state"] == "community centre")
    none_why = collections.Counter(r["why"] for r in rows if r["state"] == "none")
    meta = {"as_of": idx.get("generated") or idx.get("as_of") or "", "index_as_of": idx.get("as_of"), "cards": len(cards), "counts": {k: v for k, v in sorted(cnt.items())},
            "by_district": dict(sorted(by_d.items(), key=lambda kv: (-kv[1], kv[0]))), "communities": len(C),
            "blocks_missing": missing, "ladder": "building outline > plot centre > community centre",
            "basis": "Dubai Municipality community outline (docs/DUBAI_2040_CENTRES_PROPOSED.geojson); the point is the representative point of the community polygon, computed by us: DERIVED. "
                     "It is the middle of the community, not of the project and not the building.",
            "rule": "An entry exists only for a card with no building outline and no plot centre whose own community matches exactly one Dubai Municipality community polygon. No match, no entry."}
    return {"meta": meta, "c": C, "p": P}, rows, none_why


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--index", default=None, help="developer index json (default: the 7 Oct audit's copy of the live index)")
    ap.add_argument("--blocks-dir", default=None)
    ap.add_argument("--plots", default=PLOTS)
    ap.add_argument("--live", action="store_true", help="read the live index and live blocks (read-only kv_read_live.mjs) into a temp folder")
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--audit", default=AUDIT_CSV)
    ap.add_argument("--geo", default=GEO)
    ap.add_argument("--mapping", default=MAP)
    ap.add_argument("--dpoly", default=DPOLY)
    ap.add_argument("--data", default=L.DATA)
    a = ap.parse_args()
    d, rows, none_why = build(a.index, a.blocks_dir, a.plots, live=a.live, geo=a.geo, mapping=a.mapping, dpoly=a.dpoly, data=a.data)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(d, f, separators=(",", ":"), sort_keys=True, ensure_ascii=False)
    os.makedirs(os.path.dirname(a.audit), exist_ok=True)
    with open(a.audit, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(sorted(rows, key=lambda r: (r["state"], r["district"], r["project"])))
    m = d["meta"]
    print("cards", m["cards"], "counts", m["counts"])
    print("community positions", len(d["p"]), "in", m["communities"], "communities; bytes", os.path.getsize(a.out), "as_of", m["as_of"])
    print("by district", m["by_district"])
    print("no position (%d):" % sum(none_why.values()))
    for k, v in none_why.most_common():
        print("  %4d  %s" % (v, k))


if __name__ == "__main__":
    main()
