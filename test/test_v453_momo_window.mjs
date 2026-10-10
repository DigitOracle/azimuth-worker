// v453 - Momo for a forwarded guest whose 24-hour WhatsApp window is shut (Kendall, 9-10 Oct 2026), offline: fake KV, fake sends.
//   node test/test_v453_momo_window.mjs
import worker from "../src/index.js";
import * as fit from "../src/fit.js";
import { deskHandle } from "../src/desk.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const store = new Map();
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k).v; return t === "json" ? JSON.parse(v) : v; },
  async put(k, v, o) { store.set(k, { v, meta: o && o.metadata }); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.entries()].filter(([k]) => k.startsWith(p)).map(([name, e]) => ({ name, metadata: e.meta })), list_complete: true }; },
};
const HER = "971565484397", HIM = "971562276093", READ = "owner_admin_key_never_in_client_links_0001";
const fetches = [];
globalThis.fetch = async (input, init) => {
  const u = String((input && input.url) || input), method = (init && init.method) || "GET";
  fetches.push({ u, method, body: init && init.body, headers: init && init.headers });
  if (/\/message_templates\?name=/.test(u)) return new Response(JSON.stringify({ data: [{ name: "momo_day_check", language: "en", status: "REJECTED", category: "UTILITY", rejected_reason: "INVALID_FORMAT" }] }));
  if (/\/message_templates$/.test(u) && method === "POST") return new Response(JSON.stringify(globalThis.__tplAnswer || { id: "991", status: "PENDING", category: "UTILITY" }));
  return new Response(JSON.stringify({ messages: [{ id: "wamid.x" }] }));
};
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: "client_key_current_abcdefghij", WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", WA_FORWARD_TOKEN: "FWD",
  FIT_USERS: "kendall:" + HIM + ":Dr. Doli,najjuko:" + HER + ":Black Coffee", FIT_DAY_TEMPLATE: "momo_day_check", FIT_DAY_LANG: "en", FIT_WA_NUMBER: "971585876093",
  MAILBOXES: "", ADD_TO: "", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const T = (iso) => Date.parse(iso);
let tpl = [], texts = [];
const deps = { waSend: async (e, to, b) => texts.push({ to, b }), waSendButtons: async (e, to, b) => texts.push({ to, b }),
  waSendTemplate: async (e, to, name, lang, params, qr) => tpl.push({ to, name, lang, params, qr }), ownerWindowOpen: async () => true };
const reset = () => { tpl = []; texts = []; };

await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: "2026-10-03" }, Object.assign({}, fit.FIT_CFG_DEFAULT, { u: "kendall" })));
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: "2026-10-03" }, Object.assign({}, fit.FIT_CFG_DEFAULT, { u: "najjuko" })));

console.log("closed window -> the template, once a day");
store.set("fitc_in_kendall", { v: "2026-10-08T00:03:00.000Z" });   // last opened 8 Oct 00:03 UTC
reset(); await fit.fitEvening(env, deps, T("2026-10-09T17:05:00Z"));   // 21:05 Dubai, 9 Oct
const k1 = tpl.filter((x) => x.to === HIM);
ok(k1.length === 1 && k1[0].name === "momo_day_check" && k1[0].lang === "en" && k1[0].params[0] === "Dr. Doli" && /logged/.test(k1[0].params[1]) && !/\n/.test(k1[0].params[1]) && k1[0].qr[0] === "fit:open", "21:00 with his window shut: momo_day_check to his number, his name, one-line day, button payload fit:open", JSON.stringify(tpl));
ok(!texts.some((x) => x.to === HIM), "no free text to him while the window is shut");
reset(); await fit.fitEvening(env, deps, T("2026-10-09T17:15:00Z"));
ok(!tpl.some((x) => x.to === HIM), "the next tick the same evening sends nothing more");
reset(); await fit.fitMorning(env, deps, T("2026-10-10T01:05:00Z"));   // 05:05 Dubai, 10 Oct: a new day
ok(tpl.filter((x) => x.to === HIM).length === 1 && /yesterday/.test(tpl[0].params[1]), "the 05:00 opener on the next day: one template, about yesterday", JSON.stringify(tpl));
reset(); await fit.fitMorning(env, deps, T("2026-10-10T02:05:00Z")); await fit.fitEvening(env, deps, T("2026-10-10T17:05:00Z"));
ok(!tpl.some((x) => x.to === HIM), "never two on the same day: later morning ticks and that evening share the flag");
ok(!!store.get("fitc_nudge_kendall_2026-10-10") && !!store.get("fitc_nudge_kendall_2026-10-09"), "the shared fitc_nudge_<user>_<day> flag is used");

console.log("the button reopens the window and the full message follows");
reset();
const btn = { from: HIM, id: "wamid.btn1", type: "button", button: { payload: "fit:open", text: "Log today" } };
ok((await fit.fitGuest(env, HIM, btn, deps)) === true, "a forwarded template button reply is taken by Momo");
ok(Date.now() - Date.parse(store.get("fitc_in_kendall").v) < 5000, "the tap records the window as open (fitc_in_kendall now)");
ok(texts.some((x) => x.to === HIM && /DAY \d+|Good morning/i.test(x.b)), "the held 05:00 opener follows in full", JSON.stringify(texts).slice(0, 300));
ok(!store.has("fitc_pend_kendall"), "the held message is sent once and forgotten");
reset(); await fit.fitGuest(env, HIM, Object.assign({}, btn, { id: "wamid.btn2" }), deps);
ok(texts.length === 1 && /open again/.test(texts[0].b), "a second tap with nothing held just says the window is open");
const other = { from: HIM, id: "wamid.btn3", type: "button", button: { payload: "something_else", text: "x" } };
ok((await fit.fitGuest(env, HIM, other, deps)) === false, "a template button that is not Momo's is not taken");

console.log("open window -> normal free text");
store.set("fitc_in_kendall", { v: new Date(T("2026-10-11T15:00:00Z")).toISOString() });
reset(); await fit.fitEvening(env, deps, T("2026-10-11T17:05:00Z"));
ok(!tpl.some((x) => x.to === HIM) && texts.some((x) => x.to === HIM && /VERDICT|check-in/i.test(x.b)), "his window open: the verdict goes as free text, no template", JSON.stringify({ tpl, texts }).slice(0, 300));
ok(tpl.length === 0, "the owner (window open) gets no template either");

console.log("unconfigured -> nothing");
store.delete("fitc_in_kendall"); reset();
await fit.fitEvening(Object.assign({}, env, { FIT_DAY_TEMPLATE: "" }), deps, T("2026-10-12T17:05:00Z"));
ok(!tpl.some((x) => x.to === HIM) && !texts.some((x) => x.to === HIM), "without FIT_DAY_TEMPLATE a shut window sends nothing (as before)");

console.log("the page link");
const w0 = await fit.fitWindow(env, "kendall", Date.now());
ok(w0.guest && w0.open === false && w0.link === "https://wa.me/971585876093?text=momo", "shut: the link is given", JSON.stringify(w0));
store.set("fitc_in_kendall", { v: new Date(Date.now() - 2 * 3600000).toISOString() });
const w1 = await fit.fitWindow(env, "kendall", Date.now());
ok(w1.open === true && w1.link === "" && w1.hoursLeft > 20, "open with hours left: no link", JSON.stringify(w1));
store.set("fitc_in_kendall", { v: new Date(Date.now() - 21 * 3600000).toISOString() });
const w2 = await fit.fitWindow(env, "kendall", Date.now());
ok(w2.open === true && w2.link && w2.hoursLeft < 3, "nearly shut: the link is given", JSON.stringify(w2));
const w3 = await fit.fitWindow(env, "najjuko", Date.now());
ok(w3.guest === false && w3.link === "", "the instance owner never gets the link");
ok(!/key=|token|FWD|owner_admin/.test(JSON.stringify(w0)) && Object.keys(w0).sort().join() === "guest,hoursLeft,link,open","the link carries no key or secret");
store.delete("fitc_in_kendall");
const r = await worker.fetch(new Request(env.PUBLIC_ORIGIN + "/fit_api?key=" + READ + "&u=kendall"), env, { waitUntil() {} });
const j = await r.json();
ok(j.window && j.window.link === "https://wa.me/971585876093?text=momo", "GET /fit_api carries window {open, hoursLeft, link}", JSON.stringify(j.window));
const j2 = await (await worker.fetch(new Request(env.PUBLIC_ORIGIN + "/fit_api?key=" + READ + "&u=najjuko"), env, { waitUntil() {} })).json();
ok(j2.window && !j2.window.link, "and none for the owner");
const page = await (await worker.fetch(new Request(env.PUBLIC_ORIGIN + "/fit?key=" + READ), env, { waitUntil() {} })).text();
ok(/id="wawin" hidden/.test(page) && /Send to Momo on WhatsApp/.test(page) && /function wawin/.test(page), "the page has the hidden link, shown only from the window field");

console.log("the desk command");
const OWNER = "971562276093", PID = "1370146096179819", dtexts = [];
const lab = { owner: OWNER, pid: PID, graph: "https://graph.facebook.com/v21.0", raw: async () => ({}), send: async (e, t) => dtexts.push(t), image: async () => {}, origin: () => env.PUBLIC_ORIGIN, sleep: async () => {}, briefLink: () => "" };
const denv = { MEETINGS: KV, WA_DESK_PHONE_ID: PID, WA_DESK_OWNER: OWNER, WHATSAPP_TOKEN: "T" };
const post = { send: async () => {}, buttons: async () => {}, image: async () => {}, llm: async () => "", fetchMedia: async () => ({}), origin: () => "", now: () => Date.now(), sleep: async () => {} };
let mid = 0;
const say = async (t, from) => { dtexts.length = 0; fetches.length = 0; await deskHandle(denv, { entry: [{ changes: [{ value: { metadata: { phone_number_id: PID }, messages: [{ from: from || OWNER, id: "wamid.d" + ++mid, type: "text", text: { body: t } }] } }] }] }, { waSend: async () => {}, post, lab }); };
store.set("wa_desk_seen", { v: "1" });
await say("lab setup momo template 1588773749592854");
ok(/Dry run/.test(dtexts[0]) && /momo_day_check/.test(dtexts[0]) && /UTILITY/.test(dtexts[0]) && /Hello \{\{1\}\}, your Momo day: \{\{2\}\}\./.test(dtexts[0]) && /Log today/.test(dtexts[0]) && !fetches.some((f) => f.method === "POST"), "dry run shows name, category, body, example and button, and posts nothing", dtexts[0]);
await say("lab setup momo template 1588773749592854 go");
const p = fetches.find((f) => f.method === "POST");
const sent = p && JSON.parse(p.body);
ok(p && /\/1588773749592854\/message_templates$/.test(p.u) && sent.name === "momo_day_check" && sent.category === "UTILITY" && sent.language === "en" && sent.components[1].buttons[0].type === "QUICK_REPLY", "go POSTs the template to /<waba>/message_templates", p && p.u);
ok(/id 991/.test(dtexts[0]) && /Status: PENDING/.test(dtexts[0]), "Meta's status comes back", dtexts[0]);
globalThis.__tplAnswer = { error: { message: "Invalid parameter", error_user_title: "Template already exists", error_user_msg: "Content in this language already exists." } };
await say("lab setup momo template 1588773749592854 go");
ok(/Meta said: Invalid parameter \| Template already exists \| Content in this language already exists\./.test(dtexts[0]) && /REJECTED/.test(dtexts[0]) && /INVALID_FORMAT/.test(dtexts[0]), "a refusal comes back verbatim, with the status already on the account", dtexts[0]);
await say("lab setup momo template 1588773749592854 go", "971500001234");
ok(!dtexts.length && !fetches.some((f) => f.method === "POST"), "a stranger cannot submit it");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
