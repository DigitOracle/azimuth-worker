"""GATE GUARD (v397g): the completeness gate as a HARD STOP in front of every publish script.

  python scripts/gate_guard.py --layer <layer> --file <candidate> [--also <layer>=<file> ...] [--dry-run] [--skip-gate] [--full] [--strict]
      exit 0 = the publish may go ahead, exit 1 = BLOCKED (nothing may be written). The publish scripts call it before they write anything and stop on a non-zero exit.

What it does: reads the LIVE store once (read-only, through /img), measures the completeness gate on it ("live now"), then measures it again with the candidate file SUBSTITUTED for its layer
("candidate") and compares. It BLOCKS when, because of the candidate,
  - a fixture that passes live now fails (or a fixture whose layer the candidate brings fails: a layer that is published must carry its own fixtures),
  - a surface's coverage of register projects falls below its threshold in scripts/completeness_gate.json (when it was at or above it live, or when the candidate is worse than live),
  - a surface loses 1 point or more against live (a material drop even above the threshold),
  - (--full only) the unfindable counts rise above the live count or the baseline,
  - --strict: the candidate run has ANY failing fixture or threshold (default is relative to live, so a publish that does not itself fix an existing failure, for example KORE not yet published, is still allowed).
Projects that were on a surface live and are not on it with the candidate are listed as warnings (never silent).
It never writes KV and never deploys. A DRY RUN prints exactly the same table and says whether the real publish WOULD be blocked (the dry run itself carries on).

--skip-gate publishes UNGATED and prints a loud warning (stdout and stderr). Use it only when Kendall has said so; the warning is meant to be impossible to miss in a log.
Layers: nosales notconf announced search_extra (the main file; the district parts sit next to it as <name>_<district>.json) search_extra_announced community_positions_p   (v397 layers)
        index (devmap_index) plots plot_positions community_positions investor_tiers_index map_prices buy_extra rent_index search_index    (whole KV values)
"""
import argparse, copy, json, os, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import completeness_core as C
import check_completeness as K

LAYER_FILES = {"nosales", "notconf", "announced", "search_extra", "search_extra_announced", "community_positions_p"}
KV_LAYERS = {"index": "devmap_index", "plots": "plots", "plot_positions": "plot_positions", "community_positions": "community_positions",
             "investor_tiers_index": "investor_tiers_index", "map_prices": "map_prices", "buy_extra": "buy_extra", "rent_index": "rent_index", "search_index": "search_index"}
KNOWN = sorted(LAYER_FILES | set(KV_LAYERS))
DROP_POINTS = 1.0            # a surface that loses this many points against live is blocked even above its threshold
SURF = K.MEASURE


def _load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def load_search_extra(path):
    """The main search_extra file plus the district parts its "parts" names (<path minus .json>_<district>.json), joined into one object (the worker does the same join)."""
    se = _load(path)
    if se.get("parts"):
        sx, miss = list(se.get("sx") or []), []
        for d in sorted(se["parts"]):
            pp = path[:-5] + "_" + d + ".json"
            if os.path.exists(pp):
                sx += _load(pp).get("sx") or []
            else:
                miss.append(d)
        se = dict(se, sx=sx, _missing_parts=miss)
    return se


def substitute(kv, layers):
    """A copy of the live kv with each candidate file in place of its layer. layers = {layer: path}."""
    kv2 = dict(kv)
    kv2["_layer_src"] = dict(kv.get("_layer_src") or {})
    for layer, path in layers.items():
        if layer not in KNOWN:
            raise ValueError("unknown layer %r (known: %s)" % (layer, ", ".join(KNOWN)))
        if not os.path.exists(path):
            raise FileNotFoundError("the candidate file is not there: " + path)
        if layer == "search_extra":
            kv2["_layer_src"]["search_extra"] = ("local", load_search_extra(path))
        elif layer in LAYER_FILES:
            kv2["_layer_src"][layer] = ("local", _load(path))
        else:
            kv2[KV_LAYERS[layer]] = _load(path)
    return kv2


def compare(base, cand, rows, cfg, fast, strict=False):
    """-> (blocks, warns, table). base / cand are check_completeness.measure() results on the same rows."""
    th = (cfg or {}).get("thresholds", {})
    blocks, warns, table = [], [], []
    bfx = {f["id"]: f for f in base["fixtures"]}
    fxrows = []
    for f in cand["fixtures"]:
        b = bfx.get(f["id"], {"ok": True, "skip": True})
        before = "skip" if b.get("skip") else "ok" if b["ok"] else "FAIL"
        after = "skip" if f.get("skip") else "ok" if f["ok"] else "FAIL"
        bad = False
        if before == "ok" and after == "FAIL":
            bad = True; blocks.append("fixture %s passed live and FAILS with the candidate: %s" % (f["name"], "; ".join(f["why"] + (["missing on " + ",".join(f["missing"])] if f["missing"] else []))))
        elif before == "skip" and after == "FAIL":
            bad = True; blocks.append("fixture %s: the candidate brings its layer and the fixture FAILS: %s" % (f["name"], "; ".join(f["why"] + (["missing on " + ",".join(f["missing"])] if f["missing"] else []))))
        elif strict and after == "FAIL":
            bad = True; blocks.append("--strict: fixture %s fails with the candidate" % f["name"])
        fxrows.append((f["name"], before, after, "BLOCK" if bad else "ok"))
    for s in SURF:
        b, c = base["pct"][s], cand["pct"][s]
        t = th.get(s)
        gated = not (fast and s in ("S1", "S4", "S8"))           # --fast does not measure the footprint / unit-mix files: S1, S4, S8 are then compared relative to live only
        lost = [r for r, fb, fc in zip(rows, base["flags"], cand["flags"]) if fb["F"][s] and not fc["F"][s]]
        status = "ok"
        if gated and t is not None and c is not None and c + 1e-9 < t and (b is None or b + 1e-9 >= t or c + 1e-9 < b):
            status = "BLOCK"; blocks.append("coverage %s (%s) %.2f%% is below the threshold %.2f%% (live now %.2f%%)" % (s, C.SURFACE_LABEL[s], c, t, b))
        elif b is not None and c is not None and b - c >= DROP_POINTS - 1e-9:
            status = "BLOCK"; blocks.append("coverage %s (%s) drops %.2f points against live (%.2f%% -> %.2f%%)" % (s, C.SURFACE_LABEL[s], b - c, b, c))
        elif strict and gated and t is not None and c is not None and c + 1e-9 < t:
            status = "BLOCK"; blocks.append("--strict: coverage %s is below the threshold" % s)
        if lost:
            warns.append("%s: %d project(s) that live shows are not shown with the candidate, e.g. %s" % (s, len(lost), "; ".join("%s (%s)" % (r["name"], r.get("project_number") or "-") for r in lost[:4])))
            if status == "ok":
                status = "warn"
        table.append((s, C.SURFACE_LABEL[s], t, b, c, len(lost), status, gated))
    if not fast:
        bl = (cfg or {}).get("baseline", {})
        for k in ("unfindable_strict", "unfindable_client"):
            vb, vc = base["all"][k], cand["all"][k]
            lim = min([x for x in (vb, bl.get(k)) if x is not None] or [vc])
            if vc > lim:
                blocks.append("%s rises to %d (live now %d, baseline %s)" % (k, vc, vb, bl.get(k)))
    return blocks, warns, table, fxrows


def render(table, fxrows, blocks, warns, layers, nrows, nbase, fast, dry, base_layers, cand_layers, out=print):
    out("== GATE GUARD%s: candidate %s  (%d universe projects, %d register projects, %s)" % (" (DRY RUN)" if dry else "", ", ".join("%s=%s" % (k, os.path.basename(v)) for k, v in layers.items()), nrows, nbase, "--fast" if fast else "full"))
    for n in sorted(set(base_layers) | set(cand_layers)):
        b, c = base_layers.get(n, {"state": "-", "n": 0}), cand_layers.get(n, {"state": "-", "n": 0})
        if b["state"] != c["state"] or b["n"] != c["n"]:
            out("  layer %-24s live: %-14s %5d    candidate: %-14s %5d" % (n, b["state"], b["n"], c["state"], c["n"]))
    out("  %-4s %-24s %9s %9s %10s %7s %6s  %s" % ("", "surface", "threshold", "live now", "candidate", "delta", "lost", "status"))
    for s, label, t, b, c, lost, status, gated in table:
        out("  %-4s %-24s %9s %8.2f%% %9.2f%% %+7.2f %6d  %s%s" % (s, label, ("%.2f" % t) if t is not None else "-", b, c, c - b, lost, status.upper() if status in ("BLOCK",) else status, "" if gated else "  (relative to live: --fast does not gate it)"))
    for name, before, after, st in fxrows:
        if before != after or st != "ok" or after == "FAIL":
            out("  fixture %-44s live: %-4s candidate: %-4s %s" % (name, before, after, st))
    out("  fixtures: %d ok, %d skipped (layer not published), %d failing with the candidate" % (sum(1 for r in fxrows if r[2] == "ok"), sum(1 for r in fxrows if r[2] == "skip"), sum(1 for r in fxrows if r[2] == "FAIL")))
    for w in warns:
        out("  WARN: " + w)
    for b in blocks:
        out("  BLOCK: " + b)


def check(layers, kv, rows, cfg, fast=True, strict=False, fixtures=None, dry=False, out=print):
    """The whole decision, on data already in memory (used by the tests). -> (ok, blocks)."""
    base = K.measure(kv, rows, cfg, fast, fixtures=fixtures)
    kv2 = substitute(kv, layers)
    cand = K.measure(kv2, rows, cfg, fast, fixtures=fixtures)
    blocks, warns, table, fxrows = compare(base, cand, rows, cfg, fast, strict)
    render(table, fxrows, blocks, warns, layers, len(rows), base["cov"]["n"], fast, dry, base["layers"], cand["layers"], out)
    return (not blocks), blocks


SKIP_BANNER = ("\n" + "!" * 78 + "\n"
               "!!! COMPLETENESS GATE SKIPPED (--skip-gate): THIS PUBLISH IS UNGATED.          !!!\n"
               "!!! Nothing has checked that the candidate keeps every fixture and surface.    !!!\n"
               "!!! If a project disappears from a page because of it, this log line is why.   !!!\n" + "!" * 78 + "\n")


def enforce(layers, path=None, apply=False, skip=False, fast=True, strict=False, cache=None, max_age=900, universe=None, config=None):
    """Called by the publish scripts. layers: a layer name (with path) or a {layer: path} dict. Returns True when the publish may go on.
    BLOCKED + apply -> prints and exits 1 (nothing was written yet). BLOCKED + dry run -> prints that the real publish would be blocked and returns False (the dry run carries on)."""
    if isinstance(layers, str):
        layers = {layers: path}
    if skip:
        sys.stdout.write(SKIP_BANNER); sys.stdout.flush()
        sys.stderr.write(SKIP_BANNER); sys.stderr.flush()
        return True
    try:
        rows = K.load_universe(universe or K.DEF_UNIVERSE)
        cfg = _load(config or K.DEF_CONFIG)
        kv = C.load_live(cache or os.path.join(tempfile.gettempdir(), "completeness_cache"), max_age, fast=fast)
        ok, blocks = check(layers, kv, rows, cfg, fast, strict, dry=not apply)
    except SystemExit:
        raise
    except Exception as e:                                  # fail CLOSED: a gate that cannot run is not a pass
        print("GATE GUARD could not run (%s: %s): treated as BLOCKED. Fix the cause, or pass --skip-gate (loud, ungated) if Kendall says so." % (type(e).__name__, e))
        ok, blocks = False, ["the guard could not run"]
    if ok:
        print("GATE GUARD: PASS - the candidate keeps every fixture and surface that live has.")
        return True
    if apply:
        print("\nGATE GUARD: BLOCKED (%d). Nothing was written. Fix the candidate, or --skip-gate (ungated, loud) only on Kendall's word." % len(blocks))
        sys.exit(1)
    print("\nGATE GUARD (dry run): the real publish WOULD BE BLOCKED (%d). The dry run carries on so you can see the rest." % len(blocks))
    return False


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--layer", required=True, choices=KNOWN); ap.add_argument("--file", required=True)
    ap.add_argument("--also", action="append", default=[], help="another layer=file candidate published in the same run")
    ap.add_argument("--dry-run", action="store_true"); ap.add_argument("--skip-gate", action="store_true"); ap.add_argument("--full", action="store_true"); ap.add_argument("--strict", action="store_true")
    ap.add_argument("--cache"); ap.add_argument("--max-age", type=int, default=900); ap.add_argument("--universe"); ap.add_argument("--config")
    a = ap.parse_args(argv)
    layers = {a.layer: a.file}
    for x in a.also:
        k, _, v = x.partition("=")
        layers[k] = v
    ok = enforce(layers, apply=not a.dry_run, skip=a.skip_gate, fast=not a.full, strict=a.strict, cache=a.cache, max_age=a.max_age, universe=a.universe, config=a.config)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
