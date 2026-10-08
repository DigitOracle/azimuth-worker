// v404 - DESK INSTAGRAM: a second, independent Instagram connection for the DigitAlchemy desk account (@digitalabbotuae).
// It lives in its own KV record, ig_auth_desk, so authorising it can never overwrite Najjuko's connection (ig_auth) that feeds her
// insights pull. Nothing here touches ig_auth, ig_status, ig_log, ig_media or any other key of hers, and nothing here posts by itself:
// the only publish entry (deskIgPublish) refuses unless a caller passes approved:true, and no button calls it yet.
// Record fields, and nothing else: user_id, username, account_type, perms, token, expires_at, linked_at. The app secret is never stored.
export const DESK_AUTH_KEY = "ig_auth_desk";
export const IGDESK_SCOPES = "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights";
export const IGDESK_STATE_TTL_MS = 15 * 60 * 1000;          // a link is good for fifteen minutes
const NONCE_PREFIX = "ig_desk_state_";
const GRAPH = "https://graph.instagram.com";
const enc = new TextEncoder();
const b64u = (bytes) => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4)), (c) => c.charCodeAt(0));

// The state is signed with READ_KEY (an existing secret; the app secret is kept out of anything that rides in a URL).
async function mac(env, text) {
  const key = await crypto.subtle.importKey("raw", enc.encode("igdesk-state|" + String(env.READ_KEY || "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
}
export const isDeskState = (s) => /^d\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(String(s || ""));
export async function deskIgMakeState(env, now) {
  const nonce = b64u(crypto.getRandomValues(new Uint8Array(12)));
  const body = b64u(enc.encode(JSON.stringify({ a: "desk", n: nonce, e: (now || Date.now()) + IGDESK_STATE_TTL_MS })));
  const sig = b64u(await mac(env, "d." + body));
  return { state: "d." + body + "." + sig, nonce, ttl_s: Math.ceil(IGDESK_STATE_TTL_MS / 1000) };
}
// Returns the nonce when the state is genuine, unexpired and of the desk; otherwise "".
export async function deskIgVerifyState(env, state, now) {
  if (!env.READ_KEY || !isDeskState(state)) return "";
  const [, body, sig] = String(state).split(".");
  try {
    const want = await mac(env, "d." + body), got = unb64u(sig);
    if (got.length !== want.length) return "";
    let diff = 0; for (let i = 0; i < want.length; i++) diff |= want[i] ^ got[i];
    if (diff) return "";
    const p = JSON.parse(new TextDecoder().decode(unb64u(body)));
    if (!p || p.a !== "desk" || !p.n || !(Number(p.e) > (now || Date.now()))) return "";
    return String(p.n);
  } catch (e) { return ""; }
}

// /ig_link?acct=desk : the Instagram Login URL for the desk account, with a signed one-use state. Writes only the one-use nonce.
export async function deskIgLink(env, redirectUri) {
  if (!env.IG_APP_ID) return { error: "IG_APP_ID not set" };
  if (!env.READ_KEY) return { error: "READ_KEY not set" };
  const s = await deskIgMakeState(env);
  await env.MEETINGS.put(NONCE_PREFIX + s.nonce, "1", { expirationTtl: Math.max(60, s.ttl_s + 60) });
  const u = new URL("https://www.instagram.com/oauth/authorize");
  u.searchParams.set("client_id", env.IG_APP_ID); u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code"); u.searchParams.set("scope", IGDESK_SCOPES); u.searchParams.set("state", s.state);
  u.searchParams.set("force_reauth", "true");   // the browser may be signed in as Najjuko: make Instagram ask which account
  return { acct: "desk", link: u.toString(), redirect_uri: redirectUri, scopes: IGDESK_SCOPES, expires_in_minutes: IGDESK_STATE_TTL_MS / 60000 };
}

async function igGet(path, token, params) {
  const u = new URL(GRAPH + path);
  for (const k in (params || {})) u.searchParams.set(k, String(params[k]));
  u.searchParams.set("access_token", token);
  let r = null, j = null;
  try { r = await fetch(u.toString()); } catch (e) { return { err: "network" }; }
  try { j = await r.json(); } catch (e) {}
  if (!r.ok || !j || j.error) return { err: String((j && j.error && (j.error.message || j.error.type)) || ("HTTP " + r.status)).slice(0, 120) };
  return j;
}
export async function deskIgRecord(env) { try { return JSON.parse((await env.MEETINGS.get(DESK_AUTH_KEY)) || "null"); } catch (e) { return null; } }

// The callback for a desk state. Returns { status, title, msg } for the page; stores the long-lived token ONLY in ig_auth_desk.
export async function deskIgCallback(env, state, codeIn, redirectUri) {
  const bad = { status: 410, title: "This link has expired", msg: "Ask for a fresh link and try again." };
  const nonce = await deskIgVerifyState(env, state);
  if (!nonce || !codeIn) return bad;
  const nk = NONCE_PREFIX + nonce;
  if (!(await env.MEETINGS.get(nk))) return bad;
  try { await env.MEETINGS.delete(nk); } catch (e) {}                                  // one use: gone before the exchange, so a replay finds nothing
  if (!env.IG_APP_SECRET) return { status: 503, title: "Not quite ready", msg: "Please try the link again a little later." };
  const fail = { status: 502, title: "That didn't work", msg: "Instagram didn't finish connecting. Please ask for a fresh link." };
  let s0 = null;
  try {
    const r = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.IG_APP_ID, client_secret: env.IG_APP_SECRET, grant_type: "authorization_code", redirect_uri: redirectUri, code: String(codeIn).replace(/#_$/, "") }).toString() });
    const sj = await r.json(); s0 = sj && (Array.isArray(sj.data) ? sj.data[0] : sj);
  } catch (e) {}
  if (!s0 || !s0.access_token) return fail;
  const ll = await igGet("/access_token", s0.access_token, { grant_type: "ig_exchange_token", client_secret: env.IG_APP_SECRET });
  if (ll.err || !ll.access_token) return fail;
  const me = await igGet("/me", ll.access_token, { fields: "user_id,username,account_type" });
  const uid = String((me && me.user_id) || s0.user_id || "");
  let najj = null; try { najj = JSON.parse((await env.MEETINGS.get("ig_auth")) || "null"); } catch (e) {}
  const najjId = najj && (najj.user_id || najj.userId);
  if (uid && najjId && String(najjId) === uid)                                          // signed in as Najjuko: the desk record would just duplicate hers
    return { status: 409, title: "Wrong account", msg: "That is not the desk's Instagram account. Sign in as the desk account and ask for a fresh link." };
  const perms = Array.isArray(s0.permissions) ? s0.permissions.join(",") : String(s0.permissions || "");
  const rec = { user_id: uid, username: (me && me.username) || "", account_type: (me && me.account_type) || "", perms, token: ll.access_token,
    expires_at: Date.now() + (Number(ll.expires_in) || 5184000) * 1000, linked_at: new Date().toISOString() };
  await env.MEETINGS.put(DESK_AUTH_KEY, JSON.stringify(rec));
  return { status: 200, title: "Desk Instagram connected", msg: "The desk can now read its Instagram numbers" + (deskIgCanPost(rec) ? " and, after your approval each time, post." : ". Posting was not granted.") + " You can close this page." };
}

export function deskIgCanPost(a) { return !!(a && a.token && String(a.perms || "").indexOf("content_publish") >= 0); }
const ymd = (ms) => { try { return new Date(ms).toISOString().slice(0, 10); } catch (e) { return ""; } };

// Status without the token.
export async function deskIgStatus(env, nowMs) {
  const a = await deskIgRecord(env);
  const expired = !!(a && a.expires_at && (nowMs || Date.now()) > a.expires_at);
  return { acct: "desk", connected: !!(a && a.token) && !expired, username: a ? a.username : null, account_type: a ? a.account_type : null,
    permissions: a ? a.perms : null, can_post: deskIgCanPost(a) && !expired, token_expires: a && a.expires_at ? new Date(a.expires_at).toISOString() : null,
    linked_at: a ? a.linked_at : null, expired };
}
export async function deskIgStatusText(env) {
  const s = await deskIgStatus(env);
  if (!s.username && !s.token_expires) return "Instagram: not connected";
  if (s.expired) return "Instagram: token for @" + s.username + " has expired, a fresh link is needed";
  return "Instagram: connected as @" + s.username + ", can post: " + (s.can_post ? "yes" : "no") + ", token expires " + ymd(s.token_expires);
}

// Refresh of the 60-day token (same grant as igPull's refresh), run from the same cron slot. No-op without a record.
export async function deskIgRefresh(env, now) {
  now = now || Date.now();
  const a = await deskIgRecord(env);
  if (!a || !a.token || !a.expires_at || now > a.expires_at) return { refreshed: false };
  if (a.expires_at - now > 40 * 86400000) return { refreshed: false };                  // refreshed once the token is 20 days old
  const r = await igGet("/refresh_access_token", a.token, { grant_type: "ig_refresh_token" });
  if (r.err || !r.access_token) return { refreshed: false, err: r.err || "no token" };
  a.token = r.access_token; a.expires_at = now + (Number(r.expires_in) || 5184000) * 1000;
  await env.MEETINGS.put(DESK_AUTH_KEY, JSON.stringify(a));
  return { refreshed: true };
}

// Meta's deauthorise / data-deletion callback: true (and the desk record cleared) only when the signed user is the desk user.
export async function deskIgDeauth(env, data) {
  const a = await deskIgRecord(env);
  const uid = String((data && (data.user_id || data.userId)) || "");
  if (!a || !uid || String(a.user_id || "") !== uid) return false;
  try { await env.MEETINGS.delete(DESK_AUTH_KEY); } catch (e) {}
  return true;
}

// The single-image publish, same Graph sequence as publishInstagram (container -> poll -> media_publish) but with the desk token.
// It never runs on its own: the caller must pass approved:true, which only a desk approval button may do (none is wired yet).
export async function deskIgPublish(env, opts) {
  opts = opts || {};
  if (opts.approved !== true) return { ok: false, err: "not approved" };
  const a = await deskIgRecord(env);
  if (!a || !a.token) return { ok: false, err: "desk Instagram not connected" };
  if (a.expires_at && (opts.now || Date.now()) > a.expires_at) return { ok: false, err: "desk token expired" };
  if (!deskIgCanPost(a)) return { ok: false, err: "desk connection lacks content_publish" };
  if (!a.user_id || !/^https:\/\//.test(String(opts.imageUrl || ""))) return { ok: false, err: "missing account or https image url" };
  const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const form = { "Content-Type": "application/x-www-form-urlencoded" };
  try {
    const cr = opts.container ? { id: opts.container } : await postMedia(a.user_id,
      mediaExtras({ image_url: opts.imageUrl, caption: String(opts.caption || ""), access_token: a.token }, opts.altText, opts.aiGenerated), form);
    if (cr && cr.id && !opts.container && opts.onContainer) { try { await opts.onContainer(String(cr.id)); } catch (e) {} }   // v413 - remembered the moment it exists, so a retry never makes a second one
    if (!cr || !cr.id) return { ok: false, err: "container refused: " + String((cr && cr.error && cr.error.message) || "no id").slice(0, 120) };
    let status = "IN_PROGRESS";
    for (let i = 0; i < 6 && status === "IN_PROGRESS"; i++) {
      await sleep(2000);
      const sj = await (await fetch(GRAPH + "/v21.0/" + cr.id + "?fields=status_code&access_token=" + encodeURIComponent(a.token))).json();
      status = (sj && sj.status_code) || "FINISHED";
    }
    if (status !== "FINISHED") return { ok: false, container: String(cr.id), err: "container status " + status };
    const pj = await (await fetch(GRAPH + "/v21.0/" + a.user_id + "/media_publish", { method: "POST", headers: form,
      body: new URLSearchParams({ creation_id: cr.id, access_token: a.token }) })).json();
    if (pj && pj.id) return { ok: true, id: String(pj.id), container: String(cr.id), permalink: await deskIgPermalink(env, String(pj.id)) };
    return { ok: false, container: String(cr.id), err: "publish refused: " + String((pj && pj.error && pj.error.message) || "no id").slice(0, 120) };
  } catch (e) { return { ok: false, err: "network error; check the feed before retrying" }; }
}

// v413 - the permalink of a published media id (GET /{media-id}?fields=permalink); "" when it cannot be read.
export async function deskIgPermalink(env, mediaId) {
  const a = await deskIgRecord(env); if (!a || !a.token || !mediaId) return "";
  const r = await igGet("/v21.0/" + mediaId, a.token, { fields: "permalink" });
  return r && r.permalink ? String(r.permalink) : "";
}
// v425 - alt_text (images only, up to 1000 characters; Meta changelog 24 Mar 2025) and is_ai_generated (Meta's "AI info" label;
// changelog 22 Jun 2026; on a carousel it belongs on the parent container only). Absent when empty, so an old plan publishes as before.
// postMedia: POST /{user}/media; if Meta refuses a container that carried alt_text or is_ai_generated, it is tried ONCE more without
// them, so these extras can never be the reason a post is held (the label then rests on the caption's "Illustration.").
async function postMedia(userId, params, form) {
  const go = async (p) => await (await fetch(GRAPH + "/v21.0/" + userId + "/media", { method: "POST", headers: form, body: new URLSearchParams(p) })).json();
  const r = await go(params);
  if ((r && r.id) || !(params.alt_text || params.is_ai_generated)) return r;
  const plain = Object.assign({}, params); delete plain.alt_text; delete plain.is_ai_generated;
  const r2 = await go(plain);
  if (r2 && r2.id) r2.extras_dropped = String((r && r.error && r.error.message) || "refused").slice(0, 120);
  return r2;
}
export function mediaExtras(params, altText, aiGenerated) {
  const alt = String(altText || "").replace(/\s+/g, " ").trim().slice(0, 1000);
  if (alt) params.alt_text = alt;
  if (aiGenerated) params.is_ai_generated = "true";
  return params;
}
async function pollContainer(id, token, sleep) {
  let status = "IN_PROGRESS";
  for (let i = 0; i < 6 && status === "IN_PROGRESS"; i++) {
    await sleep(2000);
    const sj = await (await fetch(GRAPH + "/v21.0/" + id + "?fields=status_code&access_token=" + encodeURIComponent(token))).json();
    status = (sj && sj.status_code) || "FINISHED";
  }
  return status;
}
// v413 - CAROUSEL (2 to 10 pictures), Meta's documented flow: a child container per picture (is_carousel_item), then a parent container
// (media_type=CAROUSEL, children=ids, caption), then media_publish. opts.state ({children, parent}) carries ids from an earlier try, so a
// retry never makes a second set and never publishes twice; opts.onProgress(state) is called as each id appears. approved:true is required.
export async function deskIgPublishCarousel(env, opts) {
  opts = opts || {};
  if (opts.approved !== true) return { ok: false, err: "not approved" };
  const a = await deskIgRecord(env);
  if (!a || !a.token) return { ok: false, err: "desk Instagram not connected" };
  if (a.expires_at && (opts.now || Date.now()) > a.expires_at) return { ok: false, err: "desk token expired" };
  if (!deskIgCanPost(a)) return { ok: false, err: "desk connection lacks content_publish" };
  const urls = opts.imageUrls || [];
  if (!a.user_id || urls.length < 2 || urls.length > 10 || urls.some((u) => !/^https:\/\//.test(String(u)))) return { ok: false, err: "a carousel needs 2 to 10 https pictures" };
  const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const form = { "Content-Type": "application/x-www-form-urlencoded" };
  const st = opts.state || {}; st.children = Array.isArray(st.children) ? st.children : [];
  const note = async () => { if (opts.onProgress) { try { await opts.onProgress({ children: st.children.slice(), parent: st.parent }); } catch (e) {} } };
  try {
    for (let i = st.children.length; i < urls.length; i++) {
      const c = await postMedia(a.user_id, mediaExtras({ image_url: urls[i], is_carousel_item: "true", access_token: a.token }, (opts.altTexts || [])[i], false), form);
      if (!c || !c.id) return { ok: false, err: "picture " + (i + 1) + " refused: " + String((c && c.error && c.error.message) || "no id").slice(0, 120) };
      st.children.push(String(c.id)); await note();
    }
    for (const id of st.children) { const s1 = await pollContainer(id, a.token, sleep); if (s1 !== "FINISHED") return { ok: false, err: "picture container status " + s1 }; }
    if (!st.parent) {
      const pr = await postMedia(a.user_id, mediaExtras({ media_type: "CAROUSEL", children: st.children.join(","), caption: String(opts.caption || ""), access_token: a.token }, "", opts.aiGenerated), form);   // the AI label goes on the carousel container only
      if (!pr || !pr.id) return { ok: false, err: "carousel container refused: " + String((pr && pr.error && pr.error.message) || "no id").slice(0, 120) };
      st.parent = String(pr.id); await note();
    }
    const s2 = await pollContainer(st.parent, a.token, sleep);
    if (s2 !== "FINISHED") return { ok: false, err: "carousel container status " + s2 };
    const pj = await (await fetch(GRAPH + "/v21.0/" + a.user_id + "/media_publish", { method: "POST", headers: form,
      body: new URLSearchParams({ creation_id: st.parent, access_token: a.token }) })).json();
    if (pj && pj.id) return { ok: true, id: String(pj.id), permalink: await deskIgPermalink(env, String(pj.id)) };
    return { ok: false, err: "publish refused: " + String((pj && pj.error && pj.error.message) || "no id").slice(0, 120) };
  } catch (e) { return { ok: false, err: "network error; check the feed before retrying" }; }
}

// v413 - the desk account's own numbers (desk token): followers, and reach / likes / saves for the media ids the desk posted.
const insVal = (d) => (d && d.values && d.values[0] && typeof d.values[0].value === "number" ? d.values[0].value : d && d.total_value && typeof d.total_value.value === "number" ? d.total_value.value : null);
export async function deskIgPull(env, now, mediaIds) {
  const a = await deskIgRecord(env); const out = { media: {} };
  if (!a || !a.token || (a.expires_at && (now || Date.now()) > a.expires_at)) return Object.assign(out, { err: "not connected" });
  const me = await igGet("/me", a.token, { fields: "user_id,username,followers_count,media_count" });
  if (!me.err) out.account = { followers: me.followers_count, media_count: me.media_count };
  for (const id of (mediaIds || []).slice(0, 25)) {
    // v425 - the growth measures Meta now offers (views replaced impressions, Apr 2025); falls back to the v413 three if refused
    let r = await igGet("/v21.0/" + id + "/insights", a.token, { metric: "reach,likes,saved,views,shares,follows,profile_visits,total_interactions" });
    if (r.err) r = await igGet("/v21.0/" + id + "/insights", a.token, { metric: "reach,likes,saved" });
    if (r.err) continue;
    const m = {}; for (const d of (r.data || [])) { const v = insVal(d); if (v !== null) m[d.name] = v; }
    out.media[id] = m;
  }
  return out;
}
