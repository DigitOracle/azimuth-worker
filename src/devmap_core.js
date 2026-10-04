// DEVELOPERS MAP - the shared logic (v301). ONE source, two users:
//   - the page (src/devmap_page.js injects DEVMAP_CORE_JS into the browser script), and
//   - node (the index builder scripts/build_devmap_index.mjs and test/test_v301_devmap.mjs evaluate it with new Function).
// The worker itself never evaluates it (workers forbid eval): the server only serves the published index and stores the shortlist.
// It is a String.raw block with no template substitutions and no backticks, so it is also valid in the page.
//
// THE DATA MODEL (what the published index carries, per area -> per developer):
//   cells  c: [[n, ppsm, aed, bed], ...]  one cell per building x bedroom type: n = settled sales (DLD transactions register), ppsm =
//             the building's median price per square metre for that type (its median AED / its median size), aed = the median price,
//             bed = bedrooms (0 studio). A developer's figure is the sale-weighted median of its cells; it is NOT the median of
//             every individual sale (the cards carry building-by-type medians, not single sales) and the page says so.
//   rent   r: [[n, rpsm, rent, bed], ...] the same for registered Ejari contracts: annual AED per sq m, annual rent.
//   homes  h: homes in the Land Department units register for that developer's buildings in the area.
// RULES: n < EVIDENCE_MIN (3) is "not enough sales" and never a number; no rating, no ranking of reputation; tiers are PRICE BANDS only.
export const DEVMAP_CORE_JS = String.raw`
var DM=(function(){
var SQFT=10.7639, EVIDENCE_MIN=3;
var TIER_IDS=["ultra","luxury","premium","budget"];
var TIER_NAMES=["ULTRA-LUXURY","LUXURY","PREMIUM","BUDGET"];
// THE ONE CONFIG OBJECT for the four tiers. bounds = the three lower edges in AED per sq m: [ultra-luxury from, luxury from,
// premium from]; below the last is BUDGET. null = the Dubai-wide percentile bands the index carries (p50 / p80 / p95 of settled
// sales by price per sq m). Kendall: set bounds to [a,b,c] to use your own.
var TIER_CFG={bounds:[32292,22604,16684], percentiles:[95,80,50]}; // 4 Oct 2026, Kendall: value-weighted bounds, each tier about a quarter of the money: AED 3,000 / 2,100 / 1,550 per sq ft
var TYPICAL_SQFT=[["Studio",401],["1-bed",779],["2-bed",1248],["3-bed",1848]]; // median Dubai sizes in the sales register, last 12 months
function sqftOf(m){return m==null?null:m/SQFT}
function round(x){return x==null?null:Math.round(x)}
function wquant(pairs,p){ // pairs [[value,weight]]; weighted quantile, p 0..1
  var a=[],tw=0,i;for(i=0;i<pairs.length;i++){var v=pairs[i][0],w=pairs[i][1];if(v!=null&&w>0&&isFinite(v)){a.push([v,w]);tw+=w}}
  if(!a.length)return null;a.sort(function(x,y){return x[0]-y[0]});
  var t=tw*p,c=0;for(i=0;i<a.length;i++){c+=a[i][1];if(c>=t)return a[i][0]}return a[a.length-1][0]}
function wmedian(pairs){return wquant(pairs,0.5)}
function nOf(cells){var n=0;for(var i=0;i<cells.length;i++)n+=cells[i][0];return n}
function pooled(cells,idx){var p=[];for(var i=0;i<cells.length;i++)p.push([cells[i][idx==null?1:idx],cells[i][0]]);return p}
function boundsOf(index,cfg){cfg=cfg||TIER_CFG;if(cfg.bounds&&cfg.bounds.length===3)return cfg.bounds;return (index&&index.cuts&&index.cuts.bounds)||null}
function tierOf(ppsm,bounds){if(ppsm==null||!bounds)return -1;return ppsm>=bounds[0]?0:ppsm>=bounds[1]?1:ppsm>=bounds[2]?2:3}
function bandSay(t,bounds){ // the tier's price band, per sq m and per sq ft
  var lo=t===0?bounds[0]:t===1?bounds[1]:t===2?bounds[2]:null,hi=t===0?null:t===1?bounds[0]:t===2?bounds[1]:bounds[2];
  function f(x){return Math.round(x).toLocaleString("en-US")}
  var m=lo==null?"under AED "+f(hi):hi==null?"AED "+f(lo)+" and above":"AED "+f(lo)+" to "+f(hi);
  var s=lo==null?"under AED "+f(hi/SQFT):hi==null?"AED "+f(lo/SQFT)+" and above":"AED "+f(lo/SQFT)+" to "+f(hi/SQFT);
  return m+" per sq m ("+s+" per sq ft)"}
// a developer's name key: one developer however the register spells it
function devKey(s){var t=String(s==null?"":s).toLowerCase().replace(/[.,&]/g," ").replace(/\b(l l c|llc|fz|fzc|fze|ltd|limited|co|the|real estate|properties|property|developments?|developers?|investments?|group|holding|holdings|company|est)\b/g," ").replace(/\s+/g," ").trim();return t}
function money(x){return x>=1e6?"AED "+(Math.round(x/1e4)/100).toFixed(2)+"m":"AED "+Math.round(x/1e3).toLocaleString("en-US")+"k"}
// the TOTAL PURCHASE PRICE of a typical home at the floor of a tier's per sq m band (BUDGET: under the premium floor)
function tierPrices(t,bounds){if(!bounds)return "";
  var edge=t===0?bounds[0]:t===1?bounds[1]:bounds[2],i,o=[];
  for(i=0;i<TYPICAL_SQFT.length;i++)o.push(TYPICAL_SQFT[i][0]+" "+(t===3?"under ":"from ")+money(edge*TYPICAL_SQFT[i][1]/SQFT));
  return o.join(" · ")}
// v314 - the tier header as DATA, not a paragraph: the band edges (per sq m), four price cards (label + "from AED 842k" / "under AED 622k") and the Dubai-wide shares
function tierCards(t,bounds){if(!bounds)return [];var edge=t===0?bounds[0]:t===1?bounds[1]:bounds[2],i,o=[];
  for(i=0;i<TYPICAL_SQFT.length;i++)o.push([TYPICAL_SQFT[i][0],(t===3?"under ":"from ")+money(edge*TYPICAL_SQFT[i][1]/SQFT)]);
  return o}
function tierEdges(t,b){return b?{lo:t===0?b[0]:t===1?b[1]:t===2?b[2]:null,hi:t===0?null:t===1?b[0]:t===2?b[1]:b[2]}:null}
function tierShares(t,index){var s=index&&index.cuts&&index.cuts.shares;return s?{n:s.n[t],money:s.money[t]}:null}
function tierShare(t,index){var s=index&&index.cuts&&index.cuts.shares;if(!s)return "";
  return "Dubai-wide: "+s.n[t]+"% of buyers, "+s.money[t]+"% of the money"}
// ---- one developer in one area ----
function devStats(d,bounds){
  var c=d.c||[],n=nOf(c),out={k:d.k,name:d.n,homes:d.h||0,n:n,enough:n>=EVIDENCE_MIN,median:null,medianSqft:null,tier:-1,tierN:[0,0,0,0],tierShare:[0,0,0,0],second:null,aed:null};
  if(!out.enough)return out;
  out.median=round(wmedian(pooled(c,1)));out.medianSqft=round(sqftOf(out.median));out.aed=round(wmedian(pooled(c,2)));
  for(var i=0;i<c.length;i++){var t=tierOf(c[i][1],bounds);if(t>=0)out.tierN[t]+=c[i][0]}
  var tot=out.tierN[0]+out.tierN[1]+out.tierN[2]+out.tierN[3],best=0,i2;
  for(i2=0;i2<4;i2++){out.tierShare[i2]=tot?Math.round(100*out.tierN[i2]/tot):0;if(out.tierN[i2]>out.tierN[best])best=i2}
  out.tier=best; // the rule: the tier where most of its sales in this area fall
  var sec=-1;for(i2=0;i2<4;i2++)if(i2!==best&&out.tierN[i2]>0&&(sec<0||out.tierN[i2]>out.tierN[sec]))sec=i2;
  if(sec>=0&&out.tierShare[sec]>=20)out.second={tier:sec,share:out.tierShare[sec]};
  return out}
// ---- one area: the four tiers, each with its developers ----
function areaStats(area,index,cfg){
  var bounds=boundsOf(index,cfg),devs=area.devs||{},k,all=[],list=[],unknown=null;
  for(k in devs){var d=devs[k];all=all.concat(d.c||[]);if(k==="_"){unknown={n:nOf(d.c||[])};continue}list.push(devStats({k:k,n:d.n,h:d.h,c:d.c},bounds))}
  var n=nOf(all),res={name:area.name,n:n,enough:n>=EVIDENCE_MIN,median:null,medianSqft:null,q1:null,q3:null,bounds:bounds,tiers:[],mixN:[0,0,0,0],mixValue:[0,0,0,0],unknown:unknown,notEnough:[],devCount:list.length,as_of:index&&index.as_of};
  if(res.enough){var p=pooled(all,1);res.median=round(wquant(p,0.5));res.medianSqft=round(sqftOf(res.median));res.q1=round(wquant(p,0.25));res.q3=round(wquant(p,0.75))}
  var vt=0,nt=0,i;
  for(i=0;i<all.length;i++){var t=tierOf(all[i][1],bounds);if(t>=0){res.mixN[t]+=all[i][0];res.mixValue[t]+=all[i][0]*(all[i][2]||0);nt+=all[i][0];vt+=all[i][0]*(all[i][2]||0)}}
  res.unknownTier=[0,0,0,0];if(devs._)for(i=0;i<(devs._.c||[]).length;i++){var tu=tierOf(devs._.c[i][1],bounds);if(tu>=0)res.unknownTier[tu]+=devs._.c[i][0]}   // v314 - sales per tier with no developer recorded
  for(i=0;i<4;i++){res.mixN[i]=nt?Math.round(100*res.mixN[i]/nt):0;res.mixValue[i]=vt?Math.round(100*res.mixValue[i]/vt):0}
  for(i=0;i<4;i++){res.tiers.push({tier:i,id:TIER_IDS[i],name:TIER_NAMES[i],band:bounds?bandSay(i,bounds):"",prices:tierPrices(i,bounds),share:tierShare(i,index),cards:tierCards(i,bounds),edges:tierEdges(i,bounds),shares:tierShares(i,index),devs:[],median:null,medianSqft:null})}
  for(i=0;i<list.length;i++){var s=list[i];if(!s.enough){res.notEnough.push(s);continue}res.tiers[s.tier].devs.push(s)}
  for(i=0;i<4;i++){var tr=res.tiers[i];tr.devs.sort(function(a,b){return b.n-a.n||(b.median-a.median)});tr.nDevs=tr.devs.length;
    var cells=[];for(var j=0;j<tr.devs.length;j++)cells=cells.concat(devs[tr.devs[j].k].c||[]);
    if(tr.devs.length){tr.median=round(wmedian(pooled(cells,1)));tr.medianSqft=round(sqftOf(tr.median))}}
  return res}
// ---- the realtor's shortlist: keep only these developer keys ----
function shortlistFilter(stats,set,area){var o=JSON.parse(JSON.stringify(stats)),i,j;
  function keep(d){return !!set[d.k]}
  for(i=0;i<o.tiers.length;i++){var tr=o.tiers[i];tr.devs=tr.devs.filter(keep);tr.nDevs=tr.devs.length;tr.median=null;tr.medianSqft=null;
    if(area&&tr.devs.length){var cells=[];for(j=0;j<tr.devs.length;j++)cells=cells.concat(area.devs[tr.devs[j].k].c||[]);tr.median=round(wmedian(pooled(cells,1)));tr.medianSqft=round(sqftOf(tr.median))}}
  o.notEnough=o.notEnough.filter(keep);return o}
// ---- the client's budget. q: {mode:"sqft"|"sqm"|"total", min, max, beds}. Drops developers out of range. ----
function budgetFit(devEntry,stat,q,bounds){
  if(!stat.enough)return {fit:null,why:"not enough sales (under "+EVIDENCE_MIN+")"};
  if(q.mode==="total"){
    var cells=(devEntry.c||[]).filter(function(c){return q.beds==null||c[3]===q.beds}),n=nOf(cells);
    if(n<EVIDENCE_MIN)return {fit:null,why:"not enough sales of this size (under "+EVIDENCE_MIN+")"};
    var m=round(wmedian(pooled(cells,2)));
    return {fit:(q.max==null||m<=q.max)&&(q.min==null||m>=q.min),median:m,n:n,basis:"total"}}
  var v=q.mode==="sqm"?stat.median:stat.medianSqft;
  return {fit:(q.max==null||v<=q.max)&&(q.min==null||v>=q.min),median:v,n:stat.n,basis:q.mode}}
// ---- DEVELOPER VIEW: where a target price per sq m lands in an area ----
function developerView(stats,target){ // target: {ppsm} or {tier}
  var b=stats.bounds,t=target.tier!=null?target.tier:tierOf(target.ppsm,b);
  if(t<0||!b||!stats.enough)return {ok:false,why:"not enough sales in this area"};
  var tr=stats.tiers[t];
  return {ok:true,tier:t,tierName:TIER_NAMES[t],band:tr.band,shareN:stats.mixN[t],shareValue:stats.mixValue[t],competitors:tr.devs,
    say:stats.mixN[t]+"% of settled sales in "+stats.name+" ("+stats.mixValue[t]+"% of the value) are "+TIER_NAMES[t]+"."+(tr.devs.length?" "+tr.devs.length+" developer"+(tr.devs.length===1?"":"s")+" sit in that tier here.":" No developer with "+EVIDENCE_MIN+"+ sales sits in that tier here.")}}
function compareAreas(a,b,target){return {a:developerView(a,target),b:developerView(b,target)}}
// ---- rent (the same evidence rule; community-level cells, labelled as such) ----
function rentStats(d){var r=d.r||[],n=nOf(r);if(n<EVIDENCE_MIN)return {enough:false,n:n};
  return {enough:true,n:n,rpsm:round(wmedian(pooled(r,1))),rpsf:round(sqftOf(wmedian(pooled(r,1)))),rent:round(wmedian(pooled(r,2)))}}
function rentFit(d,q){var r=(d.r||[]).filter(function(c){return q.beds==null||c[3]===q.beds}),n=nOf(r);
  if(n<EVIDENCE_MIN)return {fit:null,why:"not enough contracts of this size (under "+EVIDENCE_MIN+")",n:n};
  var m=round(wmedian(pooled(r,2)));return {fit:(q.max==null||m<=q.max)&&(q.min==null||m>=q.min),rent:m,rpsf:round(sqftOf(wmedian(pooled(r,1)))),n:n}}
// ---- the whole index ----
// where my developers are: per area, how many of the shortlist have sales on record there
function whereMine(index,set){var o={},s;for(s in index.areas){var a=index.areas[s],c=0,k;for(k in a.devs)if(k!=="_"&&set[k]&&nOf(a.devs[k].c||[])>0)c++;o[s]=c}return o}
// the client meeting, BUYER: for each area, my developers that fit. named = a developer name the client asked for.
function clientMeeting(index,set,q,named){
  var out={areas:[],named:null},bounds=boundsOf(index),s,k;
  for(s in index.areas){var a=index.areas[s],stats=areaStats(a,index),rows=[];
    for(k in a.devs){if(k==="_"||!set[k])continue;var st=devStats({k:k,n:a.devs[k].n,h:a.devs[k].h,c:a.devs[k].c},bounds),bf=budgetFit(a.devs[k],st,q,bounds);if(bf.fit)rows.push({k:k,name:st.name,tier:st.tier,median:st.median,medianSqft:st.medianSqft,n:st.n,fitMedian:bf.median,basis:bf.basis})}
    if(rows.length){rows.sort(function(x,y){return x.medianSqft-y.medianSqft});out.areas.push({slug:s,name:a.name,devs:rows})}}
  out.areas.sort(function(x,y){return y.devs.length-x.devs.length});
  if(named){var nk=devKey(named);nk=(index.alias&&index.alias[nk])||nk;out.named={key:nk,mine:!!set[nk],known:!!index.devs[nk],name:(index.devs[nk]||{}).name||named}}
  return out}
function clientMeetingRent(index,set,q){
  var out=[],s,k;for(s in index.areas){var a=index.areas[s],rows=[];
    for(k in a.devs){if(k==="_"||!set[k])continue;var f=rentFit(a.devs[k],q);if(f.fit)rows.push({k:k,name:a.devs[k].n,rent:f.rent,rpsf:f.rpsf,n:f.n})}
    if(rows.length){rows.sort(function(x,y){return x.rent-y.rent});out.push({slug:s,name:a.name,devs:rows})}}
  out.sort(function(x,y){return y.devs.length-x.devs.length});return out}
// percentile bounds from a pool of [n,ppsm,...] cells (used by the index builder)
function percentileBounds(cells,percentiles){var p=pooled(cells,1),ps=percentiles||TIER_CFG.percentiles;return ps.map(function(q){return round(wquant(p,q/100))})}
return {SQFT:SQFT,EVIDENCE_MIN:EVIDENCE_MIN,TIER_IDS:TIER_IDS,TIER_NAMES:TIER_NAMES,TIER_CFG:TIER_CFG,wquant:wquant,wmedian:wmedian,tierOf:tierOf,bandSay:bandSay,devKey:devKey,tierPrices:tierPrices,tierShare:tierShare,TYPICAL_SQFT:TYPICAL_SQFT,devStats:devStats,areaStats:areaStats,shortlistFilter:shortlistFilter,budgetFit:budgetFit,developerView:developerView,compareAreas:compareAreas,rentStats:rentStats,rentFit:rentFit,whereMine:whereMine,clientMeeting:clientMeeting,clientMeetingRent:clientMeetingRent,percentileBounds:percentileBounds,boundsOf:boundsOf,sqftOf:sqftOf};
})();
`;
