// v833 - the three FN Realty owner templates: payload shape, Meta limits, and the route uploading the IMAGE header sample.
// fetch is mocked: no Meta call, no real KV.
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { WA_TEMPLATES, buildCreatePayload } from "../src/wa_templates.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

const NAMES = ["najjuko_owner_general_v1", "najjuko_owner_followup_v1", "najjuko_market_update_v1"];
for (const name of NAMES) {
  const t = WA_TEMPLATES[name]; ok(t, name + " defined");
  const p = buildCreatePayload(name, "4::HANDLE");
  ok(p.name === name && p.language === "en" && p.category === "MARKETING", name + " name/lang/category");
  const body = p.components.find((c) => c.type === "BODY");
  ok(body.text.length <= 1024, name + " body <= 1024 (" + body.text.length + ")");
  const vars = (body.text.match(/\{\{\d+\}\}/g) || []).length;
  ok(body.example && body.example.body_text[0].length === vars, name + " one example per variable");
  ok(!/\{\{\d+\}\}\s*$/.test(body.text) && !/^\s*\{\{/.test(body.text), name + " no variable at start/end");
  const btn = p.components.find((c) => c.type === "BUTTONS");
  ok(btn && btn.buttons.length >= 3 && btn.buttons.length <= 10, name + " 3-10 buttons");
  ok(btn.buttons.every((b) => b.type === "QUICK_REPLY" && b.text.length <= 25), name + " quick replies, text <= 25");
  ok(btn.buttons.some((b) => b.text === "Stop messages"), name + " has Stop messages");
  ok(!p.components.some((c) => c.type === "FOOTER"), name + " no footer");
}
const g = buildCreatePayload("najjuko_owner_general_v1", "4::HANDLE");
ok(g.components[0].type === "HEADER" && g.components[0].format === "IMAGE" && g.components[0].example.header_handle[0] === "4::HANDLE", "general: IMAGE header first");
ok(g.components[2].buttons.map((b) => b.text).join("|") === "Exploring selling|Exploring leasing|Keep me informed|Stop messages", "general: four buttons in order");
ok(!buildCreatePayload("najjuko_owner_followup_v1").components.some((c) => c.type === "HEADER"), "followup: no header");
ok(!buildCreatePayload("najjuko_market_update_v1").components.some((c) => c.type === "HEADER"), "market update: no header");

// The route: dry run by default, then a real submit uploads the stored JPEG and posts the handle.
const kv = new Map([["tplhdr_naj_pja_intro", new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).buffer]]);
const MEETINGS = { get: async (k) => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, v); }, delete: async (k) => { kv.delete(k); }, list: async () => ({ keys: [] }) };
const env = { READ_KEY: "ownerkey", WHATSAPP_TOKEN: "T", WA_PHONE_ID: "1", WA_ALLOWED: "971500000000", WABA_ID: "", MEETINGS };
let calls = [];
globalThis.fetch = async (u, o) => {
  u = String(u); calls.push({ u, o });
  if (/\/app$/.test(u)) return new Response(JSON.stringify({ id: "APP1" }));
  if (/\/uploads\?/.test(u)) return new Response(JSON.stringify({ id: "upload:S1" }));
  if (/upload:S1/.test(u)) return new Response(JSON.stringify({ h: "4::REALHANDLE" }));
  if (/message_templates/.test(u)) return new Response(JSON.stringify({ id: "777", status: "PENDING", category: "MARKETING" }));
  return new Response("{}");
};
const call = (q) => worker.fetch(new Request("https://x.test/wa_template_create?" + q, { method: "POST" }), env, { waitUntil() {} });
let r = await call("name=najjuko_owner_general_v1&confirm=yes&key=ownerkey"); let j = await r.json();
ok(j.dry === true && calls.length === 0, "dry by default, nothing sent");
r = await call("name=najjuko_owner_general_v1&confirm=yes&dry=0&waba=W1&key=ownerkey"); j = await r.json();
ok(j.ok && j.id === "777" && j.status === "PENDING" && j.category === "MARKETING", "submit returns id/status/category");
const up = calls.find((c) => /\/uploads\?/.test(c.u)); ok(up && /file_type=image%2Fjpeg/.test(up.u), "uploads as image/jpeg");
const post = calls.find((c) => /W1\/message_templates/.test(c.u)); const sent = JSON.parse(post.o.body);
ok(sent.components[0].example.header_handle[0] === "4::REALHANDLE", "posted payload carries the uploaded handle");
kv.delete("tplhdr_naj_pja_intro"); calls = [];
r = await call("name=najjuko_owner_general_v1&confirm=yes&dry=0&waba=W1&key=ownerkey");
ok(r.status === 400 && !calls.some((c) => /message_templates/.test(c.u)), "missing header image: refused, nothing posted");
console.log("v833 naj owner templates: " + n + " checks passed");
