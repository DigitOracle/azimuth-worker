// v392 - "LAUNCHED, NO REGISTERED SALES YET" on the Developers-by-area page (the data is src/nosales.js + KV img_devmap_nosales).
// The developer index builds a project card only from a project with settled sales, so a launched project with none (The Archive by Imtiaz, KORE by Imtiaz and about 770 others) had no card at all.
// In each developer's profile this module adds ONE collapsed group after the area cards: "Launched, no registered sales yet (N)". Each card opens the same Project details panel as every
// other card (register facts, developer, area and position; the plot or community position and the Investor PDF button where they exist). When an area card is selected the group is
// filtered to that area. These projects are NEVER counted: not in a total, a price band, the scale word or an area count (the group sits outside every number, like "Not confirmed by the register").
// Absent file = the page exactly as v390: every hook in src/devmap_page.js is typeof NOSALES !== "undefined" and every answer is empty without data.
// The page script gets this module ahead of its own script (NOSALES_JS defines the global NOSALES). String.raw, no substitutions and no backticks; checked with node --check by test/test_v392_nosales.mjs.
export const NOSALES_JS = String.raw`
var NOSALES=(function(){
  var D=null,N=0;
  function nk(s){return String(s==null?"":s).toLowerCase().replace(/[^a-z0-9]+/g,"")}
  function load(d){D=null;N=0;if(!d||typeof d!=="object"||!d.d||typeof d.d!=="object")return 0;
    Object.keys(d.d).forEach(function(k){Object.keys(d.d[k]).forEach(function(s){N+=(d.d[k][s]||[]).length})});D=N?d.d:null;return N}
  function count(){return N}
  // the entries of developer k; area = the selected area card (slug) or null; areaNames = the names that area goes by on the page (heading and communities)
  function list(k,area,areaNames){var out=[];if(!D||!D[k])return out;var names=(areaNames||[]).map(nk).filter(Boolean);
    Object.keys(D[k]).forEach(function(s){(D[k][s]||[]).forEach(function(e){
      if(area&&s!==area&&names.indexOf(nk(e.a))<0)return;out.push({slug:s,e:e})})});return out}
  function evOf(e){return {p:e.p!=null?e.p:(e.key||null),e:e.e,dn:e.off?(e.br||""):(e.de||""),a:e.a||"",as:e.as||"register_master",st:e.st||null,pc:e.pc==null?null:e.pc,pe:e.pe||null,u:e.u||null,ns:1,off:e.off?1:0,br:e.br||"",notes:e.notes||null,id:e.id||null}}
  function line(e,w){var s=[];if(e.off)s.push("Not on the project register");else{if(e.st)s.push(w(e.st));if(e.pe)s.push("planned end "+e.pe)}return s.join(", ")}
  function html(k,area,api){var l=list(k,area,api.areaNames?api.areaNames(area):[]);if(!l.length)return "";
    var h='<details class="card nconf nosales" id=nosales><summary><b>Launched, no registered sales yet</b> <span class=note>'+l.length+' project'+(l.length===1?'':'s')+', outside the numbers</span></summary>'
      +'<p class=note style="margin:6px 0">These projects are launched (on the Land Department register, or for KORE on its building register) but have no registered unit sales yet. They are not in the totals, the scale word, the price bands or the area counts on this page.'+(area?' Showing the selected area only.':'')+'</p><div class=pjg>';
    l.forEach(function(x){var e=x.e,ev=evOf(e),ln=line(e,api.words),
      extra='<span class=note style="display:block;margin:0">'+api.esc(e.a||"")+'</span>'+(ln?'<span class=note style="display:block;margin:2px 0 0">'+api.esc(ln)+'</span>':'')+'<span class=note style="display:block;margin:2px 0 0"><b>No registered '+(e.off?'unit ':'')+'sales yet</b></span>';
      h+=api.pjCard(x.slug,e.n,null,null,extra,"Project name not recorded",ev)});
    return h+'</div></details>'}
  // panel rows (pdRow(icon, label, value, source, tag)): the register status of a project that is not on the register, the brand filed by name, the notes
  function regRows(e,pdRow){if(!e||!e.ns)return "";var h="";
    if(e.off)h+=pdRow("chart-bar","Register status","Not on the project register","Dubai Land Department project register extract of 1 Sep 2026 (the newest we hold)",e.e||"DEVELOPER_CLAIMED");
    if(e.br&&!e.off)h+=pdRow("wallet","Brand","<span dir=auto>"+String(e.br).replace(/</g,"&lt;")+"</span> (developer says, taken from the project name)","The project name; the register names the company above, not the brand","NAME_ONLY");
    if(e.notes)e.notes.forEach(function(t){h+=pdRow("stack","Note",String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;"),"Dubai Land Department registers; developer says; third-party site marked unverified",e.e||"DEVELOPER_CLAIMED")});
    return h}
  function salesRow(e,pdRow){return e&&e.ns?pdRow("chart-donut","Sales","No registered "+(e.off?"unit ":"")+"sales yet","Dubai Land Department sales register (unit sales, land excluded)","DATA"):""}
  return {load:load,count:count,list:list,html:html,regRows:regRows,salesRow:salesRow,evOf:evOf}
})();
`;
