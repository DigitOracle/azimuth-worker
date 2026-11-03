"""v723 - build a campaign project brief (served at /cb/<slug>) from the DEVELOPER AVAILABILITY group capture.

The listener saves the group's documents to <DOCS_DIR>/developer_availability/ (file names start with the capture time in ms)
and launch captions to offers.jsonl. This picks the NEWEST document whose name matches the project, reads its text, and pulls
developer, location, price, payment plan, handover, unit types and sizes, highlights, nearby and the developer's caveat.
Any field the capture does not state is written as the literal "to confirm". It never infers or rounds a figure.

  python scripts/build_camp_brief.py --project "Palm Springs" --slug palm-springs
  python scripts/build_camp_brief.py --project "Palm Springs" --slug palm-springs --docs C:\\Dev\\azimuth-listener-naj\\docs

Writes data/camp_briefs/<slug>.json and prints the KV command that would store it (camp_brief_<slug>, binding MEETINGS).
It does NOT run that command: storing it is Kendall's call.
"""
import argparse, datetime, json, os, re, sys

TBC = "to confirm"


def docs_dir(arg):
    if arg:
        return arg
    env = r"C:\Dev\azimuth-listener-dev\.env"
    try:
        for line in open(env, encoding="utf-8"):
            if line.startswith("DOCS_DIR="):
                v = line.split("=", 1)[1].strip()
                if os.path.isdir(v):
                    return v
    except OSError:
        pass
    return r"C:\Dev\azimuth-listener-naj\docs"


def pdf_text(path):
    import pypdf
    r = pypdf.PdfReader(path)
    return "\n".join((p.extract_text() or "") for p in r.pages)


def clean(s):
    return re.sub(r"\s+", " ", s.replace("\ufffd", "·")).strip(" ·-")


def after(lines, head, stop_re, n=6):
    """the lines after a heading, until the next ALL-CAPS heading"""
    for i, l in enumerate(lines):
        if l.strip().upper() == head:
            out = []
            for m in lines[i + 1:i + 1 + n]:
                if re.match(stop_re, m.strip()) or not m.strip() or len(m.strip()) <= 1:
                    break
                out.append(clean(m))
            return out
    return []


def extract(text, project):
    lines = [l for l in text.splitlines()]
    up = [l.strip().upper() for l in lines]
    caps = r"^[A-Z0-9 &\-\u00b7\ufffd]{4,}$"
    b = {}
    for i, l in enumerate(up):
        if l == "DEVELOPED BY" and i + 1 < len(lines):
            b["developer"] = clean(lines[i + 1]).title() if lines[i + 1].isupper() else clean(lines[i + 1])
            break
    for i, l in enumerate(up):
        if l == project.upper() and i + 1 < len(lines) and "DUBAI" in up[i + 1]:
            b["location"] = clean(lines[i + 1]).title()
            break
    m = re.search(r"AED\s*[\d.,]+\s*[MK]?\s*\S\s*AED\s*[\d.,]+\s*[MK]?", text)
    if m:
        qual = "Indicative pre-launch pricing" if re.search(r"indicative pre-launch pricing", text, re.I) else ""
        b["price"] = clean(m.group(0)).replace(" · ", " to ") + (" (" + qual.lower() + ")" if qual else "")
    m = re.search(r"(\d{1,2}\s*/\s*\d{1,2}(?:\s*/\s*\d{1,2})?)\s*payment plan", text, re.I) or re.search(r"payment plan[:\s]+([^\n]{3,80})", text, re.I)
    if m:
        b["payment_plan"] = clean(m.group(1))
    m = re.search(r"(?:handover|completion)[:\s]+(Q[1-4]\s*\d{4}|\d{4})", text, re.I)
    if m:
        b["handover"] = clean(m.group(1))
    for l in lines:
        if re.search(r"bedroom", l, re.I) and re.search(r"townhouse|villa|apartment", l, re.I) and len(l) < 120:
            b["unit_types"] = clean(l)
            break
    sz = after(lines, "UNIT SIZES", caps, 2)
    if sz:
        b["unit_sizes"] = sz[0]
    hl = after(lines, "COMMUNITY HIGHLIGHTS", caps, 6)
    if hl:
        b["highlights"] = hl
    nb = after(lines, "NEARBY", caps, 6)
    if nb:
        b["nearby"] = nb
    cv = [clean(l) for l in lines if re.match(r"pre-launch information|prices, unit types", l.strip(), re.I)]
    if cv:
        b["caveat"] = cv[0][: cv[0].rfind(".") + 1] or cv[0]
    return b


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True)
    ap.add_argument("--slug", required=True)
    ap.add_argument("--docs")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "data", "camp_briefs"))
    a = ap.parse_args()
    if not re.match(r"^[a-z0-9-]{1,60}$", a.slug):
        sys.exit("slug: lowercase letters, digits and dashes")
    grp = os.path.join(docs_dir(a.docs), "developer_availability")
    key = re.sub(r"[^a-z0-9]", "", a.project.lower())
    docs = sorted([f for f in os.listdir(grp) if f.lower().endswith(".pdf") and key in re.sub(r"[^a-z0-9]", "", f.lower())], reverse=True)
    brief = {"slug": a.slug, "project": a.project}
    src = {}
    if docs:
        f = docs[0]
        brief.update(extract(pdf_text(os.path.join(grp, f)), a.project))
        ms = re.match(r"^(\d{13})_", f)
        src = {"file": f, "captured_at": datetime.datetime.fromtimestamp(int(ms.group(1)) / 1000, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if ms else ""}
    offers = []
    try:
        for line in open(os.path.join(grp, "offers.jsonl"), encoding="utf-8"):
            try:
                o = json.loads(line)
            except ValueError:
                continue
            if key in re.sub(r"[^a-z0-9]", "", json.dumps(o).lower()):
                offers.append(o)
    except OSError:
        pass
    if offers:
        src["offers_matched"] = len(offers)
    for k in ["developer", "location", "price", "payment_plan", "handover", "unit_types", "unit_sizes"]:
        brief.setdefault(k, TBC)
    for k in ["highlights", "nearby"]:
        brief.setdefault(k, [])
    brief["images"] = []   # brochure pictures are not yet published to the worker; the page shows "to confirm" rather than a stand-in
    brief["source"] = src or {"file": TBC}
    os.makedirs(a.out, exist_ok=True)
    p = os.path.join(a.out, a.slug + ".json")
    json.dump(brief, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(brief, ensure_ascii=False, indent=1))
    print("\nwrote", os.path.abspath(p))
    print("to store it (NOT run): npx wrangler kv key put --env azimuth2 --binding MEETINGS camp_brief_" + a.slug + " --path " + os.path.abspath(p) + " --remote")


if __name__ == "__main__":
    main()
