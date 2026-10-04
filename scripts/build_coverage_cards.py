"""v314 - BUY coverage: unit-mix-style cards and Buy items built from the Land Department sales register for the areas the Brief's Buy path cannot see.

WHY (scratchpad coverage_audit.md, 4 Oct 2026). The Brief's Buy mode finds buildings in img_map_prices and takes each one's per-bedroom median
and sale count from the unit-mix card (img_unitmix_<district>). A project with no card or no map-price item is invisible to Buy by construction.
Al Yelayiss 1 (DAMAC Islands, 3,714 sales in 12 months), Bukadra (2,607), Al Yufrah 1 (The Valley, 1,362), Wadi Al Safa 4/5/6/7 (Arabian Ranches and
neighbours), Palm Deira (0.2% on cards), Ras Al Khor and JLT South hold sales the app could not answer; Wadi Al Safa 2 (Liwan) has the cards but no items.

WHAT. For each target area this reads the register (lake, read-only, one short query per area) and builds ONE CARD PER REGISTER PROJECT AND HOME KIND
(apartment / villa-townhouse) with, per bedroom type, the number of registered sales and the median price (rows only where there are 3 or more sales).
  - Bedrooms are the REGISTER's own count (rooms_en). Sales with no count (about half of Arabian Ranches' villas: Casa, Lila, Palma ...) are kept in the
    card's "unspecified_bedroom_sales" and in no row - nothing is inferred from size. Studios are "Studio".
  - Villas and townhouses: the register's area is the PLOT size, so no sq ft figure is carried for them (median_sqm null; "plot_median_sqm" is the plot).
  - Off-plan sales are contract values (what the buyer agreed with the developer), not resale prices: every card says so (price_basis, offplan_share), and
    Palm Deira, which is all off-plan, is labelled that way on every row.
  - Window: sales since --months (default 36) before the register's last day, so a 2008 villa sale does not sit in a 2026 median. The card carries
    window_from, first and last sale date.
  - A project already on a PRICED card of the district is skipped (matched on the name key, as the app matches), so nothing is counted twice.
  - Ids 900000+ (stable: from the name key). A card is marked "synthetic": true and has no building page, no map position and no footprint.
OUTPUT (into --out, local files only; nothing is published here):
  unitmix_<slug>.synthetic.json   {district, generated, buildings_by_id: {<id>: card}}   cards to MERGE into img_unitmix_<slug>
  buy_extra.json                  {generated, note, items: [...]}   Brief-only Buy items (img_buy_extra; the public map reads none of them)
  map_prices_add.json             {items: [...]}   items for cards that already exist and have a real footprint position (Wadi Al Safa 2 / Liwan)
  coverage_cards.json / .csv      per area: register sales, sales on the new cards, projects built and skipped, with the reason
Usage:  python scripts\\build_coverage_cards.py --out <dir> [--months 36] [--only slug,slug]
Read-only on the lake (short hold; not 04:00-06:00 Dubai, not while Najma_Daily_Refresh / the availability sweep is running).
"""
import argparse, csv, collections, datetime as dt, json, os, re, sys, unicodedata, zlib
sys.path.insert(0, r"C:\Dev\naj-market-pulse\scripts")
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
BOARD = r"C:\Dev\naj-market-pulse\data\board"; NAMES = r"C:\Dev\naj-market-pulse\data\names"
N_MIN = 3
ID0 = 900000
# slug -> DLD area name(s) in the register; "items_only": the cards already exist (Liwan: the app never published their items)
TARGETS = {
    "alyelayiss1": {"areas": ["Al Yelayiss 1"], "label": "DAMAC Islands"},
    "alyufrah1": {"areas": ["Al Yufrah 1"], "label": "The Valley"},
    "bukadra": {"areas": ["Bukadra"], "label": "Bukadra"},
    "wadialsafa4": {"areas": ["Wadi Al Safa 4"], "label": "Wadi Al Safa 4"},
    "wadialsafa5": {"areas": ["Wadi Al Safa 5"], "label": "Arabian Ranches III and neighbours"},
    "wadialsafa6": {"areas": ["Wadi Al Safa 6"], "label": "Arabian Ranches (Wadi Al Safa 6)", "new_district": True},
    "wadialsafa7": {"areas": ["Wadi Al Safa 7"], "label": "Arabian Ranches 2 and Serena (Wadi Al Safa 7)", "new_district": True},
    "palmdeira": {"areas": ["Palm Deira"], "label": "Dubai Islands (Palm Deira)"},
    "rasalkhor": {"areas": ["Ras Al Khor Industrial First"], "label": "Ras Al Khor"},
    # name-mismatch / alias-missing districts (binding audit, fix class S): the district HAS building cards, but whole projects the register sells are on none of them
    # (Binghatti Vintage 1,506 sales in Majan, Azizi Venice 14 in Madinat Al Mataar, Sobha Central in Jabal Ali First, Creek Bay in Al Khairan First, REMRAAM in Al Hebiah
    # Fifth ...). The same register-built card, added only for projects no priced card names.
    "majan": {"areas": ["Wadi Al Safa 3"], "label": "Majan (Wadi Al Safa 3)"},
    "madinatalmataar": {"areas": ["Madinat Al Mataar"], "label": "Dubai South"},
    "jabalalifirst": {"areas": ["Jabal Ali First"], "label": "Jabal Ali First"},
    "alkhairanfirst": {"areas": ["Al Khairan First"], "label": "Dubai Creek Harbour"},
    "alhebiahfifth": {"areas": ["Al Hebiah Fifth"], "label": "DAMAC Lagoons"},
    "dubaiinvestmentparkfirst": {"areas": ["Dubai Investment Park First"], "label": "Dubai Investment Park First"},
    "dubaiinvestmentparksecond": {"areas": ["Dubai Investment Park Second"], "label": "Dubai Investment Park Second"},
    "alyelayiss2": {"areas": ["Al Yelayiss 2"], "label": "Al Yelayiss 2"},
    "liwan1": {"areas": ["Wadi Al Safa 2"], "label": "Liwan (Wadi Al Safa 2)", "existing_items": True},
}
# HELD, not built: the app maps jltsouth to the DLD area "Al Thanyah Third", but in the register that area is Emirates Living (The Greens, The Springs,
# The Lakes, Golf Heights, The Hills ...), not Jumeirah Lakes Towers. Cards from it would show Emirates Living homes under "JLT South" - the wrong place on a
# client page. JLT's own sales sit in "Al Thanyah Fifth" (shared with JLT North). It needs the district mapping settled first.
HELD = {"jltsouth": "the app's DLD area for JLT South (Al Thanyah Third) is Emirates Living in the register, not JLT; the mapping must be settled first"}
ROOMS = {"Studio": 0, "1 B/R": 1, "2 B/R": 2, "3 B/R": 3, "4 B/R": 4, "5 B/R": 5, "6 B/R": 6, "7 B/R": 7}


def fold(s): return unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode()
def norm(s): return re.sub(r"[^a-z0-9]", "", fold(s).lower())
def stem(s): return re.sub(r"\b(by|the|tower|towers|residences?|residence|building|bldg|apartments?)\b", "", fold(s).lower())
def nkey(s): return norm(stem(s))                       # the app's own name key (src/brief.js nkey, build_rent_index.py nkey)
def label(b): return "Studio" if b == 0 else f"{b} bedroom"
def pretty(s):
    s = str(s or "").strip()
    return s.title() if s.isupper() else s
def med(v):
    v = sorted(v); n = len(v)
    return v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2
def stable_id(key, used):
    i = ID0 + (zlib.crc32(key.encode()) % 99000)
    while i in used: i += 1
    used.add(i); return i


# ---- developer of a register project (same order as the off-plan prototype): the pipeline's own crosswalk, then a "by X" name suffix, then the register ----
# Nakheel's entities are the LAND OWNER of record on Palm Deira, so a crosswalk entry or a name suffix (Beyond, Ellington, Imtiaz, Samana, Prestige One ...) wins.
NAKHEEL_AR = ("\u0646\u062e\u064a\u0644", "\u0627\u0644\u0646\u062e\u0644\u0629")
SUFFIX_DEV = re.compile(r"\bby\s+([A-Za-z][A-Za-z0-9&' .-]{2,40})$", re.I)
_DEV = {}


def dev_ctx(con):
    if not _DEV:
        _DEV["projdev"] = {k: d for k, d, _ in con.execute("select project_key, dev_name, dev_key from project_developer").fetchall()}
        _DEV["reg"] = {int(r[0]): r for r in con.execute("select project_number, developer_name from g_dld__projects where project_number is not null").fetchall()}
    return _DEV


def developer(con, pnum, name):
    D = dev_ctx(con); k = re.sub(r"[^a-z0-9]", "", fold(name).lower())
    for kk, d in D["projdev"].items():
        if len(kk) >= 6 and (kk == k or k.startswith(kk) or kk in k): return d, "crosswalk project_developer"
    m = SUFFIX_DEV.search(str(name or "").strip())
    if m: return m.group(1).strip().title(), "inferred from the project name suffix 'by X'"
    r = D["reg"].get(int(pnum)) if pnum is not None and pnum == pnum else None
    if r and r[1]:
        if any(a in r[1] for a in NAKHEEL_AR): return None, "not recorded (the register names a Nakheel entity, the land owner of record, not the delivery partner)"
        return r[1], "register developer of record"
    return None, "not recorded"


def existing_priced(slug, cards_dir):
    """name keys of the district's cards that already carry a price row (the app answers those)"""
    p = os.path.join(cards_dir, f"unitmix_{slug}.json")
    if not os.path.exists(p): return set(), {}
    b = json.load(open(p, encoding="utf-8")).get("buildings_by_id") or {}
    names = set()
    for c in b.values():
        if not any(r.get("median_aed") for r in c.get("rows") or []): continue
        for n in (c.get("name"), (c.get("dld") or {}).get("project"), (c.get("dld_sales") or {}).get("project")):
            if n and nkey(n): names.add(nkey(n))
    return names, b


def on_card(k, names):
    return any(k == n or (len(n) >= 6 and len(k) >= 6 and (n in k or k in n)) for n in names)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True); ap.add_argument("--months", type=int, default=36)
    ap.add_argument("--only", default=""); ap.add_argument("--cards-dir", default=BOARD)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    from lake import connect
    con = connect()
    last = con.execute("select max(instance_date) from g_dld__transactions where trans_group_en='Sales'").fetchone()[0]
    since = last - dt.timedelta(days=round(a.months * 30.4375))
    only = [s for s in a.only.split(",") if s] or list(TARGETS)
    for h in only:
        if h in HELD: sys.exit(f"{h} is held: {HELD[h]}")
    gen = dt.date.today().isoformat()
    cov, items_all, adds = [], [], []
    for slug in only:
        T = TARGETS[slug]
        ph = ",".join("'%s'" % x.replace("'", "''") for x in T["areas"])
        rows = con.execute(f"""select coalesce(nullif(trim(project_name_en),''), nullif(trim(building_name_en),''), nullif(trim(master_project_en),'')) proj, project_number,
              property_type_en, property_sub_type_en, rooms_en, reg_type_en, actual_worth, procedure_area, instance_date
            from g_dld__transactions
            where trans_group_en='Sales' and procedure_name_en not like 'Lease%' and procedure_name_en not like 'Adding Land%' and actual_worth>0
              and area_name_en in ({ph}) and property_type_en in ('Unit','Villa') and (property_type_en='Villa' or property_sub_type_en='Flat')""").fetchall()
        allsales = len(rows)
        names, cards = existing_priced(slug, a.cards_dir)
        if T.get("existing_items"):
            # Liwan: 6 cards are already priced but the app never published their map-price items. Items with a real footprint go to map_prices
            # (the map can place them); the others go to the Brief-only file (the map would have nowhere to draw them). The district's OTHER
            # projects (1,800+ cards hold sales but no price) are then built from the register below, like any other area.
            anc = {}
            ap_ = os.path.join(NAMES, f"anchors_{slug}.json")
            if os.path.exists(ap_): anc = {str(x["i"]): x for x in json.load(open(ap_, encoding="utf-8")).get("anchors", [])}
            n_map = n_x = 0; sold_on = 0
            for i, c in cards.items():
                rws = [r for r in c.get("rows") or [] if r.get("median_aed") and re.match(r"^(studio|\d+ bedroom)$", str(r.get("type") or "").lower())]
                if not rws: continue
                b = {}
                for r in rws:
                    t = str(r["type"]).lower(); k = 0 if t == "studio" else int(t.split()[0]); b[str(k)] = int(round(r["median_aed"]))
                it = {"p": nkey(c.get("name")) or norm(c.get("name")), "n": c.get("name"), "d": slug, "i": int(i), "dev": None, "st": c.get("status") or "verified",
                      "u": c.get("total_units") or sum(x.get("units") or 0 for x in rws), "b": b, "fl": c.get("floors") or 10}
                sold_on += sum(((c.get("dld_sales") or {}).get("sold_by_type") or {}).values())
                an = anc.get(str(i))
                if an and an.get("lon") is not None:
                    it["lon"], it["lat"] = round(an["lon"], 6), round(an["lat"], 6); adds.append(it); n_map += 1
                else:
                    it["x"] = 1; items_all.append(it); n_x += 1   # a real card with no footprint position: Brief-only (x = no building page, no map position)
            print(f"{slug:14s} existing priced cards: {n_map} with a footprint -> map_prices, {n_x} without -> buy_extra | their sales {sold_on:,}")
        # ---- build the cards ----
        P = collections.defaultdict(lambda: {"tx": [], "pnum": None})
        for proj, pn, pt, sub, rm, reg, w, ar, d in rows:
            kind = "villa" if pt == "Villa" else "apt"
            g = P[(nkey(proj) or norm(proj) or "unnamed", kind)]
            g["name"] = g.get("name") or proj; g["pnum"] = g["pnum"] or pn
            g["tx"].append((ROOMS.get(rm), float(w), float(ar or 0), reg, d))
        in_window = skipped_card = no_row = 0
        built, skipped = {}, []
        used = set(); items = []; sales_on_cards = 0; reg_window = 0
        for (k, kind), g in sorted(P.items(), key=lambda kv: (kv[1]["name"] or "")):
            tx = [t for t in g["tx"] if t[4] >= since]
            if kind == "apt": tx = [t for t in tx if t[2] > 0 and 300 <= t[1] / (t[2] * 10.7639) <= 25000]      # a flat's price per sq ft must be a real one
            reg_window += len(tx)
            if not tx: continue
            if on_card(k, names): skipped.append({"project": g["name"], "kind": kind, "sales": len(tx), "why": "already on a priced card of the district"}); continue
            by = collections.defaultdict(list); unspec = 0
            for b, w, ar, reg, d in tx:
                if b is None: unspec += 1
                else: by[b].append((w, ar))
            if kind == "villa": by.pop(0, None)                       # a "studio villa" is a register slip; and the app tells a villa by having no studio / 1-bed band
            sold = {label(b): len(v) for b, v in by.items()}
            rws = []
            for b in sorted(by):
                v = by[b]
                if len(v) < N_MIN: continue                            # the 3-record rule: no price from fewer than three sales
                row = {"type": label(b), "units": len(v), "median_aed": int(round(med([w for w, _ in v]))), "basis": "DLD registered sales"}
                if kind == "villa":
                    row["configuration"] = "plot %d m\u00b2 median (the register's area for a villa is its plot)" % round(med([x for _, x in v])); row["median_sqm"] = None; row["plot_median_sqm"] = round(med([x for _, x in v]), 1)
                else:
                    row["configuration"] = "%d m\u00b2 median" % round(med([x for _, x in v])); row["median_sqm"] = round(med([x for _, x in v]), 1)
                rws.append(row)
            if not rws: skipped.append({"project": g["name"], "kind": kind, "sales": len(tx), "why": "no bedroom type with 3 or more sales that state a bedroom count"}); continue
            off = sum(1 for t in tx if str(t[3]).startswith("Off")); share = round(off / len(tx), 3)
            ds = [t[4] for t in tx]
            cid = stable_id(f"{slug}:{k}:{kind}", used)
            basis = ("Off-plan sales: the price is the contract value agreed with the developer, not a resale price." if share >= 0.5 else
                     "Registered sale prices; the off-plan sales among them (%d%%) are contract values." % round(share * 100)) if off else "Registered resale prices."
            dev, dev_basis = developer(con, g["pnum"], g["name"])
            card = {"status": "register", "synthetic": True, "developer": dev, "developer_basis": dev_basis, "kind": "villa" if kind == "villa" else "apartment", "name": pretty(g["name"]), "total_units": None, "rows": rws,
                    "dld_sales": {"sold_by_type": sold, "sold_total": sum(sold.values()), "first": str(min(ds)), "last": str(max(ds)), "project": g["name"], "usage": {"Residential": len(tx)},
                                  "window_from": str(since), "unspecified_bedroom_sales": unspec},
                    "offplan_share": share, "price_basis": basis, "bedrooms_basis": "register (rooms as the Land Department records them)",
                    "plot_size_note": "A villa's area in the register is its plot size." if kind == "villa" else None,
                    "registered_homes": len(tx), "pools": None,
                    "sources": [f"DLD sales register (g_dld__transactions), {T['areas'][0]}, sales since {since}", "built by scripts/build_coverage_cards.py (v314) from the register by project; not matched to a building footprint"],
                    "as_of": gen}
            built[str(cid)] = card
            sales_on_cards += sum(r["units"] for r in rws)
            it = {"p": k, "n": card["name"], "d": slug, "i": cid, "dev": dev, "st": "register", "syn": 1, "x": 1, "u": len(tx), "b": {str(b_): r["median_aed"] for r in rws for b_ in [0 if r["type"] == "Studio" else int(r["type"].split()[0])]}, "fl": 2 if kind == "villa" else 12}
            items.append(it)
        json.dump({"district": slug, "generated": gen, "kind": "register-built", "buildings_by_id": built}, open(os.path.join(a.out, f"unitmix_{slug}.synthetic.json"), "w", encoding="utf-8"), ensure_ascii=False)
        items_all.extend(items)
        # coverage of the window's sales: what the old cards held (priced cards of the district) vs the new cards
        old_sales = 0
        for c in cards.values():
            if any(r.get("median_aed") for r in c.get("rows") or []): old_sales += sum(((c.get("dld_sales") or {}).get("sold_by_type") or {}).values())
        cov.append({"slug": slug, "areas": T["areas"], "register_sales_all_time": allsales, "register_home_sales_in_window": reg_window, "window_from": str(since), "cards_built": len(built),
                    "priced_rows_sales_on_new_cards": sales_on_cards, "share_of_window_sales_on_new_cards": round(sales_on_cards / reg_window, 3) if reg_window else None,
                    "sales_on_existing_priced_cards_all_time": old_sales, "projects_skipped": skipped})
        print(f"{slug:14s} register home sales (window) {reg_window:6,} | new cards {len(built):3d} holding {sales_on_cards:6,} priced sales ({(sales_on_cards/reg_window*100 if reg_window else 0):.0f}%) | skipped {len(skipped)} (on a priced card: {sum(1 for s in skipped if s['why'].startswith('already'))})")
    json.dump({"generated": gen, "note": "Brief-only Buy items (img_buy_extra). Every item has x 1 (no building page, no map position); items with syn 1 are built from the register by project (synthetic cards in img_unitmix_<d>, ids 900000+); they carry no position and the public map reads none of them.", "items": items_all},
              open(os.path.join(a.out, "buy_extra.json"), "w", encoding="utf-8"), ensure_ascii=False)
    json.dump({"items": adds}, open(os.path.join(a.out, "map_prices_add.json"), "w", encoding="utf-8"), ensure_ascii=False)
    json.dump({"generated": gen, "window_months": a.months, "areas": cov}, open(os.path.join(a.out, "coverage_cards.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    with open(os.path.join(a.out, "coverage_cards.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["slug", "mode", "register_home_sales_in_window", "cards_built", "priced_sales_on_new_cards", "share", "skipped_projects"])
        for c in cov: w.writerow([c["slug"], c.get("mode", "cards"), c.get("register_home_sales_in_window", c.get("register_sales_since")), c.get("cards_built", ""), c.get("priced_rows_sales_on_new_cards", c.get("card_sales", "")), c.get("share_of_window_sales_on_new_cards", ""), len(c.get("projects_skipped", []))])
    print("written to", a.out)


if __name__ == "__main__":
    main()
