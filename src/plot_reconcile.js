// DATA CHECKS - the data discrepancy report (Najma, More -> DATA CHECKS), 2 Nov 2026. Approved to build by Dr. Kendall Wilson; not deployed.
// "Where the Land Department and the Municipality records for a plot do not agree." Research flags, never findings.
// Click 1: summary - one card per kind of disagreement (plain English, count, one line), a district filter, the date of each source.
// Click 2: the plots of one kind - each card says what the Land Department holds and what the Municipality holds, side by side,
//          with the usual reasons the two can differ (timing, renaming, merged or split plots). Search inside the list.
// Click 3: open the plot in PLOT PASSPORT (/plot_passport?id=<najma_plot_id>), or export the list: CSV or print / save as PDF
//          (both carry the sources and their dates).
// DATA: KV keys pushed by naj-market-pulse/scripts/build_plot_reconcile.py (reads MotherDuck v_plot_exceptions when published,
//       else the same four kinds derived from lk_plot_master + DLD buildings + DM permits + DM building summary, parcel-id keys only):
//       pr_sum, pr_l_<kind>_<district | all>.
// RULES: neutral words only (research flag; never violation, illegal, breach, offence); project-level links never used as a plot fact;
//        no DEWA data, no Google content; research use only, so the route is owner-key only (404 to anyone else).
// Page script is String.raw with no substitutions and no backticks.

import { labelledName } from "./community_labels.js";

export const PR_KINDS = {
  bld_no_permit: {
    title: "Building registered, no permit found",
    line: "The Land Department lists a building on the plot. We found no Municipality building permit for the same plot number.",
    icon: "bld",
  },
  permit_no_bld: {
    title: "Permit found, no building registered",
    line: "The Municipality issued a permit for the plot. The Land Department buildings register shows no building on it yet.",
    icon: "doc",
  },
  permit_no_plot: {
    title: "Permit for a plot not on today’s register",
    line: "A Municipality permit names a plot number that is not in today’s Land Department land register.",
    icon: "map",
  },
  floors_differ: {
    title: "Floor counts differ",
    line: "The two registers give floor counts at least three apart for the building on the plot.",
    icon: "layers",
  },
  // from v_plot_exceptions (Trust workstream): how well the records are tied to the plot
  building_project_differs_from_register: {
    title: "Building and land records name different projects",
    line: "The buildings on the plot carry a project name that the land register does not give for the plot.",
    icon: "bld", g: 2, la: "LAND REGISTER", lb: "OTHER RECORD",
  },
  empty_list_vs_building_evidence: {
    title: "On our empty-plot list, but building records reach it",
    line: "We list the plot as empty land, yet a building or occupancy record is tied to the plot itself.",
    icon: "map", g: 2, la: "LAND REGISTER", lb: "OTHER RECORD",
  },
  no_link_beyond_register: {
    title: "Only the land register knows this plot",
    line: "No building, permit, address or other record is tied to the plot; only its land register entry.",
    icon: "flag", g: 2, la: "LAND REGISTER", lb: "OTHER RECORD",
  },
  project_level_only: {
    title: "Linked by project only, not by plot",
    line: "Records reach the plot only through its project. A project can cover many plots, so none of them is a fact about this one.",
    icon: "layers", g: 2, la: "LAND REGISTER", lb: "OTHER RECORD",
  },
};
export const PR_GROUPS = { 1: "LAND DEPARTMENT AND MUNICIPALITY", 2: "HOW WELL THE RECORDS ARE TIED TO THE PLOT" };
export const PR_REASONS = {
  older: "Older buildings were often permitted before the Municipality’s online records began, so the permit may exist only on paper.",
  key: "A record may be filed under a different plot number, for example the number from before a re-survey.",
  renamed: "Plots and projects get renamed; the two offices may hold the same ground under different names.",
  villa: "Villas and private houses are usually registered as land or units, not on the buildings register.",
  building: "The building may still be under construction; the Land Department registers it near completion.",
  timing: "The two registers are updated on different days, so one can be weeks or months ahead of the other.",
  merged: "The plot may have been merged with a neighbour or split since the permit, so its old number is no longer used.",
  count: "The Municipality counts typical floors only; the Land Department count usually includes ground, podium and roof levels.",
  several: "Where a plot holds several buildings, each register may describe a different one.",
  builtsince: "The plot may have been built on since our empty-plot list was drawn up.",
  nolink: "Many plots are empty land, roads, utilities or open space, where no building or permit record is expected.",
  projonly: "The records name the project, not the plot. That is common for large master-planned communities.",
};
const BAD_WORDS = /violation|illegal|breach|offen[cs]e|unlawful|fraud/i;
export const prNeutral = (s) => !BAD_WORDS.test(String(s || ""));

const KINDS = Object.keys(PR_KINDS);
const SLUG = /^[a-z0-9_]{1,60}$/;
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
async function readJson(env, k) { try { return JSON.parse((await env.MEETINGS.get(k)) || "null"); } catch (e) { return null; } }
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const SRC = {
  register: "Land register (Dubai Land Department)",
  dld: "Buildings register (Dubai Land Department)",
  dm_permits: "Building permits (Dubai Municipality)",
  dm_summary: "Building summary (Dubai Municipality)",
};
// what each side of a card shows, in order: [field, label]
const SIDE_A = [["register_project", "Project on the land register"], ["sub_type", "Use"], ["area_sqm", "Plot area, square metres"], ["buildings", "Buildings"], ["floors", "Floors"], ["type", "Type"], ["project", "Project"], ["registered", "Registered"], ["land_type", "Land type"], ["on_register", "On the land register"]];
const SIDE_B = [["permits", "Permits found"], ["typical_floors", "Typical floors"], ["latest_permit", "Latest permit"], ["permit_date", "Permit date"], ["permit_type", "Permit type"], ["building_type", "Building type"], ["status", "Status"], ["completed", "Completed"], ["detail", "What it says"], ["source", "Record"], ["source_key", "Record key"]];

function fmtVal(k, v) {
  if (v === false) return "No";
  if (v === true) return "Yes";
  return String(v);
}

export function prCsv(items, kind, district, sum) {
  const q = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const asof = (sum && sum.as_of) || {};
  const pre = (x, d) => String(x || d).toLowerCase().replace(/ /g, "_") + "_";
  const la = pre(PR_KINDS[kind].la, "land department"), lb = pre(PR_KINDS[kind].lb, "municipality");
  const head = ["research_flag", "najma_plot_id", "parcel_id", "district", "plot_name"]
    .concat(SIDE_A.map((f) => la + f[0]), SIDE_B.map((f) => lb + f[0]), ["possible_reasons", "sources_and_dates"]);
  const srcLine = Object.keys(SRC).map((k) => SRC[k] + " " + (asof[k] || "date unknown")).join("; ");
  const lines = [head.join(",")];
  for (const it of items) {
    lines.push([PR_KINDS[kind].title, it.id || "", it.pk || "", (sum && sum.names && sum.names[it.d]) || it.d || "", it.n || ""]
      .concat(SIDE_A.map((f) => (it.a || {})[f[0]]), SIDE_B.map((f) => (it.b || {})[f[0]]), [(it.w || []).map((w) => PR_REASONS[w] || w).join(" | "), srcLine])
      .map(q).join(","));
  }
  return "﻿" + "# Research flags, not findings: two registers kept by two offices for different purposes. District: " + (district || "all") + "\n" + lines.join("\n") + "\n";
}

// deps: { clientOk, isOwner, clientResp, residentsKeyOf, najNav, NAJ_NAV_CSS, NAJ_FONTS }
export async function plotReconcileRoutes(request, env, url, deps) {
  const p = url.pathname;
  if (p !== "/data_checks" && p.indexOf("/data_checks/") !== 0) return null;
  if (!deps.clientOk(env, url) || !deps.isOwner(env, url)) return new Response("not found", { status: 404 });
  const kind = url.searchParams.get("t") || "";
  const dist = url.searchParams.get("d") || "all";
  if (p === "/data_checks/list" || p === "/data_checks/csv") {
    if (!PR_KINDS[kind] || !SLUG.test(dist)) return json({ ok: false, error: "Unknown check or district." }, 400);
    const sum = await readJson(env, "pr_sum");
    const items = (await readJson(env, "pr_l_" + kind + "_" + dist)) || [];
    const n = sum && sum.types && sum.types[kind] ? (dist === "all" ? sum.types[kind].n : (sum.types[kind].d || {})[dist] || 0) : items.length;
    if (p === "/data_checks/csv") {
      return new Response(prCsv(items, kind, dist, sum), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="najma_data_checks_' + kind + "_" + dist + '.csv"', "Cache-Control": "no-store" } });
    }
    return json({ ok: true, kind, district: dist, total: n, items });
  }
  if (p === "/data_checks") {
    const sum = await readJson(env, "pr_sum");
    const key = url.searchParams.get("key") || "";
    const rk = deps.residentsKeyOf ? deps.residentsKeyOf(env, url) : "";
    const body = prPageHtml(key, rk, sum, deps);
    const r = { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } };
    return deps.clientResp ? deps.clientResp(env, url, body, r) : new Response(body, r);
  }
  return new Response("not found", { status: 404 });
}

// 24-unit line icons (one per heading, never emoji)
const IC = {
  bld: '<path d="M4 21V5l8-3v19M12 8l8 3v10M2 21h20M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2"/>',
  doc: '<path d="M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h6"/>',
  map: '<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3zM9 3v15M15 6v15"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  dl: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  print: '<path d="M6 9V3h12v6M6 17H4v-7h16v7h-2M7 14h10v7H7z"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
};
const ic = (n) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || "") + "</svg>";

const PR_CSS = ':root{--ink:#0C1413;--card:#101D1B;--card2:#16262300;--line:#24352F;--text:#E8E4D8;--mut:#8FA39B;--soft:#C8D3CE;--gold:#C5A56A;--teal:#3E8A7E;--head:#F0E4C8;--chip:#1B2E2A}'
  + 'html[data-theme=light]{--ink:#F2EEE3;--card:#FBF8F0;--line:#DCD5C2;--text:#1A2422;--mut:#6E7B74;--soft:#33433F;--gold:#A88544;--teal:#2F6E64;--head:#1A2422;--chip:#EDE7D7}'
  + 'body{background:var(--ink);color:var(--text);font-family:"IBM Plex Sans",system-ui,sans-serif;margin:0;padding:16px 16px 100px;max-width:760px;margin-inline:auto;-webkit-text-size-adjust:100%}'
  + 'svg{width:18px;height:18px;flex:none}'
  + '.top{display:flex;justify-content:space-between;align-items:center;gap:8px}'
  + '.h{font-family:Fraunces,Georgia,serif;font-size:1.6rem;font-weight:600;margin:.2rem 0 .2rem;line-height:1.15}.h em{font-style:normal;color:var(--gold)}'
  + '.s{color:var(--mut);font-size:.84rem;line-height:1.5;margin:0 0 14px}'
  + '.thm{background:none;border:1px solid var(--line);color:var(--mut);border-radius:8px;padding:5px 9px;font:500 .62rem "IBM Plex Mono",monospace;letter-spacing:.06em}'
  + '.flagnote{display:flex;gap:9px;align-items:flex-start;border:1px solid var(--line);border-left:3px solid var(--teal);border-radius:10px;padding:10px 12px;font-size:.78rem;line-height:1.45;color:var(--soft);margin:0 0 14px}.flagnote svg{color:var(--teal);margin-top:1px}'
  + '.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 14px}'
  + 'label.lb{font:500 .6rem "IBM Plex Mono",monospace;letter-spacing:.1em;color:var(--mut)}'
  + 'select,input[type=search]{background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:9px;padding:9px 10px;font:inherit;font-size:.86rem;min-height:40px;box-sizing:border-box}'
  + 'select{flex:1;min-width:0}input[type=search]{width:100%}'
  + '.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
  + '.kc{display:flex;flex-direction:column;text-align:left;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;color:inherit;font:inherit;cursor:pointer;min-height:150px}'
  + '.kc .ki{color:var(--gold)}.kc .kn{font:600 1.5rem "IBM Plex Mono",monospace;color:var(--head);margin:8px 0 2px}'
  + '.kc .kt{font-family:Fraunces,Georgia,serif;font-size:.98rem;line-height:1.25;color:var(--head)}.kc .kl{font-size:.72rem;line-height:1.4;color:var(--mut);margin-top:6px}'
  + '.kc .kg{margin-top:auto;padding-top:8px;color:var(--gold);font:500 .62rem "IBM Plex Mono",monospace;letter-spacing:.06em;display:flex;align-items:center;gap:4px}.kc .kg svg{width:13px;height:13px}'
  + '.kc[disabled]{opacity:.55;cursor:default}'
  + '.hd{display:flex;align-items:center;gap:7px;font:500 .62rem "IBM Plex Mono",monospace;letter-spacing:.12em;color:var(--mut);margin:22px 0 10px;padding-top:14px;border-top:1px solid var(--line)}.hd svg{width:14px;height:14px;color:var(--gold)}'
  + '.src{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sc{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:9px 10px;font-size:.72rem;line-height:1.35;color:var(--soft)}.sc b{display:block;font:500 .7rem "IBM Plex Mono",monospace;color:var(--gold);margin-top:3px}'
  + '.back{display:inline-flex;align-items:center;gap:4px;background:none;border:0;color:var(--gold);font:500 .7rem "IBM Plex Mono",monospace;letter-spacing:.06em;padding:4px 0;cursor:pointer}'
  + '.why{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:11px 12px;margin:0 0 12px}.why .wt{display:flex;align-items:center;gap:7px;font:500 .62rem "IBM Plex Mono",monospace;letter-spacing:.1em;color:var(--mut);margin-bottom:6px}.why .wt svg{width:14px;height:14px;color:var(--teal)}'
  + '.why p{margin:4px 0;font-size:.78rem;line-height:1.45;color:var(--soft)}'
  + '.acts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 12px}'
  + '.btn{display:flex;align-items:center;justify-content:center;gap:6px;min-height:42px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--text);font:500 .72rem "IBM Plex Mono",monospace;letter-spacing:.05em;text-decoration:none;cursor:pointer}.btn svg{width:15px;height:15px;color:var(--gold)}'
  + '.btn.pri{background:var(--gold);border-color:var(--gold);color:#0C1413}.btn.pri svg{color:#0C1413}'
  + '.cnt{font-size:.74rem;color:var(--mut);margin:0 0 10px}'
  + '.pc{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin:0 0 10px;break-inside:avoid}'
  + '.pc .pn{font-family:Fraunces,Georgia,serif;font-size:1.02rem;color:var(--head);line-height:1.25}.pc .pm{font:400 .64rem "IBM Plex Mono",monospace;color:var(--mut);margin:3px 0 10px;letter-spacing:.03em}'
  + '.sides{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sd{border:1px solid var(--line);border-radius:9px;padding:8px 9px;min-width:0}.sd .st{font:500 .58rem "IBM Plex Mono",monospace;letter-spacing:.09em;color:var(--gold);margin-bottom:5px}'
  + '.sd .fv{font-size:.74rem;line-height:1.35;color:var(--soft);margin:0 0 4px;overflow-wrap:anywhere}.sd .fv i{display:block;font-style:normal;font-size:.6rem;color:var(--mut)}.sd .none{font-size:.74rem;color:var(--mut)}'
  + '.chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0}.chip{background:var(--chip);color:var(--soft);border-radius:20px;padding:4px 9px;font-size:.66rem;border:0;font-family:inherit;cursor:pointer}'
  + '.cx{font-size:.72rem;line-height:1.4;color:var(--soft);margin:6px 0 0;display:none}.cx.on{display:block}'
  + '.open{display:flex;align-items:center;gap:5px;margin-top:10px;color:var(--gold);font:500 .66rem "IBM Plex Mono",monospace;letter-spacing:.05em;text-decoration:none}.open svg{width:14px;height:14px}.noid{margin-top:10px;font-size:.68rem;color:var(--mut)}'
  + '.more{width:100%}.empty{border:1px dashed var(--line);border-radius:10px;padding:14px;color:var(--mut);font-size:.8rem;line-height:1.5}'
  + '.prt{display:none}'
  + '@media (min-width:700px){.grid{grid-template-columns:repeat(4,1fr)}.src{grid-template-columns:repeat(4,1fr)}#plist{display:grid;grid-template-columns:1fr 1fr;gap:10px}#plist .pc{margin:0}}'
  + '@media print{:root{--ink:#fff;--card:#fff;--line:#bbb;--text:#111;--mut:#555;--soft:#222;--gold:#7a5f2c;--head:#111;--chip:#eee}body{padding:0;max-width:none}.nnav,.thm,.acts,.back,#more,#q,.row,.kc .kg,.open svg{display:none!important}.prt{display:block;font-size:.72rem;color:#333;margin:0 0 10px}#plist{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cx{display:block}}';

export function prPageHtml(key, rk, sum, deps) {
  const boot = { groups: PR_GROUPS, kinds: PR_KINDS, reasons: PR_REASONS, src: SRC, sa: SIDE_A, sb: SIDE_B, sum: sum || null, key: key || "", rk: rk || "", labels: {} };
  if (sum && sum.names) for (const d of Object.keys(sum.names)) boot.labels[d] = labelledName(d, sum.names[d] || d);
  return '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<title>Data checks — Najma</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">' + (deps.NAJ_FONTS || "")
    + '<script>try{var t=localStorage.getItem("naj_thm")||((window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark");document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>'
    + '<style>' + PR_CSS + (deps.NAJ_NAV_CSS || "") + '</style></head><body>'
    + '<div class=top><div class=h>Data <em>checks</em></div><button class=thm id=thm type=button>LIGHT / DARK</button></div>'
    + '<div class=s id=sub>Plots where the Land Department and Municipality records do not agree, or where one holds a record the other does not.</div>'
    + '<div class=flagnote>' + ic("info") + '<div>Each item is a <b>research flag</b>: a reason to look closer, not a finding. The two offices keep their registers for different purposes and update them on different days.</div></div>'
    + '<div id=app></div>'
    + '<script>window.__PR=' + JSON.stringify(boot).replace(/</g, "\\u003c") + ';window.__IC=' + JSON.stringify(IC) + ';</script>'
    + '<script>' + PR_JS + '</script>'
    + (deps.najNav ? deps.najNav(key, "more", rk) : "") + '</body></html>';
}

const PR_JS = String.raw`(function(){
var B=window.__PR,G=B.groups,IC=window.__IC,S=B.sum,app=document.getElementById("app"),SHOW=30,CUR=null;
function ic(n){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(IC[n]||"")+'</svg>'}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function fmt(n){return Number(n||0).toLocaleString("en-GB")}
function kq(){return "key="+encodeURIComponent(B.key)+(B.rk?"&rk="+encodeURIComponent(B.rk):"")}
function dn(d){if(!d||d==="unknown")return "District not known";return B.labels[d]||(S&&S.names&&S.names[d])||d}
function fdate(s){if(!s)return "date not known";var p=String(s).split("-");var m=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];return p.length===3?(+p[2])+" "+m[+p[1]-1]+" "+p[0]:s}
function st(){var h=new URLSearchParams(location.hash.slice(1));return {t:h.get("t")||"",d:h.get("d")||"all"}}
function go(t,d,push){var h="#"+(t?"t="+encodeURIComponent(t)+"&":"")+"d="+encodeURIComponent(d||"all");if(push)location.hash=h;else history.replaceState(null,"",h);render()}
var thm=document.getElementById("thm");thm.onclick=function(){var t=document.documentElement.getAttribute("data-theme")==="light"?"dark":"light";document.documentElement.setAttribute("data-theme",t);try{localStorage.setItem("naj_thm",t)}catch(e){}};
window.addEventListener("hashchange",render);
function srcCards(){var a=(S&&S.as_of)||{};return '<div class=hd>'+ic("cal")+'SOURCES AND DATES</div><div class=src>'+Object.keys(B.src).map(function(k){return '<div class=sc>'+esc(B.src[k])+'<b>'+esc(fdate(a[k]))+'</b></div>'}).join("")+'</div>'}
function districtSel(cur,t){var ds={};Object.keys(S.types).forEach(function(k){if(t&&k!==t)return;var d=S.types[k].d||{};Object.keys(d).forEach(function(x){ds[x]=(ds[x]||0)+d[x]})});
 var ks=Object.keys(ds).sort(function(a,b){return dn(a).localeCompare(dn(b))});
 return '<div class=row><label class=lb for=dsel>DISTRICT</label><select id=dsel><option value=all>All districts</option>'+ks.map(function(k){return '<option value="'+esc(k)+'"'+(k===cur?" selected":"")+'>'+esc(dn(k))+' ('+fmt(ds[k])+')</option>'}).join("")+'</select></div>'}
function count(t,d){var x=S.types[t];if(!x)return 0;return d==="all"?x.n:((x.d||{})[d]||0)}
function summary(s){
 if(!S||!S.types){app.innerHTML='<div class=empty>The discrepancy data has not been loaded yet. It is built by the data team from the Land Department and Municipality registers; once it is pushed, this page fills in by itself.</div>';return}
 var h=districtSel(s.d,"");
 Object.keys(G).forEach(function(g){var ts=Object.keys(B.kinds).filter(function(t){return String(B.kinds[t].g||1)===g&&S.types[t]});if(!ts.length)return;
 h+='<div class=hd>'+ic(g==="1"?"doc":"layers")+esc(G[g])+'</div><div class=grid>';
 ts.forEach(function(t){var k=B.kinds[t],n=count(t,s.d);
  h+='<button class=kc type=button data-t="'+t+'"'+(n?"":" disabled")+'><span class=ki>'+ic(k.icon)+'</span><span class=kn>'+fmt(n)+'</span><span class=kt>'+esc(k.title)+'</span><span class=kl>'+esc(k.line)+'</span>'+(n?'<span class=kg>SEE THE PLOTS '+ic("arrow")+'</span>':'<span class=kg>NONE HERE</span>')+'</button>'});
 h+='</div>'});
 h+=srcCards();
 app.innerHTML=h;
 document.getElementById("dsel").onchange=function(){go("",this.value,false)};
 Array.prototype.forEach.call(app.querySelectorAll(".kc[data-t]"),function(b){b.onclick=function(){if(!b.disabled)go(b.getAttribute("data-t"),s.d,true)}});
}
function side(title,o,fields){var v=fields.filter(function(f){return o&&o[f[0]]!=null&&o[f[0]]!==""});
 return '<div class=sd><div class=st>'+title+'</div>'+(v.length?v.map(function(f){var x=o[f[0]];if(f[0]==="source")x=srcName(x);else if(/date|registered|completed/.test(f[0]))x=fdate(x);else if(x===false)x="No";else if(x===true)x="Yes";else if(typeof x==="number")x=fmt(x);return '<div class=fv><i>'+esc(f[1])+'</i>'+esc(x)+'</div>'}).join(""):'<div class=none>Nothing held</div>')+'</div>'}
function card(it,i){var K=B.kinds[CUR.t]||{},pm=[dn(it.d)];if(it.pk)pm.push("plot "+it.pk);
 var chips=(it.w||[]).map(function(w,j){return '<button class=chip type=button data-c="c'+i+'_'+j+'">'+esc(chipName(w))+'</button>'}).join("");
 var cx=(it.w||[]).map(function(w,j){return '<div class=cx id="c'+i+'_'+j+'">'+esc(B.reasons[w]||w)+'</div>'}).join("");
 var open=it.id?'<a class=open href="/plot_passport?'+kq()+'&id='+encodeURIComponent(it.id)+'">OPEN THE PLOT PASSPORT '+ic("arrow")+'</a>':'<div class=noid>Not in today’s land register, so there is no plot passport for it.</div>';
 return '<div class=pc><div class=pn>'+esc(it.n||("Plot "+(it.pk||"")))+'</div><div class=pm>'+esc(pm.join(" · "))+'</div><div class=sides>'+side(K.la||"LAND DEPARTMENT",it.a,B.sa)+side(K.lb||"MUNICIPALITY",it.b,B.sb)+'</div><div class=chips>'+chips+'</div>'+cx+open+'</div>'}
function srcName(x){return {g_dld__buildings:"Buildings register (Land Department)",g_dld__land_registry:"Land register (Land Department)",g_dm__building_permits:"Building permits (Municipality)",g_dm__project_information:"Construction projects (Municipality)",dm_address:"Address points (Municipality)",lk_empty_plot:"Najma empty-plot list"}[x]||String(x).replace(/^(g_|lk_)/,"").replace(/__|_/g," ")}
function chipName(w){return {older:"Older building",key:"Different plot number",renamed:"Renamed",villa:"Villa or house",building:"Still being built",timing:"Updated on different days",merged:"Merged or split plot",count:"Floors counted differently",several:"Several buildings",builtsince:"Built since the list",nolink:"Often empty land",projonly:"Project covers many plots"}[w]||w}
function list(s){
 var k=B.kinds[s.t];if(!k){go("",s.d,false);return}
 var reasons={};
 app.innerHTML='<button class=back type=button id=bk>'+ic("back")+'ALL CHECKS</button><div class=hd style="margin-top:6px;border:0;padding:0">'+ic(k.icon)+esc(k.title.toUpperCase())+'</div>'+districtSel(s.d,s.t)
  +'<div class=acts><a class=btn id=csv href="/data_checks/csv?'+kq()+'&t='+encodeURIComponent(s.t)+'&d='+encodeURIComponent(s.d)+'">'+ic("dl")+'DOWNLOAD CSV</a><button class=btn type=button id=pdf>'+ic("print")+'SAVE AS PDF</button></div>'
  +'<div id=why></div><input type=search id=q placeholder="Find a plot number or name" aria-label="Find a plot number or name"><div class=prt id=prt></div><div class=cnt id=cnt style="margin-top:10px">Loading…</div><div id=plist></div><button class="btn more" type=button id=more style="display:none">SHOW MORE</button>'
  +srcCards();
 document.getElementById("bk").onclick=function(){if(history.length>1&&CUR)history.back();else go("",s.d,false)};
 document.getElementById("dsel").onchange=function(){go(s.t,this.value,false)};
 document.getElementById("pdf").onclick=function(){SHOW=1e9;draw();setTimeout(function(){window.print()},50)};
 var my=CUR={t:s.t,d:s.d,items:[],total:0};SHOW=30;
 fetch("/data_checks/list?"+kq()+"&t="+encodeURIComponent(s.t)+"&d="+encodeURIComponent(s.d)).then(function(r){return r.json()}).then(function(j){if(CUR!==my)return;my.items=j.items||[];my.total=j.total||my.items.length;draw()}).catch(function(){document.getElementById("cnt").textContent="The list could not be loaded. Check the connection and try again."});
 document.getElementById("q").oninput=function(){SHOW=30;draw()};
 document.getElementById("more").onclick=function(){SHOW+=30;draw()};
}
function draw(){var my=CUR;if(!my)return;var q=(document.getElementById("q").value||"").toLowerCase().trim();
 var it=my.items.filter(function(x){return !q||(String(x.pk||"")+" "+String(x.n||"")+" "+String(x.id||"")).toLowerCase().indexOf(q)>=0});
 var ws={};my.items.forEach(function(x){(x.w||[]).forEach(function(w){ws[w]=1})});
 document.getElementById("why").innerHTML=Object.keys(ws).length?'<div class=why><div class=wt>'+ic("info")+'WHY THE RECORDS MAY DIFFER</div>'+Object.keys(ws).map(function(w){return '<p>'+esc(B.reasons[w]||w)+'</p>'}).join("")+'</div>':"";
 var capped=my.total>my.items.length;
 document.getElementById("cnt").textContent=(q?fmt(it.length)+" match “"+q+"”. ":"")+fmt(my.total)+" plots"+(my.d==="all"?" across all districts":" in "+dn(my.d))+(capped?(my.d==="all"?". The city-wide list holds "+fmt(my.items.length)+" of them; choose a district to see all of its plots.":". The list holds the first "+fmt(my.items.length)+" by name."):".");
 var a=(S&&S.as_of)||{};document.getElementById("prt").textContent="Najma data checks · "+B.kinds[my.t].title+" · "+(my.d==="all"?"all districts":dn(my.d))+" · research flags, not findings · sources: "+Object.keys(B.src).map(function(k){return B.src[k]+" "+fdate(a[k])}).join("; ");
 var pl=document.getElementById("plist");
 pl.innerHTML=it.length?it.slice(0,SHOW).map(card).join(""):'<div class=empty>No plot in this list matches.</div>';
 document.getElementById("more").style.display=it.length>SHOW?"flex":"none";
 Array.prototype.forEach.call(pl.querySelectorAll(".chip"),function(c){c.onclick=function(){var e=document.getElementById(c.getAttribute("data-c"));if(e)e.classList.toggle("on")}});
}
function render(){var s=st();if(s.t)list(s);else{CUR=null;summary(s)}window.scrollTo(0,0)}
render();
})();`;
