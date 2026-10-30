// v672 (Kendall, 30 Oct 2026): the Product data sheets card, FIRST on Najjuko's Momo front door (and on Kendall's, after Product briefs).
// Same pattern as Product briefs (src/work_briefs.js) but its own KV keys, so Kendall's briefs and her sheets never mix:
//   pds_index            JSON list of {slug, title, group?, kind: "pdf" | "image", thumb?: true}
//   pds_file_<slug>      the sheet itself (a PDF, or a PNG/JPEG picture)
//   pds_thumb_<slug>     a small JPEG thumbnail (optional)
// Public, no key (so a recipient can open what she sends): /pds/<slug> share page, /pds/f/<slug>.pdf|.png|.jpg the file, /pds/t/<slug>.jpg the thumbnail.
// New sheets: upload the files and update pds_index; no deploy. It starts empty ("sheets coming"); the sheets themselves are audited separately.
const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const SLUG_RE = /^[a-z0-9-]{1,40}$/;
const EXT = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg" };

export const SHEETS_ICON = '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h3M8 17h3M14 13h2M14 17h2"/>';
export const SHEETS_PEOPLE = ["najjuko", "kendall"];

const extOf = (e) => (e.kind === "pdf" ? "pdf" : e.ext === "jpg" ? "jpg" : "png");

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
  m = p.match(/^\/pds\/f\/([a-z0-9-]{1,40})\.(pdf|png|jpg)$/);
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
    return '<button class=tl type=button data-t="' + esc(e.title) + '" data-s="' + esc(share) + '" data-f="' + esc(file) + '"' + (e.kind === "pdf" ? " data-d=1" : "") + '>' + th + '<span>' + esc(e.title) + '</span></button>';
  };
  const list = items.length
    ? groups.map((g) => { const l = items.filter((e) => String(e.group || "Data sheets") === g); return '<details class=grp open><summary>' + esc(g) + '<span class=n>' + l.length + '</span></summary><div class=g>' + l.map(tile).join("") + '</div></details>'; }).join("")
    : '<div class=empty id=pds_empty><svg viewBox="0 0 24 24" width=34 height=34 fill="none" stroke="#C5A56A" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true>' + SHEETS_ICON + '</svg><p><b>Sheets coming</b></p><p>Your product data sheets are being checked. They will appear here, ready to send by WhatsApp or email.</p></div>';
  return '<a class=back href="/momo' + q + '">&#8592; Momo</a><div class=tag>MOMO</div><h1>Product data sheets</h1>' + list
    + '<div class=sh id=pds_sh><div class=shc><b id=pds_t></b><a class=b id=pds_w target=_blank rel=noopener>WhatsApp</a><a class=b id=pds_e>Email</a><button class=b id=pds_c type=button>Copy link</button><a class="b o" id=pds_o target=_blank rel=noopener>Open</a><button class="b x" id=pds_x type=button>Close</button></div></div>'
    + '<style>.grp{border:1px solid #E7E1D6;border-radius:14px;background:#FFFDF9;margin:0 0 10px;padding:0 10px}.grp summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;padding:12px 2px;font:600 1rem Fraunces,serif;color:#0A4F4A}.grp summary::-webkit-details-marker{display:none}.grp .n{font:600 .75rem "IBM Plex Mono",monospace;color:#8A6F3E;border:1px solid #C5A56A;border-radius:999px;padding:2px 8px}.grp[open]>summary{border-bottom:1px solid #EEE8DD;margin-bottom:10px}'
    + '.g{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:0 0 12px}.tl{border:1px solid #E7E1D6;background:#fff;border-radius:12px;padding:6px;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:6px}.tl img{width:100%;aspect-ratio:3/4;object-fit:cover;object-position:top;border-radius:8px;display:block}.tl span{font:600 .78rem "IBM Plex Sans",sans-serif;color:#1C2321;line-height:1.25}.pdf{display:flex;align-items:center;justify-content:center;aspect-ratio:3/4;border-radius:8px;background:#0A4F4A;color:#fff;font:700 .9rem "IBM Plex Mono",monospace}'
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
    return new Response(deps.page(key, rk, sheetsBody(key, rk, await readSheetsIndex(env), url.origin, who)), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  if (p === "/momo/work/sheets/list" && request.method === "GET") return new Response(JSON.stringify(await readSheetsIndex(env)), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  return new Response("not found", { status: 404 });
}
