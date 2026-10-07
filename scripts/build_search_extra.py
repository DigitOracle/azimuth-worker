"""v392 - MAP SEARCH ENTRIES for projects with no registered sales yet (Kendall, 7 Oct 2026: typing 'KORE by Imtiaz' in the Najma map search must find it).
The map search (src/index.js searchAll) lists the plots file (KV img_plots) by name and plot number. A project that is not in that file cannot be found. This script writes the ADDITIVE entries
(data/search_extra/search_extra.json -> KV img_search_extra, scripts/publish_nosales.py --what search); the worker merges them into /img/plots when the key exists (src/nosales.js mergePlots) and
never replaces or reorders a plot the list already has (same plot id or same name = skipped). The plots file is built by naj-market-pulse: that repo is only READ here.
Entries: every no-sales project (data/nosales/nosales.json) that has a plot position (a register plot centre, or its own plot in the plots file), plus The Archive by Imtiaz and KORE by Imtiaz.
A feature with no building outline carries nb:1, and the search result says 'plot position, not a building'.
  python scripts/build_search_extra.py [--naj C:\\Dev\\naj-market-pulse] [--out data/search_extra/search_extra.json]
"""
import argparse, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
MUST = ("648-8592", "648-8534")      # KORE by Imtiaz, The Archive by Imtiaz


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--naj", default=r"C:\Dev\naj-market-pulse")
    ap.add_argument("--nosales", default=os.path.join(ROOT, "data", "nosales", "nosales.json"))
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "search_extra", "search_extra.json"))
    a = ap.parse_args()
    ns = json.load(open(a.nosales, encoding="utf-8"))["d"]
    pp = json.load(open(os.path.join(ROOT, "data", "plot_positions", "plot_positions.json"), encoding="utf-8"))["p"]
    plots = json.load(open(os.path.join(a.naj, "data", "board", "plots.json"), encoding="utf-8"))["features"]
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
    feats = [{"type": f["type"], "geometry": f["geometry"], "properties": {k: v for k, v in f["properties"].items() if v is not None or k == "i"}} for f in feats]
    res = {"meta": {"built": "2026-10-07", "count": len(feats), "rule": "additive: merged into /img/plots by the worker; a plot id or name already in the list is skipped"}, "features": feats}
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(res, fh, ensure_ascii=False, separators=(",", ":"))
    print(len(feats), "features,", os.path.getsize(a.out), "bytes")


if __name__ == "__main__":
    main()
