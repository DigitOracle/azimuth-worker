// v672 (Kendall, 30 Oct 2026): the Product data sheets card, FIRST on Najjuko's Momo front door (and on Kendall's, after Product briefs).
// Same pattern as Product briefs (src/work_briefs.js) but its own KV keys, so Kendall's briefs and her sheets never mix:
//   pds_index            JSON list of {slug, title, group?, kind: "pdf" | "image", thumb?: true}
//   pds_file_<slug>      the sheet itself (a PDF, or a PNG/JPEG picture)
//   pds_thumb_<slug>     a small JPEG thumbnail (optional)
// Public, no key (so a recipient can open what she sends): /pds/<slug> share page, /pds/f/<slug>.pdf|.png|.jpg the file, /pds/t/<slug>.jpg the thumbnail.
// New sheets: upload the files and update pds_index; no deploy. It starts empty ("sheets coming"); the sheets themselves are audited separately.
// v675 (Kendall, 30 Oct 2026): a person adds a picture or PDF from their own Claude Code through the Momo bridge (src/work_bridge.js:
// GET sheets, POST sheet, POST sheet/delete). A bridge upload carries uploaded_by + added_at in pds_index; the loaded sheets (load_pds.py) carry
// neither and are shared, read-only. Each person sees the loaded sheets plus their own uploads. A bridge picture has NO separate thumbnail:
// the tile and the share page show the file itself scaled by CSS (the Worker cannot resize); a bridge PDF shows the PDF badge.
const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const SLUG_RE = /^[a-z0-9-]{1,40}$/;
const EXT = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
export const SHEET_MAX = 12 * 1024 * 1024;   // v675 - decoded bytes
export const SHEET_PEOPLE_UPLOAD = ["najjuko", "kendall"];

export const SHEETS_ICON = '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h3M8 17h3M14 13h2M14 17h2"/>';
export const SHEETS_PEOPLE = ["najjuko", "kendall"];

const extOf = (e) => (e.kind === "pdf" ? "pdf" : e.ext === "jpg" ? "jpg" : e.ext === "webp" ? "webp" : "png");

// v675 - what the bytes ARE, never what the caller said: PNG, JPEG, WebP or PDF by magic bytes; anything else is refused.
export function sniffKind(u8) {
  if (!u8 || u8.length < 12) return null;
  if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) return { kind: "image", ext: "png" };
  if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return { kind: "image", ext: "jpg" };
  if (u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 && u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50) return { kind: "image", ext: "webp" };
  if (u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46) return { kind: "pdf", ext: "pdf" };
  return null;
}
export function slugify(title) {
  const s = String(title || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36).replace(/-+$/, "");
  return s || "sheet";
}
export function uniqueSlug(base, taken) { let s = base, n = 2; while (taken.has(s)) { s = base.slice(0, 36 - String(n).length - 1) + "-" + n; n++; } return s; }
// the sheets one person may see: the loaded ones (no uploaded_by) plus their own bridge uploads
export const sheetsFor = (index, person) => index.filter((e) => !e.uploaded_by || e.uploaded_by === person);
export const sheetOut = (e, origin) => ({ slug: e.slug, title: e.title, group: e.group || "Data sheets", kind: e.kind, ext: extOf(e), share: origin + "/pds/" + e.slug, file: origin + "/pds/f/" + e.slug + "." + extOf(e),
  thumb: e.thumb ? origin + "/pds/t/" + e.slug + ".jpg" : null, uploaded_by: e.uploaded_by || null, added_at: e.added_at || null });
// v675 - every index write RE-READS pds_index and merges by slug (a loader or another person may have written since): never from a stale copy
async function mergeIndex(env, fn) {
  const cur = await readSheetsIndex(env), next = fn(cur.slice());
  await env.MEETINGS.put("pds_index", JSON.stringify(next)); return next;
}
function b64bytes(s) {
  const t = String(s || "").replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  if (!t || !/^[A-Za-z0-9+/]+=*$/.test(t)) return null;
  if (t.length * 3 / 4 > SHEET_MAX + 1024 * 1024) return "big";   // do not decode what cannot fit anyway
  try { const bin = atob(t), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; } catch (e) { return null; }
}
// v675 - POST sheet through the bridge. Returns [status, body] like the other bridge writes.
export async function bridgeSheetUpload(env, person, b, origin) {
  if (!SHEET_PEOPLE_UPLOAD.includes(person)) return [403, { ok: false, code: "forbidden", error: "This key cannot add sheets." }];
  const title = String(b.title || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!title) return [400, { ok: false, code: "no_title", error: "A sheet needs a title." }];
  const group = String(b.group || "").replace(/\s+/g, " ").trim().slice(0, 40) || "Data sheets";
  const u8 = b64bytes(b.content_b64 != null ? b.content_b64 : b.content_base64);
  if (u8 === "big") return [413, { ok: false, code: "too_big", error: "At most 12 MB a sheet." }];
  if (!u8) return [400, { ok: false, code: "no_content", error: "Send content_b64 (the file, base64)." }];
  if (u8.length > SHEET_MAX) return [413, { ok: false, code: "too_big", error: "At most 12 MB a sheet (this one is " + (u8.length / 1048576).toFixed(1) + " MB)." }];
  const sn = sniffKind(u8);
  if (!sn) return [415, { ok: false, code: "bad_type", error: "Send a PNG, JPEG, WebP picture or a PDF (checked by content, not by name)." }];
  const taken = new Set((await readSheetsIndex(env)).map((e) => e.slug)), slug = uniqueSlug(slugify(title), taken), now = new Date().toISOString();
  await env.MEETINGS.put("pds_file_" + slug, u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
  const rec = { slug, title, group, kind: sn.kind, ext: sn.ext, thumb: false, uploaded_by: person, added_at: now, bytes: u8.length, filename: String(b.filename || "").slice(0, 120) };
  await mergeIndex(env, (idx) => idx.filter((e) => e.slug !== slug).concat(rec));
  return [200, { ok: true, slug, share: origin + "/pds/" + slug, file: origin + "/pds/f/" + slug + "." + sn.ext, kind: sn.kind, ext: sn.ext, bytes: u8.length, data: sheetOut(rec, origin) }];
}
// v675 - POST sheet/delete: only the person who uploaded it; the loaded sheets are nobody's to delete here.
export async function bridgeSheetDelete(env, person, b) {
  const slug = String(b.slug || "").trim(); if (!SLUG_RE.test(slug)) return [400, { ok: false, code: "bad_slug", error: "Send slug." }];
  const e = (await readSheetsIndex(env)).find((x) => x.slug === slug);
  if (!e) return [404, { ok: false, code: "not_found", error: "No sheet with that slug." }];
  if (e.uploaded_by !== person) return [403, { ok: false, code: "not_yours", error: e.uploaded_by ? "That sheet was added by someone else." : "That is a loaded sheet; it is not removed through the bridge." }];
  await env.MEETINGS.delete("pds_file_" + slug); await env.MEETINGS.delete("pds_thumb_" + slug);
  await mergeIndex(env, (idx) => idx.filter((x) => x.slug !== slug));
  return [200, { ok: true, slug, deleted: true }];
}

export async function readSheetsIndex(env) {
  let r = [];
  try { r = JSON.parse(await env.MEETINGS.get("pds_index")) || []; } catch (e) {}
  return Array.isArray(r) ? r.filter((x) => x && SLUG_RE.test(String(x.slug || "")) && (x.kind === "pdf" || x.kind === "image")) : [];
}

export async function sheetsPublic(request, env, url) {
  const p = url.pathname;
  let m = p.match(/^\/pds\/t\/([a-z0-9-]{1,40})\.jpg$/);
  if (m) {
    const b = await env.MEETINGS.get("pds_thumb_" + m[1], "arrayBuffer");
    return b ? new Response(b, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" } }) : new Response("not found", { status: 404 });
  }
  m = p.match(/^\/pds\/f\/([a-z0-9-]{1,40})\.(pdf|png|jpg|webp)$/);
  if (m) {
    const e = (await readSheetsIndex(env)).find((x) => x.slug === m[1]);
    if (!e || extOf(e) !== m[2]) return new Response("not found", { status: 404 });
    const b = await env.MEETINGS.get("pds_file_" + m[1], "arrayBuffer");
    return b ? new Response(b, { headers: { "Content-Type": EXT[m[2]], "Cache-Control": "public, max-age=3600", "Content-Disposition": 'inline; filename="' + m[1] + "." + m[2] + '"' } }) : new Response("not found", { status: 404 });
  }
  m = p.match(/^\/pds\/([a-z0-9-]{1,40})\/?$/);
  if (m) {
    const e = (await readSheetsIndex(env)).find((x) => x.slug === m[1]);
    if (!e) return new Response("not found", { status: 404 });
    const file = url.origin + "/pds/f/" + e.slug + "." + extOf(e);
    const pic = e.kind === "image" ? file : e.thumb ? url.origin + "/pds/t/" + e.slug + ".jpg" : "";
    return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(e.title) + '</title>'
      + '<meta property="og:title" content="' + esc(e.title) + '"><meta property="og:description" content="Product data sheet' + (e.kind === "pdf" ? " (PDF)" : "") + '."' + (pic ? '><meta property="og:image" content="' + esc(pic) + '"' : "") + '><meta name="twitter:card" content="summary_large_image">'
      + '<style>body{margin:0;background:#0C1413;color:#E8E4D8;display:flex;flex-direction:column;align-items:center;padding:16px;font-family:system-ui,sans-serif;text-align:center}img{max-width:100%;max-height:88vh;border-radius:8px}h1{font-size:1.2rem;font-weight:600;margin:14px 0 6px}a.b{display:inline-block;margin:8px 6px;padding:11px 18px;border-radius:999px;background:#C5A56A;color:#0C1413;font-weight:700;text-decoration:none}</style></head><body>'
      + (pic ? '<img src="' + esc(pic) + '" alt="' + esc(e.title) + '">' : "") + '<h1>' + esc(e.title) + '</h1><div><a class=b href="' + esc(file) + '"' + (e.kind === "image" ? " download" : "") + '>' + (e.kind === "pdf" ? "Open the PDF" : "Download the picture") + '</a></div></body></html>',
      { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600" } });
  }
  return null;
}

const SIGN = {
  najjuko: "\\n\\nKind regards,\\nNajjuko",
  kendall: "\\n\\nKind regards,\\nDr. Kendall Wilson\\nDigitAlchemy Tech Limited\\ncontact@digitalabbot.io | +971 56 227 6093",
};

export function sheetsBody(key, rk, items, origin, who) {
  const q = "?key=" + encodeURIComponent(key) + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  const groups = []; items.forEach((e) => { const g = String(e.group || "Data sheets"); if (!groups.includes(g)) groups.push(g); });
  const tile = (e) => {
    const share = origin + "/pds/" + e.slug, file = origin + "/pds/f/" + e.slug + "." + extOf(e);
    const th = e.thumb ? '<img loading=lazy src="/pds/t/' + e.slug + '.jpg" alt="">' : e.kind === "image" ? '<img loading=lazy src="/pds/f/' + e.slug + "." + extOf(e) + '" alt="">' : '<span class=pdf>PDF</span>';
    const mine = e.uploaded_by && e.uploaded_by === who ? '<i class=me>added by you</i>' : "";   // v675
    return '<button class=tl type=button data-t="' + esc(e.title) + '" data-s="' + esc(share) + '" data-f="' + esc(file) + '"' + (e.kind === "pdf" ? " data-d=1" : "") + '>' + th + '<span>' + esc(e.title) + '</span>' + mine + '</button>';
  };
  const list = items.length
    ? groups.map((g) => { const l = items.filter((e) => String(e.group || "Data sheets") === g); return '<details class=grp open><summary>' + esc(g) + '<span class=n>' + l.length + '</span></summary><div class=g>' + l.map(tile).join("") + '</div></details>'; }).join("")
    : '<div class=empty id=pds_empty><svg viewBox="0 0 24 24" width=34 height=34 fill="none" stroke="#C5A56A" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true>' + SHEETS_ICON + '</svg><p><b>Sheets coming</b></p><p>Your product data sheets are being checked. They will appear here, ready to send by WhatsApp or email.</p></div>';
  return '<a class=back href="/momo' + q + '">&#8592; Momo</a><div class=tag>MOMO</div><h1>Product data sheets</h1>' + list
    + '<div class=sh id=pds_sh><div class=shc><b id=pds_t></b><a class=b id=pds_w target=_blank rel=noopener>WhatsApp</a><a class=b id=pds_e>Email</a><button class=b id=pds_c type=button>Copy link</button><a class="b o" id=pds_o target=_blank rel=noopener>Open</a><button class="b x" id=pds_x type=button>Close</button></div></div>'
    + '<style>.grp{border:1px solid #E7E1D6;border-radius:14px;background:#FFFDF9;margin:0 0 10px;padding:0 10px}.grp summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;padding:12px 2px;font:600 1rem Fraunces,serif;color:#0A4F4A}.grp summary::-webkit-details-marker{display:none}.grp .n{font:600 .75rem "IBM Plex Mono",monospace;color:#8A6F3E;border:1px solid #C5A56A;border-radius:999px;padding:2px 8px}.grp[open]>summary{border-bottom:1px solid #EEE8DD;margin-bottom:10px}'
    + '.g{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:0 0 12px}.tl{border:1px solid #E7E1D6;background:#fff;border-radius:12px;padding:6px;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:6px}.tl img{width:100%;aspect-ratio:3/4;object-fit:cover;object-position:top;border-radius:8px;display:block}.tl span{font:600 .78rem "IBM Plex Sans",sans-serif;color:#1C2321;line-height:1.25}.tl .me{font:500 .62rem "IBM Plex Mono",monospace;color:#8A6F3E;font-style:normal}.tl .pdf{display:flex;width:100%;align-items:center;justify-content:center;aspect-ratio:3/4;border-radius:8px;background:#0A4F4A;color:#fff;font:700 .9rem "IBM Plex Mono",monospace}'
    + '.empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:40px 18px;border:1px dashed #C5A56A;border-radius:18px;text-align:center;color:#5F6B66}.empty p{margin:0}.empty b{font-family:Fraunces,serif;font-size:1.1rem;color:#0A4F4A}'
    + '.sh{position:fixed;inset:0;background:rgba(12,20,19,.55);display:none;align-items:flex-end;z-index:50}.sh.on{display:flex}.shc{background:#FAF7F1;width:100%;max-width:560px;margin:0 auto;border-radius:18px 18px 0 0;padding:18px 16px 28px;display:flex;flex-direction:column;gap:8px}.shc b{font-family:Fraunces,serif;font-size:1.05rem;color:#0A4F4A;margin-bottom:6px}.b{border:1px solid #0A4F4A;color:#0A4F4A;background:#fff;border-radius:999px;padding:11px 14px;font:600 .9rem "IBM Plex Sans",sans-serif;text-decoration:none;text-align:center;cursor:pointer}.b.o{border-color:#C5A56A;color:#8A6F3E}.b.x{border-color:#D8D1C4;color:#5F6B66}.b.ok{background:#0A4F4A;color:#fff}</style>'
    + '<script>(function(){var SIG="' + (SIGN[who] || SIGN.najjuko) + '";function E(i){return document.getElementById(i)}var sh=E("pds_sh");'
    + 'document.querySelectorAll(".tl").forEach(function(b){b.onclick=function(){var t=b.dataset.t,s=b.dataset.s,d=b.dataset.d;E("pds_t").textContent=t;E("pds_w").href="https://wa.me/?text="+encodeURIComponent(t+" - product data sheet"+(d?" (PDF)":"")+"\\n"+s);E("pds_e").href="mailto:?subject="+encodeURIComponent(t+" - product data sheet")+"&body="+encodeURIComponent("Hello,\\n\\nPlease find the product data sheet for "+t+" here:\\n"+s+SIG);E("pds_o").href=b.dataset.f;E("pds_o").textContent=d?"Open PDF":"Open";E("pds_c").dataset.l=s;E("pds_c").textContent="Copy link";E("pds_c").classList.remove("ok");sh.classList.add("on")}});'
    + 'E("pds_x").onclick=function(){sh.classList.remove("on")};sh.onclick=function(e){if(e.target===sh)sh.classList.remove("on")};E("pds_c").onclick=function(){var b=E("pds_c");navigator.clipboard.writeText(b.dataset.l).then(function(){b.textContent="Copied";b.classList.add("ok")},function(){b.textContent=b.dataset.l})}})()</script>';
}

export async function sheetsRoute(request, env, url, deps) {
  const p = url.pathname, key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const who = typeof deps.person === "function" ? deps.person(env, url) : "";
  if (!SHEETS_PEOPLE.includes(who) || (who === "najjuko" && typeof deps.isNaj === "function" && !deps.isNaj(env, url))) return new Response("not found", { status: 404 });
  if (p === "/momo/work/sheets" && request.method === "GET") {
    return new Response(deps.page(key, rk, sheetsBody(key, rk, sheetsFor(await readSheetsIndex(env), who), url.origin, who)), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  if (p === "/momo/work/sheets/list" && request.method === "GET") return new Response(JSON.stringify(sheetsFor(await readSheetsIndex(env), who)), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  return new Response("not found", { status: 404 });
}
