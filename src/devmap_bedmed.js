// v604 - TYPICAL PRICES BY BEDROOM on the Developers-by-area page (Kendall, 16 Oct 2026: "figures, median price for 1, 2, 3 bedroom, sales and rent, for these districts ... when I select the
// area, it gives me these boxes", on the right).
// The data (KV img_devmap_bedmed, built offline by scripts/build_bedroom_medians.py in the market-pulse repo from the governed chat_sales and chat_rent_contracts tables) holds, for each of the five
// Dubai 2040 centres, each area and Dubai as a whole, the MEDIAN registered sale price and the MEDIAN annual rent on NEW Ejari contracts for 1-, 2- and 3-bedroom flats, for the last 12 months and for
// all years, with the row count behind each figure. A figure needs 10 rows (the builder withholds it otherwise); under 30 is shown as "few".
// The route (GET /developers_map_api?what=bedmed) returns the stored value when it has the shape the page needs, otherwise {} and the page shows no boxes. Nothing here writes KV.
// On the page the boxes sit in the RIGHT panel (#detail): under an area when one is chosen, for the centre when only a centre is chosen, for all of Dubai otherwise. A narrow screen has no right
// panel, so the centre card in the left sheet carries a copy (class bmside, hidden above 1100 px so a wide screen never shows it twice).
// String.raw, no substitutions and no backticks (the rule src/devmap_page.js keeps); checked with node --check by test/test_v604_bedmed.mjs.
// v611 - ASKING NOW (Kendall, 17 Oct 2026: "yes do that"): a neighbourhood's box also carries one grey line, "asking now AED X, n adverts", the median rent advertised by agents (the daily listings capture) in the
// last 14 days for that bedroom count (the latest advert per listing, flats only, at least 10 adverts; scripts/build_bedroom_asking.py, KV img_devmap_asking). It is never mixed into the registered
// median above it, it exists for neighbourhoods only (never a centre or all of Dubai), and the capture is rentals only, so a sale box carries no such line. Absent or malformed data = no line.
export const ASKING_KV_NAME = "devmap_asking";             // read through kvJson(env, "devmap_asking") = KV key img_devmap_asking

export function cleanAsking(d) {
  if (!d || typeof d !== "object" || d.v !== 1 || !d.areas || typeof d.areas !== "object" || Array.isArray(d.areas)) return null;
  return d;
}

export const BEDMED_KV_NAME = "devmap_bedmed";             // read through kvJson(env, "devmap_bedmed") = KV key img_devmap_bedmed

export function cleanBedmed(d) {
  if (!d || typeof d !== "object" || d.v !== 1) return null;
  if (!d.centres || typeof d.centres !== "object" || !d.areas || typeof d.areas !== "object" || !d.city || typeof d.city !== "object") return null;
  if (!d.windows || !d.windows.sale || !d.windows.rent) return null;
  return d;
}

export const BEDMED_CSS = String.raw`
.bmcard .bmh{margin:10px 0 4px;font-size:11.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.bmg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.bmb{border:1px solid var(--line);border-radius:8px;padding:7px;background:var(--raise);min-width:0;overflow-wrap:anywhere}
.bmb small{display:block;color:var(--muted);font-size:11px}
.bmb b{display:block;font-family:Fraunces,Georgia,serif;font-size:15px;line-height:1.2;margin:2px 0}
.bmb .bmn{display:block;color:var(--muted);font-size:10.5px}
.bmb .bma{display:block;margin-top:3px;padding-top:3px;border-top:1px dashed var(--line);color:var(--muted);font-size:10.5px}.bmb .bma b{font-family:inherit;font-size:11px;color:var(--ink);display:inline;margin:0}
.bmb.bmno b{font-size:12.5px;color:var(--muted)}
.bmcard.bmside{display:none}
@media(max-width:1100px){.bmcard.bmside{display:block}}
@media(max-width:360px){.bmg{grid-template-columns:1fr}}
`;

export const BEDMED_JS = String.raw`
var BEDMED=(function(){
var D=null,A=null,MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function X(t){return String(t==null?"":t).replace(/[&<>"]/g,function(m){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[m]})}
function load(d){D=(d&&d.v===1&&d.centres&&d.areas&&d.city&&d.windows&&d.windows.sale&&d.windows.rent)?d:null;return !!D}
function has(){return !!D}
function loadAsk(d){A=(d&&d.v===1&&d.areas&&typeof d.areas==="object")?d:null;return !!A}
function ask(kind,key,type,b){if(!A||kind!=="area")return null;var s=A.areas[key];var x=s&&s[type]&&s[type][b];return (x&&x.n>=10&&x.median)?x:null}
function cell(kind,key,win,type,b){if(!D)return null;var s=kind==="city"?D.city:(kind==="centre"?D.centres[key]:D.areas[key]);var x=s&&s[win]&&s[win][type];return x&&x[b]?x[b]:null}
function mny(v){return v>=1000000?(Math.round(v/10000)/100)+"M":Math.round(v/1000)+"K"}
function fm(n){return Math.round(n).toLocaleString("en-US")}
function dd(s){var p=String(s||"").split("-");return p.length===3?Number(p[2])+" "+MON[Number(p[1])-1]+" "+p[0]:""}
function box(label,c,type,a){
  if(!c)return '<div class="bmb bmno"><small>'+label+'</small><b>No figure</b><span class=bmn>under 10 '+(type==="sale"?"sales":"contracts")+'</span></div>';
  var n=fm(c.n)+(type==="sale"?" sales":" contracts")+(c.thin?", few":"");
  var split=(type==="sale"&&c.ready&&c.offplan)?'<span class=bmn>ready '+mny(c.ready.median)+'</span><span class=bmn>off-plan '+mny(c.offplan.median)+'</span>':'';
  var al=a?'<span class=bma>asking now <b>AED '+(type==="sale"?mny(a.median):fm(a.median))+'</b>, '+fm(a.n)+' adverts</span>':'';
  return '<div class=bmb><small>'+label+'</small><b>AED '+(type==="sale"?mny(c.median):fm(c.median))+'</b>'+split+'<span class=bmn>'+X(n)+'</span>'+al+'</div>'}
function boxes(kind,key,win,name,extra){
  if(!D)return "";var w=win==="l12"?"l12":"all";
  var row=function(type){return [1,2,3].map(function(b){return box(b+" bed",cell(kind,key,w,type,String(b)),type,ask(kind,key,type,String(b)))}).join("")};
  var anyAsk=kind==="area"&&["sale","rent"].some(function(t){return [1,2,3].some(function(b){return !!ask(kind,key,t,String(b))})});
  var any=[1,2,3].some(function(b){return cell(kind,key,w,"sale",String(b))||cell(kind,key,w,"rent",String(b))});
  if(!any&&kind!=="city")return '<div class="card bmcard'+(extra?' '+extra:'')+'"><p class=label>Typical prices by bedroom</p><p class=note style="margin:0">Fewer than 10 registered sales or new rent contracts of 1, 2 or 3 bedroom flats here, so no median is shown. Higher-level figures are on the centre and on Dubai.</p></div>';
  var when=w==="l12"?"last 12 months (sales to "+dd(D.windows.sale.l12[1])+", rents to "+dd(D.windows.rent.l12[1])+")":"all years (sales to "+dd(D.windows.sale.all_to)+", rents to "+dd(D.windows.rent.all_to)+")";
  return '<div class="card bmcard'+(extra?' '+extra:'')+'"><p class=label>Typical prices: 1, 2 and 3 bedroom flats</p><p class=note style="margin:0"><b dir=auto>'+X(name)+'</b>, '+when+'.</p>'
   +'<p class=bmh>Buy: median registered price</p><div class=bmg>'+row("sale")+'</div>'
   +'<p class=bmh>Rent: median a year, new contracts</p><div class=bmg>'+row("rent")+'</div>'
   +'<p class=note style="margin:8px 0 0">Registered prices are what the deal was recorded at, not asking prices; off-plan sales are at the developer’s price. Rents are new Ejari contract lines, renewals left out. A median needs 10 sales or contracts; “few” means under 30. For a centre, every area we group into it counts (our grouping, not the plan’s boundaries).'+(anyAsk?' “Asking now” is the median rent advertised by agents in the last 14 days ('+X(dd(A.from))+' to '+X(dd(A.to))+'), the latest advert per listing, flats only, shown where there are 10 or more adverts; an asking price is what the agent hopes for, never part of the registered median.':'')+'</p></div>'}
return {load:load,loadAsk:loadAsk,has:has,cell:cell,boxes:boxes}
})();
`;
