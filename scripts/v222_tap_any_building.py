"""Every building on the district twin answers a tap, from a cold start (Kendall, 22 Sep 2026: "even when i click on the
carson the actual twin, nothing happens").

DAMAC Hills - Carson IS register-bound, so v218's "no record" message was not the answer here. The real guard was earlier:

    addEventListener("pointerup", e => { if (!STK || !STKB.size || ...) return;

STKB holds the coloured bands, and bands are only built once something is already selected or the floor-layout view is on. So
on a freshly loaded district twin STKB is empty, the handler returned on its first condition, and NOTHING on the model was
tappable - not Carson, not anything. The way in was to select a building some other way first, which is not a thing anybody
would guess.

Now a tap always resolves against the model itself:
  * it hits a band (a selected building)           -> pick that floor, as before
  * it hits a building the registers know          -> open its page
  * it hits a building the registers do not reach  -> say so, which is v218's line

The footprint behind a mesh comes from window.BYFP, the same nearest-footprint mapping the bands are built from, reversed once
and cached.

  python scripts/v222_tap_any_building.py && python scripts/v186_apply.py
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "v186_floor_stack.js")
s = io.open(P, encoding="utf-8").read()
NL = chr(10)


def sub(old, new, where):
    global s
    assert s.count(old) == 1, (where, s.count(old))
    s = s.replace(old, new)


# the guard no longer requires a band to exist
sub("""addEventListener("pointerup",e=>{if(!STK||!STKB.size||!pd||Math.hypot(e.clientX-pd[0],e.clientY-pd[1])>6)return;""",
    """addEventListener("pointerup",e=>{if(!STK||!pd||Math.hypot(e.clientX-pd[0],e.clientY-pd[1])>6)return;""",
    "guard")

# a miss now resolves the building under the pointer rather than giving up
sub("""  if(!h){stkSayNoRecord(ray);return}""",
    """  if(!h){stkTapModel(ray);return}""",
    "fallthrough")

# and the fallback opens the page when the register knows the building
OLD = """let STKSAY=null;
function stkSayNoRecord(ray){
  if(!MESHES||!MESHES.length)return;
  const hit=ray.intersectObjects(MESHES.filter(m=>m&&m.visible),false)[0];if(!hit)return;
  let el=document.getElementById("stksay");
  if(!el){el=document.createElement("div");el.id="stksay";document.body.appendChild(el)}
  el.textContent="No register record for this building - the Land Department reaches "+(STK&&STK.buildings_by_id?Object.keys(STK.buildings_by_id).length:0)+" buildings in this district, and this is not one of them.";
  el.className="on";clearTimeout(STKSAY);STKSAY=setTimeout(()=>{el.className=""},2600);
}"""
NEW = """let STKSAY=null,STKREV=null;
// mesh index -> footprint id, from the same nearest-footprint mapping the bands are built from
function stkRev(){if(STKREV)return STKREV;if(!window.BYFP)return null;STKREV=new Map();
  for(const k in window.BYFP){const a=window.BYFP[k];if(a)a.forEach(x=>STKREV.set(x,k))}return STKREV}
function stkTapModel(ray){
  if(!MESHES||!MESHES.length)return;
  const vis=MESHES.filter(m=>m&&m.visible);
  const hit=ray.intersectObjects(vis,false)[0];if(!hit)return;
  const rev=stkRev(),ix=MESHES.indexOf(hit.object),id=rev?rev.get(ix):null;
  if(id!=null&&STK&&STK.buildings_by_id&&STK.buildings_by_id[id]){stkOpen(id);return}
  stkSay("No register record for this building - the Land Department reaches "+(STK&&STK.buildings_by_id?Object.keys(STK.buildings_by_id).length:0)+" buildings in this district, and this is not one of them.");
}
function stkSay(msg){
  let el=document.getElementById("stksay");
  if(!el){el=document.createElement("div");el.id="stksay";document.body.appendChild(el)}
  el.textContent=msg;el.className="on";clearTimeout(STKSAY);STKSAY=setTimeout(()=>{el.className=""},2600);
}"""
sub(OLD, NEW, "fallback")

for ch in ("`", "${", chr(92)):
    assert ch not in NEW, ch
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("every building answers a tap:", len(s), "chars")
