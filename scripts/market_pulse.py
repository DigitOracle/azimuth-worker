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
PROJECT_INDEX = []   # v37.1 — filled by collect_meed, shipped as a second ingest
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


class SourceRejected(Exception):
    """A source failed its sanity gate. It is quarantined, never averaged in."""


def sanity_gate(source, rows, *, row_shape, min_rows, max_rows, sample=None):
    """Fail CLOSED. Return only rows matching row_shape; raise SourceRejected if the source
    as a whole looks poisoned, collapsed, or exploded.

    row_shape(r) -> bool   : True only for a row of the expected shape (allow-list).
    min_rows / max_rows    : volume canary bounds on the CLEAN count.
    sample(clean) -> None  : optional range canary; raise SourceRejected on out-of-band values.

    The DLD price-index feed (HACK_TEST / 777.77 / test-pentest / {"$ne":null}) is the worked
    example this exists for: those rows fail row_shape and are dropped; if too few survive,
    the whole source is rejected rather than shipping a garbage figure.
    """
    if not isinstance(rows, list):
        raise SourceRejected(f"{source}: payload is not a list ({type(rows).__name__})")
    total = len(rows)
    clean = [r for r in rows if row_shape(r)]
    dropped = total - len(clean)
    if dropped:
        print(f"  gate[{source}]: dropped {dropped}/{total} rows failing shape allow-list")
    if len(clean) < min_rows:
        raise SourceRejected(f"{source}: only {len(clean)} clean rows (< {min_rows}) — quarantined")
    if len(clean) > max_rows:
        raise SourceRejected(f"{source}: {len(clean)} clean rows (> {max_rows}) — quarantined")
    if sample:
        sample(clean)  # raises SourceRejected on out-of-band headline values
    return clean


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

    # ---- source sanity gate: shape allow-list + volume canary (fails closed) ----
    STAGES = {"complete", "construction", "cancelled", "design", "on-hold", "awarded",
              "bid-evaluation", "study", "bid", "prequalification", "unknown"}
    def meed_shape(r):
        return (isinstance(r.get("projectId"), (str, int))
                and (r.get("stage") or "unknown") in STAGES
                and (r.get("netValueUsdM") is None or (isinstance(r.get("netValueUsdM"), (int, float)) and 0 <= r["netValueUsdM"] < 200000)))
    def meed_range(clean):
        biggest = max((r.get("netValueUsdM") or 0) for r in clean)
        if biggest > 100000:   # no single GCC project is > $100bn; a value this big = a poisoned row that passed shape
            raise SourceRejected(f"MEED: implausible max netValueUsdM {biggest}")
    rows = sanity_gate("MEED/register", rows, row_shape=meed_shape,
                       min_rows=8000, max_rows=40000, sample=meed_range)

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

    # v37.1 — compact name index of every LIVE project (news cross-referencing in the
    # Worker: headline -> project -> stage/value facts). Complete/cancelled excluded.
    global PROJECT_INDEX
    PROJECT_INDEX = [
        {"t": (r.get("title") or "")[:90], "s": r.get("stage"), "v": r.get("netValueUsdM")}
        for r in rows if r.get("stage") not in ("complete", "cancelled") and r.get("title")
    ]

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


# Every source is registered here. A source that fails its gate is quarantined —
# excluded from the shipped payload, recorded with its reason — never averaged in.
SOURCES = {
    "meed": collect_meed,
    # "dld": collect_dld,      # <- lands when DLD access is granted; MUST ship with its own sanity_gate
}


def main():
    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "collector": "market_pulse.py v1",
    }
    quarantine = {}
    for name, fn in SOURCES.items():
        try:
            out[name] = fn()
        except SourceRejected as e:
            quarantine[name] = str(e)
            print(f"QUARANTINED {name}: {e}")
    if quarantine:
        out["quarantine"] = quarantine
    if "meed" not in out:
        sys.exit("FATAL: the primary source (MEED) was quarantined — refusing to ship an empty pulse")
    blob = json.dumps(out, separators=(",", ":"))
    print(f"aggregate: {len(blob)} bytes | {out['meed']['countryRows']} {COUNTRY} rows walked")

    if os.environ.get("MP_DRY_RUN") == "1":
        with open("market_pulse_out.json", "w", encoding="utf-8") as f:
            f.write(json.dumps(out, indent=1))
        print("DRY RUN -> market_pulse_out.json")
        return

    def post_ingest(payload):
        req = urllib.request.Request(
            os.environ["AZIMUTH_URL"].rstrip("/") + "/ingest_market",
            data=json.dumps(payload, separators=(",", ":")).encode(),
            headers={"X-Azimuth-Ingest": os.environ["INGEST_TOKEN"],
                     "Content-Type": "application/json",
                     # Cloudflare's edge 403s the default Python-urllib UA before the
                     # Worker ever runs — proven 25 Aug (curl 400s, urllib 403s, same token)
                     "User-Agent": "najma-market-pulse/1.0"},
            method="POST")
        with urllib.request.urlopen(req, timeout=120) as r:
            print("ingest:", r.status, r.read().decode()[:200])

    post_ingest(out)
    # v37.1 — ship the live-project name index (news cross-referencing in the Worker)
    if PROJECT_INDEX:
        post_ingest({"generatedAt": out["generatedAt"], "projectIndex": PROJECT_INDEX})
        print(f"index: {len(PROJECT_INDEX)} live projects shipped")
    # v37.2 — ship a Google News batch (Google 503s Cloudflare IPs; this machine can reach it)
    try:
        items = collect_google_news()
        if items:
            post_ingest({"generatedAt": out["generatedAt"], "newsItems": items})
            print(f"news: {len(items)} Google News items shipped")
    except Exception as e:
        print(f"news: skipped ({e})")


def collect_google_news():
    """Headline/outlet/link/date only — reading public RSS, nothing scraped."""
    import re
    url = ("https://news.google.com/rss/search?q=dubai%20real%20estate%20OR%20"
           "property%20developer&hl=en-AE&gl=AE&ceid=AE:en")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        xml = r.read().decode("utf-8", "replace")
    out = []
    for it in xml.split("<item>")[1:40]:
        ti = re.search(r"<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", it, re.S)
        src = re.search(r"<source[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</source>", it, re.S)
        lnk = re.search(r"<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</link>", it, re.S)
        pd = re.search(r"<pubDate>(.*?)</pubDate>", it, re.S)
        title = (ti.group(1) if ti else "").replace("&amp;", "&").replace("&#39;", "'").replace("&quot;", '"').strip()
        if not title:
            continue
        out.append({"title": title[:160], "outlet": (src.group(1) if src else "").strip()[:40],
                    "link": (lnk.group(1) if lnk else "").strip()[:300], "at": (pd.group(1) if pd else "")})
    return out[:30]


if __name__ == "__main__":
    main()
