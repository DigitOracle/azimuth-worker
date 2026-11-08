// v812 (Kendall 8 Nov: "every Momo screen must have a Back button, a Home button, or both") - the safety net. Every HTML page the worker serves
// under /momo and /fit is checked on the way out; a page with no navigation of its own (no Back control, no "&#8592;" link) gets the shared pair:
// Back (the same behaviour as BACK_JS in reportHtml: close the tab the app opened, else history back, else Work) and Home (/momo, keeping the key).
// Pages that already have their own Back are left alone. Public one-person pages (check-in links, tracked links) are not Momo screens and are skipped.
// The header X-Momo-Nav: added marks a page that needed it, so the gap can be found and fixed at its source.
const HAS_NAV = /id=["']?bk\b|class=["']?(back|bk)\b|&#8592;|←|data-momo-nav/;
const SKIP = [/^\/momo\/checkin\//, /^\/momo\/bridge\//, /^\/momo\/today\.js$/, /^\/momo\/work\.js$/, /\.js$/];
export function needsNav(pathname, html) {
  if (pathname === "/momo" || pathname === "/fit" || !/^\/(momo|fit)(\/|$)/.test(pathname) || SKIP.some((r) => r.test(pathname))) return false;
  return /<\/body>/i.test(html) && !HAS_NAV.test(html);
}
export function navBar(url) {
  const key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const home = "/momo" + (key ? "?key=" + encodeURIComponent(key) + (rk ? "&rk=" + encodeURIComponent(rk) : "") : "");
  const st = "font:600 14px/1 'IBM Plex Sans',system-ui,sans-serif;border-radius:999px;padding:10px 16px;text-decoration:none;border:1.5px solid #0A4F4A;cursor:pointer";
  return "<div data-momo-nav=1 class=btns style='position:fixed;left:12px;bottom:12px;z-index:9999;display:flex;gap:8px'><style>@media print{[data-momo-nav]{display:none!important}}</style>"
    + "<button type=button id=mnbk style=\"" + st + ";background:#fff;color:#0A4F4A\">&#8592; Back</button><a href=\"" + home + "\" style=\"" + st + ";background:#0A4F4A;color:#fff\">Home</a></div>"
    + "<script>document.getElementById('mnbk').onclick=function(){if(window.opener||history.length<=1){window.close()}if(history.length>1){history.back()}else{location.href=" + JSON.stringify(home) + "}};</script>";
}
export async function navGuard(request, url, resp) {
  try {
    if (!resp || request.method !== "GET" || resp.status !== 200) return resp;
    if (!/text\/html/i.test(resp.headers.get("Content-Type") || "")) return resp;
    if (!/^\/(momo|fit)(\/|$)/.test(url.pathname)) return resp;
    const html = await resp.clone().text();
    if (!needsNav(url.pathname, html)) return resp;
    const h = new Headers(resp.headers); h.set("X-Momo-Nav", "added"); h.delete("Content-Length");
    return new Response(html.replace(/<\/body>(?![\s\S]*<\/body>)/i, navBar(url) + "</body>"), { status: resp.status, headers: h });
  } catch (e) { return resp; }
}
