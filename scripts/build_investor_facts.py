"""v379 - INVESTOR-PDF FACTS FOR EVERY PROJECT on the Dubai Land Department project register (Kendall, 7 Oct 2026: 'build the investor PDF facts for all projects').
The generalised form of C:\\Dev\\naj-market-pulse\\docs\\INVESTOR_TIERS_CHELSEA_SAMPLES\\assemble_chelsea_facts.py. OFFLINE and DETERMINISTIC: it reads the published lake (read-only),
the registers and the dated developer files; it writes only the folder you give it. Nothing is deployed, nothing is written to KV.

  python scripts/build_investor_facts.py --out-dir <folder> [--built 2026-10-07] [--limit N] [--naj C:\\Dev\\naj-market-pulse]

Writes into <folder>:
  index.json                              KV img_investor_tiers_index            {as_of, count, projects:[{id, name, brand_name, district, project_number}]}
  investor_tiers_facts_<district>.json    KV img_investor_tiers_facts_<district>  {projects:{<id>: facts}}   one file per district, so no key is large
  build_report.json                       counts, the known / unknown distribution of the core facts, the joins made and the projects that could not be joined

RULES (each is a line of code below, and scripts/check_investor_facts.mjs re-checks the result):
  * A figure carries its source and its evidence label. Unknown stays unknown: the field is null and the locked core says so in one plain line. Never a placeholder, never invented.
  * The developer is the register's developer_id resolved through the developers register (lk_d_developer) to its legal entity - NOT the project row's developer column (that column
    is the MASTER developer's name). A brand is shown as a SECOND line with its own label (company-name rule from the crosswalk, or the project name: developer says).
  * Project identity is the register project number. Sales join on project_number; the unit register joins on the register project_id. A developer's own web page (payment plan,
    amenities) carries no project number, so it is linked only where its project name equals the register's name EXACTLY (normalised), the register company is the SAME brand,
    and no other register project of that brand has that name; the link and its basis are written into the record and the build report.
  * Rent contracts carry only a project NAME, never a number: they are counted only on an exact name AND the same register district AND a name that is unique in that district,
    and the record says so (rents.basis). A project with no such contracts has no rents block.
  * The off-plan sales procedure is 'Sell - Pre registration' and the register does not flag a resale, so a first sale cannot be told apart from a resale: resales.separable is always
    false and no resale activity is claimed.
  * A payment plan is the developer's own wording. A printed code (60/40, 10/10/5/5/5/5/60) is a label and is NEVER read as before or after handover: no amount comes from a label.
"""
import argparse, collections, csv, datetime as dt, glob, json, os, re, statistics, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
SQFT = 10.7639
STATUS_TEXT = {"NOT_STARTED": "Not started", "ACTIVE": "Under construction", "FINISHED": "Handed over", "PENDING": "Pending", "FRIEZED": "Frozen",
               "CONDITIONAL_ACTIVATING": "Conditionally activating"}
LEGACY_IDS = {3719: "chelsea-residences-by-damac"}       # the id the live v378 button already uses
SIBLINGS = {3719: 3743, 3743: 3719}                       # two registered phases that are shown together in the unit register (as in the v376 Chelsea record)
PAIR_NOTE = ("One earlier sales extract shows a 4-bedroom sale (Chelsea Residences 2, Tower B, AED 34.3 million, 536 sq m) although the unit register stops at 3 bedrooms. "
             "This has not been reconciled.")           # carried from the reviewed v376 Chelsea record (docs/INVESTOR_TIERS_CHELSEA_SAMPLES/chelsea_facts.json)


def norm(s):
    return re.sub(r"[^a-z0-9]+", "", str(s or "").lower())


def slug(s, n=44):
    return re.sub(r"[^a-z0-9]+", "-", str(s or "").lower()).strip("-")[:n].strip("-")

# v382 - AREA HEADING = the project's OWN community, never the Land Department land district (Chelsea Residences by DAMAC: "Dubai Maritime City", not "Madinat Dubai Almelaheyah").
# Rule (Kendall, 7 Oct 2026; mirrors src/community_labels.js projectAreaLabel): the register master community of the project (g_dld__projects.master_project_en, by project_number) if it
# is not just the land district, else the community AREA_EN of the open sales extracts under the project's exact name (a name that is not a common word), else the register district.
# The master comes first here (the reverse of the index builder) because a facts record is keyed by project_number and a bare name can sit in two districts. register_area stays as filed (it picks the shard).
AREA_DISPLAY = {"horizon": "Meydan Horizon", "jlt": "Jumeirah Lakes Towers", "arabianranches3": "Arabian Ranches III", "arabianranchesiii": "Arabian Ranches III",
                "jumeriahbeachresidencejbr": "Jumeirah Beach Residence", "sobhaheartland": "Sobha Hartland"}      # mirrors src/community_labels.js AREA_DISPLAY


def area_display(raw):
    t = re.sub(r"\s+", " ", str(raw or "")).strip()
    if not t:
        return ""
    k = norm(t)
    if k in AREA_DISPLAY:
        return AREA_DISPLAY[k]
    return t if (re.search(r"[a-z]", t) and re.search(r"[A-Z]", t)) else re.sub(r"\b[a-z]", lambda m: m.group(0).upper(), t.lower())


def own_area(register_area, master, names, SA, generic):
    """returns (heading, source) source: register_master | sales_area | register_district"""
    own = {norm(register_area)}
    if master and norm(master) not in own:
        return area_display(master), "register_master"
    for nm in names:
        if not nm or generic(nm):
            continue
        sa = SA.get(re.sub(r"[^a-z0-9]+", " ", str(nm).lower()).strip())
        if sa and sa[0] and norm(sa[0]) not in own:
            return area_display(sa[0]), "sales_area"
    return (register_area or "Area not recorded on the register"), "register_district"


def district_slug(s):
    return re.sub(r"[^a-z0-9]+", "", str(s or "").lower()) or "unknown"


def clean(s):
    """a register field that holds a dash or a blank is unknown, not a value"""
    if s is None:
        return None
    t = str(s).strip()
    return None if t.lower() in ("", "-", "--", "n/a", "na", "null", "none", "nan") else t


def iso(x):
    return None if x is None else str(x)[:10]


def psf(x):
    return None if x is None else int(round(float(x) / SQFT))


def title_case(s):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    if s and s == s.upper() and len(s) > 3:
        out = []
        for w in s.split(" "):
            out.append(w if (re.search(r"\d", w) or re.fullmatch(r"[IVX]+", w) or "." in w or len(w) <= 2) else w.capitalize())
        s = " ".join(out)
    return re.sub(r"\b(By|BY)\b", "by", s)


def short_name(s):
    """the project's own name without a trailing 'by <brand>' (the brand is shown on its own line)"""
    m = re.search(r"\s+by\s+(.+)$", str(s or ""), flags=re.I)
    if not m or re.match(r"(the|a|an|and|of|at|in|on|to)\b", m.group(1).strip(), re.I) or len(m.group(1).split()) > 3:
        return str(s or "")                      # 'Marina by the Sea' is a name, not a brand suffix
    return str(s)[: m.start()].strip() or str(s or "")


def beds_label(r):
    if r is None:
        return None
    s = str(r).strip()
    if s.lower() == "studio":
        return "Studio"
    m = re.fullmatch(r"(\d+)\s*B/R", s, re.I)
    if m:
        return m.group(1) + " B/R"
    m = re.fullmatch(r"(\d+)\s*bed\s*rooms?\s*\+\s*hall", s, re.I)
    if m:
        return m.group(1) + " B/R"
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--naj", default=r"C:\Dev\naj-market-pulse")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--built", default=dt.date.today().isoformat())
    ap.add_argument("--limit", type=int, default=0, help="development only: the first N register projects")
    a = ap.parse_args()
    sys.path.insert(0, os.path.join(a.naj, "scripts"))
    from lake import connect  # noqa: E402
    import build_developer_crosswalk as X  # noqa: E402  (canonical_of / BY_ID: the company-name brand rules, parity-tested with src/devcross.js)
    con = connect()
    sys.path.insert(0, HERE)
    import devattr_register as DR  # noqa: E402  (v382: the sales extracts' own community per project name, and the common-word test)
    SA = DR.sales_area_index()
    area_src = collections.Counter()

    def rows(sql):
        r = con.execute(sql)
        cols = [d[0] for d in r.description]
        return [dict(zip(cols, x)) for x in r.fetchall()]

    tx_max = con.execute("select max(instance_date) from g_dld__transactions").fetchone()[0]
    reg_asof = con.execute("select max(load_timestamp) from g_dld__projects").fetchone()[0]
    units_asof = con.execute("select max(load_timestamp) from g_dld__units").fetchone()[0]
    l12_from = tx_max - dt.timedelta(days=364)
    T0 = "'" + str(l12_from) + "'"
    print("sales to", tx_max, "| window from", l12_from, "| project register to", iso(reg_asof), "| unit register to", iso(units_asof))
    S = "trans_group_en='Sales' and property_type_en='Unit' and project_number is not null"
    SB = "cast(project_number as bigint)"

    # ------------------------------------------------------------------------------------------------ the register: projects, developers, names
    projs = rows("""select p.project_number pn, p.project_id pid, p.developer_id did, p.master_developer_id mdid, p.project_status st, p.percent_completed pc,
        p.project_start_date sd, p.project_end_date ed, p.completion_date cd, p.cancellation_date xd, p.no_of_units units, p.no_of_buildings bld, p.escrow_agent_id esc,
        p.area_name_en area, p.master_project_en master, lp.name_en name_en, lp.zoning_authority zoning
        from g_dld__projects p left join lk_d_project lp on lp.project_number=p.project_number order by p.project_number""")
    if a.limit:
        projs = projs[: a.limit]
    devs = {int(r["developer_id"]): r for r in rows("select * from lk_d_developer where developer_id is not null")}
    escrow = {int(r["escrow_agent_number"]): r["name_en"] for r in rows("select * from lk_d_escrow_agent")}
    print("register projects:", len(projs))

    brand_name = {int(r["pn"]): r["nm"] for r in rows(f"""select pn, nm from (select {SB} pn, trim(project_name_en) nm, count(*) c from g_dld__transactions where project_name_en is not null and project_number is not null group by 1,2)
        qualify row_number() over (partition by pn order by c desc, nm)=1""")}
    # sales aggregates, one pass per question, all by register project number
    tot = {int(r["pn"]): r for r in rows(f"""select {SB} pn, count(*) n, min(instance_date) a, max(instance_date) b, median(actual_worth) filter (where actual_worth>0) w,
        min(case when reg_type_en like 'Off%' then 1 else 0 end) offplan from g_dld__transactions where {S} group by 1""")}
    l12 = {int(r["pn"]): r for r in rows(f"""select {SB} pn, count(*) n, median(actual_worth) filter (where actual_worth>0) w, median(meter_sale_price) filter (where meter_sale_price>0) m
        from g_dld__transactions where {S} and instance_date>=DATE {T0} group by 1""")}
    by_year = collections.defaultdict(list)
    for r in rows(f"select {SB} pn, year(instance_date) y, count(*) n, median(meter_sale_price) filter (where meter_sale_price>0) m from g_dld__transactions where {S} group by 1,2 order by 1,2"):
        by_year[int(r["pn"])].append({"year": int(r["y"]), "n": r["n"], "psf": psf(r["m"])})
    by_beds = collections.defaultdict(lambda: collections.defaultdict(list))
    for r in rows(f"""select {SB} pn, rooms_en r, count(*) n, median(procedure_area) a, median(actual_worth) filter (where actual_worth>0) w, median(meter_sale_price) filter (where meter_sale_price>0) m
        from g_dld__transactions where {S} group by 1,2 order by 1,2"""):
        lab = beds_label(r["r"])
        if lab:
            by_beds[int(r["pn"])][lab].append(r)
    land = {int(r["pn"]): r["n"] for r in rows(f"select {SB} pn, count(*) n from g_dld__transactions where project_number is not null and property_type_en='Land' group by 1")}
    proc = collections.defaultdict(lambda: [0, 0])
    for r in rows(f"select {SB} pn, (procedure_name_en='Sell - Pre registration') pre, count(*) n from g_dld__transactions where {S} group by 1,2"):
        proc[int(r["pn"])][0 if r["pre"] else 1] += r["n"]
    by_month = collections.defaultdict(list)
    for r in rows(f"select {SB} pn, strftime(instance_date,'%Y-%m') m, count(*) n from g_dld__transactions where {S} group by 1,2 order by 1,2"):
        by_month[int(r["pn"])].append({"month": r["m"], "n": r["n"]})
    nearby = collections.defaultdict(dict)
    for col, lab in [("nearest_metro_en", "Nearest metro"), ("nearest_mall_en", "Nearest mall"), ("nearest_landmark_en", "Nearest landmark")]:
        for r in rows(f"""select pn, v from (select {SB} pn, {col} v, count(*) c from g_dld__transactions where {S} and {col} is not null and trim({col})<>'' group by 1,2)
            qualify row_number() over (partition by pn order by c desc, v)=1"""):
            nearby[int(r["pn"])][lab] = r["v"]

    # unit register: joined on the register project_id (never on a name)
    def unit_mix(where):
        out = {}
        for r in rows(f"select p.project_number pn, u.rooms_en r, count(*) n from g_dld__units u join g_dld__projects p on p.project_id=cast(u.project_id as hugeint) where u.property_type_en='Unit' {where} group by 1,2"):
            d = out.setdefault(int(r["pn"]), {"units": 0, "studio": 0, "b1": 0, "b2": 0, "b3": 0, "b4plus": 0, "other": 0})
            d["units"] += r["n"]
            lab = beds_label(r["r"])
            k = "studio" if lab == "Studio" else ("b" + lab[0] if lab and lab[0] in "123" and lab[1] == " " else ("b4plus" if lab else "other"))
            d[k] += r["n"]
        return out
    umix = unit_mix("")

    # ------------------------------------------------------------------------------------------------ area-level figures (by register district)
    area_year = collections.defaultdict(list)
    for r in rows("select area_name_en ar, year(instance_date) y, count(*) n, median(meter_sale_price) filter (where meter_sale_price>0) m from g_dld__transactions where trans_group_en='Sales' and property_type_en='Unit' and year(instance_date)>=2015 group by 1,2 order by 1,2"):
        area_year[r["ar"]].append({"year": int(r["y"]), "n": r["n"], "psf": psf(r["m"])})
    dubai_year = [{"year": int(r["y"]), "n": r["n"], "psf": psf(r["m"])} for r in rows("select year(instance_date) y, count(*) n, median(meter_sale_price) m from g_dld__transactions where trans_group_en='Sales' and property_type_en='Unit' and year(instance_date)>=2020 group by 1 order by 1")]
    cy = rows(f"select count(*) n, median(meter_sale_price) m, avg(case when reg_type_en like 'Off%' then 1.0 else 0 end) o from g_dld__transactions where trans_group_en='Sales' and property_type_en='Unit' and instance_date>=DATE {T0}")[0]
    area_l12 = {r["ar"]: r for r in rows(f"select area_name_en ar, count(*) n, median(meter_sale_price) m from g_dld__transactions where trans_group_en='Sales' and property_type_en='Unit' and instance_date>=DATE {T0} group by 1")}
    area_proc = {r["ar"]: r for r in rows(f"""select area_name_en ar, sum(case when procedure_name_en='Sell - Pre registration' then 1 else 0 end) pre,
        sum(case when procedure_name_en like '%Sell' and reg_type_en like 'Existing%' then 1 else 0 end) ex from g_dld__transactions where trans_group_en='Sales' and property_type_en='Unit' and instance_date>=DATE {T0} group by 1""")}
    supply = collections.defaultdict(dict)
    for r in rows("select area_name_en ar, project_status s, count(*) n, sum(no_of_units) u from g_dld__projects where project_status in ('ACTIVE','NOT_STARTED') group by 1,2"):
        supply[r["ar"]][r["s"]] = {"projects": r["n"], "homes": int(r["u"] or 0)}
    comps = collections.defaultdict(list)
    for r in rows(f"""select area_name_en ar, {SB} pn, any_value(trim(project_name_en)) nm, count(*) n, median(meter_sale_price) m from g_dld__transactions
        where trans_group_en='Sales' and property_type_en='Unit' and project_number is not null and reg_type_en like 'Off%' and instance_date>=DATE {T0} group by 1,2 having count(*)>=30 order by 1, 4 desc, 2"""):
        comps[r["ar"]].append(r)

    # ------------------------------------------------------------------------------------------------ delivery: the entity, the brand family and the handover record
    ent = collections.defaultdict(dict)
    for r in rows("select cast(developer_id as bigint) d, project_status s, count(*) n from g_dld__projects where developer_id is not null group by 1,2"):
        ent[int(r["d"])][r["s"]] = r["n"]
    fam_cache = {}

    def brand_family(canon):
        if canon in fam_cache:
            return fam_cache[canon]
        b = X.BY_ID[canon]
        tok = None
        for rule in b.get("start") or []:
            t = " ".join(rule).upper()
            if re.fullmatch(r"[A-Z0-9 &.\-]{4,}", t):
                tok = t
                break
        out = None
        if tok:
            r = con.execute(f"select count(*), sum(case when project_status='FINISHED' then 1 else 0 end) from g_dld__projects where developer_id in (select developer_id from lk_d_developer where upper(name_en) like '{tok.replace(chr(39), '')}%') and project_end_date < DATE '{tx_max}'").fetchone()
            if r[0]:
                out = {"matched_by": "company name starts with " + tok + " (a name rule, not the register)", "past_planned_end": r[0], "registered_finished": int(r[1] or 0)}
        fam_cache[canon] = out
        return out
    drec_path = os.path.join(ROOT, "data", "delivery_record", "delivery_record.json")
    drec = json.load(open(drec_path, encoding="utf-8")) if os.path.exists(drec_path) else {"by": {}}

    # ------------------------------------------------------------------------------------------------ names the register and the sales use, for the joins that cannot use a number
    names_of = collections.defaultdict(set)      # pn -> normalised names
    for r in projs:
        for s in (r["name_en"], brand_name.get(int(r["pn"]))):
            if s:
                names_of[int(r["pn"])].add(norm(s))
    name_to_pns = collections.defaultdict(set)
    for pn, ns in names_of.items():
        for n in ns:
            name_to_pns[n].add(pn)
    pn_area = {int(r["pn"]): r["area"] for r in projs}
    pn_canon = {}
    for r in projs:
        d = devs.get(int(r["did"])) if r["did"] is not None else None
        if d and d["name_en"]:
            c = X.canonical_of(d["name_en"])[0]
            pn_canon[int(r["pn"])] = c if c in X.BY_ID else None

    rent_n = collections.Counter()
    for r in rows("select upper(PROJECT_EN) p, AREA_EN a, count(*) n from lk_dld_rents where PROJECT_EN is not null group by 1,2"):
        rent_n[(norm(r["p"]), norm(r["a"]))] += r["n"]
    # the same large count under several building names in one district (Creek Beach: 12 names, 604 contracts each) is a shared figure, not a project's own: those names are not used
    rent_same = collections.Counter((a, n) for (p, a), n in rent_n.items() if n >= 10)
    rent_asof = con.execute("select max(REGISTRATION_DATE) from lk_dld_rents").fetchone()[0]

    # developer-site files: payment plans (v375) and amenities (dev_meta portfolios). Linked by exact name + same brand + unique (see the RULES in the docstring).
    report = {"plan_links": [], "plan_unlinked": [], "amenity_links": 0, "amenity_files": {}, "amenity_unlinked": 0}

    link_how = {}

    def link_by_name(names, brand_canon):
        """-> (project number, how) or (None, None). Exact normalised name; the register company must be the SAME curated brand, or - when the register project name itself ends 'by <brand>'
        (the name incl. the brand, e.g. the developer's 'The Boulevard' and the register's 'THE BOULEVARD BY PRESTIGE ONE') - must be no OTHER curated brand. The match must name ONE project."""
        disp = X.BY_ID[brand_canon]["display"] if brand_canon in X.BY_ID else None
        cand = {}
        for n in names:
            for pn in name_to_pns.get(norm(n), set()):
                if pn_canon.get(pn) == brand_canon and brand_canon in X.BY_ID:
                    cand[pn] = "exact project name, and the register company is the same brand (company-name rule)"
            if disp:
                for pn in name_to_pns.get(norm(n) + norm("by " + disp), set()):
                    if pn_canon.get(pn) in (None, brand_canon) and pn not in cand:
                        cand[pn] = "exact project name including the brand the register's own project name states ('by " + disp + "'); no other brand's company is registered for it"
        if len(cand) != 1:
            return None, None
        pn = next(iter(cand))
        return pn, cand[pn]
    plans_by_pn = {}
    ppath = os.path.join(ROOT, "data", "payment_plans", "payment_plans.json")
    pp = json.load(open(ppath, encoding="utf-8"))
    kore_plan = None
    for key, v in sorted(pp["projects"].items()):
        canon = X.canonical_of(v["developer"])[0]
        pn, how = link_by_name([v["project"]] + list(v.get("aliases") or []), canon)
        if key == "imtiaz|kore":
            kore_plan = v
            continue
        if pn is None:
            report["plan_unlinked"].append(key)
        else:
            plans_by_pn.setdefault(pn, []).append((key, v))
            link_how[("plan", pn)] = how
            report["plan_links"].append([key, pn, how])
    amen_by_pn = {}
    amen_dev = {}
    PORT = {"arada": "Arada", "beyond": "Beyond", "ellington": "Ellington", "emaar": "Emaar", "fakhruddin": "Fakhruddin", "hh": "H&H", "iman": "Iman", "imtiaz": "Imtiaz", "meraas": "Meraas",
            "omniyat": "Omniyat", "palma": "Palma", "prestigeone": "Prestige One", "select": "Select Group", "sobha": "Sobha"}
    for f in sorted(glob.glob(os.path.join(a.naj, "data", "dev_meta", "*_portfolio.json"))):
        k = os.path.basename(f).replace("_portfolio.json", "")
        if k not in PORT:
            continue
        canon = X.canonical_of(PORT[k])[0]
        d = json.load(open(f, encoding="utf-8"))
        n_ok = 0
        for p in d.get("properties") or []:
            am = [s.strip() for s in (p.get("amenities") or []) if isinstance(s, str) and s.strip()]
            if not am or not p.get("name"):
                continue
            pn, how = link_by_name([p["name"]], canon)
            if pn is None:
                report["amenity_unlinked"] += 1
                amen_dev.setdefault((canon, norm(p["name"])), {"list": am, "source": "the developer's own web site " + str(d.get("source") or "") + ", page " + str(p.get("url") or "") + ", fetched " + str(d.get("fetched") or "")[:10] + " (data/dev_meta/" + os.path.basename(f) + ")",
                                                               "as_of": str(d.get("fetched") or "")[:10]})      # v411: kept for a project that is not on the register but whose developer page lists amenities
                continue
            if pn in amen_by_pn:
                continue
            amen_by_pn[pn] = {"list": am, "source": "the developer's own web site " + str(d.get("source") or "") + ", page " + str(p.get("url") or "") + ", fetched " + str(d.get("fetched") or "")[:10] + " (data/dev_meta/" + os.path.basename(f) + "); linked to the register project by " + how, "name": p["name"]}
            n_ok += 1
        report["amenity_files"][k] = n_ok
    report["amenity_links"] = len(amen_by_pn)

    # ------------------------------------------------------------------------------------------------ one record
    def plan_block(pn_plans):
        """the developer's plan, only as the developer states it. returns (payment_plan|None, reason, label|None)"""
        labels, structured = [], []
        for key, v in pn_plans:
            labels += [lb["text"] for lb in v.get("labels") or []]
            for p in v.get("plans") or []:
                q = {float(x) for x in re.findall(r"\d+(?:\.\d+)?", (p.get("source") or {}).get("text") or "")}
                if (not p.get("indicative")) and (not p.get("derived_remainder")) and p.get("confidence") == "high" and p.get("total_pct") == 100 and p.get("steps") \
                        and all(float(s["pct"]) in q for s in p["steps"]):
                    structured.append(p)
        labels = sorted(set(labels))
        lab_txt = "; ".join(labels) if labels else None
        if not structured:
            if not pn_plans:
                return None, "no developer sheet or offer for this project is on file, so the plan cannot be stated; ask the developer", None
            parts = []
            if labels:
                parts.append("the developer prints a code (" + lab_txt + ") that does not say which payments fall before or after handover")
            if any(v.get("plans") for _, v in pn_plans):
                parts.append("the developer's own wording of a plan is indicative, or part of it is derived rather than stated, so it is not read as a schedule")
            return None, " and ".join(parts) + ", so no plan is stated; ask the developer", lab_txt

        def steps_text(p):
            words = {"booking": "on booking", "instalments_before_handover": "in instalments before handover", "on_handover": "on handover", "after_handover": "after handover", "before_handover_total": "before handover"}
            return ", ".join(("%g%% " % s["pct"]) + words[s["kind"]] for s in p["steps"])
        uniq = []
        for p in structured:
            if steps_text(p) not in [steps_text(x) for x in uniq]:
                uniq.append(p)
        if len(uniq) == 1 and len(structured) == len(uniq) and len([1 for _, v in pn_plans for _ in v.get("plans") or []]) == 1:
            p = uniq[0]
            ms = []
            for s in p["steps"]:
                lab = {"booking": "On booking", "instalments_before_handover": "Instalments before handover", "on_handover": "On handover", "after_handover": "After handover", "before_handover_total": "Before handover (total)"}[s["kind"]]
                ms.append({"label": lab, "pct": float(s["pct"]) if float(s["pct"]) != int(s["pct"]) else int(s["pct"]), "before_handover": s["kind"] in ("booking", "instalments_before_handover", "before_handover_total")})
            src = p["source"]
            return {"text": steps_text(p), "milestones": ms, "evidence": "DEVELOPER_CLAIMED", "as_of": str(src.get("fetched") or "")[:10] or None,
                    "source": {"file": src.get("file"), "url": src.get("url"), "quote": src.get("text")}}, None, lab_txt
        # several options stated by the developer: the words only, no milestone list (so no cash figure is derived)
        src = uniq[0]["source"]
        return {"text": "the developer states more than one option: " + "; ".join("option " + str(i + 1) + ", " + steps_text(p) for i, p in enumerate(uniq)), "milestones": [], "evidence": "DEVELOPER_CLAIMED",
                "as_of": str(src.get("fetched") or "")[:10] or None, "source": {"file": src.get("file"), "url": src.get("url"), "quote": " | ".join(str((p["source"] or {}).get("text") or "") for p in uniq)}}, None, lab_txt

    FEES = [{"label": "Dubai Land Department registration fee", "rate": 0.04, "source": "published fixed fee on a sale"}]
    FEES_UNKNOWN = "agent commission, trustee and registration charges, and service charges are not held for this project"
    counters = collections.Counter()
    records = []

    def sales_block(pn):
        t = tot.get(pn)
        src = "Dubai Land Department sales register (unit sales, land excluded) to " + str(tx_max)
        if not t:
            return {"all_time": 0, "first": None, "last": None, "l12": 0, "l12_median_price": None, "l12_median_psf": None, "median_price": None, "by_year": [], "by_beds": [],
                    "land_registrations_excluded": land.get(pn, 0), "all_off_plan": False, "source": src}
        q = l12.get(pn)
        bb = []
        for lab in sorted(by_beds.get(pn, {}), key=lambda s: (0 if s == "Studio" else int(s[0]))):
            rr = by_beds[pn][lab]
            n = sum(x["n"] for x in rr)
            rw = max(rr, key=lambda x: x["n"])     # the median figures of the biggest row of that size label (a size can be spelt two ways on the register)
            if rw["w"] is None or rw["m"] is None or rw["a"] is None:
                continue
            bb.append({"beds": lab, "n": n, "sqft": int(round(float(rw["a"]) * SQFT)), "median_price": rw["w"], "psf": psf(rw["m"])})
        return {"all_time": t["n"], "first": iso(t["a"]), "last": iso(t["b"]), "l12": q["n"] if q else 0, "l12_median_price": q["w"] if q and q["n"] else None,
                "l12_median_psf": psf(q["m"]) if q and q["n"] else None, "median_price": t["w"], "by_year": [y for y in by_year.get(pn, []) if y["psf"] is not None],
                "by_beds": bb, "land_registrations_excluded": land.get(pn, 0), "all_off_plan": bool(t["offplan"]), "source": src}

    def make(r):
        pn = int(r["pn"])
        counters["projects"] += 1
        did = int(r["did"]) if r["did"] is not None else None
        dv = devs.get(did) if did is not None else None
        nm_en = r["name_en"] or brand_name.get(pn)
        bname = title_case(brand_name.get(pn) or nm_en) if (brand_name.get(pn) or nm_en) else "Registered project " + str(pn)
        name = short_name(title_case(nm_en)) if nm_en else short_name(bname)
        area, asrc = own_area(r["area"], clean(r["master"]), [nm_en, brand_name.get(pn)], SA, DR.is_generic_name)      # v382
        area_src[asrc] += 1
        pid = LEGACY_IDS.get(pn) or ((slug(bname) or "project") + "-" + str(pn))
        # status
        code = r["st"]
        pcv = None if r["pc"] is None else max(0.0, min(100.0, float(r["pc"])))
        stt = {"code": code, "text": STATUS_TEXT.get(code, str(code).title()) + ((" (cancelled on the register on " + iso(r["xd"]) + ")") if r["xd"] else ""), "percent": pcv, "start": iso(r["sd"]), "planned_end": iso(r["ed"]),
               "completion": iso(r["cd"]), "units": int(r["units"] or 0), "buildings": int(r["bld"] or 0), "escrow": clean(escrow.get(int(r["esc"]))) if r["esc"] is not None else None, "zoning": clean(r["zoning"]),
               "source": "Dubai Land Department project register"}
        # developer
        D = None
        canon = pn_canon.get(pn)
        if dv and dv["name_en"]:
            D = {"brand": None, "legal_entity": dv["name_en"].strip(), "evidence": "REGISTER_VERIFIED", "basis": "project number " + str(pn) + " on the project register names developer id " + str(did),
                 "registered": iso(dv["registration_date"]), "licence_number": clean(dv["license_number"]), "licence_authority": clean(dv["license_source"]), "licence_expires": iso(dv["license_expiry_date"])}
            if not D["licence_number"]:
                D["licence_number"] = D["licence_authority"] = D["licence_expires"] = None
            sfx = re.search(r"\bby\s+(.+)$", nm_en or "", re.I)
            if canon:
                D["brand"] = X.BY_ID[canon]["display"]
                D["brand_line"] = "Brand name: " + D["brand"] + " (matched to the registered company by its name, a name rule; the register records no brands)."
            elif sfx:
                D["brand"] = title_case(sfx.group(1))
                D["brand_line"] = "Brand name: " + D["brand"] + " (developer says, taken from the project name; the register does not link this brand to the registered company)."
            if r["mdid"] is not None and int(r["mdid"]) != did:
                md = devs.get(int(r["mdid"]))
                D["master_label_not_developer"] = ("The register's developer column on the project row shows the master developer, " + (md["name_en"].strip() if md and md["name_en"] else "developer id " + str(int(r["mdid"]))) +
                                                   ", not the developer; this report uses the developer id, which names " + D["legal_entity"].rstrip("."))
            counters["developer_known"] += 1
        else:
            why = "the project row names no developer id" if did is None else "the developers register holds no record of developer id " + str(did)
            D = {"brand": None, "legal_entity": None, "evidence": "UNVERIFIED", "reason": "On the project register, " + why + ", so the company behind this project cannot be named from the register"}
            if not D["reason"]:
                D["reason"] = why
        # delivery
        delivery, dreason = None, None
        if dv and dv["name_en"]:
            e = ent.get(did, {})
            delivery = {"entity": {"projects": sum(e.values()), "by_status": dict(sorted(e.items())), "source": "Dubai Land Department project register, by developer id"}}
            if canon:
                bf = brand_family(canon)
                if bf:
                    delivery["brand_family"] = bf
            rec = (drec.get("by") or {}).get(str(did))
            if rec and rec["n"] >= 3:
                delivery["record"] = {"n": rec["n"], "late": rec["late"], "months": ([rec["m"][0], rec["m"][-1]] if rec["m"] else []),
                                      "source": "Dubai Land Department project register, finished projects with both dates, delivery record built " + str(drec.get("generated") or "")[:10]}
        else:
            dreason = "no registered company is named for this project"
        # sales
        X_ = sales_block(pn)
        resales = None
        if X_["all_time"]:
            pre, oth = proc[pn]
            dw = area_proc.get(r["area"]) or {"pre": 0, "ex": 0}
            resales = {"separable": False, "reason": "the register records every off-plan sale under one procedure, 'Sell - Pre registration', and later sales under 'Sell'; neither procedure says whether the seller is the developer or an earlier owner, so a first sale cannot be told apart from a resale",
                       "project_rows": pre, "project_resale_procedure_rows": oth, "project_by_month": by_month.get(pn, []),
                       "district_window": {"from": iso(l12_from), "to": iso(tx_max), "pre_registration": int(dw["pre"] or 0), "existing_property_sell": int(dw["ex"] or 0)}}
        # rents (name join, stated as such)
        rents = None
        nms = names_of.get(pn, set())
        if nms and r["st"] == "FINISHED" and all(len(name_to_pns[n]) == 1 for n in nms):     # a project that is not handed over has no rent contract of its own to count
            c = sum(rent_n.get((n, norm(r["area"])), 0) for n in nms)
            if c > 0 and not any(rent_same.get((norm(r["area"]), rent_n.get((n, norm(r["area"])), 0)), 0) > 1 and rent_n.get((n, norm(r["area"])), 0) >= 10 for n in nms):
                rents = {"project_contracts": c, "area_contracts": None, "yield_rate": None, "basis": "rent contracts carry a project name, not a project number; counted on the exact project name in the same register district, and only because no other registered project there has that name",
                         "source": "Dubai rent register (Ejari contracts) to " + str(rent_asof)[:10]}
                counters["rents"] += 1
        # market, comparables, neighbourhood, city, supply
        market = {"area_by_year": area_year.get(r["area"], []), "dubai_by_year": dubai_year} if area_year.get(r["area"]) else None
        cps = None
        if X_["all_time"] and X_["l12"] > 0 and X_["all_off_plan"]:
            cps = [{"name": title_case(c["nm"]), "n": c["n"], "psf": psf(c["m"])} for c in comps.get(r["area"], []) if int(c["pn"]) != pn][:6] or None
        nb = [{"label": l, "value": nearby[pn][l], "source": "Dubai Land Department sales register, as recorded on this project's sales"} for l in ("Nearest metro", "Nearest mall", "Nearest landmark") if l in nearby.get(pn, {})] or None
        al = area_l12.get(r["area"])
        city = {"l12_sales": cy["n"], "l12_psf": psf(cy["m"]), "offplan_share": round(float(cy["o"]), 3), "area_l12_sales": al["n"] if al else 0, "area_l12_psf": psf(al["m"]) if al and al["n"] else None} if al else None
        # unit register
        um = umix.get(pn)
        ur = None
        sib = SIBLINGS.get(pn)
        if um and um["units"] > 0:
            one = lambda q, nm: dict({"name": nm, "project_number": q}, **{k: v for k, v in umix[q].items()})
            if sib and sib in umix:
                p1, p2 = sorted([pn, sib])
                nm_of = lambda q: title_case(brand_name.get(q) or next((x["name_en"] for x in projs if int(x["pn"]) == q), "") or "")
                ur = {"source": "Dubai Land Department unit register, project numbers " + str(p1) + " and " + str(p2) + ", joined by register project id (units to " + iso(units_asof) + ")",
                      "phase1": {"name": nm_of(p1), "project_number": p1, "units": umix[p1]["units"], "studio": umix[p1]["studio"], "b1": umix[p1]["b1"], "b2": umix[p1]["b2"], "b3": umix[p1]["b3"]},
                      "phase2": {"name": nm_of(p2), "project_number": p2, "units": umix[p2]["units"], "studio": umix[p2]["studio"], "b1": umix[p2]["b1"], "b2": umix[p2]["b2"], "b3": umix[p2]["b3"]},
                      "left_for_sale": "not known: the register does not record which homes are still for sale", "unreconciled": PAIR_NOTE}
            else:
                ur = {"source": "Dubai Land Department unit register, project number " + str(pn) + ", joined by register project id (units to " + iso(units_asof) + ")",
                      "single": dict({"name": name, "project_number": pn}, **um), "left_for_sale": "not known: the register does not record which homes are still for sale"}
        # price and plan
        planb, preason, plabel = plan_block(plans_by_pn.get(pn, []))
        if planb is not None:
            planb["linked_by"] = link_how.get(("plan", pn))
        price_plan = {"payment_plan": planb, "fees": FEES if X_["all_time"] else [], "fees_unknown": FEES_UNKNOWN}
        if planb is None:
            price_plan["payment_plan_reason"] = preason
            if plabel:
                price_plan["payment_plan_label"] = plabel
        else:
            counters["plan"] += 1
        am = amen_by_pn.get(pn)
        f = {"schema": 1,
             "project": {"id": pid, "name": name, "brand_name": bname, "area": area, "area_source": asrc, "register_area": r["area"], "master_project": r["master"], "project_number": pn},
             "as_of": {"sales": iso(tx_max), "register": iso(reg_asof), "rents": iso(rent_asof) if rents else None, "built": a.built},
             "window": {"from": iso(l12_from), "to": iso(tx_max)},
             "developer": D, "delivery": delivery, "status": stt, "sales": X_, "price_plan": price_plan}
        if dreason:
            f["delivery_reason"] = dreason
        if rents:
            f["rents"] = rents
        if market:
            f["market"] = market
        if cps:
            f["comparables"] = cps
        if nb:
            f["neighbourhood"] = nb
        if city:
            f["city"] = city
        if supply.get(r["area"]):
            f["supply"] = supply[r["area"]]
        if sib and sib in tot or sib:
            sr = next((x for x in projs if int(x["pn"]) == sib), None)
            if sr:
                X_["phase_two"] = {"name": title_case(brand_name.get(sib) or sr["name_en"] or ""), "project_number": sib, "status": sr["st"], "units": int(sr["units"] or 0), "sales": (tot.get(sib) or {"n": 0})["n"]}
        if ur:
            f["unit_register"] = ur
        if resales:
            f["resales"] = resales
        if am:
            f["amenities"] = am["list"]
            f["amenities_source"] = am["source"]
        else:
            f["amenities"] = None
            f["amenities_reason"] = "no developer web page or brochure for this project is on file, or none that can be tied to this registered project by its exact name and brand"
        return f

    # ------------------------------------------------------------------------------------------------ v411: developer material for projects that are not on the project register
    MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

    def date_long(x):
        m = re.match(r"(\d{4})-(\d{2})-(\d{2})", str(x or ""))
        return (str(int(m.group(3))) + " " + MONTHS_EN[int(m.group(2)) - 1] + " " + m.group(1)) if m else ""

    CLAIMS = {}
    for cf in sorted(glob.glob(os.path.join(ROOT, "data", "developer_claims", "*.json"))):
        c = json.load(open(cf, encoding="utf-8"))
        CLAIMS[c["key"]] = c

    def brand_group(canon):
        """the brand's record, by REGISTER COMPANY ID: every registered company whose name the crosswalk's company-name rule gives to this brand, with its projects from the project register.
        It is the brand's record, never the project's: the register names no company for a project that is not on it."""
        if canon not in X.BY_ID:
            return None
        ids = sorted(int(k) for k, d in devs.items() if d["name_en"] and X.canonical_of(d["name_en"])[0] == canon)
        if not ids:
            return None
        rr = rows(f"""select cast(developer_id as bigint) d, project_status s, count(*) n, sum(case when project_end_date < DATE '{tx_max}' then 1 else 0 end) pe,
            sum(case when project_end_date < DATE '{tx_max}' and project_status='FINISHED' then 1 else 0 end) pf from g_dld__projects where cast(developer_id as bigint) in ({",".join(str(i) for i in ids)}) group by 1,2""")
        if not rr:
            return None
        st, comp, pe, pf = collections.Counter(), set(), 0, 0
        for x in rr:
            st[x["s"]] += x["n"]
            comp.add(int(x["d"]))
            pe += int(x["pe"] or 0)
            pf += int(x["pf"] or 0)
        return {"brand": X.BY_ID[canon]["display"], "companies": len(comp), "companies_named": len(ids), "projects": sum(st.values()), "by_status": dict(sorted(st.items())), "past_planned_end": pe, "registered_finished": pf,
                "matched_by": "a company-name rule (registered company names that begin with the brand name; the register records no brands)",
                "source": "Dubai Land Department project register and developers register, by registered company id", "as_of": iso(reg_asof)}

    def claims_plan(kc):
        """the developer's own step-by-step schedule, as stated: percent per step and the date it prints. Dates it marks with an asterisk are indicative; no cash amount is derived."""
        pcs = kc["payment_plans"]
        sched, parts, quotes = [], [], []
        for i, p in enumerate(pcs["plans"]):
            ph = []
            for s in p["steps"]:
                lab = s["label"][0].lower() + s["label"][1:]
                star = "*" if s.get("marked") else ""
                if s.get("when") and lab.startswith("on completion"):
                    ph.append(("%g" % s["pct"]) + "% on completion (" + s["when"] + star + ")")
                elif s.get("when"):
                    ph.append(("%g" % s["pct"]) + "% on " + s["when"] + star)
                else:
                    ph.append(("%g" % s["pct"]) + "% " + lab)
            parts.append("Option " + str(i + 1) + " (the " + p["label"].replace(" Payment Plan", " plan").replace("Post Handover", "post-handover") + "): " + "; ".join(ph))
            quotes.append(p["quote"])
            sched.append({"label": p["label"], "steps": [{"label": s["label"], "pct": s["pct"], "when": s.get("when"), "marked": bool(s.get("marked"))} for s in p["steps"]], "total_pct": p["total_pct"]})
        src = kc["source"]
        text = "the developer states " + str(len(parts)) + " plans, each as a schedule. " + ". ".join(parts) + \
            ". Source: " + src["name"] + ", received " + date_long(src["received"]) + ". Dates marked * are indicative: the brochure does not say what the asterisk means here. No cash amount is worked out from either plan"
        return {"text": text, "milestones": [], "schedule": sched, "indicative_dates": True, "evidence": "DEVELOPER_CLAIMED", "as_of": src["received"],
                "source": {"file": "data/developer_claims/" + kc["key"] + "_launch_brochure.json (brochure image " + src["files"]["payment_plans_and_completion"] + ")", "url": None, "quote": " | ".join(quotes)}}, None, None

    def claims_amenities(kc):
        am = kc["amenities"]
        out = [x["where"] + ": " + ", ".join(x["items"]) for x in am["by_level"]]
        if am.get("pillars_also_listed"):
            out.append("Also listed on the brochure's pillars page, not on its amenity list by level: " + ", ".join(am["pillars_also_listed"]) + ". The brochure does not say who provides these or whether any is included in the price")
        return out, kc["source"]["name"] + ", received " + date_long(kc["source"]["received"]) + " (the developer's own material; developer says)"

    def kore_developer_says(kc, sizes):
        src = kc["source"]
        rows_ = []
        for r in kc["price_from"]["rows"]:
            rows_.append({"type": r["type"], "size_sqft": r["size_sqft"], "from_aed": r["from_aed"], "printed": re.sub(r"^\s*Starting:\s*", "", r["printed_price"])})
        return {"source": {"name": src["name"], "received": src["received"], "as_of": src["received"], "files": src["files"]},
                "handover_note": "The brochure prints the completion date with an asterisk and does not say what it means here, so the date is indicative.",
                "price_from": rows_, "concept": kc["concept"]["text"]}

    # names the index already holds: an announced project whose name reads the same as a registered one is NOT added (the button would no longer find the registered one by name)
    def pkey_py(n):
        return re.sub(r"[^a-z0-9\u0600-\u06ff]+", "", re.sub(r"\s+by\s+.*$", "", str(n or "").lower()))

    shards = collections.defaultdict(dict)
    index = []
    for r in projs:
        f = make(r)
        shards[district_slug(r["area"])][f["project"]["id"]] = f
        index.append({"id": f["project"]["id"], "name": f["project"]["name"], "brand_name": f["project"]["brand_name"], "district": district_slug(r["area"]), "project_number": f["project"]["project_number"]})
        records.append(f)

    # ------------------------------------------------------------------------------------------------ off-register: KORE by Imtiaz (the product sheet, docs/kore)
    kp = os.path.join(a.naj, "docs", "kore", "KORE_PRODUCT_DATA_SHEET.json")
    if os.path.exists(kp):
        ks = json.load(open(kp, encoding="utf-8"))
        kid = int(ks["sections"]["identity"]["register_ids"]["project_id"]["value"]) if isinstance(ks["sections"]["identity"].get("register_ids"), dict) and "project_id" in ks["sections"]["identity"]["register_ids"] else 962479984
        on_reg = con.execute(f"select count(*) from g_dld__projects where project_id={kid}").fetchone()[0]
        kn = con.execute("select count(*) from g_dld__transactions where upper(project_name_en) like 'KORE%'").fetchone()[0]
        if on_reg == 0:
            ku = rows(f"select rooms_en r, area_name_en ar, count(*) n from g_dld__units where cast(project_id as bigint)={kid} and property_type_en='Unit' group by 1,2")
            if ku:
                mix = {"units": 0, "studio": 0, "b1": 0, "b2": 0, "b3": 0, "b4plus": 0, "other": 0}
                for x in ku:
                    mix["units"] += x["n"]
                    lab = beds_label(x["r"])
                    mix["studio" if lab == "Studio" else ("b" + lab[0] if lab and lab[0] in "123" and lab[1] == " " else ("b4plus" if lab else "other"))] += x["n"]
                karea = collections.Counter({x["ar"]: x["n"] for x in ku}).most_common(1)[0][0]
                claims = ks["sections"]["commercial"]
                handover = claims.get("handover_stated", {}).get("value")
                kc = CLAIMS.get("kore")
                planb, preason, plabel = claims_plan(kc) if kc and kc.get("payment_plans") else plan_block([("imtiaz|kore", kore_plan)] if kore_plan else [])
                if kc and kc.get("handover"):
                    handover = kc["handover"]["text"]
                szr = collections.OrderedDict()
                for x in rows(f"select rooms_en r, count(*) n, min(actual_area) lo, max(actual_area) hi from g_dld__units where cast(project_id as bigint)={kid} and property_type_en='Unit' and actual_area>0 group by 1"):
                    lab = beds_label(x["r"])
                    if lab:
                        z = szr.setdefault(lab, {"beds": lab, "n": 0, "lo": None, "hi": None})
                        z["n"] += x["n"]
                        z["lo"] = float(x["lo"]) if z["lo"] is None else min(z["lo"], float(x["lo"]))
                        z["hi"] = float(x["hi"]) if z["hi"] is None else max(z["hi"], float(x["hi"]))
                sizes = [{"beds": z["beds"], "n": z["n"], "min_sqft": int(round(z["lo"] * SQFT)), "max_sqft": int(round(z["hi"] * SQFT))} for z in sorted(szr.values(), key=lambda z: (0 if z["beds"] == "Studio" else int(z["beds"][0])))]
                kz = {"all_time": 0, "first": None, "last": None, "l12": 0, "l12_median_price": None, "l12_median_psf": None, "median_price": None, "by_year": [], "by_beds": [], "land_registrations_excluded": 0,
                      "all_off_plan": False, "source": "Dubai Land Department sales register (unit sales, land excluded) to " + str(tx_max) + "; no sale row names KORE and the project is not on the project register"}
                if kn != 0:
                    kz = None
                alr = area_l12.get(karea)
                kf = {"schema": 1,
                      "project": {"id": "kore-by-imtiaz-offregister", "name": "KORE by Imtiaz", "brand_name": "KORE by Imtiaz", "area": area_display("Dubai Land Residence Complex"), "area_source": "register_master", "register_area": karea, "master_project": "Dubai Land Residence Complex", "project_number": None,
                                  "off_register": True, "off_register_note": "KORE is not on the Dubai Land Department project register: it has a building and unit register entry (project id " + str(kid) + ") and no project register row, so no register project number exists"},
                      "as_of": {"sales": iso(tx_max), "register": None, "rents": None, "built": a.built}, "window": {"from": iso(l12_from), "to": iso(tx_max)},
                      "developer": dict({"brand": "Imtiaz", "legal_entity": None, "evidence": "DEVELOPER_CLAIMED", "reason": "The developer's own material names Imtiaz as the brand (developer says); the project register has no record of KORE, so the company behind it is not named by the register"},
                                        **({"brand_source": {"text": kc["source"]["name"] + " (the developer's own brochure, received from the owner)", "as_of": kc["source"]["received"]}} if kc else {})),
                      "delivery": None, "delivery_reason": "the project is not on the project register and no registered company is named for it",
                      "status": None, "status_reason": "KORE is not on the project register, so no registered status, percent complete or planned end date can be given", "handover_claim": handover,
                      "sales": kz, "price_plan": {"payment_plan": planb, "fees": [], "fees_unknown": FEES_UNKNOWN}, "amenities": None,
                      "amenities_reason": "no developer amenities list for KORE is held in a form that can be quoted here",
                      "unit_register": {"source": "Dubai Land Department unit register, project id " + str(kid) + " (units to " + iso(units_asof) + ")", "as_of": iso(units_asof), "single": dict({"name": "KORE by Imtiaz", "project_number": None}, **mix),
                                        "sizes": sizes, "left_for_sale": "not known: the register does not record which homes are still for sale"}}
                if kc:
                    kf["developer_says"] = kore_developer_says(kc, sizes)
                    kf["amenities"], kf["amenities_source"] = claims_amenities(kc)
                    kf.pop("amenities_reason", None)
                bg = brand_group("imtiaz")
                if bg:
                    kf["delivery_brand"] = bg
                if planb is None:
                    kf["price_plan"]["payment_plan_reason"] = preason
                    if plabel:
                        kf["price_plan"]["payment_plan_label"] = plabel
                if area_year.get(karea):
                    kf["market"] = {"area_by_year": area_year[karea], "dubai_by_year": dubai_year}
                if alr:
                    kf["city"] = {"l12_sales": cy["n"], "l12_psf": psf(cy["m"]), "offplan_share": round(float(cy["o"]), 3), "area_l12_sales": alr["n"], "area_l12_psf": psf(alr["m"])}
                if supply.get(karea):
                    kf["supply"] = supply[karea]
                shards[district_slug(karea)][kf["project"]["id"]] = kf
                index.append({"id": kf["project"]["id"], "name": kf["project"]["name"], "brand_name": kf["project"]["brand_name"], "district": district_slug(karea), "project_number": None})
                records.append(kf)
                counters["off_register"] += 1
                if kz is None:
                    counters["kore_sales_rows_found"] = kn

    # ------------------------------------------------------------------------------------------------ v411: every other project the developer announces that is in NO register
    # The developer's own material (announced.json from the developers' own web pages and availability sheets; the dev_meta portfolios; the dated payment-plan files) gives facts the register cannot.
    # Each such project gets a record whose developer, handover, homes, amenities and plan are DEVELOPER_CLAIMED with their date and source line, whose sales are the register's own zero (checked: no sale
    # row and no unit-register row carries its name), and whose delivery record is the BRAND's, by registered company id, never the project's. A portal is never a source. A project that is on the
    # register, or whose name reads the same as a registered one, is not added: the register record stays exactly as it was.
    import hashlib
    dev_report = {"announced_entries": 0, "added": 0, "skipped": collections.Counter(), "with_handover": 0, "with_units": 0, "with_amenities": 0, "with_plan": 0, "with_brand_delivery": 0, "top20": []}
    ann_path = os.path.join(ROOT, "data", "announced", "announced.json")
    if os.path.exists(ann_path):
        ann = json.load(open(ann_path, encoding="utf-8"))
        reg_keys = {pkey_py(x["name"]) for x in index} | {pkey_py(x["brand_name"]) for x in index}
        tx_names = {norm(r["n"]) for r in rows("select distinct project_name_en n from g_dld__transactions where project_name_en is not null")}
        un_names = {norm(r["n"]) for r in rows("select distinct project_name_en n from g_dld__units where project_name_en is not null")}
        dist_name = {district_slug(r["area"]): r["area"] for r in projs if r["area"]}
        plan_by_name = {}
        for key, v in sorted(pp["projects"].items()):
            cn = X.canonical_of(v["developer"])[0]
            for nmx in [v["project"]] + list(v.get("aliases") or []):
                plan_by_name.setdefault((cn, norm(nmx)), (key, v))
        bg_cache = {}
        seen_keys, used_ids = set(), {x["id"] for x in index}
        flat = []
        for dev, groups in sorted(ann["d"].items()):
            for dslug, lst in sorted(groups.items()):
                for e in lst:
                    flat.append((dev, dslug, e))
        flat.sort(key=lambda t: (0 if t[2].get("t") == "p" else 1, t[0], t[2]["n"]))        # a web page before an availability sheet when both name the project
        for dev, dslug, e in flat:
            dev_report["announced_entries"] += 1
            nm = clean(e.get("n"))
            sk = dev_report["skipped"]
            if not nm:
                sk["no name"] += 1
                continue
            if e.get("od"):
                sk["outside Dubai"] += 1
                continue
            if e.get("pm"):
                sk["possible register match (held, findable as the register project)"] += 1
                continue
            if norm(nm) in name_to_pns or norm(nm) in tx_names or norm(nm) in un_names:
                sk["name is on the project, sales or unit register"] += 1
                continue
            pk = pkey_py(nm)
            if not pk or pk in reg_keys:
                sk["name reads like a registered project (the button would no longer find it by name)"] += 1
                continue
            if pk in seen_keys:
                sk["same name already added"] += 1
                continue
            seen_keys.add(pk)
            dn = clean(e.get("dn")) or dev
            cn = X.canonical_of(dn)[0]
            cn = cn if cn in X.BY_ID else None
            rid = str(e["id"])
            if len(rid) > 60 or not re.fullmatch(r"[a-z0-9_-]{1,60}", rid):
                rid = (re.sub(r"[^a-z0-9_-]+", "-", rid.lower())[:50].strip("-") or "announced") + "-" + hashlib.sha1(str(e["id"]).encode()).hexdigest()[:8]
            if rid in used_ids:
                sk["duplicate id"] += 1
                continue
            used_ids.add(rid)
            reg_area = dist_name.get(dslug) if dslug != "_" else None
            register_area = reg_area or "Area not stated"
            page = e.get("t") == "p"
            src_name = "the developer's own web page" if page else "the developer's own availability sheet"
            src_text = src_name + (" " + e["url"] if e.get("url") else "")
            asof = str(e["f"])[:10]
            ds = {"source": dict({"name": src_name, "as_of": asof}, **({"url": e["url"]} if e.get("url") else {}))}
            ho = clean(e.get("ho"))
            if isinstance(e.get("u"), int) and e["u"] > 0:
                ds["units_stated"] = int(e["u"])
            plb, plr, pll = None, "no developer sheet or offer for this project is on file, so the plan cannot be stated; ask the developer", None
            ph = plan_by_name.get((cn, norm(nm))) if cn else None
            if ph:
                plb, plr, pll = plan_block([ph])
            am = amen_dev.get((cn, norm(nm))) if cn else None
            if cn not in bg_cache:
                bg_cache[cn] = brand_group(cn) if cn else None
            bgx = bg_cache[cn]
            kz = {"all_time": 0, "first": None, "last": None, "l12": 0, "l12_median_price": None, "l12_median_psf": None, "median_price": None, "by_year": [], "by_beds": [], "land_registrations_excluded": 0, "all_off_plan": False,
                  "source": "Dubai Land Department sales register (unit sales, land excluded) to " + str(tx_max) + "; no sale row names " + nm + " and the project is not on the project register"}
            f = {"schema": 1,
                 "project": {"id": rid, "name": nm, "brand_name": nm, "area": area_display(e["a"]) if e.get("a") else (area_display(reg_area) if reg_area else "Dubai, district not stated by the developer"), "area_source": "developer_says",
                             "register_area": register_area, "master_project": None, "project_number": None, "off_register": True,
                             "off_register_note": nm + " is not on the Dubai Land Department project, sales or unit registers we hold: it is known only from the developer's own material, so no register project number exists"},
                 "as_of": {"sales": iso(tx_max), "register": None, "rents": None, "built": a.built}, "window": {"from": iso(l12_from), "to": iso(tx_max)},
                 "developer": {"brand": dn, "legal_entity": None, "evidence": "DEVELOPER_CLAIMED",
                               "reason": "The developer's own material names " + dn + " as the brand (developer says); the project register has no record of " + nm + ", so the company behind it is not named by the register",
                               "brand_source": {"text": src_text, "as_of": asof}},
                 "delivery": None, "delivery_reason": "the project is not on the project register and no registered company is named for it",
                 "status": None, "status_reason": nm + " is not on the project register, so no registered status, percent complete or planned end date can be given", "handover_claim": ho,
                 "sales": kz, "price_plan": {"payment_plan": plb, "fees": [], "fees_unknown": FEES_UNKNOWN}, "developer_says": ds}
            if plb is None:
                f["price_plan"]["payment_plan_reason"] = plr
                if pll:
                    f["price_plan"]["payment_plan_label"] = pll
            if am:
                f["amenities"], f["amenities_source"] = am["list"], am["source"] + " (developer says)"
            else:
                f["amenities"], f["amenities_reason"] = None, "no developer amenities list for " + nm + " is held in a form that can be quoted here"
            if bgx:
                f["delivery_brand"] = bgx
            shards[district_slug(register_area)][rid] = f
            index.append({"id": rid, "name": nm, "brand_name": nm, "district": district_slug(register_area), "project_number": None})
            records.append(f)
            dev_report["added"] += 1
            got = [k for k, ok in (("handover", bool(ho)), ("homes stated", "units_stated" in ds), ("amenities", bool(am)), ("payment plan", bool(plb)), ("brand delivery record", bool(bgx))) if ok]
            dev_report["with_handover"] += bool(ho)
            dev_report["with_units"] += "units_stated" in ds
            dev_report["with_amenities"] += bool(am)
            dev_report["with_plan"] += bool(plb)
            dev_report["with_brand_delivery"] += bool(bgx)
            dev_report["top20"].append({"id": rid, "name": nm, "brand": dn, "fields": got, "n": len(got), "source": src_text, "as_of": asof})
        dev_report["top20"].sort(key=lambda x: (-x["n"], x["brand"], x["name"]))
        dev_report["gain_any_field"] = sum(1 for x in dev_report["top20"] if x["n"] > 0)
        dev_report["top20"] = dev_report["top20"][:20]
        dev_report["skipped"] = dict(dev_report["skipped"])
        counters["announced_added"] = dev_report["added"]
    report["developer_material"] = dev_report

    # ------------------------------------------------------------------------------------------------ write
    os.makedirs(a.out_dir, exist_ok=True)
    for old in glob.glob(os.path.join(a.out_dir, "investor_tiers_facts_*.json")):
        os.remove(old)
    sizes = {}
    for d, projmap in sorted(shards.items()):
        p = os.path.join(a.out_dir, "investor_tiers_facts_" + d + ".json")
        with open(p, "w", encoding="utf-8", newline="\n") as fh:
            json.dump({"projects": projmap}, fh, ensure_ascii=False, separators=(",", ":"), sort_keys=False, default=str)
        sizes[d] = os.path.getsize(p)
    index.sort(key=lambda x: (x["project_number"] is None, x["project_number"] or 0, x["id"]))
    with open(os.path.join(a.out_dir, "index.json"), "w", encoding="utf-8", newline="\n") as fh:
        json.dump({"as_of": {"sales": iso(tx_max), "register": iso(reg_asof), "built": a.built}, "count": len(index), "projects": index}, fh, ensure_ascii=False, separators=(",", ":"))
    ids = [x["id"] for x in index]
    assert len(ids) == len(set(ids)), "duplicate project ids"

    def known(f):
        X_, S_ = f.get("sales"), f.get("status")
        return {"developer": bool(f["developer"] and f["developer"].get("legal_entity")), "status": S_ is not None, "planned_end": bool(S_ and S_.get("planned_end")),
                "sales": X_ is not None, "sales_nonzero": bool(X_ and X_["all_time"] > 0), "price": bool(X_ and X_.get("median_price")), "plan": bool(f["price_plan"]["payment_plan"]),
                "delivery_record": bool(f.get("delivery") and f["delivery"].get("record")), "delivery_entity": bool(f.get("delivery")), "amenities": bool(f.get("amenities")), "rents": bool(f.get("rents")),
                "unit_register": bool(f.get("unit_register"))}
    dist = collections.Counter()
    for f in records:
        for k, v in known(f).items():
            dist[(k, v)] += 1
    report.update({"built": a.built, "records": len(records), "districts": len(shards), "register_projects": len(projs), "counters": dict(counters), "area_source": dict(area_src),
                   "distribution": {k: {"known": dist[(k, True)], "unknown": dist[(k, False)]} for k in known(records[0])},
                   "largest_shard": max(sizes.items(), key=lambda kv: kv[1]), "total_bytes": sum(sizes.values()), "index_bytes": os.path.getsize(os.path.join(a.out_dir, "index.json")),
                   "sizes": sizes, "as_of": {"sales": iso(tx_max), "register": iso(reg_asof)}})
    with open(os.path.join(a.out_dir, "build_report.json"), "w", encoding="utf-8", newline="\n") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=1)
    print(json.dumps({k: report[k] for k in ("records", "districts", "counters", "distribution", "largest_shard", "total_bytes", "index_bytes")}, ensure_ascii=False, indent=1))
    print("plan links", len(report["plan_links"]), "unlinked", report["plan_unlinked"], "| amenity links", report["amenity_links"], report["amenity_files"], "unlinked", report["amenity_unlinked"])


if __name__ == "__main__":
    main()
