"""v325 - the register's developer of every DLD project, as a canonical developer id. ONE helper, used by the evidence builder (build_area_evidence.py),
the attribution audit (audit_devmap_attribution.py) and the monthly guard (guard_devmap_attribution.ps1).

  project_number -> {canon, name_en, developer_id, land_owner}
  canon  = the crosswalk's canonical id (same rules as src/devcross.js: build_developer_crosswalk.canonical_of) of the register developer's English legal name
           (g_dld__projects.developer_id -> data/registers/developers/developers_*.csv), else of the Arabic name on the project row.
  land_owner = True when the register names a Nakheel entity: on Palm Deira / Dubai Islands Nakheel is the LAND OWNER of record and the delivery partner is somebody else
           (same rule as build_coverage_cards.py). A land_owner row is never used to OVERRIDE a name-based developer and never counted as a contradiction.
Read-only on the lake and on the register CSV. Needs C:\\Dev\\naj-market-pulse\\scripts on sys.path (lake.py, build_developer_crosswalk.py).
"""
import csv, glob, os, sys

NMP = r"C:\Dev\naj-market-pulse"
if os.path.join(NMP, "scripts") not in sys.path: sys.path.insert(0, os.path.join(NMP, "scripts"))
import build_developer_crosswalk as X          # canonical_of / norm: parity-tested against src/devcross.js

NAKHEEL_AR = ("\u0646\u062e\u064a\u0644", "\u0627\u0644\u0646\u062e\u0644\u0629")


SPV_STOP = {"dubai", "abu", "dhabi", "group", "real", "estate", "properties", "property", "development", "developments", "developer", "developers", "holding", "holdings",
            "global", "international", "investment", "investments", "emirates", "company", "uae"}


def _brand_tokens(display):
    """the words of a curated brand's display name that can stand for its web site (no place or business words)"""
    import re as _re
    return [t for t in _re.sub(r"[^a-z0-9]+", " ", str(display or "").lower()).split() if len(t) >= 4 and t not in SPV_STOP]


def spv_brand_map(reg, dna_path=None):
    """v373 - SPV-to-brand rule from the 7 Oct 2026 audit (docs/ATTRIBUTION_AUDIT_07OCT2026/fix_spv.py): a register company is a project company (SPV) of a curated brand when
      1. its register `webpage` host names the brand (anaxdevelopments.com names no brand; www.omniyat.com names Omniyat), or
      2. data/dev_meta/developer_dna.json lists the company under that brand's dld_entities.
    returns {developer_id: set(brand ids)}. The company's own web page is a CLAIM by the company: the link is stored as evidence about the company, never as proof about a project."""
    import re as _re, json as _json
    brands = {bid: _brand_tokens(b.get("display")) for bid, b in X.BY_ID.items()}
    dna_path = dna_path or os.path.join(NMP, "data", "dev_meta", "developer_dna.json")
    ent = {}
    try:
        for k, v in _json.load(open(dna_path, encoding="utf-8"))["developers"].items():
            bid = X.canonical_of(k)[0]
            if bid in X.BY_ID:
                for e in v.get("dld_entities", []): ent.setdefault(e.strip().upper(), set()).add(bid)
    except Exception:
        pass
    out = {}
    for did, r in reg.items():
        host = _re.sub(r"^(https?://)?(www\.)?", "", (r.get("webpage") or "").strip().lower()).split("/")[0]
        core = host.split(".")[0] if host else ""
        s = {bid for bid, toks in brands.items() if core and any(t in core for t in toks)}
        s |= ent.get((r.get("developer_name_en") or "").strip().upper(), set())
        if s: out[did] = s
    return out


def register_devs(con):
    regfile = sorted(glob.glob(os.path.join(NMP, "data", "registers", "developers", "developers_*.csv")))[-1]
    reg = {}
    for r in csv.DictReader(open(regfile, encoding="utf-8")):
        try: reg[int(float(r["developer_id"]))] = r
        except Exception: pass
    regcanon, ar2en = {}, {}
    spv = spv_brand_map(reg)
    for did, r in reg.items():
        c = X.canonical_of(r["developer_name_en"])[0]
        regcanon[did] = c
        ar2en[X.norm(r["developer_name_ar"])] = c
    out = {}
    for pn, pname, did, dname in con.execute("select project_number, project_name, developer_id, developer_name from g_dld__projects where project_number is not null").fetchall():
        did = int(did) if did is not None else None
        c = regcanon.get(did) if did in reg else None
        if c is None: c = ar2en.get(X.norm(dname)) or X.canonical_of(dname)[0]
        nm = reg[did]["developer_name_en"] if did in reg else (dname or "")
        out[int(pn)] = {"canon": c, "name_en": nm, "developer_id": did, "land_owner": bool(dname and any(a in dname for a in NAKHEEL_AR)), "project": pname,
                        "webpage": (reg[did].get("webpage") or "").strip().lower() if did in reg else "", "spv_of": sorted(spv.get(did, ()))}   # v373: the company's web page and the brands it is an SPV of
    return out


def _common_words():
    """the SAME word list as src/devattr.js COMMON_WORDS (read from the file, so the two cannot drift)"""
    import re as _re
    src = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "devattr.js"), encoding="utf-8").read()
    m = _re.search(r"COMMON_WORDS = new Set\(\((.*?)\)\.split", src, _re.S)
    return set("".join(_re.findall(r'"([^"]*)"', m.group(1))).split()) if m else set()
COMMON_WORDS = _common_words()


def is_generic_name(s):
    """a name made only of common words, numbers or single letters (src/devattr.js isGenericName)"""
    import re as _re
    t = [w for w in _re.sub(r"[^a-z0-9]+", " ", str(s or "").lower()).strip().split(" ") if w]
    return (not t) or all(w in COMMON_WORDS or w.isdigit() or len(w) <= 1 for w in t)


MASTER_LIKE = {"nakheel", "meydan", "dubai-properties", "dubai-hills-estate"}      # mirrors src/devattr.js
CUR = set(X.BY_ID)                                                                    # curated brands (src/devcross.js ids)


def pick(RD, PD, slug, pname, pnum, nk_=None, legacy=False):
    """the developer of one SALE and how sure we are. q 'v' verified by the register (project_number -> developer_id), 'i' inferred from a project name, '' none.
    PD = the index builder own name map {slugs: {slug: {nameKey: canonical}}, global: {nameKey: canonical}}.
    New logic mirrors src/devattr.js decide(): a register brand wins over a name; a land owner or master-plan company never replaces a name; a register project company (SPV)
    gives way to a curated brand the name map already holds. legacy=True reproduces the v322 behaviour (the name map only) for the before/after audit."""
    nk_ = nk_ or nk
    nm = PD["slugs"].get(slug, {}).get(nk_(pname)) or PD["global"].get(nk_(pname)) or None
    if legacy: return (nm, "i") if nm else ("_", "")
    rd = RD.get(int(pnum)) if pnum is not None else None
    if rd:
        c = rd["canon"]
        if nm and c == nm: return nm, "v"
        if rd["land_owner"] or c in MASTER_LIKE: return (nm, "i") if nm else ("_", "")
        if c in CUR: return c, "v"
        if nm and nm in CUR: return (nm, "v") if nm in (rd.get("spv_of") or ()) else (nm, "i")    # v373: the register company is an SPV of that brand: verified
        return c, "v"
    return (nm, "i") if nm else ("_", "")


LABEL_CODE = {"REGISTER_VERIFIED": "V", "NAME_ONLY": "N", "DEVELOPER_CLAIMED": "D", "UNVERIFIED": "U"}      # mirrors src/devattr.js LABEL_CODE
LABEL_RANK = {"REGISTER_VERIFIED": 0, "DEVELOPER_CLAIMED": 1, "NAME_ONLY": 2, "UNVERIFIED": 3}


def sale_label(RD, pnum, dev, q):
    """v373 - the evidence label of ONE sale's developer (mirror of src/devattr.js evidenceOf for a sale that carries its own project_number, so the basis is "project_id"
    when the register has the row). q is what pick() answered: "v" = the register's developer of that project_number is the one shown (or an SPV of that brand).
    returns (label, basis)."""
    if dev == "_": return "UNVERIFIED", "none"
    has = pnum is not None and int(pnum) in RD
    if has: return ("REGISTER_VERIFIED" if q == "v" else "NAME_ONLY"), ("project_id" if q == "v" else "exact_name")
    return "NAME_ONLY", "exact_name"


def worst(labels):
    """the weakest label of several sales: a cell or a project is verified only when every sale in it is"""
    return max(labels, key=lambda l: LABEL_RANK.get(l, 3)) if labels else "UNVERIFIED"


def judge(att, reg):
    """status of one attribution against the register developer of its project_number.
    CONTRADICTS = the register developer is a CURATED BRAND (reviewed crosswalk id) and is not the attributed one.
    project company = the register names a company the crosswalk does not know as a brand (an SPV such as THE LAGOONS PHASE ONE L.L.C): its relation to the
    attributed brand is not established either way, so it is reported separately and is NOT counted as an error."""
    if att == "_": return "not recorded"
    if reg is None: return "register silent"
    if reg["canon"] == att: return "register confirms"
    if reg["land_owner"] or reg["canon"] in MASTER_LIKE: return "land owner ambiguous"
    if reg["canon"] in CUR: return "register CONTRADICTS"
    return "project company (not a brand)"


import re, collections
STEM = re.compile(r"\b(by|the|tower|towers|residences?|residence|building|bldg|apartments?)\b")
nk = lambda s: re.sub(r"[^a-z0-9]+", " ", str(s or "").lower()).strip()          # the index builder nameKey (spaces kept)
nkey = lambda s: re.sub(r"\s+", "", STEM.sub("", nk(s)))                          # the app's looser name key, used only to find the project_number
HOME = ("trans_group_en='Sales' and property_usage_en='Residential' and property_type_en in ('Unit','Villa') "
        "and coalesce(property_sub_type_en,'Flat') in ('Flat','Villa','Hotel Apartment','Stacked Townhouses')")


class NameIndex:
    """(DLD area, name key) -> Counter(project_number) from the register own sales rows, so a card or a project name can be tied to a project_number."""
    def __init__(self, con, areas):
        self.idx = collections.defaultdict(collections.Counter)
        rows = con.execute("select area_name_en, project_number, coalesce(building_name_en,''), coalesce(project_name_en,''), count(*), coalesce(master_project_en,'') from g_dld__transactions where %s and area_name_en in (%s) group by all" % (HOME, ",".join("?" * len(areas))), list(areas)).fetchall()
        self.master = collections.defaultdict(collections.Counter)      # v373: (DLD area, name key) -> register master community of the project's own sales rows
        for an, pn, bn, pjn, n, ms in rows:
            for nm in (bn, pjn):
                k = nkey(nm)
                if k:
                    self.idx[(an, k)][None if pn is None else int(pn)] += n
                    if ms: self.master[(an, k)][ms] += n
        rows = [r[:5] for r in rows]
        self.names = collections.defaultdict(set)          # DLD area -> raw names seen
        for an, pn, bn, pjn, n in rows:
            for nm in (bn, pjn):
                if nm: self.names[an].add(nm)

    def match(self, dld_areas, names):
        c = collections.Counter()
        for an in dld_areas:
            for nm in names:
                k = nkey(nm)
                if k and (an, k) in self.idx: c.update(self.idx[(an, k)])
        c.pop(None, None)
        if not c: return None, 0.0
        pn, top = c.most_common(1)[0]
        return pn, top / sum(c.values())


def sales_area_index(data_dir=None, pattern="transactions-2026-*.csv"):
    """v373 - the community each project's sales are registered in. The lake keeps only the DLD land area (Bukadra, Jabal Ali First); the open sales extracts in
    naj-market-pulse/data carry AREA_EN as the market names it (HORIZON, AL FURJAN, DUBAI LAND RESIDENCE COMPLEX) and MASTER_PROJECT_EN.
    returns {nk(project name): (modal AREA_EN, modal MASTER_PROJECT_EN)} and the same under the loose key ("~" + nkey)."""
    import csv as _csv, glob as _glob
    data_dir = data_dir or os.path.join(NMP, "data")
    ar = collections.defaultdict(collections.Counter); ms = collections.defaultdict(collections.Counter)
    for f in sorted(_glob.glob(os.path.join(data_dir, pattern))):
        for r in _csv.DictReader(open(f, encoding="utf-8-sig", newline="")):
            if r.get("GROUP_EN") != "Sales" or not r.get("PROJECT_EN") or not r.get("AREA_EN"): continue
            for k in (nk(r["PROJECT_EN"]), "~" + nkey(r["PROJECT_EN"])):
                ar[k][r["AREA_EN"].strip()] += 1
                if r.get("MASTER_PROJECT_EN"): ms[k][r["MASTER_PROJECT_EN"].strip()] += 1
    return {k: (c.most_common(1)[0][0], (ms[k].most_common(1)[0][0] if ms.get(k) else "")) for k, c in ar.items()}


def regdev_map(con, areas_of, RD=None, ni=None, sales_areas=None):
    """{slug: {nameKey: {c, d, p, s, lo}}}: for every name the register uses in that app district (building or project name), the register developer of the matched
    project_number. The index builder looks a card up by its names; a name that matches several project numbers keeps the biggest and its share."""
    RD = RD or register_devs(con)
    ni = ni or NameIndex(con, sorted({a for v in areas_of.values() for a in v}))
    out = {}
    for slug, dl in areas_of.items():
        m = {}
        for an in dl:
            for nm in ni.names.get(an, ()):
                key = nk(nm)
                if not key or key in m: continue
                pn, share = ni.match(dl, [nm])      # (the loose key may pool two project numbers; the share then drops below 0.6 and the register stays silent)
                rd = RD.get(pn) if pn is not None else None
                if rd:
                    m[key] = {"c": rd["canon"], "d": rd["name_en"], "p": pn, "s": round(share, 2), "lo": rd["land_owner"],
                              "di": rd["developer_id"], "sp": rd.get("spv_of") or []}      # v373: the register developer_id, and the brands this company is an SPV of
                    m.setdefault("~" + nkey(nm), m[key])        # the looser key (Park Ridge Tower C finds PARK RIDGE)
                # v373 - the project's OWN area: the sales rows' area (AREA_EN) and the register master community, for every name, with or without a register developer row
                ak = "@" + key
                if ak not in m:
                    k2 = nkey(nm); ac = collections.Counter(); mc = collections.Counter()
                    for an2 in dl:
                        n2 = sum(ni.idx.get((an2, k2), {}).values())
                        if n2: ac[an2] += n2
                        mc.update(ni.master.get((an2, k2), {}))
                    sa = (sales_areas or {}).get(key) or (sales_areas or {}).get("~" + nkey(nm))      # the open sales extracts: the community AREA_EN, which beats the land area
                    if sa or ac:
                        m[ak] = {"ar": sa[0] if sa else ac.most_common(1)[0][0]}
                        ms_ = (sa[1] if sa and sa[1] else "") or (mc.most_common(1)[0][0] if mc else "")
                        if ms_: m[ak]["ms"] = ms_
                        m.setdefault("@~" + nkey(nm), m[ak])
        out[slug] = m
    return out
