"""v421 - import Kendall's uncaptioned 8 Oct desk photos into the reference set.

Lists the igm_<id> keys in the azimuth-2 KV namespace whose CREATION time (KV expiration minus 14 days, the TTL
storeImage sets) falls between --start and --end (UTC ISO), then calls POST /desk_ref_import on the worker.
DRY RUN by default: the worker reports what it would import and writes nothing. Pass --apply to write.

Secrets come from the environment only and are never printed:
  CLOUDFLARE_API_TOKEN   (KV read)       READ_KEY  (the worker owner key)
Example (8 Oct 08:15-08:17 Dubai = 04:15-04:17 UTC, a minute of slack each side):
  python scripts/desk_ref_import.py --start 2026-10-08T04:14:00Z --end 2026-10-08T04:18:00Z
  python scripts/desk_ref_import.py --start 2026-10-08T04:14:00Z --end 2026-10-08T04:18:00Z --apply
"""
import argparse
import datetime as dt
import json
import os
import sys
import urllib.parse
import urllib.request

ACCOUNT = "76bc08573538d7426fce444cf7ef7645"
NAMESPACE = "2cdf36a27f834b5f9c726294d36770fb"   # [env.azimuth2] MEETINGS
ORIGIN = "https://azimuth-2.digitalchemy.workers.dev"
TTL = 14 * 86400


def iso(s):
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()


def list_igm(token, ns):
    out, cursor = [], ""
    while True:
        q = {"prefix": "igm_", "limit": "1000"}
        if cursor:
            q["cursor"] = cursor
        url = "https://api.cloudflare.com/client/v4/accounts/%s/storage/kv/namespaces/%s/keys?%s" % (ACCOUNT, ns, urllib.parse.urlencode(q))
        req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
        with urllib.request.urlopen(req, timeout=60) as r:
            j = json.load(r)
        for k in j.get("result", []):
            name = k.get("name", "")
            if name.startswith("igm_ct_") or not k.get("expiration"):
                continue
            out.append((name[4:], k["expiration"] - TTL))
        cursor = (j.get("result_info") or {}).get("cursor") or ""
        if not cursor:
            return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", required=True, help="UTC ISO, e.g. 2026-10-08T04:14:00Z")
    ap.add_argument("--end", required=True)
    ap.add_argument("--tag", default="general")
    ap.add_argument("--origin", default=ORIGIN)
    ap.add_argument("--namespace", default=NAMESPACE)
    ap.add_argument("--exclude", default="", help="comma-separated media ids to leave out (e.g. generated slides)")
    ap.add_argument("--apply", action="store_true", help="write the references (default: dry run)")
    a = ap.parse_args()
    token, key = os.environ.get("CLOUDFLARE_API_TOKEN"), os.environ.get("READ_KEY")
    if not token or not key:
        sys.exit("set CLOUDFLARE_API_TOKEN and READ_KEY in the environment")
    lo, hi = iso(a.start), iso(a.end)
    skip = set(x.strip() for x in a.exclude.split(",") if x.strip())
    rows = sorted((c, i) for i, c in list_igm(token, a.namespace) if lo <= c <= hi and i not in skip)
    print("%d igm_ keys created between %s and %s" % (len(rows), a.start, a.end))
    for c, i in rows:
        print("  %s  created ~%s" % (i, dt.datetime.fromtimestamp(c, dt.timezone.utc).strftime("%H:%M:%S UTC")))
    if not rows:
        return
    url = a.origin + "/desk_ref_import?" + urllib.parse.urlencode({"key": key, **({"apply": "1"} if a.apply else {})})
    body = json.dumps({"ids": [i for _, i in rows], "tag": a.tag}).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        res = json.load(r)
    print(json.dumps(res, indent=2))
    print("APPLIED" if a.apply else "DRY RUN - nothing written. Re-run with --apply.")


if __name__ == "__main__":
    main()
