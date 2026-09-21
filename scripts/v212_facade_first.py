"""The facade registers first; the type colours arrive a beat later (Kendall, 21 Sep 2026: "it should delay a beat").

Selecting a building repainted it by unit type instantly, so the first thing a buyer saw of the building they had just tapped
was a block of flat colour. The video session proved it was the selection and not the model - same tower, same camera, with and
without ?b=, one a lilac block and one a textured facade - after Kendall's "you picked the building with no facade, this is
horrible".

The repaint stays: every colour is a home type, and that is the point of the view. It just no longer arrives before the
building does. A NEW selection waits 900 ms, which is long enough to read a facade and short enough that nobody waits for it;
anything that re-applies to the same building - picking a floor, toggling a type - paints at once, because by then the facade
has been seen and the delay would only feel like lag.

  python scripts/v212_facade_first.py && python scripts/v186_apply.py
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "v186_floor_stack.js")
s = io.open(P, encoding="utf-8").read()

OLD_STATE = "let STK=null,STKON=false,STKSEL=null,STKFLOOR=-1,STKHOT=null,STKPL=null,STKPLID=null;"
NEW_STATE = ("let STK=null,STKON=false,STKSEL=null,STKFLOOR=-1,STKHOT=null,STKPL=null,STKPLID=null,"
             "STKLAST=null,STKTMR=null;")
assert s.count(OLD_STATE) == 1
s = s.replace(OLD_STATE, NEW_STATE)

OLD = """  if(SELPROJ){const own=[...STKM.keys()].filter(shown);if(own.length){STKSEL=new Set(own);own.forEach(i=>{const r=STK.buildings_by_id[i];stkDraw(i,stkRuns(r,stkLookBuilding(r)),false)})}
    stkCount();return}"""
NEW = """  if(SELPROJ){const own=[...STKM.keys()].filter(shown);
    if(own.length){STKSEL=new Set(own);
      const paint=()=>{own.forEach(i=>{const r=STK.buildings_by_id[i];stkDraw(i,stkRuns(r,stkLookBuilding(r)),false)});stkCount()};
      const key=own.join(",");
      if(STKTMR){clearTimeout(STKTMR);STKTMR=null}
      // a new building: let its facade be seen before the type colours land on it. Re-applying to the same one paints now.
      if(key!==STKLAST&&STKFLOOR<0){STKLAST=key;STKTMR=setTimeout(()=>{STKTMR=null;paint()},900)}
      else{STKLAST=key;paint()}}
    else{STKLAST=null}
    stkCount();return}"""
assert s.count(OLD) == 1
s = s.replace(OLD, NEW)

for ch in ("`", "${", "\\"):
    assert ch not in NEW, ch
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("facade first, colours a beat later:", len(s), "chars")
