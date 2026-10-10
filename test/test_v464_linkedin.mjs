// v464 - LinkedIn from the desk: sign-in (state, token, userinfo), video upload in parts, wait for AVAILABLE, post once; reminders;
// desk buttons Instagram / LinkedIn / Both and the "linkedin" command. Offline.
import { liRoute, liStartLink, liStep, liReminder, liEscapeKeepTags, liRecord } from "../src/li_desk.js";
import { deskHandle } from "../src/desk.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 600) : "")); } };
const store = new Map();
const KV = { async get(k, t) { const v = store.has(k) ? store.get(k) : null; return v; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
const env = { MEETINGS: KV, LI_CLIENT_ID: "CID", LI_CLIENT_SECRET: "SEC", WA_DESK_PHONE_ID: "1370146096179819", WA_DESK_OWNER: "971562276093", WHATSAPP_TOKEN: "T" };
const calls = []; let videoStatus = ["PROCESSING", "AVAILABLE"], postStatus = 201;
const fake = async (u, init) => {
  const s = String(u); calls.push({ s, init });
  if (/oauth\/v2\/accessToken/.test(s)) return new Response(JSON.stringify({ access_token: "LITOK", expires_in: 5184000, scope: "openid,profile,w_member_social" }));
  if (/\/v2\/userinfo/.test(s)) return new Response(JSON.stringify({ sub: "abc123", name: "Kendall Wilson" }));
  if (/initializeUpload/.test(s)) return new Response(JSON.stringify({ value: { video: "urn:li:video:V1", uploadToken: "", uploadInstructions: [
    { firstByte: 0, lastByte: 4194303, uploadUrl: "https://up/1" }, { firstByte: 4194304, lastByte: 5999999, uploadUrl: "https://up/2" }] } }));
  if (/^https:\/\/up\//.test(s)) return new Response("", { status: 200, headers: { etag: '"E' + s.slice(-1) + '"' } });
  if (/finalizeUpload/.test(s)) return new Response("", { status: 200 });
  if (/\/rest\/videos\/urn/.test(s)) return new Response(JSON.stringify({ status: videoStatus.shift() || "AVAILABLE" }));
  if (/\/rest\/posts/.test(s)) return new Response("", { status: postStatus, headers: postStatus === 201 ? { "x-restli-id": "urn:li:share:999" } : {} });
  return new Response("{}");
};
globalThis.fetch = fake;
const sent = []; const send = async (e, t) => sent.push(t);

// sign-in
const l = await liStartLink(env, "https://w.dev");
const s = new URL(l.link).searchParams.get("s");
ok(/^https:\/\/w\.dev\/li\/start\?s=[0-9a-f]{32}$/.test(l.link) && store.has("li_state_" + s), "the desk link carries a one-time state");
const st = await liRoute(env, new URL(l.link), { fetch: fake });
const loc = st.headers.get("location") || "";
ok(st.status === 302 && /linkedin\.com\/oauth\/v2\/authorization/.test(loc) && /scope=openid\+profile\+w_member_social/.test(loc) && /redirect_uri=https%3A%2F%2Fw\.dev%2Fli%2Fcallback/.test(loc) && /client_id=CID/.test(loc), "start redirects to LinkedIn with our app, scopes and callback", loc);
const bad = await liRoute(env, new URL("https://w.dev/li/callback?code=x&state=nope"), { fetch: fake });
ok(bad.status === 400 && !store.has("li_auth"), "an unknown state is refused");
const cb = await liRoute(env, new URL("https://w.dev/li/callback?code=C1&state=" + s), { fetch: fake, notify: send });
const rec = await liRecord(env);
ok(cb.status === 200 && rec.token === "LITOK" && rec.sub === "abc123" && rec.expires_at > Date.now() + 59 * 86400000, "callback stores token, member id and a 60-day expiry");
ok(!store.has("li_state_" + s), "the state is used once");
ok(/LinkedIn connected as Kendall Wilson/.test(sent.join("")) && !/LITOK|SEC/.test(sent.join("") + (await cb.text())), "the desk is told; the token and secret are never shown");
const tokCall = calls.find((c) => /accessToken/.test(c.s));
ok(/client_secret=SEC/.test(String(tokCall.init.body)) && /redirect_uri=https%3A%2F%2Fw\.dev%2Fli%2Fcallback/.test(String(tokCall.init.body)), "the code is exchanged with the secret and the same callback");

// posting
store.set("vid_desk_1", new Uint8Array(6000000).buffer);
store.set("desk_li_pending", JSON.stringify({ key: "desk_1", caption: "Site truth (same day) #GoCanvas #DigitAlchemy", approved: true }));
calls.length = 0; sent.length = 0;
await liStep(env, { send, fetch: fake });
const puts = calls.filter((c) => /^https:\/\/up\//.test(c.s));
ok(puts.length === 2 && puts[0].init.body.byteLength === 4194304 && puts[1].init.body.byteLength === 6000000 - 4194304, "the video goes up in LinkedIn's 4 MB parts", puts.map((p) => p.init.body.byteLength).join(","));
const fin = calls.find((c) => /finalizeUpload/.test(c.s));
ok(fin && JSON.parse(fin.init.body).finalizeUploadRequest.uploadedPartIds.join(",") === "E1,E2", "finalize sends the ETags in order");
ok(!calls.some((c) => /\/rest\/posts/.test(c.s)) && !sent.length, "still PROCESSING: nothing posted, nothing said");
const init = calls.find((c) => /initializeUpload/.test(c.s));
ok(init.init.headers["LinkedIn-Version"] && init.init.headers["X-Restli-Protocol-Version"] === "2.0.0" && JSON.parse(init.init.body).initializeUploadRequest.owner === "urn:li:person:abc123", "versioned headers and the member as owner");
calls.length = 0;
await liStep(env, { send, fetch: fake });
const post = calls.find((c) => /\/rest\/posts/.test(c.s));
const pb = post && JSON.parse(post.init.body);
ok(pb && pb.author === "urn:li:person:abc123" && pb.content.media.id === "urn:li:video:V1" && pb.visibility === "PUBLIC" && pb.lifecycleState === "PUBLISHED", "AVAILABLE: posted as Kendall with the video", JSON.stringify(pb));
ok(!calls.some((c) => /initializeUpload/.test(c.s)), "the second step does not upload again");
ok(pb.commentary === "Site truth \\(same day\\) #GoCanvas #DigitAlchemy", "reserved characters escaped, hashtags kept", pb && pb.commentary);
ok(/Posted to LinkedIn\. https:\/\/www\.linkedin\.com\/feed\/update\/urn:li:share:999\//.test(sent.join("")), "the desk gets the post link", sent.join("|"));
calls.length = 0; await liStep(env, { send, fetch: fake });
ok(!calls.length, "posted once: later ticks do nothing");

// refused post keeps the uploaded video for a retry
store.set("desk_li_pending", JSON.stringify({ key: "desk_1", caption: "x", approved: true, video: "urn:li:video:V1" }));
postStatus = 403; sent.length = 0; await liStep(env, { send, fetch: fake });
const after = JSON.parse(store.get("desk_li_pending"));
ok(/LinkedIn: post refused/.test(sent.join("")) && after.video === "urn:li:video:V1" && !after.approved, "a refusal is reported once and the upload is kept");
postStatus = 201;

// not connected / expired
const saved = store.get("li_auth"); store.set("li_auth", JSON.stringify({ token: "t", sub: "s", expires_at: Date.now() - 1 }));
store.set("desk_li_pending", JSON.stringify({ key: "desk_1", caption: "x", approved: true })); sent.length = 0; calls.length = 0;
await liStep(env, { send, fetch: fake });
ok(/not connected \(or the sign-in expired\)/.test(sent.join("")) && !calls.length, "expired sign-in: told, nothing sent to LinkedIn");

// reminders
store.set("li_auth", JSON.stringify({ token: "t", sub: "s", expires_at: Date.now() + 5 * 86400000 })); store.delete("li_reminded"); sent.length = 0;
await liReminder(env, { send }); await liReminder(env, { send });
ok(sent.length === 1 && /runs out on/.test(sent[0]), "one reminder in the last week, not every tick");
store.set("li_auth", JSON.stringify({ token: "t", sub: "s", expires_at: Date.now() - 1 })); sent.length = 0;
await liReminder(env, { send });
ok(sent.length === 1 && /has expired/.test(sent[0]), "and one when it has expired");
store.set("li_auth", saved);

// the desk: Post it -> where? -> Both
const OWNER = "971562276093", PID = "1370146096179819";
store.set("wa_desk_seen", "1");
const raws = [], texts = [], reels = [];
const lab = { owner: OWNER, pid: PID, graph: "g", raw: async (e, p) => { raws.push(p); return {}; }, send: async (e, t) => texts.push(t), image: async () => {}, origin: () => "https://w.dev", sleep: async () => {}, briefLink: () => "",
  reel: async (e, o) => { reels.push(o); return { ok: false, err: "still processing", container: "C1" }; },
  liConnected: async () => true, liLink: async () => ({ link: "https://w.dev/li/start?s=x", connected: true, until: "2026-12-09" }), liStep: async () => { texts.push("[liStep]"); } };
const post2 = { send: async () => {}, buttons: async () => {}, image: async () => {}, llm: async () => "", fetchMedia: async () => ({}), origin: () => "", now: () => Date.now(), sleep: async () => {} };
const deps = { waSend: async (e, to, t) => texts.push(t), post: post2, lab };
let mid = 0;
const go = async (m) => { raws.length = 0; texts.length = 0; await deskHandle(env, { entry: [{ changes: [{ value: { metadata: { phone_number_id: PID }, messages: [Object.assign({ from: OWNER, id: "w" + ++mid }, m)] } }] }] }, deps); };
const tap = (id) => go({ type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: id } } });
store.set("desk_reel_pending", JSON.stringify({ url: "https://w.dev/video/desk_1", caption: "Cap", at: Date.now() }));
store.delete("desk_li_pending");
await tap("dr:ok");
ok(raws[0] && raws[0].interactive.action.buttons.map((b) => b.reply.id).join(",") === "dr:ig,dr:li,dr:both" && !reels.length, "LinkedIn connected: Post it asks Instagram / LinkedIn / Both, posts nothing yet");
await tap("dr:both");
const lp = JSON.parse(store.get("desk_li_pending"));
ok(lp.key === "desk_1" && lp.caption === "Cap" && lp.approved && texts.includes("[liStep]") && reels.length === 1, "Both starts LinkedIn and Instagram together");
lab.liConnected = async () => false; reels.length = 0;
store.set("desk_reel_pending", JSON.stringify({ url: "https://w.dev/video/desk_1", caption: "Cap", at: Date.now() }));
await tap("dr:ok");
ok(reels.length === 1 && !raws.some((r) => r.interactive && /Post where/.test(r.interactive.body.text)), "without LinkedIn, Post it goes straight to Instagram as before");
await go({ type: "text", text: { body: "linkedin" } });
ok(raws[0] && raws[0].interactive.type === "cta_url" && raws[0].interactive.action.parameters.url === "https://w.dev/li/start?s=x", "linkedin sends a one-tap Sign in button");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
