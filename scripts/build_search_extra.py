"""v392 + v397b - SEARCH ENTRIES for projects the Najma map search and the Find page cannot find yet (Kendall, 7 Oct 2026).
v392: typing 'KORE by Imtiaz' in the Najma map search must find it. v397b (completeness fix 4): EVERY register project is findable. The completeness audit found the search list (S2s) covers 76.5 percent of
register projects (600 never built into that surface, 222 with no sales, 193 not on the project-register extract we hold).

Output (additive, never replaces or reorders anything the live lists hold): data/search_extra/search_extra.json -> KV img_search_extra, published by scripts/publish_nosales.py --what search
  features  the v392 plot features (KORE, The Archive and the no-sales projects with a plot position): merged into /img/plots (drawn as plot dots, as in v392)
  sx        v397b: one compact entry per register project that is not findable yet. NOT drawn on the map (search only). Fields:
              n name, ar Arabic name, pn register project number, a the project's own area, d district slug (when known), dv developer legal entity as the register files it,
              ev evidence label of dv (REGISTER_VERIFIED = project register; UNVERIFIED = another register or none), st status, u units,
              lo/la position, k 'p' plot position (centre of the registered plot, not a building) | 'c' community centre (the middle of the community, not the project), pl plot parcel id,
              s which surface needs it: 1 Find page, 2 Najma map search, 3 both
  If the file would pass --split-over bytes it is written as a small index (features + parts) and one file per district (img_search_extra_<d>); the worker joins them.
A project is findable when its name (or Arabic name) is on the live list by the audit's own name rule (exact name, else the core name of 6+ characters). Dedupe never touches an existing entry.
The plots file is built by naj-market-pulse and the audit lives there: both are only READ here.
  python scripts/build_search_extra.py [--naj C:\\Dev\\naj-market-pulse] [--out data/search_extra/search_extra.json] [--cache <dir>] [--offline]
"""
import argparse, csv, glob, gzip, json, os, re, sys, unicodedata, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
MUST = ("648-8592", "648-8534")      # KORE by Imtiaz, The Archive by Imtiaz
LIVE = "https://azimuth-2.digitalchemy.workers.dev/img/"
UA = {"User-Agent": "najma-ops/1.0"}
STOP = re.compile(r"\b(towers?|residences?|residence|building|bldg|apartments?)\b")
ALIAS = {"alyelayiss1": "alyalayis1", "alyelayiss2": "alyalayis2"}     # register spelling -> Dubai Municipality spelling, same place
csv.field_size_limit(10 ** 9)


def _fold(s):
    s = unicodedata.normalize("NFKD", str(s or ""))
    return "".join(c for c in s if not unicodedata.combining(c))


def nk_full(s):
    return re.sub(r"[^a-z0-9\u0600-\u06ff]", "", _fold(s).lower())


def nk_core(s):
    t = _fold(s).lower()
    t = re.sub(r"\s+by\s+.*$", "", t)
    t = re.sub(r"^\s*the\s+", "", t)
    t = STOP.sub("", t)
    return re.sub(r"[^a-z0-9\u0600-\u06ff]", "", t)


class Names:
    def __init__(self):
        self.full, self.core = set(), set()

    def add(self, name):
        f, c = nk_full(name), nk_core(name)
        if f:
            self.full.add(f)
        if c and len(c) >= 6:
            self.core.add(c)

    def has(self, names):
        for n in names:
            if nk_full(n) in self.full:
                return True
        for n in names:
            c = nk_core(n)
            if c and len(c) >= 6 and c in self.core:
                return True
        return False


def live(name, cache, offline):
    p = os.path.join(cache, name + ".json")
    if os.path.exists(p) and (offline or True):
        try:
            return json.load(open(p, encoding="utf-8"))
        except Exception:
            pass
    if offline:
        return None
    b = urllib.request.urlopen(urllib.request.Request(LIVE + name, headers=UA), timeout=120).read()
    if b[:2] == b"\x1f\x8b":
        b = gzip.decompress(b)
    os.makedirs(cache, exist_ok=True)
    open(p, "wb").write(b)
    return json.loads(b)


def v392_features(a, ns, pp, plots):
    by_plot = {f["properties"]["plot"]: f for f in plots if f["properties"].get("plot")}
    feats, seen = [], set()
    for pid in MUST:
        f = by_plot[pid]
        g = json.loads(json.dumps(f))
        if g["properties"].get("i") is None:
            g["properties"]["nb"] = 1
        feats.append(g)
        seen.add(pid)
    for dev in sorted(ns):
        for dist in sorted(ns[dev]):
            for e in ns[dev][dist]:
                if e.get("p") is None or str(e["p"]) not in pp:
                    continue
                x = pp[str(e["p"])]
                pid = str(x["parcels"][0])
                if pid in seen:
                    continue
                seen.add(pid)
                feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [x["lon"], x["lat"]]},
                              "properties": {"plot": pid, "name": e["n"], "units": e.get("u"), "master": e.get("a"), "district": x.get("d") or dist, "nb": 1, "i": None,
                                             "source": "register project %s; plot centre computed from the Dubai Municipality outline (DERIVED); no registered sales yet" % e["p"]}})
    return [{"type": f["type"], "geometry": f["geometry"], "properties": {k: v for k, v in f["properties"].items() if v is not None or k == "i"}} for f in feats]


def dev_en(naj):
    """register project number -> developer English name (the project register files, newest wins)."""
    out = {}
    for fn in sorted(glob.glob(os.path.join(naj, "data", "projects-*.csv"))):
        try:
            for r in csv.DictReader(open(fn, encoding="utf-8-sig")):
                if r.get("PROJECT_NUMBER") and r.get("DEVELOPER_EN"):
                    out[r["PROJECT_NUMBER"].strip()] = r["DEVELOPER_EN"].strip()
        except Exception:
            pass
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--naj", default=r"C:\Dev\naj-market-pulse")
    ap.add_argument("--nosales", default=os.path.join(ROOT, "data", "nosales", "nosales.json"))
    ap.add_argument("--universe", default=None, help="universe_projects.csv of the completeness audit (default: in the naj repo docs)")
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "search_extra", "search_extra.json"))
    ap.add_argument("--cache", default=os.path.join(os.environ.get("TEMP", "."), "search_extra_live_cache"))
    ap.add_argument("--offline", action="store_true", help="use the cache only")
    ap.add_argument("--split-over", type=int, default=400000)
    ap.add_argument("--no-sx", action="store_true", help="v392 output only")
    a = ap.parse_args()
    ns = json.load(open(a.nosales, encoding="utf-8"))["d"]
    pp = json.load(open(os.path.join(ROOT, "data", "plot_positions", "plot_positions.json"), encoding="utf-8"))["p"]
    plots = json.load(open(os.path.join(a.naj, "data", "board", "plots.json"), encoding="utf-8"))["features"]
    feats = v392_features(a, ns, pp, plots)
    res = {"meta": {"built": "2026-10-07", "count": len(feats), "rule": "additive: merged into /img/plots (features) and the search lists (sx) by the worker; a plot id or name already in a list is skipped"}, "features": feats}
    parts = {}
    if not a.no_sx:
        sx, stats = build_sx(a, ns, pp, feats)
        res["meta"]["sx_count"] = len(sx)
        res["meta"]["sx_stats"] = stats
        res["sx"] = sx
        blob = json.dumps(res, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if len(blob) > a.split_over:
            by = {}
            for x in sx:
                by.setdefault(x.get("d") or "none", []).append(x)
            parts = {d: by[d] for d in sorted(by)}
            res["sx"] = []
            res["parts"] = {d: len(v) for d, v in parts.items()}
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    for old in glob.glob(a.out[:-5] + "_*.json"):
        os.remove(old)
    with open(a.out, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(res, fh, ensure_ascii=False, separators=(",", ":"))
    total = os.path.getsize(a.out)
    print(len(feats), "features,", len(res.get("sx", [])) + sum(len(v) for v in parts.values()), "sx entries,", total, "bytes (main file)")
    for d, v in parts.items():
        fp = a.out[:-5] + "_" + d + ".json"
        with open(fp, "w", encoding="utf-8", newline="\n") as fh:
            json.dump({"d": d, "sx": v}, fh, ensure_ascii=False, separators=(",", ":"))
        total += os.path.getsize(fp)
        print("  part", d, len(v), os.path.getsize(fp), "bytes")
    print("total", total, "bytes")


def build_sx(a, ns, pp, feats):
    uni = a.universe or os.path.join(a.naj, "docs", "COMPLETENESS_AUDIT_07OCT2026", "universe_projects.csv")
    rows = list(csv.DictReader(open(uni, encoding="utf-8-sig")))
    sidx = live("search_index", a.cache, a.offline) or {"items": []}
    lplots = live("plots", a.cache, a.offline) or {"features": []}
    mprices = live("map_prices", a.cache, a.offline) or {"items": []}
    find, mapn = Names(), Names()
    area_d = {}
    for it in sidx.get("items", []):
        find.add(it.get("n"))
        if it.get("a") and it.get("d"):
            area_d.setdefault(nk_full(it["a"]), it["d"])
    for f in lplots.get("features", []) + feats:
        p = f.get("properties") or {}
        mapn.add(p.get("name"))
        if p.get("master") and p.get("district"):
            area_d.setdefault(nk_full(p["master"]), p["district"])
    for it in mprices.get("items", []):
        mapn.add(it.get("n"))
    # position tables
    cp = json.load(open(os.path.join(ROOT, "data", "community_positions", "community_positions.json"), encoding="utf-8"))
    cc = cp["c"]
    c_by_name = {nk_full(v["n"]): k for k, v in cc.items()}
    pn_c, pn_d = {}, {}
    for key, v in cp["p"].items():
        if v.get("pn") and v.get("c") in cc:
            pn_c[str(v["pn"])] = v["c"]
            pn_d[str(v["pn"])] = key.split("|")[0]
    area_c = {}
    audit = os.path.join(ROOT, "data", "community_positions", "community_positions_audit.csv")
    for r in csv.DictReader(open(audit, encoding="utf-8-sig")):
        if r.get("own_area") and r.get("dm_community_no") in cc:
            area_c.setdefault(nk_full(r["own_area"]), r["dm_community_no"])
        if r.get("district_name") and r.get("district"):
            area_d.setdefault(nk_full(r["district_name"]), r["district"])
    den = dev_en(a.naj)
    nos = {}
    for dev in ns:
        for dist in ns[dev]:
            for e in ns[dev][dist]:
                if e.get("p") is not None:
                    nos[str(e["p"])] = e
    sx, st = [], {"universe": len(rows), "findable_find": 0, "findable_map": 0, "added": 0, "plot": 0, "community": 0, "nopos": 0, "arabic": 0, "no_pn": 0}
    seen_full = set()
    for r in rows:
        if len(nk_full(r.get("name"))) < 2 and (r.get("project_number") or "").strip():
            r["name"] = "Registered project %s (no name filed)" % r["project_number"].strip()   # the register row has no usable name ('.'): findable by this label and by its number
        names = [x for x in (r.get("name"), r.get("name_alt")) if x]
        if not names or len(nk_full(r.get("name"))) < 2:
            continue
        f_ok, m_ok = find.has(names), mapn.has(names)
        st["findable_find"] += f_ok
        st["findable_map"] += m_ok
        if f_ok and m_ok:
            continue
        key = nk_full(r["name"]) + "|" + (r.get("project_number") or "")
        if key in seen_full:
            continue
        seen_full.add(key)
        pn = (r.get("project_number") or "").strip()
        x = {"n": r["name"].strip()}
        if r.get("name_alt"):
            x["ar"] = r["name_alt"].strip()
            st["arabic"] += 1
        if pn:
            x["pn"] = pn
        else:
            st["no_pn"] += 1
        area = (r.get("area") or "").strip()
        if area:
            x["a"] = area
        ne = nos.get(pn)
        if ne and ne.get("de"):
            x["dv"], x["ev"] = ne["de"], ne.get("e") or "UNVERIFIED"
        elif pn in den:
            x["dv"], x["ev"] = den[pn], "REGISTER_VERIFIED"
        elif r.get("developer_register"):
            x["dv"], x["ev"] = r["developer_register"].strip(), ("REGISTER_VERIFIED" if str(r.get("source", "")).startswith("register_") else "UNVERIFIED")
        if r.get("status"):
            x["st"] = r["status"]
        try:
            if r.get("reg_units") not in (None, ""):
                x["u"] = int(float(r["reg_units"]))
        except ValueError:
            pass
        d = area_d.get(nk_full(area))
        if pn in pp:
            q = pp[pn]
            x["lo"], x["la"], x["k"] = q["lon"], q["lat"], "p"
            x["pl"] = str(q["parcels"][0])
            d = q.get("d") or d
            st["plot"] += 1
        else:
            c = pn_c.get(pn) or area_c.get(nk_full(area)) or c_by_name.get(nk_full(area)) or c_by_name.get(ALIAS.get(nk_full(area), "-"))
            if c:
                x["lo"], x["la"], x["k"] = cc[c]["lon"], cc[c]["lat"], "c"
                d = pn_d.get(pn) or d
                st["community"] += 1
            else:
                st["nopos"] += 1
        if d:
            x["d"] = d
        x["s"] = (0 if f_ok else 1) + (0 if m_ok else 2)
        sx.append(x)
        st["added"] += 1
    return sx, st


if __name__ == "__main__":
    main()
