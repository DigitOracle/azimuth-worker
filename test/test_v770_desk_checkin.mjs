// v770: desk check-in - Ask (desk) sends Done / In progress / Stuck buttons from the desk number (template outside the 24 h window, free
// interactive inside it); the desk webhook accepts a button only from the person it was sent to, a text reply inside 24 h is a note, STOP opts out.
import { ckDesk, ckWebhook, saveTeam, ckTemplatePayload, ckInteractive, CK_JS } from "../src/checkin.js";
import { WA_TEMPLATES, buildCreatePayload } from "../src/wa_templates.js";
let fail = 0, n = 0; const ok = (c, m, x) => { n++; if (!c) { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 400)); } else console.log("ok", m); };
const store = new Map();
const env = { WA_DESK_PHONE_ID: "1370146096179819", WA_DESK_OWNER: "971500000001", MEETINGS: {
  get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, String(v)); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [], list_complete: true }) } };
await saveTeam(env, [{ name: "Vishant Rao", phone: "0501234567" }]);
const tasks = [{ name: "Brochure refresh", status: "In progress", percent: 40 }];
const posts = []; let approved = "PENDING";
const deps = () => ({ post: async (p) => { posts.push(p); return new Response(JSON.stringify({ messages: [{ id: "wamid.T" + posts.length }] }), { status: 200 }); }, tplStatus: async () => ({ ok: true, status: approved }), optedOut: async (d) => !!store.get("camp_optout_" + d), cap: 250 });

// 1. template not approved, no window -> refused with waiting, nothing sent
let [st, o] = await ckDesk(env, { kind: "task", name: "Brochure refresh", person: "Vishant Rao" }, tasks, deps());
ok(st === 409 && o.waiting && posts.length === 0, "waiting for Meta approval: nothing sent", o);
store.delete("ck_tpl_no"); approved = "APPROVED";
[st, o] = await ckDesk(env, { kind: "task", name: "Brochure refresh", person: "Vishant Rao" }, tasks, deps());
const p1 = posts[0];
ok(st === 200 && o.sent === "template" && p1.type === "template" && p1.template.name === "najjuko_task_checkin" && p1.to === "971501234567", "approved: the template goes from the desk", o);
ok(p1.template.components[0].parameters.map((x) => x.text).join("|") === "Vishant|Brochure refresh|today", "body: first name, task, due", p1.template.components[0]);
const pays = p1.template.components.slice(1).map((c) => c.parameters[0].payload);
ok(pays.length === 3 && pays.every((x) => /^ck:[A-Za-z0-9_-]{20,40}:(done|progress|stuck)$/.test(x)), "three quick-reply payloads carry the token", pays);
ok(JSON.parse(store.get("camp_sent24")).length === 1, "counted in the shared 24 h cap");
ok(!Object.keys(Object.fromEntries(store)).some((k) => k.startsWith("camp_stats_")), "never in campaign stats");
const tok = pays[0].split(":")[1];

// 2. webhook: a button from someone else is ignored; from Vishant it moves the task
const answers = []; const hooks = { taskAnswer: async (name, ans, who, note, line) => { answers.push({ name, ans, who, note, line }); } };
const sent = []; const wdeps = { send: async (to, t) => sent.push([to, t]), optOut: async (d) => store.set("camp_optout_" + d, "1") };
const ev = (from, msg) => ({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: env.WA_DESK_PHONE_ID }, messages: [Object.assign({ from, id: "wamid.in" + Math.random() }, msg)] } }] }] });
let w = await ckWebhook(env, ev("971509999999", { type: "button", button: { payload: "ck:" + tok + ":done", text: "Done" } }), hooks, wdeps);
ok(w.consumed && answers.length === 0, "a ck: button from another number is consumed but changes nothing", w);
w = await ckWebhook(env, ev("971501234567", { type: "button", button: { payload: "ck:" + tok + ":done", text: "Done" } }), hooks, wdeps);
ok(w.consumed && answers.length === 1 && answers[0].ans === "done" && answers[0].who === "Vishant Rao" && /^Vishant Rao: Done, \d\d:\d\d$/.test(answers[0].line), "Vishant taps Done: the task is answered and logged", answers);
ok(sent.length === 1 && /done/i.test(sent[0][1]), "a short thank-you goes back from the desk", sent);
ok(store.get("ck_in_971501234567") === "1", "his 24 h window is now open");

// 3. inside the window the next ask is a free interactive message with the same 3 buttons
[st, o] = await ckDesk(env, { kind: "task", name: "Brochure refresh", person: "Vishant Rao" }, tasks, deps());
const p2 = posts[posts.length - 1];
ok(st === 200 && o.sent === "buttons" && p2.type === "interactive" && p2.interactive.action.buttons.map((b) => b.reply.title).join("|") === "Done|In progress|Stuck", "inside 24 h: interactive buttons", p2);
ok(/^Hi Vishant, Najjuko here\. Quick check on Brochure refresh, due today\. Where is it\?$/.test(p2.interactive.body.text) && !/Black Coffee/.test(p2.interactive.body.text), "opens Najjuko, never Black Coffee", p2.interactive.body.text);
const tok2 = p2.interactive.action.buttons[1].reply.id.split(":")[1];

// 4. interactive tap "In progress", then a text reply becomes a note, then STOP
w = await ckWebhook(env, ev("971501234567", { type: "interactive", interactive: { type: "button_reply", button_reply: { id: "ck:" + tok2 + ":progress", title: "In progress" } } }), hooks, wdeps);
ok(answers[answers.length - 1].ans === "progress", "In progress is recorded", answers[answers.length - 1]);
w = await ckWebhook(env, ev("971501234567", { type: "text", text: { body: "editing now, done by 5" } }), hooks, wdeps);
ok(w.consumed && answers[answers.length - 1].ans === "note" && answers[answers.length - 1].note === "editing now, done by 5", "a text reply inside 24 h is a note", answers[answers.length - 1]);
w = await ckWebhook(env, ev("971500000001", { type: "text", text: { body: "desk help" } }), hooks, wdeps);
ok(!w || !w.consumed, "the desk owner's own commands are never eaten", w);
w = await ckWebhook(env, ev("971501234567", { type: "text", text: { body: "STOP" } }), hooks, wdeps);
ok(w.consumed && store.get("camp_optout_971501234567") === "1", "STOP opts him out (campaign opt-out store)");
[st, o] = await ckDesk(env, { kind: "task", name: "Brochure refresh", person: "Vishant Rao" }, tasks, deps());
ok(st === 409 && /no more messages/.test(o.error), "after STOP the desk refuses to ask him", o);

// 5. a message to the MAIN number is never touched
w = await ckWebhook(env, { entry: [{ changes: [{ value: { metadata: { phone_number_id: "999" }, messages: [{ from: "971501234567", type: "button", button: { payload: "ck:" + tok + ":done" } }] } }] }] }, hooks, wdeps);
ok(w === null, "events on another number fall through", w);

// 6. the template definition Kendall submits
const t = buildCreatePayload("najjuko_task_checkin");
ok(WA_TEMPLATES.najjuko_task_checkin && t.category === "UTILITY" && t.components[0].text === "Hi {{1}}, Najjuko here. Quick check on {{2}}, due {{3}}. Where is it?" && t.components[1].buttons.map((b) => b.text).join("|") === "Done|In progress|Stuck", "template: utility, exact body, three quick replies", t);
ok(!/offer|discount|buy|sale|promo/i.test(t.components[0].text), "no promotional wording");
let parsed = true; try { new Function(CK_JS); } catch (e) { parsed = false; console.log(e.message); }
ok(parsed && CK_JS.includes('action:"ck_desk"') && !CK_JS.includes('data-w=desk>Ask (desk)'), "served picker parses; Ask (desk) hidden until the desk template is approved (v775d), its send path kept");
ok(ckTemplatePayload("1", "x".repeat(24), "", "", "").template.components[0].parameters.every((p) => p.text === "-"), "empty variables become - (Meta refuses empty)");
ok(ckInteractive("1", "t".repeat(24), "x").interactive.action.buttons.length === 3, "interactive payload has 3 buttons");
console.log("test_v770_desk_checkin: " + (n - fail) + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
