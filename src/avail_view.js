// v784 (Kendall 5 Nov 2026: "show live availability on building and district passports") - developer availability on passports.
// Data: KV av_e_<entity> / av_p_<plot id> / av_c_<community key> / av_meta, written by naj-market-pulse scripts/export_avail_kv.py
// from MotherDuck dev_avail_map + dev_sheet_unit (the developer sheets in the DEVELOPER AVAILABILITY WhatsApp group).
// Rules: availability ONLY from developer sheets; always the developer + sheet date; a sheet older than 30 days says so;
// asking prices are labelled as the developer's and never mixed with Land Department sale prices; missing facts are left off.

const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const int = (n) => Math.round(+n).toLocaleString("en-US");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const avDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? +m[3] + " " + MON[+m[2] - 1] + " " + m[1] : ""; };
const aed = (n) => (n >= 1e6 ? "AED " + (Math.round(n / 1e4) / 100).toFixed(2) + "M" : "AED " + int(Math.round(n / 1000)) + "K");
const rngTxt = (r, f) => (!r ? "" : r[0] === r[1] ? f(r[0]) : f(r[0]) + " – " + f(r[1]));
const psfTxt = (n) => "AED " + int(n);
export const AV_STALE_DAYS = 30;

export function avAge(sheetDate, nowMs) {
  const t = Date.parse(String(sheetDate || "") + "T00:00:00Z");
  return Number.isFinite(t) ? Math.floor(((nowMs || Date.now()) - t) / 86400e3) : null;
}
export function avSourceLine(rec, nowMs) {
  const age = avAge(rec.sheet_date, nowMs), d = avDate(rec.sheet_date);
  const base = "From " + rec.developer + "’s availability sheet · " + d;
  return age != null && age > AV_STALE_DAYS ? "From " + rec.developer + "’s availability sheet · sheet from " + d + ": may have changed, ask Najjuko" : base;
}
export const avStale = (rec, nowMs) => { const a = avAge(rec.sheet_date, nowMs); return a != null && a > AV_STALE_DAYS; };

async function readJ(env, k) { try { const v = await env.MEETINGS.get(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
// both spellings of a plot id: naj:plot:681-7754 and naj:plot:6817754
export function avPlotKeys(plotId) {
  const id = String(plotId || ""), m = /^naj:plot:(\d{3})-(\d+)$/.exec(id), d = /^naj:plot:(\d{7,})$/.exec(id);
  const out = [id];
  if (m) out.push("naj:plot:" + m[1] + String(m[2]).padStart(4, "0"));
  if (d) out.push("naj:plot:" + d[1].slice(0, 3) + "-" + parseInt(d[1].slice(3), 10));
  return [...new Set(out)];
}
// every availability record for a plot (a plot can carry more than one building)
export async function avFor(env, plotId) {
  const ids = [];
  for (const k of avPlotKeys(plotId)) { const v = await readJ(env, "av_p_" + k); if (Array.isArray(v)) ids.push(...v); }
  const out = [];
  for (const e of [...new Set(ids)]) { const r = await readJ(env, "av_e_" + e); if (r && r.units > 0) out.push(r); }
  return out;
}
export const avCommKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
export async function avCommunity(env, names) {
  for (const n of [].concat(names || [])) { const v = await readJ(env, "av_c_" + avCommKey(n)); if (v && Array.isArray(v.projects) && v.projects.length) return v; }
  return null;
}

// ---- PDF / A4 passport card (bd-* classes of passport_pages.js) ----
export function availCardPdf(A, regPsf, nowMs) {
  if (!A || !A.length) return "";
  const rows = [];
  for (const r of A) {
    const beds = (r.beds || []).slice(0, 5);
    rows.push('<div class="av-h"><b>' + esc(r.project) + '</b><span>' + int(r.units) + (r.units === 1 ? " unit" : " units") + " available</span></div>"
      + '<div class="av-g">' + beds.map((b) => '<div class="av-c"><span>' + esc(b.type) + "</span><b>" + int(b.n) + '</b><i>' + (b.price ? esc(rngTxt(b.price, aed)) : "") + "</i>"
        + (b.size ? "<i>" + esc(rngTxt(b.size, int)) + " sq ft</i>" : "") + (b.psf ? "<i>" + esc(rngTxt(b.psf, psfTxt)) + "/sq ft asking</i>" : "") + "</div>").join("") + "</div>"
      + (r.payment_plan && r.payment_plan.length ? '<div class="av-n">Payment plan on the sheet: ' + esc(r.payment_plan.join(" · ")) + "</div>" : "")
      + '<div class="av-s' + (avStale(r, nowMs) ? " av-old" : "") + '">' + esc(avSourceLine(r, nowMs)) + "</div>");
  }
  const cmp = regPsf ? '<div class="av-n">For comparison, Land Department register: median <b>AED ' + int(regPsf) + "/sq ft</b> paid (12 months). Developer prices above are asking prices.</div>" : "";
  return '<div class="bd-card bd-c-av"><div class="bd-h"><span class="bd-t">Available now</span><span class="bd-chip" style="background:#FBEBCB;color:#8A5A12">Developer sheet</span></div><div class="bd-body">'
    + rows.join("") + cmp + "</div></div>";
}
export const AV_PDF_CSS = "<style id=\"bpp-av\">.av-h{display:flex;justify-content:space-between;align-items:baseline;gap:3mm;margin:.6mm 0 1.2mm}.av-h b{font:700 8.4pt Inter,sans-serif;color:#0F3D33}.av-h span{font:600 7pt Inter,sans-serif;color:#0A4F4A}"
  + ".av-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(32mm,1fr));gap:1.6mm}.av-c{background:#FBF8F1;border:.25mm solid #E4D8BF;border-radius:2.2mm;padding:1.4mm 2mm;display:flex;flex-direction:column;gap:.3mm;min-width:0}"
  + ".av-c span{font:600 6.4pt Inter,sans-serif;color:#0A4F4A}.av-c b{font:700 12pt Fraunces,Georgia,serif;color:#1C2826;line-height:1.05}.av-c i{font:500 5.8pt Inter,sans-serif;font-style:normal;color:#5F6B66;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
  + ".av-n{font:500 6.6pt Inter,sans-serif;color:#1C2826;margin-top:1.2mm}.av-s{font:500 5.8pt Inter,sans-serif;color:#5F6B66;margin:1mm 0 1.6mm}.av-old{color:#8A5A12}</style>";

// ---- web card (personal /p/ pages, /dp/ district pages, Momo) ----
export function availCardWeb(A, opts) {
  if (!A || !A.length) return "";
  const o = opts || {}, now = o.now || Date.now();
  const card = (r) => '<div class="avw-p"><div class="avw-h"><b>' + esc(r.project) + "</b><span>" + int(r.units) + (r.units === 1 ? " unit" : " units") + "</span></div>"
    + '<div class="avw-g">' + (r.beds || []).slice(0, 6).map((b) => '<div class="avw-c"><span>' + esc(b.type) + "</span><b>" + int(b.n) + "</b>" + (b.price ? "<i>" + esc(rngTxt(b.price, aed)) + "</i>" : "")
      + (b.psf ? "<i>" + esc(rngTxt(b.psf, psfTxt)) + "/sq ft asking</i>" : "") + "</div>").join("") + "</div>"
    + '<div class="avw-s' + (avStale(r, now) ? " avw-old" : "") + '">' + esc(avSourceLine(r, now)) + "</div></div>";
  return '<section class="avw" id="' + esc(o.id || "available") + '"><h2>' + esc(o.title || "Available now") + "</h2>"
    + (o.note ? '<p class="avw-note">' + esc(o.note) + "</p>" : "") + A.map(card).join("")
    + (o.regPsf ? '<p class="avw-note">Land Department register: median <b>AED ' + int(o.regPsf) + "/sq ft</b> paid. Developer prices are asking prices.</p>" : "") + "</section>";
}
// district roll-up: one card per project in the community, from av_c_<community>
export function availRollupWeb(C, opts) {
  if (!C || !C.projects || !C.projects.length) return "";
  const o = opts || {}, now = o.now || Date.now();
  const P = C.projects.slice().sort((a, b) => b.units - a.units);
  const total = P.reduce((s, p) => s + (p.units || 0), 0);
  const open = o.bare ? '<div class="avw">' : '<section class="avw" id="' + esc(o.id || "available") + '"><h2>' + esc(o.title || "Available now in " + (C.community || "this area")) + "</h2>";
  return open
    + '<p class="avw-note">' + int(total) + " units across " + P.length + (P.length === 1 ? " project" : " projects") + ", from the developers’ own availability sheets.</p>"
    + P.map((p) => '<div class="avw-p"><div class="avw-h"><b>' + esc(p.project) + "</b><span>" + int(p.units) + (p.units === 1 ? " unit" : " units") + "</span></div>"
      + '<div class="avw-r">' + esc(p.developer) + (p.types && p.types.length ? " · " + esc(p.types.join(", ")) : "") + (p.price ? " · " + esc(rngTxt(p.price, aed)) : "") + (p.psf ? " · " + esc(rngTxt(p.psf, psfTxt)) + "/sq ft asking" : "") + "</div>"
      + '<div class="avw-s' + (avStale(p, now) ? " avw-old" : "") + '">' + esc(avSourceLine(p, now)) + "</div></div>").join("") + (o.bare ? "</div>" : "</section>");
}
export const AV_WEB_CSS = ".avw{margin:18px 0}.avw h2{font:600 1.15rem Fraunces,Georgia,serif;color:#0A4F4A;margin:0 0 8px}.avw-note{font:500 .84rem Inter,sans-serif;color:#5F6B66;margin:6px 0 10px}"
  + ".avw-p{background:#FFFDF9;border:1px solid #E7E1D6;border-radius:14px;padding:12px;margin:0 0 10px}.avw-h{display:flex;justify-content:space-between;gap:10px;align-items:baseline}.avw-h b{font:600 1rem Fraunces,Georgia,serif;color:#0F3D33}.avw-h span{font:600 .82rem Inter,sans-serif;color:#0A4F4A}"
  + ".avw-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}.avw-c{background:#F7F3EA;border-radius:12px;padding:9px 10px;display:flex;flex-direction:column;gap:2px;min-width:0}"
  + ".avw-c span{font:600 .74rem Inter,sans-serif;color:#0A4F4A}.avw-c b{font:600 1.25rem Fraunces,Georgia,serif;color:#1C2826}.avw-c i{font:500 .74rem Inter,sans-serif;font-style:normal;color:#5F6B66;overflow-wrap:anywhere}"
  + ".avw-r{font:500 .84rem Inter,sans-serif;color:#1C2826;margin-top:6px}.avw-s{font:500 .74rem Inter,sans-serif;color:#5F6B66;margin-top:8px}.avw-old{color:#8A5A12}";
