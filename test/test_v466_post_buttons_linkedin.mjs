// v466 - "post" by tapping (Give me ideas / Digital Abbot / DigitAlchemy -> one line), Approve -> Instagram / LinkedIn / Both,
// and LinkedIn picture posts (Images API, single and multiImage). Offline.
import { deskPostRoute, publishOne } from "../src/desk_post.js";
import { liPostImages } from "../src/li_desk.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list({ prefix } = {}) { return { keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })) }; } };
const env = { MEETINGS: KV, WA_DESK_PHONE_ID: "1370146096179819", WA_DESK_OWNER: "971562276093" };
const texts = [], btns = [], liCalls = [];
let liOn = true, liResult = { ok: true, id: "urn:li:share:7", url: "https://www.linkedin.com/feed/update/urn:li:share:7/" };
const deps = { send: async (e, t) => texts.push(t), buttons: async (e, b, x) => btns.push({ b, x }), image: async () => {}, llm: async () => "", fetchMedia: async () => ({}),
  origin: () => "https://w.dev", now: () => Date.now(), sleep: async () => {},
  liConnected: async () => liOn, liPostImages: async (e, imgs, cap) => { liCalls.push({ imgs, cap }); return liResult; } };
const say = async (t) => { texts.length = 0; btns.length = 0; return deskPostRoute(env, { type: "text", text: { body: t } }, t, deps); };
const tap = async (id) => { texts.length = 0; btns.length = 0; return deskPostRoute(env, { type: "interactive", interactive: { button_reply: { id } } }, "", deps); };

await say("post");
ok(btns[0] && btns[0].x.map((b) => b.id).join(",") === "dp:start:ideas,dp:start:abbot,dp:start:alchemy", "post alone shows three buttons", JSON.stringify(btns));
await say("/post");
ok(btns[0] && btns[0].x.length === 3, "/post alone too");
await tap("dp:start:abbot");
ok(store.get("desk_post_wait") === "abbot" && /next message/.test(texts.join("")), "a voice button waits for one line");
await say("/queue");
ok(store.get("desk_post_wait") === "abbot", "a command does not use up the wait");

// approve -> where
const plan = { id: "pq1", status: "draft", idea: "x", type: "single", lane: "abbot", caption: "Hello (world) #DigitAlchemy", slides: [{ img_key: "k1", src: "ai", alt: "a site" }], approved: false, history: [], created: Date.now(), expires_at: Date.now() + 1e9 };
store.set("postplan_pq1", JSON.stringify(plan));
await tap("dp:pq1:ok");
ok(btns[0] && btns[0].x.map((b) => b.id).join(",") === "dp:pq1:wig,dp:pq1:wli,dp:pq1:wboth" && JSON.parse(store.get("postplan_pq1")).status === "draft", "LinkedIn connected: Approve asks where, approves nothing yet");
liOn = false; await tap("dp:pq1:ok"); liOn = true;
const afterIg = JSON.parse(store.get("postplan_pq1"));
ok(afterIg.approved === true && afterIg.targets.join() === "ig", "without LinkedIn, Approve is Instagram as before");

// LinkedIn-only publish
store.set("igm_k1", new Uint8Array(500).buffer);
const p2 = Object.assign({}, plan, { id: "pq2", status: "scheduled", approved: true, targets: ["li"] });
store.set("postplan_pq2", JSON.stringify(p2));
texts.length = 0; await publishOne(env, deps, p2, Date.now());
const s2 = JSON.parse(store.get("postplan_pq2"));
ok(liCalls.length === 1 && liCalls[0].imgs[0].bytes.byteLength === 500 && liCalls[0].cap === plan.caption && s2.status === "posted" && s2.li_id === "urn:li:share:7", "LinkedIn-only: the picture and caption go to LinkedIn, plan marked posted");
ok(/Posted pq2 to LinkedIn: https:\/\/www\.linkedin\.com/.test(texts.join("")), "the desk gets the LinkedIn link");
texts.length = 0; await publishOne(env, deps, JSON.parse(store.get("postplan_pq2")), Date.now());
ok(liCalls.length === 1, "never posted twice");
liResult = { ok: false, err: "post refused: HTTP 403" };
const p3 = Object.assign({}, plan, { id: "pq3", status: "scheduled", approved: true, targets: ["li"] }); store.set("postplan_pq3", JSON.stringify(p3));
texts.length = 0; await publishOne(env, deps, p3, Date.now());
ok(JSON.parse(store.get("postplan_pq3")).status === "held" && /not posted \(post refused: HTTP 403\)/.test(texts.join("")), "a refusal holds it and says why");
const p4 = Object.assign({}, plan, { id: "pq4", status: "scheduled", approved: false, targets: ["li"] }); store.set("postplan_pq4", JSON.stringify(p4));
const before = liCalls.length; await publishOne(env, deps, p4, Date.now());
ok(liCalls.length === before, "an unapproved plan never reaches LinkedIn");

// liPostImages itself
const lstore = new Map([["li_auth", JSON.stringify({ token: "T", sub: "abc", expires_at: Date.now() + 1e9 })]]);
const lenv = { MEETINGS: { get: async (k) => lstore.get(k) || null } };
const calls = []; let n = 0;
const fake = async (u, init) => { const s = String(u); calls.push({ s, init });
  if (/images\?action=initializeUpload/.test(s)) { n++; return new Response(JSON.stringify({ value: { uploadUrl: "https://up/i" + n, image: "urn:li:image:I" + n } })); }
  if (/^https:\/\/up\//.test(s)) return new Response("", { status: 201 });
  if (/\/rest\/posts/.test(s)) return new Response("", { status: 201, headers: { "x-restli-id": "urn:li:share:9" } });
  return new Response("{}"); };
const one = await liPostImages(lenv, [{ bytes: new Uint8Array(10).buffer, alt: "A" }], "Hi (there) #Tag", { fetch: fake });
const b1 = JSON.parse(calls.find((c) => /\/rest\/posts/.test(c.s)).init.body);
ok(one.ok && b1.content.media.id === "urn:li:image:I1" && b1.author === "urn:li:person:abc" && b1.commentary === "Hi \\(there\\) #Tag", "one picture: media post as Kendall", JSON.stringify(b1));
calls.length = 0;
const many = await liPostImages(lenv, [{ bytes: new Uint8Array(10).buffer }, { bytes: new Uint8Array(10).buffer }, { bytes: new Uint8Array(10).buffer }], "C", { fetch: fake });
const b3 = JSON.parse(calls.find((c) => /\/rest\/posts/.test(c.s)).init.body);
ok(many.ok && b3.content.multiImage.images.length === 3, "several pictures: a multiImage post");
const off = await liPostImages({ MEETINGS: { get: async () => null } }, [], "x", { fetch: fake });
ok(!off.ok && /not connected/.test(off.err), "not connected: refused before calling LinkedIn");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
