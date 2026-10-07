"""v387 - APPLY the high-confidence footprint-name bindings to the district blocks files (cause B of the 7 Oct 2026 card-map-position audit).

DRY RUN IS THE DEFAULT. Claude has NOT run --apply. Kendall approves, then this runs.

  python scripts/apply_name_bindings.py                       dry run: reads each district's LIVE blocks (read-only), computes the change, writes the new files and a report to the work folder
  python scripts/apply_name_bindings.py --apply               puts each changed district with wrangler, reads it back, compares, prints the rollback line
  options: --proposal <csv>  --work <dir>  --backup <dir>  --from-dir <dir of <slug>.json, for an offline run or a test>  --district <slug> (repeatable)  --live-protected

WHAT IT CHANGES (and nothing else)
  Reads proposals/name_bindings_proposal.csv and takes ONLY rows with confidence 'high'. For each district it reads the live KV key img_blocks_<slug> (what the page draws, GET /img/blocks_<slug>),
  backs the live value up under the backup folder, and sets the footprint property "n" (the name) of the proposed footprint index (properties.i, k = "b") when
     * the footprint has NO name now  -> the proposed name is set;
     * the footprint already carries the SAME name (case and spacing aside) -> nothing to do;
     * the footprint carries a DIFFERENT name -> NEVER overwritten: the row is flagged "different name" in the report;
  and also skips (and says why): a footprint index that is not in the live file, two high rows that give one footprint two different names, a protected key (data/protected_keys.json: a protected key such as
  img_blocks_jumeirahvillagecircle is refused unless --live-protected is passed), a Najma task running, and the 04:00-06:15 Dubai window (with --apply).
  Every other byte of the file is kept: the new text is the live text with ONLY the one properties object of each named footprint replaced (the geometry is never re-written). The script verifies this
  (the text outside those objects is byte-identical, and the parsed file differs only in those "n" values) before it writes anything.

--apply: refuses when the live value changed since it was read; puts with wrangler through subprocess ARGUMENT LISTS (never a shell string); reads the key back and compares it with the new file; prints the
ROLLBACK line per district (put the backup file back). The put keeps the live storage format (a gzipped live value is put gzipped, the way the page route passes it through; a plain one plain); the backup is in that same format, so the rollback restores it exactly.
The live read is binary-safe (scripts/_cardlib.py kv_read): the blocks keys are stored gzipped and scripts/kv_read_live.mjs (--text) cannot read them.
"""
import argparse, collections, csv, datetime, fnmatch, json, os, re, shutil, subprocess, sys, tempfile, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _cardlib as L

NS = "2cdf36a27f834b5f9c726294d36770fb"
ENVN = "azimuth2"
WORKER = r"C:\Dev\azimuth-worker-dewa"
PROPOSAL = os.path.join(L.AUDIT, "proposals", "name_bindings_proposal.csv")
PROTECTED = os.path.join(L.NMP, "data", "protected_keys.json")
PROPKEY = re.compile(r'"properties"\s*:\s*(?=\{)')
Span = collections.namedtuple("Span", "start end obj")


def norm(n):
    return re.sub(r"\s+", " ", str(n or "")).strip().lower()


def protected_pattern(key, path=PROTECTED):
    """the protecting pattern for a KV key (same rule as scripts/protected_keys.py in the shared repo: the name or img_ + name), or None"""
    try:
        pats = json.load(open(path, encoding="utf-8")).get("patterns") or []
    except Exception:
        return "(protected_keys.json unreadable: treated as protected)"
    cands = {key, key if key.startswith("img_") else "img_" + key}
    for p in pats:
        if any(fnmatch.fnmatchcase(c, p) for c in cands):
            return p
    return None


def read_rows(path):
    return [r for r in csv.DictReader(open(path, encoding="utf-8-sig")) if (r.get("confidence") or "").strip().lower() == "high"]


def splice(raw, changes):
    """raw blocks text + {footprint index: new name} -> (new text, applied dict). Only the matching properties objects are replaced. Raises ValueError on anything unexpected."""
    dec, spans, pos = json.JSONDecoder(), [], 0
    for m in PROPKEY.finditer(raw):          # each properties object is decoded with the JSON decoder itself, so a name that holds braces cannot confuse it
        if m.start() < pos:
            continue
        try:
            _, end = dec.raw_decode(raw, m.end())
        except ValueError:
            continue
        spans.append(Span(m.start(), end, raw[m.end():end]))
        pos = end
    data = json.loads(raw)
    feats = data.get("features", [])
    if len(spans) != len(feats):
        raise ValueError("properties objects found (%d) do not match the feature count (%d)" % (len(spans), len(feats)))
    compact = ", " not in raw[:2000] and ": " not in raw[:2000]
    seps = (",", ":") if compact else (", ", ": ")
    ascii_only = "\\u" in raw and not re.search(r"[^\x00-\x7f]", raw)
    out, last, applied = [], 0, {}
    for sp, f in zip(spans, feats):
        q = f.get("properties") or {}
        i = q.get("i")
        if q.get("k") == "b" and i in changes and f.get("geometry"):
            props = json.loads(sp.obj)
            if props != q:
                raise ValueError("a properties object does not parse to its feature's properties")
            props["n"] = changes[i]
            out.append(raw[last:sp.start])
            out.append('"properties"' + seps[1] + json.dumps(props, ensure_ascii=ascii_only, separators=seps))
            last = sp.end
            applied[i] = changes[i]
    out.append(raw[last:])
    new = "".join(out)
    # verification: outside the replaced objects the bytes are identical; the parsed file differs only in the applied "n" values
    chk = json.loads(new)
    if len(chk["features"]) != len(feats):
        raise ValueError("feature count changed")
    for a, b in zip(feats, chk["features"]):
        if a.get("geometry") != b.get("geometry") or a.get("type") != b.get("type"):
            raise ValueError("geometry changed")
        qa, qb = dict(a.get("properties") or {}), dict(b.get("properties") or {})
        if qa.get("k") == "b" and qa.get("i") in applied:
            qb.pop("n", None)
            qa.pop("n", None)
        if qa != qb:
            raise ValueError("a property other than n changed")
    if {k: v for k, v in chk.items() if k != "features"} != {k: v for k, v in data.items() if k != "features"}:
        raise ValueError("file metadata changed")
    return new, applied


def plan_district(slug, rows, raw):
    """-> (new_text or None, [report rows]) for one district"""
    data = json.loads(raw)
    byi = {}
    for f in data.get("features", []):
        q = f.get("properties") or {}
        if q.get("k") == "b" and f.get("geometry") and q.get("i") is not None:
            byi[q["i"]] = q
    want = {}
    for r in rows:
        try:
            want.setdefault(int(r["footprint_index"]), []).append(r)
        except ValueError:
            pass
    rep, changes = [], {}
    for i, rs in sorted(want.items()):
        names = {r["proposed_name"] for r in rs}
        for r in rs:
            base = {"district": slug, "card": r["card_name"], "footprint_index": i, "proposed_name": r["proposed_name"]}
            q = byi.get(i)
            if len(names) > 1:
                rep.append(dict(base, result="skipped", why="two high rows give footprint %d different names" % i, name_now=(q or {}).get("n", "")))
            elif q is None:
                rep.append(dict(base, result="skipped", why="footprint %d is not a building with geometry in the live blocks file" % i, name_now=""))
            else:
                cur = q.get("n") or ""
                if not cur.strip():
                    changes[i] = r["proposed_name"]
                    rep.append(dict(base, result="applied", why="the footprint has no name: the proposed name is set", name_now=""))
                elif norm(cur) == norm(r["proposed_name"]):
                    rep.append(dict(base, result="no change", why="the footprint already carries this name", name_now=cur))
                else:
                    rep.append(dict(base, result="skipped", why="different name: the footprint is called '%s'; never overwritten (a person decides)" % cur, name_now=cur))
    if not changes:
        return None, rep
    new, applied = splice(raw, changes)
    return new, rep


def kv_put(key, path):
    """path is the file to store AS IS (gzipped when the live value was gzipped: the page route passes a gzip value through with Content-Encoding)"""
    npx = shutil.which("npx.cmd") or shutil.which("npx") or "npx"
    r = subprocess.run([npx, "wrangler", "kv", "key", "put", key, "--path", path, "--env", ENVN, "--namespace-id", NS], cwd=WORKER, capture_output=True, text=True)
    if r.returncode != 0:
        L.stop("wrangler kv key put %s failed (exit %d):\n%s" % (key, r.returncode, (r.stdout or "") + (r.stderr or "")))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--apply", "-Apply", action="store_true", help="put the changed districts (default is a dry run)")
    ap.add_argument("--proposal", default=PROPOSAL)
    ap.add_argument("--work", default="")
    ap.add_argument("--backup", default="")
    ap.add_argument("--from-dir", default="", help="read <slug>.json from this folder instead of the live KV (offline run / test; --apply is refused with it)")
    ap.add_argument("--district", action="append", default=[])
    ap.add_argument("--live-protected", action="store_true")
    ap.add_argument("--protected-file", default=PROTECTED)
    a = ap.parse_args()
    if a.apply and a.from_dir:
        L.stop("--apply reads the live value; it cannot be combined with --from-dir")
    if a.apply:
        L.quiet_window()
    stamp = time.strftime("%Y%m%d_%H%M%S")
    work = a.work or os.path.join(tempfile.gettempdir(), "name_bindings_" + stamp)
    bk = a.backup or os.path.join(os.path.dirname(work), "devmap_backups", "blocks_before_v387_" + stamp)
    os.makedirs(os.path.join(work, "new"), exist_ok=True)
    os.makedirs(bk, exist_ok=True)
    rows = read_rows(a.proposal)
    by = {}
    for r in rows:
        by.setdefault(r["district"], []).append(r)
    slugs = sorted(by) if not a.district else [s for s in sorted(by) if s in a.district]
    print("%s: %d high-confidence rows in %d districts" % ("APPLY" if a.apply else "DRY RUN", sum(len(by[s]) for s in slugs), len(slugs)))
    print("work folder: " + work + "\nbackup folder: " + bk)
    report, touched, rollbacks = [], [], []
    for s in slugs:
        key = "img_blocks_" + s
        pat = protected_pattern(key, a.protected_file)
        if pat and not a.live_protected:
            for r in by[s]:
                report.append({"district": s, "card": r["card_name"], "footprint_index": r["footprint_index"], "proposed_name": r["proposed_name"], "name_now": "", "result": "skipped",
                               "why": "protected key %s (matches %s): hand-merged live; pass --live-protected to include it" % (key, pat)})
            print("  %-26s PROTECTED (%s): %d rows skipped" % (s, pat, len(by[s])))
            continue
        live = os.path.join(work, s + ".live.json")
        if a.from_dir:
            src = os.path.join(a.from_dir, s + ".json")
            if not os.path.exists(src):
                for r in by[s]:
                    report.append({"district": s, "card": r["card_name"], "footprint_index": r["footprint_index"], "proposed_name": r["proposed_name"], "name_now": "", "result": "skipped", "why": "no blocks file in --from-dir"})
                continue
            shutil.copyfile(src, live)
        else:
            if not L.kv_read(key, live, allow_missing=True):
                for r in by[s]:
                    report.append({"district": s, "card": r["card_name"], "footprint_index": r["footprint_index"], "proposed_name": r["proposed_name"], "name_now": "", "result": "skipped", "why": "no live value for " + key})
                print("  %-26s no live blocks key" % s)
                continue
        raw = open(live, encoding="utf-8").read()
        gz = bool(L.GZ.get(key)) and not a.from_dir
        bkf = os.path.join(bk, s + (".json.gz" if gz else ".json"))
        if gz:
            import gzip
            with open(bkf, "wb") as f:
                f.write(gzip.compress(raw.encode("utf-8"), 9, mtime=0))
        else:
            shutil.copyfile(live, bkf)
        try:
            new, rep = plan_district(s, by[s], raw)
        except ValueError as e:
            for r in by[s]:
                report.append({"district": s, "card": r["card_name"], "footprint_index": r["footprint_index"], "proposed_name": r["proposed_name"], "name_now": "", "result": "skipped", "why": "refused: " + str(e)})
            print("  %-26s REFUSED: %s" % (s, e))
            continue
        report += rep
        n_ap = sum(1 for x in rep if x["result"] == "applied")
        n_sk = sum(1 for x in rep if x["result"] == "skipped")
        print("  %-26s applied %3d  skipped %3d  unchanged %3d" % (s, n_ap, n_sk, sum(1 for x in rep if x["result"] == "no change")))
        if new is None:
            continue
        newp = os.path.join(work, "new", s + ".json")
        with open(newp, "w", encoding="utf-8", newline="") as f:
            f.write(new)
        putp = newp
        if gz:
            import gzip
            putp = newp + ".gz"
            with open(putp, "wb") as f:
                f.write(gzip.compress(new.encode("utf-8"), 9, mtime=0))
        rb = "npx wrangler kv key put %s --path \"%s\" --env %s --namespace-id %s" % (key, bkf, ENVN, NS)
        touched.append(s)
        rollbacks.append((s, rb))
        if a.apply:
            L.kv_read(key, os.path.join(work, s + ".recheck.json"))
            if json.load(open(os.path.join(work, s + ".recheck.json"), encoding="utf-8")) != json.loads(raw):
                L.stop("%s changed in KV since it was read. Nothing was put for it. Run again." % key)
            kv_put(key, putp)
            back = os.path.join(work, s + ".live_after.json")
            L.kv_read(key, back)
            if json.load(open(back, encoding="utf-8")) != json.loads(new):
                print("\nTHE READ-BACK OF %s DOES NOT MATCH THE NEW FILE. Roll back now (from %s):\n  %s" % (key, WORKER, rb))
                sys.exit(1)
            print("    put and verified: " + key)
    rp = os.path.join(work, "apply_report.csv")
    with open(rp, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=["district", "card", "footprint_index", "proposed_name", "name_now", "result", "why"])
        w.writeheader()
        w.writerows(report)
    tot = {k: sum(1 for x in report if x["result"] == k) for k in ("applied", "no change", "skipped")}
    print("\nrows applied %d, already named %d, skipped %d; districts that change: %d (%s)" % (tot["applied"], tot["no change"], tot["skipped"], len(touched), ", ".join(touched)))
    why = {}
    for x in report:
        if x["result"] == "skipped":
            k = re.sub(r"'[^']*'", "'...'", x["why"])
            why[k] = why.get(k, 0) + 1
    for k, v in sorted(why.items(), key=lambda kv: -kv[1]):
        print("  skipped %4d  %s" % (v, k))
    print("report: " + rp)
    if not a.apply:
        print("\nDRY RUN: nothing was put. The new files are in %s\\new; the live values are backed up in %s." % (work, bk))
    print("\nRoll-back lines (from %s), one per district:" % WORKER)
    for s, rb in rollbacks:
        print("  " + rb)


if __name__ == "__main__":
    main()
