// v631 - MOMO WORK - JOBS (Kendall 26 Oct 2026: the finished job-search app becomes one more icon inside Momo Work).
// PHASE 2: the daily feed - the worker fetches the public jobs.json (public listings only), keeps a copy in KV (3 h refresh, 7-day expiry) and the page shows it as five accordion groups.
// PHASE 3: ONE shared record (jobs_rec_najjuko, v2) holding the profile, the CV share links, the view choices, the applied map and the letter templates. Both Najjuko's key and the owner's
// insider key open the SAME record. THIS REPO IS PUBLIC: no person's details, CV text or letter wording live in code - they live in the KV record, entered through the page or seeded once.
// Spec: Client_Engagements/RealEstateBroker/02_Execution/JOB_TILE_MOMO_SPEC.md (UPDATE 26 Oct 2026 late).
import { JOBS_JS, JOBS_BODY } from "./work_jobs_page.js";
import { whatApi, readWhat, cvDraftApi } from "./work_jobs_ai.js";
export const JOBS_FEED_URL = "https://jobsearch-template.vercel.app/jobs.json";
export const JOBS_CACHE_KEY = "jobs_feed_cache", JOBS_REC_KEY = "jobs_rec_najjuko";
// v639 - ONE RECORD PER PERSON: the key that signs in is mapped to a person id (index.js personOfKey: ins_najjuko_* -> najjuko, ins_kendall_* -> kendall, anything else is refused) and every key below carries that id.
// Najjuko's existing keys keep their names exactly (jobs_rec_najjuko, jobs_cv_najjuko_<group>, jobs_cvmeta_najjuko). A person's groups, match words and own feed address live in THEIR record, never in code.
export const PEOPLE_IDS = ["najjuko", "kendall"];
export const recKey = (p) => "jobs_rec_" + p, cvKey = (p, g) => "jobs_cv_" + p + "_" + g, cvMetaKey = (p) => "jobs_cvmeta_" + p, feedKey = (p) => "jobs_feed_cache_" + p;
export const DEFAULT_GROUPS = [{ k: "MKT", n: "Marketing & brand" }, { k: "DIG", n: "Digital, social & content" }, { k: "PR", n: "Communications & PR" }, { k: "BD", n: "Business development & sales" }, { k: "RE", n: "Real estate & property" }];
const RESERVED = ["PORT", "OTHER"];
export const ICON_NAMES = ["chip", "city", "server", "shield", "cap", "megaphone", "phone", "trend", "home", "briefcase"];   // a group may name one of these drawings for its card; anything else gets the default
const FRESH_MS = 3 * 3600 * 1000, KV_TTL = 7 * 86400;
const GROUP_KEYS = DEFAULT_GROUPS.map((g) => g.k), CITIES = ["Dubai", "Abu Dhabi", "Sharjah"];
const S = (v, n) => String(v == null ? "" : v).slice(0, n);
const httpUrl = (v, n) => (/^https?:\/\//i.test(String(v || "").trim()) ? S(String(v).trim(), n || 500) : "");

export function cleanGroups(g) {   // [{k: 2-4 capital letters, n: label}], at most 8; nothing usable = the default five
  const seen = {}, o = [];
  (Array.isArray(g) ? g : []).slice(0, 8).forEach((x) => {
    const k = String((x && x.k) || "").trim(); if (!/^[A-Z]{2,4}$/.test(k) || RESERVED.includes(k) || seen[k]) return;
    seen[k] = 1; o.push({ k, n: S((x && (x.n || x.name)) || "", 60).trim() || k, i: ICON_NAMES.includes(x && x.i) ? x.i : "" });
  });
  return o.length ? o : DEFAULT_GROUPS.map((x) => Object.assign({}, x));
}
export function cleanClassify(c, gk) {   // group -> words that put a job title in that group (the person's own words, kept in the record)
  c = c && typeof c === "object" ? c : {}; const o = {};
  gk.forEach((k) => { const a = Array.isArray(c[k]) ? c[k] : []; const w = a.slice(0, 40).map((x) => S(x, 30).toLowerCase()).filter((x) => x.trim()); if (w.length) o[k] = w; });
  const ord = (Array.isArray(c._order) ? c._order : []).filter((k) => gk.includes(k)); if (ord.length) o._order = ord;   // which group is tried first; _else is where a title that matches nothing goes
  if (gk.includes(c._else)) o._else = c._else;
  return o;
}
export function cleanFeedUrl(u) {   // an own feed address: https, and only a host we recognise as a static site or worker
  try { const x = new URL(String(u || "").trim()); if (x.protocol !== "https:") return ""; if (!(x.hostname.endsWith(".vercel.app") || x.hostname.endsWith(".workers.dev"))) return ""; return S(x.toString(), 300); } catch (e) { return ""; }
}
const keysOf = (gk) => (Array.isArray(gk) && gk.length ? gk : GROUP_KEYS);

export function cleanFeed(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const jobs = (Array.isArray(o.jobs) ? o.jobs : []).slice(0, 300).map((j) => ({
    c: S(j && j.c, 120), t: S(j && j.t, 200), u: httpUrl(j && j.u), k: S(j && j.k, 40), d: S(j && j.d, 10), n: j && j.n ? 1 : 0, s: S(j && j.s, 20), l: S(j && j.l, 48), x: S(String((j && j.x) || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(), 2000),
  })).filter((j) => j.t);
  return { updated: S(o.updated, 10), at: /^\d\d:\d\d$/.test(String(o.at || "")) ? String(o.at) : "", total: jobs.length, new: jobs.filter((j) => j.n).length, jobs };
}

// force = the page's Refresh button: skip the 3 h wait. Nothing changed = the same copy comes back, so the page can say "no newer list yet".
export async function jobsFeed(env, fetchFn, force, person, feedUrl) {
  const ck = person ? feedKey(person) : JOBS_CACHE_KEY, src = cleanFeedUrl(feedUrl) || JOBS_FEED_URL;
  let cached = null; try { cached = JSON.parse(await env.MEETINGS.get(ck)); } catch (e) {}
  if (cached && cached.src && cached.src !== src) cached = null;   // the person pointed to a different feed: the old copy is not theirs any more
  const age = cached && cached.fetchedAt ? Date.now() - Date.parse(cached.fetchedAt) : Infinity;
  if (!force && cached && cached.feed && age < FRESH_MS) return Object.assign({}, cached.feed, { stale: false, fetchedAt: cached.fetchedAt });
  try {
    const r = await (fetchFn || fetch)(src, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("status " + r.status);
    const feed = cleanFeed(await r.json()), fetchedAt = new Date().toISOString();
    await env.MEETINGS.put(ck, JSON.stringify({ fetchedAt, feed, src }), { expirationTtl: KV_TTL });
    return Object.assign({}, feed, { stale: false, fetchedAt });
  } catch (e) {
    if (cached && cached.feed) return Object.assign({}, cached.feed, { stale: true, fetchedAt: cached.fetchedAt });
    return { updated: "", at: "", total: 0, new: 0, jobs: [], stale: true, fetchedAt: "" };
  }
}

// ---- the shared record (v2) ----
export const emptyRec = (gk) => ({ v: 2, updatedAt: "", groups: gk ? gk.map((k) => Object.assign({}, DEFAULT_GROUPS.find((d) => d.k === k) || { k, n: k })) : DEFAULT_GROUPS.map((x) => Object.assign({}, x)), classify: {}, feedUrl: "", profile: { name: "", headline: "", location: "", email: "", phone: "", bio: "", direct: "", indirect: "", cvPrefix: "" },
  docs: {}, view: { groups: keysOf(gk).slice(), cities: ["Dubai", "Abu Dhabi"], avoid: "" }, applied: {}, hidden: {}, fit: [], tpl: { auto: "", headlines: [], why: [], letters: {} }, ish: {} });
const DATE_RE = /^\d{4}-\d\d-\d\d$/;
// v635 - applied entries are objects {d: date, c: company, t: title, g: group, f: follow-up date}; the old plain date string still reads
export function cleanApplied(a, gk) {
  a = a && typeof a === "object" ? a : {}; const o = {};
  Object.keys(a).slice(0, 2000).forEach((k) => {
    const u = httpUrl(k); if (!u) return; const v = a[k];
    const e = typeof v === "string" ? { d: v } : v && typeof v === "object" ? v : null; if (!e || !DATE_RE.test(String(e.d || ""))) return;
    const r = { d: e.d }; if (e.c) r.c = S(e.c, 120); if (e.t) r.t = S(e.t, 200); if (keysOf(gk).includes(e.g)) r.g = e.g; if (DATE_RE.test(String(e.f || ""))) r.f = e.f; o[u] = r;
  });
  return o;
}
export function cleanHidden(h) {
  h = h && typeof h === "object" ? h : {}; const o = {};
  Object.keys(h).slice(0, 3000).forEach((k) => { const u = httpUrl(k); if (u && DATE_RE.test(String(h[k] || ""))) o[u] = h[k]; });
  return o;
}
// her own extra words for the match score (optional, kept in the record, never in code)
export function cleanFit(f) { return (Array.isArray(f) ? f : []).slice(0, 40).map((x) => S(x, 30).trim().toLowerCase()).filter(Boolean); }
export function cleanProfile(p) {
  p = p && typeof p === "object" ? p : {};
  const o = {}; ["name", "headline", "location", "email", "phone", "cvPrefix"].forEach((k) => { o[k] = S(p[k], 120).trim(); }); o.bio = S(p.bio, 800).trim();
  ["direct", "indirect"].forEach((k) => { o[k] = S(p[k], 8).replace(/[^\d\-+ ]/g, "").trim(); }); return o;
}
export function cleanDocs(d, gk) { d = d && typeof d === "object" ? d : {}; const o = {}; keysOf(gk).concat(RESERVED).forEach((k) => { const u = httpUrl(d[k]); if (u) o[k] = u; }); return o; }
export function cleanView(v, gk) {
  v = v && typeof v === "object" ? v : {}; gk = keysOf(gk);
  const groups = (Array.isArray(v.groups) ? v.groups : []).filter((g) => gk.includes(g)), cities = (Array.isArray(v.cities) ? v.cities : []).filter((c) => CITIES.includes(c));
  return { groups: groups.length ? groups : gk.slice(), cities: cities.length ? cities : ["Dubai"], avoid: S(v.avoid, 300).trim() };
}
export function cleanTpl(t, gk) {
  t = t && typeof t === "object" ? t : {};
  const letters = {}; keysOf(gk).forEach((g) => { const l = (t.letters && t.letters[g]) || {}; letters[g] = { hook: S(l.hook, 1200), proof: S(l.proof, 2000), close: S(l.close, 800) }; });
  const list = (a, n) => (Array.isArray(a) ? a : []).slice(0, n).map((x) => S(x, 200)).filter(Boolean);
  return { auto: S(t.auto, 600), headlines: list(t.headlines, 12), why: list(t.why, 12), letters };
}
export async function readRec(env, person) {
  person = person || "najjuko";
  let r = null; try { r = JSON.parse(await env.MEETINGS.get(recKey(person))); } catch (e) {}
  const groups = cleanGroups(r && r.groups), gk = groups.map((g) => g.k), e = emptyRec(gk);
  if (!r || typeof r !== "object") return Object.assign(e, { person });
  return { v: 2, person, updatedAt: S(r.updatedAt, 30), groups, classify: cleanClassify(r.classify, gk), feedUrl: cleanFeedUrl(r.feedUrl), profile: Object.assign(e.profile, cleanProfile(r.profile)), docs: cleanDocs(r.docs, gk), view: cleanView(r.view, gk),
    applied: cleanApplied(r.applied, gk), hidden: cleanHidden(r.hidden), fit: cleanFit(r.fit), tpl: cleanTpl(r.tpl, gk), ish: r.ish && typeof r.ish === "object" ? r.ish : {} };
}
export async function jobsApi(env, b, person) {
  person = person || "najjuko";
  const rec = await readRec(env, person), gk = rec.groups.map((g) => g.k);
  switch (b && b.action) {
    case "save_profile": rec.profile = Object.assign(rec.profile, cleanProfile(b.profile)); break;
    case "save_docs": rec.docs = cleanDocs(b.docs, gk); break;
    case "save_view": rec.view = cleanView(b.view, gk); break;
    case "save_tpl": rec.tpl = cleanTpl(b.tpl, gk); break;
    case "save_groups": {   // the person's own groups, match words and (optional) own feed address
      rec.groups = cleanGroups(b.groups); const nk = rec.groups.map((g) => g.k);
      rec.classify = cleanClassify(b.classify, nk); rec.feedUrl = cleanFeedUrl(b.feedUrl);
      rec.docs = cleanDocs(rec.docs, nk); rec.view = cleanView(rec.view, nk); rec.tpl = cleanTpl(rec.tpl, nk); rec.applied = cleanApplied(rec.applied, nk); break;
    }
    case "save_fit": rec.fit = cleanFit(b.fit); break;
    case "mark_applied": {
      const u = httpUrl(b.url); if (!u) return { error: "No advert link.", status: 400 };
      if (b.on === false) delete rec.applied[u];
      else {
        const prev = rec.applied[u] || {}, d = DATE_RE.test(String(b.date || "")) ? b.date : new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
        rec.applied[u] = cleanApplied({ [u]: { d: prev.d || d, c: b.c || prev.c, t: b.t || prev.t, g: b.g || prev.g, f: prev.f } }, gk)[u] || { d };
      }
      const keys = Object.keys(rec.applied); if (keys.length > 800) keys.sort((a, c) => String(rec.applied[a].d).localeCompare(String(rec.applied[c].d))).slice(0, keys.length - 800).forEach((k) => delete rec.applied[k]);
      break;
    }
    case "mark_followed": {
      const u = httpUrl(b.url); if (!u || !rec.applied[u]) return { error: "Not an applied role.", status: 400 };
      rec.applied[u].f = DATE_RE.test(String(b.date || "")) ? b.date : new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10); break;
    }
    case "set_hidden": {   // urls: the same role on several boards; on:false brings it back
      const urls = (Array.isArray(b.urls) ? b.urls : []).slice(0, 6).map((x) => httpUrl(x)).filter(Boolean); if (!urls.length) return { error: "No advert link.", status: 400 };
      const d = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
      urls.forEach((u) => { if (b.on === false) delete rec.hidden[u]; else rec.hidden[u] = d; });
      const hk = Object.keys(rec.hidden); if (hk.length > 1500) hk.sort((a, c) => rec.hidden[a].localeCompare(rec.hidden[c])).slice(0, hk.length - 1500).forEach((k) => delete rec.hidden[k]);
      break;
    }
    default: return { error: "Unknown action.", status: 400 };
  }
  rec.updatedAt = new Date().toISOString();
  await env.MEETINGS.put(recKey(person), JSON.stringify(rec));
  return { ok: true, rec };
}

// v636 - CVs uploaded once and kept in Momo's KV (not on the phone): jobs_cv_najjuko_<group> holds the file as base64, jobs_cvmeta_najjuko the list of names and sizes.
// Checked by extension AND the file's first bytes, 6 MB cap; the files themselves never appear in the repo or the tests.
export const CV_KEY = "jobs_cv_najjuko_", CV_META_KEY = "jobs_cvmeta_najjuko", CV_MAX = 6 * 1024 * 1024;
const CV_TYPES = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
export function cvKind(name, bytes) {   // the type, only when the extension and the first bytes agree
  const ext = String(name || "").toLowerCase().split(".").pop(), b = bytes || [];
  if (ext === "pdf" && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "pdf";
  if (ext === "docx" && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return "docx";
  if (ext === "doc" && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 && b[4] === 0xa1 && b[5] === 0xb1 && b[6] === 0x1a && b[7] === 0xe1) return "doc";
  return "";
}
export async function readCvMeta(env, person, gk) {
  let m = null; try { m = JSON.parse(await env.MEETINGS.get(cvMetaKey(person || "najjuko"))); } catch (e) {}
  const o = {}; keysOf(gk).forEach((g) => { const x = m && m[g]; if (x && typeof x === "object") o[g] = { name: S(x.name, 120), type: CV_TYPES[x.type] ? x.type : "pdf", size: Math.max(0, Math.min(CV_MAX, +x.size || 0)), at: S(x.at, 30) }; });
  return o;
}
export async function cvApi(env, b, person, gk) {
  person = person || "najjuko";
  const g = b && b.group; if (!keysOf(gk).includes(g)) return { error: "Choose one of your CV groups.", status: 400 };
  const meta = await readCvMeta(env, person, gk);
  if (b.action === "delete") { await env.MEETINGS.delete(cvKey(person, g)); delete meta[g]; await env.MEETINGS.put(cvMetaKey(person), JSON.stringify(meta)); return { ok: true, cv: meta }; }
  if (b.action !== "put") return { error: "Unknown action.", status: 400 };
  const name = Array.from(S(b.name, 120)).filter((ch) => ch.charCodeAt(0) > 31 && !"\\/:*?\"<>|".includes(ch)).join("").trim(), b64 = String(b.data || "").replace(/\s+/g, "");
  if (!name || !b64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { error: "That file did not arrive. Try again.", status: 400 };
  if (Math.floor(b64.length * 3 / 4) > CV_MAX + 3) return { error: "That file is over 6 MB. Save a smaller copy.", status: 413 };
  let bytes; try { const bin = atob(b64); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); } catch (e) { return { error: "That file did not arrive. Try again.", status: 400 }; }
  if (bytes.length > CV_MAX) return { error: "That file is over 6 MB. Save a smaller copy.", status: 413 };
  const kind = cvKind(name, bytes); if (!kind) return { error: "Upload a PDF or Word file (.pdf, .doc or .docx).", status: 400 };
  await env.MEETINGS.put(cvKey(person, g), b64);
  meta[g] = { name, type: kind, size: bytes.length, at: new Date().toISOString() };
  await env.MEETINGS.put(cvMetaKey(person), JSON.stringify(meta));
  return { ok: true, cv: meta };
}

export const JOBS_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>';

export async function jobsRoute(request, env, url, deps) {
  const p = url.pathname, key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  // v639 - the signing key decides whose record this is. A key that is nobody's gets "not found"; one person never reads or writes the other's record, CVs, drafts or Work-log lines.
  const person = typeof deps.person === "function" ? deps.person(env, url) : "";
  if (!PEOPLE_IDS.includes(person)) return new Response("not found", { status: 404 });
  const her = person === "najjuko" && !!deps.isNaj(env, url), J404 = () => new Response("not found", { status: 404 });
  const rec = await readRec(env, person), gk = rec.groups.map((g) => g.k);
  if (her) {
    const xd = Object.assign({}, deps, { names: deps.names || [] });
    if (p === "/momo/work/jobs/whatido" && request.method === "GET") return J(await readWhat(env));
    if (p === "/momo/work/jobs/whatido" && request.method === "POST") {
      let b = {}; try { b = await request.json(); } catch (e) { return J({ error: "Send JSON." }, 400); }
      const r = await whatApi(env, b, xd); return r.error ? J({ error: r.error }, r.status || 400) : J(r);
    }
  }
  if (p === "/momo/work/jobs/whatido") return J404();
  if (p === "/momo/work/jobs/cvdraft" && request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { return J({ error: "Send JSON." }, 400); }
    const r = await cvDraftApi(env, b, Object.assign({}, deps, { names: deps.names || [] }), rec, { what: her }); return r.error ? J({ error: r.error }, r.status || 400) : J(r);
  }
  if (p === "/momo/work/jobs/feed" && request.method === "GET") return J(await jobsFeed(env, deps.fetch, url.searchParams.get("fresh") === "1", person, rec.feedUrl));
  if (p === "/momo/work/jobs/rec" && request.method === "GET") return J(Object.assign(rec, { me: true, person, canWhat: her }));
  if (p === "/momo/work/jobs/cv" && request.method === "GET") return J({ cv: await readCvMeta(env, person, gk) });
  if (p === "/momo/work/jobs/cv" && request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { return J({ error: "Send JSON." }, 400); }
    const r = await cvApi(env, b, person, gk); return r.error ? J({ error: r.error }, r.status || 400) : J(r);
  }
  if (/^\/momo\/work\/jobs\/cv\/[A-Z]+$/.test(p) && request.method === "GET") {
    const g = p.split("/").pop(), meta = await readCvMeta(env, person, gk); if (!gk.includes(g) || !meta[g]) return new Response("not found", { status: 404 });
    const b64 = await env.MEETINGS.get(cvKey(person, g)); if (!b64) return new Response("not found", { status: 404 });
    const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Response(u, { headers: { "Content-Type": CV_TYPES[meta[g].type], "Content-Disposition": 'attachment; filename="' + meta[g].name.replace(/"/g, "") + '"', "Cache-Control": "no-store" } });
  }
  if (p === "/momo/work/jobs/api" && request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { return J({ error: "Send JSON." }, 400); }
    const r = await jobsApi(env, b, person); return r.error ? J({ error: r.error }, r.status || 400) : J(r);
  }
  if (p === "/momo/work/jobs" && request.method === "GET") return new Response(deps.page(key, rk, JOBS_BODY + "<script>" + JOBS_JS + "</script>"), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  return null;
}
