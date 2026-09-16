// v150 / v150.1 - Google Meet from her chat and the walkthrough that connects it, offline (14 Sep 2026): "meet ..." -> a card -> Book it -> a Calendar event with a Meet link,
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
const sent = [], inserts = [], tokenCalls = [], ownerNotes = [], patches = [], deletes = [];
let claudeOut = null, insertStatus = 200, pendingLink = false, patchStatus = 200, deleteStatus = 204;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("graph.facebook.com")) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ messages: [{ id: "wamid.out" + sent.length }] }), { status: 200 }); }
  if (u.includes("/owner_note")) { ownerNotes.push(Object.assign({ token: init.headers["X-Azimuth-Ingest"] }, JSON.parse(init.body))); return new Response("sent", { status: 200 }); }
  if (u.includes("api.anthropic.com")) return new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(claudeOut) }] }), { status: 200 });
  if (u.includes("oauth2.googleapis.com/token")) {
    const b = new URLSearchParams(String(init.body)); tokenCalls.push(Object.fromEntries(b));
    if (b.get("grant_type") === "authorization_code") return new Response(JSON.stringify({ access_token: "AT2", refresh_token: "RT2", expires_in: 3600, scope: b.get("code") === "noscope" ? "openid" : "https://www.googleapis.com/auth/calendar.events" }), { status: 200 });
    return new Response(JSON.stringify({ access_token: "AT", expires_in: 3600 }), { status: 200 });
  }
  if (u.includes("googleapis.com/calendar/v3/calendars/primary/events")) {
    if (init && init.method === "PATCH") { patches.push({ url: u, auth: init.headers.Authorization, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ id: "ev1", hangoutLink: "https://meet.google.com/abc-defg-hij" }), { status: patchStatus }); }
    if (init && init.method === "DELETE") { deletes.push({ url: u, auth: init.headers.Authorization }); return new Response(deleteStatus === 204 ? null : "{\"error\":\"nope\"}", { status: deleteStatus }); }
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
const tpend = []; const tctx = { waitUntil(p) { tpend.push(p); } };
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

// 2. consent mode: the walkthrough in her chat; the meet command still off
const consent = Object.assign({}, base, { GMEET: "consent", MINUTE_TICK: "on" });
const last = () => sent[sent.length - 1];
const btnIds = (m) => m && m.type === "interactive" ? m.interactive.action.buttons.map(b => b.reply.id).join(",") : "";
const guide = () => JSON.parse(store.get("gcal_guide") || "null") || {};
r = await get("/gcal/start?key=bad", consent); ok(r.status === 401, "consent: /gcal/start needs the key");
r = await get("/gcal/start?key=RK", consent); const link = await r.text();
ok(r.status === 200 && link.includes("scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events") && !link.includes("drive"), "consent link asks for calendar.events only");
ok(link.includes("redirect_uri=https%3A%2F%2Fazimuth-2.digitalchemy.workers.dev%2Fgcal%2Fcallback"), "redirect is azimuth-2 /gcal/callback");
store.delete("wa_owner_last_in");   // section 1's message opened her window; close it
i = sent.length; r = await get("/gcal/start?key=RK&send=1", consent);
ok(r.status === 409 && sent.length === i, "send=1 with her 24-hour window closed: 409, nothing sent");
store.set("wa_owner_last_in", new Date().toISOString());
i = sent.length; r = await get("/gcal/start?key=RK&send=1", consent); let rj = JSON.parse(await r.text());
ok(r.status === 200 && rj.sent === true && rj.step === "intro" && sent.length === i + 1, "send=1 with the window open: one intro message");
ok(last().to === HER && /Google Meet from this chat/.test(last().interactive.body.text) && btnIds(last()) === "gc:go,gc:later", "intro: what it is, Let's do it / Later");
await tap("gc:later", consent); ok(/connect calendar/.test(last().text.body) && guide().step === "later", "Later: tells her how to pick it up");
await say("connect calendar", consent); ok(btnIds(last()) === "gc:go,gc:later", "\"connect calendar\" restarts the intro");
i = sent.length; await tap("gc:go", consent);
const out2 = sent.slice(i);
ok(out2.length === 2 && /Step 1 of 3/.test(out2[0].text.body) && /Advanced/.test(out2[0].text.body) && /view and edit events/.test(out2[0].text.body), "Let's do it: the three Google screens explained");
const link1 = (out2[0].text.body.match(/https:\/\/accounts\.google\.com\S+/) || [""])[0];
ok(link1.includes("calendar.events") && btnIds(out2[1]) === "gc:stuck,gc:new" && guide().step === "link", "the link is in the message, then I'm stuck / New link");
await tap("gc:stuck", consent); ok(/Wrong account/.test(last().interactive.body.text) && btnIds(last()) === "gc:new,gc:help", "I'm stuck: the fixes, New link / Tell Kendall");
await tap("gc:help", consent); ok(/Send him a quick message/.test(last().text.body), "Tell Kendall with no route to him: says so honestly");
const withOwner = Object.assign({}, consent, { OWNER_NOTE_URL: "https://meeting-capture.example/owner_note", INGEST_TOKEN: "ING" });
await tap("gc:help", withOwner);
ok(ownerNotes.length === 1 && ownerNotes[0].token === "ING" && /stuck connecting Google Calendar/.test(ownerNotes[0].text) && /let Kendall know/.test(last().text.body), "Tell Kendall with OWNER_NOTE_URL: the note goes to him, she is told");
// the follow-up: nothing before twenty minutes, one after, never two
const tick = async () => { await worker.scheduled({ cron: "* * * * *", scheduledTime: Date.now() }, consent, tctx); while (tpend.length) await tpend.shift(); };
i = sent.length; await tick(); ok(sent.length === i, "tick at once: no follow-up");
const gg = guide(); gg.link_at = new Date(Date.now() - 21 * 60000).toISOString(); store.set("gcal_guide", JSON.stringify(gg));
i = sent.length; await tick(); ok(sent.length === i + 1 && /Did the Google step work/.test(last().interactive.body.text) && btnIds(last()) === "gc:stuck,gc:new", "tick after twenty minutes: one follow-up");
i = sent.length; await tick(); ok(sent.length === i, "next tick: no second follow-up");
// Google's screen cancelled, a replaced link, calendar box not ticked, then success
let st = store.get("gcal_state");
i = sent.length; r = await get("/gcal/callback?state=" + st + "&error=access_denied", consent);
ok(r.status === 200 && /closed or cancelled/.test(last().interactive.body.text) && !store.has("gcal_state"), "cancelled on Google: told in the chat, link retired");
await tap("gc:new", consent); const stOld = store.get("gcal_state"); await tap("gc:new", consent);
r = await get("/gcal/callback?state=" + stOld + "&code=c", consent); ok(r.status === 400 && !store.has("gcal_token"), "an older link after New link: refused");
st = store.get("gcal_state"); i = sent.length;
r = await get("/gcal/callback?state=" + st + "&code=noscope", consent);
ok(r.status === 400 && !store.has("gcal_token") && /calendar box is ticked/.test(last().interactive.body.text) && /scope not granted/.test(store.get("gcal_last_err")), "calendar box not ticked: nothing stored, told how to fix it");
await tap("gc:new", consent); st = store.get("gcal_state");
r = await get("/gcal/callback?state=" + st + "&code=good", consent);
ok(r.status === 200 && JSON.parse(store.get("gcal_token")).refresh_token === "RT2" && !store.has("gcal_last_err"), "good callback stores gcal_token");
ok(/Kendall is switching Meet bookings on/.test(last().text.body) && guide().step === "connected", "consent mode: connected, told bookings come next");
ok(store.get("gdrive_token") === drive, "Drive token untouched by the Calendar consent");
await say("meet Friday 3pm with sara@example.com", consent);
ok(![...store.keys()].some(k => k.startsWith("gmp_")), "consent mode: the command is still off");
r = await get("/gcal/status?key=RK", consent); const stj = JSON.parse(await r.text());
ok(stj.connected === true && stj.token_ok === true && stj.mode === "consent" && stj.guide.step === "connected" && stj.window_open === true, "/gcal/status: connected, mode, walkthrough step, window");

// 2b. switched on: Kendall starts it again, she runs the test call
i = sent.length; r = await get("/gcal/start?key=RK&send=1", on); rj = JSON.parse(await r.text());
ok(rj.step === "try" && /Google Meet is ready/.test(last().interactive.body.text) && btnIds(last()) === "gc:try,gc:skip", "on: send=1 offers the test call");
i = sent.length; await tap("gc:try", on);
const tcard = last().interactive; const tp = JSON.parse(store.get([...store.keys()].find(k => k.startsWith("gmp_"))));
const tstart = Date.parse(tp.start_iso);
ok(/Test call - Najma/.test(tcard.body.text) && /15 min/.test(tcard.body.text) && /No guests/.test(tcard.body.text) && tp.trial === true, "Try it: a 15-minute test card, no guests");
ok(tstart >= Date.now() + 9 * 60000 && tstart <= Date.now() + 16 * 60000 && new Date(tstart).getUTCMinutes() % 5 === 0 && /\+04:00$/.test(tp.start_iso), "test call about ten minutes out, on a five-minute mark, Gulf time");
await tap(tcard.action.buttons[0].reply.id, on);
ok(inserts.length === 1 && inserts[0].url.includes("sendUpdates=none") && inserts[0].body.attendees.length === 0, "test booking: nobody invited");
ok(/From now on just say \*meet\*/.test(last().text.body) && last().text.body.includes("https://meet.google.com/abc-defg-hij") && guide().step === "done", "booked: join link and how to use it; walkthrough done");
await say("connect calendar", on); ok(/already connected/.test(last().text.body), "\"connect calendar\" after done: already connected");
inserts.length = 0;
for (const k of [...store.keys()]) if (k.startsWith("evt_")) store.delete(k);   // the walkthrough's test call is not part of the counts below

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
await say("meet tomorrow 3pm team", on); ok(/isn't connected/.test(sent[sent.length - 1].interactive.body.text) && btnIds(sent[sent.length - 1]) === "gc:go,gc:later" && inserts.length === n, "no calendar token: offers to connect, books nothing");
ok(store.get("gdrive_token") === drive, "Drive token still untouched at the end");

// 6. v150.2 - the operator's kick (gcal_kick written with Cloudflare access) starts her walkthrough on the minute tick
store.delete("gcal_guide");
const kickEnv = Object.assign({}, consent);
const kickTick = async () => { await worker.scheduled({ cron: "* * * * *", scheduledTime: Date.now() }, kickEnv, tctx); while (tpend.length) await tpend.shift(); };
store.delete("wa_owner_last_in"); store.set("gcal_kick", "k1");
i = sent.length; await kickTick();
ok(sent.length === i && !store.has("gcal_kick") && JSON.parse(store.get("gcal_kick_result")).sent === false, "kick with her window closed: nothing sent, kick used, result says why");
store.set("wa_owner_last_in", new Date().toISOString()); store.set("gcal_kick", "k2");
i = sent.length; await kickTick();
ok(sent.length === i + 1 && /Google Meet from this chat/.test(last().interactive.body.text) && btnIds(last()) === "gc:go,gc:later", "kick with the window open: her intro, once");
ok(JSON.parse(store.get("gcal_kick_result")).step === "intro" && guide().step === "intro" && !store.has("gcal_kick"), "kick result recorded; walkthrough at intro");
store.set("gcal_kick", "k2");
i = sent.length; await kickTick(); ok(sent.length === i, "the same kick value again: nothing more sent");
i = sent.length; await kickTick(); ok(sent.length === i, "no kick: the tick sends nothing");
// v150.3 - an approved message as the kick
store.set("gcal_kick", JSON.stringify({ id: "n1", text: "Good morning, Black Coffee.\n\nIt's easier on your computer.", buttons: "link", signoff: true }));
i = sent.length; await kickTick();
ok(sent.length === i + 1 && last().interactive.body.text === "Good morning, Black Coffee.\n\nIt's easier on your computer.\n\n— Curated for Black Coffee, by Papi", "message kick: the approved text as written, house sign-off appended");
ok(btnIds(last()) === "gc:new,gc:stuck" && JSON.parse(store.get("gcal_kick_result")).message === true && guide().nudge_at, "message kick: New link / I'm stuck; result and nudge time recorded");
store.set("gcal_kick", JSON.stringify({ id: "n1", text: "again", buttons: "link" }));
i = sent.length; await kickTick(); ok(sent.length === i, "message kick with a used id: nothing sent");
store.set("gcal_kick", JSON.stringify({ id: "n2", text: "x".repeat(1100), buttons: "link" }));
i = sent.length; await kickTick(); ok(sent.length === i && /over 1024/.test(JSON.parse(store.get("gcal_kick_result")).why), "message kick over 1024 characters: refused, nothing sent");
await tap("gc:new", kickEnv); ok(/Step 1 of 3/.test(sent[sent.length - 2].text.body), "New link under the nudge sends the steps with a fresh link");


// v154.4 - Naj's wording (16 Sep 2026): "Google meeting with Jackson Wednesday 1:00 - 2pm" is a Meet request, an hour long
store.set("gcal_token", JSON.stringify({ refresh_token: "RT", access_token: "AT", exp: Date.now() + 3600000 }));   // the case above removed it
for (const k of [...store.keys()]) if (k.startsWith("gmp_")) store.delete(k);
claudeOut = { ok: true, title: "Google meeting with Jackson", start_iso: future, duration_min: null };
i = sent.length; await say("Google meeting with Jackson Wednesday 1:00 - 2pm", on);
let gp = [...store.keys()].filter(k => k.startsWith("gmp_")).map(k => JSON.parse(store.get(k)));
ok(gp.length === 1 && gp[0].asked === "with Jackson Wednesday 1:00 - 2pm" && gp[0].duration_min === 60, "\"Google meeting with ... 1:00 - 2pm\": a proposal, 60 minutes");
ok(sent.length === i + 1 && last().type === "interactive" && /Google Meet - book this\?/.test(last().interactive.body.text) && /60 min/.test(last().interactive.body.text), "... and the card says 60 min");
for (const k of [...store.keys()]) if (k.startsWith("gmp_")) store.delete(k);
i = sent.length; await say("Call with Jackson tomorrow 3pm on Google Meet", on);
gp = [...store.keys()].filter(k => k.startsWith("gmp_")).map(k => JSON.parse(store.get(k)));
ok(gp.length === 1 && gp[0].asked === "Call with Jackson tomorrow 3pm on Google Meet" && gp[0].duration_min === 30, "\"... on Google Meet\" anywhere in the line: a proposal, default 30 minutes");
for (const k of [...store.keys()]) if (k.startsWith("gmp_")) store.delete(k);
i = sent.length; await say("Meeting with Jackson tomorrow 3pm at the office", on);
ok(![...store.keys()].some(k => k.startsWith("gmp_")) && !sent.slice(i).some(m => m.type === "interactive" && /Google Meet - book/.test(m.interactive.body.text)), "a plain \"meeting with ...\" is not a Meet request (in person stays with the capture)");
for (const k of [...store.keys()]) if (k.startsWith("gmp_")) store.delete(k);
claudeOut = { ok: true, title: "Sara", start_iso: future, duration_min: null };
await say("meet Sara 11 - 1pm", on); gp = [...store.keys()].filter(k => k.startsWith("gmp_")).map(k => JSON.parse(store.get(k)));
ok(gp.length === 1 && gp[0].duration_min === 120, "\"11 - 1pm\": two hours (the start stays am)");
for (const k of [...store.keys()]) if (k.startsWith("gmp_")) store.delete(k);
await say("meet Sara 16-17 Sept 3pm 45m", on); gp = [...store.keys()].filter(k => k.startsWith("gmp_")).map(k => JSON.parse(store.get(k)));
ok(gp.length === 1 && gp[0].duration_min === 45, "\"16-17 Sept\" is not read as hours; a stated 45m wins");
// v154.6 - the line copied with WhatsApp's bold stars still books (Naj, 16 Sep 2026 12:59 GST: "*meet Jackson today 1pm 1h*" went to the capture)
for (const k of [...store.keys()]) if (k.startsWith("gmp_")) store.delete(k);
claudeOut = { ok: true, title: "Jackson", start_iso: future, duration_min: null };
await say("*meet Jackson today 1pm 1h*", on); gp = [...store.keys()].filter(k => k.startsWith("gmp_")).map(k => JSON.parse(store.get(k)));
ok(gp.length === 1 && gp[0].asked === "Jackson today 1pm 1h" && gp[0].duration_min === 60, "\"*meet ... 1h*\" with bold stars: a proposal, 60 minutes");
for (const k of [...store.keys()]) if (k.startsWith("gmp_")) store.delete(k);
// v154.7 - move and cancel a booked Meet from the chat
const gmpAll = () => [...store.keys()].filter(k => k.startsWith("gmp_")).map(k => JSON.parse(store.get(k)));
const evtsOf = (id) => [...store.keys()].filter(k => k.startsWith("evt_")).map(k => JSON.parse(store.get(k))).filter(e => e.gcal_id === id);
for (const k of [...store.keys()]) if (k.startsWith("gmp_") || (k.startsWith("evt_") && /"gcal_id":"ev1"/.test(store.get(k)))) store.delete(k);   // earlier bookings share the stub id
claudeOut = { ok: true, title: "Jackson", start_iso: future, duration_min: null };
await say("meet Jackson tomorrow 3pm 1h jackson@example.com", on); let jp = gmpAll()[0];
await tap("gm:ok:" + jp.id, on); jp = gmpAll()[0];
ok(jp.status === "booked" && jp.gcal_id === "ev1" && evtsOf("ev1").length === 1, "setup: Jackson booked with a guest, evt_ filed");
const later = future.replace("T15:00", "T16:00");
claudeOut = { ok: true, start_iso: later, duration_min: null };
i = sent.length; await say("move Jackson to 4pm", on); jp = gmpAll()[0];
ok(sent.length === i + 1 && /Move this Meet\?/.test(last().interactive.body.text) && /→/.test(last().interactive.body.text) && /60 min/.test(last().interactive.body.text) && btnIds(last()) === "gm:mv:" + jp.id + ",gm:keep:" + jp.id, "move: a card, old -> new time, the old length kept, Move it / Keep it");
ok(jp.move && jp.move.start_iso === later && jp.move.duration_min === 60 && jp.status === "booked" && patches.length === 0, "move: pending on the record, nothing sent to Google yet");
await tap("gm:keep:" + jp.id, on); jp = gmpAll()[0];
ok(!jp.move && jp.start_iso === future && /Kept as it was/.test(last().text.body) && patches.length === 0, "Keep it: nothing changes");
await say("move the Jackson call to 4pm 30m", on); jp = gmpAll()[0];
ok(jp.move && jp.move.duration_min === 30 && /30 min/.test(last().interactive.body.text), "move with a stated length: 30 min; \"the Jackson call\" finds it");
i = sent.length; await tap("gm:mv:" + jp.id, on); jp = gmpAll()[0];
const pt = patches[patches.length - 1];
ok(patches.length === 1 && pt.url.includes("/events/ev1?sendUpdates=all") && pt.auth === "Bearer AT" && pt.body.start.dateTime === new Date(Date.parse(later)).toISOString() && pt.body.end.dateTime === new Date(Date.parse(later) + 30 * 60000).toISOString(), "Move it: PATCH on the event, guests told, new start and end");
ok(jp.start_iso === later && jp.duration_min === 30 && !jp.move && jp.moved_at && jp.status === "booked", "Move it: the record follows");
ok(evtsOf("ev1").length === 1 && evtsOf("ev1")[0].start_iso === later, "Move it: the evt_ record moves with it");
ok(sent.length === i + 1 && /Moved - Jackson/.test(last().text.body) && last().text.body.includes("https://meet.google.com/abc-defg-hij") && /Google has told jackson@example.com/.test(last().text.body), "Move it: confirmation with the same link and the guest told");
await tap("gm:mv:" + jp.id, on); ok(/Already handled/.test(last().text.body) && patches.length === 1, "a second Move it tap: already handled");
claudeOut = { ok: false, start_iso: null, duration_min: null };
await say("move Jackson to whenever", on); ok(/When should Jackson move to/.test(last().text.body) && !gmpAll()[0].move, "move with no readable time: asks, nothing pending");
claudeOut = { ok: true, start_iso: "2020-01-01T10:00:00+04:00", duration_min: null };
await say("move Jackson to 1 Jan 2020 10am", on); ok(/already passed/.test(last().text.body) && !gmpAll()[0].move, "move into the past: refused");
i = sent.length; await say("move Sara to 4pm", on);
ok(!sent.slice(i).some(m => m.type === "interactive" && /Move this Meet/.test(m.interactive.body.text)), "move of a name with no booking: not claimed by the Meet flow");
patchStatus = 500; claudeOut = { ok: true, start_iso: later.replace("T16:00", "T17:00"), duration_min: null };
await say("move Jackson to 5pm", on); jp = gmpAll()[0]; await tap("gm:mv:" + jp.id, on); jp = gmpAll()[0];
ok(patches.length === 2 && /didn't accept the move/.test(last().text.body) && jp.start_iso === later && jp.move && jp.move.start_iso === later.replace("T16:00", "T17:00") && /^patch 500/.test(store.get("gcal_last_err")), "Google refuses the move: nothing changes, the move stays pending, error recorded");
patchStatus = 200; await tap("gm:mv:" + jp.id, on); jp = gmpAll()[0]; ok(jp.start_iso === later.replace("T16:00", "T17:00") && patches.length === 3, "Move it again after the failure: done");
// cancel
i = sent.length; await say("cancel Jackson", on); jp = gmpAll()[0];
ok(sent.length === i + 1 && /Cancel this Meet\?/.test(last().interactive.body.text) && /Google will tell jackson@example.com/.test(last().interactive.body.text) && btnIds(last()) === "gm:cx:" + jp.id + ",gm:kx:" + jp.id && jp.cancel && deletes.length === 0, "cancel: a card, Cancel it / Keep it, nothing sent to Google yet");
await tap("gm:kx:" + jp.id, on); jp = gmpAll()[0]; ok(!jp.cancel && jp.status === "booked" && /Kept - Jackson/.test(last().text.body), "Keep it: still booked");
i = sent.length; await say("cancel Zed", on); ok(!sent.slice(i).some(m => m.type === "interactive" && /Cancel this Meet/.test(m.interactive.body.text)), "cancel of a name with no booking: not claimed");
await say("cancel meeting with Jackson", on); jp = gmpAll()[0]; ok(!!jp.cancel, "\"cancel meeting with Jackson\" finds it");
deleteStatus = 500; await tap("gm:cx:" + jp.id, on); jp = gmpAll()[0];
ok(deletes.length === 1 && /didn't accept that/.test(last().text.body) && jp.status === "booked" && jp.cancel && evtsOf("ev1").length === 1, "Google refuses the delete: still booked, still pending, evt_ kept");
deleteStatus = 204; i = sent.length; await tap("gm:cx:" + jp.id, on); jp = gmpAll()[0];
ok(deletes.length === 2 && deletes[1].url.includes("/events/ev1?sendUpdates=all") && deletes[1].auth === "Bearer AT", "Cancel it: DELETE on the event, guests told");
ok(jp.status === "cancelled" && !jp.cancel && jp.cancelled_at && evtsOf("ev1").length === 0, "Cancel it: record cancelled, evt_ removed");
ok(sent.length === i + 1 && /Cancelled - Jackson/.test(last().text.body) && /off your Google Calendar and Google has told jackson@example.com/.test(last().text.body), "Cancel it: confirmation");
i = sent.length; await say("cancel Jackson", on); ok(!sent.slice(i).some(m => m.type === "interactive" && /Cancel this Meet/.test(m.interactive.body.text)), "a cancelled booking is not found again");
await tap("gm:cx:" + jp.id, on); ok(/Already handled/.test(last().text.body) && deletes.length === 2, "a stale Cancel it tap: already handled");
for (const k of [...store.keys()]) if (k.startsWith("gmp_")) store.delete(k);
// the nudge preview: an online "location" gets no map link
store.set("evt_" + Date.now() + "_x1", JSON.stringify({ summary: "Google meeting with Jackson", start_iso: future.replace("T15:00", "T08:00"), location: "Google Meet", source: "whatsapp" }));
store.set("evt_" + Date.now() + "_x2", JSON.stringify({ summary: "Coffee", start_iso: future, location: "Emaar Square, Downtown Dubai", source: "whatsapp" }));
r = await get("/nudge_test?key=RK", on); const nj = await r.json();
const gmRow = nj.next.find(x => x.summary === "Google meeting with Jackson"), cfRow = nj.next.find(x => x.summary === "Coffee");
ok(gmRow && gmRow.nav === "" && gmRow.location === "Google Meet", "nudge: \"Google Meet\" as the location gets no map link");
ok(cfRow && /google\.com\/maps/.test(cfRow.nav), "nudge: a real address still gets its map link");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
