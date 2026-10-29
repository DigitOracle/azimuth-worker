// v667 (Kendall, 29 Oct 2026): the Product Briefs card on Momo's front door, Kendall's key only.
// Two sections, Phone (9:16) and Widescreen (16:9); every card opens, copies, or goes straight to WhatsApp or email.
// Images live in KV (pb_img_<slug>_<kind>, PNG) with small JPEG thumbnails (pb_thumb_<slug>_<kind>); the index is pb_index
// (a JSON list of {slug, title, phone, wide}). The pictures themselves are public at /pb/<slug>_<kind>.png and a share page at
// /pb/<slug>?v=phone|wide, so a recipient sees the card without a key. New cards: upload the files and update pb_index; no deploy.
const KINDS = { phone: "Phone (9:16)", wide: "Widescreen (16:9)" };
const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const SLUG_RE = /^[a-z0-9-]{1,40}$/;

export const BRIEFS_ICON = '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>';

export async function readBriefsIndex(env) {
  let r = [];
  try { r = JSON.parse(await env.MEETINGS.get("pb_index")) || []; } catch (e) {}
  return Array.isArray(r) ? r.filter((x) => x && SLUG_RE.test(String(x.slug || ""))) : [];
}

// public: the picture, the thumbnail, or the share page (no key - these are marketing cards)
export async function briefsPublic(request, env, url) {
  const p = url.pathname;
  let m = p.match(/^\/pb\/t\/([a-z0-9-]{1,40})_(phone|wide)\.jpg$/);
  if (m) {
    const b = await env.MEETINGS.get("pb_thumb_" + m[1] + "_" + m[2], "arrayBuffer");
    return b ? new Response(b, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" } }) : new Response("not found", { status: 404 });
  }
  m = p.match(/^\/pb\/([a-z0-9-]{1,40})_(phone|wide)\.png$/);
  if (m) {
    const b = await env.MEETINGS.get("pb_img_" + m[1] + "_" + m[2], "arrayBuffer");
    return b ? new Response(b, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" } }) : new Response("not found", { status: 404 });
  }
  m = p.match(/^\/pb\/d\/([a-z0-9-]{1,40})\.(pdf|pptx)$/);   // v668 - a whole presentation as one file
  if (m) {
    const b = await env.MEETINGS.get("pb_doc_" + m[1] + "_" + m[2], "arrayBuffer");
    const ct = m[2] === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    return b ? new Response(b, { headers: { "Content-Type": ct, "Cache-Control": "public, max-age=3600", "Content-Disposition": 'inline; filename="' + m[1] + "." + m[2] + '"' } }) : new Response("not found", { status: 404 });
  }
  m = p.match(/^\/pb\/([a-z0-9-]{1,40})\/?$/);
  if (m) {
    const kind = url.searchParams.get("v") === "wide" ? "wide" : "phone";
    const e = (await readBriefsIndex(env)).find((x) => x.slug === m[1]);
    if (e && e.kind === "deck") {   // v668 - a deck: show the cover and offer the PDF (and the PowerPoint when there is one)
      const pdf = url.origin + "/pb/d/" + e.slug + ".pdf", cover = e.wide ? url.origin + "/pb/" + e.slug + "_wide.png" : "";
      return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(e.title) + ' | DigitAlchemy</title>'
        + '<meta property="og:title" content="' + esc(e.title) + '"><meta property="og:description" content="DigitAlchemy presentation (PDF)."' + (cover ? '><meta property="og:image" content="' + esc(cover) + '"' : "") + '><meta name="twitter:card" content="summary_large_image">'
        + '<style>body{margin:0;background:#0C1413;color:#E8E4D8;display:flex;flex-direction:column;align-items:center;padding:16px;font-family:system-ui,sans-serif;text-align:center}img{max-width:100%;border-radius:8px}h1{font-size:1.2rem;font-weight:600;margin:14px 0 6px}a.b{display:inline-block;margin:8px 6px;padding:11px 18px;border-radius:999px;background:#C5A56A;color:#0C1413;font-weight:700;text-decoration:none}a.s{background:none;border:1px solid #C5A56A;color:#C5A56A}</style></head><body>'
        + (cover ? '<img src="' + esc(cover) + '" alt="">' : "") + '<h1>' + esc(e.title) + '</h1><div><a class=b href="' + esc(pdf) + '">Open the PDF</a>' + (e.pptx ? '<a class="b s" href="' + esc(url.origin + "/pb/d/" + e.slug + ".pptx") + '">PowerPoint</a>' : "") + '</div></body></html>', { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600" } });
    }
    if (!e || !e[kind]) return new Response("not found", { status: 404 });
    const img = url.origin + "/pb/" + e.slug + "_" + kind + ".png";
    return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(e.title) + ' | DigitAlchemy</title>'
      + '<meta property="og:title" content="' + esc(e.title) + '"><meta property="og:description" content="DigitAlchemy - turning complexity into clarity."><meta property="og:image" content="' + esc(img) + '"><meta name="twitter:card" content="summary_large_image">'
      + '<style>body{margin:0;background:#0C1413;display:flex;flex-direction:column;align-items:center;padding:12px;font-family:system-ui,sans-serif}img{max-width:100%;max-height:92vh;border-radius:8px}a{color:#C5A56A;font-size:.85rem;margin-top:10px}</style></head><body>'
      + '<img src="' + esc(img) + '" alt="' + esc(e.title) + '"><a href="' + esc(img) + '" download>Download the picture</a></body></html>', { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600" } });
  }
  return null;
}

function briefsBody(key, rk, items, origin) {
  const q = "?key=" + encodeURIComponent(key) + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  // v669 (Kendall, 29 Oct): categories, then children, then a three-column grid of tiles; one tap opens the action sheet.
  const groups = []; items.forEach((e) => { const g = String(e.group || "Other"); if (!groups.includes(g)) groups.push(g); });
  const tile = (e, kind) => {
    const deck = e.kind === "deck";
    const share = origin + "/pb/" + e.slug + (deck ? "" : "?v=" + kind), file = deck ? origin + "/pb/d/" + e.slug + ".pdf" : origin + "/pb/" + e.slug + "_" + kind + ".png";
    const th = (deck ? e.wide : e[kind]) ? '<img loading=lazy src="/pb/t/' + e.slug + "_" + (deck ? "wide" : kind) + '.jpg" alt="">' : '<span class=pdf>PDF</span>';
    return '<button class="tl' + (deck ? " dk" : "") + '" type=button data-t="' + esc(e.title) + '" data-s="' + esc(share) + '" data-f="' + esc(file) + '"' + (deck && e.pptx ? ' data-p="' + esc(origin + "/pb/d/" + e.slug + ".pptx") + '"' : "") + (deck ? ' data-d=1' : "") + '>' + th + '<span>' + esc(e.title) + '</span></button>';
  };
  const grid = (list, kind) => '<div class=g>' + list.map((e) => tile(e, kind)).join("") + '</div>';
  const sec = (kind) => groups.map((g) => {
    const inG = items.filter((e) => String(e.group || "Other") === g && (e.kind === "deck" || e[kind]));
    if (!inG.length) return "";
    const ents = []; inG.forEach((e) => { const t = String(e.entity || ""); if (t && !ents.includes(t)) ents.push(t); });
    const loose = inG.filter((e) => !e.entity);
    const body = ents.map((t) => { const l = inG.filter((e) => String(e.entity || "") === t).sort((a, b) => (a.kind === "deck" ? -1 : 0) - (b.kind === "deck" ? -1 : 0)); return '<details class="grp sub"><summary>' + esc(t) + '<span class=n>' + l.length + '</span></summary>' + grid(l, kind) + '</details>'; }).join("") + (loose.length ? grid(loose, kind) : "");
    return '<details class=grp><summary>' + esc(g) + '<span class=n>' + inG.length + '</span></summary>' + body + '</details>';
  }).join("") || '<div class=empty><p>Nothing here yet.</p></div>';
  return '<a class=back href="/momo' + q + '">&#8592; Momo</a><div class=tag>MOMO</div><h1>Product briefs</h1>'
    + '<div class=tabs><button class="tb on" data-k=phone type=button>' + KINDS.phone + '</button><button class=tb data-k=wide type=button>' + KINDS.wide + '</button></div>'
    + '<div class=sec id=phone>' + sec("phone") + '</div><div class="sec hide" id=wide>' + sec("wide") + '</div>'
    + '<div class=sh id=sh><div class=shc><b id=sht></b><a class=b id=shw target=_blank rel=noopener>WhatsApp</a><a class=b id=she>Email</a><button class=b id=shc type=button>Copy link</button><a class="b o" id=sho target=_blank rel=noopener>Open</a><a class="b o hide" id=shp>PowerPoint</a><button class="b x" id=shx type=button>Close</button></div></div>'
    + '<style>.tabs{display:flex;gap:8px;margin:0 0 14px}.tb{flex:1;border:1px solid #D8D1C4;background:#fff;border-radius:999px;padding:9px;font:600 .9rem "IBM Plex Sans",sans-serif;color:#5F6B66}.tb.on{background:#0A4F4A;color:#fff;border-color:#0A4F4A}.hide{display:none}'
    + '.grp{border:1px solid #E7E1D6;border-radius:14px;background:#FFFDF9;margin:0 0 10px;padding:0 10px}.grp summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;padding:12px 2px;font:600 1rem Fraunces,serif;color:#0A4F4A}.grp summary::-webkit-details-marker{display:none}.grp .n{font:600 .75rem "IBM Plex Mono",monospace;color:#8A6F3E;border:1px solid #C5A56A;border-radius:999px;padding:2px 8px}.grp[open]>summary{border-bottom:1px solid #EEE8DD;margin-bottom:10px}.grp.sub{background:#F7F3EA}.grp.sub summary{font-size:.92rem;padding:10px 2px}'
    + '.g{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 12px}.tl{border:1px solid #E7E1D6;background:#fff;border-radius:12px;padding:6px;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:6px}.tl img{width:100%;aspect-ratio:1;object-fit:cover;object-position:top;border-radius:8px;display:block}#wide .tl img{aspect-ratio:16/9}.tl span{font:600 .72rem "IBM Plex Sans",sans-serif;color:#1C2321;line-height:1.25;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.tl.dk{border-color:#C5A56A}.pdf{display:flex;align-items:center;justify-content:center;aspect-ratio:1;border-radius:8px;background:#0A4F4A;color:#fff;font:700 .9rem "IBM Plex Mono",monospace}'
    + '.sh{position:fixed;inset:0;background:rgba(12,20,19,.55);display:none;align-items:flex-end;z-index:50}.sh.on{display:flex}.shc{background:#FAF7F1;width:100%;max-width:560px;margin:0 auto;border-radius:18px 18px 0 0;padding:18px 16px 28px;display:flex;flex-direction:column;gap:8px}.shc b{font-family:Fraunces,serif;font-size:1.05rem;color:#0A4F4A;margin-bottom:6px}.b{border:1px solid #0A4F4A;color:#0A4F4A;background:#fff;border-radius:999px;padding:11px 14px;font:600 .9rem "IBM Plex Sans",sans-serif;text-decoration:none;text-align:center;cursor:pointer}.b.o{border-color:#C5A56A;color:#8A6F3E}.b.x{border-color:#D8D1C4;color:#5F6B66}.b.ok{background:#0A4F4A;color:#fff}</style>'
    + '<script>document.querySelectorAll(".tb").forEach(function(t){t.onclick=function(){document.querySelectorAll(".tb").forEach(function(x){x.classList.remove("on")});t.classList.add("on");document.querySelectorAll(".sec").forEach(function(s){s.classList.toggle("hide",s.id!==t.dataset.k)})}});'
    + 'var SIG="\n\nKind regards,\nDr. Kendall Wilson\nDigitAlchemy Tech Limited\ncontact@digitalabbot.io | +971 56 227 6093";var sh=document.getElementById("sh");function E(i){return document.getElementById(i)}'
    + 'document.querySelectorAll(".tl").forEach(function(b){b.onclick=function(){var t=b.dataset.t,s=b.dataset.s,d=b.dataset.d;E("sht").textContent=t;E("shw").href="https://wa.me/?text="+encodeURIComponent(t+" - DigitAlchemy"+(d?" presentation (PDF)":"")+"\n"+s);E("she").href="mailto:?subject="+encodeURIComponent(t+" - DigitAlchemy")+"&body="+encodeURIComponent("Hello,\n\n"+(d?"Please find our presentation, "+t+", here:":"Here is our "+t+" brief:")+"\n"+s+SIG);E("sho").href=b.dataset.f;E("sho").textContent=d?"Open PDF":"Open";E("shc").dataset.l=s;E("shc").textContent="Copy link";E("shc").classList.remove("ok");var p=E("shp");if(b.dataset.p){p.href=b.dataset.p;p.classList.remove("hide")}else p.classList.add("hide");sh.classList.add("on")}});'
    + 'E("shx").onclick=function(){sh.classList.remove("on")};sh.onclick=function(e){if(e.target===sh)sh.classList.remove("on")};E("shc").onclick=function(){var b=E("shc");navigator.clipboard.writeText(b.dataset.l).then(function(){b.textContent="Copied";b.classList.add("ok")})}</script>';
}

export async function briefsRoute(request, env, url, deps) {
  const p = url.pathname, key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const person = typeof deps.person === "function" ? deps.person(env, url) : "";
  if (person !== "kendall") return new Response("not found", { status: 404 });   // Kendall's key only
  if (p === "/momo/work/briefs" && request.method === "GET") {
    return new Response(deps.page(key, rk, briefsBody(key, rk, await readBriefsIndex(env), url.origin)), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  if (p === "/momo/work/briefs/list" && request.method === "GET") return new Response(JSON.stringify(await readBriefsIndex(env)), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  return new Response("not found", { status: 404 });
}
