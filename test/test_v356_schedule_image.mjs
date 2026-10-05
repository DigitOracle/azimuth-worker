// v356 - a picture of a schedule: read once, confirm, then file through the same meeting filer a photographed meeting uses.
// Offline: the real worker, KV and fetch stubbed. The vision call is stubbed with the poster's JSON, so this pins OUR handling,
// not the model's reading of the real poster (that is checked by sending the real poster after the preview deploy).
//   node test/test_v356_schedule_image.mjs
import worker from "../src/index.js";
import * as S from "../src/sched_image.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + (JSON.stringify(a) === JSON.stringify(b) ? "" : "  got " + JSON.stringify(a) + " want " + JSON.stringify(b)));
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const MODELNAME = /claude|sonnet|anthropic|gpt|openai|llama|gemini|\bAI\b|model/i;

// ---------- pure parts, with the poster's own dates ----------
console.log("sanitise");
const POSTER = { kind: "schedule", events: [
  { title: "Modon briefing", date: "2026-10-05", time: "10:30", place: "Modon Sales Centre", note: "project briefing, updates, discussion" },
  { title: "Site visit at Mayfair Gardens by Majid Development", date: "2026-10-06", time: "11:00", place: "Mayfair Gardens", note: "site visit, explore, learn, discuss" },
  { title: "Object 1 briefing", date: "2026-10-07", time: "11:30", place: "our office", note: "not mandatory" },
  { title: "Launch of Kore by Imtiaz", date: "2026-10-08", time: "10:00", place: "Imtiaz Experience Centre", note: "project launch, presentation, opportunities" }] };
let c = S.schedSanitise(POSTER, "2026-10-05");
eq(c.events.map((e) => e.date + " " + e.time), ["2026-10-05 10:30", "2026-10-06 11:00", "2026-10-07 11:30", "2026-10-08 10:00"], "the poster gives 4 events, dates 5 to 8 Oct, times as printed");
eq(S.schedLine(c.events[0]), "Mon 5 Oct, 10:30 - Modon briefing, Modon Sales Centre (project briefing, updates, discussion)", "a line reads like the card she was promised");
ok(c.events[2].note === "not mandatory", "'not mandatory' sits in the note");
eq(S.schedSanitise({ kind: "schedule", events: [{ title: "Old", date: "2026-10-01", time: null, place: "", note: "" }, { title: "Far", date: "2027-03-01", time: null, place: "", note: "" }, { title: "Edge-2", date: "2026-10-03", time: null, place: "", note: "" }, { title: "Edge+120", date: "2027-02-02", time: null, place: "", note: "" }, { title: "Edge+121", date: "2027-02-03", time: null, place: "", note: "" }] }, "2026-10-05").events.map((e) => e.title), ["Edge-2", "Edge+120"], "date window: -2 days to +120 days kept, outside dropped");
eq(S.schedSanitise({ kind: "schedule", events: [{ title: "x", date: "2026-02-30", time: "25:99", place: "", note: "" }, { title: "y", date: "tomorrow", time: null, place: "", note: "" }, { title: "", date: "2026-10-06", time: null, place: "", note: "" }, null, "str"] }, "2026-10-05").events, [], "impossible dates, words, empty titles and junk rows are dropped");
const t = S.schedSanitise({ kind: "flyer", events: [{ title: "<script>alert(1)</script>Launch  party " + "z".repeat(300), date: "2026-10-06", time: "9:05", place: "<b>Hall</b>", note: "" }] }, "2026-10-05").events[0];
ok(t.title.length <= 120 && !/[<>]/.test(t.title + t.place) && t.time === "09:05", "titles clipped to 120, no HTML, 9:05 becomes 09:05");
eq(S.schedSanitise({ kind: "schedule", events: [{ title: "a", date: "2026-10-06", time: "99:00", place: "", note: "" }] }, "2026-10-05").events[0].time, null, "a bad time becomes null, the event stays");
const many = { kind: "schedule", events: Array.from({ length: 30 }, (_, i) => ({ title: "E" + i, date: "2026-10-06", time: null, place: "", note: "" })) };
eq(S.schedSanitise(many, "2026-10-05").events.length, 12, "at most 12 events");
eq([S.schedSanitise(null, "2026-10-05"), S.schedSanitise("junk", "2026-10-05"), S.schedSanitise({ kind: "schedule" }, "2026-10-05"), S.schedSanitise([], "2026-10-05")], [null, null, null, null], "garbage is rejected");
ok(S.schedCaptionHit("NEXT WEEK schedule") && S.schedCaptionHit("my calendar") && S.schedCaptionHit("agenda for Monday") && S.schedCaptionHit("events") && !S.schedCaptionHit("this is me") && !S.schedCaptionHit(""), "caption words that claim a picture for extraction");

// ---------- through the worker ----------
const READ = "owner_admin_key_never_in_client_links_0001", HER = "971565484397";
const store = new Map(); let writes = [];
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k).v; return t === "json" ? JSON.parse(v) : t === "arrayBuffer" ? (typeof v === "string" ? new TextEncoder().encode(v).buffer : v) : v; },
  async put(k, v, o) { writes.push(k); store.set(k, { v, ttl: o && o.expirationTtl }); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; },
};
const MARK = "PNGBYTES-MARKER-356";
let outbound = [], aiCalls = [], schedAnswer = null, readAnswer = { kind: "nothing", summary: "A selfie", meal: null, meeting: null, tasks: [] };
let mediaBytes = new TextEncoder().encode(MARK + "x".repeat(2000));
globalThis.fetch = async (input, init) => {
  const u = String((input && input.url) || input), method = (init && init.method) || "GET", body = init && typeof init.body === "string" ? init.body : "";
  if (u.includes("api.anthropic.com")) {
    const j = JSON.parse(body), sys = String(j.system || "");
    aiCalls.push(sys);
    const ans = /reading a picture someone sent/.test(sys) ? schedAnswer : /reading a photo or screenshot/.test(sys) ? readAnswer : {};
    return new Response(JSON.stringify({ content: [{ type: "text", text: typeof ans === "string" ? ans : JSON.stringify(ans) }], stop_reason: "end_turn" }), { status: 200 });
  }
  if (u.includes("graph.facebook.com") && method === "POST") { outbound.push(JSON.parse(body || "{}")); return new Response(JSON.stringify({ messages: [{ id: "wamid.out" + outbound.length }] }), { status: 200 }); }
  if (u.includes("graph.facebook.com")) return new Response(JSON.stringify({ url: "https://media.test/m1", mime_type: "image/jpeg" }), { status: 200 });
  if (u.includes("media.test")) return new Response(mediaBytes, { status: 200, headers: { "Content-Type": "image/jpeg" } });
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const env = { MEETINGS: KV, READ_KEY: READ, INGEST_TOKEN: "ING", WA_FORWARD_TOKEN: "FWD", WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p",
  ANTHROPIC_API_KEY: "k", MAILBOXES: "", ADD_TO: "", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const ORIGIN = env.PUBLIC_ORIGIN, ctx = { waitUntil() {} };
let n = 0;
const wa = async (msg) => { n++; return worker.fetch(new Request(ORIGIN + "/wa", { method: "POST", headers: { "Content-Type": "application/json", "X-Azimuth-Forward": "FWD" }, body: JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [Object.assign({ from: HER, id: "wamid.in" + n, timestamp: String(Math.floor(Date.now() / 1000)) }, msg)] } }] }] }) }), env, ctx); };
const tap = (id) => wa({ type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: id } } });
const lastOut = () => outbound[outbound.length - 1] || {};
const said = () => { const o = lastOut(); return (o.text && o.text.body) || (o.interactive && o.interactive.body && o.interactive.body.text) || ""; };
const btns = () => { const o = lastOut(); return o.interactive && o.interactive.action && o.interactive.action.buttons ? o.interactive.action.buttons.map((b) => b.reply) : []; };
const evts = () => [...store.entries()].filter(([k]) => k.startsWith("evt_")).map(([, e]) => JSON.parse(e.v));
const pending = () => [...store.keys()].filter((k) => k.startsWith("imgsched_"));
const allSaid = () => outbound.map((o) => (o.text && o.text.body) || (o.interactive && o.interactive.body && o.interactive.body.text) || "").join("\n") + JSON.stringify(outbound.map((o) => o.interactive && o.interactive.action));

// the poster, dated from today so the date window never rots
const dub = (off) => new Date(Date.now() + 4 * 3600000 + off * 86400000).toISOString().slice(0, 10);
const posterNow = () => ({ kind: "schedule", events: POSTER.events.map((e, i) => Object.assign({}, e, { date: dub(1 + i) })) });

console.log("a poster, no caption");
schedAnswer = posterNow(); outbound = []; aiCalls = [];
await wa({ type: "image", image: { id: "mid1", mime_type: "image/jpeg" } });
ok(/^I found 4 events in this picture:/.test(said()), "the card opens 'I found 4 events in this picture:'");
ok(said().split("\n").filter((l) => / - /.test(l)).length === 4 && /10:30 - Modon briefing, Modon Sales Centre/.test(said()), "one line per event");
eq(btns().map((b) => b.title), ["Add all", "No thanks"], "two buttons: Add all, No thanks");
ok(lastOut().context && lastOut().context.message_id === "wamid.in" + n, "the card is a reply to her picture");
ok(pending().length === 1 && store.get(pending()[0]).ttl === 86400, "the proposal is kept under imgsched_<id> for 24 hours");
ok(evts().length === 0 && ![...store.keys()].some((k) => k.startsWith("act_")), "nothing is filed before she says yes");
ok(![...store.values()].some((e) => String(e.v).includes(MARK)), "the picture bytes are stored nowhere");
ok(!EMOJI.test(allSaid()) && !MODELNAME.test(allSaid().replace(/Modon|Mayfair/g, "")), "no emoji, no model name in what she sees");
ok(aiCalls.length === 1, "one vision call, and the old photo reader did not run on top");

console.log("Add all");
const addId = btns()[0].id;
outbound = [];
await tap(addId);
eq(said(), "Added 4 events to your plate.", "'Added 4 events to your plate.'");
const filed = evts();
eq(filed.map((e) => e.summary), POSTER.events.map((e) => e.title), "4 meetings stored, the way a typed meeting is (evt_ records)");
eq(filed[0].start_iso, dub(1) + "T10:30:00+04:00", "start time in Dubai time");
ok(filed[0].location === "Modon Sales Centre" && filed[0].source === "whatsapp" && filed[0].src.type === "captured", "place kept, source recorded");
ok(pending().length === 0, "the proposal is consumed");
const k1 = evts().length; outbound = [];
await tap(addId);
ok(/expired/.test(said()) && evts().length === k1, "a second tap on the same card files nothing");

console.log("duplicates");
schedAnswer = posterNow();
outbound = []; await wa({ type: "image", image: { id: "mid2b", mime_type: "image/jpeg" } });
const id2 = btns()[0].id; outbound = [];
await tap(id2);
eq([said(), evts().length], ["Those were already on your plate.", 4], "the same poster again: every event is skipped, nothing doubles");
schedAnswer = { kind: "schedule", events: posterNow().events.slice(0, 3).concat([{ title: "New thing", date: dub(5), time: "15:00", place: "", note: "" }]) };
outbound = []; await wa({ type: "image", image: { id: "mid2c", mime_type: "image/jpeg" } });
const id3 = btns()[0].id; outbound = [];
await tap(id3);
eq([said(), evts().length], ["Added 1 event to your plate. 3 were already there.", 5], "one new event among three known: only the new one is filed");

console.log("No thanks");
schedAnswer = posterNow(); store.clear(); outbound = [];
await wa({ type: "image", image: { id: "mid3", mime_type: "image/jpeg" } });
const idn = btns()[1].id; outbound = [];
await tap(idn);
eq([said(), evts().length, pending().length], ["Okay, not added.", 0, 0], "'Okay, not added.', nothing filed, proposal dropped");

console.log("expiry and the other sender");
outbound = []; await wa({ type: "image", image: { id: "mid4", mime_type: "image/jpeg" } });
const idx = btns()[0].id; store.delete(pending()[0]); outbound = [];
await tap(idx);
ok(/expired/.test(said()) && evts().length === 0, "once the 24 hours are gone the tap says so and files nothing");
outbound = []; await wa({ type: "image", image: { id: "mid5", mime_type: "image/jpeg" } });
const pk = pending()[0], pv = JSON.parse(store.get(pk).v); pv.from = "971500000000"; store.get(pk).v = JSON.stringify(pv);
const idy = btns()[0].id; outbound = [];
await tap(idy);
ok(/expired/.test(said()) && evts().length === 0, "a proposal belongs to its sender: another number's tap files nothing");

console.log("a caption that says schedule goes straight to extraction");
store.clear(); schedAnswer = { kind: "other", events: [] }; outbound = [];
await wa({ type: "image", image: { id: "mid6", mime_type: "image/jpeg", caption: "NEXT WEEK schedule" } });
eq(said(), "I could not find dates in that picture. Send the dates as text, or tell me what it is.", "captioned 'schedule' with nothing found: she is told so, plainly");
schedAnswer = "this is not json at all {{"; outbound = [];
await wa({ type: "image", image: { id: "mid7", mime_type: "image/jpeg", caption: "calendar" } });
ok(/could not find dates/.test(said()) && evts().length === 0, "garbage back from the reader is handled the same way");
schedAnswer = posterNow(); outbound = [];
await wa({ type: "image", image: { id: "mid8", mime_type: "image/jpeg", caption: "agenda" } });
ok(/^I found 4 events/.test(said()), "captioned 'agenda' with a poster: the card appears");

console.log("a picture that is not a schedule keeps the old behaviour");
store.clear(); outbound = []; aiCalls = [];
schedAnswer = { kind: "other", events: [] };
await wa({ type: "image", image: { id: "mid9", mime_type: "image/jpeg" } });
ok(aiCalls.length === 2 && /reading a photo or screenshot/.test(aiCalls[1]), "an uncaptioned selfie: the old reader runs next");
ok(/Nothing to file from it/.test(said()) && evts().length === 0 && pending().length === 0, "and she gets the old 'Nothing to file' answer");
schedAnswer = "garbage"; outbound = [];
await wa({ type: "image", image: { id: "mid10", mime_type: "image/jpeg" } });
ok(/Nothing to file from it/.test(said()), "an unreadable reply with no caption also falls back to the old behaviour");
schedAnswer = { kind: "other", events: [{ title: "Birthday cake", date: dub(2), time: null, place: "", note: "" }] }; outbound = [];
await wa({ type: "image", image: { id: "mid11", mime_type: "image/jpeg" } });
ok(/Nothing to file from it/.test(said()), "kind 'other' with a stray date is not treated as a schedule unless she captioned it");
readAnswer = { kind: "meeting", summary: "An invitation", meal: null, meeting: { title: "Board dinner", start_iso: dub(3) + "T19:00:00+04:00", location: "Dubai" }, tasks: [] };
schedAnswer = { kind: "other", events: [] }; outbound = [];
await wa({ type: "image", image: { id: "mid12", mime_type: "image/jpeg" } });
const pimg = btns().find((b) => /^pimg:/.test(b.id)); ok(!!pimg, "the single-meeting photo still offers its own Add card");
outbound = []; await tap(pimg.id);
ok(/Board dinner/.test(said()) && evts().length === 1, "and that card still files its meeting (through the shared filer)");

console.log(fail ? "FAILED " + fail + ", passed " + pass : "ALL " + pass + " PASSED");
process.exit(fail ? 1 : 0);
