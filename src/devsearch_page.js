// v403 - THE SEARCH BUTTON on the Developers-by-area page (Kendall, 8 Oct 2026: "add a search button here").
// One button (magnifier and the word Search) in the page header, outside the side body, so it is the same on all three tabs (1 My developers, 2 Where, 3 Client meeting).
// A tap opens a full-width search panel over the sidebar: one input (autofocus), a clear button and a close button.
// WHAT IT SEARCHES: the developers (IDX.devs: name, alias map, tags), every project card in the index (IDX.areas[*].devs[*].b), the not-confirmed projects (IDX.nconf and KV notconf),
// the registered-no-sales group (KORE and the others), the announced group, and every register project on the site's search list (/img/plots sx, else /img/search_index development rows).
// MATCHING is the Find page's and the map's: the normalised name (lower case, letters and digits, Arabic letters folded), exact then prefix then word-prefix then contains; a project number; the Arabic name;
// the developer's name on a project line. RANK: developers first, then projects, then areas. Eight at a time, then "Show more". NOTHING IS COUNTED anywhere in this module.
// OPENING: a developer is picked as in tab 1 and its profile opens; a project opens the usual Project details panel (pjCard then pdOpen: accordion and the three document buttons);
// a register project with no card yet opens the same panel from its register record and says so when it has no position; an area is selected.
// Absent data (an older key set: no group files, no sx) = developers and cards only, no error. Every hook in src/devmap_page.js is typeof DEVSEARCH !== "undefined".
// String.raw, no substitutions and no backticks (the rule the page script keeps), checked with node --check by test/test_v403_devsearch.mjs.
import { PHOSPHOR_LIGHT } from "./devmap_icons.js";

const ICON_NAMES = ["magnifying-glass", "x", "buildings", "stack", "map-pin"];
const ICONS = Object.fromEntries(ICON_NAMES.map((n) => [n, PHOSPHOR_LIGHT[n] || []]));
const svg = (n, c) => '<svg class="' + c + '" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">' + (ICONS[n] || []).map((d) => '<path d="' + d + '"/>').join("") + "</svg>";

// the button, placed in the page header beside the title (the markup is static: renderAll never touches it)
export const DEVSEARCH_BTN = '<button type=button id=dsbtn class=dsbtn aria-haspopup=dialog aria-expanded=false aria-controls=dspanel aria-label="Search developers, projects and areas">' + svg("magnifying-glass", "dsic") + "<span>Search</span></button>";

export const DEVSEARCH_CSS = String.raw`
.dstr{display:flex;align-items:center;justify-content:space-between;gap:10px}.dstr h1{flex:1;min-width:0}
.dsbtn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;min-width:44px;padding:0 14px;border:1px solid var(--gold);border-radius:8px;background:var(--raise);color:var(--ink);font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;flex:none}
.dsbtn:hover{background:var(--panel)}.dsic{width:18px;height:18px;flex:none;display:block}
.dspanel{position:fixed;top:0;bottom:0;left:0;width:340px;z-index:30;display:flex;flex-direction:column;background:var(--panel);border-right:1px solid var(--line);padding:14px;padding-top:calc(14px + env(safe-area-inset-top));box-sizing:border-box}
.dspanel[hidden]{display:none}
.dsbar{display:flex;gap:8px;align-items:center}.dsbar input{flex:1;min-width:0;min-height:44px;font-size:16px}
.dsbar button{flex:none;width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:8px;background:var(--raise);color:var(--ink);cursor:pointer;padding:0}
.dsbar input::-webkit-search-cancel-button{-webkit-appearance:none;display:none}.dsbar .dsclose{width:auto;min-width:44px;padding:0 12px;font:inherit;font-size:13px;font-weight:600}.dsbar button[hidden]{display:none}.dsbar button svg{width:18px;height:18px}
.dslive{color:var(--muted);font-size:12px;margin:8px 2px 6px;min-height:16px}
.dsres{flex:1;overflow:auto;-webkit-overflow-scrolling:touch}
.dsr{display:block;width:100%;text-align:left;min-height:44px;margin:0 0 6px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--raise);color:var(--ink);font:inherit;cursor:pointer}
.dsr:hover,.dsr:focus-visible{border-color:var(--gold)}
.dsr .dst{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:10.5px;text-transform:uppercase;letter-spacing:.7px}.dsr .dst svg{width:14px;height:14px;flex:none}
.dsr b{display:block;font-size:14px;overflow-wrap:anywhere}.dsr .dsar{display:block;color:var(--muted);font-size:12.5px;text-align:right}
.dsr .dsm{display:block;color:var(--muted);font-size:11.5px;overflow-wrap:anywhere}.dsr .dsev{display:inline-block;margin-top:3px;border:1px solid var(--gold);border-radius:9px;padding:0 7px;font-size:10.5px;color:var(--ink)}
.dsr .dsg{display:block;color:var(--muted);font-size:11px;margin-top:2px}
.dsmore{display:block;width:100%;min-height:44px;margin:4px 0 10px;border:1px solid var(--gold);border-radius:8px;background:var(--raise);color:var(--ink);font:inherit;font-weight:600;cursor:pointer}
@media (max-width:760px){.dspanel{width:100%;right:0;border-right:0}}
`;

export const DEVSEARCH_JS = "var DSI=" + JSON.stringify(ICONS) + ";" + String.raw`
var DEVSEARCH=(function(){
  var C=null,CAT=null,SXL=null,SHOWN=8,STEP=8,LAST=[],QV="",PANEL=null,INP=null,CLR=null,CLS=null,LIVE=null,RES=null,BTN=null,LOADING=0;
  var EVW={REGISTER_VERIFIED:"Register verified",NAME_ONLY:"Name only, the register does not confirm it",DEVELOPER_CLAIMED:"The developer says it, not on a register",UNVERIFIED:"Not verified"};
  var GRP={card:"",nosales:"Registered, no unit sales yet",notconf:"Not confirmed, outside the numbers",announced:"Announced by the developer, not on any register we hold",reg:"Register project, no card on this page yet"};
  var SRCRANK={card:0,nosales:1,notconf:2,announced:3,reg:4};
  function ico(n,c){return '<svg class="'+c+'" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">'+((DSI&&DSI[n])||[]).map(function(d){return '<path d="'+d+'"/>'}).join("")+'</svg>'}
  function e2(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
  // the normalised name: lower case, letters and digits only, Arabic letters folded (alef forms, ya, ta marbuta, marks), one space between words
  function nk(t){return String(t==null?"":t).toLowerCase().replace(/[ً-ٟـ]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[^a-z0-9؀-ۿ]+/g," ").replace(/\s+/g," ").trim()}
  function uniq(a){var o=[],s={};a.forEach(function(x){if(x&&!s[x]){s[x]=1;o.push(x)}});return o}
  function evLabel(code,src){return EVW[code]||(src==="card"?"From the sales register":"")}
  function mkProj(o){o.f=uniq([nk(o.name),o.ar?nk(o.ar):""]);o.pnk=o.pn!=null&&o.pn!==""?String(o.pn).replace(/\D/g,""):"";o.dvk=nk(o.dv);o.t=1;return o}
  // ---- the catalogue ----
  function build(){
    var ix=(C&&C.idx&&C.idx())||{},devs=ix.devs||{},areas=ix.areas||{},cat={dev:[],proj:[],area:[]},seen={},names={},raw=(C&&C.raw)||{},mods=(C&&C.mods)||{},tags=(C&&C.tags)||{};
    var alias={};Object.keys(ix.alias||{}).forEach(function(a){var t=ix.alias[a];(alias[t]=alias[t]||[]).push(a)});
    var dn=function(k){return (devs[k]&&devs[k].name)||k};
    Object.keys(devs).forEach(function(k){var d=devs[k]||{},f=[nk(d.name||k),nk(k)];(alias[k]||[]).forEach(function(a){f.push(nk(a))});(tags[k]||[]).forEach(function(a){f.push(nk(a))});(Array.isArray(d.aliases)?d.aliases:[]).forEach(function(a){f.push(nk(a))});
      cat.dev.push({t:0,k:k,name:d.name||k,f:uniq(f)})});
    Object.keys(areas).forEach(function(s){var A=areas[s]||{};cat.area.push({t:2,slug:s,name:A.name||s,f:uniq([nk(A.name||s),nk(s)].concat((A.comms||[]).map(nk)))})});
    function add(p){var key=p.src+"|"+(p.slug||"")+"|"+(p.k||"")+"|"+nk(p.name);if(seen[key])return;seen[key]=1;names[nk(p.name)]=1;cat.proj.push(mkProj(p))}
    Object.keys(areas).forEach(function(s){var A=areas[s]||{},ds=A.devs||{};Object.keys(ds).forEach(function(k){var d=ds[k]||{};(d.b||[]).forEach(function(b,i){var nm=b&&b[2];if(!nm)return;var ev=d.bx&&d.bx[i]?d.bx[i]:null;
      add({src:"card",name:nm,pn:ev&&ev.p,dv:dn(k),a:A.name||s,ec:ev&&ev.e||"",slug:s,k:k,ppsm:b[1],n:b[0],ev:ev})})})});
    Object.keys(ix.nconf||{}).forEach(function(k){var l=ix.nconf[k]&&ix.nconf[k].all;(l||[]).forEach(function(q){if(!q||!q.name)return;var ev=q.ev||null;add({src:"notconf",name:q.name,pn:ev&&ev.p,dv:dn(k),a:q.area||"",ec:ev&&ev.e||"NAME_ONLY",slug:q.slug,k:k,ppsm:q.ppsm,n:q.n,ev:ev})})});
    function grp(src,data,mod){if(!data||typeof data!=="object"||!data.d||typeof data.d!=="object")return;
      Object.keys(data.d).forEach(function(k){var ds=data.d[k];if(!ds||typeof ds!=="object")return;Object.keys(ds).forEach(function(s){(Array.isArray(ds[s])?ds[s]:[]).forEach(function(e){if(!e||typeof e.n!=="string"||!e.n)return;
        var ev=null;try{ev=mod&&mod.evOf?mod.evOf(e):null}catch(x){ev=null}
        add({src:src,name:e.n,pn:ev&&ev.p!=null?ev.p:null,dv:k==="_"?"":(src==="announced"&&e.dn?e.dn:dn(k)),a:e.od?e.od:(e.a||(areas[s]&&areas[s].name)||""),ec:ev&&ev.e||(src==="announced"?"DEVELOPER_CLAIMED":"NAME_ONLY"),slug:src==="announced"?"~ann-"+k:s,k:k,ppsm:null,n:null,ev:ev})})})})}
    grp("nosales",raw.nosales,mods.NOSALES);grp("notconf",raw.notconf,mods.NOTCONF);grp("announced",raw.announced,mods.ANNOUNCED);
    cat.names=names;cat.reg=[];CAT=cat;if(SXL)addReg(SXL);return cat}
  // the register projects from the site's search list: a name already on a card or in a group is not listed twice
  function addReg(list){if(!CAT)return;CAT.reg=[];(Array.isArray(list)?list:[]).forEach(function(x){if(!x||typeof x.n!=="string"||!x.n)return;if(CAT.names[nk(x.n)])return;
    CAT.reg.push(mkProj({src:"reg",name:x.n,ar:x.ar||"",pn:x.pn,dv:x.dv||"",a:x.a||"",ec:x.ev||"UNVERIFIED",x:x}))})}
  function loadSx(j){SXL=j&&Array.isArray(j.sx)?j.sx:null;if(CAT)addReg(SXL||[]);return SXL?SXL.length>0:false}
  // the Find page's list when the plots feed has no sx: its development rows with off=1 are register projects without a card (no position kept there)
  function loadIndex(j){if(SXL&&SXL.length)return false;var l=[];((j&&j.items)||[]).forEach(function(r){if(r&&r.off&&r.n)l.push({n:r.n,ar:r.ar,pn:r.pn,a:r.a,dv:r.lg,ev:r.ev,st:r.rs,u:r.units,d:r.d})});SXL=l.length?l:null;if(CAT)addReg(SXL||[]);return l.length>0}
  // ---- matching ----
  function sName(f,q,toks){var best=0;for(var i=0;i<f.length;i++){var s=f[i];if(!s)continue;var v=0;
    if(s===q)v=100;else if(s.indexOf(q)===0)v=80;else{var ws=s.split(" ");
      if(toks.length===1){if(ws.some(function(w){return w.indexOf(q)===0}))v=60}
      else if(toks.every(function(t){return ws.some(function(w){return w.indexOf(t)===0})}))v=55;
      if(!v&&q.length>=3&&s.indexOf(q)>=0)v=30;
      if(!v&&toks.length>1&&toks.every(function(t){return s.indexOf(t)>=0}))v=25}
    if(v>best)best=v}return best}
  function search(raw){var q=nk(raw);if(!CAT)build();if(q.length<2&&!/^\d+$/.test(q))return [];
    var toks=q.split(" ").filter(Boolean),m=q.match(/^(?:project|proj|pn|no|number)\s+(\d+)$/),num=m?m[1]:(/^\d+$/.test(q)?q:""),out=[];
    CAT.dev.forEach(function(d){var s=sName(d.f,q,toks);if(s>0)out.push({it:d,s:s})});
    var all=CAT.proj.concat(CAT.reg||[]);
    all.forEach(function(p){var s=0;if(num){if(p.pnk===num)s=95;else if(num.length>=3&&p.pnk&&p.pnk.indexOf(num)===0)s=50}
      var sn=num&&m?0:sName(p.f,q,toks);if(sn>s)s=sn;
      if(!s&&q.length>=3&&p.dvk&&toks.every(function(t){return p.dvk.split(" ").some(function(w){return w.indexOf(t)===0})}))s=20;
      if(s>0)out.push({it:p,s:s})});
    CAT.area.forEach(function(a){var s=sName(a.f,q,toks);if(s>0)out.push({it:a,s:s})});
    out.sort(function(a,b){return a.it.t-b.it.t||b.s-a.s||(SRCRANK[a.it.src]||0)-(SRCRANK[b.it.src]||0)||a.it.name.length-b.it.name.length||(a.it.name<b.it.name?-1:a.it.name>b.it.name?1:0)});
    return out.map(function(r){return r.it})}
  // ---- the results ----
  function line(p){var a=[];if(p.dv)a.push(p.dv);if(p.a)a.push(p.a);if(p.pnk)a.push("project "+p.pnk);return a.join(" · ")}
  function resHtml(it,i){
    if(it.t===0)return '<button type=button class="dsr dsdev" data-i="'+i+'"><span class=dst>'+ico("buildings","dsi")+'Developer</span><b dir=auto>'+e2(it.name)+'</b></button>';
    if(it.t===2)return '<button type=button class="dsr dsarea" data-i="'+i+'"><span class=dst>'+ico("map-pin","dsi")+'Area</span><b dir=auto>'+e2(it.name)+'</b></button>';
    var ev=evLabel(it.ec,it.src);
    return '<button type=button class="dsr dsproj" data-i="'+i+'" data-src="'+it.src+'"><span class=dst>'+ico("stack","dsi")+'Project</span><b dir=auto>'+e2(it.name)+'</b>'+(it.ar?'<span class=dsar dir=rtl lang=ar>'+e2(it.ar)+'</span>':'')
      +'<span class=dsm dir=auto>'+e2(line(it))+'</span>'+(GRP[it.src]?'<span class=dsg>'+e2(GRP[it.src])+'</span>':'')+(ev?'<span class=dsev data-ev="'+e2(it.ec||"")+'">'+e2(ev)+'</span>':'')+'</button>'}
  function say(t){if(LIVE)LIVE.textContent=t}
  function render(){var raw=INP?INP.value:QV;QV=raw;if(CLR)CLR.hidden=!raw;LAST=search(raw);SHOWN=STEP;paint();
    if(!nk(raw))say(LOADING?"Loading the register list.":"Type a developer, a project, a project number or an area.");
    else say(LAST.length?"Results are listed below. Developers first, then projects, then areas.":"Nothing matches that. Try part of the name, the project number or the developer.")}
  function paint(){if(!RES)return;var h="";LAST.slice(0,SHOWN).forEach(function(it,i){h+=resHtml(it,i)});
    if(LAST.length>SHOWN)h+='<button type=button class=dsmore data-more="1">Show more</button>';
    if(!LAST.length&&nk(QV))h='<p class=note>No developer, project or area by that name. Try part of the name, the project number or the developer.</p>';
    RES.innerHTML=h}
  function showMore(){var was=SHOWN;SHOWN+=STEP;paint();say("More results are listed below.");
    if(RES&&RES.querySelectorAll){var l=RES.querySelectorAll(".dsr");if(l&&l[was]&&l[was].focus)l[was].focus()}}
  // ---- opening a result ----
  function openReg(x){var ev={p:x.pn||null,e:x.ev||"UNVERIFIED",dn:x.dv||"",a:x.a||"",as:"register_master",st:x.st||null,pc:null,pe:null,u:x.u||null,pl:null,sx:1};
    C.openCard(x.d||"~reg",x.n,null,null,ev);
    var has=typeof x.lo==="number"&&typeof x.la==="number",m=C.map&&C.map(),el=C.panel&&C.panel(),why;
    if(has){why=x.k==="p"?"Map centred on the registered plot, not on a building.":"Map centred on the middle of the community, not on the project and not on a building.";
      if(m&&m.easeTo){if(C.collapse)C.collapse();m.easeTo({center:[x.lo,x.la],zoom:Math.max(m.getZoom?m.getZoom():0,14.2),duration:700})}}
    else why="No position on our map yet: the register lists the project but not where it stands.";
    var h=el&&el.querySelector?el.querySelector(".pdh"):null;if(h&&h.insertAdjacentHTML)h.insertAdjacentHTML("afterend",'<p class="note dsnopos" role=status>'+e2(why)+'</p>');
    return why}
  function act(it){
    if(it.t===0){C.pick(it.k);return}
    if(it.t===2){C.select(it.slug);return}
    if(it.src==="reg"){openReg(it.x);return}
    C.openCard(it.slug,it.name,it.ppsm,it.n,it.ev)}
  function open(i){var it=LAST[i];if(!it)return false;
    try{close(true);act(it);return true}catch(x){openPanel();say("Could not open that one. Try another result.");return false}}
  // ---- the panel ----
  function mk(tag,id,par,att){var e=document.createElement(tag);if(id)e.id=id;if(att)Object.keys(att).forEach(function(k){e.setAttribute(k,att[k])});if(par)par.appendChild(e);return e}
  function ensure(){if(PANEL)return;PANEL=mk("div","dspanel",document.body,{"role":"search","aria-label":"Search developers, projects and areas"});PANEL.className="dspanel";PANEL.hidden=true;
    var bar=mk("div","",PANEL);bar.className="dsbar";
    INP=mk("input","dsq",bar,{"type":"search","placeholder":"Developer, project, number or area","aria-label":"Search developers, projects and areas","autocomplete":"off","autocapitalize":"off","spellcheck":"false","enterkeyhint":"search"});
    CLR=mk("button","dsclr",bar,{"type":"button","aria-label":"Clear the search"});CLR.innerHTML=ico("x","dsic");CLR.hidden=true;
    CLS=mk("button","dsx",bar,{"type":"button","aria-label":"Close the search"});CLS.textContent="Close";CLS.className="dsclose";
    LIVE=mk("div","dslive",PANEL,{"role":"status","aria-live":"polite"});LIVE.className="dslive";
    RES=mk("div","dsres",PANEL,{"role":"list"});RES.className="dsres";
    INP.oninput=function(){render()};
    CLR.onclick=function(){INP.value="";render();if(INP.focus)INP.focus()};
    CLS.onclick=function(){close(false)};
    INP.onkeydown=function(e){if(e.key==="Enter"){if(e.preventDefault)e.preventDefault();if(LAST.length)open(0)}
      else if(e.key==="ArrowDown"){var l=RES.querySelectorAll?RES.querySelectorAll(".dsr"):[];if(l&&l[0]&&l[0].focus){if(e.preventDefault)e.preventDefault();l[0].focus()}}};
    PANEL.onkeydown=function(e){if(e.key==="Escape"){if(e.preventDefault)e.preventDefault();close(false);return}
      if((e.key==="ArrowDown"||e.key==="ArrowUp")&&e.target&&e.target.classList&&e.target.classList.contains("dsr")){var l=RES.querySelectorAll(".dsr"),ix=-1,j;for(j=0;j<l.length;j++)if(l[j]===e.target)ix=j;
        var nx=e.key==="ArrowDown"?ix+1:ix-1;if(nx<0){if(e.preventDefault)e.preventDefault();INP.focus();return}if(l[nx]){if(e.preventDefault)e.preventDefault();l[nx].focus()}}};
    PANEL.onclick=function(e){var t=e&&e.target,b=t&&t.closest?t.closest("[data-i],[data-more]"):null;if(!b)return;
      if(b.getAttribute("data-more")){showMore();return}open(Number(b.getAttribute("data-i")))}}
  function openPanel(){ensure();PANEL.hidden=false;if(BTN)BTN.setAttribute("aria-expanded","true");
    if(!SXL&&!LOADING)loadFeeds();
    render();if(INP&&INP.focus)INP.focus()}
  function close(keep){if(!PANEL)return;PANEL.hidden=true;if(BTN){BTN.setAttribute("aria-expanded","false");if(!keep&&BTN.focus)BTN.focus()}}
  function loadFeeds(){var f=C&&C.fetch;if(!f)return;LOADING=1;
    var get=function(u){return f(u,{referrerPolicy:"no-referrer"}).then(function(r){return r&&r.ok?r.json():null})};
    get("/img/plots").then(function(j){return loadSx(j)?true:get("/img/search_index").then(loadIndex)}).catch(function(){return false}).then(function(){LOADING=0;if(PANEL&&!PANEL.hidden&&INP&&nk(INP.value))render()})}
  function init(ctx){C=ctx||{};CAT=null;SXL=null;LOADING=0;PANEL=null;INP=null;CLR=null;CLS=null;LIVE=null;RES=null;BTN=document.getElementById("dsbtn");if(BTN)BTN.onclick=function(){if(PANEL&&!PANEL.hidden)close(false);else openPanel()};return !!BTN}
  return {init:init,build:build,search:search,nk:nk,loadSx:loadSx,loadIndex:loadIndex,open:open,openPanel:openPanel,close:close,openReg:openReg,labels:EVW,stats:function(){return {built:!!CAT}}}
})();
`;
