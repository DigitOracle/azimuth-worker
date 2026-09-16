// v154.4 - DUBAI AGAINST THE WORLD, as cards (Kendall, 16 Sep 2026: "prime for the cards"). The same ten cities and the same numbers as the
// spoken pieces, for a screen she can turn to a client mid-meeting. Every figure comes from src/world.js through worldFacts(), which does the
// AED and multiple arithmetic, so a card and a script can never disagree and a twice-yearly refresh of that file updates both at once.
//
// PRIME, and the page says so in three places: prime is the top few per cent of each market, not the average home. Dubai market-wide is about
// AED 1,670 a square foot, so putting THAT beside prime London would understate Dubai two and a half times over. Neither index publishes its
// floor-area basis, so Hong Kong (saleable) and Dubai (built-up) are not measured alike - stated on the page rather than argued away, matching
// the "ready" lines of the sample scripts.
//
// No chrome of its own: the caller passes fonts, nav CSS and the nav bar, so this file never imports from index.js (no circular import).
import { WORLD_CITIES, worldFacts, WORLD_SOURCES } from "./world.js";

const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const nfmt = (n) => Number(n).toLocaleString("en-US");

// One row per city: Dubai first, then dearest to cheapest. worldFacts returns null for Dubai itself, so its row is taken from any call.
export function worldCardRows() {
  const first = worldFacts(WORLD_CITIES.find(c => !c.base).key, "psf");
  const dubai = Object.assign({}, first.dubai, { key: "dubai", flag: WORLD_CITIES[0].flag, base: true, multiple: "the baseline" });
  const rest = WORLD_CITIES.filter(c => !c.base).map(c => {
    const f = worldFacts(c.key, "psf");
    return Object.assign({}, f.other, { key: c.key, flag: c.flag, multiple: f.multiple.text, multiple_value: f.multiple.value });
  }).sort((a, b) => b.prime_usd_per_sqft - a.prime_usd_per_sqft);
  return { dubai, rest, basis: first.basis, sources: first.sources, dip: first.dip };
}

function detail(r) {
  const line = (label, v) => v ? '<div class=dl><span>' + esc(label) + '</span><p>' + esc(v) + '</p></div>' : '';
  const t = r.tax || {}, x = r.extra || {}, l = r.living || {};
  return '<div class=det>' +
    (r.role ? '<p class=why>' + esc(r.role) + '</p>' : '') +
    (r.buyers ? '<p class=why buy>' + esc(r.buyers) + '</p>' : '') +
    (r.price_source ? '<p class=src>' + esc(r.price_source) + '</p>' : '') +
    (r.note ? '<p class=src>' + esc(r.note) + '</p>' : '') +
    (r.caution ? '<p class=src>' + esc(r.caution) + '</p>' : '') +
    line("Income tax", t.income) + line("Cost of buying", t.buying) + line("Tax on the gain", t.capital_gains) +
    line("Rental yield", x.yield) + line("From Dubai", x.flight) + line("Sunshine", x.sunshine) + line("This year", x.savills_h1_2026) +
    line("Liveability", l.liveability) + line("Cost of living", l.cost_of_living) + line("Safety", l.safety) + line("Quality of living", l.quality_of_living) + line("Millionaires", l.millionaires) +
    '</div>';
}

function card(r, max) {
  const w = Math.max(3, Math.round(100 * r.prime_usd_per_sqft / max));
  const approx = r.prime_usd_approx ? "about " : "";
  return '<button class="c' + (r.base ? ' me' : '') + '" data-k="' + esc(r.key) + '" aria-expanded=false>' +
    '<div class=hd><span class=fl>' + r.flag + '</span><b>' + esc(r.city) + '</b><i>' + esc(r.multiple) + '</i></div>' +
    '<div class=big>' + approx + 'AED ' + nfmt(r.prime_aed_per_sqft) + '<small> / sq ft</small></div>' +
    '<div class=usd>' + approx + 'US$' + nfmt(r.prime_usd_per_sqft) + ' / sq ft</div>' +
    '<div class=bar><i style="width:' + w + '%"></i></div>' +
    '<div class=buys>AED 5m buys <b>' + nfmt(r.m2_for_aed_5m) + ' m&sup2;</b> &middot; US$1m buys ' + nfmt(r.m2_for_usd_1m) + ' m&sup2;</div>' +
    detail(r) + '</button>';
}

export function worldCardsHtml(key, chrome) {
  chrome = chrome || {};
  const { dubai, rest, basis, sources, dip } = worldCardRows();
  const max = Math.max(dubai.prime_usd_per_sqft, ...rest.map(r => r.prime_usd_per_sqft));
  const cards = [dubai].concat(rest).map(r => card(r, max)).join("");
  return '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<meta name=robots content=noindex><title>Dubai against the world</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">' + (chrome.fonts || '') +
    '<style>' +
    ':root{--bg:#0C1413;--card:#131F1D;--line:#24352F;--text:#E8E4D8;--mut:#8FA39B;--gold:#C5A56A;--teal:#8FC7B9}' +
    '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:"IBM Plex Sans",system-ui,-apple-system,sans-serif;padding:calc(14px + env(safe-area-inset-top)) 12px 96px}' +
    'main{max-width:620px;margin:0 auto}' +
    'h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.55rem;line-height:1.15;margin:4px 0 2px;color:var(--gold)}' +
    '.sub{font-family:"IBM Plex Mono",monospace;font-size:.66rem;letter-spacing:.05em;color:var(--mut);text-transform:uppercase;margin-bottom:10px}' +
    '.basis{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:10px;padding:10px 12px;font-size:.8rem;line-height:1.45;color:var(--mut);margin-bottom:12px}' +
    '.basis b{color:var(--text);font-weight:600}' +
    '.c{display:block;width:100%;text-align:left;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 13px;margin-bottom:9px;color:inherit;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.c.me{border-color:rgba(197,165,106,.55);background:#16211E}' +
    '.hd{display:flex;align-items:baseline;gap:7px}.fl{font-size:1.05rem;line-height:1}' +
    '.hd b{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.06rem}' +
    '.hd i{margin-left:auto;font-style:normal;font-family:"IBM Plex Mono",monospace;font-size:.64rem;color:var(--mut);text-align:right}' +
    '.big{font-family:Fraunces,Georgia,serif;font-size:1.32rem;font-weight:600;margin-top:6px;letter-spacing:-.01em}' +
    '.big small{font-size:.72rem;color:var(--mut);font-family:"IBM Plex Mono",monospace;font-weight:400}' +
    '.usd{font-family:"IBM Plex Mono",monospace;font-size:.66rem;color:var(--mut);margin-top:1px}' +
    '.bar{height:5px;border-radius:3px;background:#0C1413;margin:8px 0 7px;overflow:hidden}' +
    '.bar i{display:block;height:100%;border-radius:3px;background:var(--teal)}' +
    '.c.me .bar i{background:var(--gold)}' +
    '.buys{font-size:.76rem;color:var(--mut)}.buys b{color:var(--text);font-weight:600}' +
    '.det{display:none;margin-top:10px;border-top:1px solid var(--line);padding-top:9px}' +
    '.c[aria-expanded=true] .det{display:block}' +
    '.why{margin:0 0 7px;font-size:.82rem;line-height:1.45}.why.buy{color:var(--teal)}' +
    '.src{margin:0 0 7px;font-size:.74rem;line-height:1.4;color:var(--mut);font-style:italic}' +
    '.dl{display:grid;grid-template-columns:96px 1fr;gap:8px;padding:5px 0;border-top:1px solid rgba(36,53,47,.6)}' +
    '.dl span{font-family:"IBM Plex Mono",monospace;font-size:.6rem;letter-spacing:.04em;text-transform:uppercase;color:var(--mut);padding-top:2px}' +
    '.dl p{margin:0;font-size:.78rem;line-height:1.4}' +
    '.foot{margin-top:14px;font-size:.72rem;line-height:1.5;color:var(--mut)}.foot b{color:var(--text);font-weight:600}' +
    (chrome.navCss || '') + '</style></head><body><main>' +
    '<h1>Dubai against the world</h1>' +
    '<div class=sub>prime homes &middot; price per square foot &middot; tap a city</div>' +
    '<div class=basis><b>Prime</b> means the top few per cent of each market by value, not the average home &mdash; that is the only basis these indices publish. Dubai market-wide is about <b>AED 1,670</b> a square foot, so comparing that with prime London would understate Dubai two and a half times over. ' +
    esc(dip) + '</div>' +
    cards +
    '<div class=foot><b>Where the numbers come from.</b> Price per square foot: ' + esc(sources.prices.name) + ', ' + esc(sources.prices.period) + ', published ' + esc(sources.prices.published) + '. What a million buys: ' + esc(sources.what_1m_buys.name) + ', ' + esc(sources.what_1m_buys.period) + ', published ' + esc(sources.what_1m_buys.published) + '. AED at the peg, 3.6725 to the dollar; AED 5m is about US$1.36m. ' +
    'Monaco is not in the world cities index &mdash; its figure is Savills\' Monaco spotlight from IMSEE, Monaco\'s statistics office. ' +
    'Neither index publishes its floor-area basis, so Hong Kong (saleable area) and Dubai (built-up) are not measured the same way. Indicative figures for comparison, not a valuation.</div>' +
    '</main>' + (chrome.nav || '') +
    '<script>document.querySelectorAll(".c").forEach(function(c){c.addEventListener("click",function(){var open=c.getAttribute("aria-expanded")==="true";document.querySelectorAll(".c").forEach(function(x){x.setAttribute("aria-expanded","false")});c.setAttribute("aria-expanded",open?"false":"true");if(!open)c.scrollIntoView({block:"nearest",behavior:"smooth"})})});<\/script>' +
    '</body></html>';
}
