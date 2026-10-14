// v590 - MOMO WORK · CONTENT PLAN (Kendall 14 Oct 2026: "you also folding this into Momo Work"; the FN content strategy: three pillars + Assign).
// Najjuko's private planning space for the content the FN team makes: the KNOWN calendar (dates that exist anyway), the MARKET calendar (launches, events, area
// stories from Najma research) and the TREND inbox (what the platforms reward now, expiring in 72 hours), each item with a format, an owner on the team and the
// day the artwork has to START (the lead time of its format). The team receives the plan as a one-page PDF (/momo/work/plan/week) - never a link into Momo Work.
// This is the Momo Work side of the plan; the development team's Content Planner service will later supply the same items through a feed (see
// Client_Engagements/FN_Realty/Strategy/FN_Content_Engine_Developer_Spec_14OCT2026.md section 8). Until then the items live in her own KV, so it works today.
import { FN_LOGO_B64 as FN_LOGO, FN_LATTICE_B64 as FN_LATTICE, FN_NAVY, FN_PEACH, FN_GOLD } from "./fn_logo.js";

const PLP = "work_naj_plan_", TRP = "work_naj_trend_", TMP = "work_naj_team_", SEED_KEY = "work_naj_planseed";
export const LEAD = { story: 3, post: 7, carousel: 14, reel: 21 };            // days before publication that the artwork must start (team guide, section 3)
export const FORMATS = [["story", "Story"], ["post", "Post"], ["carousel", "Carousel"], ["reel", "Reel"]];
export const OWNERS = ["Graphic designer", "Videographer", "Social media manager", "Agent"];
export const STATES = ["Planned", "In design", "In review", "Approved", "Scheduled", "Posted"];
export const PILLARS = [["known", "Known calendar"], ["market", "Market calendar"], ["trend", "Trend"]];
export const CERT = ["Fixed", "Announced", "Expected", "Researched"];
export const PLATFORMS = ["Instagram", "TikTok", "YouTube", "LinkedIn", "X", "Article", "Other"];
// v593 (Kendall 14 Oct: "accept an Instagram or TikTok link or LinkedIn, or any type of link, even a news article"): any web link is a trend source.
export function normaliseLink(v) {
  let u = String(v || "").trim().split(/\s+/)[0];
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) { if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$|\?|#)/i.test(u)) u = "https://" + u; else return ""; }
  try { const x = new URL(u); if (!/^https?:$/.test(x.protocol)) return ""; return x.toString().slice(0, 400); } catch (e) { return ""; }
}
export function detectPlatform(url) {
  let h = ""; try { h = new URL(url).hostname.toLowerCase().replace(/^(www|m|mobile|vm|vt)\./, ""); } catch (e) { return ""; }
  if (/(^|\.)instagram\.com$/.test(h) || h === "instagr.am") return "Instagram";
  if (/(^|\.)tiktok\.com$/.test(h)) return "TikTok";
  if (/(^|\.)linkedin\.com$/.test(h) || h === "lnkd.in") return "LinkedIn";
  if (/(^|\.)youtube\.com$/.test(h) || h === "youtu.be") return "YouTube";
  if (/(^|\.)(x|twitter)\.com$/.test(h) || h === "t.co") return "X";
  return h ? "Article" : "";
}
const decodeEnt = (t) => String(t || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/\s+/g, " ").trim();
// the title the page gives itself (social sites often block this; then the host is used) - read at most 4 seconds, first 200 KB
export async function linkTitle(url) {
  try {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 4000);
    const r = await fetch(url, { signal: ac.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; FNPlan/1.0)", Accept: "text/html" } });
    clearTimeout(t);
    if (!r.ok || !/html/i.test(r.headers.get("content-type") || "text/html")) return "";
    const html = (await r.text()).slice(0, 200000);
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    const ti = og ? og[1] : (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
    const out = decodeEnt(ti).slice(0, 160);
    return /^(instagram|tiktok|linkedin|log in|login|sign in|just a moment|access denied)/i.test(out) ? "" : out;
  } catch (e) { return ""; }
}
const TREND_HOURS = 72;
const today = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const okD = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? String(d) : "";
const addDays = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const mondayOf = (d) => { const t = new Date(d + "T00:00:00Z"), g = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - g); return t.toISOString().slice(0, 10); };
export const artworkStart = (it) => addDays(it.start, -(LEAD[it.format] || 7));

// The Known calendar for the quarter, from the verified master list (every date marked fixed / announced / expected; moon-sighting dates are 'Expected').
// [id, start, end, title, pillar, certainty, format, owner, note]
export const SEED = [
  ["k_bcam_2026", "2026-10-01", "2026-10-31", "Breast Cancer Awareness Month", "known", "Fixed", "carousel", "Graphic designer", "Already running: one story a week, one carousel, one real act (decide which)"],
  ["k_dfc_2026", "2026-10-31", "2026-11-29", "Dubai Fitness Challenge (10th edition)", "known", "Announced", "carousel", "Graphic designer", "Active-lifestyle content: gyms, parks, cycling near our communities (Najma lifestyle sentences)"],
  ["k_flag_2026", "2026-11-03", "2026-11-03", "Flag Day", "known", "Fixed", "story", "Graphic designer", "Artwork should already be underway: use the fast lane"],
  ["k_movember_2026", "2026-11-01", "2026-11-30", "Movember (men's health)", "known", "Fixed", "carousel", "Graphic designer", "Decide: acknowledge or act"],
  ["k_diwali_2026", "2026-11-08", "2026-11-08", "Diwali", "known", "Fixed", "post", "Graphic designer", "Greeting for our Indian-community clients"],
  ["m_big5_2026", "2026-11-23", "2026-11-26", "Big 5 Global exhibition (Dubai World Trade Centre)", "market", "Announced", "reel", "Videographer", "Teaser, daily stories from the floor, wrap-up carousel. Organiser page still to be checked"],
  ["k_whitefri_2026", "2026-11-27", "2026-11-27", "White Friday (approximate)", "known", "Expected", "post", "Social media manager", "Only if FN has a real offer"],
  ["k_commem_2026", "2026-11-30", "2026-11-30", "Commemoration Day", "known", "Announced", "post", "Graphic designer", "Respectful single post; Managing Director approves; no sales content"],
  ["k_national_2026", "2026-12-02", "2026-12-03", "UAE National Day / Eid Al Etihad", "known", "Announced", "reel", "Videographer", "Biggest day of the quarter: film or carousel plus stories; Managing Director approves"],
  ["m_gitex_2026", "2026-12-07", "2026-12-11", "GITEX Global (Expo City Dubai)", "market", "Announced", "post", "Social media manager", "Technology and proptech angle"],
  ["k_winter_2026", "2026-12-14", "2027-01-03", "School winter break", "known", "Announced", "post", "Social media manager", "Families in Dubai; year-end market review carousel"],
  ["k_newyear_2027", "2027-01-01", "2027-01-01", "New Year's Day (three-day weekend)", "known", "Announced", "reel", "Videographer", "Year-in-review film and 2027 outlook, prepared in December"],
  ["k_marathon_2027", "2027-01-17", "2027-01-17", "Dubai Marathon", "known", "Announced", "story", "Graphic designer", "Active-lifestyle story"],
  ["k_ramadan_2027", "2027-02-08", "2027-03-09", "Ramadan begins (moon sighting, window 7-9 Feb)", "known", "Expected", "carousel", "Graphic designer", "Prepare two versions of every post until the announcement; tone and posting hours change"],
  ["k_eidfitr_2027", "2027-03-09", "2027-03-11", "Eid Al Fitr (moon sighting)", "known", "Expected", "reel", "Videographer", "Two versions ready; greeting film"],
  ["m_mipim_2027", "2027-03-15", "2027-03-19", "MIPIM property conference, Cannes", "market", "Announced", "post", "Social media manager", "International-investor content if FN attends"],
  ["k_mothers_2027", "2027-03-21", "2027-03-21", "Mother's Day in the UAE", "known", "Fixed", "story", "Graphic designer", "Homes-for-families story"],
  ["k_worldcup_2027", "2027-03-27", "2027-03-27", "Dubai World Cup", "known", "Announced", "story", "Graphic designer", "Luxury lifestyle story"],
];

function cleanItem(x, id) {
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  const start = okD(x.start) || today(), end = okD(x.end) || start;
  return {
    id, title: String(x.title || "").slice(0, 120).trim(), start, end: end < start ? start : end,
    pillar: pick(x.pillar, PILLARS.map((p) => p[0]), "market"), certainty: pick(x.certainty, CERT, "Researched"),
    format: pick(x.format, FORMATS.map((f) => f[0]), "post"), owner: pick(x.owner, OWNERS, "Graphic designer"), agent: String(x.agent || "").slice(0, 80),
    assignee: String(x.assignee || "").slice(0, 80), state: pick(x.state, STATES, "Planned"), note: String(x.note || "").slice(0, 300), source: /^https?:\/\//.test(String(x.source || "")) ? String(x.source).slice(0, 300) : "",
  };
}
function cleanTrend(x, id, prev) {
  const now = Date.now();
  return {
    id, url: normaliseLink(x.url), platform: PLATFORMS.includes(x.platform) ? x.platform : (detectPlatform(normaliseLink(x.url)) || "Other"),
    hook: String(x.hook || "").slice(0, 160).trim(), why: String(x.why || "").slice(0, 300).trim(), angle: String(x.angle || "").slice(0, 300).trim(),
    agent: String(x.agent || "").slice(0, 80), status: ["new", "assigned", "made", "dropped"].includes(x.status) ? x.status : "new",
    seen_at: (prev && prev.seen_at) || new Date(now).toISOString(), expires_at: (prev && prev.expires_at) || new Date(now + TREND_HOURS * 3600e3).toISOString(),
  };
}
async function listPrefix(env, prefix) {
  const out = []; let cursor;
  do { const r = await env.MEETINGS.list({ prefix, cursor }); cursor = r.list_complete ? null : r.cursor; for (const k of r.keys) out.push(k.name); } while (cursor);
  const recs = await Promise.all(out.map(async (k) => { try { return JSON.parse(await env.MEETINGS.get(k)); } catch (e) { return null; } }));
  return recs.filter((x) => x && typeof x === "object");
}
async function ensureSeed(env) {
  if (await env.MEETINGS.get(SEED_KEY)) return;
  for (const s of SEED) {
    const it = cleanItem({ title: s[3], start: s[1], end: s[2], pillar: s[4], certainty: s[5], format: s[6], owner: s[7], note: s[8], state: s[1] <= "2026-10-14" && s[2] >= "2026-10-14" ? "In design" : "Planned" }, s[0]);
    await env.MEETINGS.put(PLP + it.id, JSON.stringify(it));
  }
  await env.MEETINGS.put(SEED_KEY, "1");
}
const slugN = (n) => String(n || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
const cleanNumber = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length >= 8 && d.length <= 15 ? d : ""; };   // WhatsApp wants digits with the country code, no plus
export async function teamList(env, roster) {
  const saved = {}; for (const r of await listPrefix(env, TMP)) saved[r.name] = r;
  return roster.map((x) => ({ name: x[0], role: x[1], whatsapp: (saved[x[0]] || {}).whatsapp || "" }));
}
export async function planItems(env) { return (await listPrefix(env, PLP)).sort((a, b) => (a.start + a.title).localeCompare(b.start + b.title)); }
const trendLeft = (t) => Math.round((Date.parse(t.expires_at) - Date.now()) / 3600e3);

function weekHtml(items, trends, mon) {
  const sun = addDays(mon, 6), fmt = (d) => { const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], p = d.split("-"); return (+p[2]) + " " + M[+p[1] - 1]; };
  const going = items.filter((i) => i.start <= sun && i.end >= mon && i.state !== "Posted").sort((a, b) => a.start.localeCompare(b.start));
  const startNow = items.filter((i) => { const a = artworkStart(i); return a >= mon && a <= sun && i.state === "Planned"; });
  const late = items.filter((i) => artworkStart(i) < mon && i.start > sun && i.state === "Planned");
  const row = (i) => '<tr><td><b>' + esc(i.title) + '</b>' + (i.note ? '<small>' + esc(i.note) + '</small>' : '') + '</td><td>' + esc(fmt(i.start) + (i.end !== i.start ? ' – ' + fmt(i.end) : '')) + '</td><td>' + esc((FORMATS.find((f) => f[0] === i.format) || [0, i.format])[1]) + '</td><td>' + esc(i.owner) + (i.agent ? '<small>for ' + esc(i.agent) + '</small>' : '') + '</td><td>' + esc(i.state) + '</td></tr>';
  const tbl = (rows) => '<table><tr><th>What</th><th>Date</th><th>Format</th><th>Who makes it</th><th>Status</th></tr>' + rows.map(row).join("") + '</table>';
  const live = trends.filter((t) => t.status === "assigned" && trendLeft(t) > 0);
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FN Weekly content plan ' + esc(fmt(mon)) + ' ' + mon.slice(0, 4) + '</title>'
    + '<link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600&display=swap"><style>@page{size:A4;margin:12mm}@page{@top-left{content:none}@top-center{content:none}@top-right{content:none}@bottom-left{content:none}@bottom-center{content:none}@bottom-right{content:none}}'
    + 'body{margin:0;background:#F4F2EE;color:#1C2321;font-family:Inter,sans-serif;font-size:10pt;line-height:1.45}.pg{max-width:780px;margin:0 auto;background:#fff;padding:26px 30px 30px;border:1px solid ' + FN_GOLD + ';position:relative}'
    + '.latt{height:44px;margin:-26px -30px 16px;background:url("' + FN_LATTICE + '") center/auto 100% repeat-x;opacity:.85;border-bottom:1px solid ' + FN_GOLD + '}header{display:flex;justify-content:space-between;align-items:flex-start}'
    + 'h1{font-family:Anton,sans-serif;font-weight:400;font-size:24pt;color:' + FN_NAVY + ';margin:0;letter-spacing:.02em}h1 em{font-style:normal;color:' + FN_PEACH + '}header p{margin:4px 0 0;color:' + FN_NAVY + ';font-weight:500}header img{height:44px}'
    + 'h2{font-family:Anton,sans-serif;font-weight:400;color:' + FN_NAVY + ';font-size:12pt;letter-spacing:.04em;margin:16px 0 6px}table{width:100%;border-collapse:collapse;font-size:9pt}th{text-align:left;font-size:7.8pt;letter-spacing:.06em;text-transform:uppercase;color:#626B7C;padding:4px 6px;border-bottom:1px solid #E9EAEC}td{padding:6px;border-bottom:1px solid #EFE9DE;vertical-align:top}td small{display:block;color:#626B7C;font-size:8pt}'
    + '.note{margin-top:18px;padding-top:8px;border-top:1px solid #E9EAEC;font-size:7.8pt;color:#626B7C}.btns{position:fixed;right:14px;bottom:14px}.btn{background:' + FN_NAVY + ';color:' + FN_PEACH + ';border:0;border-radius:99px;padding:10px 16px;font:600 10pt Inter,sans-serif;cursor:pointer}@media print{body{background:#fff}.pg{border:0;padding:0}.btns{display:none}}</style></head><body><div class=pg><div class=latt></div>'
    + '<header><div><h1><em>Weekly</em> content plan</h1><p>' + esc(fmt(mon)) + ' – ' + esc(fmt(sun)) + ' ' + sun.slice(0, 4) + '</p></div><img src="' + FN_LOGO + '" alt="FN Realty"></header>'
    + '<h2>GOING OUT THIS WEEK</h2>' + (going.length ? tbl(going) : '<p>Nothing scheduled this week.</p>')
    + (startNow.length ? '<h2>ARTWORK STARTS THIS WEEK</h2>' + tbl(startNow) : '') + (late.length ? '<h2>ALREADY LATE TO START: USE THE FAST LANE</h2>' + tbl(late) : '')
    + (live.length ? '<h2>TRENDS TO MAKE (EACH EXPIRES 72 HOURS AFTER IT WAS SEEN)</h2><table><tr><th>Trend</th><th>Platform</th><th>For</th><th>Our angle</th></tr>' + live.map((t) => '<tr><td><b>' + esc(t.hook) + '</b><small>' + esc(t.why) + '</small></td><td>' + esc(t.platform) + '</td><td>' + esc(t.agent) + '</td><td>' + esc(t.angle) + '</td></tr>').join("") + '</table>' : '')
    + '<div class=note>Every number in a post comes from Najma with its date; reviews are summarised, never quoted; property advertisements carry the advertising permit number; the Managing Director approves sensitive items. Prepared by Serah Najjuko Ganyana for FN Realty. The method, templates and tools that produced this plan are her own (employment contract, clause 12.2) and are not part of what is provided.</div></div>'
    + '<div class=btns><button class=btn onclick="print()">Share / Save as PDF</button></div></body></html>';
}

function monthHtml(items, ym) {
  const MN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], first = ym + "-01", y = +ym.slice(0, 4), mo = +ym.slice(5, 7);
  const last = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10), fmt = (d) => { const p = d.split("-"); return (+p[2]) + " " + MN[+p[1] - 1].slice(0, 3); };
  const inM = items.filter((i) => i.pillar !== "trend" && i.start <= last && i.end >= first).sort((a, b) => a.start.localeCompare(b.start));
  const long = inM.filter((i) => (Date.parse(i.end) - Date.parse(i.start)) / 864e5 > 3), short = inM.filter((i) => long.indexOf(i) < 0);
  const col = { known: "#15665C", market: "#D9782E" };
  const lead = (new Date(first + "T00:00:00Z").getUTCDay() + 6) % 7, days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  let cells = ""; for (let k = 0; k < lead; k++) cells += "<td class=o></td>";
  for (let d = 1; d <= days; d++) {
    const ds = ym + "-" + String(d).padStart(2, "0"), hit = short.filter((i) => i.start <= ds && i.end >= ds);
    cells += "<td><b>" + d + "</b>" + hit.slice(0, 3).map((i) => '<i style="background:' + (col[i.pillar] || "#999") + '"></i>').join("") + (hit.length > 3 ? "<em>+" + (hit.length - 3) + "</em>" : "") + "</td>";
    if (((lead + d) % 7) === 0 && d < days) cells += "</tr><tr>";
  }
  const row = (i, n) => '<tr><td class=n>' + n + '</td><td><b>' + esc(i.title) + '</b>' + (i.note ? '<small>' + esc(i.note) + '</small>' : '') + '</td><td>' + esc(fmt(i.start) + (i.end !== i.start ? " – " + fmt(i.end) : "")) + '</td><td>' + esc(i.certainty) + '</td><td class=bx><span></span>Attend &nbsp; <span></span>Content only &nbsp; <span></span>Skip</td></tr>';
  let n = 0; const tbl = (list) => '<table class=ev><tr><th>#</th><th>Event or moment</th><th>Date</th><th>How certain</th><th>Decision</th></tr>' + list.map((i) => row(i, ++n)).join("") + '</table>';
  const mk = inM.filter((i) => i.pillar === "market"), kn = inM.filter((i) => i.pillar === "known");
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FN Events for ' + MN[mo - 1] + ' ' + y + '</title>'
    + '<link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600&display=swap"><style>@page{size:A4;margin:12mm}@page{@top-left{content:none}@top-center{content:none}@top-right{content:none}@bottom-left{content:none}@bottom-center{content:none}@bottom-right{content:none}}'
    + 'body{margin:0;background:#F4F2EE;color:#1C2321;font-family:Inter,sans-serif;font-size:10pt;line-height:1.45}.pg{max-width:780px;margin:0 auto;background:#fff;padding:26px 30px 30px;border:1px solid ' + FN_GOLD + '}'
    + '.latt{height:44px;margin:-26px -30px 16px;background:url("' + FN_LATTICE + '") center/auto 100% repeat-x;opacity:.85;border-bottom:1px solid ' + FN_GOLD + '}header{display:flex;justify-content:space-between;align-items:flex-start}'
    + 'h1{font-family:Anton,sans-serif;font-weight:400;font-size:24pt;color:' + FN_NAVY + ';margin:0;letter-spacing:.02em}h1 em{font-style:normal;color:' + FN_PEACH + '}header p{margin:4px 0 0;color:' + FN_NAVY + ';font-weight:500}header img{height:44px}'
    + 'h2{font-family:Anton,sans-serif;font-weight:400;color:' + FN_NAVY + ';font-size:12pt;letter-spacing:.04em;margin:16px 0 6px}.cal{width:100%;border-collapse:separate;border-spacing:3px;table-layout:fixed}.cal th{font-size:7.8pt;color:#626B7C;text-transform:uppercase;letter-spacing:.06em;text-align:left}'
    + '.cal td{height:46px;border:1px solid #EFE9DE;border-radius:6px;padding:3px 4px;vertical-align:top;font-size:8.5pt}.cal td.o{border:0}.cal td i{display:inline-block;width:8px;height:8px;border-radius:50%;margin:2px 2px 0 0}.cal td em{font-size:7.5pt;color:#626B7C;font-style:normal}'
    + '.run{margin:8px 0;font-size:9pt}.run span{display:inline-block;border:1px solid ' + FN_GOLD + ';border-radius:99px;padding:2px 10px;margin:2px 4px 2px 0}.key{font-size:8pt;color:#626B7C;margin-top:4px}.key i{display:inline-block;width:8px;height:8px;border-radius:50%;margin:0 4px 0 10px}'
    + 'table.ev{width:100%;border-collapse:collapse;font-size:9pt}table.ev th{text-align:left;font-size:7.8pt;letter-spacing:.06em;text-transform:uppercase;color:#626B7C;padding:4px 6px;border-bottom:1px solid #E9EAEC}table.ev td{padding:7px 6px;border-bottom:1px solid #EFE9DE;vertical-align:top}td.n{width:22px;font-weight:600;color:' + FN_NAVY + '}td small{display:block;color:#626B7C;font-size:8pt}'
    + 'td.bx{white-space:nowrap;font-size:8.2pt}td.bx span{display:inline-block;width:10px;height:10px;border:1.3px solid ' + FN_NAVY + ';border-radius:2px;margin-right:4px;vertical-align:-1px}'
    + '.note{margin-top:18px;padding-top:8px;border-top:1px solid #E9EAEC;font-size:7.8pt;color:#626B7C}.btns{position:fixed;right:14px;bottom:14px}.btn{background:' + FN_NAVY + ';color:' + FN_PEACH + ';border:0;border-radius:99px;padding:10px 16px;font:600 10pt Inter,sans-serif;cursor:pointer}@media print{body{background:#fff}.pg{border:0;padding:0}.btns{display:none}}</style></head><body><div class=pg><div class=latt></div>'
    + '<header><div><h1><em>Events</em> for ' + MN[mo - 1] + '</h1><p>What we are looking at, for your decision · ' + y + '</p></div><img src="' + FN_LOGO + '" alt="FN Realty"></header>'
    + '<h2>THE MONTH AT A GLANCE</h2>' + (long.length ? '<div class=run><b>Running through the month:</b> ' + long.map((i) => '<span>' + esc(i.title) + '</span>').join("") + '</div>' : '')
    + '<table class=cal><tr><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th><th>Sun</th></tr><tr>' + cells + '</tr></table><div class=key><i style="background:#D9782E"></i>Industry event<i style="background:#15665C"></i>Cause, national or seasonal moment</div>'
    + (mk.length ? '<h2>INDUSTRY EVENTS</h2>' + tbl(mk) : '') + (kn.length ? '<h2>MOMENTS AND CAUSES</h2>' + tbl(kn) : '') + (inM.length ? '' : '<p>Nothing in the plan for this month yet.</p>')
    + '<div class=note>For a decision: tick one box per line. “Attend” means FN takes part and creates content from it; “Content only” means we cover it from the office without attending; “Skip” means we leave it. Dates marked Expected depend on a moon sighting or an official announcement and may move. Prepared by Serah Najjuko Ganyana for FN Realty. The method, templates and tools that produced this are her own (employment contract, clause 12.2) and are not part of what is provided.</div></div>'
    + '<div class=btns><button class=btn onclick="print()">Share / Save as PDF</button></div></body></html>';
}

const PLAN_JS = String.raw`
var KEY=new URLSearchParams(location.search).get("key")||"",D=null,VIEW="cal",SHEET=null;
function $(i){return document.getElementById(i)}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]})}
function api(o){return fetch("/momo/work/plan/api?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}).then(function(r){return r.json()})}
function today(){return new Date(Date.now()+4*3600e3).toISOString().slice(0,10)}
function addDays(d,n){var t=new Date(d+"T00:00:00Z");t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)}
var MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fd(d){var p=d.split("-");return (+p[2])+" "+MON[+p[1]-1]}
function monday(d){var t=new Date(d+"T00:00:00Z"),g=(t.getUTCDay()+6)%7;t.setUTCDate(t.getUTCDate()-g);return t.toISOString().slice(0,10)}
function fmtName(f){var r=f;D.formats.forEach(function(x){if(x[0]===f)r=x[1]});return r}
function artStart(i){return addDays(i.start,-(D.lead[i.format]||7))}
function pil(p){var r="Trend";D.pillars.forEach(function(x){if(x[0]===p)r=x[1]});return r}
var STACK=[];function closeTop(){var c=STACK.pop();if(c)c();if(!STACK.length)load()}function SHEETALL(){while(STACK.length){STACK.pop()()}load()}
function sheet(title,html,onopen){var bg=document.createElement("div");bg.className="sheetbg";var s=document.createElement("div");s.className="sheet";s.innerHTML="<h4>"+title+"</h4>"+html+'<button type=button class="gold done">Done</button>';
 document.body.appendChild(bg);document.body.appendChild(s);STACK.push(function(){bg.remove();s.remove()});bg.onclick=closeTop;s.querySelector(".done").onclick=closeTop;if(onopen)onopen(s)}
function opts(list,cur,att){return list.map(function(v){var val=Array.isArray(v)?v[0]:v,nm=Array.isArray(v)?v[1]:v;return '<div class="opt'+(val===cur?' on':'')+'" data-v="'+esc(val)+'">'+esc(nm)+(val===cur?'<span style="margin-left:auto;color:#0A4F4A">&#10003;</span>':'')+'</div>'}).join("")}
function chip(t,c){return '<span class=chp style="border-color:'+c+';color:'+c+'">'+esc(t)+'</span>'}
var PC={known:"#15665C",market:"#D9782E",trend:"#6A4C93"};
function card(i){var as=artStart(i),t=today(),late=i.state==="Planned"&&as<t&&i.start>=t,span=fd(i.start)+(i.end!==i.start?" – "+fd(i.end):"");
 return '<div class=ent data-id="'+esc(i.id)+'" style="cursor:pointer"><h3>'+esc(i.title)+'</h3><div class=m>'+esc(span)+'</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0">'+chip(pil(i.pillar),PC[i.pillar]||"#15665C")+chip(i.certainty,i.certainty==="Expected"?"#B04A3A":"#626B78")+chip(fmtName(i.format),"#8A6F3E")+chip(i.state,i.state==="Posted"?"#15948A":"#626B78")+'</div>'
  +'<div class=line style="margin:2px 0">'+esc(i.owner)+(i.agent?' · for '+esc(i.agent):'')+'</div>'
  +(i.state==="Posted"?'':late?'<div class=line style="color:#B04A3A;margin:2px 0"><b>Artwork should have started '+esc(fd(as))+': use the fast lane.</b></div>':'<div class=line style="margin:2px 0">Artwork starts <b>'+esc(fd(as))+'</b></div>')
  +(i.note?'<div class=line style="margin:2px 0;color:#626B78">'+esc(i.note)+'</div>':'')+'</div>'}
function drawCal(){var t=today(),from=addDays(t,-3),to=addDays(t,60),L=D.items.filter(function(i){return i.end>=from&&i.start<=to&&i.state!=="Posted"||i.start>=from&&i.start<=to}),by={};
 L.sort(function(a,b){return a.start<b.start?-1:1}).forEach(function(i){var w=monday(i.start<from?from:i.start);(by[w]=by[w]||[]).push(i)});
 var ks=Object.keys(by).sort(),h=ks.map(function(w){return '<h2 style="font-size:.95rem;margin:16px 0 6px;color:#8A6F3E">Week of '+esc(fd(w))+(w===monday(t)?' · this week':'')+'</h2>'+by[w].map(card).join("")}).join("");
 $("pbody").innerHTML=(h||'<div class=empty><p>Nothing in the next eight weeks.</p></div>')
 +'<a class=ghost style="display:block;text-align:center;text-decoration:none;margin-top:14px" target=_blank href="/momo/work/plan/week?key='+encodeURIComponent(KEY)+'&from='+monday(t)+'">This week\'s plan for the team (PDF)</a>';
 document.querySelectorAll("[data-id]").forEach(function(e){e.onclick=function(){editItem(e.getAttribute("data-id"))}})}
function editItem(id){var i=D.items.filter(function(x){return x.id===id})[0];if(!i)return;
 var row=function(k,lab,val){return '<div class=fr id="e_'+k+'"><b>'+esc(lab)+'</b><span>'+esc(val||"tap to set")+'</span><i>&#8250;</i></div>'};
 sheet(esc(i.title),row("format","Format",fmtName(i.format))+row("owner","Who makes it",i.owner)+row("assignee","Assigned to",i.assignee)+row("agent","For which agent",i.agent)+row("state","Status",i.state)+(i.assignee&&numOf(i.assignee)?'<a class=ghost id=e_wa target=_blank rel=noopener style="display:block;text-align:center;text-decoration:none;margin:8px 0" href="'+esc(waLink(numOf(i.assignee),"Hi "+nameOf(i.assignee)+", "+i.title+" ("+fmtName(i.format)+"): artwork starts "+fd(artStart(i))+", it goes out "+fd(i.start)+". Can you confirm you have it?"))+'">Message '+esc(nameOf(i.assignee))+' on WhatsApp</a>':'')+'<textarea id=e_note rows=2 style="width:100%;margin:8px 0" placeholder="Note">'+esc(i.note)+'</textarea><button type=button class=ghost id=e_del style="width:100%;margin-bottom:8px">Remove from the plan</button>',function(s){
  var pickOne=function(k,lab,list){s.querySelector("#e_"+k).onclick=function(){sheet(lab,opts(list,i[k]),function(s2){s2.querySelectorAll(".opt").forEach(function(o){o.onclick=function(){i[k]=o.getAttribute("data-v");api({action:"item_save",item:i}).then(SHEETALL)}})})}};
  s.querySelector("#e_format").onclick=function(){sheet("Format",opts(D.formats,i.format),function(s2){s2.querySelectorAll(".opt").forEach(function(o){o.onclick=function(){i.format=o.getAttribute("data-v");api({action:"item_save",item:i}).then(SHEETALL)}})})};
  pickOne("owner","Who makes it",D.owners);pickOne("state","Status",D.states);
  s.querySelector("#e_assignee").onclick=function(){sheet("Assigned to",opts([""].concat((D.team||[]).map(function(x){return x.name})),i.assignee),function(s2){s2.querySelectorAll(".opt").forEach(function(o){o.onclick=function(){i.assignee=o.getAttribute("data-v");api({action:"item_save",item:i}).then(SHEETALL)}})})};
  s.querySelector("#e_agent").onclick=function(){sheet("For which agent",opts([""].concat(D.agents),i.agent),function(s2){s2.querySelectorAll(".opt").forEach(function(o){o.onclick=function(){i.agent=o.getAttribute("data-v");api({action:"item_save",item:i}).then(SHEETALL)}})})};
  s.querySelector("#e_note").onchange=function(){i.note=this.value;api({action:"item_save",item:i})};
  s.querySelector("#e_del").onclick=function(){if(confirm("Remove this from the plan?"))api({action:"item_delete",id:i.id}).then(SHEETALL)}})}
function addItem(day){var n={title:"",start:day||today(),pillar:"market",certainty:"Researched",format:"post",owner:"Graphic designer",agent:"",source:"",note:""};
 var draw=function(s){s.querySelector("#a_pil").innerHTML=D.pillars.map(function(p){return '<button type=button data-v="'+p[0]+'"'+(n.pillar===p[0]?' class=on':'')+'>'+esc(p[1])+'</button>'}).join("");
  s.querySelectorAll("#a_pil button").forEach(function(b){b.onclick=function(){n.pillar=b.getAttribute("data-v");draw(s)}});
  s.querySelector("#a_fmt").innerHTML=D.formats.map(function(f){return '<button type=button data-v="'+f[0]+'"'+(n.format===f[0]?' class=on':'')+'>'+esc(f[1])+'</button>'}).join("");
  s.querySelectorAll("#a_fmt button").forEach(function(b){b.onclick=function(){n.format=b.getAttribute("data-v");draw(s)}});
  s.querySelector("#a_art").textContent="Artwork starts "+fd(addDays(n.start,-(D.lead[n.format]||7)))};
 sheet("Add to the plan",'<input id=a_t class=sin placeholder="What is it? (a launch, an event, a cause)" style="width:100%;margin-bottom:8px"><div class=line>Date it goes out</div><input id=a_d type=date value="'+n.start+'" style="width:100%;margin-bottom:8px"><div class=line>Where it came from</div><div class=seg id=a_pil style="grid-template-columns:1fr 1fr 1fr"></div><div class=line>Format</div><div class=seg id=a_fmt style="grid-template-columns:repeat(4,1fr);gap:6px"></div><div class=line id=a_art style="margin:8px 0;font-weight:600"></div><input id=a_s class=sin placeholder="Source link (a launch needs one)" style="width:100%;margin-bottom:8px"><div class=line>You choose who makes it and which agent after saving.</div>',function(s){
  draw(s);s.querySelector("#a_d").onchange=function(){n.start=this.value||today();draw(s)};
  s.querySelector(".done").onclick=function(){n.title=s.querySelector("#a_t").value.trim();n.source=s.querySelector("#a_s").value.trim();if(!n.title){alert("Say what it is first.");return}
   if(n.pillar!=="known"&&!n.source&&!confirm("A market item should carry a source link. Save without one?"))return;api({action:"item_save",item:n}).then(SHEETALL)}})}
function trendCard(t){var left=Math.round((Date.parse(t.expires_at)-Date.now())/3600e3),dead=t.status==="dropped"||t.status==="made"||left<=0;
 return '<div class=ent data-tid="'+esc(t.id)+'" style="cursor:pointer;'+(dead?'opacity:.55':'')+'"><h3>'+esc(t.hook||"(no hook yet)")+'</h3><div class=m>'+esc(t.platform)+' · '+(t.status==="made"?'made':t.status==="dropped"?'dropped':left<=0?'expired':left+' h left')+'</div>'
  +(t.why?'<div class=line style="margin:2px 0">Why it works: '+esc(t.why)+'</div>':'')+(t.angle?'<div class=line style="margin:2px 0">Our angle: '+esc(t.angle)+'</div>':'')+(!t.why||!t.angle?'<div class=line style="margin:2px 0;color:#B04A3A">Still to add: '+[!t.why?'why it works':'',!t.angle?'our angle':''].filter(Boolean).join(' and ')+'</div>':'')+(t.agent?'<div class=line style="margin:2px 0"><b>For '+esc(t.agent)+'</b></div>':'')+'</div>'}
var MONTH=null,MN=["January","February","March","April","May","June","July","August","September","October","November","December"];
function ymOf(d){return d.slice(0,7)}
function shiftMonth(ym,n){var y=+ym.slice(0,4),m=+ym.slice(5,7)-1+n;y+=Math.floor(m/12);m=((m%12)+12)%12;return y+"-"+String(m+1).padStart(2,"0")}
function itemsOn(ds){return D.items.filter(function(i){return i.pillar!=="trend"&&i.start<=ds&&i.end>=ds&&i.state!=="Posted"})}
function isLong(i){return (Date.parse(i.end)-Date.parse(i.start))/864e5>3}
function drawMonth(){var ym=MONTH||ymOf(today()),y=+ym.slice(0,4),mo=+ym.slice(5,7),days=new Date(Date.UTC(y,mo,0)).getUTCDate(),lead=(new Date(ym+"-01T00:00:00Z").getUTCDay()+6)%7,t=today(),
 first=ym+"-01",last=ym+"-"+String(days).padStart(2,"0"),inM=D.items.filter(function(i){return i.pillar!=="trend"&&i.start<=last&&i.end>=first&&i.state!=="Posted"}),longs=inM.filter(isLong),
 cells=[],wk=[],rows=[],i,d;
 for(i=0;i<lead;i++)cells.push(null);for(d=1;d<=days;d++)cells.push(ym+"-"+String(d).padStart(2,"0"));while(cells.length%7)cells.push(null);
 for(i=0;i<cells.length;i+=7)rows.push(cells.slice(i,i+7));
 var busiest=0,busyTxt="";
 var grid=rows.map(function(r){var cnt=0,tds=r.map(function(ds){if(!ds)return '<div class=mo style="min-height:46px"></div>';var hit=itemsOn(ds).filter(function(x){return !isLong(x)});cnt+=hit.length;
   return '<div class=mo data-day="'+ds+'" style="min-height:46px;border:1px solid '+(ds===t?'#0A4F4A':'#EFE9DE')+';border-radius:8px;padding:3px 4px;cursor:pointer;background:'+(ds===t?'#EEF5F3':'#fff')+'"><div style="font-size:.74rem;color:#5F6B66;font-weight:'+(ds===t?700:500)+'">'+(+ds.slice(8))+'</div><div style="display:flex;flex-wrap:wrap;gap:2px;margin-top:2px">'+hit.slice(0,4).map(function(x){return '<i style="width:9px;height:9px;border-radius:50%;background:'+(PC[x.pillar]||"#15665C")+'"></i>'}).join("")+(hit.length>4?'<em style="font-size:.65rem;font-style:normal;color:#5F6B66">+'+(hit.length-4)+'</em>':'')+'</div></div>'}).join("");
   if(cnt>busiest){busiest=cnt;var f=r.filter(Boolean)[0];busyTxt="week of "+fd(f)}
   return '<div style="display:grid;grid-template-columns:repeat(7,1fr) 28px;gap:3px;margin-bottom:3px;align-items:center">'+grid0(tds)+'<div style="text-align:center;font-size:.72rem;color:'+(cnt>=3?'#B04A3A':'#5F6B66')+';font-weight:600">'+(cnt||"")+'</div></div>'}).join("");
 function grid0(x){return x}
 $("pbody").innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin:2px 0 8px"><button type=button class=ghost id=mprev style="width:44px;padding:8px">&#8249;</button><b style="font-size:1.05rem;color:#0A4F4A">'+MN[mo-1]+' '+y+'</b><button type=button class=ghost id=mnext style="width:44px;padding:8px">&#8250;</button></div>'
  +(longs.length?'<div class=line style="margin:2px 0 8px"><b>Running through the month:</b> '+longs.map(function(x){return esc(x.title)}).join(" · ")+'</div>':'')
  +'<div style="display:grid;grid-template-columns:repeat(7,1fr) 28px;gap:3px;margin-bottom:4px;font-size:.68rem;color:#5F6B66;text-align:center"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span><span>#</span></div>'+grid
  +'<div class=line style="margin-top:8px"><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#15665C;margin-right:4px"></i>Cause or national moment <i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#D9782E;margin:0 4px 0 10px"></i>Industry event <i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#6A4C93;margin:0 4px 0 10px"></i>Trend</div>'
  +'<div class=line style="margin-top:6px">'+(inM.length?inM.length+' item'+(inM.length===1?'':'s')+' this month'+(busiest>=2?'; the busiest is the '+busyTxt+' with '+busiest:'')+'.':'Nothing planned this month.')+' The number at the end of each row is how many items fall in that week.</div>'
  +'<a class=ghost style="display:block;text-align:center;text-decoration:none;margin-top:12px" target=_blank href="/momo/work/plan/month?key='+encodeURIComponent(KEY)+'&month='+ym+'">The month as a PDF for Ali</a>';
 $("mprev").onclick=function(){MONTH=shiftMonth(ym,-1);drawMonth()};$("mnext").onclick=function(){MONTH=shiftMonth(ym,1);drawMonth()};
 document.querySelectorAll("[data-day]").forEach(function(e){e.onclick=function(){var ds=e.getAttribute("data-day"),L=itemsOn(ds);
  sheet(esc(fd(ds)),(L.length?L.map(card).join(""):'<div class=line>Nothing on this day.</div>')+'<button type=button class=ghost id=dadd style="width:100%;margin-top:8px">Add something on this day</button>',function(s){
   s.querySelectorAll("[data-id]").forEach(function(c){c.onclick=function(){var id=c.getAttribute("data-id");closeTop();editItem(id)}});
   s.querySelector("#dadd").onclick=function(){closeTop();addItem(ds)}})}})}
function waLink(num,text){return "https://wa.me/"+num+"?text="+encodeURIComponent(text)}
function nameOf(n){return String(n||"").replace(/\s*\(.*\)$/,"").split(" ")[0]}
function numOf(name){var r="";(D.team||[]).forEach(function(x){if(x.name===name)r=x.whatsapp});return r}
function pollText(ym){var y=+ym.slice(0,4),mo=+ym.slice(5,7),days=new Date(Date.UTC(y,mo,0)).getUTCDate(),first=ym+"-01",last=ym+"-"+String(days).padStart(2,"0"),
 L=D.items.filter(function(i){return i.pillar!=="trend"&&i.start<=last&&i.end>=first&&i.state!=="Posted"}).sort(function(a,b){return a.start<b.start?-1:1});
 if(!L.length)return "";return "Team, here are the events and moments for "+MN[mo-1]+". Which ones should we take part in? Please reply with the numbers.\n\n"+L.map(function(i,k){return (k+1)+") "+fd(i.start)+(i.end!==i.start?" – "+fd(i.end):"")+" · "+i.title}).join("\n")+"\n\nWe will decide at the Monday huddle."}
function shareSheet(){var ym=MONTH||ymOf(today()),mn=MN[+ym.slice(5,7)-1];
 var row=function(id,lab,sub){return '<div class=fr id="'+id+'"><b>'+esc(lab)+'</b><span>'+esc(sub)+'</span><i>&#8250;</i></div>'};
 sheet("Share the plan",row("s_poll","Ask the team: "+mn+" events","a poll on WhatsApp")+row("s_pdf","The month as a PDF for Ali","for his decision")+row("s_week","This week's plan as a PDF","for the team")+row("s_team","Team WhatsApp numbers",(D.team||[]).filter(function(x){return x.whatsapp}).length+" of "+(D.team||[]).length+" saved")
  +'<div class=line style="margin-top:8px">WhatsApp opens on your phone with the message ready; you press send. Nothing goes out without you.</div>',function(s){
  s.querySelector("#s_pdf").onclick=function(){window.open("/momo/work/plan/month?key="+encodeURIComponent(KEY)+"&month="+ym,"_blank")};
  s.querySelector("#s_week").onclick=function(){window.open("/momo/work/plan/week?key="+encodeURIComponent(KEY)+"&from="+monday(today()),"_blank")};
  s.querySelector("#s_team").onclick=function(){teamSheet()};
  s.querySelector("#s_poll").onclick=function(){pollSheet(ym)}})}
function pollSheet(ym){var txt=pollText(ym);if(!txt){alert("Nothing planned that month yet.");return}
 var team=(D.team||[]).filter(function(x){return x.whatsapp});
 sheet("Poll: "+MN[+ym.slice(5,7)-1]+" events",'<textarea id=p_t rows=9 style="width:100%">'+esc(txt)+'</textarea>'
  +(team.length?'<div class=line style="margin:8px 0 4px">Send to one person:</div>'+team.map(function(x){return '<a class=ghost data-n="'+esc(x.name)+'" style="display:block;text-align:center;text-decoration:none;margin:4px 0" target=_blank rel=noopener>'+esc(nameOf(x.name))+' · '+esc(x.role)+'</a>'}).join(""):'<div class=line style="margin:8px 0">Add the team numbers to send to people one by one.</div>')
  +'<button type=button class=gold id=p_copy style="width:100%;margin-top:8px">Copy for the group</button>',function(s){
  var ta=s.querySelector("#p_t");s.querySelectorAll("[data-n]").forEach(function(a){a.href=waLink(numOf(a.getAttribute("data-n")),"Hi "+nameOf(a.getAttribute("data-n"))+", "+ta.value);a.onclick=function(){a.href=waLink(numOf(a.getAttribute("data-n")),"Hi "+nameOf(a.getAttribute("data-n"))+", "+ta.value)}});
  s.querySelector("#p_copy").onclick=function(){var b=this;(navigator.clipboard?navigator.clipboard.writeText(ta.value):Promise.reject()).then(function(){b.textContent="Copied. Paste it in the group."}).catch(function(){ta.select();b.textContent="Select and copy the text above"})}})}
function teamSheet(){sheet("Team WhatsApp numbers",(D.team||[]).map(function(x){return '<div class=fr data-t="'+esc(x.name)+'"><b>'+esc(nameOf(x.name))+'</b><span>'+esc(x.whatsapp?"+"+x.whatsapp:x.role)+'</span><i>&#8250;</i></div>'}).join("")
  +'<div class=line style="margin-top:8px">Full number with the country code, for example 971 50 123 4567. Stored privately in your log, used only to open WhatsApp for you.</div>',function(s){
  s.querySelectorAll("[data-t]").forEach(function(r){r.onclick=function(){var nm=r.getAttribute("data-t"),cur=numOf(nm);
   sheet(esc(nm),'<input id=t_n class=sin inputmode=tel placeholder="971 50 123 4567" value="'+esc(cur)+'" style="width:100%">',function(s2){
    s2.querySelector(".done").onclick=function(){var v=s2.querySelector("#t_n").value;api({action:"team_save",name:nm,whatsapp:v}).then(function(j){if(j.error){alert(j.error);return}D.team.forEach(function(x){if(x.name===nm)x.whatsapp=j.whatsapp});SHEETALL()})}})}})})}
function drawTrends(){var L=D.trends.slice().sort(function(a,b){return a.expires_at<b.expires_at?1:-1}),live=L.filter(function(t){return t.status!=="dropped"&&t.status!=="made"&&Date.parse(t.expires_at)>Date.now()}),dead=L.filter(function(t){return live.indexOf(t)<0}).slice(0,8);
 $("pbody").innerHTML='<div class=line>Each trend lives 72 hours. One not made in time is dropped, not carried forward.</div>'+(live.length?live.map(trendCard).join(""):'<div class=empty><p>No live trends. Add what you saw today.</p></div>')+(dead.length?'<h2 style="font-size:.9rem;margin:16px 0 6px;color:#8A6F3E">Done or expired</h2>'+dead.map(trendCard).join(""):'');
 document.querySelectorAll("[data-tid]").forEach(function(e){e.onclick=function(){editTrend(e.getAttribute("data-tid"))}})}
function editTrend(id){var t=D.trends.filter(function(x){return x.id===id})[0];if(!t)return;
 sheet(esc(t.hook||"Trend"),'<input id=t_h class=sin value="'+esc(t.hook)+'" placeholder="What is it?" style="width:100%;margin-bottom:6px"><textarea id=t_w rows=2 style="width:100%;margin-bottom:6px" placeholder="Why is it working?">'+esc(t.why)+'</textarea><textarea id=t_a rows=2 style="width:100%;margin-bottom:8px" placeholder="Our angle: which true fact fits?">'+esc(t.angle)+'</textarea>'+'<div class=fr id=t_agent><b>Give it to</b><span>'+esc(t.agent||"tap to choose")+'</span><i>&#8250;</i></div><div class=fr id=t_made><b>Mark as made</b><span></span><i>&#8250;</i></div><div class=fr id=t_drop><b>Drop it</b><span></span><i>&#8250;</i></div>'+(t.url?'<a class=ghost style="display:block;text-align:center;text-decoration:none;margin:8px 0" target=_blank rel=noopener href="'+esc(t.url)+'">Open the original</a>':''),function(s){
  var keep=function(){t.hook=s.querySelector("#t_h").value.trim()||t.hook;t.why=s.querySelector("#t_w").value.trim();t.angle=s.querySelector("#t_a").value.trim()};
  ["t_h","t_w","t_a"].forEach(function(k){s.querySelector("#"+k).onchange=function(){keep();api({action:"trend_save",trend:t})}});
  s.querySelector("#t_agent").onclick=function(){keep();sheet("Give it to",opts(D.agents,t.agent),function(s2){s2.querySelectorAll(".opt").forEach(function(o){o.onclick=function(){t.agent=o.getAttribute("data-v");t.status="assigned";api({action:"trend_save",trend:t}).then(SHEETALL)}})})};
  s.querySelector("#t_made").onclick=function(){keep();if(!t.why||!t.angle){alert("Before it counts as made, say why it works and our angle.");return}t.status="made";api({action:"trend_save",trend:t}).then(function(j){if(j.error){alert(j.error);return}SHEETALL()})};
  s.querySelector("#t_drop").onclick=function(){keep();t.status="dropped";api({action:"trend_save",trend:t}).then(SHEETALL)}})}
var PLAT_SEL="Instagram";
function detectPlat(u){var h="";try{h=new URL(/^https?:/i.test(u)?u:"https://"+u).hostname.toLowerCase().replace(/^(www|m|mobile|vm|vt)\./,"")}catch(e){return ""}
 if(/instagram\.com$|^instagr\.am$/.test(h))return "Instagram";if(/tiktok\.com$/.test(h))return "TikTok";if(/linkedin\.com$|^lnkd\.in$/.test(h))return "LinkedIn";if(/youtube\.com$|^youtu\.be$/.test(h))return "YouTube";if(/(^|\.)(x|twitter)\.com$|^t\.co$/.test(h))return "X";return h.indexOf(".")>0?"Article":""}
function addTrend(){var n={platform:"",url:"",hook:"",why:"",angle:""};
 sheet("A trend you saw",'<input id=n_u class=sin inputmode=url autocapitalize=off placeholder="Paste the link: Instagram, TikTok, LinkedIn, an article..." style="width:100%;margin-bottom:6px"><div class=line id=n_det style="margin:2px 0 8px;color:#5F6B66">Any link works. I read the platform from it.</div>'
  +'<div class=seg id=n_pl style="grid-template-columns:repeat(4,1fr);gap:4px">'+D.platforms.map(function(p){return '<button type=button data-v="'+p+'" style="padding:9px 2px;font-size:.72rem">'+p+'</button>'}).join("")+'</div>'
  +'<input id=n_h class=sin placeholder="What is it? (optional: I read the title from the link)" style="width:100%;margin:8px 0"><textarea id=n_w rows=2 style="width:100%;margin-bottom:8px" placeholder="Why is it working? (add it now or later)"></textarea><textarea id=n_a rows=2 style="width:100%" placeholder="Our angle: which true FN or Najma fact fits? (now or later)"></textarea>',function(s){
  var paint=function(){s.querySelectorAll("#n_pl button").forEach(function(x){x.classList.toggle("on",x.getAttribute("data-v")===n.platform)})},u=s.querySelector("#n_u");
  var det=function(){var d=detectPlat(u.value.trim());if(d&&!n.manual){n.platform=d}s.querySelector("#n_det").textContent=d?"Looks like "+d+(n.manual&&n.platform!==d?" (you chose "+n.platform+")":""):"Any link works. I read the platform from it.";paint()};
  u.oninput=det;u.onchange=det;
  s.querySelectorAll("#n_pl button").forEach(function(b){b.onclick=function(){n.platform=b.getAttribute("data-v");n.manual=true;paint()}});paint();
  s.querySelector(".done").onclick=function(){n.url=u.value.trim();n.hook=s.querySelector("#n_h").value.trim();n.why=s.querySelector("#n_w").value.trim();n.angle=s.querySelector("#n_a").value.trim();
   if(!n.url&&!n.hook){alert("Paste a link, or say what the trend is.");return}var btn=this;btn.disabled=true;btn.textContent="Saving...";
   api({action:"trend_save",trend:{platform:n.manual?n.platform:"",url:n.url,hook:n.hook,why:n.why,angle:n.angle}}).then(function(j){if(j.error){btn.disabled=false;btn.textContent="Done";alert(j.error);return}SHEETALL()})}})}
function draw(){$("tcal").classList.toggle("on",VIEW==="cal");$("tmon").classList.toggle("on",VIEW==="mon");$("ttr").classList.toggle("on",VIEW==="tr");$("padd").textContent=VIEW==="tr"?"Add a trend":"Add to the plan";if(VIEW==="cal")drawCal();else if(VIEW==="mon")drawMonth();else drawTrends()}
function load(){fetch("/momo/work/plan/api?key="+encodeURIComponent(KEY)).then(function(r){return r.json()}).then(function(j){D=j;draw()})}
$("tcal").onclick=function(){VIEW="cal";draw()};$("tmon").onclick=function(){VIEW="mon";draw()};$("ttr").onclick=function(){VIEW="tr";draw()};$("padd").onclick=function(){if(VIEW==="tr")addTrend();else addItem()};$("pshare").onclick=shareSheet;
$("pback").href="/momo/work?key="+encodeURIComponent(KEY);load();
`;

const PLAN_BODY = '<a class=back id=pback href="#">&#8592; Work log</a><div class=tag>MOMO · WORK</div><h1>Content plan</h1>'
  + '<div class=seg style="margin:8px 0 12px;grid-template-columns:1fr 1fr 1fr"><button type=button id=tcal class=on>List</button><button type=button id=tmon>Month</button><button type=button id=ttr>Trends</button></div>'
  + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px"><button type=button id=padd class=gold>Add to the plan</button><button type=button id=pshare class=ghost>Share</button></div><div id=pbody></div>';

export async function planRoute(request, env, url, deps, ctx) {
  const p = url.pathname, key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (p === "/momo/work/plan") return new Response(deps.page(key, rk, PLAN_BODY + "<script>" + PLAN_JS + "</script>"), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  if (p === "/momo/work/plan/week") {
    await ensureSeed(env);
    const mon = mondayOf(okD(url.searchParams.get("from")) || today());
    return new Response(weekHtml(await planItems(env), await listPrefix(env, TRP), mon), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  if (p === "/momo/work/plan/month") {
    await ensureSeed(env);
    const ym = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") || "") ? url.searchParams.get("month") : today().slice(0, 7);
    return new Response(monthHtml(await planItems(env), ym), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  if (p === "/momo/work/plan/api") {
    await ensureSeed(env);
    if (request.method === "GET") return J({ today: today(), items: await planItems(env), trends: await listPrefix(env, TRP), agents: ctx.agents, team: await teamList(env, ctx.team), formats: FORMATS, owners: OWNERS, states: STATES, pillars: PILLARS, certainty: CERT, platforms: PLATFORMS, lead: LEAD, trend_hours: TREND_HOURS });
    let b = {}; try { b = await request.json(); } catch (e) { return J({ error: "Send JSON." }, 400); }
    const rid = (v) => String(v || "").replace(/[^a-z0-9_]/gi, "").slice(0, 40) || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    if (b.action === "item_save") { const it = cleanItem(b.item || {}, rid((b.item || {}).id)); if (!it.title) return J({ error: "A title is needed." }, 400); await env.MEETINGS.put(PLP + it.id, JSON.stringify(it)); return J({ ok: true, item: it }); }
    if (b.action === "item_delete") { await env.MEETINGS.delete(PLP + rid(b.id)); return J({ ok: true }); }
    if (b.action === "team_save") {
      const nm = (ctx.team.find((x) => x[0] === b.name) || [])[0]; if (!nm) return J({ error: "Unknown person." }, 400);
      const num = cleanNumber(b.whatsapp); if (b.whatsapp && !num) return J({ error: "Use the full number with the country code, for example 971 50 123 4567." }, 400);
      await env.MEETINGS.put(TMP + slugN(nm), JSON.stringify({ name: nm, whatsapp: num })); return J({ ok: true, name: nm, whatsapp: num });
    }
    if (b.action === "trend_save") {
      const id = rid((b.trend || {}).id); let prev = null; try { prev = JSON.parse(await env.MEETINGS.get(TRP + id)); } catch (e) {}
      const incoming = Object.assign({}, b.trend || {}); const nl = normaliseLink(incoming.url);
      if (nl && !incoming.platform) incoming.platform = detectPlatform(nl);
      const t = cleanTrend(incoming, id, prev);
      if (!t.hook && t.url) t.hook = (await (ctx.title || linkTitle)(t.url)) || (new URL(t.url).hostname.replace(/^www\./, "") + new URL(t.url).pathname.replace(/\/$/, "").slice(0, 60));
      if (!t.hook) return J({ error: "Paste a link, or say what the trend is." }, 400);
      if (t.status === "made" && (!t.why || !t.angle)) return J({ error: "Before it counts as made, say why it works and our angle." }, 400);
      await env.MEETINGS.put(TRP + id, JSON.stringify(t)); return J({ ok: true, trend: t });
    }
    return J({ error: "Unknown action." }, 400);
  }
  return null;
}
