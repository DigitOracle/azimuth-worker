"""v397b - SEARCH COVERAGE CHECK (read-only). How many register projects can a client now find by typing, on the two search surfaces?
Given the built extra file (data/search_extra/search_extra.json plus its district parts) and the LIVE /img/plots, /img/search_index and /img/map_prices (read through the worker's own /img route, a
User-Agent is sent), it applies the worker's merge rule in Python (a name already in the list is skipped) and reports, for the audit universe (naj-market-pulse docs/COMPLETENESS_AUDIT_07OCT2026/
universe_projects.csv: 3,039 register extract + 267 of the 1 Sep delta + 323 sales-register-only + 286 building-register-only):
  Find page  = search_index items + sx entries flagged 1
  map search = plots + map_prices + v392 features + sx entries flagged 2
before (live lists only) and after (with the extra file), the share findable, and every project still missing with the cause. A project is findable when its name or Arabic name is on the list by the
audit's name rule (exact name, else the core name of 6+ characters). Nothing is written except the optional --csv of the still-missing projects.
  python scripts/check_search_coverage.py [--extra data/search_extra/search_extra.json] [--cache <dir>] [--offline] [--csv missing.csv]
"""
import argparse, csv, glob, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_search_extra as B

ROOT = B.ROOT


def load_extra(path):
    ex = json.load(open(path, encoding="utf-8"))
    sx = list(ex.get("sx") or [])
    parts = []
    for d in sorted(ex.get("parts") or {}):
        fp = path[:-5] + "_" + d + ".json"
        if not os.path.exists(fp):
            parts.append(d)
            continue
        sx += json.load(open(fp, encoding="utf-8")).get("sx") or []
    return ex, sx, parts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--extra", default=os.path.join(ROOT, "data", "search_extra", "search_extra.json"))
    ap.add_argument("--naj", default=r"C:\Dev\naj-market-pulse")
    ap.add_argument("--universe", default=None)
    ap.add_argument("--cache", default=os.path.join(os.environ.get("TEMP", "."), "search_extra_live_cache"))
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--csv", default=None)
    a = ap.parse_args()
    ex, sx, missing_parts = load_extra(a.extra)
    uni = a.universe or os.path.join(a.naj, "docs", "COMPLETENESS_AUDIT_07OCT2026", "universe_projects.csv")
    rows = list(B.csv.DictReader(open(uni, encoding="utf-8-sig")))
    sidx = B.live("search_index", a.cache, a.offline) or {"items": []}
    lplots = B.live("plots", a.cache, a.offline) or {"features": []}
    mprices = B.live("map_prices", a.cache, a.offline) or {"items": []}
    find0, map0 = B.Names(), B.Names()
    for it in sidx["items"]:
        find0.add(it.get("n"))
    for f in lplots["features"]:
        map0.add((f.get("properties") or {}).get("name"))
    for it in mprices["items"]:
        map0.add(it.get("n"))
    find1, map1 = B.Names(), B.Names()
    for src, dst in ((find0, find1), (map0, map1)):
        dst.full, dst.core = set(src.full), set(src.core)
    for f in ex.get("features") or []:
        map1.add((f.get("properties") or {}).get("name"))
    for x in sx:
        s = int(x.get("s") or 3)
        for nm in (x.get("n"), x.get("ar")):
            if s & 1:
                find1.add(nm)
            if s & 2:
                map1.add(nm)
    tot = {"all": [0, 0, 0, 0, 0], "register": [0, 0, 0, 0, 0]}   # n, find before, find after, map before, map after
    still = []
    for r in rows:
        if len(B.nk_full(r.get("name"))) < 2 and (r.get("project_number") or "").strip():
            r["name"] = "Registered project %s (no name filed)" % r["project_number"].strip()
        names = [x for x in (r.get("name"), r.get("name_alt")) if x and len(B.nk_full(x)) >= 2]
        reg =str(r.get("source", "")).startswith("register_")
        f0, f1, m0, m1 = (find0.has(names), find1.has(names), map0.has(names), map1.has(names)) if names else (False, False, False, False)
        for k in ("all",) + (("register",) if reg else ()):
            t = tot[k]
            t[0] += 1; t[1] += f0; t[2] += f1; t[3] += m0; t[4] += m1
        if not (f1 and m1):
            cause = "no project name in the register row" if not names else "name not on the merged list (not built, or its district part is not published)"
            still.append([r.get("key"), r.get("project_number"), r.get("name"), r.get("area"), r.get("source"), "find" if not f1 else "", "map" if not m1 else "", cause])
    pct = lambda n, d: "%.1f%%" % (100.0 * n / d) if d else "n/a"
    print("extra file: %d features, %d sx entries%s" % (len(ex.get("features") or []), len(sx), (", MISSING PARTS: " + ",".join(missing_parts)) if missing_parts else ""))
    print("live lists: search_index %d items, plots %d features, map_prices %d items" % (len(sidx["items"]), len(lplots["features"]), len(mprices["items"])))
    for k, lab in (("register", "register projects (extract + 1 Sep delta)"), ("all", "whole universe (+ sales-register-only + building-register-only)")):
        n, f0, f1, m0, m1 = tot[k]
        print("%-62s n=%d  Find %s -> %s   map search %s -> %s" % (lab, n, pct(f0, n), pct(f1, n), pct(m0, n), pct(m1, n)))
    kinds = {}
    for x in sx:
        kinds[x.get("k") or "none"] = kinds.get(x.get("k") or "none", 0) + 1
    print("sx entries by position: plot position %d, community centre %d, none (opens the details panel, no map fly) %d" % (kinds.get("p", 0), kinds.get("c", 0), kinds.get("none", 0)))
    print("still missing on either surface: %d" % len(still))
    for s in still[:40]:
        print("  ", s)
    if a.csv:
        with open(a.csv, "w", encoding="utf-8-sig", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["key", "project_number", "name", "area", "source", "missing_find", "missing_map", "cause"])
            w.writerows(still)
    return 0


if __name__ == "__main__":
    sys.exit(main())
