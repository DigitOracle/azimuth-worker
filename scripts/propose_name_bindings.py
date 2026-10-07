"""v385 - PROPOSE footprint names for the blocks files (cause B of the 7 Oct 2026 card-map-position audit).  OFFLINE, READ-ONLY on production data.

Cause B = a building footprint exists, and either the identity layer already binds it to this register project (190 cards) or the footprint carries a clear name variant (84 cards),
but the blocks file does not carry the project's name, so the page's name match (pkey/locate) finds nothing and the card is a dead end.

Input  (read only): <audit>/card_ledger.csv  and  <audit>/_blocks/<district>.json   (the audit's snapshot of the live blocks files)
Output (only): <audit>/proposals/name_bindings_proposal.csv  and  name_bindings_proposal.json
This script NEVER writes a blocks file, KV, or anything under data/. Nothing is applied: a person reviews the CSV, and a later, separate step writes names.

Confidence:  high = identity-bound (reg_bindings is the DLD register, tx_bindings is derived from settled sales) AND no other card claims the same footprint.
             low  = name variant: INFERRED until a person reviews it.  review = a footprint claimed by more than one card (any basis): a person must choose.
Evidence label: REGISTER_VERIFIED (reg_bindings) | DERIVED (tx_bindings) | INFERRED (name variant).

    python scripts/propose_name_bindings.py [--audit DIR] [--out DIR]
"""
import argparse, csv, json, os, re, sys, collections

sys.stdout.reconfigure(encoding="utf-8")
AUDIT = r"C:\Dev\naj-market-pulse\docs\CARD_MAP_POSITION_AUDIT_07OCT2026"

BOUND = re.compile(r"^footprint i=(\d+) \(bound by (reg_bindings|tx_bindings) as '(.*)'; footprint carries (.*)\)$")
VARIANT = re.compile(r"^footprint i=(\d+) named '(.*)' \(all distinctive words")


def pkey(n):
    s = re.sub(r"\s+by\s+.*$", "", str(n or "").lower())
    return re.sub(r"[^a-z0-9\u0600-\u06ff]+", "", s)


def would_match(proposed, fname):
    """the page's own rule (locate): equal keys, or both >= 8 chars and one contains the other"""
    k, fk = pkey(proposed), pkey(fname)
    return bool(fk) and len(k) >= 3 and (fk == k or (min(len(fk), len(k)) >= 8 and (fk in k or k in fk)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audit", default=AUDIT)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    out = a.out or os.path.join(a.audit, "proposals")
    rows = list(csv.DictReader(open(os.path.join(a.audit, "card_ledger.csv"), encoding="utf-8-sig")))
    blocks = {}

    def feats(d):
        if d not in blocks:
            p = os.path.join(a.audit, "_blocks", d + ".json")
            try:
                fc = json.load(open(p, encoding="utf-8"))
            except Exception:
                fc = None
            blocks[d] = {} if fc is None else {str(x["properties"].get("i")): (x["properties"].get("n") or "") for x in fc.get("features", []) if (x.get("properties") or {}).get("k") == "b" and x.get("geometry")}
        return blocks[d]

    props, skipped = [], collections.Counter()
    for r in rows:
        if r["clickable"] != "no" or r["cause"] != "B":
            skipped["not cause B (A/D/E or clickable)"] += 1
            continue
        lf = r["likely_footprint"]
        m = BOUND.match(lf)
        if m:
            idx, src, bound_as, carries = m.group(1), m.group(2), m.group(3), m.group(4)
            basis = "identity-bound"
            label = "REGISTER_VERIFIED" if src == "reg_bindings" else "DERIVED"
            detail = "identity layer %s binds footprint %s as '%s'" % (src, idx, bound_as)
        else:
            m = VARIANT.match(lf)
            if not m:
                skipped["cause B with an unreadable likely_footprint"] += 1
                continue
            idx, basis, label = m.group(1), "name variant", "INFERRED"
            detail = "footprint %s is named '%s'; every distinctive word of the shorter name is in the longer" % (idx, m.group(2))
        fmap = feats(r["district"])
        exists = idx in fmap
        props.append({"district": r["district"], "district_name": r["district_name"], "card_name": r["project"], "project_no": r["project_no"],
                      "developer": r["developer"], "register_status": r["register_status"], "sales_all": r["sales_all"], "sales_l12": r["sales_l12"],
                      "footprint_index": idx, "footprint_exists_in_blocks_file": "yes" if exists else "NO",
                      "footprint_name_now": fmap.get(idx, ""), "proposed_name": r["project"],
                      "overwrites_existing_footprint_name": "yes" if fmap.get(idx, "") and not would_match(r["project"], fmap.get(idx, "")) else "no",
                      "basis": basis, "evidence_label": label, "detail": detail})
    claims = collections.defaultdict(set)
    for p in props:
        claims[(p["district"], p["footprint_index"])].add(p["card_name"].strip().lower())
    for p in props:
        n = len(claims[(p["district"], p["footprint_index"])])
        p["cards_claiming_this_footprint"] = n
        if p["footprint_exists_in_blocks_file"] == "NO":
            p["confidence"] = "review"
            p["confidence_why"] = "the footprint index is not in the blocks file snapshot"
        elif n > 1:
            p["confidence"] = "review"
            p["confidence_why"] = "%d cards claim this footprint; a person must choose" % n
        elif p["basis"] == "identity-bound":
            p["confidence"] = "high"
            p["confidence_why"] = "bound by the identity layer; one card, one footprint"
        else:
            p["confidence"] = "low"
            p["confidence_why"] = "INFERRED name variant until a person reviews it"
    props.sort(key=lambda p: ({"high": 0, "low": 1, "review": 2}[p["confidence"]], p["district"], -int(p["sales_all"] or 0)))
    os.makedirs(out, exist_ok=True)
    fields = ["district", "district_name", "card_name", "footprint_index", "footprint_name_now", "proposed_name", "basis", "confidence", "evidence_label", "confidence_why", "detail",
              "cards_claiming_this_footprint", "footprint_exists_in_blocks_file", "overwrites_existing_footprint_name", "project_no", "developer", "register_status", "sales_all", "sales_l12"]
    with open(os.path.join(out, "name_bindings_proposal.csv"), "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(props)
    by = collections.Counter((p["basis"], p["confidence"]) for p in props)
    summary = {"proposals": len(props), "by_confidence": dict(collections.Counter(p["confidence"] for p in props)),
               "by_basis": dict(collections.Counter(p["basis"] for p in props)), "by_basis_and_confidence": {"%s|%s" % k: v for k, v in by.items()},
               "by_evidence_label": dict(collections.Counter(p["evidence_label"] for p in props)),
               "sales_all_behind_proposals": sum(int(p["sales_all"] or 0) for p in props), "sales_l12_behind_proposals": sum(int(p["sales_l12"] or 0) for p in props),
               "skipped": dict(skipped), "districts": len({p["district"] for p in props})}
    json.dump({"note": "PROPOSAL ONLY. Nothing here has been written to any blocks file or KV. high = identity-bound; low = INFERRED name variant; review = footprint claimed by several cards.",
               "source": "card_ledger.csv + _blocks snapshot, " + os.path.basename(os.path.normpath(a.audit)), "summary": summary, "proposals": props},
              open(os.path.join(out, "name_bindings_proposal.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
