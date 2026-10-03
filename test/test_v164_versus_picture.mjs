// v164 - THE VERSUS PICTURE, MADE THE WAY THE MORNING PICTURES ARE MADE (Kendall, 17 Sep 2026).
//
// Three faults are being held shut here, and the third is the one that could have reached the public.
//   1. the tap SPENT. One tap on the Versus page bought an image on the spot, with no way to steer it and no way to stop it.
//   2. the MODEL was hard-coded to the old one, so the morning pictures moved to SCENE_MODEL on 13 Sep and this one did not.
//   3. the PRICES were drawn BY THE IMAGE SERVICE. Image models garble digits. A wrong Monaco price could have gone up on a
//      public post under her name, and the approve-from-WhatsApp step would not have caught it, because she would have been
//      approving a number she had no reason to doubt.
//
// Driven through the real worker, end to end, from her tap on the page to the post waiting for her approval.
import worker from "../src/index.js";
import { worldCardFields } from "../src/world_pic.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const HER = "971565484397", READ = "read_key_for_the_owner_0123";
const store = new Map();
const KV = {
  async get(k, type) { const v = store.has(k) ? store.get(k) : null; return type === "arrayBuffer" && typeof v === "string" ? new TextEncoder().encode(v).buffer : v; },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })), list_complete: true }; } };
const sent = [];
const imgCalls = [];          // every call to the image service, with the model and prompt it was given
let renderCalls = 0;
const png = Buffer.alloc(40000, 9).toString("base64");
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("api.openai.com/v1/images/")) {
    const b = init.body && init.body.get ? { model: init.body.get("model"), prompt: init.body.get("prompt"), size: init.body.get("size"), quality: init.body.get("quality") } : JSON.parse(init.body);
    imgCalls.push(Object.assign({ endpoint: u.split("/images/")[1] }, b));
    return new Response(JSON.stringify({ data: [{ b64_json: png }] }));
  }
  if (u.includes("browser-rendering/screenshot")) { renderCalls++; return new Response(Buffer.from(png, "base64")); }
  if (u.includes("graph.instagram.com")) return new Response(JSON.stringify({ id: "X", status_code: "FINISHED" }));
  if (u.includes("graph.facebook.com")) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ messages: [{ id: "wamid.o" + sent.length }] })); }
  return new Response("{}");
};
const env = { MEETINGS: KV, READ_KEY: READ, WA_FORWARD_TOKEN: "FWD", WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p",
  OPENAI_API_KEY: "oai", SCENE_MODEL: "gpt-image-2.5-sunburst", SCENE_QUALITY: "high", SCENE_PICTURES: "on",
  CF_RENDER_TOKEN: "rtok", CF_ACCOUNT_ID: "acct", IG_APP_ID: "IGAPP", IG_APP_SECRET: "s",
  MAILBOXES: "", ADD_TO: "", AI: { async run() { return { response: "{}" }; } }, PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const ctx = { waitUntil(p) { return p; } };
let mid = 0;
const hit = (m) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev/wa", { method: "POST", headers: { "X-Azimuth-Forward": "FWD", "Content-Type": "application/json" },
  body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [Object.assign({ from: HER, id: "wamid.in" + (++mid) }, m)] } }] }] }) }), env, ctx);
const tap = (id) => hit({ type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: id } } });
const pick = (id) => hit({ type: "interactive", interactive: { type: "list_reply", list_reply: { id, title: id } } });
const say = (t) => hit({ type: "text", text: { body: t } });
const postJ = (path, b) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }), env, ctx);
const texts = () => sent.filter(m => m.type === "text").map(m => m.text.body);
const buttons = () => sent.filter(m => m.type === "interactive" && m.interactive.type === "button").map(m => m.interactive.action.buttons.map(b => b.reply.id));
const rows = () => sent.filter(m => m.type === "interactive" && m.interactive.type === "list").map(m => m.interactive.action.sections[0].rows.map(r => r.id));
const reset = () => { sent.length = 0; imgCalls.length = 0; renderCalls = 0; };

// ---------------------------------------------------------------- 1. the tap spends nothing
reset();
let r = await postJ("/versus/picture", { key: READ, city: "monaco" });
let j = JSON.parse(await r.text());
ok(r.status === 200 && j.asked === true && imgCalls.length === 0 && buttons()[0].join() === "vsp:monaco:me,vsp:monaco:plate",
  "the tap on the page buys nothing: it asks her which shape she wants, her in it or just the two cities");

// ---------------------------------------------------------------- 2. just the two cities: time of day, then the preview
reset();
await tap("vsp:monaco:plate");
ok(rows()[0].join() === "vst:monaco:P:em,vst:monaco:P:md,vst:monaco:P:la,vst:monaco:P:ss,vst:monaco:P:nt" && imgCalls.length === 0,
  "the split frame asks the same five times of day the morning asks, and still spends nothing");
reset();
await pick("vst:monaco:P:ss");
const prevText = sent.find(m => m.type === "interactive").interactive.body.text;
ok(/Here's the picture I'll make/.test(prevText) && /Dubai on the left, Monaco on the right/.test(prevText) && /Sunset/.test(prevText)
  && /I draw the prices myself/.test(prevText) && buttons()[0].map(x => x.split(":")[0]).join() === "sk,sx" && imgCalls.length === 0,
  "she is shown the picture in plain English, told we draw the prices, and given Make it / Change it - still nothing bought");

// ---------------------------------------------------------------- 3. Change it: her line is carried, and still nothing is bought
const tok = buttons()[0][0].split(":")[1];
reset();
await tap("sx:" + tok);
await say("put a boat in the Monaco half");
const prev2 = sent.find(m => m.type === "interactive" && m.interactive.type === "button").interactive.body.text;
ok(/Tell me what to change/.test(texts()[0]) && /Your change: put a boat in the Monaco half/.test(prev2) && imgCalls.length === 0,
  "Change it takes her line, shows the picture again with it on, and buys nothing - she can change it as often as she likes");

// ---------------------------------------------------------------- 4. Make it: one image, on the morning's model, carrying no digit
const tok2 = sent.find(m => m.type === "interactive" && m.interactive.type === "button").interactive.action.buttons[0].reply.id.split(":")[1];
reset();
await tap("sk:" + tok2);
const jk = [...store.keys()].find(k => k.startsWith("picjob_s"));
ok(jk && JSON.parse(store.get(jk)).versus === "monaco" && JSON.parse(store.get(jk)).mode === "plate" && imgCalls.length === 0,
  "Make it puts the job on record first and answers her, so a slow image can never lose the picture she asked for");
// run the job through /pic_resume - the same entry point the minute tick uses - and inspect what the image service was handed
const resume = () => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev/pic_resume?key=" + READ + "&min_age=30"), env, ctx).then(x => x.json());
reset();
let out = await resume();
const gen = imgCalls.filter(c => c.endpoint === "generations");
ok(out.checked === 1 && gen.length === 1 && gen[0].model === "gpt-image-2.5-sunburst" && gen[0].size === "1024x1024" && gen[0].quality === "high",
  "the picture is made on SCENE_MODEL - the same model the morning pictures use - and never on the hard-coded old one");
ok(!/\d/.test(gen[0].prompt) && /no numbers/i.test(gen[0].prompt) && !/AED/.test(gen[0].prompt) && /put a boat in the Monaco half/i.test(gen[0].prompt),
  "THE ONE THAT MATTERS: the prompt carries her change but not one digit, so no price can be drawn wrong into a picture she publishes");

// ---------------------------------------------------------------- 5. the figures are ours, set in type, and the post waits for her
const cardCalls = renderCalls;
const pend = [...store.keys()].filter(k => k.startsWith("igpost_"));
const pendRec = pend.length ? JSON.parse(store.get(pend[0])) : null;
const cap = sent.find(m => m.type === "image");
ok(cardCalls >= 1 && pend.length === 1 && pendRec && /\/img\//.test(pendRec.url) && !store.has(jk),
  "the wordless picture goes through the card engine, the finished post is held for her tap, and the job clears itself");
ok(cap && /Dubai versus Monaco/.test(cap.image.caption) && /Caption as it would go up/.test(cap.image.caption)
  && buttons().some(b => b.map(x => x.split(":")[2]).join() === "yes,cap,no"),
  "it arrives as a post awaiting her approval, never as something already on Instagram");
const cf = worldCardFields("monaco");
ok(cf.figure === "AED 4,260 vs AED 22,790" && /Savills Monaco spotlight/.test(cf.source),
  "and the two prices the card sets in type are the fact base's own, with Monaco credited to its spotlight rather than an index it is not in");

// ---------------------------------------------------------------- 6. her in it: the backdrop question, then her photo
reset();
store.set("img_style_me_pool", JSON.stringify({ usable: ["me_a", "me_b", "me_c"] }));
store.set("img_me_a", "photo-a"); store.set("img_ct_me_a", "image/jpeg");
await postJ("/versus/picture", { key: READ, city: "london" });
await tap("vsp:london:me");
ok(rows()[0].join() === "vsb:london:A,vsb:london:B,vsb:london:C,vsb:london:D,vsb:london:E,vsb:london:F" && imgCalls.length === 0,
  "put me in it asks where she is standing first - six Dubai backdrops, the way the morning offers its eight");
reset();
await pick("vsb:london:B");
ok(rows()[0].join() === "vst:london:B:em,vst:london:B:md,vst:london:B:la,vst:london:B:ss,vst:london:B:nt", "then the time of day, on the chosen backdrop");
reset();
await pick("vst:london:B:la");
const mpIds = rows()[0] || [];
ok(mpIds.slice(0, 3).map(x => x.split(":")[0]).join() === "mp,mp,mp" && sent.filter(m => m.type === "image").length >= 3 && imgCalls.length === 0,
  "then which photo of her - three to choose from, rotated by the same pool the morning uses, and still nothing bought");

reset();
await tap(mpIds[0]);
const prev3 = sent.find(m => m.type === "interactive" && m.interactive.type === "button").interactive.body.text;
ok(/You, standing in Downtown Dubai/.test(prev3) && /Late afternoon/.test(prev3) && /DUBAI vs LONDON/.test(prev3) && imgCalls.length === 0,
  "and only then the preview, naming the backdrop she chose and the hour she chose, with nothing bought yet");

const tok3 = sent.find(m => m.type === "interactive").interactive.action.buttons[0].reply.id.split(":")[1];
reset();
await tap("sk:" + tok3);
out = await resume();
const g2 = imgCalls.filter(c => c.endpoint === "generations"), e2 = imgCalls.filter(c => c.endpoint === "edits");
ok(g2.length === 1 && g2[0].size === "1024x1536" && /empty of people/.test(g2[0].prompt) && !/\d/.test(g2[0].prompt.replace(/1024x1536/g, "")),
  "her shape makes the backdrop tall and empty of people first, and that prompt carries no digit either");
ok(e2.length === 1 && e2[0].model === "gpt-image-2.5-sunburst" && /reference photo/.test(e2[0].prompt) && !/\d/.test(String(e2[0].prompt)),
  "then she is placed into it on the same model, through the morning's own person-placement words, with no digit in that prompt either");
ok([...store.keys()].filter(k => k.startsWith("igpost_")).length === 2, "and the London post joins the Monaco one, both waiting for her tap");

// ---------------------------------------------------------------- 7. a half-made picture is never bought twice
const jk2 = [...store.keys()].find(k => k.startsWith("picjob_s"));
ok(!jk2, "a finished job clears itself, so no tick can buy the same picture a second time");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
