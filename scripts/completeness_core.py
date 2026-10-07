"""COMPLETENESS CORE (v393): the one place that decides, for a registered project, whether each product SURFACE shows it.
Shared by scripts/check_completeness.py (the gate) and the audit builder (naj-market-pulse/docs/COMPLETENESS_AUDIT_07OCT2026/), so the two cannot disagree.

Read-only. The live store is read through the public /img/<name> route (no key needed); nothing is ever written to it.

SURFACES (a project is "on" a surface when the live data of that surface holds it, by register project number first, then by name):
  S1  map footprint      a named footprint in blocks_<district> whose name is the project's, or a footprint BOUND to the register (building key bk, reg_bindings property id)
  S2p Najma plots layer  a feature of KV plots (by parcel, register building id or name)
  S2s search list        the search index the Najma search uses (KV search_index: developers, developments, buildings)
  S3  developer page     a project card in devmap_index (b / bx all-years, b12 / b12x last-12-months), by register project number first
  S4  position ladder    building outline > plot centre (KV plot_positions, by parcel) > community centre (KV community_positions, by project number)
  S5  building page      a card with a building key bk, or a register-bound footprint (/building/<district>/<id> exists)
  S6  Brief + search     the Brief's candidate lists: KV map_prices, buy_extra, rent_index
  S7  investor facts     KV investor_tiers_index (one record per register project)
  S8  unit-mix card      a priced, non-placeholder card in unitmix_<district>
CAUSE CODES for a miss: 1 filtered by a sales requirement; 2 not on the project-register extract we hold (date lag); 3 no developer resolved;
  4 no footprint / name mismatch; 5 area not matched to a community; 6 dropped by a rule (attribution displacement, size or evidence limit); 7 never built into that surface; 8 other.
"""
import gzip, json, os, re, sys, time, unicodedata, urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://azimuth-2.digitalchemy.workers.dev/img/"
UA = {"User-Agent": "najma-ops/1.0"}
SURFACES = ["S1", "S2p", "S2s", "S3", "S4", "S5", "S6", "S7", "S8"]
SURFACE_LABEL = {"S1": "map footprint", "S2p": "Najma plots layer", "S2s": "search list", "S3": "developer page card", "S4": "position (any level)",
                 "S5": "building page", "S6": "Brief + search", "S7": "investor facts", "S8": "unit-mix card"}
CAUSE_LABEL = {1: "filtered by a sales requirement", 2: "not on the project-register extract we hold", 3: "no developer resolved", 4: "no footprint / name mismatch",
               5: "area not matched to a community", 6: "dropped by a rule (attribution displacement, size or evidence limit)", 7: "never built into that surface", 8: "other"}
STOP = re.compile(r"\b(towers?|residences?|residence|building|bldg|apartments?)\b")


# ------------------------------------------------------------------ name keys (the same in the audit builder)
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


class NameIndex:
    """name -> payloads. find() returns (kind, payloads): 'exact' on the full key, else 'loose' on the core key (6+ characters)."""
    def __init__(self):
        self.full, self.core = {}, {}

    def add(self, name, payload=None):
        f, c = nk_full(name), nk_core(name)
        if f:
            self.full.setdefault(f, []).append(payload)
        if c and len(c) >= 6:
            self.core.setdefault(c, []).append(payload)

    def find(self, names, accept=None):
        loose = []
        for n in names:
            f = nk_full(n)
            if f and f in self.full:
                hit = [p for p in self.full[f] if accept is None or accept(p)]
                if hit:
                    return "exact", hit
        for n in names:
            c = nk_core(n)
            if c and len(c) >= 6 and c in self.core:
                hit = [p for p in self.core[c] if accept is None or accept(p)]
                if hit:
                    loose = hit
                    break
        return ("loose", loose) if loose else ("", [])


# ------------------------------------------------------------------ the live store, read-only, through /img
def kv_get(name, cache=None, max_age=900, retries=3):
    p = os.path.join(cache, name + ".json") if cache else None
    if p and os.path.exists(p) and time.time() - os.path.getmtime(p) < max_age:
        return json.load(open(p, encoding="utf-8"))
    last = None
    for k in range(retries):
        try:
            b = urllib.request.urlopen(urllib.request.Request(BASE + name, headers=UA), timeout=120).read()
            if b[:2] == b"\x1f\x8b":
                b = gzip.decompress(b)
            if p:
                os.makedirs(cache, exist_ok=True)
                open(p, "wb").write(b)
            return json.loads(b)
        except Exception as e:
            last = e
            if getattr(e, "code", None) == 404:
                return None
            time.sleep(1 + k)
    raise RuntimeError("could not read %s from the live store: %s" % (name, last))


def load_live(cache=None, max_age=900, fast=False, workers=8):
    """The nine surfaces' data. fast=True skips the per-district footprint and unit-mix files (S1 named-footprint and S8 are then reported as not measured)."""
    base = ["devmap_index", "search_index", "plots", "plot_positions", "community_positions", "investor_tiers_index", "map_prices", "buy_extra", "rent_index", "districts_geo"]
    with ThreadPoolExecutor(workers) as ex:
        kv = dict(zip(base, ex.map(lambda n: kv_get(n, cache, max_age), base)))
    slugs = sorted(set(list((kv["devmap_index"] or {}).get("areas", {}))) | {d["slug"] for d in (kv["districts_geo"] or {}).get("districts", [])})
    kv["_slugs"] = slugs
    if not fast:
        names = ["unitmix_" + s for s in slugs] + ["blocks_" + s for s in slugs]
        with ThreadPoolExecutor(workers) as ex:
            for n, v in zip(names, ex.map(lambda n: kv_get(n, cache, max_age), names)):
                kv[n] = v
    kv["_fast"] = bool(fast)
    return kv


def local_bindings(repo=r"C:\Dev\naj-market-pulse"):
    p = os.path.join(repo, "data", "identity", "official", "dld", "reg_bindings.json")
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return {}


# ------------------------------------------------------------------ surfaces -> lookup structures
def build_surfaces(kv):
    S = {"cardP": {}, "cards": NameIndex(), "inv_pn": set(), "inv_names": NameIndex(), "search": NameIndex(), "plots_names": NameIndex(), "plots_parcels": set(),
         "plots_pid": set(), "pos_parcels": set(), "cpos_pn": set(), "cpos_names": [], "brief": NameIndex(), "blocks": NameIndex(), "um": NameIndex(), "um_prop": set(), "um_prop_any": set(),
         "devs": {}, "fast": kv.get("_fast")}
    dm = kv["devmap_index"]
    for slug, A in dm["areas"].items():
        for dk, d in A["devs"].items():
            S["devs"][dk] = d.get("n") or dk
            for lst, lx in (("b", "bx"), ("b12", "b12x")):
                for i, x in enumerate(d.get(lst) or []):
                    ev = (d.get(lx) or [])
                    e = ev[i] if i < len(ev) and isinstance(ev[i], dict) else {}
                    rec = {"area": slug, "dev": dk, "lst": lst, "name": x[2], "e": e.get("e", ""), "bk": e.get("bk", ""), "p": e.get("p"), "n": x[0]}
                    if e.get("p") not in (None, ""):
                        S["cardP"].setdefault(str(e["p"]), []).append(rec)
                    S["cards"].add(x[2], rec)
    # the "registered, no sales yet" group (v392 nosales.json) once it is published or built: a list of {p, n} (or {project_number, name}); passed with --nosales
    for it in kv.get("_nosales") or []:
        p = it.get("p", it.get("project_number")); nm = it.get("n", it.get("name", ""))
        rec = {"area": it.get("d", ""), "dev": it.get("dev", "nosales"), "lst": "nosales", "name": nm, "e": "REGISTER_VERIFIED", "bk": it.get("bk", ""), "p": p, "n": 0}
        if p not in (None, ""):
            S["cardP"].setdefault(str(p), []).append(rec)
        if nm:
            S["cards"].add(nm, rec)
    for it in (kv["investor_tiers_index"] or {}).get("projects", []):
        if it.get("project_number") not in (None, ""):
            S["inv_pn"].add(str(it["project_number"]))
        else:
            S["inv_names"].add(it.get("brand_name") or it.get("name"), it)
            S["inv_names"].add(it.get("name"), it)
    for it in (kv["search_index"] or {}).get("items", []):
        S["search"].add(it.get("n"), {"t": it.get("t"), "d": it.get("d"), "i": it.get("i")})
    for f in (kv["plots"] or {}).get("features", []):
        pr = f.get("properties", {})
        S["plots_names"].add(pr.get("name"), pr)
        if pr.get("parcel"):
            S["plots_parcels"].add(str(int(float(pr["parcel"]))))
        if pr.get("pid"):
            S["plots_pid"].add(str(pr["pid"]))
    for v in ((kv["plot_positions"] or {}).get("p") or {}).values():
        for q in v.get("parcels") or []:
            S["pos_parcels"].add(str(q))
    cp = kv["community_positions"] or {}
    for v in (cp.get("p") or {}).values():
        if v.get("pn") not in (None, ""):
            S["cpos_pn"].add(str(v["pn"]))
    S["cpos_names"] = [nk_full(v.get("n")) for v in (cp.get("c") or {}).values()]
    for it in (kv["map_prices"] or {}).get("items", []) + ((kv["buy_extra"] or {}).get("items") or []) + ((kv["rent_index"] or {}).get("items") or []):
        S["brief"].add(it.get("n"), {"d": it.get("d"), "i": it.get("i")})
    for s in kv["_slugs"]:
        b = kv.get("blocks_" + s)
        for f in (b or {}).get("features", []):
            pr = f.get("properties", {})
            if pr.get("k") == "b" and pr.get("n"):
                S["blocks"].add(pr["n"], (s, pr.get("i")))
        u = ((kv.get("unitmix_" + s) or {}).get("buildings_by_id")) or {}
        for i, c in u.items():
            priced = any(r.get("median_aed") for r in (c.get("rows") or []))
            pay = {"d": s, "i": i, "status": c.get("status"), "priced": bool(priced), "syn": bool(c.get("synthetic"))}
            for n in (c.get("name"), (c.get("dld") or {}).get("project"), (c.get("dld_sales") or {}).get("project")):
                if n:
                    S["um"].add(n, pay)
            if (c.get("dld") or {}).get("property_id"):
                S["um_prop_any"].add(str(c["dld"]["property_id"]))
                if priced and c.get("status") != "placeholder":
                    S["um_prop"].add(str(c["dld"]["property_id"]))
    return S


# ------------------------------------------------------------------ the per-project verdict
def project_flags(r, S, reg_bound):
    """r: one universe row (dict of strings). Returns flags per surface (+ how), the developer shown, the miss causes and the findability."""
    names = [r["name"]] + [a for a in (r.get("name_alt") or "").split("|") if a]
    pn = str(r.get("project_number") or "")
    parcels = [q for q in (r.get("parcels") or "").split(";") if q]
    props = [q for q in (r.get("reg_bound_props") or "").split(";") if q]
    sales = int(float(r.get("sales_all") or 0))
    in_lake = str(r.get("source", "")).startswith("register_extract")
    F, HOW, CAUSE = {}, {}, {}

    def okp(rec):                                    # a card with a different register project number is a different project
        return rec.get("p") in (None, "") or str(rec.get("p")) == pn

    # S3
    shown = None
    if pn and pn in S["cardP"]:
        F["S3"], HOW["S3"] = 1, "p"; shown = S["cardP"][pn]
    else:
        k, hit = S["cards"].find(names, okp)
        F["S3"], HOW["S3"] = (1, k) if hit else (0, ""); shown = hit or None
    # S8
    k, hit = S["um"].find(names, lambda p: p["priced"] and p["status"] != "placeholder")
    f8 = 1 if (hit or any(p in S["um_prop"] for p in props)) else 0
    F["S8"], HOW["S8"] = f8, (k or ("property" if f8 else ""))
    has_priced_card = bool(f8)
    # S1 / S5
    bound = bool(props) or any(x.get("bk") for x in (S["cardP"].get(pn) or []))
    kb, hb = S["blocks"].find(names) if not S["fast"] else ("", [])
    F["S1"], HOW["S1"] = (1, "bound") if bound else ((1, "named-" + kb) if hb else (0, ""))
    F["S5"], HOW["S5"] = (1, "bound") if bound else (0, "")
    # S2
    k, hit = S["search"].find(names)
    F["S2s"], HOW["S2s"] = (1, k) if hit else (0, "")
    k, hit = S["plots_names"].find(names)
    byparcel = any(q in S["plots_parcels"] for q in parcels)
    F["S2p"], HOW["S2p"] = (1, "parcel" if byparcel else k) if (hit or byparcel) else (0, "")
    # S4
    lvl = ""
    if F["S1"]:
        lvl = "building"
    elif any(q in S["pos_parcels"] for q in parcels):
        lvl = "plot centre"
    elif pn and pn in S["cpos_pn"]:
        lvl = "community centre"
    F["S4"], HOW["S4"] = (1 if lvl else 0), lvl
    # S6
    k, hit = S["brief"].find(names)
    F["S6"], HOW["S6"] = (1, k) if hit else (0, "")
    # S7
    if pn and pn in S["inv_pn"]:
        F["S7"], HOW["S7"] = 1, "p"
    else:
        k, hit = S["inv_names"].find(names)
        F["S7"], HOW["S7"] = (1, k) if (hit and not pn) else (0, "")
    has_sales = sales > 0 or has_priced_card
    comm_matched = any(c and (c in nk_full(r.get("area", "")) or c in nk_full(r.get("master", "")) or nk_full(r.get("master", "")) in c) for c in S["cpos_names"] if c)
    # causes
    def cz(sf):
        if F[sf]:
            return 0
        if sf == "S3":
            return 2 if not in_lake else 1 if not has_sales else 6 if has_priced_card else 4
        if sf == "S7":
            return 2 if not in_lake else 7
        if sf == "S2s":
            return 1 if not has_sales else 2 if not in_lake else 7
        if sf == "S2p":
            return 8 if not parcels else 4
        if sf == "S4":
            return 5 if not comm_matched else 4
        if sf == "S6":
            return 1 if not has_sales else (6 if has_priced_card else 4)
        if sf == "S8":
            return 1 if not has_sales else 4
        return 4                                      # S1, S5
    for sf in SURFACES:
        CAUSE[sf] = cz(sf)
    found_strict = any(F[x] for x in ("S1", "S2p", "S2s", "S3", "S6", "S7", "S8"))
    found_loose = found_strict or F["S4"]
    found_client = any(F[x] for x in ("S1", "S2p", "S2s", "S3", "S6"))   # reachable by a client without an internal link: map, plots, search, developer page, Brief
    # the developer the page shows for it, and whether it agrees with the register's
    dev_shown = ""; dev_mismatch = 0; weak = 0
    if shown:
        devs = sorted({x["dev"] for x in shown})
        dev_shown = ",".join(devs)
        canon = r.get("developer_canon") or ""
        real = [d for d in devs if d != "_"]
        if devs == ["_"]:
            weak = 1
        if canon and real and canon not in real:
            dev_mismatch = 1
    overall = 0
    if not found_strict:
        overall = 2 if not in_lake and not has_sales else 1 if not has_sales else CAUSE["S3"] if CAUSE["S3"] else 8
        if not in_lake and has_sales:
            overall = 2
    return dict(F=F, HOW=HOW, CAUSE=CAUSE, found_strict=int(found_strict), found_loose=int(bool(found_loose)), found_client=int(found_client), dev_shown=dev_shown, dev_mismatch=dev_mismatch,
                weak=weak, level=lvl, overall_cause=overall, has_sales=int(has_sales), in_lake=int(in_lake))


def coverage(rows, flags, base=lambda r: True):
    """-> {surface: (n_on, n_base)}, plus unfindable counts. rows and flags are parallel lists."""
    out = {s: [0, 0] for s in SURFACES}
    un_s = un_l = un_c = n = 0
    for r, f in zip(rows, flags):
        if not base(r):
            continue
        n += 1
        for s in SURFACES:
            out[s][1] += 1
            out[s][0] += f["F"][s]
        un_s += 1 - f["found_strict"]
        un_l += 1 - f["found_loose"]
        un_c += 1 - f["found_client"]
    return {"n": n, "surfaces": {s: tuple(v) for s, v in out.items()}, "unfindable_strict": un_s, "unfindable_loose": un_l, "unfindable_client": un_c}


# ------------------------------------------------------------------ the named fixtures
FIXTURES = [
    # name, must appear on (surface ids), register developer canonical id it must sit under on the developer page (or None), ids it must NOT sit under, how to find it (project number or None), names to look for
    {"id": "kore", "name": "KORE by Imtiaz", "pn": None, "names": ["KORE by Imtiaz"], "must": ["S3", "S2s", "S7", "S2p"], "dev": "imtiaz", "not_dev": []},
    {"id": "archive", "name": "The Archive by Imtiaz", "pn": "3781", "names": ["The Archive by Imtiaz", "THE ARCHIVE BY IMTIAZ"], "must": ["S3", "S2s", "S7", "S2p"], "dev": "imtiaz", "not_dev": []},
    {"id": "chelsea1", "name": "Chelsea Residences by DAMAC", "pn": "3719", "names": ["Chelsea Residences by DAMAC"], "must": ["S3", "S2s", "S7"], "dev": "damac", "not_dev": []},
    {"id": "chelsea2", "name": "Chelsea Residences 2 by DAMAC", "pn": "3743", "names": ["Chelsea Residences 2 by DAMAC"], "must": ["S3", "S2s", "S7"], "dev": "damac", "not_dev": []},
    {"id": "harbour", "name": "Harbour Lights", "pn": "2516", "names": ["Harbour Lights"], "must": ["S3", "S2s", "S7"], "dev": "damac", "not_dev": []},
    {"id": "coral", "name": "Coral Reef", "pn": "2729", "names": ["Coral Reef"], "must": ["S3", "S2s", "S7"], "dev": "damac", "not_dev": []},
    {"id": "covegrand", "name": "Cove Grand Residence by Imtiaz", "pn": "3774", "names": ["Cove Grand Residence by Imtiaz"], "must": ["S3", "S2s", "S7"], "dev": "imtiaz", "not_dev": []},
    {"id": "uppercrest", "name": "Upper Crest (DAMAC)", "pn": "300", "names": ["Upper Crest", "UPPER CREST"], "must": ["S3", "S2s", "S7", "S2p"], "dev": "damac", "not_dev": []},
    {"id": "vento", "name": "Vento Tower", "pn": "2776", "names": ["Vento Tower", "VENTO TOWER"], "must": ["S3", "S2s", "S7", "S2p"], "dev": "anax-developments", "not_dev": ["beyond"]},
]


def check_fixtures(S, kv, fixtures=None):
    res = []
    for fx in (fixtures or FIXTURES):
        pn = fx.get("pn"); names = fx["names"]
        row = {"project_number": pn or "", "name": fx["name"], "name_alt": "|".join(names[1:]), "parcels": "", "reg_bound_props": "", "sales_all": 1, "source": "register_extract_fixture", "area": "", "master": ""}
        # the fixture is found by its register project number where it has one; a project with no number (KORE) by name only
        f = project_flags(row, S, {})
        got = {}
        for sf in fx["must"]:
            got[sf] = bool(f["F"][sf])
        # developer-page placement, read from the cards that carry its project number (or exact name when it has none)
        recs = list(S["cardP"].get(pn, [])) if pn else []
        if not recs:
            k, hit = S["cards"].find(names, lambda p: p.get("p") in (None, "") or str(p.get("p")) == (pn or ""))
            recs = hit if k == "exact" else []
        devs = sorted({x["dev"] for x in recs})
        dev_ok = True; why = []
        if "S3" in fx["must"]:
            if not recs:
                dev_ok = False; why.append("no card on the developer page")
            elif fx.get("dev") and fx["dev"] not in devs:
                dev_ok = False; why.append("card sits under %s, not under %s" % (",".join(devs) or "nothing", fx["dev"]))
            bad = [d for d in devs if d in fx.get("not_dev", [])]
            if bad:
                dev_ok = False; why.append("card sits under forbidden developer " + ",".join(bad))
        miss = [sf for sf, ok in got.items() if not ok]
        res.append({"id": fx["id"], "name": fx["name"], "ok": (not miss) and dev_ok, "missing": miss, "devs": devs, "why": why, "how": f["HOW"]})
    return res
