"""v187: Najma's own colours on the building page, and chips that do not span the panel (Kendall, 20 Sep 2026)."""
import io, os, re

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

NEW_COL = (
    'export const BP_COL = {                     // Najma\'s own scheme, the same colours the twin\'s floors use\n'
    '  studio: "#B9A6C9", "1": "#C5A56A", "2": "#7FA8C9", "3": "#8FC7B9", "4": "#D9A441",\n'
    '  office: "#8FA39B", retail: "#D98C6A", hotel: "#C58FB0", civic: "#7FA3B8", services: "#37423F", '
    'homes: "#D9CFB8", villa: "#C9C0AC", other: "#8A8F96",\n'
    '};\n'
)
s = s[:s.index("export const BP_COL = {")] + NEW_COL + s[s.index("const CHIPS ="):]

OLD_TB = """  const tb = (val, label, col, host) => '<button class="tb" data-' + host + '="' + val + '" style="background:' + col + '">' + esc(label) + "</button>";"""
NEW_TB = """  const tb = (val, label, col, host) => '<button class="tb" data-' + host + '="' + val + '"><i style="background:' + col + '"></i>' + esc(label) + "</button>";"""
assert s.count(OLD_TB) == 1
s = s.replace(OLD_TB, NEW_TB)

CSS = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "v187_page.css"), encoding="utf-8").read()
a = s.index("const CSS = ")
b = s.index("// ---- the hero:")
s = s[:a] + "const CSS = " + chr(96) + "\n" + CSS.rstrip("\n") + "\n" + chr(96) + ";\n\n" + s[b:]
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("restyled:", len(s), "chars")
