#!/bin/bash
# v325 - rebuild the Developers-by-area index LOCALLY from saved inputs (no KV write, no push), trace it, audit it and run the guard. Used for the before/after numbers.
#   bash scripts/run_attr_local.sh <input dir> <output dir>      (input dir: districts_geo_all.json map_prices.json rent_index.json ejari_projects_index.json area_register.json um/ ; needs cov_cards + shares.json beside it)
set -e
cd "$(dirname "$0")/.."
W="$1"; O="$2"; S="$(dirname "$W")"
SL=majan,madinatalmataar,jabalalifirst,alkhairanfirst,alhebiahfifth,dubaiinvestmentparkfirst,dubaiinvestmentparksecond,alyelayiss1,alyelayiss2,alyufrah1,wadialsafa4,wadialsafa5,palmdeira
export PYTHONIOENCODING=utf-8
python scripts/build_register_projdev.py --register "$W/area_register.json" --out "$O/regdev.json"
node scripts/build_devmap_index.mjs --um "$W/um" --prices "$W/map_prices.json" --rent "$W/rent_index.json" --geo "$W/districts_geo_all.json" --shares "$S/shares.json" --register "$W/area_register.json" --offplan "$S/cov_cards" --offplan-slugs $SL --ejari "$W/ejari_projects_index.json" --regdev "$O/regdev.json" --projdev-out "$O/projdev_new.json" --out "$O/index_first.json"
python scripts/build_area_evidence.py --geo "$W/districts_geo_all.json" --projdev "$O/projdev_new.json" --out "$O/area_evidence_new.json" | head -2
node scripts/trace_devmap_attribution.mjs "$W" "$S/cov_cards" "$S/shares.json" "$O/trace_new.json" --regdev "$O/regdev.json" --evidence "$O/area_evidence_new.json" --index-out "$O/index_new.json"
python scripts/audit_devmap_attribution.py --trace "$O/trace_new.json" --register "$W/area_register.json" --projdev "$O/projdev_new.json" --geo "$W/districts_geo_all.json" --out "$O/new" | tail -2
python scripts/guard_devmap_attribution.py --index "$O/index_new.json" --register "$W/area_register.json" --out "$O/guard_new.json" | tail -4 || true
