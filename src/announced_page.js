// v397d - "ANNOUNCED BY THE DEVELOPER, NOT YET REGISTERED" on the Developers-by-area page (the data is src/announced.js + KV img_devmap_announced).
// A developer's own web site and availability sheet announce projects that the Land Department project register extract we hold does not have (it is stale since 15 Jun 2026; the newest delta is 1 Sep 2026),
// so they had no card anywhere. In each developer's profile this module adds ONE collapsed group after "Registered, no unit sales yet": "Announced by the developer, not yet registered (N)".
// Each card opens the same Project details panel; the panel says the developer says it, shows the source line with the page date, says "not on any register we hold", and NEVER shows a project number.
// These projects are never counted: not in a total, a price band, the scale word or an area count (the group sits outside every number). When an area card is selected the group is filtered to that area;
// a project whose area the developer does not state is shown only when no area is selected.
// Absent file = the page exactly as v395: every hook in src/devmap_page.js is typeof ANNOUNCED !== "undefined" and every answer is empty without data.
// The page script gets this module ahead of its own script (ANNOUNCED_JS defines the global ANNOUNCED). String.raw, no substitutions and no backticks; checked with node --check by test/test_v397d_announced.mjs.
export const ANNOUNCED_JS = String.raw`
var ANNOUNCED=(function(){
  var D=null,N=0,META=null,LABEL="Announced by the developer, not yet registered";
  function nk(s){return String(s==null?"":s).toLowerCase().replace(/[^a-z0-9]+/g,"")}
  function e2(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
  function load(d){D=null;N=0;META=null;if(!d||typeof d!=="object"||!d.d||typeof d.d!=="object")return 0;
    Object.keys(d.d).forEach(function(k){Object.keys(d.d[k]).forEach(function(s){N+=(d.d[k][s]||[]).length})});D=N?d.d:null;META=N&&d.meta&&typeof d.meta==="object"?d.meta:null;return N}
  function count(){return N}
  // the entries of developer k; area = the selected area card (slug) or null; areaNames = the names that area goes by on the page (heading and communities)
  function list(k,area,areaNames){var out=[];if(!D||!D[k])return out;var names=(areaNames||[]).map(nk).filter(Boolean);
    Object.keys(D[k]).forEach(function(s){(D[k][s]||[]).forEach(function(e){
      if(area&&s!==area&&!(e.a&&names.indexOf(nk(e.a))>=0))return;out.push({slug:s,e:e})})});return out}
  // the evidence record the card carries: no project number, no position, never a sales figure; an=1 marks it for the panel hook
  function evOf(e){return {p:null,e:"DEVELOPER_CLAIMED",dn:e.dn||"",a:e.a||"",as:"developer",st:null,pc:null,pe:null,u:e.u||null,ns:0,off:0,an:1,ann:e,id:e.id||null}}
  function slugOf(k){return "~ann-"+k}
  function safeUrl(u){u=String(u||"");return /^https?:\/\/[^\s"<>]+$/i.test(u)?u:""}
  function host(u){var m=String(u||"").match(/^https?:\/\/([^\/]+)/i);return m?m[1].replace(/^www\./,""):""}
  function srcLine(e){
    if(e.t==="s")return "The developer's own availability sheet"+(e.f?" of "+e.f:"");
    return "The developer's own web page"+(host(e.url)?" ("+host(e.url)+")":"")+(e.f?", page date "+e.f:"")}
  function line(e){var s=[];if(e.u)s.push(e.u+" units stated");else if(e.us)s.push(e.us+" units on the developer's sheet");if(e.ho)s.push("handover "+e.ho);return s.join(", ")}
  function html(k,area,api){var l=list(k,area,api.areaNames?api.areaNames(area):[]);if(!l.length)return "";
    if(api.BLK&&!api.BLK[slugOf(k)])api.BLK[slugOf(k)]={state:"none",feats:[]};
    var h='<details class="card nconf announced" id=announced><summary><b>'+LABEL+' ('+l.length+')</b> <span class=note>outside the numbers</span></summary>'
      +'<p class=note style="margin:6px 0">These projects are announced by the developer on its own web site or availability sheet. They are not on any register we hold, so there is no project number, no registered sales and no price here. They are not in the totals, the scale word, the price bands or the area counts on this page.'+(area?' Showing the selected area only; a project whose area the developer does not state is shown when no area is selected.':'')+'</p><div class=pjg>';
    l.forEach(function(x){var e=x.e,ev=evOf(e),ln=line(e),
      extra='<span class=note style="display:block;margin:0">'+api.esc(e.a||"Area not stated by the developer")+'</span>'+(ln?'<span class=note style="display:block;margin:2px 0 0">'+api.esc(ln)+'</span>':'')+'<span class=note style="display:block;margin:2px 0 0"><b>Announced, not on any register we hold</b>'+(e.f?' ('+api.esc(e.f)+')':'')+'</span>';
      h+=api.pjCard(slugOf(k),e.n,null,null,extra,"Project name not recorded",ev)});
    return h+'</div></details>'}
  // the whole Project details body for an announced project (called from pjDetailHtml with the card's record d); api = {pdRow,pdSec,esc,icoSvg}
  function detail(d,api){var e=d&&d.ev&&d.ev.ann;if(!e)return "";var pr=api.pdRow,ps=api.pdSec,es=api.esc,T="DEVELOPER_CLAIMED",src=srcLine(e),u=safeUrl(e.url),
      h='<div class=pdet><div class=pdhead><span class=pdk>'+es(LABEL)+(e.f?' &middot; developer page of '+es(e.f):'')+'</span></div>';
    var f=pr("buildings","Project",es(e.n),src,T)+pr("wallet","Developer says it is by",es(e.dn||"Not recorded"),src,e.dn?T:"NOT_AVAILABLE");
    if(e.u)f+=pr("ruler","Units stated",es(String(e.u)),src,T);
    else if(e.us)f+=pr("ruler","Units on the developer's availability sheet",es(String(e.us)),src+" (stock on the sheet, not the size of the project)",T);
    if(e.ho)f+=pr("chart-bar","Handover as stated",es(e.ho),src,T);
    h+=ps("stack","What the developer says",f);
    h+=ps("map-pin","Area",pr("map-pin","Area as the developer says",e.a?es(e.a):"Not stated by the developer",src,e.a?T:"NOT_AVAILABLE"));
    h+=ps("chart-bar","Register status",pr("chart-bar","On a register","Not on any register we hold","Dubai Land Department project register extract of 15 Jun 2026 and the delta of 1 Sep 2026 (the newest we hold)"+(META&&META.built?", checked "+META.built:""),"DATA")
      +pr("stack","Register project number","None: it has not been matched to a register project","Matching rule: exact name and same developer, or the register project number; a name alone is never enough","NOT_AVAILABLE"));
    h+=ps("chart-donut","Sales and price",pr("chart-donut","Sales and price","Not counted: no registered sales, outside every total, price band and scale","Dubai Land Department sales register (unit sales, land excluded)","NOT_AVAILABLE"));
    h+=ps("star","Source",pr("star","Where this comes from",(u?'<a href="'+es(u)+'" target=_blank rel=noopener>'+es(host(u))+'</a>':es(src)),src+" (fetched "+(e.f||"date not recorded")+")","DEVELOPER_CLAIMED"));
    return h+'</div>'}
  return {load:load,count:count,list:list,html:html,detail:detail,evOf:evOf,label:LABEL}
})();
`;
