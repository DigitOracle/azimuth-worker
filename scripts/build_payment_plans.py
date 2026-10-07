"""PAYMENT PLANS, per project, from what a developer says in writing (v375, Gap 2 of the off-plan buying journey, 7 Oct 2026).

READ-ONLY on the shared data folder; writes two NEW files (default: this repo's data/payment_plans/):
  payment_plans.json   per project: the plan options with their structure, each with its source and a confidence flag
  payment_plans_audit.csv   one row per candidate plan text: INCLUDED / LABEL_ONLY / EXCLUDED with the reason
Nothing is published, no KV is written. Offline: it reads files under --data-root (default C:\\Dev\\naj-market-pulse\\data).

WHAT IS COUNTED AS A PLAN (the rule, Kendall 7 Oct 2026: "offer an answer only if backed ... or the developer's own sheet clearly
labelled 'developer says'; if unknowable, do not offer it"):
  structured plan  a developer sentence (their site FAQ, their brochure page) that says in words what is paid when:
                   "20% on booking, 40% during construction, 40% on handover". Parsed only where every part is explicit.
                   Gaps are filled by arithmetic ONLY when the text names exactly one unquantified construction block and the
                   completion payment is stated (flag derived_remainder = true, confidence "medium").
  printed label    a code printed on a developer sheet ("5/5/5/5/5/5/70", "60/40"). It is a fact that the sheet prints it; what each
                   figure means (before or after handover) is NOT stated, and "60/40" means different things in different
                   plans. So a label is kept in "labels" and never turned into a before-handover amount.
  left out         a range ("40-50% during construction"), a remainder that hides two payments, a total that is not 100, a label
                   with no breakdown, a rate with no count. Said nowhere, listed only in the audit CSV.
Every plan is DEVELOPER_CLAIMED: it is the developer's word, not a register fact.

  python scripts/build_payment_plans.py [--data-root DIR] [--out-dir DIR] [--selftest FIXTURES.json]
"""
import argparse, collections, csv, datetime as dt, glob, json, os, re, statistics, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
DEFAULT_DATA = r"C:\Dev\naj-market-pulse\data"
DEV_FILES = {"imtiaz": "imtiaz", "prestigeone": "prestigeone", "arada": "arada", "select": "select", "emaar": "emaar", "sobha": "sobha",
             "fakhruddin": "fakhruddin", "beyond": "beyond", "palma": "palma", "omniyat": "omniyat", "ellington": "ellington", "iman": "iman",
             "meraas": "meraas", "hh": "hh"}
ROMAN = {"ii": "2", "iii": "3", "iv": "4", "v": "5", "vi": "6", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "i": "1"}
SHEET_DEV = {"Arada": "arada", "Imtiaz": "imtiaz", "Beyond": "beyond", "Binghatti": "binghatti", "Select": "select", "Fakhruddin": "fakhruddin",
             "Prestige One": "prestigeone", "Palma": "palma"}

# ------------------------------------------------------------------------------------------------ the text parser
NUM = r"(\d+(?:\.\d+)?)"
PCT = re.compile(NUM + r"\s*%")
RANGE = re.compile(NUM + r"\s*(?:-|\u2013|\u2014|\ufffd|to)\s*" + NUM + r"\s*%")
FEE_PAREN = re.compile(r"\(\s*\+?\s*" + NUM + r"\s*%[^)]*\)")        # "(+4% DLD)": a fee, not a plan step
DATE_PAREN = re.compile(r"\(\s*((?:Q[1-4]|[A-Z][a-z]{2,8})\.?\s*\d{4})\s*\)")
INSTAL_LIST = re.compile(r"(?:(?:six|five|four|three|seven|eight|\d+)\s+)?instal+ments?\s+of\s+((?:" + NUM + r"\s*%\s*,?\s*(?:and\s+)?)+)(?:\s*between\s+([A-Za-z]+\s+\d{4})\s+and\s+([A-Za-z]+\s+\d{4}))?", re.I)
CATS = [  # (category, regex); the EARLIEST match after the figure decides, ties go to the earlier row
    ("post", re.compile(r"post[- ]?handover|after (?:the )?handover|after completion|post[- ]?completion", re.I)),
    ("pretotal", re.compile(r"before (?:the )?(?:handover|completion)|up to (?:the )?(?:completion|handover)|prior to (?:handover|completion)", re.I)),
    ("handover", re.compile(r"(?:on|upon|at)\s+(?:the\s+)?(?:handover|completion)|handed over|payable on handover", re.I)),
    ("booking", re.compile(r"booking|down[- ]?payment|\bdown\b|reservation|on signing|at signing", re.I)),
    ("construction", re.compile(r"construction|instal+ments?|milestones?|quarterly|monthly|staged|during build", re.I)),
]
RATE = re.compile(r"^\s*(?:payable\s+)?(?:quarterly|monthly|per quarter|a quarter|each quarter|per month|every)", re.I)
UNATTACHED_CONSTRUCTION = re.compile(r"construction[- ]linked|staged construction|instal+ments? during construction|payments? during construction|during construction|construction milestones|construction payments|followed by instal+ments", re.I)
NOT_A_PLAN = re.compile(r"revenue share|discount|returns? up to|\byield\b|\broi\b|rent(al)? ", re.I)
HANDOVER_TEXT = re.compile(r"(?:on|upon|at)\s+(?:completion|handover)[^.,;|]*?\bin\s+((?:Q[1-4]|[A-Z][a-z]{2,8})\.?\s*\d{4})|(?:handed over|completion)\s+in\s+((?:Q[1-4]|[A-Z][a-z]{2,8})\.?\s*\d{4})", re.I)


def _cat_of(tail):
    best = None
    for rank, (c, rx) in enumerate(CATS):
        m = rx.search(tail)
        if m and (best is None or (m.start(), rank) < best[0]):
            best = ((m.start(), rank), c)
    return best[1] if best else None


def split_options(text):
    t = re.sub(r"[\u2022\u25cf\u25aa\ufffd]", "|", text.replace("\r", " ").replace("\n", " "))
    if "|" not in t and not re.search(r"\bOption\s*\d", t, re.I):
        return [t]
    chunks = re.split(r"\|\s*|\bOption\s*\d+\s*[:\-]\s*", t, flags=re.I)
    chunks = [c.strip() for c in chunks if c and c.strip()]
    labelled = [c for c in chunks if re.match(r"^\s*(?:\d{2}/\d{2}\b|[\w\- ]{0,30}?plan\s*[:\-–])", c, re.I)]
    if len(labelled) >= 2 or len(re.findall(r"\bOption\s*\d", t, re.I)) >= 2:
        return [c for c in chunks if PCT.search(c) or re.search(r"\d+/\d+", c)]
    return [" ".join(chunks)]


def parse_option(chunk):
    """-> (option dict or None, reason). option = {label, booking_pct, instalments_pct, pre_handover_pct, on_handover_pct, post_handover_pct, steps, ...}"""
    raw = chunk.strip()
    label = None
    m = re.match(r"^\s*(\d{2}/\d{2})\s+(?:post[- ]?handover\s+)?(?:payment\s+)?plan\b[\s:\-\u2013]*", raw, re.I) or re.match(r"^\s*([\w\- ]{0,30}?plan)\s*[:\-\u2013]\s*", raw, re.I)
    if m:
        label = m.group(1).strip()
    if RANGE.search(raw):
        return None, "range: a range of percentages, not one figure"
    s = FEE_PAREN.sub(" ", raw)
    when_booking = None
    mdp = re.search(r"booking\s*\(\s*((?:Q[1-4]|[A-Z][a-z]{2,8})\.?\s*\d{4})\s*\)", s)
    if mdp:
        when_booking = mdp.group(1)
    s = DATE_PAREN.sub(" ", s)
    indicative = bool(re.search(r"\btypical(?:ly)?\b|\bindicative\b|\bmay be available\b", s, re.I))
    items = []                        # (category, pct or None, rate?)
    il = INSTAL_LIST.search(s)
    ilist = None
    if il:
        ilist = [float(x) for x in PCT.findall(il.group(1))]
        s = s[:il.start()] + " INSTALLIST " + s[il.end():]
    pos = [(m.start(), m.end(), float(m.group(1))) for m in PCT.finditer(s)]
    marks = [(m.start(), m.end(), None) for m in re.finditer(r"INSTALLIST", s)]
    allm = sorted([(a, b, v, False) for a, b, v in pos] + [(a, b, v, True) for a, b, v in marks])
    if not [x for x in allm if not x[3]] and not ilist:
        return None, "no percentage in the text"
    for i, (a, b, v, is_list) in enumerate(allm):
        nxt = allm[i + 1][0] if i + 1 < len(allm) else len(s)
        tail = s[b:nxt]
        tail = re.split(r"[.;](?:\s|$)", tail)[0]
        head = s[max(0, a - 40):a]
        if NOT_A_PLAN.search(tail[:60]) and not _cat_of(tail[:60]):
            return None, "not a payment step"
        if is_list:
            items.append(("construction", sum(ilist), False)); continue
        if RATE.match(tail):
            items.append(("rate", v, True)); continue
        cat = _cat_of(tail)
        if cat is None:
            return None, "a percentage with no stated moment (" + str(v) + "%)"
        items.append((cat, v, False))
    sums = collections.Counter()
    rate_seen = False
    for c, v, rate in items:
        if rate:
            rate_seen = True
            continue
        sums[c] += v
    booking, cons, hand, post, pre_total = sums["booking"], sums["construction"], sums["handover"], sums["post"], sums["pretotal"]
    derived = False
    if pre_total:
        if booking + cons > pre_total + 0.01:
            return None, "parts exceed the stated total before handover"
        if abs(pre_total + hand + post - 100) > 0.01:
            return None, "total is not 100 (" + str(round(pre_total + hand + post, 2)) + ")"
        pre = pre_total
        if booking:
            cons_total = pre - booking          # the stated total before handover, less the stated booking: the instalments in between
            derived = cons <= 0.01 and cons_total > 0.01
        else:
            cons_total = cons                   # no booking figure and no breakdown: only the total before handover is known
    else:
        stated = booking + cons + hand + post
        gap = round(100 - stated, 4)
        if abs(gap) <= 0.01:
            pre = booking + cons
            cons_total = cons
        elif gap > 0.01:
            unatt = bool(UNATTACHED_CONSTRUCTION.search(re.sub(r"\d+(?:\.\d+)?\s*%[^,;]*", " ", s)) ) or rate_seen
            if not unatt:
                return None, "a remainder of " + str(gap) + "% with no stated moment"
            if post <= 0 and CATS[0][1].search(s):
                return None, "a post-handover payment is mentioned but not quantified"
            if hand <= 0 and not (post > 0 and cons > 0):
                return None, "the completion payment is not stated, so the remainder could hide two payments"
            cons_total = cons + gap
            pre = booking + cons_total
            derived = True
        else:
            return None, "total is over 100 (" + str(round(stated, 2)) + ")"
    if pre + hand + post < 99.99 or pre + hand + post > 100.01:
        return None, "total is not 100"
    steps = []
    if booking:
        steps.append({"kind": "booking", "pct": booking, **({"when": when_booking} if when_booking else {})})
    if cons_total:
        steps.append({"kind": "instalments_before_handover", "pct": round(cons_total, 4), **({"derived_remainder": True} if derived else {}),
                      **({"list": ilist} if ilist else {})})
    if hand:
        steps.append({"kind": "on_handover", "pct": hand})
    if post:
        steps.append({"kind": "after_handover", "pct": post})
    if pre_total and not booking and not cons_total:
        steps.insert(0, {"kind": "before_handover_total", "pct": pre_total})
    opt = {"label": label, "indicative": indicative, "on_booking_pct": booking or None, "instalments_pct": round(cons_total, 4) if cons_total else None,
           "before_handover_pct": round(pre, 4), "on_handover_pct": hand or 0, "after_handover_pct": post or 0, "total_pct": 100, "steps": steps,
           "derived_remainder": derived, "confidence": "medium" if (derived or indicative) else "high"}
    return opt, "ok"


def parse_plan_text(text):
    """-> {'options': [opt...], 'excluded': [(reason, snippet)...], 'handover_text': str|None}"""
    out = {"options": [], "excluded": [], "handover_text": None}
    if not text or not PCT.search(text) or not re.search(r"payment|instal+ment", text, re.I):
        return out
    mh = HANDOVER_TEXT.search(text)
    if mh:
        out["handover_text"] = (mh.group(1) or mh.group(2) or "").strip() or None
    for ch in split_options(text):
        if not PCT.search(ch):
            if re.search(r"\d+/\d+", ch):
                out["excluded"].append(("a label with no breakdown", ch.strip()[:140]))
            continue
        opt, why = parse_option(ch)
        if opt:
            out["options"].append(opt)
        else:
            out["excluded"].append((why, ch.strip()[:200]))
    return out


# ------------------------------------------------------------------------------------------------ labels
LABEL = re.compile(r"^\s*(\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)+)\s*(?:\((.*)\))?\s*$")


def parse_label(txt):
    """'5/5/5/5/5/5/70' -> [5,...,70] when it sums to 100; 'x (70/30 available)' -> both."""
    out = []
    for part in re.findall(r"\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)+", str(txt or "")):
        nums = [float(x) for x in part.split("/")]
        if abs(sum(nums) - 100) <= 0.01:
            out.append({"text": part, "figures": nums})
    return out


# ------------------------------------------------------------------------------------------------ names and keys
# Two names of the same project that no alias list joins, decided by a person (7 Oct 2026): Arada's sheet calls it "Inaura Hotels & Residences"
# (master Downtown Dubai), Arada's web page "Inaura Downtown". Add a pair only when the same project is certain.
CURATED_JOIN = {("arada", "inaura hotels"): "arada|inauradowntown"}
def load_json(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


class Namer:
    def __init__(self, data_root, pf):
        seg = load_json(os.path.join(data_root, "dev_meta", "developer_segments.json"))
        self.aliases = {}
        for n, al in seg["aliases"].items():
            self.aliases[n] = al
        self.key_dev = {"OMNIYAT": "omniyat", "H&H": "hh", "Meraas": "meraas", "Select Group": "select", "Ellington": "ellington", "Arada": "arada", "ZAYA": "zaya",
                        "Palma": "palma", "Fakhruddin": "fakhruddin", "BEYOND": "beyond", "Imtiaz": "imtiaz", "Iman": "iman", "Prestige One": "prestigeone", "Emaar": "emaar", "Sobha": "sobha"}
        self.dev_alias = {self.key_dev[n]: al for n, al in self.aliases.items() if n in self.key_dev}
        self.dev_alias.setdefault("binghatti", ["binghatti"])
        self.by = {}
        for k, v in pf.items():
            for nm in set(list(v.get("aliases") or []) + [v["name"]]):
                self.by.setdefault((v["dev"], self.norm(nm, v["dev"])), k)
        self.pf = pf

    def norm(self, n, dev):
        t = (n or "").lower()
        for a in self.dev_alias.get(dev, [dev]):
            t = re.sub(r"\bby\s+" + re.escape(a) + r"\b", " ", t)
            t = re.sub(r"\b" + re.escape(a) + r"\b", " ", t)
        t = re.sub(r"\b(residences?|residency|tower|the|apartments?|dubai|building)\b", " ", t)
        t = re.sub(r"[^a-z0-9 ]", " ", t)
        t = " ".join(ROMAN.get(w, w) for w in t.split())
        return t.strip()

    def key(self, dev, name):
        nn = self.norm(name, dev)
        if not nn:
            return None, False
        k = self.by.get((dev, nn)) or CURATED_JOIN.get((dev, nn))
        if k:
            return k, k in self.pf
        return dev + "|" + nn.replace(" ", ""), False


# ------------------------------------------------------------------------------------------------ sources
def sheet_files(data_root):
    out = []
    for f in sorted(glob.glob(os.path.join(data_root, "avail", "*_20*.json"))):
        if os.path.basename(f).startswith("_") or f.endswith("_auto.json"):
            continue
        try:
            d = load_json(f)
        except Exception:
            continue
        if isinstance(d, dict) and isinstance(d.get("projects"), list):
            out.append((f, d))
    return out


def build(data_root, out_dir, kore_path=None):
    pf = load_json(os.path.join(data_root, "board", "projfacts.json"))["projects"]
    nm = Namer(data_root, pf)
    audit = []
    recs = {}

    def rec(dev, key, in_pf, project, developer):
        r = recs.get(key)
        if not r:
            pfr = pf.get(key) or {}
            r = recs[key] = {"developer": pfr.get("developer") or developer, "dev": dev, "project": pfr.get("name") or project, "in_projfacts": in_pf,
                             "aliases": sorted(set(list(pfr.get("aliases") or []) + [project])), "handover_text": None, "plans": [], "labels": [], "prices": None, "confidence": None}
        return r

    # 1. developer web sites: the FAQ answer and the page description, in the developer's own words
    for dev in sorted(set(DEV_FILES.values())):
        p = os.path.join(data_root, "dev_meta", dev + "_portfolio.json")
        if not os.path.exists(p):
            continue
        d = load_json(p)
        props = d.get("properties")
        props = list(props.values()) if isinstance(props, dict) else (props or [])
        rel = os.path.relpath(p, os.path.dirname(data_root)).replace("\\", "/")
        for pr in props:
            name = pr.get("name") or pr.get("title")
            if not name:
                continue
            cands = []
            for i, fq in enumerate(pr.get("faq") or []):
                if re.search(r"payment", str(fq.get("q", "")), re.I):
                    cands.append(("faq[%d].a" % i, str(fq.get("a", ""))))
            if pr.get("description"):
                cands.append(("description", str(pr["description"])))
            facts = pr.get("facts") or {}
            for j, lab in enumerate(facts.get("payment_plans") or []):
                for lb in parse_label(lab):
                    k, inpf = nm.key(dev, name)
                    if not k:
                        continue
                    r = rec(dev, k, inpf, name, d.get("developer") or dev)
                    r["labels"].append({"text": lb["text"], "figures": lb["figures"], "source": {"kind": "developer site", "file": rel, "ref": name + " / facts.payment_plans[%d]" % j, "url": pr.get("url"), "fetched": d.get("fetched")}})
                    audit.append([k, name, "developer site label", rel, name + " facts.payment_plans[%d]" % j, lb["text"], "LABEL_ONLY", "printed code; the meaning of each figure is not stated", ""])
            for ref, text in cands:
                res = parse_plan_text(text)
                k, inpf = nm.key(dev, name)
                if not k:
                    continue
                for opt in res["options"]:
                    r = rec(dev, k, inpf, name, d.get("developer") or dev)
                    opt["source"] = {"kind": "developer site", "file": rel, "ref": name + " / " + ref, "url": pr.get("url"), "fetched": d.get("fetched"), "text": text[:600]}
                    r["plans"].append(opt)
                    if res["handover_text"] and not r["handover_text"]:
                        r["handover_text"] = res["handover_text"]
                    audit.append([k, name, "developer site text", rel, name + " " + ref, text[:220].replace("\n", " "), "INCLUDED", "ok" + (" (derived remainder)" if opt["derived_remainder"] else "") + (" (indicative)" if opt["indicative"] else ""), opt["confidence"]])
                for why, snip in res["excluded"]:
                    audit.append([k, name, "developer site text", rel, name + " " + ref, snip.replace("\n", " "), "EXCLUDED", why, ""])

    # 2. developer sheets: the latest sheet per project; the printed label, the developer's own list prices
    sheets = sheet_files(data_root)
    latest = {}
    for f, d in sheets:
        dev = SHEET_DEV.get(d.get("developer") or "")
        if not dev and "imtiaz" in os.path.basename(f):
            dev = "imtiaz"
        if not dev:
            continue
        for idx, p in enumerate(d["projects"]):
            name = p.get("p")
            k, inpf = nm.key(dev, name)
            if not k:
                continue
            prev = latest.get((k, p.get("block") or ""))
            if not prev or (d.get("sheet_date") or "") >= prev[0]["sheet_date"]:
                latest[(k, p.get("block") or "")] = (dict(d, sheet_date=d.get("sheet_date") or ""), f, idx, p, dev, inpf)
    by_proj = collections.defaultdict(list)
    for (k, blk), v in latest.items():
        by_proj[k].append(v)
    for k, vs in by_proj.items():
        d0, f0, idx0, p0, dev, inpf = vs[0]
        r = rec(dev, k, inpf, p0.get("p"), d0.get("developer") or dev)
        rel = os.path.relpath(f0, os.path.dirname(data_root)).replace("\\", "/")
        labels = collections.OrderedDict()
        for d1, f1, idx1, p1, _, _ in vs:
            for lb in parse_label(p1.get("plan")):
                labels.setdefault(lb["text"], (lb, d1, f1, idx1, p1))
            if p1.get("plan") and not parse_label(p1.get("plan")):
                audit.append([k, p1.get("p"), "developer sheet", os.path.relpath(f1, os.path.dirname(data_root)).replace("\\", "/"), "projects[%d].plan" % idx1, str(p1.get("plan")), "EXCLUDED", "label does not sum to 100 or is not a label", ""])
        # blocks of one project that print different labels: say nothing about which block has which
        blk_labels = {tuple(sorted(parse_label_texts(v[3].get("plan")))) for v in vs}
        if len({b for b in blk_labels if b}) > 1:
            audit.append([k, p0.get("p"), "developer sheet", rel, "projects[*].plan", " | ".join(sorted({t for b in blk_labels for t in b})), "EXCLUDED", "blocks of one project print different plans; which block has which is not stated", ""])
        else:
            for t, (lb, d1, f1, idx1, p1) in labels.items():
                r["labels"].append({"text": lb["text"], "figures": lb["figures"], "source": {"kind": "developer sheet", "file": os.path.relpath(f1, os.path.dirname(data_root)).replace("\\", "/"), "ref": "projects[%d].plan" % idx1, "sheet_date": d1["sheet_date"]}})
                audit.append([k, p1.get("p"), "developer sheet", os.path.relpath(f1, os.path.dirname(data_root)).replace("\\", "/"), "projects[%d].plan" % idx1, lb["text"], "LABEL_ONLY", "printed code; the meaning of each figure is not stated", ""])
        comp = next((v[3].get("completion") for v in vs if v[3].get("completion")), None)
        if comp and not r["handover_text"]:
            r["handover_text"] = comp
            r["handover_source"] = "developer sheet"
        # the developer's own list prices (unit rows: [code, type, sqft, price, view])
        rows = []
        for d1, f1, idx1, p1, _, _ in vs:
            for u in p1.get("units") or []:
                if isinstance(u, list) and len(u) >= 4 and isinstance(u[3], (int, float)) and u[3] > 0:
                    rows.append((u[1], u[2], u[3]))
        if rows:
            bt = collections.defaultdict(list)
            for t, sq, pr_ in rows:
                bt[t].append((pr_, sq))
            r["prices"] = {"source": "developer sheet", "file": rel, "sheet_date": d0["sheet_date"], "kind": "list price per unit on the developer's availability sheet",
                           "by_type": {t: {"n": len(v), "from_aed": min(x[0] for x in v), "median_aed": statistics.median([x[0] for x in v])} for t, v in sorted(bt.items())}}

    # 3. KORE: the developer's brochure page, read by a person on 6 Oct 2026 (docs/kore), every row with its page
    kp = kore_path or os.path.join(os.path.dirname(data_root), "docs", "kore", "KORE_PRODUCT_DATA_SHEET.json")
    if os.path.exists(kp):
        kd = load_json(kp)
        node = find_key(kd, "payment_plans")
        if node:
            k = "imtiaz|kore"
            r = rec("imtiaz", k, k in pf, "KORE by Imtiaz", "Imtiaz")
            for pl in node:
                rows = ((pl.get("rows") or {}).get("value")) or []
                opt = kore_option(pl.get("name"), rows)
                if not opt:
                    audit.append([k, "KORE by Imtiaz", "developer brochure", "docs/kore/KORE_PRODUCT_DATA_SHEET.json", pl.get("name"), "", "EXCLUDED", "rows do not sum to 100", ""])
                    continue
                src = pl["rows"]
                opt["source"] = {"kind": "developer brochure", "file": "docs/kore/KORE_PRODUCT_DATA_SHEET.json", "ref": "commercial.payment_plans[" + str(pl.get("name")) + "]", "page": src.get("source"), "as_of": src.get("as_of"), "note": src.get("note")}
                r["plans"].append(opt)
                audit.append([k, "KORE by Imtiaz", "developer brochure", "docs/kore/KORE_PRODUCT_DATA_SHEET.json", "brochure p08 / " + str(pl.get("name")), json.dumps([[x.get("label"), x.get("pct")] for x in rows])[:220], "INCLUDED", "every row labelled in the brochure; total 100", opt["confidence"]])
            hs = find_key(kd, "handover_stated")
            if hs and hs.get("value"):
                r["handover_text"] = hs["value"]; r["handover_source"] = "developer brochure " + str(hs.get("source"))
            lad = find_key(kd, "ladder_developer")
            if lad and lad.get("value"):
                r["prices"] = {"source": "developer brochure", "file": "docs/kore/KORE_PRODUCT_DATA_SHEET.json", "sheet_date": lad.get("as_of"), "kind": "starting price per unit type printed in the developer's brochure (" + str(lad.get("source")) + ")",
                               "by_type": {x["type"]: {"n": None, "from_aed": x["price_aed_brochure"], "median_aed": None} for x in lad["value"]}}

    # cross-check a site description against the sheet label where both exist, and finish each record
    for k, r in list(recs.items()):
        seen = set()
        r["labels"] = [x for x in r["labels"] if not (x["text"] in seen or seen.add(x["text"]))]
        r["plans"] = dedupe_plans(r["plans"])
        sheet_texts = {x["text"] for x in r["labels"] if x["source"]["kind"] == "developer sheet"}
        for o in r["plans"]:
            if o.get("label") and re.match(r"^\d{2}/\d{2}$", o["label"]):
                o["label_on_sheet"] = o["label"] in sheet_texts or None
        # a developer's web page and its newer sheet that disagree on what is paid at the end: say neither (the sheet label's last figure
        # must be what the page says is paid on or after handover)
        if r["plans"] and sheet_texts:
            lastf = {x["figures"][-1] for x in r["labels"] if x["source"]["kind"] == "developer sheet"}
            site = [o for o in r["plans"] if o["source"]["kind"] == "developer site"]
            agree = [o for o in site if any(abs(f - o["on_handover_pct"]) < 0.01 or abs(f - o["after_handover_pct"]) < 0.01 or abs(f - (o["on_handover_pct"] + o["after_handover_pct"])) < 0.01 for f in lastf)]
            if site and not agree:
                audit.append([k, r["project"], "developer site vs sheet", site[0]["source"]["file"], site[0]["source"]["ref"], "site: " + str([(o["on_booking_pct"], o["instalments_pct"], o["on_handover_pct"], o["after_handover_pct"]) for o in site]) + " / sheet labels: " + ", ".join(sorted(sheet_texts)),
                              "EXCLUDED", "the web page and the newer developer sheet disagree on the last payment; neither is offered as a structure", ""])
                r["plans"] = [o for o in r["plans"] if o["source"]["kind"] != "developer site"]
        r["confidence"] = ("high" if all(o["confidence"] == "high" for o in r["plans"]) else "medium") if r["plans"] else None
        if not r["plans"] and not r["labels"]:
            del recs[k]
    return recs, audit, pf


def parse_label_texts(plan):
    return [x["text"] for x in parse_label(plan)]


def find_key(o, key):
    if isinstance(o, dict):
        if key in o:
            return o[key]
        for v in o.values():
            r = find_key(v, key)
            if r is not None:
                return r
    elif isinstance(o, list):
        for v in o:
            r = find_key(v, key)
            if r is not None:
                return r
    return None


def kore_option(name, rows):
    steps, tot = [], 0.0
    booking = inst = hand = post = 0.0
    for x in rows:
        lab = str(x.get("label") or "").lower()
        pct = float(x.get("pct") or 0)
        tot += pct
        st = {"label": x.get("label"), "pct": pct}
        if x.get("date"):
            st["when"] = x["date"]
        if x.get("indicative"):
            st["indicative"] = True
        if "booking" in lab:
            st["kind"] = "booking"; booking += pct
        elif "post" in lab and "handover" in lab:
            st["kind"] = "after_handover"; post += pct
        elif "completion" in lab or "handover" in lab:
            st["kind"] = "on_handover"; hand += pct
        else:
            st["kind"] = "instalments_before_handover"; inst += pct
        steps.append(st)
    if abs(tot - 100) > 0.05:
        return None
    return {"label": name, "indicative": True, "on_booking_pct": booking or None, "instalments_pct": inst or None, "before_handover_pct": round(booking + inst, 4),
            "on_handover_pct": hand, "after_handover_pct": round(post, 4), "total_pct": 100, "steps": steps, "derived_remainder": False, "confidence": "high"}


def dedupe_plans(plans):
    out, seen = [], {}
    for o in plans:
        sig = (o["on_booking_pct"], o["instalments_pct"], o["on_handover_pct"], o["after_handover_pct"], o["before_handover_pct"])
        if sig in seen:
            continue
        seen[sig] = 1
        out.append(o)
    return out


def write_outputs(recs, audit, pf, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    explicit = [k for k, r in recs.items() if r["plans"]]
    labelled = [k for k, r in recs.items() if r["labels"]]
    in_pf = lambda ks: sum(1 for k in ks if recs[k]["in_projfacts"])
    before = sum(1 for v in pf.values() if v.get("plans"))
    cov = {"projects_in_projfacts": len(pf), "before_with_plan_label": before,
           "after_structured_plan": in_pf(explicit), "after_label_only_extra": in_pf([k for k in labelled if k not in explicit]),
           "after_any_plan_on_file": in_pf(set(explicit) | set(labelled)),
           "structured_plan_projects_total": len(explicit), "projects_not_in_projfacts": sum(1 for r in recs.values() if not r["in_projfacts"])}
    doc = {"version": 1, "generated": dt.datetime.now().strftime("%Y-%m-%d %H:%M"), "evidence": "DEVELOPER_CLAIMED",
           "rule": "A plan is listed only where a developer's own text says what is paid when; a printed code (60/40, 5/5/5/5/5/5/70) is kept as a label and is never read as before or after handover.",
           "coverage": cov, "projects": dict(sorted(recs.items()))}
    p = os.path.join(out_dir, "payment_plans.json")
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    ap = os.path.join(out_dir, "payment_plans_audit.csv")
    with open(ap, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["project_key", "project", "source_kind", "source_file", "source_ref", "text_or_label", "status", "reason", "confidence"])
        w.writerows(audit)
    return p, ap, cov


def selftest(fixtures):
    fx = load_json(fixtures)
    out = []
    for c in fx["cases"]:
        r = parse_plan_text(c["text"])
        out.append({"name": c["name"], "options": [{k: o[k] for k in ("label", "on_booking_pct", "instalments_pct", "before_handover_pct", "on_handover_pct", "after_handover_pct", "derived_remainder", "confidence")} for o in r["options"]],
                    "excluded": [x[0] for x in r["excluded"]], "handover_text": r["handover_text"]})
    print(json.dumps(out, ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-root", default=DEFAULT_DATA)
    ap.add_argument("--out-dir", default=os.path.join(ROOT, "data", "payment_plans"))
    ap.add_argument("--selftest", default=None)
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.selftest)
    recs, audit, pf = build(a.data_root, a.out_dir)
    p, ap_, cov = write_outputs(recs, audit, pf, a.out_dir)
    print("wrote", p, "and", ap_)
    print(json.dumps(cov, indent=1))
    by = collections.Counter(r["dev"] for r in recs.values() if r["plans"])
    print("structured plans by developer:", dict(by))
    byl = collections.Counter(r["dev"] for r in recs.values() if r["labels"] and not r["plans"])
    print("label-only by developer:", dict(byl))
    print("audit rows:", len(audit), dict(collections.Counter(x[6] for x in audit)))


if __name__ == "__main__":
    main()
