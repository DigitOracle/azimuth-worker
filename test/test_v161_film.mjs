// v161 - the DAMAC Hills 30 s film and its cluster endings, offline (17 Sep 2026): GET /film picks the cluster whose name or member sits in the ask
// (longest wins), falls back to the district's 30 s film, 404s when neither exists; "show me <cluster>" on WhatsApp sends the video, or the board's
// player link when the stored file is over 16 MB. Nothing leaves this machine: KV and WhatsApp are stubbed.
import worker from "../src/index.js";

const HER = "971565484397";
const store = new Map();
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" ? v : (t === "json" ? JSON.parse(v) : v); },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; },
};
const sent = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("graph.facebook.com")) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ messages: [{ id: "wamid.out" + sent.length }] }), { status: 200 }); }
  return new Response("{}", { status: 200 });
};
const env = { MEETINGS: KV, READ_KEY: "RK", WA_FORWARD_TOKEN: "FWD", WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", MAILBOXES: "", ADD_TO: "", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const ctx = { waitUntil() {} };
let mid = 0;
const say = (body) => worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "X-Azimuth-Forward": "FWD", "Content-Type": "application/json" },
  body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [{ from: HER, id: "wamid.in" + (++mid), type: "text", text: { body } }] } }] }] }) }), env, ctx);
const get = (path) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + path), env, ctx);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

const items = [
  { key: "unreal_dubaihills_fly", kind: "unreal", scope: "district", district: "dubaihills", name: "Dubai Hills", src: "/video/unreal_dubaihills_fly" },
  { key: "unreal_damachills_fly", kind: "unreal", scope: "district", district: "damachills", name: "Damac Hills", src: "/video/unreal_damachills_fly" },
  { key: "unreal_damachills_film30", kind: "unreal", scope: "district30", district: "damachills", name: "Damac Hills", title: "30 s film", src: "/video/unreal_damachills_film30", poster: "/video/unreal_damachills_film30?poster=1" },
  { key: "unreal_damachills_c1", kind: "unreal", scope: "cluster", cluster: 1, district: "damachills", name: "Golf Place", members: ["Golf Place", "Golf Place Terraces"], src: "/video/unreal_damachills_c1" },
  { key: "unreal_damachills_c2", kind: "unreal", scope: "cluster", cluster: 2, district: "damachills", name: "Park Residences", members: ["Park Residences", "Golf Vista"], src: "/video/unreal_damachills_c2" },
];

// 1. no register at all: 404, and the key rule holds
ok((await get("/film?q=golf")).status === 401, "GET /film without the key is 401");
ok((await get("/film?key=RK&district=damachills&q=golf")).status === 404, "GET /film with no register is 404");

store.set("img_videos", JSON.stringify({ items }));
let r = await get("/film?key=RK&district=damachills&q=show%20me%20golf%20place%20terraces");
let j = await r.json();
ok(r.status === 200 && j.cluster === 1 && j.name === "Golf Place" && j.src === "/video/unreal_damachills_c1", "longest member wins: 'golf place terraces' -> cluster 1 (" + JSON.stringify(j) + ")");
j = await (await get("/film?key=RK&district=damachills&q=GOLF%20VISTA")).json();
ok(j.cluster === 2 && j.name === "Park Residences", "case-insensitive member match: 'GOLF VISTA' -> cluster 2");
j = await (await get("/film?key=RK&district=damachills&q=park")).json();
ok(j.cluster === 2, "a short ask inside a member name: 'park' -> cluster 2");
j = await (await get("/film?key=RK&district=damachills&q=the%20lagoon")).json();
ok(j.cluster === null && j.src === "/video/unreal_damachills_film30" && j.poster === "/video/unreal_damachills_film30?poster=1", "no cluster match -> the district's 30 s film");
ok((await get("/film?key=RK&district=dubaihills&q=golf")).status === 404, "a district with only the 15 s fly-through -> 404 (the fly-through is not a film)");
j = await (await get("/film?key=RK&district=damachills")).json();
ok(j.src === "/video/unreal_damachills_film30", "no q at all -> the 30 s film");

// 2. WhatsApp: "show me <cluster>" -> a video message; over 16 MB -> the board's player link
store.set("vid_unreal_damachills_c1", new ArrayBuffer(1024));
store.set("vid_unreal_damachills_c2", new ArrayBuffer(16 * 1024 * 1024 + 1));
sent.length = 0;
await say("show me Golf Place");
ok(sent.length === 1 && sent[0].type === "video" && sent[0].video.link === "https://azimuth-2.digitalchemy.workers.dev/video/unreal_damachills_c1" && sent[0].video.caption === "Golf Place · Damac Hills",
  "'show me Golf Place' -> one video message, /video/<key>, caption 'Golf Place · Damac Hills' (" + JSON.stringify(sent[0] && (sent[0].video || sent[0].text)) + ")");
sent.length = 0;
await say("play golf vista");
ok(sent.length === 1 && sent[0].type === "text" && sent[0].text.body.indexOf("/board") === -1 && sent[0].text.body.indexOf("RK") === -1 && /too large to send in WhatsApp/.test(sent[0].text.body) && sent[0].text.body.indexOf("Park Residences · Damac Hills") !== -1,
  "'play golf vista' (17 MB stored) -> v294: no board link; says in words it is too large to send here, no video message (" + JSON.stringify(sent[0] && (sent[0].video || sent[0].text)) + ")");
sent.length = 0;
await say("show the board");
ok(sent.length === 1 && sent[0].type === "text" && sent[0].text.body.indexOf("/board") === -1 && sent[0].text.body.indexOf("#film") === -1 && /right here in this chat/.test(sent[0].text.body), "'show the board' (v294) still reaches the board command first and answers in the chat");
sent.length = 0;
await say("show me damac hills");
ok(!sent.some(m => m.type === "video") && !sent.some(m => m.type === "text" && m.text.body.indexOf("#film") !== -1), "'show me damac hills' matches no cluster -> not answered as a film");

// 3. the board's player reads #film=<key>, and the map rail prefers the 30 s film
const html = await (await get("/board?key=RK")).text();
ok(html.indexOf('/[#&]film=([a-z0-9_]+)/i.exec(location.hash)') !== -1 && html.indexOf('v.src="/video/"+fm[1]') !== -1, "the board splash opens /video/<key> for #film=<key>");
const map = await (await get("/map?key=RK")).text();
ok(map.indexOf('v.scope==="district"||v.scope==="district30"') !== -1 && map.indexOf('if(UFLY[i].scope==="district30")return UFLY[i]') !== -1, "the map rail's camera chip takes the district30 item first");

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
