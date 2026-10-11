// v506 - branded video from his own talking-head clip: the button flow, nothing spent before Make it, the job tick, fallbacks, size refusal.
import { deskLabRoute } from "../src/desk_lab.js";
import { talkRoute, talkTick, previewText, composeJob, splitName, nameDefault, matteStep, KV_MAX } from "../src/talkvideo.js";

let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };

function kv() {
  const m = new Map();
  return { m, get: async (k, t) => { const v = m.has(k) ? m.get(k) : null; if (v == null) return null; if (t === "arrayBuffer") return v instanceof ArrayBuffer ? v : null; return typeof v === "string" ? v : null; },
    put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } };
}
function mkEnv(extra) { return Object.assign({ MEETINGS: kv() }, extra || {}); }
function labDeps(out) {
  return { owner: "971500000000", origin: () => "https://w.example",
    raw: async (e, p, k) => { out.push({ kind: k, p }); return {}; }, send: async (e, s) => { out.push({ kind: "text", s }); },
    mediaInfo: async () => ({ file_size: 3 * 1048576 }), fetchMedia: async () => ({ bytes: new ArrayBuffer(3 * 1048576) }) };
}
const tap = (id) => ({ type: "interactive", interactive: { button_reply: { id } } });
const pick = (id) => ({ type: "interactive", interactive: { list_reply: { id } } });
const ids = (o) => { const a = o && o.p && o.p.interactive && o.p.interactive.action; return a ? (a.buttons ? a.buttons.map((b) => b.reply.id) : a.sections[0].rows.map((r) => r.id)) : []; };
const titlesOk = (o) => { const a = o.p.interactive.action; return a.buttons ? a.buttons.length <= 3 && a.buttons.every((b) => b.reply.title.length <= 20) : a.sections[0].rows.length <= 10 && a.sections[0].rows.every((r) => r.title.length <= 24); };
const VENDOR = /replicate|whisper|openai|cloudflare|workers ai|gpt|heygen/i;

// stubbed network: counts every call that could cost money
const calls = [];
globalThis.fetch = async (url, init) => { calls.push(String(url)); return new Response("{}", { status: 404 }); };

// ---- 1. a video arrives: the existing buttons stay, the branded-video offer is added in its own message
{
  const env = mkEnv(), out = [], d = labDeps(out);
  await deskLabRoute(env, { type: "video", video: { id: "m1", caption: "" } }, "", d);
  const ask = out.find((o) => o.kind === "video-ask"), offer = out.find((o) => o.kind === "tv-offer");
  ok(ask && ids(ask).join() === "dv:reel:desk_1,dv:status:desk_1,dv:broadcast:desk_1", "existing three buttons unchanged", ask && ids(ask));
  ok(offer && ids(offer)[0] === "tv:start:desk_1" && titlesOk(offer), "offer button tv:start:desk_1", offer && ids(offer));
  ok(env.MEETINGS.m.get("vid_desk_1") instanceof ArrayBuffer, "bytes stored as vid_desk_1");
  // a captioned video still acts at once (no offer)
  const out2 = []; await deskLabRoute(env, { type: "video", video: { id: "m2", caption: "broadcast" } }, "", labDeps(out2));
  ok(!out2.some((o) => o.kind === "tv-offer"), "captioned video: existing command path, no offer");
}

// ---- 2. size: over 25 MB without R2 is refused plainly; with MEDIA it is kept and offered
{
  const env = mkEnv(), out = [], d = labDeps(out); d.mediaInfo = async () => ({ file_size: 30 * 1048576 });
  await deskLabRoute(env, { type: "video", video: { id: "m3" } }, "", d);
  ok(out.length === 1 && /25 MB/.test(out[0].s) && !env.MEETINGS.m.has("vid_desk_1"), "over 25 MB refused, nothing stored", out);
  const r2 = new Map(), env2 = mkEnv({ MEDIA: { put: async (k, v) => r2.set(k, v), get: async (k) => r2.get(k) } }), out2 = [], d2 = labDeps(out2);
  d2.mediaInfo = async () => ({ file_size: 30 * 1048576 }); d2.fetchMedia = async () => ({ bytes: new ArrayBuffer(30 * 1048576) });
  await deskLabRoute(env2, { type: "video", video: { id: "m4" } }, "", d2);
  ok(r2.has("vid_desk_1") && out2.some((o) => o.kind === "tv-offer"), "over 25 MB with MEDIA: kept in R2 and offered");
}

// ---- 3. the full button flow, nothing spent before Make it
const env = mkEnv({ AI: { run: async (m, inp) => { calls.push("AI:" + m); return { text: "Hello from Dubai today", words: [{ word: "Hello", start: 0.1, end: 0.4 }, { word: "from", start: 0.5, end: 0.7 }, { word: "Dubai", start: 0.8, end: 1.2 }, { word: "today", start: 1.3, end: 1.6 }] }; } },
  VIDEO_SVC: { fetch: async (u, init) => { calls.push("SVC:" + u); if (/\/audio$/.test(u)) return new Response(new Uint8Array(5000)); if (/\/compose$/.test(u)) { env._compose = JSON.parse(init.body); return new Response(new Uint8Array(200000), { headers: { "Content-Type": "video/mp4" } }); } return new Response("", { status: 404 }); } } });
await env.MEETINGS.put("music_index", JSON.stringify({ calm: [{ key: "calm_1_ab", title: "Calm" }] }));
await env.MEETINGS.put("talk_plate_default", new ArrayBuffer(4000));
const out = [], d = labDeps(out);
const step = async (m) => { out.length = 0; const h = await deskLabRoute(env, m, "", d); return h; };
calls.length = 0;
await step(tap("tv:start:desk_1"));
ok(ids(out[0]).join() === "tv:bg:scene,tv:bg:plate,tv:bg:keep" && titlesOk(out[0]), "background asked", ids(out[0]));
await step(tap("tv:bg:plate")); ok(ids(out[0]).join() === "tv:ly:full,tv:ly:lower", "layout asked", ids(out[0]));
await step(tap("tv:ly:lower")); ok(ids(out[0]).join() === "tv:cp:none,tv:cp:bottom,tv:cp:scroll", "captions asked");
await step(tap("tv:cp:bottom")); ok(ids(out[0]).join() === "tv:mu:none,tv:mu:calm" && titlesOk(out[0]), "music list from the library", ids(out[0]));
await step(pick("tv:mu:calm")); ok(ids(out[0]).join() === "tv:nm:def,tv:nm:type,tv:nm:none" && /Dr\. Kendall Wilson/.test(out[0].p.interactive.body.text), "name card asked with the default");
await step(tap("tv:nm:type")); ok(/Type the name card/.test(out[0].s), "type the name");
out.length = 0; await deskLabRoute(env, { type: "text", text: { body: "Naj | Dubai Decoded" } }, "Naj | Dubai Decoded", d);
ok(ids(out[0]).join() === "tv:sh:p,tv:sh:l", "typed name taken, shape asked", out);
await step(tap("tv:sh:p"));
const pv = out[0];
ok(ids(pv).join() === "tv:go,tv:chg,tv:x" && /Brand plate/.test(pv.p.interactive.body.text) && /Naj · Dubai Decoded/.test(pv.p.interactive.body.text), "preview with Make it / Change it / Cancel", pv && pv.p.interactive.body.text);
ok(calls.length === 0, "nothing spent before Make it", calls);
ok(!out.concat([pv]).some((o) => VENDOR.test(JSON.stringify(o))), "no vendor names in the flow");
// Change it goes back to the start
await step(tap("tv:chg")); ok(ids(out[0])[0] === "tv:bg:scene", "Change it restarts at background");
for (const id of ["tv:bg:plate", "tv:ly:lower", "tv:cp:bottom"]) await step(tap(id));
await step(pick("tv:mu:calm")); await step(tap("tv:nm:def")); await step(tap("tv:sh:p"));
await step(tap("tv:go"));
ok(/Working on it/.test(out[out.length - 1].s) && calls.length === 0, "Make it: working message, the job is queued (work happens on the tick)", out);
const job0 = JSON.parse(env.MEETINGS.m.get("tv_job"));
ok(job0.stage === "words" && job0.name.line1 === "Dr. Kendall Wilson", "job record queued with default name");
// a second Make it while one runs is refused
await env.MEETINGS.put("tv_draft", JSON.stringify(Object.assign({}, job0, { step: "preview" }))); await step(tap("tv:go"));
ok(/already being made/.test(out[0].s), "one job at a time");
await env.MEETINGS.delete("tv_draft");

// ---- 4. the tick: words -> bg -> matte (no token = fallback) -> compose -> delivered with post buttons
const tdOut = [];
const td = { origin: () => "https://w.example", send: async (e, s) => tdOut.push({ t: "text", s }), video: async (e, l, c) => tdOut.push({ t: "video", l, c }),
  buttons: async (e, b, btns) => tdOut.push({ t: "buttons", b, ids: btns.map((x) => x.id), titles: btns.map((x) => x.title) }),
  genImage: async () => { calls.push("genImage"); return { bytes: new ArrayBuffer(3000) }; }, storeImage: async () => "mid123" };
for (let i = 0; i < 6; i++) await talkTick(env, td);
const job = JSON.parse(env.MEETINGS.m.get("tv_job"));
ok(job.done && job.out === "talk_1", "job done, stored as talk_1", job);
ok(env.MEETINGS.m.get("vid_talk_1") instanceof ArrayBuffer, "vid_talk_1 stored");
ok(calls.includes("AI:@cf/openai/whisper") && calls.some((c) => /\/audio$/.test(c)), "transcribed from the extracted sound");
ok(!calls.includes("genImage"), "brand plate used: no picture generated");
const cj = env._compose;
ok(cj && cj.matte === null && cj.background === null && cj.layout === "lower" && cj.captions.mode === "bottom" && cj.captions.words.length === 4 && cj.music === "https://w.example/music/calm_1_ab" && cj.width === 1080 && cj.height === 1920 && cj.video === "https://w.example/video/desk_1", "compose job built (no cut-out -> own background)", cj);
const v = tdOut.find((o) => o.t === "video");
ok(v && v.l === "https://w.example/video/talk_1" && /kept your own background/.test(v.c) && !VENDOR.test(v.c), "clip sent; fallback said plainly", v);
const b1 = tdOut.filter((o) => o.t === "buttons");
ok(b1[0] && b1[0].ids.join() === "dr:ok,dc:ai:reel:talk_1,dr:no" && b1[1] && b1[1].ids[0] === "dv:status:talk_1" && b1.every((b) => b.titles.every((t) => t.length <= 20)), "post buttons + For my Status", b1);
ok(JSON.parse(env.MEETINGS.m.get("desk_reel_pending")).url === "https://w.example/video/talk_1", "desk_reel_pending set for Post it");
const before = calls.length; await talkTick(env, td); ok(calls.length === before, "a finished job is not worked again");

// ---- 5. the cut-out with a token: start, poll, success -> matte + background in the compose job
{
  const H = []; const f = async (u, init) => { H.push([u, init && init.method, init && init.body]);
    if (/\/models\/arielreplicate\/robust_video_matting$/.test(u)) return new Response(JSON.stringify({ latest_version: { id: "ver1" } }));
    if (/\/predictions$/.test(u)) return new Response(JSON.stringify({ id: "p1", status: "starting" }), { status: 201 });
    if (/\/predictions\/p1$/.test(u)) return new Response(JSON.stringify(H.filter((x) => /p1$/.test(x[0])).length > 1 ? { status: "succeeded", output: "https://r.example/mask.mp4" } : { status: "processing" }));
    return new Response("", { status: 404 }); };
  const j = { notes: [] }, e2 = { REPLICATE_API_TOKEN: "test-token" };
  ok(await matteStep(e2, f, j, "https://w.example/video/desk_1") === "wait" && j.pred === "p1", "prediction started");
  const body = JSON.parse(H[1][2]); ok(body.version === "ver1" && body.input.input_video === "https://w.example/video/desk_1" && body.input.output_type === "alpha-mask", "prediction input shape", body);
  ok(await matteStep(e2, f, j, "") === "wait", "still processing");
  ok(await matteStep(e2, f, j, "") === "done" && j.matteUrl === "https://r.example/mask.mp4", "matte url taken");
  const c = composeJob(Object.assign({ key: "desk_1", layout: "full", caps: "scroll", shape: "l", bgUrl: "https://w.example/ig_media/x", words: [] }, j), "https://w.example");
  ok(c.matte === "https://r.example/mask.mp4" && c.background === "https://w.example/ig_media/x" && c.width === 1920, "compose with cut-out and background", c);
  const j2 = { notes: [] }; const ff = async (u) => /models/.test(u) ? new Response(JSON.stringify({ latest_version: { id: "v" } })) : /predictions$/.test(u) ? new Response(JSON.stringify({ id: "p2" })) : new Response(JSON.stringify({ status: "failed" }));
  await matteStep(e2, ff, j2, "u"); ok(await matteStep(e2, ff, j2, "u") === "done" && j2.matteUrl === null && j2.notes.length === 1, "a failed cut-out falls back");
}

// ---- 6. odds and ends
ok(splitName("Naj · Dubai Decoded").line2 === "Dubai Decoded" && nameDefault({ TALK_NAME_DEFAULT: "Najjuko | Dubai Decoded" }).line1 === "Najjuko", "name default from TALK_NAME_DEFAULT");
ok(nameDefault({}).line1 === "Dr. Kendall Wilson" && nameDefault({}).line2 === "Digital Abbot", "default name card");
ok(await talkRoute(mkEnv(), { type: "text" }, "hello", labDeps([])) === false, "plain text not taken without a name wait");
{ const o = []; await talkRoute(mkEnv(), tap("tv:go"), "", labDeps(o)); ok(/no longer waiting/.test(o[0].s), "stale tap answered plainly"); }
ok(KV_MAX === 25 * 1048576, "25 MB KV limit");

console.log(pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
