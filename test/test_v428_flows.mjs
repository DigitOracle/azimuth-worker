// v428 - WhatsApp Flows: the client brief as a form, offline (fake KV, fake fetch, fake WhatsApp). Nothing leaves.   node test/test_v428_flows.mjs
import { briefFlowJson, flowMessage, answersToQuery, briefReplyText, flowReply, sendBriefFlow, flowSetupRoute, FLOW_AREAS, FLOW_KEY } from "../src/wa_flows.js";

const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const sent = [], posts = [];
const deps = { send: async (e, to, t) => sent.push({ to, t }), post: async (e, p) => { posts.push(p); return {}; }, briefLink: (e, sp) => "https://x/brief?" + sp.toString() + "&key=CLIENTKEY" };
const env = { MEETINGS: KV, READ_KEY: "OWNERKEY", WHATSAPP_TOKEN: "T" };

// 1. the Flow JSON is well formed for a no-endpoint form
const j = briefFlowJson();
ok(j.screens.length === 2 && j.screens[1].terminal === true && !j.data_api_version && !j.routing_model, "two screens, the last terminal, no data endpoint");
const groups = j.screens.flatMap((s) => s.layout.children).filter((c) => c.type === "CheckboxGroup" || c.type === "RadioButtonsGroup");
ok(groups.every((g) => g["data-source"].length >= 1 && g["data-source"].length <= 20), "every choice group has 1 to 20 options (Meta's limit)", groups.map((g) => g.name + ":" + g["data-source"].length).join(" "));
ok(groups.every((g) => g["data-source"].every((o) => o.title.length <= 30 && o.id)), "every option has an id and a title of at most 30 characters");
const names = j.screens.flatMap((s) => s.layout.children).map((c) => c.name).filter(Boolean);
ok(new Set(names).size === names.length, "field names are unique");
ok(FLOW_AREAS.length >= 30 && FLOW_AREAS.length <= 40, "the area list fits two groups of 20", FLOW_AREAS.length);
const foot2 = j.screens[1].layout.children.find((c) => c.type === "Footer");
ok(foot2["on-click-action"].name === "complete" && /\$\{form\.max\}/.test(JSON.stringify(foot2)), "Submit completes the form with the answers");

// 2. the message that opens it
const m = flowMessage("971500000000", "123", "brief:abc");
ok(m.interactive.type === "flow" && m.interactive.action.parameters.flow_id === "123" && m.interactive.action.parameters.flow_token === "brief:abc" && m.interactive.action.parameters.flow_action_payload.screen === "HOME", "the open-form message carries the Flow id, our token and the first screen");

// 3. answers -> the Brief's query, with anything outside its vocabulary dropped
let a = answersToQuery({ client: "Ms Rahman", mode: "rent", beds: ["1", "2"], type: "apartment", areas1: ["dubaimarina", "jltnorth"], areas2: [], max: "120,000", min: "", musts: ["metro", "gym"] });
ok(a.sp.get("mode") === "rent" && a.sp.get("beds") === "1,2" && a.sp.get("type") === "apartment" && a.sp.get("areas") === "dubaimarina,jltnorth" && a.sp.get("max") === "120000" && !a.sp.has("min") && a.sp.get("musts") === "metro,gym" && a.client === "Ms Rahman", "a full set of answers becomes the Brief query", a.sp.toString());
a = answersToQuery({ mode: "lease", beds: ["9", "studio"], type: "castle", areas1: ["atlantis", "palmjumeirah"], max: "abc", min: "200000", musts: ["helipad"] });
ok(a.sp.get("mode") === "rent" && a.sp.get("beds") === "studio" && a.sp.get("type") === "any" && a.sp.get("areas") === "palmjumeirah" && !a.sp.has("max") && a.sp.get("min") === "200000" && !a.sp.has("musts"), "unknown values are dropped, never guessed", a.sp.toString());
a = answersToQuery({ mode: "buy", beds: "2", max: "1000000", min: "3000000" });
ok(a.sp.get("min") === "1000000" && a.sp.get("max") === "3000000", "a reversed budget is put the right way round");
ok(answersToQuery({ client: "<script>x</script> Bob" }).client.indexOf("<") === -1, "the client name is cleaned");

// 4. the reply text
const q = answersToQuery({ mode: "rent", beds: ["1"], max: "100000", areas1: ["dubaimarina"] }).sp;
let t = briefReplyText(q, "Ms Rahman", { results: [
  { name: "Marina Gate 2", district_name: "Dubai Marina", evidence: { median: 98000, n: 23 } },
  { name: "Dubai Marina", district_name: "Dubai Marina", area_figure: true, evidence: { median: 95000, n: 410 } }] }, "https://x/brief?k");
ok(/^Brief for Ms Rahman: Rent, 1 bed, up to AED 100,000, 1 area\(s\)\./.test(t) && /1\. Marina Gate 2, Dubai Marina: typical AED 98,000 a year \(23 contracts\)/.test(t) && /2\. Dubai Marina \(area figure\): typical AED 95,000/.test(t) && /Full Brief, map and client sheets: https:\/\/x\/brief\?k/.test(t), "the reply lists the matches with their figure and evidence, and the link", t);
t = briefReplyText(answersToQuery({ mode: "buy", beds: ["2"] }).sp, "", { results: [{ name: "A", district_name: "B", evidence: { median: 2000000, n: 5 } }] }, "");
ok(/typical AED 2,000,000 \(5 sales\)/.test(t) && !/a year/.test(t), "a purchase says sales, not a year", t);
t = briefReplyText(q, "", { results: [], empty: "No building in Dubai Marina has 1-bed lettings under AED 100,000." }, "L");
ok(/No building in Dubai Marina/.test(t), "an empty result uses the Brief's own explanation");

// 5. sending the form: refuses politely until the Flow is set up, then sends it
sent.length = 0; posts.length = 0;
await sendBriefFlow(env, "971500000000", deps);
ok(posts.length === 0 && /not set up yet/.test(sent[0].t), "before setup it says so and sends nothing");
store.set(FLOW_KEY, "555"); sent.length = 0;
await sendBriefFlow(env, "971500000000", deps);
ok(posts.length === 1 && posts[0].interactive.action.parameters.flow_id === "555" && /^brief:/.test(posts[0].interactive.action.parameters.flow_token), "after setup the form is sent with the stored id");

// 6. a reply that is not ours is left alone
ok((await flowReply(env, "x", { interactive: { nfm_reply: { response_json: JSON.stringify({ flow_token: "other:1" }) } } }, deps)) === false, "another form's answers are not taken");
ok((await flowReply(env, "x", { interactive: { button_reply: { id: "a" } } }, deps)) === false, "a button press is not taken");

// 7. setup route: owner only; dry run shows the JSON; apply posts it and stores the id
let r = await flowSetupRoute(env, new URL("https://x/wa_flow_setup"), { graph: "https://graph" });
ok(r.status === 401, "no key: refused");
r = await flowSetupRoute(env, new URL("https://x/wa_flow_setup?key=OWNERKEY&waba=123"), { graph: "https://graph" });
let body = await r.json();
ok(body.dry === true && body.flow_json.screens.length === 2, "dry run shows the form and changes nothing");
let calls = [];
globalThis.fetch = async (u, init) => { calls.push({ u: String(u), body: init.body }); return new Response(JSON.stringify({ id: "999", success: true, validation_errors: [] })); };
store.delete(FLOW_KEY);
r = await flowSetupRoute(env, new URL("https://x/wa_flow_setup?key=OWNERKEY&waba=123&apply=1"), { graph: "https://graph" });
body = await r.json();
ok(body.ok && store.get(FLOW_KEY) === "999" && calls[0].u === "https://graph/123/flows" && calls[0].body.get("publish") === "true", "apply creates and publishes the Flow on the right account and stores its id", JSON.stringify(body));
globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "Invalid Flow JSON" } }), { status: 400 });
store.delete(FLOW_KEY);
r = await flowSetupRoute(env, new URL("https://x/wa_flow_setup?key=OWNERKEY&waba=123&apply=1"), { graph: "https://graph" });
body = await r.json();
ok(!body.ok && !store.has(FLOW_KEY) && /Invalid Flow JSON/.test(JSON.stringify(body.meta)), "a refusal from Meta is shown and nothing is stored");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
