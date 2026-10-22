// v622 - the morning feed as a PDF for the graphic designer. Najjuko says "pdf" after the list; every angle of today's set becomes one card
// (headline, the big figure, who it speaks to, the source) with a "For the designer" box: format, artwork lead time, picture direction.
// FN Realty look (navy, peach, gold, Anton + Inter), outline icons only, no emoji. Pure functions plus one render/store/send step.
import { PK, pkIcon } from "./pdf_kit.js";
import { FN_LOGO_B64, FN_LATTICE_B64, FN_NAVY, FN_PEACH, FN_GOLD } from "./fn_logo.js";
import { BRIEF_KIT } from "./brief_docs.js";

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

// family -> [label, icon, kind chip, format, lead days, picture direction]
const FAM = {
  prices: ["Prices", "chart", "Move", "Post", 7, "A clean skyline of the district with space above for the figure."],
  rents_yields: ["Rents and yields", "key", "Invest", "Post", 7, "A bright living room with a door ajar and a key on the table."],
  volume: ["Market volume", "chart", "Move", "Story", 3, "A busy street of the district at golden hour, wide shot."],
  handover_supply: ["Handovers and supply", "tower", "Move", "Carousel", 14, "Towers at completion, scaffolding coming down, warm light."],
  developer: ["Developers", "builder", "Authority", "Carousel", 14, "A crane over a rising tower at dusk."],
  district: ["District", "pin", "Authority", "Carousel", 14, "A walkable street of the district with trees and cafes."],
  offplan_ready: ["Off-plan and ready", "calendar", "Invest", "Post", 7, "A model of the project beside a finished home."],
  news: ["Market news", "media", "Move", "Story", 3, "A newsstand mood: layered paper textures in navy and gold."],
  transit: ["Transit", "train", "Move", "Story", 3, "A metro platform with the station name out of focus."],
  buyer_maths: ["Buyer maths", "tag", "Invest", "Post", 7, "A calculator and keys on a desk in morning light."],
  city_life: ["City life", "city", "Authority", "Reel", 21, "A short, slow walk through the neighbourhood at sunset."],
  inventory: ["Inventory", "home", "Move", "Post", 7, "A row of doors, one open, warm light behind it."],
  education: ["Learn", "school", "Authority", "Carousel", 14, "A notebook and a floor plan, flat lay, soft shadows."],
  growth_plan: ["Growth plan", "chart", "Invest", "Carousel", 14, "A cut-away of a tower with a rising line behind it."],
};
const famOf = (a) => FAM[a && a.family] || FAM.education;

function card(a, i) {
  const f = famOf(a);
  return '<div class=card><div class=row><div class=num>' + (i + 1) + '</div><div class=fam>' + pkIcon(f[1], 16, FN_GOLD) + '<span>' + esc(f[0]) + '</span></div><div class=chip>' + esc(f[2]) + '</div></div>'
    + '<div class=cols><div class=main><h3>' + esc(a.hook) + '</h3>'
    + '<div class=fig>' + esc(a.figure) + '</div>'
    + (a.buyer ? '<div class=lbl>Who it speaks to</div><div class=who>' + esc(a.buyer) + '</div>' : '')
    + '<div class=src>Source: ' + esc(a.source || "Najma market data") + '</div></div>'
    + '<div class=des><div class=dh>For the designer</div>'
    + '<div class=k>Format</div><div class=v>' + esc(f[3]) + '</div>'
    + '<div class=k>Artwork lead time</div><div class=v>' + f[4] + ' days</div>'
    + '<div class=k>Picture direction</div><div class=v>' + esc(f[5]) + '</div>'
    + '<div class=nb>Illustration only. No text, no people inside the picture.</div></div></div></div>';
}

export function feedPdfHtml(angles, dateStr) {
  const list = (angles || []).filter(a => a && a.hook && !a.campaign).slice(0, 10);
  const tiles = list.map((a, i) => '<div class=tile><b>' + (i + 1) + '</b><span>' + esc(a.hook) + '</span></div>').join("");
  const pages = [];
  for (let i = 0; i < list.length; i += 2) pages.push('<section class=pg>' + band() + card(list[i], i) + (list[i + 1] ? card(list[i + 1], i + 1) : "") + foot() + '</section>');
  return '<!doctype html><html><head><meta charset=utf-8><title>Market news for the designer</title>'
    + '<link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600&display=swap"><style>'
    + '@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Inter,sans-serif;color:' + FN_NAVY + ';-webkit-print-color-adjust:exact}'
    + '.pg{width:210mm;height:297mm;padding:0 14mm;position:relative;page-break-after:always;overflow:hidden;background:#FBF7F0}'
    + '.band{height:14mm;margin:0 -14mm 8mm;background:' + FN_NAVY + ' url(' + FN_LATTICE_B64 + ') repeat-x center/auto 100%;display:flex;align-items:center;padding:0 14mm;justify-content:space-between}'
    + '.band img{height:10mm;background:#FBF7F0;border-radius:2mm;padding:.8mm 2mm}.band span{color:' + FN_GOLD + ';font-size:8pt;letter-spacing:.14em}'
    + '.card{background:#fff;border:1px solid #E6DCCB;border-radius:4mm;padding:6mm;margin-bottom:6mm;min-height:60mm}'
    + '.row{display:flex;align-items:center;gap:3mm}.num{width:9mm;height:9mm;border-radius:50%;background:' + FN_NAVY + ';color:' + FN_PEACH + ';font:400 13pt Anton,sans-serif;display:flex;align-items:center;justify-content:center}'
    + '.fam{display:flex;align-items:center;gap:2mm;font-size:8.5pt;font-weight:600;color:#8A6F3E;text-transform:uppercase;letter-spacing:.08em;flex:1}'
    + '.chip{background:' + FN_PEACH + ';border-radius:99px;padding:1mm 3.5mm;font-size:8pt;font-weight:600}'
    + '.cols{display:flex;gap:6mm;margin-top:4mm}.main{flex:1.5}.des{flex:1;background:#F4EEE2;border-radius:3mm;padding:4mm;font-size:8.5pt}'
    + 'h3{font:400 17pt/1.2 Anton,sans-serif;letter-spacing:.01em;margin:0 0 3mm}'
    + '.fig{font:400 22pt/1.15 Anton,sans-serif;color:' + FN_GOLD + ';margin:2mm 0 3mm}'
    + '.lbl,.k{font-size:7pt;letter-spacing:.12em;text-transform:uppercase;color:#8A6F3E;font-weight:600;margin-top:3mm}.who{font-size:9.5pt}.v{font-size:9pt;margin-top:.5mm}'
    + '.src{font-size:8pt;color:#5F6B66;margin-top:4mm}.dh{font:400 11pt Anton,sans-serif;letter-spacing:.04em}.nb{margin-top:4mm;font-size:8pt;font-style:italic;color:#5F6B66}'
    + '.foot{position:absolute;left:14mm;right:14mm;bottom:8mm;font-size:7pt;color:#5F6B66;text-align:center}'
    + '.cover h1{font:400 34pt/1.05 Anton,sans-serif;margin:10mm 0 2mm}.cover p{font-size:10pt;margin:0 0 6mm;color:#5F6B66}'
    + '.tiles{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.tile{display:flex;gap:3mm;background:#fff;border:1px solid #E6DCCB;border-radius:3mm;padding:3mm;font-size:9pt;align-items:center}'
    + '.tile b{font:400 14pt Anton,sans-serif;color:' + FN_GOLD + '}.how{margin-top:8mm;background:#F4EEE2;border-radius:3mm;padding:5mm;font-size:9pt;line-height:1.5}'
    + '</style></head><body>'
    + '<section class="pg cover">' + band() + '<h1>Market news for the designer</h1><p>' + esc(dateStr || "") + ' &middot; ' + list.length + ' ideas from this morning\'s Najma list</p>'
    + '<div class=tiles>' + tiles + '</div>'
    + '<div class=how><b>How to use this page.</b> Each idea has one card. The headline and the figure go on the artwork exactly as written. The right-hand box says the format, how many days the artwork needs, and what the picture should show. Pictures are illustrations only: no text and no people inside them.</div>'
    + foot() + '</section>' + pages.join("") + '</body></html>';
}
function band() { return '<div class=band><img src="' + FN_LOGO_B64 + '" alt=""><span>FN REALTY &middot; MARKET NEWS</span></div>'; }
function foot() { return '<div class=foot>Figures are from public Dubai records and market data; illustrations only. Curated by Najjuko &middot; Dubai Decoded</div>'; }

// render, store under an unguessable name, return {name, bytes}
export async function feedPdfStore(env, angles, dateStr, deps) {
  const html = feedPdfHtml(angles, dateStr);
  const render = (deps && deps.renderPdf) || BRIEF_KIT.renderPdf;
  const pdf = await render(env, html);
  const rnd = new Uint8Array(12); crypto.getRandomValues(rnd);
  const name = "feedpdf_" + Array.from(rnd).map(b => b.toString(16).padStart(2, "0")).join("");
  const buf = pdf instanceof ArrayBuffer ? pdf : (pdf.buffer ? pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) : pdf);
  await env.MEETINGS.put("img_" + name, buf, { expirationTtl: 3 * 86400 });
  await env.MEETINGS.put("img_ct_" + name, "application/pdf", { expirationTtl: 3 * 86400 });
  return { name, bytes: buf.byteLength };
}

export const FEED_PDF_RX = /^(?:feed\s+pdf|pdf|designer(?:\s+pdf)?|send\s+(?:it\s+)?to\s+(?:the\s+)?designer|(?:feed|list)\s+to\s+designer)\s*[?!.]*$/i;
