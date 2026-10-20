// DEVELOPER PROFILE (v614, 20 Oct 2026) - /developer_profile and /developer_profile_pdf, and the lower half of the START card.
//
// Kendall, 20 Oct 2026: "take this box on the start menu ... split it, developers by area stays on the top half, Developer profile on the
// bottom half. We have the ability to .pdf download, 3 pages maximum, with all of the information ... see the attached as to what they
// should look like."  The attached were the three Emaar infographics ("1 OF 3", "2 OF 3", "3 OF 3").
//
// WHAT THIS IS: a viewer and a packer. The three pages of a profile are infographics Kendall makes in ChatGPT's image generator from the
// register profile (MotherDuck views najma_developer_escrow_delivery / najma_developer_timeline, methodology in
// docs/DEVELOPER_ESCROW_DELIVERY_METHODOLOGY.md) and publishes with scripts/publish_devprofile.py (data repo). Nothing here computes a
// figure, so nothing here can disagree with the register: the worker shows the pictures that were checked and ships them as a PDF.
//
//   GET /developer_profile?key=                  the roster: one card per developer, "3 pages" or "In preparation"
//   GET /developer_profile?id=<id>&key=          the developer's pages, 1 OF 3 to 3 OF 3, and a PDF button
//   GET /developer_profile_pdf?id=<id>&key=      the PDF, at most three pages, one picture per page (&format=html shows the document)
//
// KV (the MEETINGS namespace, written by /ingest_market, which stores every name under img_):
//   img_devprofile_index                 JSON { as_of, developers: [{ id, name, pages (0..3), updated, as_of }] }
//   img_devprofile_<id>_<n>              the page picture, n = 1..3 (JPEG or PNG)
// Both are served only with a key: the /img/ route treats the devprofile_ prefix like ejari_ (owner key or a client key, otherwise 401).
//
// RULES: three pages is a ceiling, not a target (a fourth picture is never read); only an id that is in the index opens (the roster is the
// whitelist, so a guessed id reads nothing); a developer with no pictures is "In preparation", never an empty PDF.
import { esc, BRIEF_KIT } from "./brief_docs.js";
import { kvJson } from "./brief.js";

export const MAX_PAGES = 3;
const ID_RX = /^[a-z0-9]{2,24}$/;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON3 = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const longDate = (x) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(x || "")); return m && MONTHS[Number(m[2]) - 1] ? Number(m[3]) + " " + MONTHS[Number(m[2]) - 1] + " " + m[1] : ""; };
const fileDate = (x) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(x || "")); return m && MON3[Number(m[2]) - 1] ? m[3] + MON3[Number(m[2]) - 1] + m[1] : ""; };

// the index is read defensively: anything that is not the shape below is dropped, and a bad file reads as "nothing published"
export function cleanIndex(raw) {
  if (!raw || !Array.isArray(raw.developers)) return null;
  const seen = new Set(), developers = [];
  for (const d of raw.developers) {
    const id = d && typeof d.id === "string" ? d.id.toLowerCase() : "";
    if (!ID_RX.test(id) || seen.has(id)) continue;
    const name = String(d.name == null ? "" : d.name).replace(/[<>]/g, "").trim().slice(0, 60);
    if (!name) continue;
    seen.add(id);
    const pages = Math.max(0, Math.min(MAX_PAGES, Math.floor(Number(d.pages) || 0)));
    developers.push({ id, name, pages, updated: /^\d{4}-\d{2}-\d{2}/.test(String(d.updated || "")) ? String(d.updated).slice(0, 10) : "", as_of: /^\d{4}-\d{2}-\d{2}/.test(String(d.as_of || "")) ? String(d.as_of).slice(0, 10) : "" });
  }
  developers.sort((a, b) => (b.pages > 0) - (a.pages > 0) || a.name.localeCompare(b.name));
  return { as_of: /^\d{4}-\d{2}-\d{2}/.test(String(raw.as_of || "")) ? String(raw.as_of).slice(0, 10) : "", developers };
}

// ------------------------------------------------------------------------------------------------ the START card (lower half)
const PROFILE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#C5A56A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/></svg>';
export function devprofileStartHalf(key) {
  return '<a class="dvh dvp" href="/developer_profile?key=' + esc(encodeURIComponent(key || "")) + '">'
    + '<div class=ejh><div class="ic suic">' + PROFILE_SVG + '</div><div><b>Developer profile</b><span>Projects, escrow and delivery record in three pages. PDF to download</span></div></div></a>';
}
export const DEVPROFILE_START_CSS = '.dvsplit{padding:0!important;gap:0!important;overflow:hidden}.dvsplit .dvh{display:block;flex:1 1 0;padding:14px;color:inherit;text-decoration:none}'
  + '.dvsplit .dvp{border-top:1px solid #3A3222}';

// ------------------------------------------------------------------------------------------------ the page
const CSS = 'body{background:#0C1413;color:#E8E4D8;font-family:"IBM Plex Sans",system-ui,sans-serif;margin:0;padding:14px 14px 110px;max-width:560px;margin-inline:auto;-webkit-text-size-adjust:100%}'
  + '*{box-sizing:border-box}a{color:#C5A56A}'
  + '.dpk{font:600 .68rem "IBM Plex Mono",monospace;letter-spacing:.18em;color:#93A39E;margin:8px 0 0}'
  + '.dpt{font:400 2rem/1.1 "Newsreader",Georgia,serif;margin:6px 0 4px;color:#EDE8DE}.dpt em{font-style:normal;color:#C5A56A}'
  + '.dpl{color:#93A39E;font-size:.9rem;margin:0 0 16px}'
  + '.dpg{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}'
  + '.dpc{display:flex;flex-direction:column;gap:4px;background:#121D1B;border:1px solid #22302D;border-radius:18px;padding:14px;text-decoration:none;color:#EDE8DE;min-height:78px}'
  + '.dpc b{font:600 1.02rem "IBM Plex Sans",sans-serif}.dpc span{font-size:.74rem;color:#93A39E}.dpc.on{border-color:#3A3222}.dpc.on span{color:#C5A56A}.dpc.off{opacity:.6}'
  + '.dpb{display:inline-block;margin:0 0 6px;font-size:.82rem;text-decoration:none}'
  + '.dpdl{display:flex;align-items:center;justify-content:center;gap:8px;margin:12px 0 16px;min-height:48px;border-radius:14px;background:linear-gradient(150deg,#E8CD93,#C5A56A 60%,#9E7E45);color:#1B1608;font:600 .95rem "IBM Plex Sans",sans-serif;text-decoration:none}'
  + '.dpf{margin:0 0 14px}.dpn{font:600 .64rem "IBM Plex Mono",monospace;letter-spacing:.16em;color:#93A39E;margin:0 0 6px}'
  + '.dpf img{display:block;width:100%;height:auto;border-radius:14px;border:1px solid #22302D;background:#121D1B}'
  + '.dps{font-size:.74rem;color:#6F837D;margin:6px 0 0;line-height:1.5}.dpe{background:#121D1B;border:1px solid #22302D;border-radius:18px;padding:16px;color:#93A39E;font-size:.9rem}';

const kq = (key) => "key=" + encodeURIComponent(key || "");

export function profilePageHtml(o) {
  const key = o.key || "", idx = o.idx, dev = o.dev;
  let main = "", title = "Developer profile";
  if (dev) {
    title = dev.name + " — Developer profile";
    const asOf = longDate(dev.as_of || (idx && idx.as_of));
    main = '<a class=dpb href="/developer_profile?' + kq(key) + '">← All developers</a>'
      + '<div class=dpk>DEVELOPER PROFILE</div><h1 class=dpt>' + esc(dev.name) + '</h1>';
    if (dev.pages > 0) {
      main += '<a class=dpdl href="/developer_profile_pdf?id=' + esc(dev.id) + "&amp;" + kq(key) + '">Download PDF · ' + dev.pages + (dev.pages === 1 ? " page" : " pages") + '</a>';
      for (let n = 1; n <= dev.pages; n++) {
        const src = "/img/devprofile_" + dev.id + "_" + n + "?" + kq(key);
        main += '<figure class=dpf style="margin:0 0 14px"><div class=dpn>' + n + " OF " + dev.pages + '</div><a href="' + esc(src) + '" target=_blank rel=noopener><img src="' + esc(src) + '" alt="' + esc(dev.name) + " developer profile, page " + n + " of " + dev.pages + '" loading=' + (n === 1 ? "eager" : "lazy") + '></a></figure>';
      }
      main += '<p class=dps>Dubai Land Department registers' + (asOf ? ", as of " + esc(asOf) : "") + '. Escrow shows the agent bank recorded for a live project, never a balance. Project figures are the register’s, brand groupings are reviewed by hand.</p>';
    } else main += '<div class=dpe>This profile is being prepared. It will appear here as three pages with a PDF to download.</div>';
  } else if (idx && idx.developers.length) {
    main = '<div class=dpk>DEVELOPERS</div><h1 class=dpt>Developer <em>profile</em></h1><p class=dpl>Pick a developer: three pages, and a PDF to take away.</p><div class=dpg>'
      + idx.developers.map((d) => '<a class="dpc ' + (d.pages ? "on" : "off") + '" href="/developer_profile?id=' + esc(d.id) + "&amp;" + kq(key) + '"><b>' + esc(d.name) + '</b><span>' + (d.pages ? d.pages + (d.pages === 1 ? " page" : " pages") + (d.updated ? " · " + esc(longDate(d.updated)) : "") : "In preparation") + '</span></a>').join("") + '</div>';
  } else {
    main = '<div class=dpk>DEVELOPERS</div><h1 class=dpt>Developer <em>profile</em></h1><div class=dpe>No developer profiles are published yet.</div>';
  }
  return '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + "<title>" + esc(title) + " — Najma</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content=\"#0C1413\"><meta name=robots content=noindex>" + (o.fonts || "")
    + "<style>" + CSS + (o.navCss || "") + "</style></head><body>" + main + (o.nav || "") + "</body></html>";
}

// ------------------------------------------------------------------------------------------------ the PDF
function b64(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
// {w, h, type}; null when the bytes are neither a PNG nor a JPEG
export function imageInfo(buf) {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (u.length > 24 && u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) {
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    return { type: "image/png", w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  if (u.length > 4 && u[0] === 0xff && u[1] === 0xd8) {
    let i = 2;
    while (i + 9 < u.length) {
      if (u[i] !== 0xff) { i++; continue; }
      const m = u[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { type: "image/jpeg", h: (u[i + 5] << 8) | u[i + 6], w: (u[i + 7] << 8) | u[i + 8] };
      i += 2 + ((u[i + 2] << 8) | u[i + 3]);
    }
  }
  return null;
}

// -> { status, body } on failure, { status: 200, html, pages, fname } on success
export async function buildProfilePdf(env, dev, idx) {
  const pics = [];
  for (let n = 1; n <= Math.min(dev.pages, MAX_PAGES); n++) {
    let v = null; try { v = await env.MEETINGS.get("img_devprofile_" + dev.id + "_" + n, "arrayBuffer"); } catch (e) {}
    const info = v && v.byteLength ? imageInfo(v) : null;
    if (info && info.w > 0 && info.h > 0) pics.push({ n, info, data: v });
  }
  if (!pics.length) return { status: 404, body: { ok: false, reason: "this profile has no pictures published yet" } };
  // one page size for the document: the first picture's proportions at A4 width (the three pages of a profile are made to one shape)
  const ratio = Math.max(1.2, Math.min(1.9, pics[0].info.h / pics[0].info.w));
  const hmm = (210 * ratio).toFixed(2);
  const pages = pics.map((p) => '<div class=pg><img alt="' + esc(dev.name) + " page " + p.n + '" src="data:' + p.info.type + ";base64," + b64(p.data) + '"></div>').join("");
  const html = '<!doctype html><html lang=en><head><meta charset=utf-8><title>' + esc(dev.name) + ' — Developer profile</title><style>'
    + "@page{size:210mm " + hmm + "mm;margin:0}*{margin:0;padding:0;box-sizing:border-box}html,body{background:#F4EFE4;width:210mm}"
    + ".pg{width:210mm;height:" + hmm + "mm;overflow:hidden;break-after:page;page-break-after:always}.pg:last-child{break-after:auto;page-break-after:auto}"
    + ".pg img{display:block;width:100%;height:100%;object-fit:contain}</style></head><body>" + pages + "</body></html>";
  const fname = dev.name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") + "_Developer_Profile" + (fileDate(dev.updated || dev.as_of) ? "_" + fileDate(dev.updated || dev.as_of) : "") + ".pdf";
  return { status: 200, html, pages: pics.length, fname };
}

// ------------------------------------------------------------------------------------------------ the routes
const J = (o, status) => new Response(JSON.stringify(o, null, 1), { status: status || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const HDR = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

// deps: { clientOk, clientResp, najNav, NAJ_NAV_CSS, NAJ_FONTS } from index.js. Returns null for any other path.
export async function devprofileRoutes(request, env, url, deps) {
  const p = url.pathname;
  if (p !== "/developer_profile" && p !== "/developer_profile_pdf") return null;
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("method", { status: 405 });   // before the key, as /developers_map
  if (!deps.clientOk(env, url)) return new Response("not authorised", { status: 401, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
  const key = url.searchParams.get("key") || "";
  const idx = cleanIndex(await kvJson(env, "devprofile_index"));
  const wanted = String(url.searchParams.get("id") || "").toLowerCase();
  const dev = wanted && idx ? idx.developers.find((d) => d.id === wanted) || null : null;
  if (p === "/developer_profile") {
    if (wanted && !dev) return new Response("no such developer profile", { status: 404, headers: { "Content-Type": "text/plain", ...HDR } });
    const html = profilePageHtml({ key, idx, dev, nav: deps.najNav ? deps.najNav(key, "start") : "", navCss: deps.NAJ_NAV_CSS, fonts: deps.NAJ_FONTS });
    const init = { headers: Object.assign({ "Content-Type": "text/html; charset=utf-8" }, HDR) };
    return deps.clientResp ? deps.clientResp(env, url, html, init) : new Response(html, init);
  }
  // /developer_profile_pdf
  if (!dev) return J({ ok: false, reason: wanted ? "no such developer profile" : "id= is required (the developer's id from the roster)" }, wanted ? 404 : 400);
  const doc = await buildProfilePdf(env, dev, idx);
  if (doc.status !== 200) return J(doc.body, doc.status);
  const hdr = Object.assign({ "X-Brief-Pages": String(doc.pages) }, HDR);
  if (url.searchParams.get("format") === "html") return new Response(doc.html, { headers: Object.assign({ "Content-Type": "text/html; charset=utf-8" }, hdr) });
  if (!env.BROWSER) return J({ ok: false, reason: "no Browser Rendering binding on this Worker; add format=html to see the document" }, 503);
  let pdf;
  try { pdf = await BRIEF_KIT.renderPdf(env, doc.html); } catch (e) {
    const m = String((e && e.message) || e);
    const busy = /429|too many|rate.?limit/i.test(m);
    return J({ ok: false, reason: (busy ? "busy: " : "render failed: ") + m.slice(0, 160) }, busy ? 429 : 502);
  }
  if (!pdf || !pdf.byteLength) return J({ ok: false, reason: "the renderer returned nothing" }, 502);
  return new Response(pdf, { headers: Object.assign({ "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="' + doc.fname + '"' }, hdr) });
}
