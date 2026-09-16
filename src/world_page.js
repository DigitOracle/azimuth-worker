// v155 (16 Sep 2026) — THE VERSUS PAGE: Dubai against one of ten cities, for Naj beside a client. Pick the city, set the budget in
// the client's currency, and every line is the pair side by side: what the money buys (Knight Frank, and what the Dubai register
// says it bought), the door, every year, living, culture, this city's story, the script with her verdict, the client card. Every
// row opens its source. Every number comes from src/world.js; this file only draws. Kendall approved the direction on the prototype
// (claude.ai artifact 5iGX4So9GVQNX1YLxTmBWM) and asked for it in Azimuth the same afternoon.
import { WORLD_CITIES, WORLD_SOURCES, WORLD_SAMPLES, USD_AED, WORLD_STORY, WORLD_CULTURE, WORLD_CULTURE_SOURCES, WORLD_NUMERIC, WORLD_SIZE_REFS, WORLD_REGISTER, WORLD_FX, worldFacts, worldCity } from "./world.js";

const PAGE = `<title>Dubai Versus</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
:root{
  --paper:#EFE6D6; --paper2:#E8DCC8; --ink:#1C201E; --mut:#6E7672; --line:#D6C7AD;
  --gold:#C5A56A; --green:#006039; --green2:#0B3D2E; --bar:#D9CBB0; --barD:#006039; --barO:#C5A56A;
  --good:#1F6F43; --warn:#A8582A; --sheet:#FBF7EF;
  --disp:"Fraunces",Georgia,"Times New Roman",serif; --body:"IBM Plex Sans","Segoe UI",system-ui,sans-serif;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){ --paper:#171A18; --paper2:#1F2421; --ink:#EDE6D8; --mut:#A39E92; --line:#3A3F3B; --bar:#2C312E; --barD:#4FA37A; --barO:#C5A56A; --sheet:#22272423; --sheet:#22272A; --good:#63C08E; --warn:#E0925F; --green:#4FA37A; --green2:#7FD1A6; } }
:root[data-theme="dark"]{ --paper:#171A18; --paper2:#1F2421; --ink:#EDE6D8; --mut:#A39E92; --line:#3A3F3B; --bar:#2C312E; --barD:#4FA37A; --barO:#C5A56A; --sheet:#22272A; --good:#63C08E; --warn:#E0925F; --green:#4FA37A; --green2:#7FD1A6; }
*{box-sizing:border-box}
body{background:var(--paper);color:var(--ink);font-family:var(--body);font-size:15px;line-height:1.45;padding-inline:16px;padding-block:12px 40px;max-width:760px;margin:0 auto}
h1{font-family:var(--disp);font-weight:700;font-size:1.7rem;margin:6px 0 2px;letter-spacing:-.01em;text-wrap:balance}
.sub{color:var(--mut);font-size:.85rem;margin:0 0 12px}
.eyebrow{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);font-weight:600}
.cities{display:flex;gap:8px;overflow-x:auto;padding:4px 0 10px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.cities::-webkit-scrollbar{display:none}
.chip{flex:0 0 auto;border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:999px;padding:6px 12px 6px 8px;font:500 .85rem var(--body);display:flex;align-items:center;gap:6px;cursor:pointer}
.chip .fl{font-size:1.1rem}
.flag{display:inline-block;width:24px;height:16px;vertical-align:-3px;border-radius:2px;overflow:hidden;box-shadow:0 0 0 1px rgba(0,0,0,.12)}
.flag svg{display:block;width:100%;height:100%}
.head .flag{width:30px;height:20px;margin-right:6px}
.chip.on{background:var(--green);border-color:var(--green);color:#fff}
.chip:focus-visible,.row:focus-visible,.bud button:focus-visible,.close:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.head{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:end;margin:6px 0 4px}
.head .city{font-family:var(--disp);font-size:1.25rem;font-weight:700}
.head .city small{display:block;font:400 .78rem var(--body);color:var(--mut)}
.head .r{text-align:right}
.bud{margin:10px 0 6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.bud .lab{font-size:.8rem;color:var(--mut);margin-right:4px}
.bud button{border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:8px;padding:5px 10px;font:500 .85rem var(--body);cursor:pointer;font-variant-numeric:tabular-nums}
.bud button.on{background:var(--gold);border-color:var(--gold);color:#1C201E}
.bud select{border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:8px;padding:5px 6px;font:600 .85rem var(--body)}
.bud input{width:7.5em;border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:8px;padding:5px 8px;font:500 .85rem var(--body)}
section{margin-top:18px}
section h2{font-family:var(--disp);font-size:1.05rem;font-weight:700;margin:0 0 4px;display:flex;align-items:center;gap:8px}
section h2 .note{font:400 .75rem var(--body);color:var(--mut)}
.row{display:grid;grid-template-columns:34px 1fr 1fr;gap:6px 10px;align-items:center;padding:9px 4px;border-top:1px solid var(--line);cursor:pointer;background:transparent;border-left:0;border-right:0;border-bottom:0;width:100%;text-align:left;color:inherit;font:inherit}
.row:first-of-type{border-top:0}
.row .ic{width:26px;height:26px;color:var(--green);grid-row:span 2}
.row .lab{grid-column:2/4;font-size:.75rem;color:var(--mut);letter-spacing:.04em;text-transform:uppercase}
.row .v{font-family:var(--disp);font-size:1.15rem;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.15}
.row .v small{display:block;font:400 .74rem var(--body);color:var(--mut);margin-top:2px}
.row .v.r{text-align:right}
.bars{grid-column:2/4;display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:2px}
.bar{height:6px;background:var(--bar);border-radius:3px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--barD)}
.bar.r{transform:scaleX(-1)}
.bar.r i{background:var(--barO)}
.verdict{grid-column:2/4;font-size:.8rem;color:var(--ink);margin-top:2px}
.verdict b{color:var(--green)}
.card{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--paper2);margin-top:8px}
.card p{margin:0 0 8px}
.script{font-size:.95rem;line-height:1.55}
.ready{font-size:.8rem;color:var(--mut);border-top:1px dashed var(--line);padding-top:8px;margin-top:8px}
.pill{display:inline-block;border-radius:999px;padding:2px 9px;font-size:.72rem;font-weight:600;letter-spacing:.04em}
.pill.yes{background:var(--good);color:#fff}.pill.no{background:var(--warn);color:#fff}.pill.wait{background:var(--bar);color:var(--mut)}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.actions button{border:1px solid var(--green);background:transparent;color:var(--green);border-radius:8px;padding:7px 12px;font:600 .85rem var(--body);cursor:pointer}
.actions button.primary{background:var(--green);color:#fff}
.drawer{position:fixed;inset:auto 0 0 0;background:var(--sheet);color:var(--ink);border-top:1px solid var(--line);border-radius:16px 16px 0 0;padding:14px 18px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -12px 40px rgba(0,0,0,.18);max-height:78vh;overflow:auto;transform:translateY(105%);transition:transform .25s ease;z-index:20}
.drawer.open{transform:none}
.drawer h3{font-family:var(--disp);margin:0 0 6px;font-size:1.1rem}
.drawer p{margin:0 0 8px;font-size:.92rem}
.drawer .src{font-size:.8rem;color:var(--mut)}
.close{position:absolute;top:10px;right:12px;border:0;background:transparent;color:var(--mut);font-size:1.4rem;cursor:pointer}
.scrim{position:fixed;inset:0;background:rgba(0,0,0,.25);opacity:0;pointer-events:none;transition:opacity .25s;z-index:10}
.scrim.on{opacity:1;pointer-events:auto}
.share{background:var(--green2);color:#EDE6D8;border-radius:12px;padding:14px 16px;font-size:.92rem;line-height:1.5}
.share .t{font-family:var(--disp);font-size:1.05rem;font-weight:700;color:var(--gold);margin-bottom:6px}
.share .l{display:flex;justify-content:space-between;gap:10px;border-top:1px solid rgba(255,255,255,.12);padding:5px 0}
.share .l span:last-child{font-variant-numeric:tabular-nums;text-align:right}
.foot{margin-top:22px;font-size:.75rem;color:var(--mut);line-height:1.5}
@media (prefers-reduced-motion: reduce){.drawer,.scrim{transition:none}}
@media (min-width:640px){ body{font-size:16px} .row .v{font-size:1.3rem} }
</style>

<h1>Dubai Versus</h1>
<p class="sub">Pick a city, set the client's budget, and every line answers the question they actually asked: expensive compared to what?</p>

<div class="eyebrow">Compare Dubai with</div>
<div class="cities" id="cities" role="tablist" aria-label="City"></div>

<div class="head">
  <div class="city" id="dubaiHead">Dubai<small>prime, the top few per cent</small></div>
  <div class="city r" id="otherHead"></div>
</div>

<div class="bud" aria-label="Budget">
  <span class="lab">Budget</span>
  <select id="cur" aria-label="Currency"><option>AED</option><option>USD</option><option>EUR</option><option>GBP</option><option>CHF</option><option>AUD</option><option>SGD</option><option>HKD</option><option>INR</option></select>
  <button type="button" data-i="0">2m</button>
  <button type="button" data-i="1">3.67m</button>
  <button type="button" data-i="2" class="on">5m</button>
  <button type="button" data-i="3">10m</button>
  <input id="budget" type="number" inputmode="numeric" min="1" step="1000" value="5000000" aria-label="Budget">
  <span class="lab" id="fxnote"></span>
</div>

<section>
  <h2>Your money <span class="note">what it buys at the top end</span></h2>
  <div id="money"></div>
</section>
<section>
  <h2>At the door <span class="note">taxes and fees on the purchase</span></h2>
  <div id="door"></div>
</section>
<section>
  <h2>Every year <span class="note">what you keep, what it costs to hold</span></h2>
  <div id="keep"></div>
</section>
<section>
  <h2>Living <span class="note">the things a family asks about</span></h2>
  <div id="living"></div>
</section>
<section>
  <h2>Life and culture <span class="note">the fun facts a client remembers</span></h2>
  <div id="culture"></div>
</section>
<section>
  <h2 id="storyH">This city's story <span class="note">the facts only this pair has</span></h2>
  <div id="story"></div>
</section>
<section>
  <h2>Say it <span class="note">45 to 60 seconds to camera</span></h2>
  <div id="say"></div>
</section>
<section>
  <h2>Client card <span class="note">what she would send after the meeting</span></h2>
  <div id="share"></div>
</section>
<p class="foot" id="foot"></p>

<div class="scrim" id="scrim"></div>
<div class="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="dTitle">
  <button class="close" id="dClose" aria-label="Close">×</button>
  <h3 id="dTitle"></h3>
  <div id="dBody"></div>
</div>

<script>
const DATA = __DATA__;
const OWNER = DATA.OWNER !== false;   // false when the page was opened with a client key: no buttons that write into her chat
const ICON = {
  area:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>',
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  key:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="8" cy="12" r="4"/><path d="M12 12h9l-2 2m-2-2v3"/></svg>',
  coin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 9.5c0-1 1-1.5 2.5-1.5s2.5.6 2.5 1.6c0 2.4-5 1.4-5 3.8 0 1 1 1.6 2.5 1.6s2.5-.5 2.5-1.5"/></svg>',
  wallet:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/></svg>',
  tag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 12l9-9h9v9l-9 9z"/><circle cx="16" cy="8" r="1.3" fill="currentColor"/></svg>',
  calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  yield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 18l5-6 4 3 7-8"/><path d="M15 7h5v5"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  city:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 21h18M5 21V8l5-3v16M14 21V11l5-2v12"/></svg>',
  basket:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 10h18l-2 10H5z"/><path d="M8 10l3-6M16 10l-3-6"/></svg>',
  plane:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 14l20-9-7 17-3-7z"/></svg>',
  people:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M15 20c0-2 1.5-3.5 3.5-3.5S22 18 22 20"/></svg>',
  mask:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5c3-1.5 13-1.5 16 0v6c0 5-4 9-8 9s-8-4-8-9z"/><path d="M8 11c1-1 2-1 3 0M13 11c1-1 2-1 3 0M9 15c2 1.5 4 1.5 6 0"/></svg>',
  star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  landmark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 21h18M4 10h16M6 10v8M10 10v8M14 10v8M18 10v8M3 10l9-6 9 6"/></svg>',
  fest:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 21l4-12 8 8z"/><path d="M13 6l1-2M17 9l2-1M15 3l.5 2M19 5l-1.5 1.5"/></svg>',
  race:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 4v17"/><path d="M5 4h13l-2 4 2 4H5"/><path d="M8 4v8M11 4v8M14 4v8" opacity=".6"/></svg>',
  tower:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 21V8l3-5 3 5v13M6 21h12M9 12h6M9 16h6"/></svg>',
  mic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
};
// Numeric readings of the fact strings, for the bars. The strings themselves stay the record and open in the drawer.
const NUM = DATA.NUM;
const STORY = DATA.STORY;
// Drawn flags: Windows renders flag emoji as letter pairs, so every city carries its own small SVG (simplified, 3:2).
const FLAG = {
  dubai: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#00732f"/><rect y="6.67" width="30" height="6.67" fill="#fff"/><rect y="13.33" width="30" height="6.67" fill="#000"/><rect width="7.5" height="20" fill="#ff0000"/></svg>',
  monaco: '<svg viewBox="0 0 30 20"><rect width="30" height="10" fill="#ce1126"/><rect y="10" width="30" height="10" fill="#fff"/></svg>',
  hongkong: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#de2910"/><g fill="#fff" transform="translate(15 10)"><ellipse rx="1.9" ry="4.2" cy="-3.2"/><ellipse rx="1.9" ry="4.2" cy="-3.2" transform="rotate(72)"/><ellipse rx="1.9" ry="4.2" cy="-3.2" transform="rotate(144)"/><ellipse rx="1.9" ry="4.2" cy="-3.2" transform="rotate(216)"/><ellipse rx="1.9" ry="4.2" cy="-3.2" transform="rotate(288)"/></g></svg>',
  geneva: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#d52b1e"/><rect x="12.5" y="4" width="5" height="12" fill="#fff"/><rect x="9" y="7.5" width="12" height="5" fill="#fff"/></svg>',
  newyork: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><g fill="#b22234"><rect y="0" width="30" height="1.54"/><rect y="3.08" width="30" height="1.54"/><rect y="6.15" width="30" height="1.54"/><rect y="9.23" width="30" height="1.54"/><rect y="12.31" width="30" height="1.54"/><rect y="15.38" width="30" height="1.54"/><rect y="18.46" width="30" height="1.54"/></g><rect width="12" height="10.77" fill="#3c3b6e"/><g fill="#fff"><circle cx="2" cy="2" r=".6"/><circle cx="5" cy="2" r=".6"/><circle cx="8" cy="2" r=".6"/><circle cx="11" cy="2" r=".6"/><circle cx="3.5" cy="4" r=".6"/><circle cx="6.5" cy="4" r=".6"/><circle cx="9.5" cy="4" r=".6"/><circle cx="2" cy="6" r=".6"/><circle cx="5" cy="6" r=".6"/><circle cx="8" cy="6" r=".6"/><circle cx="11" cy="6" r=".6"/><circle cx="3.5" cy="8" r=".6"/><circle cx="6.5" cy="8" r=".6"/><circle cx="9.5" cy="8" r=".6"/></g></svg>',
  paris: '<svg viewBox="0 0 30 20"><rect width="10" height="20" fill="#0055a4"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ef4135"/></svg>',
  london: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#012169"/><path d="M0 0l30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0l30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.6"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3.6"/></svg>',
  sydney: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#00008b"/><g transform="scale(.5)"><rect width="30" height="20" fill="#012169"/><path d="M0 0l30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0l30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.6"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3.6"/></g><g fill="#fff"><circle cx="7.5" cy="15" r="1.7"/><circle cx="22" cy="4" r=".9"/><circle cx="25.5" cy="8" r=".9"/><circle cx="22" cy="12.5" r=".9"/><circle cx="18.5" cy="8.5" r=".9"/><circle cx="20" cy="10.5" r=".6"/></g></svg>',
  singapore: '<svg viewBox="0 0 30 20"><rect width="30" height="10" fill="#ef3340"/><rect y="10" width="30" height="10" fill="#fff"/><circle cx="7" cy="5" r="3.2" fill="#fff"/><circle cx="8" cy="5" r="2.7" fill="#ef3340"/><g fill="#fff"><circle cx="9.5" cy="2.8" r=".55"/><circle cx="11.5" cy="4.2" r=".55"/><circle cx="10.8" cy="6.6" r=".55"/><circle cx="8.2" cy="6.6" r=".55"/><circle cx="7.5" cy="4.2" r=".55"/></g></svg>',
  miami: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><g fill="#b22234"><rect y="0" width="30" height="1.54"/><rect y="3.08" width="30" height="1.54"/><rect y="6.15" width="30" height="1.54"/><rect y="9.23" width="30" height="1.54"/><rect y="12.31" width="30" height="1.54"/><rect y="15.38" width="30" height="1.54"/><rect y="18.46" width="30" height="1.54"/></g><rect width="12" height="10.77" fill="#3c3b6e"/><g fill="#fff"><circle cx="2" cy="2" r=".6"/><circle cx="5" cy="2" r=".6"/><circle cx="8" cy="2" r=".6"/><circle cx="11" cy="2" r=".6"/><circle cx="3.5" cy="4" r=".6"/><circle cx="6.5" cy="4" r=".6"/><circle cx="9.5" cy="4" r=".6"/><circle cx="2" cy="6" r=".6"/><circle cx="5" cy="6" r=".6"/><circle cx="8" cy="6" r=".6"/><circle cx="11" cy="6" r=".6"/><circle cx="3.5" cy="8" r=".6"/><circle cx="6.5" cy="8" r=".6"/><circle cx="9.5" cy="8" r=".6"/></g></svg>',
  mumbai: '<svg viewBox="0 0 30 20"><rect width="30" height="6.67" fill="#ff9933"/><rect y="6.67" width="30" height="6.67" fill="#fff"/><rect y="13.33" width="30" height="6.67" fill="#138808"/><circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" stroke-width=".7"/><circle cx="15" cy="10" r=".5" fill="#000080"/></svg>',
};
const flag = k => '<span class="flag">' + (FLAG[k] || "") + '</span>';
// Currency. Budget is held in AED; the page shows whatever the client thinks in. ECB reference rates of 15 September 2026, AED pegged at 3.6725 per US dollar.
const FX = DATA.FX;
const SYM = DATA.SYM;
const PRESETS = DATA.PRESETS;
let cur = "AED";
const toAED = v => v * FX[cur];
const M = (aed, short) => { const v = aed / FX[cur]; return SYM[cur] + (short ? fmtM(v) : fmt(v)); };
const CULT = DATA.CULT;
const CULT_SRC = DATA.CULT_SRC;
const pct = s => { const m = String(s||"").match(/(\\d+(?:\\.\\d+)?)\\s*%/g) || []; return m.length ? Math.max(...m.map(x => parseFloat(x))) : null; };
const num = (s, rx) => { const m = String(s||"").match(rx); return m ? parseFloat(m[1].replace(/,/g, "")) : null; };
const readTax = c => /no personal income tax|not liable|no income tax/i.test(c.tax && c.tax.income) ? 0 : pct(c.tax && c.tax.income);
const readLive = c => {
  const L = c.living || {}, E = c.extra || {};
  return {
    liveability: num(L.liveability, /(\\d+)(?:st|nd|rd|th) of 173/),
    cost: /the most expensive/i.test(L.cost_of_living) ? 1 : num(L.cost_of_living, /(\\d+)(?:st|nd|rd|th) most expensive/),
    safety: num(L.safety, /(\\d+)(?:st|nd|rd|th) safest/),
    millionaires: num(L.millionaires, /([\\d,]+) resident millionaires/),
    sun: num(E.sunshine, /about ([\\d,]+) hours/),
    flight: (() => { const h = num(E.flight, /(\\d+) hours?/), m = num(E.flight, /(\\d+) minutes/); return h == null ? null : h + (m || 0) / 60; })(),
    yld: num(E.yield, /about (\\d+(?:\\.\\d+)?)%/),
  };
};
const fmt = n => n == null ? "n/a" : Math.round(n).toLocaleString("en-US");
const fmtM = n => n >= 1e6 ? (Math.round(n / 1e5) / 10) + "m" : fmt(n);
const D = DATA.CITIES.find(c => c.base), OTHERS = DATA.CITIES.filter(c => !c.base);
const REF = DATA.REF;
function sizeRef(m2) { let best = REF[0]; for (const r of REF) if (Math.abs(Math.log(m2 / r[0])) < Math.abs(Math.log(m2 / best[0]))) best = r; const k = m2 / best[0]; return (k >= 1.8 ? Math.round(k * 10) / 10 + " × " : k <= 0.6 ? "about " + Math.round(k * 100) + "% of " : "about the size of ") + best[1]; }
// Dubai register medians, 1 Jan-14 Sep 2026 (DLD Open Data): what the budget actually bought, by band
const REG = DATA.REG;
let city = OTHERS[0].key, budget = 5000000;
const $ = id => document.getElementById(id);
function chips() {
  $("cities").innerHTML = OTHERS.map(c => '<button type="button" role="tab" class="chip' + (c.key === city ? " on" : "") + '" data-c="' + c.key + '" aria-selected="' + (c.key === city) + '">' + flag(c.key) + c.name + '</button>').join("");
  $("cities").querySelectorAll(".chip").forEach(b => b.onclick = () => { city = b.dataset.c; render(); });
}
function row(icon, label, a, b, bars, verdict, detail) {
  const el = document.createElement("button"); el.type = "button"; el.className = "row";
  el.innerHTML = '<span class="ic">' + ICON[icon] + '</span><span class="lab">' + label + '</span>' +
    '<span class="v">' + a + '</span><span class="v r">' + b + '</span>' +
    (bars ? '<span class="bars"><span class="bar"><i style="width:' + bars[0] + '%"></i></span><span class="bar r"><i style="width:' + bars[1] + '%"></i></span></span>' : '') +
    (verdict ? '<span class="verdict">' + verdict + '</span>' : '');
  el.onclick = () => openDrawer(label, detail);
  return el;
}
function fill(id, rows) { const h = $(id); h.innerHTML = ""; rows.forEach(r => h.appendChild(r)); }
function barsOf(a, b, invert) { const m = Math.max(a || 0, b || 0) || 1; let x = (a || 0) / m * 100, y = (b || 0) / m * 100; if (invert) { x = 100 - x + 4; y = 100 - y + 4; } return [Math.min(100, x), Math.min(100, y)]; }
function render() {
  const c = OTHERS.find(o => o.key === city);
  if (!$("dubaiHead").querySelector(".flag")) $("dubaiHead").insertAdjacentHTML("afterbegin", flag("dubai"));
  const aedD = Math.round(D.prime * DATA.USD_AED / 10) * 10, aedC = Math.round(c.prime * DATA.USD_AED / 10) * 10;
  const mult = c.prime / D.prime;
  $("otherHead").innerHTML = flag(c.key) + c.name + "<small>" + (c.price_source ? "Savills Monaco spotlight, IMSEE 2025" : "prime, Savills June 2026") + "</small>";
  document.querySelectorAll(".bud button").forEach(b => { const v = PRESETS[cur][parseInt(b.dataset.i, 10)]; b.textContent = fmtM(v); b.classList.toggle("on", Math.abs(toAED(v) - budget) < 1); });
  $("fxnote").textContent = cur === "AED" ? "" : "1 " + cur + " = AED " + (Math.round(FX[cur] * 1000) / 1000) + ", ECB 15 Sep 2026";
  // money
  const usd = budget / DATA.USD_AED, m2D = D.m2 * usd / 1e6, m2C = c.m2 * usd / 1e6, sqftD = budget / aedD, sqftC = budget / aedC;
  const reg = REG.find(r => budget <= r[0])[1];
  fill("money", [
    row("area", "Prime price per square foot", M(aedD) + (cur !== "AED" ? "<small>AED " + fmt(aedD) + "</small>" : ""), M(aedC) + (cur !== "AED" ? "<small>AED " + fmt(aedC) + "</small>" : ""), barsOf(aedD, aedC), (mult >= 1 ? c.name + " costs <b>" + (Math.round(mult * 10) / 10) + " times</b> Dubai per square foot" : c.name + " is <b>about " + Math.round((1 - mult) * 100) + "% below</b> Dubai per square foot"),
      "<p>Savills World Cities Prime Residential Index, values at June 2026, published 19 August 2026: Dubai US$" + fmt(D.prime) + " and " + c.name + " US$" + fmt(c.prime) + " per square foot, converted at the peg of " + DATA.USD_AED + ".</p>" + (c.price_source ? "<p>" + c.price_source + "</p>" : "") + "<p class=src>Prime means the top few per cent of each market by value, not the average home. Dubai market-wide averaged about AED 1,670 per square foot in 2025 (Betterhomes). Neither index publishes its floor-area basis; Hong Kong quotes net saleable and Dubai built-up, a 20 to 25% gap.</p>"),
    row("home", "What " + M(budget, true) + " buys at the top end", Math.round(m2D) + " m²<small>" + sizeRef(m2D) + "</small>", Math.round(m2C) + " m²<small>" + sizeRef(m2C) + "</small>", barsOf(m2D, m2C), "Same money. <b>" + Math.round(m2D / m2C * 10) / 10 + " times</b> the floor in Dubai.",
      "<p>Knight Frank Wealth Report 2026 (PIRI, values at Q4 2025): US$1 million buys " + D.m2 + " square metres of prime Dubai and " + c.m2 + " of prime " + c.name + ". Scaled to your budget: " + M(budget) + " is AED " + fmt(budget) + ", US$" + fmtM(usd) + " at the peg.</p><p class=src>Size references: a Dubai parking bay is about 14 m² (Dubai Building Code 2021), a Rove Downtown room 26 m² (Rove Hotels), a Sobha Solis one-bedroom about 50 m², the average English home 96 m² (English Housing Survey 2024-25), a padel court 200 m² (FIP), a doubles tennis court about 261 m² (ITF).</p>"),
    row("key", "What the register says it bought", reg.replace(/;.*/, "") + "<small>" + (reg.includes(";") ? reg.replace(/^[^;]*;\\s*/, "") : "DLD Open Data, 2026 to date") + "</small>", "no public register<small>listings and indices only</small>", null, null,
      "<p>Dubai Land Department Open Data, residential unit sales registered 1 January to 14 September 2026 (93,824 sales). Medians by bedroom: studio 36 m², one-bedroom 72 m², two-bedroom 116 m², three-bedroom 172 m². At AED 4.5 to 5.5 million the median unit was 147 m² citywide and 171 m² on Palm Jumeirah (78 sales). At AED 3.4 to 3.95 million: 128 m² citywide, 161 m² on the Palm.</p><p class=src>The register mixes off-plan (three quarters of 2026 sales) and ready homes; off-plan prices are contract prices.</p>"),
  ]);
  // door
  const dD = NUM.door.dubai, dC = NUM.door[c.key];
  fill("door", [
    row("tag", "Tax and fees on the purchase", dD + "%<small>" + NUM.doorTxt.dubai + "</small>", dC + "%<small>" + NUM.doorTxt[c.key] + "</small>", barsOf(dD, dC), null,
      "<p><b>Dubai:</b> " + D.tax.buying + ".</p><p><b>" + c.name + ":</b> " + c.tax.buying + ".</p>"),
    row("wallet", "Paid at the door on " + M(budget, true), M(budget * dD / 100), M(budget * dC / 100), barsOf(budget * dD / 100, budget * dC / 100), null,
      "<p>The headline rate applied to the budget, for the feel of it. Real bills are banded and depend on residency, first or second home, and the currency of the purchase.</p>"),
    row("key", "Can a foreigner own it", "yes, freehold<small>Law No. 7 of 2006, designated areas</small>", (c.key === "sydney" ? "established homes: no<small>ban to June 2029</small>" : c.key === "mumbai" ? "not as a foreign national<small>NRIs and OCIs can</small>" : c.key === "geneva" ? "authorisation needed<small>Lex Koller</small>" : "yes<small>with the duties above</small>"), null, null,
      "<p><b>Dubai:</b> non-nationals hold freehold without time limit in the designated areas (the Palm, Downtown, Marina, Business Bay, Dubai Hills and more), Dubai Law No. 7 of 2006.</p><p><b>" + c.name + ":</b> " + c.tax.buying + "</p>"),
  ]);
  // keep
  const tD = readTax(D), tC = readTax(c);
  fill("keep", [
    row("coin", "Top rate of income tax", tD + "%<small>none</small>", tC + "%<small>" + (c.tax.income.split("(")[0]).slice(0, 60) + "</small>", barsOf(tD, tC), null, "<p><b>Dubai:</b> " + D.tax.income + ".</p><p><b>" + c.name + ":</b> " + c.tax.income + ".</p>"),
    row("calendar", "Holding it, every year", "<small>" + NUM.hold.dubai + "</small>", "<small>" + NUM.hold[c.key] + "</small>", null, null, "<p><b>Dubai:</b> no annual property tax (PwC, 2026); a 5% housing fee on the annual rental value through the DEWA bill; service charges by building, for example Bellevue Towers Downtown AED 24 per square foot a year (DLD data).</p><p><b>" + c.name + ":</b> " + NUM.hold[c.key] + ".</p>"),
    row("yield", "What the flat pays you, gross", readLive(D).yld + "%<small>market-wide average</small>", (readLive(c).yld == null ? "n/a" : readLive(c).yld + "%") + "<small>market-wide average</small>", barsOf(readLive(D).yld, readLive(c).yld), null, "<p><b>Dubai:</b> " + D.extra.yield + ".</p><p><b>" + c.name + ":</b> " + (c.extra && c.extra.yield) + ".</p><p class=src>Global Property Guide averages are market-wide, not prime; prime yields run lower.</p>"),
    row("tag", "Tax on the gain when you sell", NUM.gains.dubai + "%<small>" + NUM.gainsTxt.dubai + "</small>", NUM.gains[c.key] + "%<small>" + NUM.gainsTxt[c.key] + "</small>", barsOf(NUM.gains.dubai, NUM.gains[c.key]), null, "<p><b>Dubai:</b> " + D.tax.capital_gains + ".</p><p><b>" + c.name + ":</b> " + c.tax.capital_gains + ".</p>"),
  ]);
  // living
  const lD = readLive(D), lC = readLive(c);
  const rank = (v, n) => v == null ? "n/a" : v + "<small>of " + n + "</small>";
  fill("living", [
    row("sun", "Sunshine hours a year", fmt(lD.sun), fmt(lC.sun), barsOf(lD.sun, lC.sun), null, "<p><b>Dubai:</b> " + D.extra.sunshine + ". Our July averages 41.7 degrees; that is the honest part.</p><p><b>" + c.name + ":</b> " + (c.extra && c.extra.sunshine) + ".</p>"),
    row("shield", "Safety, crowd-sourced rank", rank(lD.safety, 401), rank(lC.safety, 401), barsOf(lD.safety, lC.safety, true), null, "<p>Numbeo Safety Index, mid-2026, 401 cities, crowd-sourced. <b>Dubai:</b> " + D.living.safety + ". <b>" + c.name + ":</b> " + (c.living ? c.living.safety : "not listed") + ".</p>"),
    row("city", "Liveability rank", rank(lD.liveability, 173), rank(lC.liveability, 173), barsOf(lD.liveability, lC.liveability, true), null, "<p>Economist Intelligence Unit Global Liveability Index 2026, 173 cities: stability, healthcare, culture and environment, education, infrastructure. <b>Dubai:</b> " + D.living.liveability + ". <b>" + c.name + ":</b> " + (c.living && c.living.liveability ? c.living.liveability : "not ranked") + ".</p>"),
    row("basket", "Cost of living rank", rank(lD.cost, 226), rank(lC.cost, 226), barsOf(lD.cost, lC.cost, true), null, "<p>Mercer Cost of Living 2024, 226 cities, for international employees. <b>Dubai:</b> " + D.living.cost_of_living + ". <b>" + c.name + ":</b> " + (c.living && c.living.cost_of_living ? c.living.cost_of_living : "not ranked") + ".</p>"),
    row("city", "Quality of living rank, Mercer", (D.living.quality_of_living ? D.living.quality_of_living.match(/(\\d+)(?:st|nd|rd|th) of 241/)[1] + "<small>of 241</small>" : "n/a"), (c.living && c.living.quality_of_living ? c.living.quality_of_living.match(/(\\d+)(?:st|nd|rd|th) of 241/)[1] + "<small>of 241</small>" : "not ranked<small>Mercer 2024</small>"), (c.living && c.living.quality_of_living ? barsOf(83, parseInt(c.living.quality_of_living.match(/(\\d+)/)[1], 10), true) : null), null, "<p>Mercer Quality of Living City Ranking 2024, 241 cities (the latest edition Mercer published). <b>Dubai:</b> " + D.living.quality_of_living + ". <b>" + c.name + ":</b> " + (c.living && c.living.quality_of_living ? c.living.quality_of_living : "not on the page Mercer published") + ".</p>"),
    row("yield", "Prime values, first half of 2026", "down 4.5%<small>about 10% more expected off in H2</small>", (c.extra && c.extra.savills_h1_2026 ? c.extra.savills_h1_2026.replace(/;.*$/, "").replace(/^prime values /, "") : "not in the index") + "<small>Savills, June 2026</small>", null, null, "<p>Savills World Cities Prime Residential Index H1 2026. <b>Dubai:</b> " + D.extra.savills_h1_2026 + ". <b>" + c.name + ":</b> " + (c.extra && c.extra.savills_h1_2026 ? c.extra.savills_h1_2026 : "Monaco is not one of the 30 cities") + ".</p>"),
    row("plane", "Flight from Dubai, non-stop", "home", lC.flight == null ? "n/a" : Math.floor(lC.flight) + " h " + Math.round((lC.flight % 1) * 60) + " min", null, null, "<p>" + (c.extra && c.extra.flight) + " (FlightConnections, September 2026).</p>"),
    row("people", "Resident millionaires", fmt(lD.millionaires), fmt(lC.millionaires), barsOf(lD.millionaires, lC.millionaires), null, "<p>Henley & Partners World's Wealthiest Cities 2025. <b>Dubai:</b> " + D.living.millionaires + ". <b>" + c.name + ":</b> " + (c.living && c.living.millionaires ? c.living.millionaires : "not in the top 50 list") + ".</p>"),
  ]);
  // culture
  const K = CULT[city], KD = CULT.dubai, cv = (x) => x[0] + (x[1] ? "<small>" + x[1] + "</small>" : "");
  fill("culture", [
    row("mask", "Opera house or concert hall", cv(KD.hall), cv(K.hall), null, null, "<p>" + CULT_SRC.hall + "</p>"),
    row("star", "Michelin-starred restaurants", cv(KD.stars), cv(K.stars), null, null, "<p>" + CULT_SRC.stars + "</p>"),
    row("landmark", "UNESCO World Heritage", cv(KD.unesco), cv(K.unesco), null, null, "<p>" + CULT_SRC.unesco + "</p>"),
    row("fest", "The event everyone comes for", cv(KD.event), cv(K.event), null, null, "<p>" + CULT_SRC.event + "</p>"),
    row("race", "Formula 1", cv(KD.f1), cv(K.f1), null, null, "<p>" + CULT_SRC.f1 + "</p>"),
    row("plane", "The airport, 2025", cv(KD.air), cv(K.air), null, null, "<p>" + CULT_SRC.air + "</p>"),
    row("tower", "Tallest building", cv(KD.tall), cv(K.tall), null, null, "<p>" + CULT_SRC.tall + "</p>"),
  ]);
  // story
  $("storyH").firstChild.textContent = c.name + "'s story ";
  fill("story", (STORY[city] || []).map(f => row(f[0], f[1], f[2], f[3], null, null, f[4])));
  // say
  const s = DATA.SAMPLES.find(x => x.city === city);
  const V = DATA.FB || {};
  $("say").innerHTML = s ? '<div class="card"><p class="eyebrow">' + s.n + '/10 · ' + s.title + ' &nbsp;<span class="pill ' + (V[s.n] ? V[s.n] : "wait") + '">' + (V[s.n] === "yes" ? "Naj: say it" : V[s.n] === "no" ? "Naj: not me" : "awaiting Naj") + '</span></p><p class="script">' + s.text + '</p><p class="ready"><b>Have ready, not said:</b> ' + s.ready + '</p><p class="ready">' + s.sources + '</p></div>(OWNER ? <div class="actions"><button type="button" class="primary" onclick="sendTo(\\'script\\')">Send me this script</button><button type="button" onclick="sendTo(\\'picture\\')">Make me a picture</button><button type="button" onclick="openDrawer(\\'Another angle\\',\\'<p>Say <b>versus ' + c.name.toLowerCase() + '</b> in WhatsApp for a fresh piece on this pair once the lane is switched on.</p>\\')">Another angle</button></div>' : "")
    : '<div class="card"><p>No script written for ' + c.name + ' yet.</p></div>';
  // share
  $("share").innerHTML = '<div class="share"><div class="t">Dubai versus ' + c.name + ' · for your ' + M(budget, true) + '</div>' +
    '<div class="l"><span>Prime price per sq ft</span><span>' + M(aedD) + ' vs ' + M(aedC) + '</span></div>' +
    '<div class="l"><span>Your budget buys</span><span>' + Math.round(m2D) + ' m² vs ' + Math.round(m2C) + ' m²</span></div>' +
    '<div class="l"><span>Paid at the door</span><span>' + M(budget * dD / 100) + ' vs ' + M(budget * dC / 100) + '</span></div>' +
    '<div class="l"><span>Top income tax</span><span>' + tD + '% vs ' + tC + '%</span></div>' +
    '<div class="l"><span>Tax on the gain</span><span>' + NUM.gains.dubai + '% vs ' + NUM.gains[c.key] + '%</span></div>' +
    '<div class="l"><span>Sunshine a year</span><span>' + fmt(lD.sun) + ' vs ' + fmt(lC.sun) + ' h</span></div>' +
    '<div class="l" style="border:0;padding-top:8px;font-size:.78rem;opacity:.8"><span>Savills June 2026 · Knight Frank 2026 · prime basis</span><span>Najma</span></div></div>' +
    '(OWNER ? '<div class="actions"><button type="button" class="primary" onclick="sendTo(\\'card\\')">Send me this card</button></div>' : "");
  $("foot").textContent = "Prime means the top few per cent of each market. Figures: Savills World Cities Prime Residential Index H1 2026 (June values), Knight Frank Wealth Report 2026 (Q4 2025), PwC tax summaries 2026, Global Property Guide 2026, EIU 2026, Mercer 2024, Numbeo mid-2026, Henley 2025, DLD Open Data 2026. Savills has Dubai prime down 4.5% in the first half of 2026 and expects around 10% off in the second half. Currencies at ECB reference rates of 15 September 2026; the dirham is pegged at 3.6725 to the US dollar.";
  chips();
}
async function sendTo(what) {
  const key = new URLSearchParams(location.search).get("key") || "";
  const cn = OTHERS.find(o => o.key === city).name;
  if (!confirm((what === "card" ? "Send the Dubai versus " + cn + " card" : what === "picture" ? "Make a picture for Dubai versus " + cn + " and send it" : "Send this script") + " to your WhatsApp?")) return;
  openDrawer(what === "card" ? "Client card" : what === "picture" ? "Picture" : "Script", "<p>" + (what === "picture" ? "Drawing it, about half a minute…" : "Sending to your WhatsApp…") + "</p>");
  try {
    const r = await fetch(what === "picture" ? "/versus/picture" : "/versus/send", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, city, what, cur, budget: Math.round(budget) }) });
    const t = await r.text();
    if (what === "picture") { let j = null; try { j = JSON.parse(t); } catch (e) {} $("dBody").innerHTML = r.ok && j && j.url ? "<p>Picture sent to your WhatsApp.</p><img src=\"" + j.url + "\" alt=\"Dubai versus " + j.city + "\" style=\"width:100%;border-radius:10px\">" : "<p>Could not make the picture: " + t + "</p>"; return; }
    $("dBody").innerHTML = r.ok ? "<p>" + t + "</p><p class=src>Forward it from your chat; it carries no links and no keys.</p>" : "<p>Could not send: " + t + "</p>";
  } catch (e) { $("dBody").innerHTML = "<p>Could not send just now. Try again in a moment.</p>"; }
}
function openDrawer(title, html) { $("dTitle").textContent = title; $("dBody").innerHTML = html; $("drawer").classList.add("open"); $("scrim").classList.add("on"); }
function closeDrawer() { $("drawer").classList.remove("open"); $("scrim").classList.remove("on"); }
$("dClose").onclick = closeDrawer; $("scrim").onclick = closeDrawer;
document.addEventListener("keydown", e => { if (e.key === "Escape") closeDrawer(); });
document.querySelectorAll(".bud button").forEach(b => b.onclick = () => { budget = toAED(PRESETS[cur][parseInt(b.dataset.i, 10)]); $("budget").value = Math.round(budget / FX[cur]); render(); });
$("budget").addEventListener("change", () => { const v = parseFloat($("budget").value); if (v > 0) { budget = toAED(v); render(); } });
$("cur").addEventListener("change", () => { cur = $("cur").value; $("budget").value = Math.round(budget / FX[cur]); render(); });
try { const s = JSON.parse(localStorage.getItem("dv") || "null"); if (s && OTHERS.some(o => o.key === s.city)) { city = s.city; budget = s.budget || budget; if (FX[s.cur]) { cur = s.cur; $("cur").value = cur; } $("budget").value = Math.round(budget / FX[cur]); } } catch (e) {}
const _r = render; render = function () { _r(); try { localStorage.setItem("dv", JSON.stringify({ city, budget, cur })); } catch (e) {} };
render();
</script>
`;

// The page with its data. fb = the review record's verdicts ({ "2": "yes" }), may be empty. The key never enters the HTML:
// the page reads it from its own address when it needs to call /versus/send.
export function worldPageHtml(fb, owner, nav) {   // nav: { css, html } = the app's tab bar, when the page is one of its rooms   // owner=false: opened with a client key, so the page shows no send buttons
  const data = { USD_AED, SOURCES: WORLD_SOURCES, CITIES: WORLD_CITIES, REFS: WORLD_SIZE_REFS,
    SAMPLES: WORLD_SAMPLES.map(s => ({ n: s.n, city: s.city, title: s.title, text: s.text, ready: s.ready, sources: s.sources })),
    STORY: WORLD_STORY, CULT: WORLD_CULTURE, CULT_SRC: WORLD_CULTURE_SOURCES, NUM: WORLD_NUMERIC, REF: WORLD_SIZE_REFS, REG: WORLD_REGISTER,
    FX: WORLD_FX.rates, SYM: WORLD_FX.symbols, PRESETS: WORLD_FX.presets, FX_DATE: WORLD_FX.date,
    FB: Object.fromEntries(Object.entries(fb || {}).filter(([k, v]) => { const smp = WORLD_SAMPLES.find(x => String(x.n) === String(k)); return smp && (v && v.rev ? v.rev : 1) === (smp.rev || 1); }).map(([k, v]) => [k, v && v.verdict])), LIVE: true, OWNER: owner !== false };   // v157.4 - show a verdict only where it judged the text now on screen: compare the verdict's revision with the sample's, never pin to 1, or a fresh verdict on a rewritten script could never appear
  const json = JSON.stringify(data).replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
  const navCss = nav && nav.css ? "<style>" + nav.css + " body{padding-bottom:88px}</style>" : "";
  return "<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><meta name=robots content=noindex>" + navCss +
    PAGE.replace("const DATA = __DATA__;", "const DATA = " + json + ";").replace("<title>", "</head><body><title>") + (nav && nav.html ? nav.html : "") + "</body></html>";
}

// The two things the page sends to her own WhatsApp. Plain text, no links, no keys, so she can forward it as it is.
const fmt = n => n == null ? "n/a" : Math.round(n).toLocaleString("en-US");
const fmtM = n => n >= 1e6 ? (Math.round(n / 1e5) / 10) + "m" : fmt(n);
export function worldCardText(cityKey, budgetAED, cur) {
  const f = worldFacts(cityKey, "sqft"); if (!f) return null;
  const c = worldCity(cityKey), D = WORLD_CITIES[0];
  const rate = WORLD_FX.rates[cur] || 1, sym = WORLD_FX.symbols[cur] || "AED ";
  const M = (aed, short) => sym + (short ? fmtM(aed / rate) : fmt(aed / rate));
  const usd = budgetAED / USD_AED, m2D = D.m2 * usd / 1e6, m2C = c.m2 * usd / 1e6;
  const dD = WORLD_NUMERIC.door.dubai, dC = WORLD_NUMERIC.door[cityKey];
  const tax = x => /no personal income tax|not liable|no income tax/i.test(x.tax && x.tax.income) ? 0 : Math.max(...((String(x.tax && x.tax.income).match(/(\d+(?:\.\d+)?)\s*%/g) || ["0"]).map(parseFloat)));
  const sun = x => (String(x.extra && x.extra.sunshine).match(/about ([\d,]+) hours/) || [, "n/a"])[1];
  return "Dubai versus " + c.name + " · for your " + M(budgetAED, true) + "\n" +
    "Prime price per sq ft: " + M(f.dubai.prime_aed_per_sqft) + " vs " + M(f.other.prime_aed_per_sqft) + "\n" +
    "Your budget buys: " + Math.round(m2D) + " m² vs " + Math.round(m2C) + " m²\n" +
    "Paid at the door: " + M(budgetAED * dD / 100) + " (" + dD + "%) vs " + M(budgetAED * dC / 100) + " (" + dC + "%)\n" +
    "Top income tax: " + tax(D) + "% vs " + tax(c) + "%\n" +
    "Tax on the gain: " + WORLD_NUMERIC.gains.dubai + "% vs " + WORLD_NUMERIC.gains[cityKey] + "%\n" +
    "Sunshine a year: " + sun(D) + " vs " + sun(c) + " hours\n" +
    "Prime means the top few per cent of each market; Dubai market-wide averaged about AED 1,670 per sq ft in 2025. Savills has Dubai prime down 4.5% in the first half of 2026 and expects around 10% off in the second half.\n" +
    "Savills June 2026 · Knight Frank 2026 · rates ECB " + WORLD_FX.date + "\n— Najma";
}
export function worldScriptText(cityKey) {
  const s = WORLD_SAMPLES.find(x => x.city === cityKey); if (!s) return null;
  return "🎬 Dubai versus " + s.cityName + ": " + s.title + " · 45 to 60 seconds to camera\n\n" + s.text + "\n\n_Have ready, not said: " + s.ready + "_";
}

// v155.3 - the picture for a pair, from the same facts the script uses. One frame, the Digest identity (beige and gold, Rolex green as the
// accent), Dubai on the left and the city on the right by their unmistakable skylines, the two prime prices as the only text. The image
// model draws; every number in the frame is one the fact base holds, so the picture cannot say what the script does not.
export function worldPicturePrompt(cityKey) {
  const f = worldFacts(cityKey, "sqft"); if (!f) return null;
  const c = worldCity(cityKey);
  const land = { monaco: "the Monte Carlo harbour and casino", hongkong: "the Victoria Harbour skyline", geneva: "the Jet d'Eau on Lake Geneva", newyork: "the Manhattan skyline with the Empire State Building", paris: "the Eiffel Tower over Haussmann rooftops", london: "Big Ben and the Thames", sydney: "the Sydney Opera House and Harbour Bridge", singapore: "Marina Bay Sands", miami: "South Beach art deco towers and palms", mumbai: "Marine Drive and the Gateway of India" }[cityKey] || (c.name + "'s skyline");
  return "Editorial split-frame illustration for a property broker's Instagram post, square. Left half: Dubai at golden hour, the Burj Khalifa and the Palm Jumeirah, warm beige and gold light. Right half: " + c.name + ", " + land + ", cooler light. A thin vertical gold line divides the two halves. " +
    "Palette: warm beige #E8DCC8 and gold #C5A56A dominant, deep green #006039 as the only accent. Flat, painterly, premium, no people, no logos, no watermarks. " +
    "Text, set in an elegant serif, exactly and only this: at the top centre \"DUBAI  vs  " + c.name.toUpperCase() + "\"; at the bottom left \"AED " + f.dubai.prime_aed_per_sqft.toLocaleString("en-US") + " / sq ft\"; at the bottom right \"AED " + f.other.prime_aed_per_sqft.toLocaleString("en-US") + " / sq ft\"; and in small type at the very bottom \"prime · Savills June 2026\". No other words or numbers anywhere.";
}
