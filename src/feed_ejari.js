// v281 - EJARI · WHAT MOVED, the morning card (Kendall, 1 Oct 2026).
//
// "add something to Azimuth, after the Bible scripture: the last pull from Ejari, a day or week, as a bar chart or quick look in
// cards, so she knows what moved the day before or the week before and can align accordingly." Then: "add a filter for day, week,
// month", "top 5 / 10 / 15 / 20 districts", "the sub type field is valuable", and the register's project name, Arabic name and
// number ("THE VOGUE, 444").
//
// This module owns the card; index.js only calls feedEjariCard() from the morning chain (dailyFeedTick) and hands it the shared
// renderer, the image store and the WhatsApp image send, so the card goes through the same path the scene cards use.
//
// WHICH VIEW: DAY every morning (yesterday against the 7-day average before it), WEEK on Mondays (the last 7 days against the 7
// before), MONTH on the 1st (the last 30 days against the 30 before; the 1st wins over a Monday). TOP 5 districts on the card;
// the caption links to /contracts?view=..&top=5 with the CLIENT link key (never the owner key), where the toggles and 10/15/20 live.
//
// THE DATA (built by the DDA session; read only here - this module never writes a data key):
//   img_ejari_filed_dubai / img_ejari_filed_<district>    counted by FILING date (REGISTRATION_DATE, basis "filed") - preferred,
//                                                          because a contract signed yesterday is in the gateway feed by morning
//   img_ejari_daily_dubai / img_ejari_recent_<district>   counted by contract START date (basis "start") - the fallback; the card
//                                                          then says "by contract start date"
//   img_ejari_projects_index                              {as_of, source, projects, index: {"<project_number>": {name_en, name_ar, ...}}}
// A Dubai-wide file is {as_of, source, caveat, basis?, per_area: {fields, rows}, per_developer: {fields, rows}} (or plain {fields,
// rows}); a district file is {as_of, source, fields, rows}. A row may be an object or an array in the order of `fields`.
// EJ_FIELDS is the ONE place the files' field names are written: a rename in the files is a one-line change there.
//
// RULES: desk_like rows (flexi-desk licences) are left out of every count and never rank in MOST LET. "Contracts signed, not homes
// available" is on every card. Missing data, or data more than 3 days old: NO card, a feed-log line, and no stale number anywhere.
// Any error at all: no card - the morning never breaks because of it (index.js wraps the call as well).

import { BRIEF_DISTRICTS } from "./brief_page.js";

// the app's short names where the register's are long (the bars have one line each)
const SHORT = { jumeirahvillagecircle: "JVC", jumeirahvillagetriangle: "JVT", jltnorth: "JLT", althanyahfifth: "JLT 5", dubaimarina: "Dubai Marina", burjkhalifa: "Downtown", siliconoasis: "Silicon Oasis", dubaisportscity: "Sports City", alyelayiss2: "Town Square", madinatalmataar: "Dubai South", palmjumeirah: "Palm Jumeirah", dubaihills: "Dubai Hills", alkhairanfirst: "Creek Harbour", madinathind4: "DAMAC Hills 2" };

// ---- the adapter: the one place the files' field names are written ---------------------------------------------------
// canonical name -> the field name(s) in the DDA files; the first present wins. The DDA session's final names (1 Oct 2026) first.
export const EJ_FIELDS = {
  date: ["date", "contract_start_date", "registration_date"],
  district: ["district"], area: ["area", "area_name_en"], key: ["key"],
  project: ["dld_project", "project_name_en"],             // = Ejari project_name_en, e.g. THE VOGUE
  projectAr: ["project_name_ar"],                          // the register's Arabic name
  projectNo: ["dld_project_number", "project_number"],     // = Ejari project_number, e.g. 444
  devNo: ["developer_number"], dev: ["developer", "developer_name"],
  beds: ["beds", "beds_band"], sub: ["sub_type", "property_sub_type"], usage: ["usage", "property_usage"],
  reg: ["reg_type"], n: ["contracts"], props: ["props"],
  med: ["rent_median", "median_rent"], q1: ["rent_q1"], q3: ["rent_q3"], desk: ["desk_like"]
};
export const EJ_PROJECT_FIELDS = { en: ["name_en"], ar: ["name_ar"], area: ["area"], district: ["district"], key: ["key"], dev: ["developer"] };
export const EJ_KV = {
  filedDubai: "img_ejari_filed_dubai", startDubai: "img_ejari_daily_dubai",
  filed: (d) => "img_ejari_filed_" + d, start: (d) => "img_ejari_recent_" + d,
  projects: "img_ejari_projects_index", appNames: "img_rent_index", districts: "img_districts_geo"
};
export const EJ_MAX_AGE_DAYS = 3;
export const EJ_TOP = 5;

const present = (v) => v !== undefined && v !== null && !(typeof v === "string" && v.trim() === "");
const pickF = (o, names) => { for (const f of names) if (present(o[f])) return o[f]; return null; };
const num = (v) => { if (!present(v)) return null; const n = Number(v); return isFinite(n) ? n : null; };
const str = (v) => present(v) ? String(v).replace(/\s+/g, " ").trim() : "";

export function ejRow(raw, fields) {
  let o = raw;
  if (Array.isArray(raw)) { o = {}; (fields || []).forEach((f, i) => { o[f] = raw[i]; }); }
  if (!o || typeof o !== "object") return null;
  const g = (c) => pickF(o, EJ_FIELDS[c]);
  const date = str(g("date")).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = g("desk");
  return {
    date, district: str(g("district")).toLowerCase(), area: str(g("area")), key: str(g("key")),
    project: str(g("project")), projectAr: str(g("projectAr")), projectNo: str(g("projectNo")).replace(/\.0+$/, ""),
    dev: str(g("dev")), beds: str(g("beds")).toLowerCase(), sub: str(g("sub")), usage: str(g("usage")),
    reg: /renew/i.test(str(g("reg"))) ? "Renew" : "New",
    n: Math.max(0, num(g("n")) || 0), med: num(g("med")),
    desk: d === true || d === 1 || d === "true" || d === "1"
  };
}
// a whole file: the Dubai-wide shape (per_area) or a plain one (rows). per_developer is the same contracts cut another way, so it
// is never added to the counts.
export function ejDoc(doc, basisIfAbsent) {
  if (!doc || typeof doc !== "object") return null;
  const part = doc.per_area && Array.isArray(doc.per_area.rows) ? doc.per_area : Array.isArray(doc.rows) ? doc : null;
  if (!part) return null;
  const rows = part.rows.map((r) => ejRow(r, part.fields || doc.fields)).filter(Boolean);
  const last = rows.reduce((m, r) => (r.date > m ? r.date : m), "");
  const first = rows.reduce((m, r) => (!m || r.date < m ? r.date : m), "");
  let asOf = str(doc.as_of).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) asOf = last;
  return { asOf, last, first, source: str(doc.source), caveat: str(doc.caveat), basis: str(doc.basis) || basisIfAbsent || "", rows };
}
export function ejProjects(doc) {
  const out = new Map();
  if (!doc || typeof doc !== "object") return out;
  const isMap = (x) => x && typeof x === "object" && !Array.isArray(x);
  const map = isMap(doc.index) ? doc.index : isMap(doc.projects) ? doc.projects : {};
  for (const k of Object.keys(map)) {
    const o = map[k]; if (!isMap(o)) continue;
    const g = (c) => pickF(o, EJ_PROJECT_FIELDS[c]);
    out.set(String(k).trim(), { en: str(g("en")), ar: str(g("ar")), key: str(g("key")), district: str(g("district")).toLowerCase() });
  }
  return out;
}

// ---- words ----------------------------------------------------------------------------------------------------------
// the register's sub-type as a chip: "1bed room+Hall" -> "1 bed + hall"; "Hotel" -> "Hotel apartment"
export function subSay(s) {
  if (!s) return "";
  if (/hotel/i.test(s)) return "Hotel apartment";
  let t = String(s).toLowerCase().replace(/(\d)\s*bed\s*rooms?/g, "$1 bed").replace(/(\d)\s*bed\b/g, "$1 bed").replace(/\s*\+\s*/g, " + ").replace(/\s+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
const is1Bed = (r) => r.beds === "1" || /^1\s*bed/i.test(r.sub);
function bedsSay(r) {
  if (r.beds === "studio" || /studio/i.test(r.sub)) return "studios";
  if (/hotel/i.test(r.sub)) return "hotel apartments";
  if (/villa/i.test(r.sub)) return "villas";
  if (r.beds === "office" || /office/i.test(r.sub)) return "offices";
  const m = (r.beds.match(/^(\d)/) || String(r.sub).match(/^(\d)\s*bed/i)); if (m) return m[1] + "-beds";
  return r.sub ? subSay(r.sub).toLowerCase() + "s" : "";
}
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DAY = 86400000;
const dms = (s) => Date.parse(String(s).slice(0, 10) + "T00:00:00Z");
const dstr = (ms) => new Date(ms).toISOString().slice(0, 10);
const addD = (s, n) => dstr(dms(s) + n * DAY);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dLong = (s) => { const d = new Date(dms(s)); return WD[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()]; };
const dShort = (s) => { const d = new Date(dms(s)); return d.getUTCDate() + " " + MON[d.getUTCMonth()]; };
const span = (a, b) => (a.slice(5, 7) === b.slice(5, 7) ? String(new Date(dms(a)).getUTCDate()) : dShort(a)) + "–" + dShort(b);
const fmt = (n) => Math.round(n || 0).toLocaleString("en-US");
const aedK = (v) => v == null ? "—" : v >= 1e6 ? "AED " + (v / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M" : "AED " + Math.round(v / 1e3) + "k";
export const gstToday = (nowMs) => dstr((nowMs == null ? Date.now() : nowMs) + 4 * 3600000);

// DAY every morning, WEEK on Mondays, MONTH on the 1st (the 1st wins)
export function feedEjariView(today) {
  const d = new Date(dms(today));
  if (d.getUTCDate() === 1) return "month";
  if (d.getUTCDay() === 1) return "week";
  return "day";
}
const VIEW = {
  day: { len: 1, prevLen: 7, avg: true, when: "yesterday", vs: "on the 7-day average", seg: "DAY" },
  week: { len: 7, prevLen: 7, avg: false, when: "this past week", vs: "on the 7 days before", seg: "WEEK" },
  month: { len: 30, prevLen: 30, avg: false, when: "in the last 30 days", vs: "on the 30 days before", seg: "MONTH" }
};

function wmed(pairs) {   // each group's median, weighted by its contracts
  const p = pairs.filter((x) => x[0] != null && x[1] > 0).sort((a, b) => a[0] - b[0]);
  const tot = p.reduce((s, x) => s + x[1], 0); if (!tot) return null;
  let c = 0; for (const x of p) { c += x[1]; if (c >= tot / 2) return x[0]; }
  return p[p.length - 1][0];
}

// ---- the model: everything the card says, from the files, or {skip, why} -----------------------------------------------
// src = { dubai: ejDoc, districts: Map(slug -> ejDoc), projects: Map, appNames: Map, names: {slug: name} }
export function ejariModel(src, view, today) {
  const V = VIEW[view] || VIEW.day;
  const D = src && src.dubai;
  if (!D || !D.rows.length || !D.asOf) return { skip: true, why: "no Ejari data in KV" };
  const age = Math.round((dms(today) - dms(D.asOf)) / DAY);
  if (age > EJ_MAX_AGE_DAYS) return { skip: true, why: "the Ejari data is " + age + " days old (as of " + D.asOf + "), past the " + EJ_MAX_AGE_DAYS + "-day limit" };
  const yest = addD(today, -1);
  // the last day the file holds, never today's half-filed day. Dubai-wide there is no day without a contract, so a missing day is
  // a day not yet in the file, not a zero - the card never reports one as 0.
  const lastDay = D.last && D.last < D.asOf ? D.last : D.asOf;
  let anchor = lastDay < yest ? lastDay : yest;
  // v299 (Kendall, 3-4 Oct 2026: "45 new leases, down 97%"): a day the file holds may still be filling. A day counts as complete only
  // if its contracts are at least half the median of the same weekday over the weeks before it (the register's weekdays run ~2.8-3.4k,
  // Saturdays ~1.2k, Sundays ~0.6k, so a weekday-aware test); a partial day is stepped back over, up to three days, and reported.
  const dayTot = {}; for (const r of D.rows) if (!r.desk) dayTot[r.date] = (dayTot[r.date] || 0) + r.n;
  const isComplete = (d) => {
    const refs = []; for (let k = 1; k <= 4; k++) { const t = dayTot[addD(d, -7 * k)]; if (t) refs.push(t); }
    if (refs.length < 2) return true;                       // nothing to compare with: do not block
    refs.sort((x, y) => x - y); const med = refs.length % 2 ? refs[(refs.length - 1) / 2] : (refs[refs.length / 2 - 1] + refs[refs.length / 2]) / 2;
    return (dayTot[d] || 0) >= 0.5 * med;
  };
  const skippedPartial = [];
  for (let g = 0; g < 3 && !isComplete(anchor); g++) { skippedPartial.push(anchor); anchor = addD(anchor, -1); }
  const to = anchor, from = addD(to, -(V.len - 1));
  const pTo = addD(from, -1), pFrom = addD(pTo, -(V.prevLen - 1));
  const inR = (r, a, b) => r.date >= a && r.date <= b;
  const live = D.rows.filter((r) => !r.desk);
  const sum = (a, b, reg) => live.reduce((s, r) => s + (inR(r, a, b) && r.reg === reg ? r.n : 0), 0);
  const cmpOk = D.first && D.first <= pFrom;   // only compare against a period the file actually holds
  const tile = (reg) => {
    const n = sum(from, to, reg); let pct = null;
    if (cmpOk) { const p = sum(pFrom, pTo, reg), base = V.avg ? p / V.prevLen : p; if (base > 0) pct = Math.round(((n - base) / base) * 100); }
    return { n, pct };
  };
  const nw = tile("New"), rn = tile("Renew");
  const cur = live.filter((r) => inR(r, from, to) && r.reg === "New");
  const oneBed = wmed(cur.filter(is1Bed).map((r) => [r.med, r.n]));
  // WHERE: new leases by district
  const byD = {}, areaOf = {};
  for (const r of cur) {
    const k = r.district || ("area:" + r.area.toLowerCase()); if (!k || k === "area:") continue;
    byD[k] = (byD[k] || 0) + r.n;
    if (r.area) { const m = areaOf[k] || (areaOf[k] = {}); m[r.area] = (m[r.area] || 0) + r.n; }
  }
  const dName = (k) => (src.names && src.names[k]) || (areaOf[k] ? Object.keys(areaOf[k]).sort((a, b) => areaOf[k][b] - areaOf[k][a])[0] : "") || k.replace(/^area:/, "");
  const where = Object.keys(byD).filter((k) => byD[k] > 0).sort((a, b) => byD[b] - byD[a] || a.localeCompare(b)).slice(0, EJ_TOP).map((k) => ({ slug: k, name: dName(k), n: byD[k] }));
  // BY TYPE: the register's own sub-type
  const bySub = {};
  for (const r of cur) if (r.sub) { const s = subSay(r.sub); bySub[s] = (bySub[s] || 0) + r.n; }
  const types = Object.keys(bySub).filter((k) => bySub[k] > 0).sort((a, b) => bySub[b] - bySub[a] || a.localeCompare(b)).slice(0, 7).map((k) => ({ name: k, n: bySub[k] }));
  // MOST LET: buildings by new leases, from the district files (or the Dubai file when it carries projects); flexi-desk never ranks
  const pool = [];
  for (const doc of (src.districts ? src.districts.values() : [])) for (const r of doc.rows) pool.push(r);
  const pRows = (pool.length ? pool : D.rows).filter((r) => !r.desk && r.reg === "New" && inR(r, from, to) && (r.key || r.project || r.projectNo));
  const byP = new Map();
  for (const r of pRows) {
    const k = r.key || (r.projectNo ? "no:" + r.projectNo : "dld:" + r.project.toLowerCase());
    const p = byP.get(k) || { key: r.key, en: "", ar: "", no: "", district: r.district, n: 0, kinds: {} };
    p.en = p.en || r.project; p.ar = p.ar || r.projectAr; p.no = p.no || r.projectNo; p.n += r.n;
    const b = bedsSay(r); if (b) p.kinds[b] = (p.kinds[b] || 0) + r.n;
    byP.set(k, p);
  }
  const most = [...byP.values()].sort((a, b) => b.n - a.n || String(a.en).localeCompare(String(b.en))).slice(0, 3).map((p) => {
    const ix = p.no && src.projects ? src.projects.get(p.no) : null;
    const en = p.en || (ix && ix.en) || "", ar = p.ar || (ix && ix.ar) || "";
    const app = (p.key && src.appNames && src.appNames.get(p.key)) || "";
    const ks = Object.keys(p.kinds).sort((a, b) => p.kinds[b] - p.kinds[a]);
    const mix = !ks.length ? "" : ks.length === 1 ? ks[0] : p.kinds[ks[0]] / p.n >= 0.5 ? "mostly " + ks[0] : ks[0] + ", " + ks[1];
    return { app, en, ar, no: p.no || "", district: dName(p.district || ""), n: p.n, mix };
  });
  return {
    view, skippedPartial, basis: D.basis === "filed" ? "filed" : "start", today, anchor, from, to, asOf: D.asOf, isYesterday: anchor === yest,
    newLeases: nw, renewals: rn, oneBed, where, types, most, cmpOk,
    source: D.source || "Dubai Land Department, Ejari tenancy register", caveat: D.caveat
  };
}

// ---- the card: 1080 x 1350, the approved design (scratchpad ejari_card_mock/card.html), real figures only ------------------
function periodWords(m) {
  if (m.view === "day") return m.isYesterday ? "yesterday" : "on " + dShort(m.anchor);
  if (m.view === "week") return "this past week";
  return "in the last 30 days";
}
function headline(m) {
  const n = '<em>' + esc(fmt(m.newLeases.n)) + '</em>', w = m.newLeases.n === 1 ? "lease" : "leases", p = esc(periodWords(m));
  return m.basis === "filed" ? n + " new " + w + "<br>filed with Ejari " + p : n + " new " + w + "<br>starting " + p + " in Ejari";
}
function delta(t, V) {
  if (t.pct == null) return '<div class="d">no earlier period on file</div>';
  if (t.pct === 0) return '<div class="d">level ' + esc(V.vs.replace(/^on /, "with ")) + '</div>';
  return '<div class="d ' + (t.pct > 0 ? "up" : "dn") + '">' + (t.pct > 0 ? "▲ " : "▼ ") + Math.abs(t.pct) + "% " + esc(V.vs) + "</div>";
}
export function ejariCardHtml(m) {
  const V = VIEW[m.view] || VIEW.day;
  const when = m.view === "day" ? dLong(m.anchor) : span(m.from, m.to);
  const basisSay = m.basis === "filed" ? "tenancy contracts by the day they were filed with Ejari" : "by contract start date";
  const pw = periodWords(m).toUpperCase();
  const max = m.where.length ? m.where[0].n : 1;
  const bars = m.where.map((x) => '<div class="bar"><span>' + esc(x.name) + '</span><div class="t" style="width:' + Math.max(4, Math.round(100 * x.n / max)) + '%"></div><span class="n">' + esc(fmt(x.n)) + "</span></div>").join("");
  const chips = m.types.map((t) => "<span>" + esc(t.name) + " <b>" + esc(fmt(t.n)) + "</b></span>").join("");
  const most = m.most.map((b) => {
    const title = b.app || b.en || ("Project #" + b.no);
    const reg = [b.en ? esc(b.en.toUpperCase()) : "", b.ar ? '<bdi dir="rtl" lang="ar">' + esc(b.ar) + "</bdi>" : "", b.no ? "#" + esc(b.no) : ""].filter(Boolean).join(" · ");
    return '<span>' + esc(title) + (b.district ? ' <span class="m">· ' + esc(b.district) + "</span>" : "") + (reg ? '<br><span class="pr">' + reg + "</span>" : "") + "</span><span>" + esc(fmt(b.n)) + (b.mix ? " · " + esc(b.mix) : "") + "</span>";
  }).join("");
  const segs = ["day", "week", "month"].map((k) => '<span' + (k === m.view ? ' class="on"' : "") + ">" + VIEW[k].seg + "</span>").join("");
  const foot = "<b>Contracts signed, not homes available.</b> Source: " + esc(String(m.source).slice(0, 110)) + ", extract of " + esc(dShort(m.asOf)) + ". " +
    (m.basis === "filed" ? "Counted by the day each contract was filed. " : "Counted by contract start date; a contract can be filed a day or two either side, so the latest days fill in later. ") +
    (m.caveat && m.caveat.length <= 140 ? esc(m.caveat.replace(/\.?\s*$/, ".")) + " " : "") + "Flexi-desk licences left out.";
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Arabic:wght@400;500&family=IBM+Plex+Mono:wght@500&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap" rel="stylesheet">
<style>
:root{--bg:#0C1413;--card:#121D1B;--line:#22302D;--ink:#EDE8DE;--mut:#93A39E;--gold:#C5A56A;--teal:#2C8C80;--teal2:#1C5E56}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1350px;overflow:hidden;background:var(--bg)}
body{color:var(--ink);font-family:'IBM Plex Sans','IBM Plex Sans Arabic',sans-serif;padding:44px 64px 28px;display:flex;flex-direction:column;gap:14px}
.kick{font:500 22px 'IBM Plex Mono',monospace;letter-spacing:.18em;color:var(--gold)}
h1{font:400 54px/1.04 'Newsreader',serif;margin-top:4px}
h1 em{color:var(--gold);font-style:normal}
.sub{font-size:22px;color:var(--mut);margin-top:8px}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:18px 24px}
.tile .l{font:500 17px 'IBM Plex Mono',monospace;letter-spacing:.12em;color:var(--mut)}
.tile .v{font:400 52px/1.08 'Newsreader',serif;margin-top:4px}
.tile .d{font-size:19px;margin-top:4px}
.up{color:#7FC8A9}.dn{color:#E08A7A}
.panel{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:18px 30px}
.ph{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.ph b{font:500 19px 'IBM Plex Mono',monospace;letter-spacing:.14em;color:var(--gold)}
.ph span{font-size:18px;color:var(--mut)}
.bar{display:grid;grid-template-columns:270px 1fr 90px;align-items:center;gap:16px;margin:5px 0;font-size:22px}
.bar .t{height:22px;border-radius:7px;background:linear-gradient(90deg,var(--teal2),var(--teal))}
.bar .n{text-align:right;font-weight:600}
.bld{display:grid;grid-template-columns:1fr auto;gap:6px 18px;font-size:21px}
.bld .m{color:var(--mut);font-size:18px}
.foot{margin-top:auto;font-size:15px;color:var(--mut);line-height:1.4;border-top:1px solid var(--line);padding-top:12px}
.foot b{color:var(--ink);font-weight:500}
.seg{display:flex;gap:6px;background:#0E1817;border:1px solid var(--line);border-radius:16px;padding:5px;width:fit-content}
.seg span{font:600 19px 'IBM Plex Mono',monospace;letter-spacing:.1em;padding:7px 24px;border-radius:11px;color:var(--mut)}
.seg span.on{background:var(--gold);color:#1A1407}
.subt{display:flex;gap:9px;flex-wrap:wrap}
.subt span{border:1px solid var(--line);border-radius:999px;padding:5px 13px;font-size:18px;background:#0E1817}
.subt b{color:var(--gold)}
.seg.sm{padding:4px;border-radius:12px;gap:4px}.seg.sm span{font-size:15px;padding:6px 12px;border-radius:8px}
.pr{font:500 15px 'IBM Plex Mono','IBM Plex Sans Arabic',monospace;letter-spacing:.06em;color:var(--mut)}
.pr bdi{font-family:'IBM Plex Sans Arabic',sans-serif;letter-spacing:0;font-size:16px}
</style></head><body>
<div>
  <div class="kick">EJARI · WHAT MOVED</div>
  <h1>${headline(m)}</h1>
  <div class="sub">${esc(when)} · ${esc(basisSay)}</div>
</div>
<div class="seg">${segs}</div>
<div class="tiles">
  <div class="tile"><div class="l">NEW LEASES</div><div class="v">${esc(fmt(m.newLeases.n))}</div>${delta(m.newLeases, V)}</div>
  <div class="tile"><div class="l">RENEWALS</div><div class="v">${esc(fmt(m.renewals.n))}</div>${delta(m.renewals, V)}</div>
  <div class="tile"><div class="l">1-BED MEDIAN</div><div class="v">${esc(aedK(m.oneBed))}</div><div class="d">${m.oneBed == null ? "no 1-bed rent in the extract" : "new leases, a year"}</div></div>
</div>
${m.where.length ? `<div class="panel">
  <div class="ph"><b>WHERE · NEW LEASES ${esc(pw)}</b><span class="seg sm"><span class="on">TOP 5</span><span>10</span><span>15</span><span>20</span></span></div>
  ${bars}
</div>` : ""}
${m.types.length ? `<div class="panel">
  <div class="ph"><b>BY TYPE · EJARI SUB-TYPE</b><span>new leases ${esc(periodWords(m))}</span></div>
  <div class="subt">${chips}</div>
</div>` : ""}
${m.most.length ? `<div class="panel">
  <div class="ph"><b>MOST LET ${esc(pw)}</b><span>register name · Arabic · project no.</span></div>
  <div class="bld">${most}</div>
</div>` : ""}
<div class="foot">${foot}</div>
</body></html>`;
}

// ---- the caption: Black Coffee ... curated by Papi; the link carries the CLIENT key or nothing ------------------------------
export function ejariCaption(m, origin, linkKey) {
  const V = VIEW[m.view] || VIEW.day;
  const t = m.newLeases, top = m.where[0];
  const move = t.pct == null ? "" : t.pct === 0 ? ", level " + V.vs.replace(/^on /, "with ") : ", " + (t.pct > 0 ? "up " : "down ") + Math.abs(t.pct) + "% " + V.vs;
  const lead = "Black Coffee, here is what moved in Ejari " + periodWords(m) + ": " + fmt(t.n) + " new lease" + (t.n === 1 ? "" : "s") +
    (m.basis === "filed" ? " filed" : " by contract start date") + move + "." + (top ? " Busiest: " + top.name + " (" + fmt(top.n) + ")." : "") + " Contracts signed, not homes available.";
  const link = linkKey ? "\n\nDay, week, month and the top 10 / 15 / 20: " + String(origin || "").replace(/\/+$/, "") + "/contracts?view=" + m.view + "&top=" + EJ_TOP + "&key=" + encodeURIComponent(linkKey) : "";
  return lead + link + "\n\n— curated by Papi";
}

// ---- loading ---------------------------------------------------------------------------------------------------------
async function kvJsonAny(env, k) {   // v283.1 - plain or gzipped (1f 8b) JSON; push_ejari gzips values over 1 MB
  if (!env || !env.MEETINGS) return null;
  let v = null; try { v = await env.MEETINGS.get(k, "arrayBuffer"); } catch (e) { return null; }
  if (v == null) return null;
  try {
    if (typeof v === "string") return JSON.parse(v);
    let u8 = new Uint8Array(v);
    if (u8.length > 2 && u8[0] === 0x1f && u8[1] === 0x8b) u8 = new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
    return JSON.parse(new TextDecoder().decode(u8));
  } catch (e) { return null; }
}
async function readJson(env, k) { return kvJsonAny(env, k); }
export async function ejariLoad(env, names0) {
  let basis = "filed", dubai = ejDoc(await readJson(env, EJ_KV.filedDubai), "filed");
  if (!dubai || !dubai.rows.length) { basis = "start"; dubai = ejDoc(await readJson(env, EJ_KV.startDubai), "start"); }
  if (!dubai) return { dubai: null };
  dubai.basis = basis;   // the key it came from decides the label, whatever the file says
  const names = {};
  for (const r of BRIEF_DISTRICTS) names[r[0]] = r[1];
  const geo = await readJson(env, EJ_KV.districts);
  if (geo && Array.isArray(geo.districts)) for (const x of geo.districts) if (x && x.slug && x.name) names[x.slug] = x.name;
  Object.assign(names, SHORT, names0 || {});
  // the district files of every district with new leases in the last 60 days (capped), on the SAME basis - never mixed
  const since = addD(dubai.asOf || dubai.last, -60), tally = {};
  for (const r of dubai.rows) if (r.district && !r.desk && r.reg === "New" && r.date >= since) tally[r.district] = (tally[r.district] || 0) + r.n;
  const slugs = Object.keys(tally).filter((s) => /^[a-z0-9]{2,40}$/.test(s)).sort((a, b) => tally[b] - tally[a]).slice(0, 40);
  const districts = new Map();
  await Promise.all(slugs.map(async (s) => { const d = ejDoc(await readJson(env, basis === "filed" ? EJ_KV.filed(s) : EJ_KV.start(s)), basis); if (d && d.rows.length) districts.set(s, d); }));
  const projects = ejProjects(await readJson(env, EJ_KV.projects));
  const appNames = new Map(); const ri = await readJson(env, EJ_KV.appNames);
  for (const it of (ri && ri.items) || []) { if (!it || !it.d || !it.n) continue; for (const id of [it.i].concat(Array.isArray(it.is) ? it.is : [])) if (id != null && !appNames.has(it.d + ":" + id)) appNames.set(it.d + ":" + id, String(it.n)); }
  return { dubai, districts, projects, appNames, names };
}

// ---- the step: called by the morning chain. Returns a one-line feed-log string; never throws. --------------------------
// deps: { nowMs, dry, origin, linkKey, names, render(html, W, H) -> ArrayBuffer|null, store(key, png) -> url, send(url, caption) -> {ok} }
export const ejCardKey = (today, view) => "ejcard_" + today.replace(/-/g, "") + "_" + view;
export async function feedEjariCard(env, deps) {
  deps = deps || {};
  const today = gstToday(deps.nowMs), view = deps.view || feedEjariView(today);
  const log = async (rec) => { try { await env.MEETINGS.put("mkt_feed_ejari", JSON.stringify(Object.assign({ at: new Date(deps.nowMs == null ? Date.now() : deps.nowMs).toISOString(), today, view }, rec)), { expirationTtl: 14 * 86400 }); } catch (e) {} };
  try {
    const sentK = "ejari_card_sent_" + today;
    if (!deps.dry && (await env.MEETINGS.get(sentK))) return "Ejari card: already sent today";
    const src = await ejariLoad(env, deps.names);
    const m = ejariModel(src, view, today);
    if (m.skip) { await log({ ok: false, skipped: m.why }); return "Ejari card SKIPPED: " + m.why; }
    const html = ejariCardHtml(m), caption = ejariCaption(m, deps.origin, deps.linkKey);
    const what = view.toUpperCase() + " top " + EJ_TOP + ", " + fmt(m.newLeases.n) + " new leases " + periodWords(m) + (m.basis === "filed" ? " (by filing date)" : " (by contract start date - no filed file)");
    if (deps.dry) return "Ejari card (dry run, not rendered or sent): " + what;
    const png = deps.render ? await deps.render(html, 1080, 1350) : null;
    if (!png || !png.byteLength || png.byteLength < 5000) { await log({ ok: false, skipped: "render failed", what }); return "Ejari card SKIPPED: the render failed"; }
    const url = await deps.store(ejCardKey(today, view), png);
    const r = await deps.send(url, caption);
    if (!(r && r.ok)) { await log({ ok: false, skipped: "WhatsApp refused the image", status: r && r.status, what }); return "Ejari card NOT delivered: WhatsApp refused it"; }
    try { await env.MEETINGS.put(sentK, "1", { expirationTtl: 2 * 86400 }); } catch (e) {}
    await log({ ok: true, sent: what, url, basis: m.basis });
    return "Ejari card sent: " + what;
  } catch (e) {
    const why = String((e && e.message) || e).slice(0, 120);
    await log({ ok: false, skipped: "error: " + why });
    return "Ejari card SKIPPED (error: " + why + ")";
  }
}
