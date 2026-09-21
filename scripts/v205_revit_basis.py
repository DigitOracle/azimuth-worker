"""A plate drawn from a Revit model must not be captioned "indicative" (Kendall, 21 Sep 2026: the Symphony is the template,
"we worked out the floor plans ... we worked out the floor plates").

The plate caption has three bases - the units register, the Municipality's floor count, the type register - and every one of
them ends by saying where each home sits is not published. The Symphony's plate now comes from the developer's Revit model of
that building, so it has a fourth: the flats are drawn where the model puts them, with the model's own unit numbers. Without
this the page would tell the truth backwards on the one building where the layout is real.

The fit itself (how the model's plate is set into the surveyed footprint) is in the plate file's own note, so the page states
it without carrying one building's dimensions in the worker's code.

  python scripts/v205_revit_basis.py
"""
import io, os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REVIT = ("The unit numbers, types and sizes are the developer's Revit model of this building, floor by floor, and each flat "
         "is drawn where the model puts it.")
TAIL = (" What is not claimed is which way a flat faces: the model's own labels are to project north, which is not true "
        "north here.")


def sub(s, old, new, n=1):
    assert s.count(old) == n, old[:80]
    return s.replace(old, new)


# --- the building page -----------------------------------------------------------------------------------------------------
P = os.path.join(HERE, "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

s = sub(s, """      register: "How many homes of each type this floor carries is the Land Department register's units for the type, spread evenly over the floors the register gives it." }[p.basis] || "";
    let extra = "";
    if (p.basis !== "units") extra += " No unit numbers are shown: the units register does not cover this building well enough.";""",
        """      register: "How many homes of each type this floor carries is the Land Department register's units for the type, spread evenly over the floors the register gives it.",
      revit: \"""" + REVIT + """\" }[p.basis] || "";
    const real = p.basis === "revit";
    let extra = "";
    if (!real && p.basis !== "units") extra += " No unit numbers are shown: the units register does not cover this building well enough.";""")

OLD_TAIL = ("""    return "<b>Indicative layout.</b> The outline is this building's surveyed footprint; the sizes of the homes against each other are the register's. " +
      basis + extra + " Where each home sits, and where the lifts and stairs are, is not published for this building — that comes from a Revit model or the developer's stacking plan, as on The Symphony.";""")

s = sub(s, OLD_TAIL,
        """    if (real) return "<b>The built layout.</b> " + basis + " " + esc(D.plateNote || "The outline is this building's surveyed footprint.") + extra + \"""" + TAIL + """\";
""" + OLD_TAIL)

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("building page:", len(s), "chars")

# --- the twin's own panel, which draws the same plate ------------------------------------------------------------------------
# (the v186 block is injected inside a template literal: no backticks, no dollar-brace, no backslashes)
Q = os.path.join(HERE, "scripts", "v186_floor_stack.js")
t = io.open(Q, encoding="utf-8").read()

# the plate key carries {note, building}: the note says how the model's plan was set into the footprint, so keep it on the plate
t = sub(t, """.then(j=>{STKPL=(j&&(j.building||((j.buildings||{})[String(i)])))||null;then()})""",
        """.then(j=>{STKPL=(j&&(j.building||((j.buildings||{})[String(i)])))||null;if(STKPL&&j&&j.note&&!STKPL.note)STKPL.note=j.note;then()})""")
t = sub(t, """register:"How many homes of each type this floor carries is the Land Department register's units for the type, spread evenly over the floors the register gives it."}[p.basis]||"";""",
        """register:"How many homes of each type this floor carries is the Land Department register's units for the type, spread evenly over the floors the register gives it.",revit:\"""" + REVIT + """\"}[p.basis]||"";
  if(p.basis==="revit")return h+'<div class=fbas><b>The built layout.</b> '+says+" "+stkEsc(STKPL.note||"The outline is this building's surveyed footprint.")+\"""" + TAIL + """\"+"</div>";""")
for ch in ("`", "${", "\\"):
    assert ch not in REVIT and ch not in TAIL, ch
io.open(Q, "w", encoding="utf-8", newline="").write(t)
print("twin panel:", len(t), "chars")
