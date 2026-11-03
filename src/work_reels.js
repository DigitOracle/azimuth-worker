// v700 (Kendall, 3 Nov 2026: "Go reels"): the Reels card on Momo's front door (Najjuko's and Kendall's), modelled on src/work_presentations.js.
// One entry = one finished video. KV keys in MEETINGS:
//   reels_index        JSON list of {slug, title, event?, date?, features?, secs?, format?, video_key, caption?}
//   vid_<video_key>    the video, through the existing PUT /video_upload + GET /video/<key> route (KV up to 24 MiB)
//   vidposter_<key>    its poster jpg (PUT /video_upload?poster=1), served at /video/<key>?poster=1
// Public, no key: /reel/<slug> share page (the video and its title).
// New entries: upload the video + poster, then merge the entry into reels_index BY SLUG (re-read just before the write); no deploy.
const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const SLUG_RE = /^[a-z0-9-]{1,60}$/;
const VKEY_RE = /^[a-z0-9_]{1,80}$/i;
const FORMATS = ["9:16", "4:5", "16:9", "1:1"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const REELS_ICON = '<rect x="3" y="8" width="18" height="13" rx="1.5"/><path d="M3 8l2.5-4.5 15 0L21 8"/><path d="M8 3.5L10 8M13.5 3.5L15.5 8"/><path d="M10.5 11.5v6l5-3z"/>';
export const REELS_PEOPLE = ["najjuko", "kendall"];

const reelDate = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || "")); return m ? parseInt(m[3], 10) + " " + MONTHS[parseInt(m[2], 10) - 1] + " " + m[1] : ""; };
const reelLen = (s) => { const n = Math.round(Number(s) || 0); if (n <= 0) return ""; const m = Math.floor(n / 60), r = n % 60; return m ? m + " min" + (r ? " " + r + " s" : "") : r + " s"; };
const one = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
export function cleanReel(x) {
  if (!x || !SLUG_RE.test(String(x.slug || "")) || !String(x.title || "").trim() || !VKEY_RE.test(String(x.video_key || ""))) return null;
  const e = { slug: String(x.slug), title: one(x.title, 120), video_key: String(x.video_key) };
  if (x.event) e.event = one(x.event, 200);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(x.date || ""))) e.date = String(x.date);
  if (x.features) e.features = one(x.features, 120);
  if (Number(x.secs) > 0) e.secs = Math.round(Number(x.secs));
  if (FORMATS.includes(String(x.format || ""))) e.format = String(x.format);
  if (x.caption) e.caption = String(x.caption).trim().slice(0, 3000);
  return e;
}
export async function readReels(env) {
  let r = [];
  try { r = JSON.parse(await env.MEETINGS.get("reels_index")) || []; } catch (e) {}
  return Array.isArray(r) ? r.map(cleanReel).filter(Boolean) : [];
}
// newest first by date; on the same day the short reels before the long recordings, then by title; undated last
export const reelsSorted = (items) => items.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || ((a.secs || 0) > 90) - ((b.secs || 0) > 90) || String(a.title).localeCompare(String(b.title)));

export async function reelPublic(request, env, url) {
  const m = url.pathname.match(/^\/reel\/([a-z0-9-]{1,60})\/?$/);
  if (!m) return null;
  const e = (await readReels(env)).find((x) => x.slug === m[1]);
  if (!e) return new Response("not found", { status: 404 });
  const v = "/video/" + e.video_key, dt = reelDate(e.date);
  const sub = [e.event, dt].filter(Boolean).join(" · ");
  return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(e.title) + '</title>'
    + '<meta property="og:title" content="' + esc(e.title) + '"><meta property="og:description" content="' + esc(sub || "Video") + '">'
    + '<meta property="og:image" content="' + esc(url.origin + v + "?poster=1") + '"><meta property="og:video" content="' + esc(url.origin + v) + '">'
    + '<style>body{margin:0;background:#0C1413;color:#E8E4D8;display:flex;flex-direction:column;align-items:center;padding:20px 16px;font-family:system-ui,sans-serif;text-align:center}.w{max-width:720px;width:100%}h1{font-size:1.3rem;font-weight:600;margin:10px 0 4px}.d{color:#8FA39B;font-size:.9rem;margin:0 0 14px}video{width:100%;max-height:80vh;border-radius:10px;background:#000}</style></head><body><div class=w>'
    + '<h1>' + esc(e.title) + '</h1>' + (sub ? '<p class=d>' + esc(sub) + '</p>' : "")
    + '<video id=reel_v controls playsinline preload=metadata poster="' + esc(v + "?poster=1") + '" src="' + esc(v) + '"></video></div></body></html>',
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}

const ic = (d, s, c) => '<svg viewBox="0 0 24 24" width=' + (s || 26) + ' height=' + (s || 26) + ' fill="none" stroke="' + (c || "#C5A56A") + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true>' + d + '</svg>';

export function reelsBody(key, rk, items, origin) {
  const q = "?key=" + encodeURIComponent(key) + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  const tile = (e, i) => {
    const share = origin + "/reel/" + e.slug, v = "/video/" + e.video_key, poster = v + "?poster=1";
    const meta = [reelDate(e.date), reelLen(e.secs), e.format].filter(Boolean);
    return '<div class=rt id="reel_' + esc(e.slug) + '"><div class=rv><img class=rp loading=lazy alt="" src="' + esc(poster) + '"><button class=rpl type=button data-i=' + i + ' aria-label="Play">' + ic('<path d="M8 5.5v13l11-6.5z"/>', 30, "#fff") + '</button>'
      + '<video class=rvid hidden playsinline controls preload=none poster="' + esc(poster) + '" data-src="' + esc(v) + '"></video></div>'
      + '<div class=rx><b>' + esc(e.title) + '</b>' + (e.event ? '<i>' + esc(e.event) + '</i>' : "") + (e.features ? '<i class=rf>Features ' + esc(e.features) + '</i>' : "")
      + (meta.length ? '<span class=ch>' + meta.map((h) => '<em>' + esc(h) + '</em>').join("") + '</span>' : "") + '</div>'
      + '<div class=ba><button class=b type=button data-p=' + i + '>Play</button><a class=b href="' + esc(v) + '" download="' + esc(e.slug) + '.mp4">Save</a>'
      + '<a class="b w" target=_blank rel=noopener href="https://wa.me/?text=' + encodeURIComponent(e.title + "\n" + share) + '">Send on WhatsApp</a>'
      + (e.caption ? '<button class="b o rc" type=button data-c="' + esc(e.caption) + '">Copy caption</button>' : "") + '</div></div>';
  };
  const list = items.length ? '<div class=pl id=reels_list>' + reelsSorted(items).map(tile).join("") + '</div>'
    : '<div class=empty id=reels_empty>' + ic(REELS_ICON, 34) + '<p><b>Reels coming</b></p><p>Finished videos will appear here, ready to play, save and send.</p></div>';
  return '<a class=back href="/momo' + q + '">&#8592; Momo</a><div class=tag>MOMO</div><h1>Reels</h1>' + list
    + '<style>.rt,.b,.rv,.rx{box-sizing:border-box;min-width:0;max-width:100%}.rx b,.rx i{overflow-wrap:anywhere}.pl{display:flex;flex-direction:column;gap:12px}.rt{border:1px solid #E7E1D6;background:#FFFDF9;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:10px}'
    + '.rv{position:relative;border-radius:10px;overflow:hidden;background:#0C1413}.rp{display:block;width:100%;max-height:340px;object-fit:contain}.rpl{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:58px;height:58px;border-radius:50%;border:0;background:rgba(10,79,74,.85);display:flex;align-items:center;justify-content:center;cursor:pointer}.rvid{width:100%;max-height:70vh;background:#000}'
    + '.rx{display:flex;flex-direction:column;gap:3px}.rx b{font:600 1rem Fraunces,serif;color:#0A4F4A}.rx i{font:500 .78rem "IBM Plex Sans",sans-serif;color:#5F6B66;font-style:normal}.rx i.rf{color:#8A6F3E}.ch{display:flex;gap:6px;flex-wrap:wrap;margin-top:3px}.ch em{font:600 .62rem "IBM Plex Mono",monospace;color:#8A6F3E;border:1px solid #C5A56A;border-radius:999px;padding:2px 8px;font-style:normal}'
    + '.ba{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}.b{border:1px solid #0A4F4A;color:#0A4F4A;background:#fff;border-radius:999px;padding:10px 12px;font:600 .85rem "IBM Plex Sans",sans-serif;text-decoration:none;text-align:center;cursor:pointer}.b.w{background:#0A4F4A;color:#fff}.b.o{border-color:#C5A56A;color:#8A6F3E}.b.ok{background:#0A4F4A;color:#fff;border-color:#0A4F4A}'
    + '.empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:34px 18px;border:1px dashed #C5A56A;border-radius:18px;text-align:center;color:#5F6B66}.empty p{margin:0}.empty b{font-family:Fraunces,serif;font-size:1.1rem;color:#0A4F4A}</style>'
    + '<script>(function(){var T=document.querySelectorAll(".rt");function play(i){var t=T[i];if(!t)return;var v=t.querySelector("video");if(!v.src)v.src=v.dataset.src;v.hidden=false;var p=t.querySelector(".rp"),b=t.querySelector(".rpl");if(p)p.remove();if(b)b.remove();var r=v.play();if(r&&r.catch)r.catch(function(){})}'
    + 'document.querySelectorAll("[data-p],.rpl").forEach(function(b){b.onclick=function(){play(+(b.dataset.p||b.dataset.i))}});'
    + 'document.querySelectorAll(".rc").forEach(function(b){b.onclick=function(){var c=b.dataset.c;function ok(){b.textContent="Copied";b.classList.add("ok");setTimeout(function(){b.textContent="Copy caption";b.classList.remove("ok")},2500)}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(c).then(ok,function(){fb()})}else fb();function fb(){var a=document.createElement("textarea");a.value=c;document.body.appendChild(a);a.select();try{document.execCommand("copy");ok()}catch(e){}a.remove()}}})})()</script>';
}

export async function reelsRoute(request, env, url, deps) {
  const p = url.pathname, key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const who = typeof deps.person === "function" ? deps.person(env, url) : "";
  if (!REELS_PEOPLE.includes(who) || (who === "najjuko" && typeof deps.isNaj === "function" && !deps.isNaj(env, url))) return new Response("not found", { status: 404 });
  if (p === "/momo/work/reels" && request.method === "GET") {
    return new Response(deps.page(key, rk, reelsBody(key, rk, await readReels(env), url.origin)), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  if (p === "/momo/work/reels/list" && request.method === "GET") return new Response(JSON.stringify(reelsSorted(await readReels(env))), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  return new Response("not found", { status: 404 });
}
