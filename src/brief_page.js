// THE BRIEF - part B, the screens (30 Sep 2026).
//
// A client of Naj's asked "three options in JVC, one bedroom, AED 65K rent" and answering it took a session of hand work.
// Kendall: that must be what START does - pick from drop-downs, get the list, then choose the outputs.
//
// This module owns:
//   - briefStartCard()  the "00 - THEY TELL YOU WHAT THEY WANT" way in, drawn above the five angles on /start
//   - briefRoutes()     GET /brief: the form, the ranked list (from GET /brief_api, Contract A) and the output buttons
//                       (GET /brief_pdf, Contract B). Both endpoints are built elsewhere; this page codes against the contract.
//
// The page script is a String.raw block with no ${} and no backticks, served inline and checked with node --check by
// test/test_brief_page.mjs. It is NOT Function.toString(): wrangler bundles with keepNames, which writes __name(...) calls
// into function bodies that do not exist in the browser.
//
// Rules the page keeps:
//   - no click does nothing (v273): every output button either starts a job with a visible status, or says why it cannot
//   - a slow or failed PDF says so in words, with Try again and a direct link; it never sits silent
//   - "estimated left" is drawn only when the API returns it, and always labelled as an estimate, never as homes available
//   - a shared link carries the CLIENT key, never the owner key (clientLinkKey, v239.1)
//   - plain English on the screen: no unexplained acronyms

// The app's districts: slug, name, corridor. Snapshot of img_districts_geo (naj-market-pulse data/board/districts_geo.json,
// 23 Sep 2026). The route reads the live KV copy first and falls back to this.
export const BRIEF_DISTRICTS = [
  ["jltnorth", "Jumeirah Lake Towers", "Coast"], ["jltsouth", "Jumeirah Islands", "Coast"], ["althanyahfifth", "JLT / Al Thanyah 5", "Coast"],
  ["palmjumeirah", "Palm Jumeirah", "Coast"], ["dubaimarina", "Dubai Marina", "Coast"], ["dubaimaritimecity", "Dubai Maritime City", "Coast"],
  ["alwasl", "Al Wasl", "Downtown & Creek"], ["alsatwa", "Al Satwa", "Downtown & Creek"], ["samaaljadaf", "Al Jaddaf", "Downtown & Creek"],
  ["businessbay", "Business Bay", "Downtown & Creek"], ["burjkhalifa", "Downtown Dubai", "Downtown & Creek"], ["palmdeira", "Dubai Islands", "Downtown & Creek"],
  ["alkhairanfirst", "Dubai Creek Harbour", "Downtown & Creek"], ["majan", "Majan", "New Dubai"], ["dubaisciencepark", "Dubai Science Park", "New Dubai"],
  ["siliconoasis", "Dubai Silicon Oasis", "New Dubai"], ["dubaisportscity", "Dubai Sports City", "New Dubai"], ["jumeirahvillagetriangle", "Jumeirah Village Triangle", "New Dubai"],
  ["jumeirahvillagecircle", "Jumeirah Village Circle", "New Dubai"], ["dubaiproductioncity", "Dubai Production City", "New Dubai"], ["motorcity", "Motor City", "New Dubai"],
  ["arjan", "Arjan", "New Dubai"], ["dubaistudiocity", "Dubai Studio City", "New Dubai"], ["dubaihills", "Dubai Hills Estate", "Meydan & MBR"],
  ["meydanone", "Meydan One", "Meydan & MBR"], ["sobhaheartland", "Sobha Hartland", "Meydan & MBR"], ["wadialsafa5", "Wadi Al Safa 5", "Meydan & MBR"],
  ["rasalkhor", "Sobha One / Ras Al Khor", "Meydan & MBR"], ["wadialsafa4", "Wadi Al Safa 4", "Meydan & MBR"], ["bukadra", "Sobha Hartland II / Bukadra", "Meydan & MBR"],
  ["madinatalmataar", "Dubai South", "South & Outer"], ["jabalalifirst", "Jebel Ali", "South & Outer"], ["dubaiinvestmentparkfirst", "Dubai Investments Park", "South & Outer"],
  ["madinathind4", "DAMAC Hills 2", "South & Outer"], ["jabalaliindustrialsecond", "Jebel Ali Industrial 2", "South & Outer"], ["damachills", "DAMAC Hills", "South & Outer"],
  ["dubaiindustrialcity", "Dubai Industrial City", "South & Outer"], ["dubaiinvestmentparksecond", "Dubai Investments Park 2", "South & Outer"],
  ["alyelayiss1", "Al Yelayiss 1", "South & Outer"], ["alyelayiss2", "Town Square", "South & Outer"], ["alhebiahfifth", "Al Hebiah 5", "South & Outer"],
  ["alyufrah1", "The Valley", "South & Outer"], ["liwan1", "Liwan", "Other"]
];
// names the register spells badly, and entries in the geo file that are not districts a client would ask for
const NAME_FIX = { liwan1: "Liwan" };
const NOT_A_DISTRICT = new Set(["goldensymphony"]);
// what people actually call these places, so the district filter finds "JVC" and "downtown"
const SAID_AS = {
  jumeirahvillagecircle: "jvc", jumeirahvillagetriangle: "jvt", jltnorth: "jlt", althanyahfifth: "jlt", burjkhalifa: "downtown burj",
  alkhairanfirst: "creek", madinatalmataar: "dubai south", alyelayiss2: "town square", madinathind4: "damac hills 2 akoya",
  samaaljadaf: "jaddaf culture village", siliconoasis: "dso silicon", dubaisportscity: "sports city", dubaihills: "hills",
  palmdeira: "deira islands", sobhaheartland: "hartland", bukadra: "hartland 2 ii", alyufrah1: "valley", dubaimarina: "marina"
};
const CORRIDOR_ORDER = ["New Dubai", "Coast", "Downtown & Creek", "Meydan & MBR", "South & Outer", "Other"];
const CORRIDOR_SAY = { "Meydan & MBR": "Meydan & Mohammed Bin Rashid City" };

// the non-negotiables, in the words on the chip. Keys are Contract A's musts list.
export const BRIEF_MUSTS = [["balcony", "balcony"], ["metro", "near a metro"], ["pool", "pool"], ["gym", "gym"], ["parking", "parking"], ["new", "newer building (2020 or later)"], ["schools", "schools nearby"]];
const MUST_KEYS = BRIEF_MUSTS.map((m) => m[0]);
const BEDS = ["studio", "1", "2", "3"];
const TYPES = ["apartment", "villa", "any"];

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// JSON for an inline <script>: nothing in the data can close the tag or break the line
const safeJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

// The query, as a shared link carries it. Anything malformed is dropped rather than guessed at.
export function briefQuery(sp) {
  const g = (k) => String(sp.get(k) || "").trim();
  const num = (v) => { const n = Math.round(Number(String(v).replace(/[^0-9.]/g, ""))); return v !== "" && isFinite(n) && n > 0 ? n : 0; };
  const list = (v) => v.split(",").map((x) => x.trim()).filter(Boolean);
  const mode = g("mode") === "buy" ? "buy" : "rent";
  const beds = BEDS.includes(g("beds")) ? g("beds") : "1";
  const type = TYPES.includes(g("type")) ? g("type") : "any";
  let min = num(g("min")), max = num(g("max"));
  if (min && max && min > max) { const t = min; min = max; max = t; }
  const areas = list(g("areas").toLowerCase()).filter((s) => /^[a-z0-9]{2,40}$/.test(s)).slice(0, 44);
  const musts = list(g("musts")).filter((m) => MUST_KEYS.includes(m));
  let limit = parseInt(g("limit"), 10); limit = isFinite(limit) ? Math.max(1, Math.min(50, limit)) : 10;
  const pick = list(g("pick")).filter((k) => k.length <= 160).slice(0, 50);
  return { mode, beds, min, max, areas, type, musts: [...new Set(musts)], limit, pick, run: g("run") === "1" };
}

async function briefDistricts(env) {
  let rows = null;
  try {
    const raw = env && env.MEETINGS ? await env.MEETINGS.get("img_districts_geo") : null;   // read only
    const d = raw ? JSON.parse(raw) : null;
    if (d && Array.isArray(d.districts) && d.districts.length >= 10) rows = d.districts.filter((x) => x && x.slug && x.name).map((x) => [x.slug, x.name, x.corridor || "Other"]);
  } catch (e) { rows = null; }
  if (!rows) rows = BRIEF_DISTRICTS;
  return rows.filter((r) => !NOT_A_DISTRICT.has(r[0])).map((r) => ({ s: r[0], n: NAME_FIX[r[0]] || r[1], c: CORRIDOR_ORDER.includes(r[2]) ? r[2] : "Other" }));
}

// ---- /start: the new first way in ----------------------------------------------------------------------------------
// Drawn with the /start page's own classes (.ang) so it sits with the five below it. A <div>, not an <a>, because it holds
// two links of its own (Rent / Buy) and a link inside a link is not allowed.
export function briefStartCard(key, rk, icon) {
  const q = "key=" + encodeURIComponent(key || "") + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  const steps = [
    ["THE BRIEF", "rent or buy, bedrooms, budget, where, and what they will not do without"],
    ["the list", "the buildings that fit, ranked by what homes there actually let or sell for"],
    ["tick the ones to keep", "then share the list, or make the PDFs: one per building, a compare sheet with a map, or the full pack"]
  ].map((p) => "<li><b>" + esc(p[0]) + "</b> \u2014 " + esc(p[1]) + "</li>").join("");
  const go = (m, label) => '<a class=go href="/brief?mode=' + m + "&amp;" + esc(q) + '" style="text-decoration:none;margin-right:8px">' + label + " \u2192</a>";
  return '<div class="ang brief0" id=brief0><div class=tg>' + (icon || "") + "<b>00</b><span>THEY TELL YOU WHAT THEY WANT</span></div>"
    + "<div class=sd>\u201cThree options in JVC, one bedroom, AED 65K rent.\u201d</div>"
    + "<div class=ld>They already know the brief. Put it in, get the buildings that fit, and send them something they can keep.</div>"
    + "<ol>" + steps + "</ol>" + go("rent", "they want to RENT") + go("buy", "they want to BUY") + "</div>";
}

// ---- the page ------------------------------------------------------------------------------------------------------
const BRIEF_CSS = 'body{background:#0C1413;color:#E8E4D8;font-family:"IBM Plex Sans",system-ui,sans-serif;margin:0;padding:14px 14px 150px;max-width:560px;margin-inline:auto;-webkit-text-size-adjust:100%}'
  + '*{box-sizing:border-box}button{font:inherit;color:inherit}'
  + '.bk{display:inline-block;color:#8FA39B;text-decoration:none;font-family:"IBM Plex Mono",monospace;font-size:.64rem;letter-spacing:.1em;margin:0 0 8px}'
  + '.h{font-family:Fraunces,Georgia,serif;font-size:1.7rem;font-weight:600;margin:.1rem 0 .1rem;line-height:1.15}.h em{font-style:normal;color:#C5A56A}'
  + '.s{color:#8FA39B;font-size:.84rem;line-height:1.5;margin:0 0 14px}'
  + '.card{background:#101D1B;border:1px solid #24352F;border-left:3px solid #C5A56A;border-radius:12px;padding:12px 13px;margin:0 0 12px}'
  + '.lb{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-family:"IBM Plex Mono",monospace;font-size:.62rem;letter-spacing:.11em;color:#8FA39B;margin:12px 0 7px}.lb:first-child{margin-top:0}.lb b{color:#C5A56A;font-weight:500;letter-spacing:.03em;text-align:right}'
  + '.seg{display:flex;gap:6px;flex-wrap:wrap}.seg button,.chip{flex:1 1 auto;min-height:42px;border:1px solid #2E4540;background:#0E1918;border-radius:9px;padding:8px 10px;font-size:.86rem;cursor:pointer;-webkit-tap-highlight-color:transparent}'
  + '.seg button.on,.chip.on{background:#C5A56A;border-color:#C5A56A;color:#0C1413;font-weight:600}'
  + '.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{flex:0 1 auto;min-height:38px;font-size:.8rem;border-radius:999px;padding:7px 12px}'
  + '.bud{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin:8px 0 0}.bud span{color:#8FA39B;font-size:.8rem}'
  + '.in{width:100%;min-height:44px;background:#0E1918;border:1px solid #2E4540;border-radius:9px;color:#E8E4D8;padding:9px 11px;font-size:16px;font-family:inherit}.in:focus{outline:2px solid #C5A56A;outline-offset:1px}'
  + '.hint{color:#6F837D;font-size:.72rem;line-height:1.45;margin:6px 0 0}'
  + '.dl{max-height:260px;overflow:auto;margin:8px 0 0;padding:2px 0;border-top:1px solid #1B2E2A}.dg{font-family:"IBM Plex Mono",monospace;font-size:.56rem;letter-spacing:.1em;color:#6F837D;margin:9px 0 5px;text-transform:uppercase}'
  + '[hidden]{display:none!important}'
  + '.go{display:block;width:100%;min-height:50px;margin:14px 0 0;border:0;border-radius:10px;background:#C5A56A;color:#0C1413;font-family:"IBM Plex Mono",monospace;font-size:.84rem;letter-spacing:.06em;font-weight:600;cursor:pointer}'
  + '.msg{color:#E0A080;font-size:.8rem;line-height:1.45;margin:8px 0 0}.msg:empty{display:none}'
  + '.rh{font-family:"IBM Plex Mono",monospace;font-size:.64rem;letter-spacing:.08em;color:#8FA39B;margin:22px 0 8px;padding-top:14px;border-top:1px solid #24352F;line-height:1.6}.rh b{color:#C5A56A;font-size:.9rem;font-weight:500}'
  + '.sa{display:flex;gap:8px;align-items:center;margin:0 0 8px;font-size:.78rem;color:#8FA39B}.sa button{background:none;border:1px solid #2E4540;border-radius:999px;padding:5px 11px;color:#C8D3CE;font-size:.74rem;cursor:pointer}'
  + '.row{display:flex;gap:10px;background:#101D1B;border:1px solid #24352F;border-radius:12px;padding:11px 12px;margin:0 0 9px}.row.off{opacity:.55}'
  + '.pk{flex:0 0 auto;padding-top:2px}.pk input{width:24px;height:24px;accent-color:#C5A56A;margin:0}'
  + '.rb{flex:1 1 auto;min-width:0}.r1{display:flex;gap:7px;align-items:baseline;flex-wrap:wrap}.rk{font-family:"IBM Plex Mono",monospace;font-size:.66rem;color:#8FA39B}'
  + '.nm{font-family:Fraunces,Georgia,serif;font-size:1.05rem;font-weight:600;color:#F0E4C8;line-height:1.25}'
  + '.vd{font-family:"IBM Plex Mono",monospace;font-size:.6rem;letter-spacing:.06em;border-radius:999px;padding:2px 8px;white-space:nowrap}'
  + '.v-within{background:#1E4A40;color:#8FD3B9}.v-a_little_above{background:#4A3B1E;color:#E8C27A}.v-above{background:#4A2323;color:#E89A9A}.v-below{background:#1E3148;color:#9FC2E8}'
  + '.r2{color:#8FA39B;font-size:.76rem;margin:3px 0 6px;line-height:1.4}.r3{font-size:.86rem;line-height:1.4}.r3 b{color:#C5A56A}.r4{color:#A9B7B2;font-size:.76rem;margin:2px 0 0;line-height:1.45}'
  + '.mu{display:flex;flex-wrap:wrap;gap:4px;margin:7px 0 0}.mu span{font-size:.7rem;border:1px solid #2E4540;border-radius:999px;padding:2px 8px;color:#C8D3CE}.mu .y{border-color:#3E8A7E;color:#8FD3B9}.mu .n{border-color:#6A3A3A;color:#E0A0A0}.mu .u{border-style:dashed;color:#8FA39B}'
  + '.est{margin:8px 0 0;border:1px dashed #6E5A33;border-radius:9px;padding:7px 9px;font-size:.76rem;line-height:1.45;color:#E8D6AE}.est b{font-family:"IBM Plex Mono",monospace;font-size:.6rem;letter-spacing:.1em;color:#C5A56A;display:block}'
  + '.r5{color:#6F837D;font-size:.72rem;line-height:1.45;margin:7px 0 0}.r5 a{color:#C5A56A;text-decoration:none;white-space:nowrap}'
  + '.nt{color:#6F837D;font-size:.72rem;line-height:1.5;border:1px dashed #24352F;border-radius:9px;padding:9px 11px;margin:10px 0 0}'
  + '.out{background:#101D1B;border:1px solid #3B584F;border-radius:12px;padding:12px 13px;margin:16px 0 0}.out .lb{margin:0 0 9px}'
  + '.ob{display:grid;grid-template-columns:1fr 1fr;gap:7px}.ob button{min-height:48px;border:1px solid #C5A56A;background:#0E1918;color:#E8E4D8;border-radius:10px;padding:8px;font-size:.82rem;line-height:1.25;cursor:pointer;text-align:center}'
  + '.ob button small{display:block;color:#8FA39B;font-size:.66rem;margin-top:2px}.ob .pri{grid-column:1/-1;background:#C5A56A;color:#0C1413;font-weight:600}.ob .pri small{color:#3B3322}'
  + '.shb{margin:10px 0 0}.shb .in{font-size:.8rem;font-family:"IBM Plex Mono",monospace}.shr{display:flex;gap:7px;margin:7px 0 0}.shr a,.shr button{flex:1;min-height:40px;display:flex;align-items:center;justify-content:center;border:1px solid #2E4540;border-radius:9px;background:#0E1918;color:#E8E4D8;text-decoration:none;font-size:.8rem;cursor:pointer}'
  + '.omsg{color:#E8D6AE;font-size:.78rem;line-height:1.45;margin:8px 0 0}.omsg:empty{display:none}'
  + '.job{border-top:1px solid #24352F;padding:9px 0 2px;margin:9px 0 0}.job .jt{font-size:.82rem;color:#F0E4C8}.job .js{font-size:.76rem;color:#8FA39B;margin:3px 0 0;line-height:1.45}.job.bad .js{color:#E0A080}.job.ok .js{color:#8FD3B9}'
  + '.ja{display:flex;flex-wrap:wrap;gap:7px;margin:7px 0 0}.ja a,.ja button{min-height:38px;display:inline-flex;align-items:center;border:1px solid #C5A56A;border-radius:9px;background:#0E1918;color:#E8E4D8;text-decoration:none;padding:6px 12px;font-size:.78rem;cursor:pointer}.ja .p{background:#C5A56A;color:#0C1413;font-weight:600}'
  + '.pill{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(66px + env(safe-area-inset-bottom));z-index:39;background:#C5A56A;color:#0C1413;border:0;border-radius:999px;padding:10px 18px;font-family:"IBM Plex Mono",monospace;font-size:.72rem;letter-spacing:.05em;font-weight:600;box-shadow:0 6px 18px rgba(0,0,0,.45);cursor:pointer;white-space:nowrap}';

function briefFormHtml(districts) {
  const seg = (id, items) => '<div class=seg id=' + id + ">" + items.map((x) => "<button type=button data-v=" + x[0] + ">" + esc(x[1]) + "</button>").join("") + "</div>";
  const groups = CORRIDOR_ORDER.map((c) => {
    const ds = districts.filter((d) => d.c === c).sort((a, b) => a.n.localeCompare(b.n));
    if (!ds.length) return "";
    return '<div class=dgw><div class=dg>' + esc(CORRIDOR_SAY[c] || c) + "</div><div class=chips>"
      + ds.map((d) => "<button type=button class=chip data-s=" + esc(d.s) + ' data-f="' + esc((d.n + " " + d.s + " " + (SAID_AS[d.s] || "")).toLowerCase()) + '">' + esc(d.n) + "</button>").join("") + "</div></div>";
  }).join("");
  return '<div class=card id=bform>'
    + '<div class=lb>I\u2019M LOOKING TO</div>' + seg("fmode", [["rent", "Rent"], ["buy", "Buy"]])
    + '<div class=lb>BEDROOMS</div>' + seg("fbeds", [["studio", "Studio"], ["1", "1"], ["2", "2"], ["3", "3 or more"]])
    + '<div class=lb><span id=fbudl>BUDGET</span><b id=fbudv></b></div><div class=chips id=fpre></div>'
    + '<div class=bud><input class=in id=fmin inputmode=decimal autocomplete=off placeholder="from" aria-label="lowest budget"><span>to</span><input class=in id=fmax inputmode=decimal autocomplete=off placeholder="up to" aria-label="highest budget"></div>'
    + '<div class=hint id=fbudh>Type it the way you say it: 65k, 1.2m or 65000.</div>'
    + '<div class=lb>WHERE <b id=fdsel>Anywhere in Dubai</b></div>'
    + '<div class=chips><button type=button class="chip on" id=fany>Anywhere in Dubai</button></div>'
    + '<input class=in id=fdq type=search autocomplete=off placeholder="find a district: JVC, Marina, Downtown\u2026" style="margin-top:8px" aria-label="find a district">'
    + '<div class=dl id=fdl>' + groups + '<div class=hint id=fdnone hidden>No district by that name. Clear the search to see them all.</div></div>'
    + '<div class=lb>HOME TYPE</div>' + seg("ftype", [["apartment", "Apartment"], ["villa", "Villa & townhouse"], ["any", "Any"]])
    + '<div class=lb>WILL NOT DO WITHOUT <b id=fmustv></b></div><div class=chips id=fmust>'
    + BRIEF_MUSTS.map((m) => "<button type=button class=chip data-v=" + m[0] + ">" + esc(m[1]) + "</button>").join("") + "</div>"
    + '<div class=lb>HOW MANY BUILDINGS</div>' + seg("flim", [["10", "10"], ["20", "20"], ["50", "50"]])
    + '<button type=button class=go id=fgo>SHOW ME THE BUILDINGS \u2192</button><div class=msg id=fmsg role=alert></div>'
    + "</div>";
}

function briefOutHtml() {
  return '<div class=out id=bout hidden><div class=lb>WHAT TO SEND <b id=ochosen></b></div><div class=ob>'
    + '<button type=button class=pri id=o-ind>Individual PDFs<small>one per building, three pages each</small></button>'
    + '<button type=button id=o-share>Share this list<small>a link that opens this list</small></button>'
    + '<button type=button id=o-c5>Compare 5<small>one sheet and a map</small></button>'
    + '<button type=button id=o-c10>Compare 10<small>one sheet and a map</small></button>'
    + '<button type=button id=o-pack>Full pack<small>sheet, map, every building</small></button>'
    + '</div><div class=omsg id=omsg role=status></div>'
    + '<div class=shb id=shbox hidden><input class=in id=shurl readonly aria-label="the link to this list"><div class=shr><button type=button id=shcopy>Copy link</button><a id=shwa href="#" target=_blank rel=noopener>WhatsApp</a></div></div>'
    + '<div id=jobs></div></div>';
}

export function briefPageHtml(o) {
  const key = o.key || "", rk = o.rk || "";
  const boot = { key, shareKey: o.shareKey || "", rk, q: o.q, districts: o.districts.map((d) => ({ s: d.s, n: d.n })), musts: BRIEF_MUSTS };
  return '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<title>The brief \u2014 Najma</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413"><meta name=robots content=noindex>' + (o.fonts || "")
    + "<style>" + BRIEF_CSS + (o.navCss || "") + "</style></head><body>"
    + '<a class=bk href="/start?key=' + esc(encodeURIComponent(key)) + (rk ? "&amp;rk=" + esc(encodeURIComponent(rk)) : "") + '">\u2039 START</a>'
    + '<div class=h>The <em>brief</em></div>'
    + '<div class=s>Put in what they asked for. You get the buildings that fit, ranked by what homes there actually let or sell for, then choose what to send.</div>'
    + briefFormHtml(o.districts)
    + '<div id=bres aria-live=polite></div>'
    + briefOutHtml()
    + '<button type=button class=pill id=bpill hidden></button>'
    + '<script>window.__BRIEF=' + safeJson(boot) + ";</script>"
    + "<script>" + BRIEF_JS + "</script>"
    + (o.nav || "") + "</body></html>";
}

// ---- the route -----------------------------------------------------------------------------------------------------
// h carries the app's own gate and chrome from src/index.js, so this module never re-implements the key rules:
// { clientOk, keyTier, clientLinkKey, clientResp, residentsKeyOf, najNav, NAJ_NAV_CSS, NAJ_FONTS }
export async function briefRoutes(request, env, url, h) {
  if (url.pathname !== "/brief") return null;
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("method not allowed", { status: 405 });
  if (!h.clientOk(env, url)) return new Response("unauthorized", { status: 401 });
  const key = url.searchParams.get("key") || "";
  // the link Naj shares goes to a client's phone: it carries the client key, never the owner key (v239.1)
  const shareKey = h.keyTier(env, url) === "client" ? key : h.clientLinkKey(env);
  const rk = h.residentsKeyOf(env, url);
  const html = briefPageHtml({ key, shareKey, rk, q: briefQuery(url.searchParams), districts: await briefDistricts(env), nav: h.najNav(key, "start", rk), navCss: h.NAJ_NAV_CSS, fonts: h.NAJ_FONTS });
  return h.clientResp(env, url, html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

// ---- the page script -----------------------------------------------------------------------------------------------
// Plain ES5 and string concatenation, no ${} and no backticks (String.raw keeps every backslash for the browser).
export const BRIEF_JS = String.raw`
(function(){
var B=window.__BRIEF||{};
var KEY=B.key||"",SKEY=B.shareKey||"",RKQ=B.rk?"&rk="+encodeURIComponent(B.rk):"";
var DN={};(B.districts||[]).forEach(function(d){DN[d.s]=d.n});
var MN={};(B.musts||[]).forEach(function(m){MN[m[0]]=m[1]});
var PRE={rent:[[0,50000,"up to 50k"],[50000,70000,"50k \u2013 70k"],[70000,100000,"70k \u2013 100k"],[100000,150000,"100k \u2013 150k"],[150000,250000,"150k \u2013 250k"],[250000,0,"250k and up"]],
 buy:[[0,1000000,"under 1M"],[1000000,1500000,"1M \u2013 1.5M"],[1500000,2500000,"1.5M \u2013 2.5M"],[2500000,5000000,"2.5M \u2013 5M"],[5000000,0,"5M and up"]]};
var VERD={within:"in budget",a_little_above:"a little over budget",above:"over budget",below:"under budget"};
var ST={mode:"rent",beds:"1",min:0,max:0,areas:[],type:"any",musts:[],limit:10};
var LAST=null,RES=null,SEL={},PICK=null,SEQ=0,JN=0,RUNNING=0,QUEUE=[],JOBS={};
var PDF_WAIT={dossier:100000,compare:120000,onesheet:100000,pack:170000};
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function each(list,fn){for(var i=0;i<list.length;i++)fn(list[i],i)}
function parseAed(s){s=String(s==null?"":s).toLowerCase().replace(/aed|,|\s/g,"");if(!s)return 0;var m=s.match(/^(\d+(?:\.\d+)?)(k|m|mn|million)?$/);if(!m)return NaN;var v=parseFloat(m[1]);if(m[2]==="k")v*=1e3;else if(m[2])v*=1e6;return Math.round(v)}
function fmtAed(v){v=+v;if(!isFinite(v))return "";if(v>=1e6)return "AED "+(v/1e6).toFixed(2).replace(/\.?0+$/,"")+"M";if(v>=1e3)return "AED "+Math.round(v/1e3)+"k";return "AED "+Math.round(v)}
function short(v){return v?fmtAed(v).replace("AED ",""):""}
function bedsWord(b){return b==="studio"?"studio":(b==="3"?"3 or more bedrooms":(b==="1"?"1 bedroom":b+" bedrooms"))}
function budText(st){if(st.min&&st.max)return fmtAed(st.min)+" to "+short(st.max);if(st.max)return "up to "+fmtAed(st.max);if(st.min)return fmtAed(st.min)+" and up";return "any budget"}
function perYear(st){return st.mode==="rent"?" a year":""}
function areasText(st){if(!st.areas.length)return "anywhere in Dubai";var n=st.areas.map(function(s){return DN[s]||s});return n.length>3?n.slice(0,3).join(", ")+" and "+(n.length-3)+" more":n.join(", ")}
function summary(st){return (st.mode==="rent"?"To rent":"To buy")+": "+bedsWord(st.beds)+", "+budText(st)+perYear(st)+", "+areasText(st)+(st.type==="any"?"":(st.type==="villa"?", villa or townhouse":", apartment"))+(st.musts.length?", with "+st.musts.map(function(m){return MN[m]||m}).join(", "):"")}
function qs(st,key){var p=[];if(key!=null)p.push("key="+encodeURIComponent(key));p.push("mode="+st.mode,"beds="+st.beds,"min="+(st.min||0));if(st.max)p.push("max="+st.max);
  p.push("areas="+st.areas.map(encodeURIComponent).join(","),"type="+st.type,"musts="+st.musts.join(","),"limit="+st.limit);return p.join("&")}
function clone(st){return {mode:st.mode,beds:st.beds,min:st.min,max:st.max,areas:st.areas.slice(),type:st.type,musts:st.musts.slice(),limit:st.limit}}

// ---- the form ----
function segOn(id,v){each($(id).querySelectorAll("button"),function(b){b.classList.toggle("on",b.getAttribute("data-v")===String(v))})}
function segWire(id,fn){each($(id).querySelectorAll("button"),function(b){b.onclick=function(){fn(b.getAttribute("data-v"));draw()}})}
function drawPresets(){var el=$("fpre");el.innerHTML=PRE[ST.mode].map(function(p,i){return "<button type=button class=chip data-ix="+i+">"+esc(p[2])+"</button>"}).join("");
  each(el.querySelectorAll("button"),function(b){b.onclick=function(){var p=PRE[ST.mode][+b.getAttribute("data-ix")];ST.min=p[0];ST.max=p[1];$("fmin").value=short(p[0]);$("fmax").value=short(p[1]);msg("");draw()}})}
function draw(){segOn("fmode",ST.mode);segOn("fbeds",ST.beds);segOn("ftype",ST.type);segOn("flim",ST.limit);
  $("fbudl").textContent=ST.mode==="rent"?"BUDGET, RENT A YEAR (AED)":"BUDGET, PRICE (AED)";
  $("fbudv").textContent=(ST.min||ST.max)?budText(ST)+perYear(ST):"";
  each($("fpre").querySelectorAll("button"),function(b){var p=PRE[ST.mode][+b.getAttribute("data-ix")];b.classList.toggle("on",!!p&&p[0]===ST.min&&p[1]===ST.max)});
  each($("fdl").querySelectorAll("button"),function(b){b.classList.toggle("on",ST.areas.indexOf(b.getAttribute("data-s"))>=0)});
  $("fany").classList.toggle("on",!ST.areas.length);$("fdsel").textContent=ST.areas.length?ST.areas.length+" chosen":"Anywhere in Dubai";
  each($("fmust").querySelectorAll("button"),function(b){b.classList.toggle("on",ST.musts.indexOf(b.getAttribute("data-v"))>=0)});
  $("fmustv").textContent=ST.musts.length?ST.musts.length+" chosen":"";}
function filterD(){var q=String($("fdq").value||"").toLowerCase().trim(),any=false;
  each($("fdl").querySelectorAll(".dgw"),function(g){var shown=0;each(g.querySelectorAll("button"),function(b){var hit=!q||String(b.getAttribute("data-f")||"").indexOf(q)>=0;b.hidden=!hit;if(hit)shown++});g.hidden=!shown;if(shown)any=true});
  $("fdnone").hidden=any}
function readBudget(){var a=parseAed($("fmin").value),b=parseAed($("fmax").value);
  if(isNaN(a)||isNaN(b))return "The budget has to be a number, like 65k, 1.2m or 65000.";
  if(a&&b&&a>b){var t=a;a=b;b=t;$("fmin").value=short(a);$("fmax").value=short(b)}
  ST.min=a;ST.max=b;if(!a&&!b)return "Set a budget first: tap a range, or type the most they will pay.";
  if(ST.mode==="rent"&&(b||a)>5000000)return "That looks like a price to buy, not a yearly rent. Switch to Buy, or check the number.";
  return ""}
function msg(t){$("fmsg").textContent=t||""}
function applyQ(q){if(!q)return;ST.mode=q.mode||"rent";ST.beds=q.beds||"1";ST.min=q.min||0;ST.max=q.max||0;ST.areas=(q.areas||[]).filter(function(s){return !!DN[s]});ST.type=q.type||"any";ST.musts=q.musts||[];ST.limit=q.limit||10;
  $("fmin").value=short(ST.min);$("fmax").value=short(ST.max);PICK=q.pick&&q.pick.length?q.pick:null}

// ---- the search (Contract A: GET /brief_api) ----
function fetchT(u,ms){var ac=typeof AbortController!=="undefined"?new AbortController():null,t=setTimeout(function(){if(ac)ac.abort()},ms);
  return fetch(u,ac?{signal:ac.signal,credentials:"same-origin"}:{credentials:"same-origin"}).then(function(r){clearTimeout(t);return r},function(e){clearTimeout(t);throw (e&&e.name==="AbortError")?{timeout:true}:e})}
function run(){var e=readBudget();if(e){msg(e);return}msg("");
  var st=clone(ST),my=++SEQ;LAST=st;
  try{history.replaceState(null,"",location.pathname+"?"+qs(st,KEY)+RKQ+"&run=1")}catch(x){}
  $("bres").innerHTML="<div class=rh>Looking for "+esc(summary(st).replace(/^To (rent|buy): /,""))+"\u2026</div>";
  $("bout").hidden=true;$("bpill").hidden=true;
  fetchT("/brief_api?"+qs(st,KEY),30000).then(function(r){if(!r.ok)throw {status:r.status};return r.json()}).then(function(j){if(my!==SEQ)return;if(!j||!j.results)throw {bad:true};RES=j;pickDefault();drawRes()})
  .catch(function(err){if(my!==SEQ)return;RES=null;var t=err&&err.timeout?"The search took too long to answer.":(err&&err.status===401?"This link\u2019s key was not accepted. Open the app from a fresh link.":(err&&err.status===404?"The search is not switched on yet.":(err&&err.status?"The search did not answer (error "+err.status+").":(err&&err.bad?"The search answered with something this page cannot read.":"No connection to the search. Check the signal."))));
    $("bres").innerHTML="<div class=rh>"+esc(t)+"</div><button type=button class=go id=bretry>TRY AGAIN</button>";$("bretry").onclick=run})}
function pickDefault(){SEL={};var rs=RES.results||[];if(PICK){each(rs,function(r){if(PICK.indexOf(r.key)>=0)SEL[r.key]=true});PICK=null;if(chosen().length)return}
  each(rs,function(r,i){if(i<10)SEL[r.key]=true})}
function chosen(){var out=[];each((RES&&RES.results)||[],function(r){if(SEL[r.key])out.push(r.key)});return out}
function byKey(k){var f=null;each((RES&&RES.results)||[],function(r){if(r.key===k)f=r});return f}
function money(r,st){var e=r.evidence||{},sale=e.basis==="dld_sales";
  var head=(sale?"typical price ":"typical rent ")+"<b>"+esc(fmtAed(e.median))+"</b>"+(sale?"":" a year");
  var mid=(e.q1&&e.q3)?" \u00b7 middle half "+esc(short(e.q1))+" \u2013 "+esc(short(e.q3)):"";
  return "<div class=r3>"+head+mid+"</div>"}
function day(d){var M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];d=String(d||"");return d.length>=10?(+d.slice(8,10))+" "+M[+d.slice(5,7)-1]+" "+d.slice(0,4):d}
function facts(r){var e=r.evidence||{},sale=e.basis==="dld_sales",p=[];
  if(e.n!=null)p.push(e.n+(sale?(e.n===1?" sale":" sales"):(e.n===1?" letting":" lettings"))+(e.n_new!=null&&!sale?" ("+e.n_new+" new)":""));
  if(e.sqm)p.push("about "+Math.round(e.sqm)+" m\u00b2");if(e.latest)p.push("latest "+day(e.latest));
  return p.length?"<div class=r4>"+esc(p.join(" \u00b7 "))+"</div>":""}
function musts(r,st){var m=r.musts||{},keys=st.musts.length?st.musts:Object.keys(m).filter(function(k){return m[k]===true}).slice(0,4);if(!keys.length)return "";
  return "<div class=mu>"+keys.map(function(k){var v=m[k],w=MN[k]||k;return v===true?"<span class=y>\u2713 "+esc(w)+"</span>":(v===false?"<span class=n>\u2717 no "+esc(w)+"</span>":"<span class=u>"+esc(w)+": not known</span>")}).join("")+"</div>"}
// "estimated left" - only when the API sends it, and always as an estimate (spec: T minus R, rounded; never "available")
function estimate(r,st){var x=r.estimated_left!=null?r.estimated_left:r.estimate_left;if(x==null||x===false)return "";
  var about=typeof x==="object"?x.about:x,of=typeof x==="object"?x.of:null;if(about==null||!isFinite(+about))return "";
  var w=st.beds==="studio"?"studios":(st.beds==="3"?"homes of 3 or more bedrooms":st.beds+"-bedroom homes");
  return "<div class=est><b>ESTIMATE, NOT A COUNT</b>About "+esc(about)+(of!=null?" of "+esc(of):"")+" "+esc(w)+" here have no tenancy running on the government rent register today. Owners living in their own homes and renewals not yet registered are in that number, so the real figure is lower. The leasing team confirms what is free.</div>"}
function gaps(r){var c=r.completeness||{},g=[];if(c.photos===false)g.push("photos to follow");if(c.layouts===false)g.push("no layout plans yet");if(c.record===false)g.push("not yet in the building record");return g}
function rowHtml(r,i,st){var on=!!SEL[r.key],dn=r.district_name||DN[r.district]||r.district||"",al=(r.aliases||[]).length?" \u00b7 also filed as "+(r.aliases.slice(0,2).join(", "))+(r.aliases.length>2?" and "+(r.aliases.length-2)+" more":""):"";
  var link=r.building_url?" <a href=\""+esc(r.building_url+(r.building_url.indexOf("?")>=0?"&":"?")+"key="+encodeURIComponent(KEY)+RKQ)+"\">building page \u2197</a>":"";
  var g=gaps(r),why=(r.why?r.why:"")+(g.length?(r.why?" \u00b7 ":"")+g.join(" \u00b7 "):"");
  return "<div class=\"row"+(on?"":" off")+"\" id=row"+i+"><label class=pk><input type=checkbox data-ix="+i+(on?" checked":"")+" aria-label=\"choose "+esc(r.name)+"\"></label><div class=rb>"
    +"<div class=r1><span class=rk>"+esc(r.rank!=null?r.rank:i+1)+"</span><span class=nm>"+esc(r.name)+"</span>"+(VERD[r.verdict]?"<span class=\"vd v-"+esc(r.verdict)+"\">"+esc(VERD[r.verdict])+"</span>":"")+"</div>"
    +"<div class=r2>"+esc(dn+al)+"</div>"+money(r,st)+facts(r)+musts(r,st)+estimate(r,st)
    +((why||link)?"<div class=r5>"+esc(why)+link+"</div>":"")+"</div></div>"}
function drawRes(){var st=LAST,rs=RES.results||[],tot=RES.total_matched!=null?RES.total_matched:rs.length;
  if(!rs.length){$("bres").innerHTML="<div class=rh>Nothing matched "+esc(summary(st))+".</div><div class=nt>Try a wider budget, another district or two, or fewer must-haves. A building needs at least three recorded "+(st.mode==="rent"?"lettings":"sales")+" to be listed.</div>"+notes();$("bout").hidden=true;$("bpill").hidden=true;return}
  $("bres").innerHTML="<div class=rh><b>"+tot+"</b> buildings match \u00b7 the best "+rs.length+" below<br>"+esc(summary(st))+"</div>"
    +"<div class=sa><span id=bcount></span><button type=button id=ball>choose all</button><button type=button id=bnone>clear</button></div>"
    +rs.map(function(r,i){return rowHtml(r,i,st)}).join("")+notes();
  each($("bres").querySelectorAll("input[type=checkbox]"),function(cb){cb.onchange=function(){var r=rs[+cb.getAttribute("data-ix")];if(!r)return;SEL[r.key]=!!cb.checked;var row=$("row"+cb.getAttribute("data-ix"));if(row)row.classList.toggle("off",!cb.checked);counts()}});
  $("ball").onclick=function(){each(rs,function(r){SEL[r.key]=true});drawRes()};$("bnone").onclick=function(){SEL={};drawRes()};
  $("bout").hidden=false;$("shbox").hidden=true;omsg("");counts()}
function notes(){var n=(RES&&RES.notes)||[],src=[];if(RES&&RES.as_of)src.push("evidence as of "+day(RES.as_of));
  var t=(LAST&&LAST.mode==="buy")?"What homes here actually sold for, from the Land Department\u2019s registered sales":"What homes here actually let for, from registered tenancy contracts (Ejari, Dubai\u2019s rent register)";
  return "<div class=nt>"+esc(t)+". This is not a list of homes on the market today: the leasing or sales team confirms what is free."+(n.length?"<br>"+n.map(esc).join("<br>"):"")+(src.length?"<br>"+esc(src.join(" \u00b7 ")):"")+"</div>"}
function counts(){var n=chosen().length;var c=$("bcount");if(c)c.textContent=n+" chosen";$("ochosen").textContent=n?n+" chosen":"none chosen";
  var p=$("bpill");p.hidden=!RES||!(RES.results||[]).length;p.textContent=n+" chosen \u00b7 what to send \u2193"}

// ---- the outputs (Contract B: GET /brief_pdf) ----
function omsg(t){$("omsg").textContent=t||""}
function need(n){omsg(n>1?"Tick at least "+n+" buildings in the list first.":"Tick at least one building in the list first.");return false}
function pdfUrl(kind,keys){var st=LAST;return "/brief_pdf?key="+encodeURIComponent(KEY)+"&kind="+kind+"&keys="+keys.map(encodeURIComponent).join(",")+"&mode="+st.mode+"&beds="+st.beds+"&min="+(st.min||0)+(st.max?"&max="+st.max:"")}
function fileName(kind,keys){var r=byKey(keys[0]),n=String((r&&r.name)||"list").replace(/[^A-Za-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40);
  return "Najma-"+(kind==="dossier"?n:(kind==="pack"?"full-pack":"compare-"+keys.length))+".pdf"}
function job(kind,keys,label){var u=pdfUrl(kind,keys);
  for(var id in JOBS){var o=JOBS[id];if(o.url===u&&(o.state==="wait"||o.state==="run")){jobDraw(o,"This one is already being made.");return o}}
  var j={id:"job"+(++JN),kind:kind,keys:keys,label:label,url:u,state:"wait",t0:0,blob:null,href:null};JOBS[j.id]=j;
  var d=document.createElement("div");d.className="job";d.id=j.id;$("jobs").appendChild(d);jobDraw(j);QUEUE.push(j);pump();return j}
function pump(){while(RUNNING<2&&QUEUE.length)start(QUEUE.shift())}
function start(j){RUNNING++;j.state="run";j.t0=Date.now();jobDraw(j);
  j.tick=setInterval(function(){if(j.state==="run")jobDraw(j)},1000);
  fetchT(j.url,PDF_WAIT[j.kind]||120000).then(function(r){if(!r.ok)return r.text().then(function(t){throw {status:r.status,text:t}},function(){throw {status:r.status}});
      var ct=(r.headers&&r.headers.get&&r.headers.get("content-type"))||"";if(ct.indexOf("pdf")<0)throw {notpdf:true};return r.blob()})
    .then(function(b){if(!b||!b.size)throw {empty:true};j.blob=b;try{j.href=URL.createObjectURL(b)}catch(e){j.href=null}j.state="ok";done(j)},
          function(e){j.state="bad";j.err=e||{};done(j)})}
function done(j){clearInterval(j.tick);RUNNING--;jobDraw(j);pump()}
function why(e){if(e.timeout)return "It is taking longer than it should, so this page stopped waiting. Try again, or choose fewer buildings.";
  if(e.status===404)return "The document maker is not switched on yet.";if(e.status===401)return "The link\u2019s key was not accepted.";
  if(e.status===429||e.status===503)return "The document maker is busy. Wait a moment and try again.";
  if(e.status===504||e.status===524)return "It took too long on the server. Try again, or choose fewer buildings.";
  if(e.status)return "It did not come through (error "+e.status+")."+(e.text&&e.text.length<140&&!/</.test(e.text)?" "+e.text:"");
  if(e.notpdf)return "Something came back, but it was not a PDF.";if(e.empty)return "The PDF came back empty.";
  return "No connection. Check the signal and try again."}
function jobDraw(j,extra){var d=$(j.id);if(!d)return;var s=Math.round((Date.now()-(j.t0||Date.now()))/1000),st,acts="";
  if(j.state==="wait")st="Waiting its turn\u2026";
  else if(j.state==="run")st="Making the PDF\u2026 "+s+" s"+(s>=25?" \u2014 still working, "+(j.kind==="pack"?"a full pack can take a couple of minutes":"a map can take a minute"):"");
  else if(j.state==="ok"){st="Ready.";acts=(j.href?"<a class=p href=\""+esc(j.href)+"\" target=_blank rel=noopener download=\""+esc(fileName(j.kind,j.keys))+"\">Open the PDF</a>":"<a class=p href=\""+esc(j.url)+"\" target=_blank rel=noopener>Open the PDF</a>")+(canShareFile()?"<button type=button data-a=send>Send it</button>":"")}
  else {st=why(j.err||{});acts="<button type=button class=p data-a=retry>Try again</button><a href=\""+esc(j.url)+"\" target=_blank rel=noopener>Open it directly</a>"}
  d.className="job"+(j.state==="bad"?" bad":(j.state==="ok"?" ok":""));
  d.innerHTML="<div class=jt>"+esc(j.label)+"</div><div class=js>"+esc(st)+(extra?" "+esc(extra):"")+"</div>"+(acts?"<div class=ja>"+acts+"</div>":"");
  each(d.querySelectorAll("button"),function(b){var a=b.getAttribute("data-a");b.onclick=function(){if(a==="retry"){j.state="wait";j.err=null;jobDraw(j);QUEUE.push(j);pump()}else if(a==="send")sendFile(j)}})}
function canShareFile(){try{return !!(navigator.canShare&&typeof File!=="undefined"&&navigator.canShare({files:[new File([""],"a.pdf",{type:"application/pdf"})]}))}catch(e){return false}}
function sendFile(j){try{var f=new File([j.blob],fileName(j.kind,j.keys),{type:"application/pdf"});navigator.share({files:[f],title:j.label}).catch(function(){jobDraw(j,"Not sent.")})}catch(e){jobDraw(j,"This phone cannot send it from here: open it, then share.")}}
function outWire(){
  $("o-ind").onclick=function(){var ks=chosen();if(!ks.length)return need(1);var over=ks.length>10;if(over)ks=ks.slice(0,10);
    each(ks,function(k){var r=byKey(k);job("dossier",[k],(r?r.name:k)+" \u2014 its own PDF")});omsg((over?"The first 10 chosen, ":"")+ks.length+(ks.length===1?" PDF":" PDFs, one per building,")+" on the way. Each is ready to open or send on its own.")};
  $("o-c5").onclick=function(){cmp(5)};$("o-c10").onclick=function(){cmp(10)};
  $("o-pack").onclick=function(){var ks=chosen();if(!ks.length)return need(1);var over=ks.length>10;if(over)ks=ks.slice(0,10);job("pack",ks,"Full pack \u2014 "+ks.length+" buildings");omsg((over?"The pack takes the first 10 chosen. ":"")+"The full pack is on the way. It is the biggest, so it takes the longest.")};
  $("o-share").onclick=share;$("shcopy").onclick=function(){copy($("shurl").value)}}
function cmp(n){var ks=chosen();if(ks.length<2)return need(2);var cut=ks.length>n;ks=ks.slice(0,n);job("compare",ks,"Compare "+ks.length+" \u2014 one sheet and a map");omsg(cut?"Compare "+n+" takes the first "+n+" you chose, in the order of the list.":"")}
function shareUrl(){var ks=chosen();return location.origin+"/brief?"+qs(LAST,SKEY||null)+"&run=1"+(ks.length?"&pick="+ks.map(encodeURIComponent).join(","):"")}
function share(){if(!RES||!LAST)return omsg("Make a list first.");var u=shareUrl(),t=summary(LAST)+" \u2014 the buildings that fit:";
  $("shurl").value=u;$("shbox").hidden=false;$("shwa").href="https://wa.me/?text="+encodeURIComponent(t+" "+u);
  var warn=SKEY?"":" This link carries no client key yet, so it will not open on someone else\u2019s phone.";
  if(navigator.share){navigator.share({title:"The brief \u2014 Najma",text:t,url:u}).then(function(){omsg("Sent."+warn)},function(){omsg("Not sent. The link is below to copy."+warn)});return}
  copy(u,warn)}
function copy(u,warn){warn=warn||"";var box=$("shurl");
  function sel(){try{box.focus();box.select()}catch(e){}omsg("The link is below: press and hold it to copy."+warn)}
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(u).then(function(){omsg("Link copied. Paste it into WhatsApp or an email."+warn)},sel);else sel()}

// ---- wiring ----
segWire("fmode",function(v){if(v!==ST.mode){ST.mode=v;ST.min=0;ST.max=0;$("fmin").value="";$("fmax").value="";drawPresets()}});
segWire("fbeds",function(v){ST.beds=v});segWire("ftype",function(v){ST.type=v});segWire("flim",function(v){ST.limit=+v});
each($("fdl").querySelectorAll("button"),function(b){b.onclick=function(){var s=b.getAttribute("data-s"),i=ST.areas.indexOf(s);if(i>=0)ST.areas.splice(i,1);else ST.areas.push(s);draw()}});
$("fany").onclick=function(){ST.areas=[];$("fdq").value="";filterD();draw()};
$("fdq").oninput=filterD;
each($("fmust").querySelectorAll("button"),function(b){b.onclick=function(){var v=b.getAttribute("data-v"),i=ST.musts.indexOf(v);if(i>=0)ST.musts.splice(i,1);else ST.musts.push(v);draw()}});
$("fmin").onchange=$("fmax").onchange=function(){var e=readBudget();msg(e&&e.indexOf("number")>=0?e:"");draw()};
$("fgo").onclick=run;
$("bpill").onclick=function(){var o=$("bout");if(o&&o.scrollIntoView)o.scrollIntoView({behavior:"smooth",block:"start"})};
outWire();
applyQ(B.q);drawPresets();draw();
(window.__qnParts=window.__qnParts||[]).push(function(){return LAST?{filters:{brief:summary(LAST),chosen:chosen().length}}:{}});
window.__brief={state:ST,run:run,chosen:function(){return chosen()},jobs:JOBS,parseAed:parseAed,summary:summary,qs:qs};
if(B.q&&B.q.run)run();
})();
`;
