// PLOT PASSPORT (Najma, More -> PLOT PASSPORT), 2 Nov 2026. Approved to build by Dr. Kendall Wilson; not deployed.
// "One plot. Every connected record. Every claim traceable."
// Click 1: search (parcel number, municipality plot number, area/land number, Najma plot id, project or building name) with suggestions.
// Click 2: the passport - a plain-words summary card, then cards: Research flags, Land, Projects, Permits, Buildings, Timeline, Sources.
//          Every fact carries a strength chip: Direct match / Map-based estimate / Project-level only (tap for one plain line).
//          A view toggle: "Direct facts" (default) or "Everything we hold" (adds the inferred and project-level links, in their own card).
// Click 3: Research report (print / save as PDF, sources and dates) or tap a source card to see how it was linked.
// DATA: KV keys pushed by naj-market-pulse/scripts/build_plot_passport.py (read MotherDuck lk_plot_master, lk_plot_xwalk, najma_plot_coverage, DLD
//       buildings, DM permits and projects): pp_meta, pp_s_<2 chars> (search shards), pp_b_<crc32(id) % buckets> (passports).
// RULES: project-level links are never shown as plot facts and never summed; no DEWA data; no Google content; research use only.
// Page script is String.raw with no substitutions and no backticks.

const PP_ID = /^naj:plot:[A-Za-z0-9\-]{1,40}$/;
const normQ = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
let CRC_T = null;
export function ppCrc32(str) {
  if (!CRC_T) { CRC_T = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c; } }
  const b = new TextEncoder().encode(str); let c = -1;
  for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
const json = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
const escH = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function readJson(env, k) { try { const v = await env.MEETINGS.get(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }

export async function ppSearch(env, q) {
  const n = normQ(q);
  if (n.length < 2) return { q: n, results: [], total: 0, short: true };
  const shard = (await readJson(env, "pp_s_" + n.split(" ")[0].slice(0, 2))) || [];
  const seen = new Set(), out = []; let total = 0;
  for (const e of shard) {
    const t = e[0];
    if (!(t.startsWith(n) || t.indexOf(" " + n) >= 0)) continue;
    if (seen.has(e[2])) continue; seen.add(e[2]); total++;
    if (out.length < 12) out.push({ label: e[1], id: e[2], kind: e[4], exact: t === n });
  }
  out.sort((a, b) => (b.exact - a.exact) || ((a.kind === "number" ? 0 : 1) - (b.kind === "number" ? 0 : 1)));
  return { q: n, results: out, total };
}

export async function ppGet(env, id) {
  if (!PP_ID.test(id || "")) return null;
  const meta = (await readJson(env, "pp_meta")) || {};
  const b = await readJson(env, "pp_b_" + (ppCrc32(id) % (meta.buckets || 4096)));
  return b && b[id] ? b[id] : null;
}

// the plain-English vocabulary, shared by the page and the report
const STRENGTH = {
  d: ["Direct match", "The record carries this plot's own number (parcel, land or building number), so it is about this plot."],
  m: ["Map-based estimate", "Linked by location (it sits inside this plot's outline) or by a plot number written in text. A best match, not a certainty."],
  p: ["Project-level only", "The record belongs to a project that sits on this plot and on others. It is not a fact about this plot alone."]
};
const METHOD = {
  self: "the land register row for this plot", parcel_direct: "same parcel number", area_land: "same area and land number",
  plot_no_parsed: "same municipality plot number", dm_building_parcel: "building number traced to this parcel",
  dm_project_parcel: "construction project number traced to this parcel", point_in_makani_plot: "location inside this plot's outline (Makani map)",
  point_in_empty_plot: "location inside this plot's outline (empty-plot map)", footprint_plot_evidence: "building outline sits on this plot",
  makani_entrance_building: "address number traced through the building entrance", point_in_parcel_2017: "location inside this plot on the 2017 land map",
  text_plot_number: "a plot number written in the record's title or text", via_project: "same registered project (covers all its plots)",
  via_project_name: "same project name (covers all its plots)"
};
const mText = (m) => METHOD[m] || (String(m || "").indexOf("building_") === 0 ? "building identifier traced to this plot" : String(m || "").replace(/_/g, " "));

const ICONS = {   // simple line icons (24 grid, stroke) - icons, never emoji
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', land: '<path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z"/><path d="M9 4v13M15 7v13"/>',
  crane: '<path d="M4 21V5h12M4 5l4-2v2M16 5v4M14 9h4v3h-4zM2 21h8"/>', permit: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  bldg: '<path d="M4 21V7l8-4v18M12 9l8 3v9M2 21h20M7 10h2M7 14h2M15 14h2M15 18h2"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><path d="M7 14h10v7H7z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', pin: '<path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'
};
const ic = (n) => '<svg class=ic viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || "") + "</svg>";

const PP_CSS = String.raw`
:root{--bg:#0C1413;--card:#101D1B;--raise:#152422;--line:#24352F;--ink:#E8E4D8;--soft:#C8D3CE;--muted:#8FA39B;--gold:#C5A56A;--teal:#3E8A7E;--d:#56B584;--m:#D9A441;--p:#8FA39B;--flag:#7FA7C9}
html[data-theme=light] .btn.pri{color:#fff}
html[data-theme=light]{--bg:#F2EEE3;--card:#FBF8F1;--raise:#EFE9DA;--line:#DDD5C2;--ink:#1A2422;--soft:#33403D;--muted:#5E6E68;--gold:#8E6E35;--teal:#2F6E64;--d:#2E7D55;--m:#9A6A12;--p:#5E6E68;--flag:#3D6788}
*{box-sizing:border-box}body{background:var(--bg);color:var(--ink);font-family:"IBM Plex Sans",system-ui,sans-serif;margin:0 auto;padding:16px 16px 104px;max-width:760px;-webkit-text-size-adjust:100%;line-height:1.45}
.ic{width:18px;height:18px;flex:none}
h1{font-family:Fraunces,Georgia,serif;font-size:1.7rem;font-weight:600;margin:.2rem 0 .1rem;line-height:1.15}h1 em{font-style:normal;color:var(--gold)}
.sub{color:var(--muted);font-size:.86rem;margin:0 0 14px}
.sbar{display:flex;gap:8px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:6px 6px 6px 12px}
.sbar:focus-within{border-color:var(--gold)}.sbar .ic{color:var(--muted)}
.sbar input{flex:1;min-width:0;min-height:44px;border:0;background:transparent;color:var(--ink);font:inherit;font-size:16px;outline:none}
.sbar input::-webkit-search-cancel-button{-webkit-appearance:none}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;min-width:44px;padding:0 14px;border:1px solid var(--line);border-radius:9px;background:var(--raise);color:var(--ink);font:inherit;font-size:.86rem;font-weight:600;cursor:pointer;text-decoration:none}
.btn:hover,.btn:focus-visible{border-color:var(--gold)}.btn.pri{background:var(--gold);color:#0C1413;border-color:var(--gold)}.btn[hidden]{display:none}
.hint{color:var(--muted);font-size:.8rem;margin:8px 2px;min-height:1.1em}
.sug{display:grid;grid-template-columns:1fr;gap:8px;margin:6px 0 10px}
@media(min-width:620px){.sug{grid-template-columns:1fr 1fr}}
.sg{display:flex;gap:10px;align-items:center;text-align:left;min-height:56px;padding:10px 12px;border:1px solid var(--line);border-radius:11px;background:var(--card);color:var(--ink);font:inherit;cursor:pointer}
.sg:hover,.sg:focus-visible{border-color:var(--gold)}.sg .ic{color:var(--gold)}.sg b{display:block;font-size:.92rem;overflow-wrap:anywhere}.sg small{color:var(--muted);font-size:.74rem}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin:0 0 12px}
.card h2{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-family:"IBM Plex Mono",monospace;font-size:.72rem;letter-spacing:.1em;color:var(--gold);font-weight:500;text-transform:uppercase}
.card h2 .n{margin-left:auto;color:var(--muted);letter-spacing:.04em}
.sum{border-left:3px solid var(--gold)}.sum .t{font-family:Fraunces,Georgia,serif;font-size:1.35rem;font-weight:600;margin:0}.sum .w{color:var(--muted);font-size:.82rem;margin:2px 0 10px}
.sum p{margin:0 0 10px;font-size:.95rem;color:var(--soft)}
.acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.jump{display:flex;gap:6px;overflow-x:auto;margin:0 0 12px;padding-bottom:2px;scrollbar-width:none}.jump a{flex:none;display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border:1px solid var(--line);border-radius:18px;color:var(--soft);text-decoration:none;font-size:.8rem}
.seg{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--line);border-radius:10px;overflow:hidden;margin:0 0 12px}
.seg button{min-height:44px;border:0;background:var(--card);color:var(--muted);font:inherit;font-size:.84rem;font-weight:600;cursor:pointer}.seg button[aria-pressed=true]{background:var(--raise);color:var(--ink);box-shadow:inset 0 -2px 0 var(--gold)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.f{background:var(--raise);border-radius:10px;padding:9px 10px;min-width:0}.f .l{color:var(--muted);font-size:.7rem;letter-spacing:.03em}.f .v{font-size:.95rem;font-weight:600;overflow-wrap:anywhere;margin:2px 0 4px}
.f.wide{grid-column:1/-1}
.it{background:var(--raise);border-radius:10px;padding:10px;margin:0 0 8px}.it .h{display:flex;gap:8px;align-items:flex-start;justify-content:space-between}.it b{font-size:.92rem;overflow-wrap:anywhere}
.it .m{color:var(--muted);font-size:.8rem;margin-top:3px;overflow-wrap:anywhere}
.chip{display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:0 9px;border-radius:14px;border:1px solid currentColor;background:transparent;font:inherit;font-size:.7rem;font-weight:600;cursor:pointer;white-space:nowrap}
.chip:before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
.chip.d{color:var(--d)}.chip.m{color:var(--m)}.chip.p{color:var(--p)}.chip.m:before{background:transparent;border:1.5px solid currentColor}.chip.p:before{border-radius:1px}
.exp{display:none;font-size:.78rem;color:var(--soft);margin:6px 0 0;padding:6px 8px;border-left:2px solid var(--line)}.exp.on{display:block}
.flagc{border-left:3px solid var(--flag)}.flagc h2{color:var(--flag)}.fl{display:flex;gap:8px;font-size:.86rem;color:var(--soft);margin:0 0 8px}.fl .ic{color:var(--flag);margin-top:2px}
.tl{position:relative;margin:0;padding:0 0 0 18px;list-style:none}.tl:before{content:"";position:absolute;left:5px;top:4px;bottom:4px;width:2px;background:var(--line)}
.tl li{position:relative;margin:0 0 10px}.tl li:before{content:"";position:absolute;left:-17px;top:6px;width:10px;height:10px;border-radius:50%;background:var(--card);border:2px solid var(--gold)}
.tl .dt{font-family:"IBM Plex Mono",monospace;font-size:.72rem;color:var(--muted)}.tl .wt{font-size:.88rem}
.more{width:100%;margin-top:4px}
.empty{color:var(--muted);font-size:.86rem;margin:0}
.legend summary{cursor:pointer;min-height:44px;display:flex;align-items:center;gap:8px;color:var(--soft);font-size:.86rem}
.legend .row{display:flex;gap:10px;align-items:flex-start;margin:8px 0;font-size:.84rem;color:var(--soft)}
.note{color:var(--muted);font-size:.74rem;margin:14px 2px}
.inf{border-style:dashed}
.browse h2{margin-bottom:8px}.steps{display:grid;grid-template-columns:1fr;gap:8px}@media(min-width:620px){.steps{grid-template-columns:1fr 1fr}}
.step{display:flex;gap:12px;align-items:center;text-align:left;min-height:60px;padding:10px 12px;border:1px solid var(--line);border-radius:11px;background:var(--raise);color:var(--ink);font:inherit;cursor:pointer;width:100%}
.step:hover,.step:focus-visible{border-color:var(--gold)}.step:disabled{opacity:.55;cursor:default}
.step .sn{flex:none;width:26px;height:26px;border-radius:50%;background:var(--gold);color:#0C1413;font-family:"IBM Plex Mono",monospace;font-size:.75rem;display:flex;align-items:center;justify-content:center}
.step small{display:block;color:var(--muted);font-size:.7rem;letter-spacing:.04em}.step b{display:block;font-size:.95rem;overflow-wrap:anywhere}
.or{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:.74rem;margin:4px 0 10px}.or:before,.or:after{content:"";flex:1;height:1px;background:var(--line)}
.scrim{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:60}.scrim[hidden],.sheet[hidden]{display:none}
.sheet{position:fixed;left:0;right:0;bottom:0;z-index:61;max-height:86vh;display:flex;flex-direction:column;background:var(--card);border-top:1px solid var(--line);border-radius:16px 16px 0 0;padding:10px 16px calc(14px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px rgba(0,0,0,.35)}
@media(min-width:760px){.sheet{left:50%;right:auto;bottom:auto;top:8vh;width:560px;transform:translateX(-50%);border-radius:16px;border:1px solid var(--line);max-height:80vh}}
.sheet .grab{width:40px;height:4px;border-radius:2px;background:var(--line);margin:0 auto 8px}
.shd{display:flex;align-items:center;gap:8px;margin:0 0 8px}.shd b{flex:1;font-family:Fraunces,Georgia,serif;font-size:1.15rem}
.sheet input{min-height:48px;border:1px solid var(--line);border-radius:10px;background:var(--raise);color:var(--ink);font:inherit;font-size:16px;padding:0 12px;width:100%}
.sheet input:focus{outline:none;border-color:var(--gold)}
.shl{overflow:auto;-webkit-overflow-scrolling:touch;margin-top:8px;flex:1}
.opt{display:flex;gap:10px;align-items:center;width:100%;text-align:left;min-height:52px;padding:8px 10px;margin:0 0 6px;border:1px solid var(--line);border-radius:10px;background:var(--raise);color:var(--ink);font:inherit;cursor:pointer}
.opt:hover,.opt:focus-visible{border-color:var(--gold)}.opt .ic{color:var(--gold)}.opt b{display:block;font-size:.92rem;overflow-wrap:anywhere}.opt small{color:var(--muted);font-size:.74rem}.opt.sp{border-style:dashed}
.crumb{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:0 0 10px;font-size:.82rem;color:var(--muted)}
.crumb button{min-height:36px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--gold);font:inherit;font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.crumb span[aria-current]{color:var(--ink);font-weight:600;padding:0 4px}
`;

const PP_JS = String.raw`(function(){
var KEY=document.body.getAttribute("data-key")||"",RK=document.body.getAttribute("data-rk")||"";
var ST={"d":["Direct match","The record carries this plot's own number (parcel, land or building number), so it is about this plot."],"m":["Map-based estimate","Linked by location (it sits inside this plot's outline) or by a plot number written in text. A best match, not a certainty."],"p":["Project-level only","The record belongs to a project that sits on this plot and on others. It is not a fact about this plot alone."]};
var MT=JSON.parse(document.getElementById("ppmt").textContent);
var $=function(i){return document.getElementById(i)};
var q=$("ppq"),sug=$("ppsug"),hint=$("pphint"),out=$("ppout"),clr=$("ppclr");
var VIEW="d",CUR=null,T=null,SEQ=0;
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function ic(n){var t=document.getElementById("ic-"+n);return t?t.innerHTML:""}
function kq(){return "key="+encodeURIComponent(KEY)+(RK?"&rk="+encodeURIComponent(RK):"")}
function chip(s){return '<button type=button class="chip '+s+'" data-chip="'+s+'" aria-expanded=false>'+ST[s][0]+'</button>'}
function expl(s){return '<div class=exp>'+esc(ST[s][1])+'</div>'}
function mt(m){return MT[m]||(String(m||"").indexOf("building_")===0?"building identifier traced to this plot":String(m||"").replace(/_/g," "))}
function num(v){if(v==null||v==="")return null;var n=Number(v);return isFinite(n)?n.toLocaleString("en-US"):String(v)}
function dt(s){if(!s)return "";var d=new Date(s+"T00:00:00Z");return isNaN(d)?s:d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})}
function fact(l,v,s,wide){if(v==null||v==="")return "";return '<div class="f'+(wide?" wide":"")+'"><div class=l>'+esc(l)+'</div><div class=v>'+esc(v)+'</div>'+chip(s)+expl(s)+'</div>'}
function sec(id,icn,title,n,body){return '<section class=card id="'+id+'"><h2>'+ic(icn)+esc(title)+(n!=null?'<span class=n>'+n+'</span>':"")+'</h2>'+body+'</section>'}
function list(items,fn,first){if(!items.length)return "";var h="";items.forEach(function(x,i){h+='<div class=it'+(i>=first?' data-x hidden':'')+'>'+fn(x)+'</div>'});if(items.length>first)h+='<button type=button class="btn more" data-more>Show all '+items.length+'</button>';return h}
function say(t){hint.textContent=t}

function search(){var v=q.value.trim();clr.hidden=!v;if(T)clearTimeout(T);if(v.length<2){sug.innerHTML="";say(v?"Type at least two letters or digits.":"");return}
  T=setTimeout(function(){var my=++SEQ;say("Searching…");
    fetch("/plot_passport/search?"+kq()+"&q="+encodeURIComponent(v)).then(function(r){return r.json()}).then(function(j){if(my!==SEQ)return;
      if(!j.results||!j.results.length){sug.innerHTML="";say("No plot matches “"+v+"”. Try the parcel number (seven digits), the plot number as 319-268, or a project name.");return}
      say(j.total>j.results.length?("Showing "+j.results.length+" of "+j.total+". Keep typing to narrow it."):(j.total===1?"One plot matches.":j.total+" plots match."));
      sug.innerHTML=j.results.map(function(r){return '<button type=button class=sg data-id="'+esc(r.id)+'">'+ic(r.kind==="name"?"bldg":"pin")+'<span><b>'+esc(r.label)+'</b><small>'+(r.kind==="name"?"by name":"by number")+'</small></span></button>'}).join("")}).catch(function(){say("Search is not reachable just now. Try again in a moment.")})},180)}

var CTX={};function open(id,push,ctx){CTX=ctx||{d:null,g:null};closeSheet();say("Opening the passport…");sug.innerHTML="";
  fetch("/plot_passport/p?"+kq()+"&id="+encodeURIComponent(id)).then(function(r){return r.json()}).then(function(j){if(!j.ok){say(j.error||"That plot is not in the passport data.");return}
    CUR=j.plot;say("");render();if(push!==false){try{history.pushState({id:id},"","/plot_passport?"+kq()+"&id="+encodeURIComponent(id))}catch(e){}}
    var s=$("pp-crumb");if(s)s.scrollIntoView({block:"start"})}).catch(function(){say("The passport could not be opened just now.")})}

function sentence(p){var a=[];var sq=p.sqm?(num(Math.round(p.sqm))+" sq m ("+num(Math.round(p.sqm*10.7639))+" sq ft)"):null;
  var use=(p.sub_type||p.land_type||"").toLowerCase();
  a.push("A "+(sq?sq+" ":"")+(use?use+" ":"")+"plot"+(p.area_name?" in "+p.area_name:"")+".");
  var b=p.buildings.length,pr=p.projects.length,pe=p.permits.length;
  a.push(b?("On it: "+b+" registered building"+(b>1?"s":"")+"."):"No registered building is linked to it.");
  var live=p.projects.filter(function(x){return !x.done&&!/complet|cancel|closed|reject|withdraw/i.test(x.status||"")}).length;
  if(pr)a.push((live?live+" construction project"+(live>1?"s":"")+" not yet marked complete":"Construction projects recorded, all marked complete")+(pe?", "+pe+(pe>=12?"+":"")+" permit"+(pe>1?"s":""):"")+".");
  else if(pe)a.push(pe+" permit"+(pe>1?"s":"")+" on record.");
  a.push(p.last?("Last recorded change: "+dt(p.last)+"."):"No dated change on record.");
  return a.join(" ")}

function render(){var p=CUR;if(!p)return;var ttl="Plot "+(p.parcel||p.plot_no||p.id.replace("naj:plot:",""));document.title=ttl+" — Plot passport";
  var dn=CTX.d?CTX.d.name:(p.area_name||"District"),gn=CTX.g?CTX.g.name:null;
  var h='<nav class=crumb id=pp-crumb aria-label="Where this plot sits"><button type=button data-crumb=d>'+esc(dn)+'</button><span aria-hidden=true>›</span>'+(gn?'<button type=button data-crumb=g>'+esc(gn)+'</button><span aria-hidden=true>›</span>':'')+'<span aria-current=page>'+esc(ttl)+'</span></nav>';
  h+='<section class="card sum" id=pp-sum><p class=t>'+esc(ttl)+'</p><div class=w>'+esc([p.area_name,p.master||p.project].filter(function(v,i,a){return v&&a.indexOf(v)===i}).join(" · "))+'</div><p>'+esc(sentence(p))+'</p>'
   +'<div class=acts><a class="btn pri" target=_blank rel=noopener href="/plot_passport/report?'+kq()+'&id='+encodeURIComponent(p.id)+'">'+ic("print")+'Research report</a><button type=button class=btn id=ppcopy>'+ic("copy")+'Copy link</button></div></section>';
  h+='<nav class=jump aria-label="Sections"><a href="#pp-land">Land</a><a href="#pp-proj">Projects</a><a href="#pp-perm">Permits</a><a href="#pp-bldg">Buildings</a><a href="#pp-tl">Timeline</a><a href="#pp-src">Sources</a></nav>';
  h+='<div class=seg role=group aria-label="What to show"><button type=button data-view=d aria-pressed='+(VIEW==="d")+'>Direct facts</button><button type=button data-view=all aria-pressed='+(VIEW==="all")+'>Everything we hold</button></div>';
  if(p.flags&&p.flags.length)h+='<section class="card flagc"><h2>'+ic("flag")+'Research flags<span class=n>'+p.flags.length+'</span></h2>'+p.flags.map(function(f){return '<div class=fl>'+ic("info")+'<span>'+esc(f.t)+'</span></div>'}).join("")+'<p class=empty>Flags point to gaps or disagreements between records. They are not a judgement on the plot.</p></section>';
  var land=fact("Plot area",p.sqm?num(Math.round(p.sqm))+" sq m":null,"d")+fact("Land use",p.land_type,"d")+fact("Registered as",[p.prop_type,p.sub_type].filter(Boolean).join(", "),"d")+fact("Ownership",p.freehold==null?null:(p.freehold?"Freehold (open to all nationalities)":"Not freehold"),"d")
   +fact("Area",p.area_name,"d")+fact("Master community",p.master,"d")+fact("Project on the register",p.project,"d",true)
   +fact("Parcel number",p.parcel,"d")+fact("Municipality plot number",p.plot_no,"d")+fact("Area / land number",p.area_land,"d")+fact("Najma plot id",p.id,"d",true);
  h+=sec("pp-land","land","Land",null,'<div class=grid2>'+land+'</div><p class=note>From the Dubai Land Department land register, snapshot '+esc(dt(p.as_of))+'.</p>');
  h+=sec("pp-proj","crane","Projects",p.projects.length,list(p.projects,function(x){return '<div class=h><b>Construction project '+esc(x.no)+'</b>'+chip(x.s)+'</div>'+expl(x.s)+'<div class=m>'+esc([x.status,x.start?"works started "+dt(x.start):"",x.done?"completed "+dt(x.done):(x.due?"expected "+dt(x.due):"")].filter(Boolean).join(" · "))+'</div><div class=m>'+esc([x.consultant?"Consultant: "+x.consultant:"",x.contractor?"Contractor: "+x.contractor:""].filter(Boolean).join(" · "))+'</div>'},3)||'<p class=empty>No construction project is linked to this plot.</p>');
  h+=sec("pp-perm","permit","Permits",p.permits.length+(p.permits.length>=12?"+":""),list(p.permits,function(x){return '<div class=h><b>'+esc(x.type||"Permit")+'</b>'+chip(x.s)+'</div>'+expl(x.s)+'<div class=m>'+esc(["No. "+x.no,x.status,dt(x.date),x.btype].filter(Boolean).join(" · "))+'</div>'},3)||'<p class=empty>No building permit is linked to this plot.</p>');
  h+=sec("pp-bldg","bldg","Buildings",p.buildings.length,list(p.buildings,function(x){return '<div class=h><b>'+esc(x.name||("Building "+(x.no||"")))+'</b>'+chip(x.s)+'</div>'+expl(x.s)+'<div class=m>'+esc([x.type,x.floors?x.floors+" floor"+(x.floors=="1"?"":"s"):"",x.flats?x.flats+" flats":"",x.shops?x.shops+" shops":"",x.offices?x.offices+" offices":"",x.date?"registered "+dt(x.date):""].filter(Boolean).join(" · "))+'</div>'},3)||'<p class=empty>No registered building is linked to this plot.</p>');
  h+=sec("pp-tl","clock","Timeline",p.timeline.length,p.timeline.length?'<ol class=tl>'+p.timeline.map(function(x,i){return '<li'+(i>=6?' data-x hidden':'')+'><div class=dt>'+esc(dt(x.date))+'</div><div class=wt>'+esc(x.what)+'</div></li>'}).join("")+'</ol>'+(p.timeline.length>6?'<button type=button class="btn more" data-more>Show all '+p.timeline.length+'</button>':''):'<p class=empty>No dated events on record.</p>');
  var ev=p.evidence.filter(function(x){return VIEW==="all"||x.s==="d"});
  var srcItem=function(x){return '<div class=h><b>'+esc(x.label)+'</b>'+chip(x.s)+'</div>'+expl(x.s)+'<div class=m>Linked by '+esc(mt(x.method))+' · '+x.n+' key'+(x.n>1?"s":"")+'</div><div class=m data-x hidden>Source table '+esc(x.src)+' · link strength '+Math.round(x.conf*100)+' in 100'+(x.cov!=null?' · '+Math.round(x.cov)+'% of this source reaches a plot':'')+(x.as_of?' · as of '+esc(dt(x.as_of)):'')+'</div><button type=button class=btn data-det style="margin-top:6px;min-height:36px">How it was linked</button>'};
  h+=sec("pp-src","link","Sources",ev.length,ev.length?ev.map(function(x,i){return '<div class=it'+(i>=6?' data-x hidden':'')+'>'+srcItem(x)+'</div>'}).join("")+(ev.length>6?'<button type=button class="btn more" data-more>Show all '+ev.length+'</button>':''):'<p class=empty>No source is linked to this plot.</p>');
  if(VIEW==="all"){var inf=p.projlevel||[];h+='<section class="card inf"><h2>'+ic("link")+'Inferred associations<span class=n>'+inf.length+'</span></h2><p class=empty style="margin-bottom:8px">These records belong to a project that sits on this plot and others. They describe the project, not this plot, and are never added up per plot.</p>'+(inf.length?inf.map(function(x){return '<div class=it>'+srcItem(x)+'</div>'}).join(""):'<p class=empty>None held.</p>')+'</section>'}
  else{var nm=p.evidence.filter(function(x){return x.s!=="d"}).length+(p.projlevel||[]).length;if(nm)h+='<p class=note>'+nm+' more source'+(nm>1?"s":"")+' reach this plot by location or by project. Choose “Everything we hold” to see them, clearly labelled.</p>'}
  h+='<p class=note>Research use only. Built '+esc(p.rule||"")+'. Every fact names how it was matched; nothing here is a legal title or a valuation.</p>';
  out.innerHTML=h}

document.addEventListener("click",function(e){var t=e.target.closest("button,a");if(!t)return;
  if(t.classList.contains("sg")){open(t.getAttribute("data-id"));return}
  if(t.hasAttribute("data-chip")){var x=t.parentNode.querySelector(".exp")||t.closest(".f,.it").querySelector(".exp");if(x){var on=!x.classList.contains("on");x.classList.toggle("on",on);t.setAttribute("aria-expanded",on)}return}
  if(t.hasAttribute("data-view")){VIEW=t.getAttribute("data-view");render();var s=$("pp-src");return}
  if(t.hasAttribute("data-more")){var c=t.parentNode;[].forEach.call(c.querySelectorAll(".it[data-x],li[data-x]"),function(n){n.hidden=false});t.remove();return}
  if(t.hasAttribute("data-det")){var d=t.parentNode.querySelector(".m[data-x]");if(d){d.hidden=!d.hidden;t.textContent=d.hidden?"How it was linked":"Hide"}return}
  if(t.id==="ppcopy"){try{navigator.clipboard.writeText(location.href);t.lastChild.textContent="Link copied"}catch(err){}return}
  if(t.hasAttribute("data-opt")){var o=SH[+t.getAttribute("data-opt")];if(o)o.fn();return}
  if(t.id==="ppshx"){closeSheet();return}
  if(t.id==="ppb1"){districts();return}
  if(t.id==="ppb2"){groups();return}
  if(t.hasAttribute("data-crumb")){if(t.getAttribute("data-crumb")==="g"&&CTX.g){DC=CTX.d;pickG(CTX.g);return}
    var sl=(CTX.d&&CTX.d.slug)||(CUR&&CUR.district);if(sl)pickD(sl);else districts();return}
  if(t.id==="ppclr"){q.value="";search();q.focus();return}});
var sh=$("ppsheet"),scr=$("ppscrim"),shq=$("ppshq"),shl=$("ppshl"),SH=[],SHBACK=null,DL=null,DC=null,DCACHE={};
function nq(s){return String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function hit(o,f){return !f||o.sticky||(" "+nq(o.t)).indexOf(" "+f)>=0||nq(o.t).indexOf(f)>=0}
function drawSheet(){var f=nq(shq.value),n=0,m=0,h="";SH.forEach(function(o,i){if(!hit(o,f))return;if(!o.sticky)m++;if(n>=150)return;n++;h+='<button type=button class="opt'+(o.sticky?" sp":"")+'" data-opt="'+i+'">'+ic(o.i||"pin")+'<span><b>'+esc(o.t)+'</b>'+(o.s?'<small>'+esc(o.s)+'</small>':'')+'</span></button>'});
  shl.innerHTML=h+(m>150?'<p class=empty>'+m+' match. Type more letters to narrow the list.</p>':'')+(!n?'<p class=empty>Nothing matches “'+esc(shq.value)+'” here.</p>':'')}
function openSheet(title,items,ph,back){SH=items;SHBACK=back||document.activeElement;$("ppsht").textContent=title;shq.value="";shq.placeholder=ph||"Type the first few letters";shq.setAttribute("aria-label",ph||"Filter this list");drawSheet();sh.hidden=false;scr.hidden=false;try{shq.focus({preventScroll:true})}catch(e){}}
function closeSheet(){if(sh.hidden)return;sh.hidden=true;scr.hidden=true;if(SHBACK&&SHBACK.focus)try{SHBACK.focus({preventScroll:true})}catch(e){}}
function getJ(u){return fetch(u).then(function(r){return r.json()})}
function districts(){if(DL){openSheet("Choose a district",DL.map(function(d){return {t:d.name,s:num(d.n)+" plots",i:"pin",fn:function(){pickD(d.slug)}}}),"Type a district, e.g. Business Bay",$("ppb1"));return}
  getJ("/plot_passport/districts?"+kq()).then(function(j){DL=j.districts||[];if(!DL.length){say("The district list has not been loaded yet.");return}districts()}).catch(function(){say("The district list is not reachable just now.")})}
function pickD(slug){var go=function(d){DC=d;$("ppb1v").textContent=d.name;$("ppb2").disabled=false;$("ppb2v").textContent="Choose a building or project";groups()};
  if(DCACHE[slug])return go(DCACHE[slug]);getJ("/plot_passport/d?"+kq()+"&slug="+encodeURIComponent(slug)).then(function(j){if(!j.ok){say(j.error||"That district is not loaded yet.");return}DCACHE[slug]=j.district;go(j.district)}).catch(function(){say("That district is not reachable just now.")})}
function kindW(k){return k==="b"?"building":k==="p"?"project":k==="m"?"master community":"buildings"}
function groups(){if(!DC)return districts();var it=[];if(DC.vacant&&DC.vacant.length)it.push({t:"Plots without a building",s:num(DC.vacant.length)+" plots of vacant or unbuilt land",i:"land",sticky:true,fn:function(){pickG({name:"Plots without a building",plots:DC.vacant})}});
  DC.groups.forEach(function(g){it.push({t:g[0],s:kindW(g[1])+" · "+(g[2].length===1?"1 plot":g[2].length+" plots"),i:g[1]==="m"?"land":g[1]==="p"?"crane":"bldg",fn:function(){pickG({name:g[0],plots:g[2]})}})});
  openSheet(DC.name+": buildings and projects",it,"Type the first few letters of the building",$("ppb2"))}
function pickG(g){$("ppb2v").textContent=g.name;if(g.plots.length===1){open(g.plots[0][0],true,{d:DC,g:g});return}
  openSheet(g.name+": choose the plot",g.plots.map(function(x){return {t:x[1],i:"pin",fn:function(){open(x[0],true,{d:DC,g:g})}}}),"Type a plot number",$("ppb2"))}
shq.addEventListener("input",drawSheet);
shq.addEventListener("keydown",function(e){if(e.key==="Enter"){var f=shl.querySelector(".opt");if(f)f.click()}});
document.addEventListener("keydown",function(e){if(e.key==="Escape")closeSheet()});
scr.addEventListener("click",closeSheet);
q.addEventListener("input",search);
q.addEventListener("keydown",function(e){if(e.key==="Enter"){var f=sug.querySelector(".sg");if(f)open(f.getAttribute("data-id"))}});
window.addEventListener("popstate",function(e){if(e.state&&e.state.id)open(e.state.id,false)});
var st0=new URLSearchParams(location.search).get("id");if(st0)open(st0,false);
})();`;

export function plotPassportHtml(key, rk, meta, deps) {
  const icTpl = Object.keys(ICONS).map((n) => '<template id="ic-' + n + '">' + ic(n) + "</template>").join("");
  const fresh = meta && meta.as_of ? "Register snapshot " + escH(meta.as_of) + " · " + Number(meta.plots || 0).toLocaleString("en-US") + " plots" + (meta.pilot ? " (pilot set)" : "") : "The plot data has not been loaded yet.";
  const leg = ["d", "m", "p"].map((s) => '<div class=row><span class="chip ' + s + '" style="cursor:default">' + STRENGTH[s][0] + "</span><span>" + escH(STRENGTH[s][1]) + "</span></div>").join("");
  return '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<title>Plot passport — Najma</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">' + (deps.NAJ_FONTS || "")
    + '<script>try{var t=localStorage.getItem("naj_thm")||((window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark");document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>'
    + "<style>" + PP_CSS + (deps.NAJ_NAV_CSS || "") + "html[data-theme=light] .nnav{background:rgba(242,238,227,.95);border-top-color:#DDD5C2}</style></head>"
    + '<body data-key="' + escH(key) + '" data-rk="' + escH(rk || "") + '">' + icTpl
    + '<h1>Plot <em>passport</em></h1><p class=sub>One plot. Every connected record. Every claim traceable.</p>'
    + '<section class="card browse" aria-label="Find a plot by place"><h2>' + ic("pin") + 'Find it by place</h2><div class=steps>'
    + '<button type=button class=step id=ppb1 aria-haspopup=dialog><span class=sn>1</span><span><small>DISTRICT</small><b id=ppb1v>Choose a district</b></span></button>'
    + '<button type=button class=step id=ppb2 aria-haspopup=dialog disabled><span class=sn>2</span><span><small>BUILDING OR PROJECT</small><b id=ppb2v>Choose a district first</b></span></button>'
    + '</div><p class=empty style="margin-top:8px">Pick the district, then the building. A building on one plot opens its passport straight away.</p></section>'
    + '<div class=or>or search if you know the number</div>'
    + '<div class=scrim id=ppscrim hidden></div><div class=sheet id=ppsheet hidden role=dialog aria-modal=true aria-labelledby=ppsht><div class=grab aria-hidden=true></div><div class=shd><b id=ppsht></b><button type=button class=btn id=ppshx aria-label="Close this list">' + ic("x") + '</button></div><input id=ppshq type=search autocomplete=off><div class=shl id=ppshl></div></div>'
    + '<div class=sbar role=search>' + ic("search") + '<input id=ppq type=search inputmode=search autocomplete=off placeholder="Parcel number, plot number or project name" aria-label="Search for a plot by parcel number, plot number, or project or building name"><button type=button class=btn id=ppclr hidden aria-label="Clear the search">' + ic("x") + "</button></div>"
    + '<div class=hint id=pphint aria-live=polite></div><div class=sug id=ppsug></div><div id=ppout></div>'
    + '<details class="card legend"><summary>' + ic("info") + "What the labels mean</summary>" + leg + "</details>"
    + '<p class=note>' + fresh + ". Sources: Dubai Land Department and Dubai Municipality open data, linked by Najma. Research use only.</p>"
    + '<script type=application/json id=ppmt>' + JSON.stringify(METHOD).replace(/</g, "\\u003c") + "</script>"
    + "<script>" + PP_JS + "</script>" + (deps.najNav ? deps.najNav(key, "more", rk) : "") + "</body></html>";
}

export function plotReportHtml(p, meta) {
  const e = escH, d = (s) => (s ? e(s) : "—");
  const chipT = (s) => '<span class="c ' + s + '">' + STRENGTH[s][0] + "</span>";
  const row = (l, v) => (v == null || v === "" ? "" : "<tr><th>" + e(l) + "</th><td>" + e(v) + "</td><td>" + chipT("d") + "</td></tr>");
  const ttl = "Plot " + (p.parcel || p.plot_no || p.id);
  const tbl = (head, rows) => (rows.length ? "<table><thead><tr>" + head.map((h) => "<th>" + h + "</th>").join("") + "</tr></thead><tbody>" + rows.join("") + "</tbody></table>" : "<p class=e>None linked.</p>");
  return '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>' + e(ttl) + " — research report</title><style>"
    + 'body{font-family:"IBM Plex Sans",system-ui,sans-serif;color:#1A2422;background:#fff;max-width:820px;margin:0 auto;padding:20px 16px;font-size:13px;line-height:1.45}'
    + "h1{font-family:Georgia,serif;font-size:22px;margin:0}h2{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#8E6E35;border-bottom:1px solid #DDD5C2;padding-bottom:4px;margin:20px 0 8px}"
    + "table{width:100%;border-collapse:collapse;margin:0 0 6px}th,td{text-align:left;vertical-align:top;padding:5px 6px;border-bottom:1px solid #EEE8DA;overflow-wrap:anywhere}thead th{font-size:11px;color:#5E6E68}"
    + ".c{display:inline-block;border:1px solid;border-radius:10px;padding:0 7px;font-size:10.5px;white-space:nowrap}.c.d{color:#2E7D55}.c.m{color:#9A6A12}.c.p{color:#5E6E68}"
    + ".e{color:#5E6E68}.top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.pb{min-height:44px;padding:0 14px;border:1px solid #8E6E35;background:#8E6E35;color:#fff;border-radius:8px;font:inherit;cursor:pointer}"
    + ".ft{color:#5E6E68;font-size:11px;margin-top:24px;border-top:1px solid #DDD5C2;padding-top:8px}@media print{.pb{display:none}body{padding:0}}"
    + "@media(max-width:560px){table,thead,tbody,tr,th,td{display:block}thead{display:none}tr{border-bottom:1px solid #DDD5C2;padding:4px 0}th,td{border:0;padding:2px 0}}"
    + "</style></head><body>"
    + '<div class=top><div><h1>' + e(ttl) + "</h1><div class=e>" + e([p.area_name, p.master || p.project].filter(Boolean).join(" · ")) + " · Najma plot id " + e(p.id) + '</div></div><button class=pb onclick="print()">Print or save as PDF</button></div>'
    + "<h2>How to read this report</h2><table>" + ["d", "m", "p"].map((s) => "<tr><td>" + chipT(s) + "</td><td>" + e(STRENGTH[s][1]) + "</td></tr>").join("") + "</table>"
    + (p.flags && p.flags.length ? "<h2>Research flags</h2><table>" + p.flags.map((f) => "<tr><td>" + e(f.t) + "</td></tr>").join("") + "</table>" : "")
    + "<h2>Land (land register, snapshot " + d(p.as_of) + ")</h2><table>" + row("Plot area", p.sqm ? Math.round(p.sqm).toLocaleString("en-US") + " sq m (" + Math.round(p.sqm * 10.7639).toLocaleString("en-US") + " sq ft)" : null)
    + row("Land use", p.land_type) + row("Registered as", [p.prop_type, p.sub_type].filter(Boolean).join(", ")) + row("Ownership", p.freehold == null ? null : p.freehold ? "Freehold" : "Not freehold")
    + row("Area", p.area_name) + row("Master community", p.master) + row("Project on the register", p.project) + row("Parcel number", p.parcel) + row("Municipality plot number", p.plot_no) + row("Area / land number", p.area_land) + "</table>"
    + "<h2>Construction projects (Dubai Municipality)</h2>" + tbl(["Project", "Status", "Dates", "Consultant / contractor", "Strength"], p.projects.map((x) => "<tr><td>" + d(x.no) + "</td><td>" + d(x.status) + "</td><td>" + e(["started " + (x.start || "—"), x.done ? "completed " + x.done : "expected " + (x.due || "—")].join("; ")) + "</td><td>" + e([x.consultant, x.contractor].filter(Boolean).join(" / ")) + "</td><td>" + chipT(x.s) + "</td></tr>"))
    + "<h2>Building permits (Dubai Municipality)</h2>" + tbl(["Permit", "Type", "Status", "Date", "Strength"], p.permits.map((x) => "<tr><td>" + d(x.no) + "</td><td>" + d(x.type) + "</td><td>" + d(x.status) + "</td><td>" + d(x.date) + "</td><td>" + chipT(x.s) + "</td></tr>"))
    + "<h2>Buildings (Dubai Land Department)</h2>" + tbl(["Building", "Type", "Floors", "Registered", "Strength"], p.buildings.map((x) => "<tr><td>" + e(x.name || x.no) + "</td><td>" + d(x.type) + "</td><td>" + d(x.floors) + "</td><td>" + d(x.date) + "</td><td>" + chipT(x.s) + "</td></tr>"))
    + "<h2>Timeline</h2>" + tbl(["Date", "Event", "Source table"], p.timeline.map((x) => "<tr><td>" + d(x.date) + "</td><td>" + e(x.what) + "</td><td>" + e(x.src) + "</td></tr>"))
    + "<h2>Sources and how each was linked</h2>" + tbl(["Source", "Linked by", "Keys", "As of", "Strength"], p.evidence.concat(p.projlevel || []).map((x) => "<tr><td>" + e(x.label) + "<br><span class=e>" + e(x.src) + "</span></td><td>" + e(mText(x.method)) + "</td><td>" + e(x.n) + "</td><td>" + d(x.as_of) + "</td><td>" + chipT(x.s) + "</td></tr>"))
    + '<p class=e>Project-level rows describe the project as a whole and are never totalled per plot.</p>'
    + "<div class=ft>Prepared for Dr. Digital Abbot by Najma. Research use only: not a legal title, survey or valuation. Data snapshot " + d(p.as_of) + "; passport built " + d(meta && meta.built_at) + ". Sources: Dubai Land Department and Dubai Municipality open data.</div>"
    + "</body></html>";
}

// deps: { clientOk, clientResp, residentsKeyOf, najNav, NAJ_NAV_CSS, NAJ_FONTS }
export async function plotPassportRoutes(request, env, url, deps) {
  const p = url.pathname;
  if (p !== "/plot_passport" && p.indexOf("/plot_passport/") !== 0) return null;
  if (!deps.clientOk(env, url)) return new Response("unauthorized", { status: 401 });
  const key = url.searchParams.get("key") || "";
  if (p === "/plot_passport/districts") return json({ districts: (await readJson(env, "pp_dl")) || [] });
  if (p === "/plot_passport/d") {
    const slug = url.searchParams.get("slug") || "";
    if (!/^[a-z0-9_]{1,60}$/.test(slug)) return json({ ok: false, error: "That is not a district." }, 400);
    const d = await readJson(env, "pp_d_" + slug);
    return d ? json({ ok: true, district: d }) : json({ ok: false, error: "That district is not loaded yet." }, 404);
  }
  if (p === "/plot_passport/search") return json(await ppSearch(env, url.searchParams.get("q") || ""));
  if (p === "/plot_passport/p") {
    const id = url.searchParams.get("id") || "";
    if (!PP_ID.test(id)) return json({ ok: false, error: "That is not a Najma plot id." }, 400);
    const plot = await ppGet(env, id);
    return plot ? json({ ok: true, plot }) : json({ ok: false, error: "That plot is not in the passport data yet." }, 404);
  }
  const html = (body) => { const r = { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }; return deps.clientResp ? deps.clientResp(env, url, body, r) : new Response(body, r); };
  if (p === "/plot_passport/report") {
    const id = url.searchParams.get("id") || "";
    const plot = await ppGet(env, id);
    if (!plot) return new Response("That plot is not in the passport data.", { status: 404 });
    return html(plotReportHtml(plot, await readJson(env, "pp_meta")));
  }
  if (p === "/plot_passport") {
    const rk = deps.residentsKeyOf ? deps.residentsKeyOf(env, url) : "";
    return html(plotPassportHtml(key, rk, await readJson(env, "pp_meta"), deps));
  }
  return new Response("not found", { status: 404 });
}
