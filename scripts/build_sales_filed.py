"""build_sales_filed.py -- UNIT SALES registered with the Land Department, by REGISTRATION day (v396, 7 Oct 2026).

Why. The "Contracts signed" page was built on the Ejari rent feeds only. Kendall: "we have access to both, so we should be able to
say Imtiaz, rentals AND sales for a particular week". The sales side is the Land Department's transactions feed that
naj-market-pulse/scripts/fetch_dld.py pulls every morning (data/transactions-YYYY-MM-DD.csv, plus the two year-to-date files). This
builds the sales twin of build_ejari_filed.py: the same row/field style, the same district and developer rules, basis "registered".

Reads only. Writes only under --out (default <this repo>/data/sales_filed). Publishes nothing (scripts/publish_sales_filed.py does,
and it is Kendall's). Deterministic: the same input files and the same lake snapshot give the same bytes.

What counts as a SALE (and what never does)
  sale      one registered sale of ONE unit: procedure 'Sale' (a finished unit) or 'Sell - Pre registration' (the off-plan registration),
            property type Unit. Residential and commercial units both (flats, villas, hotel apartments, offices, shops).
  land      a plot sold (property type Land, or a Land sub type): counted in its OWN counter, never in sales. (KORE by Imtiaz is one
            land sale and one mortgage, repeated in every daily file.)
  mortgage  a mortgage / lease-finance registration: its own counter. Modifications and transfers are not counted.
  not counted at all, listed in the build report: gifts (group Gifts, procedure Grant ...), whole-building sales, 'Delayed Sell',
            'Sell Development', 'Development Registration', 'Sale On Payment Plan', lease-to-own, and any unit above 20,000 sq m
            with no bedroom count (conservative: a parcel, not a flat).
  Off-plan is the register's own flag (IS_OFFPLAN_EN). 'Sell - Pre registration' is the off-plan REGISTRATION: a first sale and a resale
  of an off-plan unit cannot be told apart in this feed ("not separable"); 'Sale' is a registered sale of a finished unit.

One transaction, many daily files. The same transaction repeats in every daily file, so rows are deduplicated on TRANSACTION_NUMBER +
PROCEDURE_EN and the newest file's values win (names and area labels are re-spelled between files).

District. The register area comes from the lake's transaction register (txn -> area id) where it has reached the transaction, else the
feed's own area label when it is a register area name, else the marketing-name alias (data/dld/area_alias.json), then the same
area -> district pairs build_ejari_daily.district_areas gives (dld_rent_buildings.DLD_AREA first). An area serving two districts is
written under each; the Dubai-wide file counts it once. Areas with no district are in the Dubai-wide file only.

Developer. REGISTER_VERIFIED: the transaction's project number from the lake register, then the register developer of that project number
(lk_project_numbers -> lk_d_project -> lk_d_developer). NAME_ONLY: the project name matched EXACTLY (case and spacing folded) to ONE
project of the Ejari projects index / the register, whose developer is then used; a name that two developers share is not used.
Otherwise the developer is not recorded (null) and the row says so. Nothing is guessed from a similar name.

Output (files only):
  <out>/sales_filed_<district>.json   {as_of, basis:'registered', source, district, caveat, fields, rows:[objects]}
  <out>/sales_filed_dubai.json        {as_of, basis, source, caveat, per_area:{fields,rows}, per_developer:{fields,rows}}
  <out>/_build_report.json            counts, attribution coverage, unmapped areas (not published)
    python scripts/build_sales_filed.py [--pulse C:\\Dev\\naj-market-pulse] [--out DIR] [--days 400] [--no-lake] [--data-dir DIR]
"""
import argparse, glob, gzip, json, os, re, statistics, sys, time
from collections import Counter, defaultdict

sys.dont_write_bytecode = True
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, ".."))

FIELDS = ["date", "district", "area", "dld_project", "project_name_ar", "dld_project_number", "key", "developer_number", "developer",
          "attribution", "kind", "stage", "beds", "sub_type", "usage", "sales", "price_n", "price_median", "price_q1", "price_q3",
          "psm_median", "psm_q1", "psm_q3", "prices", "psm", "master_project"]
AREA_FIELDS = ["date", "area", "district", "kind", "stage", "beds", "sub_type", "sales", "price_n", "price_median", "psm_median", "price_sum"]
VALUE_CAP = 500_000_000   # v440: a single deal above this (whole towers, land banks: up to AED 3.1B) is left out of the total value
SALE_PROCS = {"Sale": "ready", "Sell - Pre registration": "offplan"}
LAND_PROCS = {"Sale", "Delayed Sell", "Sell Development", "Adding Land By Sell", "Sell - Pre registration", "Sale On Payment Plan"}
MORT_SKIP = re.compile(r"modif|transfer", re.I)
BIG_UNIT_SQM = 20000.0
MIN_N = 5            # a median is printed from five sales; fewer says nothing
CAVEAT = ("basis registered: the date is the day the Land Department registered the transaction (INSTANCE_DATE). SALES are registered sales of "
          "one unit: 'Sale' (a finished unit) and 'Sell - Pre registration' (the off-plan registration). For off-plan a first sale and a resale "
          "cannot be told apart. Plots (kind land) and mortgages (kind mortgage) are separate counters and are never in sales. Developer: "
          "REGISTER_VERIFIED = project number from the register; NAME_ONLY = exact project name matched to one register developer; "
          "null = developer not recorded. No unit numbers are published.")


def TKEY(t):
    """a total order for candidate tuples (sets have none): every field decides, so no two runs can pick differently"""
    return tuple("" if x is None else str(x) for x in t)


def clean_ws(s):
    return re.sub(r"\s+", " ", (s or "").strip())


def norm_key(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def log(*a):
    print(*a, flush=True)


# ---- lookups -------------------------------------------------------------------------------------------------------------
def lake_lookups(pulse, cache):
    """One short read-only visit to the lake (the catalogue is released at once), cached for the next run. {} when the lake cannot be read."""
    sys.path.insert(0, os.path.join(pulse, "scripts"))
    try:
        import lake
        from build_ejari_daily import district_areas
        con = lake.connect(read_only=True)
        try:
            # every query is ordered: the cache and the output must not depend on the order the lake happens to return rows in
            pairs = sorted(list(p) for p in district_areas(con))
            reg = [list(r) for r in con.execute("select r.txn_key, try_cast(r.project_number as bigint), a.name_en from lk_txn_register r "
                                                "left join lk_dld_area_names a on a.area_id = r.area_id where r.txn_key is not null "
                                                "order by 1, 2, 3").fetchall()]
            dev = [list(r) for r in con.execute("""select pn.pn, min(p.developer_number), min(dv.name_en)
                from (select distinct project_id, try_cast(project_number as bigint) pn from lk_project_numbers where project_id is not null) pn
                join lk_d_project p on p.project_id = pn.project_id left join lk_d_developer dv on dv.developer_number = p.developer_number
                where pn.pn is not null group by 1 order by 1""").fetchall()]
            pnames = [list(r) for r in con.execute("select try_cast(p.project_number as bigint), p.name_en, p.name_ar, d.developer_number, d.name_en "
                                                   "from lk_d_project p left join lk_d_developer d on d.developer_number = p.developer_number "
                                                   "where p.project_number is not null and p.name_en is not null order by 1, 2, 3, 4, 5").fetchall()]
            devs = [list(r) for r in con.execute("select developer_number, name_en from lk_d_developer where name_en is not null order by 1, 2").fetchall()]
        finally:
            con.close()
        out = {"pairs": pairs, "reg": reg, "dev": dev, "pnames": pnames, "devs": devs, "from": "lake"}
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        with gzip.open(cache, "wt", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, separators=(",", ":"), default=str)
        return out
    except Exception as e:
        log("lake not readable (%s)" % str(e)[:140])
        if os.path.exists(cache):
            log("using the cached lookups from the last lake read: " + cache)
            with gzip.open(cache, "rt", encoding="utf-8") as f:
                d = json.load(f)
            d["from"] = "cache"
            return d
        return {}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--pulse", default=r"C:\Dev\naj-market-pulse")
    ap.add_argument("--data-dir", default="")
    ap.add_argument("--out", default=os.path.join(REPO, "data", "sales_filed"))
    ap.add_argument("--days", type=int, default=400)
    ap.add_argument("--no-lake", action="store_true", help="no lake: area pairs from DLD_AREA only, no register project numbers (tests)")
    ap.add_argument("--as-of", default="", help="pin the as-of day (default: the latest registration day in the files)")
    a = ap.parse_args()
    t0 = time.time()
    import duckdb
    data_dir = a.data_dir or os.path.join(a.pulse, "data")
    out_dir = a.out
    os.makedirs(out_dir, exist_ok=True)
    sys.path.insert(0, os.path.join(a.pulse, "scripts"))
    from dld_rent_buildings import DLD_AREA

    files = sorted(glob.glob(os.path.join(data_dir, "transactions-*.csv")))
    if not files:
        sys.exit("no transactions-*.csv under " + data_dir)
    lk = {} if a.no_lake else lake_lookups(a.pulse, os.path.join(out_dir, "_lookups.json.gz"))
    if not a.no_lake and not lk:
        sys.exit("the lake could not be read and there is no cached lookup; re-run with --no-lake only for a test")
    log("files %d (%s .. %s); lookups: %s" % (len(files), os.path.basename(files[0]), os.path.basename(files[-1]), lk.get("from", "none")))

    # ---- the area -> district map (DLD_AREA first, the lake crosswalk fills what it has not named), case folded -------------------
    pairs = [(x, d) for x, ds in DLD_AREA.items() for d in ds]
    named = set(DLD_AREA)
    for x, d in (lk.get("pairs") or []):
        if x not in named and (x, d) not in pairs:
            pairs.append((x, d))
    a2d, canon = defaultdict(list), {}
    for x, d in sorted(pairs):
        canon.setdefault(x.lower(), x)
        if d not in a2d[x.lower()]:
            a2d[x.lower()].append(d)
    prim = {k: min(v) for k, v in a2d.items()}      # an area serving two districts is counted once Dubai-wide, under its first
    alias = {}
    ap_ = os.path.join(a.pulse, "data", "dld", "area_alias.json")
    if os.path.exists(ap_):
        alias = {k.lower(): v for k, v in json.load(open(ap_, encoding="utf-8"))["alias"].items()}
    reg = {r[0]: (r[1], r[2]) for r in (lk.get("reg") or [])}                  # txn_key -> (project number, register area)
    devr = {int(r[0]): (r[1], r[2]) for r in (lk.get("dev") or [])}            # project number -> (developer number, name)
    dev_by_name = defaultdict(set)
    for dn, nm in (lk.get("devs") or []):
        dev_by_name[clean_ws(nm).upper()].add(dn)

    # ---- project names -> candidates (the Ejari projects index first, then the register) -------------------------------------------
    cand = defaultdict(set)       # folded name -> {(pn, name_en, name_ar, dev_no, dev_name, index_key)}
    idx_path = os.path.join(a.pulse, "data", "dld", "ejari_daily", "ejari_projects_index.json")
    idx = {}
    if os.path.exists(idx_path):
        for pn, v in json.load(open(idx_path, encoding="utf-8"))["index"].items():
            if not v.get("name_en"):
                continue
            idx[int(pn)] = v
            dn = v.get("developer_number")
            if dn is None and v.get("developer"):
                s = dev_by_name.get(clean_ws(v["developer"]).upper(), set())
                dn = next(iter(s)) if len(s) == 1 else None
            cand[clean_ws(v["name_en"]).lower()].add((int(pn), clean_ws(v["name_en"]), v.get("name_ar"), dn, v.get("developer"), v.get("key")))
    for pn, nm, ar, dn, dname in (lk.get("pnames") or []):
        if pn is not None and nm:
            cand[clean_ws(nm).lower()].add((int(pn), clean_ws(nm), ar, dn, dname, (idx.get(int(pn)) or {}).get("key")))
    pn_info = {}                  # project number -> (name_en, name_ar, index key)
    for v in cand.values():
        for (pn, nm, ar, dn, dname, k) in sorted(v, key=TKEY):
            pn_info.setdefault(pn, (nm, ar, k))
    # beds_left keys, exactly as build_ejari_daily: the app's own building id where the project is bound to a footprint
    bl = {}
    for p in glob.glob(os.path.join(a.pulse, "data", "dld", "beds_left", "beds_left_*.json")):
        d = json.load(open(p, encoding="utf-8"))
        for r in d["rows"]:
            if r.get("app_key"):
                bl[(d["district"], clean_ws(r["dld_project"]).lower())] = r["app_key"]

    # ---- load, deduplicate, classify (duckdb) -------------------------------------------------------------------------------------
    con = duckdb.connect()
    con.execute("create table raw as select *, regexp_extract(filename, 'transactions-(?:ytd-)?([0-9]{4}-[0-9]{2}-[0-9]{2})', 1) stamp "
                "from read_csv(%r, all_varchar=true, header=true, union_by_name=true, filename=true)" % [f.replace("\\", "/") for f in files])
    n_raw = con.execute("select count(*) from raw").fetchone()[0]
    con.execute("""create table tx as select * from raw where TRANSACTION_NUMBER is not null and INSTANCE_DATE is not null
        qualify row_number() over (partition by TRANSACTION_NUMBER, PROCEDURE_EN order by stamp desc, filename desc,
        md5(CAST(raw AS VARCHAR))) = 1""")      # rows of one transaction inside ONE file (a portfolio of units, a group listed twice) tie: the row's own bytes decide, so every run agrees
    n_tx = con.execute("select count(*) from tx").fetchone()[0]
    as_of = a.as_of or con.execute("select max(substr(INSTANCE_DATE, 1, 10)) from tx").fetchone()[0]
    import datetime as dt
    first_day = (dt.date.fromisoformat(as_of) - dt.timedelta(days=a.days - 1)).isoformat()
    rows = con.execute("""select TRANSACTION_NUMBER, substr(INSTANCE_DATE, 1, 10) d, GROUP_EN, trim(PROCEDURE_EN), IS_OFFPLAN_EN, USAGE_EN, AREA_EN,
            PROP_TYPE_EN, PROP_SB_TYPE_EN, try_cast(TRANS_VALUE as double), try_cast(coalesce(ACTUAL_AREA, PROCEDURE_AREA) as double), ROOMS_EN,
            nullif(trim(MASTER_PROJECT_EN), ''), nullif(regexp_replace(trim(PROJECT_EN), '\\s+', ' ', 'g'), '')
        from tx where substr(INSTANCE_DATE, 1, 10) between ? and ? order by TRANSACTION_NUMBER, PROCEDURE_EN""", [first_day, as_of]).fetchall()
    con.close()
    log("raw rows %s -> %s distinct transactions (%s files); %s in the window %s..%s" % (format(n_raw, ","), format(n_tx, ","), len(files), format(len(rows), ","), first_day, as_of))

    def classify(group, proc, ptype, sub, rooms, sqm):
        g, p, sb = group or "", proc or "", (sub or "").lower()
        if g == "Gifts" or p.lower().startswith("grant"):
            return "gift"
        if g == "Mortgage":
            return "other" if MORT_SKIP.search(p) else "mortgage"
        if g != "Sales":
            return "other"
        if ptype == "Land" or sb in ("land", "agricultural"):
            return "land" if p in LAND_PROCS else "other"
        if ptype == "Unit" and p in SALE_PROCS:
            if sqm is not None and sqm >= BIG_UNIT_SQM and (rooms in (None, "", "NA")):
                return "big_unit"
            return "sale"
        return "other_sale" if ptype == "Unit" else "other"

    def bed_band(rooms, sub):
        r, s = (rooms or "").strip(), (sub or "").strip()
        if s == "Office" or r == "Office":
            return "office"
        if s in ("Shop", "Show Rooms") or r == "Shop":
            return "shop"
        if r == "Studio":
            return "studio"
        if r.upper() == "PENTHOUSE":
            return "3+"
        m = re.match(r"^(\d+) B/R$", r)
        if m:
            n = int(m.group(1))
            return "studio" if n == 0 else str(n) if n <= 3 else "3+"
        return None

    def ptype(sub):
        s = (sub or "").strip()
        if not s:
            return None
        if re.search(r"hotel", s, re.I):
            return "Hotel Apartment"
        return s

    # ---- project and developer resolution --------------------------------------------------------------------------------------------
    spell = defaultdict(Counter)
    for r in rows:
        if r[13]:
            spell[r[13].lower()][r[13]] += 1
    nres = {}

    def by_name(fold, raw_name):
        """-> (pn, display, ar, dev_no, dev_name, index_key, evidence) from an EXACT name; developer only when ONE developer owns the name"""
        if fold in nres:
            return nres[fold]
        c = sorted(cand.get(fold, ()), key=TKEY)
        dk = lambda t: clean_ws(t[4]).upper() if t[4] else None       # the developer is its register name, however many project numbers share the label
        devs = {dk(t) for t in c} - {None}
        pns = {t[0] for t in c}
        disp = c[0][1] if c else raw_name
        if len(devs) == 1:
            pick = next(t for t in c if dk(t) in devs and t[3] is not None) if any(dk(t) in devs and t[3] is not None for t in c) else next(t for t in c if dk(t) in devs)
            pn = pick[0] if len(pns) == 1 else None
            r = (pn, disp, pick[2], pick[3], pick[4], pick[5] if len(pns) == 1 else None, "NAME_ONLY")
        else:
            r = (min(pns) if len(pns) == 1 else None, disp, None, None, None, c[0][5] if (c and len(pns) == 1) else None, "AMBIGUOUS" if len(devs) > 1 else "NONE")
        nres[fold] = r
        return r

    def pct(sorted_v, p):
        if not sorted_v:
            return None
        k = (len(sorted_v) - 1) * p
        f = int(k)
        c = min(f + 1, len(sorted_v) - 1)
        return sorted_v[f] + (sorted_v[c] - sorted_v[f]) * (k - f)

    groups = {}
    counters = Counter()
    not_counted = Counter()
    unmapped_area = Counter()
    attr = Counter()
    for (tn, d, group, proc, off, usage, area_raw, ptp, sub, value, sqm, rooms, master, project) in rows:
        kind = classify(group, proc, ptp, sub, rooms, sqm)
        if kind not in ("sale", "land", "mortgage"):
            counters[kind] += 1
            not_counted[proc or "?"] += 1 if kind != "gift" else 0
            continue
        counters[kind] += 1
        stage = ("offplan" if off == "Off-Plan" else "ready") if kind == "sale" else None
        # the register area -> else the feed's label when it is a register area -> else the marketing alias
        r_pn, r_area = reg.get(tn, (None, None))
        area = None
        for cand_area in (r_area, area_raw, alias.get((area_raw or "").lower())):
            if cand_area and cand_area.lower() in a2d:
                area = canon[cand_area.lower()]
                break
        if area is None:
            area = clean_ws(area_raw) or None
            if kind == "sale":
                unmapped_area[area or "?"] += 1
        districts = a2d.get(area.lower(), []) if area else []
        # project and developer
        dev_no = dev_name = ar = ikey = None
        evidence = None
        pn = int(r_pn) if r_pn is not None else None
        disp = project
        if pn is not None and pn in devr and devr[pn][1]:
            dev_no, dev_name, evidence = devr[pn][0], devr[pn][1], "REGISTER_VERIFIED"
            info = pn_info.get(pn)
            if info:
                disp, ar, ikey = info
        elif project:
            nr = by_name(project.lower(), project)
            pn = nr[0] if pn is None else pn
            ikey = nr[5]
            if nr[6] == "NAME_ONLY":
                disp, ar, dev_no, dev_name, evidence = nr[1], nr[2], nr[3], nr[4], "NAME_ONLY"
        if evidence is None and project:
            disp = spell[project.lower()].most_common(1)[0][0]     # an unmatched name keeps its most used spelling (ties: first in sort order)
        if kind == "sale":
            attr[evidence or "NOT_RECORDED"] += 1
        beds = bed_band(rooms, sub) if kind == "sale" else None
        sbt = ptype(sub) if kind == "sale" else None
        use = usage if kind == "sale" else None
        price = value if (kind == "sale" and value and value > 0) else None
        psm = round(value / sqm) if (price and sqm and sqm > 5) else None
        targets = districts if districts else [""]
        for dist in targets:
            if disp:
                key = ikey if (ikey and (not dist or ikey.split(":")[0] == dist or ikey.startswith("dld:"))) else (bl.get((dist, clean_ws(disp).lower())) or "dld:" + norm_key(disp))
            elif master:
                key = "master:" + norm_key(master)
            else:
                key = None
            gk = (d, dist, area, disp, pn, key, dev_no, dev_name, evidence, kind, stage, beds, sbt, use, master if not disp else None, ar)
            g = groups.get(gk)
            if g is None:
                g = groups[gk] = [0, [], []]
            g[0] += 1
            if price:
                g[1].append(int(round(price)))
            if psm:
                g[2].append(int(psm))

    log("kinds: " + ", ".join("%s %s" % (k, format(v, ",")) for k, v in sorted(counters.items())))

    out_rows = []
    for gk in sorted(groups, key=lambda k: tuple("" if x is None else str(x) for x in k)):
        (d, dist, area, disp, pn, key, dev_no, dev_name, evidence, kind, stage, beds, sbt, use, master, ar) = gk
        n, prices, psm = groups[gk]
        prices.sort()
        psm.sort()
        big = len(prices) >= MIN_N
        bigm = len(psm) >= MIN_N
        out_rows.append({"date": d, "district": dist or None, "area": area, "dld_project": disp, "project_name_ar": ar, "dld_project_number": pn,
                         "key": key, "developer_number": dev_no, "developer": dev_name, "attribution": evidence, "kind": kind, "stage": stage,
                         "beds": beds, "sub_type": sbt, "usage": use, "sales": n, "price_n": len(prices),
                         "price_median": round(pct(prices, .5)) if big else None, "price_q1": round(pct(prices, .25)) if big else None,
                         "price_q3": round(pct(prices, .75)) if big else None,
                         "psm_median": round(pct(psm, .5)) if bigm else None, "psm_q1": round(pct(psm, .25)) if bigm else None,
                         "psm_q3": round(pct(psm, .75)) if bigm else None,
                         "prices": prices or None, "psm": psm or None, "master_project": master})

    source = ("Dubai Land Department transactions feed (naj-market-pulse/scripts/fetch_dld.py), %d daily files %s to %s, deduplicated on "
              "transaction number + procedure; district by register area; developer by register project number or exact project name; "
              "window %s to %s" % (len(files), os.path.basename(files[0])[13:23], os.path.basename(files[-1])[13:23], first_day, as_of))
    by_dist = defaultdict(list)
    for r in out_rows:
        if r["district"]:
            by_dist[r["district"]].append(r)
    sizes = {}
    for dname, rs in sorted(by_dist.items()):
        p = os.path.join(out_dir, "sales_filed_%s.json" % dname)
        json.dump({"as_of": as_of, "basis": "registered", "source": source, "district": dname, "caveat": CAVEAT, "fields": FIELDS, "rows": rs},
                  open(p, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, separators=(",", ":"))
        sizes[dname] = os.path.getsize(p)
    for old in glob.glob(os.path.join(out_dir, "sales_filed_*.json")):          # a district that no longer has rows must not leave a stale file
        nm = os.path.basename(old)[len("sales_filed_"):-5]
        if nm != "dubai" and nm not in by_dist:
            os.remove(old)

    # ---- the Dubai-wide file: per area per day (counts), per developer per day (project level, with prices) ------------------------------------
    pa, pa_p, pa_m, pdv = defaultdict(int), defaultdict(list), defaultdict(list), defaultdict(int)
    for r in out_rows:
        dist = r["district"]
        if dist and prim.get((r["area"] or "").lower()) != dist:
            continue                 # an area serving two districts is counted once, under its first
        k = (r["date"], r["area"], dist, r["kind"], r["stage"], r["beds"], r["sub_type"])
        pa[k] += r["sales"]
        pa_p[k].extend(r["prices"] or [])
        pa_m[k].extend(r["psm"] or [])
        if r["kind"] == "sale" and r["developer"] is not None:
            pdv[(r["date"], r["area"], dist, r["developer_number"], r["developer"], r["stage"])] += r["sales"]

    def srt(kv):
        return tuple("" if x is None else str(x) for x in kv[0])
    per_area = []
    for k, v in sorted(pa.items(), key=srt):
        pr, pm = sorted(pa_p[k]), sorted(pa_m[k])
        per_area.append(list(k) + [v, len(pr), round(pct(pr, .5)) if len(pr) >= MIN_N else None, round(pct(pm, .5)) if len(pm) >= MIN_N else None,
                                   sum(x for x in pr if x <= VALUE_CAP) if pr else None])   # v440: the total value of the priced sales
    per_dev = [list(k) + [v] for k, v in sorted(pdv.items(), key=srt)]
    pd_fields = ["date", "area", "district", "developer_number", "developer", "stage", "sales"]
    # the projects that have a registered sale, plot sale or mortgage in the window: the page's search offers them even when Ejari knows nothing
    # of them yet (a launch with no tenants: KORE by Imtiaz, Chelsea Residences)
    pj = {}
    for r in out_rows:
        if not (r["district"] and r["dld_project"] and r["key"]):
            continue
        x = pj.setdefault((r["district"], r["key"]), {"name": r["dld_project"], "ar": r["project_name_ar"], "pn": r["dld_project_number"], "area": r["area"],
                                                       "dn": r["developer_number"], "dev": r["developer"], "sales": 0, "land": 0, "mortgage": 0})
        x["sales" if r["kind"] == "sale" else r["kind"]] += r["sales"]
        x["ar"] = x["ar"] or r["project_name_ar"]
        x["pn"] = x["pn"] or r["dld_project_number"]
        x["dn"] = x["dn"] if x["dn"] is not None else r["developer_number"]
        x["dev"] = x["dev"] or r["developer"]
    pj_fields = ["key", "name", "name_ar", "project_number", "district", "area", "developer_number", "developer", "sales", "land", "mortgage"]
    pj_rows = [[k[1], v["name"], v["ar"], v["pn"], k[0], v["area"], v["dn"], v["dev"], v["sales"], v["land"], v["mortgage"]] for k, v in sorted(pj.items())]
    dub = {"as_of": as_of, "basis": "registered", "source": source, "caveat": CAVEAT,
           "per_area": {"fields": AREA_FIELDS, "rows": per_area}, "per_developer": {"fields": pd_fields, "rows": per_dev},
           "projects": {"fields": pj_fields, "rows": pj_rows}}
    p = os.path.join(out_dir, "sales_filed_dubai.json")
    json.dump(dub, open(p, "w", encoding="utf-8", newline="\n"), ensure_ascii=False, separators=(",", ":"))
    sizes["dubai"] = os.path.getsize(p)

    # ---- the report ---------------------------------------------------------------------------------------------------------------------------
    n_sale = counters["sale"]
    tot_attr = sum(attr.values()) or 1
    sale_rows_in_dist = sum(r["sales"] for r in out_rows if r["kind"] == "sale" and r["district"] and prim.get((r["area"] or "").lower()) == r["district"])
    report = {"as_of": as_of, "window": [first_day, as_of], "files": len(files), "raw_rows": n_raw, "transactions": n_tx, "in_window": len(rows),
              "counts": dict(counters), "unit_sales": n_sale,
              "attribution": {k: {"n": v, "pct": round(100.0 * v / tot_attr, 1)} for k, v in sorted(attr.items())},
              "unit_sales_with_district_pct": round(100.0 * sale_rows_in_dist / max(1, n_sale), 1),
              "unmapped_areas_top": unmapped_area.most_common(25), "not_counted_procedures": dict(not_counted.most_common(20)),
              "file_sizes": sizes, "lookups": lk.get("from", "none"), "seconds": round(time.time() - t0, 1)}
    json.dump(report, open(os.path.join(out_dir, "_build_report.json"), "w", encoding="utf-8", newline="\n"), indent=1, ensure_ascii=False)
    log("unit sales %s; attribution: %s; with a district: %s%%; %d district files; dubai %d KB; %.0fs" % (
        format(n_sale, ","), ", ".join("%s %s%%" % (k, v["pct"]) for k, v in report["attribution"].items()),
        report["unit_sales_with_district_pct"], len(by_dist), sizes["dubai"] // 1024, time.time() - t0))


if __name__ == "__main__":
    main()
