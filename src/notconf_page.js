// v397a - "NOT CONFIRMED BY THE REGISTER" for the projects a rule kept off the developer cards (the data is src/notconf.js + KV img_devmap_notconf).
// A register project whose registered sales are offices or shops, whose sale has no size, whose card carries the name of the building outline, or whose name another project shares, had no card at all
// (Tamani Arts Offices and about 100 more). Here each one is a card in the developer's own 'Not confirmed by the register' group (label NAME_ONLY, the registered company shown), or, when no developer
// with a profile page can be named, in the AREA card's collapsed group 'Projects whose developer is not recorded here', so the 'Developer not recorded' slot is no longer a dead end.
// These projects are NEVER counted: not in a total, a price band, the scale word or an area count. Absent file = the page exactly as v395: every hook in src/devmap_page.js is typeof NOTCONF !== "undefined"
// and every answer is empty without data. The page script gets this module ahead of its own script (NOTCONF_JS defines the global NOTCONF). String.raw, no substitutions and no backticks;
// checked with node --check by test/test_v397a_dropped.mjs.
export const NOTCONF_JS = String.raw`
var NOTCONF=(function(){
  var D=null,N=0,ALIAS={althanyahfifth:"jltnorth"};
  var WHY={non_residential_sales:"Its registered sales are of offices, shops or hotel rooms, not homes counted by bedrooms, so this page has no price band for it.",
    no_sales_by_type:"The register holds sales for this project under a unit type with no bedroom count, so this page has no price band for it.",
    no_size:"A sale price is recorded but no size, so no price per sq m can be made.",
    no_sales:"Priced from the units register; there is no registered sale to count.",
    other_name:"The register names this project differently from the building outline its sales are filed on, so the register name found nothing on this page.",
    same_name:"Another register project with exactly this name is shown on this page; this one has no card of its own."};
  var WHYV={non_residential_sales:"Not in the totals: its registered sales are offices, shops or hotel units.",no_sales_by_type:"Not in the totals: its registered sales have no bedroom count.",no_size:"Not in the totals: its sales have no size.",no_sales:"Not in the totals: there is no registered sale to count."};
  var REASONS=Object.keys(WHY);
  function load(d){D=null;N=0;if(!d||typeof d!=="object"||!d.d||typeof d.d!=="object")return 0;var o={};
    Object.keys(d.d).forEach(function(k){var ds=d.d[k];if(!ds||typeof ds!=="object")return;Object.keys(ds).forEach(function(s){var l=Array.isArray(ds[s])?ds[s]:[],t=ALIAS[s]||s;
      l.forEach(function(e){if(!e||typeof e.n!=="string"||!e.n||REASONS.indexOf(e.r)<0)return;((o[k]=o[k]||{})[t]=o[k][t]||[]).push(e);N++})})});D=N?o:null;return N}
  function count(){return N}
  function why(e){return (e&&e.e==="REGISTER_VERIFIED"&&WHYV[e.r])||WHY[e&&e.r]||""}
  // the entries of developer k (an id, or "_" for the area-level group); area = the selected area (slug) or null
  function list(k,area){var out=[];if(!D||!D[k])return out;Object.keys(D[k]).forEach(function(s){if(area&&s!==area)return;D[k][s].forEach(function(e){out.push({slug:s,e:e})})});return out}
  function items(k,area){return k==="_"?[]:list(k,area)}
  function evOf(e){return {p:e.p!=null?e.p:null,e:e.e==="REGISTER_VERIFIED"?"REGISTER_VERIFIED":"NAME_ONLY",dn:e.de||e.br||"",a:e.a||"",as:e.as||"district",st:e.st||null,pc:e.pc==null?null:e.pc,pe:e.pe||null,u:e.u||null,h:e.h||null,mix:e.mix||null,pl:e.pl==null?null:e.pl,nc:1,r:e.r,al:e.al||""}}
  function line(e){return e.al?"Listed on this page as "+e.al:""}
  function cardOf(x,api){var e=x.e,ev=evOf(e),ln=line(e),st=e.st?api.words?api.words(e.st):String(e.st).toLowerCase():"",
    extra='<span class=note style="display:block;margin:0">'+api.esc(e.a||"")+'</span>'
      +'<span class="note srcl" style="display:block;margin:2px 0 0;font-size:10.5px">'+(e.e==="REGISTER_VERIFIED"?'Registered developer per the Land Department register: '+api.esc(e.de||""):'Matched by name only, not confirmed by the register')+'</span>'
      +(e.de&&e.e!=="REGISTER_VERIFIED"?'<span class="note srcl" style="display:block;margin:2px 0 0;font-size:10.5px">Register names: '+api.esc(e.de)+'</span>':'')
      +(ln?'<span class=note style="display:block;margin:2px 0 0">'+api.esc(ln)+'</span>':'')
      +'<span class=note style="display:block;margin:2px 0 0">'+api.esc(why(e))+'</span>';
    return api.pjCard(x.slug,e.n,null,null,extra,"Project name not recorded",ev)}
  // the cards, for the developer's group (inside the group's own grid)
  function cards(xs,api){return xs.map(function(x){return cardOf(x,api)}).join("")}
  // the AREA card's group: the entries whose developer is not recorded here; collapsed, outside every number
  function areaHtml(slug,api){var l=list("_",slug);if(!l.length)return "";
    return '<details class="card nconf nconfarea" id=nconfarea><summary><b>Projects whose developer is not recorded here</b> <span class=note>'+l.length+' project'+(l.length===1?'':'s')+', outside the numbers</span></summary>'
      +'<p class=note style="margin:6px 0">These projects are on the Land Department register in this area, but the register does not give a developer this page can confirm, or no developer page exists for the one it names. They are not in the totals, the scale word, the price bands or the area counts on this page.</p><div class=pjg>'+cards(l,api)+'</div></details>'}
  // panel rows (pdRow(icon, label, value, source, tag))
  function regRows(e,pdRow){if(!e||!e.nc)return "";var h=pdRow("stack","Why it is outside the numbers",String(why(e)).replace(/&/g,"&amp;").replace(/</g,"&lt;"),"Dubai Land Department unit-mix cards and registers",e.e||"NAME_ONLY");
    if(e.al)h+=pdRow("buildings","Listed on this page as",String(e.al).replace(/&/g,"&amp;").replace(/</g,"&lt;"),"The name of the building outline the sales are filed on","DATA");return h}
  function salesRow(e,pdRow){return e&&e.nc?pdRow("chart-donut","Sales","Not counted on this page","Dubai Land Department sales register (homes counted by bedrooms)","DATA"):""}
  return {load:load,count:count,list:list,items:items,cards:cards,areaHtml:areaHtml,evOf:evOf,regRows:regRows,salesRow:salesRow,why:why,reasons:REASONS}
})();
`;
