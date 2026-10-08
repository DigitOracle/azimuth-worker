"""v414 - PUBLISH a developer's renders (data/developer_claims/<slug>/render_*.jpg -> KV img_dev_render_<slug>_<n> and img_ct_dev_render_<slug>_<n>). KENDALL APPROVES, THEN KENDALL RUNS THIS. Claude has NOT run it.
Dry run is the DEFAULT: it checks the permission, validates the files, runs the completeness gate guard, reads each live key through the worker's own /img route (read-only) and prints what it would do.

  python scripts/publish_dev_renders.py --slug kore                 dry run
  add --apply to put the keys (refuses a key that already holds a value); add --apply --replace to replace (the old value is backed up first)
  options: --work <dir>  --skip-gate

THE PERMISSION GATE: it REFUSES (exit 1, nothing read, nothing written, even as a dry run's final verdict) unless data/developer_claims/<slug>_*.json says render_permission.status == "on_file".
Flipping it is a one-line edit by the owner (status "on_file", set_by, date), then regenerate src/dev_claims_data.js (node scripts/gen_dev_claims_js.mjs), then this script, then the worker release that reads it.
The Client sheet (/brief_pdf?kind=dossier&keys=dev:<slug>) shows pictures only when the Worker was built with "on_file" AND the keys are published; while "pending" it says the pictures are withheld.

Order (stops at the first failure):
  0  permission on file, else STOP;  with --apply, refuses 04:00-06:15 Dubai time and while Najma_Daily_Refresh / Najma_Avail_Sweep is Running
  1  validates the files (JPEG, long edge <= 1600 px, size, no person-page names from renders_not_stored)
  2  the completeness gate guard (scripts/gate_guard.py, no layer: proves the live gate state is unchanged)
  3  reads each live key through GET <worker>/img/<name> (404 = no value); a value and no --replace: STOP; with --replace it is backed up first
  4  --apply: puts the image and its content type (argument LISTS, no shell), then reads each back through the live /img route, waiting up to 70 s
  5  prints the ROLLBACK lines
"""
import argparse, datetime, glob, json, os, shutil, subprocess, sys, tempfile, time, urllib.request, urllib.error

NS = "2cdf36a27f834b5f9c726294d36770fb"
ENVN = "azimuth2"
WORKER = r"C:\Dev\azimuth-worker-dewa"
LIVE = "https://azimuth-2.digitalchemy.workers.dev"
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
sys.path.insert(0, HERE)
LIMIT = 700 * 1024


def stop(msg):
    print("\nSTOPPED: " + msg)
    sys.exit(1)


def load_claims(slug):
    for p in sorted(glob.glob(os.path.join(REPO, "data", "developer_claims", "*.json"))):
        j = json.load(open(p, encoding="utf8"))
        if j.get("key") == slug:
            return j
    stop("no developer claims file for slug '%s'" % slug)


def check_permission(c):
    """The gate. Returns only when render_permission.status is exactly 'on_file'."""
    rp = c.get("render_permission") or {}
    if rp.get("status") != "on_file":
        stop("render_permission.status is '%s', not 'on_file': the developer's written permission is not on file, so no picture is published. Nothing was read or written." % rp.get("status"))
    return rp


def quiet_window():
    now = datetime.datetime.utcnow() + datetime.timedelta(hours=4)
    if 240 <= now.hour * 60 + now.minute < 375:
        stop("it is %s Dubai: the 04:00-06:15 morning chain window. Run this after 06:15." % now.strftime("%H:%M"))
    for t in ("Najma_Daily_Refresh", "Najma_Avail_Sweep"):
        r = subprocess.run(["powershell", "-NoProfile", "-Command", "(Get-ScheduledTask -TaskName %s -ErrorAction SilentlyContinue).State" % t], capture_output=True, text=True)
        if r.stdout.strip() == "Running":
            stop("%s is Running. Wait for it to finish." % t)


def jpeg_size(b):
    i = 2
    while i + 9 < len(b):
        if b[i] != 0xFF:
            i += 1
            continue
        m = b[i + 1]
        if 0xC0 <= m <= 0xCF and m not in (0xC4, 0xC8, 0xCC):
            return (b[i + 7] << 8) | b[i + 8], (b[i + 5] << 8) | b[i + 6]
        i += 2 + ((b[i + 2] << 8) | b[i + 3])
    return None


def validate(c):
    items = []
    for r in c.get("renders") or []:
        p = os.path.join(REPO, "data", "developer_claims", r["file"])
        if not os.path.exists(p):
            stop("the file is not there: " + p)
        b = open(p, "rb").read()
        if len(b) > LIMIT:
            stop("%s is %d bytes, over the %d KB limit" % (r["file"], len(b), LIMIT // 1024))
        if b[:2] != b"\xff\xd8":
            stop(r["file"] + " is not a JPEG")
        sz = jpeg_size(b)
        if not sz or max(sz) > 1600:
            stop("%s: long edge is over 1600 px (%s)" % (r["file"], sz))
        if not r.get("kv", "").startswith("dev_render_"):
            stop("%s: kv name must start with dev_render_" % r["file"])
        items.append((r["kv"], p, b))
        print("  ok: %s %s %d bytes" % (r["file"], sz, len(b)))
    if not items:
        stop("the claims file lists no renders")
    return items


def live_get(name):
    u = LIVE + "/img/" + name + "?cb=" + str(int(time.time() * 1000))
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "najma-ops/1.0"}), timeout=60) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        stop("reading %s failed: HTTP %d" % (u, e.code))
    except Exception as e:
        stop("reading %s failed: %s" % (u, e))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--slug", required=True)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--replace", action="store_true")
    ap.add_argument("--work", default="")
    ap.add_argument("--skip-gate", action="store_true")
    a = ap.parse_args()
    c = load_claims(a.slug)
    print("0/4 picture permission")
    rp = check_permission(c)
    print("  on file (set by %s, %s)" % (rp.get("set_by"), rp.get("date")))
    if a.apply:
        quiet_window()
    work = a.work or os.path.join(tempfile.gettempdir(), "dev_render_%s_%s" % (a.slug, time.strftime("%Y%m%d_%H%M%S")))
    os.makedirs(work, exist_ok=True)
    print("1/4 validating the files")
    items = validate(c)
    print("2/4 completeness gate guard")
    import gate_guard
    gate_guard.enforce({}, apply=a.apply, skip=a.skip_gate)
    print("3/4 reading the live keys through the live /img route (read-only)")
    plan, rb = [], []
    for name, p, b in items:
        raw = live_get(name)
        if raw is not None:
            if not a.replace:
                stop("img_%s already holds a value. Nothing was written. Use --replace (the old value is backed up first)." % name)
            bk = os.path.join(work, name + ".backup.jpg")
            open(bk, "wb").write(raw)
            rb.append("npx wrangler kv key put img_%s --path \"%s\" --env %s --namespace-id %s" % (name, bk, ENVN, NS))
        else:
            rb.append("npx wrangler kv key delete img_%s --env %s --namespace-id %s" % (name, ENVN, NS))
            rb.append("npx wrangler kv key delete img_ct_%s --env %s --namespace-id %s" % (name, ENVN, NS))
        plan.append((name, p, b))
    if not a.apply:
        print("\nDRY RUN: nothing written. It would put %d images (and their content types)." % len(plan))
        print("Roll-back lines it would print (from %s):\n  " % WORKER + "\n  ".join(rb))
        return
    npx = shutil.which("npx.cmd") or shutil.which("npx") or "npx"
    ctf = os.path.join(work, "ct.txt")
    open(ctf, "w").write("image/jpeg")
    print("4/4 putting")
    for name, p, b in plan:
        for key, path in (("img_" + name, p), ("img_ct_" + name, ctf)):
            r = subprocess.run([npx, "wrangler", "kv", "key", "put", key, "--path", path, "--env", ENVN, "--namespace-id", NS], cwd=WORKER, capture_output=True, text=True)
            if r.returncode != 0:
                stop("wrangler kv key put %s failed (exit %d):\n%s" % (key, r.returncode, (r.stdout or "") + (r.stderr or "")))
        print("  put img_" + name)
    deadline = time.time() + 70
    pend = {n: b for n, p, b in plan}
    while pend and time.time() < deadline:
        time.sleep(5)
        for n in list(pend):
            if live_get(n) == pend[n]:
                del pend[n]
                print("  verified through the live /img route: " + n)
    if pend:
        print("\nREAD-BACK DID NOT MATCH within 70 s for: %s. Re-check once, then roll back. From %s:\n  %s" % (", ".join(pend), WORKER, "\n  ".join(rb)))
        sys.exit(1)
    print("\nDONE. To roll back (from %s):\n  %s" % (WORKER, "\n  ".join(rb)))


if __name__ == "__main__":
    main()
