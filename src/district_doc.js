// v774 PERSONAL PASSPORT PAGE /p/<code> (Kendall 5 Nov 2026, after the v772 keeper PDF: "garbage ... would that make you want to buy? No";
// then: "personalised HTML on a short link ... much cleaner and richer, because a page can do more than a PDF").
// One page per recipient (campaign + contact + reader): cover with the saved illustration, "Prepared for <name> · <date>", Najjuko's note that
// reflects their answer; section anchors (Overview · Prices · Handover · Rent · Area); tap a row to expand, tap "i" for the full source,
// tap the broker card to enlarge, Google Maps for the location, WhatsApp to Najjuko with a pre-filled line; "Save as PDF" prints the same
// design as tall full pages. Light/cream only. Figures and text from stored data only (dpLoad); a missing fact is left off.
// The code is random (8 chars); no name or number is ever in the address. Each open is recorded and feeds the follow-up task.
import { dpLoad, srcLabel, dpDate, dpReader } from "./district_passport.js";
import { NAJ_BRN, NAJ_BRN_EXPIRES } from "./campaigns.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const gap = (v) => v == null || v === "" || (typeof v === "string" && /^(to confirm|to be announced|n\/a)$/i.test(v.trim())) || (Array.isArray(v) && !v.length);
const fv = (f) => (f && !gap(f.value) ? f.value : null);
const fs = (f) => (f ? srcLabel(f.source, f.as_of) : "");
const fsFull = (f) => (f ? String(f.source || "").replace(/\S+\.(pdf|xlsx?|docx?|png|jpe?g)\b/gi, "").replace(/\(local [^)]*\)/gi, "").replace(/\s+/g, " ").trim() + (f.as_of ? " · as of " + dpDate(f.as_of) : "") : "");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const NAJ_WA = "971565484397";

export const DOC_WHY = {
  keeper: { why: "for owners keeping their home at Palm Jebel Ali", told: "you're keeping your home until handover, so here is what matters for you: when the buildings are handed over, what homes like yours could rent for, and how values are moving." },
  seller: { why: "for owners thinking about selling at Palm Jebel Ali", told: "you're open to selling, so here is what matters for you: what homes are selling for by bedroom, how prices have moved this year, and how fast homes are changing hands." },
  investor: { why: "for investors looking at the next Palm launch", told: "you're interested in another Palm investment, so here is what matters for you: the Palm Springs launch, how Palm Jebel Ali has priced this year, and what is being built." },
};
export const docTitle = (slug) => (slug === "palm-springs" ? "Palm Springs" : "Palm Jebel Ali");
export const docCaption = (name, slug) => "Thank you" + (name ? ", " + name : "") + ". Your " + docTitle(slug) + " passport is ready:";

async function J(env, k) { try { const v = await env.MEETINGS.get(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function code8() { const a = "abcdefghjkmnpqrstuvwxyz23456789"; let s = ""; for (const x of crypto.getRandomValues(new Uint8Array(8))) s += a[x % a.length]; return s; }
// one code per campaign + contact + district + reader; tapping again reuses it
export async function docCreate(env, o) {
  const by = "dp_docby_" + String(o.cid || "x") + "_" + String(o.d || "x") + "_" + o.slug + "_" + dpReader(o.reader);
  let c = await env.MEETINGS.get(by); if (!c) { c = code8(); await env.MEETINGS.put(by, c, { expirationTtl: 120 * 86400 }); }
  const prev = await J(env, "dp_doc_" + c);
  await env.MEETINGS.put("dp_doc_" + c, JSON.stringify(Object.assign(prev || { opens: 0 }, { slug: o.slug, reader: dpReader(o.reader), name: String(o.name || "").slice(0, 40), answer: String(o.answer || "").slice(0, 60), cid: o.cid || "", d: o.d || "", at: new Date(o.now || Date.now()).toISOString() })), { expirationTtl: 120 * 86400 });
  return c;
}

// ---------- building blocks ----------
const I_ICON = '<svg width=14 height=14 viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=2 aria-hidden=true><circle cx=12 cy=12 r=9 /><path d="M12 11v6M12 7.5v.5"/></svg>';
const src = (f) => (f ? '<details class=src><summary>' + I_ICON + "<span>" + esc(fs(f)) + "</span></summary><p>" + esc(fsFull(f)) + "</p></details>" : "");
const stat = (k, v, f, big, note) => gap(v) ? "" : '<div class="st' + (big ? " big" : "") + '"><div class=k>' + esc(k) + "</div><div class=v>" + esc(v) + "</div>" + (note ? "<div class=nt>" + esc(note) + "</div>" : "") + src(f) + "</div>";
function psfChart(f) {
  const v = fv(f.pja_psf_by_month); if (!Array.isArray(v)) return "";
  const rows = v.filter((m) => m.sales >= 5); if (!rows.length) return "";
  const mx = Math.max(...rows.map((m) => m.median_psf)), mn = Math.min(...rows.map((m) => m.median_psf));
  return '<div class=card><div class=k>Median price per sq ft, by month</div><div class=chart>' + rows.map((m) => '<div class=col><b>' + (m.median_psf / 1000).toFixed(2) + 'k</b><i style="height:' + (35 + Math.round(60 * (m.median_psf - mn) / Math.max(1, mx - mn))) + '%"></i><span>' + MON[+m.month.slice(5) - 1] + "</span><em>" + m.sales + "</em></div>").join("")
    + "</div><div class=nt>AED per sq ft; the small number is how many homes sold that month. Months with fewer than 5 sales are left out.</div>" + src(f.pja_psf_by_month) + "</div>";
}
function projectRows(f, b) {   // tap a project to see its sales by bedroom
  const pipe = fv(f.pja_supply_pipeline), p = b && b.price && !gap(b.price.value) ? b.price : null; if (!Array.isArray(pipe)) return "";
  const R = {}; if (p && typeof p.value === "string") p.value.split(";").forEach((x) => { const m = /Frond\s+(\w)\s+(\d)\s*B\/R median AED ([\d,]+) \((\d+) sales\)/.exec(x); if (m) (R[m[1]] = R[m[1]] || []).push([m[2], m[3], m[4]]); });
  return pipe.map((x) => { const fr = (/Frond\s+(\w)/.exec(x.project) || [])[1], rows = (R[fr] || []).filter((r) => +r[0] <= 4);
    return '<details class=proj><summary><div><b>' + esc(x.project.replace(/^Palm Central Private Residences - /, "Palm Central · ")) + "</b><span>" + esc(x.units) + " homes · handover planned " + esc(dpDate(x.planned_end)) + "</span></div><i class=chev aria-hidden=true></i></summary>"
      + (rows.length ? '<div class=beds>' + rows.map((r) => '<div><span>' + r[0] + " bed</span><b>AED " + (Number(r[1].replace(/,/g, "")) / 1e6).toFixed(2) + "M</b><em>" + r[2] + " sales</em></div>").join("") + "</div>" + src(p) : "<p class=nt>No sales by bedroom on record yet.</p>") + "</details>"; }).join("") + src(f.pja_supply_pipeline);
}
function rentCards(f) { const c = fv(f.comparable_rents_palm_jumeirah); return Array.isArray(c) ? c.map((x) => stat("Palm Jumeirah " + (x.type === "Flat" ? "apartments" : "villas"), x.median_annual + " a year", f.comparable_rents_palm_jumeirah, false, "median of " + x.contracts + " rent contracts")).join("") : ""; }
function areaCards(d) {
  const a = d.dna; if (!a) return "";
  const l = (t) => (a.lines || []).find((x) => x.t === t), ga = l("getting_around"), al = l("active_lifestyle"), S = (s, as) => ({ source: s, as_of: as });
  return stat("Liveability, Jebel Ali district", a.live && a.live.p ? Math.round(a.live.p.default) + " / 100" : null, a.live ? S("Najma liveability score, version " + a.live.v, a.live.as_of) : null, true, a.live ? "families " + Math.round(a.live.p.family) + " · retirees " + Math.round(a.live.p.retiree) : "")
    + stat("Green cover", a.green ? a.green.share + "% of the district" : null, a.green ? S(a.green.src, a.green.d) : null)
    + (ga ? stat("Getting around", ga.s.replace(/^.*?: /, "").replace(/, across.*$/, ""), S(ga.src, ga.as_of)) : "")
    + (al ? stat("Active life", al.s.replace(/^.*?: /, ""), S(al.src, al.as_of)) : "");
}

export function docHtml(d, rec, origin) {
  const b = d.brief, f = d.facts, r = dpReader(rec.reader), W = DOC_WHY[r], name = rec.name || "", when = dpDate(rec.at), O = origin || "";
  const isPS = d.slug === "palm-springs", title = docTitle(d.slug);
  const n = fv(f.pja_home_sales) ? String(fv(f.pja_home_sales)).match(/^\d+/)[0] : null;
  const psf = fv(f.pja_median_psf) ? String(fv(f.pja_median_psf)).replace(/ \(median, home sales\)/, "") : null, med = fv(f.pja_median_price) ? String(fv(f.pja_median_price)).replace(/ \(median home sale\)/, "") : null;
  const pipe = fv(f.pja_supply_pipeline);
  const wa = "https://wa.me/" + NAJ_WA + "?text=" + encodeURIComponent("Hi Najjuko, I read my " + title + " passport and would like to talk.");
  const maps = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(isPS ? "Palm Springs Nakheel Jebel Ali Dubai" : "Palm Jebel Ali Dubai");
  const ov = isPS
    ? stat("Price, indicative pre-launch", String(fv(b.price) || "").replace(/\s*\(indicative pre-launch pricing\)/i, "") || null, b.price, true) + stat("Homes", fv(b.unit_types), b.unit_types) + stat("Developer", fv(b.developer), b.developer)
      + stat("Highlights", Array.isArray(fv(b.highlights)) ? fv(b.highlights).join(" · ") : null, b.highlights) + stat("Next door: Palm Jebel Ali", n && psf ? n + " home sales this year · median " + psf : null, f.pja_median_psf, false, "All Palm Jebel Ali sales so far are Palm Central apartments, so not like for like with Palm Springs villas.")
      + "<p class=soft>Najjuko will confirm the payment plan and handover date with you as soon as Nakheel releases them.</p>"
    : r === "keeper" ? stat("First planned handover", Array.isArray(pipe) ? dpDate(pipe[0].planned_end) : null, f.pja_supply_pipeline, true, Array.isArray(pipe) ? pipe[0].project.replace(/^Palm Central Private Residences - /, "Palm Central · ") : "") + stat("Median price per sq ft this year", psf, f.pja_median_psf) + stat("Home sales this year", n ? n + ", all off-plan" : null, f.pja_home_sales)
    : stat("Median price per sq ft this year", psf, f.pja_median_psf, true) + stat("Median sale price", med, f.pja_median_price) + stat("Home sales this year", n ? n + ", all off-plan" : null, f.pja_home_sales) + stat("Homes registered", fv(f.pja_units_registered), f.pja_units_registered);
  const secs = [["overview", "Overview", ov], ["prices", "Prices", psfChart(f)], ["handover", "Handover", projectRows(f, isPS ? null : b) ? "<p class=hint>Tap a building to see what its homes sold for, by bedroom.</p>" + projectRows(f, isPS ? null : b) : ""],
    ["rent", "Rent", rentCards(f) ? "<p class=soft>No home on Palm Jebel Ali is rented yet, so the nearest comparable is Palm Jumeirah.</p>" + rentCards(f) : ""], ["area", "Area", areaCards(d) ? areaCards(d) + '<p class=nt>Area figures are the Jebel Ali district, not Palm Jebel Ali alone.</p>' : ""]].filter((s) => s[2]);
  const order = r === "seller" ? ["overview", "prices", "handover", "rent", "area"] : r === "keeper" ? ["overview", "handover", "rent", "prices", "area"] : ["overview", "prices", "handover", "rent", "area"];
  secs.sort((a, x) => order.indexOf(a[0]) - order.indexOf(x[0]));
  const H = { overview: isPS ? "Palm Springs at a glance" : r === "keeper" ? "Your home, until handover" : r === "seller" ? "What your home could sell for" : "The numbers that matter", prices: "How Palm Jebel Ali has priced this year", handover: "What is being built, and when", rent: "What homes nearby rent for", area: "Living around Jebel Ali" };
  const card = Date.now() <= Date.parse(NAJ_BRN_EXPIRES + "T23:59:59+04:00");
  const ICON_WA = '<svg width=20 height=20 viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.8 aria-hidden=true><path d="M4 20l1.3-3.8A8 8 0 1 1 8 19z"/><path d="M9 9.5c.3 2 2 3.8 4.5 4.5l1-1.2 1.8.8"/></svg>';
  const ICON_MAP = '<svg width=18 height=18 viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.8 aria-hidden=true><path d="M12 21s-6-5.6-6-10.5a6 6 0 0 1 12 0C18 15.4 12 21 12 21z"/><circle cx=12 cy=10.5 r=2.2 /></svg>';
  const ICON_PDF = '<svg width=18 height=18 viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1.8 aria-hidden=true><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M12 11v6M9.5 14.5 12 17l2.5-2.5"/></svg>';
  const body = '<header class="cover pg"><img class=art src="' + O + "/dp/img/" + esc(d.S.img) + '" alt=""><div class=shade></div><div class=logos><img src="' + O + '/dp/img/logo-najma" alt="Najma"><img src="' + O + '/dp/img/logo-da" alt="DigitalAbbot"></div><span class=lab>Illustration</span>'
    + '<div class=ct><div class=kicker>' + (isPS ? "PROJECT PASSPORT" : "DISTRICT PASSPORT") + "</div><h1>" + esc(title) + "</h1><p class=why>" + esc(W.why) + '</p><div class=for>Prepared for <b>' + esc(name || "you") + "</b> · " + esc(when) + "</div>"
    + '<div class=note>' + esc((name ? "Dear " + name + ", thank you for taking the time. You told me " : "Thank you for taking the time. You told me ") + W.told) + "<i>Najjuko</i></div></div></header>"
    + '<nav class=nav>' + secs.map((s) => '<a href="#' + s[0] + '">' + s[1] + "</a>").join("") + "</nav>"
    + '<div class=tools><a href="' + maps + '" target=_blank rel=noopener>' + ICON_MAP + "Location</a><button type=button onclick=\"window.print()\">" + ICON_PDF + "Save as PDF</button></div>"
    + secs.map((s) => '<section class=pg id="' + s[0] + '"><div class=hd>' + esc(s[1].toUpperCase()) + "</div><h2>" + esc(H[s[0]]) + "</h2>" + s[2] + "</section>").join("")
    + '<section class="pg close" id=talk><div class=hd>TALK TO NAJJUKO</div><h2>' + esc(name ? name + ", let's talk it through" : "Let's talk it through") + "</h2><p class=lead>I'll reach out to you shortly. If you'd rather start now, message me on WhatsApp or send me an email.</p>"
    + '<a class=cta href="' + wa + '" target=_blank rel=noopener>' + ICON_WA + "Talk to Najjuko on WhatsApp</a><a class=\"cta o\" href=\"mailto:najma@digitalabbot.io?subject=" + encodeURIComponent("My " + title + " passport") + '">najma@digitalabbot.io</a>'
    + (card ? '<details class=bcard><summary><img src="' + O + '/dp/img/card" alt="Najjuko broker card"><div><b>Verified broker</b><span>BRN ' + NAJ_BRN + " · Faez Noorzad Real Estate. Tap to enlarge; check it with the QR code on the card.</span></div></summary><img class=big src=\"" + O + '/dp/img/card" alt="Najjuko broker card, full size"></details>' : "")
    + '<p class=fine>Najma by DigitalAbbot. Figures from the Land Department and Ejari registers and Nakheel releases, dated under each figure (tap the i). Estimate, not a valuation; pre-launch details may change on release.</p></section>';
  return '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=color-scheme content="light only"><meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content=noindex><meta name=theme-color content="#F7F3EA"><title>' + esc(title) + " passport" + (name ? " · " + esc(name) : "") + "</title>"
    + '<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,600;1,500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap" rel=stylesheet><style>' + CSS + "</style></head><body>" + body + "</body></html>";
}

const CSS = ':root{color-scheme:light only;--cream:#F7F3EA;--card:#FFFDF9;--line:#E7E1D6;--teal:#0A4F4A;--gold:#C5A56A;--gold2:#8A6F3E;--ink:#1C2826;--mute:#5F6B66}'
  + '*{box-sizing:border-box}html,body{margin:0;background:var(--cream)!important;color:var(--ink)!important;font-family:"IBM Plex Sans",sans-serif;scroll-behavior:smooth}body{max-width:560px;margin:0 auto}'
  + '.cover{position:relative;min-height:min(88vh,760px);display:flex;flex-direction:column;justify-content:flex-end;color:#fff;overflow:hidden}.art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}'
  + '.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,30,28,0) 25%,rgba(8,40,36,.7) 55%,rgba(8,40,36,.95) 100%)}.logos{position:absolute;top:16px;left:16px;right:16px;display:flex;justify-content:space-between}.logos img{height:34px;background:rgba(255,253,249,.94);border-radius:8px;padding:4px 8px}'
  + '.lab{position:absolute;right:16px;top:62px;font:600 .58rem "IBM Plex Mono",monospace;background:rgba(255,253,249,.85);color:var(--gold2);padding:2px 8px;border-radius:99px}.ct{position:relative;padding:0 20px 26px}'
  + '.kicker{font:600 .66rem "IBM Plex Mono",monospace;letter-spacing:.16em;color:#E9D9B5}.cover h1{font:600 2.6rem/1.02 Fraunces,serif;margin:6px 0 4px}.why{margin:0 0 14px;color:#E8F1EC;font-size:.95rem}'
  + '.for{font:600 .7rem "IBM Plex Mono",monospace;letter-spacing:.05em;color:#E9D9B5;border-top:1px solid rgba(233,217,181,.5);padding-top:10px}.for b{color:#fff}.note{margin-top:10px;font-size:.92rem;line-height:1.5;color:#F3F7F5}.note i{display:block;margin-top:6px;font:500 italic 1.15rem Fraunces,serif;color:#E9D9B5}'
  + '.nav{position:sticky;top:0;z-index:5;display:flex;gap:6px;overflow-x:auto;padding:10px 16px;background:rgba(247,243,234,.96);border-bottom:1px solid var(--line);scrollbar-width:none}.nav a{flex:none;font:600 .78rem "IBM Plex Sans",sans-serif;color:var(--teal);text-decoration:none;border:1px solid var(--line);background:#fff;border-radius:99px;padding:7px 12px}'
  + '.tools{display:flex;gap:8px;padding:12px 16px 0}.tools a,.tools button{flex:1;display:flex;gap:6px;align-items:center;justify-content:center;font:600 .82rem "IBM Plex Sans",sans-serif;color:var(--teal);background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px;text-decoration:none;cursor:pointer}'
  + 'section{padding:22px 16px 6px;scroll-margin-top:52px}.hd{font:600 .64rem "IBM Plex Mono",monospace;letter-spacing:.14em;color:var(--gold2)}h2{font:600 1.45rem/1.15 Fraunces,serif;color:var(--teal);margin:6px 0 12px}'
  + '.st,.card,.proj{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 15px;margin:0 0 10px}.k{font:600 .64rem "IBM Plex Mono",monospace;letter-spacing:.07em;color:var(--gold2);text-transform:uppercase}.v{font:600 1.35rem/1.2 Fraunces,serif;color:var(--teal);margin-top:4px}'
  + '.st.big{background:var(--teal);border-color:var(--teal)}.st.big .k{color:#E9D9B5}.st.big .v{color:#fff;font-size:2rem}.st.big .nt,.st.big .src summary{color:#CFE2D8}.nt{font-size:.8rem;color:var(--mute);margin-top:6px;line-height:1.4}.hint{font-size:.82rem;color:var(--mute);margin:-4px 0 10px}'
  + '.src{margin-top:8px}.src summary{list-style:none;display:flex;gap:6px;align-items:center;font-size:.72rem;color:var(--mute);cursor:pointer}.src summary::-webkit-details-marker{display:none}.src p{font-size:.74rem;color:var(--mute);margin:6px 0 0;padding:8px 10px;background:var(--cream);border-radius:8px}'
  + '.soft{font-size:.88rem;background:var(--card);border-left:4px solid var(--gold);padding:10px 12px;border-radius:10px;margin:0 0 10px}'
  + '.chart{display:flex;align-items:flex-end;gap:8px;height:190px;margin:12px 0 4px;border-bottom:1px solid var(--line)}.col{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center}.col i{width:100%;background:linear-gradient(var(--teal),#2C6B63);border-radius:8px 8px 0 0}'
  + '.col b{font:600 .78rem Fraunces,serif;color:var(--teal);margin-bottom:4px}.col span{font:600 .66rem "IBM Plex Mono",monospace;color:var(--gold2);margin-top:5px}.col em{font-style:normal;font-size:.6rem;color:var(--mute)}'
  + '.proj summary{list-style:none;display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer}.proj summary::-webkit-details-marker{display:none}.proj b{display:block;font:600 1.05rem Fraunces,serif;color:var(--teal)}.proj summary span{font-size:.8rem;color:var(--mute)}'
  + '.chev{width:10px;height:10px;border-right:2px solid var(--gold2);border-bottom:2px solid var(--gold2);transform:rotate(45deg);transition:.2s;flex:none}.proj[open] .chev{transform:rotate(225deg)}'
  + '.beds{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.beds div{background:var(--cream);border-radius:12px;padding:10px}.beds span{font:600 .64rem "IBM Plex Mono",monospace;color:var(--gold2)}.beds b{font-size:1.1rem!important}.beds em{display:block;font-style:normal;font-size:.7rem;color:var(--mute)}'
  + '.close{padding-bottom:30px}.lead{font-size:.95rem;line-height:1.5;margin:0 0 14px}.cta{display:flex;gap:8px;align-items:center;justify-content:center;background:var(--teal);color:#fff;border-radius:99px;padding:14px;font:600 1rem "IBM Plex Sans",sans-serif;text-decoration:none;margin-bottom:10px}.cta.o{background:#fff;color:var(--teal);border:1px solid var(--teal)}'
  + '.bcard{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:10px;margin:6px 0 12px}.bcard summary{list-style:none;display:flex;gap:10px;align-items:center;cursor:zoom-in}.bcard summary::-webkit-details-marker{display:none}.bcard summary img{width:110px;border-radius:6px}.bcard b{display:block;font:600 1rem Fraunces,serif;color:var(--teal)}.bcard span{font-size:.75rem;color:var(--mute)}.bcard .big{width:100%;margin-top:10px;border-radius:10px}.bcard[open] summary img{display:none}'
  + '.fine{font-size:.7rem;color:var(--mute);line-height:1.45}'
  + '@media print{@page{size:108mm 192mm;margin:0}body{max-width:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}.nav,.tools{display:none}.pg{width:108mm;min-height:192mm;break-after:page;padding:8mm 7mm}.cover{height:192mm;min-height:0;padding:0}.pg:last-child{break-after:auto}'
  + 'details.src p,details.proj>*:not(summary){display:block}.src summary span{white-space:normal}.bcard .big{display:none}.bcard[open] summary img{display:block}}';

// ---------- the route: /p/<code>; each open is recorded on the follow-up ----------
export async function docRoute(request, env, url, deps) {
  const m = url.pathname.match(/^\/p\/([a-z2-9]{8})\/?$/); if (!m) return null;
  const rec = await J(env, "dp_doc_" + m[1]); if (!rec) return new Response("This passport link has expired. Message Najjuko on WhatsApp and she will send a fresh one.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const d = await dpLoad(env, rec.slug); if (!d) return new Response("not found", { status: 404 });
  const now = new Date().toISOString();
  rec.opens = (rec.opens || 0) + 1; rec.first_open = rec.first_open || now; rec.last_open = now;
  await env.MEETINGS.put("dp_doc_" + m[1], JSON.stringify(rec), { expirationTtl: 120 * 86400 });
  if (deps && typeof deps.onOpen === "function") { try { await deps.onOpen(rec); } catch (e) {} }
  return new Response(docHtml(d, rec, url.origin), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
