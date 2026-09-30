"""The Brief, part C - the district map layers behind the LOD 100 maps in /brief_pdf (src/brief_docs.js).

Why this exists. The approved maps (Downloads/JVC_1BR_65K_sheets/map/make_map.py, 30 Sep 2026) are matplotlib renders of every
footprint in the district raised to its height, seen from the south at 50 degrees. The Worker cannot run matplotlib, and the app
does not serve footprint OUTLINES anywhere: img_anchors_<d> carries one centroid and a height per footprint, img_sky_<d> is a
packed GLB mesh and img_ctx_<d> is road polygons. So the Worker gets one compact layer per district and draws the same view as SVG
(briefMapSvg in src/brief_docs.js): same projection, same palette, same badges, north arrow and scale bar. One layer per district
serves every building and every set of buildings, where a pre-rendered picture would be needed per building AND per chosen set.

Input   C:/Dev/naj-market-pulse/data/ce/<d>/buildings.geojson   footprints (OpenStreetMap-derived district model), feature order = i
        C:/Dev/naj-market-pulse/data/ce/<d>/streets.geojson     centrelines with road class (hw) and name (nm), where present
        C:/Dev/naj-market-pulse/data/ce/<d>/ctx.json            road polygons, used only where there is no streets.geojson
        C:/Dev/naj-market-pulse/data/names/anchors_<d>.json     heights (fps: [i, x, y, h]) - the same source make_map.py uses
Output  KV img_brief_fp_<d> (JSON, via POST /ingest_market; the imageName cap there is 40 characters, "brief_fp_" + slug fits):
        {"d", "v": 1, "crs": "EPSG:32640 minus o", "o": [x0, y0], "b": [[i, h, [x, y, x, y, ...]], ...],     metres, integers
         "s": [[width_class, [x, y, ...]], ...], "rp": [[x, y, ...], ...] (road polygons, fallback), "lab": [[name, [x, y, ...]]],
         "ll": [a, b, c, d, e, f]   lon/lat -> local x = a*lon + b*lat + c, y = d*lon + e*lat + f (the projection's tangent at the
                                    district centre, worst error printed; used only to drop an approximate pin), "src": "..."}
Usage   python scripts/brief_map_layers.py [--district jumeirahvillagecircle ...] [--out DIR]           dry run: writes files only
        python scripts/brief_map_layers.py --push                                                          needs INGEST_TOKEN
Nothing is pushed without --push. Run it from the machine that holds naj-market-pulse.
"""
import argparse, base64, glob, json, math, os, sys, urllib.request

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

from pyproj import Transformer

DATA = os.environ.get("NAJ_DATA", r"C:/Dev/naj-market-pulse/data")
WORKER = "https://azimuth-2.digitalchemy.workers.dev"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(__import__("tempfile").gettempdir(), "brief_layers")   # outside the repo
to_utm = Transformer.from_crs(4326, 32640, always_xy=True)
# road class -> the line-width class the SVG uses (make_map.py's cls_w order); residential = 0 ... motorway = 9
CLS = ["residential", "tertiary_link", "tertiary", "motorway_link", "secondary_link", "primary_link", "secondary", "primary",
       "trunk", "motorway"]
LABEL_CLASSES = {"motorway", "trunk", "primary", "secondary"}


def env_token(name):
    p = r"C:\Dev\azimuth-listener-naj\.env"
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            if line.startswith(name + "="):
                return line.split("=", 1)[1].strip()
    return os.environ.get(name)


def outer_rings(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]
    if geom["type"] == "MultiPolygon":
        return [p[0] for p in geom["coordinates"]]
    return []


def flat(pts, o):
    out = []
    for x, y in pts:
        out += [int(round(x - o[0])), int(round(y - o[1]))]
    return out


def simplify(pts, tol=0.8):
    """Drop points closer than tol metres to the last kept one - footprints carry survey-grade noise the map cannot show."""
    keep = [pts[0]]
    for p in pts[1:-1]:
        if math.dist(p, keep[-1]) >= tol:
            keep.append(p)
    keep.append(pts[-1])
    return keep


def build(d):
    base = os.path.join(DATA, "ce", d)
    g = json.load(open(os.path.join(base, "buildings.geojson"), encoding="utf-8"))
    heights = {}
    ap = os.path.join(DATA, "names", "anchors_%s.json" % d)
    if os.path.exists(ap):
        heights = {r[0]: r[3] for r in json.load(open(ap, encoding="utf-8")).get("fps", [])}
    rings = []
    for i, f in enumerate(g["features"]):
        for ring in outer_rings(f["geometry"]):
            xs, ys = to_utm.transform([c[0] for c in ring], [c[1] for c in ring])
            h = heights.get(i) or (f.get("properties") or {}).get("bHeight") or 12.0
            rings.append((i, float(h), list(zip(xs, ys))))
    if not rings:
        return None
    allx = [p[0] for r in rings for p in r[2]]
    ally = [p[1] for r in rings for p in r[2]]
    o = [int(math.floor(min(allx))) - 200, int(math.floor(min(ally))) - 200]
    X0, X1, Y0, Y1 = min(allx) - 300, max(allx) + 300, min(ally) - 300, max(ally) + 300
    lay = {"d": d, "v": 1, "crs": "EPSG:32640 minus o", "o": o,
           "b": [[i, round(h, 1), flat(simplify(r), o)] for i, h, r in rings], "s": [], "rp": [], "lab": [],
           "src": "Footprints and streets: OpenStreetMap contributors (district model); heights: anchors_%s fps, else the "
                  "footprint's bHeight, else 12 m" % d}
    sp = os.path.join(base, "streets.geojson")
    if os.path.exists(sp):
        best = {}
        for f in json.load(open(sp, encoding="utf-8"))["features"]:
            hw = (f.get("properties") or {}).get("hw")
            if hw not in CLS or f["geometry"]["type"] != "LineString":
                continue
            c = f["geometry"]["coordinates"]
            xs, ys = to_utm.transform([p[0] for p in c], [p[1] for p in c])
            pts = list(zip(xs, ys))
            if all(not (X0 < x < X1 and Y0 < y < Y1) for x, y in pts):
                continue
            lay["s"].append([CLS.index(hw), flat(simplify(pts, 2.0), o)])
            nm = (f.get("properties") or {}).get("nm") or ""
            if nm and hw in LABEL_CLASSES:
                L = math.dist(pts[0], pts[-1])
                if nm not in best or L > best[nm][0]:
                    best[nm] = (L, pts)
        for nm, (L, pts) in sorted(best.items(), key=lambda kv: -kv[1][0])[:5]:
            lay["lab"].append([nm, flat([pts[0], pts[len(pts) // 2], pts[-1]], o)])
    else:
        cp = os.path.join(base, "ctx.json")
        if os.path.exists(cp):
            for poly in json.load(open(cp, encoding="utf-8")).get("roads", []):
                ring = poly[0]                         # ctx.json is already UTM 40N with y as -northing (the twin's z)
                pts = [(x, -z) if z < 0 else (x, z) for x, z in ring]
                if all(not (X0 < x < X1 and Y0 < y < Y1) for x, y in pts):
                    continue
                lay["rp"].append(flat(simplify(pts, 2.0), o))
    # lon/lat -> local metres over the district's own footprints (used only to drop an approximate pin)
    lons, lats, xs, ys = [], [], [], []
    for f in g["features"][::max(1, len(g["features"]) // 400)]:
        for ring in outer_rings(f["geometry"]):
            lo, la = ring[0][0], ring[0][1]
            x, y = to_utm.transform(lo, la)
            lons.append(lo); lats.append(la); xs.append(x - o[0]); ys.append(y - o[1])
    # the tangent of the projection at the district's centre (exact at the centre; the worst error over the district is printed)
    lo0, la0 = sum(lons) / len(lons), sum(lats) / len(lats)
    x0, y0 = to_utm.transform(lo0, la0)
    xe, ye = to_utm.transform(lo0 + 0.01, la0)
    xn, yn = to_utm.transform(lo0, la0 + 0.01)
    a, b, d_, e = (xe - x0) / 0.01, (xn - x0) / 0.01, (ye - y0) / 0.01, (yn - y0) / 0.01
    ax = [a, b, x0 - o[0] - a * lo0 - b * la0]
    ay = [d_, e, y0 - o[1] - d_ * lo0 - e * la0]
    err = max(math.hypot(ax[0] * lo + ax[1] * la + ax[2] - x, ay[0] * lo + ay[1] * la + ay[2] - y)
              for lo, la, x, y in zip(lons, lats, xs, ys))
    lay["ll"] = [round(v, 4) for v in ax + ay]
    lay["ll_err_m"] = round(err, 2)
    return lay


def push(name, obj, tok):
    raw = json.dumps(obj, separators=(",", ":")).encode()
    body = json.dumps({"imageName": name, "image": base64.b64encode(raw).decode(), "contentType": "application/json"}).encode()
    req = urllib.request.Request(WORKER + "/ingest_market", data=body, method="POST",
                                 headers={"X-Azimuth-Ingest": tok, "Content-Type": "application/json",
                                          "User-Agent": "najma-market-pulse/1.0"})
    return json.load(urllib.request.urlopen(req, timeout=900))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--district", nargs="*")
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--push", action="store_true")
    a = ap.parse_args()
    ds = a.district or sorted(os.path.basename(os.path.dirname(p)) for p in glob.glob(os.path.join(DATA, "ce", "*", "buildings.geojson"))
                              if not os.path.basename(os.path.dirname(p)).startswith("_"))
    tok = env_token("INGEST_TOKEN") if a.push else None
    if a.push and not tok:
        sys.exit("--push needs INGEST_TOKEN")
    os.makedirs(a.out, exist_ok=True)
    total = 0
    for d in ds:
        try:
            lay = build(d)
        except Exception as ex:                  # one district's bad file never stops the others
            print("%-28s FAILED: %s" % (d, ex))
            continue
        if not lay:
            print("%-28s no footprints - skipped" % d)
            continue
        raw = json.dumps(lay, separators=(",", ":"))
        name = "brief_fp_" + d
        if len(name) > 40:
            print("%-28s key %s is over the 40-character ingest cap - skipped" % (d, name))
            continue
        open(os.path.join(a.out, name + ".json"), "w", encoding="utf-8").write(raw)
        total += len(raw)
        print("%-28s %5d footprints  %4d streets  %3d road polys  %d labels  %7.0f KB  lonlat fit %.2f m%s"
              % (d, len(lay["b"]), len(lay["s"]), len(lay["rp"]), len(lay["lab"]), len(raw) / 1024, lay["ll_err_m"],
                 "" if len(raw) < 5 * 1024 * 1024 else "  OVER 5 MB - will be refused"))
        if a.push and len(raw) < 5 * 1024 * 1024:
            print("   pushed", push(name, lay, tok))
    print("total %.1f MB in %s%s" % (total / 1048576, os.path.abspath(a.out), "" if a.push else "  (dry run - nothing pushed)"))


if __name__ == "__main__":
    main()
