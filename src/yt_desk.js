// v477 - YOUTUBE FROM THE DESK (Kendall 11 Oct 2026: "We have a YouTube channel Digital Abbott has. Can we do something with that as well?").
// "youtube" on the desk -> a one-tap Google sign-in for the channel owner (scope youtube.upload + youtube.readonly) -> the refresh token
// is kept in KV yt_auth. Post it -> Post where? gains YouTube: the video's bytes go up by the resumable upload. A vertical clip under
// 60 s becomes a Short (#Shorts in the title). Google keeps uploads from an unaudited API project PRIVATE, so by default (YT_PUBLIC unset)
// we upload as private and say so; set YT_PUBLIC=on once the project passes Google's audit. Client: the existing GOOGLE_OAUTH_CLIENT_ID.
export const YT_AUTH_KEY = "yt_auth";
const SCOPES = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";
const redirectOf = (origin) => origin + "/yt/callback";
const page = (title, msg, ok) => new Response("<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><title>" + title + "</title><body style='font-family:system-ui;padding:24px;max-width:520px;margin:auto;background:#0A4F4A;color:#fff'><h2 style='color:#C5A56A'>" + title + "</h2><p>" + msg + "</p></body>", { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });

export async function ytRecord(env) { try { return JSON.parse((await env.MEETINGS.get(YT_AUTH_KEY)) || "null"); } catch (e) { return null; } }
export const ytConnected = (a) => !!(a && a.refresh_token);

export async function ytStartLink(env, origin) {
  if (!env.GOOGLE_OAUTH_CLIENT_ID) return { err: "GOOGLE_OAUTH_CLIENT_ID is not set" };
  const s = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("");
  await env.MEETINGS.put("yt_state_" + s, "1", { expirationTtl: 900 });
  const a = await ytRecord(env);
  return { link: origin + "/yt/start?s=" + s, connected: ytConnected(a), channel: a && a.channel };
}

// /yt/start and /yt/callback; null for any other path. deps: { fetch?, notify(env, text) }
export async function ytRoute(env, url, deps) {
  const f = (deps && deps.fetch) || fetch;
  if (url.pathname === "/yt/start") {
    const s = url.searchParams.get("s") || "";
    if (!s || !(await env.MEETINGS.get("yt_state_" + s))) return page("Link expired", "Ask the desk for a new one: send youtube.", false);
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    for (const [k, v] of Object.entries({ client_id: env.GOOGLE_OAUTH_CLIENT_ID, redirect_uri: redirectOf(url.origin), response_type: "code", scope: SCOPES, access_type: "offline", prompt: "consent select_account", include_granted_scopes: "false", state: s })) u.searchParams.set(k, v);
    return Response.redirect(u.toString(), 302);
  }
  if (url.pathname !== "/yt/callback") return null;
  const s = url.searchParams.get("state") || "", code = url.searchParams.get("code") || "";
  if (url.searchParams.get("error")) return page("Not connected", "Google said: " + String(url.searchParams.get("error")).slice(0, 200), false);
  if (!s || !(await env.MEETINGS.get("yt_state_" + s))) return page("Link expired", "Ask the desk for a new one: send youtube.", false);
  await env.MEETINGS.delete("yt_state_" + s);
  const tr = await (await f("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: String(env.GOOGLE_OAUTH_CLIENT_ID).trim(), client_secret: String(env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim(), redirect_uri: redirectOf(url.origin), grant_type: "authorization_code" }).toString() })).json().catch(() => ({}));
  if (!tr || !tr.refresh_token) return page("Not connected", "Google did not give a lasting permission (" + String((tr && (tr.error_description || tr.error)) || "no token").slice(0, 160) + "). Try the link again and tick every box.", false);
  const ch = await (await f("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", { headers: { Authorization: "Bearer " + tr.access_token } })).json().catch(() => ({}));
  const c = ch && ch.items && ch.items[0];
  if (!c) return page("Not connected", "Signed in, but that Google account has no YouTube channel" + (ch && ch.error ? " (" + String(ch.error.message || "").slice(0, 160) + ")" : "") + ". Sign in with the account that owns the Digital Abbot channel; if the channel is a brand account, pick it on the account chooser.", false);
  const rec = { refresh_token: tr.refresh_token, access_token: tr.access_token, exp: Date.now() + (Number(tr.expires_in) || 3600) * 1000, channel: c.snippet && c.snippet.title, channel_id: c.id, subs: c.statistics && c.statistics.subscriberCount, at: Date.now() };
  await env.MEETINGS.put(YT_AUTH_KEY, JSON.stringify(rec));
  if (deps && deps.notify) { try { await deps.notify(env, "YouTube connected: " + rec.channel + (rec.subs ? " (" + rec.subs + " subscribers)" : "") + ". Post it now offers YouTube too."); } catch (e) {} }
  return page("YouTube connected", "Channel: " + rec.channel + ". You can close this page.", true);
}

export async function ytToken(env, deps) {
  const f = (deps && deps.fetch) || fetch, a = await ytRecord(env);
  if (!ytConnected(a)) return { err: "YouTube is not connected (send youtube)" };
  if (a.access_token && a.exp > Date.now() + 60000) return { token: a.access_token, a };
  const j = await (await f("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: String(env.GOOGLE_OAUTH_CLIENT_ID).trim(), client_secret: String(env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim(), refresh_token: a.refresh_token, grant_type: "refresh_token" }).toString() })).json().catch(() => ({}));
  if (!j.access_token) return { err: "Google refused the stored permission (" + (j.error || "no token") + "); send youtube to sign in again" };
  a.access_token = j.access_token; a.exp = Date.now() + (Number(j.expires_in) || 3600) * 1000; await env.MEETINGS.put(YT_AUTH_KEY, JSON.stringify(a));
  return { token: j.access_token, a };
}

// title/description from the post caption: first line (no hashtags) as the title, #Shorts when short
export function ytMeta(caption, isShort) {
  const c = String(caption || "").trim(), first = (c.split(/\n/)[0] || "Digital Abbot").replace(/#\w+/g, "").replace(/\s+/g, " ").trim();
  let title = first.length > 90 ? first.slice(0, 87).replace(/\s+\S*$/, "") + "..." : first;
  if (isShort) title = (title + " #Shorts").slice(0, 100);
  const tags = (c.match(/#(\w+)/g) || []).map((t) => t.slice(1)).slice(0, 10);
  return { title: title || "Digital Abbot", description: (c + "\n\nDigitAlchemy Tech Limited - contact@digitalabbot.io").slice(0, 4900), tags };
}

// upload bytes; returns { id, url, privacy } or { err }
export async function ytUpload(env, bytes, caption, opts, deps) {
  const f = (deps && deps.fetch) || fetch;
  const t = await ytToken(env, deps); if (t.err) return t;
  const privacy = String(env.YT_PUBLIC || "").toLowerCase() === "on" ? "public" : "private";
  const m = ytMeta(caption, !!(opts && opts.short));
  const init = await f("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", { method: "POST",
    headers: { Authorization: "Bearer " + t.token, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": String(bytes.byteLength) },
    body: JSON.stringify({ snippet: { title: m.title, description: m.description, tags: m.tags, categoryId: "28" }, status: { privacyStatus: privacy, selfDeclaredMadeForKids: false } }) });
  const loc = init.headers.get("location");
  if (!init.ok || !loc) { const e = await init.json().catch(() => ({})); return { err: "YouTube refused the upload (" + init.status + "): " + String((e.error && e.error.message) || "").slice(0, 200) }; }
  const put = await f(loc, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: bytes });
  const v = await put.json().catch(() => ({}));
  if (!put.ok || !v.id) return { err: "the upload did not finish (" + put.status + "): " + String((v.error && v.error.message) || "").slice(0, 200) };
  return { id: v.id, url: (opts && opts.short ? "https://youtube.com/shorts/" : "https://youtu.be/") + v.id, privacy: (v.status && v.status.privacyStatus) || privacy };
}
