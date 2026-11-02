// v691 (Dr. Kendall Wilson, 2 Nov 2026) - two plot tools in Najma's MORE room. Research only, no deploy until he says.
//   /plot_radar  ACTIVITY RADAR: plots with something new on the record this week, strongest evidence first.
//   /plot_land   LAND SCANNER: plots in four plain-English groups, then a filtered list.
// Data: KV plot_radar / plot_land, written by naj-market-pulse/scripts/build_plot_intel.py from the MotherDuck views
// v_plot_activity_weekly, v_plot_land_status and lk_plot_changes (Trust workstream). Every row opens the Plot Passport.
// UX decisions: docs/ux/ACTIVITY_RADAR_UX.md, docs/ux/LAND_SCANNER_UX.md. Rules held here:
//   - a permit is never "construction started"; a project-level fact is never written as a plot fact
//   - availability for purchase is unknown and the page says so; the data date is on screen
//   - cards, never lists; inline SVG icons, never emoji; every abbreviation spelled out

// The Plot Passport lives at /plot_passport?id=<najma_plot_id> (merged 2 Nov).
export const PASSPORT_PATH = "/plot_passport";
export const MAP_PATH = "/developers_map";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// change types as the record states them, in words; never "started"
export const CHANGE = {
  permit: { label: "Building permit", icon: "doc" },
  building: { label: "Building recorded", icon: "bldg" },
  project: { label: "Project registered", icon: "flag" },
  register: { label: "Register change", icon: "edit" }
};
export const STRENGTH = {
  strong: { label: "Strong", say: "Two or more official records agree" },
  medium: { label: "Medium", say: "One official record" },
  weak: { label: "Weak", say: "One record, not yet confirmed by another" }
};
export const GROUPS = [
  { id: "none", icon: "leaf", t: "No development activity found", s: "No building, no permit and no active project on any record we hold." },
  { id: "registered", icon: "flag", t: "Registered project, no verified start", s: "A developer has registered a project here. No record shows work on site." },
  { id: "permits", icon: "doc", t: "Permits suggest upcoming work", s: "A building permit is on file. A permit is not proof that work has begun." },
  { id: "disagree", icon: "alert", t: "Looked empty, newer records disagree", s: "Our older list called it empty. A newer record says something is there. Check before use." }
];

const ICON = {
  doc: "M6 2h9l5 5v15H6z M14 2v6h6 M9 13h8 M9 17h8",
  bldg: "M4 22V6l8-4 8 4v16 M9 22v-5h6v5 M8 9h2 M14 9h2 M8 13h2 M14 13h2",
  flag: "M5 22V3 M5 4h12l-2 4 2 4H5",
  edit: "M4 20h4L20 8l-4-4L4 16z M14 6l4 4",
  leaf: "M4 20c0-9 6-15 16-16-1 10-7 16-16 16z M4 20l8-8",
  alert: "M12 3l10 18H2z M12 10v5 M12 18v.5",
  pin: "M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z M12 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6",
  radar: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0 M12 12l6-6",
  filter: "M3 5h18l-7 8v6l-4 2v-8z",
  clock: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 7v5l3 2",
  chev: "M9 6l6 6-6 6"
};
export function icon(n, cls) {
  return '<svg class="' + (cls || "ic") + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="' + (ICON[n] || ICON.chev) + '"/></svg>';
}

// "28 Oct" from 2026-10-28
export function shortDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return "";
  return Number(m[3]) + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m[2]) - 1];
}

// one plain-English line per change; the wording never claims work has started
export function oneLiner(r) {
  const d = shortDate(r.date);
  const on = d ? " on " + d : "";
  switch (r.type) {
    case "permit": return "New building permit filed" + on + (r.what ? " (" + r.what + ")" : "");
    case "building": return "Building now on the Dubai Municipality record" + on;
    case "project": return "Project registered with the Land Department" + on + (r.what ? ": " + r.what : "") + " (project-level record)";
    case "register": return "Land register entry changed" + on + (r.what ? ": " + r.what : "");
    default: return "Record changed" + on;
  }
}

const RANK = { strong: 0, medium: 1, weak: 2 };
export function rankRadar(rows) {
  return (rows || []).slice().sort((a, b) => (RANK[a.strength] ?? 3) - (RANK[b.strength] ?? 3) || String(b.date || "").localeCompare(String(a.date || "")));
}

const CSS = '*{box-sizing:border-box}:root{--bg:#0C1413;--card:#101D1B;--line:#24352F;--ink:#E8E4D8;--mute:#8FA39B;--gold:#C5A56A;--teal:#3E8A7E;--hi:#F0E4C8;--chip:#13231F;--warn:#E0B060}'
  + '@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#F6F3EA;--card:#FFFFFF;--line:#DCD5C2;--ink:#1D2A27;--mute:#566963;--gold:#8A6A2C;--teal:#0A4F4A;--hi:#0A4F4A;--chip:#EEE8D8;--warn:#8A5A00}}'
  + 'body{background:var(--bg);color:var(--ink);font-family:"IBM Plex Sans",system-ui,sans-serif;margin:0;padding:16px 16px 104px;max-width:640px;margin-inline:auto;-webkit-text-size-adjust:100%}'
  + '.h{font-family:Fraunces,Georgia,serif;font-size:1.6rem;font-weight:600;margin:.2rem 0 .2rem;line-height:1.15}.h em{font-style:normal;color:var(--gold)}'
  + '.s{color:var(--mute);font-size:.84rem;line-height:1.5;margin:0 0 12px}'
  + '.fresh{display:flex;gap:8px;align-items:flex-start;background:var(--chip);border:1px solid var(--line);border-radius:10px;padding:9px 11px;font-size:.76rem;line-height:1.45;color:var(--mute);margin:0 0 14px}.fresh b{color:var(--ink)}'
  + '.ic{width:18px;height:18px;flex:none}.fresh .ic{color:var(--gold);margin-top:1px}'
  + '.chips{display:flex;gap:6px;overflow-x:auto;padding:2px 0 8px;margin:0 0 4px;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}'
  + '.chip{flex:none;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:8px 12px;font:inherit;font-size:.78rem;min-height:36px;cursor:pointer}'
  + '.chip[aria-pressed="true"]{background:var(--teal);border-color:var(--teal);color:#fff}'
  + '.fl{font-family:"IBM Plex Mono",monospace;font-size:.6rem;letter-spacing:.11em;color:var(--mute);margin:6px 0 4px}'
  + 'select{font:inherit;font-size:.82rem;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:8px 10px;min-height:40px;width:100%}'
  + '.row2{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 10px}@media (max-width:420px){.row2{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.row2 select:first-child{grid-column:1/-1}}select{min-width:0;text-overflow:ellipsis}'
  + '.card{display:flex;gap:11px;align-items:flex-start;text-decoration:none;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 13px;margin:0 0 10px}'
  + '.card .ic{color:var(--gold);margin-top:2px}.card .b{flex:1;min-width:0}.card .l{font-size:.92rem;line-height:1.35;color:var(--hi)}'
  + '.card .m{font-size:.74rem;color:var(--mute);margin-top:4px;line-height:1.4}.card .go{color:var(--mute);align-self:center}'
  + '.st{display:inline-block;font-family:"IBM Plex Mono",monospace;font-size:.58rem;letter-spacing:.08em;border-radius:6px;padding:2px 6px;margin-right:6px;border:1px solid var(--line)}'
  + '.st.strong{background:var(--teal);color:#fff;border-color:var(--teal)}.st.medium{color:var(--teal);border-color:var(--teal)}.st.weak{color:var(--mute)}'
  + '.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 14px}'
  + '.grp{display:flex;flex-direction:column;gap:6px;text-align:left;font:inherit;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:13px 12px;min-height:150px;cursor:pointer}'
  + '.grp .ic{width:22px;height:22px;color:var(--gold)}.grp .n{font-family:Fraunces,Georgia,serif;font-size:1.6rem;color:var(--hi);line-height:1}'
  + '.grp .t{font-size:.84rem;font-weight:600;line-height:1.3}.grp .d{font-size:.7rem;color:var(--mute);line-height:1.4}'
  + '.grp[aria-pressed="true"]{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold) inset}'
  + '.btn{display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;font-size:.84rem;color:var(--ink);background:var(--chip);border:1px solid var(--line);border-radius:10px;padding:10px;min-height:44px;margin:0 0 12px;cursor:pointer;font-family:inherit;width:100%}'
  + '.btn .ic{color:var(--gold)}.cnt{font-size:.78rem;color:var(--mute);margin:4px 0 10px}'
  + '.empty{border:1px dashed var(--line);border-radius:12px;padding:16px;color:var(--mute);font-size:.84rem;line-height:1.5;text-align:center}'
  + '.nt{color:var(--mute);font-size:.72rem;line-height:1.45;border:1px dashed var(--line);border-radius:9px;padding:9px 11px;margin-top:14px}'
  + '[hidden]{display:none!important}';

function page(title, body, script, deps, key, rk, navKey) {
  const nav = deps && deps.najNav ? deps.najNav(key, navKey || "more", rk) : "";
  return '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<title>' + esc(title) + ' — Najma</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">' + ((deps && deps.NAJ_FONTS) || "")
    + '<style>' + CSS + ((deps && deps.NAJ_NAV_CSS) || "") + '</style></head><body>' + body + '<script>' + script + '</script>' + nav + '</body></html>';
}

function freshness(d, extra) {
  const asOf = d && d.as_of ? shortDate(d.as_of) + " " + String(d.as_of).slice(0, 4) : "not yet built";
  return '<div class=fresh>' + icon("clock") + '<div>Records checked up to <b>' + esc(asOf) + '</b>. ' + extra + '</div></div>';
}

// a JSON blob that is safe inside a <script> element
const blob = (o) => JSON.stringify(o).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16));

// ----------------------------------------------------------------------- ACTIVITY RADAR
export function radarHtml(data, key, rk, deps) {
  const rows = rankRadar((data && data.rows) || []).map((r) => ({ id: r.id, no: r.no || "", d: r.district || "", type: r.type, st: r.strength, line: oneLiner(r), src: r.source || "" }));
  const chips = (name, list) => '<div class=chips role=group aria-label="' + name + '">' + list.map((c, i) => '<button class=chip type=button data-f="' + name + '" data-v="' + esc(c[0]) + '" aria-pressed="' + (i === 0) + '">' + esc(c[1]) + '</button>').join("") + '</div>';
  const districts = [...new Set(rows.map((r) => r.d).filter(Boolean))].sort();
  const body = '<div class=h>Activity <em>radar</em></div>'
    + '<div class=s>Plots where something new appeared on the official record this week. Strongest evidence first. Tap a plot to open its passport.</div>'
    + freshness(data, 'A permit or a registration is paperwork, not proof that work has started on site.')
    + '<div class=fl>WHAT CHANGED</div>' + chips("type", [["", "All"]].concat(Object.keys(CHANGE).map((k) => [k, CHANGE[k].label])))
    + '<div class=fl>EVIDENCE</div>' + chips("st", [["", "All"]].concat(Object.keys(STRENGTH).map((k) => [k, STRENGTH[k].label])))
    + '<div class=fl>DISTRICT</div><select id=fd aria-label="District"><option value="">All districts</option>' + districts.map((d) => '<option>' + esc(d) + '</option>').join("") + '</select>'
    + '<div class=cnt id=cnt></div><div id=list></div><button class=btn id=more type=button hidden>Show more</button>'
    + '<div class=nt><b>Evidence strength.</b> Strong: two or more official records agree. Medium: one official record. Weak: one record not yet confirmed by another. '
    + 'Sources: Dubai Municipality building permits and buildings, Dubai Land Department project register and land register. Research only; availability for purchase is not known.</div>';
  const script = 'var R=' + blob(rows) + ',K=' + blob({ key: key || "", rk: rk || "", pp: PASSPORT_PATH }) + ',IC=' + blob({ permit: icon(CHANGE.permit.icon), building: icon(CHANGE.building.icon), project: icon(CHANGE.project.icon), register: icon(CHANGE.register.icon), chev: icon("chev", "ic go") }) + ',SL=' + blob({ strong: "STRONG", medium: "MEDIUM", weak: "WEAK" }) + ';'
    + PAGE_COMMON
    + 'var F={type:"",st:"",d:""},N=40;'
    + 'function draw(){var s=R.filter(function(r){return(!F.type||r.type===F.type)&&(!F.st||r.st===F.st)&&(!F.d||r.d===F.d)});'
    + '$("cnt").textContent=s.length+(s.length===1?" plot":" plots")+(F.type||F.st||F.d?" match":" this week");'
    + 'var L=$("list");L.innerHTML=s.length?s.slice(0,N).map(function(r){return \'<a class=card href="\'+pass(r.id)+\'">\'+(IC[r.type]||"")+\'<div class=b><div class=l>\'+X(r.line)+\'</div><div class=m><span class="st \'+X(r.st)+\'">\'+(SL[r.st]||"")+\'</span>Plot \'+X(r.no||r.id)+(r.d?" \\u00b7 "+X(r.d):"")+\'</div></div>\'+IC.chev+\'</a>\'}).join(""):\'<div class=empty>\'+(R.length?"Nothing matches these filters. Tap All to widen.":"No new activity on file this week.")+\'</div>\';'
    + '$("more").hidden=s.length<=N}'
    + 'chips(F,function(){N=40;draw()});$("fd").onchange=function(){F.d=this.value;N=40;draw()};$("more").onclick=function(){N+=40;draw()};draw();';
  return page("Activity radar", body, script, deps, key, rk);
}

// shared client helpers (one copy, both pages)
const PAGE_COMMON = 'function $(i){return document.getElementById(i)}'
  + 'function X(s){return String(s==null?"":s).replace(/[&<>"\']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",\'"\':"&quot;","\'":"&#39;"}[c]})}'
  + 'function q(){return "&key="+encodeURIComponent(K.key)+(K.rk?"&rk="+encodeURIComponent(K.rk):"")}'
  + 'function pass(id){return K.pp+"?id="+encodeURIComponent(id)+q()}'
  + 'function chips(F,cb){Array.prototype.forEach.call(document.querySelectorAll(".chip"),function(b){b.onclick=function(){var f=b.getAttribute("data-f");F[f]=b.getAttribute("data-v");'
  + 'Array.prototype.forEach.call(document.querySelectorAll(\'.chip[data-f="\'+f+\'"]\'),function(o){o.setAttribute("aria-pressed",String(o===b))});cb()}})}';

// ----------------------------------------------------------------------- LAND SCANNER
const SIZES = [["", "Any size"], ["s", "Under 1,000 sq m"], ["m", "1,000 to 5,000 sq m"], ["l", "Over 5,000 sq m"]];
export function sizeBand(a) { a = Number(a) || 0; return !a ? "" : a < 1000 ? "s" : a <= 5000 ? "m" : "l"; }

export function landHtml(data, key, rk, deps) {
  const rows = ((data && data.rows) || []).map((r) => ({ id: r.id, no: r.no || "", d: r.district || "", g: r.group, lt: r.land_type || "", a: Number(r.area_sqm) || 0, why: r.why || "" }));
  const counts = {}; GROUPS.forEach((g) => { counts[g.id] = 0; }); rows.forEach((r) => { if (counts[r.g] != null) counts[r.g]++; });
  const districts = [...new Set(rows.map((r) => r.d).filter(Boolean))].sort();
  const types = [...new Set(rows.map((r) => r.lt).filter(Boolean))].sort();
  const mapHref = MAP_PATH + "?empty=all&key=" + encodeURIComponent(key || "") + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  const body = '<div class=h>Land <em>scanner</em></div>'
    + '<div class=s>Every plot we hold, sorted by what the records say is happening on it. Pick a group, narrow it down, tap a plot.</div>'
    + freshness(data, '<b>Whether a plot is for sale is not known.</b> Most land in these groups is held by a developer.')
    + '<div class=grid role=group aria-label="Groups">' + GROUPS.map((g) => '<button class=grp type=button data-g="' + g.id + '" aria-pressed=false>' + icon(g.icon) + '<span class=n>' + counts[g.id].toLocaleString("en-US") + '</span><span class=t>' + esc(g.t) + '</span><span class=d>' + esc(g.s) + '</span></button>').join("") + '</div>'
    + '<a class=btn href="' + esc(mapHref) + '">' + icon("pin") + 'See the empty plots on the map</a>'
    + '<div id=pick class=empty>Pick a group above to see its plots.</div>'
    + '<div id=lst hidden><div class=row2>'
    + '<select id=fd aria-label="District"><option value="">All districts</option>' + districts.map((d) => '<option>' + esc(d) + '</option>').join("") + '</select>'
    + '<select id=fs aria-label="Plot size">' + SIZES.map((s) => '<option value="' + s[0] + '">' + esc(s[1]) + '</option>').join("") + '</select>'
    + '<select id=ft aria-label="Land type"><option value="">Any land type</option>' + types.map((t) => '<option>' + esc(t) + '</option>').join("") + '</select>'
    + '</div><div class=cnt id=cnt></div><div id=list></div><button class=btn id=more type=button hidden>Show more</button></div>'
    + '<div class=nt>Sources: Dubai Municipality plot outlines and buildings, Makani (the Dubai address grid), Dubai Land Department project and land registers. '
    + 'A registered project is a project-level record: it does not tell you what is built on this plot. Research only.</div>';
  const script = 'var R=' + blob(rows) + ',K=' + blob({ key: key || "", rk: rk || "", pp: PASSPORT_PATH }) + ',G=' + blob(Object.fromEntries(GROUPS.map((g) => [g.id, { t: g.t, i: icon(g.icon) }]))) + ',CH=' + blob(icon("chev", "ic go")) + ';'
    + PAGE_COMMON
    + 'var F={g:"",d:"",s:"",t:""},N=40;'
    + 'function band(a){return !a?"":a<1000?"s":a<=5000?"m":"l"}function fm(n){return Math.round(n).toLocaleString("en-US")}'
    + 'function draw(){$("pick").hidden=!!F.g;$("lst").hidden=!F.g;if(!F.g)return;'
    + 'var s=R.filter(function(r){return r.g===F.g&&(!F.d||r.d===F.d)&&(!F.s||band(r.a)===F.s)&&(!F.t||r.lt===F.t)}).sort(function(a,b){return b.a-a.a});'
    + '$("cnt").textContent=s.length+(s.length===1?" plot":" plots")+" \\u00b7 "+G[F.g].t+" \\u00b7 largest first";'
    + '$("list").innerHTML=s.length?s.slice(0,N).map(function(r){return \'<a class=card href="\'+pass(r.id)+\'">\'+G[r.g].i+\'<div class=b><div class=l>Plot \'+X(r.no||r.id)+(r.d?" \\u00b7 "+X(r.d):"")+\'</div><div class=m>\'+(r.a?fm(r.a)+" sq m ("+fm(r.a*10.7639)+" sq ft)":"Size not on record")+(r.lt?" \\u00b7 "+X(r.lt):"")+(r.why?"<br>"+X(r.why):"")+\'</div></div>\'+CH+\'</a>\'}).join(""):\'<div class=empty>No plots in this group match. Widen a filter.</div>\';'
    + '$("more").hidden=s.length<=N}'
    + 'Array.prototype.forEach.call(document.querySelectorAll(".grp"),function(b){b.onclick=function(){F.g=b.getAttribute("data-g");N=40;'
    + 'Array.prototype.forEach.call(document.querySelectorAll(".grp"),function(o){o.setAttribute("aria-pressed",String(o===b))});draw();$("lst").scrollIntoView({behavior:"smooth",block:"start"})}});'
    + '["fd","fs","ft"].forEach(function(i){$(i).onchange=function(){F[{fd:"d",fs:"s",ft:"t"}[i]]=this.value;N=40;draw()}});$("more").onclick=function(){N+=40;draw()};'
    + 'try{var g0=new URLSearchParams(location.search).get("g");if(g0&&G[g0]){var b0=document.querySelector(\'.grp[data-g="\'+g0+\'"]\');if(b0)b0.click()}}catch(e){}draw();';
  return page("Land scanner", body, script, deps, key, rk);
}

// ----------------------------------------------------------------------- routes
async function kvJson(env, k) { try { const t = await env.MEETINGS.get(k); return t ? JSON.parse(t) : null; } catch (e) { return null; } }

export async function plotIntelRoutes(request, env, url, deps) {
  const p = url.pathname;
  if (p !== "/plot_radar" && p !== "/plot_land") return null;
  if (request.method !== "GET") return new Response("method", { status: 405 });
  if (!deps.clientOk(env, url)) return new Response("unauthorized", { status: 401 });
  const key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const h = { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" } };
  if (p === "/plot_radar") return new Response(radarHtml(await kvJson(env, "plot_radar"), key, rk, deps), h);
  return new Response(landHtml(await kvJson(env, "plot_land"), key, rk, deps), h);
}

// MORE room entries (index.js draws them with its own room markup)
export const PLOT_ROOMS = [
  ["ACTIVITY RADAR", "/plot_radar", "trend", "Plots with something new on the record this week — permits, buildings, projects — strongest evidence first."],
  ["LAND SCANNER", "/plot_land", "pin", "Plots with no building yet, in four plain groups. Counts first, then the list, then the plot."]
];
