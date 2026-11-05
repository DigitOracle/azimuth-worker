// v786b - her Google Calendar, READ ONLY, in section 1 of the Today card. Account: hernajjesty@gmail.com.
// Its own consent, its own token (gcal_read_token, calendar.readonly). The Meet-booking token (gcal_token) is never read or changed here.
// It lands on the already-registered /gcal/callback; the state starts "gr" so the Meet handler never sees it.
export const GR_SCOPE = "openid email https://www.googleapis.com/auth/calendar.readonly";
export const GR_HINT = "hernajjesty@gmail.com";
const H = (t, b) => new Response(`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><body style="font-family:system-ui;background:#F7F3EA;color:#0A4F4A;padding:2rem;max-width:520px;margin:auto"><h2>${t}</h2>${b}</body>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });

export async function calStart(env, redirect) {
  if (!env.GOOGLE_OAUTH_CLIENT_ID) return new Response("Google sign-in is not set up on the Worker", { status: 500 });
  const st = "gr" + crypto.randomUUID().replace(/-/g, "").slice(0, 20); await env.MEETINGS.put("gcal_read_state", st, { expirationTtl: 3600 });
  return Response.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({ client_id: env.GOOGLE_OAUTH_CLIENT_ID, redirect_uri: redirect, response_type: "code", scope: GR_SCOPE,
    access_type: "offline", prompt: "consent", include_granted_scopes: "false", state: st, login_hint: GR_HINT }).toString(), 302);
}
export async function calCallback(env, url, redirect) {
  const st = url.searchParams.get("state"), code = url.searchParams.get("code");
  if (url.searchParams.get("error")) return H("Not connected", "<p>Google said: " + String(url.searchParams.get("error")).replace(/[<>&]/g, "") + ". Go back to Momo and tap Connect your calendar again.</p>");
  if (!code || st !== (await env.MEETINGS.get("gcal_read_state"))) return H("This link has expired", "<p>Go back to Momo and tap Connect your calendar again.</p>");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: env.GOOGLE_OAUTH_CLIENT_ID, client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET, redirect_uri: redirect, grant_type: "authorization_code" }) });
  const j = await r.json().catch(() => ({}));
  if (!j.refresh_token) return H("Not connected", "<p>Google did not give a lasting permission (" + String(j.error || r.status).replace(/[<>&]/g, "") + "). Tap Connect again and tick the calendar box.</p>");
  let email = ""; try { email = JSON.parse(atob(String(j.id_token || "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).email || ""; } catch (e) {}
  await env.MEETINGS.put("gcal_read_token", JSON.stringify({ refresh_token: j.refresh_token, access_token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000, email, granted: new Date().toISOString(), scope: j.scope || "" }));
  await env.MEETINGS.delete("gcal_read_state"); await env.MEETINGS.delete("gcal_read_cache");
  return H("Connected", "<p>Momo can now read your calendar" + (email ? " (" + email.replace(/[<>&]/g, "") + ")" : "") + ". It only reads; it never adds, changes or deletes anything.</p><p>Go back to Momo: today's meetings now show at the top of Work.</p>");
}
async function token(env) {
  let t = null; try { t = JSON.parse((await env.MEETINGS.get("gcal_read_token")) || "null"); } catch (e) {}
  if (!t || !t.refresh_token) return null;
  if (t.access_token && t.exp > Date.now() + 60000) return t.access_token;
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env.GOOGLE_OAUTH_CLIENT_ID, client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET, refresh_token: t.refresh_token, grant_type: "refresh_token" }) });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) { await env.MEETINGS.put("gcal_read_err", "refresh " + r.status + " " + (j.error || "")); return null; }
  t.access_token = j.access_token; t.exp = Date.now() + (j.expires_in || 3600) * 1000; await env.MEETINGS.put("gcal_read_token", JSON.stringify(t)); return t.access_token;
}
// today's events (Dubai day), cached 5 minutes. {connected, email, events:[{id,time,end,title,where,all_day}]}
export async function calToday(env, today) {
  let raw = null; try { raw = JSON.parse((await env.MEETINGS.get("gcal_read_token")) || "null"); } catch (e) {}
  if (!raw) return { connected: false };
  try { const c = JSON.parse((await env.MEETINGS.get("gcal_read_cache")) || "null"); if (c && c.day === today && c.at > Date.now() - 300e3) return c.v; } catch (e) {}
  const at = await token(env); if (!at) return { connected: false, broken: true };
  const q = new URLSearchParams({ timeMin: today + "T00:00:00+04:00", timeMax: today + "T23:59:59+04:00", singleEvents: "true", orderBy: "startTime", maxResults: "25", timeZone: "Asia/Dubai" });
  const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?" + q, { headers: { Authorization: "Bearer " + at } });
  if (!r.ok) { await env.MEETINGS.put("gcal_read_err", "events " + r.status + " " + (await r.text()).slice(0, 200)); return { connected: true, email: raw.email, events: [], error: true }; }
  const j = await r.json();
  const hm = (s) => { const m = /T(\d{2}:\d{2})/.exec(s || ""); return m ? m[1] : ""; };
  const events = (j.items || []).filter((e) => e.status !== "cancelled").map((e) => ({ id: e.id, time: hm(e.start && e.start.dateTime), end: hm(e.end && e.end.dateTime), all_day: !!(e.start && e.start.date), title: String(e.summary || "Busy").slice(0, 120), where: String(e.location || "").slice(0, 120) }));
  const v = { connected: true, email: raw.email, events };
  await env.MEETINGS.put("gcal_read_cache", JSON.stringify({ day: today, at: Date.now(), v }), { expirationTtl: 3600 });
  return v;
}
