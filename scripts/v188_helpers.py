"""The page's view() is shipped as source text, so the module-level helpers it calls (esc, fmt, aed) have to exist in the
browser too. They are defined once, beside the __name shim."""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()
old = '    "const __name=(f)=>f;" +'
new = ('    "const __name=(f)=>f;" +\n'
       '    "const esc=" + String(esc) + ",fmt=" + String(fmt) + ",aed=" + String(aed) + ";" +')
assert s.count(old) == 1, s.count(old)
io.open(P, "w", encoding="utf-8", newline="").write(s.replace(old, new))
print("helpers shipped with the page")
