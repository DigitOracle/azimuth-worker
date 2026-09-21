"""The twin's own panel shows the plate, not the old bar chart (Kendall, 21 Sep 2026: "why do i still see this?", on
/skyline/businessbay?b=650 - the range chart the Floor layout view has shown since v186).

The building page was rebuilt around the indicative plate; the twin's panel was not, and a deep link (?b=<id>) opens the panel
rather than the page. So the panel now carries, in this order: a button to the building page, a floor picker, the plate for the
chosen floor with its caveat, and the type table underneath. The floor-range chart goes.
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "v186_floor_stack.js")
s = io.open(P, encoding="utf-8").read()


def sub(old, new):
    global s
    assert s.count(old) == 1, old[:70]
    s = s.replace(old, new)


# the plate for the open building, fetched once per building
sub("let STK=null,STKON=false,STKSEL=null,STKFLOOR=-1,STKHOT=null;",
    "let STK=null,STKON=false,STKSEL=null,STKFLOOR=-1,STKHOT=null,STKPL=null,STKPLID=null;")

sub("function stkPanel(){",
    '''function stkPlateFetch(i,then){if(STKPLID===String(i)){then();return}STKPLID=String(i);STKPL=null;
  fetch("/img/plate_"+window.__twinDistrict+"_"+i+"?t="+Math.floor(Date.now()/600000)).then(r=>r.ok?r.json():null)
    .then(j=>{STKPL=(j&&(j.building||((j.buildings||{})[String(i)])))||null;then()}).catch(()=>then())}
// the same drawing the building page uses, in the panel's width
function stkPlateSVG(f){
  if(!STKPL||!STKPL.floors)return"";
  const ix=STKPL.floors[String(f.l)];if(ix===undefined)return"";
  const p=STKPL.plates[ix];if(!p)return"";
  if(p.skip)return'<div class=fbas>'+(p.skip==="small"?"Not drawn: the register puts more homes on this floor than this footprint can hold - several buildings are probably bound to one record.":"Not drawn: too many units on one floor to draw.")+"</div>";
  const lab=(STKPL.labels||{})[String(f.l)],o=STKPL.outline,xs=[],ys=[];
  for(let i=0;i<o.length;i+=2){xs.push(o[i]);ys.push(o[i+1])}
  const x0=Math.min.apply(null,xs),x1=Math.max.apply(null,xs),y0=Math.min.apply(null,ys),y1=Math.max.apply(null,ys);
  const pad=Math.max(3,(x1-x0)*0.03),W=1000,k=W/(x1-x0+2*pad),H=(y1-y0+2*pad)*k;
  const T=(a)=>{let t="";for(let i=0;i<a.length;i+=2)t+=((a[i]-x0+pad)*k).toFixed(1)+","+((y1-a[i+1]+pad)*k).toFixed(1)+" ";return t};
  const SH={studio:"S","1":"1","2":"2","3":"3","4":"4",office:"O",retail:"R",other:""};
  let h='<svg class=fplate viewBox="0 0 '+W+" "+H.toFixed(0)+'">';
  if(p.tower)h+='<polygon points="'+T(o)+'" fill="#2B3532" fill-opacity=".3" stroke="#C5A56A" stroke-opacity=".45" stroke-width="1.4" stroke-dasharray="7 6"/><polygon points="'+T(p.tower)+'" fill="#2B3532" stroke="#C5A56A" stroke-opacity=".6" stroke-width="1.8"/>';
  else h+='<polygon points="'+T(o)+'" fill="'+(p.cells.length?"#2B3532":(stkHex(STKCOL[p.use]||STKCOL.other)))+'" fill-opacity="'+(p.cells.length?1:0.35)+'" stroke="#C5A56A" stroke-opacity=".6" stroke-width="1.8"/>';
  for(const c of p.cells){const t=lab&&lab[c[2]]!==undefined?lab[c[2]]:(SH[c[0]]||"");
    h+='<polygon points="'+T(c[1])+'" fill="'+stkHex(STKCOL[c[0]]||STKCOL.other)+'" stroke="#0E1613" stroke-width="1.5" stroke-linejoin="round"/>';
    let cx=0,cy=0,mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9;const a=c[1];
    for(let i=0;i<a.length;i+=2){cx+=a[i];cy+=a[i+1];mnx=Math.min(mnx,a[i]);mxx=Math.max(mxx,a[i]);mny=Math.min(mny,a[i+1]);mxy=Math.max(mxy,a[i+1])}
    cx/=a.length/2;cy/=a.length/2;
    if(Math.max(mxx-mnx,mxy-mny)*k>16&&Math.min(mxx-mnx,mxy-mny)*k>9)
      h+='<text x="'+((cx-x0+pad)*k).toFixed(1)+'" y="'+((y1-cy+pad)*k+4).toFixed(1)+'" font-size="'+(lab?Math.min(12,Math.max(7.5,k*1.5)):Math.min(15,Math.max(9,k*2.2))).toFixed(1)+'" font-weight="600" text-anchor="middle" fill="#0E1613" fill-opacity=".8">'+stkEsc(t)+"</text>"}
  for(const b of p.blocks||[])h+='<polygon points="'+T(b[1])+'" fill="'+(b[0]==="lift"?"#5B6662":"#9A95D6")+'" stroke="#0E1613" stroke-width="1.3"/>';
  if(!p.cells.length)h+='<text x="'+W/2+'" y="'+(H/2+5).toFixed(1)+'" font-size="17" letter-spacing="3" text-anchor="middle" fill="#E8E4D8" fill-opacity=".8">'+stkEsc(String(p.use).toUpperCase())+"</text>";
  h+='<g transform="translate('+(W-40)+',38) rotate('+(-STKPL.north).toFixed(1)+')"><circle r="17" fill="#0E1613" fill-opacity=".6" stroke="#C5A56A" stroke-opacity=".6"/><path d="M0,-12 L5,7 L0,3 L-5,7 Z" fill="#C5A56A"/><text y="-21" font-size="11" fill="#C5A56A" text-anchor="middle">N</text></g></svg>';
  const says={units:"The unit numbers, types and sizes are the Land Department units register's, one row per unit; they are laid round the facade in unit-number order.",municipality:"How many homes this floor carries is the Municipality's count for the floor, shared between the types the Land Department register puts on it.",register:"How many homes of each type this floor carries is the Land Department register's units for the type, spread evenly over the floors the register gives it."}[p.basis]||"";
  return h+'<div class=fbas><b>Indicative layout.</b> The outline is this building’s surveyed footprint; the sizes of the homes against each other are the register’s. '+says+(p.basis!=="units"?" No unit numbers are shown: the units register does not cover this building well enough.":"")+(p.dm_use?" The Municipality records this floor as "+stkEsc(p.dm_use)+"; the Land Department register lists these homes on it, so they are drawn.":"")+(p.tower?" The footprint (dashed) is far larger than the floor the register describes, so it is read as a podium.":"")+" Where each home sits, and where the lifts and stairs are, is not published for this building.</div>"}
function stkPanel(){''')

# the Floor layout view: a button, a floor picker, the plate - no range chart
sub("  const rows=stkChart(r,[...seen.values()]);", "  const sel=r.floors.map((f,j)=>'<option value=\"'+j+'\">'+stkEsc(f.l==='G'?'Ground floor':(f.n!=null?'Floor '+f.n:f.l))+(f.k?' · '+f.k+' homes':'')+'</option>').join('');")

sub("""  d.innerHTML=clash+unfit+'<div class=flh>Floor layout <span>'+N+' levels'+(r.basements?' + '+r.basements+' below ground':'')+'</span></div><div class=fstk id=fstk>'+rows+'</div><div class=fdet id=fdet>Tap a floor, here or on the tower.</div>'+""",
    """  d.innerHTML=clash+unfit+'<div class=flh>Floor layout <span>'+N+' levels'+(r.basements?' + '+r.basements+' below ground':'')+'</span></div>'+
    '<a class=fopen target=_blank rel=noopener href="/building/'+encodeURIComponent(window.__twinDistrict)+'/'+encodeURIComponent(i)+'?key='+encodeURIComponent(KEY)+(window.__RKQ||"")+'">open the building page ↗</a>'+
    '<select id=fsel class=fsel>'+sel+'</select><div id=fplate></div><div class=fdet id=fdet>Pick a floor, or tap one on the tower.</div>'+""")

sub("""  d.querySelector("#fstk").onclick=(e)=>{const sv=d.querySelector("#fstk svg");if(!sv)return;const bx=sv.getBoundingClientRect(),g=sv.__g;
    const y=(e.clientY-bx.top)*g.vh/bx.height;if(y<g.t||y>g.t+g.h)return;stkPick(i,Math.max(0,Math.min(N-1,N-1-Math.floor((y-g.t)/g.h*N))))};""",
    """  const fs=d.querySelector("#fsel");if(fs)fs.onchange=()=>stkPick(i,+fs.value);
  stkPlateFetch(i,()=>{if(STKFLOOR>=0)stkPick(i,STKFLOOR)});""")

# the plate follows the chosen floor
sub("""  const pp=document.getElementById("ppanel");if(!pp)return;stkMark(pp,r);""",
    """  const pp=document.getElementById("ppanel");if(!pp)return;
  const fs=pp.querySelector("#fsel");if(fs&&STKFLOOR>=0)fs.value=String(STKFLOOR);
  const ph=pp.querySelector("#fplate");if(ph)ph.innerHTML=STKFLOOR>=0?stkPlateSVG(r.floors[STKFLOOR]):"";""")

# chrome
CSS_OLD = '".fstk{margin:6px 0 8px;cursor:crosshair}'
CSS_NEW = ('".fopen{display:block;text-align:center;margin:8px 0 6px;padding:7px 0;border:1px solid rgba(197,165,106,.5);'
           'border-radius:99px;color:#C5A56A;text-decoration:none;font:600 .58rem monospace;letter-spacing:.12em;'
           'text-transform:uppercase}.fopen:hover{background:rgba(197,165,106,.12)}"+'
           '".fsel{display:block;width:100%;margin:2px 0 6px;appearance:none;-webkit-appearance:none;background:rgba(12,20,19,.6);'
           'border:1px solid rgba(197,165,106,.35);border-radius:8px;color:#E8E4D8;font:600 .8rem Fraunces,Georgia,serif;'
           'padding:6px 10px;cursor:pointer}.fsel option{background:#0C1413;font-size:.72rem}"+'
           '".fplate svg{display:block;width:100%;height:auto;margin:2px 0 4px}"+'
           + CSS_OLD)
sub(CSS_OLD, CSS_NEW)

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("twin panel rebuilt:", len(s), "chars")
