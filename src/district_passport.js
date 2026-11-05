// v771 DISTRICT PASSPORT (Kendall, 5 Nov 2026: "it should just be taking us to our DNAs ... a version of the DNA that has to do with this particular
// district ... the same kind of one-pager or four-pager that we already put out for a building"). Replaces the dark /cb/<slug> brief page.
// Routes (public, like /cb/ was; nothing personal on the page or in the address):
//   GET /dp/<slug>?r=<reader>&v=full&ty=1   one-pager (default) or the 4-page passport; ty=1 adds Najjuko's thank-you line at the top
//   GET /dp/img/<name>                      the saved illustration (dp_img_<name> in KV, generated ONCE, labelled "Illustration") or the broker card
// Data, stored only, never invented: camp_brief_<slug> (developer capture), camp_facts_<set> (register rollups), pp_dna[<district>] (district DNA).
// A fact that is missing is LEFT OFF. A missing deciding fact (payment plan, handover) gets at most ONE soft line naming Najjuko. Never "to confirm".
import { NAJ_BRN, NAJ_BRN_EXPIRES } from "./campaigns.js";
import puppeteer from "@cloudflare/puppeteer";   // v772 - the PDF, through the same Browser Rendering binding as building passports

export const DP_READERS = {
  investor: { label: "Investor", line: "For an investor: prices, price per sq ft, supply, handover and rent comparables" },
  keeper: { label: "Keeping it", line: "For an owner keeping the home: handover dates, build progress, rents and getting it ready to lease" },
  seller: { label: "Selling", line: "For an owner open to selling: what homes are selling for, by bedroom, and how fast" },
};
export const dpReader = (r) => (Object.prototype.hasOwnProperty.call(DP_READERS, r) ? r : "investor");
// a district (or project) -> where its facts live. palm-springs is a project next to Palm Jebel Ali; palm-jebel-ali is the district itself.
export const DP_SETS = {
  "palm-springs": { name: "Palm Springs", sub: "Nakheel · Jebel Ali · next launch near Palm Jebel Ali", brief: "palm-springs", facts: "pja", dna: "jabalalifirst", img: "palm-springs", kind: "project" },
  "palm-central": { name: "Palm Central Private Residences", sub: "Nakheel · Palm Jebel Ali, between Fronds M and N", brief: "palm-central", facts: "pja", dna: "jabalalifirst", img: "palm-central", kind: "project" },
  "palm-jebel-ali": { name: "Palm Jebel Ali", sub: "Nakheel · registered projects on the island", brief: "palm-central", facts: "pja", dna: "jabalalifirst", img: "palm-jebel-ali", kind: "district" },
};
export const THANKS = "Thank you very much, I appreciate you taking the time. I'll reach out to you shortly to talk it through. Najjuko";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dpDate = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || "")); return m ? +m[3] + " " + MON[+m[2] - 1] + " " + m[1] : ""; };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const isGap = (v) => v == null || v === "" || (typeof v === "string" && /^(to confirm|to be announced|n\/a)$/i.test(v.trim())) || (Array.isArray(v) && !v.length);
// a stored source string -> a short clean label; file names never print
export function srcLabel(src, asOf) {
  const s = String(src || ""), d = dpDate(asOf);
  let l = /ejari/i.test(s) ? "Ejari rent register" : /project register/i.test(s) ? "Land Department project register" : /DLD|gateway|register/i.test(s) ? "Land Department register"
    : /floor plan/i.test(s) ? "Nakheel floor plans" : /brochure/i.test(s) ? "Nakheel brochure" : /one-pager/i.test(s) ? "Nakheel one-pager" : /sentinel|copernicus/i.test(s) ? "Copernicus Sentinel-2"
    : /area insights/i.test(s) ? "Google Area Insights" : s.replace(/\S+\.(pdf|xlsx?|docx?|png|jpe?g)\b/gi, "").replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  return l + (d ? " · " + d : "");
}
async function J(env, k) { try { const v = await env.MEETINGS.get(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }

export async function dpLoad(env, slug) {
  const S = DP_SETS[slug]; if (!S) return null;
  const [brief, facts, dnaAll, imgMeta] = await Promise.all([J(env, "camp_brief_" + S.brief), J(env, "camp_facts_" + S.facts), J(env, "pp_dna"), env.MEETINGS.get("dp_img_" + S.img + "_meta")]);
  return { slug, S, brief: brief || {}, facts: facts || {}, dna: dnaAll && dnaAll[S.dna] ? dnaAll[S.dna] : null, hasImg: !!imgMeta };
}

// ---- small builders ----
const card = (k, v, src, tag, wide) => isGap(v) ? "" : '<div class="c' + (wide ? " w" : "") + '"><div class=k>' + esc(k) + (tag ? ' <span class="tag' + (tag === "DISTRICT" ? " d" : "") + '">' + tag + "</span>" : "") + '</div><div class=v>' + esc(Array.isArray(v) ? v.join(" · ") : v) + "</div>" + (src ? "<div class=s>" + esc(src) + "</div>" : "") + "</div>";
const fv = (f) => (f && !isGap(f.value) ? f.value : null);
const fs = (f) => (f ? srcLabel(f.source, f.as_of) : "");
const pick = (o, k) => (o && o[k] && !isGap(o[k].value) ? o[k] : null);

function heroHtml(d) {
  if (!d.hasImg) return "";
  return '<figure class=hero><img src="/dp/img/' + esc(d.S.img) + '" alt="' + esc(d.S.name) + ' illustration"><figcaption>Illustration</figcaption></figure>';
}
function softLine(d) {   // at most one, only for a deciding fact the developer has not released
  const b = d.brief, miss = [];
  if (d.S.kind === "project") { if (!pick(b, "payment_plan")) miss.push("payment plan"); if (!pick(b, "handover")) miss.push("handover date"); }
  return miss.length ? '<div class=soft>Najjuko will confirm the ' + miss.join(" and ") + " with you as soon as Nakheel releases " + (miss.length > 1 ? "them" : "it") + ".</div>" : "";
}
function closeHtml(d, line) {
  const exp = Date.now() > Date.parse(NAJ_BRN_EXPIRES + "T23:59:59+04:00");
  const ver = exp ? "" : '<div class=vb><img src="/dp/img/card" alt="Najjuko broker card"><div><b>Verified broker</b><span>BRN ' + NAJ_BRN + " · Faez Noorzad Real Estate. Check it with the QR on the card.</span></div></div>";
  return '<a class=cta href="https://wa.me/971565484397"><svg width=22 height=22 viewBox="0 0 24 24" fill=none stroke="#fff" stroke-width=1.7 aria-hidden=true><path d="M4 20l1.3-3.8A8 8 0 1 1 8 19z"/></svg><div><b>Talk to Najjuko</b><span>' + esc(line) + "</span></div></a>" + ver;
}
function monthBars(f) {
  const v = fv(f); if (!Array.isArray(v)) return "";
  const rows = v.filter((m) => m.sales >= 5); if (!rows.length) return "";
  const mx = Math.max(...rows.map((m) => m.median_psf));
  return "<h2>Price per sq ft, month by month</h2>" + rows.map((m) => '<div class=bar><span>' + MON[+m.month.slice(5) - 1] + " · " + m.sales + '</span><i style="width:' + Math.round(110 * m.median_psf / mx) + 'px"></i><b>' + Number(m.median_psf).toLocaleString("en-US") + "</b></div>").join("")
    + '<p class=n>Median AED per sq ft and number of sales · ' + esc(fs(f)) + ". Months with under 5 sales left out.</p>";
}
function bedroomTable(b) {
  const p = pick(b, "price"); if (!p || typeof p.value !== "string") return "";
  const R = {}; String(p.value).split(";").forEach((x) => { const m = /Frond\s+(\w)\s+(\d)\s*B\/R median AED ([\d,]+) \((\d+) sales\)/.exec(x); if (m) { (R[m[2]] = R[m[2]] || {})[m[1]] = [m[3], m[4]]; } });
  const ks = Object.keys(R).sort(); if (!ks.length) return "";
  const cell = (x) => (x ? "AED " + (Number(x[0].replace(/,/g, "")) / 1e6).toFixed(2) + "M (" + x[1] + ")" : "");
  return "<h2>Median sale by bedroom · Palm Central</h2><table><tr><th>Bedrooms</th><th>Frond M</th><th>Frond N</th></tr>" + ks.map((k) => "<tr><td>" + k + "</td><td>" + cell(R[k].M) + "</td><td>" + cell(R[k].N) + "</td></tr>").join("") + "</table><p class=n>(number of sales) · " + esc(fs(p)) + "</p>";
}
function supplyTable(f) {
  const v = fv(f && f.pja_supply_pipeline); if (!Array.isArray(v)) return "";
  return "<h2>What is being built</h2><table><tr><th>Project</th><th>Homes</th><th>Planned handover</th></tr>" + v.map((x) => "<tr><td>" + esc(x.project) + "</td><td>" + esc(x.units) + "</td><td>" + esc(dpDate(x.planned_end)) + "</td></tr>").join("") + "</table><p class=n>" + esc(fs(f.pja_supply_pipeline)) + "</p>";
}
function rentCards(f) {
  const own = fv(f.pja_rents), cmp = fv(f.comparable_rents_palm_jumeirah);
  let h = "";
  if (own && /^No /i.test(own)) h += "<div class=soft>No home on Palm Jebel Ali is rented yet, so there is no rent of its own. The nearest comparable is Palm Jumeirah.</div>";
  if (Array.isArray(cmp)) h += '<div class=g>' + cmp.map((x) => card("Palm Jumeirah " + (x.type === "Flat" ? "flats" : "villas"), x.median_annual + " a year", "median · " + x.contracts + " contracts · " + fs(f.comparable_rents_palm_jumeirah).replace(/;.*$/, ""), "COMPARABLE")).join("") + "</div>";
  return h;
}
function districtCards(f) {
  return card("Home sales, 2026", fv(f.pja_home_sales) ? String(fv(f.pja_home_sales)).replace(/ home sales registered.*?\(/, " (").replace(/\)$/, ")") : null, fs(f.pja_home_sales), "DISTRICT")
    + card("Median price", fv(f.pja_median_price) ? String(fv(f.pja_median_price)).replace(/ \(median home sale\)/, "") : null, fs(f.pja_median_price), "DISTRICT")
    + card("Median per sq ft", fv(f.pja_median_psf) ? String(fv(f.pja_median_psf)).replace(/ \(median, home sales\)/, "") : null, fs(f.pja_median_psf), "DISTRICT")
    + card("Homes registered", fv(f.pja_units_registered), fs(f.pja_units_registered), "DISTRICT");
}
function areaPage(d) {
  const a = d.dna; if (!a) return "<div class=soft>Area facts for Palm Jebel Ali are being gathered; Najjuko can talk you through the area.</div>";
  const line = (t) => (a.lines || []).find((l) => l.t === t);
  const ga = line("getting_around"), al = line("active_lifestyle");
  return '<div class=g>' + card("Liveability", a.live && a.live.p ? Math.round(a.live.p.default) + " / 100" : null, a.live ? "families " + Math.round(a.live.p.family) + " · retirees " + Math.round(a.live.p.retiree) + " · Najma liveability · " + dpDate(a.live.as_of) : "", "JEBEL ALI")
    + card("Green cover", a.green ? a.green.share + "%" : null, a.green ? srcLabel(a.green.src, a.green.d) : "", "")
    + (ga ? card("Getting around", ga.s.replace(/^.*?: /, "").replace(/, across.*$/, ""), srcLabel(ga.src, ga.as_of), "", true) : "")
    + (al ? card("Active life", al.s.replace(/^.*?: /, ""), srcLabel(al.src, al.as_of), "", true) : "") + "</div>"
    + "<div class=soft>Who lives here: no homes are handed over yet, so there is no resident mix for Palm Jebel Ali. It appears here once residents move in.</div>"
    + "<p class=n>Area figures are the Jebel Ali district, not Palm Jebel Ali alone.</p>";
}

export function dpOnePager(d, reader, ty) {
  const b = d.brief, f = d.facts, R = DP_READERS[reader];
  let g = "";
  if (d.S.kind === "project") g += card("Developer", fv(b.developer), fs(b.developer)) + card("Homes", fv(b.unit_types) || fv(b.homes), fs(pick(b, "unit_types") || pick(b, "homes")))
    + card(d.slug === "palm-springs" ? "Price (indicative, pre-launch)" : "Price", d.slug === "palm-springs" ? String(fv(b.price) || "").replace(/\s*\(indicative pre-launch pricing\)/i, "") || null : null, fs(b.price), "", true)
    + card("Highlights", fv(b.highlights), fs(b.highlights), "", true);
  g += card("Next door: Palm Jebel Ali", fv(f.pja_home_sales) && fv(f.pja_median_psf) ? String(fv(f.pja_home_sales)).match(/^\d+/)[0] + " home sales this year · median " + String(fv(f.pja_median_psf)).replace(/ \(median, home sales\)/, "") : null,
    fs(f.pja_median_psf) + (d.slug === "palm-springs" ? ". All Palm Jebel Ali sales so far are Palm Central apartments, so not like for like with Palm Springs villas." : ""), "DISTRICT", true);
  if (reader === "keeper") g += supplyMini(f);
  const body = '<div class=top><span>NAJMA · ' + (d.S.kind === "project" ? "PROJECT" : "DISTRICT") + " ONE-PAGER · " + esc(R.label.toUpperCase()) + "</span><span>" + dpDate(new Date().toISOString()) + "</span></div>"
    + heroHtml(d) + "<h1>" + esc(d.S.name) + "</h1><p class=sub>" + esc(d.S.sub) + "</p>"
    + (ty ? '<div class=ty>' + esc(THANKS.replace(/ Najjuko$/, "")) + " <i>Najjuko</i></div>" : "")
    + "<div class=g>" + g + "</div>" + softLine(d)
    + '<a class=full href="?r=' + reader + "&v=full" + (ty ? "&ty=1" : "") + '">See the full ' + (d.slug === "palm-springs" ? "Palm Jebel Ali " : "") + "passport (4 pages)</a>"
    + closeHtml(d, reader === "seller" ? "About selling your Palm Jebel Ali home" : reader === "keeper" ? "Handover, snagging and leasing help" : "About " + d.S.name + ", or your Palm Jebel Ali home")
    + '<div class=foot><span>' + (d.S.kind === "project" ? "Pre-launch guidance only; prices and homes may change on release." : "Estimate, not a valuation.") + "</span><span class=pg>1 / 1</span></div>";
  return page(d.S.name + " · one-pager", '<div class=ph>' + body + "</div>");
}
function supplyMini(f) { const v = fv(f.pja_supply_pipeline); return Array.isArray(v) ? card("Planned handovers", v.map((x) => x.project.replace(/^Palm Central Private Residences - /, "") + " " + dpDate(x.planned_end)).join(" · "), fs(f.pja_supply_pipeline), "DISTRICT", true) : ""; }

export function dpFull(d, reader, ty) {
  // the 4 pages are always about the DISTRICT (Palm Jebel Ali), whichever project the link started from
  const f = d.facts, b = d.S.kind === "project" && d.slug !== "palm-central" ? null : d.brief, R = DP_READERS[reader];
  const head = (n, t) => '<div class=top><span>NAJMA · DISTRICT PASSPORT · ' + esc(R.label.toUpperCase()) + '</span><span class=pg>' + n + " / 4</span></div>" + (t ? "<h2 class=pt>" + t + "</h2>" : "");
  const foot = '<div class=foot><span>Najma · najma@digitalabbot.io</span><span>Estimate, not a valuation</span></div>';
  const order = reader === "seller" ? ["sales", "bed", "supply", "area"] : reader === "keeper" ? ["supply", "rent", "sales", "area"] : ["sales", "supply", "rent", "area"];
  const P = {
    sales: () => "<h1>Palm Jebel Ali</h1><p class=sub>Nakheel · " + esc(fv(f.pja_units_registered) || "") + "</p>" + (d.hasImg ? '<figure class=hero><img src="/dp/img/palm-jebel-ali" alt="Palm Jebel Ali illustration"><figcaption>Illustration</figcaption></figure>' : "") + (ty ? '<div class=ty>' + esc(THANKS.replace(/ Najjuko$/, "")) + " <i>Najjuko</i></div>" : "") + '<div class=g>' + districtCards(f) + "</div>" + monthBars(f.pja_psf_by_month),
    supply: () => "<h2>Supply and handover</h2>" + supplyTable(f) + bedroomTable(d.brief && d.S.brief === "palm-central" ? d.brief : null),
    bed: () => "<h2>What homes sell for</h2>" + bedroomTable(d.brief && d.S.brief === "palm-central" ? d.brief : null) + supplyTable(f),
    rent: () => "<h2>Rent and income</h2>" + rentCards(f) + "<p class=sub>Najjuko can walk you through what these mean for your home size and handover year.</p>",
    area: () => "<h2>The area</h2>" + areaPage(d) + closeHtml(d, reader === "seller" ? "Talk through selling your home" : "Compare Palm Springs and Palm Central for you"),
  };
  return page("Palm Jebel Ali · district passport", order.map((k, i) => '<div class="ph pp">' + head(i + 1) + P[k]() + foot + "</div>").join(""));
}

const CSS = ':root{color-scheme:light only}html,body{background:#F7F3EA!important;color:#1C2826!important}'
  + ':root{--cream:#F7F3EA;--card:#FFFDF9;--line:#E7E1D6;--teal:#0A4F4A;--gold:#C5A56A;--gold2:#8A6F3E;--ink:#1C2826;--mute:#5F6B66;--green:#2F7D5B}*{box-sizing:border-box}'
  + 'body{margin:0;background:var(--cream);font-family:"IBM Plex Sans",sans-serif;color:var(--ink)}.ph{max-width:560px;margin:0 auto;padding:18px 16px 26px}.pp{border-bottom:8px solid #EDE7DA}'
  + '.top{display:flex;justify-content:space-between;gap:8px;font:500 .66rem "IBM Plex Mono",monospace;color:var(--gold2);letter-spacing:.1em}h1{font:600 1.8rem/1.1 Fraunces,serif;color:var(--teal);margin:10px 0 4px}'
  + 'h2{font:600 1.1rem Fraunces,serif;color:var(--teal);margin:16px 0 8px}.sub{color:var(--mute);font-size:.88rem;margin:0 0 12px}.n{font-size:.68rem;color:var(--mute);margin:6px 0}'
  + '.hero{margin:10px 0 6px;position:relative}.hero img{width:100%;border-radius:14px;display:block;aspect-ratio:3/2;object-fit:cover}.hero figcaption{position:absolute;right:8px;bottom:8px;background:rgba(255,253,249,.85);color:var(--gold2);font:600 .6rem "IBM Plex Mono",monospace;padding:3px 8px;border-radius:999px}'
  + '.ty{background:#EAF2EE;border:1px solid #CFE2D8;border-radius:14px;padding:10px 12px;font-size:.86rem;color:#1F4D3B;margin:0 0 12px}.ty i{font-family:Fraunces,serif;font-style:italic}'
  + '.g{display:grid;grid-template-columns:1fr 1fr;gap:8px}.c{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px 11px;min-width:0}.c.w{grid-column:1/-1}'
  + '.c .k{font:600 .64rem "IBM Plex Mono",monospace;letter-spacing:.06em;color:var(--gold2);text-transform:uppercase}.c .v{font:600 1rem/1.25 Fraunces,serif;color:var(--teal);margin-top:3px;overflow-wrap:anywhere}.c .s{font-size:.68rem;color:var(--mute);margin-top:5px}'
  + '.tag{display:inline-block;font:600 .56rem "IBM Plex Mono",monospace;border-radius:999px;padding:2px 7px;border:1px solid var(--gold);color:var(--gold2)}.tag.d{border-color:#9CC3B1;color:var(--green)}'
  + '.soft{font-size:.84rem;background:var(--card);border-left:3px solid var(--gold);padding:8px 10px;border-radius:8px;margin:10px 0}.full{display:block;text-align:center;border:1px solid var(--teal);color:var(--teal);border-radius:999px;padding:11px;margin-top:12px;font-weight:600;text-decoration:none}'
  + '.cta{display:flex;align-items:center;gap:10px;background:var(--teal);color:#fff;border-radius:16px;padding:12px 14px;margin-top:12px;text-decoration:none}.cta b{font:600 1rem Fraunces,serif}.cta span{font-size:.78rem;opacity:.85;display:block}'
  + '.vb{display:flex;gap:10px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:8px;margin-top:8px}.vb img{width:96px;border-radius:6px}.vb b{font:600 .9rem Fraunces,serif;color:var(--teal);display:block}.vb span{font-size:.72rem;color:var(--mute)}'
  + '.foot{margin-top:14px;padding-top:8px;border-top:1px solid var(--line);font-size:.64rem;color:var(--mute);display:flex;justify-content:space-between;gap:8px}.pg{font:600 .62rem "IBM Plex Mono",monospace;color:var(--gold2)}'
  + '.bar{display:flex;align-items:center;gap:6px;font-size:.76rem;margin:4px 0}.bar i{height:9px;background:var(--teal);border-radius:4px;display:block}.bar span{width:60px;color:var(--mute)}'
  + 'table{width:100%;border-collapse:collapse;font-size:.78rem}td,th{border-bottom:1px solid var(--line);padding:7px 4px;text-align:left;vertical-align:top}th{font:600 .6rem "IBM Plex Mono",monospace;color:var(--gold2);text-transform:uppercase}'
  + '@media print{@page{size:A4;margin:9mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.ph{max-width:none!important;padding:0 2mm!important}.pp{border:0!important;break-after:page}.pp:last-child{break-after:auto}.full{display:none!important}.hero img{aspect-ratio:16/7!important}.c{padding:7px 9px!important}.g{gap:6px!important}h1{margin-top:6px!important}.vb img{width:80px!important}}';   // v772b - print rules LAST so they win
function page(title, body) {
  return '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content=noindex><meta name=theme-color content="#F7F3EA"><meta name=color-scheme content="light only"><title>' + esc(title) + "</title>"
    + '<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,600;1,500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap" rel=stylesheet><style>' + CSS + "</style></head><body>" + body + "</body></html>";
}

export const dpFileName = (slug, reader, one) => (DP_SETS[slug] ? (one ? DP_SETS[slug].name : "Palm Jebel Ali") : slug) + " - " + DP_READERS[dpReader(reader)].label.replace("Keeping it", "Keeper").replace("Selling", "Seller") + (one ? " one-pager" : " passport") + " - Najjuko.pdf";
async function dataVer(d) { const t = JSON.stringify([d.brief, d.facts, d.dna ? d.dna.live : null, d.hasImg, "v772b"]); let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
let LAUNCH = (b) => puppeteer.launch(b);
export function __setDpLauncher(fn) { LAUNCH = fn || ((b) => puppeteer.launch(b)); }
// the stored PDF for one district + reader (+ one-pager or the 4 pages); renders only when the data changed since the last render
export async function dpPdf(env, slug, reader, one, origin) {
  const d = await dpLoad(env, slug); if (!d) return null; reader = dpReader(reader);
  const v = await dataVer(d), key = "dp_pdf_" + slug + "_" + reader + "_" + (one ? "one" : "full");
  const meta = await J(env, key + "_meta");
  if (meta && meta.v === v) { const b = await env.MEETINGS.get(key, "arrayBuffer"); if (b) return { pdf: b, name: dpFileName(slug, reader, one), cached: true }; }
  let html = one ? dpOnePager(d, reader, false) : dpFull(d, reader, false);
  html = html.replace(/(src|href)="\/dp\//g, '$1="' + origin + "/dp/");
  const browser = await LAUNCH(env.BROWSER);
  try {
    const page = await browser.newPage();
    try { await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]); } catch (e) {}
    try { await page.emulateMediaType("print"); } catch (e) {}
    try { await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 }); } catch (e) { if (!/timeout/i.test(String((e && e.message) || e))) throw e; }
    try { await page.evaluate(() => document.fonts.ready.then(() => true)); } catch (e) {}
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    await env.MEETINGS.put(key, pdf); await env.MEETINGS.put(key + "_meta", JSON.stringify({ v, at: new Date().toISOString(), bytes: pdf.byteLength || pdf.length }));
    return { pdf, name: dpFileName(slug, reader, one), cached: false };
  } finally { try { await browser.close(); } catch (e) {} }
}

export async function dpRoute(request, env, url) {
  const p = url.pathname;
  let m = p.match(/^\/dp\/f\/([a-z0-9-]{1,60})-(investor|keeper|seller)-(one|full)\.pdf$/);   // v772 - the PDF WhatsApp fetches as a document
  if (m) { const r = await dpPdf(env, m[1], m[2], m[3] === "one", url.origin); if (!r) return new Response("not found", { status: 404 });
    return new Response(r.pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="' + r.name + '"', "Cache-Control": "public, max-age=3600", "X-Dp-Cached": r.cached ? "1" : "0" } }); }
  m = p.match(/^\/dp\/img\/([a-z0-9-]{1,40})(?:\.(?:jpg|png))?$/);
  if (m) {
    const name = m[1] === "card" ? "card_najjuko" : m[1];
    if (m[1] === "card" && Date.now() > Date.parse(NAJ_BRN_EXPIRES + "T23:59:59+04:00")) return new Response("not found", { status: 404 });
    const buf = await env.MEETINGS.get("dp_img_" + name, "arrayBuffer"); if (!buf) return new Response("not found", { status: 404 });
    return new Response(buf, { headers: { "Content-Type": (await env.MEETINGS.get("dp_img_" + name + "_meta")) || "image/jpeg", "Cache-Control": "public, max-age=86400" } });
  }
  m = p.match(/^\/dp\/([a-z0-9-]{1,60})\/?$/); if (!m) return null;
  const d = await dpLoad(env, m[1]); if (!d) return new Response("not found", { status: 404 });
  const reader = dpReader(url.searchParams.get("r")), ty = url.searchParams.get("ty") === "1";
  const html = url.searchParams.get("v") === "full" ? dpFull(d, reader, ty) : dpOnePager(d, reader, ty);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
