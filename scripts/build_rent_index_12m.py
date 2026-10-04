"""v314 - the RENT index over a rolling 12-month window, built from the published lake (Ejari register) instead of the daily ~28-60 day pull.

WHY. scripts/build_rent_index.py (naj-market-pulse) reads ONE daily pull (data/rents-YYYY-MM-DD[-api].csv, ~28 days of registrations) and
keeps registrations from the last 60 days (floor = pull date - 60), so the live img_rent_index covers 2 months (1 Aug to 30 Sep 2026).
Under the Brief's "3 or more contracts" rule that leaves 21 of the audit's 410 query cells with no building that qualifies and 20 with no
figure for the home type, although the register holds 626,192 residential lettings in 12 months.

WHAT THIS DOES. Same record shape, same bedroom bands, same name key, same binding to app buildings (it IMPORTS those functions from
naj-market-pulse scripts/build_rent_index.py - nothing is copied or edited there), same de-duplication, over a rolling window of --months
(default 12) ending on --as-of. Only the source differs: pp_dld__rent_contracts in the lake, read-only, one short query.
  - The lake has no registration timestamp, so the window is on CONTRACT START DATE (the audit's own 12-month lettings convention); "last"
    is the latest start date. A contract is a (contract_id, line_number) row, counted once.
  - "New" = contract_reg_type_en New; everything else is a renewal. The Brief's figure is still the median of NEW lettings where there are
    3 or more (rentFigure), so the 12-month window changes how many contracts stand behind it, not which kind it prefers: the figure keeps
    its new-lettings emphasis. Both medians are in the record (m / mn).
  - Villas and townhouses: ROOMS from the register's own bedroom count (the lake carries it on ~99% of them; the daily pull on ~70%).
    Flats: bedrooms read from the size, exactly as the live index does (--flat-rooms register uses the register's count instead; it is a
    different basis, so the Brief's note about it would need to change - not done here).
  - Records the live index carries that this script does not build (the two Piccadilly Green option records, anything with "fp" or
    "ev_scope") are NOT in the lake; pass --live <file> (a fresh READ of KV img_rent_index) and they are merged in unchanged. The publish
    script scripts/publish_rent_index_12m.ps1 does that against a fresh live read.
  - Price drift: a 12-month window mixes older and newer rents. The index keeps the full 12 months in "n" and the NEW-lettings median in
    "mn"; the app's figure is "mn" where there are 3+ new lettings. The record also carries "w90": contracts of the last 90 days, so a reader
    can see how much of a figure is recent (not used by the app today).

Usage (PowerShell, from C:\\Dev\\_cov_v314):
  python scripts\\build_rent_index_12m.py --out <file> [--months 12] [--as-of 2026-10-03] [--live <live img_rent_index json>] [--flat-rooms size|register]
Read-only on the lake (short hold, run outside 04:00-06:00 Dubai and not while Najma_Daily_Refresh / the availability sweep is running).
It writes ONE local file. It never pushes.
"""
import argparse, collections, datetime as dt, json, os, re, sys, time
sys.path.insert(0, r"C:\Dev\naj-market-pulse\scripts")
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
import build_rent_index as B   # noqa: E402  fold/nkey/bed_band/stats/band_stats/building_lookup/load_bands/DLD_AREA - the live builder's own


def lake_rows(start, end):
    from lake import connect   # noqa: E402
    c = connect()
    try:
        cur = c.execute(f"""select contract_id, line_number, trim(area_name_en), trim(coalesce(project_name_en,'')), contract_start_date, contract_reg_type_en,
              try_cast(annual_amount as double), try_cast(actual_area as double), ejari_property_type_en, ejari_property_sub_type_en
            from pp_dld__rent_contracts
            where property_usage_en='Residential' and ejari_property_type_en in ('Flat','Villa')
              and contract_start_date between '{start}' and '{end}'""")
        return cur.fetchall()
    finally:
        c.close()


def rooms_of(sub):
    s = str(sub or "").lower()
    if s.startswith("studio"): return "0"
    m = re.match(r"(\d+)\s*bed", s)
    return m.group(1) if m else ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True); ap.add_argument("--months", type=int, default=12)
    ap.add_argument("--as-of", default=None); ap.add_argument("--live", default=None)
    ap.add_argument("--flat-rooms", choices=["size", "register"], default="size")
    a = ap.parse_args()
    day = a.as_of or dt.date.today().isoformat()
    end = dt.date.fromisoformat(day)
    start = (end - dt.timedelta(days=round(a.months * 30.4375))).isoformat()
    t0 = time.time()
    bands_meta, city_cuts, area_cuts, villa_cut = B.load_bands()
    look, anchors = B.building_lookup()
    raw = lake_rows(start, day)
    print(f"lake: {len(raw):,} residential flat/villa lettings with a start date {start}..{day} ({time.time()-t0:.1f}s)")
    rows, skipped, seen = [], collections.Counter(), set()
    r90 = (end - dt.timedelta(days=90)).isoformat()
    for cid, ln, area, proj, sd, reg, amt, sqm, ptype, sub in raw:
        kind = "apt" if ptype == "Flat" else "villa"
        if not amt or not sqm or not (5000 <= amt <= 20_000_000) or not (10 <= sqm <= 2000): skipped["amount or size out of range"] += 1; continue
        if kind == "apt" and re.search(r"room in labor|^room$|office|hotel|labor camp", str(sub or ""), re.I): skipped["not a home (room, camp, office)"] += 1; continue
        sig = (cid, ln)
        if (sig, proj) in seen: skipped["exact duplicate row"] += 1; continue
        seen.add((sig, proj))
        rooms = rooms_of(sub) if (kind == "villa" or a.flat_rooms == "register") else ""
        rows.append({"sig": sig, "area": area or "", "proj": proj, "kind": kind, "amt": amt, "sqm": sqm, "reg": sd, "new": (reg or "").strip() == "New", "rooms": rooms,
                     "band": B.bed_band(kind, rooms, sqm, area, city_cuts, area_cuts, villa_cut), "r90": sd >= r90})
    # one contract, several project names: union the names that share a contract, count each contract once (as build_rent_index.py does)
    parent = {}
    def find(x):
        while parent.setdefault(x, x) != x: parent[x] = parent[parent[x]]; x = parent[x]
        return x
    by_sig = collections.defaultdict(set)
    for r in rows:
        if r["proj"]: by_sig[r["sig"]].add((r["area"], r["proj"]))
    for names in by_sig.values():
        names = sorted(names)
        for nm in names[1:]: parent[find(nm)] = find(names[0])
    groups = collections.defaultdict(dict); members = collections.defaultdict(set)
    for r in rows:
        if not r["proj"]: continue
        root = find((r["area"], r["proj"])); groups[root].setdefault(r["sig"], r); members[root].add(r["proj"])
    area_rows = collections.defaultdict(dict)
    for r in rows: area_rows[r["area"]].setdefault(r["sig"], r)

    def with_w90(stats_by_kind, rs):          # w90: contracts of the last 90 days behind each band's figure
        for k, bands in stats_by_kind.items():
            for bd, st in bands.items():
                pool = [r for r in rs if (("v" if r["kind"] == "villa" else "b") == k and r["band"] == bd) or (k == "vr" and r["kind"] == "villa" and str(r.get("rooms") or "").isdigit() and str(min(int(r["rooms"]), 5)) == bd and int(r["rooms"]) >= 1)]
                st["w90"] = sum(1 for r in pool if r["r90"])
        return stats_by_kind

    items, bound = [], 0
    for root, sigs in groups.items():
        area = root[0]; slugs = B.DLD_AREA.get(area) or []
        names = sorted(members[root], key=lambda s: (-sum(1 for r in sigs.values() if r["proj"] == s), s))
        hits = []
        for nm in names:
            for slug in slugs:
                for i, src in look.get((slug, B.nkey(nm)), []): hits.append((nm, slug, i, src))
        hits.sort(key=lambda h: (h[3] != "anchor", names.index(h[0])))
        primary = hits[0][0] if hits else names[0]
        d = hits[0][1] if hits else (slugs[0] if slugs else None)
        iss = []
        for h in hits:
            if h[1] == d and h[2] not in iss: iss.append(h[2])
        it = {"p": B.nkey(primary) or B.norm(primary), "n": primary, "area": area, "d": d}
        others = [nm for nm in names if nm != primary]
        if others: it["a"] = others
        if iss:
            an = anchors[d].get(iss[0]) or {}
            it.update({"i": iss[0], "bind": hits[0][3]})
            if len(iss) > 1: it["is"] = iss
            if an.get("lon") is not None: it["lon"], it["lat"] = round(an["lon"], 6), round(an["lat"], 6)
            bound += 1
        rs = list(sigs.values()); it["last"] = max(r["reg"] for r in rs); it.update(with_w90(B.band_stats(rs), rs))
        items.append(it)
    items.sort(key=lambda it: (it["d"] or "~", it["area"], it["n"].lower()))
    areas = []
    for ar, s in sorted(area_rows.items()):
        rs = list(s.values())
        areas.append(dict({"area": ar, "d": (B.DLD_AREA.get(ar) or [None])[0]}, **with_w90(B.band_stats(rs), rs)))
    regs = [r["reg"] for r in rows]
    carried = []
    if a.live:                                         # merge the records the lake cannot build (option records with their own footprint or evidence scope)
        live = json.load(open(a.live, encoding="utf-8"))
        have = {it["p"] for it in items}
        for it in live.get("items", []):
            if (it.get("fp") or it.get("ev_scope")) and it["p"] not in have:
                items.append(it); carried.append(it["p"])
    out = {"generated": dt.datetime.now().isoformat(timespec="seconds"), "as_of": day, "source_file": f"lake pp_dld__rent_contracts {start}..{day}",
           "window": [min(regs), max(regs)], "window_months": a.months, "contracts": len({r["sig"] for r in rows}),
           "note": f"DLD Ejari rent contracts started in the {a.months} months to {day}: what homes in each building actually rented for, new lettings and renewals. "
                   "NOT live availability. Bedrooms are inferred from the contract's size (bands learned per DLD area from contracts that carry the type); "
                   "villas use the register's own bedroom count. The same contract filed under several project names is counted once. "
                   "Each figure is the median of NEW lettings where there are 3 or more, otherwise of all contracts; w90 is the contracts of the last 90 days.",
           "bands": {"flat_city_cuts": city_cuts, "villa_cut": villa_cut, "flat_accuracy_city": bands_meta["flat"]["city"]["accuracy"],
                     "flat_accuracy_area": bands_meta["flat"].get("accuracy_with_area_cuts"), "source": "data/dld/rent_bed_bands.json", "flat_basis": a.flat_rooms},
           "skipped": dict(skipped), "items": items, "areas": areas}
    json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    kb = os.path.getsize(a.out) // 1024
    print(f"{len(rows):,} contracts counted | buildings {len(items):,} (bound to an app building {bound:,}; carried from live: {carried or 'none'}) | areas {len(areas)} | {kb} KB | {time.time()-t0:.1f}s")
    print("skipped:", dict(skipped))


if __name__ == "__main__":
    main()
