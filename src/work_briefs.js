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
  // children: one collapsible group per product line, so 73 cards never become one long scroll (Kendall, 29 Oct)
  const groups = []; items.forEach((e) => { const g = String(e.group || "Other"); if (!groups.includes(g)) groups.push(g); });
  const row = (e, kind) => {
      if (e.kind === "deck") {   // v668 - a whole presentation: one item, one link, sent as a PDF
        const share = origin + "/pb/" + e.slug, pdf = origin + "/pb/d/" + e.slug + ".pdf";
        const txt = encodeURIComponent(e.title + " - DigitAlchemy presentation (PDF)\n" + share), mb = encodeURIComponent("Hello,\n\nPlease find our presentation, " + e.title + ", here:\n" + share + "\n\nKind regards,\nDr. Kendall Wilson\nDigitAlchemy Tech Limited\ncontact@digitalabbot.io | +971 56 227 6093");
        return '<div class="pb dk"><a class=th href="' + esc(pdf) + '" target=_blank rel=noopener>' + (e.wide ? '<img loading=lazy src="/pb/t/' + e.slug + '_wide.jpg" alt="">' : '<span class=pdf>PDF</span>') + '</a><div class=pi><b>' + esc(e.title) + '</b><small>' + (e.pages ? e.pages + " slides · " : "") + 'one PDF</small><div class=bt>'
          + '<a class=b href="https://wa.me/?text=' + txt + '" target=_blank rel=noopener>WhatsApp</a><a class=b href="mailto:?subject=' + encodeURIComponent(e.title + " - DigitAlchemy") + '&body=' + mb + '">Email</a><button class=b type=button data-l="' + esc(share) + '">Copy link</button><a class="b o" href="' + esc(pdf) + '" target=_blank rel=noopener>Open PDF</a>' + (e.pptx ? '<a class="b o" href="' + esc(origin + "/pb/d/" + e.slug + ".pptx") + '">PowerPoint</a>' : "") + '</div></div></div>';
      }
      return null;
  };
  const sec = (kind) => groups.map((g) => {
    const inG = items.filter((e) => String(e.group || "Other") === g && (e.kind === "deck" || e[kind]));
    const ents = []; inG.forEach((e) => { const t = String(e.entity || ""); if (t && !ents.includes(t)) ents.push(t); });
    const render = (list) => list.map((e) => row(e, kind) || (() => {
      const share = origin + "/pb/" + e.slug + "?v=" + kind, img = origin + "/pb/" + e.slug + "_" + kind + ".png";
      const txt = encodeURIComponent(e.title + " - DigitAlchemy\n" + share), mb = encodeURIComponent("Hello,\n\nHere is our " + e.title + " brief:\n" + share + "\n\nKind regards,\nDr. Kendall Wilson\nDigitAlchemy Tech Limited\ncontact@digitalabbot.io | +971 56 227 6093");
      return '<div class=pb><a class=th href="' + esc(img) + '" target=_blank rel=noopener><img loading=lazy src="/pb/t/' + e.slug + "_" + kind + '.jpg" alt=""></a><div class=pi><b>' + esc(e.title) + '</b><div class=bt>'
        + '<a class=b href="https://wa.me/?text=' + txt + '" target=_blank rel=noopener>WhatsApp</a>'
        + '<a class=b href="mailto:?subject=' + encodeURIComponent(e.title + " - DigitAlchemy") + '&body=' + mb + '">Email</a>'
        + '<button class=b type=button data-l="' + esc(share) + '">Copy link</button>'
        + '<a class="b o" href="' + esc(img) + '" target=_blank rel=noopener>Open</a></div></div></div>';
    })()).join("");
    // children: when a group has entities (a client each), one sub-menu per entity; decks first, then that entity's single slides
    const rows = ents.length
      ? ents.map((t) => { const l = inG.filter((e) => String(e.entity || "") === t).sort((a, b) => (a.kind === "deck" ? -1 : 0) - (b.kind === "deck" ? -1 : 0)); return '<details class="grp sub"><summary>' + esc(t) + '<span class=n>' + l.length + '</span></summary>' + render(l) + '</details>'; }).join("") + render(inG.filter((e) => !e.entity))
      : render(inG);
    const n = inG.length;
    return n ? '<details class=grp' + (groups.length === 1 ? " open" : "") + '><summary>' + esc(g) + '<span class=n>' + n + '</span></summary>' + rows + '</details>' : "";
  }).join("") || '<div class=empty><p>Nothing here yet.</p></div>';
  return '<a class=back href="/momo' + q + '">&#8592; Momo</a><div class=tag>MOMO</div><h1>Product briefs</h1>'
    + '<div class=tabs><button class="tb on" data-k=phone type=button>' + KINDS.phone + '</button><button class=tb data-k=wide type=button>' + KINDS.wide + '</button></div>'
    + '<div class=sec id=phone>' + sec("phone") + '</div><div class="sec hide" id=wide>' + sec("wide") + '</div>'
    + '<style>.grp.sub{background:#F7F3EA;margin:0 0 10px}.grp.sub summary{font-size:.95rem;padding:10px 2px}.pb.dk{border-color:#C5A56A}.pdf{display:flex;align-items:center;justify-content:center;width:96px;height:72px;border-radius:8px;background:#0A4F4A;color:#fff;font:700 .9rem "IBM Plex Mono",monospace}.pi small{display:block;color:#5F6B66;font-size:.75rem;margin:-4px 0 8px}.grp{border:1px solid #E7E1D6;border-radius:14px;background:#FFFDF9;margin:0 0 10px;padding:0 10px}.grp summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;padding:12px 2px;font:600 1rem Fraunces,serif;color:#0A4F4A}.grp summary::-webkit-details-marker{display:none}.grp .n{font:600 .75rem "IBM Plex Mono",monospace;color:#8A6F3E;border:1px solid #C5A56A;border-radius:999px;padding:2px 8px}.grp[open] summary{border-bottom:1px solid #EEE8DD;margin-bottom:10px}.tabs{display:flex;gap:8px;margin:0 0 14px}.tb{flex:1;border:1px solid #D8D1C4;background:#fff;border-radius:999px;padding:9px;font:600 .9rem "IBM Plex Sans",sans-serif;color:#5F6B66}.tb.on{background:#0A4F4A;color:#fff;border-color:#0A4F4A}.hide{display:none}'
    + '.pb{display:flex;gap:12px;background:#fff;border:1px solid #E7E1D6;border-radius:16px;padding:10px;margin:0 0 10px}.th img{width:96px;border-radius:8px;display:block}#wide .th img{width:150px}.pi{flex:1;min-width:0}.pi b{font-family:Fraunces,serif;font-weight:600;font-size:1rem;color:#0A4F4A;display:block;margin:2px 0 8px}'
    + '.bt{display:flex;flex-wrap:wrap;gap:6px}.b{border:1px solid #0A4F4A;color:#0A4F4A;background:#fff;border-radius:999px;padding:6px 11px;font:600 .78rem "IBM Plex Sans",sans-serif;text-decoration:none;cursor:pointer}.b.o{border-color:#C5A56A;color:#8A6F3E}.b.ok{background:#0A4F4A;color:#fff}</style>'
    + '<script>document.querySelectorAll(".tb").forEach(function(t){t.onclick=function(){document.querySelectorAll(".tb").forEach(function(x){x.classList.remove("on")});t.classList.add("on");document.querySelectorAll(".sec").forEach(function(s){s.classList.toggle("hide",s.id!==t.dataset.k)})}});'
    + 'document.querySelectorAll("button[data-l]").forEach(function(b){b.onclick=function(){navigator.clipboard.writeText(b.dataset.l).then(function(){b.textContent="Copied";b.classList.add("ok");setTimeout(function(){b.textContent="Copy link";b.classList.remove("ok")},1500)})}})</script>';
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
