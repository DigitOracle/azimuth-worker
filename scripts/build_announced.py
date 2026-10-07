"""v397d - PROJECTS THE DEVELOPER ANNOUNCES THAT ARE IN NO REGISTER (completeness fix #9; Kendall: 'if it exists it must be findable, with an honest label').
OFFLINE, DETERMINISTIC, RE-RUNNABLE. Reads local files (the published lake read-only, the developer portfolios, the audit's register universe) and the live developer index (read-only, through
the worker's public /img route, or a saved copy with --index). Writes data/announced/announced.json, data/announced/announced_matched.csv, data/announced/announced_skipped.csv and
data/search_extra/announced_search.json. Nothing is deployed, nothing is written to KV (scripts/publish_announced.py does that, and only Kendall runs it).

  python scripts/build_announced.py [--naj C:\\Dev\\naj-market-pulse] [--universe <universe_projects.csv>] [--index <devmap_index.json | URL>] [--out data/announced/announced.json]

SOURCES (the developer's own claim, never a register): (a) data/dev_meta/developer_dna.json -> developers.<name>.portfolio.properties (the developers' web-site portfolios, page date = the fetch date), the same
pages as data/dev_meta/*_portfolio.json (a portfolio file the dna does not carry is read too); (b) the lake table sheet_project (the developers' availability sheets, page date = sheet date).
REGISTER = the Land Department project register extract of 15 Jun 2026 + the 1 Sep 2026 delta + projects named only on the sales or building registers (the audit's universe_projects.csv, 3,915 rows).

MATCHING RULE (a project is 'registered' only on one of these; a bare name is never enough):
  M1  the exact normalised name (letters and digits only, lower case, accents folded) equals a register project name (English or Arabic alternative) AND the register row has the same developer;
  M2  the source binds the project to a register name (the lake's sheet_project.register_names, bound by the lake matcher against the developers register) that exists on the register, or the source
      carries a register project number;
  'same developer' = the register row's crosswalk id is the developer's slug, or the live index files that register project (by number or exact name) under that developer, or the register company is a
  company the index alias map / the dna entity list gives to that developer, or the company name contains the developer's name, or the project name says 'by <developer>'. (The register's own developer
  field is often the land owner or master company, so it cannot be the only test.)
  HELD (not shown, not counted as announced: 'a possible register match'): the same developer and the same CORE name (the exact name with ' by X', ' at X', 'phase', 'the' and roman numerals removed, trailing
  phase digits dropped) - an Emaar 'Altan At Dubai Creek Harbour' against the register's 'ALTAN', or 'Anya 2' against a registered 'Anya'. These are findable as the register project.
  A name that equals a register project of ANOTHER developer is NOT a match (counted and listed as a name collision; it is shown).
SKIPPED (not a project; reported with the reason): outside Dubai (the product holds Dubai districts only), the name of a community or area, the developer's own name, a malformed or page-slug name, a duplicate.
DEVELOPER PROFILE: the developer name is matched EXACTLY (letters and digits) against the live index's developer list, then its alias map, then the dna aliases. No match = keyed '~<name>' (no profile page).
DISTRICT: the developer's own location text must equal EXACTLY one of the 42 districts' names, an index community of a district, or a Dubai Municipality community that sits in one district; else
the project is filed under '_' (area text only).
ENTRY (compact keys): n name, dn developer as written, a area/location as the developer says, u units stated, us units on the developer's availability sheet, ho handover as stated, url, f page date, t source kind
(p portfolio page, s availability sheet), e evidence (always DEVELOPER_CLAIMED), id stable id. SHAPE: d[<developer slug or ~name>][<district slug or _>] = [entry, ...].
"""
import argparse, collections, csv, datetime as dt, json, os, re, sys, unicodedata, urllib.request

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
LIVE_INDEX = "https://azimuth-2.digitalchemy.workers.dev/img/devmap_index"
UA = {"User-Agent": "najma-ops/1.0"}
LABEL = "Announced by the developer, not yet registered"
OUTSIDE = re.compile(r"\b(sharjah|abu dhabi|ajman|uaq|umm al quwain|ras al khaimah|rak|fujairah|marjan|siniya|saadiyat|yas island|al hamra|al reem|sheffield)\b", re.I)
ROMAN = {"i": "1", "ii": "2", "iii": "3", "iv": "4", "v": "5", "vi": "6", "vii": "7", "viii": "8", "ix": "9", "x": "10"}


def fold(s):
    s = unicodedata.normalize("NFKD", str(s or ""))
    return "".join(c for c in s if not unicodedata.combining(c))


def nk(s):
    return re.sub(r"[^a-z0-9\u0600-\u06ff]", "", fold(s).lower().replace("&", "and"))


def core(s):
    """the CORE name used only to HOLD a possible register match, never to match."""
    t = fold(s).lower().replace("&", "and")
    t = re.sub(r"\s+(by|at|in)\s+.*$", "", t)
    t = re.sub(r"\bphase\s*\w+\b", " ", t)
    t = re.sub(r"^\s*the\s+", "", t)
    t = " ".join(ROMAN.get(w, w) for w in re.split(r"[^a-z0-9]+", t) if w)
    return re.sub(r"[^a-z0-9\u0600-\u06ff]", "", t)


def base_no_phase(c):
    return re.sub(r"\d+$", "", c)


def clean_name(n):
    n = str(n or "").replace("\ufffd", "-").replace("\u2013", "-").replace("\u2014", "-")
    return re.sub(r"\s+", " ", n).strip()


def load_json(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def load_index(src):
    if src and os.path.exists(src):
        return load_json(src)
    url = src or LIVE_INDEX
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        raw = r.read()
    if raw[:2] == b"\x1f\x8b":
        import gzip
        raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8"))


def date10(s):
    m = re.match(r"(\d{4}-\d{2}-\d{2})", str(s or ""))
    return m.group(1) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--naj", default=r"C:\Dev\naj-market-pulse")
    ap.add_argument("--universe", default="")
    ap.add_argument("--index", default="")
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "announced", "announced.json"))
    ap.add_argument("--search-out", default=os.path.join(ROOT, "data", "search_extra", "announced_search.json"))
    ap.add_argument("--built", default=dt.date.today().isoformat())
    a = ap.parse_args()
    naj = a.naj
    uni_path = a.universe or os.path.join(naj, "docs", "COMPLETENESS_AUDIT_07OCT2026", "universe_projects.csv")
    csv.field_size_limit(10 ** 9)

    # ---------------------------------------------------------------- the live index: developers, aliases, districts
    IX = load_index(a.index)
    dev_by_nk = collections.defaultdict(set)
    for slug, v in IX["devs"].items():
        dev_by_nk[nk(v["name"])].add(slug)
    alias_nk = collections.defaultdict(set)
    for k, s in IX.get("alias", {}).items():
        alias_nk[nk(k)].add(s)
    areas = IX["areas"]
    dna = load_json(os.path.join(naj, "data", "dev_meta", "developer_dna.json"))["developers"]
    dna_alias = {}
    dna_entities = collections.defaultdict(set)
    for dn, v in dna.items():
        for al in [dn] + list(v.get("aliases") or []):
            dna_alias[nk(al)] = dn
        for e in list(v.get("dld_entities") or []) + [x.get("name") for x in (v.get("dld_entity_links") or [])] + [x.get("entity") for x in (v.get("dld_projects_2026") or [])]:
            if e:
                dna_entities[dn].add(nk(e))

    def resolve_dev(name):
        """exact matches only: the index developer list, then its alias map, then the dna aliases (which go back to the developer list)."""
        k = nk(name)
        if k in dev_by_nk and len(dev_by_nk[k]) == 1:
            return next(iter(dev_by_nk[k]))
        if k in alias_nk and len(alias_nk[k]) == 1:
            return next(iter(alias_nk[k]))
        if k in dna_alias:
            k2 = nk(dna_alias[k])
            if k2 in dev_by_nk and len(dev_by_nk[k2]) == 1:
                return next(iter(dev_by_nk[k2]))
        return None

    # districts: names, index communities, Dubai Municipality communities that sit in one district
    place = {}
    ambiguous = set()

    def put_place(name, slug):
        k = nk(name)
        if not k:
            return
        if k in place and place[k] != slug:
            ambiguous.add(k)
        place.setdefault(k, slug)
    for s, v in areas.items():
        put_place(v["name"], s)
        put_place(s, s)
    for s, v in areas.items():
        for c in v.get("comms") or []:
            put_place(c, s)
    try:
        import duckdb
        con = duckdb.connect(os.path.join(naj, "data", "graph", "najma.duckdb"), read_only=True)
        dmc = collections.defaultdict(list)
        for s, nm, b in con.execute("select slug, name_en, buildings from district_dm_community").fetchall():
            if s in areas:
                dmc[nk(nm)].append((b or 0, s))
        for k, l in dmc.items():
            if len({s for _, s in l}) == 1 and k not in place:
                place[k] = l[0][1]
        sheets = con.execute("select name, developer, sheet_date, register_names, on_sheet from sheet_project order by sheet_key").fetchall()
    except Exception as ex:
        print("lake not readable:", ex)
        sys.exit(1)
    for k in ambiguous:
        place.pop(k, None)
    # the same places keyed by their CORE form (roman numerals as digits), to read 'Arabian Ranches Iii' as 'Arabian Ranches III'
    place_c, place_c_amb = {}, set()
    for s, v in areas.items():
        for nm_ in [v["name"]] + list(v.get("comms") or []):
            kc = core(nm_)
            if kc in place_c and place_c[kc] != s:
                place_c_amb.add(kc)
            place_c.setdefault(kc, s)
    for k in place_c_amb:
        place_c.pop(k, None)
    for k, s in list(place.items()):
        place_c.setdefault(k, s)

    def find_place(text):
        """EXACT only: the whole text equals a district, an index community or a Dubai Municipality community."""
        kc = core(text) if text else ""
        return (place.get(nk(text)) or place_c.get(kc)) if text else None

    def locate(name, raw, title_suffix):
        """the developer's own words for where the project is, in this order: its location field, its page-title suffix, the end of the project name (' at X', ' in X', or its last 2-4 words)."""
        def tidy(t):
            t = re.sub(r"\s+by\s+.*$", "", clean_name(t), flags=re.I)
            t = re.sub(r"^[-\s]+|[-\s]+$", "", t)
            m = re.search(r"\b(?:in|at)\s+(.+)$", t, re.I)
            return (m.group(1) if m and find_place(m.group(1)) else t).strip()
        raw, title_suffix = tidy(raw or ""), tidy(title_suffix or "")
        for t in (raw, title_suffix):
            if t and find_place(t):
                return t, find_place(t)
        n = clean_name(name)
        m = re.search(r"\b(?:at|in)\s+(.+)$", n, re.I)
        if m and find_place(m.group(1)):
            return clean_name(m.group(1)), find_place(m.group(1))
        w = n.split()
        for k in (4, 3, 2):
            if len(w) > k:
                t = " ".join(w[-k:])
                if find_place(t):
                    return t, find_place(t)
        # a clean place name that is not a district: kept as the developer's text only when it is short, has no sentence in it and is not an echo of the project name
        for t in (raw, title_suffix):
            if t and len(t) <= 40 and nk(t) not in ("dubai", "uae", "unitedarabemirates") and not re.search(r"[,;:]|\b(for sale|with|where|inspired|enjoy|luxury|and|the|is|a|development|community|modern)\b", t, re.I) and nk(t) not in nk(n) and nk(n) not in nk(t):
                return t, None
        return "", None
    area_names = {nk(v["name"]) for v in areas.values()}
    comm_names = {nk(c) for v in areas.values() for c in (v.get("comms") or [])}

    # ---------------------------------------------------------------- the register universe
    reg = list(csv.DictReader(open(uni_path, encoding="utf-8-sig")))
    reg_full = collections.defaultdict(list)
    reg_core = collections.defaultdict(list)
    masters = set()
    for r in reg:
        for n in [r["name"]] + [x for x in (r.get("name_alt") or "").split("|") if x]:
            if nk(n):
                reg_full[nk(n)].append(r)
            if core(n):
                reg_core[core(n)].append(r)
        if r.get("master"):
            masters.add(nk(r["master"]))

    # the product's own developer attribution: the register project numbers (and names) the live index files under each developer (bx.p), the no-sales file, and the dna's register projects 2026
    attr_pn = collections.defaultdict(set)
    attr_nm = collections.defaultdict(set)
    for ar in areas.values():
        for ds, dv in (ar.get("devs") or {}).items():
            for i, b in enumerate(dv.get("b") or []):
                attr_nm[ds].add(nk(b[2] if len(b) > 2 else ""))
            for x in dv.get("bx") or []:
                if isinstance(x, dict) and x.get("p") not in (None, ""):
                    attr_pn[ds].add(str(x["p"]))
    try:
        for ds, dd in load_json(os.path.join(ROOT, "data", "nosales", "nosales.json"))["d"].items():
            for lst in dd.values():
                for x in lst:
                    attr_nm[ds].add(nk(x["n"]))
                    if x.get("p") not in (None, ""):
                        attr_pn[ds].add(str(x["p"]))
    except Exception:
        pass
    dna_proj = collections.defaultdict(set)
    for dn, v in dna.items():
        for x in v.get("dld_projects_2026") or []:
            dna_proj[dn].add(nk(x.get("project")))

    def same_dev(r, slug, dev_display, dna_key, name):
        canon = (r.get("developer_canon") or "")
        if slug and canon == slug:
            return True
        if slug and (str(r.get("project_number")) in attr_pn.get(slug, ()) or nk(r.get("name")) in attr_nm.get(slug, ())):
            return True
        if dna_key and nk(r.get("name")) in dna_proj.get(dna_key, ()):
            return True
        rn = nk(r.get("developer_register") or "")
        if slug and any(s == slug for s in alias_nk.get(rn, ())):
            return True
        if dna_key and rn in dna_entities.get(dna_key, ()):
            return True
        dk = nk(dev_display)
        if len(dk) >= 4 and dk in rn:
            return True
        m = re.search(r"\bby\s+(.+)$", fold(r.get("name") or "").lower())
        if m and len(dk) >= 4 and dk in nk(m.group(1)):
            return True
        return False

    # ---------------------------------------------------------------- candidates
    cands = []
    seen_files = set()
    pf = collections.OrderedDict()
    for dn, v in dna.items():
        port = v.get("portfolio") or {}
        for p in port.get("properties") or []:
            pf[(dn, p.get("slug") or p.get("name"))] = (dn, p, port.get("fetched"), port.get("source"))
    dna_total = len(pf)
    file_only = 0
    for fp in sorted(os.listdir(os.path.join(naj, "data", "dev_meta"))):
        if not fp.endswith("_portfolio.json"):
            continue
        j = load_json(os.path.join(naj, "data", "dev_meta", fp))
        key = fp[:-len("_portfolio.json")]
        dnk = next((d for d, v in dna.items() if (v.get("portfolio") or {}).get("source") == j.get("source")), None)
        for p in j.get("properties") or []:
            if dnk and (dnk, p.get("slug") or p.get("name")) in pf:
                continue
            file_only += 1
            pf[(dnk or key, p.get("slug") or p.get("name"))] = (dnk or key, p, j.get("fetched"), j.get("source"))
    for (dk, _), (dn, p, fetched, src) in pf.items():
        f = p.get("facts") or {}
        title = p.get("title") or ""
        loc = clean_name(p.get("area") or p.get("location") or f.get("location") or "")
        suf = ""
        if "|" in title:
            suf = clean_name(title.rsplit("|", 1)[1])
            if nk(suf) == nk(dn) or re.search(r"(emaar|sobha|imtiaz|meraas|properties|developments?|group)\b", suf, re.I):
                suf = ""
        cands.append({"dn": dn, "name": clean_name(p.get("name") or p.get("title")), "a": "", "loc_raw": loc, "loc_title": suf, "u": p.get("units") or f.get("units"), "us": None, "ho": p.get("handover") or f.get("handover"),
                      "url": p.get("url"), "f": date10(fetched), "t": "p", "bound": [], "txt": " ".join([title, p.get("h1") or "", p.get("url") or "", str(loc or "")]), "pn": p.get("project_number")})
    for nm, dev, sd, rn, ons in sheets:
        try:
            bound = json.loads(rn or "[]")
        except Exception:
            bound = []
        cands.append({"dn": dev, "name": clean_name(nm), "a": "", "loc_raw": "", "loc_title": "", "u": None, "us": ons if ons else None, "ho": None, "url": None, "f": date10(sd), "t": "s", "bound": bound, "txt": nm, "pn": None})

    def units_of(x):
        try:
            v = int(float(str(x).replace(",", "")))
            return v if v > 0 else None
        except Exception:
            return None

    # ---------------------------------------------------------------- classify
    matched, held, skipped, collide, shown = [], [], [], [], []
    taken = {}
    stats = collections.Counter()
    acct = []   # the accounting: every candidate in exactly one bucket

    def add_shown(c, bucket, core_key):
        """a candidate that is shown, unless the same developer already announces the same core name (then it is a duplicate, listed with its reason)."""
        dk = (c["slug"] or "~" + nk(c["dn"]), core_key)
        if dk in taken:
            c["bucket"], c["detail"] = "skipped-duplicate", "duplicate of another announcement by the same developer (kept: %s)" % taken[dk]
            skipped.append((c["name"], c["dn"], c["detail"], c["t"]))
            return
        taken[dk] = c["name"]
        c["bucket"] = bucket
        shown.append(c)

    for ci, c in enumerate(cands):
        c["cid"] = "c%03d" % (ci + 1)
        c["bucket"], c["detail"], c["slug"], c["dev_display"] = None, "", None, c["dn"]
        name, devn = c["name"], c["dn"]
        if not name:
            c["bucket"], c["detail"] = "skipped-malformed", "no project name"
            skipped.append(("(no name)", devn, c["detail"], c["t"]))
            continue
        slug = resolve_dev(devn)
        dna_key = next((d for d in dna if nk(d) == nk(devn) or dna_alias.get(nk(devn)) == d), None)
        dev_display = IX["devs"][slug]["name"] if slug else devn
        c["slug"], c["dev_display"] = slug, dev_display
        f_name = nk(name)
        reason = None
        mo = OUTSIDE.search(name) or OUTSIDE.search(c["txt"])
        if not f_name or (len(f_name) >= 16 and " " not in name) or re.search(r"\b(.{6,})\b.*\b\1\b", fold(name).lower()) and len(name) > 40:
            reason = "malformed name or page slug, not a project name"
        elif mo:
            pl = c["loc_raw"] if c["loc_raw"] and mo.group(1).lower() in c["loc_raw"].lower() and len(c["loc_raw"]) <= 40 else mo.group(1).title()
            c["od"] = pl
            add_shown(c, "shown-outside-Dubai", core(name) or f_name)
            c["detail"] = c["detail"] or "outside Dubai: the developer's page says '%s'" % mo.group(1).lower()
            continue
        elif f_name in masters or f_name in area_names or f_name in comm_names or f_name in place:
            reason = "the name of a community or area, not a project"
        elif f_name == nk(devn) or f_name == nk(dev_display):
            reason = "the developer's own name (a sheet total or a page title), not a project"
        if reason:
            c["bucket"], c["detail"] = "skipped-malformed", reason
            skipped.append((name, devn, reason, c["t"]))
            continue
        # M1 / M2
        hit = [r for r in reg_full.get(f_name, []) if same_dev(r, slug, dev_display, dna_key, name)]
        rule = "M1 exact name + same developer"
        if not hit:
            for b in c["bound"]:
                h2 = list(reg_full.get(nk(b), []))
                if h2:
                    hit, rule = h2, "M2 the source's own binding to a register name"
                    break
        if not hit and c.get("pn"):
            h3 = [r for r in reg if str(r["project_number"]) == str(c["pn"])]
            if h3:
                hit, rule = h3, "M2 register project number carried by the source"
        if hit:
            r = hit[0]
            c["bucket"], c["detail"] = "matched", rule + " -> " + ("PN" + str(r["project_number"]) if r["project_number"] else r["key"])
            matched.append((name, devn, rule, "PN" + str(r["project_number"]) if r["project_number"] else r["key"], r["name"], c["t"]))
            continue
        # the same exact name is on the register but the register company is not provably this developer's: NOT a match (a bare name is never enough), and NOT shown as 'not registered' either,
        # because the register does hold a project of that very name. Held and listed for Kendall (announced_name_collisions.csv).
        other = [r for r in reg_full.get(f_name, [])]
        if other:
            kk = "PN" + str(other[0]["project_number"]) if other[0]["project_number"] else other[0]["key"]
            collide.append((name, devn, kk, other[0]["name"], other[0].get("developer_register", "")))
            c["pm"] = {"n": other[0]["name"], "k": kk}
            add_shown(c, "shown-possible-match", core(name) or f_name)
            c["detail"] = c["detail"] or "same exact name on the register (%s %s), developer not confirmed" % (kk, other[0]["name"])
            continue
        # HELD: same developer, same core name (or same base after dropping a trailing phase number)
        cc = core(name)
        ch = [r for r in reg_core.get(cc, []) if same_dev(r, slug, dev_display, dna_key, name)] if cc else []
        if not ch and cc and len(base_no_phase(cc)) >= 4:
            for k2, rows in reg_core.items():
                if base_no_phase(k2) == base_no_phase(cc) and any(same_dev(r, slug, dev_display, dna_key, name) for r in rows):
                    ch = [r for r in rows if same_dev(r, slug, dev_display, dna_key, name)]
                    break
        if ch:
            kk = "PN" + str(ch[0]["project_number"]) if ch[0]["project_number"] else ch[0]["key"]
            held.append((name, devn, kk, ch[0]["name"], c["t"]))
            c["pm"] = {"n": ch[0]["name"], "k": kk}
            add_shown(c, "shown-possible-match", cc or f_name)
            c["detail"] = c["detail"] or "same developer, same core name as register project %s %s" % (kk, ch[0]["name"])
            continue
        add_shown(c, "shown", cc or f_name)

    # ---------------------------------------------------------------- build the file
    d = collections.defaultdict(lambda: collections.defaultdict(list))
    n_dist = 0
    # a units figure that three or more projects of one developer share is the page's community figure, not the project's: dropped
    ucount = collections.Counter((c["slug"], units_of(c["u"])) for c in shown if units_of(c["u"]))
    dropped_units = 0
    for c in shown:
        if units_of(c["u"]) and ucount[(c["slug"], units_of(c["u"]))] >= 3:
            c["u"] = None
            dropped_units += 1
        if c.get("od"):
            c["a"], dist = "", None      # outside Dubai: no district, no map position; the label carries the place the developer gives
        else:
            c["a"], dist = locate(c["name"], c["loc_raw"], c["loc_title"])
        if dist:
            n_dist += 1
        e = {"id": "ann-%s-%s" % (c["slug"] or nk(c["dn"]), nk(c["name"]))[:90], "n": c["name"], "e": "DEVELOPER_CLAIMED", "dn": c["dev_display"] if c["slug"] else c["dn"], "t": c["t"]}
        if c["a"]:
            e["a"] = c["a"]
        u = units_of(c["u"])
        if u:
            e["u"] = u
        us = units_of(c["us"])
        if us:
            e["us"] = us
        if c["ho"]:
            e["ho"] = clean_name(c["ho"])
        if c["url"]:
            e["url"] = c["url"]
        if c["f"]:
            e["f"] = c["f"]
        if c.get("od"):
            e["od"] = c["od"]
        if c.get("pm"):
            e["pm"] = c["pm"]
        # lw = 'listed, no register entry found' wording: a handover year of 2025 or earlier (already built, so 'not yet registered' would be wrong), or a hotel, mall or staff-accommodation type by name
        my = re.search(r"\b(20\d\d)\b", str(c["ho"] or ""))
        if (my and int(my.group(1)) <= 2025) or re.search(r"\b(hotel|resort|mall|staff accommodation)\b", c["name"], re.I):
            e["lw"] = 1
        d[c["slug"] or "~" + nk(c["dn"])][dist or "_"].append(e)
    out = {}
    for dev in sorted(d):
        out[dev] = {}
        for dist in sorted(d[dev]):
            out[dev][dist] = sorted(d[dev][dist], key=lambda e: (e["n"].lower()))
    total = sum(len(l) for ds in out.values() for l in ds.values())
    with_profile = sum(len(l) for dev, ds in out.items() if not dev.startswith("~") for l in ds.values())
    by_dev = collections.Counter({dev: sum(len(l) for l in ds.values()) for dev, ds in out.items()})
    meta = {"built": a.built, "count": total, "label": LABEL, "rule": "DEVELOPER_CLAIMED only; matched/held/skipped as described in scripts/build_announced.py", "register": "Land Department project register extract 15 Jun 2026 + delta 1 Sep 2026 + sales/building-register-only projects (3,915 rows)",
            "candidates": len(cands), "buckets": dict(sorted(collections.Counter(c["bucket"] for c in cands).items())), "matched": len(matched), "shown": total, "with_profile": with_profile, "without_profile": total - with_profile,
            "in_a_district": n_dist, "area_text_only": total - n_dist, "units_dropped_page_level_figure": dropped_units, "label_listed": "Listed by the developer, no register entry found", "listed_wording": sum(1 for ds in out.values() for l in ds.values() for e in l if e.get("lw")), "index_generated": IX.get("generated"), "index_as_of": IX.get("as_of"),
            "no_profile": sorted(dev[1:] for dev in out if dev.startswith("~"))}
    res = {"meta": meta, "d": out}
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(res, fh, ensure_ascii=False, separators=(",", ":"), sort_keys=False)

    def wcsv(name, head, rows):
        with open(os.path.join(os.path.dirname(a.out), name), "w", encoding="utf-8-sig", newline="") as fh:
            w = csv.writer(fh, lineterminator="\n")
            w.writerow(head)
            w.writerows(sorted(rows, key=lambda r: [str(x).lower() for x in r]))
    wcsv("announced_matched.csv", ["project", "developer", "rule", "register_key", "register_name", "source"], matched)
    wcsv("announced_held.csv", ["project", "developer", "register_key_possible", "register_name_possible", "source"], held)
    wcsv("announced_skipped.csv", ["project", "developer", "reason", "source"], skipped)
    wcsv("announced_name_collisions.csv", ["project", "developer", "register_key_same_name", "register_name", "register_developer"], collide)
    assert all(c["bucket"] for c in cands), "a candidate has no bucket"
    # the accounting: every candidate in exactly one bucket (matched / shown / shown-outside-Dubai / shown-possible-match / skipped-duplicate / skipped-malformed)
    with open(os.path.join(os.path.dirname(a.out), "announced_accounting.csv"), "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(["candidate", "source", "developer", "project", "bucket", "detail"])
        for c in cands:
            w.writerow([c["cid"], "availability sheet" if c["t"] == "s" else "developer web page", c["dn"], c["name"], c["bucket"], c["detail"]])

    # ---------------------------------------------------------------- search entries (the Find page; no position is ever invented, so no plot feature)
    items = []
    for dev in sorted(out):
        for dist in sorted(out[dev]):
            for e in out[dev][dist]:
                it = {"n": e["n"], "t": "development", "ann": 1}
                for fl in ("lw", "od", "pm"):
                    if e.get(fl):
                        it[fl] = 1
                if not dev.startswith("~"):
                    it["dev"] = dev
                if e.get("a"):
                    it["a"] = e["a"]
                if e.get("u"):
                    it["units"] = e["u"]
                items.append(it)
    sres = {"meta": {"built": a.built, "count": len(items), "rule": "additive: merged into /img/search_index by the worker; a development of the same name and developer already in the list is skipped. Announced, not registered: no position, so no plot feature."},
            "features": [], "items": items}
    os.makedirs(os.path.dirname(a.search_out), exist_ok=True)
    with open(a.search_out, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(sres, fh, ensure_ascii=False, separators=(",", ":"))

    print(json.dumps({"candidates": len(cands), "from_dna_portfolios": dna_total, "portfolio_files_only": file_only, "sheets": len(sheets), "buckets": meta["buckets"], "matched": len(matched), "skipped": len(skipped),
                      "skipped_by_reason": collections.Counter(s[2].split(" (")[0] for s in skipped), "name_collisions": len(collide), "shown": total, "with_profile": with_profile, "in_a_district": n_dist,
                      "top15": by_dev.most_common(15), "no_profile": meta["no_profile"], "bytes": os.path.getsize(a.out), "search_bytes": os.path.getsize(a.search_out)}, indent=1, default=str))


if __name__ == "__main__":
    main()
