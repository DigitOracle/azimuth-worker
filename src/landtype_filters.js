// v731 (Kendall, 4 Nov 2026): Dubai Land Department (DLD) categories as high-level FILTERS wherever Momo lists plots or buildings
// (Building Passports card, plot passport district/building picker).
// Data: naj-market-pulse/scripts/build_plot_passport.py (v4 packs) puts a code "use.land.tenure" on every browse row of pp_d_<slug>
// ([plot id, line, code]) and combo counts x = {code: plots} on every pp_dl district and pp_d_<slug>. Ids below MUST match
// use_cat / land_cat in that script. Until the rebuilt packs are stored (no x on any district) the filters stay hidden.
// USE comes from the DLD SUB-TYPE (what the plot is used for); the DLD LAND TYPE is secondary - the two can disagree.
// Client code is plain ES5, no backticks, safe to concatenate into String.raw page scripts.

export const LT_USE = [["ho", "Homes"], ["vi", "Villas"], ["co", "Commercial"], ["mx", "Mixed use"], ["in", "Industrial & warehouses"],
  ["gh", "Government housing"], ["cm", "Community"], ["ut", "Utilities & infrastructure"], ["ag", "Agricultural"], ["lc", "Labour camps"],
  ["ot", "Other / not recorded"]];
export const LT_LAND = [["co", "Commercial"], ["re", "Residential"], ["in", "Industrial"], ["pf", "Public facilities"], ["ga", "Government authorities"],
  ["os", "Open space"], ["ut", "Utility"], ["ag", "Agricultural"], ["fd", "Future development"], ["rc", "Recreational"], ["tr", "Transport"],
  ["ed", "Educational"], ["wb", "Water body"], ["hs", "Hospitality"], ["hc", "Healthcare"], ["ot", "Other"], ["nr", "Not recorded"]];
export const LT_TEN = [["1", "Freehold"], ["0", "Not freehold"], ["n", "Tenure not recorded"]];
export const LT_NOTE = "DLD categories; land type and sub-type can disagree.";

// ltfDraw(el, districts, F, onChange, cls): cls = {g: grid class, c: chip class, on: selected class}
export const LTF_JS = 'var LTU=' + JSON.stringify(LT_USE) + ',LTL=' + JSON.stringify(LT_LAND) + ',LTT=' + JSON.stringify(LT_TEN) + ',LTN=' + JSON.stringify(LT_NOTE) + ';'
  + 'function ltfOn(F){return !!(F&&(F.u||F.l||F.f))}'
  + 'function ltfP(c){var a=String(c).split(".");return {u:a[0]==="nr"?"ot":(a[0]||"ot"),l:a[1]||"nr",f:a[2]==="1"||a[2]==="0"?a[2]:"n"}}'
  + 'function ltfM(c,F,skip){if(!ltfOn(F))return true;if(c==null||c==="")return false;var p=ltfP(c);return (skip==="u"||!F.u||p.u===F.u)&&(skip==="l"||!F.l||(","+F.l+",").indexOf(","+p.l+",")>=0)&&(skip==="f"||!F.f||p.f===F.f)}'
  + 'function ltfN(L,F,skip){var n=0;(L||[]).forEach(function(d){var x=d&&d.x||{};for(var k in x)if(Object.prototype.hasOwnProperty.call(x,k)&&ltfM(k,F,skip))n+=Number(x[k])||0});return n}'
  + 'function ltfHas(L){return (L||[]).some(function(d){return d&&d.x&&typeof d.x==="object"})}'
  + 'function ltfDim(L,F,dim){var o={};(L||[]).forEach(function(d){var x=d&&d.x||{};for(var k in x){if(!Object.prototype.hasOwnProperty.call(x,k)||!ltfM(k,F,dim))continue;var v=ltfP(k)[dim];o[v]=(o[v]||0)+(Number(x[k])||0)}});return o}'
  + 'function ltfE(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c]})}'
  + 'function ltfDraw(el,L,F,cb,cls){if(!el)return;if(!ltfHas(L)){el.hidden=true;el.innerHTML="";return}el.hidden=false;cls=cls||{g:"ltg",c:"ltc",on:"on"};'
  + 'function grp(dim,list,lab){var o=ltfDim(L,F,dim),h="";list.forEach(function(x){var n=o[x[0]]||0,on=F[dim]===x[0];if(!n&&!on)return;h+=\'<button type=button class="\'+cls.c+(on?" "+cls.on:"")+\'" aria-pressed="\'+on+\'" data-ltd="\'+dim+\'" data-ltv="\'+x[0]+\'"><b>\'+ltfE(x[1])+\'</b><span>\'+n.toLocaleString("en")+" plots</span></button>"});return h?\'<div class="\'+cls.g+\'" role=group aria-label="\'+lab+\'">\'+h+"</div>":"<p class=ltn>No plots here.</p>"}'
  + 'var h=(cls.t?\'<div class="\'+(cls.tc||"ltt")+\'">\'+ltfE(cls.t)+"</div>":"")+\'<p class=ltn>\'+ltfE(LTN)+(ltfOn(F)?\' <button type=button class=ltx data-ltclr=1>Clear filters</button>\':"")+"</p>"+grp("u",LTU,"Use (DLD)")'
  + '+\'<details class=ltd\'+(F.l||F.f?" open":"")+\'><summary>Land type and tenure (DLD)</summary><p class=ltn>Land type</p>\'+grp("l",LTL,"Land type (DLD)")+\'<p class=ltn>Tenure</p>\'+grp("f",LTT,"Tenure")+"</details>";'
  + 'el.innerHTML=h;Array.prototype.forEach.call(el.querySelectorAll("[data-ltd]"),function(b){b.onclick=function(){var d=b.getAttribute("data-ltd"),v=b.getAttribute("data-ltv");F[d]=F[d]===v?"":v;cb()}});'
  + 'var x=el.querySelector("[data-ltclr]");if(x)x.onclick=function(){F.u="";F.l="";F.f="";cb()}}';
