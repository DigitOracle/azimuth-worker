// v697 (Kendall, 3 Nov 2026): the Building Passports card on Momo (Najjuko's front door and Kendall's), modelled on src/work_presentations.js.
// A Building Passport is a 3-page A4 client brief for ONE building, written by ChatGPT from register figures only, made in the worker:
//   request (card form) -> bpp_req_<id> {text, note, at, by, status, plot_id?, slug?, msg?} + id appended to bpp_requests
//   minute tick (bppTick): resolve -> read the plot passport (pp_b_<crc32 % buckets>) + the data pack (pp_pack_<plot without naj:plot:>)
//   -> build the prompt (approved wording, numbers only from the data) -> OpenAI Responses API in BACKGROUND mode (no request waits on it)
//   -> poll each minute -> inline the logo (KV bpp_logo_png, base64) -> PDF through Browser Rendering -> exactly 3 pages or ONE re-ask
//   -> bpp_file_<slug>_html, bpp_file_<slug>_pdf, merge bpp_index BY SLUG (re-read just before the write).
// Public, no key (what she sends): /bp/<slug> the HTML page, /bp/f/<slug>.pdf the PDF. Same pattern as /pres/.
// Risks and opportunities are computed HERE by simple rules from the figures (bppFacts), never left to the model to invent.
import puppeteer from "@cloudflare/puppeteer";
import { ppGet, ppSearch } from "./plot_passport.js";
import { bppFinance, BPP_READERS, readerFor } from "./passport_finance.js";   // v727 - the financial engine on page 2, by reader (investor / broker / developer)

const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const SLUG_RE = /^[a-z0-9-]{1,80}$/;
const PP_ID = /^naj:plot:[A-Za-z0-9\-]{1,40}$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MODEL = "gpt-5.5";
const OAI = "https://api.openai.com/v1/responses";

export const BPP_ICON = '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4"/><path d="M8.5 18v-6l3-2 3 2v6"/><path d="M11.5 18v-2.5"/>';
export const BPP_PEOPLE = ["najjuko", "kendall"];

// v703 (Kendall, 3 Nov 2026: "go hierarchy"): Building Passports picker goes zone -> district -> building.
// OUR grouping of plot-passport district slugs (pp_dl) under the five Dubai 2040 urban centres, taken from the app's centres file
// (azimuth-worker-dewa data/centres2040/centres2040.json: comms[].c via sl / name match), plus the Najma coastal layer (comms[].sea).
// The plan names centres, not boundaries. Edit the lists here; any district not listed under 1-5 shows under "Other areas", never dropped.
export const BPP_ZONES = [
  { id: "c1", name: "Deira and Bur Dubai", d: ["abuhail", "albaraha", "albuteen", "aldhagaya", "algarhoud", "alhamriya", "alhamriyaport", "alhudaiba", "samaaljadaf", "aljafliya", "alkarama", "alkhabeesi", "alkhairanfirst", "alkheeran", "almamzer", "almararr", "almurqabat", "almuteena", "alnahdafirst", "alnahdasecond", "alqusais", "alraffa", "alras", "alrashidiya", "alrega", "alsabkha", "alsuqalkabeer", "altwarfirst", "altwarsecond", "alwaheda", "alcornich", "burdubai", "cornichdeira", "dubaiinternationalairport", "eyalnasser", "horalanz", "horalanzeast", "dubaimaritimecity", "mankhool", "nadshamma", "naif", "oudmetha", "palmdeira", "portsaeed", "regaalbuteen", "umhurairfirst", "umhurairsecond", "umramool"] },
  { id: "c2", name: "Downtown and Business Bay", d: ["albada", "algozefirst", "algozefourth", "algozeindustrialfirst", "algozeindustrialsecond", "algozethird", "alkifaf", "alqoaz", "alsaffafirst", "alsaffasecond", "alsatwa", "alwasl", "bukadra", "burjkhalifa", "businessbay", "ghadeeraltair", "dubaihills", "island2", "jumeirahfirst", "jumeirahsecond", "jumeirahthird", "nadalshiba", "meydanone", "rasalkhorindustrialfirst", "tradecenterfirst", "tradecentersecond", "umsuqaim", "umsuqaimfirst", "zaabeelfirst", "zaabeelsecond"] },
  { id: "c3", name: "Dubai Marina and JBR", d: ["albarsha", "albarshafirst", "jumeirahvillagetriangle", "jumeirahvillagecircle", "albarshathird", "dubaisportscity", "alsafouhfirst", "alsafouhsecond", "althanyahfifth", "althanyahfirst", "althanyahsecond", "jabalalifirst", "dubaimarina", "dubaiproductioncity", "palmjumeirah"] },
  { id: "c4", name: "Expo 2020 Centre", d: ["allayan1", "alyelayiss5", "dubaiinvestmentparkfirst", "dubaiinvestmentparksecond", "jabalaliindustrialfirst", "jabalaliindustrialsecond", "jabalaliindustrialthird", "madinatalmataar", "meaisemsecond", "mugatrah", "saihshuaib1", "dubaiindustrialcity", "saihshuaib3", "saihshuaib4"] },
  { id: "c5", name: "Dubai Silicon Oasis Centre", d: ["alrowaiyahfirst", "alrowaiyahsecond", "alrowaiyahthird", "alwarqafirst", "alwarsanfirst", "alwarsansecond", "alwarsanthird", "madinathind1", "nadalhamar", "nadalshibafourth", "nadalshibasecond", "nadalshibathird", "siliconoasis", "rasalkhorindustrialsecond", "rasalkhorindustrialthird", "liwan1", "majan", "wadialsafa5", "warsanfourth"] },
  { id: "coast", name: "Coastal (Najma layer, ours)", d: ["alhamriyaport", "almamzer", "alraffa", "alsafouhfirst", "alsafouhsecond", "alsuqalkabeer", "burdubai", "hessyanfirst", "hessyansecond", "island2", "jumeirahfirst", "jumeirahsecond", "jumeirahthird", "dubaimaritimecity", "dubaimarina", "palmdeira", "palmjabalali", "palmjumeirah", "umsuqaim", "umsuqaimfirst", "umsuqaimsecond", "umsuqaimthird", "worldislands"] },
];

export const bppDate = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || "")); return m ? parseInt(m[3], 10) + " " + MONTHS[parseInt(m[2], 10) - 1] + " " + m[1] : ""; };
const aed = (n) => "AED " + Math.round(Number(n) || 0).toLocaleString("en-US");
const int = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");
const BEDS = (b) => (String(b) === "0" ? "studio" : b + " bed");
const median = (xs) => { const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const todayGst = (ms) => new Date((ms || Date.now()) + 4 * 3600e3).toISOString().slice(0, 10);

async function readJson(env, k) { try { const v = await env.MEETINGS.get(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

// ------------------------------------------------------------------------------------------------ the index
export function cleanEntry(x) {
  if (!x || !SLUG_RE.test(String(x.slug || "")) || !String(x.title || "").trim()) return null;
  const e = { slug: String(x.slug), title: String(x.title).replace(/\s+/g, " ").trim().slice(0, 120) };
  if (x.area) e.area = String(x.area).slice(0, 80);
  if (PP_ID.test(String(x.plot_id || ""))) e.plot_id = String(x.plot_id);
  if (/^\d{3,9}$/.test(String(x.parcel || ""))) e.parcel = String(x.parcel);
  if (/^\d{4}-\d{2}-\d{2}/.test(String(x.date || ""))) e.date = String(x.date).slice(0, 10);
  if (x.html) e.html = true;
  if (x.pdf) e.pdf = true;
  if (BPP_READERS[x.reader]) e.reader = x.reader;   // v728 - keep the reader (it was being dropped, so the tile lost "For an investor")
  if (/^[a-z]{1,20}$/.test(String(x.fin || ""))) e.fin = String(x.fin);
  if (x.csv) e.csv = true;
  return e;
}
// v728 (Kendall, 4 Nov 2026: "we do not need to store previous passports") - ONE passport per plot per reader.
// The identity is plot_id + reader (broker when unset); an entry without a plot_id is its own identity (its slug).
export const bppKeyOf = (e) => (e && e.plot_id ? e.plot_id + "|" + (BPP_READERS[e.reader] ? e.reader : "broker") : "slug|" + (e && e.slug));
// every KV key that belongs to one stored passport (its files and its hero picture)
export const bppSlugKeys = (slug) => ["bpp_file_" + slug + "_html", "bpp_file_" + slug + "_pdf", "bpp_file_" + slug + "_csv", "bpp_photo_" + slug, "bpp_img_" + slug];
// newest per identity (date, then later in the list wins a tie); returns { keep, drop } of index entries
export function bppNewest(items) {
  const best = new Map();
  (items || []).forEach((e, i) => { const k = bppKeyOf(e), b = best.get(k); if (!b || String(e.date || "") >= String(b.e.date || "")) best.set(k, { e, i }); });
  const keepIdx = new Set([...best.values()].map((x) => x.i));
  return { keep: (items || []).filter((_, i) => keepIdx.has(i)), drop: (items || []).filter((_, i) => !keepIdx.has(i)) };
}
export async function readBppIndex(env) {
  const r = await readJson(env, "bpp_index");
  return Array.isArray(r) ? bppNewest(r.map(cleanEntry).filter(Boolean)).keep : [];   // v728 - the list shows only the current passports
}
export const bppSorted = (items) => items.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
export function mergeEntry(cur, entry) { return mergeEntryPlan(cur, entry).next; }
// v728 - the new entry replaces any entry with the same slug AND any older passport for the same plot + reader.
// superseded = the slugs whose files must now be deleted (never the new slug: its files were just written).
export function mergeEntryPlan(cur, entry) {
  const e = cleanEntry(entry); if (!e) return { next: cur, superseded: [] };
  const k = bppKeyOf(e);
  const old = cur.find((x) => x.slug === e.slug);
  const gone = cur.filter((x) => x.slug !== e.slug && bppKeyOf(x) === k);
  return { next: cur.filter((x) => x.slug !== e.slug && bppKeyOf(x) !== k).concat(Object.assign({}, old || {}, e)), superseded: [...new Set(gone.map((x) => x.slug))] };
}
export async function putBppEntry(env, entry) {
  const r = await readJson(env, "bpp_index");   // re-read NOW, never a stale copy (raw, so stored duplicates are seen and removed)
  const { next, superseded } = mergeEntryPlan(Array.isArray(r) ? r.map(cleanEntry).filter(Boolean) : [], entry);
  await env.MEETINGS.put("bpp_index", JSON.stringify(next));
  for (const slug of superseded) for (const key of bppSlugKeys(slug)) await env.MEETINGS.delete(key);
  return next;
}
// v728 - after a passport is made, the older job records for the same plot + reader go (finished ones only; never one still running)
export async function dropOldJobs(env, keepId, plotId, reader) {
  const ids = await readReqIds(env), drop = [];
  for (const id of ids) {
    if (id === keepId) continue;
    const q = await readReq(env, id);
    if (q && q.plot_id === plotId && (q.reader_used || readerFor(q.reader)) === reader && ["done", "failed"].includes(q.status)) drop.push(id);
  }
  for (const id of drop) await env.MEETINGS.delete("bpp_req_" + id);
  if (drop.length) { const cur = await readReqIds(env); await env.MEETINGS.put("bpp_requests", JSON.stringify(cur.filter((x) => !drop.includes(x)))); }
  return drop;
}

// v728 - ONE-OFF cleanup of passports stored before the rule. Pure plan: from the raw index, the request records and the
// bpp_file_ key names, which KV keys go. Keeps the newest per plot + reader; also drops files whose slug is no longer in the index
// and finished jobs superseded by a newer finished job for the same plot + reader. Never touches the logo, photo-test token or counters.
export function bppCleanupPlan(rawIndex, reqs, fileKeys) {
  const items = (Array.isArray(rawIndex) ? rawIndex : []).map(cleanEntry).filter(Boolean);
  const { keep, drop } = bppNewest(items);
  const keepSlugs = new Set(keep.map((e) => e.slug));
  const keys = new Set();
  drop.forEach((e) => { if (!keepSlugs.has(e.slug)) bppSlugKeys(e.slug).forEach((k) => keys.add(k)); });
  (fileKeys || []).forEach((k) => { const m = /^bpp_file_([a-z0-9-]{1,80})_(html|pdf|csv)$/.exec(k); if (m && !keepSlugs.has(m[1])) keys.add(k); });
  const latest = new Map(), jobs = [];
  (reqs || []).filter((q) => q && q.id && q.plot_id && ["done", "failed"].includes(q.status)).forEach((q) => {
    const k = q.plot_id + "|" + (q.reader_used || readerFor(q.reader)), b = latest.get(k);
    if (!b) { latest.set(k, q); return; }
    const newer = String(q.at || "") > String(b.at || "") ? q : b, older = newer === q ? b : q;
    latest.set(k, newer); jobs.push(older.id);
  });
  jobs.forEach((id) => keys.add("bpp_req_" + id));
  return { index: keep, keys: [...keys].sort(), jobs, kept: keep.length, dropped_entries: drop.length };
}
async function kvKeys(env, prefix) {
  const out = []; let cursor;
  do { const r = await env.MEETINGS.list({ prefix, cursor }); (r.keys || []).forEach((k) => out.push(k.name)); cursor = r.list_complete ? null : r.cursor; } while (cursor);
  return out;
}
// guarded admin action: Kendall only, dry run unless confirm === BPP_CLEANUP_CONFIRM
export const BPP_CLEANUP_CONFIRM = "delete-older-passports";
export async function bppCleanup(env, confirm) {
  const raw = await readJson(env, "bpp_index");
  const ids = await readReqIds(env);
  const reqs = (await Promise.all(ids.map((id) => readReq(env, id)))).filter(Boolean);
  const plan = bppCleanupPlan(raw, reqs, await kvKeys(env, "bpp_file_"));
  if (confirm !== BPP_CLEANUP_CONFIRM) return { ok: true, dry_run: true, would_delete: plan.keys.length, keys: plan.keys, kept: plan.kept, dropped_entries: plan.dropped_entries };
  await env.MEETINGS.put("bpp_index", JSON.stringify(plan.index));
  for (const k of plan.keys) await env.MEETINGS.delete(k);
  if (plan.jobs.length) { const cur = await readReqIds(env); await env.MEETINGS.put("bpp_requests", JSON.stringify(cur.filter((x) => !plan.jobs.includes(x)))); }
  return { ok: true, dry_run: false, deleted: plan.keys.length, kept: plan.kept };
}

// ------------------------------------------------------------------------------------------------ public pages
export async function bppPublic(request, env, url) {
  const p = url.pathname;
  let m = p.match(/^\/bp\/f\/([a-z0-9-]{1,80})\.pdf$/);
  if (m) {
    const b = await env.MEETINGS.get("bpp_file_" + m[1] + "_pdf", "arrayBuffer");
    return b ? new Response(b, { headers: { "Content-Type": "application/pdf", "Cache-Control": "public, max-age=3600", "Content-Disposition": 'inline; filename="' + m[1] + '.pdf"' } }) : new Response("not found", { status: 404 });
  }
  m = p.match(/^\/bp\/f\/([a-z0-9-]{1,80})\.csv$/);   // v727 - the downloadable schedule behind the investor / developer figures (CSV; opens in Excel)
  if (m) {
    const c = await env.MEETINGS.get("bpp_file_" + m[1] + "_csv");
    return c ? new Response(c, { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "public, max-age=600", "Content-Disposition": 'attachment; filename="' + m[1] + '_schedule.csv"' } }) : new Response("not found", { status: 404 });
  }
  m = p.match(/^\/bp\/img\/([a-z0-9-]{1,80})$/);   // v702 - the hero picture: Google's, fetched live each time (never stored), or the stored illustration
  if (m) {
    const im = await bppImage(env, m[1]).catch(() => null);
    return im ? new Response(im.body, { headers: { "Content-Type": im.type, "Cache-Control": im.google ? "no-store" : "public, max-age=86400" } }) : new Response("not found", { status: 404 });
  }
  if (p === "/bp/photo_test") return photoTest(env, url);
  m = p.match(/^\/bp\/([a-z0-9-]{1,80})\/?$/);
  if (m) {
    const h = await env.MEETINGS.get("bpp_file_" + m[1] + "_html");
    return h ? new Response(h, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600" } }) : new Response("not found", { status: 404 });
  }
  return null;
}

// v702 test bench: the hero photo for one building WITHOUT a passport job (no ChatGPT, no request, no message to anyone).
// Closed unless KV bpp_photo_test_token is set (set it, test, delete it). Writes only bpp_photo_t-<slug> / bpp_img_t-<slug>.
async function photoTest(env, url) {
  const tok = await env.MEETINGS.get("bpp_photo_test_token");
  if (!tok || url.searchParams.get("t") !== tok) return new Response("not found", { status: 404 });
  const res = await bppResolve(env, url.searchParams.get("q") || "");
  const pp = res.id ? await ppGet(env, res.id) : null;
  if (!pp) return J({ ok: false, error: res.err || "not found" }, 404);
  const f = bppFacts(pp, await readJson(env, "pp_pack_" + res.id.replace("naj:plot:", "")), todayGst());
  const slug = "t-" + bppSlug(f.name, f.parcel).slice(0, 70);
  const ph = url.searchParams.get("again") ? await bppPhoto(env, slug, f, pp) : (await readJson(env, "bpp_photo_" + slug)) || await bppPhoto(env, slug, f, pp);
  const box = '<div class="bpp-photo" style="width:78mm;height:58mm"></div>';
  return new Response("<!doctype html><meta charset=utf-8><meta name=viewport content=\"width=device-width\"><body style=\"background:#F6F2E9;font-family:Inter,sans-serif;padding:16px\"><h1>" + esc(f.name) + "</h1><p>" + esc(f.area) + " · photo: " + esc(ph.kind) + (ph.why ? " (" + esc(ph.why) + ")" : "") + "</p>"
    + placePhoto(box, heroFigure(ph, "/bp/img/" + slug)) + "</body>", { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

// ------------------------------------------------------------------------------------------------ v725 Release 1 helpers (Kendall, 4 Nov 2026)
// Audit: Operations/Research/Building_Passport_Coverage_Audit_04NOV2026.md section 10. The pack fields come from
// naj-market-pulse/scripts/plot_passport_market.py r1_extras (bldgs, refs, google, access, adverts_hist, asof).
export const STALE_DAYS = 45;
const FRESH_NAME = { g_dld__projects: "projects register (Dubai Land Department)", g_dld__units: "units register (Dubai Land Department)", g_dld__buildings: "buildings register (Dubai Land Department)" };
// " (source, as of 15 Jun 2026; NOTE: this register is 141 days old, so later changes may not show)"; nothing when no date is known
export function asOf(pack, table, fallbackDate, today) {
  const a = (pack && pack.asof && pack.asof[table]) || {};
  const d = a.date || (fallbackDate ? String(fallbackDate).slice(0, 10) : "");
  if (!d) return "";
  let days = a.days;
  if (days == null && today) days = Math.round((Date.parse(today) - Date.parse(d)) / 864e5);
  return " (" + (a.src || FRESH_NAME[table] || "register") + ", as of " + bppDate(d)
    + (days != null && days > STALE_DAYS ? "; NOTE: this register is " + days + " days old, so later changes may not show" : "") + ")";
}
export function bldgText(b) {
  const nm = (b.name ? b.name + " " : "") + "(building no. " + (b.no || "not recorded") + ")";
  const bits = [b.floors ? b.floors + " floors" : "floors not recorded"];
  if (b.flats) bits.push(int(b.flats) + " flats");
  if (b.offices) bits.push(int(b.offices) + " offices");
  if (b.shops) bits.push(int(b.shops) + " shops");
  bits.push(b.car_parks ? int(b.car_parks) + " car parks" : "car parks not recorded");
  bits.push(b.lifts ? b.lifts + " lifts" : "lifts not recorded");
  if (b.pools) bits.push(b.pools + " pool" + (b.pools > 1 ? "s" : ""));
  if (b.bua_sqm) bits.push("built-up area " + int(b.bua_sqm) + " m2");
  if (b.units) bits.push(int(b.units) + " registered units" + (b.mix && b.mix.length ? " (" + b.mix.slice(0, 5).map((u) => (u.rooms || u.type || "other") + " " + u.n).join(", ") + ")" : ""));
  return nm + ": " + bits.join(", ");
}
const DEST = { dubai_mall: "Dubai Mall", difc: "DIFC (Dubai International Financial Centre)", dxb: "Dubai International Airport", marina: "Dubai Marina", expo: "Expo City" };
export function accessLine(a) {
  if (!a) return "";
  if (a.kind === "straight") return "Access (calculated, straight-line distance on the map, not a drive time): nearest metro station " + a.metro + (a.line ? " (" + a.line + ")" : "") + " about " + a.metro_km + " km away.";
  const m = Object.keys(a.mins || {}).map((k) => (DEST[k] || k) + " " + Math.round(a.mins[k]) + " min");
  return "Access (calculated drive times by road" + (a.solved_on ? ", worked out " + bppDate(a.solved_on) : "") + "): nearest metro " + (a.metro || "not recorded") + (a.metro_min != null ? " " + Math.round(a.metro_min) + " min drive" : "")
    + (a.tram ? "; nearest tram " + a.tram + (a.tram_min != null ? " " + Math.round(a.tram_min) + " min" : "") : "") + (m.length ? "; " + m.join(", ") : "") + ".";
}
// one Google place per building: a place shared by several building records is shown once; sales-office places are kept OUT of resident experience
export function googleLines(g) {
  const out = [];
  const places = ((g && g.places) || []).filter((p, i, a) => p && p.place_id && a.findIndex((q) => q.place_id === p.place_id) === i);
  if (!places.length) return out;
  const res = places.filter((p) => !p.sales_office), so = places.filter((p) => p.sales_office);
  for (const p of res) {
    out.push("Google box ('Live from Google' chip, building experience): Google Maps place \"" + (p.name || "") + "\""
      + (p.rating != null ? ", rating " + p.rating + " out of 5 from " + int(p.count || 0) + " reviews" : ", no rating yet")
      + ", retrieved " + bppDate(p.as_of) + ", place id " + p.place_id + (p.uri ? ", link " + p.uri : "")
      + (p.praise && p.praise.length ? ". Themes reviewers praise: " + p.praise.join(", ") : "") + (p.complaint && p.complaint.length ? ". Themes reviewers complain about: " + p.complaint.join(", ") : "")
      + ". We hold at most 5 review texts per place (" + (p.held || 0) + " here), so this is NOT every review; never quote names.");
  }
  for (const p of so) out.push("Google note (not resident experience): the Google place \"" + (p.name || "") + "\" (place id " + p.place_id + ", retrieved " + bppDate(p.as_of) + ") is left out of the building experience because " + p.sales_office + ". Show it only as this note, with no stars.");
  return out;
}

// ------------------------------------------------------------------------------------------------ the facts (register figures only)
// Everything the model may print, as plain lines, plus the computed risks and opportunities. Missing = said so, never guessed.
export function bppFacts(pp, pack, today) {
  pack = pack || {};
  const L = [], risks = [], opps = [], missing = [];
  const pj = pack.project || {};
  const name = pp.project || (pp.buildings || []).map((b) => b.name).find(Boolean) || ("Plot " + (pp.parcel || pp.plot_no || pp.id));
  L.push("Building: " + name + ", " + (pp.area_name || "Dubai") + ", Dubai. Plot " + (pp.plot_no || "not recorded") + ", parcel " + (pp.parcel || "not recorded")
    + (pj.number ? ", DLD project " + pj.number : "") + ". Master project " + (pp.master || "not recorded") + ". " + (pp.freehold === true ? "Freehold." : pp.freehold === false ? "Not freehold." : "Tenure not recorded.")
    + (pp.sqm ? " Plot " + int(pp.sqm) + " m2 (" + int(pp.sqm * 10.7639) + " sq ft)." : " Plot area not recorded.")
    + " Land type " + (pp.land_type || "not recorded") + (pp.sub_type ? ", " + pp.sub_type : "") + ".");
  if (pj.number) {
    L.push("Developer: brand " + (pj.brand || "not recorded") + "; registered developer " + (pj.developer_en || pj.developer_ar || "not recorded") + (pj.developer_no ? " (DLD developer " + Math.round(pj.developer_no) + ")" : "")
      + ". Escrow bank " + (pj.escrow_en || pj.escrow_ar || "not recorded") + ". Planning authority " + (pj.authority || "not recorded") + ".");
    L.push("Project register" + asOf(pack, "g_dld__projects", pj.as_of, today) + ": status " + (pj.status || "not recorded") + ", " + (pj.pct != null ? pj.pct + "% complete" : "progress not recorded")
      + ", start " + (bppDate(pj.start) || "not recorded") + ", planned completion " + (bppDate(pj.end_planned) || "not recorded") + ", " + (pj.buildings != null ? pj.buildings + " buildings" : "") + ", " + (pj.units != null ? pj.units + " units" : "") + ".");
    if (pj.description) L.push("Project description in the register (use it for the physical building section): " + pj.description);
  } else missing.push("project register record");
  const bl = pp.buildings || [];
  const bd = pack.bldgs || [];
  if (bd.length) {   // v725 R1 item 1: one line per BUILDING (DLD parent property id), never project totals on one record
    L.push("Buildings register" + asOf(pack, "g_dld__buildings") + ": " + bd.length + " building" + (bd.length > 1 ? "s" : "") + " on this plot, each with its own figures (never add them up as one building): "
      + bd.map(bldgText).join("; ") + ".");
    if (bd.length > 1) L.push("Building-level rule: the floors, homes, car parks and lifts above belong to each building separately. Sales and rents below are " + (pack.projects_on_plot ? "for DLD project " + (pj.number || "") + " only (" + pack.projects_on_plot.length + " DLD projects share this plot)" : "for the whole project") + ", labelled project level.");
  } else if (bl.length) L.push("Buildings register: " + bl.length + " buildings on the plot: " + bl.map((b) => "no. " + b.no + " " + (b.floors ? b.floors + " floors" : "floors not recorded") + (b.shops ? ", " + b.shops + " shops" : "") + (b.offices ? ", " + b.offices + " offices" : "")).join("; ") + ".");
  const units = (pack.units || []).filter((u) => u.type !== "Building");
  const homes = units.filter((u) => u.type === "Flat" || u.type === "Villa" || /B\/R|Studio/i.test(u.rooms || ""));
  const nHomes = homes.reduce((s, u) => s + u.n, 0), nOther = units.filter((u) => homes.indexOf(u) < 0).reduce((s, u) => s + u.n, 0);
  if (pack.refs && pack.refs.default_height) missing.push("measured building height (the 12 m figure in our model is a default, not a measurement)");
  if (homes.length) L.push("Units register" + asOf(pack, "g_dld__units") + ": " + int(nHomes) + " homes plus " + int(nOther) + " non-residential units. Mix: " + homes.map((u) => (u.rooms || "unknown") + " " + u.n + (u.median_sqm ? " (median " + u.median_sqm + " m2)" : "")).join(", ") + ".");
  else missing.push("unit mix");
  const tl = (pp.timeline || []).slice().reverse();
  if (tl.length) L.push("Building story (oldest first): " + tl.map((t) => bppDate(t.date) + " " + t.what.replace(/^The .*? project: /, "")).join("; ") + ".");
  // sales
  const pr = pp.prices || null, sal = pack.sales || null;
  if (sal) {
    const k = sal.kinds || {};
    L.push("Sales registered with the Land Department, " + sal.year + " to " + bppDate(sal.to) + ": " + Object.keys(k).map((x) => (x === "ready" ? "ready resale" : x === "offplan" ? "off-plan" : x) + " " + k[x].deals + " deals, median AED " + int(k[x].aed_m2) + " per m2 (AED " + int(k[x].aed_sqft) + " per sq ft)").join("; ") + ". Sales all time: " + int(sal.all_time || 0) + ".");
  } else missing.push("ready vs off-plan sales split");
  if (pr && pr.sale) {
    const rows = [];
    for (const y of pr.years || []) for (const b of ["1", "2", "3"]) { const c = (pr.sale[y] || {})[b]; if (c) rows.push(BEDS(b) + " " + y + " " + aed(c[0]) + " (" + c[1] + " deals" + (c[2] === "d" ? ", " + (pp.area_name || "district") + " median, this " + pr.scope + " had none" : "") + ")"); }
    if (rows.length) L.push("Sale medians by bedroom and year (" + pr.scope + " " + (pr.name || "") + ", " + pr.ytd + " to " + bppDate(pr.to) + "): " + rows.join("; ") + ".");
  }
  // rentals
  const ten = pack.tenancies || null;
  const since = ten && ten.first && (Date.parse(ten.to) - Date.parse(ten.first)) / 864e5 <= (ten.window_days || 400);
  if (ten && ten.total) {
    const bs = Object.keys(ten.beds).sort();
    const h = ten.history;
    if (h) L.push("Tenancy history (Ejari, the Dubai Land Department tenancy register, project level, every contract length, to " + bppDate(h.to) + "): " + int(h.all_time) + " residential contracts since " + bppDate(h.first)
      + "; " + int(h.last_12m) + " in the last 12 months, of which " + int(h.renewals_12m) + " renewals" + (h.last_12m ? " (" + Math.round(h.renewals_12m / h.last_12m * 100) + "% renewal rate, " + h.renewals_12m + " of " + h.last_12m + ")" : "") + ".");
    L.push("Rentals (Ejari tenancies registered in this " + (bd.length > 1 || pack.projects_on_plot ? "project, project level, " : "building ") + (since ? "since the first one on " + bppDate(ten.first) : "in the last " + ten.window_days + " days") + ", to " + bppDate(ten.to) + "): " + ten.total + " contracts. Medians: " + bs.map((b) => BEDS(b) + " " + aed(ten.beds[b][0]) + " (" + ten.beds[b][1] + " contracts)").join(", ") + ".");
  } else missing.push("registered tenancies in this building");
  if (pr && pr.rent) {
    const rows = [];
    for (const y of pr.years || []) for (const b of ["1", "2", "3"]) { const c = (pr.rent[y] || {})[b]; if (c && c[2] === "d") rows.push(BEDS(b) + " " + y + " " + aed(c[0]) + " (" + int(c[1]) + " contracts)"); }
    if (rows.length) L.push("District rent medians, " + (pp.area_name || "district") + " (new contracts, for context only): " + rows.join("; ") + ".");
  }
  // adverts, agencies, asking rents
  const fl = pp.flats || {}, items = (fl.items || []).filter((x) => x.mode === "rent");
  const ask = {};
  for (const x of items) { const b = x.beds == null ? null : String(x.beds); if (b != null && x.price) (ask[b] = ask[b] || []).push(Number(x.price)); }
  if (fl.total) {
    L.push("Adverts live on " + bppDate(fl.checked) + ": " + fl.total + " (" + (fl.rent || 0) + " for rent, " + (fl.sale || 0) + " for sale). Adverts can repeat a unit, so this is an upper bound.");
    const askL = Object.keys(ask).sort().map((b) => BEDS(b) + " median " + aed(median(ask[b])) + " (" + ask[b].length + " adverts)");
    if (askL.length) L.push("Asking rents from the newest " + items.length + " adverts: " + askL.join(", ") + ".");
    const ag = {};
    for (const x of fl.items || []) if (x.firm) ag[x.firm] = (ag[x.firm] || 0) + 1;
    const top = Object.entries(ag).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (top.length) L.push("Agencies handling it now (by adverts among the newest " + (fl.items || []).length + "): " + top.map((t) => t[0] + " " + t[1]).join(", ") + ".");
    const ex = (fl.items || []).slice(0, 4).map((x) => (x.beds === 0 ? "studio" : x.beds + " bed") + (x.sqft ? " " + int(x.sqft) + " sq ft" : "") + " " + aed(x.price) + (x.mode === "rent" ? " a year" : "") + ", " + (x.portal || "portal") + (x.agent ? ", agent " + x.agent.replace(/\s+/g, " ") : "") + (x.firm ? ", " + x.firm : "") + (x.phone ? ", " + x.phone : "") + ", listed " + bppDate(x.date));
    if (ex.length) L.push("Sample listings: " + ex.join(". ") + ".");
  } else missing.push("live adverts");
  // occupancy signals (never a vacancy %)
  // v725: when several DLD projects share the plot, the lets belong to the primary project only, so the homes in the bar are that project's buildings' homes
  const isHome = (u) => u.type === "Flat" || u.type === "Villa" || /B\/R|Studio/i.test(u.rooms || "");
  const own = pack.projects_on_plot && pj.number ? bd.filter((b) => b.pn === pj.number) : [];
  const homesOcc = own.length ? own.reduce((s, b) => s + (b.mix || []).filter(isHome).reduce((t, u) => t + u.n, 0), 0) : nHomes;
  if (homesOcc && (ten || fl.total)) L.push("Occupancy signals (never show a vacancy percentage; show a stacked bar): " + int(homesOcc) + " homes" + (own.length ? " in " + own.map((b) => b.name || "building " + b.no).join(", ") + " (DLD project " + pj.number + ")" : "") + "; " + (ten ? ten.total : 0) + " let (registered tenancies" + (since ? " since handover" : ", last " + (ten ? ten.window_days : 400) + " days") + "); " + (fl.rent || 0) + " rental adverts live (upper bound); the remainder: no signal (owner-occupied, empty or not yet advertised; no register says which).");
  // investment
  const y = pr && pr.sale ? (pr.years || []).slice().reverse().find((yy) => pr.sale[yy] && pr.sale[yy]["1"] && pr.sale[yy]["1"][2] === "b") : null;
  const p1 = y ? pr.sale[y]["1"][0] : null, r1 = ten && ten.beds["1"] ? ten.beds["1"][0] : null;
  let yld = null;
  if (p1 && r1) { yld = r1 / p1 * 100; L.push("Investment (calculated): gross yield 1 bed about " + yld.toFixed(1) + "% (registered rent " + int(r1) + " divided by " + y + " median price " + int(p1) + "); price-to-rent about " + Math.round(p1 / r1) + " years" + (sal ? "; liquidity " + int(sal.all_time || 0) + " sales all time, " + Object.values(sal.kinds || {}).reduce((s, k) => s + k.deals, 0) + " in " + sal.year + " to " + bppDate(sal.to) : "") + ". Service charge: not available yet (grey chip)."); }
  else { missing.push("gross yield (needs both a registered 1-bed rent and a 1-bed sale median in this building)"); L.push("Investment: gross yield not available (see missing). Service charge: not available yet (grey chip)."); }
  missing.push("service-charge rate", "facilities and amenities (developer brochure)", "Makani number");
  const nr = pack.near || {};
  L.push("Neighbourhood (from the tenancy register): nearest metro " + (nr.metro || "not recorded") + "; nearest mall " + (nr.mall || "not recorded") + "; landmark " + (nr.landmark || "not recorded") + ".");
  const ac = accessLine(pack.access);
  if (ac) L.push(ac); else missing.push("drive times and nearest station for this building");
  const gl = googleLines(pack.google);
  if (gl.length) L.push(...gl);
  else L.push("Google box ('Live from Google' chip): no Google place is matched to this building yet; say so, show no rating.");
  const ah = pack.adverts_hist;
  if (ah && ah.distinct_90d) L.push("Advert history (Property Finder, last 90 days to " + bppDate(ah.last) + "): " + int(ah.distinct_90d) + " different adverts seen, " + int(ah.rent_90d) + " of them for rent. One portal only; one flat can be advertised several times.");
  else if (fl.total) L.push("Adverts note: the adverts above are a sample of live adverts from one portal on one day, not the full stock for sale or rent.");
  const ev = pp.evidence || [];
  L.push("Evidence: " + ev.length + " linked records on this plot; " + (ev.filter((e) => e.s === "d" && /Dubai/.test(e.label)).length ? ev.filter((e) => e.s === "d" && /Dubai/.test(e.label)) : ev.filter((e) => e.s === "d")).map((e) => e.label).slice(0, 6).join(", ") + ": direct matches" + (ev.some((e) => e.s === "m") ? "; " + ev.filter((e) => e.s === "m").length + " more by map location (best matches)" : "") + ".");

  // ---- risks and opportunities: simple rules on the figures above
  const done = /finish|complet/i.test(pj.status || "");
  if (pj.number && !done && ten && ten.total) risks.push("Completion is not yet recorded in the Land Department register although homes are let since " + bppDate(ten.first) + ". Ask for the completion certificate.");
  if (pj.number && !done && !(ten && ten.total) && pj.end_planned && pj.end_planned < today) risks.push("The planned completion date (" + bppDate(pj.end_planned) + ") has passed with " + (pj.pct != null ? pj.pct + "% recorded" : "no progress recorded") + ". Ask the developer for the current handover date.");
  if (fl.rent && ten && ten.total && fl.rent > ten.total) risks.push(fl.rent + " rental adverts against " + ten.total + " registered tenancies: heavy letting competition.");
  const hi = [], near = [];
  for (const b of Object.keys(ask).sort()) {
    const a = median(ask[b]), r = ten && ten.beds[b] ? ten.beds[b][0] : null;
    if (!a || !r || ask[b].length < 3) continue;
    if (a > r * 1.15) hi.push(BEDS(b) + " " + aed(a) + " vs " + int(r));
    else if (a >= r) near.push(BEDS(b) + " " + aed(a) + " vs " + int(r));
  }
  if (hi.length) risks.push("Asking rents sit well above registered rents (" + hi.join("; ") + "): expect to negotiate.");
  if (near.length) opps.push("Asking rents sit close to registered rents (" + near.join("; ") + "), so asking is near what tenants pay.");
  risks.push("Service-charge rate not yet matched: holding costs unknown.");
  if (yld != null) opps.push("About " + yld.toFixed(1) + "% gross yield on a 1 bed, on registered rent and " + y + " sale medians.");
  if (sal && sal.kinds && sal.kinds.ready && sal.kinds.ready.deals >= 10) opps.push("Steady resale: " + sal.kinds.ready.deals + " ready resales in " + sal.year + " to " + bppDate(sal.to) + " at AED " + int(sal.kinds.ready.aed_sqft) + " per sq ft.");
  if (!opps.length) opps.push("No opportunity can be computed from the register figures held today; say so plainly.");
  return { name, area: pp.area_name || "", parcel: pp.parcel || "", plot_id: pp.id, lines: L, risks, opps, missing };
}

export function bppPrompt(f, dateText) {
  return "Design a premium, magazine-quality \"Building Passport\" as ONE self-contained HTML file (inline CSS only, no JavaScript, Google Fonts allowed: Fraunces + Inter + IBM Plex Mono). It must print as exactly 3 A4 pages (use @page size A4 margin 0, and three .page sections of exactly 210mm x 297mm with overflow hidden; content must FIT - no overflow, everything ends at least 8mm above the footer) and also read well on a phone screen. "
    + "Brand: Najma (Dubai property intelligence). Palette: deep green #0F3D33, gold #C5A56A, cream #F6F2E9, ink #1C2826. Use the logo as <img src=\"najma_logo.png\" alt=\"Najma\"> in the hero band. No emojis anywhere; use small inline SVG line icons. "
    + "Design direction (look only): a cream page with a thin gold rule under the header; a large serif title block (\"BUILDING PASSPORT\" then the building name in italic serif and a one-line purpose); section headers as dark-green tab banners with a small gold line icon and a numbered gold kicker (\"01 - THE BUILDING\", \"02 - THE MARKET\", \"03 - RISKS AND OPPORTUNITIES\"); rounded cream cards with thin gold borders; beside the title on page 1 an EMPTY photo box exactly <div class=\"bpp-photo\" style=\"width:78mm;height:58mm\"></div> (leave it empty: the photo and its caption are put in later; draw no illustration, picture or skyline anywhere). Do NOT add any other logos. "
    + "Every section header carries a source chip: \"From the registers\" (green), \"From the adverts\" (gold: live adverts, asking rents, agencies and broker cards), \"Calculated\" (blue), \"Live from Google\" (amber, ONLY on the Google reviews box), \"Developer source\" (purple), \"Not available yet\" (grey). "
    + "Wording: a percentage complete is construction progress at the register date, never a completion; a planned date is planned. Use the logo at least 22mm tall. Keep every card fully inside its page: no card may extend past the right edge, and the last card on each page must end at least 10mm above the footer; if space is short, make cards smaller, never cut them. The milestone timeline must fit inside its card width. "
    + "Footer on every page: \"Curated by Najjuko · Dubai Decoded · WhatsApp +971 56 548 4397\" on the left and \"Najma Building Passport · " + dateText + " · page N of 3\" on the right. "
    + "Page structure: page 1 = what the building is (identity and location, physical building, apartment inventory with a donut for the unit mix, building story as a horizontal milestone timeline with every date and label fully visible inside the card); "
    + "page 2 = what the market is doing (sales with a line or bars for the 1-bed sale median by year, rentals with grouped bars for asking vs registered rent by bedroom, occupancy as a stacked horizontal bar of signals, investment KPI cards, a grid of broker cards: agent, agency, phone, listing); "
    + "page 3 = what it means: a prominent \"Risks and opportunities\" panel (chip: Calculated) as a row of cards with exactly the points given below, a \"Najma summary\" card (what is confirmed, what needs verification, why it matters - only from the facts), a \"Recommended next actions\" card (numbered, practical, drawn from the risks and missing items), then compact construction, operations, neighbourhood, developer and evidence cards. "
    + "Sections numbered 01 to 12 across the three pages: 01 Identity and location, 02 Physical building, 03 Apartment inventory, 04 Sales, 05 Rentals, 06 Occupancy, 07 Investment, 08 Construction and approvals, 09 Operations and service charges, 10 Neighbourhood, 11 Developer, 12 Evidence. "
    + "Under every register-backed figure print its source and as-of date in small text exactly as given in DATA; any \"NOTE: this register is N days old\" must be printed visibly beside that figure (small amber note). Figures for one building are never added up into a project total, and project-level figures are labelled \"project level\". The Google box shows the rating, the review count, the retrieval date and the Google Maps link as given, plus the line \"Google shows at most 5 reviews per place; this is not every review\". "
    + "HARD RULES: never invent a number, rating, name or fact; every number must come from DATA below; never leave out an available metric; label every missing item \"Not available yet\". Return ONLY the complete HTML document, starting with <!doctype html>.\n\n"
    + "DATA (use exactly):\n" + f.lines.join("\n")
    + "\nNot available yet (show as such, grey chip): " + f.missing.join("; ") + "."
    + "\nRisks (computed; print exactly these): " + f.risks.map((r, i) => "(" + String.fromCharCode(97 + i) + ") " + r).join(" ")
    + "\nOpportunities (computed; print exactly these): " + f.opps.map((r, i) => "(" + String.fromCharCode(97 + i) + ") " + r).join(" ")
    + (f.finance && f.finance.length ? "\nFINANCE for section 07 Investment on page 2 (v727; it replaces the plain investment KPI cards; print exactly; under every figure say observed or assumed and its source and as-of date as given; a figure marked preliminary shows the word \"preliminary\" and NO number; show the assumptions as a small table with their values; keep it inside page 2):\n" + f.finance.join("\n") : "")
    + "\nDisclaimer: Research use only. Not a valuation, legal title or offer. Registered deals are actual prices; adverts are asking prices.";
}

// v727: one set of investment figures only. The engine's reader view replaces the older plain gross-yield line and opportunity (different method),
// and the schedule link gets this passport's own address.
export function withFinance(f, fin, slug) {
  const lines = f.lines.filter((l) => !/^Investment( \(calculated\))?:/.test(l));
  const opps = f.opps.filter((o) => !/gross yield on a 1 bed/.test(o));
  if (fin.reader === "investor" && fin.gross && fin.gross.value != null) opps.push("About " + (fin.gross.value * 100).toFixed(1) + "% gross yield on a typical " + (fin.unit.b === "0" ? "studio" : fin.unit.b + " bed") + " (registered rent over registered ready price per m2 x median size).");
  if (!opps.length) opps.push("No opportunity can be computed from the register figures held today; say so plainly.");
  const finance = fin.lines.map((l) => l.replace("/bp/f/<this passport>.csv", "/bp/f/" + slug + ".csv"));
  return { ...f, lines, opps, finance };
}
export const bppSlugFor = (name, parcel, reader) => bppSlug(name, parcel) + (reader && reader !== "broker" ? "-" + reader : "");

export const bppSlug = (name, parcel) => (String(name || "building").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "building") + (parcel ? "-" + String(parcel).replace(/[^0-9]/g, "") : "");
export const pdfPages = (buf) => { const s = new TextDecoder("latin1").decode(new Uint8Array(buf)); return (s.match(/\/Type\s*\/Page(?![s\w])/g) || []).length; };
export const extractHtml = (txt) => { const m = /<!doctype html[\s\S]*<\/html>/i.exec(String(txt || "")); return m ? m[0] : ""; };
export const responseText = (r) => (r && r.output || []).filter((o) => o.type === "message").map((o) => (o.content || []).map((c) => c.text || "").join("")).join("");

// ------------------------------------------------------------------------------------------------ v702 the hero photo (Kendall, 3 Nov 2026: "Go photo")
// ON REQUEST ONLY, chosen once in the pending step of that passport's job (never a bulk run over plots):
//   1. Google Places (New) Text Search for "<building>, <area>, Dubai" -> the first place whose name carries the building's words -> its first
//      landscape photo at least 1200 px wide. We keep ONLY place_id + the photo resource name + the author credits (bpp_photo_<slug>);
//      the picture itself is fetched LIVE from Google each time /bp/img/<slug> is opened (and once at PDF render), never stored (Google's terms).
//   2. No acceptable Google photo -> ONE generated architectural exterior from the register facts, kept for that passport only
//      (bpp_img_<slug>), captioned "Illustration". At most 20 a day (bpp_imgcount_<GST day>); over the cap = no photo at all.
//   Unnamed plots ("Plot 1234567") never go to Google: a text search on a plot number finds the wrong building.
const IMG_MODEL = "gpt-image-2.5-flare";
const IMG_CAP = 20;
const PLACES = "https://places.googleapis.com/v1/";
const STOP = ["the", "and", "tower", "towers", "building", "residence", "residences", "dubai"];
const words = (s) => String(s || "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.includes(w));
const b64ToBytes = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
const bytesToB64 = (buf) => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
export const bestPhoto = (photos) => (photos || []).find((p) => p && p.name && +p.widthPx >= 1200 && +p.widthPx > +p.heightPx) || null;
export const nameMatches = (want, got) => { const w = words(want), g = words(got); return w.length > 0 && w.every((x) => g.includes(x)); };
const credits = (p) => (p.authorAttributions || []).map((a) => ({ n: String(a.displayName || "").slice(0, 80), u: /^https:\/\//.test(a.uri || "") ? String(a.uri).slice(0, 300) : "" })).filter((a) => a.n).slice(0, 3);

async function googlePick(env, name, area) {
  if (!env.GOOGLE_MAPS_KEY || /^Plot\s/i.test(name) || !words(name).length) return null;
  const r = await fetch(PLACES + "places:searchText", { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": env.GOOGLE_MAPS_KEY, "X-Goog-FieldMask": "places.id,places.displayName,places.photos" },
    body: JSON.stringify({ textQuery: name + ", " + (area || "") + ", Dubai", maxResultCount: 5, locationBias: { circle: { center: { latitude: 25.13, longitude: 55.22 }, radius: 50000 } } }) });
  if (!r.ok) return null;
  const j = await r.json().catch(() => ({}));
  for (const pl of j.places || []) {
    if (!nameMatches(name, pl.displayName && pl.displayName.text)) continue;
    const ph = bestPhoto(pl.photos);
    if (ph) return { kind: "google", place_id: pl.id, name: ph.name, w: ph.widthPx, h: ph.heightPx, attr: credits(ph) };
  }
  return null;
}
async function googleMedia(env, ph) {
  const get = (nm) => fetch(PLACES + String(nm).split("/").map(encodeURIComponent).join("/") + "/media?maxWidthPx=1600&key=" + env.GOOGLE_MAPS_KEY);
  let r = await get(ph.name);
  if (!r.ok && ph.place_id) {   // photo names expire: look the place up again and take its best photo now
    const d = await fetch(PLACES + "places/" + encodeURIComponent(ph.place_id), { headers: { "X-Goog-Api-Key": env.GOOGLE_MAPS_KEY, "X-Goog-FieldMask": "photos" } });
    const best = d.ok ? bestPhoto((await d.json().catch(() => ({}))).photos) : null;
    if (!best) return null;
    r = await get(best.name);
  }
  return r.ok ? r : null;
}
export function imagePrompt(f, pp) {
  const fl = Math.max(0, ...((pp && pp.buildings) || []).map((b) => +b.floors || 0));
  return "Photorealistic architectural exterior photograph of a residential building in " + (f.area || "Dubai") + ", Dubai, UAE, seen from street level at golden hour, clear sky, "
    + (fl ? "about " + fl + " floors tall, " : "") + (pp && pp.land_type ? "on a " + String(pp.land_type).toLowerCase() + " plot, " : "")
    + "contemporary Gulf architecture, landscaped entrance with palms, no people close up, no text, no signage, no logos, no watermark. Landscape 3:2.";
}
async function generatePhoto(env, slug, f, pp, now) {
  if (!env.OPENAI_API_KEY) return null;
  const ck = "bpp_imgcount_" + todayGst(now);
  const n = parseInt(await env.MEETINGS.get(ck), 10) || 0;
  if (n >= IMG_CAP) return { kind: "none", why: "daily cap" };
  await env.MEETINGS.put(ck, String(n + 1), { expirationTtl: 3 * 86400 });   // counted before the call: a failed call still cost a try
  const r = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", headers: { Authorization: "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ model: IMG_MODEL, prompt: imagePrompt(f, pp), size: "1536x1024", quality: "medium", output_format: "jpeg", n: 1 }) });
  if (!r.ok) return { kind: "none", why: "picture service " + r.status };
  const j = await r.json().catch(() => ({}));
  const b64 = j && j.data && j.data[0] && j.data[0].b64_json;
  if (!b64) return { kind: "none", why: "no picture came back" };
  await env.MEETINGS.put("bpp_img_" + slug, b64ToBytes(b64));
  return { kind: "gen" };
}
// picks and records the photo for one passport; returns the record (kind google | gen | none)
export async function bppPhoto(env, slug, f, pp, now) {
  let ph = null;
  try { ph = await googlePick(env, f.name, f.area); } catch (e) {}
  if (!ph) { try { ph = await generatePhoto(env, slug, f, pp, now); } catch (e) { ph = { kind: "none", why: String(e && e.message || e).slice(0, 80) }; } }
  ph = ph || { kind: "none" };
  ph.at = new Date(now || Date.now()).toISOString();
  await env.MEETINGS.put("bpp_photo_" + slug, JSON.stringify(ph));
  return ph;
}
// the picture bytes, live: Google each time, or the stored illustration
export async function bppImage(env, slug) {
  const ph = await readJson(env, "bpp_photo_" + slug);
  if (!ph) return null;
  if (ph.kind === "google" && env.GOOGLE_MAPS_KEY) {
    const r = await googleMedia(env, ph);
    return r ? { body: await r.arrayBuffer(), type: r.headers.get("Content-Type") || "image/jpeg", google: true } : null;
  }
  if (ph.kind === "gen") { const b = await env.MEETINGS.get("bpp_img_" + slug, "arrayBuffer"); return b ? { body: b, type: "image/jpeg" } : null; }
  return null;
}
export async function bppImageDataUri(env, slug) { const im = await bppImage(env, slug); return im ? "data:" + im.type + ";base64," + bytesToB64(im.body) : ""; }
// the hero figure that fills the model's empty photo box; src is the live route (page) or a data: URI (PDF render)
export function heroFigure(ph, src) {
  if (!ph || !src || (ph.kind !== "google" && ph.kind !== "gen")) return "";
  const who = (ph.attr || []).map((a) => a.u ? '<a href="' + esc(a.u) + '" style="color:inherit">' + esc(a.n) + "</a>" : esc(a.n)).join(", ");
  const cap = ph.kind === "gen" ? "Illustration" : "Photo: " + (who || "Google") + " · Google Maps";
  return '<figure class="bpp-hero" style="margin:0;width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;border-radius:10px;border:1px solid #C5A56A">'
    + '<img src="' + esc(src) + '" alt="' + (ph.kind === "gen" ? "Illustration" : "Photo of the building") + '" style="flex:1;min-height:0;width:100%;object-fit:cover;display:block">'
    + '<figcaption style="font:500 8pt Inter,sans-serif;color:#1C2826;background:#F6F2E9;padding:3px 7px">' + cap + "</figcaption></figure>";
}
const HOLDER_RE = /(<div[^>]*class=(["'])[^"']*\bbpp-photo\b[^"']*\2[^>]*>)\s*<\/div>/i;
export const hasHolder = (html) => HOLDER_RE.test(String(html || ""));
export function placePhoto(html, fig) {
  if (!fig) return html;
  return html.replace(HOLDER_RE, (m, open) => open + fig + "</div>");   // no box from the model = no photo, never one dropped in at random
}

// ------------------------------------------------------------------------------------------------ requests
async function readReqIds(env) { const r = await readJson(env, "bpp_requests"); return Array.isArray(r) ? r.filter((x) => /^[a-z0-9]{6,24}$/.test(x)) : []; }
async function readReq(env, id) { return readJson(env, "bpp_req_" + id); }
async function putReq(env, id, r) { r.updated = new Date().toISOString(); await env.MEETINGS.put("bpp_req_" + id, JSON.stringify(r)); return r; }

// a typed building name or plot / parcel number -> one plot id, or why not
export async function bppResolve(env, text) {
  const t = String(text || "").trim();
  if (PP_ID.test(t)) return (await ppGet(env, t)) ? { id: t } : { err: "That plot is not in the passport data." };
  const digits = t.replace(/[^0-9]/g, "");
  if (/^\d{7}$/.test(digits) && /^[\d\s\-]+$/.test(t)) {
    for (const id of ["naj:plot:" + digits.slice(0, 3) + "-" + parseInt(digits.slice(3), 10), "naj:plot:" + digits]) { const pp = await ppGet(env, id); if (pp && String(pp.parcel) === digits) return { id }; }
  }
  if (/^\d{3}-\d{1,4}$/.test(t)) { const id = "naj:plot:" + t.split("-")[0] + "-" + parseInt(t.split("-")[1], 10); if (await ppGet(env, id)) return { id }; }
  const s = await ppSearch(env, t);
  const ex = (s.results || []).filter((r) => r.exact);
  const pick = ex.length ? ex : (s.results || []);
  const ids = [...new Set(pick.map((r) => r.id))];
  if (ids.length === 1) return { id: ids[0] };
  return { err: ids.length ? "needs a plot number" : "No building or plot found by that name; needs a plot number" };
}

// ------------------------------------------------------------------------------------------------ the job (minute tick)
async function oaiStart(env, input) {
  const r = await fetch(OAI, { method: "POST", headers: { Authorization: "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, input, background: true, store: true }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) throw new Error("ChatGPT did not accept the request (" + r.status + ")");
  return j.id;
}
async function oaiGet(env, id) {
  const r = await fetch(OAI + "/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + env.OPENAI_API_KEY } });
  return r.json().catch(() => ({}));
}
// runs in the page: the texts of elements cut off at a page edge or running into the footer (bottom 14 mm of a .page)
export const OVERFLOW_JS = `(() => { const out = []; const mm = 96 / 25.4;
  document.querySelectorAll(".page").forEach((pg, i) => { const P = pg.getBoundingClientRect(); const foot = pg.querySelector("footer, .footer, [class*=foot]");
    const F = foot ? foot.getBoundingClientRect().top : P.bottom - 14 * mm;
    pg.querySelectorAll("*").forEach((el) => { if (foot && (el === foot || foot.contains(el))) return; const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
      const st = getComputedStyle(el); if (st.position === "absolute" && /decor|bg|orn|watermark/i.test(el.className || "")) return;
      if (r.right > P.right + 2 || r.bottom > F + 1) { const t = (el.innerText || "").trim().replace(/\\s+/g, " ").slice(0, 60); if (t && el.children.length === 0) out.push("page " + (i + 1) + ": " + t); } }); });
  return out.slice(0, 12); })()`;
let LAUNCH = (binding) => puppeteer.launch(binding);
export function __setLauncher(fn) { LAUNCH = fn || ((binding) => puppeteer.launch(binding)); }
async function renderPdf(env, html) {
  const browser = await LAUNCH(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 45000 });
    try { await page.evaluate(() => document.fonts.ready.then(() => true)); } catch (e) {}
    let over = [];
    try { over = await page.evaluate(OVERFLOW_JS); } catch (e) {}
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    return { pdf, over: Array.isArray(over) ? over : [] };
  } finally { try { await browser.close(); } catch (e) {} }
}
async function withLogo(env, html) {
  const b64 = await env.MEETINGS.get("bpp_logo_png");
  return b64 ? html.replace(/(["'])najma_logo\.png\1/g, '"data:image/png;base64,' + b64 + '"') : html;
}

// one step of one job per call; safe to run every minute
export async function bppTick(env, nowMs) {
  if (!env.OPENAI_API_KEY) return { idle: "no key" };
  const now = nowMs || Date.now();
  const ids = (await readReqIds(env)).slice(-40);
  for (const id of ids) {
    const r = await readReq(env, id);
    if (!r || ["done", "failed", "needs a plot number"].includes(r.status)) continue;
    if (r.lock && now - Date.parse(r.lock) < 5 * 60e3) return { busy: id };
    try {
      if (r.status === "pending") {
        const res = r.plot_id ? { id: r.plot_id } : await bppResolve(env, r.text);
        if (!res.id) { r.status = /plot number/.test(res.err) ? "needs a plot number" : "failed"; r.msg = res.err; await putReq(env, id, r); continue; }
        const pp = await ppGet(env, res.id);
        if (!pp) { r.status = "failed"; r.msg = "That plot is not in the passport data."; await putReq(env, id, r); continue; }
        const pack = await readJson(env, "pp_pack_" + res.id.replace("naj:plot:", ""));
        const today = todayGst(now);
        const f0 = bppFacts(pp, pack, today);
        const fin = bppFinance(pp, pack, readerFor(r.reader), today);   // v727 - the asset type can change the reader (empty plot -> developer)
        r.reader_used = fin.reader; r.fin_status = fin.status;
        r.plot_id = res.id; r.title = f0.name; r.area = f0.area; r.parcel = f0.parcel; r.slug = bppSlugFor(f0.name, f0.parcel, fin.reader);
        const f = withFinance(f0, fin, r.slug);
        if (fin.csv) await env.MEETINGS.put("bpp_file_" + r.slug + "_csv", fin.csv); r.csv = !!fin.csv;
        r.photo = (await bppPhoto(env, r.slug, f, pp, now)).kind;   // v702 - the hero photo, chosen once per request
        r.prompt_chars = 0; const prompt = bppPrompt(f, bppDate(today)); r.prompt_chars = prompt.length;
        r.resp = await oaiStart(env, prompt); r.status = "writing"; r.tries = 0; r.started = new Date(now).toISOString();
        await putReq(env, id, r); return { started: id };
      }
      if (r.status === "writing" || r.status === "fixing") {
        if (now - Date.parse(r.started || r.at) > 60 * 60e3) { r.status = "failed"; r.msg = "ChatGPT took over an hour."; await putReq(env, id, r); continue; }
        const o = await oaiGet(env, r.resp);
        if (o.status === "queued" || o.status === "in_progress") return { waiting: id };
        if (o.status !== "completed") { r.status = "failed"; r.msg = "ChatGPT stopped (" + (o.status || "unknown") + ")."; await putReq(env, id, r); continue; }
        const html = extractHtml(responseText(o));
        if (!html) { r.status = "failed"; r.msg = "ChatGPT returned no HTML."; await putReq(env, id, r); continue; }
        r.lock = new Date(now).toISOString(); await putReq(env, id, r);
        const logo = await withLogo(env, html);
        const ph = await readJson(env, "bpp_photo_" + r.slug);   // v702 - the page links the live picture; the PDF gets it once, at render
        const full = placePhoto(logo, heroFigure(ph, "/bp/img/" + r.slug));
        const { pdf, over } = await renderPdf(env, placePhoto(logo, heroFigure(ph, await bppImageDataUri(env, r.slug).catch(() => ""))));
        const n = pdfPages(pdf);
        r.over = over.slice(0, 6);
        if ((n !== 3 || over.length) && !(r.tries >= 1)) {
          r.tries = (r.tries || 0) + 1; r.pages = n; delete r.lock;
          r.resp = await oaiStart(env, "Revise this Building Passport HTML. Printed to PDF in Chrome it came out as " + n + " pages" + (over.length ? " and these items are cut off at the page edge or run into the footer: " + over.join(" | ") : "") + ". Content overflowed. Keep the design, palette, fonts, every number and the 3-page A4 structure; tighten spacing, shrink charts and type, and make everything fit in exactly three 210mm x 297mm .page sections with overflow hidden, ending at least 8mm above the footer. Never invent or drop a number. Return ONLY the complete corrected HTML document starting with <!doctype html>.\n\nHTML:\n" + html);
          r.status = "fixing"; await putReq(env, id, r); return { reask: id };
        }
        await env.MEETINGS.put("bpp_file_" + r.slug + "_html", full);
        await env.MEETINGS.put("bpp_file_" + r.slug + "_pdf", pdf);
        await putBppEntry(env, { slug: r.slug, title: r.title, area: r.area, plot_id: r.plot_id, parcel: r.parcel, date: todayGst(now), html: true, pdf: true, reader: r.reader_used || "broker", fin: r.fin_status || "", csv: !!r.csv });
        r.status = "done"; r.pages = n; delete r.lock; delete r.resp; await putReq(env, id, r);
        await dropOldJobs(env, id, r.plot_id, r.reader_used || "broker").catch(() => []);   // v728 - only the latest passport is kept
        return { done: id, pages: n };
      }
    } catch (e) { r.status = "failed"; r.msg = String(e && e.message || e).slice(0, 200); delete r.lock; await putReq(env, id, r); return { failed: id }; }
  }
  return { idle: true };
}

// ------------------------------------------------------------------------------------------------ the card page
const SIGN = { najjuko: "\\n\\nKind regards,\\nNajjuko", kendall: "\\n\\nKind regards,\\nDr. Kendall Wilson\\nDigitAlchemy Tech Limited\\ncontact@digitalabbot.io | +971 56 227 6093" };
const ic = (d, s, c) => '<svg viewBox="0 0 24 24" width=' + (s || 26) + ' height=' + (s || 26) + ' fill="none" stroke="' + (c || "#C5A56A") + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true>' + d + '</svg>';
const forWho = (k) => (k === "investor" ? "an investor" : "a " + k);   // v727
const ST = { pending: "Waiting to start", writing: "Being made", fixing: "Being made (fitting to 3 pages)", done: "Ready", failed: "Could not be made", "needs a plot number": "Needs a plot number" };

export function bppBody(key, rk, items, reqs, origin, who) {
  const q = "?key=" + encodeURIComponent(key) + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  const tile = (e) => {
    const share = origin + "/bp/" + e.slug;
    return '<div class=bt><div class=bh><span class=pi>' + ic(BPP_ICON) + '</span><span class=px><b>' + esc(e.title) + '</b><i>' + esc([e.reader && BPP_READERS[e.reader] ? "For " + forWho(e.reader) + (e.fin === "preliminary" ? " (preliminary)" : "") : "", e.area, bppDate(e.date)].filter(Boolean).join(" · ")) + '</i></span></div>'
      + '<div class=ba><a class=b href="/bp/' + e.slug + '" target=_blank rel=noopener>Open</a>' + (e.pdf ? '<a class=b href="/bp/f/' + e.slug + '.pdf" target=_blank rel=noopener>PDF</a>' : "") + (e.csv ? '<a class=b href="/bp/f/' + e.slug + '.csv">Schedule (Excel CSV)</a>' : "")
      + '<a class="b w" target=_blank rel=noopener href="https://wa.me/?text=' + encodeURIComponent(e.title + " - Building Passport\n" + share) + '">Send on WhatsApp</a>'
      + (e.plot_id ? '<a class="b o" href="/plot_passport' + q + "&id=" + encodeURIComponent(e.plot_id) + '">Full evidence</a>' : "") + '</div></div>';
  };
  // v701 (Kendall, 3 Nov): the page opens on what is in the register, not on one passport; made passports sit below the form
  const list = items.length ? '<details class=made><summary>Passports made (' + items.length + ')</summary><div class=pl id=bpp_list>' + bppSorted(items).map(tile).join("") + '</div></details>'
    : '<p class=fmm id=bpp_empty>No passports made yet.</p>';
  const stats = '<div class=sts id=bpp_stats><div><b id=bpp_sp>-</b><span>plots in the register</span></div><div><b id=bpp_sd>-</b><span>districts</span></div><div><b>' + items.length + '</b><span>passports made</span></div></div>'
    + '<style>.sts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:6px 0 4px}.sts div{border:1px solid #E7E1D6;background:#FFFDF9;border-radius:14px;padding:12px 8px;text-align:center}.sts b{display:block;font:600 1.25rem Fraunces,serif;color:#0A4F4A}.sts span{font:500 .72rem "IBM Plex Sans",sans-serif;color:#5F6B66}.made summary{font:600 1.05rem Fraunces,serif;color:#0A4F4A;cursor:pointer;margin:22px 0 8px}</style>';
  const rq = reqs.filter((r) => r && r.status !== "done").slice(-12).reverse();
  const reqH = rq.length ? '<div class=rl id=bpp_reqs>' + rq.map((r) => '<div class=rq><b>' + esc((r.title || r.text) + (r.reader && BPP_READERS[r.reader] ? " · for " + forWho(r.reader) : "")) + '</b><span class="s s_' + esc(String(r.status).replace(/\W/g, "")) + '">' + esc(ST[r.status] || r.status) + '</span>' + (r.msg ? '<i>' + esc(r.msg) + '</i>' : "") + '</div>').join("") + '</div>' : "";
  return '<a class=back href="/momo' + q + '">&#8592; Momo</a><div class=tag>MOMO</div><h1>Building Passports</h1>' + stats
    + '<h2>Request a passport</h2><form id=bpp_f class=fm>'   // v698 (Kendall, 3 Nov): district first, then its buildings - no typing through thousands
    // v703 (Kendall, 3 Nov: "go hierarchy"): area first (Dubai 2040 urban centre, OUR grouping, see BPP_ZONES), then district, then building
    + '<label class=fl>Area</label><p class=zn>Areas grouped by Dubai 2040 urban centre (our grouping: the plan names the centres, not their boundaries). Coastal is our own Najma layer.</p><div class=zg id=bpp_z role=group aria-label="Area"><p class=fmm>Loading areas...</p></div>'
    + '<label class=fl for=bpp_q>Search</label><input id=bpp_q type=search placeholder="Filter districts, then buildings: name, plot number, freehold, empty..." autocomplete=off>'
    + '<label class=fl for=bpp_d>District</label><select id=bpp_d><option value="">Loading districts...</option></select>'
    + '<label class=fl for=bpp_b>Building</label><select id=bpp_b disabled><option value="">Choose a district first</option></select>'
    + '<details class=alt><summary>Or type a plot / parcel number</summary><input id=bpp_t maxlength=120 placeholder="e.g. 3460188 or 346-188"></details>'
    + '<label class=fl>Passport for</label><div class=zg id=bpp_r role=radiogroup aria-label="Passport for">' + Object.keys(BPP_READERS).map((k) => '<label class="zc rd' + (k === "broker" ? " on" : "") + '"><input type=radio name=bpp_reader value=' + k + (k === "broker" ? " checked" : "") + ' style="position:absolute;opacity:0;width:1px;height:1px"><b>' + esc(BPP_READERS[k].label) + '</b><span>' + esc(BPP_READERS[k].line.replace(/^Passport for an? [a-z]+: /, "")) + '</span></label>').join("") + '</div>'
    + '<input id=bpp_n maxlength=300 placeholder="Note (optional)"><button class="b ok" type=submit>Generate passport</button><p id=bpp_m class=fmm></p></form>' + reqH + list
    + '<style>.bt,.fm input,.b,.rq{box-sizing:border-box;min-width:0;max-width:100%}.pl{display:flex;flex-direction:column;gap:10px}.bt{border:1px solid #E7E1D6;background:#FFFDF9;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:10px}.bh{display:flex;gap:12px;align-items:center}.pi{flex:0 0 44px;height:44px;border-radius:10px;background:#0A4F4A;display:flex;align-items:center;justify-content:center}.px{display:flex;flex-direction:column;gap:3px}.px b{font:600 1rem Fraunces,serif;color:#0A4F4A}.px i{font:500 .78rem "IBM Plex Sans",sans-serif;color:#5F6B66;font-style:normal}'
    + '.ba{display:grid;grid-template-columns:1fr 1fr;gap:8px}.b{border:1px solid #0A4F4A;color:#0A4F4A;background:#fff;border-radius:999px;padding:10px 12px;font:600 .85rem "IBM Plex Sans",sans-serif;text-decoration:none;text-align:center;cursor:pointer}.b.w{background:#0A4F4A;color:#fff}.b.o{border-color:#C5A56A;color:#8A6F3E}.b.ok{background:#0A4F4A;color:#fff}'
    + '.empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:34px 18px;border:1px dashed #C5A56A;border-radius:18px;text-align:center;color:#5F6B66}.empty p{margin:0}.empty b{font-family:Fraunces,serif;font-size:1.1rem;color:#0A4F4A}'
    + 'h2{font:600 1.15rem Fraunces,serif;color:#0A4F4A;margin:22px 0 8px}.fm{display:flex;flex-direction:column;gap:8px}.fm input{border:1px solid #D8D1C4;border-radius:12px;padding:12px;font:500 .95rem "IBM Plex Sans",sans-serif;background:#fff}.fmm{margin:0;font-size:.85rem;color:#5F6B66;min-height:1em}'
    + '.rl{display:flex;flex-direction:column;gap:8px;margin-top:12px}.rq{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;border:1px solid #E7E1D6;border-radius:12px;padding:10px 12px;background:#FFFDF9}.rq b{font:600 .92rem "IBM Plex Sans",sans-serif;color:#1C2826;flex:1 1 60%}.rq i{flex:1 1 100%;font:500 .78rem "IBM Plex Sans",sans-serif;color:#8A3E3E;font-style:normal}.s{font:600 .62rem "IBM Plex Mono",monospace;border-radius:999px;padding:3px 9px;border:1px solid #C5A56A;color:#8A6F3E}.s_failed,.s_needsaplotnumber{border-color:#C98A8A;color:#8A3E3E}</style>'
    + '<style>.fm select{border:1px solid #D8D1C4;border-radius:12px;padding:12px;font:500 .95rem "IBM Plex Sans",sans-serif;background:#fff;color:#1C2826;width:100%;max-width:100%}.fl{font:600 .72rem "IBM Plex Mono",monospace;letter-spacing:.08em;color:#8A6F3E;text-transform:uppercase;margin-top:4px}.alt summary{font:500 .82rem "IBM Plex Sans",sans-serif;color:#5F6B66;cursor:pointer;padding:4px 0}.alt input{width:100%;margin-top:6px}.zn{margin:0;font:500 .78rem "IBM Plex Sans",sans-serif;color:#5F6B66}.zg{display:grid;grid-template-columns:1fr 1fr;gap:8px}.zc{box-sizing:border-box;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;border:1px solid #E7E1D6;background:#FFFDF9;border-radius:14px;padding:10px 12px;cursor:pointer;color:#1C2826}.zc b{font:600 .9rem Fraunces,serif;color:#0A4F4A;line-height:1.2}.zc span{font:500 .7rem "IBM Plex Sans",sans-serif;color:#5F6B66}.zc.on{background:#0A4F4A;border-color:#0A4F4A}.zc.on b,.zc.on span{color:#fff}</style>'
    + '<script>(function(){var Q=location.search.replace(/^\\?/,""),ds=document.getElementById("bpp_d"),bs=document.getElementById("bpp_b");'
    + 'function opt(v,t){var o=document.createElement("option");o.value=v;o.textContent=t;return o}'
    // v703: area cards (2-up, phone-first) filter the district select; a district can sit in a centre AND the coastal layer; "Other areas" = no centre
    + 'var ZS=' + JSON.stringify(BPP_ZONES) + ',ZI={},DL=[],ZN="",zg=document.getElementById("bpp_z"),qi=document.getElementById("bpp_q"),ROWS=[];'
    + 'ZS.forEach(function(z){z.d.forEach(function(s){(ZI[s]=ZI[s]||[]).push(z.id)})});'
    + 'function inZ(d,z){var a=ZI[d.slug]||[];if(!z)return true;if(z==="other")return !a.some(function(x){return x!=="coast"});return a.indexOf(z)>=0}'
    + 'function zcards(){var Z=[{id:"",name:"All areas"}].concat(ZS,[{id:"other",name:"Other areas (no 2040 centre)"}]);zg.innerHTML="";Z.forEach(function(z){var L=DL.filter(function(d){return inZ(d,z.id)}),n=0;L.forEach(function(d){n+=d.n||0});if(z.id&&!L.length)return;var b=document.createElement("button");b.type="button";b.className="zc"+(z.id===ZN?" on":"");b.setAttribute("aria-pressed",z.id===ZN?"true":"false");'
    + 'b.innerHTML=\'' + ic('<path d="M12 21s-6-5.6-6-10.5a6 6 0 0 1 12 0C18 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>', 18, "#C5A56A") + '\';var t=document.createElement("b");t.textContent=z.name;var s=document.createElement("span");s.textContent=L.length+" districts \\u00b7 "+n.toLocaleString("en")+" plots";b.appendChild(t);b.appendChild(s);b.onclick=function(){ZN=z.id;zcards();ds.value="";resetB();fillD()};zg.appendChild(b)})}'
    + 'function fillD(){var q=ds.value?"":qi.value.trim().toLowerCase(),qs=q.replace(/[^a-z0-9]/g,""),L=DL.filter(function(d){return inZ(d,ZN)&&(!q||d.name.toLowerCase().indexOf(q)>=0||(qs&&d.slug.indexOf(qs)>=0))});ds.innerHTML="";ds.appendChild(opt("",L.length?"Choose a district ("+L.length+")":(q?"No district matches \\u201c"+qi.value+"\\u201d":"No districts here")));L.forEach(function(d){ds.appendChild(opt(d.slug,d.name+" \\u00b7 "+d.n+" plots"))})}'
    + 'function resetB(){bs.innerHTML="";bs.disabled=true;ROWS=[];bs.appendChild(opt("","Choose a district first"))}'
    + 'fetch("/plot_passport/districts?"+Q).then(function(r){return r.json()}).then(function(j){var L=j.districts||[],tp=0;L.forEach(function(d){tp+=d.n||0});var e1=document.getElementById("bpp_sp"),e2=document.getElementById("bpp_sd");if(e1)e1.textContent=tp.toLocaleString("en");if(e2)e2.textContent=L.length;DL=L;zcards();fillD()}).catch(function(){zg.innerHTML="";ds.innerHTML="";ds.appendChild(opt("","Districts could not load - type a plot number below"))});'
    // v699 (Kendall, 3 Nov): type-to-filter; named buildings first, then built plots with no name, then empty plots - each plot line says tenure, use, size, built/empty, project, permits
    + 'function draw(){var q=qi.value.trim().toLowerCase(),secs=[["Named buildings",[]],["Built plots with no building name",[]],["Empty plots",[]]],n=0;ROWS.forEach(function(r){if(q&&r.s.indexOf(q)<0)return;secs[r.k][1].push(r);n++});'
    + 'bs.innerHTML="";bs.appendChild(opt("",n?(q?n+" match":"Choose ("+n+")"):"Nothing matches \\u201c"+qi.value+"\\u201d"));secs.forEach(function(s){if(!s[1].length)return;var og=document.createElement("optgroup");og.label=s[0]+" ("+s[1].length+")";s[1].slice(0,600).forEach(function(r){og.appendChild(opt(r.id,r.t))});bs.appendChild(og)});bs.disabled=!n}'
    + 'qi.oninput=function(){if(ds.value)draw();else fillD()};'
    + 'ds.onchange=function(){bs.innerHTML="";bs.disabled=true;qi.value="";ROWS=[];if(!ds.value){bs.appendChild(opt("","Choose a district first"));fillD();return}bs.appendChild(opt("","Loading buildings..."));'
    + 'fetch("/plot_passport/d?"+Q+"&slug="+encodeURIComponent(ds.value)).then(function(r){return r.json()}).then(function(j){var D=j.district||{},g=(D.groups||[]).slice().sort(function(a,b){return String(a[0]).localeCompare(String(b[0]))});'
    + 'g.forEach(function(x){var u=x[1]==="u"||/no (registered|building) name/i.test(x[0]),ps=x[2]||[];ps.forEach(function(p){var lab=u?String(p[1]):(ps.length===1?x[0]+" \\u00b7 "+String(p[1]).replace(/^Plot \\S+ \\u00b7 /,""):x[0]+" \\u00b7 "+String(p[1]));ROWS.push({id:p[0],t:lab,k:u?1:0,s:lab.toLowerCase()})})});'
    + '(D.vacant||[]).forEach(function(p){var lab=String(p[1]);ROWS.push({id:p[0],t:lab,k:2,s:lab.toLowerCase()})});qi.disabled=false;draw()}).catch(function(){bs.innerHTML="";bs.appendChild(opt("","Buildings could not load"))})};'
    + 'Array.prototype.forEach.call(document.querySelectorAll("#bpp_r input"),function(i){i.onchange=function(){Array.prototype.forEach.call(document.querySelectorAll("#bpp_r .rd"),function(l){l.classList.toggle("on",l.querySelector("input").checked)})}});'
    + 'var f=document.getElementById("bpp_f"),m=document.getElementById("bpp_m");f.onsubmit=function(e){e.preventDefault();var t=bs.value||document.getElementById("bpp_t").value.trim();if(!t){m.textContent="Choose a district and a building, or type a plot number.";return}var nm=bs.value?bs.options[bs.selectedIndex].textContent:"",nt=document.getElementById("bpp_n").value.trim();m.textContent="Sending...";'
    + 'fetch("/momo/work/passports/api"+location.search,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({op:"request",reader:(document.querySelector("#bpp_r input:checked")||{}).value||"broker",text:t,note:(nm?nm+(nt?" \\u2014 ":""):"")+nt})}).then(function(r){return r.json()}).then(function(j){if(j.ok){m.textContent="Requested. It shows below while it is being made (a few minutes).";setTimeout(function(){location.reload()},1200)}else m.textContent=j.error||"That did not go through."}).catch(function(){m.textContent="That did not go through."})}})()</script>';
}

export async function bppRoute(request, env, url, deps) {
  const p = url.pathname, key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const who = typeof deps.person === "function" ? deps.person(env, url) : "";
  if (!BPP_PEOPLE.includes(who) || (who === "najjuko" && typeof deps.isNaj === "function" && !deps.isNaj(env, url))) return new Response("not found", { status: 404 });
  const reqs = async () => (await Promise.all((await readReqIds(env)).slice(-20).map((id) => readReq(env, id)))).filter(Boolean);
  if (p === "/momo/work/passports" && request.method === "GET")
    return new Response(deps.page(key, rk, bppBody(key, rk, await readBppIndex(env), await reqs(), url.origin, who)), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  if (p === "/momo/work/passports/list" && request.method === "GET") return J({ passports: bppSorted(await readBppIndex(env)), requests: await reqs() });
  if (p === "/momo/work/passports/api" && request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) {}
    if (b.op === "cleanup") return who === "kendall" ? J(await bppCleanup(env, b.confirm)) : J({ ok: false, error: "Not allowed." }, 403);   // v728 - one-off, dry run unless confirmed
    if (b.op !== "request") return J({ ok: false, error: "Unknown action." }, 400);
    const text = String(b.text || "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (text.length < 2) return J({ ok: false, error: "Type a building name or a plot number." }, 400);
    const ids = await readReqIds(env);
    if (ids.length >= 200) return J({ ok: false, error: "Too many open requests." }, 429);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await putReq(env, id, { id, text, note: String(b.note || "").slice(0, 300), reader: readerFor(b.reader), at: new Date().toISOString(), by: who, status: "pending" });   // v727 - reader (default broker)
    const cur = await readReqIds(env);   // re-read just before the write
    await env.MEETINGS.put("bpp_requests", JSON.stringify(cur.concat(id).slice(-200)));
    return J({ ok: true, id });
  }
  return new Response("not found", { status: 404 });
}
