"""v386 - PUBLISH KV img_plot_positions: the plot-centre position of project cards that have no building outline (scripts/build_plot_positions.py).

KENDALL APPROVES, THEN THIS RUNS. Claude has NOT run it (it was only syntax-checked). It writes ONE production KV key, and only when told to.
Dry run is the DEFAULT: it validates the local file, reads the live key (read-only) and prints what it would do. Nothing is written.

  python scripts/publish_plot_positions.py                      dry run
  python scripts/publish_plot_positions.py --apply              put the key (refuses if a value is already there)
  python scripts/publish_plot_positions.py --apply --replace    replace an existing value (the old one is backed up first)
  options: --file <plot_positions.json>  --work <dir>      (the PowerShell spellings -Apply and -Replace work too)

What it does, in order (it stops at the first failure and prints the real error):
  0  with --apply, refuses to run 04:00-06:15 Dubai time (the morning chain) or while Najma_Daily_Refresh / Najma_Avail_Sweep is Running
  1  validates the file: size under 600 KB, every entry has lon / lat inside Dubai, parcels, basis makani_plot_outline, evidence DERIVED, link REGISTER_VERIFIED and a label
  2  reads the live img_plot_positions (read-only, scripts/kv_read_live.mjs). A value is there and no --replace: STOP. With --replace it is
     backed up to <work> and to <work>/../devmap_backups first
  3  --apply only: puts the key, reads it back and compares it with the file
  4  prints the ROLLBACK line (restore the backup, or delete the key when there was none)
The page reads the key through GET /developers_map_api?what=plotpos. Absent key = nothing changes on the page.

KNOWN WINDOWS BUG in the put step of the earlier publish scripts: a shell string with embedded quotes ('cmd /c "npx wrangler ... > log 2>&1"') loses its quoting when a path holds a space.
The put here is a LIST of arguments (no shell, no redirection): subprocess.run([npx.cmd, "wrangler", "kv", "key", "put", KEY, "--path", FILE, ...], cwd=WORKER).
"""
import argparse, datetime, json, os, shutil, subprocess, sys, tempfile, time

NS = "2cdf36a27f834b5f9c726294d36770fb"
ENVN = "azimuth2"
WORKER = r"C:\Dev\azimuth-worker-dewa"
KEY = "img_plot_positions"
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DEFAULT_FILE = os.path.join(REPO, "data", "plot_positions", "plot_positions.json")
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
    p = d.get("p")
    if not isinstance(p, dict) or not p:
        stop("the file holds no positions (p)")
    for k, e in p.items():
        if not (54.5 <= e.get("lon", 0) <= 56.6 and 24.0 <= e.get("lat", 0) <= 25.6):
            stop("project %s has a position outside Dubai" % k)
        if not e.get("parcels") or e.get("n_plots") != len(e["parcels"]):
            stop("project %s: parcels missing or n_plots does not match" % k)
        if e.get("basis") != "makani_plot_outline" or e.get("evidence") != "DERIVED" or e.get("link") != "REGISTER_VERIFIED" or not e.get("label"):
            stop("project %s: basis / evidence / link / label is not as required" % k)
        if "building" not in e["label"] or "Plot position" not in e["label"]:
            stop("project %s: the label does not say it is a plot position and not a building" % k)
    print("  file ok: %d bytes, %d positions, as of %s" % (size, len(p), (d.get("meta") or {}).get("as_of")))
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
    work = a.work or os.path.join(tempfile.gettempdir(), "plot_positions_" + time.strftime("%Y%m%d_%H%M%S"))
    os.makedirs(work, exist_ok=True)
    bk = os.path.join(os.path.dirname(work), "devmap_backups")
    os.makedirs(bk, exist_ok=True)
    print("Work folder: " + work)
    print("1/3 validating " + a.file)
    validate(a.file)
    print("2/3 reading the live key (read-only)")
    backup = os.path.join(work, "plot_positions.backup.json")
    had = node_read(backup, True)
    if had:
        if not a.replace:
            stop("%s already holds a value. Nothing was written. Use --replace to overwrite it (the old value is backed up first)." % KEY)
        stamp = os.path.join(bk, "img_plot_positions_before_v386_" + time.strftime("%Y%m%d_%H%M%S") + ".json")
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
    npx = shutil.which("npx.cmd") or shutil.which("npx") or "npx"
    r = subprocess.run([npx, "wrangler", "kv", "key", "put", KEY, "--path", a.file, "--env", ENVN, "--namespace-id", NS], cwd=WORKER, capture_output=True, text=True)
    if r.returncode != 0:
        stop("wrangler kv key put failed (exit %d):\n%s" % (r.returncode, (r.stdout or "") + (r.stderr or "")))
    print("  put %s (%d KB)" % (KEY, round(os.path.getsize(a.file) / 1024)))
    back = os.path.join(work, "plot_positions.live_after.json")
    node_read(back, False)
    if json.load(open(back, encoding="utf8")) != json.load(open(a.file, encoding="utf8")):
        print("\nTHE READ-BACK DOES NOT MATCH THE FILE. Roll back now (from %s):\n  %s" % (WORKER, rb))
        sys.exit(1)
    print("  verified: the live value equals the file")
    print("\nDONE. To roll back (from %s):\n  %s" % (WORKER, rb))


if __name__ == "__main__":
    main()
