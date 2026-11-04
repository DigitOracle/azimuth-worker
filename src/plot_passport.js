// PLOT PASSPORT (Najma, More -> PLOT PASSPORT), 2 Nov 2026. Approved to build by Dr. Kendall Wilson; not deployed.
// "One plot. Every connected record. Every claim traceable."
// Click 1: search (parcel number, municipality plot number, area/land number, Najma plot id, project or building name) with suggestions.
// Click 2: the passport - a plain-words summary card, then four tabs (one tap each): Flats for sale/rent (current adverts with the agent, brokerage,
//          agent phone and broker card) | Prices (median rent and purchase per year, 1-3 bed, for the plot's building or project) | Buildings | Timeline.
//          Default tab = Flats when any advert is current, else Buildings. Strength is a small dot per fact. Simplified 2 Nov 2026 (Dr. Kendall Wilson:
//          "too much information ... we do not need the sources"): no Sources card, no source drill-down, no 'Everything we hold' toggle.
// Click 3: Research report (print / save as PDF), matching the page.
// DATA: KV keys pushed by naj-market-pulse/scripts/build_plot_passport.py (read MotherDuck lk_plot_master, lk_plot_xwalk, najma_plot_coverage, DLD
//       buildings, DM permits and projects): pp_meta, pp_s_<2 chars> (search shards), pp_b_<crc32(id) % buckets> (passports).
// RULES: project-level links are never shown as plot facts and never summed; no DEWA data; no Google content; research use only.
// Page script is String.raw with no substitutions and no backticks.

import { LTF_JS } from "./landtype_filters.js";   // v731 - DLD use / land type / tenure filters on the district/building picker
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

// the strength vocabulary lives in the page script (ST): the page shows it as one small dot per fact
const ICONS = {   // simple line icons (24 grid, stroke) - icons, never emoji
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', land: '<path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z"/><path d="M9 4v13M15 7v13"/>',
  crane: '<path d="M4 21V5h12M4 5l4-2v2M16 5v4M14 9h4v3h-4zM2 21h8"/>', permit: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  bldg: '<path d="M4 21V7l8-4v18M12 9l8 3v9M2 21h20M7 10h2M7 14h2M15 14h2M15 18h2"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><path d="M7 14h10v7H7z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', pin: '<path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>', phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>', tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
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
.tl{position:relative;margin:0;padding:0 0 0 18px;list-style:none}.tl:before{content:"";position:absolute;left:5px;top:4px;bottom:4px;width:2px;background:var(--line)}
.tl li{position:relative;margin:0 0 10px}.tl li:before{content:"";position:absolute;left:-17px;top:6px;width:10px;height:10px;border-radius:50%;background:var(--card);border:2px solid var(--gold)}
.tl .dt{font-family:"IBM Plex Mono",monospace;font-size:.72rem;color:var(--muted)}.tl .wt{font-size:.88rem}
.tl .yh{font-family:"IBM Plex Mono",monospace;font-size:.8rem;color:var(--gold);margin:12px 0 6px -18px}.tl .yh:before{display:none}
.st{margin:12px 0 2px}.st h2{margin-bottom:6px}.st .bar{height:8px;border-radius:4px;background:var(--line);overflow:hidden;margin:4px 0 2px}.st .bar i{display:block;height:100%;background:var(--gold)}.st .pl{font-size:.74rem;color:var(--muted)}
.ms{display:flex;overflow-x:auto;padding:8px 0 4px;margin:8px 0 0;list-style:none;scroll-snap-type:x mandatory}.ms li{flex:0 0 auto;width:118px;position:relative;padding:20px 10px 0 0;scroll-snap-align:start}
.ms li:before{content:"";position:absolute;top:5px;left:0;right:0;height:2px;background:var(--line)}.ms li:after{content:"";position:absolute;top:0;left:0;width:12px;height:12px;border-radius:50%;background:var(--card);border:2px solid var(--gold)}
.ms li.pl:after{border-style:dashed;border-color:var(--muted)}.ms .y{font-family:"IBM Plex Mono",monospace;font-size:.7rem;color:var(--gold)}.ms .l{font-size:.8rem;line-height:1.25;margin-top:2px}
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
.ltw{margin-top:10px}.ltt{font-size:.7rem;letter-spacing:.08em;color:var(--gold);text-transform:uppercase;margin:0 0 4px}.ltn{margin:4px 0 6px;color:var(--muted);font-size:.74rem}.ltg{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ltc{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0;min-height:52px;text-align:left;padding:8px 10px;border:1px solid var(--line);border-radius:12px;background:var(--raise);color:var(--ink);font:inherit;cursor:pointer}.ltc b{font-size:.84rem;overflow-wrap:anywhere}.ltc span{font-size:.7rem;color:var(--muted)}.ltc.on{background:var(--gold);border-color:var(--gold);color:#0C1413}.ltc.on span{color:#0C1413}.ltx{border:0;background:none;color:var(--gold);text-decoration:underline;font:inherit;cursor:pointer}.ltd summary{cursor:pointer;color:var(--muted);font-size:.8rem;margin:6px 0}
.tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:0 0 10px;padding:4px;background:var(--card);border:1px solid var(--line);border-radius:12px}
.tabs button{min-height:48px;padding:4px 6px;border:0;border-radius:9px;background:transparent;color:var(--muted);font:inherit;font-size:.78rem;font-weight:600;line-height:1.2;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
.tabs button[aria-selected=true]{background:var(--raise);color:var(--ink);box-shadow:inset 0 -2px 0 var(--gold)}.tabs .n{font-family:"IBM Plex Mono",monospace;font-size:.68rem;color:var(--gold)}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--d);vertical-align:middle;margin-left:4px;flex:none}.dot.m{background:transparent;border:1.5px solid var(--m)}.dot.p{border-radius:1px;background:var(--p)}
.flagl{display:flex;gap:6px;align-items:center;font-size:.8rem;color:var(--muted);margin:10px 0 0}.flagl .ic{color:var(--flag);width:15px;height:15px}.flagl a{color:var(--flag)}
.cnt{margin:0 0 10px;font-size:.95rem}.cnt small{display:block;color:var(--muted);font-size:.76rem;margin-top:2px}
.bh{display:flex;align-items:center;gap:6px;font-size:.84rem;font-weight:600;margin:12px 0 8px;color:var(--soft)}.bh .ic{color:var(--gold);width:16px;height:16px}.bh .n{margin-left:auto;color:var(--muted);font-weight:400;font-size:.74rem}
.fc{display:grid;grid-template-columns:1fr;gap:8px}@media(min-width:620px){.fc{grid-template-columns:1fr 1fr}}
.lc{background:var(--raise);border-radius:11px;padding:11px;min-width:0}.lc[hidden]{display:none}.ft{display:flex;justify-content:space-between;align-items:center;gap:8px}.ft b{font-size:.92rem;overflow-wrap:anywhere}
.tag{font-size:.68rem;font-weight:600;padding:2px 8px;border-radius:10px;white-space:nowrap}.tag.s{background:rgba(197,165,106,.18);color:var(--gold)}.tag.r{background:rgba(62,138,126,.2);color:var(--d)}
.pr{font-family:Fraunces,Georgia,serif;font-size:1.25rem;font-weight:600;margin:4px 0 2px}.pr small{font-family:"IBM Plex Sans",system-ui,sans-serif;font-size:.74rem;color:var(--muted);font-weight:400}
.lc .m{color:var(--muted);font-size:.76rem}
.ag{display:flex;gap:8px;align-items:flex-start;margin-top:8px;padding-top:8px;border-top:1px solid var(--line)}.ag>.ic{color:var(--gold);margin-top:2px}.ag b{display:block;font-size:.86rem}.ag small{display:block;color:var(--muted);font-size:.74rem;overflow-wrap:anywhere}
.btn.tel{margin-top:6px;min-height:40px;font-size:.84rem}
.kv{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}.kv span{font-size:.86rem;font-weight:600;overflow-wrap:anywhere}.kv small{display:block;color:var(--muted);font-size:.68rem;font-weight:400}
.chart{width:100%;height:auto;display:block;margin:0 0 4px}.chart .ax{stroke:var(--line)}.chart .vl{font-size:9.5px;fill:var(--ink);font-weight:600}.chart .dn{font-size:8.5px;fill:var(--muted)}.chart .dd{font-style:italic}.chart .yr{font-size:11px;fill:var(--soft)}.chart .nd{font-size:8px;fill:var(--muted)}
.b1{fill:var(--teal);background:var(--teal)}.b2{fill:var(--gold);background:var(--gold)}.b3{fill:var(--flag);background:var(--flag)}.dis{opacity:.35}
.lg{display:flex;flex-wrap:wrap;gap:12px;font-size:.76rem;color:var(--soft);margin:0 0 4px}.lg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
.crumb{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:0 0 10px;font-size:.82rem;color:var(--muted)}
.crumb button{min-height:36px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--gold);font:inherit;font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.crumb span[aria-current]{color:var(--ink);font-weight:600;padding:0 4px}
`;

const PP_JS = String.raw`(function(){
var KEY=document.body.getAttribute("data-key")||"",RK=document.body.getAttribute("data-rk")||"";
var ST={"d":["Direct match","The record carries this plot's own number (parcel, land or building number), so it is about this plot."],"m":["Map-based estimate","Linked by location (it sits inside this plot's outline) or by a plot number written in text. A best match, not a certainty."],"p":["Project-level only","The record belongs to a project that sits on this plot and on others. It is not a fact about this plot alone."]};
var $=function(i){return document.getElementById(i)};
var q=$("ppq"),sug=$("ppsug"),hint=$("pphint"),out=$("ppout"),clr=$("ppclr");
var CUR=null,T=null,SEQ=0;
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function ic(n){var t=document.getElementById("ic-"+n);return t?t.innerHTML:""}
function kq(){return "key="+encodeURIComponent(KEY)+(RK?"&rk="+encodeURIComponent(RK):"")}
function num(v){if(v==null||v==="")return null;var n=Number(v);return isFinite(n)?n.toLocaleString("en-US"):String(v)}
function dt(s){if(!s)return "";var d=new Date(s+"T00:00:00Z");return isNaN(d)?s:d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})}
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

function money(v){if(v==null||v==="")return "";v=Number(v);if(!isFinite(v))return "";return v>=1e6?"AED "+(Math.round(v/1e5)/10)+"m":v>=1e3?"AED "+Math.round(v/1e3)+"k":"AED "+Math.round(v)}
function short(v){return money(v).replace("AED ","")}
function dot(s){return s&&ST[s]?'<span class="dot '+s+'" role=img title="'+esc(ST[s][0])+'" aria-label="'+esc(ST[s][0])+'"></span>':""}
var TAB=null,TABFOR=null;
function flatsPanel(p){var F=p.flats||{items:[]},it=F.items||[];
  if(!it.length)return '<p class=empty>No flats advertised on this plot right now'+(F.checked?' (checked '+esc(dt(F.checked))+')':'')+'.</p>';
  var ns=it.filter(function(x){return x.mode==="sale"}).length,nr=it.length-ns;
  var h='<p class=cnt><b>'+(F.total||it.length)+' flat'+((F.total||it.length)>1?'s':'')+' advertised</b>: '+[F.sale!=null?F.sale+' for sale':(ns?ns+' for sale':''),F.rent!=null?F.rent+' to rent':(nr?nr+' to rent':'')].filter(function(v){return v&&v.indexOf("0 ")!==0}).join(', ')+'.<small>Adverts seen on '+esc(dt(F.checked))+((F.total||0)>it.length?'; showing the newest '+it.length:'')+'.</small></p>';
  var g={},order=[];it.forEach(function(x){var k=x.b||"This plot";if(!g[k]){g[k]=[];order.push(k)}g[k].push(x)});
  order.forEach(function(k){h+='<h3 class=bh>'+ic("bldg")+esc(k)+'<span class=n>'+g[k].length+'</span></h3><div class=fc>';
    g[k].forEach(function(x,i){var bd=x.beds==null?"":(x.beds===0?"Studio":x.beds+" bed");
      h+='<div class=lc'+(i>=6?' data-x hidden':'')+'><div class=ft><b>'+esc([bd,x.sqft?num(Math.round(x.sqft))+" sq ft":""].filter(Boolean).join(" · ")||"Flat")+'</b><span class="tag '+(x.mode==="sale"?"s":"r")+'">'+(x.mode==="sale"?"For sale":"To rent")+'</span></div>'
       +'<div class=pr>'+esc(money(x.price))+(x.mode==="rent"?'<small> a year</small>':'')+'</div>'
       +'<div class=m>'+esc([x.date?"Listed "+dt(x.date):"",x.portal].filter(Boolean).join(" · "))+'</div>'
       +'<div class=ag>'+ic("user")+'<div><b>'+esc(x.agent||"Agent not named")+'</b><small>'+esc(x.firm||"")+(x.card?' · Land Department broker card '+esc(x.card):'')+'</small>'
       +(x.phone?'<a class="btn tel" href="tel:'+esc(String(x.phone).replace(/[^+0-9]/g,""))+'">'+ic("phone")+esc(x.phone)+'</a>':'<small>No agent phone on the advert</small>')+'</div></div></div>'});
    h+='</div>'+(g[k].length>6?'<button type=button class="btn more" data-more>Show all '+g[k].length+'</button>':'')});
  return h+'<p class=note>Phone numbers are the agent&rsquo;s own line from the advert, not the portal&rsquo;s shared WhatsApp line. Adverts show asking prices, not what is paid.</p>'}
var BEDC=["b1","b2","b3"];
function chart(P,kind){var Y=P.years,S=P[kind]||{},W=340,H=190,top=22,base=150,gw=(W-20)/Y.length,bw=Math.min(26,(gw-18)/3),mx=0;
  Y.forEach(function(y){[1,2,3].forEach(function(b){var c=(S[y]||{})[b];if(c&&c[0]>mx)mx=c[0]})});
  if(!mx)return '<p class=empty>No registered '+(kind==="rent"?"rent contracts":"sales")+' for 1, 2 or 3 bed flats here or in the district in these years.</p>';
  var s='<svg class=chart viewBox="0 0 '+W+' '+H+'" role=img aria-label="'+(kind==="rent"?"Median annual rent":"Median purchase price")+' by year and bedrooms"><line x1=10 x2='+(W-10)+' y1='+base+' y2='+base+' class=ax />';
  Y.forEach(function(y,yi){var x0=10+yi*gw+(gw-3*bw-8)/2;
    [1,2,3].forEach(function(b,bi){var c=(S[y]||{})[b],x=x0+bi*(bw+4);
      if(!c){s+='<text x="'+(x+bw/2)+'" y="'+(base-4)+'" class=nd text-anchor=middle>none</text><text x="'+(x+bw/2)+'" y="'+(base+12)+'" class=dn text-anchor=middle>0</text>';return}
      var hh=Math.max(2,(base-top)*c[0]/mx),dc=c[2]==="d";
      s+='<rect x="'+x+'" y="'+(base-hh)+'" width="'+bw+'" height="'+hh+'" rx=2 class="'+BEDC[bi]+(dc?' dis':'')+'"><title>'+b+' bed '+y+': '+money(c[0])+', '+c[1]+' deal'+(c[1]>1?'s':'')+(dc?' (district median)':'')+'</title></rect>'
       +'<text x="'+(x+bw/2)+'" y="'+(base-hh-4)+'" class=vl text-anchor=middle>'+short(c[0])+'</text>'
       +'<text x="'+(x+bw/2)+'" y="'+(base+12)+'" class="dn'+(dc?' dd':'')+'" text-anchor=middle>'+(dc?'d ':'')+c[1]+'</text>'});
    s+='<text x="'+(10+yi*gw+gw/2)+'" y="'+(base+30)+'" class=yr text-anchor=middle>'+esc(y)+(y===P.ytd?' to date':'')+'</text>'});
  return s+'</svg>'}
function pricesPanel(p){var P=p.prices;if(!P)return '<p class=empty>No registered sales or rent contracts are tied to a building or project on this plot.</p>';
  var who=P.scope==="building"?"This building":"This project",dis=false;["rent","sale"].forEach(function(k){P.years.forEach(function(y){[1,2,3].forEach(function(b){var c=((P[k]||{})[y]||{})[b];if(c&&c[2]==="d")dis=true})})});
  var leg='<div class=lg><span><i class=b1></i>1 bed</span><span><i class=b2></i>2 bed</span><span><i class=b3></i>3 bed</span>'+(dis?'<span><i class="b2 dis"></i>district (d)</span>':'')+'</div>';
  return '<p class=cnt><b>'+esc(who)+': '+esc(P.name||"")+'</b><small>Registered deals for the '+(P.scope==="building"?"building":"whole project")+', not for this plot alone. Median per year; the small number under each bar is how many deals it rests on'+(dis?'. Where it had no deal that year, the lighter bar marked d is the district median':'')+'.</small></p>'
   +leg+'<h3 class=bh>'+ic("key")+'Annual rent (new contracts)</h3>'+chart(P,"rent")+'<h3 class=bh>'+ic("tag")+'Purchase price</h3>'+chart(P,"sale")
   +'<p class=note>Rent: new Ejari contracts for flats, renewals left out. Purchase: Land Department registered sales of flats, at the registered price. Deals to '+esc(dt(P.to))+'.</p>'}
// v696 (Kendall, 3 Nov 2026): the building's life as milestones, oldest first, from the timeline the builder already writes.
var MS=[[/PLANNED completion/i,"Completion planned",1],[/start date/i,"Construction start",0],[/first sale registered[^]*off-plan/i,"First off-plan sale",0],[/first sale of a ready/i,"First ready-home sale",0],[/first sale registered/i,"First sale",0],[/first rent contract/i,"First tenancy",0],[/Buildings entered/i,"Buildings registered",0],[/recorded as complete|completion date recorded|completed on/i,"Completed",0]];
function today(){return new Date().toISOString().slice(0,10)}
function life(p){var L={ev:[]};(p.timeline||[]).forEach(function(x){var w=x.what||"",m=w.match(/construction (\d+)% complete/i);
    if(m){if(!L.pctAt||x.date>L.pctAt){L.pct=+m[1];L.pctAt=x.date}L.ev.push({d:x.date,l:m[1]+"% built",pl:0});return}
    for(var i=0;i<MS.length;i++){if(MS[i][0].test(w)){L.ev.push({d:x.date,l:MS[i][1],pl:MS[i][2]});if(MS[i][2])L.planned=x.date;else if(MS[i][1]==="Completed")L.done=x.date;return}}
    L.ev.push({d:x.date,l:w.replace(/^The [^:]+ project: /,"").replace(/ \(.*$/,""),pl:0})});
  L.ev.sort(function(a,b){return a.d<b.d?-1:a.d>b.d?1:0});
  L.late=!!(L.planned&&L.planned<today()&&!L.done);L.ev.forEach(function(e){if(e.pl&&L.late)e.l="Completion was planned"});
  L.ev.forEach(function(e){if(!L.ready&&/First tenancy|First ready-home sale/.test(e.l))L.ready=e.d});   // people living there or buying it ready outranks an older progress reading
  if(L.ready&&L.pctAt&&L.ready<L.pctAt)L.ready=null;
  if(L.ready)L.late=false;
  L.status=L.done||L.pct>=100?"Complete":L.ready?"Handed over (homes rented or sold ready from "+dt(L.ready)+")":(L.pct!=null?"Under construction, "+L.pct+"% ("+dt(L.pctAt)+")":null);return L}
function story(p){var L=life(p);if(!L.ev.length)return "";
  var h='<div class=st><h2>'+ic("bldg")+'Building story</h2>';
  if(L.ready)h+='<div class=pl>'+esc("Handed over: homes rented or sold ready from "+dt(L.ready)+(L.pct!=null&&L.pct<100?" (the last progress reading, "+L.pct+"% on "+dt(L.pctAt)+", is older)":""))+'</div>';
  else if(L.pct!=null&&!L.done&&L.pct<100)h+='<div class=bar role=img aria-label="'+L.pct+' percent built"><i style="width:'+Math.max(2,Math.min(100,L.pct))+'%"></i></div><div class=pl>'+esc(L.pct+"% built as of "+dt(L.pctAt)+(L.planned?" · completion "+(L.late?"was planned for ":"planned for ")+dt(L.planned):""))+'</div>';
  return h+'<ol class=ms>'+L.ev.map(function(e){return '<li'+(e.pl?' class=pl':'')+'><div class=y>'+esc(dt(e.d))+'</div><div class=l>'+esc(e.l)+'</div></li>'}).join("")+'</ol></div>'}
function bldgPanel(p){var pr=p.projects||[],one=pr.length===1?pr[0]:null,L=life(p),many=p.buildings.length>1;
  var bs=p.buildings.slice().sort(function(a,b){return (+a.no||0)-(+b.no||0)});
  var h=bs.length?'<div class=fc>'+bs.map(function(x,i){var u=[x.flats?num(x.flats)+" flats":"flats not in the register",x.shops?num(x.shops)+" shops":"",x.offices?num(x.offices)+" offices":""].filter(Boolean).join(", ");
    var done=(one&&one.done)||L.done||(L.ready?"handed over by "+dt(L.ready):""),due=(one&&one.due)||L.planned,st=(one&&one.status)||L.status;
    return '<div class=lc'+(i>=6?' data-x hidden':'')+'><div class=ft><b>'+esc((x.name||"Building")+(x.no&&(many||!x.name)?" · Building "+x.no:""))+'</b>'+dot(x.s)+'</div><div class=kv>'
     +(x.floors?'<span><small>Floors</small>'+esc(x.floors)+'</span>':'')+'<span><small>Units</small>'+esc(u)+'</span>'
     +'<span><small>Completion</small>'+esc(done?(/^\d{4}-/.test(done)?dt(done):done):(due?(due<today()?"was planned for ":"planned for ")+dt(due):"not recorded"))+'</span>'
     +'<span><small>Status</small>'+esc(st||"Registered, no progress on record")+'</span>'
     +(x.date?'<span><small>In the register since</small>'+esc(dt(x.date))+'</span>':'')+'</div></div>'}).join("")+'</div>'+(bs.length>6?'<button type=button class="btn more" data-more>Show all '+bs.length+'</button>':''):'<p class=empty>No registered building is linked to this plot.</p>';
  if(pr.length>1)h+='<p class=note>'+pr.length+' construction projects on record; their dates are in the Timeline.</p>';
  return h}
function tlPanel(p){var t=(p.timeline||[]).slice().sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0});if(!t.length)return '<p class=empty>No dated events on record.</p>';   // v696 - oldest first, one heading per year
  var y0="",h='<ol class=tl>';t.forEach(function(x){var y=String(x.date||"").slice(0,4);if(y!==y0){h+='<li class=yh aria-hidden=true>'+esc(y)+'</li>';y0=y}h+='<li><div class=dt>'+esc(dt(x.date))+'</div><div class=wt>'+esc(x.what)+' '+dot(x.s)+'</div></li>'});return h+'</ol>'}
function render(){var p=CUR;if(!p)return;var ttl="Plot "+(p.parcel||p.plot_no||p.id.replace("naj:plot:",""));document.title=ttl+" — Plot passport";
  if(TABFOR!==p.id){TABFOR=p.id;TAB=(p.flats&&p.flats.items&&p.flats.items.length)?"flats":"bldg"}
  var dn=CTX.d?CTX.d.name:(p.area_name||"District"),gn=CTX.g?CTX.g.name:null;
  var h='<nav class=crumb id=pp-crumb aria-label="Where this plot sits"><button type=button data-crumb=d>'+esc(dn)+'</button><span aria-hidden=true>›</span>'+(gn?'<button type=button data-crumb=g>'+esc(gn)+'</button><span aria-hidden=true>›</span>':'')+'<span aria-current=page>'+esc(ttl)+'</span></nav>';
  h+='<section class="card sum" id=pp-sum><p class=t>'+esc(ttl)+'</p><div class=w>'+esc([p.area_name,p.master||p.project].filter(function(v,i,a){return v&&a.indexOf(v)===i}).join(" · "))+'</div><p>'+esc(sentence(p))+'</p>'+story(p)
   +'<div class=acts><a class="btn pri" target=_blank rel=noopener href="/plot_passport/report?'+kq()+'&id='+encodeURIComponent(p.id)+'">'+ic("print")+'Research report</a><button type=button class=btn id=ppcopy>'+ic("copy")+'Copy link</button></div>'
   +(p.flags&&p.flags.length?'<p class=flagl>'+ic("flag")+'<span>'+(p.flags.length===1?"1 research flag on this plot":p.flags.length+" research flags on this plot")+' — <a href="/data_checks?'+kq()+'">see Data checks</a></span></p>':'')+'</section>';
  var nf=(p.flats&&p.flats.items)?(p.flats.total||p.flats.items.length):0;
  var T=[["flats","Flats for sale/rent",nf],["prices","Prices",null],["bldg","Buildings",p.buildings.length],["tl","Timeline",p.timeline.length]];
  h+='<div class=tabs role=tablist aria-label="Plot passport">'+T.map(function(t){return '<button type=button role=tab id="pptab-'+t[0]+'" data-tab="'+t[0]+'" aria-selected='+(TAB===t[0])+' aria-controls=pppanel>'+esc(t[1])+(t[2]!=null?'<span class=n>'+t[2]+'</span>':'')+'</button>'}).join("")+'</div>';
  h+='<section class=card id=pppanel role=tabpanel aria-labelledby="pptab-'+TAB+'">'+(TAB==="flats"?flatsPanel(p):TAB==="prices"?pricesPanel(p):TAB==="bldg"?bldgPanel(p):tlPanel(p))+'</section>';
  h+='<p class=note><span class="dot d"></span> direct match &nbsp;<span class="dot m"></span> map-based estimate. Research use only; nothing here is a legal title or a valuation.</p>';
  out.innerHTML=h}

document.addEventListener("click",function(e){var t=e.target.closest("button,a");if(!t)return;
  if(t.classList.contains("sg")){open(t.getAttribute("data-id"));return}
  if(t.hasAttribute("data-tab")){TAB=t.getAttribute("data-tab");render();var tb=document.getElementById("pptab-"+TAB);if(tb&&tb.focus)try{tb.focus({preventScroll:true})}catch(er){}return}
  if(t.hasAttribute("data-more")){var c=t.parentNode;[].forEach.call(c.querySelectorAll(".lc[data-x],li[data-x]"),function(n){n.hidden=false});t.remove();return}
  if(t.id==="ppcopy"){try{navigator.clipboard.writeText(location.href);t.lastChild.textContent="Link copied"}catch(err){}return}
  if(t.hasAttribute("data-opt")){var o=SH[+t.getAttribute("data-opt")];if(o)o.fn();return}
  if(t.id==="ppshx"){closeSheet();return}
  if(t.id==="ppb1"){districts();return}
  if(t.id==="ppb2"){groups();return}
  if(t.hasAttribute("data-crumb")){if(t.getAttribute("data-crumb")==="g"&&CTX.g){DC=CTX.d;pickG(CTX.g);return}
    var sl=(CTX.d&&CTX.d.slug)||(CUR&&CUR.district);if(sl)pickD(sl);else districts();return}
  if(t.id==="ppclr"){q.value="";search();q.focus();return}});
var sh=$("ppsheet"),scr=$("ppscrim"),shq=$("ppshq"),shl=$("ppshl"),SH=[],SHBACK=null,DL=null,DC=null,DCACHE={};
// v731 DLD filters: counts follow the chosen district (or all districts); they narrow the district list, then buildings and plots
var LF={u:"",l:"",f:""},lfe=$("ppltf"),LT=typeof ltfDraw==="function",lOn=LT?ltfOn:function(){return false},lN=LT?ltfN:function(){return 0},lM=LT?ltfM:function(){return true},lDraw=LT?ltfDraw:function(){};function lsel(){return DC?[DC]:(DL||[])}function ldraw(){lDraw(lfe,lsel(),LF,ldraw,{g:"ltg",c:"ltc",on:"on",t:"Use (DLD)"})}function dN(d){return lOn(LF)?lN([d],LF):d.n}
function nq(s){return String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function hit(o,f){return !f||o.sticky||(" "+nq(o.t)).indexOf(" "+f)>=0||nq(o.t).indexOf(f)>=0}
function drawSheet(){var f=nq(shq.value),n=0,m=0,h="";SH.forEach(function(o,i){if(!hit(o,f))return;if(!o.sticky)m++;if(n>=150)return;n++;h+='<button type=button class="opt'+(o.sticky?" sp":"")+'" data-opt="'+i+'">'+ic(o.i||"pin")+'<span><b>'+esc(o.t)+'</b>'+(o.s?'<small>'+esc(o.s)+'</small>':'')+'</span></button>'});
  shl.innerHTML=h+(m>150?'<p class=empty>'+m+' match. Type more letters to narrow the list.</p>':'')+(!n?'<p class=empty>Nothing matches “'+esc(shq.value)+'” here.</p>':'')}
function openSheet(title,items,ph,back){SH=items;SHBACK=back||document.activeElement;$("ppsht").textContent=title;shq.value="";shq.placeholder=ph||"Type the first few letters";shq.setAttribute("aria-label",ph||"Filter this list");drawSheet();sh.hidden=false;scr.hidden=false;try{shq.focus({preventScroll:true})}catch(e){}}
function closeSheet(){if(sh.hidden)return;sh.hidden=true;scr.hidden=true;if(SHBACK&&SHBACK.focus)try{SHBACK.focus({preventScroll:true})}catch(e){}}
function getJ(u){return fetch(u).then(function(r){return r.json()})}
function districts(){if(DL){openSheet("Choose a district",DL.filter(function(d){return !lOn(LF)||dN(d)>0}).map(function(d){return {t:d.name,s:num(dN(d))+" plots"+(lOn(LF)?" match the filters":""),i:"pin",fn:function(){pickD(d.slug)}}}),"Type a district, e.g. Business Bay",$("ppb1"));return}
  getJ("/plot_passport/districts?"+kq()).then(function(j){DL=j.districts||[];if(!DL.length){say("The district list has not been loaded yet.");return}districts()}).catch(function(){say("The district list is not reachable just now.")})}
function pickD(slug){var go=function(d){DC=d;ldraw();$("ppb1v").textContent=d.name;$("ppb2").disabled=false;$("ppb2v").textContent="Choose a building or project";groups()};
  if(DCACHE[slug])return go(DCACHE[slug]);getJ("/plot_passport/d?"+kq()+"&slug="+encodeURIComponent(slug)).then(function(j){if(!j.ok){say(j.error||"That district is not loaded yet.");return}DCACHE[slug]=j.district;go(j.district)}).catch(function(){say("That district is not reachable just now.")})}
function kindW(k){return k==="b"?"building":k==="p"?"project":k==="m"?"master community":"buildings"}
function groups(){if(!DC)return districts();var it=[],vac=(DC.vacant||[]).filter(function(x){return lM(x[2],LF)});if(vac.length)it.push({t:"Plots without a building",s:num(vac.length)+" plots of vacant or unbuilt land",i:"land",sticky:true,fn:function(){pickG({name:"Plots without a building",plots:vac})}});
  DC.groups.forEach(function(g){var ps=g[2].filter(function(x){return lM(x[2],LF)});if(!ps.length)return;it.push({t:g[0],s:kindW(g[1])+" · "+(ps.length===1?"1 plot":ps.length+" plots"),i:g[1]==="m"?"land":g[1]==="p"?"crane":"bldg",fn:function(){pickG({name:g[0],plots:ps})}})});
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
getJ("/plot_passport/districts?"+kq()).then(function(j){if(!DL)DL=j.districts||[];ldraw()}).catch(function(){});   // v731 - chips appear only once the packs carry DLD codes
var st0=new URLSearchParams(location.search).get("id");if(st0)open(st0,false);
})();`;

export function plotPassportHtml(key, rk, meta, deps) {
  const icTpl = Object.keys(ICONS).map((n) => '<template id="ic-' + n + '">' + ic(n) + "</template>").join("");
  const fresh = meta && meta.as_of ? "Register snapshot " + escH(meta.as_of) + " · " + Number(meta.plots || 0).toLocaleString("en-US") + " plots" + (meta.pilot ? " (pilot set)" : "") : "The plot data has not been loaded yet.";
  return '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<title>Plot passport — Najma</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">' + (deps.NAJ_FONTS || "")
    + '<script>try{var t=localStorage.getItem("naj_thm")||((window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark");document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>'
    + "<style>" + PP_CSS + (deps.NAJ_NAV_CSS || "") + "html[data-theme=light] .nnav{background:rgba(242,238,227,.95);border-top-color:#DDD5C2}</style></head>"
    + '<body data-key="' + escH(key) + '" data-rk="' + escH(rk || "") + '">' + icTpl
    + '<h1>Plot <em>passport</em></h1><p class=sub>One plot: flats on the market and who is selling them, prices, buildings and dates.</p>'
    + '<section class="card browse" aria-label="Find a plot by place"><h2>' + ic("pin") + 'Find it by place</h2><div class=steps>'
    + '<button type=button class=step id=ppb1 aria-haspopup=dialog><span class=sn>1</span><span><small>DISTRICT</small><b id=ppb1v>Choose a district</b></span></button>'
    + '<button type=button class=step id=ppb2 aria-haspopup=dialog disabled><span class=sn>2</span><span><small>BUILDING OR PROJECT</small><b id=ppb2v>Choose a district first</b></span></button>'
    + '</div><div id=ppltf class=ltw hidden></div><p class=empty style="margin-top:8px">Pick the district, then the building. A building on one plot opens its passport straight away.</p></section>'
    + '<div class=or>or search if you know the number</div>'
    + '<div class=scrim id=ppscrim hidden></div><div class=sheet id=ppsheet hidden role=dialog aria-modal=true aria-labelledby=ppsht><div class=grab aria-hidden=true></div><div class=shd><b id=ppsht></b><button type=button class=btn id=ppshx aria-label="Close this list">' + ic("x") + '</button></div><input id=ppshq type=search autocomplete=off><div class=shl id=ppshl></div></div>'
    + '<div class=sbar role=search>' + ic("search") + '<input id=ppq type=search inputmode=search autocomplete=off placeholder="Parcel number, plot number or project name" aria-label="Search for a plot by parcel number, plot number, or project or building name"><button type=button class=btn id=ppclr hidden aria-label="Clear the search">' + ic("x") + "</button></div>"
    + '<div class=hint id=pphint aria-live=polite></div><div class=sug id=ppsug></div><div id=ppout></div>'
    + '<p class=note>' + fresh + ". Research use only.</p>"
    + "<script>" + LTF_JS + "</script><script>" + PP_JS + "</script>" + (deps.najNav ? deps.najNav(key, "more", rk) : "") + "</body></html>";
}

const aed = (v) => (v == null ? "—" : v >= 1e6 ? "AED " + (Math.round(v / 1e5) / 10) + "m" : "AED " + Math.round(v / 1e3) + "k");
export function plotReportHtml(p, meta) {
  const e = escH, d = (s) => (s ? e(s) : "—");
  const ttl = "Plot " + (p.parcel || p.plot_no || p.id);
  const tbl = (head, rows, none) => (rows.length ? "<table><thead><tr>" + head.map((h) => "<th>" + h + "</th>").join("") + "</tr></thead><tbody>" + rows.join("") + "</tbody></table>" : "<p class=e>" + (none || "None linked.") + "</p>");
  const F = p.flats || { items: [] }, it = F.items || [], P = p.prices;
  const one = (p.projects || []).length === 1 ? p.projects[0] : null;
  const pt = (k) => P ? tbl(["Year", "1 bed", "2 bed", "3 bed"], P.years.map((y) => "<tr><td>" + e(y) + (y === P.ytd ? " to date" : "") + "</td>" + [1, 2, 3].map((b) => { const c = ((P[k] || {})[y] || {})[b]; return "<td>" + (c ? e(aed(c[0])) + " <span class=e>(" + c[1] + " deal" + (c[1] > 1 ? "s" : "") + (c[2] === "d" ? ", district" : "") + ")</span>" : "<span class=e>no deals</span>") + "</td>"; }).join("") + "</tr>")) : "";
  return '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>' + e(ttl) + " — research report</title><style>"
    + 'body{font-family:"IBM Plex Sans",system-ui,sans-serif;color:#1A2422;background:#fff;max-width:820px;margin:0 auto;padding:20px 16px;font-size:13px;line-height:1.45}'
    + "h1{font-family:Georgia,serif;font-size:22px;margin:0}h2{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#8E6E35;border-bottom:1px solid #DDD5C2;padding-bottom:4px;margin:20px 0 8px}"
    + "table{width:100%;border-collapse:collapse;margin:0 0 6px}th,td{text-align:left;vertical-align:top;padding:5px 6px;border-bottom:1px solid #EEE8DA;overflow-wrap:anywhere}thead th{font-size:11px;color:#5E6E68}"
    + ".e{color:#5E6E68}.top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.pb{min-height:44px;padding:0 14px;border:1px solid #8E6E35;background:#8E6E35;color:#fff;border-radius:8px;font:inherit;cursor:pointer}"
    + ".ft{color:#5E6E68;font-size:11px;margin-top:24px;border-top:1px solid #DDD5C2;padding-top:8px}@media print{.pb{display:none}body{padding:0}}"
    + "@media(max-width:560px){table,thead,tbody,tr,th,td{display:block}thead{display:none}tr{border-bottom:1px solid #DDD5C2;padding:4px 0}th,td{border:0;padding:2px 0}}"
    + "</style></head><body>"
    + '<div class=top><div><h1>' + e(ttl) + "</h1><div class=e>" + e([p.area_name, p.master || p.project].filter(Boolean).join(" · ")) + (p.sqm ? " · " + Math.round(p.sqm).toLocaleString("en-US") + " sq m" : "") + (p.land_type ? " · " + e(p.land_type) : "") + '</div></div><button class=pb onclick="print()">Print or save as PDF</button></div>'
    + (p.flags && p.flags.length ? "<p class=e>" + p.flags.length + " research flag" + (p.flags.length > 1 ? "s" : "") + " on this plot (see Data checks in Najma).</p>" : "")
    + "<h2>Flats advertised (seen " + d(F.checked) + ")</h2>" + tbl(["Building", "Flat", "Price", "Listed", "Agent", "Phone"], it.map((x) => "<tr><td>" + d(x.b) + "</td><td>" + e([x.beds == null ? "" : x.beds === 0 ? "Studio" : x.beds + " bed", x.sqft ? Math.round(x.sqft).toLocaleString("en-US") + " sq ft" : "", x.mode === "sale" ? "for sale" : "to rent"].filter(Boolean).join(", ")) + "</td><td>" + e(aed(x.price)) + (x.mode === "rent" ? " a year" : "") + "</td><td>" + d(x.date) + (x.portal ? "<br><span class=e>" + e(x.portal) + "</span>" : "") + "</td><td>" + d(x.agent) + "<br><span class=e>" + e(x.firm || "") + (x.card ? ", broker card " + e(x.card) : "") + "</span></td><td>" + d(x.phone) + "</td></tr>"), "No flats advertised on this plot right now.")
    + (P ? "<h2>" + (P.scope === "building" ? "This building" : "This project") + ": " + e(P.name || "") + " — median annual rent (new contracts)</h2>" + pt("rent") + "<h2>Median purchase price (registered sales)</h2>" + pt("sale") + "<p class=e>Deals belong to the " + (P.scope === "building" ? "building" : "whole project") + ", not to this plot alone. Where it had no deal in a year, the district median is shown and marked. Deals to " + d(P.to) + ".</p>" : "")
    + "<h2>Buildings</h2>" + tbl(["Building", "Floors", "Units", "Completion", "Status"], p.buildings.map((x) => "<tr><td>" + e(x.name || x.no) + "</td><td>" + d(x.floors) + "</td><td>" + e([x.flats ? x.flats + " flats" : "", x.shops ? x.shops + " shops" : "", x.offices ? x.offices + " offices" : ""].filter(Boolean).join(", ") || "—") + "</td><td>" + d(one ? (one.done || one.due) : x.date) + "</td><td>" + d(one ? one.status : "Registered") + "</td></tr>"))
    + "<h2>Timeline</h2>" + tbl(["Date", "Event"], p.timeline.map((x) => "<tr><td>" + d(x.date) + "</td><td>" + e(x.what) + "</td></tr>"), "No dated events on record.")
    + "<div class=ft>Prepared for Dr. Digital Abbot by Najma. Research use only: not a legal title, survey or valuation. Land register snapshot " + d(p.as_of) + "; passport built " + d(meta && meta.built_at) + ". Records from the Dubai Land Department and Dubai Municipality; adverts from property portals.</div>"
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
