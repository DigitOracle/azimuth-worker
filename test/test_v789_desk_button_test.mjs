// v789: the Desk button is in Najjuko's check-in pop-up beside My WhatsApp, and the owner's test send (ck_desk_test) goes out as the approved
// template with a "test" token that is thanked and changes nothing of hers.
import fs from "fs";
import { ckDeskTest, ckWebhook, CK_JS } from "../src/checkin.js";
let fail = 0, n = 0; const ok = (c, m, x) => { n++; if (!c) { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 400)); } else console.log("ok", m); };
const store = new Map();
const env = { WA_DESK_PHONE_ID: "1370146096179819", WA_DESK_OWNER: "971562270000", MEETINGS: {
  get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, String(v)); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [], list_complete: true }) } };
const posts = []; let approved = "PENDING";
const deps = () => ({ post: async (p) => { posts.push(p); return new Response(JSON.stringify({ messages: [{ id: "wamid.T" + posts.length }] }), { status: 200 }); }, tplStatus: async () => ({ ok: true, status: approved }), optedOut: async (d) => !!store.get("camp_optout_" + d), cap: 250 });

// the pop-up
let parsed = true; try { new Function(CK_JS); } catch (e) { parsed = false; console.log(e.message); }
ok(parsed, "served picker still parses");
ok(CK_JS.includes("data-w=me>My WhatsApp</button>") && CK_JS.includes("data-w=desk>Desk</button>"), "a person with a number gets two buttons: My WhatsApp and Desk");
ok(CK_JS.includes("id=ck_hint") && !/`/.test(CK_JS), "one line of help; no backticks in the served script");

// the owner's test send
let [st, o] = await ckDeskTest(env, { to: "0501234567", name: "Kendall" }, deps());
ok(st === 400 && posts.length === 0, "a number not written as 9715xxxxxxxx is refused", o);
store.set("ck_tpl_no", "PENDING");
[st, o] = await ckDeskTest(env, { to: "971562270000", name: "Kendall" }, deps());
ok(st === 409 && o.waiting && posts.length === 0, "not approved at Meta: nothing sent", o);
approved = "APPROVED";
[st, o] = await ckDeskTest(env, { to: "971562270000", name: "Kendall Wilson" }, deps());
const p = posts[0];
ok(st === 200 && o.ok && o.wamid === "wamid.T1" && p.type === "template" && p.template.name === "najjuko_task_checkin" && p.to === "971562270000", "approved: the template goes out, Meta is asked fresh (the stored 'no' is ignored)", o);
ok(p.template.components[0].parameters.map((x) => x.text).join("|") === "Kendall|Test check-in (ignore)|today", "body: first name, test subject, today", p.template.components[0]);
ok(store.get("ck_tpl_ok") && !store.has("ck_tpl_no") && JSON.parse(store.get("camp_sent24")).length === 1, "approval remembered; the send counts in the shared 24 h cap");
store.set("camp_optout_971553000000", "1");
[st, o] = await ckDeskTest(env, { to: "971553000000", name: "X" }, deps());
ok(st === 409 && posts.length === 1, "an opted-out number is never messaged", o);

// a tap on the test message: thanked, nothing of hers touched
const pay = p.template.components[1].parameters[0].payload, sent = []; let touched = 0;
const hooks = { taskAnswer: async () => { touched++; } };
const body = (from, payload) => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: env.WA_DESK_PHONE_ID }, messages: [{ from, type: "button", button: { payload } }] } }] }] });
let out = await ckWebhook(env, body("971562270000", pay), hooks, { send: async (to, t) => { sent.push([to, t]); } });
ok(out && out.consumed && out.answers.length === 0 && touched === 0 && /This was a test/.test(sent[0][1]), "test button tap: consumed, thanked, no task answer written", { out, sent });
out = await ckWebhook(env, body("971500000009", pay), hooks, { send: async (to, t) => { sent.push([to, t]); } });
ok(out.consumed && sent.length === 1 && touched === 0, "the same button from another number does nothing");

// the route: the owner's action is checked before the Najjuko-only gate, and is Kendall's alone
const wl = fs.readFileSync(new URL("../src/work_log.js", import.meta.url), "utf8");
const iTest = wl.indexOf('b.action === "ck_desk_test"'), iGate = wl.indexOf('/^(sync_|ck_)/.test(String(b.action || "")) && prof.person !== "najjuko"');
ok(iTest > 0 && iGate > iTest && /b\.action === "ck_desk_test"\) \{[^}]*prof\.person !== "kendall"\) return J\(\{ ok: false[^}]*\}, 403\)/.test(wl), "ck_desk_test sits before the Najjuko-only gate and refuses everyone but Kendall");
console.log("test_v789_desk_button_test: " + (n - fail) + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
