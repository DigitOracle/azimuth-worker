"""v397c - PUBLISH KV img_community_positions_p: the community-centre position by REGISTER PROJECT NUMBER for every project with no building outline and no plot centre
(scripts/build_community_positions_p.py -> data/community_positions/community_positions_projects.json).

KENDALL APPROVES, THEN THIS RUNS. Claude has NOT run it with --apply (the dry run only). It writes ONE production KV key, and only when told to.
Dry run is the DEFAULT: it validates the local file, reads the live key through the public /img route (read-only) and prints what it would do. Nothing is written.

  python scripts/publish_community_positions_p.py                      dry run
  python scripts/publish_community_positions_p.py --apply              put the key (REFUSES if a value is already there)
  python scripts/publish_community_positions_p.py --apply --replace    replace an existing value (the old one is backed up first, from the live route)
  options: --file <community_positions_projects.json>  --work <dir>      (the PowerShell spellings -Apply and -Replace work too)

Order (it stops at the first failure and prints the real error):
  0  --apply refuses to run 04:00-06:15 Dubai time (the morning chain) or while Najma_Daily_Refresh / Najma_Avail_Sweep is Running
  1  validates the file: under 2 MB (a warning above 400 KB), every community a point inside Dubai with evidence DERIVED and basis community_polygon, every entry keyed p:<digits>, pointing at a
     known community, its label starting 'Community centre: ' and saying the exact plot is not in our data yet
  2  backs up the live value through GET /img/community_positions_p (404 = none). A value is there and no --replace: STOP.
  3  --apply only: puts the key (wrangler argument list, no shell), then reads it back THROUGH THE LIVE ROUTE (retries up to 90 s) and compares with the file
  4  prints the ROLLBACK line (restore the backup, or delete the key when there was none)
The page reads the key through GET /developers_map_api?what=commposp. Absent key = the page is v395.
"""
import argparse, datetime, gzip, json, os, shutil, subprocess, sys, tempfile, time, urllib.request

NS = "2cdf36a27f834b5f9c726294d36770fb"
ENVN = "azimuth2"
WORKER = r"C:\Dev\azimuth-worker-dewa"
KEY = "img_community_positions_p"
LIVE = "https://azimuth-2.digitalchemy.workers.dev/img/community_positions_p"
UA = {"User-Agent": "najma-ops/1.0"}
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DEFAULT_FILE = os.path.join(REPO, "data", "community_positions", "community_positions_projects.json")
LIMIT = 2 * 1024 * 1024
SOFT = 400 * 1024


def stop(msg):
    print("\nSTOPPED: " + msg)
    sys.exit(1)


def dubai_minutes():
    now = datetime.datetime.utcnow() + datetime.timedelta(hours=4)
    return now.hour * 60 + now.minute, now.strftime("%H:%M")


def quiet_window():
    mins, hhmm = dubai_minutes()
    if 240 <= mins < 375:
        stop("it is %s Dubai: the 04:00-06:15 morning chain window. Run this after 06:15." % hhmm)
    for t in ("Najma_Daily_Refresh", "Najma_Avail_Sweep"):
        r = subprocess.run(["powershell", "-NoProfile", "-Command", "(Get-ScheduledTask -TaskName %s -ErrorAction SilentlyContinue).State" % t], capture_output=True, text=True)
        if r.stdout.strip() == "Running":
            stop("%s is Running. Wait for it to finish." % t)


def validate(path):
    if not os.path.exists(path):
        stop("the file is not there: " + path)
    size = os.path.getsize(path)
    if size > LIMIT:
        stop("the file is %d bytes, over the 2 MB limit" % size)
    if size > SOFT:
        print("  WARNING: %d bytes is over the 400 KB target: shard by district before publishing" % size)
    d = json.load(open(path, encoding="utf8"))
    c, p = d.get("c"), d.get("p")
    if not isinstance(c, dict) or not isinstance(p, dict) or not p:
        stop("the file holds no community positions (c, p)")
    for k, e in c.items():
        if not (54.5 <= e.get("lon", 0) <= 56.6 and 24.0 <= e.get("lat", 0) <= 25.6):
            stop("community %s has a position outside Dubai" % k)
        if e.get("evidence") != "DERIVED" or e.get("basis") != "community_polygon":
            stop("community %s: evidence / basis is not DERIVED / community_polygon" % k)
    for k, e in p.items():
        if not (k.startswith("p:") and k[2:].isdigit()):
            stop("key %r is not p:<register project number>" % k)
        if e.get("c") not in c:
            stop("project %s points at community %s, which is not in the file" % (k, e.get("c")))
        lab = e.get("l") or ""
        if not lab.startswith("Community centre: ") or "The exact plot is not in our data yet." not in lab:
            stop("project %s: the label does not say it is a community centre and that the exact plot is not in our data yet" % k)
        if "building" in lab.lower() and "not" not in lab.lower():
            stop("project %s: the label claims a building" % k)
    print("  file ok: %d bytes, %d project positions in %d communities, as of %s" % (size, len(p), len(c), (d.get("meta") or {}).get("as_of")))
    return d


def live_read():
    """the live value through the public /img route: (bytes of the JSON text, None) or (None, None) on 404"""
    last = None
    for k in range(3):
        try:
            b = urllib.request.urlopen(urllib.request.Request(LIVE, headers=UA), timeout=60).read()
            if b[:2] == b"\x1f\x8b":
                b = gzip.decompress(b)
            return b
        except Exception as e:
            if getattr(e, "code", None) == 404:
                return None
            last = e
            time.sleep(1 + k)
    stop("reading the live route failed: %s" % last)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--apply", "-Apply", action="store_true", help="write the key (default is a dry run)")
    ap.add_argument("--replace", "-Replace", action="store_true", help="replace an existing value (it is backed up first)")
    ap.add_argument("--file", default=DEFAULT_FILE)
    ap.add_argument("--work", default="")
    ap.add_argument("--skip-gate", "-SkipGate", action="store_true", help="publish UNGATED (the completeness gate is a hard stop; this prints a loud warning)")
    a = ap.parse_args()
    if a.apply:
        quiet_window()
    work = a.work or os.path.join(tempfile.gettempdir(), "community_positions_p_" + time.strftime("%Y%m%d_%H%M%S"))
    os.makedirs(work, exist_ok=True)
    print("Work folder: " + work)
    print("1/3 validating " + a.file)
    validate(a.file)
    import gate_guard   # v397g HARD STOP: scripts/gate_guard.py runs the completeness gate with this file substituted; a block exits 1 before anything is written (a missing guard is an ImportError = no publish)
    gate_guard.enforce("community_positions_p", a.file, apply=a.apply, skip=a.skip_gate)
    print("2/3 reading the live key through the /img route (read-only)")
    live = live_read()
    backup = os.path.join(work, "community_positions_p.backup.json")
    if live is not None:
        open(backup, "wb").write(live)
        print("  a live value is there (%d bytes), backed up to %s" % (len(live), backup))
        if not a.replace:
            stop("%s already holds a value. Nothing was written. Use --replace to overwrite it (the old value is backed up first)." % KEY)
    else:
        print("  no live value yet (first publish)")
    rb = ("npx wrangler kv key put %s --path \"%s\" --env %s --namespace-id %s" % (KEY, backup, ENVN, NS)) if live is not None else ("npx wrangler kv key delete %s --env %s --namespace-id %s" % (KEY, ENVN, NS))
    if not a.apply:
        print("\nDRY RUN: nothing written to the live store. It would put %s (%d KB)." % (KEY, round(os.path.getsize(a.file) / 1024)))
        print("Roll-back line it would print (from %s):\n  %s" % (WORKER, rb))
        return
    print("3/3 putting")
    npx = shutil.which("npx.cmd") or shutil.which("npx") or "npx"
    r = subprocess.run([npx, "wrangler", "kv", "key", "put", KEY, "--path", a.file, "--env", ENVN, "--namespace-id", NS], cwd=WORKER, capture_output=True, text=True)
    if r.returncode != 0:
        stop("wrangler kv key put failed (exit %d):\n%s" % (r.returncode, (r.stdout or "") + (r.stderr or "")))
    print("  put %s (%d KB)" % (KEY, round(os.path.getsize(a.file) / 1024)))
    want = json.load(open(a.file, encoding="utf8"))
    got = None
    for k in range(10):
        b = live_read()
        if b is not None:
            try:
                got = json.loads(b)
            except ValueError:
                got = None
            if got == want:
                break
        time.sleep(9)
    if got != want:
        print("\nTHE LIVE ROUTE DOES NOT RETURN THE FILE. Roll back now (from %s):\n  %s" % (WORKER, rb))
        sys.exit(1)
    print("  verified through the live route: the value equals the file")
    print("\nDONE. To roll back (from %s):\n  %s" % (WORKER, rb))


if __name__ == "__main__":
    main()
