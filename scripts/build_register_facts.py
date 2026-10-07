"""v386 - REGISTER FACTS per register project number, for the developer index (scripts/build_devmap_index.mjs --regfacts <file>).
Offline, deterministic, read-only on its inputs. Writes ONE file (default data/regfacts/register_facts.json):
  {"meta": {...}, "p": {"<project number>": {"st": status, "pc": percent complete, "pe": planned end date, "u": registered units, "mix": [studio, 1, 2, 3, 4+], "pl": registered land parcels}}}
Sources (the ones the 7 Oct card audit used):
  --csv    docs/CONSTRUCTION_VIEW_DUBAI_projects.csv   Dubai Land Department project register: status, percent completed, end date, registered units
  --types  data/dld/project_types.json                 Dubai Land Department unit files: units by bedrooms per project number
  --land   data/board                                  land_registry_<district>.json: registered land parcels per project (project_id, then project name inside the project's own district file)
UNKNOWN STAYS ABSENT: a field with no source is not written (no placeholder, no zero, no empty string).
  mix = [studio, 1 bed, 2 bed, 3 bed, 4+ bed] counts of units whose bedrooms the register states; written only when at least one unit has them.
  pl  = the number of distinct registered land parcels the register ties to the project. 0 is written ONLY when the project sits in a district whose land registry file we hold and no parcel
        is tied to it; a project in a district we hold no land registry for gets no pl at all.
Run:  python scripts/build_register_facts.py [--csv ...] [--types ...] [--land ...] [--out ...]"""
import argparse, csv, glob, json, os, re, sys

NMP = r"C:\Dev\naj-market-pulse"
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)


def pkey(n):
    s = str(n or "").lower()
    s = re.sub(r"\s+by\s+.*$", "", s)
    return re.sub(r"[^a-z0-9\u0600-\u06ff]+", "", s)


def akey(n):
    return re.sub(r"[^a-z0-9]+", "", str(n or "").lower())


def num(x):
    try:
        f = float(str(x).strip())
        return f
    except Exception:
        return None


BED = {"studio": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 4, "6+": 4}


def build(csv_path, types_path, land_dir):
    rows = list(csv.DictReader(open(csv_path, encoding="utf-8-sig", errors="replace")))
    types = json.load(open(types_path, encoding="utf-8")) if types_path and os.path.exists(types_path) else {"rows": []}
    mix, tu = {}, {}
    for r in types.get("rows", []):
        p = str(r.get("project_number") or "").strip()
        if not p:
            continue
        n = int(r.get("units") or 0)
        tu[p] = tu.get(p, 0) + n
        b = BED.get(str(r.get("bedrooms") if r.get("bedrooms") is not None else "").strip().lower())
        if b is None or n <= 0:
            continue
        mix.setdefault(p, [0, 0, 0, 0, 0])[b] += n
    # land registry: parcels per project id, and per (area, project name key) for plots that carry a name but a different/blank id
    byid, byname, covered = {}, {}, set()
    for f in sorted(glob.glob(os.path.join(land_dir, "land_registry_*.json"))):
        try:
            d = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        ak = akey(d.get("area"))
        covered.add(ak)
        for pl in d.get("plots", []):
            pid = str(pl.get("parcel_id") or "").split(".")[0]
            if not pid:
                continue
            if pl.get("project_id"):
                byid.setdefault(str(pl["project_id"]).split(".")[0], set()).add(pid)
            if pl.get("project_name_en"):
                byname.setdefault((ak, pkey(pl["project_name_en"])), set()).add(pid)
    out = {}
    for r in rows:
        p = str(r.get("project_number") or "").strip()
        if not p:
            continue
        o = {}
        st = (r.get("project_status") or "").strip()
        if st:
            o["st"] = st
        pc = num(r.get("percent_completed"))
        if pc is not None and 0 <= pc <= 100:
            o["pc"] = int(round(pc))
        pe = (r.get("project_end_date") or "").strip()[:10]
        if re.match(r"^\d{4}-\d{2}-\d{2}$", pe):
            o["pe"] = pe
        u = num(r.get("units_register"))
        u = int(u) if u and u > 0 else None
        if u is None:
            u = int(num(r.get("reg_units")) or 0) or None
        if u is None and tu.get(p):
            u = tu[p]
        if u:
            o["u"] = u
        if p in mix and sum(mix[p]) > 0:
            o["mix"] = mix[p]
        ak = akey(r.get("district"))
        ps = set(byid.get(str(r.get("project_id") or "").strip(), set()))
        if ak in covered:
            ps |= byname.get((ak, pkey(r.get("project_name"))), set())
        if ps:
            o["pl"] = len(ps)
        elif ak in covered:
            o["pl"] = 0
        if o:
            out[p] = o
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default=os.path.join(NMP, "docs", "CONSTRUCTION_VIEW_DUBAI_projects.csv"))
    ap.add_argument("--types", default=os.path.join(NMP, "data", "dld", "project_types.json"))
    ap.add_argument("--land", default=os.path.join(NMP, "data", "board"))
    ap.add_argument("--out", default=os.path.join(REPO, "data", "regfacts", "register_facts.json"))
    a = ap.parse_args()
    p = build(a.csv, a.types, a.land)
    meta = {"source": "Dubai Land Department project register, unit files and land registry (7 Oct 2026 card audit sources)",
            "layout": "p[project number] = {st register status, pc percent complete, pe planned end date, u registered units, mix [studio,1,2,3,4+] units with a stated bedroom count, pl registered land parcels}; a missing key means not known",
            "projects": len(p), "count": {k: sum(1 for v in p.values() if k in v) for k in ("st", "pc", "pe", "u", "mix", "pl")}}
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8", newline="\n") as f:
        json.dump({"meta": meta, "p": p}, f, separators=(",", ":"), sort_keys=True)
    print("projects", len(p), "bytes", os.path.getsize(a.out), meta["count"])


if __name__ == "__main__":
    main()
