// v147 - scene pictures in her chat, offline (13 Sep 2026): backdrop -> time of day -> her photo -> what the picture will be ->
// Change it -> Make it -> the minute tick makes it and sends both sizes. No network: WhatsApp, the image service and the
// renderer are stubbed, and every message she would see is captured and checked.
import worker from "../src/index.js";

const HER = "971565484397";
const store = new Map();
const KV = {
  async get(k) { return store.has(k) ? store.get(k) : null; },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; },
};
const sent = [], edits = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("graph.facebook.com")) {
    const b = JSON.parse(init.body);
    sent.push(b);
    return new Response(JSON.stringify({ messages: [{ id: "wamid.out" + sent.length }] }), { status: 200 });
  }
  if (u.includes("api.openai.com/v1/images/edits")) {
    const fd = init.body;
    const imgs = fd.getAll("image[]");
    edits.push({ prompt: fd.get("prompt"), n: imgs.length, first: imgs[0] ? await imgs[0].text() : "", second: imgs[1] ? await imgs[1].text() : "" });
    return new Response(JSON.stringify({ data: [{ b64_json: Buffer.alloc(30000, 7).toString("base64") }] }), { status: 200 });
  }
  if (u.includes("browser-rendering/screenshot")) return new Response(new Uint8Array(12000).fill(9), { status: 200 });
  return new Response("{}", { status: 200 });
};
const env = { MEETINGS: KV, READ_KEY: "RK", WA_FORWARD_TOKEN: "FWD", WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p",
  OPENAI_API_KEY: "o", CF_RENDER_TOKEN: "r", CF_ACCOUNT_ID: "a", MAILBOXES: "", ADD_TO: "", SCENE_PICTURES: "on", MINUTE_TICK: "on",
  PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const pending = [];
const ctx = { waitUntil(p) { pending.push(p); } };
let mid = 0;
const post = (message, e) => worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "X-Azimuth-Forward": "FWD", "Content-Type": "application/json" },
  body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [Object.assign({ from: HER, id: "wamid.in" + (++mid) }, message)] } }] }] }) }), e || env, ctx);
const tap = (id, e) => post({ type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: id } } }, e);
const say = (body, e) => post({ type: "text", text: { body } }, e);
const settle = async () => { while (pending.length) await pending.shift(); };

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const since = (i) => sent.slice(i);

// what the morning flow leaves behind: angle 4 and its backdrops, her usable photos
store.set("fbg_4", JSON.stringify({ n: "4", area: "", angle: { hook: "No metro for five kilometres, yet 6.6% gross yield.", figure: "5 km+", source: "RTA metro network coverage" },
  options: [{ id: "B", name: "Street level", note: "A real residential street, lived-in",
    place: "A residential street in Dubai at eye level - low-rise and mid-rise buildings, mature planting along the pavement, parked cars, a shaded walkway, ordinary and lived-in rather than promotional" }] }));
store.set("img_style_me_pool", JSON.stringify({ usable: ["style_ref_17", "style_ref_21", "style_ref_22"] }));
for (const k of ["style_ref_17", "style_ref_21", "style_ref_22"]) { store.set("img_" + k, "PHOTO:" + k); store.set("img_" + k + "_cut", "CUT:" + k); }

// 1. backdrop -> the time of day
let i = sent.length; await tap("fbg:4:B"); await settle();
let m = since(i);
ok(m.length === 1 && m[0].type === "interactive" && m[0].interactive.type === "list", "backdrop: one list comes back");
ok(m[0] && m[0].interactive.body.text === "What time of day?", "backdrop: asks 'What time of day?'");
const rows = m[0] ? m[0].interactive.action.sections[0].rows : [];
ok(rows.map(r => r.title).join("|") === "Early morning|Midday|Late afternoon|Sunset|Night", "time list: the five approved choices, in order");
ok(rows.map(r => r.description).join("|") === "Soft low sun, long gentle shadows|Bright sun, clear sky|Warm golden light|Golden glow, sun low behind|Lights on, deep blue sky", "time list: the approved notes");
ok(rows[3] && rows[3].id === "stm:4:B:ss", "time list: Sunset carries stm:4:B:ss");

// 2. time of day -> which photo of her
i = sent.length; await tap("stm:4:B:ss"); await settle();
m = since(i);
ok(m.filter(x => x.type === "image").length === 3, "time: three photos of her offered");
const ask = m.find(x => x.type === "interactive");
ok(ask && ask.interactive.body.text === "Good pick - Street level at sunset. Which photo of you for this one?", "time: 'Good pick - Street level at sunset. Which photo of you for this one?'");
const mp = ask ? ask.interactive.action.buttons.map(b => b.reply.id) : [];
ok(mp.length === 3 && mp.every(id => /^mp:[a-z0-9]+:\d$/i.test(id)), "time: three photo buttons");

// 3. her photo -> what the picture will be
i = sent.length; await tap(mp[1]); await settle();
m = since(i);
const show = m.find(x => x.type === "interactive");
const txt = show ? show.interactive.body.text : "";
ok(m.length === 1 && show, "photo: one message with buttons, nothing made yet");
ok(txt === "Here's the picture I'll make:\n\nYou, walking along the pavement towards the camera. Behind you: a residential street in Dubai, low-rise and mid-rise buildings, mature planting along the pavement, parked cars, a shaded walkway. Sunset, a warm golden glow. Your face, hair and outfit exactly as in your photo.", "photo: the approved description, word for word");
ok(!/first picture|second picture|cream|gpt|openai|chatgpt/i.test(txt), "photo: nothing about reference pictures, the layout or the image service");
const btn = show ? show.interactive.action.buttons.map(b => b.reply) : [];
ok(btn.length === 2 && btn[0].title === "✅ Make it" && btn[1].title === "✏️ Change it", "photo: Make it / Change it");
const tok = btn[0] ? btn[0].id.slice(3) : "";
ok(btn[1] && btn[1].id === "sx:" + tok, "photo: both buttons carry the same picture");
ok(edits.length === 0 && ![...store.keys()].some(k => k.startsWith("picjob_")), "photo: no picture made and no job before Make it");

// 4. Change it -> her line -> shown again with her change
i = sent.length; await tap("sx:" + tok); await settle();
m = since(i);
ok(m.length === 1 && m[0].text && m[0].text.body === "Tell me what to change, in a line.", "change: 'Tell me what to change, in a line.'");
i = sent.length; await say("put the Burj Khalifa behind me"); await settle();
m = since(i);
const again = m.find(x => x.type === "interactive");
ok(m.length === 1 && again && again.interactive.body.text.endsWith("\n\nYour change: put the Burj Khalifa behind me"), "change: the description comes back with her change added");
ok(again && again.interactive.action.buttons[0].reply.id === "sk:" + tok, "change: same picture, same Make it");
ok(!store.has("scedit_" + HER), "change: her next message is not taken as another change");

// 5. Make it -> a job on record, one acknowledgement, a second tap does nothing
i = sent.length; await tap("sk:" + tok); await settle();
m = since(i);
ok(m.length === 1 && m[0].text && m[0].text.body === "Making your picture now, give me a minute.", "make: 'Making your picture now, give me a minute.'");
const jk = "picjob_s" + tok;
const job = store.has(jk) ? JSON.parse(store.get(jk)) : null;
ok(job && job.scene === true && job.meKey === "style_ref_21" && job.tid === "ss" && job.extra[0] === "put the Burj Khalifa behind me", "make: scene job recorded with her photo, sunset and her change");
ok(!store.has("scpend_" + tok), "make: the pending picture is used up");
i = sent.length; await tap("sk:" + tok); await settle();
ok(since(i).length === 0, "make: a second tap while it is being made sends nothing");
ok(edits.length === 0, "make: nothing generated inside the webhook");

// 6. the minute tick makes it: her photo first, the layout second, her change in the prompt; both sizes to her; the job cleared
i = sent.length;
await worker.scheduled({ cron: "* * * * *", scheduledTime: Date.now() }, env, ctx); await settle();
m = since(i);
ok(edits.length === 1 && edits[0].n === 2, "tick: one image edit with two pictures");
ok(edits[0] && edits[0].first === "PHOTO:style_ref_21", "tick: her own photo goes first");
ok(edits[0] && /^Make a realistic photograph of the woman in the first picture/.test(edits[0].prompt) && edits[0].prompt.includes("Change: Put the Burj Khalifa behind me."), "tick: prompt keeps her face from the first picture and carries her change");
const imgs = m.filter(x => x.type === "image");
ok(imgs.length === 2 && imgs.every(x => x.to === HER), "tick: two pictures to her");
ok(imgs[0] && imgs[0].image.caption.startsWith("No metro for five kilometres") && /_card\d+$/.test(imgs[0].image.link), "tick: square first, with the angle as caption");
ok(imgs[1] && imgs[1].image.caption === "Same picture at 1080×1920 for Stories." && /_card\d+_s$/.test(imgs[1].image.link), "tick: then the story size");
ok(!store.has(jk), "tick: job cleared once sent");
i = sent.length;
await worker.scheduled({ cron: "* * * * *", scheduledTime: Date.now() }, env, ctx); await settle();
ok(since(i).length === 0 && edits.length === 1, "tick: the next minute makes nothing twice");

// 7. switched off: the backdrop goes straight to her photos, as before
const off = Object.assign({}, env, { SCENE_PICTURES: "" });
i = sent.length; await tap("fbg:4:B", off); await settle();
m = since(i);
ok(!m.some(x => x.interactive && x.interactive.body && x.interactive.body.text === "What time of day?") && m.filter(x => x.type === "image").length === 3, "off: no time-of-day step, the old photo offer");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
