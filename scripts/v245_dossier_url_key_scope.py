"""The About card has been dead on every building that HAS a dossier, since v220.

Kendall, on /building/dubaimarina/444: "the about the building button is dead. So we need that fixed in order to run
this video." The question-bank session clicked it in a real browser and caught the error off `pageerror`:

    ReferenceError: K is not defined

dossierUrl reads `const k = share ? (D.shareKey || "") : K;`. **K is a SERVER constant** - `const K =
encodeURIComponent(key || "")` in buildingPageHtml - and that line lives inside the CLIENT script, which is handed its
key as a parameter named KEY: `view(THREE, GLTFLoader, OrbitControls, RoomEnvironment, MeshoptDecoder, D, KEY, COL)`.
The client has KEY. It has never had K. One letter, in the one scope where it resolves to nothing.

WHY IT SURVIVED SINCE v220, and why every check we own passed it:
  * It throws on CLICK, not on load. The page loads clean, the script runs to completion, the handler is wired.
  * It only fires when D.dossier EXISTS, because dossierBlock() is the only caller. A building with no dossier never
    reaches the line, and until today almost no building had one - my own batch gave Marina Pinnacle its first this
    morning, which is what exposed it.
  * node --check passes: a bare identifier is valid syntax.
  * The suites pass: they execute buildingData and buildingPageHtml, which BUILD the page.
  * An execute-on-load harness passes: it proves the script runs, and this throw is not at load.
  * A string search of the page finds "dossierUrl" and "K" happily, because the client source is IN the page.

So five separate checks, each sound, none of which could see it. The only thing that found it was a person clicking the
button in a browser and reading the error - which is the third time today that executing the real thing beat inspecting
it, after the inert tap and the truncated GLB.

The fix is one identifier. The lesson is that the client script is a different scope that merely looks like the same
file, and nothing in our tooling enforces that boundary.

  python scripts/v245_dossier_url_key_scope.py
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

OLD = """    const k = share ? (D.shareKey || "") : K;"""
NEW = """    // KEY, not K: this runs in the browser, where the key arrives as view()'s KEY parameter. K is the server's own
    // constant in buildingPageHtml and does not exist here - it threw ReferenceError on every click, for every
    // building that had a dossier, from v220 until 22 Sep 2026.
    const k = share ? (D.shareKey || "") : KEY;"""
if NEW in s:
    print("already applied")
    raise SystemExit(0)
assert s.count(OLD) == 1, s.count(OLD)
s = s.replace(OLD, NEW)
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("dossierUrl uses the client's KEY:", len(s), "chars")
