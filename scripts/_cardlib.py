"""v387 - shared, OFFLINE helpers for the card-position ladder (build_community_positions.py, card_position_ledger.py).
Read-only: nothing here writes KV, a blocks file or anything under the shared market-pulse repo.

  pkey / locate      the page's own name match (src/devmap_page.js), ported 1:1 from the 7 Oct audit's build_ledger.py
  load_index         the developer index (/img/devmap_index): a local file, or --live (read-only kv_read_live.mjs into a work folder)
  load_blocks        the district blocks files (/img/blocks_<slug>): a local folder, or --live
  enumerate_cards    every project card of the index (both windows and the biggest-projects lists), deduped by district + name
  card_key           district|pkey(name): the key of the community and plot-centre files for a card (a project number is NOT needed)
"""
import csv, glob, json, os, re, subprocess, sys, tempfile, time

NMP = r"C:\Dev\naj-market-pulse"
AUDIT = os.path.join(NMP, "docs", "CARD_MAP_POSITION_AUDIT_07OCT2026")
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DATA = os.path.join(NMP, "data")


def J(p, d=None):
    try:
        with open(p, encoding="utf8") as f:
            return json.load(f)
    except Exception:
        return d


def pkey(n):
    s = str(n or "").lower()
    s = re.sub(r"\s+by\s+.*$", "", s)
    return re.sub(r"[^a-z0-9\u0600-\u06ff]+", "", s)


def norm(n):
    return re.sub(r"\s+", " ", str(n or "")).strip().lower()


def fold(s):
    return re.sub(r"[^a-z0-9]+", "", str(s or "").lower())


def card_key(slug, name):
    return "%s|%s" % (slug, pkey(name))


def locate(feats, name):
    k = pkey(name)
    out = []
    if len(k) >= 3:
        for f in feats:
            fk = f["k"]
            if not fk:
                continue
            if fk == k or (min(len(fk), len(k)) >= 8 and (k in fk or fk in k)):
                out.append(f)
    return out


GZ = {}      # key -> True when the live value was stored gzipped (the last kv_read of it)
NS = "2cdf36a27f834b5f9c726294d36770fb"
WORKER = r"C:\Dev\azimuth-worker-dewa"


def kv_read(key, out, allow_missing=False):
    """READ-ONLY live KV read (wrangler kv key get, BINARY-safe: the blocks keys are stored gzipped and a --text read corrupts them; scripts/kv_read_live.mjs uses --text).
    Writes the plain JSON text to `out`; records in GZ whether the stored value was gzipped. True when a file was written."""
    import gzip, shutil
    env = dict(os.environ)
    env["NODE_OPTIONS"] = "--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=5000"
    npx = shutil.which("npx.cmd") or shutil.which("npx") or "npx"
    r = subprocess.run([npx, "wrangler", "kv", "key", "get", key, "--env", "azimuth2", "--namespace-id", NS], cwd=WORKER, capture_output=True, env=env)
    raw = r.stdout
    if r.returncode != 0 or not raw:
        msg = (r.stderr or b"").decode("utf8", "replace") + raw[:200].decode("utf8", "replace")
        if allow_missing and re.search(r"not found|does not exist|10009", msg, re.I):
            print(key + ": MISSING (no value on file)")
            return False
        raise SystemExit("reading %s failed:\n%s" % (key, msg.strip()))
    GZ[key] = raw[:2] == b"\x1f\x8b"
    buf = gzip.decompress(raw) if GZ[key] else raw
    txt = buf.decode("utf8")
    at = min([i for i in (txt.find("{"), txt.find("[")) if i >= 0] or [-1])
    if at < 0:
        if allow_missing and re.search(r"value not found", txt, re.I):
            print(key + ": MISSING (no value on file)")
            return False
        raise SystemExit("%s: the value is not JSON (first 200 chars): %s" % (key, txt[:200]))
    with open(out, "w", encoding="utf8", newline="") as f:
        f.write(txt[at:])
    return True


def load_index(path=None, live=False, work=None):
    if live:
        work = work or tempfile.mkdtemp(prefix="cards_live_")
        os.makedirs(work, exist_ok=True)
        path = os.path.join(work, "devmap_index.json")
        kv_read("img_devmap_index", path)
    path = path or os.path.join(AUDIT, "idx.json")
    d = J(path)
    if not d or "areas" not in d:
        raise SystemExit("not a developer index: " + str(path))
    return d, path


def block_feats(fc):
    feats = []
    for x in (fc or {}).get("features", []):
        q = x.get("properties") or {}
        if q.get("k") == "b" and x.get("geometry"):
            feats.append({"i": q.get("i"), "n": q.get("n") or "", "k": pkey(q.get("n"))})
    return feats


def load_blocks(slugs, blocks_dir=None, live=False, work=None):
    """slug -> list of {i, n, k} (building features with a geometry). Missing file = empty list (and listed in the second result)."""
    out, missing = {}, []
    if live:
        work = work or tempfile.mkdtemp(prefix="cards_live_")
        blocks_dir = os.path.join(work, "_blocks")
        os.makedirs(blocks_dir, exist_ok=True)
        for s in slugs:
            kv_read("img_blocks_" + s, os.path.join(blocks_dir, s + ".json"), allow_missing=True)
    blocks_dir = blocks_dir or os.path.join(AUDIT, "_blocks")
    for s in slugs:
        fc = J(os.path.join(blocks_dir, s + ".json"))
        if fc is None:
            missing.append(s)
        out[s] = block_feats(fc)
    return out, missing, blocks_dir


def enumerate_cards(idx):
    """key (district, norm(name)) -> card. The page turns three lists into cards: b (all years), b12 (last 12 months) and ev.top (biggest projects here)."""
    areas = idx["areas"]
    cards = {}

    def add(slug, name, n_all=None, n_l12=None, dev=None, devname=None, p=None, a=None, asrc=None, src=""):
        if not name:
            return None
        key = (slug, norm(name))
        c = cards.setdefault(key, {"slug": slug, "name": name.strip(), "n_all": 0, "n_l12": 0, "devs": {}, "p": set(), "src": set(), "win_all": 0, "win_l12": 0, "areas": {}})
        if n_all:
            c["n_all"] = max(c["n_all"], n_all)
        if n_l12:
            c["n_l12"] = max(c["n_l12"], n_l12)
        if dev:
            c["devs"][dev] = devname
        if p:
            c["p"].add(p)
        if a:
            c["areas"][(a, asrc or "")] = c["areas"].get((a, asrc or ""), 0) + 1
        c["src"].add(src)
        return c

    for slug, a in areas.items():
        for dk, d in a["devs"].items():
            dn = d.get("n") or dk
            bx = d.get("bx") or []
            b12x = d.get("b12x") or []
            for i, b in enumerate(d.get("b") or []):
                x = bx[i] if i < len(bx) and bx[i] else {}
                c = add(slug, b[2], n_all=b[0], dev=dk, devname=dn, p=x.get("p"), a=x.get("a"), asrc=x.get("as"), src="b")
                if c:
                    c["win_all"] = 1
            for i, b in enumerate(d.get("b12") or []):
                x = b12x[i] if i < len(b12x) and b12x[i] else {}
                c = add(slug, b[2], n_l12=b[0], dev=dk, devname=dn, p=x.get("p"), a=x.get("a"), asrc=x.get("as"), src="b12")
                if c:
                    c["win_l12"] = 1
            for t in ((d.get("ev") or {}).get("top") or []):
                add(slug, t[0], n_all=t[1], n_l12=t[3], dev=dk, devname=dn, src="ev.top")
            if d.get("b12") is None:
                for b in d.get("b") or []:
                    k = (slug, norm(b[2]))
                    if k in cards:
                        cards[k]["win_l12"] = 1
    for c in cards.values():
        c["n_all"] = max(c["n_all"], c["n_l12"])        # 12-month sales are a subset of all-year sales
    return cards


def card_area(c):
    """the card's own area label: the one its project records carry (bx.a), most frequent first, then alphabetical (deterministic). (label, source) or (None, None)."""
    if not c["areas"]:
        return None, None
    (a, s), _ = sorted(c["areas"].items(), key=lambda kv: (-kv[1], kv[0][0], kv[0][1]))[0]
    return a, s


def project_numbers_from_register(cards, data=DATA):
    """the register project number for a card with none in the index: the audit's own fallbacks (unmapped audit file, then the project register by name). Adds to c['p'] and c['st']."""
    status_by_no, pn_name, area_by_no = {}, {}, {}
    f = os.path.join(data, "projects-2026-09-01.csv")
    if os.path.exists(f):
        for r in csv.DictReader(open(f, encoding="utf-8-sig", errors="replace")):
            no = str(r["PROJECT_NUMBER"]).strip()
            status_by_no[no] = r["PROJECT_STATUS"]
            area_by_no[no] = r.get("AREA_EN") or ""
            pn_name[pkey(r["PROJECT_EN"])] = (no, r["PROJECT_STATUS"], r["AREA_EN"])
    unm = {}
    for fp in glob.glob(os.path.join(data, "audit", "unmapped", "unmapped_*.json")):
        d = J(fp) or {}
        s = d.get("district") or os.path.basename(fp)[9:-5]
        for p in d.get("projects", []):
            unm.setdefault(s, {})[pkey(p.get("project"))] = p
    for c in cards.values():
        p = sorted(c["p"])
        st = status_by_no.get(str(p[0])) if p else None
        u = unm.get(c["slug"], {}).get(pkey(c["name"]))
        if u:
            st = st or u.get("status")
            if not p and u.get("project_number"):
                p = [u["project_number"]]
        if st is None and pkey(c["name"]) in pn_name:
            st = pn_name[pkey(c["name"])][1]
            if not p:
                p = [pn_name[pkey(c["name"])][0]]
        c["p"] = set(str(x) for x in p)
        c["st"] = st or ""
        c["reg_area"] = (area_by_no.get(sorted(c["p"])[0], "") or (pn_name.get(pkey(c["name"]), ("", "", ""))[2] if not p else "")) if c["p"] else ""
    return status_by_no


def dubai_now():
    import datetime
    return datetime.datetime.utcnow() + datetime.timedelta(hours=4)


def stop(msg):
    print("\nSTOPPED: " + msg)
    sys.exit(1)


def quiet_window():
    """04:00-06:15 Dubai is the morning chain; a Najma task running is a second refusal. Shared by every script here that writes to KV."""
    now = dubai_now()
    mins = now.hour * 60 + now.minute
    if 240 <= mins < 375:
        stop("it is %s Dubai: the 04:00-06:15 morning chain window. Run this after 06:15." % now.strftime("%H:%M"))
    for t in ("Najma_Daily_Refresh", "Najma_Avail_Sweep"):
        r = subprocess.run(["powershell", "-NoProfile", "-Command", "(Get-ScheduledTask -TaskName %s -ErrorAction SilentlyContinue).State" % t], capture_output=True, text=True)
        if r.stdout.strip() == "Running":
            stop("%s is Running. Wait for it to finish." % t)
