// v186 - FLOOR STACK (Kendall, 19 Sep 2026): every register-bound building looks and acts like the Symphony unit viewer, "whilst
// maintaining revit and arcgis integrity". The CityEngine massing (ArcGIS footprints + surveyed heights) is never changed: a tower
// is cut into floor bands by clipping planes on copies that SHARE its geometry, and the original comes back untouched when the
// bands go. What each band IS comes from /img/stack_<district> (naj-market-pulse scripts/build_floor_stack.py): the Dubai
// Municipality floor register by building id, and the Land Department units register's floor range per unit type. A type on a
// floor is the register's range, never a unit position - the panel says so. Unit positions stay with level A (Revit / a
// developer stacking plan: the Symphony pilot).
ren.localClippingEnabled=true;
let STK=null,STKON=false,STKSEL=null,STKFLOOR=-1,STKHOT=null;const STKB=new Map(),STKG=new Map();
const STKCOL={studio:0xB9A6C9,"1":0xC5A56A,"2":0x7FA8C9,"3":0x8FC7B9,"4":0xD9A441,office:0x8FA39B,retail:0xD98C6A,hotel:0xC58FB0,services:0x37423F,homes:0xD9CFB8,villa:0xC9C0AC,civic:0x7FA3B8,other:0x8A8F96};
const STKCHIP=[["studio","Studio"],["1","1 BHK"],["2","2 BHK"],["3","3 BHK"],["4","4 BHK +"]],STKUSE=[["office","Office"],["retail","Retail"],["hotel","Hotel"]];
const STKUSEN={homes:"homes",villa:"villa",office:"offices",retail:"retail",hotel:"hotel",civic:"civic",services:"services and parking"};
const STKF={on:new Set(STKCHIP.map(c=>c[0])),use:new Set(),alo:0,ahi:100,slo:0,shi:100};
const STKGHOST=new THREE.MeshStandardMaterial({color:0x5d6b68,roughness:1,metalness:0,transparent:true,opacity:0.16,depthWrite:false});
const stkHex=(n)=>"#"+n.toString(16).padStart(6,"0");
const stkEsc=(s)=>String(s==null?"":s).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
const stkAed=(v)=>v<=0?0:v>=100?Infinity:300000*Math.pow(100,v/100);          // AED 300k .. 30M, log
const stkSq=(v)=>v<=0?0:v>=100?Infinity:300*Math.pow(20,v/100);                // 300 .. 6,000 sq ft, log
const stkFmtA=(a)=>a===Infinity?"any":a<=0?"0":a>=1e6?(+(a/1e6).toFixed(a<1e7?2:1))+"M":Math.round(a/1e3)+"k";
const stkFmtS=(s)=>s===Infinity?"any":s<=0?"0":Math.round(s/10)*10+"";
fetch("/img/stack_"+window.__twinDistrict+"?t="+Math.floor(Date.now()/600000)).then(r=>r.ok?r.json():null).then(j=>{if(j&&j.buildings_by_id){STK=j;stkUI()}}).catch(()=>{});
// the colour a floor is drawn in: a home floor takes its most numerous register type, anything else its use
function stkCol(r,f){if(f.u!=="homes"&&f.u!=="hotel"&&f.u!=="villa")return STKCOL[f.u]||STKCOL.other;
  let best=null;for(const t of f.t||[]){const T=r.types[t];if(!T||!STKCOL[T.c]||T.c==="other")continue;if(!best||(T.units||0)>(best.units||0))best=T}
  return best?STKCOL[best.c]:STKCOL.homes}
// does a floor pass the filters: the first register type on it that is switched on and inside budget and size, or its use
function stkMatch(r,f){if(STKF.use.has(f.u))return{c:f.u};
  const alo=stkAed(STKF.alo),ahi=stkAed(STKF.ahi),slo=stkSq(STKF.slo),shi=stkSq(STKF.shi),full=(a,b)=>a<=0&&b>=100;
  for(const t of f.t||[]){const T=r.types[t];if(!T||!STKF.on.has(T.c))continue;
    if(T.aed!=null){if(T.aed<alo||T.aed>ahi)continue}else if(!full(STKF.alo,STKF.ahi))continue;
    if(T.sqm!=null){const s=T.sqm*10.764;if(s<slo||s>shi)continue}else if(!full(STKF.slo,STKF.shi))continue;
    return T}
  return null}
// an original under bands moves to a layer the camera never draws - its visible flag, labels, tap and ghosting stay the page's
// own - and comes back with its layer mask exactly as it was
function stkHide(m){if(m.userData.stkMask==null)m.userData.stkMask=m.layers.mask;m.layers.set(30)}
function stkShow(m){if(m.userData.stkMask!=null){m.layers.mask=m.userData.stkMask;m.userData.stkMask=null}}
function stkClear(){STKB.forEach(b=>{scene.remove(b.g);b.mats.forEach(x=>x.dispose());b.ms.forEach(stkShow)});STKB.clear();
  STKG.forEach((g,i)=>{scene.remove(g);const m=MESHES&&MESHES[+i];if(m)stkShow(m)});STKG.clear()}
// the register key is the footprint id (the unit-mix card's key), NOT the mesh order. The page gives every mesh to its nearest
// footprint once the model and the anchors are both in (window.BYFP); until then there is nothing to cut.
let STKM=null;function stkMap(){if(STKM)return STKM;if(!STK||!MESHES||!window.BYFP)return null;STKM=new Map();
  for(const k in STK.buildings_by_id){const ms=window.BYFP[k];if(ms&&ms.length)STKM.set(k,ms.slice())}
  return STKM}
// runs: [[first floor, last floor, colour, opacity, glow]] over the building's drawn floors, bottom up; floors share the model's
// height evenly (the model's height is kept as surveyed - the band count comes from the register, never the other way round)
function stkDraw(i,runs,gap){const ms=(STKM.get(i)||[]).map(x=>MESHES[x]).filter(Boolean),r=STK.buildings_by_id[i];if(!ms.length||!r||r.fits===false)return;   // a podium cannot hold the register's floors: leave the model alone
  const bb=new THREE.Box3();ms.forEach(m=>{m.updateWorldMatrix(true,false);bb.expandByObject(m)});const y0=bb.min.y,H=bb.max.y-y0,N=r.floors.length;if(H<3||!N)return;
  const h=H/N,gp=gap?Math.min(0.45,h*0.13):0,g=new THREE.Group(),mats=[],bands=[];
  for(const q of runs){const lo=y0+q[0]*h,hi=y0+(q[1]+1)*h-gp;
    const cp=[new THREE.Plane(new THREE.Vector3(0,1,0),-lo),new THREE.Plane(new THREE.Vector3(0,-1,0),hi)];
    // a v3 tower is several meshes (walls, slab bands, crown) sharing faces; each gets its own small depth offset so they do not
    // fight for the same pixels once they are one colour
    ms.forEach((m,k)=>{const mt=new THREE.MeshStandardMaterial({color:q[2],emissive:q[2],emissiveIntensity:q[4]||0.14,roughness:0.62,metalness:0.02,flatShading:true,side:THREE.FrontSide,
        transparent:q[3]<1,opacity:q[3],depthWrite:q[3]>=1,clippingPlanes:cp,polygonOffset:k>0,polygonOffsetFactor:-k,polygonOffsetUnits:-4*k});
      const b=new THREE.Mesh(m.geometry,mt);b.matrixAutoUpdate=false;b.matrix.copy(m.matrixWorld);b.userData.stk={i:i,j0:q[0],j1:q[1],lo:lo,hi:hi,y0:y0,fh:h};g.add(b);bands.push(b);mats.push(mt)})}
  ms.forEach(stkHide);scene.add(g);STKB.set(i,{g:g,mats:mats,bands:bands,ms:ms})}
function stkGhost(i){const m=MESHES[+i];if(!m||!m.visible)return;const g=new THREE.Mesh(m.geometry,STKGHOST);g.matrixAutoUpdate=false;m.updateWorldMatrix(true,false);g.matrix.copy(m.matrixWorld);stkHide(m);scene.add(g);STKG.set(i,g)}
// consecutive floors with the same look become one band: the district view stays a few draw calls per tower
function stkRuns(r,look){const out=[];r.floors.forEach((f,j)=>{const L=look(f,j);const p=out[out.length-1];if(p&&p[1]===j-1&&p[2]===L[0]&&p[3]===L[1]&&p[4]===L[2])p[1]=j;else out.push([j,j,L[0],L[1],L[2]])});return out}
function stkLookDistrict(r){return(f)=>{const T=stkMatch(r,f);return T?[STKCOL[T.c]||STKCOL.other,1,0.3]:[0x2c3836,0.3,0]}}
// the open tower: homes one champagne tone (a floor carries several types, so no single type colour would be true), podium and
// services in their own tone, the chosen floor a solid gold slab; with the filter on, matching floors take their type's colour
function stkLookBuilding(r){return(f,j)=>{if(j===STKFLOOR)return[0xF4D58D,1,0.85];const home=f.u==="homes"||f.u==="hotel"||f.u==="villa";
  if(STKON){const T=stkMatch(r,f);return T?[STKCOL[T.c]||STKCOL.other,1,0.25]:(home?[0x4a524e,1,0.02]:[0x2c3836,1,0])}
  return home?[j%2?0xD9BF8C:0xCFB37E,1,0.42]:[STKCOL[f.u]||STKCOL.services,1,0.04]}}   // two close warm tones, floor by floor: the rhythm of floors without gap lines (they shimmer at distance)
// the whole scene from the current state: a building open -> its floors, one band each; the filter on -> every stacked tower
function stkApply(){if(!STK||!MESHES||!stkMap())return;stkClear();STKSEL=null;
  const shown=(i)=>(STKM.get(i)||[]).some(x=>MESHES[x]&&MESHES[x].visible),mine=new Set();STKM.forEach(v=>v.forEach(x=>mine.add(x)));
  if(SELPROJ){const own=[...STKM.keys()].filter(shown);if(own.length){STKSEL=new Set(own);own.forEach(i=>{const r=STK.buildings_by_id[i];stkDraw(i,stkRuns(r,stkLookBuilding(r)),false)})}
    stkCount();return}
  if(STKON){STKM.forEach((v,i)=>{if(shown(i))stkDraw(i,stkRuns(STK.buildings_by_id[i],stkLookDistrict(STK.buildings_by_id[i])),false)});MESHES.forEach((m,x)=>{if(!mine.has(x))stkGhost(x)})}
  stkCount()}
function stkAnchor(i){return ANCH&&ANCH.anchors.find(a=>String(a.i)===String(i))}
// tapping a building opens ITS OWN PAGE (Kendall, 20 Sep: "instead of opening a panel, it should open a new pop up or page
// within the ecosystem") - the Symphony viewer for that building, built from the registers.
function stkOpen(i){location.href="/building/"+encodeURIComponent(window.__twinDistrict)+"/"+encodeURIComponent(i)+"?key="+encodeURIComponent(KEY)+(window.__RKQ||"")}
function stkCount(){const c=document.getElementById("stkc");if(!c||!STK)return;let fl=0;const hit=[];
  const ids=STKM?[...STKM.keys()]:Object.keys(STK.buildings_by_id);
  for(const i of ids){const r=STK.buildings_by_id[i];let n=0,lo=null,hi=null,from=null;
    r.floors.forEach(f=>{const T=stkMatch(r,f);if(!T)return;n++;if(f.n!=null){lo=lo==null?f.n:Math.min(lo,f.n);hi=hi==null?f.n:Math.max(hi,f.n)}if(T.aed!=null&&(from==null||T.aed<from))from=T.aed});
    if(n){fl+=n;hit.push({i:i,n:n,k:r.floors.reduce((s,f)=>s+(stkMatch(r,f)?(f.k||0):0),0),lo:lo,hi:hi,from:from,name:r.name})}}
  const homes=hit.reduce((s,h)=>s+h.k,0);
  c.innerHTML="<b>"+hit.length+"</b> buildings here<small>"+fl.toLocaleString("en")+" floors match"+(homes?" · "+homes.toLocaleString("en")+" homes on them":"")+" · of "+ids.length+" with a register record</small>";
  hit.sort((a,b)=>b.n-a.n);const L=document.getElementById("stkl");
  if(L)L.innerHTML=hit.slice(0,8).map(h=>'<a data-i="'+h.i+'"><span>'+stkEsc(h.name||"building")+'</span><small>'+(h.lo!=null?(h.lo===h.hi?"floor "+h.lo:"floors "+h.lo+"-"+h.hi):h.n+" floors")+(h.from!=null?" · from "+stkFmtA(h.from):"")+'</small></a>').join("");
  if(L)L.querySelectorAll("a").forEach(a=>a.onclick=()=>stkOpen(a.dataset.i))}
function stkUI(){
  const st=document.createElement("style");st.textContent=
    "#hh,#hp{display:none!important}"+                                           /* the new filter replaces the old HOMES control (Kendall, 20 Sep) */
    ".stkb{font:600 .62rem 'IBM Plex Mono',monospace;letter-spacing:.1em;color:#C5A56A;background:rgba(19,31,29,.92);border:1px solid rgba(197,165,106,.5);border-radius:99px;padding:6px 11px;cursor:pointer}.stkb.on{color:#0C1413;background:#C5A56A}"+
    "#stkp{position:fixed;right:14px;top:74px;width:268px;box-sizing:border-box;padding:14px 16px 16px;z-index:44;display:none;max-height:calc(100vh - 150px);overflow:auto;"+
    "background:rgba(19,31,29,.94);border:1px solid rgba(197,165,106,.4);border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.45);color:#E8E4D8;font-family:'IBM Plex Mono',monospace}#stkp.on{display:block}"+
    "#stkp h4{margin:0;font-size:.62rem;font-weight:600;letter-spacing:.14em;color:#C5A56A;text-transform:uppercase}"+
    "#stkc{font-family:Fraunces,Georgia,serif;font-size:1.02rem;font-weight:600;margin:8px 0 12px;color:#E8E4D8}#stkc b{color:#C5A56A}#stkc small{display:block;font-family:'IBM Plex Mono',monospace;font-size:.58rem;letter-spacing:.06em;color:#8FA39B;font-weight:400;margin-top:3px}"+
    ".stt{display:flex;align-items:center;gap:8px;width:100%;border:1px solid rgba(197,165,106,.28);background:rgba(12,20,19,.55);border-radius:8px;padding:7px 10px;margin:0 0 5px;font:500 .72rem/1 'IBM Plex Mono',monospace;letter-spacing:.06em;color:#E8E4D8;cursor:pointer;transition:border-color .15s,opacity .15s}"+
    ".stt i{width:12px;height:12px;border-radius:3px;flex:none}.stt.off{opacity:.42}.stt.off i{filter:grayscale(1)}.stt:hover{border-color:rgba(197,165,106,.7)}"+
    ".stg{font-size:.55rem;letter-spacing:.14em;color:#8FA39B;text-transform:uppercase;margin:14px 0 7px;display:flex;justify-content:space-between;align-items:baseline}.stg u{text-decoration:none;color:#C5A56A;letter-spacing:.06em}"+
    ".srg{position:relative;height:26px;margin:0 4px}.srg i{position:absolute;left:0;right:0;top:12px;height:2px;background:rgba(197,165,106,.35)}"+
    ".srg input{position:absolute;left:-6px;width:calc(100% + 12px);top:1px;margin:0;background:none;pointer-events:none;-webkit-appearance:none;appearance:none;height:24px}"+
    ".srg input::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:18px;height:18px;border-radius:50%;background:#C5A56A;border:2px solid #0C1413;cursor:pointer}"+
    ".srg input::-moz-range-thumb{pointer-events:auto;width:18px;height:18px;border-radius:50%;background:#C5A56A;border:2px solid #0C1413;cursor:pointer}"+
    ".svl{display:flex;justify-content:space-between;font-size:.62rem;color:#E8E4D8;margin:0 4px 2px}"+
    "#stkh{display:block;width:100%;border:1px solid rgba(197,165,106,.4);border-radius:99px;padding:7px 0;margin-top:12px;background:transparent;color:#C5A56A;font:600 .6rem 'IBM Plex Mono',monospace;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}#stkh:hover{background:rgba(197,165,106,.12)}"+
    "#stkl a{display:flex;justify-content:space-between;gap:8px;font-size:.62rem;padding:6px 0;border-bottom:1px solid rgba(197,165,106,.16);cursor:pointer;color:#E8E4D8}#stkl a small{color:#8FA39B;white-space:nowrap}#stkl a:hover span{color:#C5A56A}"+
    ".stn{font-size:.53rem;line-height:1.5;color:rgba(143,163,155,.85);margin-top:10px}"+
    "#ppanel .flr{display:none}#ppanel.floors .flr{display:block}#ppanel.floors .snap,#ppanel.floors .deep,#ppanel.floors .vw{display:none!important}"+
    ".flh{font:600 .66rem 'IBM Plex Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:#C5A56A;margin:2px 0 0}.flh span{color:rgba(232,228,216,.55);font-weight:500;margin-left:6px}"+
    ".fwarn{font-size:.72rem;line-height:1.45;margin:6px 0 2px;padding:7px 9px;border:1px solid rgba(217,148,112,.55);border-radius:8px;color:#E8C4A8}"+
    ".fstk{margin:6px 0 8px;cursor:crosshair}.fstk svg{display:block;width:100%;height:auto}.fstk text{font:500 9px 'IBM Plex Mono',monospace;fill:rgba(232,228,216,.62)}"+
    ".fstk .tl{font:600 9.5px 'IBM Plex Mono',monospace;fill:rgba(232,228,216,.9)}.fstk .zl{fill:rgba(232,228,216,.45);font-size:8.5px}"+
    ".fdet{font-size:.78rem;line-height:1.45;margin:6px 0;padding:8px 10px;border:1px solid rgba(197,165,106,.35);border-radius:8px}.fdet b{color:#F4D58D}"+
    ".ftyp{width:100%;border-collapse:collapse;font-size:.7rem;margin-top:4px}.ftyp td,.ftyp th{padding:3px 2px;text-align:right;font-weight:400}.ftyp th{opacity:.6;font-size:.62rem}.ftyp td:first-child,.ftyp th:first-child{text-align:left}"+
    ".ftyp i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:-1px}.fbas{font-size:.62rem;color:rgba(143,163,155,.9);line-height:1.4;margin-top:6px}"+
    "@media(max-width:640px){#stkp{left:10px;right:10px;width:auto;top:auto;bottom:74px;max-height:44vh}}";
  document.head.appendChild(st);
  const tog=document.getElementById("filters")||document.body;const btn=document.createElement("button");btn.className="stkb on";btn.id="stkbtn";btn.textContent="HOMES";tog.appendChild(btn);
  const p=document.createElement("div");p.id="stkp";
  p.innerHTML='<h4>Homes</h4><div id=stkc></div><div class=stg>Bedrooms</div><div id=stkt></div><div class=stg>Also in the towers</div><div id=stku></div>'+
    '<div class=stg>Budget <u id=svahi></u></div><div class=srg><i></i><input id=salo type=range min=0 max=100 value=0><input id=sahi type=range min=0 max=100 value=100></div><div class=svl><span id=svalo></span><span>and up to</span></div>'+
    '<div class=stg>Size <u id=svshi></u></div><div class=srg><i></i><input id=sslo type=range min=0 max=100 value=0><input id=sshi type=range min=0 max=100 value=100></div><div class=svl><span id=svslo></span><span>sq ft</span></div>'+
    '<button id=stkh>Hide all</button><div class=stg>List them <u>most floors that match</u></div><div id=stkl></div>'+
    '<div class=stn>Every building the registers describe, floor by floor. Floors: Dubai Municipality floor register. Types, prices and sizes: the Land Department units register - the floor range each type sits on, not unit positions.</div>';
  document.body.appendChild(p);
  const tt=document.getElementById("stkt"),tu=document.getElementById("stku");
  const chip=(set,k,label,host)=>{const b=document.createElement("button");b.className="stt";b.innerHTML='<i style="background:'+stkHex(STKCOL[k])+'"></i>'+label;
    const sync=()=>b.classList.toggle("off",!set.has(k));sync();b.onclick=()=>{set.has(k)?set.delete(k):set.add(k);sync();stkHideLbl();stkApply()};host.appendChild(b);return sync};
  const syncs=STKCHIP.map(c=>chip(STKF.on,c[0],c[1],tt)).concat(STKUSE.map(c=>chip(STKF.use,c[0],c[1],tu)));
  const stkHideLbl=()=>{document.getElementById("stkh").textContent=(STKF.on.size||STKF.use.size)?"Hide all":"Show all"};
  document.getElementById("stkh").onclick=()=>{if(STKF.on.size||STKF.use.size){STKF.on.clear();STKF.use.clear()}else STKCHIP.forEach(c=>STKF.on.add(c[0]));syncs.forEach(s=>s());stkHideLbl();stkApply()};
  const pair=(a,b,va,vb,ka,kb,fmt,fn)=>{const A=document.getElementById(a),B=document.getElementById(b);
    const upd=(ev)=>{let x=+A.value,y=+B.value;if(x>y){if(ev&&ev.target===A)A.value=x=y;else B.value=y=x}STKF[ka]=x;STKF[kb]=y;document.getElementById(va).textContent=fmt(fn(x));document.getElementById(vb).textContent=fmt(fn(y))};
    upd();let t=0;[A,B].forEach(el=>el.addEventListener("input",ev=>{upd(ev);clearTimeout(t);t=setTimeout(()=>stkApply(),120)}))};
  pair("salo","sahi","svalo","svahi","alo","ahi",stkFmtA,stkAed);pair("sslo","sshi","svslo","svshi","slo","shi",stkFmtS,stkSq);
  btn.onclick=()=>{STKON=!STKON;btn.classList.toggle("on",STKON);p.classList.toggle("on",STKON&&!SELPROJ);stkApply()};
  STKON=true;p.classList.add("on");                                   // the filter IS the twin's homes control now: open from the start
  const t0=setInterval(()=>{if(stkMap()){clearInterval(t0);stkApply()}},400);setTimeout(()=>clearInterval(t0),90000);   // draw as soon as the model and the anchors are in
  stkCount();
  if(new URLSearchParams(location.search).get("floors")==="1")btn.click();   // a link can open the twin with the floors on
  window.__twinStack={on:()=>{if(!STKON)btn.click()},off:()=>{if(STKON)btn.click()},buildings:()=>stkMap()?STKM.size:0,drawn:()=>STKB.size,floor:(j)=>stkPick([...(STKSEL||[])][0],j),check:()=>[...(stkMap()||new Map()).keys()].map(k=>{const a=stkAnchor(k);return[k,(a&&(a.name||a.dev_project))||"",STK.buildings_by_id[k].name||""]})};window.__twinStackSel=()=>[...(STKSEL||[])].map(k=>STK.buildings_by_id[k].name)}
// the floor-range chart (Kendall, 19 Sep: the stripe wall "is horrible"): one column per unit type, drawn over the floors the
// register puts it on - the ranges overlap and the chart shows that - with podium, parking and services as shaded bands across,
// and the chosen floor as one gold line through every column
function stkChart(r,types){const N=r.floors.length,W=300,t=8,h=Math.max(150,Math.min(230,N*3)),L=30,R=6,vh=t+h+22,cw=(W-L-R)/Math.max(types.length,1);
  const yOf=(j)=>t+(N-1-j)/N*h,byN=new Map();r.floors.forEach((f,j)=>{if(f.n!=null)byN.set(f.n,j)});
  const jOf=(n,end)=>{if(byN.has(n))return byN.get(n);let best=null;byN.forEach((j,k)=>{if(end?(k<=n&&(best==null||k>best[0])):(k>=n&&(best==null||k<best[0])))best=[k,j]});return best?best[1]:null};
  let o='<svg viewBox="0 0 '+W+' '+vh+'" xmlns="http://www.w3.org/2000/svg">';
  // zones: runs of non-home floors, shaded full width and named once
  let z=null;const zones=[];r.floors.forEach((f,j)=>{const nh=f.u!=="homes"&&f.u!=="hotel"&&f.u!=="villa";if(nh){if(z&&z.u===f.u&&z.b===j-1)z.b=j;else{z={u:f.u,a:j,b:j};zones.push(z)}}});
  zones.forEach(q=>{const y1=yOf(q.b),y2=yOf(q.a)+h/N;o+='<rect x="'+L+'" y="'+y1.toFixed(1)+'" width="'+(W-L-R)+'" height="'+(y2-y1).toFixed(1)+'" fill="'+stkHex(STKCOL[q.u]||STKCOL.services)+'" opacity=".55"/>';
    if(y2-y1>=11)o+='<text class=zl x="'+(W-R-4)+'" y="'+((y1+y2)/2+3).toFixed(1)+'" text-anchor="end">'+stkEsc(STKUSEN[q.u]||q.u)+'</text>'});
  // floor axis: every 10th floor, G and the roof
  for(let n=10;n<=Math.max(...byN.keys(),0);n+=10){if(byN.has(n)){const y=yOf(byN.get(n))+h/N/2;o+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="rgba(232,228,216,.08)"/><text x="'+(L-5)+'" y="'+(y+3).toFixed(1)+'" text-anchor="end">'+n+'</text>'}}
  o+='<text x="'+(L-5)+'" y="'+(yOf(0)+h/N/2+3).toFixed(1)+'" text-anchor="end">'+stkEsc(r.floors[0].l)+'</text>';
  // one column per type over its floor range
  types.forEach((T,k)=>{const x=L+k*cw+cw*0.22,w=cw*0.56,col=stkHex(STKCOL[T.c]||STKCOL.other);
    const a=T.lo!=null?jOf(T.lo,false):null,b=T.hi!=null?jOf(T.hi,true):null;
    o+='<rect x="'+x.toFixed(1)+'" y="'+t+'" width="'+w.toFixed(1)+'" height="'+h+'" rx="3" fill="rgba(232,228,216,.04)"/>';
    if(a!=null&&b!=null&&b>=a){const y1=yOf(b),y2=yOf(a)+h/N;o+='<rect x="'+x.toFixed(1)+'" y="'+y1.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+Math.max(2,y2-y1).toFixed(1)+'" rx="3" fill="'+col+'"/>'}
    const lab=T.c==="studio"?"Studio":/^[0-9]$/.test(T.c)?T.c+(T.c==="4"&&!/^4/.test(T.t)?"+":"")+" BR":String(T.t).slice(0,7);
    o+='<text class=tl x="'+(x+w/2).toFixed(1)+'" y="'+(t+h+14)+'" text-anchor="middle">'+stkEsc(lab)+'</text>'});
  o+='<g id=fmark></g></svg>';
  setTimeout(()=>{const sv=document.querySelector("#fstk svg");if(sv)sv.__g={t:t,h:h,vh:vh,L:L,W:W,R:R,N:N}},0);
  return o}
function stkMark(pp,r){const g=pp.querySelector("#fmark"),sv=pp.querySelector("#fstk svg");if(!g||!sv||!sv.__g)return;const G=sv.__g;
  if(STKFLOOR<0){g.innerHTML="";return}const y=G.t+(G.N-1-STKFLOOR)/G.N*G.h+G.h/G.N/2,f=r.floors[STKFLOOR];
  g.innerHTML='<line x1="'+(G.L-2)+'" x2="'+(G.W-G.R)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="#F4D58D" stroke-width="2"/><rect x="0" y="'+(y-7).toFixed(1)+'" width="'+(G.L-4)+'" height="14" rx="3" fill="#F4D58D"/><text x="'+((G.L-4)/2)+'" y="'+(y+3).toFixed(1)+'" text-anchor="middle" style="fill:#0C1413;font-weight:700">'+stkEsc(f.l)+'</text>'}
// the building panel gains a third view, Floor layout (Kendall, 19 Sep: "i prefer this to be the overall floor layout"), and opens on it when the building has a stack
function stkPanel(){const pp=document.getElementById("ppanel");if(!pp||!STKSEL||!pp.classList.contains("on"))return;
  const i=[...STKSEL].sort((a,b)=>STK.buildings_by_id[b].floors.length-STK.buildings_by_id[a].floors.length)[0],r=STK.buildings_by_id[i];
  const mb=pp.querySelector(".modeb");if(!mb||mb.querySelector('[data-m="floors"]'))return;
  const fb=document.createElement("button");fb.className="mb";fb.dataset.m="floors";fb.textContent="Floor layout";mb.appendChild(fb);
  mb.querySelectorAll(".mb").forEach(b=>b.addEventListener("click",()=>{pp.classList.toggle("floors",b.dataset.m==="floors");if(b.dataset.m==="floors"){pp.classList.remove("deep");mb.querySelectorAll(".mb").forEach(x=>x.classList.toggle("on",x===b))}}));
  const N=r.floors.length;
  const seen=new Map();r.types.forEach((T,ti)=>{if(T.c==="other"||!T.units)return;seen.set(ti,T)});
  const rows=stkChart(r,[...seen.values()]);
  const trs=[...seen.values()].slice(0,7).map(T=>'<tr><td><i style="background:'+stkHex(STKCOL[T.c]||STKCOL.other)+'"></i>'+stkEsc(T.t)+'</td><td>'+(T.lo!=null?(T.lo===T.hi?T.lo:T.lo+"-"+T.hi):"")+'</td><td>'+(T.units||"")+'</td><td>'+(T.aed?(T.est?"~":"")+stkFmtA(T.aed):"")+'</td><td>'+(T.yield?T.yield+"%":"")+'</td></tr>').join("");
  const unfit=r.fits===false?'<div class=fwarn>The floors are not drawn on the tower here: this footprint stands far lower in the model than the register building, so it is the podium of the scheme, or it carries a podium height. The layout below is the register and stands on its own.</div>':"";
  const basis=r.basis==="dm_floors"?"Floors from the Dubai Municipality floor register (building "+stkEsc(r.dm)+(r.label?", permit "+stkEsc(String(r.label).replace(/ +/g,""))+")":")")+(r.basements?"; "+r.basements+" basement"+(r.basements>1?"s":"")+" not drawn":"")
    :"No Municipality floor register on this building yet: floors from the Land Department register's "+N+" levels";
  // the register record and the map disagree on which building this is: one of the two bindings is wrong, and the floors below
  // are the register's. Say it rather than draw one building's floors on another in silence (footprint 53, Business Bay).
  const clash=r.conflict?'<div class=fwarn>The map calls this building '+stkEsc(r.conflict)+'. These floors are the register record for '+stkEsc(r.name)+' - one of the two is bound to the wrong footprint, so read them with care.</div>':"";

  const d=document.createElement("div");d.className="flr";
  d.innerHTML=clash+unfit+'<div class=flh>Floor layout <span>'+N+' levels'+(r.basements?' + '+r.basements+' below ground':'')+'</span></div><div class=fstk id=fstk>'+rows+'</div><div class=fdet id=fdet>Tap a floor, here or on the tower.</div>'+
    (trs?'<table class=ftyp><tr><th>type</th><th>floors</th><th>units</th><th>median</th><th>yield</th></tr>'+trs+'</table>':'')+
    '<div class=fbas>'+basis+'. A type on a floor means the Land Department register puts that type in this floor range, not a unit position.'+(r.level_shift?" The register numbers levels "+r.level_shift+" higher than the permit here; its ranges are shifted to match.":"")+' The tower is the CityEngine model at its surveyed height, divided evenly.</div>';
  const pn=pp.querySelector(".pn");pp.insertBefore(d,pn||null);
  d.querySelector("#fstk").onclick=(e)=>{const sv=d.querySelector("#fstk svg");if(!sv)return;const bx=sv.getBoundingClientRect(),g=sv.__g;
    const y=(e.clientY-bx.top)*g.vh/bx.height;if(y<g.t||y>g.t+g.h)return;stkPick(i,Math.max(0,Math.min(N-1,N-1-Math.floor((y-g.t)/g.h*N))))};
  fb.click()}
function stkPick(i,j){if(!STK||i==null)return;const r=STK.buildings_by_id[i];if(!r)return;STKFLOOR=(STKFLOOR===j)?-1:j;stkApply();
  const pp=document.getElementById("ppanel");if(!pp)return;stkMark(pp,r);
  const det=pp.querySelector("#fdet");if(!det)return;if(STKFLOOR<0){det.textContent="Tap a floor, here or on the tower.";return}
  const f=r.floors[j];const ty=(f.t||[]).map(t=>r.types[t]).filter(T=>T&&T.c!=="other");
  det.innerHTML='<b>'+(f.n!=null?"Floor "+f.n:({G:"Ground",M:"Mezzanine",R:"Roof",PH:"Penthouse"}[f.l]||f.l))+'</b> · '+(f.k?f.k+" "+(f.u==="office"?"offices":f.u==="retail"?"shops":"homes"):STKUSEN[f.u]||f.u)+(f.a?" · "+Math.round(f.a*10.764).toLocaleString("en")+" sq ft":"")+
    (ty.length?'<br>'+ty.map(T=>stkEsc(T.t)+(T.aed?" · "+(T.est?"~":"")+"AED "+stkFmtA(T.aed):"")+(T.sqm?" · "+Math.round(T.sqm*10.764).toLocaleString("en")+" sq ft":"")).join("<br>"):"")}
// every change of selection repaints the stack after the page's own ghosting has run
const _stkAP=applyProj;applyProj=function(name){STKFLOOR=-1;_stkAP(name);const p=document.getElementById("stkp");if(p)p.classList.toggle("on",STKON&&!SELPROJ);if(STK){stkApply();stkPanel()}};
const _stkAD=applyDev;applyDev=function(d){_stkAD(d);if(STK)stkApply()};
// a tap on a band: inside the open building it picks the floor; anywhere else it opens that building. Raycasts ignore clipping,
// so a hit only counts where it lands inside its own band.
addEventListener("pointerup",e=>{if(!STK||!STKB.size||!pd||Math.hypot(e.clientX-pd[0],e.clientY-pd[1])>6)return;
  if(e.target&&e.target.closest&&e.target.closest("#ppanel,#stkp,#devwrap,.lb,.nnav,.rail,.tog,.feat"))return;
  ptr.x=(e.clientX/innerWidth)*2-1;ptr.y=-(e.clientY/innerHeight)*2+1;ray.setFromCamera(ptr,cam);
  const all=[];STKB.forEach(b=>b.bands.forEach(x=>all.push(x)));
  const h=ray.intersectObjects(all,false).find(x=>{const u=x.object.userData.stk;return x.point.y>=u.lo-0.05&&x.point.y<=u.hi+0.05});if(!h)return;
  const u=h.object.userData.stk;e.stopImmediatePropagation();pd=null;
  if(STKSEL&&STKSEL.has(u.i)){stkPick(u.i,Math.max(u.j0,Math.min(u.j1,Math.floor((h.point.y-u.y0)/u.fh))));return}
  stkOpen(u.i)});
