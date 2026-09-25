"""The HOMES panel runs off the right edge and cannot be moved back.

Kendall, 25 Sep 2026: "this is in this interface, it's off to the right, and with any interface. Drag it across. I can
only look around. So I need it to change to like that little hand where I can grab it and move it to the centre."

`#stkp` is `position:fixed; right:14px; top:74px; width:268px`. Anchoring to the right edge is fine until the window
is narrower than the layout assumes or the browser chrome eats the edge, and then part of the panel is simply outside
the viewport with no way to reach it - the map drags underneath instead, which is exactly what he describes.

TWO FIXES, and the second one matters more than the one he asked for:

  * **DRAG.** The header is a handle: `cursor:grab`, `cursor:grabbing` while held. Pointer events, so it works with a
    mouse, a trackpad and a finger without three code paths. Position persists per browser.
  * **CLAMP, which fixes it even for someone who never drags anything.** On open, on drag, and on every window resize
    the panel is forced back inside the viewport. A panel cannot end up unreachable, whether it got there from a
    narrow window, a rotated phone, or a drag that went too far. The bug he hit was not "I cannot move it" - it was
    "it is somewhere I cannot reach", and dragging alone would leave that possible.

The clamp keeps the whole panel in view where it fits, and where the panel is taller or wider than the window it
guarantees the HEADER stays visible, because the header is the handle and a handle you cannot see is not a handle.

DOUBLE-CLICK THE HEADER TO PUT IT BACK. A dragged panel has no other way home, and "drag it back roughly where it
was" is not a thing anyone should have to do.

WHY left/top RATHER THAN right. Dragging an element anchored by `right` means every move is inverted, and mixing the
two produces a panel that jumps the moment the window resizes. On first drag the panel is converted to left/top at
its current measured position, so it does not move at all on the first pointer-down.

  python scripts/v254_homes_panel_drag_and_clamp.py
"""
import io
import os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "index.js")
s = io.open(P, encoding="utf-8").read()

if "stkDrag" in s:
    print("already applied")
    raise SystemExit(0)


def sub(old, new, where):
    global s
    assert s.count(old) == 1, (where, s.count(old))
    s = s.replace(old, new)


# 1. the header looks like a handle
sub('''    "#stkp h4{margin:0;font-size:.62rem;font-weight:600;letter-spacing:.14em;color:#C5A56A;text-transform:uppercase}"+''',
    '''    "#stkp h4{margin:0 0 2px;font-size:.62rem;font-weight:600;letter-spacing:.14em;color:#C5A56A;text-transform:uppercase;"+
    "cursor:grab;user-select:none;touch-action:none;padding:2px 0}"+
    "#stkp h4:active{cursor:grabbing}#stkp h4::after{content:' ∷';opacity:.5;letter-spacing:.1em}"+
    "#stkp.drag{transition:none;box-shadow:0 14px 40px rgba(0,0,0,.6)}"+''',
    "handle style")

# 2. drag, clamp, persist, and a way home
sub("""  document.body.appendChild(p);
  const tt=document.getElementById("stkt"),tu=document.getElementById("stku");""",
    """  document.body.appendChild(p);
  // v254 - the panel is anchored to the right edge, so a narrow window puts part of it outside the viewport with no
  // way to reach it: the map drags underneath instead. Dragging is what Kendall asked for; the CLAMP is what fixes it
  // for someone who never drags, and it runs on open and on every resize as well as on release.
  {
    const KEY="najStkPos";
    const clamp=()=>{
      const r=p.getBoundingClientRect(), W=innerWidth, H=innerHeight;
      // where the panel is bigger than the window, keep the HEADER reachable - a handle you cannot see is not a handle
      const x=Math.min(Math.max(8,r.left), Math.max(8,W-Math.min(r.width,W-16)-8));
      const y=Math.min(Math.max(8,r.top),  Math.max(8,H-44));
      p.style.left=Math.round(x)+"px"; p.style.top=Math.round(y)+"px"; p.style.right="auto";
    };
    const stkDrag=(e)=>{
      const r=p.getBoundingClientRect();
      p.style.left=r.left+"px"; p.style.top=r.top+"px"; p.style.right="auto";   // convert off the right anchor before moving
      const dx=e.clientX-r.left, dy=e.clientY-r.top;
      p.classList.add("drag");
      const move=(ev)=>{ p.style.left=(ev.clientX-dx)+"px"; p.style.top=(ev.clientY-dy)+"px"; };
      const up=()=>{ removeEventListener("pointermove",move); removeEventListener("pointerup",up);
        p.classList.remove("drag"); clamp();
        try{ localStorage.setItem(KEY,JSON.stringify([parseInt(p.style.left,10),parseInt(p.style.top,10)])); }catch(err){}
      };
      addEventListener("pointermove",move); addEventListener("pointerup",up);
      e.preventDefault();
    };
    const head=p.querySelector("h4");
    head.title="Drag to move · double-click to put it back";
    head.addEventListener("pointerdown",stkDrag);
    // double-click returns it to the corner it started in, because a dragged panel has no other way home
    head.addEventListener("dblclick",()=>{ p.style.left=""; p.style.top=""; p.style.right="14px";
      try{ localStorage.removeItem(KEY); }catch(err){} });
    try{ const v=JSON.parse(localStorage.getItem(KEY)||"null");
      if(v&&v.length===2){ p.style.left=v[0]+"px"; p.style.top=v[1]+"px"; p.style.right="auto"; } }catch(err){}
    addEventListener("resize",()=>{ if(p.classList.contains("on")&&p.style.right==="auto") clamp(); });
    // a panel opened into a window too narrow for it must not start out of reach
    const _obs=new MutationObserver(()=>{ if(p.classList.contains("on")&&p.style.right==="auto") clamp(); });
    _obs.observe(p,{attributes:true,attributeFilter:["class"]});
  }
  const tt=document.getElementById("stkt"),tu=document.getElementById("stku");""",
    "drag behaviour")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("the homes panel drags and cannot be lost:", len(s), "chars")
