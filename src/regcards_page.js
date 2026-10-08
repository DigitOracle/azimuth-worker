// v401 - REGISTER-BUILT CARDS on the Developers-by-area page (the data is src/regcards.js + KV img_devmap_regcards, built by scripts/build_regcards.py).
// The completeness audit of 7 Oct 2026 found register projects that have registered sales (or none yet, or only land sales) and no card on any developer's page, because the index builds a card only from
// settled sales of homes counted by bedroom with a size. Each one is a card here, made from the Land Department register alone and labelled 'Built from the Land Department register; no price card yet':
// name, register project number, the registered developer (label REGISTER_VERIFIED), area, status, registered units, the number of unit sales and their date range, a price range ONLY where five or more
// sales carry a price, and the best position rung (found by the page itself from the project number: plot centre, then community centre). No price per area, no price band, no invented number.
// Three places: the developer's own collapsed group 'Registered sales, no price card yet' (a developer with a profile page); the AREA card's group (one of the 42 districts, developer not recorded here);
// and the collapsed 'Other Dubai areas' card (any district the page has no area card for). Every card opens the usual Project details panel with the three document buttons.
// These projects are NEVER counted: not in a total, a price band, the scale word or an area count. Absent file = the page exactly as v399: every hook in src/devmap_page.js is typeof REGCARDS !== "undefined"
// and every answer is empty without data. The page script gets this module ahead of its own script (REGCARDS_JS defines the global REGCARDS). String.raw, no substitutions and no backticks;
// checked with node --check by test/test_v401_regcards.mjs.
export const REGCARDS_JS = String.raw`
var REGCARDS=(function(){
  var D=null,N=0,LABEL="Built from the Land Department register; no price card yet",MIN=5,MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function x(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
  function num(n){return Math.round(Number(n)).toLocaleString("en-US")}
  function load(d){D=null;N=0;if(!d||typeof d!=="object"||!d.d||typeof d.d!=="object")return 0;var o={};
    Object.keys(d.d).forEach(function(k){var ds=d.d[k];if(!ds||typeof ds!=="object")return;Object.keys(ds).forEach(function(s){var l=Array.isArray(ds[s])?ds[s]:[];
      l.forEach(function(e){if(!e||typeof e.n!=="string"||!e.n||e.p==null)return;((o[k]=o[k]||{})[s]=o[k][s]||[]).push(e);N++})})});D=N?o:null;return N}
  function count(){return N}
  // the entries of developer k (an id, or "_" for the developer-not-recorded group); area = the selected area (slug) or null
  function list(k,area){var out=[];if(!D||!D[k])return out;Object.keys(D[k]).forEach(function(s){if(area&&s!==area)return;D[k][s].forEach(function(e){out.push({slug:s,e:e})})});return out}
  function items(k,area){return k==="_"?[]:list(k,area)}
  function dstr(s){var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||""));return m?(+m[3])+" "+MON[+m[2]-1]+" "+m[1]:""}
  function priced(e){return e.pmin!=null&&e.pmax!=null&&Number(e.np)>=MIN}
  function evOf(e){return {p:e.p!=null?e.p:null,e:e.e,dn:e.de||e.br||"",a:e.a||"",as:e.as||"register_district",st:e.st||null,pc:e.pc==null?null:e.pc,pe:e.pe||null,u:e.u||null,rc:1,
    sc:e.sc||0,so:e.so||0,sf:e.sf||"",sl:e.sl||"",np:e.np||0,pmin:e.pmin==null?null:e.pmin,pmax:e.pmax==null?null:e.pmax,br:e.br||"",k:e.k||""}}
  // the sales, in words, from the numbers the register holds (never rounded up, never estimated)
  function salesLine(e){var sc=Number(e.sc)||0,so=Number(e.so)||0;
    if(sc>0){var r=e.sf&&e.sl?(e.sf===e.sl?" on "+dstr(e.sf):", "+dstr(e.sf)+" to "+dstr(e.sl)):"";return num(sc)+" unit sale"+(sc===1?"":"s")+" registered"+r}
    if(so>0)return "No registered unit sale; "+num(so)+" land or building sale"+(so===1?"":"s");
    return "No registered unit sales yet"}
  function priceLine(e){return priced(e)?"Sale prices AED "+num(e.pmin)+" to "+num(e.pmax)+" ("+num(e.np)+" priced sales)":""}
  function devLine(e,esc){return e.e==="REGISTER_VERIFIED"?"Registered developer per the Land Department register: "+esc(e.de||""):e.e==="NAME_ONLY"?"Matched by name only, not confirmed by the register":"Developer not recorded on the register"}
  function cardOf(xx,api){var e=xx.e,ev=evOf(e),pl=priceLine(e),
    extra='<span class=note style="display:block;margin:0">'+api.esc(e.a||"")+'</span>'
      +'<span class="note srcl" style="display:block;margin:2px 0 0;font-size:10.5px">'+api.esc(LABEL)+'</span>'
      +'<span class="note srcl" style="display:block;margin:2px 0 0;font-size:10.5px">'+devLine(e,api.esc)+'</span>'
      +(e.e==="NAME_ONLY"&&e.de?'<span class="note srcl" style="display:block;margin:2px 0 0;font-size:10.5px">Register names: '+api.esc(e.de)+'</span>':'')
      +'<span class=note style="display:block;margin:2px 0 0"><b>'+api.esc(salesLine(e))+'</b></span>'
      +(pl?'<span class=note style="display:block;margin:2px 0 0">'+api.esc(pl)+'</span>':'');
    return api.pjCard(xx.slug,e.n,null,null,extra,"Project name not recorded",ev)}
  function cards(xs,api){return xs.map(function(xx){return cardOf(xx,api)}).join("")}
  var NOTE="They are not in the totals, the scale word, the price bands or the area counts on this page. Every figure on a card is taken from the Land Department registers; where there is no price range, fewer than five of its sales carry a price.";
  // the developer's own collapsed group (inside the profile, after the no-sales group)
  function html(k,area,api){var l=list(k,area);if(!l.length||k==="_")return "";
    return '<details class="card nconf regcards" id=regcards><summary><b>Registered sales, no price card yet</b> <span class=note>'+l.length+' project'+(l.length===1?'':'s')+', outside the numbers</span></summary>'
      +'<p class=note style="margin:6px 0">'+api.esc(LABEL)+'. These projects are on the Land Department register under this developer, with no card of their own yet. '+NOTE+(area?' Showing the selected area only.':'')+'</p><div class=pjg>'+cards(l,api)+'</div></details>'}
  // the AREA card's group: the entries whose developer has no profile page here, in one of the 42 districts
  function areaHtml(slug,api){var l=list("_",slug);if(!l.length)return "";
    return '<details class="card nconf regcards rcarea" id=rcarea><summary><b>Projects whose developer is not recorded here: sales registered, no price card yet</b> <span class=note>'+l.length+' project'+(l.length===1?'':'s')+', outside the numbers</span></summary>'
      +'<p class=note style="margin:6px 0">'+api.esc(LABEL)+'. These projects are on the Land Department register in this area; no developer page exists for the company it names. '+NOTE+'</p><div class=pjg>'+cards(l,api)+'</div></details>'}
  // 'Other Dubai areas': every entry whose district the page has no area card for (api.inAreas(slug) false), grouped by the area name on the register
  function otherHtml(api){if(!D)return "";var g={},n=0;
    Object.keys(D).forEach(function(k){Object.keys(D[k]).forEach(function(s){if(api.inAreas&&api.inAreas(s))return;D[k][s].forEach(function(e){var a=e.a||s;(g[a]=g[a]||[]).push({slug:s,e:e});n++})})});
    if(!n)return "";var names=Object.keys(g).sort(function(a,b){return a.localeCompare(b)});
    return '<details class="card nconf regcards rcother" id=rcother><summary><b>Other Dubai areas</b> <span class=note>'+n+' registered project'+(n===1?'':'s')+', outside the numbers</span></summary>'
      +'<p class=note style="margin:6px 0">'+api.esc(LABEL)+'. These projects are on the Land Department register in areas this page has no area card for. A map position, where one is offered, is the centre of the community, not the building. '+NOTE+'</p>'
      +names.map(function(a){return '<p class=label style="margin-top:10px" dir=auto>'+api.esc(a)+' <span class=note>'+g[a].length+'</span></p><div class=pjg>'+cards(g[a],api)+'</div>'}).join("")+'</details>'}
  // panel rows (pdRow(icon, label, value, source, tag)): how the card was made, and the sales in full
  function regRows(e,pdRow){if(!e||!e.rc)return "";var h=pdRow("stack","How this card was made",x(LABEL)+". It is outside the totals, the price bands and the area counts.","Dubai Land Department project, developers and sales registers","DATA");
    if(e.br)h+=pdRow("wallet","Brand","<span dir=auto>"+x(e.br)+"</span> (taken from the project name)","The project name; the register names the company above, not the brand","NAME_ONLY");return h}
  function salesRow(e,pdRow){if(!e||!e.rc)return "";var SRC="Dubai Land Department sales register (sales of units and villas; land and whole buildings are counted apart)",h=pdRow("chart-donut","Unit sales registered",x(salesLine(e)),SRC,"DATA");
    if(priced(e))h+=pdRow("chart-bar","Sale prices",x("AED "+num(e.pmin)+" to "+num(e.pmax)+", the lowest and the highest of "+num(e.np)+" priced sales"),SRC+"; a range is shown only where five or more sales carry a price","DATA");
    if((Number(e.sc)||0)>0&&(Number(e.so)||0)>0)h+=pdRow("stack","Land or building sales",x(num(e.so)+" more sale"+(e.so===1?"":"s")+" of land or whole buildings, not counted above"),"Dubai Land Department sales register","DATA");return h}
  return {load:load,count:count,list:list,items:items,html:html,areaHtml:areaHtml,otherHtml:otherHtml,cards:cards,evOf:evOf,regRows:regRows,salesRow:salesRow,salesLine:salesLine,priceLine:priceLine,label:LABEL}
})();
`;
