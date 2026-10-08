"""v414 - store the KORE launch brochure pages that are developer renders WITHOUT people, downscaled (long edge 1600 px, JPEG quality 80), under data/developer_claims/kore/.
Excluded on purpose: 'WhatsApp Image 2026-10-06 at 12.04.38 PM.jpeg' (pool, swimmers) and every page with people. Local files only: nothing is written to KV by this script.
  python scripts/store_kore_renders.py [--src <folder>]
"""
import argparse, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "data", "developer_claims", "kore")
MAP = [("WhatsApp Image 2026-10-06 at 12.04.36 PM.jpeg", "render_1_elevation.jpg"),
       ("WhatsApp Image 2026-10-06 at 12.04.39 PM.jpeg", "render_2_aerial.jpg"),
       ("WhatsApp Image 2026-10-06 at 12.04.38 PM (2).jpeg", "render_3_interior.jpg")]
# NOT stored: 12.04.38 PM (3).jpeg (its living-room render shows a woman on the wall screen: a person) and 12.04.38 PM.jpeg (pool, swimmers).


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=r"C:\Users\kwils\Downloads")
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    for s, o in MAP:
        im = Image.open(os.path.join(a.src, s)).convert("RGB")
        w, h = im.size
        k = 1600.0 / max(w, h)
        if k < 1:
            im = im.resize((round(w * k), round(h * k)), Image.LANCZOS)
        p = os.path.join(OUT, o)
        im.save(p, "JPEG", quality=80, optimize=True)
        print(o, im.size, os.path.getsize(p))


if __name__ == "__main__":
    sys.exit(main())
