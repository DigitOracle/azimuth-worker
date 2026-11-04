// v754 (Kendall 4 Nov 2026, Phase 1 of WORKFLOW_Momo_Meetings_Tasks_Content_Calendar_04NOV2026.md) - Momo's link to Najjuko's
// content calendar (a Google Sheet). Step 1: connect (one tap, her Google account, Sheets permission) and point Momo at the sheet.
// Momo then reads the tabs and the header row of each, and keeps that as the calendar map (cc_map). Nothing is written to the sheet here.
// KV: gsheet_token {refresh_token, access_token, exp, email}, cc_cfg {sheet_id, url, set_at}, cc_map {tabs:[{title, rows, cols, headers}], read_at}
const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export function sheetIdFrom(u) {
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/.exec(String(u || "")) || /^([a-zA-Z0-9_-]{30,})$/.exec(String(u || "").trim());
  return m ? m[1] : "";
}

export async function gsToken(env) {
  let t = null; try { t = JSON.parse((await env.MEETINGS.get("gsheet_token")) || "null"); } catch (e) {}
  if (!t || !t.refresh_token) return null;
  if (t.access_token && t.exp > Date.now() + 60000) return t.access_token;
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.GOOGLE_OAUTH_CLIENT_ID, client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET, refresh_token: t.refresh_token, grant_type: "refresh_token" }) });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) return null;
  t.access_token = j.access_token; t.exp = Date.now() + (j.expires_in || 3600) * 1000;
  await env.MEETINGS.put("gsheet_token", JSON.stringify(t));
  return t.access_token;
}

// the calendar map: every tab, its size, and its header row (first non-empty row in the first five)
export async function readMap(env, sheetId) {
  const tok = await gsToken(env); if (!tok) return { error: "not connected" };
  const H = { Authorization: "Bearer " + tok };
  const meta = await fetch("https://sheets.googleapis.com/v4/spreadsheets/" + sheetId + "?fields=properties.title,sheets.properties(title,gridProperties)", { headers: H });
  if (!meta.ok) return { error: meta.status === 404 ? "sheet not found" : meta.status === 403 ? "no access to this sheet with the connected Google account" : "Google said " + meta.status };
  const m = await meta.json(), tabs = [];
  for (const sh of (m.sheets || []).slice(0, 30)) {
    const t = sh.properties.title, g = sh.properties.gridProperties || {};
    const r = await fetch("https://sheets.googleapis.com/v4/spreadsheets/" + sheetId + "/values/" + encodeURIComponent("'" + t.replace(/'/g, "''") + "'!A1:Z5"), { headers: H });
    const v = r.ok ? ((await r.json()).values || []) : [];
    const headers = (v.find((row) => row.filter((c) => String(c).trim()).length >= 2) || []).map((c) => String(c).trim()).slice(0, 26);
    tabs.push({ title: t, rows: g.rowCount || 0, cols: g.columnCount || 0, headers });
  }
  return { title: (m.properties || {}).title || "", tabs, read_at: new Date().toISOString() };
}

function page(key, rk, tok, cfg, map) {
  const q = "?key=" + encodeURIComponent(key) + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  const step = (n, done, title, body) => '<div class="st' + (done ? " ok" : "") + '"><span class=n>' + (done ? "&#10003;" : n) + '</span><div><b>' + title + '</b>' + body + '</div></div>';
  const s1 = step(1, !!tok, "Connect your Google account", tok
    ? '<p>Connected' + (tok.email ? " as <i>" + esc(tok.email) + "</i>" : "") + '. <a href="/gsheet/start' + q + '">Reconnect</a></p>'
    : '<p>One tap. Sign in with the Google account that can edit the content calendar, then tap <b>Allow</b>.</p><a class=bt href="/gsheet/start' + q + '">Connect Google</a>');
  const s2 = step(2, !!(cfg && cfg.sheet_id), "Paste the content calendar link", '<p>Open the sheet, tap <b>Share → Copy link</b>, paste it here.</p>'
    + '<form id=f><input id=u type=url placeholder="https://docs.google.com/spreadsheets/d/..." value="' + esc(cfg && cfg.url || "") + '"' + (tok ? "" : " disabled") + '><button class=bt' + (tok ? "" : " disabled") + '>Save</button></form><p id=msg class=m></p>');
  const tabs = map && map.tabs ? map.tabs.map((t) => '<div class=tb><b>' + esc(t.title) + '</b><span>' + t.rows + ' rows</span>' + (t.headers.length ? '<p>' + t.headers.map((h) => '<em>' + esc(h) + '</em>').join("") + '</p>' : '<p class=m>no header row found</p>') + '</div>').join("") : "";
  const s3 = step(3, !!(map && map.tabs), "Momo reads the calendar", map && map.tabs ? '<p>' + esc(map.title) + ' · ' + map.tabs.length + ' tabs · read ' + esc(String(map.read_at).slice(0, 16).replace("T", " ")) + ' UTC</p>' + tabs : '<p>After step 2, Momo lists the tabs and columns here so you can check it found the right sheet.</p>');
  return '<a class=back href="/momo/work' + q + '">&#8592; Work</a><div class=tag>MOMO · WORK</div><h1>Content calendar</h1>'
    + '<p class=lead>Connect once. After that Momo can update the calendar from your meetings, and always shows you the changes before it writes anything.</p>'
    + s1 + s2 + s3
    + '<style>.lead{color:#5F6B66;margin:0 0 14px}.st{display:flex;gap:12px;border:1px solid #E7E1D6;background:#FFFDF9;border-radius:14px;padding:14px;margin:0 0 10px}.st .n{flex:0 0 28px;height:28px;border-radius:50%;background:#C5A56A;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}.st.ok .n{background:#0A4F4A}.st b{font-family:Fraunces,serif;color:#0A4F4A}.st p{margin:6px 0;font-size:.9rem}.st>div{min-width:0;flex:1}'
    + '.bt{display:inline-block;background:#0A4F4A;color:#fff;border:0;border-radius:999px;padding:10px 16px;font:600 .9rem "IBM Plex Sans",sans-serif;text-decoration:none;cursor:pointer}.bt[disabled]{opacity:.4}#f{display:flex;gap:8px;flex-wrap:wrap}#u{flex:1;min-width:0;border:1px solid #C5A56A;border-radius:10px;padding:10px;font-size:.9rem}.m{color:#8A6F3E}'
    + '.tb{border-top:1px solid #EFE9DE;padding:8px 0}.tb span{float:right;color:#5F6B66;font-size:.8rem}.tb em{display:inline-block;font-style:normal;font-size:.72rem;border:1px solid #C5A56A;color:#8A6F3E;border-radius:999px;padding:1px 8px;margin:2px 4px 2px 0}</style>'
    + '<script>(function(){var f=document.getElementById("f");if(!f)return;f.onsubmit=function(e){e.preventDefault();var m=document.getElementById("msg");m.textContent="Reading the sheet\\u2026";'
    + 'fetch("/momo/work/calendar' + q + '",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:document.getElementById("u").value})}).then(function(r){return r.json()}).then(function(j){if(j.ok)location.reload();else m.textContent=j.error||"Could not read the sheet."}).catch(function(){m.textContent="Could not reach Momo. Try again."})}})()</script>';
}

export async function calendarRoute(request, env, url, deps) {
  if (url.pathname !== "/momo/work/calendar") return null;
  const key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  if (request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) {}
    const id = sheetIdFrom(b.url);
    if (!id) return J({ error: "That does not look like a Google Sheets link." }, 400);
    const map = await readMap(env, id);
    if (map.error) return J({ error: "Momo could not open it: " + map.error + "." }, 400);
    await env.MEETINGS.put("cc_cfg", JSON.stringify({ sheet_id: id, url: String(b.url).slice(0, 300), set_at: new Date().toISOString() }));
    await env.MEETINGS.put("cc_map", JSON.stringify(map));
    return J({ ok: true, tabs: map.tabs.length });
  }
  let tok = null, cfg = null, map = null;
  try { tok = JSON.parse((await env.MEETINGS.get("gsheet_token")) || "null"); } catch (e) {}
  try { cfg = JSON.parse((await env.MEETINGS.get("cc_cfg")) || "null"); } catch (e) {}
  try { map = JSON.parse((await env.MEETINGS.get("cc_map")) || "null"); } catch (e) {}
  return new Response(deps.page(key, rk, page(key, rk, tok, cfg, map)), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
