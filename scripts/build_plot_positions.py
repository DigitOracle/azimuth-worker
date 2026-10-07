"""v386 - PLOT POSITIONS for project cards that have no building outline on the map.
Offline, deterministic, re-runnable, READ-ONLY on the lake and on the Makani files (more outlines arrive while the Makani queue runs: run this again and the file grows).
Writes ONE local file (default data/plot_positions/plot_positions.json):
  {"meta": {...}, "p": {"<register project number>": {lon, lat, parcels:[ids], n_plots, basis:"makani_plot_outline", evidence:"DERIVED", link:"REGISTER_VERIFIED", label, as_of, st, d}}}

WHAT IT USES
  --ledger     the 7 Oct card audit's card_ledger.csv (one row per project card; clickable = no means the page finds no building outline of that name; parcels = the registered land parcels
               the Dubai Land Department register ties to the project by name, from land_registry_<district>.json and units_buildings_<district>.json).
  --plots-dir  data/dm/plots/makani_*.jsonl : one line per parcel id, `shape` = "lon,lat, lon,lat, ..." (Dubai Municipality's plot outline) or null when the service returned none.
RULES (nothing is invented)
  * a project gets an entry only when it has 1 to 40 registered parcels AND EVERY one of them has a held outline; a project with some outlines missing waits (counted as "awaiting");
  * the position is the centre of the held outline (area-weighted centroid of the ring; for several parcels the area-weighted centre of all of them, which is the centroid of their union because plots do not overlap),
    lon / lat to 5 decimals; several plots more than 3 km apart are NOT averaged into one point (no entry, counted as "dispersed");
  * the project-to-parcel link is REGISTER_VERIFIED (Dubai Land Department land registry carries the project on that parcel); the position is DERIVED (computed here from the Municipality outline);
  * a plot id tied to more than one project (a podium or sibling tower shares it) is marked in `shared` and the label says so;
  * more than 40 parcels (a community): NO entry (a community centre cannot be stated honestly as a point of the project); no parcel, or no outline held: NO entry.
Run:  python scripts/build_plot_positions.py [--ledger ...] [--plots-dir ...] [--out ...] [--as-of YYYY-MM-DD]"""
import argparse, collections, csv, glob, json, math, os, re, sys

NMP = r"C:\Dev\naj-market-pulse"
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
MAX_PARCELS = 40
MAX_SPREAD_M = 3000.0
BASIS = "makani_plot_outline"
NOT_BUILT = ("NOT_STARTED", "PENDING")


def parse_ring(shape):
    """'lon,lat, lon,lat, ...' -> [(lon, lat), ...] or None. Only values inside the Dubai box are accepted."""
    if not isinstance(shape, str) or not shape.strip():
        return None
    try:
        v = [float(t) for t in shape.replace(";", ",").split(",") if t.strip()]
    except ValueError:
        return None
    if len(v) < 6 or len(v) % 2:
        return None
    pts = [(v[i], v[i + 1]) for i in range(0, len(v), 2)]
    if not all(54.5 <= x <= 56.6 and 24.0 <= y <= 25.6 for x, y in pts):
        return None
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    return pts


def ring_area_centroid(pts, lat0):
    """planar area (m2) and centroid (lon, lat) of a ring, in a local metre frame around lat0. Zero area falls back to the vertex mean with area 0."""
    kx = 111320.0 * math.cos(math.radians(lat0))
    ky = 110574.0
    xy = [((x - pts[0][0]) * kx, (y - pts[0][1]) * ky) for x, y in pts]
    a2 = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(xy, xy[1:]):
        c = x0 * y1 - x1 * y0
        a2 += c
        cx += (x0 + x1) * c
        cy += (y0 + y1) * c
    if abs(a2) < 1e-9:
        n = len(pts) - 1
        return 0.0, (sum(p[0] for p in pts[:-1]) / n, sum(p[1] for p in pts[:-1]) / n)
    cx /= 3.0 * a2
    cy /= 3.0 * a2
    return abs(a2) / 2.0, (pts[0][0] + cx / kx, pts[0][1] + cy / ky)


def plot_centre(rings):
    """area-weighted centre of several rings (lon, lat), the largest distance of a ring centre from it in metres, and the total area."""
    lat0 = sum(r[0][1] for r in rings) / len(rings)
    parts = [ring_area_centroid(r, lat0) for r in rings]
    tot = sum(a for a, _ in parts)
    if tot <= 0:
        lon = sum(c[0] for _, c in parts) / len(parts)
        lat = sum(c[1] for _, c in parts) / len(parts)
    else:
        lon = sum(a * c[0] for a, c in parts) / tot
        lat = sum(a * c[1] for a, c in parts) / tot
    kx = 111320.0 * math.cos(math.radians(lat0))
    spread = max(math.hypot((c[0] - lon) * kx, (c[1] - lat) * 110574.0) for _, c in parts)
    return lon, lat, spread, tot


def held_outlines(plots_dir):
    """parcel id (str) -> (ring, 'at' timestamp): the newest record that carries a parseable outline."""
    held = {}
    for f in sorted(glob.glob(os.path.join(plots_dir, "makani_*.jsonl"))):
        with open(f, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    r = json.loads(line)
                except ValueError:
                    continue            # a half-written last line of a running crawl
                pid = str(r.get("parcel_id") or "").split(".")[0]
                ring = parse_ring(r.get("shape"))
                if not pid or ring is None:
                    continue
                at = str(r.get("at") or "")
                if pid not in held or at >= held[pid][1]:
                    held[pid] = (ring, at)
    return held


def label_for(status, n, shared):
    base = "Plot position (centre of the registered plot)" if n <= 5 else "Plot position (centre of the project's %d registered plots)" % n
    t = base + (", building not built yet" if status in NOT_BUILT else "; the building outline is not on our map yet")
    if shared:
        t += ". The plot is shared with another registered project"
    return t


def build(ledger_path, plots_dir, as_of=None):
    rows = list(csv.DictReader(open(ledger_path, encoding="utf-8-sig")))
    owners = collections.defaultdict(set)         # parcel -> project numbers (all cards, clickable or not)
    for r in rows:
        for pid in filter(None, (r.get("parcels") or "").split(";")):
            if r.get("project_no"):
                owners[pid].add(r["project_no"])
    proj = {}                                       # project number -> {parcels, status, district}
    for r in rows:
        if (r.get("clickable") or "").strip().lower() != "no" or not r.get("project_no"):
            continue
        q = proj.setdefault(r["project_no"], {"parcels": set(), "st": "", "d": r.get("district") or ""})
        q["parcels"] |= set(filter(None, (r.get("parcels") or "").split(";")))
        q["st"] = q["st"] or (r.get("register_status") or "")
    held = held_outlines(plots_dir)
    out, c = {}, collections.Counter()
    miss_parcels = set()
    used_at = []
    for pn in sorted(proj, key=lambda x: (0, int(x), "") if x.isdigit() else (1, 0, x)):
        q = proj[pn]
        ps = sorted(q["parcels"])
        if not ps:
            c["no_parcel"] += 1
            continue
        if len(ps) > MAX_PARCELS:
            c["community_over_40"] += 1
            continue
        if not all(p in held for p in ps):
            c["awaiting_outlines"] += 1
            miss_parcels |= {p for p in ps if p not in held}
            continue
        lon, lat, spread, _ = plot_centre([held[p][0] for p in ps])
        if len(ps) > 1 and spread > MAX_SPREAD_M:
            c["dispersed"] += 1
            continue
        shared = sorted({o for p in ps for o in owners[p]} - {pn})
        e = {"lon": round(lon, 5), "lat": round(lat, 5), "parcels": ps, "n_plots": len(ps), "basis": BASIS, "evidence": "DERIVED", "link": "REGISTER_VERIFIED",
             "label": label_for(q["st"], len(ps), bool(shared)), "st": q["st"], "d": q["d"]}
        if shared:
            e["shared"] = shared
        e["as_of"] = max(held[p][1] for p in ps)[:10]      # the newest outline record behind THIS entry
        used_at += [held[p][1] for p in ps]
        out[pn] = e
        c["positions"] += 1
    asof = as_of or (max(used_at)[:10] if used_at else "")
    if as_of:
        for e in out.values():
            e["as_of"] = as_of
    by_d = collections.Counter(e["d"] for e in out.values())
    by_s = collections.Counter(e["st"] or "unknown" for e in out.values())
    meta = {"as_of": asof, "cards_without_outline_projects": len(proj), "counts": dict(c), "by_district": dict(sorted(by_d.items(), key=lambda kv: (-kv[1], kv[0]))),
            "by_state": dict(sorted(by_s.items(), key=lambda kv: (-kv[1], kv[0]))), "awaiting_parcels": len(miss_parcels),
            "basis": "Dubai Municipality plot outline (Makani 'Find My Land Number'), centre computed by us: DERIVED. Project to parcel link: Dubai Land Department land registry: REGISTER_VERIFIED.",
            "rule": "An entry exists only when every registered parcel of the project (1 to 40) has a held outline. No outline, no entry."}
    return {"meta": meta, "p": out}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ledger", default=os.path.join(NMP, "docs", "CARD_MAP_POSITION_AUDIT_07OCT2026", "card_ledger.csv"))
    ap.add_argument("--plots-dir", default=os.path.join(NMP, "data", "dm", "plots"))
    ap.add_argument("--out", default=os.path.join(REPO, "data", "plot_positions", "plot_positions.json"))
    ap.add_argument("--as-of", default=None)
    a = ap.parse_args()
    d = build(a.ledger, a.plots_dir, a.as_of)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(d, f, separators=(",", ":"), sort_keys=True)
    m = d["meta"]
    print("positions", len(d["p"]), "as_of", m["as_of"], "bytes", os.path.getsize(a.out))
    print("counts", m["counts"], "awaiting parcels", m["awaiting_parcels"])
    print("by state", m["by_state"])
    print("by district", m["by_district"])


if __name__ == "__main__":
    main()
