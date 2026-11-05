// v724 - campaign PREVIEW mode (Najjuko walks the Palm owners flow on her own phone, inside her 24-hour window), facts as data
// ({fact:key} from camp_facts_<set>, "to confirm" when missing) and the /cb/ brief with a source line under every fact.
// Through the REAL /wa entry point with the forward header (her traffic arrives forwarded from meeting-capture on the main number id).
// FAKE numbers, FAKE facts; graph.facebook.com is MOCKED and any other host throws.
import fs from "node:fs";
const worker = (await import("../src/index.js")).default;
const C = await import("../src/campaigns.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 500)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, String(v)); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NAJ_NUM = "971500000099", KEN_NUM = "971500000098", STRANGER = "971500000777", MAIN = "100000000000002", DESK = "100000000000001";
const env = { MEETINGS: KV, WA_ALLOWED: NAJ_NUM, WA_DESK_OWNER: KEN_NUM, WA_DESK_PHONE_ID: DESK, WA_PHONE_ID: MAIN, WHATSAPP_TOKEN: "TEST_TOKEN", WA_FORWARD_TOKEN: "fwd_TEST_0123456789", PUBLIC_ORIGIN: "https://w", AI: { run: async () => ({ response: "{}" }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const calls = [];
globalThis.fetch = async (u, init) => {
  const s = String(u && u.url || u);
  if (!/^https:\/\/graph\.facebook\.com\//.test(s)) throw new Error("network blocked in test: " + s);
  calls.push({ url: s, body: init && init.body ? JSON.parse(init.body) : null });
  return new Response(JSON.stringify({ messages: [{ id: "wamid.P" + calls.length }] }), { status: 200 });
};
let mid = 0;
const wa = (from, msg, pid) => worker.fetch(new Request("https://w/wa", { method: "POST", headers: { "X-Azimuth-Forward": env.WA_FORWARD_TOKEN, "Content-Type": "application/json" },
  body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: pid || MAIN }, messages: [Object.assign({ from, id: "m" + (++mid) }, msg)] } }] }] }) }), env, ctx);
const text = (from, body, pid) => wa(from, { type: "text", text: { body } }, pid);
const tap = (from, id, pid) => wa(from, { type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: "x" } } }, pid);
const pv = () => calls.filter((c) => JSON.stringify(c.body).includes("TEST PREVIEW"));
const bodyOf = (c) => c.body.type === "text" ? c.body.text.body : c.body.interactive.body.text;

// the flow and FAKE facts as data
const FLOW = JSON.parse(fs.readFileSync(new URL("./fixtures/flow_pja_owners.json", import.meta.url)));
const { f, err } = C.cleanFlow(FLOW); ok(!err.length && f.facts === "pja" && f.nodes.s1.body.startsWith("Hi {{1}}, Najjuko here."), "fixture: renamed templates keep their draft body + facts set", err);
ok(f.nodes.s1.template === "najjuko_pja_owner_intro_v2" && f.nodes.nudge.template === "najjuko_market_updates_ask", "templates renamed (no FN Realty)");
ok(!/FN Realty|fnrealty/i.test(fs.readFileSync(new URL("./fixtures/flow_pja_owners.json", import.meta.url), "utf8")), "no FN Realty anywhere in the flow");
store.set("camp_flow_pja-owners", JSON.stringify(f));
store.set("camp_facts_pja", JSON.stringify({ pja_home_sales: { value: "12 test sales", source: "TEST", as_of: "2026-11-02" }, pja_median_psf: { value: "AED 1,234 per sq ft", source: "TEST", as_of: "2026-11-02" } }));

// 1. no keyword: nothing from the preview, her ordinary chat untouched
calls.length = 0; await text(NAJ_NUM, "hello"); ok(pv().length === 0 && !store.has("camp_preview_log"), "ordinary message: no preview");
// 2. a stranger cannot start it
calls.length = 0; await text(STRANGER, "campaign preview"); ok(pv().length === 0, "stranger: no preview");
// 3. Najjuko starts it on the number she talks to Azimuth on
calls.length = 0; let r = await text(NAJ_NUM, "Campaign preview");
ok(r.status === 200 && calls.length === 1 && calls[0].url.includes("/" + MAIN + "/messages") && calls[0].body.to === NAJ_NUM, "start: one message, from the number her chat arrived on", calls);
const s1 = calls[0].body;
ok(s1.interactive.type === "list" && bodyOf(calls[0]).startsWith("TEST PREVIEW (template najjuko_pja_owner_intro_v2)\n\nHi Ahmed, Najjuko here. I specialise in Palm Jebel Ali. You’re receiving this because you own a unit at Palm Jebel Ali (sample reason). Quick question about your unit: what’s your plan for it right now?\n\nNajjuko · BRN 98949 · Tap Stop and I’ll delete your details."), "exact approved wording, TEST PREVIEW first", bodyOf(calls[0]));
const rows = s1.interactive.action.sections[0].rows;
ok(rows.length === 5 && rows.every((x) => x.title.length <= 24) && rows[0].description === "Keeping it until handover" && rows.map((x) => x.description || x.title).join("|") === "Keeping it until handover|Open to selling|Another Palm investment|Not now|Stop messages", "five options, full wording kept", rows);
calls.length = 0; await text(NAJ_NUM, "preview pja"); ok(calls.length === 1 && bodyOf(calls[0]).includes("Najjuko here"), "'preview pja' works too");
// 4. (a) handover: thank-you + the updates ask; the consent tap records NOTHING
calls.length = 0; await tap(NAJ_NUM, rows[0].id);
ok(calls.length === 2 && bodyOf(calls[0]).startsWith("TEST PREVIEW\n\nThank you Ahmed") && calls[1].body.interactive.type === "button" && calls[1].body.interactive.action.buttons[0].reply.id.startsWith("pv:pja-owners:a2:"), "(a) walks the real nodes with pv: ids", calls.map(bodyOf));
calls.length = 0; await tap(NAJ_NUM, "pv:pja-owners:a2:0");
ok(/would record consent "market-updates" = yes/.test(bodyOf(calls[0])) && bodyOf(calls[1]).includes("one update every two weeks") && calls[2].body.interactive.action.buttons.map((b) => b.reply.title).join() === "Start again,See the follow-up,End preview", "(a) consent shown not stored; end-of-branch controls", calls.map(bodyOf));
ok(![...store.keys()].some((k) => /^camp_(contact|consentlog|stats|sent24|handover|optout|msg|link)/.test(k)), "nothing in campaign stores", [...store.keys()]);
// 5. (b) selling: list, agents, facts from data, handover shown not recorded
calls.length = 0; await tap(NAJ_NUM, "pv:pja-owners:__:0"); ok(calls.length === 1 && bodyOf(calls[0]).includes("Najjuko here"), "Start again");
calls.length = 0; await tap(NAJ_NUM, "pv:pja-owners:s1:1"); ok(calls[0].body.interactive.type === "list" && calls[0].body.interactive.action.sections[0].rows[0].id === "pv:pja-owners:b1:0", "(b) listed / not listed list");
calls.length = 0; await tap(NAJ_NUM, "pv:pja-owners:b1:1");
ok(bodyOf(calls[0]).includes("DLD records show 12 test sales, at a median of AED 1,234 per sq ft") && /handed to Najjuko: Selling path/.test(calls.map(bodyOf).join("|")), "(b) facts read as data; handover shown", calls.map(bodyOf));
ok(!store.has("camp_handover_index"), "(b) no real handover");
// 6. (c) Palm Springs: the brief link goes straight to /cb/, untracked
calls.length = 0; await tap(NAJ_NUM, "pv:pja-owners:s1:2");
ok(bodyOf(calls[0]).includes("https://w/cb/palm-springs") && ![...store.keys()].some((k) => k.startsWith("camp_link_")), "(c) brief link, no tracked link written", bodyOf(calls[0]));
// 7. STOP: confirmation text, NO opt-out
calls.length = 0; await tap(NAJ_NUM, "pv:pja-owners:s1:4");
ok(bodyOf(calls[0]).startsWith("TEST PREVIEW (no opt-out recorded)") && !store.has("camp_optout_" + NAJ_NUM) && !store.has("camp_optout_index"), "STOP in preview writes no opt-out");
// 8. the follow-up template preview
calls.length = 0; await tap(NAJ_NUM, "pv:pja-owners:__:2");
ok(calls[0].body.interactive.type === "button" && bodyOf(calls[0]) === "TEST PREVIEW (template najjuko_market_updates_ask)\n\nHi Ahmed, Najjuko again. No need to reply to my last message. Would you like a short Palm Jebel Ali market update every two weeks? Three numbers, what they mean, nothing more.\n\nNajjuko · BRN 98949 · Tap Stop and I’ll delete your details."
  && calls[0].body.interactive.action.buttons.map((b) => b.reply.title).join() === "Yes please,No thanks,Stop messages", "follow-up wording exact", calls[0] && calls[0].body);
calls.length = 0; await tap(NAJ_NUM, "pv:pja-owners:__:1"); ok(/TEST PREVIEW ended/.test(bodyOf(calls[0])), "End preview");
// 9. a webhook retry of the same message does not send twice
const dupe = { from: NAJ_NUM, id: "same1", type: "text", text: { body: "campaign preview" } };
const post1 = () => worker.fetch(new Request("https://w/wa", { method: "POST", headers: { "X-Azimuth-Forward": env.WA_FORWARD_TOKEN }, body: JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: MAIN }, messages: [dupe] } }] }] }) }), env, ctx);
calls.length = 0; await post1(); await post1(); ok(calls.length === 1, "retry: one send");
// 10. Kendall on the desk number: sent from the desk id, the desk handler never sees it
calls.length = 0; await text(KEN_NUM, "campaign preview", DESK);
ok(calls.length === 1 && calls[0].url.includes("/" + DESK + "/messages") && calls[0].body.to === KEN_NUM && !store.has("wa_desk_last_in"), "Kendall: preview from the desk number, desk handler untouched", [calls, store.get("wa_desk_last_in")]);
// 11. log separate; never stats or shared cap
const log = JSON.parse(store.get("camp_preview_log"));
ok(log.length >= 8 && log.every((x) => x.who.length === 4) && log.some((x) => x.what === "s1.selling"), "camp_preview_log records each choice (last 4 digits only)", log.slice(0, 3));
ok(!store.has("camp_sent24") && ![...store.keys()].some((k) => k.startsWith("camp_stats_")), "never counted against the shared cap or stats");
// 12. no flow in this instance (e.g. meeting-capture's KV): not consumed, behaves as before
store.delete("camp_flow_pja-owners"); const o = await C.campPreview(env, { entry: [{ changes: [{ value: { metadata: {}, messages: [{ from: NAJ_NUM, id: "z", type: "text", text: { body: "campaign preview" } }] } }] }] }, {});
ok(o === null, "no flow stored: event not consumed"); store.set("camp_flow_pja-owners", JSON.stringify(f));
env.CAMP_PREVIEW = "off"; ok((await C.campPreview(env, { entry: [{ changes: [{ value: { messages: [{ from: NAJ_NUM, type: "text", text: { body: "campaign preview" } }] } }] }] }, {})) === null, "CAMP_PREVIEW=off"); delete env.CAMP_PREVIEW;

// facts: a missing fact is "to confirm", an object never prints as a number
ok(C.factText({}, "nope") === "to confirm" && C.factText({ a: { value: [1, 2] } }, "a") === "to confirm" && C.factText({ a: { value: "x" } }, "a") === "x", "factText");
// the brief page: source + date under each fact, gaps "to confirm"
store.set("camp_brief_palm-central", JSON.stringify({ slug: "palm-central", project: "Test Central", developer: { value: "Test Dev", source: "TEST brochure", as_of: "2026-11-03" },
  units_register: { value: "Frond X: 10 units", source: "TEST register", as_of: "2026-11-02" }, price: { value: "1 B/R median AED 1,000,000 (3 sales)", source: "TEST DLD", as_of: "2026-11-02" },
  payment_plan: { value: "to confirm", source: "TEST brochure", as_of: "2026-11-03" }, handover: { value: "", source: "TEST", as_of: "" }, highlights: { value: ["Pool", "Park"], source: "TEST brochure", as_of: "2026-11-03" } }));
r = await worker.fetch(new Request("https://w/cb/palm-central"), env, ctx); const t = await r.text();
ok(r.status === 301 && /\/dp\/palm-central$/.test(r.headers.get("Location") || ""), "v771: /cb/palm-central now opens the district passport (301 to /dp/)", r.status);

console.log("test_v724_campaign_preview: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
