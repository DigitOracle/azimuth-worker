"""The tap fix, in the handler that actually runs.

v218 and v222 were dead code and I did not check. Both changed the pointerup handler inside the v186 floor-stack block - but
the HOST twin registers its own pointerup first (index.js ~9528), and its first act is:

    if(!pd||moved>6){pd=null;return}
    pd=null;                              <- consumed here

so by the time the v186 handler runs, pd is null and it returns on its first condition. Every time. Kendall reported "nothing
happens" twice, I shipped two fixes, and neither could ever have fired. I verified it this time by driving the live page in a
browser and tapping the building myself, which is what I should have done first.

WHAT ACTUALLY HAPPENS ON A TAP: the host raycasts the visible meshes and looks for an ANCHOR carrying that mesh index
(a.meshes). If it finds one it opens it. If it does not - and for most buildings there is no such anchor - it falls through to
the construction/pipeline "featured" meshes, misses those too, hides the card and returns in silence. That silence is the bug.

This adds the fallback where the tap really lands: no anchor, so ask the floor stack. It knows the footprint behind the mesh
(window.BYFP, reversed) and whether the register holds that building - so it opens the building page, or says the register
does not reach it, which is what v218 was for.

  python scripts/v224_tap_fallback_in_host.py && python scripts/v186_apply.py

(Renumbered from v223: the building-wiring session had already taken that number for the THE BUILDING tab work,
and theirs carries a test file named for it. Two v223s in one history helps nobody.)
"""
import io, os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NL = chr(10)


def sub(s, old, new, where):
    assert s.count(old) == 1, (where, s.count(old))
    return s.replace(old, new)


# --- the floor stack exposes its resolver, and takes a hit rather than casting its own ray ------------------------------------
P = os.path.join(HERE, "scripts", "v186_floor_stack.js")
s = io.open(P, encoding="utf-8").read()

OLD = """function stkTapModel(ray){
  if(!MESHES||!MESHES.length)return;
  const vis=MESHES.filter(m=>m&&m.visible);
  const hit=ray.intersectObjects(vis,false)[0];if(!hit)return;
  const rev=stkRev(),ix=MESHES.indexOf(hit.object),id=rev?rev.get(ix):null;
  if(id!=null&&STK&&STK.buildings_by_id&&STK.buildings_by_id[id]){stkOpen(id);return}
  stkSay("No register record for this building - the Land Department reaches "+(STK&&STK.buildings_by_id?Object.keys(STK.buildings_by_id).length:0)+" buildings in this district, and this is not one of them.");
}"""
NEW = """function stkTapModel(ray){
  if(!MESHES||!MESHES.length)return false;
  const vis=MESHES.filter(m=>m&&m.visible);
  const hit=ray.intersectObjects(vis,false)[0];if(!hit)return false;
  return stkTapMesh(MESHES.indexOf(hit.object));
}
// the host twin owns the tap (it registers pointerup first and consumes pd), so it calls this when its own anchor
// lookup finds nothing. Returns true when it has answered the tap.
function stkTapMesh(ix){
  if(ix==null||ix<0)return false;
  const rev=stkRev(),id=rev?rev.get(ix):null;
  if(id!=null&&STK&&STK.buildings_by_id&&STK.buildings_by_id[id]){stkOpen(id);return true}
  if(!STK||!STK.buildings_by_id)return false;
  stkSay("No register record for this building - the Land Department reaches "+Object.keys(STK.buildings_by_id).length+" buildings in this district, and this is not one of them.");
  return true;
}
window.__stkTapMesh=function(ix){try{return stkTapMesh(ix)}catch(e){return false}};"""
s = sub(s, OLD, NEW, "expose")
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("v186 block:", len(s), "chars")

# --- the host asks the floor stack when its own lookup fails ------------------------------------------------------------------
Q = os.path.join(HERE, "src", "index.js")
t = io.open(Q, encoding="utf-8").read()
OLD2 = """    if(h){const idx=MESHES.indexOf(h.object);const a=ANCH.anchors.find(x=>x.meshes&&x.meshes.indexOf(idx)>=0);if(a){openAnchor(a);return}}}"""
NEW2 = ("""    if(h){const idx=MESHES.indexOf(h.object);const a=ANCH.anchors.find(x=>x.meshes&&x.meshes.indexOf(idx)>=0);if(a){openAnchor(a);return}"""
        + NL +
        """      // v224: no anchor carries this mesh, which is the common case. Ask the floor stack: it knows the footprint behind
      // the mesh and whether the register holds it, so the tap opens the building page or says why it cannot.
      if(window.__stkTapMesh&&window.__stkTapMesh(idx))return}}""")
t = sub(t, OLD2, NEW2, "host fallback")
io.open(Q, "w", encoding="utf-8", newline="").write(t)
print("index.js:", len(t), "chars")
