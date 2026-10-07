"""v397a - PROJECTS DROPPED BY A RULE, kept visible (Kendall, 7 Oct 2026: 'if it is in a government register it must be findable').
OFFLINE, DETERMINISTIC, RE-RUNNABLE. Reads a work folder of the v390 dry run (scripts\\publish_devmap_attr_v390.ps1 -DryRun -Work <dir>: it holds the live unit-mix cards, the register counts,
the register developer map and the evidence file), re-runs the SAME index builder with --dropped-out, and writes ONE file (default data/notconf/notconf.json).
Nothing is deployed, nothing is written to KV (scripts/publish_notconf.py does that, and only Kendall runs it).

  python scripts/build_notconf.py --work <v390 dry-run work folder> [--out data/notconf/notconf.json] [--audit <csv>] [--dropped <already collected json>]

WHAT IS IN IT (reason code r):
  non_residential_sales   a priced card whose registered sales are offices, shops or hotel rooms: the page prices homes by bedroom count, so no cell was made (Tamani Arts Offices)
  no_sales_by_type        the register holds sales for the project, filed under a unit type with no bedroom count
  no_size                 a priced row with sales but no median size, so no price per sq m
  no_sales                a priced card with no registered sale (only when the v392 no-sales file does not already hold the project)
  other_name              the project IS a card on the page, but under the name of the building outline it was bound to (La Cle by Maaia Developers for the register project Azizi Jewel) and the card
                          carries no register project number: the register's own name finds nothing. The entry carries the register name, the card's name ('al') and is outside the numbers
                          (the card itself stays where it is, counted as before).
A project that IS already a card of the index (same register project number, or the same name, in the same area) is not repeated; a project already in the v392 no-sales file is not repeated.
Buildings of ONE register project in one area are one entry.

WHERE IT SHOWS (d[<key>][<district slug>] = [entry, ...]):
  <developer id>  the developer is KNOWN (the register's company, or the brand) and has a profile page (at least one register-verified project in the index): the entry joins that developer's
                  'Not confirmed by the register' group, label NAME_ONLY, the registered company shown ('de').
  "_"             no developer, or one that has no profile page: the AREA card's group 'Projects whose developer is not recorded here' (collapsed, per district), so the 'Developer not recorded' slot is no longer a dead end.
Never counted: not in a total, a price band, the scale word or an area count.

ENTRY (compact keys): p register project number, n name, e evidence label (always NAME_ONLY here), de registered company, br the developer the name pointed to when it is not the registered company,
  a area label, as area source, h registered homes, r reason code, al the card's own name (other_name), st/pc/pe/u/mix/pl register facts of the project (when data/regfacts has them).
"""
import argparse, csv, datetime as dt, json, os, re, subprocess, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
NMP = r"C:\Dev\naj-market-pulse"
SCRATCH = r"C:\Users\kwils\AppData\Local\Temp\claude\C--Users-kwils-Downloads\cfd69a2f-a784-4bee-87d0-17cb12cabffb\scratchpad"
DEF_SLUGS = "majan,madinatalmataar,jabalalifirst,alkhairanfirst,alhebiahfifth,dubaiinvestmentparkfirst,dubaiinvestmentparksecond,alyelayiss1,alyelayiss2,alyufrah1,wadialsafa4,wadialsafa5,palmdeira"
REASONS = ("non_residential_sales", "no_sales_by_type", "no_size", "no_sales", "other_name", "same_name")
RF_KEYS = ("st", "pc", "pe", "u", "mix", "pl")


def nk(s):
    return re.sub(r"[^a-z0-9]+", " ", str(s or "").lower()).strip()


def title(s):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    return s.title() if s and s == s.upper() else s


def collect(work, cards, shares, slugs, regbind, txbind, out_tmp, dropped_out):
    """Re-run the final pass of the index builder with --dropped-out. The arguments are exactly those of scripts/publish_devmap_attr_v390.ps1."""
    j = lambda *p: os.path.join(work, *p)
    args = ["node", os.path.join(HERE, "build_devmap_index.mjs"), "--um", j("um"), "--prices", j("map_prices.json"), "--rent", j("rent_index.json"), "--geo", j("districts_geo_all.json"),
            "--shares", shares, "--register", j("area_register.json"), "--offplan", cards, "--offplan-slugs", slugs, "--regdev", j("regdev.json")]
    if os.path.exists(j("ejari_projects_index.json")):
        args += ["--ejari", j("ejari_projects_index.json")]
    if os.path.exists(regbind) and os.path.exists(txbind):
        args += ["--regbind", regbind, "--txbind", txbind]
    rf = os.path.join(ROOT, "data", "regfacts", "register_facts.json")
    if os.path.exists(rf):
        args += ["--regfacts", rf]
    args += ["--evidence", j("area_evidence.json"), "--out", out_tmp, "--dropped-out", dropped_out]
    r = subprocess.run(args, capture_output=True, text=True, cwd=ROOT)
    if r.returncode != 0:
        sys.exit("the index builder failed:\n" + (r.stdout or "") + (r.stderr or ""))
    print("  " + (r.stdout or "").strip().splitlines()[-1])


def index_facts(idx):
    """What the index already holds: (slug, project number) and (slug, name) of every card, the names of every card Dubai-wide, and the developers that have a profile page
    (a register-verified project somewhere)."""
    have_p, have_n, prof = set(), set(), set()
    for slug, A in idx["areas"].items():
        for dk, d in A["devs"].items():
            for lst, lx in (("b", "bx"), ("b12", "b12x")):
                xs = d.get(lx) or []
                for i, b in enumerate(d.get(lst) or []):
                    x = xs[i] if i < len(xs) else None
                    have_n.add((slug, nk(b[2])))
                    if x and x.get("p") not in (None, ""):
                        have_p.add((slug, str(x["p"])))
                    if dk != "_" and x and x.get("e") == "REGISTER_VERIFIED":
                        prof.add(dk)
    return have_p, have_n, prof


def resolve(dropped, area_register, idx):
    """Tie each record to its Land Department PROJECT REGISTER row by name, and decide its developer the way the index does (scripts/devattr_register.py pick, the mirror of src/devattr.js decide).
    The index builder looks the register up through RESIDENTIAL flat and villa sales only, so an office, shop or hotel project has no register row there and its developer came from a project-name list
    alone (Tamani Arts Offices went to 'The Developer Properties', the register names Business Bay LLC). Here the register project is found by its own name: inside the district's Land Department
    areas first, else the one project of that name in the whole register (a name that fits two register projects is never guessed).
    Adds: p, pname (the register's project name), dn (registered company), regdk (the register company's crosswalk id), dk (the developer to file under, or '')."""
    sys.path.insert(0, HERE)
    sys.path.insert(0, os.path.join(NMP, "scripts"))
    import devattr_register as DR  # noqa: E402
    from lake import connect  # noqa: E402
    con = connect()
    RD = DR.register_devs(con)
    byname, pnames = {}, {}
    for pn, nm, ar in con.execute("select project_number, name_en, area_name_en from lk_d_project where project_number is not null and name_en is not null").fetchall():
        pnames[int(pn)] = nm
        for k in {nk(nm), "~" + DR.nkey(nm)}:
            byname.setdefault(k, set()).add((int(pn), ar))
    out = []
    for r0 in dropped:
        alias = r0.get("kind") == "alias"
        names = list(r0.get("names") or []) if alias else [r0["name"]] + list(r0.get("names") or [])      # an alias is looked up by the OTHER names of the card, never by the building outline's own name
        areas = set((area_register.get(r0["slug"]) or {}).get("areas") or [])
        found = {}                                                                                        # register project number -> how it was found
        if r0.get("p") not in (None, ""):
            found[int(r0["p"])] = "card"
        for nm in names:
            for key in (nk(nm), "~" + DR.nkey(nm)):
                hit = False
                for scope in ("district", "register"):
                    c = {x[0] for x in byname.get(key, ()) if scope == "register" or x[1] in areas}
                    if len(c) == 1:
                        found.setdefault(next(iter(c)), "register_name_" + scope)
                        hit = True
                        break
                if hit:
                    break
        for pn in (sorted(found) or [None]):                                                              # one record per register project the card's names lead to
            r = dict(r0)
            rd = RD.get(pn) if pn is not None else None
            r["p"], r["p_by"], r["pname"] = pn, found.get(pn, ""), (pnames.get(pn, "") if pn is not None else "")
            if rd:
                r["dn"] = rd["name_en"] or r.get("dn") or ""
                r["regdk"] = rd["canon"]
                if not alias:
                    pd = {"slugs": {r["slug"]: {nk(x): r["dk"] for x in names if r.get("dk")}}, "global": {}}
                    dev, q = DR.pick(RD, pd, r["slug"], r["name"], pn)
                    r["dk"] = dev if dev and dev != "_" else ""
            elif pn is None:
                r["dn"] = r.get("dn") or ""
            out.append(r)
    # a register project that shares its NAME with a card of another register project (Sondos Sage 829 and the card Sondos Sage of project 3188): the name finds the card, the number finds nothing
    have_p, have_n, _ = index_facts(idx)
    for pn, nm in sorted(pnames.items()):
        pareas = {x[1] for x in byname.get(nk(nm), ()) if x[0] == pn}
        for slug, ar in sorted(area_register.items()):
            if not (pareas & set(ar.get("areas") or [])) or (slug, str(pn)) in have_p or (slug, nk(nm)) not in have_n or slug not in idx["areas"]:
                continue
            rd = RD.get(pn)
            dev, q = DR.pick(RD, {"slugs": {}, "global": {}}, slug, nm, pn) if rd else ("_", "")
            out.append({"kind": "samename", "slug": slug, "id": "", "name": nm, "names": [nm], "reason": "same_name", "p": pn, "p_by": "register_name_same", "pname": nm, "dev": "",
                        "dk": dev if dev and dev != "_" else "", "dn": (rd["name_en"] if rd else ""), "regdk": rd["canon"] if rd else "", "a": idx["areas"][slug]["name"], "as": "district", "homes": 0, "sold": 0})
    return out


def shape(dropped, idx, nosales, regfacts):
    have_p, have_n, prof = index_facts(idx)
    ns_p = set()
    for dev, ds in ((nosales or {}).get("d") or {}).items():
        for dist, lst in ds.items():
            for e in lst:
                if e.get("p") is not None:
                    ns_p.add(str(e["p"]))
    groups, skipped = {}, {"already_a_card": 0, "in_nosales_file": 0, "alias_without_register_project": 0, "no_name": 0}
    for r in dropped:
        alias = r.get("kind") == "alias"
        pk = str(r["p"]) if r.get("p") not in (None, "") else None
        if alias:
            if not pk:
                skipped["alias_without_register_project"] += 1
                continue
            if r.get("cp") is not None and str(r["cp"]) == pk:
                continue                                    # the other name of the card leads to the card's own register project: not a different project
            names = [nk(x) for x in (r.get("names") or [])] + [nk(r.get("pname"))]
        else:
            names = [nk(x) for x in ([r["name"]] + list(r.get("names") or []))]
        if (pk and (r["slug"], pk) in have_p) or (r.get("kind") != "samename" and any((r["slug"], n) in have_n for n in names if n and not (alias and n == nk(r["name"])))):
            skipped["already_a_card"] += 1
            continue
        if (alias or r["reason"] == "no_sales") and pk and pk in ns_p:
            skipped["in_nosales_file"] += 1
            continue
        key = (r["slug"], "p" + pk) if pk else (r["slug"], "n" + nk(r["name"]))
        groups.setdefault(key, []).append(r)
    d, counters, placed = {}, {x: 0 for x in REASONS}, {"brand": 0, "area": 0}
    for (slug, _), recs in sorted(groups.items()):
        real = [r for r in recs if r.get("kind") != "alias"]
        use = real or recs
        r0 = sorted(use, key=lambda r: (-r.get("sold", 0), r["id"]))[0]
        reason = next((x for x in REASONS if x != "other_name" and any(r.get("reason") == x for r in real)), "other_name")
        pk = r0.get("p")
        card_names = [r["name"] for r in use]
        pname = (r0.get("pname") or "").strip()
        if pk is not None and pname:
            name = card_names[0] if (len(use) == 1 and nk(card_names[0]) == nk(pname) and card_names[0] != card_names[0].upper()) else title(pname)
        else:
            name = card_names[0] if len(use) == 1 else title(next((x for r in use for x in (r.get("names") or []) if x), card_names[0]))
        if not str(name or "").strip():
            skipped["no_name"] += 1                                  # a card with no name at all (no project name either) cannot be shown or found
            continue
        dk = next((r["dk"] for r in use if r.get("dk") and r["dk"] != "_"), "")
        reg_co = next((r["dn"] for r in use if r.get("dn")), "")
        brand_dev = next((r["dev"] for r in use if r.get("dev")), "")
        e = {"n": name, "e": "NAME_ONLY", "r": reason, "a": r0["a"], "as": r0["as"]}
        if pk is not None:
            e = {"p": int(pk), **e}
        if reg_co:
            e["de"] = reg_co
        if brand_dev and nk(brand_dev) != nk(reg_co):
            e["br"] = brand_dev
        homes = sum(r.get("homes") or 0 for r in use)
        if homes:
            e["h"] = homes
        if reason == "other_name":
            e["al"] = r0["name"]
        pf = (regfacts or {}).get(str(pk)) if pk is not None else None
        for q in RF_KEYS:
            if pf and pf.get(q) not in (None, ""):
                e[q] = pf[q]
        place = dk if (dk and dk in prof) else "_"
        d.setdefault(place, {}).setdefault(slug, []).append(e)
        counters[reason] += 1
        placed["brand" if place != "_" else "area"] += 1
    for place in d:
        for slug in d[place]:
            d[place][slug].sort(key=lambda e: (-(e.get("h") or 0), e["n"]))
    n = sum(len(v) for ds in d.values() for v in ds.values())
    return {"meta": {"built": dt.date.today().isoformat(), "count": n, "by_reason": counters, "placed": placed, "skipped": skipped,
                     "rule": "Projects a rule kept out of the developer cards (their sales are not homes with a bedroom count, or carry no size, or the card carries another name): shown in the Not-confirmed group, never counted in any total, price band, scale word or area count.",
                     "source": "Dubai Land Department project register and units register (unit-mix cards), sales register"}, "d": d}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--work", required=True, help="a v390 dry-run work folder")
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "notconf", "notconf.json"))
    ap.add_argument("--audit", default="")
    ap.add_argument("--dropped", default="", help="skip the collection and use this dropped.json")
    ap.add_argument("--cards", default=os.path.join(SCRATCH, "cov_cards"))
    ap.add_argument("--shares", default=os.path.join(SCRATCH, "shares.json"))
    ap.add_argument("--slugs", default=DEF_SLUGS)
    ap.add_argument("--regbind", default=r"C:\Dev\naj-market-pulse\data\identity\official\dld\reg_bindings.json")
    ap.add_argument("--txbind", default=r"C:\Dev\naj-market-pulse\data\identity\official\dld\tx_bindings.json")
    a = ap.parse_args()
    tmp_idx = os.path.join(a.work, "notconf_index.tmp.json")
    dropped_json = a.dropped or os.path.join(a.work, "notconf_dropped.json")
    if not a.dropped:
        print("1/3 collecting the dropped cards (the final index pass, read-only on every input)")
        collect(a.work, a.cards, a.shares, a.slugs, a.regbind, a.txbind, tmp_idx, dropped_json)
    idx = json.load(open(tmp_idx if os.path.exists(tmp_idx) else os.path.join(a.work, "devmap_index.new.json"), encoding="utf8"))
    dropped = json.load(open(dropped_json, encoding="utf8"))
    nsf = os.path.join(ROOT, "data", "nosales", "nosales.json")
    nosales = json.load(open(nsf, encoding="utf8")) if os.path.exists(nsf) else None
    rff = os.path.join(ROOT, "data", "regfacts", "register_facts.json")
    regfacts = (json.load(open(rff, encoding="utf8")) or {}).get("p") if os.path.exists(rff) else None
    print("2/3 tying %d records to the project register, then shaping" % len(dropped))
    dropped = resolve(dropped, json.load(open(os.path.join(a.work, "area_register.json"), encoding="utf8")), idx)
    json.dump(dropped, open(os.path.join(a.work, "notconf_resolved.json"), "w", encoding="utf8"))
    out = shape(dropped, idx, nosales, regfacts)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    m = out["meta"]
    print("3/3 wrote %s: %d entries, %d bytes | by reason %s | placed %s | skipped %s" % (a.out, m["count"], os.path.getsize(a.out), m["by_reason"], m["placed"], m["skipped"]))
    if a.audit:
        with open(a.audit, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f)
            w.writerow(["place", "district", "p", "name", "reason", "register_company", "brand_by_name", "area", "homes", "card_name", "label"])
            for place, ds in sorted(out["d"].items()):
                for slug, lst in sorted(ds.items()):
                    for e in lst:
                        w.writerow([place, slug, e.get("p", ""), e["n"], e["r"], e.get("de", ""), e.get("br", ""), e["a"], e.get("h", ""), e.get("al", ""), e["e"]])
        print("audit: " + a.audit)


if __name__ == "__main__":
    main()
