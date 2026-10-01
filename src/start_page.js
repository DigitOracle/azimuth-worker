// START, v278.1 (Kendall, 1 Oct 2026): the approved mock-up (scratchpad start_mock/start.html) made live.
// Three ways in: THE BRIEF (rent / buy), CONTRACTS SIGNED (Ejari), ADVERTISED SUPPLY (listing sites, owner only).
// Kendall: "put the buttons in, even if they're only placeholders for now". The two new cards are NOT dead controls: a tap opens
// a short panel saying what is coming and when, until their pages ship (v279). Advertised supply is drawn for the owner key only -
// portal data never reaches a client (standing rule).
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function greeting(isOwner) {
  const h = (new Date(Date.now() + 4 * 3600e3)).getUTCHours();   // Dubai time
  const part = h < 12 ? "GOOD MORNING" : h < 17 ? "GOOD AFTERNOON" : "GOOD EVENING";
  return part + (isOwner ? ", BLACK COFFEE" : "");
}

const KEY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4.2"/><path d="M11 12.2 20 3.5M17 6.5l2.2 2.2M14.6 8.9l1.9 1.9"/></svg>';
const HOUSE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#1A1407" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/></svg>';
const DOC_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#7FC8A9" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z"/><path d="M14 3.5V8h4"/><path d="m9 14 2 2 4-4.5"/></svg>';
const TAG_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#E3C88F" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9-8-8Z"/><circle cx="8.5" cy="8.5" r="1.6"/></svg>';
const SKY = '<svg class=sky viewBox="0 0 390 120" preserveAspectRatio="none" aria-hidden="true"><path fill="#C5A56A" d="M0 120V92h18V70h14v22h10V54h16v38h12V80h10V40h8V24h4v16h8v52h14V66h18v26h10V48h12v44h16V74h10v18h14V30h6V12h3v18h6v62h12V58h16v34h10V86h14V62h12v30h18V44h14v48h10V76h12v16h16V68h12v52z"/></svg>';

export function startBody(key, rk, isOwner) {
  const q = "key=" + encodeURIComponent(key || "") + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  const brief = (m, cls, icon, title, sub) => '<a class="btn ' + cls + '" href="/brief?mode=' + m + "&amp;" + esc(q) + '">'
    + '<span class=go>→</span><div class=ic>' + icon + '</div><div><div class=bt>' + title + '</div><div class=bs>' + sub + '</div></div><span class=glow></span></a>';
  const soon = (id, icon, title, sub, body) => '<button type=button class="soon" data-soon="' + id + '"><span class=ic2>' + icon + '</span>'
    + '<span class=st><b>' + title + '</b><span>' + sub + '</span></span><span class=pill>SOON</span></button>'
    + '<div class=panel id="p-' + id + '" hidden>' + body + '</div>';
  return SKY
    + '<div class=hello>' + esc(greeting(isOwner)) + '</div>'
    + '<h1 class=hh>What’s the <em>client</em><br>after today?</h1>'
    + '<div class=lede>Two taps to the right buildings, the PDFs and the map.</div>'
    + '<div class=tag>THE BRIEF <i></i></div>'
    + '<div class=big>'
    + brief("rent", "rent", KEY_SVG, "They want<br>to rent", "a year’s lease · rent by bedroom")
    + brief("buy", "buy", HOUSE_SVG, "They want<br>to buy", "ready or off-plan · price by bedroom")
    + '</div>'
    + '<div class=tag>CONTRACTS SIGNED · EJARI <i></i></div>'
    + soon("ejari", DOC_SVG, "Who’s letting, where", "contracts filed with Ejari · by building, developer, district",
      "Coming this week: search any building, developer or district and see the tenancy contracts filed with Ejari — yesterday, this week or this month, by bedroom and type, with the register’s English and Arabic names. Contracts signed, not homes available.")
    + (isOwner
      ? '<div class=tag>ADVERTISED SUPPLY <i></i></div>'
        + soon("supply", TAG_SVG, "What’s advertised now", "rental adverts across listing sites · for you only",
          "Coming this week: how many rental adverts a building or district has across the listing sites we can read, by bedroom, with median asking rent and days listed. For you only — never shown to a client. Adverts, not vacancy.")
      : "")
    + '<script>document.addEventListener("click",function(e){var b=e.target.closest("[data-soon]");if(!b)return;var p=document.getElementById("p-"+b.getAttribute("data-soon"));if(p){p.hidden=!p.hidden;b.classList.toggle("open",!p.hidden);}});</script>';
}

export const START_CSS = 'body{background:radial-gradient(120% 50% at 50% 0%,#16302B 0%,#0C1413 60%) #0C1413 fixed;position:relative;overflow-x:hidden}'
  + '.sky{position:absolute;left:0;right:0;top:150px;height:70px;width:100%;opacity:.10;pointer-events:none;z-index:0}'
  + '.hello,.hh,.lede,.tag,.big,.soon,.panel{position:relative;z-index:1}'
  + '.hello{font:600 .72rem "IBM Plex Mono",monospace;letter-spacing:.2em;color:#C5A56A;margin-top:6px}'
  + '.hh{font:400 2.4rem/1.05 "Newsreader",Georgia,serif;margin:6px 0 0;color:#EDE8DE}.hh em{font-style:normal;color:#C5A56A}'
  + '.lede{color:#93A39E;font-size:.95rem;margin-top:8px}'
  + '.tag{display:flex;align-items:center;gap:8px;margin:24px 0 10px;font:600 .68rem "IBM Plex Mono",monospace;letter-spacing:.18em;color:#93A39E}.tag i{flex:1;height:1px;background:#22302D}'
  + '.big{display:grid;grid-template-columns:1fr 1fr;gap:12px}'
  + '.btn{position:relative;border-radius:22px;padding:18px 16px 16px;min-height:178px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;text-decoration:none;transition:transform .12s}'
  + '.btn:active{transform:scale(.98)}'
  + '.btn.rent{background:linear-gradient(150deg,#2E9B8D 0%,#1C5E56 70%);box-shadow:0 14px 34px -12px rgba(44,140,128,.75),inset 0 1px 0 rgba(255,255,255,.18)}'
  + '.btn.buy{background:linear-gradient(150deg,#E8CD93 0%,#C5A56A 55%,#9E7E45 100%);box-shadow:0 14px 34px -12px rgba(197,165,106,.75),inset 0 1px 0 rgba(255,255,255,.35)}'
  + '.btn .ic{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:rgba(255,255,255,.16)}.btn.buy .ic{background:rgba(12,20,19,.12)}.btn .ic svg{width:30px;height:30px}'
  + '.btn .bt{font:600 1.35rem/1.1 "IBM Plex Sans",sans-serif}.btn.rent .bt{color:#F4FBF9}.btn.buy .bt{color:#1A1407}'
  + '.btn .bs{font-size:.78rem;margin-top:4px}.btn.rent .bs{color:rgba(244,251,249,.78)}.btn.buy .bs{color:rgba(26,20,7,.72)}'
  + '.btn .go{position:absolute;right:14px;top:16px;width:30px;height:30px;border-radius:50%;display:grid;place-items:center}.btn.rent .go{background:rgba(255,255,255,.18);color:#fff}.btn.buy .go{background:rgba(12,20,19,.15);color:#1A1407}'
  + '.btn .glow{position:absolute;right:-30px;bottom:-40px;width:140px;height:140px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.22),transparent 65%)}'
  + '.soon{width:100%;display:flex;align-items:center;gap:12px;background:#121D1B;border:1px solid #22302D;border-radius:20px;padding:14px;text-align:left;color:#EDE8DE;font:inherit;cursor:pointer}'
  + '.soon .ic2{width:46px;height:46px;flex:none;border-radius:14px;display:grid;place-items:center;background:rgba(44,140,128,.18)}.soon .ic2 svg{width:26px;height:26px}'
  + '.soon .st{flex:1;display:flex;flex-direction:column;gap:2px}.soon .st b{font-size:1.02rem;font-weight:600}.soon .st span{font-size:.78rem;color:#93A39E}'
  + '.soon .pill{font:600 .62rem "IBM Plex Mono",monospace;letter-spacing:.14em;color:#C5A56A;border:1px solid #C5A56A;border-radius:999px;padding:3px 8px}'
  + '.soon.open{border-color:#C5A56A}'
  + '.panel{margin-top:8px;background:#0E1817;border:1px dashed #2C3B37;border-radius:14px;padding:12px 14px;font-size:.86rem;line-height:1.5;color:#C9D2CE}'
  + '@media (max-width:340px){.big{grid-template-columns:1fr}.btn{min-height:140px}}';
