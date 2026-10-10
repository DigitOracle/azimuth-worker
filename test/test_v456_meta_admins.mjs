// v456 - "lab meta admins": who runs the business on Meta, read with the worker's token, shown only on the desk. Offline.   node test/test_v456_meta_admins.mjs
import { deskHandle } from "../src/desk.js";

const OWNER = "971562276093", STRANGER = "971500001234", PID = "1370146096179819";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const texts = [], fetches = []; let mode = "ok";
globalThis.fetch = async (u, init) => { const s = String(u); fetches.push({ u: s, auth: init && init.headers && init.headers.Authorization });
  if (mode === "denied") return new Response(JSON.stringify({ error: { message: "(#200) Requires business_management permission" } }));
  if (/business_users/.test(s)) return new Response(JSON.stringify({ data: [{ name: "Kendall Wilson", email: "owner@example.com", role: "ADMIN" }] }));
  if (/system_users/.test(s)) return new Response(JSON.stringify({ data: [{ name: "azimuth-bot", role: "ADMIN" }] }));
  if (/assigned_users/.test(s)) return new Response(JSON.stringify({ data: [{ name: "Kendall Wilson", tasks: ["MANAGE"] }] }));
  if (/1588773749592854\?fields/.test(s)) return new Response(JSON.stringify({ name: "Digital Abbot", owner_business_info: { name: "DigitAlchemy", id: "1730729287953659" } }));
  return new Response("{}"); };
const lab = { owner: OWNER, pid: PID, graph: "https://graph.facebook.com/v21.0", raw: async () => ({}), send: async (e, t) => texts.push(t), image: async () => {}, origin: () => "", sleep: async () => {}, briefLink: () => "" };
const env = { MEETINGS: KV, WA_DESK_PHONE_ID: PID, WA_DESK_OWNER: OWNER, WHATSAPP_TOKEN: "SECRET-TOKEN" };
const post = { send: async () => {}, buttons: async () => {}, image: async () => {}, llm: async () => "", fetchMedia: async () => ({}), origin: () => "", now: () => Date.now(), sleep: async () => {} };
const deps = { waSend: async (e, to, t) => texts.push("[waSend to " + to + "] " + t), post, lab };
let mid = 0;
const body = (from, t) => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: PID }, messages: [{ from, id: "wamid.in" + ++mid, type: "text", text: { body: t } }] } }] }] });
const say = async (t, from) => { texts.length = 0; fetches.length = 0; await deskHandle(env, body(from || OWNER, t), deps); };
store.set("wa_desk_seen", "1");

await say("lab meta admins");
const r = texts.join("\n");
ok(/Kendall Wilson - owner@example\.com - ADMIN/.test(r), "lists each person with login email and role", r);
ok(/owned by DigitAlchemy \(1730729287953659\)/.test(r) && /System users/.test(r) && /assigned to the WhatsApp account: Kendall Wilson \[MANAGE\]/.test(r), "shows the owner business, the system users and who is assigned", r);
ok(fetches.every((f) => f.auth === "Bearer SECRET-TOKEN") && !/SECRET-TOKEN/.test(r), "uses the worker's token and never shows it");
ok(fetches.every((f) => !/POST/.test(f.method || "")), "read-only");
mode = "denied"; await say("lab meta admins");
ok(/People: not readable\. Meta said: \(#200\) Requires business_management permission/.test(texts.join("\n")), "a missing permission comes back in Meta's own words", texts.join("\n"));
mode = "ok"; await say("lab meta admins", STRANGER);
ok(!texts.some((t) => /owner@example\.com/.test(t)), "a stranger gets nothing");
await say("lab");
ok(/lab meta admins/.test(texts[0]), "it is on the lab menu");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
