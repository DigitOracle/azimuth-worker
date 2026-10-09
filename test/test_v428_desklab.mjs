// v428 - THE DESK LAB through deskHandle (the real desk entry point), offline. Every send goes to the owner from the desk number only.
//   node test/test_v428_desklab.mjs
import { deskHandle } from "../src/desk.js";
import { listPayload, ctaPayload, locationRequestPayload, carouselPayload, typingPayload } from "../src/desk_lab.js";

const OWNER = "971562276093", STRANGER = "971500001234", NAJ = "971565484397", PID = "1370146096179819";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const raws = [], texts = [], images = [], fetches = []; let refuse = null;
globalThis.fetch = async (u, init) => { fetches.push({ u: String(u), method: (init && init.method) || "GET" });
  if (/message_qrdls/.test(String(u))) return new Response(JSON.stringify({ code: "ABC", prefilled_message: "x", deep_link_url: "https://wa.me/message/ABC", qr_image_url: "https://scontent/qr.png" }));
  if (/whatsapp_business_profile/.test(String(u))) return new Response(JSON.stringify({ data: [{ about: "DigitAlchemy desk", websites: ["https://digitalabbot.io"], vertical: "PROF_SERVICES" }] }));
  return new Response("{}"); };
const lab = { owner: OWNER, pid: PID, graph: "https://graph.facebook.com/v21.0",
  raw: async (e, p, k) => { raws.push(p); return refuse && refuse === k ? { error: { message: "(#131009) Parameter value is not valid" } } : { messages: [{ id: "wamid.X" }] }; },
  send: async (e, t) => texts.push(t), image: async (e, link, cap) => images.push({ link, cap }),
  origin: () => "https://azimuth-2.digitalchemy.workers.dev", sleep: async () => {}, briefLink: () => "https://x/brief?k" };
const env = { MEETINGS: KV, WA_DESK_PHONE_ID: PID, WA_DESK_OWNER: OWNER, WHATSAPP_TOKEN: "T" };
const post = { send: async () => {}, buttons: async () => {}, image: async () => {}, llm: async () => "", fetchMedia: async () => ({}), origin: () => "", now: () => Date.now(), sleep: async () => {} };
const deps = { waSend: async (e, to, t) => texts.push("[waSend to " + to + "] " + t), post, lab };
let mid = 0;
const body = (from, m) => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: PID }, messages: [Object.assign({ from, id: "wamid.in" + ++mid }, m)] } }] }] });
const say = async (t, from) => { raws.length = 0; texts.length = 0; images.length = 0; await deskHandle(env, body(from || OWNER, { type: "text", text: { body: t } }), deps); };
store.set("wa_desk_seen", "1");

await say("lab");
ok(/Desk lab/.test(texts[0]) && /lab carousel/.test(texts[0]) && /brief/.test(texts[0]), "lab lists every feature");
await say("lab list");
ok(raws[0] && raws[0].to === OWNER && raws[0].interactive.type === "list" && raws[0].interactive.action.sections[0].rows.length === 4 && raws[0].interactive.action.sections[0].rows.every((r) => r.title.length <= 24), "lab list sends a list menu of 4 rows, titles within 24 characters", JSON.stringify(raws[0]));
texts.length = 0; await deskHandle(env, body(OWNER, { type: "interactive", interactive: { type: "list_reply", list_reply: { id: "lab:site", title: "You on site" } } }), deps);
ok(/You picked: You on site/.test(texts[0]), "a picked row is answered");
await say("lab link");
ok(raws[0].interactive.type === "cta_url" && /\/brief$/.test(raws[0].interactive.action.parameters.url) && raws[0].interactive.action.parameters.display_text.length <= 20, "lab link sends a link button");
await say("lab location");
ok(raws[0].interactive.type === "location_request_message" && store.has("desk_lab_loc"), "lab location asks for a location and remembers it asked");
texts.length = 0; await deskHandle(env, body(OWNER, { type: "location", location: { latitude: 25.1859, longitude: 55.2917, name: "Business Bay" } }), deps);
ok(/Got your location: 25\.18590, 55\.29170 \(Business Bay\)/.test(texts[0]) && !store.has("desk_lab_loc"), "the shared location is answered once");
await say("lab typing");
ok(raws[0].status === "read" && raws[0].typing_indicator.type === "text" && /^wamid\.in/.test(raws[0].message_id) && /typing/.test(texts[0]), "lab typing marks his message read with typing, then answers");
// carousel: needs 2 stored pictures
await say("lab carousel");
ok(raws.length === 0 && /needs at least 2 stored pictures/.test(texts[0]), "the carousel refuses politely without pictures");
store.set("postplan_index", JSON.stringify(["p1"])); store.set("postplan_p1", JSON.stringify({ slides: [{ img_key: "aaa" }, { img_key: "bbb" }, { img_key: "ccc" }] }));
await say("lab carousel");
const car = raws[0];
ok(car && car.interactive.type === "carousel" && car.interactive.action.cards.length === 3 && car.interactive.action.cards[0].header.image.link === "https://azimuth-2.digitalchemy.workers.dev/ig_media/aaa", "lab carousel sends 3 cards with the stored pictures", JSON.stringify(car));
refuse = "lab-carousel"; await say("lab carousel"); refuse = null;
ok(/The carousel was refused\. Meta said: \(#131009\)/.test(texts[0]), "a refusal comes back with Meta's own words", texts[0]);
await say("lab qr");
ok(images[0] && images[0].link === "https://scontent/qr.png" && /wa\.me\/message\/ABC/.test(images[0].cap) && JSON.parse(store.get("desk_lab_qr")).code === "ABC", "lab qr makes the code, sends the picture and keeps the link");
ok(fetches.some((f) => /\/1370146096179819\/message_qrdls\?prefilled_message=Send%20me%20the%20digital%20footprint%20demo&generate_qr_image=PNG/.test(f.u) && f.method === "POST"), "the QR is made for the desk number with the message pre-typed");
await say("lab profile");
ok(/About: DigitAlchemy desk/.test(texts[0]) && /Websites: https:\/\/digitalabbot\.io/.test(texts[0]), "lab profile reads the business profile");
// v430 - form setup from the desk: dry run, then go
await say("lab setup brief 1588773749592854");
ok(/Dry run/.test(texts[0]) && !store.has("wa_flow_brief_id"), "setup without go is a dry run and creates nothing");
const f0 = globalThis.fetch;
// a fake Meta: flows list, create, assets upload, publish, status
const meta = { flows: [], published: new Set(), createErrs: [], publishOk: true, calls: [] };
globalThis.fetch = async (u, init) => { const s = String(u), mth = (init && init.method) || "GET"; meta.calls.push(mth + " " + s.replace("https://graph.facebook.com/v21.0", ""));
  if (/\/1588773749592854\/flows\?fields=/.test(s)) return new Response(JSON.stringify({ data: meta.flows }));
  if (/\/1588773749592854\/flows$/.test(s) && mth === "POST") { const f = { id: "777", name: init.body.get("name"), status: "DRAFT" }; meta.flows.push(f); return new Response(JSON.stringify({ id: "777", validation_errors: meta.createErrs })); }
  if (/\/777\/assets$/.test(s)) return new Response(JSON.stringify({ success: true, validation_errors: [] }));
  if (/\/777\/publish$/.test(s)) { if (meta.publishOk) { meta.flows[0].status = "PUBLISHED"; return new Response(JSON.stringify({ success: true })); } return new Response(JSON.stringify({ error: { message: "Publishing attempt failed" } }), { status: 400 }); }
  if (/\/777\?fields=/.test(s)) return new Response(JSON.stringify({ status: "DRAFT", validation_errors: [{ error_type: "INVALID_PROPERTY_VALUE", message: "label is too long", pointers: [{ path: "screens[1].layout.children[2].label", line_start: 40 }] }] }));
  return f0(u, init); };
// 1. Meta finds problems on create: saved as draft, problems listed, not published, nothing stored
meta.createErrs = [{ error_type: "INVALID_PROPERTY_VALUE", message: "label is too long", pointers: [{ path: "screens[0].layout.children[1].label" }] }];
await say("lab setup brief 1588773749592854 go");
ok(!store.has("wa_flow_brief_id") && /saved as a draft \(id 777\) but Meta found problems/.test(texts[0]) && /label is too long \(screens\[0\]/.test(texts[0]) && !meta.calls.some((c) => /publish$/.test(c)), "create with problems: draft kept, problems listed with where they are, not published", texts[0]);
// 2. the next try reuses the draft (no second create), uploads the fixed JSON, publishes, stores
meta.createErrs = []; meta.calls.length = 0;
await say("lab setup brief 1588773749592854 go");
ok(store.get("wa_flow_brief_id") === "777" && meta.calls.some((c) => /^POST \/777\/assets$/.test(c)) && !meta.calls.some((c) => /^POST \/1588773749592854\/flows$/.test(c)) && /Form published and stored \(id 777\)/.test(texts[0]), "the retry reuses the draft, uploads, publishes and stores", meta.calls.join(" | "));
// 3. already published: just stored
store.delete("wa_flow_brief_id"); await say("lab setup brief 1588773749592854 go");
ok(store.get("wa_flow_brief_id") === "777" && /already published/.test(texts[0]), "an already published form is simply stored");
// 4. publish refused: the detailed problems are fetched and reported
meta.flows = []; meta.publishOk = false; store.delete("wa_flow_brief_id");
await say("lab setup brief 1588773749592854 go");
ok(!store.has("wa_flow_brief_id") && /did not publish the form \(draft 777\)\. Meta said: Publishing attempt failed/.test(texts[0]) && /label is too long \(screens\[1\]\.layout\.children\[2\]\.label, line 40\)/.test(texts[0]) && /Status: DRAFT/.test(texts[0]), "a refused publish reports Meta's itemised problems", texts[0]);
globalThis.fetch = f0;
await say("lab nonsense");
ok(/Unknown lab command/.test(texts[0]), "an unknown lab command shows the menu");

// strangers and Najjuko never reach the lab
await say("lab list", STRANGER);
ok(raws.length === 0 && texts.length === 0, "a stranger on the desk gets nothing");
await say("lab list", NAJ);
ok(raws.length === 0 && texts.length === 0, "Najjuko writing to the desk gets nothing either");
// every lab payload is addressed to the owner
ok([listPayload(OWNER, "b", "x", [{ id: 1, title: "t" }]), ctaPayload(OWNER, "b", "l", "https://u"), locationRequestPayload(OWNER, "b"), carouselPayload(OWNER, "b", [{ image: "i", text: "t", label: "l", url: "u" }, { image: "i", text: "t", label: "l", url: "u" }])].every((p) => p.to === OWNER) && !("to" in typingPayload("m")), "every lab message is addressed to the owner");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
