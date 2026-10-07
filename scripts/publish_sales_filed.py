"""v396 - PUBLISH the sales files (scripts/build_sales_filed.py -> data/sales_filed/sales_filed_*.json). KENDALL APPROVES, THEN KENDALL RUNS THIS. Claude has NOT run it.
Dry run is the DEFAULT: it validates every local file, reads each live key through the worker's own /img route (read-only) and prints what it would do. Nothing is written.

  python scripts/publish_sales_filed.py                          dry run, every file
  python scripts/publish_sales_filed.py --only dubai businessbay  dry run, those files
  add --apply to put the keys (refuses any key that already holds a value); add --apply --replace to replace (the old value is backed up first)
  options: --dir <folder>  --work <folder>

KV keys: img_sales_filed_<district> and img_sales_filed_dubai. A file over 1 MB is stored gzipped (the page reads either; the /img route serves the gzip as such).
Order (it stops at the first failure and prints the real error):
  0  with --apply, refuses 04:00-06:15 Dubai time (the morning chain) and while Najma_Daily_Refresh / Najma_Avail_Sweep is Running
  1  validates each file (shape, basis 'registered', no row with a unit number, sizes under the 25 MB KV limit)
  2  reads the live key through GET <worker>/img/<name> (the live route; 404 = no value). A value there and no --replace: STOP. With --replace it is backed up first
  3  --apply only: puts the key (an ARGUMENT LIST: no shell, no redirection), reads it back through the live /img route and compares it with what was put
  4  prints the ROLLBACK line for every key (restore the backup, or delete the key when there was none)
The worker release v396 must be deployed (by Kendall) for the page to read these keys; before that they are inert (the v395 page ignores them).
"""
import argparse, datetime, glob, gzip, hashlib, json, os, shutil, subprocess, sys, tempfile, time, urllib.error, urllib.parse, urllib.request

NS = "2cdf36a27f834b5f9c726294d36770fb"
ENVN = "azimuth2"
WORKER = r"C:\Dev\azimuth-worker-dewa"
LIVE = "https://azimuth-2.digitalchemy.workers.dev"
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
GZIP_OVER = 1024 * 1024
KV_LIMIT = 25 * 1024 * 1024


def stop(msg):
    print("\nSTOPPED: " + msg)
    sys.exit(1)


def read_key():
    """READ_KEY from the listener .env: the /img route locks sales_filed_* behind it once v396 is live. Never printed."""
    try:
        for line in open(r"C:\Dev\azimuth-listener-naj\.env", encoding="utf-8"):
            if line.startswith("READ_KEY="):
                return line.split("=", 1)[1].strip()
    except OSError:
        pass
    return None


def quiet_window():
    now = datetime.datetime.utcnow() + datetime.timedelta(hours=4)
    if 240 <= now.hour * 60 + now.minute < 375:
        stop("it is %s Dubai: the 04:00-06:15 morning chain window. Run this after 06:15." % now.strftime("%H:%M"))
    for t in ("Najma_Daily_Refresh", "Najma_Avail_Sweep"):
        r = subprocess.run(["powershell", "-NoProfile", "-Command", "(Get-ScheduledTask -TaskName %s -ErrorAction SilentlyContinue).State" % t], capture_output=True, text=True)
        if r.stdout.strip() == "Running":
            stop("%s is Running. Wait for it to finish." % t)


def validate(path):
    size = os.path.getsize(path)
    if size > KV_LIMIT:
        stop("%s is %d bytes, over the KV limit" % (os.path.basename(path), size))
    d = json.load(open(path, encoding="utf8"))
    if d.get("basis") != "registered" or not d.get("as_of") or not d.get("caveat"):
        stop("%s: missing basis 'registered', as_of or caveat" % os.path.basename(path))
    if "per_area" in d:
        if not d["per_area"].get("rows"):
            stop("%s: no per_area rows" % os.path.basename(path))
        if "unit" in " ".join(d["per_area"]["fields"]):
            stop("%s: a unit-level field in the Dubai file" % os.path.basename(path))
        return len(d["per_area"]["rows"])
    if not d.get("rows") or not d.get("district"):
        stop("%s: no rows or no district" % os.path.basename(path))
    bad = [f for f in d["fields"] if "unit_number" in f or f == "unit"]
    if bad:
        stop("%s: unit-level fields %s" % (os.path.basename(path), bad))
    return len(d["rows"])


def live_get(name):
    """the live value through the /img route (keyed first, keyless as the pre-v396 fallback); None = 404. Gzip is undone."""
    key = read_key()
    urls = ([LIVE + "/img/" + name + "?key=" + urllib.parse.quote(key) + "&cb=" + str(int(time.time()))] if key else []) + [LIVE + "/img/" + name + "?cb=" + str(int(time.time()))]
    last = None
    for u in urls:
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "najma-publish/1.0", "Accept-Encoding": "identity"}), timeout=120) as r:
                data = r.read()
            return gzip.decompress(data) if data[:2] == b"\x1f\x8b" else data
        except urllib.error.HTTPError as e:
            last = e
            if e.code == 404:
                return None
            if e.code not in (401, 403):
                stop("reading %s failed: HTTP %d" % (name, e.code))
        except Exception as e:
            stop("reading %s failed: %s" % (name, e))
    stop("reading %s failed: HTTP %s" % (name, getattr(last, "code", "?")))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--replace", action="store_true")
    ap.add_argument("--only", nargs="*", default=[])
    ap.add_argument("--dir", default=os.path.join(REPO, "data", "sales_filed"))
    ap.add_argument("--work", default="")
    a = ap.parse_args()
    files = sorted(glob.glob(os.path.join(a.dir, "sales_filed_*.json")))
    if a.only:
        files = [f for f in files if os.path.basename(f)[len("sales_filed_"):-5] in a.only]
    if not files:
        stop("no sales_filed_*.json under " + a.dir)
    if a.apply:
        quiet_window()
    work = a.work or os.path.join(tempfile.gettempdir(), "sales_filed_" + time.strftime("%Y%m%d_%H%M%S"))
    os.makedirs(work, exist_ok=True)
    print("Work folder: " + work)
    npx = shutil.which("npx.cmd") or shutil.which("npx") or "npx"
    rollback = []
    for f in files:
        stem = os.path.splitext(os.path.basename(f))[0]
        key = "img_" + stem
        n = validate(f)
        raw = open(f, "rb").read()
        payload = gzip.compress(raw, 9, mtime=0) if len(raw) > GZIP_OVER else raw
        note = "%d KB%s, %d rows" % (len(raw) // 1024, " -> %d KB gz" % (len(payload) // 1024) if payload is not raw else "", n)
        live = live_get(stem)
        backup = os.path.join(work, key + ".backup.json")
        if live is not None:
            if not a.replace:
                print("HOLDS %-44s a value is already there; use --replace (nothing written)" % key)
                continue
            open(backup, "wb").write(live)
        rb = ("npx wrangler kv key put %s --path \"%s\" --env %s --namespace-id %s" % (key, backup, ENVN, NS)) if live is not None else ("npx wrangler kv key delete %s --env %s --namespace-id %s" % (key, ENVN, NS))
        if not a.apply:
            print("WOULD %-44s %s%s" % (key, note, "  (replaces a live value; backed up first)" if live is not None else "  (first publish)"))
            rollback.append(rb)
            continue
        out = os.path.join(work, stem + (".json.gz" if payload is not raw else ".json"))
        open(out, "wb").write(payload)
        r = subprocess.run([npx, "wrangler", "kv", "key", "put", key, "--path", out, "--env", ENVN, "--namespace-id", NS], cwd=WORKER, capture_output=True, text=True)
        if r.returncode != 0:
            stop("wrangler kv key put %s failed (exit %d):\n%s" % (key, r.returncode, (r.stdout or "") + (r.stderr or "")))
        time.sleep(3)
        back = live_get(stem)
        if back is None or hashlib.sha256(back).hexdigest() != hashlib.sha256(raw).hexdigest():
            print("FAIL  %-44s THE READ-BACK THROUGH THE LIVE /img ROUTE DOES NOT MATCH (KV can take a moment: re-check once, then roll back):\n  %s" % (key, rb))
            sys.exit(1)
        print("PUT   %-44s %s -> verified through the live /img route" % (key, note))
        rollback.append(rb)
    print("\n%s. ROLLBACK lines (run from %s):" % ("DONE" if a.apply else "DRY RUN: nothing written", WORKER))
    for rb in rollback:
        print("  " + rb)


if __name__ == "__main__":
    main()
