"""v411 - prove that a rebuild changes NO register-verified record. Offline.
  python scripts/compare_investor_facts.py <baseline-folder> <new-folder> [--report out.json]
Every record of the baseline folder (the facts as built before the change) is looked up in the new folder by project id and compared byte for byte (the same compact JSON the builder writes).
The only records allowed to differ are the ones this release is meant to change: those that are NOT on the project register (project.off_register true). A record on the register that differs,
or that is missing, is a failure (exit 1). Records that exist only in the new folder must all be off-register. The index entries of the baseline must be unchanged.
"""
import glob, json, os, sys


def load(folder):
    recs, shard_of = {}, {}
    for p in sorted(glob.glob(os.path.join(folder, "investor_tiers_facts_*.json"))):
        d = json.load(open(p, encoding="utf-8"))["projects"]
        for k, v in d.items():
            recs[k] = json.dumps(v, ensure_ascii=False, separators=(",", ":"), sort_keys=False, default=str)
            shard_of[k] = os.path.basename(p)
    idx = json.load(open(os.path.join(folder, "index.json"), encoding="utf-8"))
    return recs, shard_of, idx


def main():
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    if len(args) != 2:
        print(__doc__)
        return 2
    base, new = load(args[0]), load(args[1])
    bad, same, changed_off, added = [], 0, [], []
    for k, v in base[0].items():
        off_before = bool(json.loads(v)["project"].get("off_register"))
        if k not in new[0]:
            bad.append(k + ": missing from the new folder")
        elif new[0][k] == v:
            same += 1
        elif off_before:
            changed_off.append(k)
        else:
            bad.append(k + ": a register-verified record changed")
        if k in new[0] and base[1][k] != new[1][k]:
            bad.append(k + ": moved to another shard")
    for k, v in new[0].items():
        if k not in base[0]:
            if not json.loads(v)["project"].get("off_register"):
                bad.append(k + ": a new record that is on the register")
            added.append(k)
    bidx = {x["id"]: x for x in base[2]["projects"]}
    nidx = {x["id"]: x for x in new[2]["projects"]}
    for k, x in bidx.items():
        if k not in changed_off and nidx.get(k) != x:
            bad.append(k + ": index entry changed")
    rep = {"baseline_records": len(base[0]), "byte_identical": same, "changed_off_register": changed_off, "added_off_register": len(added), "violations": bad[:50], "violation_count": len(bad)}
    if "--report" in sys.argv:
        json.dump(rep, open(sys.argv[sys.argv.index("--report") + 1], "w", encoding="utf-8"), indent=1)
    print(json.dumps({k: (v if k != "added_off_register" else v) for k, v in rep.items()}, indent=1))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
