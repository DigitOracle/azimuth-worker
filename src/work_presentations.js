// v684 (Kendall, 1 Nov 2026): the Presentations card on Najjuko's Momo front door (and Kendall's), modelled on src/work_sheets.js.
// One entry = one talk or event: the deck (PPTX), its PDF and a walkthrough video (or a link to one). KV keys in MEETINGS:
//   pres_index               JSON list of {slug, title, date?, pptx?: true, pdf?: true, video_key?, video_url?, slides_url?}
//   pres_file_<slug>_pptx    the PowerPoint file
//   pres_file_<slug>_pdf     the PDF
//   vid_<video_key>          the video, through the existing /video_upload + /video/<key> route (KV up to 24 MB; R2 MEDIA fallback)
// Public, no key (so a recipient can open what she sends): /pres/<slug> share page (Download PPTX, Open PDF, Watch),
// /pres/f/<slug>.pptx and /pres/f/<slug>.pdf the files.
// New entries: upload the files and merge the entry into pres_index BY SLUG (re-read just before the write, never from a stale copy); no deploy.
const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const SLUG_RE = /^[a-z0-9-]{1,60}$/;
const VKEY_RE = /^[a-z0-9_]{1,80}$/i;
const CT = { pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", pdf: "application/pdf" };
import { dubaiDay, readSpk } from "./work_speaking.js";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const PRES_ICON = '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/><path d="M10 8.5v4l3.5-2z"/>';
export const PRES_PEOPLE = ["najjuko", "kendall"];

export const presDate = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || "")); return m ? parseInt(m[3], 10) + " " + MONTHS[parseInt(m[2], 10) - 1] + " " + m[1] : ""; };
const cleanUrl = (u) => { const s = String(u || "").trim(); return /^https:\/\/[^\s"<>]+$/i.test(s) ? s : ""; };
// what the public page and the card may use: a well-formed entry, nothing else
export function cleanEntry(x) {
  if (!x || !SLUG_RE.test(String(x.slug || "")) || !String(x.title || "").trim()) return null;
  const e = { slug: String(x.slug), title: String(x.title).replace(/\s+/g, " ").trim().slice(0, 120) };
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(x.date || ""))) e.date = String(x.date);
  if (x.pptx) e.pptx = true;
  if (x.pdf) e.pdf = true;
  if (x.video_key && VKEY_RE.test(String(x.video_key))) e.video_key = String(x.video_key);
  else if (cleanUrl(x.video_url)) e.video_url = cleanUrl(x.video_url);
  if (/^https:\/\/docs\.google\.com\/presentation\//.test(cleanUrl(x.slides_url))) e.slides_url = cleanUrl(x.slides_url);
  return e;
}
export async function readPresIndex(env) {
  let r = [];
  try { r = JSON.parse(await env.MEETINGS.get("pres_index")) || []; } catch (e) {}
  return Array.isArray(r) ? r.map(cleanEntry).filter(Boolean) : [];
}
// newest first by date, undated last
export const presSorted = (items) => items.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

// v733 (Kendall, 4 Nov 2026): a presentation whose date has passed (Dubai day) moves into the "Archived" child section; nothing is deleted.
// Its date, in order: (1) a linked speaking engagement in speaking_rec_kendall (its endDate, else date) - linked when the engagement's id is the
// slug, or one of its materials links to /pres/<slug>; (2) the entry's own date; (3) a date in the slug or title (3nov2026, 2026-11-03, 3 Nov 2026).
// No date found -> the main list, marked "Date unknown" so it can be fixed.
const MON3 = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n) => (n < 10 ? "0" : "") + n;
const okDay = (y, mo, d) => { const t = new Date(Date.UTC(y, mo - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? y + "-" + pad(mo) + "-" + pad(d) : ""; };
export function dateInText(s) {
  const x = String(s || "").toLowerCase();
  let m = /(20\d{2})-(\d{2})-(\d{2})/.exec(x); if (m) { const r = okDay(+m[1], +m[2], +m[3]); if (r) return r; }
  m = /(?:^|[^0-9])(\d{1,2})[\s-]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s-]?(20\d{2})/.exec(x);
  if (m) { const r = okDay(+m[3], MON3.indexOf(m[2]) + 1, +m[1]); if (r) return r; }
  return "";
}
export function spkLinks(items) {
  const by = {};
  (Array.isArray(items) ? items : []).forEach((i) => {
    if (!i || i.status === "cancelled") return; const d = i.endDate || i.date; if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ""))) return;
    const keys = [String(i.id || "")]; (Array.isArray(i.materials) ? i.materials : []).forEach((m) => { const k = /\/pres\/([a-z0-9-]{1,60})(?:[/?#]|$)/.exec(String(m && m.url || "")); if (k) keys.push(k[1]); });
    keys.forEach((k) => { if (k && (!by[k] || d > by[k].date)) by[k] = { date: d, title: String(i.title || "") }; });
  });
  return by;
}
export function presWhen(e, links) {
  const l = links && links[e.slug]; if (l) return { date: l.date, from: "speaking" };
  if (e.date) return { date: e.date, from: "entry" };
  const d = dateInText(e.slug) || dateInText(e.title); return d ? { date: d, from: "text" } : { date: "", from: "" };
}
// {main, archived}: archived = date before today (Dubai), newest first; main = today or later, then undated
export function presSplit(items, today, links) {
  const t = today || dubaiDay(), main = [], archived = [];
  items.forEach((e) => { const w = presWhen(e, links), x = Object.assign({}, e, { when: w.date, whenFrom: w.from }); (w.date && w.date < t ? archived : main).push(x); });
  main.sort((a, b) => (a.when ? 0 : 1) - (b.when ? 0 : 1) || String(a.when).localeCompare(String(b.when)));
  archived.sort((a, b) => String(b.when).localeCompare(String(a.when)));
  return { main, archived };
}
async function presLinks(env) { try { const r = await readSpk(env, "kendall"); return spkLinks(r && r.items); } catch (e) { return {}; } }
// merge ONE entry by slug into what is stored NOW (fields given replace, fields not given are kept)
export function mergeEntry(cur, entry) {
  const e = cleanEntry(entry); if (!e) return cur;
  const old = cur.find((x) => x.slug === e.slug);
  const next = Object.assign({}, old || {}, e);
  if (e.video_key) delete next.video_url; else if (e.video_url) delete next.video_key;
  return cur.filter((x) => x.slug !== e.slug).concat(next);
}
export async function putPresEntry(env, entry) {
  const next = mergeEntry(await readPresIndex(env), entry);
  await env.MEETINGS.put("pres_index", JSON.stringify(next)); return next;
}
const videoSrc = (e) => (e.video_key ? "/video/" + e.video_key : e.video_url || "");

export async function presPublic(request, env, url) {
  const p = url.pathname;
  let m = p.match(/^\/pres\/f\/([a-z0-9-]{1,60})\.(pptx|pdf)$/);
  if (m) {
    const e = (await readPresIndex(env)).find((x) => x.slug === m[1]);
    if (!e || !e[m[2]]) return new Response("not found", { status: 404 });
    const b = await env.MEETINGS.get("pres_file_" + m[1] + "_" + m[2], "arrayBuffer");
    return b ? new Response(b, { headers: { "Content-Type": CT[m[2]], "Cache-Control": "public, max-age=3600", "Content-Disposition": (m[2] === "pdf" ? "inline" : "attachment") + '; filename="' + m[1] + "." + m[2] + '"' } }) : new Response("not found", { status: 404 });
  }
  m = p.match(/^\/pres\/([a-z0-9-]{1,60})\/?$/);
  if (m) {
    const e = (await readPresIndex(env)).find((x) => x.slug === m[1]);
    if (!e) return new Response("not found", { status: 404 });
    const v = videoSrc(e), dt = presDate(e.date);
    const btn = (e.pptx ? '<a class=b id=pres_pptx href="/pres/f/' + e.slug + '.pptx" download>Download PPTX</a>' : "")
      + (e.slides_url ? '<a class=b id=pres_slides href="' + esc(e.slides_url) + '" target=_blank rel=noopener>Open in Google Slides</a>' : "")
      + (e.pdf ? '<a class=b id=pres_pdf href="/pres/f/' + e.slug + '.pdf" target=_blank rel=noopener>Open PDF</a>' : "")
      + (v ? '<a class=b id=pres_watch href="' + esc(v) + '"' + (e.video_key ? "" : " target=_blank rel=noopener") + '>Watch</a>' : "");
    return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(e.title) + '</title>'
      + '<meta property="og:title" content="' + esc(e.title) + '"><meta property="og:description" content="Presentation' + (dt ? ", " + esc(dt) : "") + '.">'
      + (e.video_key ? '<meta property="og:video" content="' + esc(url.origin + v) + '">' : "")
      + '<style>body{margin:0;background:#0C1413;color:#E8E4D8;display:flex;flex-direction:column;align-items:center;padding:20px 16px;font-family:system-ui,sans-serif;text-align:center}.w{max-width:720px;width:100%}h1{font-size:1.3rem;font-weight:600;margin:10px 0 4px}.d{color:#8FA39B;font-size:.9rem;margin:0 0 14px}video{width:100%;border-radius:10px;background:#000}a.b{display:inline-block;margin:8px 6px;padding:11px 18px;border-radius:999px;background:#C5A56A;color:#0C1413;font-weight:700;text-decoration:none}</style></head><body><div class=w>'
      + '<h1>' + esc(e.title) + '</h1>' + (dt ? '<p class=d>' + esc(dt) + '</p>' : "")
      + (e.video_key ? '<video id=pres_v controls playsinline preload=metadata src="' + esc(v) + '"></video>' : "")
      + '<div>' + btn + '</div></div></body></html>',
      { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600" } });
  }
  return null;
}

const SIGN = {
  najjuko: "\\n\\nKind regards,\\nNajjuko",
  kendall: "\\n\\nKind regards,\\nDr. Kendall Wilson\\nDigitAlchemy Tech Limited\\ncontact@digitalabbot.io | +971 56 227 6093",
};

export function presBody(key, rk, items, origin, who, opts) {
  const q = "?key=" + encodeURIComponent(key) + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  const o = opts || {}, sp = presSplit(items, o.today, o.links);
  const tile = (e) => {
    const share = origin + "/pres/" + e.slug, dt = presDate(e.when);
    const has = [e.pptx ? "PPTX" : "", e.pdf ? "PDF" : "", videoSrc(e) ? "Video" : ""].filter(Boolean);
    return '<button class=pt type=button data-t="' + esc(e.title) + '" data-s="' + esc(share) + '"><span class=pi><svg viewBox="0 0 24 24" width=26 height=26 fill="none" stroke="#C5A56A" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true>' + PRES_ICON + '</svg></span><span class=px><b>' + esc(e.title) + '</b>' + (dt ? '<i>' + esc(dt) + '</i>' : '<i class=du>Date unknown</i>') + '<span class=ch>' + has.map((h) => '<em>' + h + '</em>').join("") + '</span></span></button>';
  };
  const grid = (xs) => '<div class=pl>' + xs.map(tile).join("") + '</div>';
  let arch = "";
  if (sp.archived.length) {
    let inner;
    if (sp.archived.length > 10) {
      const g = []; sp.archived.forEach((e) => { const k = e.when.slice(0, 7); if (!g.length || g[g.length - 1].k !== k) g.push({ k, xs: [] }); g[g.length - 1].xs.push(e); });
      inner = g.map((x) => '<h3 class=pm>' + MONTHS[+x.k.slice(5, 7) - 1] + " " + x.k.slice(0, 4) + '</h3>' + grid(x.xs)).join("");
    } else inner = grid(sp.archived);
    arch = '<details class=pa id=pres_arch><summary>Archived (' + sp.archived.length + ')</summary>' + inner + '</details>';
  }
  const list = items.length ? (sp.main.length ? grid(sp.main) : '<p class=pn id=pres_none>No upcoming presentations. Past ones are in Archived below.</p>') + arch
    : '<div class=empty id=pres_empty><svg viewBox="0 0 24 24" width=34 height=34 fill="none" stroke="#C5A56A" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true>' + PRES_ICON + '</svg><p><b>Presentations coming</b></p><p>Your decks, their PDFs and the walkthrough videos will appear here, ready to send by WhatsApp or email.</p></div>';
  return '<a class=back href="/momo' + q + '">&#8592; Momo</a><div class=tag>MOMO</div><h1>Presentations</h1>' + list
    + '<div class=sh id=pres_sh><div class=shc><b id=pres_t></b><a class=b id=pres_w target=_blank rel=noopener>WhatsApp</a><a class=b id=pres_e>Email</a><button class=b id=pres_c type=button>Copy link</button><a class="b o" id=pres_o target=_blank rel=noopener>Open</a><button class="b x" id=pres_x type=button>Close</button></div></div>'
    + '<style>.pl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.pt{display:flex;flex-direction:column;gap:10px;align-items:flex-start;min-width:0;overflow-wrap:anywhere;'
    + '}.px i.du{color:#A0522D}.pn{color:#5F6B66;font:500 .9rem "IBM Plex Sans",sans-serif}.pa{margin-top:18px;border-top:1px solid #E7E1D6;padding-top:12px}.pa summary{cursor:pointer;font:600 1rem Fraunces,serif;color:#0A4F4A;padding:6px 0 12px}.pm{font:600 .72rem "IBM Plex Mono",monospace;color:#8A6F3E;letter-spacing:.06em;text-transform:uppercase;margin:12px 0 8px}.pt{border:1px solid #E7E1D6;background:#FFFDF9;border-radius:14px;padding:12px;text-align:left;cursor:pointer;width:100%}.pi{flex:0 0 44px;height:44px;border-radius:10px;background:#0A4F4A;display:flex;align-items:center;justify-content:center}.px{display:flex;flex-direction:column;gap:3px}.px b{font:600 1rem Fraunces,serif;color:#0A4F4A}.px i{font:500 .78rem "IBM Plex Sans",sans-serif;color:#5F6B66;font-style:normal}.ch{display:flex;gap:6px;flex-wrap:wrap}.ch em{font:600 .62rem "IBM Plex Mono",monospace;color:#8A6F3E;border:1px solid #C5A56A;border-radius:999px;padding:2px 8px;font-style:normal}'
    + '.empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:40px 18px;border:1px dashed #C5A56A;border-radius:18px;text-align:center;color:#5F6B66}.empty p{margin:0}.empty b{font-family:Fraunces,serif;font-size:1.1rem;color:#0A4F4A}'
    + '.sh{position:fixed;inset:0;background:rgba(12,20,19,.55);display:none;align-items:flex-end;z-index:50}.sh.on{display:flex}.shc{background:#FAF7F1;width:100%;max-width:560px;margin:0 auto;border-radius:18px 18px 0 0;padding:18px 16px 28px;display:flex;flex-direction:column;gap:8px}.shc b{font-family:Fraunces,serif;font-size:1.05rem;color:#0A4F4A;margin-bottom:6px}.b{border:1px solid #0A4F4A;color:#0A4F4A;background:#fff;border-radius:999px;padding:11px 14px;font:600 .9rem "IBM Plex Sans",sans-serif;text-decoration:none;text-align:center;cursor:pointer}.b.o{border-color:#C5A56A;color:#8A6F3E}.b.x{border-color:#D8D1C4;color:#5F6B66}.b.ok{background:#0A4F4A;color:#fff}</style>'
    + '<script>(function(){var SIG="' + (SIGN[who] || SIGN.najjuko) + '";function E(i){return document.getElementById(i)}var sh=E("pres_sh");'
    + 'document.querySelectorAll(".pt").forEach(function(b){b.onclick=function(){var t=b.dataset.t,s=b.dataset.s;E("pres_t").textContent=t;E("pres_w").href="https://wa.me/?text="+encodeURIComponent(t+" - presentation\\n"+s);E("pres_e").href="mailto:?subject="+encodeURIComponent(t+" - presentation")+"&body="+encodeURIComponent("Hello,\\n\\nPlease find the presentation, its PDF and the walkthrough for "+t+" here:\\n"+s+SIG);E("pres_o").href=s;E("pres_c").dataset.l=s;E("pres_c").textContent="Copy link";E("pres_c").classList.remove("ok");sh.classList.add("on")}});'
    + 'E("pres_x").onclick=function(){sh.classList.remove("on")};sh.onclick=function(e){if(e.target===sh)sh.classList.remove("on")};E("pres_c").onclick=function(){var b=E("pres_c");navigator.clipboard.writeText(b.dataset.l).then(function(){b.textContent="Copied";b.classList.add("ok")},function(){b.textContent=b.dataset.l})}})()</script>';
}

export async function presRoute(request, env, url, deps) {
  const p = url.pathname, key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const who = typeof deps.person === "function" ? deps.person(env, url) : "";
  if (!PRES_PEOPLE.includes(who) || (who === "najjuko" && typeof deps.isNaj === "function" && !deps.isNaj(env, url))) return new Response("not found", { status: 404 });
  if (p === "/momo/work/presentations" && request.method === "GET") {
    return new Response(deps.page(key, rk, presBody(key, rk, await readPresIndex(env), url.origin, who, { links: await presLinks(env) })), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  if (p === "/momo/work/presentations/list" && request.method === "GET") return new Response(JSON.stringify(presSorted(await readPresIndex(env))), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  return new Response("not found", { status: 404 });
}
