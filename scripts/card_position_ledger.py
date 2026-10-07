"""v387 - THE LIVE CARD LEDGER: for every project card of the developer page, its place on the LADDER, and why.
Ask it at any time: "how many cards do not have a map position, and why?"  Offline and re-runnable. Read-only: it writes only its own two files.

  state            building outline  >  plot centre  >  community centre  >  none          (the page applies the same order at run time)
  building         the page's own name match (pkey / locate, ported 1:1) finds a footprint in the district blocks file
  plot centre      the card's register project number is in data/plot_positions/plot_positions.json (centre of the registered plot, DERIVED)
  community centre the card key (district|pkey(name)) is in data/community_positions/community_positions.json (middle of the card's own community, DERIVED; NOT the building)
  none             nothing above; the why column says what is missing (an unmatched community label, an ambiguous one, ...)

Sources, in order of freshness:  --live reads the LIVE index (img_devmap_index) and the LIVE blocks (img_blocks_<slug>) with read-only wrangler gets into a temp folder;
without --live it uses the 7 Oct audit's copies of both (docs/CARD_MAP_POSITION_AUDIT_07OCT2026/idx.json and _blocks/). --index and --blocks-dir point at other copies.
The plot and community files are read from this repo's data/ (what the page would be given); --plots / --community point elsewhere. A missing file means that rung is empty (v386 behaviour).
Register status comes from the Land Department project register (data/projects-2026-09-01.csv) through the card's project number or its name.

  python scripts/card_position_ledger.py [--live] [--index F] [--blocks-dir D] [--plots F] [--community F] [--out F] [--summary F] [--list none]
Prints counts by state, by district and by register status, then the reasons for 'none'. --list none|community|plot|building prints the cards in that state.
"""
import argparse, collections, csv, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _cardlib as L
import build_community_positions as B

OUT = os.path.join(L.REPO, "data", "card_position_ledger", "card_position_ledger.csv")
SUMMARY = os.path.join(L.REPO, "data", "card_position_ledger", "card_position_ledger_summary.json")
STATES = ["building", "plot centre", "community centre", "none"]


def status_group(st, has_p):
    if st:
        return st
    return "not found in register file" if not has_p else "(no status)"


def build(index=None, blocks_dir=None, plots=B.PLOTS, community=B.OUT, live=False):
    idx, idx_path = L.load_index(index, live=live)
    slugs = sorted(idx["areas"])
    blocks, missing, blocks_dir = L.load_blocks(slugs, blocks_dir, live=live)
    cards = L.enumerate_cards(idx)
    L.project_numbers_from_register(cards)
    pp = (L.J(plots) or {}).get("p", {}) if plots and os.path.exists(plots) else {}
    cp = (L.J(community) or {}).get("p", {}) if community and os.path.exists(community) else {}
    polys = B.load_polygons()
    tables = B.load_tables(polys)
    rows = []
    for key in sorted(cards):
        c = cards[key]
        slug = c["slug"]
        hit = L.locate(blocks.get(slug, []), c["name"])
        plot = [p for p in sorted(c["p"]) if p in pp]
        ck = L.card_key(slug, c["name"])
        why, state = "", "none"
        if hit:
            state, why = "building", "%d footprint%s match the name" % (len(hit), "" if len(hit) == 1 else "s")
        elif plot:
            state, why = "plot centre", "register project %s: %s" % (plot[0], pp[plot[0]].get("label", ""))
        elif ck in cp:
            state, why = "community centre", cp[ck].get("l", "")
        else:
            a, asrc = L.card_area(c)
            if not a:
                a = idx["areas"][slug]["name"]
            cn, via, _ = B.resolve(a, tables, slug=slug, reg_area=c.get("reg_area"))
            if cn is None and not L.card_area(c)[0] and tables[3].get(slug):
                cn = tables[3][slug][0]
            if cn is None:
                why = "no community polygon: " + via
            elif not os.path.exists(community or ""):
                why = "a community polygon exists (%s) but no community_positions file is loaded; run build_community_positions.py" % polys[cn]["name"]
            else:
                why = "a community polygon exists (%s) but the community file does not list this card; re-run build_community_positions.py" % polys[cn]["name"]
        rows.append({"state": state, "district": slug, "district_name": idx["areas"][slug]["name"], "project": c["name"], "card_key": ck, "project_no": ";".join(sorted(c["p"])),
                     "register_status": status_group(c.get("st", ""), bool(c["p"])), "developer": "; ".join(sorted(set(str(v) for v in c["devs"].values()))),
                     "sales_all": c["n_all"], "sales_l12": c["n_l12"], "why": why})
    S = {"index": idx_path, "index_as_of": idx.get("as_of"), "index_generated": idx.get("generated"), "blocks_dir": blocks_dir, "blocks_missing": missing,
         "plot_positions": len(pp), "community_positions": len(cp), "cards": len(rows)}
    S["by_state"] = {s: sum(1 for r in rows if r["state"] == s) for s in STATES}
    S["sales_l12_by_state"] = {s: sum(int(r["sales_l12"] or 0) for r in rows if r["state"] == s) for s in STATES}
    S["by_district"] = {d: {s: sum(1 for r in rows if r["district"] == d and r["state"] == s) for s in STATES} for d in sorted({r["district"] for r in rows})}
    S["by_register_status"] = {g: {s: sum(1 for r in rows if r["register_status"] == g and r["state"] == s) for s in STATES} for g in sorted({r["register_status"] for r in rows})}
    S["none_reasons"] = dict(collections.Counter(r["why"] for r in rows if r["state"] == "none").most_common())
    return rows, S


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--live", action="store_true")
    ap.add_argument("--index", default=None)
    ap.add_argument("--blocks-dir", default=None)
    ap.add_argument("--plots", default=B.PLOTS)
    ap.add_argument("--community", default=B.OUT)
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--summary", default=SUMMARY)
    ap.add_argument("--list", default="", choices=["", "none", "community", "plot", "building"])
    a = ap.parse_args()
    rows, S = build(a.index, a.blocks_dir, a.plots, a.community, live=a.live)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(sorted(rows, key=lambda r: (STATES.index(r["state"]), r["district"], -int(r["sales_all"] or 0))))
    with open(a.summary, "w", encoding="utf-8", newline="\n") as f:
        json.dump(S, f, indent=1, sort_keys=True, ensure_ascii=False)
    print("index %s (as of %s, generated %s); %d cards; plot centres in file %d; community centres in file %d" % (S["index"], S["index_as_of"], S["index_generated"], S["cards"], S["plot_positions"], S["community_positions"]))
    print("\nBY STATE (cards, last-12-month sales behind them)")
    for s in STATES:
        print("  %-18s %5d  (%5.1f%%)  %8d sales" % (s, S["by_state"][s], 100.0 * S["by_state"][s] / max(1, S["cards"]), S["sales_l12_by_state"][s]))
    print("\nBY DISTRICT (building / plot centre / community centre / none)")
    for d, v in sorted(S["by_district"].items(), key=lambda kv: -kv[1]["none"] - kv[1]["community centre"]):
        print("  %-26s %4d %4d %4d %4d" % (d, v["building"], v["plot centre"], v["community centre"], v["none"]))
    print("\nBY REGISTER STATUS (building / plot centre / community centre / none)")
    for g, v in sorted(S["by_register_status"].items(), key=lambda kv: -sum(kv[1].values())):
        print("  %-28s %4d %4d %4d %4d" % (g, v["building"], v["plot centre"], v["community centre"], v["none"]))
    print("\nWHY 'none'")
    for k, v in S["none_reasons"].items():
        print("  %4d  %s" % (v, k))
    if a.list:
        want = {"none": "none", "community": "community centre", "plot": "plot centre", "building": "building"}[a.list]
        print("\nCARDS IN STATE '%s'" % want)
        for r in rows:
            if r["state"] == want:
                print("  %-26s %-50s %s" % (r["district"], r["project"][:50], r["why"][:90]))
    print("\nwrote " + a.out + "\n      " + a.summary)


if __name__ == "__main__":
    main()
