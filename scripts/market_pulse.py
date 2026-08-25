#!/usr/bin/env python3
"""Market Pulse collector — v1, MEED-only.

Pulls the GCC construction corpus from Digital Abbot Cloud, reduces it to a small
aggregate JSON (~10 KB), and pushes it into the azimuth-2 Worker's KV via the
token-protected /ingest_market route. The Worker never sees raw rows.

DLD (transactions/rents) is a second collect_* function to be added once Kendall's
DLD/data.dubai access lands — same output envelope, extra keys.

Env (all required unless noted):
  DAC_KEY        Digital Abbot Cloud key (unlimited tier)
  AZIMUTH_URL    e.g. https://azimuth-2.<subdomain>.workers.dev  (no trailing slash)
  INGEST_TOKEN   the azimuth-2 INGEST_TOKEN secret
  MP_COUNTRY     optional, default "UAE"
  MP_DRY_RUN     optional; "1" = write market_pulse_out.json locally, do not POST

Run locally:  DAC_KEY=... MP_DRY_RUN=1 python scripts/market_pulse.py
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timezone, timedelta

BASE = "https://www.digitalabbot.io/api/cloud/v1"
COUNTRY = os.environ.get("MP_COUNTRY", "UAE")
RECENT_DAYS = 7
TOP_N = 10
BIG_VALUE_USDM = 50  # "recently updated AND worth talking about" floor


def api(path, params=None):
    """GET one Digital Abbot Cloud endpoint. Honours Retry-After on 429; other 4xx are fatal."""
    qs = ""
    if params:
        qs = "?" + "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in params.items())
    url = BASE + path + qs
    for attempt in range(4):
        req = urllib.request.Request(url, headers={"x-dac-key": os.environ["DAC_KEY"]})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = int(e.headers.get("Retry-After", "5") or 5)
                time.sleep(min(wait, 60))
                continue
            if 500 <= e.code < 600:
                time.sleep(5)
                continue
            body = e.read().decode("utf-8", "replace")[:300]
            sys.exit(f"FATAL {e.code} on {path}: {body}")
    sys.exit(f"FATAL: retries exhausted on {path}")


def collect_meed():
    status = api("/meed/status")["data"]
    stats = api("/meed/stats")["data"]

    # ---- schema canary: fail LOUDLY rather than write bad aggregates ----
    corpus = status.get("corpus", {})
    assert corpus.get("projects", 0) > 10000, f"canary: corpus too small: {corpus}"
    assert any(c.get("key") == COUNTRY for c in stats.get("byCountry", [])), \
        f"canary: {COUNTRY} missing from byCountry"

    # ---- full country register walk (cursor-paged; unlimited internal key) ----
    rows, after, pages = [], "", 0
    while True:
        params = {"country": COUNTRY, "limit": 200}
        if after:
            params["after"] = after
        page = api("/meed/projects", params)
        rows.extend(page.get("data", []))
        pages += 1
        pg = page.get("page", {})
        if not pg.get("hasMore") or pages > 200:  # 200-page hard stop = 40k rows
            break
        after = pg.get("nextCursor", "")

    # per-country stage split (global stats can't provide the country x stage cross)
    by_stage = {}
    for r in rows:
        s = r.get("stage") or "unknown"
        b = by_stage.setdefault(s, {"count": 0, "valueUsdM": 0})
        b["count"] += 1
        b["valueUsdM"] += r.get("netValueUsdM") or 0

    cutoff = (datetime.now(timezone.utc) - timedelta(days=RECENT_DAYS)).strftime("%Y-%m-%d")
    recent = [r for r in rows
              if (r.get("lastUpdated") or "") >= cutoff and (r.get("netValueUsdM") or 0) >= BIG_VALUE_USDM]
    recent.sort(key=lambda r: r.get("netValueUsdM") or 0, reverse=True)

    active = [r for r in rows if r.get("stage") == "construction"]
    active.sort(key=lambda r: r.get("netValueUsdM") or 0, reverse=True)

    def slim(r):
        return {"id": r.get("projectId"), "title": (r.get("title") or "")[:90],
                "stage": r.get("stageLabel") or r.get("stage"),
                "valueUsdM": r.get("netValueUsdM"), "updated": r.get("lastUpdated")}

    return {
        "source": "Digital Abbot Cloud — stored MEED Projects corpus (GlobalData)",
        "corpusVersion": corpus.get("version"),
        "corpusSyncedAt": corpus.get("lastSyncAt"),
        "country": COUNTRY,
        "countryRows": len(rows),
        "byStage": sorted(
            [{"stage": k, **v} for k, v in by_stage.items()],
            key=lambda x: x["valueUsdM"], reverse=True),
        "recentBigUpdates": [slim(r) for r in recent[:TOP_N]],
        "largestUnderConstruction": [slim(r) for r in active[:TOP_N]],
        "gcc": {
            "totals": stats.get("totals"),
            "byCountry": stats.get("byCountry"),
            "byValueBand": stats.get("byValueBand"),
        },
    }


def main():
    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "collector": "market_pulse.py v1 (MEED-only)",
        "meed": collect_meed(),
        # "dld": collect_dld(),   # <- lands when DLD access is granted
    }
    blob = json.dumps(out, separators=(",", ":"))
    print(f"aggregate: {len(blob)} bytes | {out['meed']['countryRows']} {COUNTRY} rows walked")

    if os.environ.get("MP_DRY_RUN") == "1":
        with open("market_pulse_out.json", "w", encoding="utf-8") as f:
            f.write(json.dumps(out, indent=1))
        print("DRY RUN -> market_pulse_out.json")
        return

    req = urllib.request.Request(
        os.environ["AZIMUTH_URL"].rstrip("/") + "/ingest_market",
        data=blob.encode(),
        headers={"X-Azimuth-Ingest": os.environ["INGEST_TOKEN"],
                 "Content-Type": "application/json"},
        method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        print("ingest:", r.status, r.read().decode()[:200])


if __name__ == "__main__":
    main()
