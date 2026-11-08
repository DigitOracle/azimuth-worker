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
// v803 (Kendall 7 Nov, "yes do v803"): register names arrive in capitals ("RAW DISTRICT 2 TOWER C BY IMTIAZ"); shown as "Raw District 2,
// Tower C" with the developer Imtiaz. The 04:00 job does this (announced_social.nice_name, which also prefers a marketing name from the
// project's own video / website / press titles); this is the same rule for a snapshot written before v803. JVC, DIFC and brand words stay
// in capitals; brand styling with digits in a word (O1NE, V1EW, BAYZ101) is left as written.
const KEEP_CAPS = new Set(["JVC", "JVT", "JLT", "JBR", "JGE", "DIFC", "DIP", "DSO", "DLRC", "DWC", "DXB", "MBR", "UAE", "RAK", "SZR", "MAG", "SLS", "DAMAC", "AYS",
  "II", "III", "IV", "VI", "VII", "VIII", "IX", "XI", "XII", "LLC", "FZE", "FZ", "GCC", "W", "ME", "B2B", "HQ", "LIV", "IGO", "ARK"]);
const SMALL = new Set(["by", "at", "of", "the", "and", "in", "on", "de", "la", "le", "du", "for", "a"]);
const capWord = (w, first) => {
  const core = w.replace(/[^A-Za-z0-9&'.-]/g, "");
  if (KEEP_CAPS.has(core.toUpperCase())) return w;
  if (!first && SMALL.has(core.toLowerCase())) return w.toLowerCase();
  if (/^(?:\d+[A-Z]{1,2}|[A-Z]{1,2}\d+|[A-Z])$/.test(core)) return w;
  return w.split("-").map((p) => p.slice(0, 1).toUpperCase() + p.slice(1).toLowerCase()).join("-");
};
const words = (s) => new Set(String(s || "").toLowerCase().match(/[a-z0-9]+/g) || []);
export function niceName(name, developer) {
  let n = String(name || "").replace(/\s+/g, " ").trim(), dev = developer;
  if (!n || n !== n.toUpperCase() || !/[A-Z]/.test(n)) return [n, dev];
  const m = n.match(/^(.+?)\s+BY\s+([A-Z][A-Z0-9 &.'-]{1,40})$/);
  if (m) {
    const dw = words(dev), bw = words(m[2]);
    if (!dev) { dev = m[2].split(" ").map((w, i) => capWord(w, i === 0)).join(" "); n = m[1]; }
    else if ([...bw].some((x) => dw.has(x))) n = m[1];
  }
  if (n.split(" ").some((w) => /[A-Z]\d|\d[A-Z]/.test(w) && !/^(?:\d+[A-Z]{1,2}|[A-Z]{1,2}\d+)$/.test(w))) return [n, dev];
  const ws = n.split(" "); let out = ws.map((w, i) => capWord(w, i === 0 || ["-", "|", ":"].includes(ws[i - 1]))).join(" ");
  if (out.split(" ").length >= 3) out = out.replace(/(\S)\s+(Tower|Building|Block|Phase|Plot|Cluster)\s+([A-Z0-9]{1,3})\b/g, "$1, $2 $3");
  return [out, dev];
}
export function tidyLaunches(snap) {
  if (!snap || !Array.isArray(snap.rows)) return snap;
  return Object.assign({}, snap, { rows: snap.rows.map((r) => { if (!r || !r.project) return r; const [p, d] = niceName(r.project, r.developer); return (p === r.project && d === r.developer) ? r : Object.assign({}, r, { project: p, developer: d }); }) });
}
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
// v802 (Kendall 7 Nov: a Meraas masterplan aerial was on two different projects): a picture that appears under more than one launch is a
// developer's generic image, never this project's own, so it is left out everywhere (SHARED is filled by reportHtml from the whole data doc)
let SHARED = new Set();
export function sharedPics(data) {
  const by = new Map();
  for (const [k, e] of Object.entries(data || {})) for (const p of (e && e.pics) || []) if (p && p.url) by.set(p.url, (by.get(p.url) || new Set()).add(k));
  return new Set([...by].filter(([, ks]) => ks.size > 1).map(([u]) => u));
}
const picsOf = (r, e) => ((e && e.pics) || []).filter((p) => p && safePic(p.url) && !SHARED.has(p.url));

// THE MAP: rings at 1, 2 and 3 km round the pin, the amenity points within 3.2 km, far landmarks as edge arrows, a compass, a legend
// v805 (Kendall 8 Nov: "that map ... that's horrible ... we have Esri ... base maps"). Under the pins: Esri's light grey canvas and its
// reference labels (public export service), fetched when the report is built and embedded, covering MAP_R km either side of the pin. The
// pin's own point comes from the 04:00 job (e.lat / e.lon); with no point the old ring diagram is drawn.
export const MAP_R = 6;
const MW = 500, MH = 290;
function mercBox(lat, lon, rKm) {
  const x = lon * 20037508.34 / 180, y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) * 20037508.34 / Math.PI;
  const k = 1000 / Math.cos(lat * Math.PI / 180), hx = rKm * k, hy = rKm * (MH / MW) * k;
  return [x - hx, y - hy, x + hx, y + hy].map((v) => v.toFixed(1)).join(",");
}
const b64 = (buf) => { let s = ""; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
export async function esriLayer(svc, lat, lon) {
  const q = new URLSearchParams({ bbox: mercBox(lat, lon, MAP_R), bboxSR: "3857", imageSR: "3857", size: MW * 2 + "," + MH * 2, format: "png32", transparent: "true", f: "image" });
  const r = await fetch("https://services.arcgisonline.com/arcgis/rest/services/" + svc + "/MapServer/export?" + q, { cf: { cacheTtl: 86400 * 30, cacheEverything: true } });
  if (!r.ok || !/image/.test(r.headers.get("content-type") || "")) return null;
  return "data:image/png;base64," + b64(await r.arrayBuffer());
}
export async function addMaps(rows, data) {
  await Promise.all(rows.map(async (r) => {
    const e = data[r.key]; if (!e || !(Number(e.lat) && Number(e.lon)) || e._map) return;
    try {
      const [base, ref] = await Promise.all([esriLayer("Canvas/World_Light_Gray_Base", +e.lat, +e.lon), esriLayer("Canvas/World_Light_Gray_Reference", +e.lat, +e.lon)]);
      if (base) e._map = { base, ref };
    } catch (x) {}
  }));
}

export function mapSvg(e) {
  const W = 500, H = 290, cx = W / 2, cy = H / 2, M = e && e._map, sc = M ? (W / 2) / MAP_R : (H / 2 - 6) / 3.2;
  if (!e || !e.pin_basis) return '<div class=nomap>No map point for this launch yet.</div>';
  const col = { m: "#B42832", l: NAVY, s: "#3C785A", c: GOLD };
  let o = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" xmlns="http://www.w3.org/2000/svg"><rect width="' + W + '" height="' + H + '" rx="12" fill="#F6F1E6" stroke="' + PALE + '"/>';
  if (M) o += '<defs><clipPath id=mc><rect width="' + W + '" height="' + H + '" rx="12"/></clipPath></defs><g clip-path="url(#mc)"><image class=mapimg href="' + M.base + '" width="' + W + '" height="' + H + '" preserveAspectRatio="none"/>' + (M.ref ? '<image href="' + M.ref + '" width="' + W + '" height="' + H + '" preserveAspectRatio="none" opacity=".9"/>' : "") + '</g><text x="' + (W - 6) + '" y="' + (H - 30) + '" font-size="8" text-anchor="end" fill="#8A8A8A">Basemap: Esri, HERE, Garmin, OpenStreetMap contributors</text>';
  for (const k of (M ? [1, 3, 5] : [1, 2, 3])) o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (k * sc).toFixed(1) + '" fill="none" stroke="#DED2B9"/><text x="' + (cx + k * sc * 0.71 + 3).toFixed(1) + '" y="' + (cy - k * sc * 0.71 - 3).toFixed(1) + '" font-size="11" fill="#AA966E">' + k + ' km</text>';
  for (const p of (e.pts || [])) {
    const x = cx + p[1] * sc, y = cy - p[2] * sc; if (x < 8 || x > W - 8 || y < 8 || y > H - 8) continue;
    const c = col[p[0]] || MUTE;
    o += p[0] === "m" ? '<rect x="' + (x - 5).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" width="10" height="10" fill="' + c + '"/>'
      : p[0] === "c" ? '<path d="M' + x.toFixed(1) + " " + (y - 6).toFixed(1) + "l-6 11h12z" + '" fill="' + c + '"/>' : '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (p[0] === "l" ? 5 : 3.5) + '" fill="' + c + '"/>';
  }
  for (const m of (e.marks || [])) {
    if (m.km <= (M ? MAP_R : 3.2)) continue;
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

const cmp = (d) => String(d || "").replace(/north/g, "N").replace(/south/g, "S").replace(/east/g, "E").replace(/west/g, "W").replace(/-/g, "");

export function launchPage(r, e, n, total, sub, by) {
  const ps = picsOf(r, e), hero = ps[0], snaps = ps.slice(1, 4);
  const price = r.from_aed ? "from " + aedShort(r.from_aed) : "";
  const tiles = facts(r).map(([ic, lab, v]) => '<div class=tl>' + I(IC[ic]) + '<div><b>' + lab.toUpperCase() + '</b><p>' + esc(v) + "</p></div></div>").join("");
  const status = r.registered ? "On the Dubai Land Department register" + (r.dld_project_number ? " (project " + esc(r.dld_project_number) + ")" : "") : "Launched, not yet on the Dubai Land Department register";
  const notes = [status, r.zone ? "Dubai 2040: " + r.zone : "", (r.sources_n || 0) + " source" + (r.sources_n === 1 ? "" : "s") + ", first seen " + dSay(r.first_seen)].filter(Boolean).join(" · ");
  const near = ((e && e.near) || []).map((x) => '<tr><th>' + esc(x.lab) + '</th><td class=nm>' + esc(x.name) + '</td><td>' + x.km.toFixed(1) + " km " + esc(cmp(x.dir)) + "</td></tr>").join("")
    + ((e && e.marks) || []).map((x) => '<tr><th>' + esc(x.name) + '</th><td class=nm></td><td>' + x.km.toFixed(1) + " km " + esc(cmp(x.dir)) + "</td></tr>").join("");
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

// v805 (Kendall 8 Nov: "we're wasting space on this cover page ... put the picture and the launch, then some developer DNA"). One launch: a
// big picture, the launch's name and facts, then the developer's register record. Several launches: the cards, then one record per developer
// (at most three). The record is najma_developer_escrow_delivery at brand level (Dubai Land Department registers), carried in the report
// data as dev_dna by the 04:00 job. The register overwrites a planned date at handover, so "finished on time" is never shown; the honest
// delivery signal is projects under way that are already past their planned end.
export const normDev = (s) => String(s || "").toLowerCase().replace(/properties|developments|development|real estate|group/g, "").replace(/[^a-z0-9]/g, "");
export function dnaFor(dna, developer) {
  const k = normDev(developer); if (!k || !dna) return null;
  if (dna[k]) return dna[k];
  const hit = Object.keys(dna).find((x) => k.length >= 4 && (x.startsWith(k) || k.startsWith(x)));
  return hit ? dna[hit] : null;
}
const bn = (v) => { v = Number(v) || 0; return v >= 1e9 ? "AED " + (v / 1e9).toFixed(1) + " billion" : v >= 1e6 ? "AED " + Math.round(v / 1e6) + " million" : "AED " + nf(v); };
export function dnaPanel(name, d) {
  if (!d) return "";
  const yr = String(d.first_project_start || "").slice(0, 4);
  const stat = (big, lab) => '<div class=ds><b>' + big + "</b><span>" + lab + "</span></div>";
  const live = Number(d.live_projects) || 0, esc_ok = Number(d.live_with_escrow_agent) || 0, act = Number(d.active_with_planned_end) || 0, late = Number(d.active_past_planned_end) || 0;
  const lines = [
    live ? I(IC.key, 26) + "<p><b>" + esc_ok + " of " + live + "</b> live projects have an escrow account" + (d.main_live_agent_bank ? ", mostly with " + esc(String(d.main_live_agent_bank).replace(/\s*\(.*\)\s*/g, "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())) : "") + "</p>" : "",
    act ? I(IC.plan, 26) + "<p><b>" + late + " of " + act + "</b> projects under way are past their planned end date</p>" : "",
    d.median_build_months_since_2023 ? I(IC.ruler, 26) + "<p>Typical build time: <b>" + Math.round(d.median_build_months_since_2023) + " months</b> (projects finished since 2023)</p>" : "",
    d.contracted_offplan_sales_live_escrow ? I(IC.note, 26) + "<p><b>" + nf(d.contracted_offplan_sales_live_escrow) + "</b> off-plan sales, " + bn(d.contracted_offplan_aed_live_escrow) + ", in its live projects</p>" : "",
  ].filter(Boolean).map((x) => "<div class=dl>" + x + "</div>").join("");
  return '<div class=dna><div class=dh><span>DEVELOPER DNA</span><h3>' + esc(name) + "</h3>" + (yr ? "<i>On the Dubai Land Department register since " + yr + "</i>" : "") + "</div>"
    + '<div class=dg>' + stat(nf(d.projects_total), "projects registered") + stat(nf(d.projects_finished), "finished") + stat(nf(d.projects_active), "under way")
    + stat(nf(d.registered_units_finished), "homes handed over") + stat(nf(d.registered_units_live), "homes in build") + "</div>" + lines
    + '<div class=dsrc>Source: Dubai Land Department project and escrow registers, as of ' + esc(dSay(d.as_of)) + ". All companies trading under the brand.</div></div>";
}

export function coverPage(rows, data, title, sub, total, by, dna) {
  const head = '<div class=chd><img class=lgs src="najma_logo.png" alt="Najma"><div><div class=kick>N A J M A &nbsp; L A U N C H &nbsp; R E P O R T</div><div class=hs>' + esc(sub) + "</div></div></div>";
  if (rows.length === 1) {
    const r = rows[0], e = data[r.key], p = picsOf(r, e)[0], d = dnaFor(dna, r.developer);
    const price = r.from_aed ? "from " + aedShort(r.from_aed) : "";
    const chips = [r.handover ? ["key", "Handover " + r.handover] : null, r.registered ? ["note", "On the register" + (r.dld_project_number ? ", project " + r.dld_project_number : "")] : ["note", "Launched, not yet on the register"],
      r.zone ? ["pin", "Dubai 2040: " + r.zone] : null].filter(Boolean).map(([ic, t]) => "<span class=chip>" + I(IC[ic], 22) + esc(t) + "</span>").join("");
    return '<section class="pg cover one">' + head
      + (p ? '<div class=chero><img src="' + esc(p.url) + '" alt=""><span class=cr>Image: ' + esc(p.credit || (e && e.credit) || "") + "</span></div>" : '<div class="chero none"><span>' + esc(String(r.developer || "?").slice(0, 1)) + "</span></div>")
      + '<div class=ctt><h1>' + esc(r.project) + "</h1>" + (price ? "<div class=pr>" + esc(price) + "</div>" : "") + "</div>"
      + '<div class=csb>' + esc([r.developer, r.area].filter(Boolean).join(" · ")) + "</div><div class=chips>" + chips + "</div>"
      + (d ? dnaPanel(r.developer, d) : '<div class=dna><div class=dh><span>DEVELOPER DNA</span><h3>' + esc(r.developer || "Developer") + "</h3><i>No register record matched this developer yet.</i></div></div>")
      + footer(1, total, by) + "</section>";
  }
  const cards = rows.map((r, i) => {
    const p = picsOf(r, data[r.key])[0];
    return '<div class=cc>' + (p ? '<img src="' + esc(p.url) + '" alt="">' : '<div class="ci none"><span>' + esc(String(r.developer || "?").slice(0, 1)) + "</span></div>") + '<div class=cn>' + (i + 1) + '</div><div class=cb><b>' + esc(r.project) + '</b><i>' + esc(r.from_aed ? "from " + aedShort(r.from_aed) : "") + '</i></div><div class=cs>' + esc([r.developer, r.area].filter(Boolean).join(" · ")) + "</div></div>";
  }).join("");
  const devs = [...new Set(rows.map((r) => r.developer).filter(Boolean))].map((n) => [n, dnaFor(dna, n)]).filter(([, d]) => d).slice(0, rows.length > 4 ? 1 : 2);
  return '<section class="pg cover">' + head + '<h1 class=cth>' + esc(title) + '</h1><p class=lead>' + rows.length + " Dubai launch" + (rows.length === 1 ? "" : "es") + ", with our map and Dubai Land Department register context</p><div class=cg>" + cards + "</div>"
    + devs.map(([n, d]) => dnaPanel(n, d)).join("") + '<div class=note>Pictures: frames from the launch videos and posts, credited on each page; no people. Prices are the advertised starting prices.</div>' + footer(1, total, by) + "</section>";
}

export const REPORT_CSS = '@page{size:1080px 1920px;margin:0}*{box-sizing:border-box}body{margin:0;background:#E9E2D3;font-family:"IBM Plex Sans","Segoe UI",sans-serif;color:' + INK + ';-webkit-print-color-adjust:exact;print-color-adjust:exact}'
  + '.pg{width:1080px;height:1920px;margin:0 auto 24px;position:relative;overflow:hidden;background:' + CREAM + ';padding:34px 60px 22px;page-break-after:always;display:flex;flex-direction:column}'
  + '.hd{display:flex;align-items:center;gap:16px;height:80px}.lg{height:70px}.kick{font:600 20px "IBM Plex Sans",sans-serif;color:' + GOLD + ';letter-spacing:.04em}.hs{font:400 20px Fraunces,Georgia,serif;color:' + INK + '}.no{margin-left:auto;font:700 30px Fraunces,Georgia,serif;color:' + NAVY + '}'
  + '.hero{margin-top:10px;height:440px;border-radius:20px;overflow:hidden;position:relative;background:#EFE6D4}.hero img{width:100%;height:100%;object-fit:cover}.hero .cr{position:absolute;right:8px;bottom:8px;background:rgba(31,43,68,.82);color:#fff;font-size:16px;border-radius:8px;padding:3px 10px}'
  + '.none{display:flex;align-items:center;justify-content:center}.none span{width:110px;height:110px;border-radius:50%;background:#0A4F4A;color:#F3E7CF;display:flex;align-items:center;justify-content:center;font:600 54px Fraunces,Georgia,serif}'
  + '.tt{display:flex;justify-content:space-between;align-items:baseline;margin-top:20px;gap:20px}.tt h2{font:700 50px/1.05 Fraunces,Georgia,serif;color:' + NAVY + ';margin:0}.pr{font:700 44px Fraunces,Georgia,serif;color:' + GOLD + ';white-space:nowrap}'
  + '.sb{display:flex;justify-content:space-between;font-size:24px;margin:6px 0 12px}.sb span{font-size:18px;color:' + MUTE + '}'
  + '.tls{display:grid;grid-template-columns:1fr 1fr;gap:12px}.tl{display:flex;gap:14px;background:#fff;border:2px solid ' + GOLD + ';border-radius:16px;padding:14px 18px;min-height:104px}.tl b{font:600 16px "IBM Plex Sans",sans-serif;color:' + GOLD + '}.tl p{margin:4px 0 0;font-size:20px}.tl.wide{margin-top:12px;min-height:84px}'
  + '.sn{display:flex;gap:14px;margin-top:14px}.sn figure{flex:1;margin:0}.sn img{width:100%;height:180px;object-fit:cover;border-radius:12px}.sn figcaption b{display:block;font-size:17px;color:' + NAVY + '}.sn figcaption span{font-size:14px;color:' + MUTE + '}'
  + '.two{display:flex;gap:16px;margin-top:14px}.pn{background:#fff;border:2px solid ' + GOLD + ';border-radius:18px;padding:14px 20px}.pn.map{flex:1.28}.pn.area{flex:1}.pn h3{font:700 26px Fraunces,Georgia,serif;color:' + NAVY + ';margin:0 0 8px}'
  + '.dist{width:100%;border-collapse:collapse;margin-top:8px;font-size:17px}.dist th{text-align:left;color:' + NAVY + ';width:120px}.dist td{text-align:right;font-weight:600;white-space:nowrap}.dist td.nm{text-align:left;font-weight:400;color:' + MUTE + ';max-width:180px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}'
  + '.mut{font-size:15px;color:' + MUTE + ';margin-top:6px}.an{font-weight:600;font-size:19px;margin-bottom:8px}.al{font-size:17px;color:' + MUTE + ';margin-top:8px}.av{font:700 30px Fraunces,Georgia,serif;color:' + NAVY + '}.av span{font:400 16px "IBM Plex Sans",sans-serif;color:' + MUTE + ';margin-left:10px}.as{font-size:14px;color:' + MUTE + ';margin-top:14px}.nomap{font-size:18px;color:' + MUTE + ';padding:40px 0}'
  + '.src{font-size:16px;margin-top:12px;color:' + INK + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ft{margin-top:auto;padding-top:14px;text-align:center;font-size:17px;color:' + MUTE + ';line-height:1.6}'
  + '.cover{text-align:left}.lgc{height:140px;margin-top:20px}.cover h1{font:700 62px Fraunces,Georgia,serif;color:' + NAVY + ';margin:8px 0}.cover .hs{font-size:30px}.lead{font-size:21px;color:' + MUTE + '}.rule{width:300px;height:2px;background:' + GOLD + ';margin:0 auto 18px}'
  + '.cg{display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:left}.cc{position:relative;background:#fff;border:2px solid ' + GOLD + ';border-radius:16px;padding:8px;height:252px}.cc img,.ci{width:100%;height:160px;object-fit:cover;border-radius:12px}.ci.none span{width:70px;height:70px;font-size:34px}.cn{position:absolute;left:16px;top:16px;background:' + NAVY + ';color:#fff;border-radius:8px;padding:2px 10px;font-weight:700}'
  + '.cb{display:flex;justify-content:space-between;gap:8px;margin:8px 8px 0}.cb b{font:700 23px Fraunces,Georgia,serif;color:' + NAVY + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cb i{font:700 22px Fraunces,Georgia,serif;color:' + GOLD + ';font-style:normal;white-space:nowrap}.cs{margin:4px 8px;font-size:18px;color:' + MUTE + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.note{font-size:17px;color:' + MUTE + ';margin-top:14px}'
  + '.bar{position:sticky;top:0;z-index:5;display:flex;gap:10px;justify-content:center;padding:10px;background:' + CREAM + ';border-bottom:1px solid ' + PALE + '}.bar a{display:inline-flex;align-items:center;gap:6px;background:#0A4F4A;color:#fff;text-decoration:none;border-radius:999px;padding:10px 18px;font:600 15px "IBM Plex Sans",sans-serif}.bar a.wa{background:#fff;color:#0A4F4A;border:1px solid #0A4F4A}'
  + '.chd{display:flex;align-items:center;gap:16px;height:84px}.lgs{height:76px}.chero{margin-top:12px;height:620px;border-radius:24px;overflow:hidden;position:relative;background:#EFE6D4}.chero img{width:100%;height:100%;object-fit:cover}.chero .cr{position:absolute;right:10px;bottom:10px;background:rgba(31,43,68,.82);color:#fff;font-size:16px;border-radius:8px;padding:3px 10px}'
  + '.ctt{display:flex;justify-content:space-between;align-items:baseline;margin-top:22px;gap:20px}.ctt h1{font:700 64px/1.05 Fraunces,Georgia,serif;color:' + NAVY + ';margin:0}.csb{font-size:26px;margin:6px 0 14px}'
  + '.chips{display:flex;flex-wrap:wrap;gap:10px}.chip{display:inline-flex;align-items:center;gap:8px;background:#fff;border:2px solid ' + GOLD + ';border-radius:999px;padding:6px 16px 6px 10px;font-size:19px}'
  + '.dna{margin-top:20px;background:#0A4F4A;color:#F3E7CF;border-radius:22px;padding:22px 28px}.dh span{font:600 17px "IBM Plex Sans",sans-serif;letter-spacing:.18em;color:' + GOLD + '}.dh h3{font:700 40px Fraunces,Georgia,serif;margin:4px 0 2px;color:#fff}.dh i{font-size:18px;color:#CFE0DA;font-style:normal}'
  + '.dg{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:16px 0 8px}.ds{background:rgba(255,255,255,.08);border:1px solid rgba(197,165,106,.55);border-radius:14px;padding:12px 10px;text-align:center}.ds b{display:block;font:700 34px Fraunces,Georgia,serif;color:' + GOLD + '}.ds span{font-size:15px;color:#E6EFEC}'
  + '.dl{display:flex;align-items:center;gap:12px;margin-top:8px}.dl p{margin:0;font-size:19px;color:#F3E7CF}.dl b{color:#fff}.dsrc{font-size:14px;color:#A9C4BD;margin-top:12px}'
  + '.cover .cth{font:700 52px Fraunces,Georgia,serif;color:' + NAVY + ';margin:10px 0 4px;text-align:left}.cover .lead{text-align:left;margin:0 0 14px}.cover .note{text-align:left}'
  + '.mapimg{filter:saturate(.85)}'
  + '@media print{.bar{display:none}body{background:none}.pg{margin:0}}';

const ZOOM_JS = '<script>(function(){function z(){var s=Math.min(1,(window.innerWidth-8)/1080);document.querySelectorAll(".pg").forEach(function(p){p.style.zoom=s})}z();addEventListener("resize",z)})()</script>';

export function reportHtml(rows, data, opts) {
  opts = opts || {};
  const total = rows.length + 1, sub = opts.sub || "";
  SHARED = sharedPics(data);   // v802
  const pages = [coverPage(rows, data, opts.title || "Najma Launch Report", sub, total, opts.by, opts.dna)].concat(rows.map((r, i) => launchPage(r, data[r.key], i + 1, total, sub, opts.by)));
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
  const snap = tidyLaunches(await deps.kv(env, "launches")), rep = await deps.kv(env, "launch_report_data");
  const rows = pickRows(snap && snap.rows, rec.keys), data = (rep && rep.rows) || {};
  await addMaps(rows, data);   // v805 Esri basemap under each launch's map
  const pdfHref = origin + "/lr/" + rec.token + ".pdf";
  const text = (rec.title || "Najma Launch Report") + (rec.sub ? " (" + rec.sub + ")" : "") + ": " + rows.length + " Dubai launch" + (rows.length === 1 ? "" : "es") + ", prices as advertised. " + origin + "/lr/" + rec.token;
  return { rows, html: await withLogo(env, reportHtml(rows, data, { title: rec.title, sub: rec.sub, by: rec.by, dna: rep && rep.dev_dna, bar, pdfHref, waHref: "https://wa.me/?text=" + encodeURIComponent(text) })), text };
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
  const snap = tidyLaunches(await deps.kv(env, "launches"));
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
