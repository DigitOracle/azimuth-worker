"""v401 - PUBLISH the register-built cards (scripts/build_regcards.py -> KV img_devmap_regcards). KENDALL APPROVES, THEN KENDALL RUNS THIS. Claude has NOT run it with --apply.
Dry run is the DEFAULT: it validates the local file, runs the completeness gate guard, reads the live value through the worker's own /img route (read-only) and prints what it would do. Nothing is written.

  python scripts/publish_regcards.py                 dry run for KV img_devmap_regcards
  add --apply to put the key (refuses if a value is already there); add --apply --replace to replace one (the old value is backed up first)
  options: --file <json>  --work <dir>  --skip-gate

Order (it stops at the first failure and prints the real error):
  0  with --apply, refuses to run 04:00-06:15 Dubai time (the morning chain) or while Najma_Daily_Refresh / Najma_Avail_Sweep is Running
  1  validates the file (size, shape, name, register project number, evidence label, no price-per-area field, a price range only with five or more priced sales, entry count)
  2  the completeness gate guard (scripts/gate_guard.py, layer regcards): BLOCKS before anything is written
  3  reads the live key through GET <worker>/img/<name> (404 = no value). A value is there and no --replace: STOP. With --replace it is backed up first
  4  --apply only: puts the key (a LIST of arguments: no shell), then reads it back through the live /img route, waiting up to 70 s for a new key to show
  5  prints the ROLLBACK line
Publish ORDER does not matter: an older worker ignores the key; the page treats an absent key as nothing to add (v399 behaviour). Worker release v401 must be deployed (by Kendall) for the cards to show.
"""
import argparse, datetime, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error

NS = "2cdf36a27f834b5f9c726294d36770fb"
ENVN = "azimuth2"
WORKER = r"C:\Dev\azimuth-worker-dewa"
LIVE = "https://azimuth-2.digitalchemy.workers.dev"
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
sys.path.insert(0, HERE)
KEY = "img_devmap_regcards"
FILE = os.path.join(REPO, "data", "regcards", "regcards.json")
LIMIT = 300 * 1024
LABELS = ("REGISTER_VERIFIED", "NAME_ONLY", "DEVELOPER_CLAIMED", "UNVERIFIED")
EMOJI = re.compile("[\U0001F000-\U0001FFFF\u2600-\u27BF\uFE0F]")


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


def validate(path):
    if not os.path.exists(path):
        stop("the file is not there: " + path)
    size = os.path.getsize(path)
    if size > LIMIT:
        stop("the file is %d bytes, over the %d KB limit" % (size, LIMIT // 1024))
    raw = open(path, encoding="utf8").read()
    if EMOJI.search(raw):
        stop("the file holds an emoji character")
    d = json.loads(raw)
    n = 0
    for dev, ds in (d.get("d") or {}).items():
        for dist, lst in ds.items():
            for e in lst:
                if not e.get("n") or e.get("e") not in LABELS or not isinstance(e.get("p"), int):
                    stop("%s/%s: an entry has no name, no register project number or no evidence label" % (dev, dist))
                if "ppsm" in e or "price" in e:
                    stop("%s: an entry must carry no price-per-area field (nothing here is priced per area)" % e["n"])
                if ("pmin" in e or "pmax" in e) and not (e.get("np", 0) >= 5 and e.get("pmin") is not None and e.get("pmax") is not None and e["pmin"] <= e["pmax"]):
                    stop("%s: a price range needs five or more priced sales" % e["n"])
                n += 1
    if not n:
        stop("the file holds no entries")
    if (d.get("meta") or {}).get("count") != n:
        stop("the file says %s entries and holds %d" % ((d.get("meta") or {}).get("count"), n))
    print("  file ok: %d bytes, %d entries" % (size, n))
    return d


def live_get(key):
    """the live value through the worker's /img route; None = 404 (no value). Python urllib needs a User-Agent."""
    u = LIVE + "/img/" + key[len("img_"):] + "?cb=" + str(int(time.time() * 1000))
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "najma-ops/1.0"}), timeout=60) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        stop("reading %s through %s failed: HTTP %d" % (key, u, e.code))
    except Exception as e:
        stop("reading %s through %s failed: %s" % (key, u, e))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--apply", "-Apply", action="store_true", help="write the key (default is a dry run)")
    ap.add_argument("--replace", "-Replace", action="store_true", help="replace an existing value (it is backed up first)")
    ap.add_argument("--file", default="")
    ap.add_argument("--work", default="")
    ap.add_argument("--skip-gate", "-SkipGate", action="store_true", help="publish UNGATED (loud warning)")
    a = ap.parse_args()
    fpath = a.file or FILE
    if a.apply:
        quiet_window()
    work = a.work or os.path.join(tempfile.gettempdir(), KEY + "_" + time.strftime("%Y%m%d_%H%M%S"))
    os.makedirs(work, exist_ok=True)
    bk = os.path.join(os.path.dirname(work), "devmap_backups")
    os.makedirs(bk, exist_ok=True)
    print("Work folder: " + work)
    print("1/4 validating " + fpath)
    want = validate(fpath)
    print("2/4 completeness gate guard")
    import gate_guard   # HARD STOP: a block exits 1 before anything is written; a missing guard is an ImportError = no publish
    gate_guard.enforce("regcards", fpath, apply=a.apply, skip=a.skip_gate)
    print("3/4 reading the live key through the live /img route (read-only)")
    raw = live_get(KEY)
    backup = os.path.join(work, KEY + ".backup.json")
    if raw is not None:
        if not a.replace:
            stop("%s already holds a value. Nothing was written. Use --replace to overwrite it (the old value is backed up first)." % KEY)
        open(backup, "wb").write(raw)
        stamp = os.path.join(bk, KEY + "_before_v401_" + time.strftime("%Y%m%d_%H%M%S") + ".json")
        open(stamp, "wb").write(raw)
        print("  backed up the live value to " + stamp)
    else:
        print("  no live value yet (first publish)")
    rb = ("npx wrangler kv key put %s --path \"%s\" --env %s --namespace-id %s" % (KEY, backup, ENVN, NS)) if raw is not None else ("npx wrangler kv key delete %s --env %s --namespace-id %s" % (KEY, ENVN, NS))
    if not a.apply:
        print("\nDRY RUN: nothing written to the live store. It would put %s (%d KB)." % (KEY, round(os.path.getsize(fpath) / 1024)))
        print("Roll-back line it would print (from %s):\n  %s" % (WORKER, rb))
        return
    print("4/4 putting")
    npx = shutil.which("npx.cmd") or shutil.which("npx") or "npx"
    r = subprocess.run([npx, "wrangler", "kv", "key", "put", KEY, "--path", fpath, "--env", ENVN, "--namespace-id", NS], cwd=WORKER, capture_output=True, text=True)
    if r.returncode != 0:
        stop("wrangler kv key put failed (exit %d):\n%s" % (r.returncode, (r.stdout or "") + (r.stderr or "")))
    print("  put %s (%d KB)" % (KEY, round(os.path.getsize(fpath) / 1024)))
    deadline, same = time.time() + 70, False
    while True:
        time.sleep(5)
        back = live_get(KEY)
        if back is not None and json.loads(back.decode("utf8")) == want:
            same = True
            break
        if time.time() > deadline:
            break
    if not same:
        print("\nTHE READ-BACK THROUGH THE LIVE /img ROUTE DID NOT MATCH THE FILE WITHIN 70 s. Re-check once, then roll back. From %s:\n  %s" % (WORKER, rb))
        sys.exit(1)
    print("  verified through the live /img route: the live value equals the file")
    print("\nDONE. To roll back (from %s):\n  %s" % (WORKER, rb))


if __name__ == "__main__":
    main()
