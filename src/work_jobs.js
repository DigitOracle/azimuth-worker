// v631 - MOMO WORK - JOBS (Kendall 26 Oct 2026: the finished job-search app becomes one more icon inside Momo Work).
// PHASE 2: the daily feed - the worker fetches the public jobs.json (public listings only), keeps a copy in KV (3 h refresh, 7-day expiry) and the page shows it as five accordion groups.
// PHASE 3: ONE shared record (jobs_rec_najjuko, v2) holding the profile, the CV share links, the view choices, the applied map and the letter templates. Both Najjuko's key and the owner's
// insider key open the SAME record. THIS REPO IS PUBLIC: no person's details, CV text or letter wording live in code - they live in the KV record, entered through the page or seeded once.
// Spec: Client_Engagements/RealEstateBroker/02_Execution/JOB_TILE_MOMO_SPEC.md (UPDATE 26 Oct 2026 late).
import { JOBS_JS, JOBS_BODY } from "./work_jobs_page.js";
export const JOBS_FEED_URL = "https://jobsearch-template.vercel.app/jobs.json";
export const JOBS_CACHE_KEY = "jobs_feed_cache", JOBS_REC_KEY = "jobs_rec_najjuko";
const FRESH_MS = 3 * 3600 * 1000, KV_TTL = 7 * 86400;
const GROUP_KEYS = ["MKT", "DIG", "PR", "BD", "RE"], DOC_KEYS = GROUP_KEYS.concat(["PORT", "OTHER"]), CITIES = ["Dubai", "Abu Dhabi", "Sharjah"];
const S = (v, n) => String(v == null ? "" : v).slice(0, n);
const httpUrl = (v, n) => (/^https?:\/\//i.test(String(v || "").trim()) ? S(String(v).trim(), n || 500) : "");

export function cleanFeed(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const jobs = (Array.isArray(o.jobs) ? o.jobs : []).slice(0, 300).map((j) => ({
    c: S(j && j.c, 120), t: S(j && j.t, 200), u: httpUrl(j && j.u), k: S(j && j.k, 40), d: S(j && j.d, 10), n: j && j.n ? 1 : 0, s: S(j && j.s, 20), l: S(j && j.l, 48),
  })).filter((j) => j.t);
  return { updated: S(o.updated, 10), at: /^\d\d:\d\d$/.test(String(o.at || "")) ? String(o.at) : "", total: jobs.length, new: jobs.filter((j) => j.n).length, jobs };
}

// force = the page's Refresh button: skip the 3 h wait. Nothing changed = the same copy comes back, so the page can say "no newer list yet".
export async function jobsFeed(env, fetchFn, force) {
  let cached = null; try { cached = JSON.parse(await env.MEETINGS.get(JOBS_CACHE_KEY)); } catch (e) {}
  const age = cached && cached.fetchedAt ? Date.now() - Date.parse(cached.fetchedAt) : Infinity;
  if (!force && cached && cached.feed && age < FRESH_MS) return Object.assign({}, cached.feed, { stale: false, fetchedAt: cached.fetchedAt });
  try {
    const r = await (fetchFn || fetch)(JOBS_FEED_URL, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("status " + r.status);
    const feed = cleanFeed(await r.json()), fetchedAt = new Date().toISOString();
    await env.MEETINGS.put(JOBS_CACHE_KEY, JSON.stringify({ fetchedAt, feed }), { expirationTtl: KV_TTL });
    return Object.assign({}, feed, { stale: false, fetchedAt });
  } catch (e) {
    if (cached && cached.feed) return Object.assign({}, cached.feed, { stale: true, fetchedAt: cached.fetchedAt });
    return { updated: "", at: "", total: 0, new: 0, jobs: [], stale: true, fetchedAt: "" };
  }
}

// ---- the shared record (v2) ----
export const emptyRec = () => ({ v: 2, updatedAt: "", profile: { name: "", headline: "", location: "", email: "", phone: "", bio: "", direct: "", indirect: "", cvPrefix: "" },
  docs: {}, view: { groups: GROUP_KEYS.slice(), cities: ["Dubai", "Abu Dhabi"], avoid: "" }, applied: {}, hidden: {}, fit: [], tpl: { auto: "", headlines: [], why: [], letters: {} }, ish: {} });
const DATE_RE = /^\d{4}-\d\d-\d\d$/;
// v635 - applied entries are objects {d: date, c: company, t: title, g: group, f: follow-up date}; the old plain date string still reads
export function cleanApplied(a) {
  a = a && typeof a === "object" ? a : {}; const o = {};
  Object.keys(a).slice(0, 2000).forEach((k) => {
    const u = httpUrl(k); if (!u) return; const v = a[k];
    const e = typeof v === "string" ? { d: v } : v && typeof v === "object" ? v : null; if (!e || !DATE_RE.test(String(e.d || ""))) return;
    const r = { d: e.d }; if (e.c) r.c = S(e.c, 120); if (e.t) r.t = S(e.t, 200); if (GROUP_KEYS.includes(e.g)) r.g = e.g; if (DATE_RE.test(String(e.f || ""))) r.f = e.f; o[u] = r;
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
export function cleanDocs(d) { d = d && typeof d === "object" ? d : {}; const o = {}; DOC_KEYS.forEach((k) => { const u = httpUrl(d[k]); if (u) o[k] = u; }); return o; }
export function cleanView(v) {
  v = v && typeof v === "object" ? v : {};
  const groups = (Array.isArray(v.groups) ? v.groups : []).filter((g) => GROUP_KEYS.includes(g)), cities = (Array.isArray(v.cities) ? v.cities : []).filter((c) => CITIES.includes(c));
  return { groups: groups.length ? groups : GROUP_KEYS.slice(), cities: cities.length ? cities : ["Dubai"], avoid: S(v.avoid, 300).trim() };
}
export function cleanTpl(t) {
  t = t && typeof t === "object" ? t : {};
  const letters = {}; GROUP_KEYS.forEach((g) => { const l = (t.letters && t.letters[g]) || {}; letters[g] = { hook: S(l.hook, 1200), proof: S(l.proof, 2000), close: S(l.close, 800) }; });
  const list = (a, n) => (Array.isArray(a) ? a : []).slice(0, n).map((x) => S(x, 200)).filter(Boolean);
  return { auto: S(t.auto, 600), headlines: list(t.headlines, 12), why: list(t.why, 12), letters };
}
export async function readRec(env) {
  let r = null; try { r = JSON.parse(await env.MEETINGS.get(JOBS_REC_KEY)); } catch (e) {}
  const e = emptyRec(); if (!r || typeof r !== "object") return e;
  return { v: 2, updatedAt: S(r.updatedAt, 30), profile: Object.assign(e.profile, cleanProfile(r.profile)), docs: cleanDocs(r.docs), view: cleanView(r.view),
    applied: cleanApplied(r.applied), hidden: cleanHidden(r.hidden), fit: cleanFit(r.fit), tpl: cleanTpl(r.tpl), ish: r.ish && typeof r.ish === "object" ? r.ish : {} };
}
export async function jobsApi(env, b) {
  const rec = await readRec(env);
  switch (b && b.action) {
    case "save_profile": rec.profile = Object.assign(rec.profile, cleanProfile(b.profile)); break;
    case "save_docs": rec.docs = cleanDocs(b.docs); break;
    case "save_view": rec.view = cleanView(b.view); break;
    case "save_tpl": rec.tpl = cleanTpl(b.tpl); break;
    case "save_fit": rec.fit = cleanFit(b.fit); break;
    case "mark_applied": {
      const u = httpUrl(b.url); if (!u) return { error: "No advert link.", status: 400 };
      if (b.on === false) delete rec.applied[u];
      else {
        const prev = rec.applied[u] || {}, d = DATE_RE.test(String(b.date || "")) ? b.date : new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
        rec.applied[u] = cleanApplied({ [u]: { d: prev.d || d, c: b.c || prev.c, t: b.t || prev.t, g: b.g || prev.g, f: prev.f } })[u] || { d };
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
  await env.MEETINGS.put(JOBS_REC_KEY, JSON.stringify(rec));
  return { ok: true, rec };
}

export const JOBS_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>';

export async function jobsRoute(request, env, url, deps) {
  const p = url.pathname, key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (!deps.isAny(env, url)) return new Response("not found", { status: 404 });
  if (p === "/momo/work/jobs/feed" && request.method === "GET") return J(await jobsFeed(env, deps.fetch, url.searchParams.get("fresh") === "1"));
  if (p === "/momo/work/jobs/rec" && request.method === "GET") return J(await readRec(env));
  if (p === "/momo/work/jobs/api" && request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { return J({ error: "Send JSON." }, 400); }
    const r = await jobsApi(env, b); return r.error ? J({ error: r.error }, r.status || 400) : J(r);
  }
  if (p === "/momo/work/jobs" && request.method === "GET") return new Response(deps.page(key, rk, JOBS_BODY + "<script>" + JOBS_JS + "</script>"), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  return null;
}
