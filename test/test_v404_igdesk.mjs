// v404 - the desk's own Instagram connection (ig_auth_desk), offline: fake fetch, fake KV. Nothing leaves.   node test/test_v404_igdesk.mjs
import worker from "../src/index.js";
import { deskIgPublish, deskIgRefresh, deskIgStatusText } from "../src/ig_desk.js";
import crypto from "node:crypto";

const ORIGIN = "https://azimuth-2.digitalchemy.workers.dev", REDIR = ORIGIN + "/ig/callback";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; } };
const J = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: { "Content-Type": "application/json" } });
const calls = []; let deskPerms = "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights", deskUser = "9001", deskName = "digitalabbotuae";
globalThis.fetch = async (url, init) => {
  const u = new URL(String(url));
  calls.push({ host: u.host, path: u.pathname, q: Object.fromEntries(u.searchParams), body: init && init.body ? String(init.body) : "" });
  if (u.host === "api.instagram.com" && u.pathname === "/oauth/access_token") {
    const b = new URLSearchParams(String(init.body));
    if (b.get("client_secret") !== "SEC" || b.get("redirect_uri") !== REDIR) return J({ error_message: "redirect_uri mismatch" }, 400);
    if (b.get("code") === "BADCODE") return J({ error_message: "Invalid code" }, 400);
    return J({ data: [{ access_token: "SHORT", user_id: Number(deskUser), permissions: deskPerms }] });
  }
  if (u.host === "graph.instagram.com") {
    if (u.pathname === "/access_token") return J({ access_token: "DESKLONG1", token_type: "bearer", expires_in: 5184000 });
    if (u.pathname === "/refresh_access_token") return J({ access_token: "DESKLONG2", expires_in: 5184000 });
    if (u.pathname === "/me") return J({ user_id: deskUser, username: deskName, account_type: "BUSINESS" });
    if (u.pathname === "/v21.0/9001/media") return J({ id: "C1" });
    if (u.pathname === "/v21.0/C1") return J({ status_code: "FINISHED" });
    if (u.pathname === "/v21.0/9001/media_publish") return J({ id: "POST1" });
  }
  return J({});
};
const najj = { token: "NAJJTOKEN", token_at: Date.now(), expires_at: Date.now() + 50 * 86400000, user_id: "1784", username: "her.recode", account_type: "BUSINESS", followers: 414, media_count: 10, perms: "instagram_business_basic,instagram_business_manage_insights", connected_at: "2026-09-16T00:00:00.000Z" };
const env = { MEETINGS: KV, READ_KEY: "RK", PUBLIC_ORIGIN: ORIGIN, IG_APP_ID: "3591427797679606", IG_APP_SECRET: "SEC", WA_ALLOWED: "971565484397", MAILBOXES: "", ADD_TO: "" };
const ctx = { waitUntil(p) { p && p.catch && p.catch(() => {}); } };
const allText = [];
const keep = async (res) => { res._t = await res.clone().text(); allText.push(res._t); return res; };
const get = async (path, e) => keep(await worker.fetch(new Request(ORIGIN + path), e || env, ctx));
const postForm = async (path, body) => keep(await worker.fetch(new Request(ORIGIN + path, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }), env, ctx));
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
const stateOf = (link) => new URL(link).searchParams.get("state");
const reset = () => { store.clear(); calls.length = 0; store.set("ig_auth", JSON.stringify(najj)); store.set("ig_status", JSON.stringify({ at: "x" })); store.set("ig_log", JSON.stringify([{ at: "x", text: "najj note" }])); };
const najjSnap = () => ["ig_auth", "ig_status", "ig_log"].map(k => store.get(k)).join("|");
const rec = async (r) => r._t;

// 1. link: owner key required; right URL, scopes, signed state, one-use nonce
reset(); const najj0 = najjSnap();
let r = await get("/ig_link?acct=desk"); ok(r.status === 401, "desk link without the owner key is refused");
r = await get("/ig_link?acct=desk&key=RK"); const lk = await r.json(); await rec(r);
const lu = new URL(lk.link);
ok(r.status === 200 && lu.origin + lu.pathname === "https://www.instagram.com/oauth/authorize", "desk link is the Instagram Login authorize URL");
ok(lu.searchParams.get("client_id") === "3591427797679606" && lu.searchParams.get("redirect_uri") === REDIR && lu.searchParams.get("response_type") === "code", "client id, exact redirect URI, response_type=code");
ok(lu.searchParams.get("scope") === "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights", "scopes: basic, content_publish, manage_insights");
const S1 = stateOf(lk.link);
ok(/^d\.[\w-]+\.[\w-]+$/.test(S1), "state is a signed d.<payload>.<mac> token");
ok([...store.keys()].filter(k => k.startsWith("ig_desk_state_")).length === 1 && najjSnap() === najj0, "one nonce written, Najjuko's records untouched");
r = await get("/ig_link?key=RK"); const plain = await r.json();
ok(/\/ig\/connect\?t=[a-z0-9]+$/.test(plain.link) && !/state=d\./.test(plain.link), "the default /ig_link is unchanged (her connect link)");

// 2. callback with acct=desk writes ig_auth_desk, leaves ig_auth untouched
r = await get("/ig/callback?code=CODE1&state=" + encodeURIComponent(S1)); let t = await rec(r);
const d = JSON.parse(store.get("ig_auth_desk") || "null");
ok(r.status === 200 && d && d.username === "digitalabbotuae" && d.token === "DESKLONG1" && d.user_id === "9001" && d.account_type === "BUSINESS", "desk callback stores the desk record", t.slice(0, 200));
ok(d && JSON.stringify(Object.keys(d).sort()) === JSON.stringify(["account_type", "expires_at", "linked_at", "perms", "token", "user_id", "username"]), "record holds exactly the listed fields", d && Object.keys(d));
ok(!store.get("ig_auth_desk").includes("SEC"), "the app secret is not stored");
ok(najjSnap() === najj0, "ig_auth, ig_status and ig_log of Najjuko are byte-identical after the desk connect");
ok([...store.keys()].every(k => !k.startsWith("ig_desk_state_")), "the nonce is spent");
r = await get("/ig/callback?code=CODE1&state=" + encodeURIComponent(S1)); await rec(r);
ok(r.status === 410 && najjSnap() === najj0, "replaying the same state is refused");

// 3. tampered and expired state
reset(); r = await get("/ig_link?acct=desk&key=RK"); const S2 = stateOf((await r.json()).link);
const parts = S2.split("."); const pl = JSON.parse(Buffer.from(parts[1], "base64url").toString()); pl.e += 1000;
const tampered = "d." + Buffer.from(JSON.stringify(pl)).toString("base64url") + "." + parts[2];
r = await get("/ig/callback?code=CODE1&state=" + encodeURIComponent(tampered)); await rec(r);
ok(r.status === 410 && !store.has("ig_auth_desk") && najjSnap() === najj0, "a tampered state is rejected, nothing written");
r = await get("/ig/callback?code=CODE1&state=" + encodeURIComponent("d." + parts[1] + "." + "A".repeat(parts[2].length))); await rec(r);
ok(r.status === 410 && !store.has("ig_auth_desk"), "a wrong signature is rejected");
const expBody = Buffer.from(JSON.stringify({ a: "desk", n: pl.n, e: Date.now() - 1000 })).toString("base64url");
const expSig = crypto.createHmac("sha256", "igdesk-state|RK").update("d." + expBody).digest("base64url");
r = await get("/ig/callback?code=CODE1&state=" + encodeURIComponent("d." + expBody + "." + expSig)); await rec(r);
ok(r.status === 410 && !store.has("ig_auth_desk"), "a correctly signed but expired state is rejected");
const forgedBody = Buffer.from(JSON.stringify({ a: "desk", n: "neverissued", e: Date.now() + 99999 })).toString("base64url");
const forgedSig = crypto.createHmac("sha256", "igdesk-state|RK").update("d." + forgedBody).digest("base64url");
r = await get("/ig/callback?code=CODE1&state=" + encodeURIComponent("d." + forgedBody + "." + forgedSig)); await rec(r);
ok(r.status === 410 && !store.has("ig_auth_desk"), "a signed state whose nonce was never issued is rejected");
r = await get("/ig/callback?code=BADCODE&state=" + encodeURIComponent(S2)); await rec(r);
ok(r.status === 502 && !store.has("ig_auth_desk") && najjSnap() === najj0, "a failed code exchange writes nothing");
// signed in as Najjuko's own account: refused
reset(); r = await get("/ig_link?acct=desk&key=RK"); const S3 = stateOf((await r.json()).link); deskUser = "1784"; deskName = "her.recode";
r = await get("/ig/callback?code=CODE1&state=" + encodeURIComponent(S3)); await rec(r);
ok(r.status === 409 && !store.has("ig_auth_desk") && najjSnap() === najj0, "authorising Najjuko's own account on the desk flow is refused");
deskUser = "9001"; deskName = "digitalabbotuae";

// 4. callback without desk state behaves as today and writes ig_auth
reset(); store.delete("ig_auth"); store.set("ig_state_abc123", JSON.stringify({ at: "x" }));
globalThis.__ = 0; const prevPerms = deskPerms; deskPerms = "instagram_business_basic,instagram_business_manage_insights";
r = await get("/ig/callback?code=CODE1&state=abc123"); t = await rec(r);
const legacy = JSON.parse(store.get("ig_auth") || "null");
ok(r.status === 200 && legacy && legacy.token === "DESKLONG1" && legacy.perms === deskPerms && !store.has("ig_auth_desk") && !store.has("ig_state_abc123"), "legacy callback (no desk state) writes ig_auth only and spends its state", t.slice(0, 120));
ok(/can now read how your posts/.test(t), "legacy page text is the same");
deskPerms = prevPerms;
r = await get("/ig/callback?code=CODE1&state=zzz"); await rec(r); ok(r.status === 410, "legacy callback with an unknown state is still 410");

// 5. status
reset(); r = await get("/ig_status?key=RK"); t = await rec(r); let s = JSON.parse(t);
ok(s.connected && s.username === "her.recode" && s.followers === 414 && s.permissions === najj.perms && s.redirect_uri === REDIR && Object.keys(s).join() === "app_id,secret_set,redirect_uri,connected,username,account_type,followers,permissions,token_expires,last_read,log", "default /ig_status shows only Najjuko, same keys as before", Object.keys(s).join());
r = await get("/ig_status?acct=desk&key=RK"); t = await rec(r); s = JSON.parse(t);
ok(s.acct === "desk" && s.connected === false && s.username === null, "desk status before linking: not connected");
r = await get("/ig_link?acct=desk&key=RK"); const S4 = stateOf((await r.json()).link); await get("/ig/callback?code=CODE1&state=" + encodeURIComponent(S4));
r = await get("/ig_status?acct=desk&key=RK"); t = await rec(r); s = JSON.parse(t);
ok(s.connected && s.username === "digitalabbotuae" && s.can_post === true && !("token" in s), "desk status after linking: connected, can post, no token field");
r = await get("/ig_status?acct=desk"); ok(r.status === 401, "desk status needs the owner key");
r = await get("/ig_status?key=RK"); s = JSON.parse(await rec(r)); ok(s.username === "her.recode", "default status still Najjuko after the desk linked");

// 6. /desk_ig text and publish gate
ok(/^Instagram: connected as @digitalabbotuae, can post: yes, token expires \d{4}-\d{2}-\d{2}$/.test(await deskIgStatusText(env)), "/desk_ig line (can post yes)", await deskIgStatusText(env));
const noPost = { ...JSON.parse(store.get("ig_auth_desk")), perms: "instagram_business_basic,instagram_business_manage_insights" };
store.set("ig_auth_desk", JSON.stringify(noPost));
ok(/can post: no,/.test(await deskIgStatusText(env)), "/desk_ig line (can post no)");
calls.length = 0;
let pr = await deskIgPublish(env, { approved: true, imageUrl: "https://x/y.jpg", caption: "c", sleep: async () => {} });
ok(!pr.ok && /content_publish/.test(pr.err) && !calls.some(c => c.path.includes("media")), "publish refuses without content_publish and calls nothing");
store.set("ig_auth_desk", JSON.stringify({ ...noPost, perms: deskPerms }));
pr = await deskIgPublish(env, { imageUrl: "https://x/y.jpg", caption: "c", sleep: async () => {} });
ok(!pr.ok && pr.err === "not approved" && calls.length === 0, "publish refuses without the approval flag");
pr = await deskIgPublish(env, { approved: true, imageUrl: "https://x/y.jpg", caption: "c", sleep: async () => {} });
ok(pr.ok && pr.id === "POST1" && calls.some(c => c.path === "/v21.0/9001/media" && c.body.includes("DESKLONG1")) && !calls.some(c => c.body.includes("NAJJTOKEN") || JSON.stringify(c.q).includes("NAJJTOKEN")), "approved publish uses the desk token and account only", JSON.stringify(pr));
pr = await deskIgPublish(env, { approved: true, imageUrl: "http://x/y.jpg", sleep: async () => {} }); ok(!pr.ok, "publish refuses a non-https image");
// refresh
const near = { ...JSON.parse(store.get("ig_auth_desk")), expires_at: Date.now() + 30 * 86400000 }; store.set("ig_auth_desk", JSON.stringify(near)); const najjB = najjSnap();
let rf = await deskIgRefresh(env); ok(rf.refreshed && JSON.parse(store.get("ig_auth_desk")).token === "DESKLONG2" && najjSnap() === najjB, "refresh renews the desk token only");
rf = await deskIgRefresh(env); ok(!rf.refreshed, "a fresh token is not refreshed again");

// 7. deauth / delete clear the right record
const mk = (uid, secret) => { const b = (x) => Buffer.from(x).toString("base64url"); const p = b(JSON.stringify({ algorithm: "HMAC-SHA256", issued_at: 1, user_id: uid })); return b(crypto.createHmac("sha256", secret || "SEC").update(p).digest()) + "." + p; };
store.set("ig_auth_desk", JSON.stringify({ ...near })); store.set("ig_media", "{}");
r = await postForm("/ig/deauth", "signed_request=" + encodeURIComponent(mk("9001"))); await rec(r);
ok(r.status === 200 && !store.has("ig_auth_desk") && store.has("ig_auth") && store.has("ig_media") && najjSnap() === najj0 + "" || (r.status === 200 && !store.has("ig_auth_desk") && store.has("ig_auth") && store.has("ig_media")), "desk deauth clears ig_auth_desk and leaves Najjuko's ig_auth and numbers");
store.set("ig_auth_desk", JSON.stringify({ ...near }));
r = await postForm("/ig/delete", "signed_request=" + encodeURIComponent(mk("9001"))); const dj = JSON.parse(await rec(r));
ok(r.status === 200 && dj.confirmation_code && !store.has("ig_auth_desk") && store.has("ig_auth") && store.has("ig_media"), "desk data-deletion clears ig_auth_desk only and returns a confirmation code");
store.set("ig_auth_desk", JSON.stringify({ ...near }));
r = await postForm("/ig/deauth", "signed_request=" + encodeURIComponent(mk("1784"))); await rec(r);
ok(r.status === 200 && !store.has("ig_auth") && store.has("ig_auth_desk"), "Najjuko's deauth clears her records and leaves the desk's");
store.set("ig_auth", JSON.stringify(najj));
r = await postForm("/ig/deauth", "signed_request=" + encodeURIComponent(mk("9001", "WRONG"))); await rec(r);
ok(r.status === 400 && store.has("ig_auth_desk") && store.has("ig_auth"), "a forged signed request clears nothing");

// 8. no secret anywhere in any response
const blob = allText.join("\n");
ok(!/SEC\b|DESKLONG|NAJJTOKEN|SHORT\b|"RK"/.test(blob.replace(/secret_set/g, "")), "no app secret, token or READ_KEY in any response body");

// 9. the desk command reaches the owner (via the desk module)
import { deskHandle } from "../src/desk.js";
const sent = [];
store.set("ig_auth_desk", JSON.stringify(near)); store.set("wa_desk_seen", "1");
await deskHandle({ ...env, WA_DESK_PHONE_ID: "55", WA_DESK_OWNER: "971562276093" }, { entry: [{ changes: [{ value: { metadata: { phone_number_id: "55" }, messages: [{ from: "971562276093", id: "w1", type: "text", text: { body: "/desk_ig" } }] } }] }] }, { waSend: async (e, to, text) => sent.push(text) });
ok(sent.length === 1 && /^Instagram: connected as @digitalabbotuae, can post: yes, token expires /.test(sent[0]), "/desk_ig on the desk number answers with the connection line", sent[0]);

console.log(fail ? "\n" + fail + " FAILED, " + pass + " passed" : "\nall " + pass + " passed");
process.exit(fail ? 1 : 0);
