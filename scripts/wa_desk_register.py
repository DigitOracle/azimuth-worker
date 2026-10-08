"""v409 - owner-only: check (and with --register, register) the desk WhatsApp number via the worker.
Reads READ_KEY from C:\\Dev\\azimuth-listener-naj\\.env. Never prints the key or any PIN.
  python scripts\\wa_desk_register.py              # status + next step
  python scripts\\wa_desk_register.py --register   # POST register (refused by the worker if already CONNECTED)
  python scripts\\wa_desk_register.py --register --pin 123456   # only when Meta says a PIN already exists (133005)
"""
import argparse, json, sys, urllib.request, urllib.error, urllib.parse

BASE = "https://azimuth-2.digitalchemy.workers.dev"
ENV = r"C:\Dev\azimuth-listener-naj\.env"


def read_key():
    for line in open(ENV, encoding="utf-8"):
        if line.startswith("READ_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("READ_KEY not found in " + ENV)


def call(method, path, params):
    url = BASE + path + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, method=method, data=b"" if method == "POST" else None, headers={"User-Agent": "wa-desk-register/1"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def show(code, body):
    try:
        j = json.loads(body)
    except Exception:
        print("HTTP", code, body[:200]); return
    for k in ("display_phone_number", "verified_name", "name_status", "status", "quality_rating", "code_verification_status", "platform_type", "registered", "refused", "why", "error", "note"):
        if k in j and j[k] is not None:
            print(f"{k}: {j[k]}")
    st = j.get("status")
    if isinstance(st, dict):
        for k, v in st.items():
            if k != "ok":
                print(f"  {k}: {v}")
    if j.get("next_step"):
        print("NEXT:", j["next_step"])
    print("HTTP", code)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--register", action="store_true")
    ap.add_argument("--pin", default="")
    a = ap.parse_args()
    params = {"key": read_key()}
    if a.register:
        if a.pin:
            params["pin"] = a.pin
        show(*call("POST", "/wa_desk_register", params))
    else:
        show(*call("GET", "/wa_desk_status", params))


if __name__ == "__main__":
    main()
