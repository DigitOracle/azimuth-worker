"""v397d - PUBLISH the two files of release v397d (scripts/build_announced.py): the developer-page group and the Find-page items for the projects a developer announces that are in no register.
KENDALL APPROVES, THEN KENDALL RUNS THIS. Claude has NOT run it. Dry run is the DEFAULT: it validates the local file, reads the live value through the worker's own /img route (read-only) and prints
what it would do. Nothing is written.

  python scripts/publish_announced.py --what announced             dry run for KV img_devmap_announced        (the developer page group, what=announced)
  python scripts/publish_announced.py --what search                dry run for KV img_search_extra_announced  (the Find-page items)
  add --apply to put the key (refuses if a value is already there); add --apply --replace to replace one (the old value is backed up first)
  options: --file <json>  --work <dir>      (the PowerShell spellings -Apply and -Replace work too)

Order (it stops at the first failure and prints the real error):
  0  with --apply, refuses to run 04:00-06:15 Dubai time (the morning chain) or while Najma_Daily_Refresh / Najma_Avail_Sweep is Running
  1  validates the file (size, shape, every entry has a name and the one label DEVELOPER_CLAIMED, none carries a project number, a position or a sales field)
  2  reads the live key through GET <worker>/img/<name> (the live route; 404 = no value). A value is there and no --replace: STOP. With --replace it is backed up to <work> and <work>/../devmap_backups first
  3  --apply only: puts the key (a LIST of arguments: no shell, no redirection), reads it back through the live /img route and compares it with the file
  4  prints the ROLLBACK line (restore the backup, or delete the key when there was none)
Publish ORDER does not matter: the page and the Find merge both treat an absent key as 'nothing to add' (v395 behaviour). The worker release v397d must be deployed (by Kendall) for either key to show.
"""
import argparse, datetime, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error

NS = "2cdf36a27f834b5f9c726294d36770fb"
ENVN = "azimuth2"
WORKER = r"C:\Dev\azimuth-worker-dewa"
LIVE = "https://azimuth-2.digitalchemy.workers.dev"
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
KINDS = {
    "announced": {"key": "img_devmap_announced", "file": os.path.join(REPO, "data", "announced", "announced.json"), "limit": 250 * 1024},
    "search": {"key": "img_search_extra_announced", "file": os.path.join(REPO, "data", "search_extra", "announced_search.json"), "limit": 200 * 1024},
}
FORBIDDEN = ("p", "pp", "key", "pn", "sales", "ppsm", "n_sales", "price")


def stop(msg):
    print("\nSTOPPED: " + msg)
    sys.exit(1)


def quiet_window():
    now = datetime.datetime.utcnow() + datetime.timedelta(hours=4)
    if 240 <= now.hour * 60 + now.minute < 375:
        stop("it is %s Dubai: the 04:00-06:15 morning chain window. Run this after 06:15." % now.strftime("%H:%M"))
    for t in ("Najma_Daily_Refresh", "Najma_Avail_Sweep"):
        r = subprocess.run(["powershell", "-NoProfile", "-Command", "(Get-ScheduledTask -TaskName %s -ErrorAction SilentlyContinue).State" % t], capture_output=True, text=True)
        if r.stdout.strip() == "Running":
            stop("%s is Running. Wait for it to finish." % t)


def validate(kind, path):
    if not os.path.exists(path):
        stop("the file is not there: " + path)
    size = os.path.getsize(path)
    if size > KINDS[kind]["limit"]:
        stop("the file is %d bytes, over the %d KB limit (shard it)" % (size, KINDS[kind]["limit"] // 1024))
    d = json.load(open(path, encoding="utf8"))
    if kind == "announced":
        n = 0
        for dev, ds in (d.get("d") or {}).items():
            for dist, lst in ds.items():
                for e in lst:
                    if not e.get("n") or e.get("e") != "DEVELOPER_CLAIMED":
                        stop("%s/%s: an entry has no name or its label is not DEVELOPER_CLAIMED" % (dev, dist))
                    bad = [k for k in FORBIDDEN if k in e]
                    if bad:
                        stop("%s: an announced entry must carry no project number, position, sales or price field (%s)" % (e["n"], ",".join(bad)))
                    n += 1
        if not n:
            stop("the file holds no entries")
        if n != (d.get("meta") or {}).get("count"):
            stop("meta.count %s does not match the %d entries" % ((d.get("meta") or {}).get("count"), n))
        print("  file ok: %d bytes, %d entries" % (size, n))
    else:
        its = d.get("items")
        if not isinstance(its, list) or not its:
            stop("the file holds no items")
        for it in its:
            if not it.get("n") or it.get("ann") != 1 or it.get("t") != "development":
                stop("an item has no name, is not flagged ann:1 or is not a development: %s" % it.get("n"))
        if d.get("features"):
            stop("announced projects have no position: the features list must be empty")
        print("  file ok: %d bytes, %d items" % (size, len(its)))
    return d


def live_get(key):
    """the live value through the worker's /img route; None = 404 (no value). Python urllib needs a User-Agent."""
    u = LIVE + "/img/" + key[len("img_"):] + "?cb=" + str(int(time.time() * 1000))
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "najma-publish/1.0"}), timeout=60) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        stop("reading %s through %s failed: HTTP %d" % (key, u, e.code))
    except Exception as e:
        stop("reading %s through %s failed: %s" % (key, u, e))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--what", choices=sorted(KINDS), required=True)
    ap.add_argument("--apply", "-Apply", action="store_true", help="write the key (default is a dry run)")
    ap.add_argument("--replace", "-Replace", action="store_true", help="replace an existing value (it is backed up first)")
    ap.add_argument("--file", default="")
    ap.add_argument("--work", default="")
    ap.add_argument("--skip-gate", "-SkipGate", action="store_true", help="publish UNGATED (the completeness gate is a hard stop; this prints a loud warning)")
    a = ap.parse_args()
    K = KINDS[a.what]
    key, fpath = K["key"], a.file or K["file"]
    if a.apply:
        quiet_window()
    work = a.work or os.path.join(tempfile.gettempdir(), key + "_" + time.strftime("%Y%m%d_%H%M%S"))
    os.makedirs(work, exist_ok=True)
    bk = os.path.join(os.path.dirname(work), "devmap_backups")
    os.makedirs(bk, exist_ok=True)
    print("Work folder: " + work)
    print("1/3 validating " + fpath)
    validate(a.what, fpath)
    import gate_guard   # v397g HARD STOP: scripts/gate_guard.py runs the completeness gate with this file substituted; a block exits 1 before anything is written (a missing guard is an ImportError = no publish)
    gate_guard.enforce({"announced": "announced", "search": "search_extra_announced"}[a.what], fpath, apply=a.apply, skip=a.skip_gate)
    print("2/3 reading the live key through the live /img route (read-only)")
    raw = live_get(key)
    backup = os.path.join(work, key + ".backup.json")
    if raw is not None:
        if not a.replace:
            stop("%s already holds a value. Nothing was written. Use --replace to overwrite it (the old value is backed up first)." % key)
        open(backup, "wb").write(raw)
        stamp = os.path.join(bk, key + "_before_v397d_" + time.strftime("%Y%m%d_%H%M%S") + ".json")
        open(stamp, "wb").write(raw)
        print("  backed up the live value to " + stamp)
    else:
        print("  no live value yet (first publish)")
    rb = ("npx wrangler kv key put %s --path \"%s\" --env %s --namespace-id %s" % (key, backup, ENVN, NS)) if raw is not None else ("npx wrangler kv key delete %s --env %s --namespace-id %s" % (key, ENVN, NS))
    if not a.apply:
        print("\nDRY RUN: nothing written to the live store. It would put %s (%d KB)." % (key, round(os.path.getsize(fpath) / 1024)))
        print("Roll-back line it would print (from %s):\n  %s" % (WORKER, rb))
        return
    print("3/3 putting")
    npx = shutil.which("npx.cmd") or shutil.which("npx") or "npx"
    r = subprocess.run([npx, "wrangler", "kv", "key", "put", key, "--path", fpath, "--env", ENVN, "--namespace-id", NS], cwd=WORKER, capture_output=True, text=True)
    if r.returncode != 0:
        stop("wrangler kv key put failed (exit %d):\n%s" % (r.returncode, (r.stdout or "") + (r.stderr or "")))
    print("  put %s (%d KB)" % (key, round(os.path.getsize(fpath) / 1024)))
    time.sleep(3)
    back = live_get(key)
    if back is None or json.loads(back.decode("utf8")) != json.load(open(fpath, encoding="utf8")):
        print("\nTHE READ-BACK THROUGH THE LIVE /img ROUTE DOES NOT MATCH THE FILE (KV can take a moment to propagate: re-check once, then roll back). From %s:\n  %s" % (WORKER, rb))
        sys.exit(1)
    print("  verified through the live /img route: the live value equals the file")
    print("\nDONE. To roll back (from %s):\n  %s" % (WORKER, rb))


if __name__ == "__main__":
    main()
