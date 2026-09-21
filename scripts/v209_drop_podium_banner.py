"""The podium banner goes from the twin's panel too (Kendall, 21 Sep 2026: "get rid of this").

The building page lost it in v204. The twin's own panel kept its copy, which is what he is still looking at: a paragraph at the
top of the panel, on every one of the 25 buildings whose footprint is shorter than the register's building, explaining a
modelling decision before showing him anything he asked for.

Nothing true is lost. The plate's own caption still says it where it is relevant and where there is room to say it properly -
"the footprint (dashed) is far larger than the floor the register describes, so it is read as a podium" - and that sentence sits
next to the drawing it is about, rather than in front of everything.

  python scripts/v209_drop_podium_banner.py && python scripts/v186_apply.py
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "v186_floor_stack.js")
s = io.open(P, encoding="utf-8").read()

OLD = """  const unfit=r.fits===false?'<div class=fwarn>The floors are not drawn on the tower here: this footprint stands far lower in the model than the register building, so it is the podium of the scheme, or it carries a podium height. The layout below is the register and stands on its own.</div>':"";
"""
assert s.count(OLD) == 1
s = s.replace(OLD, """  const unfit="";   // v209 - the podium paragraph is gone: the plate's caption says it where it belongs, beside the drawing
""")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("podium banner out of the twin panel:", len(s), "chars")
