// v477 - YouTube from the desk: "youtube" gives a sign-in button; once connected, Post it asks where with YouTube in the list;
// YouTube uploads the stored video (resumable), private unless YT_PUBLIC=on, a clip_ as a Short. Offline.
import { deskLabRoute } from "../src/desk_lab.js";
import { ytMeta, ytRoute } from "../src/yt_desk.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
const env = { MEETINGS: KV, WA_DESK_PHONE_ID: "1", WA_DESK_OWNER: "971500000000", GOOGLE_OAUTH_CLIENT_ID: "cid", GOOGLE_OAUTH_CLIENT_SECRET: "sec" };
const calls = [];
globalThis.fetch = async (u, init) => {
  u = String(u); calls.push({ u, init });
  if (/oauth2.googleapis.com\/token/.test(u)) return new Response(JSON.stringify({ access_token: "AT", refresh_token: "RT", expires_in: 3600 }));
  if (/youtube\/v3\/channels/.test(u)) return new Response(JSON.stringify({ items: [{ id: "UC1", snippet: { title: "Digital Abbot" }, statistics: { subscriberCount: "12" } }] }));
  if (/upload\/youtube\/v3\/videos/.test(u)) return new Response("", { status: 200, headers: { location: "https://up.google/session1" } });
  if (u === "https://up.google/session1") return new Response(JSON.stringify({ id: "abc123", status: { privacyStatus: "private" } }));
  return new Response("{}");
};
const texts = [], raws = [];
const deps = { send: async (e, t) => texts.push(t), raw: async (e, p, tag) => { raws.push(p); return {}; }, origin: () => "https://w.dev", liConnected: async () => false, now: () => Date.now() };
const go = (m, t) => { texts.length = 0; raws.length = 0; return deskLabRoute(env, Object.assign({ from: "971500000000" }, m), t || "", deps); };
const say = (t) => go({ type: "text", text: { body: t } }, t);
const tap = (id) => go({ type: "interactive", interactive: { list_reply: { id } } });

await say("youtube");
const cta = raws[0];
ok(cta && JSON.stringify(cta).includes("https://w.dev/yt/start?s="), "youtube gives a sign-in button", JSON.stringify(cta));
const s = JSON.stringify(cta).match(/yt\/start\?s=([0-9a-f]+)/)[1];
const r1 = await ytRoute(env, new URL("https://w.dev/yt/start?s=" + s), {});
ok(r1.status === 302 && /youtube.upload/.test(decodeURIComponent(r1.headers.get("location"))) && /redirect_uri=https%3A%2F%2Fw.dev%2Fyt%2Fcallback/.test(r1.headers.get("location")), "start sends Google the upload scope and our callback");
const note = [];
const r2 = await ytRoute(env, new URL("https://w.dev/yt/callback?state=" + s + "&code=C"), { notify: async (e, t) => note.push(t) });
ok(r2.status === 200 && JSON.parse(store.get("yt_auth")).channel === "Digital Abbot" && /YouTube connected: Digital Abbot/.test(note[0]), "callback stores the token and names the channel");
ok((await ytRoute(env, new URL("https://w.dev/yt/callback?state=" + s + "&code=C"), {})).status === 400, "the link works once");

store.set("vid_clip_1", new Uint8Array(5000).buffer);
store.set("desk_reel_pending", JSON.stringify({ url: "https://w.dev/video/clip_1", caption: "Plans meet the ground. #DigitAlchemy #BIM", at: Date.now() }));
await tap("dr:ok");
const lst = raws[0] && raws[0].interactive && raws[0].interactive.action.sections[0].rows.map((r) => r.id).join(",");
ok(lst === "dr:ig,dr:yt,dr:all", "Post it asks where, with YouTube", lst);
calls.length = 0;
await tap("dr:yt");
const init = calls.find((c) => /upload\/youtube/.test(c.u));
const meta = init && JSON.parse(init.init.body);
ok(meta && meta.status.privacyStatus === "private" && /#Shorts$/.test(meta.snippet.title) && meta.snippet.tags.join() === "DigitAlchemy,BIM", "uploads private, as a Short, tags from the caption", init && init.init.body);
ok(/On YouTube: https:\/\/youtube.com\/shorts\/abc123/.test(texts.join("\n")) && /PRIVATE for now/.test(texts.join("\n")), "says where it is and that it is private", texts.join(" | "));
await tap("dr:yt");
ok(/Already on YouTube/.test(texts.join("")), "never uploads twice");
env.YT_PUBLIC = "on";
ok(ytMeta("A long first line\nmore", false).title === "A long first line", "title is the first line");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
