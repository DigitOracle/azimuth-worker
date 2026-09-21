"""A tap on a building the registers do not reach should say so, not do nothing (Kendall, 22 Sep 2026:
"when i click on a building here, nothing happens").

He was on DAMAC Hills, where 24 buildings of roughly a thousand footprints carry a register record. The tap raycasts the
BANDS, which only exist for register-bound buildings, so a tap on any of the other ~980 - the villas - hit nothing and the
handler returned in silence. Nothing was broken; the page simply had no way to say "there is nothing behind this one".

Now a tap that misses every band falls through to the model itself. If it hits a building, a line appears for two seconds
naming what we know: the register does not reach it. A villa in DAMAC Hills is not a defect and the page should say which it
is, rather than leaving a tap unanswered.

  python scripts/v218_tap_says_why.py && python scripts/v186_apply.py
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "v186_floor_stack.js")
s = io.open(P, encoding="utf-8").read()

OLD = """  const h=ray.intersectObjects(all,false).find(x=>{const u=x.object.userData.stk;return x.point.y>=u.lo-0.05&&x.point.y<=u.hi+0.05});if(!h)return;"""
NEW = """  const h=ray.intersectObjects(all,false).find(x=>{const u=x.object.userData.stk;return x.point.y>=u.lo-0.05&&x.point.y<=u.hi+0.05});
  if(!h){stkSayNoRecord(ray);return}"""
assert s.count(OLD) == 1
s = s.replace(OLD, NEW)

# the fallback: hit the model itself, and say what we know about what was hit
OLD2 = """function stkOpen(i){"""
NEW2 = """// A tap that misses every band: the building has no register record, so nothing was drawn over it. Hit the model instead and
// say so - silence reads as a broken page, and on a villa district almost every tap lands here.
let STKSAY=null;
function stkSayNoRecord(ray){
  if(!MESHES||!MESHES.length)return;
  const hit=ray.intersectObjects(MESHES.filter(m=>m&&m.visible),false)[0];if(!hit)return;
  let el=document.getElementById("stksay");
  if(!el){el=document.createElement("div");el.id="stksay";document.body.appendChild(el)}
  el.textContent="No register record for this building - the Land Department reaches "+(STK&&STK.buildings_by_id?Object.keys(STK.buildings_by_id).length:0)+" buildings in this district, and this is not one of them.";
  el.className="on";clearTimeout(STKSAY);STKSAY=setTimeout(()=>{el.className=""},2600);
}
function stkOpen(i){"""
assert s.count(OLD2) == 1
s = s.replace(OLD2, NEW2)

# chrome
OLD3 = '".fopen{display:block;'
NEW3 = ('"#stksay{position:fixed;left:50%;bottom:86px;transform:translateX(-50%) translateY(8px);z-index:30;max-width:min(520px,86vw);'
        'padding:9px 14px;border-radius:10px;background:rgba(12,20,19,.94);border:1px solid rgba(197,165,106,.45);color:#E8E4D8;'
        'font:500 .62rem/1.5 monospace;text-align:center;opacity:0;pointer-events:none;transition:opacity .18s,transform .18s}"+'
        '"#stksay.on{opacity:1;transform:translateX(-50%) translateY(0)}"+'
        + OLD3)
assert s.count(OLD3) == 1
s = s.replace(OLD3, NEW3)

for ch in ("`", "${"):
    assert ch not in NEW2 and ch not in NEW3, ch
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("a tap now says why:", len(s), "chars")
