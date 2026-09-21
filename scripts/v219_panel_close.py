"""The top-right panels get a close control, and on a phone they get out of the way (Kendall, 22 Sep 2026: "there is a problem
with overlap here, especially on the mobile, for the homes i need to be able to x out").

HOMES, RESIDENTS and COLOUR BY open into tall panels pinned to the top right. Open, they sit over the building and
sub-community panel - on a phone they bury it. The only way to close one was to notice the small caret in its header and tap
the header again, which is not a close control and does not read as one.

Two changes:
  * every panel in the stack gets an X, shown only while it is open, tappable at 28 px;
  * on a phone, opening the detail panel collapses whatever is open in the stack. Two panels competing for one screen is the
    overlap he is describing, and the one he just asked for should win.

Nothing is removed: the header still toggles, and on a desktop the stack behaves as before except for the X.

  python scripts/v219_panel_close.py
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "index.js")
s = io.open(P, encoding="utf-8").read()

OLD = ("""  + '  hh.onclick=function(){var open=!hp.classList.contains("on");if(open)window.__stackOpen(hp);hp.classList.toggle("on",open);if(open&&!HB.on){HB.on=true;drawHomes()}};'""")
NEW = OLD + """
  // v219 - an X on every panel in the stack, and on a phone the stack yields to the detail panel
  + '  document.querySelectorAll(".hstack .hp").forEach(function(p){var h=p.querySelector(".hh");if(!h||h.querySelector(".hx"))return;'
  + '    var x=document.createElement("u");x.className="hx";x.textContent="\u2715";x.title="close";'
  + '    x.onclick=function(ev){ev.stopPropagation();p.classList.remove("on")};h.appendChild(x)});'
  + '  var dp=document.getElementById("panel");'
  + '  if(dp&&window.MutationObserver)new MutationObserver(function(){if(innerWidth<=640&&dp.classList.contains("on"))'
  + '    document.querySelectorAll(".hstack .hp.on").forEach(function(q){q.classList.remove("on")})}).observe(dp,{attributes:true,attributeFilter:["class"]});'"""
assert s.count(OLD) == 1
s = s.replace(OLD, NEW)

OLD2 = """  + '.hbody{display:none;padding:2px 12px 10px;border-top:1px solid var(--line)}.hp.on .hbody{display:block}'"""
NEW2 = OLD2 + """
  + '.hx{display:none}.hp.on .hx{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;margin:-6px -6px -6px 6px;'
  + '  border-radius:8px;color:var(--mut);font-style:normal;font-size:.9rem;cursor:pointer;flex:none}'
  + '.hp.on .hx:hover{color:var(--gold);background:rgba(197,165,106,.14)}'"""
assert s.count(OLD2) == 1
s = s.replace(OLD2, NEW2)

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("close control added:", len(s), "chars")
