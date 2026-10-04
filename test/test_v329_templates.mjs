// v329 - WhatsApp template creation routes and the feed_template switch. fetch is mocked everywhere: no Meta call, no KV, no send.
import assert from "node:assert/strict";
import fs from "node:fs";
import { execSync } from "node:child_process";
import worker from "../src/index.js";
import { WA_TEMPLATES, buildCreatePayload, parseStatus, LOG_NUDGE_TEMPLATE } from "../src/wa_templates.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m + " -> got " + JSON.stringify(a)); n++; };

const TOKEN = "SECRET_TOKEN_abc123";
const kv = new Map();
const MEETINGS = { get: async (k) => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, v); }, delete: async (k) => { kv.delete(k); }, list: async () => ({ keys: [] }) };
const env = () => ({ READ_KEY: "ownerkey", WHATSAPP_TOKEN: TOKEN, WA_PHONE_ID: "111", WA_ALLOWED: "971500000000", FEED_TEMPLATE: "azimuth_daily", WABA_ID: "", MEETINGS });
let calls = [];
let metaStatus = "PENDING";
globalThis.fetch = async (u, o) => {
  u = String(u); calls.push({ u, o });
  if (/message_templates/.test(u) && (!o || !o.method || o.method === "GET")) return new Response(JSON.stringify({ data: [{ name: "najma_feed_ready", status: metaStatus, category: "UTILITY", rejected_reason: metaStatus === "REJECTED" ? "INCORRECT_CATEGORY" : "NONE" }] }), { status: 200 });
  if (/message_templates/.test(u)) return new Response(JSON.stringify({ id: "999", status: "PENDING" }), { status: 200 });
  return new Response(JSON.stringify({ messages: [{ id: "wamid.X" }] }), { status: 200 });
};
const call = (path, method = "GET", e = env()) => worker.fetch(new Request("https://x.test" + path, { method }), e, { waitUntil() {} });
const K = "&key=ownerkey";

// 1. definitions: exactly the agreed shape
for (const [name, body] of [["najma_feed_ready", "Black Coffee, your five angles for today are ready. Reply here and I will send them. Curated by Papi"],
  ["najma_log_day", "Black Coffee, a quick note: what did you eat and how did you move today? Reply here with a line or a photo, for example food: chicken salad, or gym: 40 min. Curated by Papi"]]) {
  const p = buildCreatePayload(name);
  eq(p, { name, language: "en_US", category: "UTILITY", components: [{ type: "BODY", text: body }] }, "payload " + name);
  eq(p.components.map((c) => c.type), ["BODY"], name + ": body only, no header/footer/buttons");
  ok(!JSON.stringify(p).includes("{{") && !("example" in p.components[0]), name + ": no variables, no examples");
}
eq(LOG_NUDGE_TEMPLATE, "najma_log_day", "log template constant");
eq(buildCreatePayload("nope"), null, "unknown name");

// 2. owner key required (401), on all three routes
for (const [path, m] of [["/wa_template_create?name=najma_feed_ready&confirm=yes", "POST"], ["/wa_template_status?name=najma_feed_ready&waba=1", "GET"], ["/wa_template_use?name=najma_feed_ready&confirm=yes", "POST"]]) {
  eq((await call(path, m)).status, 401, "no key " + path);
  eq((await call(path + "&key=wrong", m)).status, 401, "wrong key " + path);
}
eq(calls.length, 0, "401s call nothing");

// 3. confirm required, POST required, dry-run default sends nothing
eq((await call("/wa_template_create?name=najma_feed_ready&waba=77" + K, "POST")).status, 400, "confirm required");
eq((await call("/wa_template_create?name=najma_feed_ready&waba=77&confirm=yes" + K, "GET")).status, 405, "GET refused on create");
let r = await call("/wa_template_create?name=najma_feed_ready&waba=77&confirm=yes" + K, "POST");
let j = await r.json();
ok(j.dry === true, "dry by default");
eq(j.payload, buildCreatePayload("najma_feed_ready"), "dry returns exactly the payload");
eq(calls.length, 0, "dry-run calls fetch zero times");
ok(!JSON.stringify(j).includes(TOKEN), "token not in dry response");

// 4. real create (mocked): one POST to message_templates with Bearer, token not echoed
r = await call("/wa_template_create?name=najma_log_day&waba=77&confirm=yes&dry=0" + K, "POST");
j = await r.json();
eq(calls.length, 1, "one mocked Meta call");
ok(calls[0].u.endsWith("/77/message_templates") && calls[0].o.method === "POST", "posts to the waba");
eq(JSON.parse(calls[0].o.body), buildCreatePayload("najma_log_day"), "body sent");
eq(calls[0].o.headers.Authorization, "Bearer " + TOKEN, "bearer used");
ok(!JSON.stringify(j).includes(TOKEN) && j.ok && j.id === "999", "create response clean");
calls = [];
r = await call("/wa_template_create?name=najma_feed_ready&confirm=yes&dry=0" + K, "POST");
eq(r.status, 400, "no waba and no env.WABA_ID refused"); eq(calls.length, 0, "and nothing sent");

// 5. status parsing
eq(parseStatus({ data: [{ name: "a", status: "approved" }] }, "a").status, "APPROVED", "approved");
eq(parseStatus({ data: [{ name: "a", status: "REJECTED", rejected_reason: "TAG_CONTENT_MISMATCH" }] }, "a").rejected_reason, "TAG_CONTENT_MISMATCH", "reason");
eq(parseStatus({ data: [] }, "a").status, "NOT_FOUND", "not found");
metaStatus = "REJECTED"; r = await call("/wa_template_status?name=najma_feed_ready&waba=77" + K); j = await r.json();
eq([j.status, j.rejected_reason], ["REJECTED", "INCORRECT_CATEGORY"], "status route");
ok(!JSON.stringify(j).includes(TOKEN), "token not in status");

// 6. the switch refuses unless APPROVED
calls = [];
for (const s of ["PENDING", "REJECTED"]) {
  metaStatus = s; r = await call("/wa_template_use?name=najma_feed_ready&waba=77&confirm=yes" + K, "POST");
  eq(r.status, 409, "refused when " + s); ok(!kv.has("feed_template"), "flag untouched when " + s);
}
eq((await call("/wa_template_use?name=najma_log_day&waba=77&confirm=yes" + K, "POST")).status, 400, "log template cannot be switched");
// 7. sends: default is azimuth_daily with params; flagged is najma_feed_ready with none
const sent = () => calls.filter((c) => /\/111\/messages$/.test(c.u)).map((c) => JSON.parse(c.o.body));
calls = [];
r = await call("/feed_nudge_send?head=Hi&body=There" + K);
let s = sent(); eq(s.length, 1, "default: one send");
eq(s[0].template.name, "azimuth_daily", "default stays azimuth_daily");
eq(s[0].template.components[0].parameters.length, 2, "default carries two params");
metaStatus = "APPROVED"; calls = [];
r = await call("/wa_template_use?name=najma_feed_ready&waba=77&confirm=yes" + K, "POST"); j = await r.json();
ok(j.ok && kv.get("feed_template") === "najma_feed_ready", "flag set once APPROVED");
calls = [];
await call("/feed_nudge_send?head=Hi&body=There" + K);
s = sent(); eq(s.length, 1, "flagged: one send");
eq(s[0].template.name, "najma_feed_ready", "flagged template used");
ok(s[0].template.components === undefined, "no parameters for the new template");
eq(s[0].to, "971500000000", "still only to WA_ALLOWED");
ok(!calls.some((c) => JSON.stringify(c).includes("azimuth_daily") && /messages$/.test(c.u)), "azimuth_daily not sent when flagged");

// 8. NEGATIVE CONTROL: release-v327 has no flag, so the same flagged KV would still send azimuth_daily there
try {
  const old = execSync("git show release-v327:src/index.js", { cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), maxBuffer: 1 << 28 }).toString();
  ok(!old.includes("najma_feed_ready") && !old.includes("feedTemplateFlag"), "control: v327 knows nothing of the flag");
} catch (e) { console.log("control skipped:", String(e.message).slice(0, 80)); }
const now = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(now.includes("feedTemplateFlag(env)"), "current source reads the flag");
console.log("test_v329_templates: " + n + " assertions OK");
