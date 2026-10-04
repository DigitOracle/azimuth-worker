"""v325 - the REGISTER'S developer for every building name in every app district, so the index builder can put the register first.
  python scripts\\build_register_projdev.py --register <area_register.json> --out <regdev.json>
Read-only on the lake (two short queries) and the developers register CSV. Writes ONE local file: {slug: {nameKey: {c, d, p, s, lo}}}
  c  canonical developer id (src/devcross.js rules)      d  the register's English company name      p  project_number      s  share of the name's sales that sit on that project_number
  lo true when the register names a Nakheel entity (land owner of record)
Used by: node scripts/build_devmap_index.mjs ... --regdev <regdev.json>
"""
import argparse, json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, r"C:\Dev\naj-market-pulse\scripts")
import devattr_register as R
from lake import connect

ap = argparse.ArgumentParser(); ap.add_argument("--register", required=True); ap.add_argument("--out", required=True); a = ap.parse_args()
areas_of = {k: v.get("areas") or [] for k, v in json.load(open(a.register, encoding="utf-8")).items()}
con = connect()
M = R.regdev_map(con, areas_of)
json.dump(M, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("districts", len(M), "names with a register developer", sum(len(v) for v in M.values()))
