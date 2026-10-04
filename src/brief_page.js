// THE BRIEF - part B, the screens (30 Sep 2026; v277 stepped flow, 1 Oct 2026).
//
// A client of Naj's asked "three options in JVC, one bedroom, AED 65K rent" and answering it took a session of hand work.
// Kendall: that must be what START does - pick from drop-downs, get the list, then choose the outputs.
//
// v277 (Kendall, 1 Oct 2026, after seeing v275 live): "get rid of all those questions ... this way in needs to just start
// with: they want to rent, they want to buy ... very simple, very clean, and then it moves into filling that information in."
//   - the /start "00" card is two big buttons, THEY WANT TO RENT / THEY WANT TO BUY, and nothing else
//   - /brief is one question per screen, with Back and a progress marker: rent or buy (skipped when the button chose it) ->
//     bedrooms -> budget -> where -> must-haves (optional, Skip) -> SHOW ME THE BUILDINGS
//   - home type and how-many are no longer asked: Any and 10, with "Show 20 / Show 50" as a small link under the list
//   - the register "left" estimate is no longer on the client face. Where a DEVELOPER'S OWN SHEET names the building, the row
//     says "Available now, per <developer>'s sheet of <date>: N one-bedrooms"; otherwise nothing - no placeholder, no "to follow"
//
// This module owns:
//   - briefStartCard()  the "00 - THEY TELL YOU WHAT THEY WANT" way in, drawn above the five angles on /start
//   - briefRoutes()     GET /brief: the steps, the ranked list (from GET /brief_api, Contract A) and the output buttons
//                       (GET /brief_pdf, Contract B). Both endpoints are built elsewhere; this page codes against the contract.
//
// The page script is a String.raw block with no ${} and no backticks, served inline and checked with node --check by
// test/test_brief_page.mjs. It is NOT Function.toString(): wrangler bundles with keepNames, which writes __name(...) calls
// into function bodies that do not exist in the browser.
//
// Rules the page keeps:
//   - no click does nothing (v273): every output button either starts a job with a visible status, or says why it cannot
//   - a slow or failed PDF says so in words, with Try again and a direct link; it never sits silent
//   - availability on screen is the developer's own sheet, dated and named, or nothing; the register estimate never mixes in
//   - a shared link carries the CLIENT key, never the owner key (clientLinkKey, v239.1), and restores the whole brief
//   - plain English on the screen: no unexplained acronyms

//
// v282 (Kendall, 1 Oct 2026, approved): two real client briefs ("a furnished 2-3 bedroom townhouse, AED 240K, up to 300K for a modern
// home; private pool preferred; pet-friendly must" and "Arabian Ranches vs DAMAC Hills, furnished apartment, her dog, pools and parks").
//   - bedrooms are several (2 and 3); the kind of home (apartment / townhouse / villa / any) is asked on the same screen
//   - the budget is a target plus an optional "stretch up to"; the list labels in budget / stretch / a little over / over
//   - furnished is its own step; it is "not known" on every home a client sees (the rent register does not record it); the OWNER
//     key alone sees what listing-site adverts say (furnished_hint from /brief_api), never a client
//   - must / nice to have / don't care for each criterion; each row shows yes / no / not known per criterion, with the source folded
//     under it; not known never leaves a home out
//   - Where: picking 2 or 3 areas shows ONE switch, "Compare these areas side by side", on by default; the results then open with
//     the comparison block (one column per area, stacked on a phone) and the homes in one tab per area
//   - Arabian Ranches is offered through its Land Department areas (EXTRA_AREAS in src/brief.js), not as an app district
//   - the search and each PDF retry ONCE on a timeout or a dropped connection, saying "Still working..." while they do
import { BRIEF_CRITERIA, EXTRA_AREAS } from "./brief.js";
import { labelledName } from "./community_labels.js";   // v307 - community name next to the Land Department name
import { AMENITY_CARDS_CSS, AMENITY_CARDS_JS } from "./amenity_cards.js";   // v290 AMENITY CARDS - the cards above the homes list
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
  palmdeira: "deira islands", sobhaheartland: "hartland", bukadra: "hartland 2 ii", alyufrah1: "valley", dubaimarina: "marina",
  damachills: "damac hills", wadialsafa5: "arabian ranches 3 villanova", wadialsafa6: "arabian ranches", wadialsafa7: "arabian ranches 2 serena rukan sustainable city"
};
const CORRIDOR_ORDER = ["New Dubai", "Coast", "Downtown & Creek", "Meydan & MBR", "South & Outer", "Other"];
const CORRIDOR_SAY = { "Meydan & MBR": "Meydan & Mohammed Bin Rashid City" };

// v282: the client's criteria (Contract A's list, src/brief.js), each asked three ways: must / nice to have / don't care
export const BRIEF_WANTS = BRIEF_CRITERIA;
// v287 (Kendall, 1 Oct 2026: "add icons or emojis"): one emoji per must-have, on the page only (the PDF and API keep plain words)
const WANT_ICON = { private_pool: "🏊", community_pool: "🌊", pets: "🐕", modern: "✨", long_term: "🗓️", metro: "🚇", schools: "🏫", gym: "🏋️", parking: "🅿️", balcony: "🌇" };
const WANT_KEYS = BRIEF_WANTS.map((m) => m[0]);
const WANT_ALIAS = { pool: "community_pool", new: "modern" };   // a v277 link's chips
const BEDS = ["studio", "1", "2", "3"];
const TYPES = ["apartment", "townhouse", "villa", "any"];
const FURN = ["furnished", "unfurnished", "either"];

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// JSON for an inline <script>: nothing in the data can close the tag or break the line
const safeJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

// The query, as a shared link carries it. Anything malformed is dropped rather than guessed at.
// v282: bedrooms and home type are lists; a target (max) and an optional stretch; furnished; musts and nice-to-haves; compare.
export function briefQuery(sp) {
  const g = (k) => String(sp.get(k) || "").trim();
  const num = (v) => { const n = Math.round(Number(String(v).replace(/[^0-9.]/g, ""))); return v !== "" && isFinite(n) && n > 0 ? n : 0; };
  const list = (v) => v.split(",").map((x) => x.trim()).filter(Boolean);
  const modeSet = g("mode") === "buy" || g("mode") === "rent";                  // the /start button chose it: step 1 is skipped
  const mode = g("mode") === "buy" ? "buy" : "rent";
  let beds = [...new Set(list(g("beds")).filter((b) => BEDS.includes(b)))];
  if (!beds.length) beds = ["1"];
  beds.sort((a, b) => BEDS.indexOf(a) - BEDS.indexOf(b));
  let types = [...new Set(list(g("type")).filter((t) => TYPES.includes(t)))];
  if (!types.length || types.includes("any")) types = ["any"];
  let min = num(g("min")), max = num(g("max")), stretch = num(g("stretch"));
  if (min && max && min > max) { const t = min; min = max; max = t; }
  if (!max || stretch <= max) stretch = 0;
  const furnished = FURN.includes(g("furnished")) ? g("furnished") : "either";
  const areas = list(g("areas").toLowerCase()).filter((s) => /^[a-z0-9]{2,40}$/.test(s)).slice(0, 44);
  const wants = (k) => list(g(k)).map((m) => WANT_ALIAS[m] || m).filter((m) => WANT_KEYS.includes(m));
  const musts = [...new Set(wants("musts"))], nice = [...new Set(wants("nice"))].filter((m) => !musts.includes(m));
  let limit = parseInt(g("limit"), 10); limit = isFinite(limit) ? Math.max(1, Math.min(50, limit)) : 10;
  const pick = list(g("pick")).filter((k) => k.length <= 160).slice(0, 50);
  return { mode, modeSet, beds, bedsSet: !!g("beds"), types, min, max, stretch, furnished, areas, compare: g("compare") !== "0", musts, nice, limit, pick, run: g("run") === "1" };
}

async function briefDistricts(env) {
  let rows = null;
  try {
    const raw = env && env.MEETINGS ? await env.MEETINGS.get("img_districts_geo") : null;   // read only
    const d = raw ? JSON.parse(raw) : null;
    if (d && Array.isArray(d.districts) && d.districts.length >= 10) rows = d.districts.filter((x) => x && x.slug && x.name).map((x) => [x.slug, x.name, x.corridor || "Other"]);
  } catch (e) { rows = null; }
  if (!rows) rows = BRIEF_DISTRICTS;
  // v282 - the areas the rent register covers that are not app districts (Arabian Ranches, by its Land Department areas)
  for (const [s, x] of Object.entries(EXTRA_AREAS)) if (!rows.some((r) => r[0] === s)) rows = rows.concat([[s, x.name, x.corridor]]);
  return rows.filter((r) => !NOT_A_DISTRICT.has(r[0])).map((r) => ({ s: r[0], n: labelledName(r[0], NAME_FIX[r[0]] || r[1]), c: CORRIDOR_ORDER.includes(r[2]) ? r[2] : "Other" }));
}


// ---- /start: the new first way in ----------------------------------------------------------------------------------
// v277: two big buttons and nothing else. Drawn with the /start page's own classes (.ang) so it sits with the five below it.
// A <div>, not an <a>, because it holds two links of its own and a link inside a link is not allowed.
export function briefStartCard(key, rk, icon) {
  const q = "key=" + encodeURIComponent(key || "") + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  const go = (m, label) => '<a class="go big" href="/brief?mode=' + m + "&amp;" + esc(q) + '">' + label + " \u2192</a>";
  return '<div class="ang brief0" id=brief0><div class=tg>' + (icon || "") + "<b>00</b><span>THEY TELL YOU WHAT THEY WANT</span></div>"
    + '<div class=two>' + go("rent", "THEY WANT TO RENT") + go("buy", "THEY WANT TO BUY") + "</div></div>";
}
// the two-button card's own rules, added to the /start page's stylesheet by index.js
export const BRIEF_START_CSS = '.brief0 .two{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}'
  + '.brief0 .go.big{display:flex;align-items:center;justify-content:center;min-height:64px;margin:0;padding:10px 8px;border-radius:10px;font-size:.78rem;letter-spacing:.06em;font-weight:600;text-decoration:none;text-align:center;line-height:1.3}'
  + '@media (max-width:360px){.brief0 .two{grid-template-columns:1fr}}';

// ---- the page ------------------------------------------------------------------------------------------------------
const BRIEF_CSS = 'body{background:#0C1413;color:#E8E4D8;font-family:"IBM Plex Sans",system-ui,sans-serif;margin:0;padding:14px 14px 150px;max-width:560px;margin-inline:auto;-webkit-text-size-adjust:100%}'
  + '*{box-sizing:border-box}button{font:inherit;color:inherit}'
  + '.bk{display:inline-block;color:#8FA39B;text-decoration:none;font-family:"IBM Plex Mono",monospace;font-size:.64rem;letter-spacing:.1em;margin:0 0 8px}'
  + '.h{font-family:Fraunces,Georgia,serif;font-size:1.7rem;font-weight:600;margin:.1rem 0 .1rem;line-height:1.15}.h em{font-style:normal;color:#C5A56A}'
  + '.s{color:#8FA39B;font-size:.84rem;line-height:1.5;margin:0 0 14px}'
  + '.card{background:#101D1B;border:1px solid #24352F;border-left:3px solid #C5A56A;border-radius:12px;padding:12px 13px;margin:0 0 12px}'
  + '.prog{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:0 0 10px}.prog .pt{font-family:"IBM Plex Mono",monospace;font-size:.6rem;letter-spacing:.11em;color:#8FA39B}'
  + '.prog .dots{display:flex;gap:5px}.prog .dots i{width:18px;height:4px;border-radius:2px;background:#24352F}.prog .dots i.on{background:#C5A56A}.prog .dots i.done{background:#3E8A7E}'
  + '.prog button{background:none;border:1px solid #2E4540;border-radius:999px;color:#C8D3CE;font-family:"IBM Plex Mono",monospace;font-size:.62rem;letter-spacing:.08em;padding:6px 12px;min-height:34px;cursor:pointer}'
  + '.q{font-family:Fraunces,Georgia,serif;font-size:1.35rem;font-weight:600;color:#F0E4C8;line-height:1.2;margin:2px 0 10px}.q em{font-style:normal;color:#C5A56A}'
  + '.step[hidden]{display:none}'
  + '.lb{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-family:"IBM Plex Mono",monospace;font-size:.62rem;letter-spacing:.11em;color:#8FA39B;margin:12px 0 7px}.lb:first-child{margin-top:0}.lb b{color:#C5A56A;font-weight:500;letter-spacing:.03em;text-align:right}'
  + '.seg{display:flex;gap:8px;flex-wrap:wrap}.seg button,.chip{flex:1 1 auto;min-height:42px;border:1px solid #2E4540;background:#0E1918;border-radius:9px;padding:8px 10px;font-size:.86rem;cursor:pointer;-webkit-tap-highlight-color:transparent}'
  + '.seg.big button{min-height:64px;font-size:1rem;font-weight:500;flex:1 1 45%}'
  + '.seg button.on,.chip.on{background:#C5A56A;border-color:#C5A56A;color:#0C1413;font-weight:600}'
  + '.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{flex:0 1 auto;min-height:38px;font-size:.8rem;border-radius:999px;padding:7px 12px}'
  + '.bud{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin:8px 0 0}.bud span{color:#8FA39B;font-size:.8rem}'
  + '.in{width:100%;min-height:44px;background:#0E1918;border:1px solid #2E4540;border-radius:9px;color:#E8E4D8;padding:9px 11px;font-size:16px;font-family:inherit}.in:focus{outline:2px solid #C5A56A;outline-offset:1px}'
  + '.hint{color:#6F837D;font-size:.72rem;line-height:1.45;margin:6px 0 0}'
  + '.dl{max-height:260px;overflow:auto;margin:8px 0 0;padding:2px 0;border-top:1px solid #1B2E2A}.dg{font-family:"IBM Plex Mono",monospace;font-size:.56rem;letter-spacing:.1em;color:#6F837D;margin:9px 0 5px;text-transform:uppercase}'
  + '[hidden]{display:none!important}'
  + '.go{display:block;width:100%;min-height:50px;margin:14px 0 0;border:0;border-radius:10px;background:#C5A56A;color:#0C1413;font-family:"IBM Plex Mono",monospace;font-size:.84rem;letter-spacing:.06em;font-weight:600;cursor:pointer}'
  + '.go.soft{background:#0E1918;color:#C8D3CE;border:1px solid #2E4540;margin-top:8px;min-height:44px;font-weight:500}'
  + '.msg{color:#E0A080;font-size:.8rem;line-height:1.45;margin:8px 0 0}.msg:empty{display:none}'
  + '.sum{display:flex;justify-content:space-between;align-items:center;gap:10px;background:#101D1B;border:1px solid #24352F;border-radius:12px;padding:10px 13px;margin:0 0 4px;font-size:.8rem;line-height:1.4;color:#C8D3CE}.sum button{flex:0 0 auto;background:none;border:1px solid #2E4540;border-radius:999px;color:#C5A56A;font-family:"IBM Plex Mono",monospace;font-size:.62rem;letter-spacing:.08em;padding:6px 12px;min-height:34px;cursor:pointer}'
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
  + '.av{margin:8px 0 0;border:1px solid #3E8A7E;border-radius:9px;padding:7px 9px;font-size:.78rem;line-height:1.45;color:#D8EFE6}.av b{font-family:"IBM Plex Mono",monospace;font-size:.6rem;letter-spacing:.1em;color:#8FD3B9;display:block}.av small{display:block;color:#8FA39B;font-size:.68rem;margin-top:2px}'
  + '.r5{color:#6F837D;font-size:.72rem;line-height:1.45;margin:7px 0 0}.r5 a{color:#C5A56A;text-decoration:none;white-space:nowrap}'
  + '.more{text-align:center;font-family:"IBM Plex Mono",monospace;font-size:.66rem;letter-spacing:.08em;color:#8FA39B;margin:4px 0 10px}.more a{color:#C5A56A;text-decoration:none;padding:6px 8px;cursor:pointer}'
  + '.nt{color:#6F837D;font-size:.72rem;line-height:1.5;border:1px dashed #24352F;border-radius:9px;padding:9px 11px;margin:10px 0 0}'
  + '.out{background:#101D1B;border:1px solid #3B584F;border-radius:12px;padding:12px 13px;margin:16px 0 0}.out .lb{margin:0 0 9px}'
  + '.ob{display:grid;grid-template-columns:1fr 1fr;gap:7px}.ob button{min-height:48px;border:1px solid #C5A56A;background:#0E1918;color:#E8E4D8;border-radius:10px;padding:8px;font-size:.82rem;line-height:1.25;cursor:pointer;text-align:center}'
  + '.ob button small{display:block;color:#8FA39B;font-size:.66rem;margin-top:2px}.ob .pri{grid-column:1/-1;background:#C5A56A;color:#0C1413;font-weight:600}.ob .pri small{color:#3B3322}.ob .blk{border-color:#3E8A7E}'
  + '.shb{margin:10px 0 0}.shb .in{font-size:.8rem;font-family:"IBM Plex Mono",monospace}.shr{display:flex;gap:7px;margin:7px 0 0}.shr a,.shr button{flex:1;min-height:40px;display:flex;align-items:center;justify-content:center;border:1px solid #2E4540;border-radius:9px;background:#0E1918;color:#E8E4D8;text-decoration:none;font-size:.8rem;cursor:pointer}'
  + '.omsg{color:#E8D6AE;font-size:.78rem;line-height:1.45;margin:8px 0 0}.omsg:empty{display:none}'
  + '.job{border-top:1px solid #24352F;padding:9px 0 2px;margin:9px 0 0}.job .jt{font-size:.82rem;color:#F0E4C8}.job .js{font-size:.76rem;color:#8FA39B;margin:3px 0 0;line-height:1.45}.job.bad .js{color:#E0A080}.job.ok .js{color:#8FD3B9}'
  + '.ja{display:flex;flex-wrap:wrap;gap:7px;margin:7px 0 0}.ja a,.ja button{min-height:38px;display:inline-flex;align-items:center;border:1px solid #C5A56A;border-radius:9px;background:#0E1918;color:#E8E4D8;text-decoration:none;padding:6px 12px;font-size:.78rem;cursor:pointer}.ja .p{background:#C5A56A;color:#0C1413;font-weight:600}'
  + '.pill{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(66px + env(safe-area-inset-bottom));z-index:39;background:#C5A56A;color:#0C1413;border:0;border-radius:999px;padding:10px 18px;font-family:"IBM Plex Mono",monospace;font-size:.72rem;letter-spacing:.05em;font-weight:600;box-shadow:0 6px 18px rgba(0,0,0,.45);cursor:pointer;white-space:nowrap}';

// v282 additions: multi-choice chips, the stretch row, the three-way must-haves, the compare switch, the comparison block, area tabs,
// the criteria marks and their sources on each row, and the owner-only furnished hint
const BRIEF_CSS2 = '.seg.multi button{flex:1 1 20%}.hint2{color:#8FA39B;font-size:.74rem;margin:-2px 0 8px}'
  + '.str{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:center;margin:10px 0 0}.str span{color:#8FA39B;font-size:.78rem;white-space:nowrap}'
  + '.wr{display:flex;flex-direction:column;gap:5px;padding:8px 0;border-top:1px solid #1B2E2A}.wr:first-child{border-top:0}.wr .wl{font-size:.86rem;color:#E8E4D8}.ic{margin-right:6px;font-style:normal}'
  + '.w3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px}.w3 button{min-height:38px;border:1px solid #2E4540;background:#0E1918;border-radius:8px;font-size:.74rem;padding:5px 4px;cursor:pointer}'
  + '.w3 button.on[data-l=must]{background:#C5A56A;border-color:#C5A56A;color:#0C1413;font-weight:600}.w3 button.on[data-l=nice]{background:#3E8A7E;border-color:#3E8A7E;color:#0C1413;font-weight:600}.w3 button.on[data-l=no]{border-color:#8FA39B;color:#E8E4D8}'
  + '.sw{display:flex;align-items:center;gap:10px;width:100%;margin:12px 0 0;min-height:48px;border:1px solid #3E8A7E;border-radius:10px;background:#0E1918;padding:8px 12px;font-size:.86rem;text-align:left;cursor:pointer}'
  + '.sw i{flex:0 0 auto;width:38px;height:22px;border-radius:11px;background:#24352F;position:relative}.sw i:after{content:"";position:absolute;left:3px;top:3px;width:16px;height:16px;border-radius:8px;background:#8FA39B}'
  + '.sw.on i{background:#3E8A7E}.sw.on i:after{left:19px;background:#E8E4D8}'
  + '.cmp{background:#101D1B;border:1px solid #3B584F;border-radius:12px;padding:11px 12px;margin:10px 0 4px}.cmp .lb{margin:0 0 6px}'
  + '.cr{border-top:1px solid #24352F;padding:8px 0 6px}.cr .ct{font-family:"IBM Plex Mono",monospace;font-size:.6rem;letter-spacing:.09em;color:#C5A56A;margin:0 0 5px}'
  + '.cg{display:grid;gap:8px}.cc{font-size:.76rem;line-height:1.4;color:#D8E1DD;min-width:0}.cc b{display:block;font-size:.66rem;color:#8FA39B;font-weight:500;letter-spacing:.03em}.cc small{display:block;color:#6F837D;font-size:.64rem;margin-top:2px}'
  + '.mk{font-weight:600}.mk.y{color:#8FD3B9}.mk.n{color:#E0A0A0}.mk.u{color:#8FA39B;font-weight:400}'
  + '@media (max-width:520px){.cg{grid-template-columns:1fr!important}}'
  + '.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 8px}.tabs button{flex:1 1 auto;min-height:40px;border:1px solid #2E4540;background:#0E1918;border-radius:999px;padding:6px 12px;font-size:.78rem;cursor:pointer}.tabs button.on{background:#C5A56A;border-color:#C5A56A;color:#0C1413;font-weight:600}'
  + '.v-stretch{background:#3A3A1E;color:#E0D88A}'
  + 'details.cs{margin:6px 0 0;font-size:.68rem;color:#8FA39B;line-height:1.45}details.cs summary{cursor:pointer;color:#A9B7B2}details.cs div{margin:3px 0 0}'
  + '.fh{margin:7px 0 0;border:1px dashed #8A6A3A;border-radius:8px;padding:6px 8px;font-size:.72rem;color:#E8D6AE;line-height:1.4}.fh b{font-family:"IBM Plex Mono",monospace;font-size:.58rem;letter-spacing:.1em;color:#C5A56A;display:block}';

// One question per screen. Every step is in the markup; the script shows one at a time (a phone with a broken script would
// still show the whole form, top to bottom, rather than nothing).
// v282 (Kendall, 1 Oct 2026, approved): rent or buy -> bedrooms (several; the kind of home on the same screen) -> budget (a target and
// an optional "stretch up to") -> furnished -> where (with "Compare these areas side by side" when 2 or 3 are picked) -> must-haves
function briefFormHtml(districts) {
  const seg = (id, items, cls) => '<div class="seg' + (cls ? " " + cls : "") + '" id=' + id + ">" + items.map((x) => "<button type=button data-v=" + x[0] + ">" + (x[2] ? "<span class=ic aria-hidden=true>" + x[2] + "</span>" : "") + esc(x[1]) + "</button>").join("") + "</div>";
  const groups = CORRIDOR_ORDER.map((c) => {
    const ds = districts.filter((d) => d.c === c).sort((a, b) => a.n.localeCompare(b.n));
    if (!ds.length) return "";
    return '<div class=dgw><div class=dg>' + esc(CORRIDOR_SAY[c] || c) + "</div><div class=chips>"
      + ds.map((d) => "<button type=button class=chip data-s=" + esc(d.s) + ' data-f="' + esc((d.n + " " + d.s + " " + (SAID_AS[d.s] || "")).toLowerCase()) + '">' + esc(d.n) + "</button>").join("") + "</div></div>";
  }).join("");
  const step = (n, id, inner) => '<div class=step id=s-' + id + " data-n=" + n + ">" + inner + "</div>";
  return '<div class=card id=bform>'
    + '<div class=prog><button type=button id=fback>‹ BACK</button><span class=pt id=fstep></span><span class=dots id=fdots></span></div>'
    + step(1, "mode", '<div class=q>They want to…</div>' + seg("fmode", [["rent", "Rent", "🔑"], ["buy", "Buy", "🏠"]], "big"))
    + step(2, "beds", '<div class=q>How many <em>bedrooms</em>?</div><div class=hint2>Tap one or more.</div>' + seg("fbeds", [["studio", "Studio", "🛋️"], ["1", "1", "🛏️"], ["2", "2", "🛏️"], ["3", "3 or more", "🛏️"]], "big multi")
      + '<div class=lb>WHAT KIND OF HOME <b id=ftypev></b></div>' + seg("ftype", [["apartment", "Apartment", "🏢"], ["townhouse", "Townhouse", "🏘️"], ["villa", "Villa", "🏡"], ["any", "Any", "✨"]], "multi")
      + '<div class=hint>The rent register files townhouses and villas together; a townhouse is marked where the project name says so.</div>'
      + '<button type=button class=go id=fnextbd>NEXT →</button><div class=msg id=fmsgb role=alert></div>')
    + step(3, "budget", '<div class=q id=fbudq>What is the <em>budget</em>?</div><div class=lb><span id=fbudl>BUDGET</span><b id=fbudv></b></div><div class=chips id=fpre></div>'
      + '<div class=bud><input class=in id=fmin inputmode=decimal autocomplete=off placeholder="from (optional)" aria-label="lowest budget"><span>to</span><input class=in id=fmax inputmode=decimal autocomplete=off placeholder="target" aria-label="the target budget"></div>'
      + '<div class=str><span>stretch up to</span><input class=in id=fstr inputmode=decimal autocomplete=off placeholder="optional, e.g. 300k" aria-label="stretch up to"></div>'
      + '<div class=hint id=fbudh>Type it the way you say it: 65k, 1.2m or 65000. The stretch is the most they would pay for the right home.</div>'
      + '<button type=button class=go id=fnextb>NEXT →</button><div class=msg id=fmsg role=alert></div>')
    + step(4, "furn", '<div class=q>Furnished?</div>' + seg("ffurn", [["furnished", "Furnished", "🛋️"], ["unfurnished", "Unfurnished", "📦"], ["either", "Either", "🤝"]], "big")
      + '<div class=hint>The rent register does not record furnishing, so every home shows it as not known; the leasing team confirms it.</div>')
    + step(5, "where", '<div class=q>Where?</div><div class=lb>DISTRICTS <b id=fdsel>Anywhere in Dubai</b></div>'
      + '<div class=chips><button type=button class="chip on" id=fany>Anywhere in Dubai</button></div>'
      + '<input class=in id=fdq type=search autocomplete=off placeholder="find a district: JVC, Marina, Arabian Ranches…" style="margin-top:8px" aria-label="find a district">'
      + '<div class=dl id=fdl>' + groups + '<div class=hint id=fdnone hidden>No district by that name. Clear the search to see them all.</div></div>'
      + '<button type=button class="sw on" id=fcmp aria-pressed=true hidden><i></i><span>Compare these areas side by side</span></button>'
      + '<button type=button class=go id=fnextw>NEXT →</button>')
    + step(6, "musts", '<div class=q>What <em>matters</em> to them?</div><div class=lb>OPTIONAL <b id=fmustv></b></div><div id=fwant>'
      + BRIEF_WANTS.map((m) => "<div class=wr data-k=" + m[0] + "><div class=wl>" + (WANT_ICON[m[0]] ? "<span class=ic aria-hidden=true>" + WANT_ICON[m[0]] + "</span>" : "") + esc(m[1]) + "</div><div class=w3><button type=button data-l=must><span class=ic aria-hidden=true>⭐</span>Must</button><button type=button data-l=nice><span class=ic aria-hidden=true>👍</span>Nice to have</button><button type=button data-l=no>Don’t care</button></div></div>").join("") + "</div>"
      + '<div class=hint>A home is left out only where a record says no. Where nothing is known, it stays in, marked “not known”.</div>'
      + '<button type=button class=go id=fgo>SHOW ME THE HOMES →</button><button type=button class="go soft" id=fskip>Skip — nothing in particular</button><div class=msg id=fmsg2 role=alert></div>')
    + "</div>"
    + '<div class=sum id=bsum hidden><span id=bsumt></span><button type=button id=bedit>CHANGE</button></div>';
}

function briefOutHtml() {
  return '<div class=out id=bout hidden><div class=lb>WHAT TO SEND <b id=ochosen></b></div><div class=ob>'
    + '<button type=button class=pri id=o-ind>Individual PDFs<small>one per building, three pages each</small></button>'
    + '<button type=button id=o-share>Share this list<small>a link that opens this list</small></button>'
    + '<button type=button id=o-c5>Compare 5<small>one sheet and a map</small></button>'
    + '<button type=button id=o-c10>Compare 10<small>one sheet and a map</small></button>'
    + '<button type=button id=o-pack>Full pack<small>sheet, map, every building</small></button>'
    + '<button type=button class=blk id=o-blocks>See them in blocks<small>the chosen buildings, gold on their plots</small></button>'
    + '</div><div class=omsg id=omsg role=status></div>'
    + '<div class=shb id=shbox hidden><input class=in id=shurl readonly aria-label="the link to this list"><div class=shr><button type=button id=shcopy>Copy link</button><a id=shwa href="#" target=_blank rel=noopener>WhatsApp</a></div></div>'
    + '<div id=jobs></div></div>';
}

export function briefPageHtml(o) {
  const key = o.key || "", rk = o.rk || "";
  const boot = { key, shareKey: o.shareKey || "", rk, q: o.q, districts: o.districts.map((d) => ({ s: d.s, n: d.n })), wants: BRIEF_WANTS };
  return '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<title>The brief — Najma</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413"><meta name=robots content=noindex>' + (o.fonts || "")
    + "<style>" + BRIEF_CSS + BRIEF_CSS2 + AMENITY_CARDS_CSS + (o.navCss || "") + "</style></head><body>"
    + '<a class=bk href="/start?key=' + esc(encodeURIComponent(key)) + (rk ? "&amp;rk=" + esc(encodeURIComponent(rk)) : "") + '">‹ START</a>'
    + '<div class=h>The <em>brief</em></div>'
    + '<div class=s id=bsub>One question at a time. You get the homes that fit, ranked by what homes there actually let or sell for, then choose what to send.</div>'
    + briefFormHtml(o.districts)
    + '<div id=bres aria-live=polite></div>'
    + briefOutHtml()
    + '<button type=button class=pill id=bpill hidden></button>'
    + '<script>window.__BRIEF=' + safeJson(boot) + ";</script>"
    + "<script>" + BRIEF_JS + "</script>"
    + "<script>" + AMENITY_CARDS_JS + "</script>"   // v290 AMENITY CARDS
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
var MN={};(B.wants||[]).forEach(function(m){MN[m[0]]=m[1]});
var PRE={rent:[[0,50000,"up to 50k"],[50000,70000,"50k – 70k"],[70000,100000,"70k – 100k"],[100000,150000,"100k – 150k"],[150000,250000,"150k – 250k"],[250000,0,"250k and up"]],
 buy:[[0,1000000,"under 1M"],[1000000,1500000,"1M – 1.5M"],[1500000,2500000,"1.5M – 2.5M"],[2500000,5000000,"2.5M – 5M"],[5000000,0,"5M and up"]]};
var VERD={within:"in budget",stretch:"stretch",a_little_above:"a little over budget",above:"over budget",below:"under budget"};
var STEPS=["mode","beds","budget","furn","where","musts"],NSTEP=STEPS.length;
var ST={mode:"rent",beds:["1"],types:["any"],min:0,max:0,stretch:0,furnished:"either",areas:[],compare:true,musts:[],nice:[],limit:10};
var BDEF=!(B.q&&B.q.bedsSet);   // the "1 bedroom" a fresh page starts on is replaced by the first tap, not added to
var STEP=1,LAST=null,RES=null,SEL={},PICK=null,SEQ=0,JN=0,RUNNING=0,QUEUE=[],JOBS={},TAB=null;
var PDF_WAIT={dossier:100000,compare:120000,onesheet:100000,pack:170000};
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function each(list,fn){for(var i=0;i<list.length;i++)fn(list[i],i)}
function has(a,v){return a.indexOf(v)>=0}
function parseAed(s){s=String(s==null?"":s).toLowerCase().replace(/aed|,|\s/g,"");if(!s)return 0;var m=s.match(/^(\d+(?:\.\d+)?)(k|m|mn|million)?$/);if(!m)return NaN;var v=parseFloat(m[1]);if(m[2]==="k")v*=1e3;else if(m[2])v*=1e6;return Math.round(v)}
function fmtAed(v){v=+v;if(!isFinite(v))return "";if(v>=1e6)return "AED "+(v/1e6).toFixed(2).replace(/\.?0+$/,"")+"M";if(v>=1e3)return "AED "+Math.round(v/1e3)+"k";return "AED "+Math.round(v)}
function short(v){return v?fmtAed(v).replace("AED ",""):""}
function bedsWord(bs){var w=bs.map(function(b){return b==="studio"?"studio":(b==="3"?"3 or more":b)});if(bs.length===1)return bs[0]==="studio"?"studio":(bs[0]==="3"?"3 or more bedrooms":(bs[0]==="1"?"1 bedroom":bs[0]+" bedrooms"));
  var last=w.pop();return w.join(", ")+" or "+last+(bs[bs.length-1]==="studio"?"":" bedrooms")}
function typesWord(ts){if(has(ts,"any"))return "";return ", "+ts.join(" or ")}
function budText(st){var t;if(st.min&&st.max)t=fmtAed(st.min)+" to "+short(st.max);else if(st.max)t="up to "+fmtAed(st.max);else if(st.min)t=fmtAed(st.min)+" and up";else t="any budget";
  return t+(st.stretch&&st.max?" (stretch to "+short(st.stretch)+")":"")}
function perYear(st){return st.mode==="rent"?" a year":""}
function areasText(st){if(!st.areas.length)return "anywhere in Dubai";var n=st.areas.map(function(s){return DN[s]||s});return n.length>3?n.slice(0,3).join(", ")+" and "+(n.length-3)+" more":n.join(", ")}
function cmpOn(st){return !!st.compare&&st.areas.length>=2&&st.areas.length<=3}
function summary(st){return (st.mode==="rent"?"To rent":"To buy")+": "+bedsWord(st.beds)+typesWord(st.types)+", "+budText(st)+perYear(st)+(st.furnished==="either"?"":", "+st.furnished)+", "+areasText(st)+(cmpOn(st)?" side by side":"")
  +(st.musts.length?", must: "+st.musts.map(function(m){return MN[m]||m}).join(", "):"")+(st.nice.length?", nice to have: "+st.nice.map(function(m){return MN[m]||m}).join(", "):"")}
function qs(st,key){var p=[];if(key!=null)p.push("key="+encodeURIComponent(key));p.push("mode="+st.mode,"beds="+st.beds.join(","),"min="+(st.min||0));if(st.max)p.push("max="+st.max);if(st.stretch&&st.max)p.push("stretch="+st.stretch);
  p.push("areas="+st.areas.map(encodeURIComponent).join(","),"type="+st.types.join(","),"furnished="+st.furnished,"musts="+st.musts.join(","),"nice="+st.nice.join(","));if(cmpOn(st))p.push("compare=1");p.push("limit="+st.limit);return p.join("&")}
function clone(st){return {mode:st.mode,beds:st.beds.slice(),types:st.types.slice(),min:st.min,max:st.max,stretch:st.stretch,furnished:st.furnished,areas:st.areas.slice(),compare:st.compare,musts:st.musts.slice(),nice:st.nice.slice(),limit:st.limit}}
function day(d){var M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];d=String(d||"");return d.length>=10?(+d.slice(8,10))+" "+M[+d.slice(5,7)-1]+" "+d.slice(0,4):d}

// ---- the steps: one question per screen ----
function segOn(id,vals){each($(id).querySelectorAll("button"),function(b){b.classList.toggle("on",has(vals,b.getAttribute("data-v")))})}
function segWire(id,fn){each($(id).querySelectorAll("button"),function(b){b.onclick=function(){fn(b.getAttribute("data-v"));draw()}})}
function toggleIn(a,v){var i=a.indexOf(v);if(i>=0)a.splice(i,1);else a.push(v)}
function drawPresets(){var el=$("fpre");el.innerHTML=PRE[ST.mode].map(function(p,i){return "<button type=button class=chip data-ix="+i+">"+esc(p[2])+"</button>"}).join("");
  each(el.querySelectorAll("button"),function(b){b.onclick=function(){var p=PRE[ST.mode][+b.getAttribute("data-ix")];ST.min=p[0];ST.max=p[1];$("fmin").value=short(p[0]);$("fmax").value=short(p[1]);msg("");draw()}})}
function showStep(n){STEP=Math.max(1,Math.min(NSTEP,n));each(STEPS,function(s,i){$("s-"+s).hidden=(i+1)!==STEP});
  $("fback").hidden=STEP===1&&!RES;$("fstep").textContent="STEP "+STEP+" OF "+NSTEP;
  $("fdots").innerHTML=STEPS.map(function(s,i){return "<i class=\""+(i+1<STEP?"done":(i+1===STEP?"on":""))+"\"></i>"}).join("");
  $("bform").hidden=false;$("bsum").hidden=true;$("bsub").hidden=false;
  try{window.scrollTo(0,0)}catch(e){}}
function wantOf(k){return has(ST.musts,k)?"must":(has(ST.nice,k)?"nice":"no")}
function draw(){segOn("fmode",[ST.mode]);segOn("fbeds",ST.beds);segOn("ftype",ST.types);segOn("ffurn",[ST.furnished]);
  $("ftypev").textContent=has(ST.types,"any")?"Any":ST.types.join(", ");
  $("fbudl").textContent=ST.mode==="rent"?"RENT A YEAR (AED)":"PRICE (AED)";
  $("fbudq").innerHTML=ST.mode==="rent"?"What <em>rent</em> a year?":"What <em>price</em>?";
  $("fbudv").textContent=(ST.min||ST.max)?budText(ST)+perYear(ST):"";
  each($("fpre").querySelectorAll("button"),function(b){var p=PRE[ST.mode][+b.getAttribute("data-ix")];b.classList.toggle("on",!!p&&p[0]===ST.min&&p[1]===ST.max)});
  each($("fdl").querySelectorAll("button"),function(b){b.classList.toggle("on",ST.areas.indexOf(b.getAttribute("data-s"))>=0)});
  $("fany").classList.toggle("on",!ST.areas.length);$("fdsel").textContent=ST.areas.length?ST.areas.length+" chosen":"Anywhere in Dubai";
  var cm=$("fcmp");cm.hidden=!(ST.areas.length>=2&&ST.areas.length<=3);cm.classList.toggle("on",!!ST.compare);cm.setAttribute("aria-pressed",ST.compare?"true":"false");
  each($("fwant").querySelectorAll(".wr"),function(r){var k=r.getAttribute("data-k"),w=wantOf(k);each(r.querySelectorAll("button"),function(b){b.classList.toggle("on",b.getAttribute("data-l")===w)})});
  var nm=ST.musts.length+ST.nice.length;$("fmustv").textContent=nm?(ST.musts.length+" must, "+ST.nice.length+" nice to have"):"";}
function filterD(){var q=String($("fdq").value||"").toLowerCase().trim(),any=false;
  each($("fdl").querySelectorAll(".dgw"),function(g){var shown=0;each(g.querySelectorAll("button"),function(b){var hit=!q||String(b.getAttribute("data-f")||"").indexOf(q)>=0;b.hidden=!hit;if(hit)shown++});g.hidden=!shown;if(shown)any=true});
  $("fdnone").hidden=any}
function readBudget(){var a=parseAed($("fmin").value),b=parseAed($("fmax").value),s=parseAed($("fstr").value);
  if(isNaN(a)||isNaN(b)||isNaN(s))return "The budget has to be a number, like 65k, 1.2m or 65000.";
  if(a&&b&&a>b){var t=a;a=b;b=t;$("fmin").value=short(a);$("fmax").value=short(b)}
  ST.min=a;ST.max=b;ST.stretch=0;if(!a&&!b)return "Set a budget first: tap a range, or type the target.";
  if(s){if(!b)return "Set a target first; the stretch is what they would go up to above it.";if(s<=b)return "The stretch has to be above the target ("+fmtAed(b)+").";ST.stretch=s}
  if(ST.mode==="rent"&&(s||b||a)>5000000)return "That looks like a price to buy, not a yearly rent. Go back and choose Buy, or check the number.";
  return ""}
function msg(t){$("fmsg").textContent=t||"";$("fmsg2").textContent="";$("fmsgb").textContent=""}
function applyQ(q){if(!q)return;ST.mode=q.mode||"rent";ST.beds=(q.beds&&q.beds.length?q.beds:["1"]).slice();ST.types=(q.types&&q.types.length?q.types:["any"]).slice();ST.min=q.min||0;ST.max=q.max||0;ST.stretch=q.stretch||0;
  ST.furnished=q.furnished||"either";ST.areas=(q.areas||[]).filter(function(s){return !!DN[s]});ST.compare=q.compare!==false;ST.musts=(q.musts||[]).slice();ST.nice=(q.nice||[]).slice();ST.limit=q.limit||10;
  $("fmin").value=short(ST.min);$("fmax").value=short(ST.max);$("fstr").value=short(ST.stretch);PICK=q.pick&&q.pick.length?q.pick:null}
// the brief, folded to one line above the list, with CHANGE to reopen the steps
function fold(){$("bform").hidden=true;$("bsub").hidden=true;$("bsum").hidden=false;$("bsumt").textContent=summary(LAST||ST)}

// ---- the search (Contract A: GET /brief_api) ----
function fetchT(u,ms){var ac=typeof AbortController!=="undefined"?new AbortController():null,t=setTimeout(function(){if(ac)ac.abort()},ms);
  return fetch(u,ac?{signal:ac.signal,credentials:"same-origin"}:{credentials:"same-origin"}).then(function(r){clearTimeout(t);return r},function(e){clearTimeout(t);throw (e&&e.name==="AbortError")?{timeout:true}:e})}
// v282 (Kendall, 1 Oct): a dropped connection showed "The search took too long" while the live search answers in about 2 s. A timeout
// or a network error is retried ONCE, automatically, with "Still working..." on screen; an answer from the server (any status) is not.
function fetchRetry(u,ms,onRetry){return fetchT(u,ms).then(null,function(e){if(e&&e.status)throw e;if(onRetry)onRetry(e);return fetchT(u,ms)})}
function run(){var e=readBudget();if(e){msg(e);showStep(3);return}msg("");
  var st=clone(ST),my=++SEQ;LAST=st;fold();TAB=null;
  try{history.replaceState(null,"",location.pathname+"?"+qs(st,KEY)+RKQ+"&run=1")}catch(x){}
  $("bres").innerHTML="<div class=rh>Looking for "+esc(summary(st).replace(/^To (rent|buy): /,""))+"…</div>";
  $("bout").hidden=true;$("bpill").hidden=true;
  fetchRetry("/brief_api?"+qs(st,KEY),30000,function(){if(my===SEQ)$("bres").innerHTML="<div class=rh id=bwait>Still working… the connection dropped, trying once more.</div>"})
  .then(function(r){if(!r.ok)throw {status:r.status};return r.json()}).then(function(j){if(my!==SEQ)return;if(!j||!j.results)throw {bad:true};RES=j;pickDefault();drawRes()})
  .catch(function(err){if(my!==SEQ)return;RES=null;var t=err&&err.timeout?"The search took too long to answer, twice.":(err&&err.status===401?"This link’s key was not accepted. Open the app from a fresh link.":(err&&err.status===404?"The search is not switched on yet.":(err&&err.status?"The search did not answer (error "+err.status+").":(err&&err.bad?"The search answered with something this page cannot read.":"No connection to the search, after two tries. Check the signal."))));
    $("bres").innerHTML="<div class=rh>"+esc(t)+"</div><button type=button class=go id=bretry>TRY AGAIN</button>";$("bretry").onclick=run})}
function pickDefault(){var keep={};if(!PICK){each(chosen(),function(k){keep[k]=true})}SEL={};var rs=RES.results||[];if(PICK){each(rs,function(r){if(PICK.indexOf(r.key)>=0)SEL[r.key]=true});PICK=null;if(chosen().length)return}
  each(rs,function(r,i){if(i<10||keep[r.key])SEL[r.key]=true})}
function chosen(){var out=[];each((RES&&RES.results)||[],function(r){if(SEL[r.key])out.push(r.key)});return out}
function byKey(k){var f=null;each((RES&&RES.results)||[],function(r){if(r.key===k)f=r});return f}
function bedSay(b){return b===0||b==="0"?"studio":(+b>=3?"3-bed":b+"-bed")}
function money(r,st){var e=r.evidence||{},sale=e.basis==="dld_sales";
  var head=(sale?"typical price ":"typical rent ")+"<b>"+esc(fmtAed(e.median))+"</b>"+(sale?"":" a year")+(e.beds!=null&&st.beds.length>1?" · "+bedSay(e.beds):"");
  var mid=(e.q1&&e.q3)?" · middle half "+esc(short(e.q1))+" – "+esc(short(e.q3)):"";
  return "<div class=r3>"+head+mid+"</div>"}
function facts(r){var e=r.evidence||{},sale=e.basis==="dld_sales",p=[];
  if(e.say&&!sale)p.push(e.say);else if(e.n!=null)p.push(e.n+(sale?(e.n===1?" sale":" sales"):(e.n===1?" letting":" lettings"))+(e.n_new!=null&&!sale?" ("+e.n_new+" new)":""));
  if(e.window&&e.window.say&&!sale)p.push(e.window.say);
  if(e.home==="villa")p.push("villa or townhouse");if(e.beds_basis==="size_3plus")p.push("3 or more bedrooms, read from the size");
  if(e.sqm)p.push("about "+Math.round(e.sqm)+" m²");if(e.latest)p.push("latest "+day(e.latest));
  return p.length?"<div class=r4>"+esc(p.join(" · "))+"</div>":""}
function mark(v){return v===true?"<span class=\"mk y\">✓</span>":(v===false?"<span class=\"mk n\">✗</span>":"<span class=\"mk u\">not known</span>")}
// v282: the client's criteria, each with its answer and, folded underneath, where the answer comes from
function crits(r,st){var cs=r.criteria;
  if(!cs){var m=r.musts||{},keys=Object.keys(m).filter(function(k){return m[k]===true}).slice(0,4);if(!keys.length)return "";
    return "<div class=mu>"+keys.map(function(k){return "<span class=y>✓ "+esc(k)+"</span>"}).join("")+"</div>"}
  if(!cs.length)return "";
  var lab=function(c){return c.k==="furnished"?c.label:(MN[c.k]||c.label||c.k)};
  return "<div class=mu>"+cs.map(function(c){var w=lab(c)+(c.level==="must"?" (must)":"");return c.v===true?"<span class=y>✓ "+esc(w)+"</span>":(c.v===false?"<span class=n>✗ "+esc(w)+"</span>":"<span class=u>"+esc(w)+(c.community_fact?": the community's own - "+esc(c.community_fact.say):": not known")+"</span>")}).join("")+"</div>"
    +"<details class=cs><summary>where these answers come from</summary>"+cs.map(function(c){return "<div>"+esc(lab(c))+" — "+esc(c.src||"")+(c.detail?" "+esc(c.detail)+".":"")+"</div>"}).join("")+"</details>"}
// OWNER ONLY: the API sends furnished_hint to the owner key alone; a client page never receives it
function fhint(r){var h=r.furnished_hint;if(!h)return "";
  return "<div class=fh><b>OWNER ONLY · NEVER SENT TO A CLIENT</b>"+(h.none?"Furnished, from listing-site adverts: "+esc(h.none)+".":esc(h.furnished+" of "+h.of+" live adverts marked furnished"+(h.as_of?" ("+day(h.as_of)+")":"")+". Adverts, not homes free."))+"</div>"}
// DEVELOPER AVAILABILITY - only what the developer's own sheet says, named and dated; nothing where there is no sheet
function bedsCount(b,n){var one=n===1;var w=b==="studio"||b===0?(one?"studio":"studios"):(+b>=3?(one?"home of 3 or more bedrooms":"homes of 3 or more bedrooms"):(+b===1?(one?"one-bedroom":"one-bedrooms"):(one?"two-bedroom":"two-bedrooms")));return n+" "+w}
function avail(r,st){var a=r.developer_availability;if(!a||!a.count)return "";var e=r.evidence||{};var n=bedsCount(e.beds!=null?e.beds:st.beds[0],a.count);
  return "<div class=av><b>DEVELOPER AVAILABILITY</b>Available now, per "+esc(a.developer)+"’s sheet of "+esc(day(a.as_of))+": "+esc(n)+"."+(a.units&&a.units.length?"<small>"+esc(a.units.slice(0,6).map(function(u){return u.unit+(u.sqft?" · "+u.sqft+" sq ft":"")+(u.aed?" · "+fmtAed(u.aed):"")}).join(" / "))+(a.units.length>6?" …":"")+"</small>":"")+"<small>The developer’s own list, not the register"+(a.auto?" (read by machine; check before quoting)":"")+".</small></div>"}
function gaps(r){var c=r.completeness||{},g=[];if(c.photos===false)g.push("photos to follow");if(c.layouts===false)g.push("no layout plans yet");if(c.record===false)g.push("not yet in the building record");return g}
function rowHtml(r,i,st){var on=!!SEL[r.key],dn=r.district_name||DN[r.district]||r.district||"",al=(r.aliases||[]).length?" · also filed as "+(r.aliases.slice(0,2).join(", "))+(r.aliases.length>2?" and "+(r.aliases.length-2)+" more":""):"";
  var link=r.building_url?" <a href=\""+esc(r.building_url+(r.building_url.indexOf("?")>=0?"&":"?")+"key="+encodeURIComponent(KEY)+RKQ)+"\">building page ↗</a>":"";
  var g=gaps(r),why=(r.why?r.why:"")+(g.length?(r.why?" · ":"")+g.join(" · "):"");
  return "<div class=\"row"+(on?"":" off")+"\" id=row"+i+"><label class=pk><input type=checkbox data-ix="+i+(on?" checked":"")+" aria-label=\"choose "+esc(r.name)+"\"></label><div class=rb>"
    +"<div class=r1><span class=rk>"+esc(r.rank!=null?r.rank:i+1)+"</span><span class=nm>"+esc(r.name)+"</span>"+(VERD[r.verdict]?"<span class=\"vd v-"+esc(r.verdict)+"\">"+esc(VERD[r.verdict])+"</span>":"")+"</div>"
    +"<div class=r2>"+esc(dn+al)+"</div>"+money(r,st)+facts(r)+crits(r,st)+fhint(r)+avail(r,st)
    +((why||link)?"<div class=r5>"+esc(why)+link+"</div>":"")+"</div></div>"}
// v282: the comparison block - one column per area (stacked on a phone), every cell answered or "not known", with its source
function cell(c){if(!c)return "<span class=\"mk u\">not known</span>";return mark(c.v)+" "+esc(c.say||"")+(c.src?"<small>"+esc(c.src)+"</small>":"")}
function compHtml(cmp){var n=cmp.length,rowsC=[["matches","HOMES THAT MATCH"],["rent","TYPICAL RENT, LAST 60 DAYS"],["types","HOME TYPES"],["pools","POOLS"],["parks","PARKS AND DOG-FRIENDLY SPACES"],["schools","SCHOOLS NEARBY"],["newest","NEWEST COMPLETION"]];
  return "<div class=cmp id=bcmp><div class=lb>SIDE BY SIDE <b>"+esc(cmp.map(function(a){return a.name}).join(" · "))+"</b></div>"+rowsC.map(function(rc){
    return "<div class=cr><div class=ct>"+rc[1]+"</div><div class=cg style=\"grid-template-columns:repeat("+n+",minmax(0,1fr))\">"+cmp.map(function(a){var c=a[rc[0]],h;
      if(rc[0]==="types")h=["apartment","townhouse","villa"].map(function(k){return "<div>"+esc(k==="villa"?"villa or townhouse":k)+": "+cell(c&&c[k])+"</div>"}).join("");
      else if(rc[0]==="pools")h=["private","community"].map(function(k){return "<div>"+k+": "+cell(c&&c[k])+"</div>"}).join("");
      else h=cell(c);
      return "<div class=cc><b>"+esc(a.name)+"</b>"+h+"</div>"}).join("")+"</div></div>"}).join("")+"</div>"}
function moreHtml(tot,n){if(tot<=n)return "";var a=[];if(n<20&&tot>10)a.push("<a id=more20>Show 20</a>");if(n<50&&tot>20)a.push("<a id=more50>Show 50</a>");return a.length?"<div class=more>the best "+n+" of "+tot+" · "+a.join(" · ")+"</div>":""}
function floorLine(st){return st.min?"<div class=nt>Showing "+esc(fmtAed(st.min))+" and above</div>":""}
function drawRes(){var st=LAST,rs=RES.results||[],tot=RES.total_matched!=null?RES.total_matched:rs.length,cmp=RES.comparison;
  if(!rs.length&&!cmp){$("bres").innerHTML=""+emptyHtml(st)+notes();$("bout").hidden=true;$("bpill").hidden=true;return}
  var body;
  if(cmp){var areas=cmp.map(function(a){return a.slug});if(!TAB||!has(areas,TAB))TAB=areas[0];
    body="<div class=tabs id=btabs>"+cmp.map(function(a){var k=rs.filter(function(r){return r.district===a.slug}).length;return "<button type=button data-a="+esc(a.slug)+(a.slug===TAB?" class=on":"")+">"+esc(a.name)+" ("+k+")</button>"}).join("")+"</div>"
      +cmp.map(function(a){var part=[];each(rs,function(r,i){if(r.district===a.slug)part.push(rowHtml(r,i,st))});return "<div class=tabp data-a="+esc(a.slug)+(a.slug===TAB?"":" hidden")+">"+(part.join("")||"<div class=nt>Nothing here matches this brief: no building with three or more recorded lettings of this type in the budget.</div>")+"</div>"}).join("");
    $("bres").innerHTML="<div class=rh><b>"+tot+"</b> homes match · side by side<br>"+esc(summary(st))+"</div>"+floorLine(st)+compHtml(cmp)
      +"<div class=sa><span id=bcount></span><button type=button id=ball>choose all</button><button type=button id=bnone>clear</button></div>"+body+notes();
    each($("btabs").querySelectorAll("button"),function(b){b.onclick=function(){TAB=b.getAttribute("data-a");each($("btabs").querySelectorAll("button"),function(x){x.classList.toggle("on",x===b)});each($("bres").querySelectorAll(".tabp"),function(p){p.hidden=p.getAttribute("data-a")!==TAB})}})}
  else $("bres").innerHTML="<div class=rh><b>"+tot+"</b> buildings match · the best "+rs.length+" below<br>"+esc(summary(st))+"</div>"+floorLine(st)
    +"<div class=sa><span id=bcount></span><button type=button id=ball>choose all</button><button type=button id=bnone>clear</button></div>"
    +rs.map(function(r,i){return rowHtml(r,i,st)}).join("")+moreHtml(tot,rs.length)+notes();
  each($("bres").querySelectorAll("input[type=checkbox]"),function(cb){cb.onchange=function(){var r=rs[+cb.getAttribute("data-ix")];if(!r)return;SEL[r.key]=!!cb.checked;var row=$("row"+cb.getAttribute("data-ix"));if(row)row.classList.toggle("off",!cb.checked);counts()}});
  $("ball").onclick=function(){each(rs,function(r){SEL[r.key]=true});drawRes()};$("bnone").onclick=function(){SEL={};drawRes()};
  var m20=$("more20"),m50=$("more50");if(m20)m20.onclick=function(){ST.limit=20;run()};if(m50)m50.onclick=function(){ST.limit=50;run()};
  $("bout").hidden=!rs.length;$("shbox").hidden=true;omsg("");counts();
  if(window.__amenCards)window.__amenCards(st,RES,KEY)}   // v290 AMENITY CARDS (src/amenity_cards.js): one card per ticked must-have per district, above the homes
function emptyHtml(st){var e=RES&&RES.empty;if(!e)return "<div class=rh>Nothing matched "+esc(summary(st))+".</div><div class=nt>Try a wider budget, another district or two, or fewer must-haves.</div>";return "<div class=rh>"+esc(e.title)+"<br><small>"+esc(summary(st))+"</small></div><div class=nt>"+(e.reasons||[]).map(esc).join("<br>")+"<br><b>Next step:</b> "+esc(e.next||"")+"</div>"}
function notes(){var n=(RES&&RES.notes)||[],sm=(RES&&RES.summary)||[];var t=(LAST&&LAST.mode==="buy")?"What homes here actually sold for, from the Land Department’s registered sales":"What homes here actually let for, from registered tenancy contracts (Ejari, Dubai’s rent register)";var body=sm.length?sm.map(esc).join("<br>"):esc(t)+". This is not a list of homes on the market today.";return "<div class=nt>"+body+"</div>"+(n.length?"<details class=nt><summary>Details for the team</summary>"+n.map(esc).join("<br>")+"</details>":"")}
function counts(){var n=chosen().length;var c=$("bcount");if(c)c.textContent=n+" chosen";
  var bi=$("o-ind"),b5=$("o-c5");if(bi&&bi.firstChild)bi.firstChild.nodeValue=n>=1?"Individual PDFs ("+n+")":"Individual PDFs";if(b5&&b5.firstChild)b5.firstChild.nodeValue=(n>=2&&n<5)?"Compare these "+n:"Compare 5";var b10=$("o-c10");if(b10)b10.hidden=(n>=2&&n<=5);$("ochosen").textContent=n?n+" chosen":"none chosen";
  var p=$("bpill");p.hidden=!RES||!(RES.results||[]).length;p.textContent=n+" chosen · what to send ↓"}

// ---- the outputs (Contract B: GET /brief_pdf) ----
function omsg(t){$("omsg").textContent=t||""}
function need(n){omsg(n>1?"Tick at least "+n+" buildings in the list first.":"Tick at least one building in the list first.");return false}
function pdfUrl(kind,keys){var st=LAST;return "/brief_pdf?key="+encodeURIComponent(KEY)+"&kind="+kind+"&keys="+keys.map(encodeURIComponent).join(",")+"&mode="+st.mode+"&beds="+st.beds.join(",")+"&min="+(st.min||0)+(st.max?"&max="+st.max:"")
  +(st.stretch&&st.max?"&stretch="+st.stretch:"")+"&type="+st.types.join(",")+"&furnished="+st.furnished+(st.musts.length?"&musts="+st.musts.join(","):"")+(st.nice.length?"&nice="+st.nice.join(","):"")
  +(st.areas.length?"&areas="+st.areas.join(","):"")+(cmpOn(st)?"&compare=1":"")}
function fileName(kind,keys){var r=byKey(keys[0]),n=String((r&&r.name)||"list").replace(/[^A-Za-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40);
  return "Najma-"+(kind==="dossier"?n:(kind==="pack"?"full-pack":"compare-"+keys.length))+".pdf"}
function job(kind,keys,label){var u=pdfUrl(kind,keys);
  for(var id in JOBS){var o=JOBS[id];if(o.url===u&&(o.state==="wait"||o.state==="run")){jobDraw(o,"This one is already being made.");return o}}
  var j={id:"job"+(++JN),kind:kind,keys:keys,label:label,url:u,state:"wait",t0:0,blob:null,href:null};JOBS[j.id]=j;
  var d=document.createElement("div");d.className="job";d.id=j.id;$("jobs").appendChild(d);jobDraw(j);QUEUE.push(j);pump();return j}
function pump(){while(RUNNING<2&&QUEUE.length)start(QUEUE.shift())}
function start(j){RUNNING++;j.state="run";j.t0=Date.now();j.retrying=false;jobDraw(j);
  j.tick=setInterval(function(){if(j.state==="run")jobDraw(j)},1000);
  fetchRetry(j.url,PDF_WAIT[j.kind]||120000,function(){j.retrying=true;j.t0=Date.now();jobDraw(j)}).then(function(r){if(!r.ok)return r.text().then(function(t){throw {status:r.status,text:t}},function(){throw {status:r.status}});
      var ct=(r.headers&&r.headers.get&&r.headers.get("content-type"))||"";if(ct.indexOf("pdf")<0)throw {notpdf:true};return r.blob()})
    .then(function(b){if(!b||!b.size)throw {empty:true};j.blob=b;try{j.href=URL.createObjectURL(b)}catch(e){j.href=null}j.state="ok";done(j)},
          function(e){j.state="bad";j.err=e||{};done(j)})}
function done(j){clearInterval(j.tick);RUNNING--;jobDraw(j);pump()}
function why(e){if(e.timeout)return "It is taking longer than it should, so this page stopped waiting after two tries. Try again, or choose fewer buildings.";
  if(e.status===404)return "The document maker is not switched on yet.";if(e.status===401)return "The link’s key was not accepted.";
  if(e.status===429||e.status===503)return "The document maker is busy. Wait a moment and try again.";
  if(e.status===504||e.status===524)return "It took too long on the server. Try again, or choose fewer buildings.";
  if(e.status)return "It did not come through (error "+e.status+")."+(e.text&&e.text.length<140&&!/</.test(e.text)?" "+e.text:"");
  if(e.notpdf)return "Something came back, but it was not a PDF.";if(e.empty)return "The PDF came back empty.";
  return "No connection, after two tries. Check the signal and try again."}
function jobDraw(j,extra){var d=$(j.id);if(!d)return;var s=Math.round((Date.now()-(j.t0||Date.now()))/1000),st,acts="";
  if(j.state==="wait")st="Waiting its turn…";
  else if(j.state==="run")st=(j.retrying?"Still working… the connection dropped, trying once more. ":"Making the PDF… ")+s+" s"+(s>=25?" — still working, "+(j.kind==="pack"?"a full pack can take a couple of minutes":"a map can take a minute"):"");
  else if(j.state==="ok"){st="Ready.";acts=(j.href?"<a class=p href=\""+esc(j.href)+"\" target=_blank rel=noopener download=\""+esc(fileName(j.kind,j.keys))+"\">Open the PDF</a>":"<a class=p href=\""+esc(j.url)+"\" target=_blank rel=noopener>Open the PDF</a>")+(canShareFile()?"<button type=button data-a=send>Send it</button>":"")}
  else {st=why(j.err||{});acts="<button type=button class=p data-a=retry>Try again</button><a href=\""+esc(j.url)+"\" target=_blank rel=noopener>Open it directly</a>"}
  d.className="job"+(j.state==="bad"?" bad":(j.state==="ok"?" ok":""));
  d.innerHTML="<div class=jt>"+esc(j.label)+"</div><div class=js>"+esc(st)+(extra?" "+esc(extra):"")+"</div>"+(acts?"<div class=ja>"+acts+"</div>":"");
  each(d.querySelectorAll("button"),function(b){var a=b.getAttribute("data-a");b.onclick=function(){if(a==="retry"){j.state="wait";j.err=null;jobDraw(j);QUEUE.push(j);pump()}else if(a==="send")sendFile(j)}})}
function canShareFile(){try{return !!(navigator.canShare&&typeof File!=="undefined"&&navigator.canShare({files:[new File([""],"a.pdf",{type:"application/pdf"})]}))}catch(e){return false}}
function sendFile(j){try{var f=new File([j.blob],fileName(j.kind,j.keys),{type:"application/pdf"});navigator.share({files:[f],title:j.label}).catch(function(){jobDraw(j,"Not sent.")})}catch(e){jobDraw(j,"This phone cannot send it from here: open it, then share.")}}
// BLOCKS: the chosen buildings gold on their plots. Only ids with a footprint go (a dld: key has none); one district per view.
function blocksUrl(){var ks=chosen(),d=null,ids=[];each(ks,function(k){var r=byKey(k);if(!r||r.app_id==null||!r.district)return;if(!d)d=r.district;if(r.district===d)ids.push(r.app_id)});
  if(!ids.length)return null;return {d:d,ids:ids,url:"/blocks?district="+encodeURIComponent(d)+"&gold="+ids.join(",")+"&key="+encodeURIComponent(KEY)+RKQ}}
function outWire(){
  $("o-ind").onclick=function(){var ks=chosen();if(!ks.length)return need(1);var over=ks.length>10;if(over)ks=ks.slice(0,10);
    each(ks,function(k){var r=byKey(k);job("dossier",[k],(r?r.name:k)+" — its own PDF")});omsg((over?"The first 10 chosen, ":"")+ks.length+(ks.length===1?" PDF":" PDFs, one per building,")+" on the way. Each is ready to open or send on its own.")};
  $("o-c5").onclick=function(){cmp(5)};$("o-c10").onclick=function(){cmp(10)};
  $("o-pack").onclick=function(){var ks=chosen();if(!ks.length)return need(1);var over=ks.length>10;if(over)ks=ks.slice(0,10);job("pack",ks,"Full pack — "+ks.length+" buildings");omsg((over?"The pack takes the first 10 chosen. ":"")+"The full pack is on the way. It is the biggest, so it takes the longest.")};
  $("o-blocks").onclick=function(){var ks=chosen();if(!ks.length)return need(1);var b=blocksUrl();if(!b){omsg("None of the chosen buildings has a footprint on the blocks map yet.");return}
    var skipped=ks.length-b.ids.length;omsg(skipped?"Opening the blocks with "+b.ids.length+" of the "+ks.length+" chosen: the rest have no footprint yet, or sit in another district.":"");location.href=b.url};
  $("o-share").onclick=share;$("shcopy").onclick=function(){copy($("shurl").value)}}
function cmp(n){var ks=chosen();if(ks.length<2)return need(2);var cut=ks.length>n;ks=ks.slice(0,n);job("compare",ks,"Compare "+ks.length+" — one sheet and a map");omsg(cut?"Compare "+n+" takes the first "+n+" you chose, in the order of the list.":"")}
function shareUrl(){var ks=chosen();return location.origin+"/brief?"+qs(LAST,SKEY||null)+"&run=1"+(ks.length?"&pick="+ks.map(encodeURIComponent).join(","):"")}
function share(){if(!RES||!LAST)return omsg("Make a list first.");var u=shareUrl(),t=summary(LAST)+" — the homes that fit:";
  $("shurl").value=u;$("shbox").hidden=false;$("shwa").href="https://wa.me/?text="+encodeURIComponent(t+" "+u);
  var warn=SKEY?"":" This link carries no client key yet, so it will not open on someone else’s phone.";
  if(navigator.share){navigator.share({title:"The brief — Najma",text:t,url:u}).then(function(){omsg("Sent."+warn)},function(){omsg("Not sent. The link is below to copy."+warn)});return}
  copy(u,warn)}
function copy(u,warn){warn=warn||"";var box=$("shurl");
  function sel(){try{box.focus();box.select()}catch(e){}omsg("The link is below: press and hold it to copy."+warn)}
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(u).then(function(){omsg("Link copied. Paste it into WhatsApp or an email."+warn)},sel);else sel()}

// ---- wiring ----
segWire("fmode",function(v){if(v!==ST.mode){ST.mode=v;ST.min=0;ST.max=0;ST.stretch=0;$("fmin").value="";$("fmax").value="";$("fstr").value="";drawPresets()}showStep(2)});
segWire("fbeds",function(v){if(BDEF){ST.beds=[v];BDEF=false}else toggleIn(ST.beds,v);ST.beds.sort(function(a,b){return ["studio","1","2","3"].indexOf(a)-["studio","1","2","3"].indexOf(b)});msg("")});
segWire("ftype",function(v){if(v==="any")ST.types=["any"];else{ST.types=ST.types.filter(function(t){return t!=="any"});toggleIn(ST.types,v);if(!ST.types.length||ST.types.length===3)ST.types=["any"]}});
$("fnextbd").onclick=function(){if(!ST.beds.length){$("fmsgb").textContent="Tap at least one bedroom count.";return}msg("");showStep(3)};
$("fnextb").onclick=function(){var e=readBudget();if(e){msg(e);return}msg("");draw();showStep(4)};
segWire("ffurn",function(v){ST.furnished=v;showStep(5)});
$("fnextw").onclick=function(){showStep(6)};
$("fback").onclick=function(){if(STEP>1)showStep(STEP-1);else if(RES){fold()}};
$("bedit").onclick=function(){showStep(1)};
each($("fdl").querySelectorAll("button"),function(b){b.onclick=function(){toggleIn(ST.areas,b.getAttribute("data-s"));draw()}});
$("fany").onclick=function(){ST.areas=[];$("fdq").value="";filterD();draw()};
$("fcmp").onclick=function(){ST.compare=!ST.compare;draw()};
$("fdq").oninput=filterD;
each($("fwant").querySelectorAll(".wr"),function(r){var k=r.getAttribute("data-k");each(r.querySelectorAll("button"),function(b){b.onclick=function(){var l=b.getAttribute("data-l");
  ST.musts=ST.musts.filter(function(x){return x!==k});ST.nice=ST.nice.filter(function(x){return x!==k});if(l==="must")ST.musts.push(k);else if(l==="nice")ST.nice.push(k);draw()}})});
$("fmin").onchange=$("fmax").onchange=$("fstr").onchange=function(){var e=readBudget();msg(e&&e.indexOf("number")>=0?e:"");draw()};
$("fgo").onclick=run;$("fskip").onclick=function(){ST.musts=[];ST.nice=[];draw();run()};
$("bpill").onclick=function(){var o=$("bout");if(o&&o.scrollIntoView)o.scrollIntoView({behavior:"smooth",block:"start"})};
outWire();
applyQ(B.q);drawPresets();draw();
(window.__qnParts=window.__qnParts||[]).push(function(){return LAST?{filters:{brief:summary(LAST),chosen:chosen().length}}:{}});
window.__brief={state:ST,run:run,chosen:function(){return chosen()},jobs:JOBS,parseAed:parseAed,summary:summary,qs:qs,step:function(){return STEP},show:showStep,blocksUrl:blocksUrl};
if(B.q&&B.q.run)run();else showStep(B.q&&B.q.modeSet?2:1);
})();
`;
