"""v380 - PUBLISH KV img_centres2040: our grouping of Dubai Municipality communities into the five Dubai 2040 centres, the coastal layer and the stock per centre.

KENDALL APPROVES, THEN THIS RUNS. Claude has NOT run it (it was only syntax-checked). It writes ONE production KV key, and only when told to.
Dry run is the DEFAULT: it validates the local file, reads the live key (read-only) and prints what it would do. Nothing is written.

  python scripts/publish_centres2040.py                      dry run
  python scripts/publish_centres2040.py --apply              put the key (refuses if a value is already there)
  python scripts/publish_centres2040.py --apply --replace    replace an existing value (the old one is backed up first)
  options: --file <centres2040.json>  --work <dir>      (the PowerShell spellings -Apply and -Replace work too)

What it does, in order (it stops at the first failure and prints the real error):
  0  with --apply, refuses to run 04:00-06:15 Dubai time (the morning chain) or while Najma_Daily_Refresh / Najma_Avail_Sweep is Running
  1  validates the file: size under 600 KB, five centres with numbers and bounds, communities, the slug table, drawn polygons,
     the grouping label and the source line, and that every registered home is in a centre or in 'outside'
  2  reads the live img_centres2040 (read-only, scripts/kv_read_live.mjs). A value is there and no --replace: STOP. With --replace it is
     backed up to <work> and to <work>/../devmap_backups first
  3  --apply only: puts the key (wrangler kv key put, no --remote flag: wrangler 3.114.17 rejects it), reads it back and compares it with the file
  4  prints the ROLLBACK line (restore the backup, or delete the key when there was none)
The page reads the key through GET /developers_map_api?what=centres. Absent key = the page keeps the old opening (price bands). Nothing else reads it.
"""
import argparse, datetime, json, os, subprocess, sys, tempfile, time

NS = "2cdf36a27f834b5f9c726294d36770fb"
ENVN = "azimuth2"
WORKER = r"C:\Dev\azimuth-worker-dewa"
KEY = "img_centres2040"
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DEFAULT_FILE = os.path.join(REPO, "data", "centres2040", "centres2040.json")
LIMIT = 600 * 1024


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
        stop("the file is %d bytes, over the 600 KB limit" % size)
    d = json.load(open(path, encoding="utf8"))
    cs = d.get("centres") or []
    if len(cs) != 5 or [c.get("id") for c in cs] != [1, 2, 3, 4, 5]:
        stop("the file must hold the five centres, ids 1 to 5")
    for c in cs:
        for k in ("name", "role", "colour", "units", "units_all", "share", "lab", "bbox"):
            if c.get(k) in (None, "", []):
                stop("centre %s has no %s" % (c.get("id"), k))
    if not d.get("comms") or not d.get("sl") or not (d.get("geo") or {}).get("features"):
        stop("communities, the slug table or the drawn polygons are missing")
    if not d.get("grouping") or "not their boundaries" not in d["grouping"] or "Dubai 2040 Urban Master Plan" not in (d.get("source") or ""):
        stop("the grouping label or the source line is missing")
    tot = sum(c["units_all"] for c in cs) + d.get("outside_units", -1)
    if tot != d.get("total_units"):
        stop("centres plus outside (%s) do not add up to the total (%s)" % (tot, d.get("total_units")))
    print("  file ok: %d bytes, 5 centres, %d communities, %d slug keys, %d polygons, tolerance %s m" % (size, len(d["comms"]), len(d["sl"]), len(d["geo"]["features"]), d.get("tol_m")))
    return d


def node_read(out, allow_missing):
    cmd = ["node", os.path.join(REPO, "scripts", "kv_read_live.mjs"), KEY, out] + (["--allow-missing"] if allow_missing else [])
    r = subprocess.run(cmd, capture_output=True, text=True)
    txt = (r.stdout + r.stderr).strip()
    if r.returncode != 0:
        stop("reading %s failed:\n%s" % (KEY, txt))
    print("  " + txt)
    return os.path.exists(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--apply", "-Apply", action="store_true", help="write the key (default is a dry run)")
    ap.add_argument("--replace", "-Replace", action="store_true", help="replace an existing value (it is backed up first)")
    ap.add_argument("--file", default=DEFAULT_FILE)
    ap.add_argument("--work", default="")
    a = ap.parse_args()
    if a.apply:
        quiet_window()
    work = a.work or os.path.join(tempfile.gettempdir(), "centres2040_" + time.strftime("%Y%m%d_%H%M%S"))
    os.makedirs(work, exist_ok=True)
    bk = os.path.join(os.path.dirname(work), "devmap_backups")
    os.makedirs(bk, exist_ok=True)
    print("Work folder: " + work)
    print("1/3 validating " + a.file)
    validate(a.file)
    print("2/3 reading the live key (read-only)")
    backup = os.path.join(work, "centres2040.backup.json")
    had = node_read(backup, True)
    if had:
        if not a.replace:
            stop("%s already holds a value. Nothing was written. Use --replace to overwrite it (the old value is backed up first)." % KEY)
        stamp = os.path.join(bk, "img_centres2040_before_v380_" + time.strftime("%Y%m%d_%H%M%S") + ".json")
        open(stamp, "wb").write(open(backup, "rb").read())
        print("  backed up the live value to " + stamp)
    else:
        print("  no live value yet (first publish)")
    rb = ("npx wrangler kv key put %s --path \"%s\" --env %s --namespace-id %s" % (KEY, backup, ENVN, NS)) if had else ("npx wrangler kv key delete %s --env %s --namespace-id %s" % (KEY, ENVN, NS))
    if not a.apply:
        print("\nDRY RUN: nothing written to the live store. It would put %s (%d KB)." % (KEY, round(os.path.getsize(a.file) / 1024)))
        print("Roll-back line it would print (from %s):\n  %s" % (WORKER, rb))
        return
    print("3/3 putting")
    log = os.path.join(tempfile.gettempdir(), "kvput_" + time.strftime("%H%M%S") + ".log")
    r = subprocess.run('cmd /c "npx wrangler kv key put %s --path \\"%s\\" --env %s --namespace-id %s > \\"%s\\" 2>&1"' % (KEY, a.file, ENVN, NS, log), cwd=WORKER, shell=True)
    txt = open(log, encoding="utf8", errors="replace").read() if os.path.exists(log) else ""
    if r.returncode != 0:
        stop("wrangler kv key put failed (exit %d):\n%s" % (r.returncode, txt))
    print("  put %s (%d KB)" % (KEY, round(os.path.getsize(a.file) / 1024)))
    back = os.path.join(work, "centres2040.live_after.json")
    node_read(back, False)
    if json.load(open(back, encoding="utf8")) != json.load(open(a.file, encoding="utf8")):
        print("\nTHE READ-BACK DOES NOT MATCH THE FILE. Roll back now (from %s):\n  %s" % (WORKER, rb))
        sys.exit(1)
    print("  verified: the live value equals the file")
    print("\nDONE. To roll back (from %s):\n  %s" % (WORKER, rb))


if __name__ == "__main__":
    main()
