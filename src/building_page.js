// v187 - THE BUILDING PAGE (Kendall, 20 Sep 2026: "instead of opening a panel, it should open a new pop up or page within the
// ecosystem", pointing at the Symphony unit viewer: "this is what i wanted to open up").
//
// The Symphony pilot is a developer render with the units drawn over it, a Revit model behind every room, the developer's
// availability sheet and the register. One building has all four. This page is the same page for EVERY register-bound building,
// from what the registers hold: the same FILTERS panel, the same "Sold so far" table, the same About-the-building card, the same
// card on tap - with the building's own CityEngine model as the hero, cut into floors, in place of a render nobody published.
//
// Integrity, as on the twin: the model is never changed. Bands share its geometry and are cut with clipping planes; the original
// is parked on an unused layer. A type on a floor is the register's floor range, never a unit position - the page says so.
// Unit positions belong to level A (a Revit model or a developer stacking plan) and are not invented here.

export const BP_COL = {                     // Najma's own scheme, the same colours the twin's floors use
  studio: "#B9A6C9", "1": "#C5A56A", "2": "#7FA8C9", "3": "#8FC7B9", "4": "#D9A441",
  office: "#8FA39B", retail: "#D98C6A", hotel: "#C58FB0", civic: "#7FA3B8", services: "#37423F", staff: "#9FB0A8", labour: "#7E8A86", homes: "#D9CFB8", villa: "#C9C0AC", other: "#8A8F96",
};
const CHIPS = [["studio", "Studio"], ["1", "1 BHK"], ["2", "2 BHK"], ["3", "3 BHK"], ["4", "4 BHK +"]];
const USES = [["office", "Office"], ["retail", "Retail"], ["hotel", "Hotel"], ["staff", "Staff housing"], ["labour", "Labour housing"]];
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (n) => (n == null ? "" : Math.round(n).toLocaleString("en-US"));
const aed = (n) => (n == null ? "—" : n >= 1e6 ? "AED " + (n / 1e6).toFixed(2) + "M" : "AED " + fmt(n));

// ---- what the registers can say about one building ---------------------------------------------------------------------------
export function buildingData(slug, id, stack, umx, bf, anchors, people, districtName, plansIndex) {
  const amen = stack.district_amenities || null;
  const r = stack && stack.buildings_by_id && stack.buildings_by_id[String(id)];
  const u = umx && umx.buildings_by_id && umx.buildings_by_id[String(id)];
  if (!r || !u) return null;
  const dm = u.dm || {}, dld = u.dld || {}, sales = u.dld_sales || {};
  const a = ((anchors && anchors.anchors) || []).find((x) => String(x.i) === String(id)) || {};
  const sold = sales.sold_by_type || {};
  const register = (r.types || []).filter((t) => t.units).map((t) => ({
    type: t.t, c: t.c, launched: t.units, sold: sold[t.t] || 0, median: t.aed, est: !!t.est, sqm: t.sqm, rent: t.rent, yield: t.yield,
    lo: t.lo, hi: t.hi,
  }));
  const floors = r.floors || [];
  const homeFloors = floors.filter((f) => f.u === "homes" || f.u === "hotel" || f.u === "villa");
  const band = (u2) => { const n = floors.filter((f) => f.u === u2).length; return n ? n + (n === 1 ? " floor" : " floors") : null; };
  const facts = [];
  if (u.developer) facts.push(["Developer", u.developer]);
  else if (dld.project && String(dld.project).toLowerCase() !== String(r.name || "").toLowerCase()) facts.push(["Registered as", dld.project]);
  if (dm.floors_label) facts.push(["Stack", String(dm.floors_label).replace(/\s+/g, " ").trim() + (r.basements ? "" : "") ]);
  const mix = [band("office") && band("office") + " of offices", band("retail") && band("retail") + " of retail",
    homeFloors.length ? homeFloors.length + " residential floors" : null, band("services") && band("services") + " of services and parking"].filter(Boolean);
  if (mix.length) facts.push(["Floors", mix.join(" · ")]);
  if (u.total_units || dld.units_registered) facts.push(["Units", fmt(u.total_units || dld.units_registered) + " registered" +
    (u.asset_classes ? " — " + Object.entries(u.asset_classes).filter((e) => e[1]).map((e) => fmt(e[1]) + " " + e[0]).join(", ") : "")]);
  if (dm.height_m) facts.push(["Height", Math.round(dm.height_m) + " m" + (a.h && Math.abs(a.h - dm.height_m) > 12 ? " (the model stands " + Math.round(a.h) + " m)" : "")]);
  if (dm.completed || dm.construction_year) facts.push(["Completed", String(dm.completed || dm.construction_year).slice(0, 10)]);
  else if (dm.permitted) facts.push(["Permit", String(dm.permitted).slice(0, 10) + (dm.dm_status ? " · " + dm.dm_status : "")]);
  if (u.car_parks || dm.indoor_parking) facts.push(["Parking", fmt(u.car_parks || dm.indoor_parking) + " bays"]);
  if (u.elevators || dm.lifts) facts.push(["Lifts", String(u.elevators || dm.lifts)]);
  // what no listing states: a genuinely mixed tower, shops under the homes, and labour or staff housing in the same building
  if (r.uses && r.uses.length) facts.push([r.mixed ? "Mixed use" : "Used for", r.uses.map((x) => ({ homes: "homes", villa: "villas", office: "offices", retail: "retail", hotel: "hotel", civic: "civic", staff: "staff housing", labour: "labour housing" }[x] || x)).join(" · ")]);
  if (r.podium) facts.push(["Podium", "shops or offices on the ground floor"]);
  if (r.labour || r.staff) facts.push(["In the same building", [r.labour ? "labour accommodation" : null, r.staff ? "staff or student accommodation" : null].filter(Boolean).join(" · ")]);
  if (r.area_sqm) facts.push(["Registered floor area", fmt(r.area_sqm) + " m²"]);
  if (dm.plot_area_sqm) facts.push(["Plot", fmt(dm.plot_area_sqm) + " m²" + (dm.buildings_on_plot > 1 ? " · " + dm.buildings_on_plot + " buildings on it" : "")]);
  if (a.lat && a.lon) facts.push(["Location", a.lat.toFixed(4) + " N " + a.lon.toFixed(4) + " E" + (a.cluster ? " · " + a.cluster : "")]);
  const around = [];
  if (sales.metro) around.push(["Metro", sales.metro]);
  if (sales.mall) around.push(["Mall", sales.mall]);
  if (sales.landmark) around.push(["Landmark", sales.landmark]);
  return {
    slug, id: String(id), name: r.name || a.name || "building", district: districtName || (stack.district || slug),
    basis: r.basis, conflict: r.conflict, levelShift: r.level_shift, basements: r.basements, label: dm.floors_label,
    grade: a.identity_grade || null, mapName: a.name || null, x: a.x, z: a.z, h: a.h || dm.height_m,
    floors, types: r.types || [], register, facts, around,
    sales: { total: sales.sold_total, first: sales.first, last: sales.last, sqm: sales.median_aed_sqm },
    sheet: r.sheet || null, generated: stack.generated, asOf: (stack.sources || [])[0] || "",
    open: r.open || null, openFrom: r.open_from || null, openRadius: r.open_radius || 0, plot: r.plot || null,
    fits: r.fits !== false, heightFlag: r.height_flag || null, modelH: (anchors && a.h) || null,
    plans: plansFor(plansIndex, r.name, (u.dld || {}).project, u.developer),
    rent: r.rent || null, project: r.project || null,
    schools: amen ? (amen.schools || []).slice(0, 8) : null,
    schoolsAll: amen ? (amen.schools || []).length : 0,
    healthN: amen ? amen.health_n || 0 : 0,
    amenKm: amen ? amen.radius_km || 5 : 0,
    developer: u.developer || null,
    // the register's own name for this building, when it differs - NOT the project register row, which is `project`
    registeredAs: (dld.project && String(dld.project).toLowerCase() !== String(r.name || "").toLowerCase()) ? dld.project : null,
    people: communityMix(people, stack.district || slug),
    fps: ((anchors && anchors.anchors) || []).filter((x) => x.x != null).map((x) => [x.i, x.x, x.z]),
  };
}

// The community's resident mix (DEWA register, per community only). Kendall's decision of 17 Sep 2026 allows it on a
// client-facing surface; the size floors in the data are disclosure control and are not touched here. It is context about an
// area, never a reason to choose one - the card says so.
function communityMix(people, slug) {
  const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const want = norm(slug);
  const c = ((people && people.communities) || []).find((x) => [x.name, x.label, x.official].concat(x.known || []).some((n) => norm(n) === want));
  if (!c) return null;
  // Regions first, with the countries inside them. Naming countries alone leaves a meaningless "everyone else" - Business Bay
  // read India 17, Russia 7, Iran 6, UK 6 and then 63% unexplained, because a country is only named at 5% or more. The regions
  // carry the same people at 1% and account for nearly all of them.
  const regions = (c.regions || []).filter((r) => r.pct).map((r) => ({
    name: r.name, pct: r.pct, others: r.others || 0,
    countries: (r.countries || []).slice(0, 6),          // pairs, not strings: the doughnut drills into them
  }));
  if (!regions.length && !(c.mix || []).length) return null;
  const named = regions.reduce((t, r) => t + r.pct, 0);
  return { label: c.label || c.official || c.name, accounts: c.accounts || null, unknown: c.noNationalityPct || 0,
    regions, rest: Math.max(0, 100 - named - (c.noNationalityPct || 0)),
    mix: (c.mix || []).slice(0, 4), floor: (people.rules && people.rules.minSharePct) || 5,
    cfloor: (people.rules && people.rules.regionCountryMinPct) || 1 };
}

// The floor plans this building's project has in the library. Matched on the project name, both ways, so "Bay Square - 02"
// finds "Bay Square" and "The Symphony" finds "The Symphony by Imtiaz". Nothing is guessed: no match, no plans.
function plansFor(index, name, project, developer) {
  const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(the|by|tower|towers|residences|residence|building)\b/g, " ").replace(/\s+/g, " ").trim();
  const mine = [norm(name), norm(project)].filter((x) => x.length > 3);
  if (!mine.length) return null;
  for (const d of ((index && index.developers) || [])) {
    for (const p of (d.projects || [])) {
      const pn = norm(p.name);
      if (!pn) continue;
      if (!mine.some((m) => m === pn || (m.length > 5 && pn.indexOf(m) >= 0) || (pn.length > 5 && m.indexOf(pn) >= 0))) continue;
      const plans = (p.plans || []).filter((x) => x.url).slice(0, 12)
        .map((x) => ({ label: x.label || x.kind || "plan", url: x.url, source: x.source || null }));
      if (plans.length) return { developer: d.name || developer || null, project: p.name, note: p.note || null, plans };
    }
  }
  return null;
}

// ---- the page ------------------------------------------------------------------------------------------------------------------
export function buildingPageHtml(D, key, rk) {
  const K = encodeURIComponent(key || "");
  const chips = CHIPS.filter((c) => D.register.some((t) => t.c === c[0]));
  const uses = USES.filter((c) => D.floors.some((f) => f.u === c[0]));
  const back = "/skyline/" + encodeURIComponent(D.slug) + "?key=" + K + "&b=" + encodeURIComponent(D.id) + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  const tb = (val, label, col, host) => '<button class="tb" data-' + host + '="' + val + '"><i style="background:' + col + '"></i>' + esc(label) + "</button>";
  const regRows = D.register.map((t) => '<tr><td>' + esc(t.type) +
    '<div class=bar><i style="width:' + Math.max(0, Math.min(100, Math.round(100 * (t.sold || 0) / (t.launched || 1)))) + '%"></i></div></td>' +
    "<td>" + fmt(t.sold) + "</td><td>" + fmt(t.launched) + "</td><td>" + (t.median ? (t.est ? "~" : "") + aed(t.median) : "—") + "</td></tr>").join("");
  const head = '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">' +
    "<title>" + esc(D.name) + " — the building</title>" +
    '<link rel=preconnect href="https://fonts.googleapis.com"><link rel=preconnect href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel=stylesheet>' +
    "<style>" + CSS + "</style>" +
    '<script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.169.0/build/three.module.js","three/addons/":"https://unpkg.com/three@0.169.0/examples/jsm/"}}</script></head><body>';
  const body =
    '<div id=stage></div><div id=msg>loading the model…</div>' +
    // whichever building is open, its name and its developer sit across the top (Kendall, 20 Sep)
    '<div id=title><b>' + esc(D.name) + "</b><span>" + esc([D.developer || (D.registeredAs ? "registered as " + D.registeredAs : ""), D.district]
      .filter(Boolean).join(" · ")) + "</span></div>" +
    '<a class=bk href="' + back + '">← the twin</a>' +
    '<div id=about class=glass>About the building</div>' +
    '<div id=tab>⌃</div>' +
    '<div id=panel class=glass>' +
      "<h1>FILTERS</h1><div id=count></div>" +
      '<div id=types>' + chips.map((c) => tb(c[0], c[1], BP_COL[c[0]], "t")).join("") + "</div>" +
      (uses.length ? '<div class=grp>Also in the tower</div><div id=others>' + uses.map((c) => tb(c[0], c[1], BP_COL[c[0]], "u")).join("") + "</div>" : "") +
      '<div class=grp>Size <u id=vhi></u></div><div class=range><div class=track></div><input id=lo type=range><input id=hi type=range></div>' +
      '<div class=vals><span id=vlo></span><span>sq ft</span></div>' +
      '<div class=grp>Price <u id=vphi></u></div><div class=range><div class=track></div><input id=plo type=range><input id=phi type=range></div>' +
      '<div class=vals><span id=vplo></span><span>per sq ft</span></div>' +
      '<div class=grp>Homes on the floor <u id=vkhi></u></div><div class=range><div class=track></div><input id=khi type=range></div>' +
      (D.open ? '<div class=grp>Open view <u>sees over the roofs</u></div><div id=dirs>' +
        ["N", "NE", "E", "SE", "S", "SW", "W", "NW"].map((x, k) => '<button class="tb dir off" data-d="' + k + '">' + x + "</button>").join("") + "</div>" : "") +
      '<button id=hide>Hide All</button>' +
      (D.register.length ? '<div class=grp>Sold so far <u id=soldtag></u></div><div id=sold></div>' +
        '<div class=src>Dubai Land Department units register. Counts by type, not by unit number: which homes are sold is not published.</div>' : "") +
    "</div>" +
    "<div id=card></div>" +
    '<div id=foot></div>' +
    (!D.fits ? '<div id=warn>The floors are not drawn on the model here. This footprint stands ' + (D.modelH ? Math.round(D.modelH) + " m" : "far lower") +
      ' in the twin, and the register building is ' + (D.heightFlag && D.heightFlag.bound_m ? D.heightFlag.bound_m + " m" : "much taller") +
      ': either the footprint is the podium of the scheme, or the model carries a podium height for it. The floor layout below is the register’s and stands on its own.</div>' : "") +
    (D.conflict ? '<div id=warn>The map calls this building ' + esc(D.conflict) + '. The floors here are the register record for ' +
      esc(D.name) + " — one of the two is bound to the wrong footprint, so read them with care.</div>" : "");
  const json = JSON.stringify(D).replace(/<\//g, "<\\/");
  const tail = '<script type="module">import * as THREE from "three";import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";' +
    'import { OrbitControls } from "three/addons/controls/OrbitControls.js";import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";' +
    'import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";' +
    "const D=" + json + ",KEY=" + JSON.stringify(key || "") + ",COL=" + JSON.stringify(BP_COL) + ";" +
    // the worker is bundled with esbuild's keepNames, which wraps every function in __name(); the browser has no such helper, so
    // the page carries a no-op of its own before the view function's own source runs
    "const __name=(f)=>f;" +
    "(" + String(view) + ")(THREE,GLTFLoader,OrbitControls,RoomEnvironment,MeshoptDecoder,D,KEY,COL);" +
    "</script></body></html>";
  return head + body + tail;
}

const CSS = `
:root{--ink:#0C1413;--panel:rgba(19,31,29,.94);--gold:#C5A56A;--line:rgba(197,165,106,.38);--text:#E8E4D8;--mut:#8FA39B}
html,body{margin:0;height:100%;background:var(--ink);color:var(--text);font-family:"IBM Plex Mono",ui-monospace,monospace;overflow:hidden}
#stage{position:fixed;inset:0}#stage canvas{display:block}
#msg{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);font-size:.66rem;letter-spacing:.12em;color:var(--mut)}
.glass{background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.45);color:var(--text)}
#panel{position:fixed;right:14px;top:62px;width:248px;box-sizing:border-box;padding:14px 15px 15px;max-height:calc(100% - 92px);overflow:auto;z-index:4}
#panel h1{margin:0;font-size:.6rem;font-weight:600;letter-spacing:.14em;color:var(--gold);text-transform:uppercase}
#count{font-family:Fraunces,Georgia,serif;font-size:1rem;font-weight:600;margin:7px 0 12px}
#count b{color:var(--gold)}
#count small{display:block;font-family:"IBM Plex Mono",monospace;font-size:.55rem;letter-spacing:.06em;color:var(--mut);font-weight:400;margin-top:3px;line-height:1.5}
#types,#others{display:flex;flex-wrap:wrap;gap:5px}
.tb{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);background:rgba(12,20,19,.5);border-radius:99px;padding:5px 9px;font:500 .6rem/1 "IBM Plex Mono",monospace;letter-spacing:.06em;color:var(--text);cursor:pointer;transition:border-color .15s,opacity .15s}
.tb i{width:9px;height:9px;border-radius:2px;flex:none}
.tb.off{opacity:.4}.tb.off i{filter:grayscale(1)}.tb:hover{border-color:var(--gold)}
.grp{font-size:.52rem;letter-spacing:.14em;color:var(--mut);text-transform:uppercase;margin:13px 0 6px;display:flex;justify-content:space-between;align-items:baseline}
.grp u{text-decoration:none;color:var(--gold);letter-spacing:.04em}
.sz{display:none}
.range{position:relative;height:24px;margin:0 3px}
.range .track{position:absolute;left:0;right:0;top:11px;height:2px;background:rgba(197,165,106,.32)}
.range input{position:absolute;left:-5px;width:calc(100% + 10px);top:0;margin:0;background:none;pointer-events:none;-webkit-appearance:none;appearance:none;height:24px}
.range input::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:16px;height:16px;border-radius:50%;background:var(--gold);border:2px solid var(--ink);cursor:pointer}
.range input::-moz-range-thumb{pointer-events:auto;width:16px;height:16px;border-radius:50%;background:var(--gold);border:2px solid var(--ink);cursor:pointer}
.vals{display:flex;justify-content:space-between;font-size:.58rem;color:var(--text);margin:0 3px 2px}
#hide{display:block;width:100%;border:1px solid var(--line);border-radius:99px;padding:6px 0;margin-top:11px;background:transparent;color:var(--gold);font:600 .56rem "IBM Plex Mono",monospace;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
#hide:hover{background:rgba(197,165,106,.12)}
table.reg{width:100%;border-collapse:collapse;font-size:.58rem;margin-top:2px}
table.reg td,table.reg th{padding:3px 2px;text-align:right;font-weight:400}
table.reg th{color:var(--mut);font-size:.5rem;letter-spacing:.08em;text-transform:uppercase}
table.reg td:first-child,table.reg th:first-child{text-align:left}
.bar{height:3px;border-radius:2px;background:rgba(197,165,106,.18);overflow:hidden;margin-top:2px}.bar i{display:block;height:100%;background:var(--gold)}
.src{font-size:.52rem;color:rgba(143,163,155,.85);line-height:1.5;margin-top:7px}
#tab{display:none}
.plans{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}
.plans a{display:block;text-decoration:none;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:rgba(12,20,19,.5)}
.plans img{display:block;width:100%;height:92px;object-fit:cover;background:#F6F3EC}
.plans b{display:block;padding:5px 7px;font-size:.55rem;letter-spacing:.08em;text-transform:uppercase;color:var(--gold)}
.plate{display:block;width:100%;max-height:190px;margin:6px 0 2px}
#title{position:fixed;left:50%;transform:translateX(-50%);top:16px;z-index:5;text-align:center;pointer-events:none;max-width:44vw}
#title b{display:block;font:600 1.25rem/1.15 Fraunces,Georgia,serif;color:var(--text);text-shadow:0 2px 10px rgba(0,0,0,.75)}
#title span{display:block;margin-top:3px;font-size:.58rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);text-shadow:0 2px 8px rgba(0,0,0,.8)}
#about{position:fixed;left:14px;top:62px;padding:7px 14px;border-radius:99px;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);cursor:pointer;z-index:4}
.bk{position:fixed;left:14px;top:18px;z-index:5;font-size:.6rem;letter-spacing:.08em;color:var(--gold);background:var(--panel);border:1px solid var(--line);border-radius:99px;padding:6px 12px;text-decoration:none}
#card{position:fixed;left:14px;top:104px;width:334px;box-sizing:border-box;padding:16px 17px;display:none;max-height:calc(100% - 150px);overflow:auto;z-index:4;background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
#card h2{margin:0 0 2px;font:600 1.25rem/1.2 Fraunces,Georgia,serif;color:var(--text)}
#card .t{color:var(--gold);font-size:.56rem;letter-spacing:.12em;text-transform:uppercase}
#card .x{position:absolute;right:13px;top:9px;cursor:pointer;font-size:1.1rem;color:var(--mut)}
#card h3{margin:15px 0 7px;font:600 .55rem/1 "IBM Plex Mono",monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);border-top:1px solid rgba(197,165,106,.22);padding-top:12px}
dl{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;margin:12px 0 0;font-size:.68rem}
dt{color:var(--mut)}dd{margin:0;text-align:right}
.pill{display:inline-block;margin-top:9px;padding:3px 9px;border-radius:99px;font-size:.55rem;letter-spacing:.08em;text-transform:uppercase}
.pill.a{background:var(--gold);color:var(--ink);font-weight:600}.pill.g{background:rgba(232,228,216,.12)}.pill.n{background:rgba(232,228,216,.08);color:var(--mut)}
.row{display:flex;justify-content:space-between;gap:10px;font-size:.66rem;padding:5px 0;border-bottom:1px solid rgba(197,165,106,.14)}
.row span:last-child{color:var(--mut);white-space:nowrap;text-align:right}
.row small{color:var(--mut)}
.acts{display:flex;gap:7px;margin-top:12px}
.acts a{flex:1;text-align:center;padding:7px 0;border-radius:99px;text-decoration:none;font-size:.58rem;letter-spacing:.08em;text-transform:uppercase}
.acts .w{background:#25D366;color:#053}.acts .c{border:1px solid var(--line);color:var(--gold)}
#foot{position:fixed;left:14px;bottom:14px;right:280px;font-size:.55rem;line-height:1.6;color:rgba(143,163,155,.8);pointer-events:none}
#gcredit{position:fixed;right:280px;bottom:14px;font-size:.5rem;color:rgba(143,163,155,.55);pointer-events:none}
#warn{position:fixed;left:14px;bottom:70px;max-width:440px;font-size:.62rem;line-height:1.5;color:#E8C4A8;background:rgba(12,20,19,.85);border:1px solid rgba(217,148,112,.5);border-radius:10px;padding:8px 11px;z-index:4}
@media(max-width:820px){#title{position:static;transform:none;max-width:none;padding:44px 14px 0}#title b{font-size:1.05rem}#panel{left:10px;right:10px;width:auto;top:auto;bottom:10px;max-height:46vh}
  #card{left:10px;right:10px;width:auto;top:96px;max-height:44vh}
  #foot{display:none}#warn{left:10px;right:10px;max-width:none;bottom:auto;top:104px}#about{top:18px;left:auto;right:14px}}
`;

// ---- the hero: this building's own model, cut into its floors -------------------------------------------------------------------
function view(THREE, GLTFLoader, OrbitControls, RoomEnvironment, MeshoptDecoder, D, KEY, COL) {
  const el = document.getElementById("stage"), msg = document.getElementById("msg"), $ = (id) => document.getElementById(id);
  // its own, because this function is shipped as text: the module's helpers are renamed by the bundler and are not here
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (v) => (v == null ? "" : Math.round(v).toLocaleString("en-US"));
  const aed = (v) => (v == null ? "\u2014" : v >= 1e6 ? "AED " + (v / 1e6).toFixed(2) + "M" : "AED " + fmt(v));

  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0C1413); scene.fog = new THREE.Fog(0x101B19, 900, 4200);
  const cam = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 2, 20000);
  const ren = new THREE.WebGLRenderer({ antialias: true }); ren.setPixelRatio(Math.min(2, devicePixelRatio)); ren.setSize(innerWidth, innerHeight);
  ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.0; ren.localClippingEnabled = true; el.appendChild(ren.domElement);
  { const pm = new THREE.PMREMGenerator(ren); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.5; }
  const sun = new THREE.DirectionalLight(0xFFF2DA, 2.1); sun.position.set(-260, 420, 220); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; scene.add(sun); scene.add(new THREE.HemisphereLight(0x9FB6AE, 0x121D1B, 0.55));
  ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap;
  // the twin's own sky: teal-black at the horizon, ink overhead, a breath of gold along the skyline
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { horizon: { value: new THREE.Color(0x1B332E) }, zenith: { value: new THREE.Color(0x121D1B) }, warm: { value: new THREE.Color(0xC5A56A) } },
    vertexShader: "varying vec3 vW;void main(){vW=normalize((modelMatrix*vec4(position,1.0)).xyz);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: "uniform vec3 horizon,zenith,warm;varying vec3 vW;void main(){float h=clamp(vW.y,0.0,1.0);vec3 c=mix(horizon,zenith,pow(h,0.45));c+=warm*0.05*exp(-h*13.0);gl_FragColor=vec4(c,1.0);}" }));
  sky.scale.setScalar(9000); scene.add(sky);
  const ctl = new OrbitControls(cam, ren.domElement); ctl.enableDamping = true; ctl.autoRotate = true; ctl.autoRotateSpeed = 0.45; ctl.maxPolarAngle = Math.PI * 0.495;
  addEventListener("pointerdown", () => { ctl.autoRotate = false; }, { once: true });
  addEventListener("resize", () => { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); ren.setSize(innerWidth, innerHeight); });

  const floors = D.floors, N = floors.length;
  const state = { on: new Set(), use: new Set(), lo: 0, hi: 1e9, plo: 0, phi: 1e9, khi: 1e9, dirs: new Set(), sel: -1 };
  D.register.forEach((t) => state.on.add(t.c));
  const sqft = (t) => (t.sqm ? t.sqm * 10.764 : null);
  const sizes = D.register.map(sqft).filter((x) => x);
  const smax = sizes.length ? Math.ceil(Math.max.apply(null, sizes) / 50) * 50 : 5000;
  state.hi = smax;

  const psf = (t) => (t.aed && t.sqm ? t.aed / (t.sqm * 10.764) : null);
  const typesOn = (f) => (f.t || []).map((i) => D.types[i]).filter((t) => t && state.on.has(t.c) &&
    (!sqft(t) || (sqft(t) >= state.lo && sqft(t) <= state.hi)) &&
    (!psf(t) || (psf(t) >= state.plo && psf(t) <= state.phi)));
  // which sides this floor sees over, from the massing of every neighbour within the radius
  const DIRN = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const openOf = (j) => (D.open && D.open[j] != null ? D.open[j] : null);
  const openDirs = (j) => { const m = openOf(j); return m == null ? [] : DIRN.filter((_d, k) => m & (1 << k)); };
  const dirOk = (j) => { if (!state.dirs.size) return true; const m = openOf(j); if (m == null) return false;
    for (const k of state.dirs) if (!(m & (1 << k))) return false; return true; };
  const isHome = (f) => f.u === "homes" || f.u === "hotel" || f.u === "villa";
  const match = (f, j) => {
    if (!dirOk(j)) return null;
    if ((f.k || 0) > state.khi) return null;
    return state.use.has(f.u) ? { c: f.u } : (isHome(f) ? typesOn(f)[0] || null : null);
  };
  const colourOf = (f, j) => {
    if (j === state.sel) return [0xF4D58D, 1, 0.85];
    const m = match(f, j);
    if (m) return [parseInt(String(COL[m.c] || COL.other).slice(1), 16), 1, 0.3];
    return isHome(f) ? [0x4a524e, 1, 0.02] : [0x2f3a38, 1, 0];
  };

  let MESH = [], BANDS = [], MATS = [], y0 = 0, fh = 1;
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load("/img/sky_" + D.slug, (g) => {
    msg.remove();
    const root = g.scene, all = [];
    root.updateMatrixWorld(true);
    root.traverse((o) => { if (o.isMesh) all.push(o); });
    // the same rule the twin uses: every mesh belongs to its nearest footprint, and this page keeps the ones that are ours
    const bb = new THREE.Box3(), c = new THREE.Vector3();
    const mine = [], others = [];
    for (const m of all) {
      bb.setFromObject(m); bb.getCenter(c);
      let best = null, bd = 1e12;
      for (const f of D.fps) { const dx = f[1] - c.x, dz = f[2] - c.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = f[0]; } }
      (String(best) === D.id && bd <= 900 ? mine : others).push(m);
    }
    if (!mine.length) { const w = document.createElement("div"); w.id = "msg"; w.textContent = "this footprint is not in the model"; document.body.appendChild(w); return; }
    // context: the neighbours stay, quietly, so the tower is somewhere rather than nowhere
    // the neighbours keep their own facades so the tower stands in a city, only quieter than the subject
    const dim = (mt) => { const c = mt.clone(); if (c.map) { c.map.colorSpace = THREE.SRGBColorSpace; c.color.multiplyScalar(0.72); } else { c.color.lerp(new THREE.Color(0x2b3533), 0.55); }
      c.roughness = Math.min(1, (c.roughness || 0.8) + 0.1); c.metalness = 0; return c; };
    for (const m of others) { m.material = Array.isArray(m.material) ? m.material.map(dim) : dim(m.material); m.castShadow = true; m.receiveShadow = true; }
    scene.add(root);
    MESH = mine;
    const b0 = new THREE.Box3().setFromObject(root), c0 = b0.getCenter(new THREE.Vector3()), s0 = b0.getSize(new THREE.Vector3());
    { const g = new THREE.Mesh(new THREE.CircleGeometry(Math.max(s0.x, s0.z) * 1.3, 64),
        new THREE.MeshStandardMaterial({ color: 0x16211E, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 8 }));
      g.rotation.x = -Math.PI / 2; g.position.set(c0.x, b0.min.y + 0.05, c0.z); g.receiveShadow = true; scene.add(g); }
    // the district's aerial, the same Esri sheet the twin drapes under its massing: roads, greenery and water, in the model's metres
    fetch("/img/ground_" + D.slug).then((r) => (r.ok ? r.json() : null)).then((g) => {
      if (!g || !g.scene) return;
      const G = g.scene, tex = new THREE.TextureLoader().load("/img/ground_" + D.slug + "_jpg");
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, ren.capabilities.getMaxAnisotropy());
      const geo = new THREE.PlaneGeometry(G.x1 - G.x0, G.z1 - G.z0); geo.rotateX(-Math.PI / 2);
      const pl = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0, color: 0xBFC4BC,
        polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 }));
      pl.position.set((G.x0 + G.x1) / 2, b0.min.y + 0.1, (G.z0 + G.z1) / 2); pl.receiveShadow = true; pl.renderOrder = -1; scene.add(pl);
      const cr = document.createElement("div"); cr.id = "gcredit";
      cr.textContent = g.attribution || "Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community";
      document.body.appendChild(cr);
    }).catch(() => {});
    const box = new THREE.Box3(); mine.forEach((m) => box.expandByObject(m));
    y0 = box.min.y; const H = box.max.y - y0; fh = H / Math.max(N, 1);
    const ctr = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const R = Math.max(size.x, size.z, 30);
    // frame the whole tower for the viewport it actually has: fit its height vertically and its width horizontally, take the
    // larger distance, and leave a margin. A narrow window needs to stand further back than a wide one.
    const fit = () => {
      const vfov = cam.fov * Math.PI / 180;
      const dH = (H * 0.62) / Math.tan(vfov / 2);
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect);
      const dW = (R * 0.9) / Math.tan(hfov / 2);
      const d = Math.max(dH, dW, R * 2.2) * 1.12;
      const dir = new THREE.Vector3(0.62, 0, 0.78).normalize();
      // stand above the subject, not in the street: a squat block needs more elevation than a tower to read at all
      cam.position.set(ctr.x + dir.x * d, y0 + H * 0.72 + R * 0.35, ctr.z + dir.z * d);
      ctl.target.set(ctr.x, y0 + H * 0.46, ctr.z);
      ctl.minDistance = R * 0.8; ctl.maxDistance = d * 3.2;
      scene.fog.near = d * 1.05; scene.fog.far = d * 5; cam.far = Math.max(9000, d * 9); cam.updateProjectionMatrix();
      return d;
    };
    const dist = fit();
    addEventListener("resize", () => { if (!ctl.__moved) fit(); });
    ctl.addEventListener("start", () => { ctl.__moved = true; });
    for (const m of mine) { if (m.userData.bpMask == null) m.userData.bpMask = m.layers.mask; m.layers.set(30); }   // parked, never changed
    paint();
  }, undefined, () => { msg.textContent = "the model for this district is not published yet"; });

  function clearBands() { for (const b of BANDS) scene.remove(b); for (const m of MATS) m.dispose(); BANDS = []; MATS = []; }
  function paint() {
    if (!MESH.length) return;
    clearBands();
    if (!D.fits) {     // the model is far shorter than the register's building: the footprint is a podium, or its height is one
      for (const m of MESH) { if (m.userData.bpMask != null) { m.layers.mask = m.userData.bpMask; m.userData.bpMask = null; } }
      count();
      return;
    }
    const runs = [];
    floors.forEach((f, j) => {
      const L = colourOf(f, j), p = runs[runs.length - 1];
      if (p && p.j1 === j - 1 && p.col === L[0] && p.op === L[1] && p.em === L[2]) p.j1 = j;
      else runs.push({ j0: j, j1: j, col: L[0], op: L[1], em: L[2] });
    });
    for (const q of runs) {
      const lo = y0 + q.j0 * fh, hi = y0 + (q.j1 + 1) * fh;
      const cp = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -lo), new THREE.Plane(new THREE.Vector3(0, -1, 0), hi)];
      MESH.forEach((m, k) => {
        const src = Array.isArray(m.material) ? m.material[0] : m.material;
        let mt;
        if (src && src.map) {                       // v3 export: a real facade photograph. Keep it and tint it, as the twin does.
          mt = src.clone();
          mt.map.colorSpace = THREE.SRGBColorSpace;
          mt.color = new THREE.Color(q.col); mt.color.lerp(new THREE.Color(0xFFFFFF), 0.34);
          mt.emissive = new THREE.Color(q.col); mt.emissiveIntensity = Math.max(0.12, q.em);
          mt.roughness = 0.85; mt.metalness = 0;
        } else {
          mt = new THREE.MeshStandardMaterial({ color: q.col, emissive: q.col, emissiveIntensity: q.em, roughness: 0.6, metalness: 0.02, flatShading: true });
        }
        mt.side = THREE.FrontSide; mt.transparent = q.op < 1; mt.opacity = q.op; mt.depthWrite = q.op >= 1; mt.clippingPlanes = cp;
        mt.polygonOffset = k > 0; mt.polygonOffsetFactor = -k; mt.polygonOffsetUnits = -4 * k; mt.needsUpdate = true;
        const b = new THREE.Mesh(m.geometry, mt); b.matrixAutoUpdate = false; b.matrix.copy(m.matrixWorld);
        b.castShadow = true; b.receiveShadow = true;
        b.userData.bp = { j0: q.j0, j1: q.j1, lo, hi }; scene.add(b); BANDS.push(b); MATS.push(mt);
      });
    }
    count();
  }
  (function loop() { requestAnimationFrame(loop); ctl.update(); ren.render(scene, cam); })();

  // ---- the panel ------------------------------------------------------------------------------------------------------------
  function count() {
    let n = 0, homes = 0;
    floors.forEach((f, j) => { if (match(f, j)) { n++; homes += f.k || 0; } });
    $("count").innerHTML = "<b>" + n + "</b> floor" + (n === 1 ? "" : "s") + (homes ? "<small>" + homes.toLocaleString("en") + " homes on them</small>" :
      "<small>of " + floors.length + " in the building</small>");
  }
  document.querySelectorAll("[data-t]").forEach((b) => { b.onclick = () => { const k = b.dataset.t; state.on.has(k) ? state.on.delete(k) : state.on.add(k); b.classList.toggle("off", !state.on.has(k)); hideLabel(); paint(); }; });
  document.querySelectorAll("[data-u]").forEach((b) => { b.classList.add("off"); b.onclick = () => { const k = b.dataset.u; state.use.has(k) ? state.use.delete(k) : state.use.add(k); b.classList.toggle("off", !state.use.has(k)); hideLabel(); paint(); }; });
  const lo = $("lo"), hi = $("hi");
  [lo, hi].forEach((e) => { e.min = 0; e.max = smax; e.step = 25; });
  lo.value = 0; hi.value = smax;
  const vals = () => { $("vlo").textContent = Math.round(state.lo).toLocaleString("en"); $("vhi").textContent = state.hi >= smax ? "any" : Math.round(state.hi).toLocaleString("en"); };
  lo.oninput = () => { state.lo = Math.min(+lo.value, +hi.value - 25); lo.value = state.lo; vals(); paint(); };
  hi.oninput = () => { state.hi = Math.max(+hi.value, +lo.value + 25); hi.value = state.hi; vals(); paint(); };
  vals();
  // price per sq ft, from the register's median price and median size for each type
  const psfAll = D.register.map((t) => (t.median && t.sqm ? t.median / (t.sqm * 10.764) : null)).filter((x) => x);
  const pmax = psfAll.length ? Math.ceil(Math.max.apply(null, psfAll) / 100) * 100 : 5000;
  state.phi = pmax;
  const plo = $("plo"), phi = $("phi");
  [plo, phi].forEach((e) => { e.min = 0; e.max = pmax; e.step = 25; });
  plo.value = 0; phi.value = pmax;
  const pvals = () => { $("vplo").textContent = "AED " + Math.round(state.plo).toLocaleString("en"); $("vphi").textContent = state.phi >= pmax ? "any" : "to AED " + Math.round(state.phi).toLocaleString("en"); };
  plo.oninput = () => { state.plo = Math.min(+plo.value, +phi.value - 25); plo.value = state.plo; pvals(); paint(); };
  phi.oninput = () => { state.phi = Math.max(+phi.value, +plo.value + 25); phi.value = state.phi; pvals(); paint(); };
  pvals();
  // homes on the floor: the register's count for that floor, which is the question nobody else can answer
  const kmax = Math.max.apply(null, floors.map((f) => f.k || 0).concat([1]));
  state.khi = kmax;
  const khi = $("khi");
  khi.min = 1; khi.max = kmax; khi.step = 1; khi.value = kmax;
  const kvals = () => { $("vkhi").textContent = state.khi >= kmax ? "any" : "at most " + state.khi; };
  khi.oninput = () => { state.khi = +khi.value; kvals(); paint(); };
  kvals();
  document.querySelectorAll("[data-d]").forEach((b) => { b.onclick = () => { const k = +b.dataset.d; state.dirs.has(k) ? state.dirs.delete(k) : state.dirs.add(k); b.classList.toggle("off", !state.dirs.has(k)); paint(); }; });
  function hideLabel() { $("hide").textContent = state.on.size || state.use.size ? "Hide All" : "Show All"; }
  $("hide").onclick = () => {
    const none = state.on.size === 0 && state.use.size === 0;
    state.on.clear(); state.use.clear();
    if (none) D.register.forEach((t) => state.on.add(t.c));
    document.querySelectorAll("[data-t]").forEach((b) => b.classList.toggle("off", !state.on.has(b.dataset.t)));
    document.querySelectorAll("[data-u]").forEach((b) => b.classList.toggle("off", !state.use.has(b.dataset.u)));
    hideLabel(); paint();
  };
  $("tab").onclick = () => { const p = $("panel"); p.style.display = p.style.display === "none" ? "" : "none"; };

  // ---- the cards ------------------------------------------------------------------------------------------------------------
  // Who lives here: a ring of regions, click one to drill into its countries, click the middle to come back
  const RING = ["#C5A56A", "#8FC7B9", "#7FA8C9", "#B9A6C9", "#D9A441", "#D98C6A", "#9FB0A8", "#7E8A86", "#6F8A99"];
  function arc(cx, cy, r, a0, a1) {
    const p = (a) => [cx + r * Math.cos((a - 90) * Math.PI / 180), cy + r * Math.sin((a - 90) * Math.PI / 180)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return "M " + x0.toFixed(2) + " " + y0.toFixed(2) + " A " + r + " " + r + " 0 " + (a1 - a0 > 180 ? 1 : 0) + " 1 " + x1.toFixed(2) + " " + y1.toFixed(2);
  }
  // one ring, two uses: slices = [{name, pct, col, sub, on}], centre = [big, small, backLabel]
  function ring(host, slices, centre, back) {
    if (!host) return;
    const total = slices.reduce((t, x) => t + x.pct, 0) || 1;
    let a = 0;
    const R = 62, IR = 40, C = 74;
    const paths = slices.map((x, i) => {
      const span = 360 * x.pct / total, a0 = a, a1 = a + span;
      a = a1;
      return '<path d="' + arc(C, C, (R + IR) / 2, a0, Math.max(a0 + 0.4, a1 - 0.8)) + '" stroke="' + x.col +
        '" stroke-width="' + (R - IR) + '" fill="none" data-s="' + i + '" style="cursor:' + (x.on ? "pointer" : "default") +
        '"><title>' + esc(x.name) + " " + x.pct + (x.sub ? " · " + esc(x.sub) : "") + "</title></path>";
    });
    const mid = '<text x="' + C + '" y="' + (C - 2) + '" text-anchor="middle" style="font:600 14px Fraunces,Georgia,serif;fill:#E8E4D8">' + esc(centre[0]) + "</text>" +
      '<text x="' + C + '" y="' + (C + 11) + '" text-anchor="middle" style="font:500 8px \'IBM Plex Mono\',monospace;fill:#8FA39B">' + esc(centre[1]) + "</text>" +
      (back ? '<text x="' + C + '" y="' + (C + 24) + '" text-anchor="middle" style="font:500 8px \'IBM Plex Mono\',monospace;fill:#C5A56A;cursor:pointer" data-back="1">&#8592; back</text>' : "");
    const legend = slices.map((x, i) => '<div class=row data-s="' + i + '" style="cursor:' + (x.on ? "pointer" : "default") +
      '"><span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;background:' + x.col + '"></i>' +
      esc(x.name) + (x.sub ? "<br><small>" + esc(x.sub) + "</small>" : "") + "</span><span>" + x.label + "</span></div>").join("");
    host.innerHTML = '<svg viewBox="0 0 148 148" style="width:140px;height:140px;display:block;margin:2px auto 6px">' + paths.join("") + mid + "</svg>" + legend;
    host.querySelectorAll("[data-s]").forEach((el) => { const x = slices[+el.dataset.s]; if (x && x.on) el.onclick = () => x.on(); });
    const b = host.querySelector("[data-back]");
    if (b && back) b.onclick = back;
  }

  // Sold so far: the register's units by type, drilling into sold against what is left, and filtering the tower with it
  function drawSold(only) {
    const host = $("sold");
    if (!host || !D.register.length) return;
    const tag = $("soldtag");
    const col = (c) => COL[c] || COL.other;
    if (!only) {
      const left = D.register.reduce((t, r) => t + Math.max(0, (r.launched || 0) - (r.sold || 0)), 0);
      const units = D.register.reduce((t, r) => t + (r.launched || 0), 0);
      if (tag) tag.textContent = fmt(left) + " left";
      ring(host, D.register.filter((r) => r.launched).map((r) => ({
        name: r.type, pct: r.launched, col: col(r.c), label: fmt(r.launched),
        sub: fmt(Math.max(0, r.launched - (r.sold || 0))) + " left of " + fmt(r.launched),
        on: () => { state.on = new Set([r.c]); state.use = new Set();
          document.querySelectorAll("[data-t]").forEach((b) => b.classList.toggle("off", b.dataset.t !== r.c));
          document.querySelectorAll("[data-u]").forEach((b) => b.classList.add("off"));
          hideLabel(); paint(); drawSold(r); },
      })), [fmt(units), "homes registered"], null);
      return;
    }
    const sold = only.sold || 0, all = only.launched || 0, rest = Math.max(0, all - sold);
    if (tag) tag.textContent = fmt(rest) + " left";
    ring(host, [
      { name: "sold", pct: sold || 0.001, col: col(only.c), label: fmt(sold) + " · " + Math.round(100 * sold / (all || 1)) + "%" },
      { name: "still to sell", pct: rest || 0.001, col: "rgba(232,228,216,.16)", label: fmt(rest) },
    ], [fmt(rest), "left of " + fmt(all)], () => { drawSold(null); });
    const note = document.createElement("div");
    note.className = "src";
    note.innerHTML = esc(only.type) + (only.median ? " · settles at " + (only.est ? "~" : "") + aed(only.median) : "") +
      (only.sqm ? " · " + fmt(only.sqm * 10.764) + " sq ft median" : "") +
      (only.yield ? " · " + only.yield + "% yield" : "");
    host.appendChild(note);
  }

  function drawDonut(region) {
    const host = $("donut");
    if (!host || !D.people) return;
    const P = D.people;
    const slices = region
      ? (region.countries || []).map((c, k) => ({ name: c[0], pct: c[1], col: RING[k % RING.length], label: c[1] + "%" }))
          .concat(region.others ? [{ name: "others here", pct: region.others, col: "rgba(232,228,216,.16)", label: region.others + "%" }] : [])
      : P.regions.map((r, k) => ({ name: r.name, pct: r.pct, col: RING[k % RING.length], label: r.pct + "%",
          sub: (r.countries || []).slice(0, 2).map((c) => c[0] + " " + c[1] + "%").join(" · "),
          on: () => drawDonut(r) }));
    ring(host, slices, region ? [region.pct + "%", esc(region.name)] : [String(P.regions.length), "regions"], region ? () => drawDonut(null) : null);
  }

  function open_(html) { const c = $("card"); c.innerHTML = '<span class=x>&times;</span>' + html; c.style.display = "block"; c.scrollTop = 0;
    c.querySelector(".x").onclick = close_; if ($("donut")) drawDonut(null); }
  function close_() { $("card").style.display = "none"; if (state.sel >= 0) { state.sel = -1; paint(); } }
  const label = (f) => (f.n != null ? "Floor " + f.n : ({ G: "Ground floor", M: "Mezzanine", R: "Roof", PH: "Penthouse level" }[f.l] || f.l));
  const USEN = { homes: "homes", villa: "villas", office: "offices", retail: "retail", hotel: "hotel", civic: "civic", services: "services and parking" };
  function floorCard(j) {
    const f = floors[j], ts = (f.t || []).map((i) => D.types[i]).filter(Boolean);
    const msgTxt = encodeURIComponent(D.name + " · " + label(f) + (f.k ? " · " + f.k + " " + (USEN[f.u] || f.u) : "") +
      (ts.length ? " · " + ts.map((t) => t.t).join(", ") : "") + " — from the Dubai registers, on Azimuth");
    open_('<div class=t>' + esc(D.name) + "</div><h2>" + esc(label(f)) + "</h2>" +
      '<span class="pill ' + (isHome(f) ? "a" : "n") + '">' + (f.k ? f.k + " " + (USEN[f.u] || f.u) : USEN[f.u] || f.u) + "</span>" +
      "<dl><dt>Use</dt><dd>" + esc(USEN[f.u] || f.u) + "</dd>" +
      (f.k ? "<dt>Homes on it</dt><dd>" + f.k + "</dd>" : "") +
      (f.a ? "<dt>Area</dt><dd>" + fmt(f.a * 10.764) + " sq ft</dd>" : "") +
      "<dt>Level</dt><dd>" + esc(f.l) + " of " + N + "</dd>" +
      (openOf(j) != null ? "<dt>Sees over the roofs</dt><dd>" + (openDirs(j).length ? openDirs(j).join(" · ") : "no side yet") + "</dd>" : "") + "</dl>" +
      plateSVG(f) +
      (ts.length ? "<h3>The types the register puts on this floor</h3>" + ts.map((t) =>
        '<div class=row><span>' + esc(t.t) + (t.sqm ? "<br><small>" + fmt(t.sqm * 10.764) + " sq ft median</small>" : "") + "</span><span>" +
        (t.aed ? (t.est ? "~" : "") + aedC(t.aed) : "—") + (t.yield ? "<br><small>" + t.yield + "% yield</small>" : "") + "</span></div>").join("") +
        '<div class=src>A type on a floor means the Land Department register places that type within this floor range. It is not a unit position: which flat is where comes from a Revit model or the developer stacking plan, and this building has neither on file.</div>'
        : '<div class=src>No unit type is registered against this floor.</div>') +
      '<div class=acts><a class=w target=_blank href="https://wa.me/?text=' + msgTxt + '">Send by WhatsApp</a>' +
      '<a class=c href="/find?key=' + encodeURIComponent(KEY) + "&q=" + encodeURIComponent(D.name) + '">Look it up in Find</a></div>');
  }
  const aedC = (n) => (n >= 1e6 ? "AED " + (n / 1e6).toFixed(2) + "M" : "AED " + Math.round(n).toLocaleString("en"));
  // the plate: the true outline of the building at its base, from the model's own geometry, with the floor's homes beside it.
  // No internal division is drawn, because none is held - only a Revit model or a developer's deck knows where the walls are.
  let PLATE = null;
  function plateOutline() {
    if (PLATE !== null || !MESH.length) return PLATE;
    const pts = [];
    for (const m of MESH) {
      const g = m.geometry, pos = g.attributes && g.attributes.position;
      if (!pos) continue;
      g.computeBoundingBox();
      const lowY = g.boundingBox.min.y + Math.max(0.5, (g.boundingBox.max.y - g.boundingBox.min.y) * 0.02);
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y <= lowY) pts.push([pos.getX(i), pos.getZ(i)]);
      }
    }
    if (pts.length < 3) { PLATE = false; return PLATE; }
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);                      // monotone chain hull: the plate's outline
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [], upper = [];
    for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    PLATE = lower.slice(0, -1).concat(upper.slice(0, -1));
    return PLATE;
  }
  function plateSVG(f) {
    const hull = plateOutline();
    if (!hull || hull.length < 3) return "";
    const xs = hull.map((p) => p[0]), zs = hull.map((p) => p[1]);
    const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), z0 = Math.min.apply(null, zs), z1 = Math.max.apply(null, zs);
    const w = Math.max(1, x1 - x0), h = Math.max(1, z1 - z0), pad = Math.max(w, h) * 0.12;
    const pts = hull.map((p) => (p[0] - x0 + pad).toFixed(1) + "," + (p[1] - z0 + pad).toFixed(1)).join(" ");
    const homes = f.k ? f.k + (f.k === 1 ? " home" : " homes") : (USEN[f.u] || f.u);
    return "<h3>The floor plate</h3>" +
      '<svg class=plate viewBox="0 0 ' + (w + 2 * pad).toFixed(1) + " " + (h + 2 * pad).toFixed(1) + '">' +
      '<polygon points="' + pts + '" fill="rgba(197,165,106,.14)" stroke="#C5A56A" stroke-width="' + (Math.max(w, h) / 160).toFixed(2) + '"/>' +
      '<text x="' + ((w + 2 * pad) / 2).toFixed(1) + '" y="' + (pad * 0.72).toFixed(1) + '" text-anchor="middle" style="fill:#8FA39B" font-size="' +
      (Math.max(w, h) / 22).toFixed(1) + '">N &#8593;</text></svg>' +
      '<div class=src>' + esc(label(f)) + " · " + esc(homes) + (f.a ? " · " + fmt(f.a * 10.764) + " sq ft on the floor" : "") +
      ". The outline is this building's own footprint, from the survey the model is built on. Where the walls between those homes " +
      "run is not published: that comes from a Revit model or the developer's floor-plan deck, as on The Symphony.</div>";
  }

  function pick(j) { state.sel = state.sel === j ? -1 : j; paint(); if (state.sel >= 0) floorCard(state.sel); else close_(); }

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  ren.domElement.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
  ren.domElement.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) { down = null; return; }
    down = null;
    ptr.x = (e.clientX / innerWidth) * 2 - 1; ptr.y = -(e.clientY / innerHeight) * 2 + 1;
    ray.setFromCamera(ptr, cam);
    const h = ray.intersectObjects(BANDS, false).find((x) => { const u = x.object.userData.bp; return x.point.y >= u.lo - 0.05 && x.point.y <= u.hi + 0.05; });
    if (!h) return;
    const u = h.object.userData.bp;
    pick(Math.max(u.j0, Math.min(u.j1, Math.floor((h.point.y - y0) / fh))));
  });

  $("about").onclick = () => {
    const s = D.sales || {};
    open_('<div class=t>' + esc(D.district) + "</div><h2>" + esc(D.name) + "</h2>" +
      (D.grade ? '<span class="pill n">' + esc(String(D.grade).toLowerCase().replace(/_/g, " ")) + "</span>" : "") +
      (D.project ? "<h3>Construction · the register</h3>" +
        '<div class=row><span>' + esc(D.project.name || "this project") + (D.project.master ? "<br><small>" + esc(D.project.master) + "</small>" : "") +
          "</span><span>" + esc(String(D.project.status || "").toLowerCase() || "—") + "</span></div>" +
        (D.project.pct != null ? '<div class=row><span>Percent complete</span><span>' + D.project.pct + "%</span></div>" +
          '<div class=bar style="margin:2px 0 6px"><i style="width:' + Math.max(0, Math.min(100, D.project.pct)) + '%"></i></div>' : "") +
        (D.project.end ? '<div class=row><span>' + (D.project.pct === 100 ? "Completed" : "Due") + "</span><span>" + esc(D.project.end) + "</span></div>" : "") +
        (D.project.escrow ? '<div class=row><span>Escrow account</span><span dir=auto>' + esc(D.project.escrow) + "</span></div>" : "") +
        (D.project.units ? '<div class=row><span>Units in the project</span><span>' + fmt(D.project.units) +
          (D.project.registered ? " · " + fmt(D.project.registered) + " registered" : "") + "</span></div>" : "") +
        '<div class=src>Dubai Land Department project register, joined by project id, not by name. Percent complete and the escrow agent are the register’s own, not the developer’s marketing.</div>' : "") +
      (D.facts.length ? "<h3>The building</h3>" + D.facts.map((f) => '<div class=row><span><small>' + esc(f[0]) + "</small><br>" + esc(f[1]) + "</span><span></span></div>").join("") : "") +
      "<h3>The stack</h3>" + stackLines().map((l) => '<div class=row><span>' + esc(l[0]) + "</span><span>" + esc(l[1]) + "</span></div>").join("") +
      (s.total ? "<h3>Sold, from the register</h3><div class=row><span>Units sold</span><span>" + fmt(s.total) + "</span></div>" +
        (s.sqm ? '<div class=row><span>Median per sq ft</span><span>AED ' + fmt(s.sqm / 10.764) + "</span></div>" : "") +
        (s.first ? '<div class=row><span>First and last sale</span><span>' + esc(String(s.first).slice(0, 7)) + " – " + esc(String(s.last).slice(0, 7)) + "</span></div>" : "") : "") +
      (D.openFrom ? "<h3>What it sees over</h3>" + D.openFrom.map((fl, k) => '<div class=row><span>' + DIRN[k] + "</span><span>" +
        (fl == null ? "blocked at every floor" : fl === 0 ? "open from the ground" : "open from floor " + (floors[fl] ? floors[fl].l : fl)) + "</span></div>").join("") +
        '<div class=src>Measured against every footprint within ' + D.openRadius + " m in this district's model, on flat ground: it says whether a floor looks over the neighbours on that side, not what is beyond them. Buildings outside this district are not counted.</div>" : "") +
      (D.people ? "<h3>Who lives here · " + esc(D.people.label) + "</h3>" +
        '<div id=donut></div>' +
        (D.people.unknown ? '<div class=src style="margin-top:2px">A further ' + D.people.unknown +
          "% of accounts carry no nationality at all and are not in the ring.</div>" : "") +
        '<div class=src>DEWA customer register for the whole community' + (D.people.accounts ? ", " + fmt(D.people.accounts) + " accounts" : "") +
        ", of the residents whose nationality it holds. There is no building-level figure: a region is shown at any size, a country inside it from " +
        D.people.cfloor + "%, and smaller groups stay pooled so nobody can be identified by subtraction. It is context about an area, not a reason to choose one.</div>" : "") +
      (D.rent ? "<h3>What it lets for</h3>" +
        '<div class=src style="margin:0 0 6px">Ejari registers a letting against the SCHEME, not the tower: these are ' +
        fmt(D.rent.n) + " contracts registered against " + esc(D.rent.scheme) + " since 2024, the scheme this building belongs to." +
        (esc(D.rent.scheme).toLowerCase() !== esc(D.name).toLowerCase() ? " They are not this building's alone." : "") + "</div>" +
        Object.keys(D.rent.by_type).map((t) => { const v = D.rent.by_type[t];
          const price = (D.register.find((x) => String(x.type).toLowerCase().replace(/[^a-z0-9]/g, "") === String(t).toLowerCase().replace(/[^a-z0-9]/g, "")) || {}).median;
          const y = (price && v.aed) ? Math.round(1000 * v.aed / price) / 10 : null;
          return '<div class=row><span>' + esc(t) + "<br><small>" + fmt(v.n) + " contracts" +
            (v.new != null ? " · " + fmt(v.new) + " new, " + fmt(v.renew) + " renewed" : "") + "</small></span><span>" +
            aed(v.aed) + " a year" + (y ? "<br><small>" + y + "% on the register price</small>" : "") + "</span></div>"; }).join("") +
        '<div class=src>A contract is a letting newly registered or renewed, not a measure of how much of the building is occupied. ' +
        "Where a yield is shown it is the scheme's rent against this building's register price, worked out here, not quoted.</div>" : "") +
      (D.schools && D.schools.length ? "<h3>Schools · " + esc(D.district) + "</h3>" +
        D.schools.map((x) => '<div class=row><span>' + esc(x.name) + "<br><small>" + esc([x.curriculum, x.rating].filter(Boolean).join(" · ")) +
          "</small></span><span>" + (x.km != null ? x.km + " km" : "") + "</span></div>").join("") +
        '<div class=src>' + D.schoolsAll + " KHDA schools and " + fmt(D.healthN) + " DHA health facilities within " + D.amenKm +
        " km of the district centre, nearest first. Measured from the centre of " + esc(D.district) + ", not from this building's door.</div>" : "") +
      (D.plans ? "<h3>The plans · " + esc(D.plans.project) + "</h3>" +
        '<div class=plans>' + D.plans.plans.map((p) => '<a href="' + esc(p.url) + '" target=_blank rel=noopener><img loading=lazy src="' +
          esc(p.url) + '" alt="' + esc(p.label) + '"><b>' + esc(p.label) + "</b></a>").join("") + "</div>" +
        '<div class=src>' + (D.plans.note ? esc(D.plans.note) + ". " : "") +
        "Developer material from the app's plan library, shown to the broker who sells it; each plan names its source on the PLANS page.</div>" : "") +
      (D.around.length ? "<h3>Around it</h3>" + D.around.map((a) => '<div class=row><span>' + esc(a[0]) + "</span><span>" + esc(a[1]) + "</span></div>").join("") : "") +
      '<div class=src>' + esc(D.asOf) + ". Floors divide the model's surveyed height evenly; a double-height lobby is not drawn as one." +
      (D.levelShift ? " The register numbers levels " + D.levelShift + " higher than the permit here, so its ranges are shifted to match." : "") + "</div>");
  };
  function stackLines() {
    const out = [], seen = [];
    floors.forEach((f, j) => { const p = seen[seen.length - 1]; if (p && p.u === f.u && p.j1 === j - 1) { p.j1 = j; } else seen.push({ u: f.u, j0: j, j1: j }); });
    for (const q of seen) {
      const a = floors[q.j0], b = floors[q.j1];
      out.push([USEN[q.u] || q.u, q.j0 === q.j1 ? a.l : a.l + "–" + b.l]);
    }
    if (D.basements) out.unshift(["basements (not drawn)", String(D.basements)]);
    return out.reverse();
  }
  $("foot").innerHTML = esc(D.name) + " · " + esc(D.district) + " — " + N + " levels" + (D.basements ? " above " + D.basements + " basement" + (D.basements > 1 ? "s" : "") : "") +
    ", from the Dubai Municipality floor register and the Land Department units register. Model: CityEngine massing over ArcGIS footprints, cut into floors — not a survey of the building.";
  hideLabel(); count(); drawSold(null);
}
