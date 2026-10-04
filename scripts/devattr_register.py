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


def register_devs(con):
    regfile = sorted(glob.glob(os.path.join(NMP, "data", "registers", "developers", "developers_*.csv")))[-1]
    reg = {}
    for r in csv.DictReader(open(regfile, encoding="utf-8")):
        try: reg[int(float(r["developer_id"]))] = r
        except Exception: pass
    regcanon, ar2en = {}, {}
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
        out[int(pn)] = {"canon": c, "name_en": nm, "developer_id": did, "land_owner": bool(dname and any(a in dname for a in NAKHEEL_AR)), "project": pname}
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
        if nm and nm in CUR: return nm, "i"
        return c, "v"
    return (nm, "i") if nm else ("_", "")


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
        rows = con.execute("select area_name_en, project_number, coalesce(building_name_en,''), coalesce(project_name_en,''), count(*) from g_dld__transactions where %s and area_name_en in (%s) group by all" % (HOME, ",".join("?" * len(areas))), list(areas)).fetchall()
        for an, pn, bn, pjn, n in rows:
            for nm in (bn, pjn):
                k = nkey(nm)
                if k: self.idx[(an, k)][None if pn is None else int(pn)] += n
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


def regdev_map(con, areas_of, RD=None, ni=None):
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
                    m[key] = {"c": rd["canon"], "d": rd["name_en"], "p": pn, "s": round(share, 2), "lo": rd["land_owner"]}
                    m.setdefault("~" + nkey(nm), m[key])        # the looser key (Park Ridge Tower C finds PARK RIDGE)
        out[slug] = m
    return out
