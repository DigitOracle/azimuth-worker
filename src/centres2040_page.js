// v380 - DUBAI 2040 CENTRES on the Developers-by-area page (the data is src/centres2040.js + KV img_centres2040).
// The page script gets this module ahead of its own script (CENTRES_JS defines the global CENTRES2040 with one factory, make(ctx)); src/devmap_page.js calls it
// through a handful of guarded hooks (every hook is typeof CF !== "undefined" && CF, so an old page, a missing data file or a test stub changes nothing).
//
//   THE OPENING: with the data present (and no ?bands=1) the map opens on the five centres as large coloured areas, each labelled with its number and name; core and adjacent areas solid,
//   peripheral ones in a lighter tint; everything else neutral. Price-band shading is an optional layer that appears once a centre, an area or a developer is chosen.
//   ?bands=1 restores the old opening. No data file: the old opening.
//   THE FILTER BAR: upper-left of the map on every screen: Centre, Coastal, Area, Developer, Price band, Window (and the developer lock chips, when a developer is locked, take the place of
//   the last four so the bar never says the same thing twice). A tap opens the choices, x clears.
//   THE GROUPING IS OURS: the plan (Dubai 2040 Urban Master Plan, UAE Government, 13 Mar 2021) names five centres and their roles, it publishes no boundaries. The sixth layer, coastal, is Najma's.
//
// String.raw, no substitutions and no backticks (the rule src/devmap_page.js keeps); checked with node --check by test/test_v380_centres.mjs.
import { PHOSPHOR_LIGHT } from "./devmap_icons.js";

export const CENTRES_CSS = String.raw`
#fbar{position:absolute;left:8px;top:8px;z-index:6;display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;width:max-content;max-width:calc(100% - 64px)}
#fbmain,#fbar #lockchips{display:contents}
#fbar #lockchips{position:static;max-width:none}
#fbar .fg{display:inline-flex;align-items:center;max-width:100%;background:#0e1413;border:1px solid var(--line);border-radius:999px}
#fbar .fg.on{border-color:var(--gold)}
#fbar .fchip{display:inline-flex;align-items:center;gap:5px;min-height:34px;min-width:0;max-width:100%;background:none;border:0;color:#f5efe2;border-radius:999px;padding:3px 9px;font:inherit;font-size:12px;cursor:pointer}
#fbar .fchip .fl{color:var(--muted);font-size:11px;white-space:nowrap}
#fbar .fchip b{min-width:0;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
#fbar .fchip .fcv{width:12px;height:12px;flex:none;color:var(--muted)}
#fbar .fchip .evi{width:14px;height:14px;flex:none;color:var(--gold)}
#fbar .fx{display:inline-flex;align-items:center;justify-content:center;min-width:30px;min-height:30px;background:none;border:0;color:#f5efe2;cursor:pointer;padding:0;margin-right:2px}
#fbar .fx .evi{width:13px;height:13px;color:#f5efe2}
#fbar .fsw .swk{display:inline-block;width:26px;height:14px;border-radius:7px;background:#3a4a48;position:relative;flex:none}
#fbar .fsw .swk::after{content:"";position:absolute;left:2px;top:2px;width:10px;height:10px;border-radius:50%;background:#f5efe2}
#fbar .fsw[aria-checked="true"] .swk{background:#4aa6c4}
#fbar .fsw[aria-checked="true"] .swk::after{left:14px}
#fbar .fwf{font-size:10.5px;color:var(--muted);white-space:nowrap}
#fbar #lockchips .chip{cursor:pointer}
#fbar button:focus-visible,#fbar .chip:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
#fbar .fmenu{order:9;flex:0 0 100%;min-width:min(300px,calc(100vw - 80px));max-height:min(46vh,380px);overflow:auto;background:#0e1413;border:1px solid var(--gold);border-radius:10px;padding:8px;color:#f5efe2}
#fbar .fmh{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}
#fbar .fmh b{font-size:12.5px}
#fbar .fopts{display:grid;grid-template-columns:1fr 1fr;gap:6px}
#fbar .fopt{display:flex;align-items:center;gap:7px;text-align:left;min-width:0;min-height:40px;background:var(--raise);border:1px solid var(--line);border-radius:8px;padding:6px 8px;color:#f5efe2;font:inherit;font-size:12px;cursor:pointer;overflow-wrap:anywhere}
#fbar .fopt.on{border-color:var(--gold)}
#fbar .fopt small{display:block;color:var(--muted);font-size:10.5px}
#fbar .fopt.wide{grid-column:1/-1}
#fbar .fnote{grid-column:1/-1;margin:0;color:var(--muted);font-size:11px}
.cnum{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;flex:none;border-radius:50%;color:#0b1211;font-weight:800;font-size:13px}
.cg2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px}
.cg2 .ccard:last-child:nth-child(odd){grid-column:1/-1}
.ccard{display:flex;gap:8px;align-items:flex-start;text-align:left;border:1px solid var(--line);border-radius:10px;padding:8px;min-width:0;overflow-wrap:anywhere;font-size:12px;background:var(--raise);color:inherit;font-family:inherit;cursor:pointer}
.ccard:hover,.ccard:focus-visible{border-color:var(--gold)}
.ccard .cbody{display:block;min-width:0}.ccard b{display:block;font-size:13px}
.ccard .cst{display:block;color:var(--gold);font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;margin-top:1px}
.ccard .crole{display:block;color:var(--muted);font-size:11.5px;margin-top:2px}
.ccard .cstock{display:block;font-size:11.5px;margin-top:4px}
.cder{background:#8a9a96;margin-left:2px;display:inline-block;vertical-align:baseline}
#cencard>.btn{display:inline-flex;align-items:center;gap:6px;min-height:36px}#cencard>.btn .evi{width:14px;height:14px;flex:none;transform:rotate(90deg)}
.cenhd{display:flex;gap:10px;align-items:center;margin:10px 0 6px}.cenhd h2{margin:0}
.cbadge{display:inline-block;border:1px solid #4aa6c4;color:#bfe6f2;border-radius:9px;padding:0 7px;font-size:10.5px;margin:2px 4px 2px 0}
.cbadge.pe{border-color:var(--muted);color:var(--muted)}
.cstat{border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--raise);min-width:0}.cstat b{display:block;font-family:Fraunces,Georgia,serif;font-size:17px;line-height:1.15}.cstat small{display:block;color:var(--muted);font-size:11px}
.csw{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:1px solid var(--line);border-radius:10px;background:var(--raise);color:var(--ink);font:inherit;font-size:13px;padding:9px;cursor:pointer;min-height:40px}
.csw[aria-checked="true"]{border-color:#4aa6c4}
.csw .swk{display:inline-block;width:30px;height:16px;border-radius:8px;background:#3a4a48;position:relative;flex:none}
.csw .swk::after{content:"";position:absolute;left:2px;top:2px;width:12px;height:12px;border-radius:50%;background:#f5efe2}
.csw[aria-checked="true"] .swk{background:#4aa6c4}.csw[aria-checked="true"] .swk::after{left:16px}
.cenline{border-left:3px solid var(--gold)}
body #bsnap,body.locked #bsnap{top:var(--fbh,56px)!important}
@media(max-width:760px){#side.max{height:min(88vh,calc(100vh - var(--fbh,56px) - 4px))}}
@media(max-width:560px){#fbar{gap:5px}#fbar .fchip{min-height:34px;padding:3px 7px;font-size:11.5px;gap:4px}#fbar .fchip .fl{display:none}#fbar .fchip.fsw .fl{display:inline}#fbar .fchip b{max-width:112px}#fbar .fwf{display:none}#fbar .fx{min-width:28px}}
@media(max-width:360px){#fbar .fchip b{max-width:96px}.cg2{grid-template-columns:1fr}}
`;

const NEED = ["map-trifold", "map-pin", "buildings", "chart-bar", "stack", "caret-down", "x", "info"];
const CENI = JSON.stringify(Object.fromEntries(NEED.map((n) => [n, PHOSPHOR_LIGHT[n] || []])));

const CORE = String.raw`
var NOTE="Our grouping of districts; the plan names the centres, not their boundaries",SRC="Dubai 2040 Urban Master Plan, UAE Government, 13 Mar 2021";
var TW={c:"Core",a:"Adjacent",p:"Peripheral in our grouping"};
var EVW={N:"Named in the plan (the district; our list of its communities)",D:"Our grouping (DERIVED_NEAREST)"};
var ABBR={3:"JBR means Jumeirah Beach Residence."};
var DEF=[55.2,25.08];
function ico(n,cl){return '<svg class="'+(cl||"evi")+'" viewBox="0 0 256 256" fill=currentColor aria-hidden=true>'+((CENI[n])||[]).map(function(d){return '<path d="'+d+'"/>'}).join("")+'</svg>'}
function X(t){return String(t==null?"":t).replace(/[&<>"]/g,function(m){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[m]})}
function fm(n){return n==null?"-":Math.round(n).toLocaleString("en-US")}
function inR(r,x,y){var o=false,i,j=r.length-1;for(i=0;i<r.length;j=i++){if(((r[i][1]>y)!==(r[j][1]>y))&&(x<(r[j][0]-r[i][0])*(y-r[i][1])/(r[j][1]-r[i][1])+r[i][0]))o=!o}return o}
function make(c){
var S=c.S,D=null,RC={},CBY={},CF={NOTE:NOTE,SRC:SRC,TW:TW,EVW:EVW};
function valid(d){return !!(d&&d.centres&&d.centres.length===5&&d.comms&&d.comms.length&&d.sl&&d.geo&&d.geo.features&&d.geo.features.length)}
CF.load=function(d){D=valid(d)?d:null;RC={};CBY={};S.cen=null;S.coast=false;S.cshade=true;S.bandsAsk=false;S.fmenu=null;S.cenAll=false;S.bflag=false;
  if(D){D.centres.forEach(function(e){CBY[e.id]=e});try{S.bflag=new URLSearchParams(location.search).get("bands")==="1"}catch(e){}}};
CF.on=function(){return !!D};
CF.data=function(){return D};
function locked(){return !!(S.prof&&S.screen===1)}
function chosen(){return S.cen!=null||!!S.sel||!!S.prof||!!S.bandsAsk}
function fillMode(){return !!D&&!S.bflag&&S.screen===1&&!chosen()}
CF.fillMode=fillMode;
CF.noBands=function(){if(!D||S.screen!==1)return false;if(fillMode())return true;return S.cshade===false};
CF.hideBands=CF.noBands;
// ---- which centre an area stands in: the area's own key, then the Dubai Municipality community it stands on, then its position ----
function pip(x,y){var fs=D.geo.features,i,j,k,g,ps,h;for(i=0;i<fs.length;i++){g=fs[i].geometry;ps=g.type==="Polygon"?[g.coordinates]:g.coordinates;for(j=0;j<ps.length;j++){if(inR(ps[j][0],x,y)){h=false;for(k=1;k<ps[j].length;k++){if(inR(ps[j][k],x,y)){h=true;break}}if(!h)return fs[i].properties.i}}}return null}
function areaRec(slug){if(!D)return null;if(RC[slug]!==undefined)return RC[slug];var i=D.sl[slug],ix=c.idx();
  if(i==null&&c.DM&&c.DM.resolveArea)i=D.sl[c.DM.resolveArea(slug)];
  if(i==null){var a=ix&&ix.areas&&ix.areas[slug],b=a&&a.bbox;if(b)i=pip((b[0]+b[2])/2,(b[1]+b[3])/2)}
  RC[slug]=i==null?null:D.comms[i];return RC[slug]}
CF.areaRec=areaRec;
CF.centreOf=function(slug){var r=areaRec(slug);return r?r.c:0};
CF.ok=function(slug){if(!D)return true;if(S.cen==null&&!S.coast)return true;var r=areaRec(slug);if(!r)return false;if(S.cen!=null&&r.c!==S.cen)return false;if(S.coast&&!r.sea)return false;return true};
function filtLabel(){var p=[];if(S.cen!=null&&CBY[S.cen])p.push("in "+CBY[S.cen].name);if(S.coast)p.push("on the sea coast");return p.join(", ")}
CF.filterLabel=filtLabel;
function filtShort(){var p=[];if(S.cen!=null&&CBY[S.cen])p.push(CBY[S.cen].name);if(S.coast)p.push("sea coast");return p.join(", ")}
function hasFilter(){return !!D&&(S.cen!=null||!!S.coast)}
CF.hasFilter=hasFilter;
// ---- the list hooks ----
CF.filterProfile=function(p){if(!hasFilter()||!p)return p;var q={},k;for(k in p)q[k]=p[k];q.priced=(p.priced||[]).filter(function(a){return CF.ok(a.slug)});q.thin=(p.thin||[]).filter(function(a){return CF.ok(a.slug)});q._cf=1;return q};
CF.profNote=function(){if(!hasFilter())return "";return '<p class=note id=cfnote style="margin:10px 0 0">Showing only the areas '+X(filtLabel())+' (change it in the bar on the map). The area cards, the price table and the project list follow this choice; the price-band mix, scale and evidence below are for all of Dubai.</p>'};
function devIn(k){var ix=c.ixOf(S.win),ar=0,n=0;Object.keys(ix.areas).forEach(function(s){if(!CF.ok(s))return;var d=ix.areas[s].devs&&ix.areas[s].devs[k];if(!d)return;var t=0;(d.c||[]).forEach(function(q){t+=q[0]});if(t>0){ar++;n+=t}});return{areas:ar,sales:n}}
CF.devIn=devIn;
CF.devOrder=function(mn){if(!hasFilter())return mn;var a=[],b=[];mn.forEach(function(x){(devIn(x.k).sales>0?a:b).push(x)});return a.concat(b)};
CF.devNote=function(k){if(!hasFilter())return "";var r=devIn(k);return '<span class=note style="display:block;margin:0"><b>'+X(filtShort())+':</b> '+(r.sales?r.areas+' area'+(r.areas===1?'':'s')+', '+fm(r.sales)+' sales':'no sales here')+'</span>'};
CF.onSelect=function(slug){if(!D||CF.ok(slug))return;var r=areaRec(slug);if(S.cen!=null&&!(r&&r.c===S.cen))S.cen=r&&r.c?r.c:null;if(S.coast&&!(r&&r.sea))S.coast=false};
CF.afterOpen=function(pq){if(!D||S.bflag)return;if(pq&&(pq.get("meet")||pq.get("area")||pq.get("prof")||pq.get("drill")))return;S.screen=1};
// ---- the cards in the side panel (screen 1) ----
function stock(u,s){return '<span class=cstock>'+fm(u)+' registered homes, '+s+'% of Dubai <span class="tag cder" title="Derived from our grouping: the Land Department project register added up for the areas we placed in this centre">DERIVED</span></span>'}
function centreCard(e){return '<button type=button class=ccard data-cen="'+e.id+'" aria-label="Show '+X(e.name)+' on the map"><span class=cnum style="background:'+e.colour+'">'+e.id+'</span><span class=cbody><b dir=auto>'+X(e.name)+'</b><span class=cst>'+X(e.status)+' centre</span><span class=crole>'+X(e.role)+'</span>'+stock(e.units,e.share)+(ABBR[e.id]?'<span class=note style="display:block;margin:2px 0 0">'+ABBR[e.id]+'</span>':'')+'</span></button>'}
function seaStats(){var n=0,u=0,wn=0,wu=0;D.comms.forEach(function(r){if(r.sea){n++;u+=r.u}else if(r.wf){wn++;wu+=r.u}});return{n:n,u:u,s:Math.round(1000*u/D.total_units)/10,wn:wn,wu:wu,ws:Math.round(1000*wu/D.total_units)/10}}
CF.seaStats=function(){return D?seaStats():null};
function coastCard(){var s=seaStats();return '<div class="card coastcard"><p class=label>Sixth layer: coastal (Najma’s own addition, not part of the plan)</p><button type=button class=csw id=coastsw data-coast=1 role=switch aria-checked="'+(S.coast?'true':'false')+'"><i class=swk></i><span>Sea coast within 500 m</span></button>'+(S.coast?'<p class=note id=coastnote style="margin:4px 0 0">Sea coast within 500 m (Najma’s own layer, not part of the plan)</p>':'')+'<p class=note>'+s.n+' areas, '+fm(s.u)+' registered homes ('+s.s+'% of Dubai) <span class="tag cder">DERIVED</span>. The second badge is inland waterfront (creek, canal or marina basin within 250 m): '+s.wn+' more areas, '+fm(s.wu)+' homes ('+s.ws+'%). Palm Jumeirah, Dubai Islands, World Islands and Maritime City count as sea coast; lakes and lagoons do not.</p></div>'}
function tierWord(r){return TW[r.t]||"Outside the five centres"}
function areaCards(list,max){var ix=c.ixOf(S.win);var rows=list.map(function(s){var a=ix.areas[s],st=c.stats(s),r=areaRec(s);return {s:s,name:(c.idx().areas[s]||a||{}).name||s,n:st&&st.enough?st.n:0,st:st,r:r}});rows.sort(function(a,b){return b.n-a.n||a.name.localeCompare(b.name)});var more=rows.length>max&&!S.cenAll;
  var shown=more?rows.slice(0,max):rows;
  return '<div class=acg>'+shown.map(function(x){var cc=x.r&&x.r.c?CBY[x.r.c]:null;return '<button type=button class=acard data-carea="'+X(x.s)+'" aria-label="Open '+X(x.name)+'">'+c.ico("map-pin","evi")+'<b dir=auto>'+X(x.name)+'</b>'+(x.r?'<span>'+X(tierWord(x.r))+'</span>':'')+(x.r&&x.r.sea?'<span class=cbadge>Sea coast</span>':'')+(x.r&&x.r.wf?'<span class=cbadge>Waterfront</span>':'')+(x.st&&x.st.enough?'<span>'+fm(x.st.n)+' sales</span><span class=am>AED '+fm(c.pu(x.st.median))+' '+c.pul()+'</span>':'<span>under 3 sales, no price</span>')+'</button>'}).join("")+'</div>'+(more?'<button type=button class=btn data-cshow=1 style="margin-top:8px">Show all '+rows.length+' areas</button>':'')}
function devCards(list,max){var ix=c.ixOf(S.win),agg={};list.forEach(function(s){var ds=ix.areas[s]&&ix.areas[s].devs||{};Object.keys(ds).forEach(function(k){if(k==="_")return;var d=ds[k],t=0;(d.c||[]).forEach(function(q){t+=q[0]});if(!t)return;var e=agg[k]||(agg[k]={k:k,name:(c.idx().devs&&c.idx().devs[k]&&c.idx().devs[k].name)||d.n||k,n:0,a:0});e.n+=t;e.a++})});
  var a=Object.keys(agg).map(function(k){return agg[k]}).sort(function(x,y){return y.n-x.n||x.name.localeCompare(y.name)});if(!a.length)return '<div class="dvc quiet">'+ico("buildings","evi mu")+'No developer has settled sales here yet.</div>';
  return '<div class=dvcg>'+a.slice(0,max).map(function(d){return '<a href="#" class="dlink dvc" data-k="'+X(d.k)+'" title="'+X(d.name)+'">'+ico("buildings","evi")+'<b dir=auto>'+X(d.name)+'</b><span>'+fm(d.n)+' sale'+(d.n===1?'':'s')+'</span><span>'+d.a+' area'+(d.a===1?'':'s')+' here</span>'+(S.mine&&S.mine[d.k]?'<span class=inl>'+c.icoSvg("star","inls")+'in your list</span>':'')+'</a>'}).join("")+'</div>'+(a.length>max?'<p class=note>The '+max+' with the most sales of '+a.length+'.</p>':'')}
function areaList(){var ix=c.idx();return Object.keys(ix.areas).filter(CF.ok)}
function centreSummary(e){var core=e.core&&e.core.length?'<p class=note style="margin:6px 0 0"><b>Core:</b> '+e.core.map(X).join(", ")+'. '+X(e.id===4?"One Dubai Municipality area; the plan names the Expo centre, not its edge.":"The district names are the plan’s; the list of communities inside them is ours.")+'</p>':'';
  var caps=D.comms.filter(function(r){return r.c===e.id&&r.cap&&(r.t==="c"||r.t==="a")}).map(function(r){return '<p class=note style="margin:6px 0 0"><b>'+X(r.n)+':</b> '+X(r.cap)+'</p>'}).join("");
  var top=e.top&&e.top.length?'<p class=note style="margin:6px 0 0"><b>Most registered homes:</b> '+e.top.map(function(t){return X(t[0])+' ('+fm(t[1])+')'}).join("; ")+'.</p>':'';
  var al=areaList();
  return '<div class=card id=cencard><button type=button class=btn data-cback=1>'+c.ico("caret-down","evi")+' All of Dubai</button><div class=cenhd><span class=cnum style="background:'+e.colour+'">'+e.id+'</span><div><h2 dir=auto>'+X(e.name)+'</h2><span class=note>'+X(e.status)+' centre. '+X(e.role)+'</span></div></div>'
  +(ABBR[e.id]?'<p class=note style="margin:0 0 6px">'+ABBR[e.id]+'</p>':'')
  +'<div class=cg2><div class=cstat><b>'+fm(e.units)+'</b><small>registered homes, core and adjacent areas ('+e.share+'% of Dubai) <span class="tag cder">DERIVED</span></small></div><div class=cstat><b>'+fm(e.units_all)+'</b><small>with the '+e.nper+' peripheral areas in the lighter tint ('+e.share_all+'%) <span class="tag cder">DERIVED</span></small></div></div>'
  +core+caps+top
  +'<p class=note style="margin:6px 0 0">Only the core is in a district the plan names. Every other area here is placed by distance to the core (our grouping, DERIVED_NEAREST), never as official. '+X(NOTE)+'. Source: '+X(SRC)+'.</p>'
  +'<p class=label style="margin-top:14px">Areas in this centre: tap one</p>'+areaCards(al,12)
  +'<p class=label style="margin-top:14px">Developers in this centre</p>'+devCards(al,6)+'</div>'}
CF.cardsHtml=function(){
  if(!D)return "";
  if(S.screen!==1){return hasFilter()?'<p class=note id=cenfilt>The map and the lists show only the areas '+X(filtLabel())+'. Change it in the bar on the map.</p>':""}
  if(S.cen!=null&&CBY[S.cen])return centreSummary(CBY[S.cen])+(S.coast?coastCard():"");
  if(S.bflag||chosen())return S.coast?coastCard():"";
  var out=D.total_units,ins=0;D.centres.forEach(function(e){ins+=e.units_all});
  return '<div class=card id=cencards><p class=label>Dubai 2040: the five centres</p><p class=note style="margin:0">'+X(NOTE)+'. Tap a centre on the map or a card below. Source: '+X(SRC)+'.</p><div class=cg2>'+D.centres.map(centreCard).join("")+'</div>'
   +'<p class=note>Registered homes are the Land Department project register, added up by our grouping (DERIVED). Outside the five centres: '+fm(D.outside_units)+' registered homes ('+Math.round(1000*D.outside_units/D.total_units)/10+'%), left neutral on the map.</p></div>'+coastCard()}
CF.wire=function(root){if(!root||!root.querySelectorAll)return;
  [].forEach.call(root.querySelectorAll("[data-cen]"),function(b){b.onclick=function(){pick(Number(b.getAttribute("data-cen")))}});
  [].forEach.call(root.querySelectorAll("[data-cback]"),function(b){b.onclick=function(){pick(null)}});
  [].forEach.call(root.querySelectorAll("[data-carea]"),function(b){b.onclick=function(){c.select(b.getAttribute("data-carea"),true)}});
  [].forEach.call(root.querySelectorAll("[data-cshow]"),function(b){b.onclick=function(){S.cenAll=true;c.renderSide()}});
  [].forEach.call(root.querySelectorAll("[data-coast]"),function(b){b.onclick=function(){CF.act("coast",!S.coast)}})};
// the line at the top of an area: which centre, how sure, the second-nearest centre, the caption
CF.areaLine=function(slug){if(!D)return "";var r=areaRec(slug);if(!r)return "";var e=r.c?CBY[r.c]:null;
  var badges=(r.sea?'<span class=cbadge title="Sea coast within 500 m of the open Gulf: Najma’s own layer, not part of the plan">Sea coast within 500 m</span>':'')+(r.wf?'<span class=cbadge title="Creek, canal or marina basin within 250 m: a second badge, Najma’s own layer">Inland waterfront</span>':'');
  if(!e)return '<div class="box cenline" id=cenline><b>Outside the five centres</b><p class=note style="margin:2px 0 0">More than 4 km from the core of every centre in our grouping. '+X(NOTE)+'.</p>'+badges+'</div>';
  var sec=r.c2&&CBY[r.c2]&&r.c2!==r.c?'<p class=note style="margin:4px 0 0">Between two centres: it is also near <b>'+X(CBY[r.c2].name)+'</b> ('+r.d2+' km from its core). We placed it with the nearer one.</p>':'';
  return '<div class="box cenline" id=cenline><div class=cenhd style="margin:0 0 4px"><span class=cnum style="background:'+e.colour+'">'+e.id+'</span><div><b dir=auto>Centre '+e.id+': '+X(e.name)+'</b><span class=note style="display:block;margin:0">'+X(tierWord(r))+(r.d!=null&&r.t!=="c"?', '+r.d+' km from the core':'')+'</span></div></div>'
   +'<p class=note style="margin:2px 0 0">'+X(EVW[r.e]||EVW.D)+'</p>'+sec+(r.cap?'<p class=note style="margin:4px 0 0">'+X(r.cap)+'</p>':'')+(r.m&&r.m.length?'<p class=note style="margin:4px 0 0">Known as: '+r.m.map(X).join(", ")+'.</p>':'')
   +(r.u?'<p class=note style="margin:4px 0 0">'+fm(r.u)+' registered homes in this community <span class="tag cder">DERIVED</span></p>':'')+badges+'<p class=note style="margin:4px 0 0">'+X(NOTE)+'. Source: '+X(SRC)+'.</p></div>'};
// ---- the filter bar ----
function ixv(){return c.idx()||{}}
function winLabel(){return S.win==="l12"?"Last 12 months":"All years"}
function defWin(){return ixv().ev?"l12":"all"}
function grp(f,ic,lab,val,on,clr){return '<span class="fg'+(on?' on':'')+'"><button type=button class=fchip data-f="'+f+'" aria-haspopup=true aria-expanded="'+(S.fmenu===f?'true':'false')+'" title="'+X(val)+'" aria-label="'+lab+': '+X(val)+'">'+ico(ic,"evi")+'<span class=fl>'+lab+'</span><b dir=auto>'+X(val)+'</b>'+ico("caret-down","fcv")+'</button>'+((on&&clr!==false)?'<button type=button class=fx data-x="'+f+'" aria-label="Clear '+lab.toLowerCase()+'">'+ico("x","evi")+'</button>':'')+'</span>'}
function barHtml(){var h="",lk=locked(),ix=ixv(),W=c.DM.TIER_WORDS;
  if(D){var e=S.cen!=null?CBY[S.cen]:null;h+=grp("cen","map-trifold","Centre",e?e.id+" "+e.name:"All of Dubai",!!e);
    h+='<span class="fg'+(S.coast?' on':'')+'"><button type=button class="fchip fsw" data-f="coast" role=switch aria-checked="'+(S.coast?'true':'false')+'" aria-label="Coastal: sea coast within 500 m"><span class=fl>Coastal</span><i class=swk></i>'+(S.coast?'<span class=fwf title="Inland waterfront (creek, canal or marina basin within 250 m) is a second badge on the cards and the map, not part of the filter">+ waterfront badge</span>':'')+'</button></span>'}
  if(!lk){var an=S.sel&&ix.areas&&ix.areas[S.sel]?ix.areas[S.sel].name:null;h+=grp("area","map-pin","Area",an||"All areas",!!an);
    h+=grp("dev","buildings","Developer","All developers",false);
    h+=grp("band","chart-bar","Price band",S.band!=null?W[S.band]:"All price bands",S.band!=null);
    h+=grp("win","stack","Window",winLabel(),S.win!==defWin())}
  return h}
CF.barHtml=barHtml;
function opt(v,body,on,wide){return '<button type=button class="fopt'+(on?' on':'')+(wide?' wide':'')+'" data-v="'+X(v)+'">'+body+'</button>'}
function menuHtml(){var f=S.fmenu;if(!f)return "";var ix=ixv(),W=c.DM.TIER_WORDS,t="",o="",nt="";
  if(f==="cen"){t="Choose a centre";o=opt("",'<span><b>All of Dubai</b></span>',S.cen==null,true)+D.centres.map(function(e){return opt(String(e.id),'<span class=cnum style="background:'+e.colour+'">'+e.id+'</span><span><b>'+X(e.name)+'</b><small>'+e.share+'% of Dubai’s registered homes (DERIVED)</small></span>',S.cen===e.id)}).join("");nt=NOTE+". Source: "+SRC+"."}
  else if(f==="area"){t="Choose an area";var list=locked()?lockAreas():areaList();list.sort(function(a,b){return String((ix.areas[a]||{}).name||a).localeCompare(String((ix.areas[b]||{}).name||b))});o=opt("",'<span><b>All areas</b></span>',!S.sel&&!S.parea,true)+list.map(function(s){return opt(s,'<span><b dir=auto>'+X((ix.areas[s]||{}).name||s)+'</b></span>',S.sel===s||S.parea===s)}).join("")}
  else if(f==="dev"){t="Choose a developer";var ml=c.mineList().filter(function(k){return k!==S.prof});o=opt("",'<span><b>All developers</b></span>',!S.prof,true)+ml.map(function(k){return opt(k,'<span><b dir=auto>'+X(c.devName(k))+'</b></span>',S.prof===k)}).join("");nt=ml.length?"Your developers. Add more on screen 1.":"Choose your developers on screen 1 first."}
  else if(f==="band"){t="Choose a price band";o=opt("",'<span><b>All price bands</b></span>',S.band==null,true)+[0,1,2,3].map(function(i){return opt(String(i),'<span><b>'+W[i]+'</b></span>',S.band===i)}).join("")+'<button type=button class="fopt wide'+(S.cshade===false?'':' on')+'" data-sh="1"><span><b>Price-band shading on the map: '+(S.cshade===false?'off':'on')+'</b><small>tap to switch</small></span></button>';nt=fillMode()?"Price bands appear on the map once you choose a centre, an area or a developer.":(S.screen!==1?"Price bands colour screen 1. On this screen the map is shaded by your developers.":"")}
  else if(f==="win"){t="Choose the window";o=(ix.ev?opt("l12",'<span><b>Last 12 months</b></span>',S.win==="l12")+opt("all",'<span><b>All years</b></span>',S.win==="all"):opt("all",'<span><b>All years</b></span>',true,true));nt=ix.ev?"":"This data has no yearly record yet."}
  return '<div class=fmenu id=fmenu role=dialog aria-label="'+t+'"><div class=fmh><b>'+t+'</b><button type=button class=fx data-x=menu aria-label="Close">'+ico("x","evi")+'</button></div><div class=fopts>'+o+(nt?'<p class=fnote>'+X(nt)+'</p>':'')+'</div></div>'}
function lockAreas(){var p=c.DM.devProfile(c.ixOf(S.win),S.prof);return (p.priced||[]).concat(p.thin||[]).map(function(a){return a.slug}).filter(CF.ok)}
function ensureBar(){var host=c.$("map");if(!host)return null;var b=c.$("fbar");
  if(!b){b=document.createElement("div");b.id="fbar";b.innerHTML="<div id=fbmain></div>";b.addEventListener("click",onBar);b.addEventListener("keydown",function(e){if(e.key==="Escape"&&S.fmenu){S.fmenu=null;drawBar()}else if((e.key==="Enter"||e.key===" ")&&e.target&&e.target.closest&&e.target.closest("#lockchips .chip")){e.preventDefault();onBar(e)}});host.appendChild(b)}
  var lk=c.$("lockchips");if(lk&&lk.parentNode!==b)b.appendChild(lk);
  return b}
function drawBar(){var m=c.$("fbmain");if(!m)return;m.innerHTML=barHtml()+menuHtml();
  var lk=c.$("lockchips");if(lk&&lk.querySelectorAll){[].forEach.call(lk.querySelectorAll(".chip"),function(ch,i){ch.setAttribute("data-f",["dev","area","band","win"][i]||"");ch.setAttribute("role","button");ch.setAttribute("tabindex","0")})}
  var b=c.$("fbar"),h=b&&b.offsetHeight,host=c.$("map");if(h&&host&&host.style&&host.style.setProperty)host.style.setProperty("--fbh",(h+16)+"px");var de=document.documentElement;if(h&&de&&de.style&&de.style.setProperty)de.style.setProperty("--fbh",(h+16)+"px")}
function onBar(e){var t=e.target;if(!t||!t.closest)return;var xb=t.closest("button");if(xb&&xb.closest&&xb.closest("#lockchips"))return;
  var sh=t.closest("[data-sh]");if(sh){CF.act("shade",S.cshade===false);return}
  var v=t.closest("[data-v]");if(v){CF.act(S.fmenu,v.getAttribute("data-v"));return}
  var x=t.closest("[data-x]");if(x){var k=x.getAttribute("data-x");if(k==="menu"){S.fmenu=null;drawBar()}else CF.act(k,null,true);return}
  var f=t.closest("[data-f]");if(f){var k2=f.getAttribute("data-f");if(k2==="coast"){CF.act("coast",!S.coast);return}S.fmenu=S.fmenu===k2?null:k2;drawBar()}}
function pick(k){S.cen=k;S.fmenu=null;if(S.sel&&!CF.ok(S.sel)){S.sel=null;S.pj=null;S.parea=null;S.drawer=null;S.fdev=null}if(S.parea&&!CF.ok(S.parea))S.parea=null;S.cenAll=false;c.renderAll();
  var m=c.map();if(m&&m.fitBounds){if(k&&CBY[k]){var b=CBY[k].bbox;m.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:c.pad(),duration:700})}else m.flyTo({center:DEF,zoom:9.6,duration:700})}}
CF.pick=pick;
// one entry point for every choice (the bar's menus call it; so do the tests). kind: cen, coast, area, dev, band, win, shade
CF.act=function(kind,val,isClear){S.fmenu=null;var nul=val==null||val==="";
  if(kind==="cen"){pick(nul?null:Number(val));return}
  if(kind==="coast"){S.coast=isClear?false:!!val&&val!=="0";if(S.sel&&!CF.ok(S.sel)){S.sel=null;S.pj=null;S.parea=null}c.renderAll();return}
  if(kind==="area"){if(nul){S.parea=null;if(!S.prof){S.sel=null;S.pj=null;S.drawer=null}c.renderAll()}else if(S.prof){S.parea=val;c.renderDetail();c.refreshMap()}else c.select(val,true);return}
  if(kind==="dev"){if(nul){if(S.prof)c.leaveProf();else c.renderAll()}else{if(S.prof&&S.prof!==val)c.leaveProf();c.openProf(val)}return}
  if(kind==="band"){S.band=nul?null:Number(val);S.bandsAsk=S.band!=null;if(S.band!=null)S.cshade=true;c.renderAll();return}
  if(kind==="win"){c.setWin(nul?defWin():val);return}
  if(kind==="shade"){S.cshade=!!val;c.renderAll();return}
  drawBar()};
// ---- the map layers ----
function cenFeatures(){var fmode=fillMode(),cen=S.cen,fs=[];D.geo.features.forEach(function(f){var r=D.comms[f.properties.i],cc=r.c,col=cc&&CBY[cc]?CBY[cc].colour:"#7fd4ff",fo=0,lo=0;
  if(cc){if(fmode){fo=r.t==="p"?0.2:0.5;lo=r.t==="p"?0.3:0.55}else if(cen!=null&&cen===cc){fo=r.t==="p"?0.05:0.11;lo=0.8}}
  fs.push({type:"Feature",geometry:f.geometry,properties:{col:col,fo:fo,lo:lo,sea:r.sea?1:0,wf:r.wf?1:0,nm:r.n,c:cc,t:r.t}})});return {type:"FeatureCollection",features:fs}}
function olFeatures(){var fmode=fillMode(),fs=[];((D.ol&&D.ol.features)||[]).forEach(function(f){var o=f.properties.o,col=CBY[o]?CBY[o].colour:"#c5a56a";fs.push({type:"Feature",geometry:f.geometry,properties:{col:col,oo:fmode?0.95:(S.cen===o?0.95:0),ow:fmode?2.2:3}})});return {type:"FeatureCollection",features:fs}}
function labFeatures(){return {type:"FeatureCollection",features:D.centres.map(function(e){return {type:"Feature",geometry:{type:"Point",coordinates:e.lab},properties:{t:e.id+"  "+e.name}}})}}
CF.cenFeatures=function(){return D?cenFeatures():null};
var AF=null;
CF.addLayers=function(map,font){if(!D||!map)return;try{
  map.addSource("cen",{type:"geojson",data:cenFeatures()});map.addSource("cenol",{type:"geojson",data:olFeatures()});map.addSource("cenlab",{type:"geojson",data:labFeatures()});
  AF=map.getPaintProperty("a-fill","fill-opacity");
  map.addLayer({id:"c-fill",type:"fill",source:"cen",paint:{"fill-color":["get","col"],"fill-opacity":["get","fo"]}},"a-fill");
  map.addLayer({id:"c-seafill",type:"fill",source:"cen",filter:["==",["get","sea"],1],paint:{"fill-color":"#7fd4ff","fill-opacity":0}},"a-fill");
  map.addLayer({id:"c-line",type:"line",source:"cen",paint:{"line-color":["get","col"],"line-opacity":["get","lo"],"line-width":0.7}},"a-label");
  map.addLayer({id:"c-ol",type:"line",source:"cenol",paint:{"line-color":["get","col"],"line-opacity":["get","oo"],"line-width":["get","ow"]}},"a-label");
  map.addLayer({id:"c-sea",type:"line",source:"cen",filter:["==",["get","sea"],1],paint:{"line-color":"#7fd4ff","line-width":2.6,"line-opacity":0,"line-dasharray":[2,1.4]}},"a-label");
  map.addLayer({id:"c-wf",type:"line",source:"cen",filter:["==",["get","wf"],1],paint:{"line-color":"#7fd4ff","line-width":1.4,"line-opacity":0,"line-dasharray":[0.6,1.6]}},"a-label");
  map.addLayer({id:"c-lab",type:"symbol",source:"cenlab",layout:{"text-field":["get","t"],"text-font":font,"text-size":14,"text-max-width":8,"visibility":"none"},paint:{"text-color":"#ffffff","text-halo-color":"#0b0f0f","text-halo-width":2}});
  }catch(e){if(window.console)console.warn("centres layers",e);D=D}}
function applyMode(m){var f=fillMode(),co=!!S.coast;try{
  m.setPaintProperty("a-fill","fill-opacity",f?0.01:AF);m.setPaintProperty("a-line","line-opacity",f?0:1);m.setLayoutProperty("a-label","visibility",f?"none":"visible");m.setLayoutProperty("c-lab","visibility",f?"visible":"none");
  m.setPaintProperty("c-seafill","fill-opacity",co?0.22:0);m.setPaintProperty("c-sea","line-opacity",co?0.95:0);m.setPaintProperty("c-wf","line-opacity",co?0.75:0)}catch(e){}}
CF.bind=function(map,lib){if(!D||!map||!map.on)return;var pop=new lib.Popup({closeButton:false,closeOnClick:false,offset:12});
  map.on("mousemove","c-fill",function(e){if(!fillMode()){return}var p=e.features&&e.features[0]&&e.features[0].properties;if(!p||!p.c){pop.remove();return}map.getCanvas().style.cursor="pointer";pop.setLngLat(e.lngLat).setHTML("<b>"+X(p.nm)+"</b><br>Centre "+p.c+": "+X(CBY[p.c].name)+"<br>"+X(TW[p.t]||""))  .addTo(map)});
  map.on("mouseleave","c-fill",function(){pop.remove()});
  map.on("click","c-fill",function(e){if(!fillMode())return;var p=e.features&&e.features[0]&&e.features[0].properties;if(p&&p.c)pick(Number(p.c))})};
CF.refresh=function(){ensureBar();drawBar();if(!D)return;var m=c.map();if(m&&m.getSource&&m.getSource("cen")){m.getSource("cen").setData(cenFeatures());m.getSource("cenol").setData(olFeatures());applyMode(m)}};
CF.mount=ensureBar;
c.ico=ico;
return CF}
return {make:make,NOTE:NOTE,SRC:SRC};
`;

export const CENTRES_JS = "var CENI=" + CENI + ";var CENTRES2040=(function(){" + CORE + "})();";
