// v799 - MOMO "NEW LAUNCHES" (Kendall, 7 Nov 2026), for Kendall and Najjuko. Reads the same snapshot the 05:00 feed reads (KV img_launches,
// written by the 04:00 refresh from the announced projects layer): one store, two views. Light cream, 2-up cards, icons not emojis. Each card:
// project, developer, area, from AED (as advertised), unit types, plan, handover, a confidence chip, sources count, last seen, links.
// Filters: This week / All / By developer. Nothing here is for a client sheet: prices are as advertised until the developer's sheet confirms.

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const svg = (d, s) => '<svg viewBox="0 0 24 24" width="' + (s || 14) + '" height="' + (s || 14) + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
export const LAUNCH_ICONS = {
  launch: '<path d="M4 20l4-1 9-9a2.8 2.8 0 0 0-4-4l-9 9-1 4z"/><path d="M13.5 6.5l4 4"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  bed: '<path d="M3 18V8M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6"/>',
  plan: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};
const nf = (v) => Math.round(Number(v) || 0).toLocaleString("en-US");
const ago = (iso, today) => { const d = Math.round((Date.parse(today) - Date.parse(iso)) / 86400000); return isNaN(d) ? "" : d <= 0 ? "today" : d === 1 ? "yesterday" : d + " days ago"; };

export function launchCards(rows, today) {
  return (rows || []).filter((r) => r && r.project).map((r) => {
    const line = (ic, v) => (v ? '<div class=ln>' + svg(LAUNCH_ICONS[ic]) + '<span>' + esc(v) + '</span></div>' : "");
    const links = (r.links || []).slice(0, 3).map((u, i) => '<a class=lk href="' + esc(u) + '" target=_blank rel="noopener noreferrer">' + svg(LAUNCH_ICONS.link, 12) + (/youtube|youtu\.be/.test(u) ? "Video" : /instagram/.test(u) ? "Post" : "Source") + (i ? " " + (i + 1) : "") + "</a>").join("");
    return '<div class=lc data-dev="' + esc(r.developer) + '" data-first="' + esc(r.first_seen) + '">'
      + '<div class=top><span class=ini>' + esc(String(r.developer || "?").slice(0, 1)) + '</span><span class="cf cf-' + esc(r.confidence) + '">' + esc(r.confidence || "low") + '</span></div>'
      + '<b class=pj>' + esc(r.project) + '</b><div class=dv>' + esc(r.developer) + '</div>'
      + line("pin", r.area) + line("tag", r.from_aed ? "from AED " + nf(r.from_aed) : "") + line("bed", r.units) + line("plan", r.plan ? r.plan + " plan" : "") + line("key", r.handover ? "handover " + r.handover : "")
      + '<div class=ft>' + svg(LAUNCH_ICONS.eye, 12) + '<span>seen ' + esc(ago(r.last_seen, today)) + ' &middot; ' + nf(r.sources_n) + ' source' + (r.sources_n === 1 ? "" : "s") + '</span></div>'
      + (links ? '<div class=lks>' + links + '</div>' : "") + '</div>';
  }).join("");
}

export function launchesPage(key, rk, snap, today) {
  const q = "?key=" + encodeURIComponent(key) + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  const rows = (snap && snap.rows) || [];
  const devs = [...new Set(rows.map((r) => r.developer).filter(Boolean))].sort();
  const week = new Date(Date.parse(today) - 7 * 86400000).toISOString().slice(0, 10);
  return '<a class=back href="/momo' + q + '">&#8592; Momo</a><div class=tag>MOMO &middot; MARKET</div><h1>New launches</h1>'
    + '<p class=ld>Launched, not on the DLD register yet. Prices as advertised (developer posts, broker videos, news) until the developer\'s sheet confirms them.</p>'
    + '<div class=fl><button class=on data-f=week>This week</button><button data-f=all>All</button><select id=dv aria-label="By developer"><option value="">By developer</option>' + devs.map((d) => '<option>' + esc(d) + '</option>').join("") + '</select></div>'
    + '<div class=grid id=lg data-week="' + week + '">' + launchCards(rows, today) + '</div><div class=em id=le hidden>' + svg(LAUNCH_ICONS.launch, 28) + '<p>No new launches this week.</p></div>'
    + '<p class=nt>Updated ' + esc((snap && snap.generated) || "not yet") + ' by the 04:00 refresh.</p>'
    + '<style>.ld{color:#5F6B66;font-size:.88rem;margin:0 0 12px}.fl{display:flex;gap:8px;margin:0 0 12px;flex-wrap:wrap}.fl button,.fl select{border:1px solid #C5A56A;background:#FFFDF9;color:#0A4F4A;border-radius:999px;padding:7px 14px;font:600 .82rem "IBM Plex Sans",sans-serif}.fl button.on{background:#0A4F4A;color:#fff;border-color:#0A4F4A}'
    + '.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.lc{background:#FFFDF9;border:1px solid #E7E1D6;border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:4px;min-width:0}'
    + '.top{display:flex;justify-content:space-between;align-items:center}.ini{width:28px;height:28px;border-radius:50%;background:#0A4F4A;color:#F3E7CF;display:flex;align-items:center;justify-content:center;font:600 .9rem Fraunces,serif}'
    + '.cf{font:600 .66rem "IBM Plex Mono",monospace;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:2px 8px}.cf-high{background:#DCEBE4;color:#0A4F4A}.cf-medium{background:#F4E9D2;color:#8A6F3E}.cf-low{background:#EEE9E1;color:#5F6B66}'
    + '.pj{font:600 1rem/1.2 Fraunces,serif;color:#0A4F4A;margin-top:6px;overflow-wrap:anywhere}.dv{font-size:.78rem;color:#8A6F3E;font-weight:600;margin-bottom:4px}'
    + '.ln{display:flex;gap:6px;align-items:flex-start;font-size:.8rem;color:#1C2321}.ln svg{flex:0 0 14px;color:#C5A56A;margin-top:2px}.ln span{min-width:0;overflow-wrap:anywhere}'
    + '.ft{display:flex;gap:5px;align-items:center;font-size:.72rem;color:#5F6B66;margin-top:6px;border-top:1px solid #EFE9DE;padding-top:6px}.lks{display:flex;gap:6px;flex-wrap:wrap}.lk{display:inline-flex;gap:3px;align-items:center;font-size:.72rem;color:#0A4F4A;text-decoration:none;border:1px solid #D8CDB8;border-radius:999px;padding:2px 8px}'
    + '.em{display:flex;flex-direction:column;align-items:center;gap:8px;padding:40px 0;border:1px dashed #D8D1C4;border-radius:18px;color:#5F6B66}.em[hidden]{display:none}.em p{margin:0}.nt{font-size:.72rem;color:#8FA39B;margin-top:14px}</style>'
    + '<script>(function(){var g=document.getElementById("lg"),e=document.getElementById("le"),s=document.getElementById("dv"),f="week",W=g.getAttribute("data-week");'
    + 'function run(){var n=0;[].forEach.call(g.children,function(c){var ok=(f==="all"||c.getAttribute("data-first")>=W)&&(!s.value||c.getAttribute("data-dev")===s.value);c.style.display=ok?"":"none";if(ok)n++});e.hidden=n>0}'
    + '[].forEach.call(document.querySelectorAll(".fl button"),function(b){b.onclick=function(){f=b.getAttribute("data-f");[].forEach.call(document.querySelectorAll(".fl button"),function(x){x.classList.toggle("on",x===b)});run()}});s.onchange=run;run()})()</script>';
}

export async function launchesRoute(request, env, url, deps) {
  if (url.pathname !== "/momo/work/launches" || request.method !== "GET") return null;
  let snap = null; try { snap = await deps.kv(env, "launches"); } catch (e) {}
  const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
  return new Response(deps.page(url.searchParams.get("key") || "", url.searchParams.get("rk") || "", launchesPage(url.searchParams.get("key") || "", url.searchParams.get("rk") || "", snap, today)),
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
