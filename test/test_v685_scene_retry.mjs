// v685 - scene picture retries (1 Nov 2026: angles 2 and 3 of the morning feed gave up after three tries inside five minutes,
// "render exception: Navigation timeout of 25000 ms exceeded"). Offline: WhatsApp, the image service, the renderer and the owner
// note are stubbed. Checks: a failed try waits before the next one, a feed job gets six tries, at most two scene jobs make at once,
// a made picture whose card never renders is still sent (with the caption), and on a give-up Kendall is told and Naj is not.
import worker from "../src/index.js";

const HER = "971565484397";
const store = new Map();
const KV = {
  async get(k) { return store.has(k) ? store.get(k) : null; },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; },
};
const sent = [], owner = [];
let renderOk = false, editOk = true;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("graph.facebook.com")) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ messages: [{ id: "wamid.out" + sent.length }] }), { status: 200 }); }
  if (u.includes("owner.note")) { owner.push(JSON.parse(init.body).text); return new Response("ok", { status: 200 }); }
  if (u.includes("api.openai.com/v1/images/edits")) return editOk ? new Response(JSON.stringify({ data: [{ b64_json: Buffer.alloc(30000, 7).toString("base64") }] }), { status: 200 }) : new Response("busy", { status: 500 });
  if (u.includes("browser-rendering/screenshot")) return renderOk ? new Response(new Uint8Array(12000).fill(9), { status: 200 }) : new Response("timeout", { status: 504 });
  return new Response("{}", { status: 200 });
};
const env = { MEETINGS: KV, READ_KEY: "RK", WA_FORWARD_TOKEN: "FWD", WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p",
  OPENAI_API_KEY: "o", CF_RENDER_TOKEN: "r", CF_ACCOUNT_ID: "a", MAILBOXES: "", ADD_TO: "", SCENE_PICTURES: "on", MINUTE_TICK: "on",
  OWNER_NOTE_URL: "https://owner.note/x", INGEST_TOKEN: "ing", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const ctx = { waitUntil() {} };
const resume = async () => JSON.parse(await (await worker.fetch(new Request("https://x/pic_resume?key=RK&min_age=30"), env, ctx)).text());
const job = (k) => JSON.parse(store.get(k) || "null");
const unwait = (k) => { const j = job(k); if (j) { j.next_at = 0; store.set(k, JSON.stringify(j)); } };

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

store.set("img_style_ref_24", "PHOTO"); store.set("img_style_ref_27", "PHOTO");
const mk = (n, extra) => Object.assign({ scene: true, n, opt: "J", tid: "la", to: HER, at: Date.now(), tries: 0, auto: "feed", meKey: "style_ref_24", extra: [],
  option: { id: "J", name: "Metro platform", place: "A Dubai Metro station platform" }, angle: { hook: "h" + n, figure: "1", source: "s" },
  post: { n, idp: "feed_", hook: "Hook " + n, figure: "352", source: "Ejari", masthead: "Marsa Dubai", caption: "Caption " + n } }, extra || {});

// 1. picture already made (like angle 2 this morning), the card render keeps failing
const K2 = "picjob_sfeedtest2";
store.set("img_scene_x2", new Uint8Array(30000).buffer);
store.set(K2, JSON.stringify(mk("2", { sceneKey: "scene_x2" })));
let r = await resume();
let j = job(K2);
ok(j && j.tries === 1 && j.next_at > Date.now() + 60000, "first failure: waits about two minutes before the next try");
ok(Array.isArray(j.errs) && j.errs.length === 1, "the failure is kept on the job");
r = await resume();
ok(job(K2).tries === 1 && r.jobs.some(x => /retry in/.test(x.skipped || "")), "the next minute tick does NOT burn a try");
for (let t = 2; t <= 5; t++) { unwait(K2); await resume(); }
ok(job(K2) && job(K2).tries === 5 && !job(K2).gaveUp, "a feed job is still trying after five failures");
const before = sent.length;
unwait(K2); r = await resume();
const out = sent.slice(before);
ok(!store.has(K2), "sixth failure with a made picture: the job is finished");
ok(out.length === 1 && out[0].type === "image" && /scene_x2/.test(out[0].image.link) && out[0].image.caption === "Caption 2", "she gets the picture itself, with the caption");
ok(owner.some(t => /WITHOUT the card words/.test(t)), "Kendall is told the card words were missing");

// 2. nothing made yet and the image service keeps failing - give up, Kendall told, Naj NOT sent the prompt
editOk = false;
const K3 = "picjob_sfeedtest3";
store.set(K3, JSON.stringify(mk("3", { meKey: "style_ref_27" })));
const b3 = sent.length, o3 = owner.length;
for (let t = 1; t <= 6; t++) { unwait(K3); await resume(); }
ok(job(K3) && job(K3).gaveUp && job(K3).tries === 6, "no picture after six tries: gave up, record kept");
ok(sent.length === b3, "Naj is sent nothing about an automatic feed job that gave up");
ok(owner.slice(o3).some(t => /GAVE UP/.test(t) && /picjob_sfeedtest3/.test(t)), "Kendall is told, with the job key");

// 3. a picture she tapped for herself keeps the old ending (the prompt), after four tries
const K4 = "picjob_4_b";
store.set(K4, JSON.stringify(mk("4", { auto: undefined })));
const b4 = sent.length;
for (let t = 1; t <= 4; t++) { unwait(K4); await resume(); }
ok(job(K4) && job(K4).gaveUp && job(K4).tries === 4, "her own tap: four tries, then gave up");
ok(sent.slice(b4).some(m => m.type === "text" && /prompt instead/.test(m.text.body)), "her own tap: she still gets the prompt");

// 4. no stampede: three fresh jobs with two already making - none starts; with none making, at most two start
editOk = true; renderOk = true;
for (const k of ["picjob_sfeedz1", "picjob_sfeedz2", "picjob_sfeedz3"]) store.set(k, JSON.stringify(mk("1")));
const busy = (k) => { const x = job(k); x.running_until = Date.now() + 120000; store.set(k, JSON.stringify(x)); };
store.set("picjob_sfeedbusyA", JSON.stringify(mk("1"))); busy("picjob_sfeedbusyA");
store.set("picjob_sfeedbusyB", JSON.stringify(mk("1"))); busy("picjob_sfeedbusyB");
r = await resume();
ok(r.jobs.filter(x => /queued behind/.test(x.skipped || "")).length === 3, "two already making: the other three wait their turn");
store.delete("picjob_sfeedbusyA"); store.delete("picjob_sfeedbusyB");
r = await resume();
const started = r.jobs.filter(x => !x.skipped).length;
ok(started === 2, "none making: two start this tick (got " + started + ")");

console.log((fail ? "FAIL" : "PASS") + " - " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
