// v731 (Kendall, 4 Nov 2026): Dubai Land Department (DLD) categories as high-level FILTERS wherever Momo lists plots or buildings
// (Building Passports card, plot passport district/building picker).
// Data: naj-market-pulse/scripts/build_plot_passport.py (v4 packs) puts a code "use.land.tenure" on every browse row of pp_d_<slug>
// ([plot id, line, code]) and combo counts x = {code: plots} on every pp_dl district and pp_d_<slug>. Ids below MUST match
// use_cat / land_cat in that script. Until the rebuilt packs are stored (no x on any district) the filters stay hidden.
// USE comes from the DLD SUB-TYPE (what the plot is used for); the DLD LAND TYPE is secondary - the two can disagree.
// Client code is plain ES5, no backticks, safe to concatenate into String.raw page scripts.
//
// v735 (Kendall, 4 Nov 2026): "add one filter: ready (built/handed over) vs off-plan - that's a big difference and an entry point",
// and "half and half across the mobile width" instead of full-width bars. The builder adds a 4th code segment "use.land.tenure.status"
// (build_status in build_plot_passport.py) and an as-of date "sa" per district. The STATUS RULE (same as the builder):
//   r Ready      completed / handed over by register evidence: DLD project register FINISHED (or 100% complete), or the newest
//                Dubai Municipality (DM) construction project Closed / given a completion date, or - with no project record at all -
//                a building in the DLD buildings register
//   o Off-plan   DLD project ACTIVE / NOT_STARTED / PENDING (or conditional / frozen), or the DM project still Open with no completion date
//                (a DM project Open 6+ years before its as-of date is stale, not evidence)
//   e Empty plot no building, no permit and no construction project linked
//   k Not known  some record but no completion evidence either way
// DLD and DM disagree -> the newer as-of date wins and the letter carries "!" ("registers disagree"); the chip counts those on screen.
// The Status group shows FIRST, outside the accordion; it stays hidden until the codes carry the 4th segment.

export const LT_USE = [["ho", "Homes"], ["vi", "Villas"], ["co", "Commercial"], ["mx", "Mixed use"], ["in", "Industrial & warehouses"],
  ["gh", "Government housing"], ["cm", "Community"], ["ut", "Utilities & infrastructure"], ["ag", "Agricultural"], ["lc", "Labour camps"],
  ["ot", "Other / not recorded"]];
export const LT_LAND = [["co", "Commercial"], ["re", "Residential"], ["in", "Industrial"], ["pf", "Public facilities"], ["ga", "Government authorities"],
  ["os", "Open space"], ["ut", "Utility"], ["ag", "Agricultural"], ["fd", "Future development"], ["rc", "Recreational"], ["tr", "Transport"],
  ["ed", "Educational"], ["wb", "Water body"], ["hs", "Hospitality"], ["hc", "Healthcare"], ["ot", "Other"], ["nr", "Not recorded"]];
export const LT_TEN = [["1", "Freehold"], ["0", "Not freehold"], ["n", "Tenure not recorded"]];
export const LT_STAT = [["r", "Ready"], ["o", "Off-plan"], ["e", "Empty plot"], ["k", "Not known"]];   // v735 - ids match build_status
export const LT_NOTE = "DLD categories; land type and sub-type can disagree.";
export const LT_SNOTE = "Status from DLD project register and DM construction records";
// v735 compact chips: 2 per row at 375 px, small padding, whatever grid/chip classes the host page passes
export const LTF_CSS = ".ltfc [role=group]{display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important}"
  + ".ltfc button[data-ltd]{min-height:0!important;padding:6px 9px!important;border-radius:10px!important;font-size:.8rem!important;line-height:1.2!important;min-width:0!important;width:auto!important}"
  + ".ltfc button[data-ltd] span{font-size:.7rem!important}.ltfc .ltsn{margin:2px 0 6px;font-size:.7rem;color:#5F6B69}";

// ltfDraw(el, districts, F, onChange, cls): cls = {g: grid class, c: chip class, on: selected class}; F = {u, l, f, s}
export const LTF_JS = 'var LTU=' + JSON.stringify(LT_USE) + ',LTL=' + JSON.stringify(LT_LAND) + ',LTT=' + JSON.stringify(LT_TEN) + ',LTS=' + JSON.stringify(LT_STAT) + ',LTN=' + JSON.stringify(LT_NOTE) + ',LTSN=' + JSON.stringify(LT_SNOTE) + ',LTCSS=' + JSON.stringify(LTF_CSS) + ';'
  + 'function ltfOn(F){return !!(F&&(F.u||F.l||F.f||F.s))}'
  + 'function ltfP(c){var a=String(c).split(".");return {u:a[0]==="nr"?"ot":(a[0]||"ot"),l:a[1]||"nr",f:a[2]==="1"||a[2]==="0"?a[2]:"n",s:a.length>3?(String(a[3]).charAt(0)||"k"):"",dis:a.length>3&&String(a[3]).indexOf("!")>0}}'
  + 'function ltfM(c,F,skip){if(!ltfOn(F))return true;if(c==null||c==="")return false;var p=ltfP(c);return (skip==="u"||!F.u||p.u===F.u)&&(skip==="l"||!F.l||(","+F.l+",").indexOf(","+p.l+",")>=0)&&(skip==="f"||!F.f||p.f===F.f)&&(skip==="s"||!F.s||p.s===F.s)}'
  + 'function ltfN(L,F,skip){var n=0;(L||[]).forEach(function(d){var x=d&&d.x||{};for(var k in x)if(Object.prototype.hasOwnProperty.call(x,k)&&ltfM(k,F,skip))n+=Number(x[k])||0});return n}'
  + 'function ltfHas(L){return (L||[]).some(function(d){return d&&d.x&&typeof d.x==="object"})}'
  + 'function ltfHasS(L){return (L||[]).some(function(d){var x=d&&d.x;if(!x||typeof x!=="object")return false;for(var k in x)if(Object.prototype.hasOwnProperty.call(x,k)&&String(k).split(".").length>3)return true;return false})}'
  + 'function ltfDim(L,F,dim){var o={};(L||[]).forEach(function(d){var x=d&&d.x||{};for(var k in x){if(!Object.prototype.hasOwnProperty.call(x,k)||!ltfM(k,F,dim))continue;var p=ltfP(k),v=p[dim];o[v]=(o[v]||0)+(Number(x[k])||0);if(dim==="s"&&p.dis)o["!"]=(o["!"]||0)+(Number(x[k])||0)}});return o}'
  + 'function ltfAsOf(L){var a="";(L||[]).forEach(function(d){if(d&&d.sa&&d.sa>a)a=d.sa});if(!a)return "";var t=new Date(a+"T00:00:00Z");return isNaN(t)?a:t.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})}'
  + 'function ltfE(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c]})}'
  // v736 (Kendall, 4 Nov 2026): one tap = one filter (select / tap again clears), no pop-ups. Steps in order: 1 Status, 2 Land type,
  // 3 Use (only once a land type is chosen: "Narrow <land type> by use", biggest 4 + More... inline), 4 Freehold / Not freehold.
  // ltfSum = the summary line ("Off-plan > Commercial > Homes . 12,340 plots" / "All plots . 265,619"); nm = optional land-id -> card name.
  + 'function ltfLab(dim,v,nm){if(dim==="l"&&nm&&nm[v])return nm[v];var T={u:LTU,l:LTL,f:LTT,s:LTS}[dim]||[],r=v;T.forEach(function(x){if(x[0]===v)r=x[1]});return r}'
  + 'function ltfSum(F,n,nm){var p=[];if(F.s)p.push(ltfLab("s",F.s));if(F.l)p.push(ltfLab("l",F.l,nm));if(F.u)p.push(ltfLab("u",F.u));if(F.f)p.push(ltfLab("f",F.f));var c=(Number(n)||0).toLocaleString("en");return p.length?p.join(" \\u203a ")+" \\u00b7 "+c+" plots":"All plots \\u00b7 "+c}'
  + 'function ltfClr(F){F.u="";F.l="";F.f="";F.s="";F.mu=0}'
  + 'function ltfGrp(L,F,dim,list,lab,cls,max){var o=ltfDim(L,F,dim),a=[],h="";list.forEach(function(x){var n=o[x[0]]||0,on=F[dim]===x[0];if(n||on)a.push([x,n,on])});if(max)a.sort(function(p,q){return q[1]-p[1]});var more=max&&!F["m"+dim]&&a.length>max+1;'
  + '(more?a.filter(function(y,i){return i<max||y[2]}):a).forEach(function(y){h+=\'<button type=button class="\'+cls.c+(y[2]?" "+cls.on:"")+\'" aria-pressed="\'+y[2]+\'" data-ltd="\'+dim+\'" data-ltv="\'+y[0][0]+\'"><b>\'+ltfE(y[0][1])+\'</b><span>\'+y[1].toLocaleString("en")+" plots</span></button>"});'
  + 'if(more)h+=\'<button type=button class="\'+cls.c+\' ltm" data-ltmore="\'+dim+\'"><b>More\\u2026</b><span>\'+(a.length-max)+" more</span></button>";return h?\'<div class="\'+cls.g+\'" role=group aria-label="\'+lab+\'">\'+h+"</div>":"<p class=ltn>No plots here.</p>"}'
  + 'function ltfUse(L,F,cls,nm){return F.l?\'<div class="\'+(cls.tc||"ltt")+\'">Narrow \'+ltfE(ltfLab("l",F.l,nm))+" by use</div>"+ltfGrp(L,F,"u",LTU,"Narrow by use",cls,4):""}'
  + 'function ltfBind(el,F,cb){Array.prototype.forEach.call(el.querySelectorAll("[data-ltd]"),function(b){b.onclick=function(){var d=b.getAttribute("data-ltd"),v=b.getAttribute("data-ltv");F[d]=F[d]===v?"":v;if(d==="l"){F.u="";F.mu=0}cb()}});'
  + 'Array.prototype.forEach.call(el.querySelectorAll("[data-ltmore]"),function(b){b.onclick=function(){F["m"+b.getAttribute("data-ltmore")]=1;cb()}});var x=el.querySelector("[data-ltclr]");if(x)x.onclick=function(){ltfClr(F);cb()}}'
  // cls.only = the steps to draw (any of "sluf", default all four); cls.noL = no land-type chips (the host page has its own land cards)
  + 'function ltfDraw(el,L,F,cb,cls){if(!el)return;if(!ltfHas(L)){el.hidden=true;el.innerHTML="";return}el.hidden=false;cls=cls||{g:"ltg",c:"ltc",on:"on"};var w=cls.only||"sluf",tc=cls.tc||"ltt",h="";'
  + 'function T(t){return \'<div class="\'+tc+\'">\'+t+"</div>"}'
  + 'if(w.indexOf("s")>=0&&ltfHasS(L)){var so=ltfDim(L,F,"s"),ao=ltfAsOf(L);h+=T("Status")+ltfGrp(L,F,"s",LTS,"Status: ready or off-plan",cls)+\'<p class=ltsn>\'+ltfE(LTSN)+(ao?", as of "+ltfE(ao):"")+"."+(so["!"]?" "+so["!"].toLocaleString("en")+" plots: registers disagree (newer record used).":"")+"</p>"}'
  + 'if(w.indexOf("l")>=0&&!cls.noL)h+=T("Land type (DLD)")+ltfGrp(L,F,"l",LTL,"Land type (DLD)",cls);if(w.indexOf("u")>=0)h+=ltfUse(L,F,cls,cls.nm);'
  + 'if(w.indexOf("f")>=0)h+=T("Freehold")+ltfGrp(L,F,"f",LTT.slice(0,2),"Tenure",cls);'
  + 'if(!h&&cls.noNote){el.hidden=true;el.innerHTML="";return}el.innerHTML=\'<style>\'+LTCSS+\'</style><div class=ltfc>\'+h+(cls.noNote?"":\'<p class=ltn>\'+ltfE(LTN)+(ltfOn(F)?\' <button type=button class=ltx data-ltclr=1>Clear filters</button>\':"")+"</p>")+"</div>";ltfBind(el,F,cb)}';
