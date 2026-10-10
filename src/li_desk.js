// v464 - LINKEDIN FROM THE DESK (Kendall 10 Oct 2026: "i want to do it the same way for insta"). App "DigitAlchemy Desk" (id 266599695),
// products Share on LinkedIn (w_member_social) + Sign In with LinkedIn (OpenID Connect). Posts go to Kendall's PERSONAL profile only:
// company-page posting needs LinkedIn's Community Management API, not granted. The token lasts 60 days with no refresh, so the desk
// reminds him 7 days before. Client ID is public (LI_CLIENT_ID); the secret is the LI_CLIENT_SECRET secret, put by Kendall, never seen.
//   GET /li/start?s=<state>   -> LinkedIn consent (state made by the desk "linkedin" command, 15 minutes, single use)
//   GET /li/callback          -> code -> token -> userinfo (sub) -> KV li_auth
// Video: Videos API initializeUpload -> PUT each 4 MB part (ETag) -> finalizeUpload -> wait AVAILABLE -> Posts API.

export const LI_AUTH_KEY = "li_auth", LI_VERSION = "202609";
const LI_API = "https://api.linkedin.com";
const SCOPES = "openid profile w_member_social";
const H = (tok, json) => Object.assign({ Authorization: "Bearer " + tok, "LinkedIn-Version": LI_VERSION, "X-Restli-Protocol-Version": "2.0.0" }, json ? { "Content-Type": "application/json" } : {});
const redirectOf = (origin) => origin + "/li/callback";

export async function liRecord(env) { try { return JSON.parse((await env.MEETINGS.get(LI_AUTH_KEY)) || "null"); } catch (e) { return null; } }
export function liConnected(a, now) { return !!(a && a.token && a.sub && (!a.expires_at || (now || Date.now()) < a.expires_at)); }

// the desk asks for a sign-in link: a one-time state, good for 15 minutes
export async function liStartLink(env, origin) {
  if (!env.LI_CLIENT_ID) return { err: "LI_CLIENT_ID is not set" };
  const s = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("");
  await env.MEETINGS.put("li_state_" + s, "1", { expirationTtl: 900 });
  return { link: origin + "/li/start?s=" + s };
}

const page = (title, msg, ok) => new Response("<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><title>" + title + "</title><body style='font-family:system-ui;padding:24px;max-width:520px;margin:auto;background:#0A4F4A;color:#fff'><h2 style='color:#C5A56A'>" + title + "</h2><p>" + msg + "</p></body>", { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });

// /li/start and /li/callback; null for any other path. deps: { fetch?, notify(env, text) }
export async function liRoute(env, url, deps) {
  const f = (deps && deps.fetch) || fetch;
  if (url.pathname === "/li/start") {
    const s = url.searchParams.get("s") || "";
    if (!s || !(await env.MEETINGS.get("li_state_" + s))) return page("Link expired", "Ask the desk for a new one: send linkedin.", false);
    const u = new URL("https://www.linkedin.com/oauth/v2/authorization");
    u.searchParams.set("response_type", "code"); u.searchParams.set("client_id", env.LI_CLIENT_ID); u.searchParams.set("redirect_uri", redirectOf(url.origin));
    u.searchParams.set("state", s); u.searchParams.set("scope", SCOPES);
    return Response.redirect(u.toString(), 302);
  }
  if (url.pathname !== "/li/callback") return null;
  const s = url.searchParams.get("state") || "", code = url.searchParams.get("code") || "";
  if (url.searchParams.get("error")) return page("Not connected", "LinkedIn said: " + String(url.searchParams.get("error_description") || url.searchParams.get("error")).slice(0, 200), false);
  if (!s || !(await env.MEETINGS.get("li_state_" + s))) return page("Link expired", "Ask the desk for a new one: send linkedin.", false);
  await env.MEETINGS.delete("li_state_" + s);
  if (!env.LI_CLIENT_SECRET) return page("Not connected", "The LinkedIn secret is not set on the worker.", false);
  const tr = await (await f("https://www.linkedin.com/oauth/v2/accessToken", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectOf(url.origin), client_id: env.LI_CLIENT_ID, client_secret: env.LI_CLIENT_SECRET }).toString() })).json().catch(() => ({}));
  if (!tr || !tr.access_token) return page("Not connected", "LinkedIn refused the sign-in: " + String((tr && (tr.error_description || tr.error)) || "no token").slice(0, 200), false);
  const me = await (await f(LI_API + "/v2/userinfo", { headers: { Authorization: "Bearer " + tr.access_token } })).json().catch(() => ({}));
  if (!me || !me.sub) return page("Not connected", "Signed in, but LinkedIn did not say who you are.", false);
  const rec = { token: tr.access_token, sub: me.sub, name: me.name || "", expires_at: Date.now() + (Number(tr.expires_in) || 5184000) * 1000, scope: tr.scope || SCOPES, at: Date.now() };
  await env.MEETINGS.put(LI_AUTH_KEY, JSON.stringify(rec));
  await env.MEETINGS.delete("li_reminded");
  if (deps && deps.notify) { try { await deps.notify(env, "LinkedIn connected" + (rec.name ? " as " + rec.name : "") + ". Videos can now go to LinkedIn from the desk. Good until " + new Date(rec.expires_at).toISOString().slice(0, 10) + "; I will remind you a week before."); } catch (e) {} }
  return page("LinkedIn connected", "You can close this page. The desk can now post your videos to LinkedIn.", true);
}

// Upload a video (bytes) for the member: initialize, PUT parts, finalize. Returns { video } or { err }.
export async function liUploadVideo(env, a, bytes, deps) {
  const f = (deps && deps.fetch) || fetch;
  const owner = "urn:li:person:" + a.sub;
  const init = await (await f(LI_API + "/rest/videos?action=initializeUpload", { method: "POST", headers: H(a.token, true),
    body: JSON.stringify({ initializeUploadRequest: { owner, fileSizeBytes: bytes.byteLength, uploadCaptions: false, uploadThumbnail: false } }) })).json().catch(() => ({}));
  const v = init && init.value;
  if (!v || !v.video || !Array.isArray(v.uploadInstructions)) return { err: "upload refused: " + String((init && (init.message || init.code)) || "no answer").slice(0, 160) };
  const etags = [];
  for (const ins of v.uploadInstructions) {
    const part = bytes.slice(ins.firstByte, ins.lastByte + 1);
    const r = await f(ins.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: part });
    const et = r && r.headers && r.headers.get("etag");
    if (!r || !r.ok || !et) return { err: "a video part was refused (HTTP " + (r && r.status) + ")" };
    etags.push(et.replace(/^"|"$/g, ""));
  }
  const fin = await f(LI_API + "/rest/videos?action=finalizeUpload", { method: "POST", headers: H(a.token, true),
    body: JSON.stringify({ finalizeUploadRequest: { video: v.video, uploadToken: v.uploadToken || "", uploadedPartIds: etags } }) });
  if (!fin || !fin.ok) { let j = {}; try { j = await fin.json(); } catch (e) {} return { err: "finalize refused: " + String(j.message || ("HTTP " + (fin && fin.status))).slice(0, 160) }; }
  return { video: v.video };
}

export async function liVideoStatus(a, video, deps) {
  const f = (deps && deps.fetch) || fetch;
  const j = await (await f(LI_API + "/rest/videos/" + encodeURIComponent(video), { headers: H(a.token) })).json().catch(() => ({}));
  return { status: (j && j.status) || "UNKNOWN", reason: (j && j.processingFailureReason) || "" };
}

// LinkedIn "little text" reserves these characters; escape them so a caption is posted as written
export function liEscape(s) { return String(s || "").replace(/[\\|{}@\[\]()<>#*_~]/g, (c) => "\\" + c); }
export function liEscapeKeepTags(s) { return String(s || "").split(/(#[A-Za-z0-9_]+)/).map((p, i) => (i % 2 ? p : liEscape(p))).join(""); }

export async function liPostVideo(a, video, caption, deps) {
  const f = (deps && deps.fetch) || fetch;
  const body = { author: "urn:li:person:" + a.sub, commentary: liEscapeKeepTags(caption).slice(0, 2900), visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    content: { media: { id: video } }, lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false };
  const r = await f(LI_API + "/rest/posts", { method: "POST", headers: H(a.token, true), body: JSON.stringify(body) });
  if (r && r.status === 201) { const id = r.headers.get("x-restli-id") || r.headers.get("x-linkedin-id") || ""; return { ok: true, id, url: id ? "https://www.linkedin.com/feed/update/" + id + "/" : "" }; }
  let j = {}; try { j = await r.json(); } catch (e) {}
  return { ok: false, err: "post refused: " + String(j.message || ("HTTP " + (r && r.status))).slice(0, 160) };
}

// one step of an approved LinkedIn video post (state in KV desk_li_pending): upload once, wait for AVAILABLE, post once.
// deps: { send(env,text), fetch? }. "Still processing" is silent; done and refused are told once.
export async function liStep(env, deps) {
  let p = null; try { p = JSON.parse((await env.MEETINGS.get("desk_li_pending")) || "null"); } catch (e) {}
  if (!p || p.posted || !p.approved) return;
  const save = () => env.MEETINGS.put("desk_li_pending", JSON.stringify(p), { expirationTtl: 3 * 86400 });
  const a = await liRecord(env);
  if (!liConnected(a)) { p.approved = false; await save(); await deps.send(env, "LinkedIn is not connected (or the sign-in expired). Send linkedin to connect, then tap the LinkedIn button again."); return; }
  if (!p.video) {
    const bytes = await env.MEETINGS.get("vid_" + p.key, "arrayBuffer");
    if (!bytes) { p.approved = false; await save(); await deps.send(env, "LinkedIn: the video " + p.key + " is no longer stored. Send it to the desk again."); return; }
    const up = await liUploadVideo(env, a, bytes, deps);
    if (up.err) { p.approved = false; await save(); await deps.send(env, "LinkedIn: " + up.err + ". Nothing was posted."); return; }
    p.video = up.video; p.tries = 0; await save();
  }
  const st = await liVideoStatus(a, p.video, deps);
  if (st.status === "PROCESSING_FAILED") { p.approved = false; p.video = undefined; await save(); await deps.send(env, "LinkedIn could not process the video" + (st.reason ? " (" + st.reason + ")" : "") + ". Nothing was posted."); return; }
  if (st.status !== "AVAILABLE") { p.tries = (p.tries || 0) + 1; if (p.tries > 30) { p.approved = false; await deps.send(env, "LinkedIn is still processing after 30 minutes. Not posted; tap LinkedIn again to retry."); } await save(); return; }
  const r = await liPostVideo(a, p.video, p.caption, deps);
  if (r.ok) { p.posted = true; p.id = r.id; p.url = r.url; await save(); await deps.send(env, "Posted to LinkedIn." + (r.url ? " " + r.url : "")); return; }
  p.approved = false; await save(); await deps.send(env, "LinkedIn: " + r.err + ". Tap LinkedIn to try again (the video is already uploaded).");
}

// once a day: a reminder 7 days before the 60-day sign-in runs out (and once when it has)
export async function liReminder(env, deps, now) {
  const a = await liRecord(env); if (!a || !a.expires_at) return;
  const left = a.expires_at - (now || Date.now());
  const stage = left <= 0 ? "expired" : left < 7 * 86400000 ? "soon" : "";
  if (!stage || (await env.MEETINGS.get("li_reminded")) === stage) return;
  await env.MEETINGS.put("li_reminded", stage, { expirationTtl: 70 * 86400 });
  await deps.send(env, stage === "expired" ? "Your LinkedIn sign-in has expired, so videos cannot go to LinkedIn. Send linkedin to sign in again (one tap)." : "Your LinkedIn sign-in runs out on " + new Date(a.expires_at).toISOString().slice(0, 10) + ". Send linkedin to renew it (one tap).");
}
