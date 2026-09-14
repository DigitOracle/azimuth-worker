// v151 - the time of day for every feed format with a picture, offline (14 Sep 2026). Kendall: "the time of day is only asking in
// picture with you, not the other options". Taps go through the real webhook; WhatsApp, the drafting service and the renderer are
// stubbed; every message she would see, and every drafting request, is captured and checked.
import worker from "../src/index.js";

const HER = "971565484397";
const store = new Map();
const KV = {
  async get(k) { return store.has(k) ? store.get(k) : null; },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; },
};
const sent = [], drafts = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("graph.facebook.com")) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ messages: [{ id: "wamid.out" + sent.length }] }), { status: 200 }); }
  if (u.includes("api.anthropic.com/v1/messages")) {
    drafts.push(String(init.body));
    return new Response(JSON.stringify({ content: [{ type: "text", text: "SCRIPT: Five kilometres from the nearest metro, and still a 6.6% gross yield.\nCAPTION: 6.6% gross yield - DLD rental registrations to 13 Sep 2026.\nWould you trade the metro for the yield?\n#DubaiRealEstate" }] }), { status: 200 });
  }
  if (u.includes("browser-rendering/screenshot")) return new Response(new Uint8Array(12000).fill(9), { status: 200 });
  return new Response("{}", { status: 200 });
};
const env = { MEETINGS: KV, READ_KEY: "RK", WA_FORWARD_TOKEN: "FWD", WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", MAILBOXES: "", ADD_TO: "",
  ANTHROPIC_API_KEY: "a", CF_RENDER_TOKEN: "r", CF_ACCOUNT_ID: "c", SCENE_PICTURES: "on", MINUTE_TICK: "on", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const pending = [];
const ctx = { waitUntil(p) { pending.push(p); } };
const settle = async () => { while (pending.length) await pending.shift(); };
let mid = 0;
const tap = async (id, e) => {
  await worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "X-Azimuth-Forward": "FWD", "Content-Type": "application/json" },
    body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [{ from: HER, id: "wamid.in" + (++mid), type: "interactive", interactive: { type: "list_reply", list_reply: { id, title: id } } }] } }] }] }) }), e || env, ctx);
  await settle();
};
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const texts = (ms) => ms.filter(x => x.type === "text").map(x => x.text.body);

store.set("mkt_briefctx", JSON.stringify({ at: Date.now(), brief: "Weekly brief.", data: "6.6% gross yield (DLD rental registrations to 13 Sep 2026); 5 km+ to the nearest metro (RTA).",
  angles: [{ hook: "A", figure: "1", source: "S" }, { hook: "B", figure: "2", source: "S" }, { hook: "Rents held in JVC.", figure: "7.1%", source: "DLD rental registrations" },
    { hook: "No metro for five kilometres, yet 6.6% gross yield.", figure: "5 km+", source: "RTA metro network coverage; DLD rental registrations to 13 Sep 2026", family: "city_life" }] }));

const TITLES = "Early morning|Midday|Late afternoon|Sunset|Night";
const NOTES = "Soft low sun, long gentle shadows|Bright sun, clear sky|Warm golden light|Golden glow, sun low behind|Lights on, deep blue sky";

// 1. Instagram: the time of day first, nothing drafted yet
let i = sent.length, d = drafts.length;
await tap("mkt:ig:4");
let m = sent.slice(i);
const list = m[0] && m[0].interactive;
ok(m.length === 1 && list && list.type === "list" && list.body.text === "What time of day?" && list.action.button === "Time of day", "Instagram: asks 'What time of day?' first, as Picture with you does");
const rows = list ? list.action.sections[0].rows : [];
ok(rows.map(r => r.title).join("|") === TITLES && rows.map(r => r.description).join("|") === NOTES, "Instagram: the same five approved choices and notes");
ok(rows.map(r => r.id).join("|") === "mtd:ig:4:em|mtd:ig:4:md|mtd:ig:4:la|mtd:ig:4:ss|mtd:ig:4:nt", "Instagram: each choice carries the format and the angle");
ok(drafts.length === d, "Instagram: nothing drafted before she picks");

// 2. she picks Sunset: the draft, the cards, and the cover-plate prompt lit for sunset
i = sent.length; d = drafts.length;
await tap("mtd:ig:4:ss");
m = sent.slice(i);
const t2 = texts(m);
ok(drafts.length === d + 1 && t2.some(x => x.startsWith("📸 Instagram package — Angle 4")), "Sunset: the Instagram package is drafted");
ok(m.filter(x => x.type === "image").length === 2, "Sunset: both cards still come");
const plate = t2.find(x => x.includes("Cover plate")) || "";
ok(plate.includes("Sunset: the sun just above the horizon on the RIGHT of frame"), "Sunset: the cover-plate prompt is lit for sunset");
ok(!/Blue hour, twenty minutes|Bright clear morning, about eight|Soft overcast afternoon|Late afternoon, about an hour before sunset: warm low sun coming/.test(plate), "Sunset: none of the rotating lights is left in it");

// 3. carousel at night: the plate prompt and the cover prompt both at night
i = sent.length;
await tap("mkt:car:4");
ok(sent.slice(i).length === 1 && sent[i].interactive && sent[i].interactive.body.text === "What time of day?", "Carousel: asks the time of day");
i = sent.length;
await tap("mtd:car:4:nt");
const t3 = texts(sent.slice(i));
ok(t3.some(x => x.startsWith("🎠 LinkedIn carousel — Angle 4")), "Night: the carousel is drafted");
ok((t3.find(x => x.includes("Cover plate")) || "").includes("Night: a deep blue sky, warm street lamps and lit windows"), "Night: the cover plate is lit for night");
const cover = t3.find(x => x.includes("Cover-image prompt")) || "";
ok(cover.includes("standing on a Dubai balcony at night, the city lights glowing") && cover.includes("warm evening light from lamps and lit windows") && !cover.includes("golden-hour"), "Night: the magazine-cover prompt is set at night, not golden hour");

// 4. article: asks, and its cover prompt follows the answer
i = sent.length;
await tap("mkt:art:4");
ok(sent.slice(i).length === 1 && sent[i].interactive && sent[i].interactive.action.sections[0].rows[0].id === "mtd:art:4:em", "Article: asks the time of day");
i = sent.length;
await tap("mtd:art:4:md");
ok(texts(sent.slice(i)).some(x => x.includes("Cover-image prompt") && x.includes("bright midday light softened by open shade")), "Midday: the article's cover prompt is lit for midday");

// 5. the video prompt: her time of day replaces the fixed late-afternoon light in what it asks for
i = sent.length;
await tap("mkt:vid:4");
ok(sent.slice(i).length === 1 && sent[i].interactive && sent[i].interactive.body.text === "What time of day?", "Video prompt: asks the time of day");
d = drafts.length;
await tap("mtd:vid:4:em");
ok(drafts.length === d + 1 && drafts[d].includes("STYLE: soft early-morning light") && !drafts[d].includes("warm late-afternoon light"), "Early morning: the video prompt is written for early-morning light");

// 6. LinkedIn post, two angles at once: asked once, then both drafted
i = sent.length;
await tap("mkt:li:3+4");
ok(sent.slice(i).length === 1 && sent[i].interactive && sent[i].interactive.action.sections[0].rows[3].id === "mtd:li:3+4:ss", "LinkedIn post, two angles: asked once, for both");
i = sent.length;
await tap("mtd:li:3+4:la");
const t6 = texts(sent.slice(i));
ok(t6.filter(x => /^✍️ LinkedIn post — Angle [34]/.test(x)).length === 2 && t6.filter(x => x.includes("Late afternoon, about an hour before sunset: warm golden sun low on the RIGHT")).length === 2, "Late afternoon: both posts drafted, both plates lit for it");

// 7. no picture, no question: the podcast script and the questions go straight to the draft
i = sent.length; d = drafts.length;
await tap("mkt:pod:4");
ok(!sent.slice(i).some(x => x.interactive && x.interactive.body && x.interactive.body.text === "What time of day?") && drafts.length === d + 1 && texts(sent.slice(i)).some(x => x.startsWith("🎙 Podcast script — Angle 4")), "Podcast script: no time question, drafted straight away");
i = sent.length; d = drafts.length;
await tap("mkt:q:4");
ok(!sent.slice(i).some(x => x.interactive && x.interactive.body && x.interactive.body.text === "What time of day?") && drafts.length === d + 1, "Questions for the room: no time question");
i = sent.length; d = drafts.length;
await tap("mtd:pod:4:ss");
ok(drafts.length === d, "a time choice for a format without a picture does nothing");

// 8. switched off: Instagram drafts straight away with the rotating light, as before
const off = Object.assign({}, env, { SCENE_PICTURES: "" });
i = sent.length;
await tap("mkt:ig:4", off);
const t8 = texts(sent.slice(i));
ok(!sent.slice(i).some(x => x.interactive && x.interactive.body && x.interactive.body.text === "What time of day?") && t8.some(x => x.startsWith("📸 Instagram package — Angle 4")), "off: no time question, the draft straight away");
ok(/Late afternoon, about an hour before sunset: warm low sun coming|Blue hour, twenty minutes|Bright clear morning, about eight|Soft overcast afternoon/.test(t8.find(x => x.includes("Cover plate")) || ""), "off: the plate keeps its rotating light");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
