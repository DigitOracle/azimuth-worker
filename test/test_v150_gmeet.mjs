// v150 - Google Meet from her chat, offline (14 Sep 2026): "meet ..." -> a card -> Book it -> a Calendar event with a Meet link,
// invites only to typed addresses, an evt_ record for the nudges; the switch, the consent routes and the Drive token untouched.
// No network: WhatsApp, Claude and Google are stubbed, and every request is captured and checked.
import worker from "../src/index.js";

const HER = "971565484397";
const store = new Map();
const KV = {
  async get(k) { return store.has(k) ? store.get(k) : null; },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; },
};
const sent = [], inserts = [], tokenCalls = [];
let claudeOut = null, insertStatus = 200, pendingLink = false;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("graph.facebook.com")) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ messages: [{ id: "wamid.out" + sent.length }] }), { status: 200 }); }
  if (u.includes("api.anthropic.com")) return new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(claudeOut) }] }), { status: 200 });
  if (u.includes("oauth2.googleapis.com/token")) {
    const b = new URLSearchParams(String(init.body)); tokenCalls.push(Object.fromEntries(b));
    if (b.get("grant_type") === "authorization_code") return new Response(JSON.stringify({ access_token: "AT2", refresh_token: "RT2", expires_in: 3600, scope: b.get("code") === "noscope" ? "openid" : "https://www.googleapis.com/auth/calendar.events" }), { status: 200 });
    return new Response(JSON.stringify({ access_token: "AT", expires_in: 3600 }), { status: 200 });
  }
  if (u.includes("googleapis.com/calendar/v3/calendars/primary/events")) {
    if (init && init.method === "POST") {
      inserts.push({ url: u, auth: init.headers.Authorization, body: JSON.parse(init.body) });
      if (insertStatus !== 200) return new Response('{"error":"nope"}', { status: insertStatus });
      return new Response(JSON.stringify(pendingLink ? { id: "ev1", conferenceData: { createRequest: { status: { statusCode: "pending" } } } } : { id: "ev1", hangoutLink: "https://meet.google.com/abc-defg-hij" }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: "ev1", conferenceData: { entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/zzz-later-now" }] } }), { status: 200 });
  }
  return new Response("{}", { status: 200 });
};
const base = { MEETINGS: KV, READ_KEY: "RK", WA_FORWARD_TOKEN: "FWD", WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", MAILBOXES: "", ADD_TO: "",
  ANTHROPIC_API_KEY: "k", GOOGLE_OAUTH_CLIENT_ID: "cid", GOOGLE_OAUTH_CLIENT_SECRET: "cs", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const on = Object.assign({}, base, { GMEET: "on" });
const ctx = { waitUntil() {} };
let mid = 0;
const post = (message, e) => worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "X-Azimuth-Forward": "FWD", "Content-Type": "application/json" },
  body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [Object.assign({ from: HER, id: "wamid.in" + (++mid) }, message)] } }] }] }) }), e, ctx);
const tap = (id, e) => post({ type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: id } } }, e);
const say = (body, e) => post({ type: "text", text: { body } }, e);
const get = (path, e) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + path), e, ctx);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const future = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) + "T15:00:00+04:00";
const drive = JSON.stringify({ refresh_token: "DRIVE", access_token: "DA", exp: Date.now() + 3600000 });
store.set("gdrive_token", drive);

// 1. switched off: routes 404, and "meet ..." is not taken by this feature
let r = await get("/gcal/start?key=RK", base);
ok(r.status === 404, "GMEET unset: /gcal/start is 404");
let i = sent.length; claudeOut = { ok: true, title: "Sara", start_iso: future, duration_min: null };
await say("meet Friday 3pm with sara@example.com", base);
ok(!sent.slice(i).some(m => m.type === "interactive" && /Google Meet/.test(m.interactive.body.text)), "GMEET unset: no Meet card");
ok(![...store.keys()].some(k => k.startsWith("gmp_")), "GMEET unset: no proposal stored");

// 2. consent mode: routes open, command still off
const consent = Object.assign({}, base, { GMEET: "consent" });
r = await get("/gcal/start?key=bad", consent); ok(r.status === 401, "consent: /gcal/start needs the key");
r = await get("/gcal/start?key=RK", consent); const link = await r.text();
ok(r.status === 200 && link.includes("scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events") && !link.includes("drive"), "consent link asks for calendar.events only");
ok(link.includes("redirect_uri=https%3A%2F%2Fazimuth-2.digitalchemy.workers.dev%2Fgcal%2Fcallback"), "redirect is azimuth-2 /gcal/callback");
const st = new URL(link).searchParams.get("state");
i = sent.length; r = await get("/gcal/start?key=RK&send=1", consent);
ok(sent.slice(i).length === 1 && sent[sent.length - 1].to === HER && /Google Calendar/.test(sent[sent.length - 1].text.body), "&send=1 sends her one consent message");
const st2 = new URL(await r.text()).searchParams.get("state");
r = await get("/gcal/callback?state=" + st + "&code=c", consent); ok(r.status === 400 && !store.has("gcal_token"), "callback with a replaced state is refused");
r = await get("/gcal/callback?state=" + st2 + "&code=noscope", consent); ok(r.status === 400 && !store.has("gcal_token"), "callback without the calendar scope stores nothing");
await get("/gcal/start?key=RK", consent);
const st3 = store.get("gcal_state");
r = await get("/gcal/callback?state=" + st3 + "&code=good", consent);
ok(r.status === 200 && JSON.parse(store.get("gcal_token")).refresh_token === "RT2", "good callback stores gcal_token");
ok(store.get("gdrive_token") === drive, "Drive token untouched by the Calendar consent");
i = sent.length; await say("meet Friday 3pm with sara@example.com", consent);
ok(!store.has("gmp_") && ![...store.keys()].some(k => k.startsWith("gmp_")), "consent mode: the command is still off");
r = await get("/gcal/status?key=RK", on); const stj = JSON.parse(await r.text());
ok(stj.connected === true && stj.token_ok === true, "/gcal/status reports connected");

// 3. on: a card, guests only from typed addresses, length from the text
i = sent.length; claudeOut = { ok: true, title: "Sara from Emaar ghost@evil.com", start_iso: future, duration_min: 30 };
await say("meet Friday 3pm with Sara from Emaar sara@example.com, Tom@Example.com. 45m", on);
let out = sent.slice(i);
ok(out.length === 1 && out[0].type === "interactive", "on: one card comes back");
const card = out[0].interactive;
ok(/Sara from Emaar/.test(card.body.text) && !/ghost@evil\.com/.test(card.body.text), "card title keeps the name, drops a model-supplied address");
ok(/sara@example\.com, tom@example\.com/.test(card.body.text) && /45 min/.test(card.body.text), "card lists the typed guests and 45 min");
const [okBtn, noBtn] = card.action.buttons.map(b => b.reply);
ok(okBtn.id.startsWith("gm:ok:") && noBtn.id.startsWith("gm:no:") && okBtn.title.length <= 20 && noBtn.title.length <= 20, "Book it / Don't book buttons within WhatsApp's 20 characters");
ok(inserts.length === 0, "nothing booked before the tap");

// 4. Book it
i = sent.length; await tap(okBtn.id, on);
ok(inserts.length === 1, "one Calendar insert");
const ins = inserts[0];
ok(ins.url.includes("conferenceDataVersion=1") && ins.url.includes("sendUpdates=all") && ins.auth === "Bearer AT2", "insert asks for a Meet link, sends invites, uses the calendar token");
ok(ins.body.conferenceData.createRequest.conferenceSolutionKey.type === "hangoutsMeet", "hangoutsMeet requested");
ok(JSON.stringify(ins.body.attendees) === JSON.stringify([{ email: "sara@example.com" }, { email: "tom@example.com" }]), "attendees are exactly the typed addresses");
ok((Date.parse(ins.body.end.dateTime) - Date.parse(ins.body.start.dateTime)) === 45 * 60000 && Date.parse(ins.body.start.dateTime) === Date.parse(future), "start and a 45-minute end");
out = sent.slice(i);
ok(out.length === 1 && /Booked/.test(out[0].text.body) && out[0].text.body.includes("https://meet.google.com/abc-defg-hij"), "she gets the join link");
const gevts = () => [...store.keys()].filter(k => k.startsWith("evt_")).map(k => JSON.parse(store.get(k))).filter(e => e.source === "gmeet");   // switched off, "meet ..." still files through the old capture
const evts = gevts();
ok(evts.length === 1 && evts[0].join === "https://meet.google.com/abc-defg-hij" && evts[0].start_iso === future, "evt_ record carries the join link for the nudges");
i = sent.length; await tap(okBtn.id, on);
ok(inserts.length === 1 && /Already handled/.test(sent[sent.length - 1].text.body), "a second tap books nothing more");

// 5. Don't book, a failed insert, a pending link, no time, a past time, no token
claudeOut = { ok: true, title: "Team", start_iso: future, duration_min: null };
await say("meet tomorrow 3pm team", on);
let c2 = sent[sent.length - 1].interactive.action.buttons.map(b => b.reply.id);
ok(/No guests/.test(sent[sent.length - 1].interactive.body.text) && /30 min/.test(sent[sent.length - 1].interactive.body.text), "no guests, default 30 min");
await tap(c2[1], on); ok(inserts.length === 1 && /Not booked/.test(sent[sent.length - 1].text.body), "Don't book creates nothing");
await say("meet tomorrow 3pm team", on); c2 = sent[sent.length - 1].interactive.action.buttons.map(b => b.reply.id);
insertStatus = 403; await tap(c2[0], on);
ok(/didn't accept/.test(sent[sent.length - 1].text.body) && gevts().length === 1, "a refused insert: told, no evt_ written");
insertStatus = 200; pendingLink = true; await tap(c2[0], on);
ok(inserts[inserts.length - 1].url.includes("sendUpdates=none") && sent[sent.length - 1].text.body.includes("https://meet.google.com/zzz-later-now"), "retry after a failure works; a pending link is read back; no guests = no invites");
pendingLink = false;
i = sent.length; claudeOut = { ok: false, title: null, start_iso: null, duration_min: null };
await say("meet with sara@example.com", on); ok(/When should it be/.test(sent[sent.length - 1].text.body), "no time: asks when");
claudeOut = { ok: true, title: "Old", start_iso: "2020-01-01T10:00:00+04:00", duration_min: null };
await say("meet 1 Jan 2020 10am", on); ok(/already passed/.test(sent[sent.length - 1].text.body), "past time: refused");
store.delete("gcal_token"); const n = inserts.length;
await say("meet tomorrow 3pm team", on); ok(/isn't connected/.test(sent[sent.length - 1].text.body) && inserts.length === n, "no calendar token: says so, books nothing");
ok(store.get("gdrive_token") === drive, "Drive token still untouched at the end");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
