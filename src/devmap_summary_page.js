// v353 - the drawing of the executive summary page (the reading itself is in devmap_summary.js: pure, rule-based, tested).
import { esc } from "./brief_docs.js";
import { icon } from "./devmap_pdf.js";
import { LABEL, HOW } from "./devmap_summary.js";

const TEAL = "#0A4F4A", GOLDI = "#C5A56A", RUST = "#A4502A", HAIR = "#E6E1D8", MUTED = "#6B7A76", NAVY = "#1D2B3A";
const VC = { sup: TEAL, mix: "#9A7B2F", cau: RUST, na: "#8A9A96" };
const small = (c) => '<div class="esc"><div class="esn">' + esc(c.number || "") + '</div><div class="est"><b>' + esc(c.title) + "</b><span>" + esc(c.text) + "</span></div></div>";

// pages = { headline, decision, evidence, scen, work }: the page numbers that exist in this document
export function summaryPage(C, m, A, pages) {
  const chipCls = { worth: "sup", mixed: "mix", weak: "cau" }[A.overall.key], c = A.overall.counts;
  const dims = '<div class="esd">' + A.dims.map((d) => '<div class="esdi" style="border-top-color:' + VC[d.verdict] + '"><span class="esdl">' + d.label + '</span><b style="color:' + VC[d.verdict] + '">' + LABEL[d.verdict] + "</b><em>" + esc(d.number) + "</em></div>").join("") + "</div>";
  const pointers = [];
  if (pages.headline) pointers.push("Price history chart: page " + pages.headline);
  if (pages.decision) pointers.push("Income, growth, supply, unit types: page " + pages.decision);
  if (pages.evidence) pointers.push("Buildings, rent, liquidity, off-plan: page " + pages.evidence);
  if (pages.scen) pointers.push("Scenarios: page " + pages.scen + (pages.work ? ", workings: page " + pages.work : ""));
  const col = (title, ic, color, cards) => '<div class="esc2"><div class="esh" style="color:' + color + '">' + icon(ic, 15, color) + "<span>" + title + "</span></div>" + cards.map(small).join("") + "</div>";
  return '<div class="esk"><div class="lbl" style="text-transform:uppercase">Should you invest here? What the register says</div>' +
    '<h1 class="serif esh1" style="font-size:16.5px;line-height:1.25;margin:0;font-weight:400">' + esc(A.headline) + "</h1>" +
    '<div class="esr"><span class="esch" style="background:' + VC[chipCls] + '">Reading: ' + esc(A.chip) + '</span><span class="esrt">' + c.sup + " supportive, " + c.mix + " mixed, " + c.cau + " cautionary" + (c.na ? ", " + c.na + " not rated" : "") + ". A reading of past register figures, not advice.</span></div></div>" +
    dims +
    '<div class="es2">' + col("Three reasons the register supports a closer look", "star", TEAL, A.reasons) + col("Three reasons for caution", "info", RUST, A.cautions) + "</div>" +
    '<div class="esstrip">' + A.key.map((k) => "<div class=\"esk5\"><span>" + esc(k.label) + "</span><b>" + esc(k.value) + "</b><em>" + esc(k.sub) + "</em></div>").join("") + "</div>" +
    '<div class="es2"><div class="esc2"><div class="esh" style="color:' + NAVY + '">' + icon("chart-bar", 15, NAVY) + "<span>What would change this view</span></div>" + A.changers.map(small).join("") + "</div>" +
    '<div class="esc2"><div class="esh" style="color:' + NAVY + '">' + icon("chat-circle-text", 15, NAVY) + "<span>Questions to ask before buying</span></div>" + A.questions.map((q) => '<div class="esq"><b>' + esc(q.title) + "</b><span>" + esc(q.text) + "</span></div>").join("") + "</div></div>" +
    '<div class="espt">' + icon("map-pin", 13, TEAL) + "<span><b>Where to find the evidence.</b> " + pointers.join(" &middot; ") + ".</span></div>" +
    '<div class="eshow">' + esc(HOW) + "</div>" +
    '<div class="i3disc"><b>Please read.</b> Past figures only: not a forecast, not a promised return, not financial advice and not an offer. Vacancy, management fees, selling costs and any loan are assumptions or are not in any register; replace them with your own. Check each property and your own circumstances with a licensed adviser before buying.</div>';
}
export const SUMMARY_CSS = `
  .esk { display:flex; flex-direction:column; gap:6px; } .es2 { margin-top:2px; } .esh1 { font-size:16.5px; line-height:1.25; margin:0; color:${NAVY}; font-weight:400; }
  .esr { display:flex; align-items:center; gap:10px; } .esch { color:#fff; font-size:11px; font-weight:600; padding:3px 11px; border-radius:12px; white-space:nowrap; } .esrt { font-size:9.2px; color:${MUTED}; }
  .esd { display:grid; grid-template-columns:repeat(5,1fr); gap:7px; } .esdi { border:1px solid ${HAIR}; border-top:3px solid ${TEAL}; border-radius:5px; background:#fff; padding:4px 8px; display:flex; flex-direction:column; }
  .esdl { font-size:8.2px; color:${MUTED}; text-transform:uppercase; letter-spacing:.03em; } .esdi b { font-size:11px; font-weight:600; } .esdi em { font-style:normal; font-size:9px; color:#3d4249; }
  .es2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; align-items:start; } .esc2 { display:flex; flex-direction:column; gap:5px; }
  .esh { display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; }
  .esc { display:grid; grid-template-columns:84px 1fr; gap:8px; align-items:center; border:1px solid ${HAIR}; border-radius:6px; background:#fff; padding:6px 9px; }
  .esn { font-family:Newsreader, Georgia, serif; font-size:16px; color:${NAVY}; line-height:1.1; white-space:nowrap; } .est { display:flex; flex-direction:column; } .est b { font-size:10px; color:${NAVY}; } .est span { font-size:9px; color:#3d4249; line-height:1.34; }
  .esstrip { display:grid; grid-template-columns:repeat(5,1fr); gap:7px; } .esk5 { background:#F8F5EE; border-radius:6px; padding:5px 9px; display:flex; flex-direction:column; border-top:3px solid ${GOLDI}; }
  .esk5 span { font-size:8.2px; color:#3d4249; } .esk5 b { font-family:Newsreader, Georgia, serif; font-size:19px; font-weight:400; color:${NAVY}; } .esk5 em { font-style:normal; font-size:8px; color:${MUTED}; }
  .esq { border:1px solid ${HAIR}; border-left:3px solid ${GOLDI}; border-radius:5px; background:#fff; padding:4px 8px; display:flex; flex-direction:column; gap:1px; } .esq b { font-size:9.8px; color:${NAVY}; } .esq span { font-size:8.9px; color:#3d4249; line-height:1.34; }
  .espt { display:flex; gap:7px; align-items:center; font-size:9px; color:#3d4249; background:#EEF4F2; border-radius:5px; padding:4px 10px; } .eshow { font-size:7.8px; color:${MUTED}; line-height:1.35; }
`;
