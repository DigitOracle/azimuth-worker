// v800 - THE NAJMA LAUNCH REPORT, ON DEMAND (Kendall, 7 Nov 2026: "could she say I need a report for this week, or this month").
// Najjuko or Kendall choose a period, optional developer / Dubai 2040 zone, and up to 10 launches on the Momo New launches card; this
// lays out the report the way Najma Launch Report No. 1 was made (Operations/Research/Dubai_Launch_Feed_07NOV2026/Najma_Launch_Report_No1):
// a cover with the launch cards, then one page per launch - pictures, four fact tiles, notes, the map with compass and distances, the
// area today from the Dubai Land Department register, the source line, and the "price as advertised" footer. 9:16 pages (1080 x 1920).
//
// NO FACES: the only pictures used are the ones the 04:00 job checked and copied into KV (img_lpic_* video frames, img_lthumb_* Instagram
// copies; OpenCV face detection plus a person check, any person rejects the picture). A raw YouTube thumbnail is never shown here.
// Everything the page needs is precomputed by the 04:00 job: KV img_launches (the cards) and img_launch_report_data (pictures, distances,
// map points, the area's register medians). This module only lays out.
//
// SHARING (the safe option, Kendall's question): a report made from Momo gets a random 128-bit token stored in KV (lr_<token>, 120 days)
// with the launch keys, the title and who made it. /lr/<token> (and /lr/<token>.pdf) open for anyone holding the link, like the /video/
// and /bp/ links she already sends - so a client can open it from WhatsApp without a key. A token cannot be guessed, the page is noindex,
// it expires, and it holds only what is already public (advertised launch details) plus register aggregates; nothing private (no key,
// no client, no availability sheet) is ever on it. Making a link needs Kendall's or Najjuko's key.

import puppeteer from "@cloudflare/puppeteer";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf = (v) => Math.round(Number(v) || 0).toLocaleString("en-US");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dSay = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Number(m[3]) + " " + MON[Number(m[2]) - 1] + " " + m[1] : ""; };
const aedShort = (v) => { v = Number(v); return v >= 1e6 ? "AED " + (v / 1e6).toFixed(2) + "M" : "AED " + Math.round(v / 1e3) + "K"; };
export const safePic = (u) => /\/img\/l(?:pic|thumb)_[\w-]+$/.test(String(u || ""));   // our own face-checked copies only
const NAVY = "#1F2B44", GOLD = "#C5A56A", CREAM = "#FAF6EE", INK = "#202020", MUTE = "#5F6B66", PALE = "#EEE7D8";
const I = (d, s, c) => '<svg viewBox="0 0 24 24" width="' + (s || 34) + '" height="' + (s || 34) + '" fill="none" stroke="' + (c || GOLD) + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
const IC = {
  bed: '<path d="M3 18V8M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6"/>', ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  plan: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M8 3v4M16 3v4M9 17l6-5M9.5 13.5h0M14.5 16.5h0"/>', key: '<circle cx="7" cy="15" r="4"/><path d="M10 12l9-9M16 6l3 3"/>',
  note: '<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M8 12h8M8 16h6"/>', pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
};

// one launch's facts, from the card row and its report-data entry
function facts(r) {
  return [["bed", "Unit types", r.units || "Not stated"], ["ruler", "Sizes", r.sizes || "Not stated"], ["plan", "Payment plan", r.plan ? r.plan + " plan" : "Not stated"],
    ["key", "Handover", r.handover || "Not stated"]];
}
const picsOf = (r, e) => ((e && e.pics) || []).filter((p) => p && safePic(p.url));

// THE MAP: rings at 1, 2 and 3 km round the pin, the amenity points within 3.2 km, far landmarks as edge arrows, a compass, a legend
export function mapSvg(e) {
  const W = 500, H = 290, cx = W / 2, cy = H / 2, sc = (H / 2 - 6) / 3.2;
  if (!e || !e.pin_basis) return '<div class=nomap>No map point for this launch yet.</div>';
  const col = { m: "#B42832", l: NAVY, s: "#3C785A", c: GOLD };
  let o = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" xmlns="http://www.w3.org/2000/svg"><rect width="' + W + '" height="' + H + '" rx="12" fill="#F6F1E6" stroke="' + PALE + '"/>';
  for (const k of [1, 2, 3]) o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (k * sc).toFixed(1) + '" fill="none" stroke="#DED2B9"/><text x="' + (cx + k * sc * 0.71 + 3).toFixed(1) + '" y="' + (cy - k * sc * 0.71 - 3).toFixed(1) + '" font-size="11" fill="#AA966E">' + k + ' km</text>';
  for (const p of (e.pts || [])) {
    const x = cx + p[1] * sc, y = cy - p[2] * sc; if (x < 8 || x > W - 8 || y < 8 || y > H - 8) continue;
    const c = col[p[0]] || MUTE;
    o += p[0] === "m" ? '<rect x="' + (x - 5).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" width="10" height="10" fill="' + c + '"/>'
      : p[0] === "c" ? '<path d="M' + x.toFixed(1) + " " + (y - 6).toFixed(1) + "l-6 11h12z" + '" fill="' + c + '"/>' : '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (p[0] === "l" ? 5 : 3.5) + '" fill="' + c + '"/>';
  }
  for (const m of (e.marks || [])) {
    if (m.km <= 3.2) continue;
    const b = (m.deg || 0) * Math.PI / 180, dx = Math.sin(b), dy = -Math.cos(b);
    const t = Math.min(dx ? ((dx > 0 ? W - 18 : 18) - cx) / dx : 1e9, dy ? ((dy > 0 ? H - 18 : 18) - cy) / dy : 1e9);
    const ax = cx + dx * t, ay = cy + dy * t;
    o += '<line x1="' + (ax - dx * 24).toFixed(1) + '" y1="' + (ay - dy * 24).toFixed(1) + '" x2="' + ax.toFixed(1) + '" y2="' + ay.toFixed(1) + '" stroke="' + NAVY + '" stroke-width="3"/>'
      + '<circle cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1) + '" r="4" fill="' + NAVY + '"/>'
      + '<text x="' + Math.min(Math.max(ax - dx * 34, 50), W - 50).toFixed(1) + '" y="' + Math.min(Math.max(ay - dy * 34 + 4, 16), H - 30).toFixed(1) + '" font-size="12" font-weight="700" text-anchor="middle" fill="' + NAVY + '">' + esc(/Burj/.test(m.name) ? "Burj Khalifa" : "Airport") + "</text>";
  }
  o += '<circle cx="' + cx + '" cy="' + cy + '" r="10" fill="' + GOLD + '" stroke="' + NAVY + '" stroke-width="3"/><circle cx="' + cx + '" cy="' + cy + '" r="3" fill="' + NAVY + '"/>';
  const kx = W - 34, ky = 40;   // compass
  o += '<circle cx="' + kx + '" cy="' + ky + '" r="19" fill="#fff" stroke="' + NAVY + '" stroke-width="2"/><path d="M' + kx + " " + (ky - 15) + "l-6 15 6-4 6 4z" + '" fill="' + NAVY + '"/><path d="M' + kx + " " + (ky + 15) + "l-6-15 6 4 6-4z" + '" fill="#fff" stroke="' + NAVY + '"/><text x="' + kx + '" y="' + (ky - 23) + '" font-size="13" font-weight="700" text-anchor="middle" fill="' + NAVY + '">N</text>';
  const leg = [["m", "metro"], ["l", "mall"], ["s", "supermarket"], ["c", "school"]]; let lx = 14;
  o += '<rect x="6" y="' + (H - 24) + '" width="292" height="18" rx="5" fill="#F6F1E6"/>';
  for (const [k, t] of leg) { o += (k === "m" ? '<rect x="' + lx + '" y="' + (H - 19) + '" width="9" height="9" fill="' + col[k] + '"/>' : k === "c" ? '<path d="M' + (lx + 5) + " " + (H - 20) + "l-5 10h10z" + '" fill="' + col[k] + '"/>' : '<circle cx="' + (lx + 4.5) + '" cy="' + (H - 14.5) + '" r="4.5" fill="' + col[k] + '"/>') + '<text x="' + (lx + 13) + '" y="' + (H - 10) + '" font-size="11" fill="' + MUTE + '">' + t + "</text>"; lx += 22 + t.length * 6.2; }
  return o + "</svg>";
}

function areaPanel(r, e) {
  const a = e && e.area;
  if (!a) return '<p class=mut>The area\'s sales are not in the Dubai Land Department register we hold' + (r.area ? " for " + esc(r.area) : "") + ', so there is no registered price to compare.</p>';
  const st = (lbl, x) => x && x.n >= 10 ? '<div class=al>' + lbl + '</div><div class=av>AED ' + nf(x.psf) + ' / sq ft<span>' + nf(x.n) + ' sales</span></div>' : "";
  return '<div class=an>' + esc(a.label) + '</div>' + st("Off-plan apartments, median", a.offplan) + st("Ready apartments, median", a.ready) + st("Ready villas, median", a.ready_villa) + st("Off-plan villas, median", a.offplan_villa)
    + '<div class=as>Dubai Land Department register via Najma, sales ' + esc(dSay(a.period && a.period[0])) + " to " + esc(dSay(a.period && a.period[1])) + "</div>";
}

function footer(page, total, by) {
  const who = by === "najjuko" ? "Curated by Najjuko · Dubai Decoded · WhatsApp +971 56 548 4397" : "Najma · DigitAlchemy® Tech Limited · contact@digitalabbot.io · +971 56 227 6093";
  return '<div class=ft><div>Prices as advertised in public videos and posts, not client prices. Client prices come only from developer availability sheets.</div><div>' + who + " · page " + page + " of " + total + "</div></div>";
}

function head(title, sub, n) {
  return '<div class=hd><img class=lg src="najma_logo.png" alt="Najma"><div><div class=kick>N A J M A &nbsp; L A U N C H &nbsp; R E P O R T</div><div class=hs>' + esc(sub) + '</div></div>' + (n ? '<div class=no>' + esc(n) + "</div>" : "") + "</div>";
}

export function launchPage(r, e, n, total, sub, by) {
  const ps = picsOf(r, e), hero = ps[0], snaps = ps.slice(1, 4);
  const price = r.from_aed ? "from " + aedShort(r.from_aed) : "";
  const tiles = facts(r).map(([ic, lab, v]) => '<div class=tl>' + I(IC[ic]) + '<div><b>' + lab.toUpperCase() + '</b><p>' + esc(v) + "</p></div></div>").join("");
  const status = r.registered ? "On the Dubai Land Department register" + (r.dld_project_number ? " (project " + esc(r.dld_project_number) + ")" : "") : "Launched, not yet on the Dubai Land Department register";
  const notes = [status, r.zone ? "Dubai 2040: " + r.zone : "", (r.sources_n || 0) + " source" + (r.sources_n === 1 ? "" : "s") + ", first seen " + dSay(r.first_seen)].filter(Boolean).join(" · ");
  const near = ((e && e.near) || []).map((x) => '<tr><th>' + esc(x.lab) + '</th><td class=nm>' + esc(x.name) + '</td><td>' + x.km.toFixed(1) + " km " + esc(x.dir) + "</td></tr>").join("")
    + ((e && e.marks) || []).map((x) => '<tr><th>' + esc(x.name) + '</th><td class=nm></td><td>' + x.km.toFixed(1) + " km " + esc(x.dir) + "</td></tr>").join("");
  const src = (e && e.source ? e.source : "") + ((r.links || []).length ? " · " + (r.links || []).slice(0, 2).map((u) => esc(u.replace(/^https?:\/\/(www\.)?/, ""))).join(" · ") : "");
  return '<section class=pg>' + head("", sub, n + " / " + (total - 1))
    + (hero ? '<div class=hero><img src="' + esc(hero.url) + '" alt=""><span class=cr>Image: ' + esc(hero.credit || (e && e.credit) || "") + "</span></div>" : '<div class="hero none"><span>' + esc(String(r.developer || "?").slice(0, 1)) + "</span></div>")
    + '<div class=tt><h2>' + esc(r.project) + '</h2><div class=pr>' + esc(price) + '</div></div><div class=sb>' + esc([r.developer, r.area].filter(Boolean).join(" · ")) + (price ? '<span>as advertised</span>' : "") + "</div>"
    + '<div class=tls>' + tiles + "</div>"
    + '<div class="tl wide">' + I(IC.note) + '<div><b>STATUS AND NOTES</b><p>' + esc(notes) + "</p></div></div>"
    + (snaps.length ? '<div class=sn>' + snaps.map((p) => '<figure><img src="' + esc(p.url) + '" alt=""><figcaption><b>' + (p.kind === "instagram" ? "From the post" : "Frame from the video") + '</b><span>Image: ' + esc(p.credit || "") + "</span></figcaption></figure>").join("") + "</div>" : "")
    + '<div class=two><div class="pn map"><h3>Where it is</h3>' + mapSvg(e) + '<table class=dist>' + near + '</table><div class=mut>Straight-line distances from our map points. Pin: ' + (e && e.pin_basis === "project" ? "the registered project point" : "the area centre") + '</div></div>'
    + '<div class="pn area"><h3>The area today</h3>' + areaPanel(r, e) + "</div></div>"
    + '<div class=src>Source: ' + esc(src || "Najma announced projects layer") + "</div>" + footer(n + 1, total, by) + "</section>";
}

export function coverPage(rows, data, title, sub, total, by) {
  const cards = rows.map((r, i) => {
    const p = picsOf(r, data[r.key])[0];
    return '<div class=cc>' + (p ? '<img src="' + esc(p.url) + '" alt="">' : '<div class="ci none"><span>' + esc(String(r.developer || "?").slice(0, 1)) + "</span></div>") + '<div class=cn>' + (i + 1) + '</div><div class=cb><b>' + esc(r.project) + '</b><i>' + esc(r.from_aed ? "from " + aedShort(r.from_aed) : "") + '</i></div><div class=cs>' + esc([r.developer, r.area].filter(Boolean).join(" · ")) + "</div></div>";
  }).join("");
  return '<section class="pg cover"><img class=lgc src="najma_logo.png" alt="Najma"><div class=kick>N A J M A &nbsp; L A U N C H &nbsp; R E P O R T</div><h1>' + esc(title) + '</h1><div class=hs>' + esc(sub) + '</div><p class=lead>' + rows.length + " Dubai launch" + (rows.length === 1 ? "" : "es") + ", with our map and Dubai Land Department register context</p><div class=rule></div><div class=cg>" + cards + '</div><div class=note>Pictures: frames from the launch videos and posts, credited on each page; no people. Prices are the advertised starting prices.</div>' + footer(1, total, by) + "</section>";
}

export const REPORT_CSS = '@page{size:1080px 1920px;margin:0}*{box-sizing:border-box}body{margin:0;background:#E9E2D3;font-family:"IBM Plex Sans","Segoe UI",sans-serif;color:' + INK + ';-webkit-print-color-adjust:exact;print-color-adjust:exact}'
  + '.pg{width:1080px;height:1920px;margin:0 auto 24px;position:relative;overflow:hidden;background:' + CREAM + ';padding:34px 60px 0;page-break-after:always}'
  + '.hd{display:flex;align-items:center;gap:16px;height:80px}.lg{height:70px}.kick{font:600 20px "IBM Plex Sans",sans-serif;color:' + GOLD + ';letter-spacing:.04em}.hs{font:400 20px Fraunces,Georgia,serif;color:' + INK + '}.no{margin-left:auto;font:700 30px Fraunces,Georgia,serif;color:' + NAVY + '}'
  + '.hero{margin-top:10px;height:440px;border-radius:20px;overflow:hidden;position:relative;background:#EFE6D4}.hero img{width:100%;height:100%;object-fit:cover}.hero .cr{position:absolute;right:8px;bottom:8px;background:rgba(31,43,68,.82);color:#fff;font-size:16px;border-radius:8px;padding:3px 10px}'
  + '.none{display:flex;align-items:center;justify-content:center}.none span{width:110px;height:110px;border-radius:50%;background:#0A4F4A;color:#F3E7CF;display:flex;align-items:center;justify-content:center;font:600 54px Fraunces,Georgia,serif}'
  + '.tt{display:flex;justify-content:space-between;align-items:baseline;margin-top:20px;gap:20px}.tt h2{font:700 50px/1.05 Fraunces,Georgia,serif;color:' + NAVY + ';margin:0}.pr{font:700 44px Fraunces,Georgia,serif;color:' + GOLD + ';white-space:nowrap}'
  + '.sb{display:flex;justify-content:space-between;font-size:24px;margin:6px 0 12px}.sb span{font-size:18px;color:' + MUTE + '}'
  + '.tls{display:grid;grid-template-columns:1fr 1fr;gap:12px}.tl{display:flex;gap:14px;background:#fff;border:2px solid ' + GOLD + ';border-radius:16px;padding:14px 18px;min-height:104px}.tl b{font:600 16px "IBM Plex Sans",sans-serif;color:' + GOLD + '}.tl p{margin:4px 0 0;font-size:20px}.tl.wide{margin-top:12px;min-height:84px}'
  + '.sn{display:flex;gap:14px;margin-top:14px}.sn figure{flex:1;margin:0}.sn img{width:100%;height:180px;object-fit:cover;border-radius:12px}.sn figcaption b{display:block;font-size:17px;color:' + NAVY + '}.sn figcaption span{font-size:14px;color:' + MUTE + '}'
  + '.two{display:flex;gap:16px;margin-top:14px}.pn{background:#fff;border:2px solid ' + GOLD + ';border-radius:18px;padding:14px 20px}.pn.map{flex:1.28}.pn.area{flex:1}.pn h3{font:700 26px Fraunces,Georgia,serif;color:' + NAVY + ';margin:0 0 8px}'
  + '.dist{width:100%;border-collapse:collapse;margin-top:8px;font-size:17px}.dist th{text-align:left;color:' + NAVY + ';width:120px}.dist td{text-align:right;font-weight:600}.dist td.nm{text-align:left;font-weight:400;color:' + MUTE + ';max-width:180px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}'
  + '.mut{font-size:15px;color:' + MUTE + ';margin-top:6px}.an{font-weight:600;font-size:19px;margin-bottom:8px}.al{font-size:17px;color:' + MUTE + ';margin-top:8px}.av{font:700 30px Fraunces,Georgia,serif;color:' + NAVY + '}.av span{font:400 16px "IBM Plex Sans",sans-serif;color:' + MUTE + ';margin-left:10px}.as{font-size:14px;color:' + MUTE + ';margin-top:14px}.nomap{font-size:18px;color:' + MUTE + ';padding:40px 0}'
  + '.src{font-size:16px;margin-top:12px;color:' + INK + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ft{position:absolute;left:0;right:0;bottom:22px;text-align:center;font-size:17px;color:' + MUTE + ';line-height:1.6}'
  + '.cover{text-align:center}.lgc{height:140px;margin-top:20px}.cover h1{font:700 62px Fraunces,Georgia,serif;color:' + NAVY + ';margin:8px 0}.cover .hs{font-size:30px}.lead{font-size:21px;color:' + MUTE + '}.rule{width:300px;height:2px;background:' + GOLD + ';margin:0 auto 18px}'
  + '.cg{display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:left}.cc{position:relative;background:#fff;border:2px solid ' + GOLD + ';border-radius:16px;padding:8px;height:252px}.cc img,.ci{width:100%;height:160px;object-fit:cover;border-radius:12px}.ci.none span{width:70px;height:70px;font-size:34px}.cn{position:absolute;left:16px;top:16px;background:' + NAVY + ';color:#fff;border-radius:8px;padding:2px 10px;font-weight:700}'
  + '.cb{display:flex;justify-content:space-between;gap:8px;margin:8px 8px 0}.cb b{font:700 23px Fraunces,Georgia,serif;color:' + NAVY + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cb i{font:700 22px Fraunces,Georgia,serif;color:' + GOLD + ';font-style:normal;white-space:nowrap}.cs{margin:4px 8px;font-size:18px;color:' + MUTE + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.note{font-size:17px;color:' + MUTE + ';margin-top:14px}'
  + '.bar{position:sticky;top:0;z-index:5;display:flex;gap:10px;justify-content:center;padding:10px;background:' + CREAM + ';border-bottom:1px solid ' + PALE + '}.bar a{display:inline-flex;align-items:center;gap:6px;background:#0A4F4A;color:#fff;text-decoration:none;border-radius:999px;padding:10px 18px;font:600 15px "IBM Plex Sans",sans-serif}.bar a.wa{background:#fff;color:#0A4F4A;border:1px solid #0A4F4A}'
  + '@media print{.bar{display:none}body{background:none}.pg{margin:0}}';

const ZOOM_JS = '<script>(function(){function z(){var s=Math.min(1,(window.innerWidth-8)/1080);document.querySelectorAll(".pg").forEach(function(p){p.style.zoom=s})}z();addEventListener("resize",z)})()</script>';

export function reportHtml(rows, data, opts) {
  opts = opts || {};
  const total = rows.length + 1, sub = opts.sub || "";
  const pages = [coverPage(rows, data, opts.title || "Najma Launch Report", sub, total, opts.by)].concat(rows.map((r, i) => launchPage(r, data[r.key], i + 1, total, sub, opts.by)));
  const bar = opts.bar ? '<div class=bar><a href="' + esc(opts.pdfHref) + '">' + I('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 18, "#fff") + 'Download PDF</a><a class=wa href="' + esc(opts.waHref) + '">' + I('<path d="M4 20l1.5-4.5A8 8 0 1 1 9 19z"/>', 18, "#0A4F4A") + "Send on WhatsApp</a></div>" : "";
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>' + esc(opts.title || "Najma Launch Report") + '</title>'
    + '<link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=IBM+Plex+Sans:wght@400;600&display=swap"><style>' + REPORT_CSS + "</style></head><body>" + bar + pages.join("") + (opts.bar ? ZOOM_JS : "") + "</body></html>";
}

// ---------- choosing the launches ----------
export function periodRange(period, today, from, to) {
  const d = (n) => new Date(Date.parse(today) - n * 86400000).toISOString().slice(0, 10);
  if (period === "month") return [today.slice(0, 8) + "01", today, "This month"];
  if (period === "30") return [d(30), today, "Last 30 days"];
  if (period === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(from || "") && /^\d{4}-\d{2}-\d{2}$/.test(to || "")) return [from, to, dSay(from) + " to " + dSay(to)];
  return [d(7), today, "This week"];
}
export function pickRows(snapRows, keys) {
  const by = new Map((snapRows || []).map((r) => [r.key, r]));
  return [...new Set(keys || [])].map((k) => by.get(k)).filter((r) => r && r.project && (r.area || r.from_aed)).slice(0, 10);
}

// ---------- routes ----------
let LAUNCH = (b) => puppeteer.launch(b);
export function __setLrLauncher(fn) { LAUNCH = fn || ((b) => puppeteer.launch(b)); }
const TOK_RX = /^[a-f0-9]{32}$/;
export function newToken() { const b = new Uint8Array(16); crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, "0")).join(""); }
async function kvj(env, k) { try { return JSON.parse((await env.MEETINGS.get(k)) || "null"); } catch (e) { return null; } }
async function withLogo(env, html) { const b64 = await env.MEETINGS.get("bpp_logo_png"); return b64 ? html.replace(/(["'])najma_logo\.png\1/g, '"data:image/png;base64,' + b64 + '"') : html; }

async function buildFor(env, rec, deps, origin, bar) {
  const snap = await deps.kv(env, "launches"), rep = await deps.kv(env, "launch_report_data");
  const rows = pickRows(snap && snap.rows, rec.keys), data = (rep && rep.rows) || {};
  const pdfHref = origin + "/lr/" + rec.token + ".pdf";
  const text = (rec.title || "Najma Launch Report") + (rec.sub ? " (" + rec.sub + ")" : "") + ": " + rows.length + " Dubai launch" + (rows.length === 1 ? "" : "es") + ", prices as advertised. " + origin + "/lr/" + rec.token;
  return { rows, html: await withLogo(env, reportHtml(rows, data, { title: rec.title, sub: rec.sub, by: rec.by, bar, pdfHref, waHref: "https://wa.me/?text=" + encodeURIComponent(text) })), text };
}

// GET /momo/work/launches/report?key=..&k=a,b&period=week|month|30|custom&from&to&wa=1 (Kendall's and Najjuko's keys; the caller checks)
export async function makeReportRoute(request, env, url, deps) {
  if (url.pathname !== "/momo/work/launches/report" || request.method !== "GET") return null;
  const keys = String(url.searchParams.get("k") || "").split(",").map((s) => s.trim()).filter((s) => /^ap_[a-f0-9]{6,16}$/.test(s)).slice(0, 10);
  if (!keys.length) return new Response("choose at least one launch", { status: 400 });
  const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
  const [, , label] = periodRange(url.searchParams.get("period") || (keys.length === 1 ? "" : "week"), today, url.searchParams.get("from"), url.searchParams.get("to"));
  const by = deps.person ? deps.person(env, url) : "";
  const one = keys.length === 1;
  const snap = await deps.kv(env, "launches");
  const first = pickRows(snap && snap.rows, keys)[0];
  const rec = { token: newToken(), keys, by, at: new Date().toISOString(), title: one && first ? first.project + " · Najma Launch Report" : "Najma Launch Report", sub: one ? dSay(today) : label + " · " + dSay(today) };
  await env.MEETINGS.put("lr_" + rec.token, JSON.stringify(rec), { expirationTtl: 120 * 86400 });
  if (url.searchParams.get("wa") === "1") { const b = await buildFor(env, rec, deps, url.origin, false); return Response.redirect("https://wa.me/?text=" + encodeURIComponent(b.text), 302); }
  return Response.redirect(url.origin + "/lr/" + rec.token, 302);
}

// GET /lr/<token> and /lr/<token>.pdf - open for anyone holding the link (see SHARING above)
export async function publicReportRoute(request, env, url, deps) {
  const m = url.pathname.match(/^\/lr\/([a-f0-9]{32})(\.pdf)?$/); if (!m || request.method !== "GET") return null;
  const rec = await kvj(env, "lr_" + m[1]); if (!rec || !TOK_RX.test(rec.token || "")) return new Response("This report link has expired.", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  if (!m[2]) { const b = await buildFor(env, rec, deps, url.origin, true); return new Response(b.html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } }); }
  const cached = await env.MEETINGS.get("lr_pdf_" + rec.token, "arrayBuffer");
  const name = String(rec.title || "Najma Launch Report").replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 60) + ".pdf";
  if (cached) return new Response(cached, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="' + name + '"', "X-Robots-Tag": "noindex" } });
  const b = await buildFor(env, rec, deps, url.origin, false);
  const browser = await LAUNCH(env.BROWSER);
  try {
    const page = await browser.newPage();
    try { await page.emulateMediaType("print"); } catch (e) {}
    try { await page.setContent(b.html, { waitUntil: "networkidle0", timeout: 30000 }); } catch (e) { if (!/timeout/i.test(String((e && e.message) || e))) throw e; }
    try { await page.evaluate(() => document.fonts.ready.then(() => true)); } catch (e) {}
    const pdf = await page.pdf({ width: "1080px", height: "1920px", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    await env.MEETINGS.put("lr_pdf_" + rec.token, pdf, { expirationTtl: 120 * 86400 });
    return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="' + name + '"', "X-Robots-Tag": "noindex" } });
  } finally { try { await browser.close(); } catch (e) {} }
}
