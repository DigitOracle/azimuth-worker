"""The facade is never replaced. The floors are laid OVER it (Kendall, 21 Sep 2026).

"I never want to see this building with these plain colors. We have the facades. It should always be the facades and the
floors, whatever the case may be, that can be overlaid, but we always always need to have the facade."

v213 delayed the repaint by a beat, which was the wrong shape of fix: it made the facade visible for 900 ms and then took it
away again. The repaint was never a tint - stkDraw builds new flat-coloured meshes from the building's geometry and HIDES the
textured original (ms.forEach(stkHide)), so the facade was gone, not covered. Selecting a tower replaced the building with a
block of colour, which on Aykon City-tower B is lilac.

Now the textured meshes stay on screen and the bands sit over them, translucent, so a floor's type reads as a wash of colour
on a building you can still see. The picked floor stays strong, because a chosen floor is a statement and not a hint; every
other band is light enough to read the facade through. Nothing about the model changes: the bands still share its geometry and
are still cut with clipping planes, and the original is no longer parked on layer 30 because it is doing its job.

  python scripts/v215_facade_always.py && python scripts/v186_apply.py
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "v186_floor_stack.js")
s = io.open(P, encoding="utf-8").read()

# --- the bands become a wash over the facade, not a replacement for it -------------------------------------------------------
OLD = ("""    ms.forEach((m,k)=>{const mt=new THREE.MeshStandardMaterial({color:q[2],emissive:q[2],emissiveIntensity:q[4]||0.14,roughness:0.62,metalness:0.02,flatShading:true,side:THREE.FrontSide,"""
       """
        transparent:q[3]<1,opacity:q[3],depthWrite:q[3]>=1,clippingPlanes:cp,polygonOffset:k>0,polygonOffsetFactor:-k,polygonOffsetUnits:-4*k});""")
NEW = ("""    // OVER the facade, never instead of it: a chosen floor reads strongly, every other band is a wash you can see through
    const strong=(q[4]||0)>=0.6,op=Math.min(q[3]===undefined?1:q[3],strong?0.82:0.46);
    ms.forEach((m,k)=>{const mt=new THREE.MeshStandardMaterial({color:q[2],emissive:q[2],emissiveIntensity:q[4]||0.14,roughness:0.62,metalness:0.02,flatShading:true,side:THREE.FrontSide,"""
       """
        transparent:true,opacity:op,depthWrite:false,clippingPlanes:cp,polygonOffset:true,polygonOffsetFactor:-1-k,polygonOffsetUnits:-4*(k+1)});""")
assert s.count(OLD) == 1
s = s.replace(OLD, NEW)

# --- and the textured original stays on screen --------------------------------------------------------------------------------
OLD2 = """  ms.forEach(stkHide);scene.add(g);STKB.set(i,{g:g,mats:mats,bands:bands,ms:ms})}"""
NEW2 = """  scene.add(g);STKB.set(i,{g:g,mats:mats,bands:bands,ms:ms})}   // v215: the facade is NOT hidden any more"""
assert s.count(OLD2) == 1
s = s.replace(OLD2, NEW2)

for ch in ("`", "${", "\\"):
    assert ch not in NEW and ch not in NEW2, ch
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("facade kept, floors overlaid:", len(s), "chars")
