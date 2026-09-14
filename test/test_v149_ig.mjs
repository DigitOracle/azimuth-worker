// v149 - Instagram insights, offline (14 Sep 2026): the connect link, Instagram's login round trip, the three-hourly read with its
// per-metric fallback, the card ledger written by a real scene picture, matching posts to cards, the report, and Meta's deauthorise
// and data-deletion callbacks. No network: Instagram, WhatsApp, the image service and the renderer are stubbed; nothing leaves.
import worker from "../src/index.js";
import crypto from "node:crypto";

const HER = "971565484397";
const ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";
const store = new Map();
const KV = {
  async get(k) { return store.has(k) ? store.get(k) : null; },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; },
};
const now = Date.now(), HOUR = 3600000, DAY = 24 * HOUR;
const igTime = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "+0000");
const MEDIA = [
  { id: "p1", caption: "No metro for five kilometres, yet 6.6% gross yield. That's how much people love living here. #DubaiRealEstate", media_type: "IMAGE", media_product_type: "FEED", timestamp: igTime(now - 2 * HOUR), permalink: "https://www.instagram.com/p/p1/", media_url: "https://cdn.example/p1.jpg" },
  { id: "r1", caption: "If I can't feel it, I can't sell it.", media_type: "VIDEO", media_product_type: "REELS", timestamp: igTime(now - 3 * DAY), permalink: "https://www.instagram.com/reel/r1/", media_url: "https://cdn.example/r1.mp4", thumbnail_url: "https://cdn.example/r1.jpg" },
  { id: "p0", caption: "Old post", media_type: "CAROUSEL_ALBUM", media_product_type: "FEED", timestamp: igTime(now - 40 * DAY), permalink: "https://www.instagram.com/p/p0/", media_url: "https://cdn.example/p0.jpg" },
];
const STORIES = [{ id: "s1", media_type: "IMAGE", timestamp: igTime(now - HOUR), permalink: "https://www.instagram.com/stories/s1/", media_url: "https://cdn.example/s1.jpg" }];
const VALUES = {
  p1: { reach: 520, views: 800, likes: 41, comments: 6, saved: 12, shares: 9, total_interactions: 68, follows: 3, profile_visits: 22 },
  r1: { reach: 1500, views: 2600, likes: 60, comments: 4, saved: 5, shares: 7, total_interactions: 76 },
  p0: { reach: 300, views: 420, likes: 30, comments: 2, saved: 1, shares: 0, total_interactions: 33, follows: 0, profile_visits: 4 },
};
const calls = [], sent = [], edits = [];
let refreshes = 0;
const J = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: { "Content-Type": "application/json" } });
globalThis.fetch = async (url, init) => {
  const u = new URL(String(url));
  calls.push({ host: u.host, path: u.pathname, q: Object.fromEntries(u.searchParams), body: init && typeof init.body === "string" ? init.body : "" });
  if (u.host === "graph.facebook.com") { sent.push(JSON.parse(init.body)); return J({ messages: [{ id: "wamid.out" + sent.length }] }); }
  if (u.href.includes("api.openai.com/v1/images/edits")) { edits.push(1); return J({ data: [{ b64_json: Buffer.alloc(30000, 7).toString("base64") }] }); }
  if (u.href.includes("browser-rendering/screenshot")) return new Response(new Uint8Array(12000).fill(9), { status: 200 });
  if (u.host === "api.instagram.com" && u.pathname === "/oauth/access_token") {
    const b = new URLSearchParams(String(init.body));
    if (b.get("client_id") !== "3591427797679606" || b.get("client_secret") !== "SEC" || b.get("grant_type") !== "authorization_code" || b.get("code") !== "CODE1" || b.get("redirect_uri") !== ORIGIN + "/ig/callback")
      return J({ error_type: "OAuthException", code: 400, error_message: "Invalid platform app" }, 400);
    return J({ data: [{ access_token: "SHORT", user_id: 1784, permissions: "instagram_business_basic,instagram_business_manage_insights" }] });
  }
  if (u.host === "graph.instagram.com") {
    const tok = u.searchParams.get("access_token");
    if (u.pathname === "/access_token") return u.searchParams.get("client_secret") === "SEC" && u.searchParams.get("grant_type") === "ig_exchange_token" && tok === "SHORT" ? J({ access_token: "LONG1", token_type: "bearer", expires_in: 5184000 }) : J({ error: { message: "bad exchange", code: 190 } }, 400);
    if (u.pathname === "/refresh_access_token") { refreshes++; return J({ access_token: "LONG2", token_type: "bearer", expires_in: 5184000 }); }
    if (!/^LONG/.test(tok || "")) return J({ error: { message: "Invalid OAuth access token", code: 190 } }, 400);
    if (u.pathname === "/me") return J({ user_id: "1784", username: "her.recode", account_type: "MEDIA_CREATOR", followers_count: 378, media_count: 122 });
    if (u.pathname === "/me/media") return J({ data: MEDIA, paging: { cursors: { after: "X" } } });
    if (u.pathname === "/me/stories") return J({ data: STORIES });
    if (u.pathname === "/me/insights") {
      const m = u.searchParams.get("metric");
      if (m === "follower_demographics") {
        const b = u.searchParams.get("breakdown");
        if (u.searchParams.get("period") !== "lifetime" || u.searchParams.get("timeframe") !== "this_month") return J({ error: { message: "(#100) timeframe required", code: 100 } }, 400);
        const res = { city: [["Kampala, Central", 40], ["Dubai, Dubai", 150]], age: [["25-34", 120], ["35-44", 90]], gender: [["F", 200], ["M", 150]], country: [["AE", 220], ["UG", 60]] }[b];
        return J({ data: [{ name: "follower_demographics", period: "lifetime", total_value: { breakdowns: [{ dimension_keys: [b], results: res.map(([k, v]) => ({ dimension_values: [k], value: v })) }] } }] });
      }
      if (m.includes(",")) return J({ error: { message: "(#100) metric[4] must be one of the following values", code: 100 } }, 400);
      if (m === "follows_and_unfollows") return J({ error: { message: "(#100) Incompatible metric", code: 100 } }, 400);
      return J({ data: [{ name: m, period: "day", total_value: { value: { reach: 900, views: 2400, accounts_engaged: 60, total_interactions: 140 }[m] || 0 } }] });
    }
    const ins = u.pathname.match(/^\/(\w+)\/insights$/);
    if (ins) {
      const id = ins[1], metrics = String(u.searchParams.get("metric") || "").split(",");
      if (id === "s1") return J({ error: { message: "(#10) Not enough viewers for the media to show insights", code: 10 } }, 400);
      if (id === "r1" && metrics.includes("ig_reels_avg_watch_time")) return J({ error: { message: "(#100) The metric ig_reels_avg_watch_time is not supported", code: 100 } }, 400);
      const V = VALUES[id] || {};
      return J({ data: metrics.filter(k => k in V).map(k => ({ name: k, period: "lifetime", values: [{ value: V[k] }] })) });
    }
    return J({ error: { message: "unknown path " + u.pathname, code: 100 } }, 400);
  }
  return J({});
};
const env = { MEETINGS: KV, READ_KEY: "RK", WA_FORWARD_TOKEN: "FWD", WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", MAILBOXES: "", ADD_TO: "",
  OPENAI_API_KEY: "o", CF_RENDER_TOKEN: "r", CF_ACCOUNT_ID: "a", SCENE_PICTURES: "on", MINUTE_TICK: "on", PUBLIC_ORIGIN: ORIGIN,
  IG_APP_ID: "3591427797679606", IG_APP_SECRET: "SEC", CARD_LEDGER: "on" };
const pending = [];
const ctx = { waitUntil(p) { pending.push(p); } };
const settle = async () => { while (pending.length) await pending.shift(); };
const get = (path, e) => worker.fetch(new Request(ORIGIN + path), e || env, ctx);
const postForm = (path, body, e) => worker.fetch(new Request(ORIGIN + path, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }), e || env, ctx);
let mid = 0;
const tap = (id) => worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "X-Azimuth-Forward": "FWD", "Content-Type": "application/json" },
  body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [{ from: HER, id: "wamid.in" + (++mid), type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: id } } }] } }] }] }) }), env, ctx);
const tick = (h, m) => worker.scheduled({ cron: "* * * * *", scheduledTime: Date.UTC(2026, 8, 14, h, m) }, env, ctx);
const kv = (k) => { try { return JSON.parse(store.get(k)); } catch (e) { return null; } };

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

// 1. off everywhere IG_APP_ID is not set (meeting-capture runs the same file)
let r = await get("/ig_status?key=RK", Object.assign({}, env, { IG_APP_ID: "" }));
ok(r.status === 404, "no IG_APP_ID: the Instagram routes do not exist");
r = await postForm("/ig/delete", "signed_request=x.y", Object.assign({}, env, { IG_APP_ID: "" }));
ok(r.status === 404, "no IG_APP_ID: the delete callback does not exist either");

// 2. the connect link: keyed, single use, Instagram's own login with only the two permissions
r = await get("/ig_link");
ok(r.status === 401, "link: no key, 401");
r = await get("/ig_link?key=RK");
const link = (await r.json()).link || "";
ok(/^https:\/\/azimuth-2\.digitalchemy\.workers\.dev\/ig\/connect\?t=[a-z0-9]{12,}$/.test(link), "link: a one-use connect link on her instance");
const t = link.split("t=")[1];
r = await get("/ig/connect?t=nottherightone");
ok(r.status === 410 && (await r.text()).includes("This link has expired"), "connect: an unknown link says it has expired");
r = await get("/ig/connect?t=" + t);
const loc = new URL(r.headers.get("Location") || "https://none/");
ok(r.status === 302 && loc.host === "www.instagram.com" && loc.pathname === "/oauth/authorize", "connect: sends her to Instagram's login");
ok(loc.searchParams.get("client_id") === "3591427797679606" && loc.searchParams.get("redirect_uri") === ORIGIN + "/ig/callback" && loc.searchParams.get("response_type") === "code" && loc.searchParams.get("state") === t,
  "connect: the Instagram app ID, the registered return address and the link's own state");
ok(loc.searchParams.get("scope") === "instagram_business_basic,instagram_business_manage_insights", "connect: asks only to read her profile and her numbers");

// 3. the return from Instagram
r = await get("/ig/callback?error=access_denied&error_reason=user_denied&state=" + t);
ok(r.status === 200 && (await r.text()).includes("Nothing was connected") && !store.has("ig_auth"), "callback: if she says no, nothing is connected");
let before = calls.length;
r = await get("/ig/callback?code=CODE1&state=" + t, Object.assign({}, env, { IG_APP_SECRET: "" }));
ok(r.status === 503 && !calls.slice(before).some(c => c.host === "api.instagram.com"), "callback: without the app secret it stops before calling Instagram");
r = await get("/ig/callback?code=CODE1&state=" + t);
let body = await r.text();
const auth = kv("ig_auth") || {};
ok(r.status === 200 && body.includes("You're connected") && body.includes("It can't post, message or change anything"), "callback: 'You're connected' page");
ok(!/LONG1|SHORT|SEC/.test(body), "callback: the page shows no token or secret");
ok(auth.token === "LONG1" && auth.username === "her.recode" && auth.account_type === "MEDIA_CREATOR" && auth.followers === 378 && /manage_insights/.test(auth.perms), "callback: 60-day token and her profile kept");
ok(auth.expires_at > now + 59 * DAY && !store.has("ig_state_" + t), "callback: token good for 60 days, the link used up");
r = await get("/ig/callback?code=CODE1&state=" + t);
ok(r.status === 410, "callback: the same link cannot be used twice");
r = await get("/ig_status?key=RK");
body = await r.text();
const status = JSON.parse(body);
ok(status.connected === true && status.username === "her.recode" && status.secret_set === true && !body.includes("LONG1"), "status: connected, and the token never printed");

// 4. the card ledger, written by a real scene picture going to her
store.set("fbg_4", JSON.stringify({ n: "4", area: "", angle: { hook: "No metro for five kilometres, yet 6.6% gross yield.", figure: "5 km+", source: "RTA metro network coverage" },
  options: [{ id: "B", name: "Street level", note: "A real residential street, lived-in", place: "A residential street in Dubai at eye level - low-rise and mid-rise buildings, mature planting along the pavement, parked cars, a shaded walkway" }] }));
store.set("img_style_me_pool", JSON.stringify({ usable: ["style_ref_17", "style_ref_21", "style_ref_22"] }));
for (const k of ["style_ref_17", "style_ref_21", "style_ref_22"]) { store.set("img_" + k, "PHOTO:" + k); store.set("img_" + k + "_cut", "CUT:" + k); }
let i = sent.length; await tap("fbg:4:B"); await settle();
await tap("stm:4:B:ss"); await settle();
const ask = sent.slice(i).find(x => x.type === "interactive" && x.interactive.type === "button");
const mp = ask ? ask.interactive.action.buttons.map(b => b.reply.id) : [];
i = sent.length; await tap(mp[1]); await settle();
const show = sent.slice(i).find(x => x.type === "interactive");
const tok = show ? show.interactive.action.buttons[0].reply.id.slice(3) : "";
await tap("sk:" + tok); await settle();
await tick(4, 5); await settle();
const ledger = kv("cards_sent") || [];
ok(edits.length === 1 && ledger.length === 1, "ledger: one scene picture made and one card on the ledger");
ok(ledger[0] && ledger[0].kind === "scene" && ledger[0].backdrop === "Street level" && ledger[0].time === "Sunset" && ledger[0].photo === "style_ref_21", "ledger: the card's backdrop, time of day and photo");
ok(ledger[0] && ledger[0].hook.startsWith("No metro for five kilometres") && ledger[0].figure === "5 km+", "ledger: what the card said");
ledger[0].at = new Date(now - 3 * HOUR).toISOString();                           // sent three hours ago, before she posted
store.set("cards_sent", JSON.stringify(ledger));

// 5. the read: posts, Stories, per-metric fallback, the account, followers
before = calls.length;
r = await get("/ig_pull?key=RK");
const pull = await r.json();
const M = kv("ig_media") || {};
ok(pull.posts === 3 && pull.stories === 1 && pull.read === 4 && !pull.err, "read: three posts and one Story found, all four read");
ok(M.p1 && M.p1.m && M.p1.m.reach === 520 && M.p1.m.saved === 12 && M.p1.m.shares === 9, "read: the post's reach, saves and shares");
ok(M.r1 && M.r1.m && M.r1.m.reach === 1500 && !("ig_reels_avg_watch_time" in M.r1.m) && M.r1.errs.some(e => /ig_reels_avg_watch_time/.test(e)), "read: one unsupported Reel metric does not lose the rest");
ok(M.s1 && !M.s1.m && M.s1.errs.some(e => /Not enough viewers/.test(e)), "read: a Story under five viewers is recorded, not retried metric by metric");
const acct = kv("ig_account") || {};
ok(acct.totals && acct.totals.reach === 900 && acct.errs.some(e => /follows_and_unfollows/.test(e)), "read: the account's day, each metric on its own after one fails");
ok(acct.audience && acct.audience.city && acct.audience.city[0].k === "Dubai, Dubai" && acct.audience.age.length === 2, "read: who follows her, biggest city first");
ok((kv("ig_followers") || []).slice(-1)[0].n === 378, "read: followers recorded for the day");
ok(!calls.slice(before).some(c => c.host === "graph.instagram.com" && c.q.access_token && c.q.access_token !== "LONG1"), "read: every request uses the stored token");
r = await get("/ig_pull?key=RK");
ok((await r.json()).read === 0, "read: straight after, nothing is read again");

// 6. which card each post came from, and the report
r = await get("/ig_report?key=RK&format=json");
const rep = await r.json();
const row = (id) => rep.rows.find(x => x.id === id) || {};
ok(row("p1").card && row("p1").card.how === "caption" && row("p1").card.kind === "scene picture" && row("p1").card.backdrop === "Street level" && row("p1").card.time === "Sunset", "report: the post matched to its scene card by caption");
ok(row("p1").rate === 13.1, "report: rate = interactions / reach (68 / 520 = 13.1%)");
ok(row("s1").card && row("s1").card.how === "timing", "report: the Story is only a likely match, by timing");
ok(!row("r1").card && !row("p0").card, "report: posts with none of the card's words match no card");
ok(rep.groups[0] && rep.groups[0].group === "Card · scene picture · Street level · Sunset" && rep.groups[0].rate === 13.1, "report: groups ranked by rate, the scene card first");
r = await get("/ig_report?key=RK");
body = await r.text();
ok(r.status === 200 && body.includes("Which cards perform") && body.includes("@her.recode") && body.includes("Dubai, Dubai") && !body.includes("LONG1"), "report page: her account, audience and no token");
r = await get("/ig_report");
ok(r.status === 401, "report page: keyed");

// 7. the token stays fresh, and the minute tick reads every three hours at :17
auth.token_at = now - 21 * DAY; store.set("ig_auth", JSON.stringify(Object.assign(kv("ig_auth"), { token_at: now - 21 * DAY })));
await get("/ig_pull?key=RK");
ok(refreshes === 1 && kv("ig_auth").token === "LONG2", "token: refreshed once it is 20 days old");
before = calls.length; await tick(3, 18); await settle();
ok(!calls.slice(before).some(c => c.host === "graph.instagram.com"), "tick: 03:18 UTC reads nothing");
before = calls.length; await tick(3, 17); await settle();
ok(calls.slice(before).some(c => c.host === "graph.instagram.com" && c.path === "/me"), "tick: 03:17 UTC reads her numbers");

// 8. Meta's callbacks: a forged request changes nothing; a signed deletion removes everything and gives a status page
const b64u = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const payload = b64u(JSON.stringify({ algorithm: "HMAC-SHA256", issued_at: 1789300000, user_id: "1784" }));
const good = b64u(crypto.createHmac("sha256", "SEC").update(payload).digest()) + "." + payload;
const forged = b64u(crypto.createHmac("sha256", "WRONG").update(payload).digest()) + "." + payload;
r = await postForm("/ig/deauth", "signed_request=" + encodeURIComponent(forged));
ok(r.status === 400 && store.has("ig_auth"), "deauthorise: a forged signature is refused and nothing is removed");
r = await postForm("/ig/delete", "signed_request=" + encodeURIComponent(good));
const del = await r.json();
ok(r.status === 200 && /^https:\/\/azimuth-2\.digitalchemy\.workers\.dev\/ig\/deletion\?code=[a-z0-9]+$/.test(del.url) && del.confirmation_code, "delete: Meta gets a status link and a confirmation code");
ok(["ig_auth", "ig_media", "ig_account", "ig_followers", "ig_status", "ig_log"].every(k => !store.has(k)), "delete: her token, numbers, audience and log are gone");
r = await get("/ig/deletion?code=" + del.confirmation_code);
ok(r.status === 200 && (await r.text()).includes("was deleted on"), "delete: the status page confirms it");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
