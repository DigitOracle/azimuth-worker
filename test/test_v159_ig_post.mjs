// v158 - she approves every Instagram post from WhatsApp (16 Sep 2026). Nothing reaches her feed without her tap: the card holds
// the post in KV, "Post it" is the only path to the publish API, "Not now" throws it away, and a token without the publishing
// permission is refused in plain words rather than at Meta. Through the real worker with WhatsApp and Instagram stubbed.
import worker from "../src/index.js";
import { worldPostCaption } from "../src/world_page.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const HER = "971565484397", READ = "read_key_for_the_owner_0123";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })), list_complete: true }; } };
const sent = [], ig = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (/graph\.facebook\.com\/v[\d.]+\/MEDIA\d+$/.test(u)) return new Response(JSON.stringify({ url: "https://lookaside.example/" + u.split("/").pop(), mime_type: "image/jpeg" }));
  if (u.startsWith("https://lookaside.example/")) return new Response(new Uint8Array(4096).fill(7), { headers: { "Content-Type": "image/jpeg" } });
  if (u.includes("graph.facebook.com")) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ messages: [{ id: "wamid.o" + sent.length }] })); }
  if (u.includes("graph.instagram.com")) {
    ig.push(u);
    if (u.includes("/media_publish")) return new Response(JSON.stringify({ id: "17900000000000000" }));
    if (u.includes("/media")) return new Response(JSON.stringify({ id: "CONTAINER1" }));
    return new Response(JSON.stringify({ status_code: "FINISHED" }));
  }
  return new Response("{}");
};
const env = { MEETINGS: KV, READ_KEY: READ, WA_FORWARD_TOKEN: "FWD", WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", IG_APP_ID: "IGAPP", IG_APP_SECRET: "s",
  MAILBOXES: "", ADD_TO: "", AI: { async run() { return { response: "{}" }; } }, PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const ctx = { waitUntil() {} };
let mid = 0;
const post = (message) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev/wa", { method: "POST", headers: { "X-Azimuth-Forward": "FWD", "Content-Type": "application/json" },
  body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [Object.assign({ from: HER, id: "wamid.in" + (++mid) }, message)] } }] }] }) }), env, ctx);
const say = (t) => post({ type: "text", text: { body: t } });
const tap = (id) => post({ type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: id } } });
const texts = () => sent.filter(m => m.type === "text").map(m => m.text.body);
const src = (await import("node:fs")).readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

// 1. one connect grants insights AND publishing
ok(/const IG_SCOPES = "[^"]*instagram_business_basic[^"]*instagram_business_manage_insights[^"]*instagram_business_content_publish"/.test(src), "one connect link asks for the numbers and publishing together, so reconnecting does not cost her the insights");

// 2. a token from before v158 cannot post, and is told so in words
const AUTH_OLD = { token: "T", user_id: "17841454430442268", username: "her.recode", expires_at: Date.now() + 5e9, perms: "instagram_business_basic,instagram_business_manage_insights" };
const AUTH_NEW = Object.assign({}, AUTH_OLD, { perms: AUTH_OLD.perms + ",instagram_business_content_publish" });
store.set("ig_auth", JSON.stringify(AUTH_OLD));
store.set("igpost_abc", JSON.stringify({ url: "https://x/img/p1", caption: "a caption", at: "now" }));
await tap("igp:abc:yes");
ok(ig.length === 0 && texts().some(t => /connected for the numbers, not for posting/.test(t)) && store.has("igpost_abc"), "without the publishing permission nothing is sent to Instagram, she is told why, and the post is kept");

// 3. her tap is the only path to the feed
store.set("ig_auth", JSON.stringify(AUTH_NEW));
sent.length = 0; ig.length = 0;
await tap("igp:abc:yes");
ok(ig.filter(u => /\/media$/.test(u.split("?")[0])).length === 1 && ig.some(u => u.includes("/media_publish")) && texts().some(t => /Posted to Instagram/.test(t)) && !store.has("igpost_abc"), "Post it: container, then publish, then she is told, and the pending post is cleared");
ok(ig.every(u => !u.includes("undefined")) && ig.some(u => u.includes("17841454430442268")), "the publisher uses the account id the live record actually stores (user_id, not userId)");

// 4. Not now throws it away
store.set("igpost_def", JSON.stringify({ url: "https://x/img/p2", caption: "c", at: "now" }));
sent.length = 0; ig.length = 0;
await tap("igp:def:no");
ok(ig.length === 0 && !store.has("igpost_def") && texts().some(t => /Nothing was posted/.test(t)), "Not now: nothing posted and the post is discarded, not parked");

// 5. change the caption, then see it again before it can go up
store.set("igpost_ghi", JSON.stringify({ url: "https://x/img/p3", caption: "old words", at: "now" }));
sent.length = 0; ig.length = 0;
await tap("igp:ghi:cap");
ok(store.get("igcap_pending") === "ghi" && texts().some(t => /Send me the caption you want/.test(t)) && ig.length === 0, "Change caption opens the window and posts nothing");
await say("Dubai or London. Expensive compared to what.");
const rec = JSON.parse(store.get("igpost_ghi"));
const btn = sent.filter(m => m.type === "interactive").pop();
ok(rec.caption === "Dubai or London. Expensive compared to what." && ig.length === 0 && !store.has("igcap_pending") && btn && btn.interactive.action.buttons.map(b => b.reply.id).join() === "igp:ghi:yes,igp:ghi:cap,igp:ghi:no" && sent.some(m => m.type === "image" && m.image.caption.includes("Dubai or London")) && [...store.keys()].filter(k => k.startsWith("igpost_")).length === 1, "her words become the caption, the same post comes back for a fresh tap with the new words on it, still unposted and with no orphan left behind");

// 6. an image she sends with "post to instagram" is proposed, never published on the word alone
sent.length = 0; ig.length = 0;
for (const k of [...store.keys()].filter(k => k.startsWith("igpost_"))) store.delete(k);
store.set("mkt_lastdraft_ig", "the stored caption draft");
await post({ type: "image", image: { id: "MEDIA1", caption: "post to instagram" } });
const pend = [...store.keys()].filter(k => k.startsWith("igpost_"));
ok(ig.length === 0 && pend.length === 1 && /\/ig_media\//.test(JSON.parse(store.get(pend[0])).url) && sent.some(m => m.type === "image" && /the stored caption draft/.test(m.image.caption)) && sent.some(m => m.type === "interactive"), "she sends a picture saying post it: the caption is shown and it waits for her tap");

// 7. the caption the Versus picture offers
const capL = worldPostCaption("london"), capM = worldPostCaption("monaco");
ok(/AED 7,200 a square foot, Dubai AED 4,260/.test(capL) && /1\.7 times Dubai/.test(capL) && /top few per cent/.test(capL) && /Savills, June 2026/.test(capL) && capL.includes("#dubai"), "the offered caption carries both prices, the multiple, the prime caveat and the source");
ok(/Monaco spotlight and IMSEE/.test(capM) && !/Figures from Savills, June 2026/.test(capM), "Monaco is credited to its own source, because it is not in the world cities index");

// 8. the reader and the writer agree on the field names: the v38 publisher read userId/expiresAt, the live record writes user_id/expires_at
ok(/a\.user_id \|\| a\.userId/.test(src) && /a\.expires_at \|\| a\.expiresAt/.test(src) && !/auth\.userId/.test(src), "the publisher reads the field names the connect flow actually writes, and no longer reads the ones it does not");

// 9. a half-failed publish must never post twice
store.set("ig_auth", JSON.stringify(AUTH_NEW));
store.set("igpost_jkl", JSON.stringify({ url: "https://x/img/p4", caption: "once only", at: "now" }));
let boom = 0;
const realFetch2 = globalThis.fetch;
globalThis.fetch = async (u, init) => { if (String(u).includes("/media_publish")) { boom++; throw new Error("network went away"); } return realFetch2(u, init); };
sent.length = 0; ig.length = 0;
await tap("igp:jkl:yes");
const held = JSON.parse(store.get("igpost_jkl"));
ok(boom === 1 && held.container === "CONTAINER1" && held.state === "held" && texts().some(t => /Look at your feed first/.test(t)), "the publish call dies: the post is kept with its container and she is told to look before tapping again");
globalThis.fetch = realFetch2;
ig.length = 0; sent.length = 0;
await tap("igp:jkl:yes");
ok(ig.filter(u => /\/media$/.test(u.split("?")[0])).length === 0 && ig.some(u => u.includes("/media_publish")) && !store.has("igpost_jkl"), "tapping again reuses the same container instead of making a second one, so it cannot post twice");

// 10. rewriting the caption throws away a container built from the old words
store.set("igpost_mno", JSON.stringify({ url: "https://x/img/p5", caption: "old", container: "CONTAINER_OLD", state: "held", at: "now" }));
await tap("igp:mno:cap");
await say("brand new words");
const re2 = JSON.parse(store.get("igpost_mno"));
ok(re2.caption === "brand new words" && !re2.container && !re2.state, "a new caption throws away the container built from the old one, so the old words can never go up");
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
