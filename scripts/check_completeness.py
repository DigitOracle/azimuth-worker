"""COMPLETENESS GATE (v393, v397g). "If it is in a government register it must be findable in the product, with an honest label for what we do and do not know."
Kendall, 7 Oct 2026 (KORE by Imtiaz and The Archive by Imtiaz were not on the developer page: that page built cards only from projects with settled sales).

  python scripts/check_completeness.py                  the gate: exit 0 = pass, exit 1 = fail (any named fixture missing from a surface where it must appear; any surface's coverage of register
                                                        projects below its threshold in scripts/completeness_gate.json; the count of unfindable entities above the stored baseline)
  python scripts/check_completeness.py --baseline-update    re-measure and write the thresholds (measured minus 1 point) and the unfindable baselines into the config. Never run it to hide a failing fixture.
  python scripts/check_completeness.py --self-test          the NEGATIVE CONTROL: corrupts a copy of the data (drops named fixtures from the index and from every layer, and a share of cards) and demands that the gate FAILS on it.
  options: --index <devmap_index.json>   gate a freshly built index BEFORE it is published (the other surfaces still read live)
           --plots <file> --plot-positions <file> --community-positions <file>   the same for the plot publishes (any may be omitted)

  v397g - EVERY SURFACE LAYER. Each is optional: absent = skipped and reported "layer not published", so the gate runs both before and after the v397 publish. With no flag a layer is read from the live /img route
  (a 404 = not published; the owner key in the listener .env is used only when a route answers 401, and is never printed). A local file replaces the live value for that layer:
           --nosales <nosales.json>             S1/S3 developer page: the "registered, no sales yet" group (KV img_devmap_nosales)
           --notconf <notconf.json>             S1/S3 developer page: "not confirmed by the register" (KV img_devmap_notconf)
           --announced <announced.json>         S3 developer page: developer-announced projects (KV img_devmap_announced); register coverage never counts them, a fixture may
           --search-extra-dir <dir>             S2 search: <dir>/search_extra.json (+ the district parts its "parts" names, search_extra_<d>.json) and <dir>/announced_search.json
           --announced-search <file>            S2 search: img_search_extra_announced (overrides the one in --search-extra-dir)
           --community-positions-p <file>       S4 position: community centres by register project number ("p:<number>", KV img_community_positions_p)
           --require-layers                     a fixture whose layer is not published FAILS instead of being skipped (use it after the publish, to verify it)
           --fast       skip the per-district footprint and unit-mix files (S1 named-footprint and S8 are then not measured; about 15 s instead of about 60 s)
           --cache <dir> --max-age <s>   keep the live reads (default 900 s)    --audit-csv <file>   the audit trail (appended; default scripts/completeness_audit_trail.csv)
           --universe <csv> --config <json>

READ-ONLY: reads the live store through the public /img/<name> route. Writes only the audit-trail CSV (and, with --baseline-update, the config). Never writes KV, never deploys.
Publishing is guarded by scripts/gate_guard.py (the hard stop wired into every publish script).
The universe (scripts/completeness_universe.csv) is the frozen list of register projects (3,039 on the 15 Jun 2026 extract, 267 newer from the 1 Sep delta, 323 named only by sales, 286 named only by the
building register); rebuild it with naj-market-pulse/docs/COMPLETENESS_AUDIT_07OCT2026/build_universe.py when a fresh register pull lands (--rebuild-universe prints the exact commands).
"""
import argparse, copy, csv, datetime, json, os, random, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import completeness_core as C

DEF_CONFIG = os.path.join(HERE, "completeness_gate.json")
DEF_UNIVERSE = os.path.join(HERE, "completeness_universe.csv")
DEF_AUDIT = os.path.join(HERE, "completeness_audit_trail.csv")
BASE_SOURCES = ("register_extract", "register_delta")      # the projects a project-register file holds: coverage is measured on these
MEASURE = ["S1", "S2p", "S2s", "S3", "S4", "S5", "S6", "S7", "S8"]
csv.field_size_limit(10 ** 9)


def load_universe(p):
    return list(csv.DictReader(open(p, encoding="utf-8-sig")))


def _jload(p):
    return json.load(open(p, encoding="utf-8"))


def apply_overrides(kv, a):
    """Replace live values by candidate local files. Works on any object with the option attributes (argparse namespace or the guard's)."""
    g = lambda n: getattr(a, n, None)
    src = kv.setdefault("_layer_src", {})
    for n in C.LAYER_KEYS:
        src.setdefault(n, ("live", None))
    if g("nosales"):
        src["nosales"] = ("local", _jload(g("nosales")))
    if g("notconf"):
        src["notconf"] = ("local", _jload(g("notconf")))
    if g("announced"):
        src["announced"] = ("local", _jload(g("announced")))
    d = g("search_extra_dir")
    if d:
        mp = os.path.join(d, "search_extra.json")
        if os.path.exists(mp):
            se = _jload(mp)
            if se.get("parts"):
                sx, miss = list(se.get("sx") or []), []
                for dd in sorted(se["parts"]):
                    pp = os.path.join(d, "search_extra_%s.json" % dd)
                    if os.path.exists(pp):
                        sx += _jload(pp).get("sx") or []
                    else:
                        miss.append(dd)
                se = dict(se, sx=sx, _missing_parts=miss)
            src["search_extra"] = ("local", se)
        ap_ = os.path.join(d, "announced_search.json")
        if os.path.exists(ap_) and not g("announced_search"):
            src["search_extra_announced"] = ("local", _jload(ap_))
    if g("announced_search"):
        src["search_extra_announced"] = ("local", _jload(g("announced_search")))
    if g("community_positions_p"):
        src["community_positions_p"] = ("local", _jload(g("community_positions_p")))
    if g("index"):
        kv["devmap_index"] = _jload(g("index"))
    if g("plots"):
        kv["plots"] = _jload(g("plots"))
    if g("plot_positions"):
        kv["plot_positions"] = _jload(g("plot_positions"))
    if g("community_positions"):
        kv["community_positions"] = _jload(g("community_positions"))


def _drop_names(obj, names):
    """Deep-copy a layer and remove every entry whose name is in `names` (lower case)."""
    o = copy.deepcopy(obj)
    low = lambda x: str(x or "").lower()
    if isinstance(o, dict) and isinstance(o.get("d"), dict):
        for dev in list(o["d"]):
            for dist in list(o["d"][dev]):
                o["d"][dev][dist] = [e for e in o["d"][dev][dist] if low(e.get("n")) not in names]
    if isinstance(o, dict):
        if isinstance(o.get("features"), list):
            o["features"] = [f for f in o["features"] if low((f.get("properties") or {}).get("name")) not in names]
        if isinstance(o.get("sx"), list):
            o["sx"] = [x for x in o["sx"] if low(x.get("n")) not in names]
        if isinstance(o.get("items"), list):
            o["items"] = [x for x in o["items"] if low(x.get("n")) not in names]
    return o


# fixtures the negative control removes from the layers (lower-case names), and the fixture ids that must then FAIL if they passed on the clean data
CORRUPT_NAMES = {"kore by imtiaz", "the archive by imtiaz", "burj azizi", "trump tower", "tamani arts offices", "sobha sanctuary", "elegant tower"}
CORRUPT_IDS = ["kore", "archive", "burjazizi", "trumptower", "tamaniarts", "sobhasanctuary", "cposp100"]


def corrupt(kv, seed=393):
    """The negative control's damage, on copies of the data only: remove the cards of two named fixtures, the search hit of one, 15% of every other card, and the named fixtures from every layer."""
    kv = dict(kv)
    dm = copy.deepcopy(kv["devmap_index"]); rnd = random.Random(seed)
    kill = {"300", "3774"}                                                   # Upper Crest, Cove Grand Residence by Imtiaz
    for A in dm["areas"].values():
        for d in A["devs"].values():
            for lst, lx in (("b", "bx"), ("b12", "b12x")):
                if not d.get(lst):
                    continue
                keep = []
                for i, x in enumerate(d[lst]):
                    e = (d.get(lx) or [{}] * (i + 1))[i] if d.get(lx) and i < len(d[lx]) else {}
                    if str(e.get("p")) in kill or rnd.random() < 0.15:
                        continue
                    keep.append(i)
                d[lst] = [d[lst][i] for i in keep]
                if d.get(lx):
                    d[lx] = [d[lx][i] for i in keep if i < len(d[lx])]
    kv["devmap_index"] = dm
    si = copy.deepcopy(kv["search_index"]); si["items"] = [i for i in si["items"] if "upper crest" not in str(i.get("n", "")).lower()]
    kv["search_index"] = si
    src = {}
    for n, (how, obj) in (kv.get("_layer_src") or {}).items():
        if obj is None:
            src[n] = (how, None)
        elif n == "community_positions_p":
            o = copy.deepcopy(obj); (o.get("p") or {}).pop("p:100", None); src[n] = (how, o)
        else:
            src[n] = (how, _drop_names(obj, CORRUPT_NAMES))
    kv["_layer_src"] = src
    return kv


def measure(kv, rows, cfg, fast, require_layers=False, fixtures=None):
    S = C.build_surfaces(kv)
    flags = [C.project_flags(r, S, {}) for r in rows]
    isbase = lambda r: str(r["source"]).startswith(BASE_SOURCES)
    cov = C.coverage(rows, flags, isbase)
    allc = C.coverage(rows, flags, lambda r: True)
    pct = {s: (100.0 * v[0] / v[1] if v[1] else None) for s, v in cov["surfaces"].items()}
    fx = C.check_fixtures(S, kv, fixtures=fixtures, require_layers=require_layers)
    return {"S": S, "flags": flags, "cov": cov, "all": allc, "pct": pct, "fixtures": fx, "layers": S["layers"]}


def evaluate(m, cfg, fast):
    fails, trail = [], []
    th = (cfg or {}).get("thresholds", {})
    for f in m["fixtures"]:
        st = "SKIP" if f.get("skip") else "PASS" if f["ok"] else "FAIL"
        det = "; ".join(f["why"] + (["missing on " + ",".join(f["missing"])] if f["missing"] else []))
        if not f["ok"]:
            fails.append("fixture %s: %s" % (f["name"], det))
        trail.append(("fixture", f["name"], ",".join(f["devs"]), "", st, det))
    for s in MEASURE:
        if fast and s in ("S1", "S4", "S8"):
            trail.append(("coverage", s, "%.2f" % m["pct"][s], th.get(s, ""), "SKIP", "not measured with --fast (value shown is a lower bound)"))
            continue
        v = m["pct"][s]
        t = th.get(s)
        ok = t is None or (v is not None and v + 1e-9 >= t)
        if not ok:
            fails.append("coverage %s (%s) %.2f%% is below the threshold %.2f%%" % (s, C.SURFACE_LABEL[s], v, t))
        trail.append(("coverage", s, "%.2f" % v if v is not None else "", t if t is not None else "", "PASS" if ok else "FAIL", C.SURFACE_LABEL[s]))
    bl = (cfg or {}).get("baseline", {})
    for k, v in (("unfindable_strict", m["all"]["unfindable_strict"]), ("unfindable_client", m["all"]["unfindable_client"])):
        if fast:                                                    # both counts lean on the S1 / S8 data that --fast skips
            trail.append(("unfindable", k, v, bl.get(k, ""), "SKIP", "not comparable with --fast"))
            continue
        b = bl.get(k)
        ok = b is None or v <= b
        if not ok:
            fails.append("%s rose to %d (baseline %d)" % (k, v, b))
        trail.append(("unfindable", k, v, b if b is not None else "", "PASS" if ok else "FAIL", "entities no surface shows"))
    for n, L in (m.get("layers") or {}).items():
        trail.append(("layer", n, L["n"], "", "SKIP" if L["state"] in ("not published", "no file") else "INFO", L["state"]))
    return fails, trail


def write_trail(path, mode, trail):
    if not path:
        return
    new = not os.path.exists(path)
    with open(path, "a", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["run_utc", "mode", "check", "subject", "value", "threshold", "status", "detail"])
        ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        for t in trail:
            w.writerow([ts, mode] + list(t))


def print_report(m, fails, label, nrows, fast, out=print):
    out("== %s: %d universe projects, base (register projects) %d" % (label, nrows, m["cov"]["n"]))
    for n, L in m["layers"].items():
        out("  layer %-24s %-14s %s" % (n, L["state"] if L["state"] not in ("not published", "no file") else "NOT PUBLISHED", ("%d entries" % L["n"]) if L["n"] else "(skipped: layer not published)"))
    for s in MEASURE:
        out("  %-4s %-26s %6.2f%%  (%d of %d)%s" % (s, C.SURFACE_LABEL[s], m["pct"][s], m["cov"]["surfaces"][s][0], m["cov"]["surfaces"][s][1], "  [--fast: lower bound, not gated]" if fast and s in ("S1", "S4", "S8") else ""))
    out("  unfindable (no surface at all, task definition): %d of %d;  not reachable by a client (no map, plot, search, developer page or Brief): %d" % (m["all"]["unfindable_strict"], m["all"]["n"], m["all"]["unfindable_client"]))
    for f in m["fixtures"]:
        out("  fixture %-38s %s %s" % (f["name"], "skip" if f.get("skip") else "ok  " if f["ok"] else "FAIL", ("under " + ",".join(f["devs"])) if f["devs"] else ("(" + "; ".join(f["why"]) + ")" if f.get("skip") else "")))
    for x in fails:
        out("  FAIL: " + x)


def build_parser():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=DEF_CONFIG); ap.add_argument("--universe", default=DEF_UNIVERSE); ap.add_argument("--audit-csv", default=DEF_AUDIT)
    ap.add_argument("--cache", default=os.path.join(tempfile.gettempdir(), "completeness_cache")); ap.add_argument("--max-age", type=int, default=900)
    ap.add_argument("--index"); ap.add_argument("--nosales"); ap.add_argument("--notconf"); ap.add_argument("--announced"); ap.add_argument("--search-extra-dir"); ap.add_argument("--announced-search")
    ap.add_argument("--community-positions-p"); ap.add_argument("--plots"); ap.add_argument("--plot-positions"); ap.add_argument("--community-positions")
    ap.add_argument("--fast", action="store_true"); ap.add_argument("--baseline-update", action="store_true"); ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--require-layers", action="store_true"); ap.add_argument("--rebuild-universe", action="store_true"); ap.add_argument("--quiet", action="store_true")
    return ap


def main(argv=None):
    ap = build_parser()
    a = ap.parse_args(argv)
    if a.rebuild_universe:
        print("python C:\\Dev\\naj-market-pulse\\docs\\COMPLETENESS_AUDIT_07OCT2026\\build_universe.py   (writes universe_projects.csv there)\n"
              "copy C:\\Dev\\naj-market-pulse\\docs\\COMPLETENESS_AUDIT_07OCT2026\\universe_projects.csv %s" % DEF_UNIVERSE)
        return 0
    t0 = time.time()
    rows = load_universe(a.universe)
    cfg = json.load(open(a.config, encoding="utf-8")) if os.path.exists(a.config) else {}
    kv = C.load_live(a.cache, a.max_age, fast=a.fast)
    apply_overrides(kv, a)
    m = measure(kv, rows, cfg, a.fast, a.require_layers)
    mode = "baseline-update" if a.baseline_update else "self-test" if a.self_test else "gate"

    def show(m, fails, label):
        if not a.quiet:
            print_report(m, fails, label, len(rows), a.fast)

    if a.baseline_update:
        th = {s: round(m["pct"][s] - 1.0, 2) for s in MEASURE if m["pct"][s] is not None}
        if a.fast:
            for s in ("S1", "S4", "S8"):
                th[s] = (cfg.get("thresholds") or {}).get(s, th.get(s))
            print("WARNING: --fast skipped S1 and S8; their thresholds were kept as they were.")
        cfg = {"version": 1, "measured_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "base": "register projects (project-register extract plus the 1 Sep 2026 delta): %d" % m["cov"]["n"],
               "rule": "a threshold is the measured coverage minus 1 point; the baseline is the measured count of entities no surface shows. Raise them as coverage grows; never lower them to hide a regression.",
               "thresholds": th, "baseline": {"unfindable_strict": m["all"]["unfindable_strict"], "unfindable_client": m["all"]["unfindable_client"]}}
        json.dump(cfg, open(a.config, "w", encoding="utf-8"), indent=1)
        fails, trail = evaluate(m, cfg, a.fast)
        write_trail(a.audit_csv, mode, trail)
        show(m, [x for x in fails if x.startswith("fixture")], "BASELINE UPDATED (" + a.config + ")")
        fx_fail = [x for x in fails if x.startswith("fixture")]
        if fx_fail:
            print("NOTE: thresholds were rewritten, but %d fixture(s) still fail; the gate will keep exiting 1 until they are on their surfaces (fixtures are never baselined)." % len(fx_fail))
        return 0

    fails, trail = evaluate(m, cfg, a.fast)
    if not cfg:
        fails.append("no config at %s: run --baseline-update once" % a.config)
    if a.self_test:
        # NEGATIVE CONTROL: the same gate, on a corrupted copy of the data, must fail on exactly the damage done
        kv2 = corrupt(kv)
        m2 = measure(kv2, rows, cfg, a.fast, a.require_layers)
        f2, t2 = evaluate(m2, cfg, a.fast)
        names = {f["id"]: f["name"] for f in C.FIXTURES}
        clean_ok = {f["id"] for f in m["fixtures"] if f["ok"] and not f.get("skip")}
        expect = ["uppercrest", "covegrand"] + [i for i in CORRUPT_IDS if i in clean_ok]       # a layer fixture is only expected to fail when it passed on the clean data (its layer was there)
        must = [i for i in expect if any(x.startswith("fixture " + names[i]) for x in f2)]
        drop = [x for x in f2 if x.startswith("coverage S3") or x.startswith("coverage S7") or x.startswith("unfindable")]
        ok = len(must) == len(expect) and (len(drop) > 0 or not cfg)
        base_f = [x for x in fails if x.startswith("fixture Upper Crest") or x.startswith("fixture Cove Grand")]
        trail = [("negative-control", "corrupted copy", len(f2), len(fails), "PASS" if ok and not base_f else "FAIL",
                  "gate failures on the corrupted data: %d (fixtures named: %d of %d expected, coverage/baseline: %d); on the clean data: %d" % (len(f2), len(must), len(expect), len(drop), len(fails)))] + t2
        write_trail(a.audit_csv, mode, trail)
        if not a.quiet:
            print("== NEGATIVE CONTROL (clean data: %d gate failure(s); corrupted copy: %d); fixtures expected to fail on the damage: %s" % (len(fails), len(f2), ", ".join(expect)))
            for x in f2:
                print("  corrupted run fails:", x)
        if ok and not base_f:
            print("NEGATIVE CONTROL PASSED: the gate fails on corrupted input, and names the damage (%d of %d expected fixtures named)." % (len(must), len(expect)))
            return 0
        print("NEGATIVE CONTROL FAILED: the gate did not catch the corruption (named %d of %d expected fixtures), or the clean data already failed on the corrupted fixtures." % (len(must), len(expect)))
        return 1
    write_trail(a.audit_csv, mode, trail)
    show(m, fails, "COMPLETENESS GATE %.0fs" % (time.time() - t0))
    if fails:
        print("COMPLETENESS GATE: FAIL (%d)  audit trail: %s" % (len(fails), a.audit_csv))
        return 1
    print("COMPLETENESS GATE: PASS  audit trail: %s" % a.audit_csv)
    return 0


if __name__ == "__main__":
    sys.exit(main())
