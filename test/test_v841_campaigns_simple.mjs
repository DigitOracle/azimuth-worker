// v841 (Kendall 18 Nov 2026): the simple Campaigns view.
// Opening a campaign shows ONLY: how many were sent; replies counted as positive / do not contact / other / no reply;
// every person who replied with their words and a wa.me button; everyone who did not reply with the same button.
// Do-not-contact people are marked and get no button. No charts, no funnel, no other stats. Tests fold away on the list.
// Also: campWebhook now keeps the reply text, and the page's reads run in parallel (it took minutes on a phone).
import { campaignRoute, campWebhook, simplePerson } from "../src/campaigns.js";
import { writeFileSync } from "node:fs";

const store = new Map(); let reads = 0, inflight = 0, maxInflight = 0;
const env = { READ_KEY: "rk-owner", WA_DESK_PHONE_ID: "111", MEETINGS: {
  get: async (k) => { reads++; inflight++; maxInflight = Math.max(maxInflight, inflight); await new Promise((r) => setTimeout(r, 2)); inflight--; return store.has(k) ? store.get(k) : null; },
  put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); } } };
const put = (k, v) => store.set(k, JSON.stringify(v)), getj = (k) => JSON.parse(store.get(k) || "null");
const person = (e, u) => ({ "k-naj": "najjuko", "k-ken": "kendall" })[u.searchParams.get("key")] || "";
const deps = { person, isNaj: () => true, now: Date.parse("2026-11-18T08:00:00Z") };
let pass = 0; const ok = (c, m) => { if (!c) { console.error("FAIL", m); process.exit(1); } pass++; };
const get = async (key, path) => campaignRoute(new Request("https://x" + path), env, new URL("https://x" + path + (path.includes("?") ? "&" : "?") + "key=" + key), deps);

const flow = { id: "greenlist-owners", start: "s1", nodes: { s1: { type: "template", template: "t", lang: "en", buttons: [{ id: "0", title: "Exploring selling", next: "x" }, { id: "1", title: "Not now" }, { id: "2", title: "Stop messages", optout: true }] }, x: { type: "end" } } };
put("camp_flow_greenlist-owners", flow);
const base = { template: "t", lang: "en", phone: "desk", window: "10:00-17:30", cap: 50, flow: "greenlist-owners", tags: ["gl"] };
put("camp_index", ["gl-r1", "gl-r2", "gl-test"]);
put("camp_gl-r1", Object.assign({ id: "gl-r1", name: "Green List owners (13 Nov)", parent: "gl", status: "done", created: "2026-11-13T06:00:00Z", started: "2026-11-13T06:00:00Z" }, base));
put("camp_gl-r2", Object.assign({ id: "gl-r2", name: "Green List owners (16 Nov retry)", parent: "gl", status: "done", created: "2026-11-16T07:00:00Z", started: "2026-11-16T07:00:00Z" }, base));
put("camp_gl-test", Object.assign({ id: "gl-test", name: "Green List test - 13 Nov", parent: "gl-test", status: "done", created: "2026-11-13T03:00:00Z", started: "2026-11-13T03:00:00Z" }, base, { flow: "" }));
put("camp_parent_gl", { id: "gl", title: "Green List owners" });
for (const id of ["gl-r1", "gl-r2", "gl-test"]) put("camp_stats_" + id, { sent: 5, delivered: 0, day: { "2026-11-13": 5 } });
const D = (i) => "9715000000" + String(i).padStart(2, "0");
// 1 positive (tapped Exploring selling), 2 "Not now" (other), 3 free text (other), 4 tapped Stop (dnc), 5 no reply, 6 no reply but opted out earlier (dnc),
// 7 no reply and Meta held it back (131049), 8 replied in r2 after no reply in r1 (counted once, as replied)
const msgs = { "gl-r1": [], "gl-r2": [] };
const M = (w, cid, i, extra) => { put("camp_msg_" + w, Object.assign({ cid, d: D(i), at: "2026-11-13T06:0" + (i % 10) + ":00Z", st: "delivered", delivered: true }, extra || {})); msgs[cid].push(w); };
M("w1", "gl-r1", 1, { replied: true, tap: "Exploring selling" }); put("camp_state_gl-r1_" + D(1), { path: ["s1.0"], at: "2026-11-13T06:10:00Z" });
M("w2", "gl-r1", 2, { replied: true }); put("camp_state_gl-r1_" + D(2), { path: ["s1.1"], at: "2026-11-13T06:11:00Z" });
M("w3", "gl-r1", 3, { replied: true, reply: "Call me after 5pm please", reply_at: "2026-11-13T07:00:00Z" });
M("w4", "gl-r1", 4, { replied: true, optout: true }); put("camp_optout_" + D(4), "1");
M("w5", "gl-r1", 5); M("w6", "gl-r1", 6); put("camp_optout_" + D(6), "1");
M("w7", "gl-r2", 7, { st: "failed", delivered: false, err: [131049] });
M("w8a", "gl-r1", 8); M("w8b", "gl-r2", 8, { replied: true, reply: "Yes, send details" });
for (const [cid, ws] of Object.entries(msgs)) put("camp_msgs_" + cid, ws);
put("camp_msgs_gl-test", []);
for (let i = 1; i <= 8; i++) put("camp_contact_" + D(i), { e164: "+" + D(i), name: "Owner " + i });

// pure classifier
const pp = simplePerson(D(1), [{ m: getj("camp_msg_w1"), s2: getj("camp_state_gl-r1_" + D(1)), flow }], { name: "A", e164: "+" + D(1) }, false, false);
ok(pp.kind === "positive" && pp.words.join() === "Exploring selling", "tap on a real option is positive " + JSON.stringify(pp));
ok(simplePerson(D(2), [{ m: getj("camp_msg_w2"), s2: { path: ["s1.1"] }, flow }], {}, false, false).kind === "other", "Not now is other");
ok(simplePerson(D(9), [{ m: { d: D(9), replied: true }, s2: { path: ["s1.2"] }, flow }], {}, false, false).kind === "dnc", "Stop button is do not contact");
ok(simplePerson(D(9), [{ m: { d: D(9) }, s2: null, flow }], {}, true, false).kind === "dnc", "opted out without replying is do not contact");
ok(simplePerson(D(9), [{ m: { d: D(9) }, s2: null, flow }], {}, false, false).kind === "none", "no reply");

// the list: one row per campaign, tests folded away, no charts
reads = 0; maxInflight = 0;
let html = await (await get("k-naj", "/momo/campaigns")).text();
ok(/Green List owners/.test(html) && /<details class=stest><summary>Tests \(1\)/.test(html), "tests fold into one collapsed section");
ok(!/<svg[^>]*role="img"/.test(html) && !/Funnel|donut|Delivered/i.test(html), "list has no charts or delivery stats");

// opening a campaign (her view)
reads = 0; maxInflight = 0;
html = await (await get("k-naj", "/momo/campaigns?c=gl")).text();
writeFileSync(process.env.V841_OUT || "v841_preview_body.html", html);
ok(maxInflight > 4, "reads run in parallel (max in flight " + maxInflight + ")");
ok(/<b>8<\/b><i>sent<\/i>/.test(html), "8 people sent (person 8 counted once)");
const cnt = (lab) => { const m = html.match(new RegExp('<b style="color:[^"]+">(\\d+)</b><i>' + lab + '</i>')); return m ? +m[1] : -1; };
ok(cnt("Positive") === 1 && cnt("Do not contact") === 2 && cnt("Other reply") === 3 && cnt("No reply") === 2, "reply types: positive 1, dnc 2, other 3 (Not now, two texts), no reply 2 - got " + [cnt("Positive"), cnt("Do not contact"), cnt("Other reply"), cnt("No reply")]);
ok(/Replied \(5\)/.test(html) && /Did not reply \(3\)/.test(html), "5 replied (incl. the Stop), 3 did not (one of them opted out)");
ok(/Call me after 5pm please/.test(html) && /Yes, send details/.test(html), "their actual words are shown");
ok(/href="https:\/\/wa\.me\/971500000001"/.test(html) && /href="https:\/\/wa\.me\/971500000005"/.test(html) && /href="https:\/\/wa\.me\/971500000007"/.test(html), "one-tap wa.me for repliers and non-repliers");
ok(!/wa\.me\/971500000004/.test(html) && !/wa\.me\/971500000006/.test(html), "do-not-contact people get no WhatsApp button");
ok((html.match(/class=sdnc>Do not contact/g) || []).length === 2, "both do-not-contact people are marked");
ok(/1 of the 8 were not delivered by WhatsApp/.test(html) && /not delivered<\/span>/.test(html), "a Meta-held message is said plainly, and the person is marked");
ok(!/<svg[^>]*role="img"/.test(html) && !/Funnel|Daily sends|Opt-out and block|Clicks per link|What happened|Read<\/i>|Delivered<\/i>/.test(html), "no pie chart, funnel or other stats");
ok(!/Owner tools/.test(html), "her view has no owner link");
ok(getj("camp_seen_najjuko_gl-r1"), "opening clears her unread badge");
// Kendall: same page plus one quiet link to the old tools; full=1 is owner only
html = await (await get("k-ken", "/momo/campaigns?c=gl")).text();
ok(/Owner tools/.test(html) && /<b>8<\/b><i>sent<\/i>/.test(html), "owner sees the same simple page with an Owner tools link");
html = await (await get("k-ken", "/momo/campaigns?c=gl&full=1")).text(); ok(/Runs \(2\)/.test(html), "owner full view still works");
html = await (await get("k-naj", "/momo/campaigns?c=gl&full=1")).text(); ok(!/Runs \(/.test(html) && /Replied \(5\)/.test(html), "full=1 is ignored for her");

// campWebhook keeps the reply text
put("camp_msg_w9", { cid: "gl-r1", d: D(5), at: "2026-11-13T06:05:00Z", st: "delivered", delivered: true });
const body = (msg) => ({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "111" }, messages: [msg] } }] }] });
await campWebhook(env, body({ from: D(5), id: "in1", type: "text", text: { body: "Interested, what is the price?" }, context: { id: "w9" } }), { now: deps.now });
let m9 = getj("camp_msg_w9"); ok(m9.replied && m9.reply === "Interested, what is the price?" && m9.reply_at, "free-text reply saved " + JSON.stringify(m9));
await campWebhook(env, body({ from: D(5), id: "in2", type: "text", text: { body: "Also 2 bed?" }, context: { id: "w9" } }), { now: deps.now + 60000 });
m9 = getj("camp_msg_w9"); ok(m9.reply === "Also 2 bed?", "the latest reply wins");
await campWebhook(env, body({ from: D(5), id: "in3", type: "audio", audio: { id: "a" }, context: { id: "w9" } }), { now: deps.now + 120000 });
ok(getj("camp_msg_w9").reply === "(voice note)", "a voice note is named, not dropped");
console.log("test_v841_campaigns_simple: " + pass + " passed, 0 failed");
