"""view() ships as source text, so it cannot borrow the module's helpers: the bundler renames them (fmt -> fmt2) and the
browser then has nothing by that name. The page function defines its own, which travel with it whatever the bundler calls them."""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

# 1. drop the by-name shim
old = '    "const esc=" + String(esc) + ",fmt=" + String(fmt) + ",aed=" + String(aed) + ";" +\n'
assert s.count(old) == 1
s = s.replace(old, "")

# 2. give view() its own
anchor = "  const el = document.getElementById(\"stage\"), msg = document.getElementById(\"msg\"), $ = (id) => document.getElementById(id);"
assert s.count(anchor) == 1
locals_js = (
    "  // its own, because this function is shipped as text: the module's helpers are renamed by the bundler and are not here\n"
    "  const esc = (v) => String(v == null ? \"\" : v).replace(/[&<>\"]/g, (c) => ({ \"&\": \"&amp;\", \"<\": \"&lt;\", \">\": \"&gt;\", '\"': \"&quot;\" }[c]));\n"
    "  const fmt = (v) => (v == null ? \"\" : Math.round(v).toLocaleString(\"en-US\"));\n"
    "  const aed = (v) => (v == null ? \"\\u2014\" : v >= 1e6 ? \"AED \" + (v / 1e6).toFixed(2) + \"M\" : \"AED \" + fmt(v));\n"
)
s = s.replace(anchor, anchor + "\n" + locals_js)
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("view() carries its own helpers now")
