// v459 - the site-clarity video template: payload shape and the upload-then-submit order. Offline.   node test/test_v459_video_template.mjs
import { buildCreatePayload, templateRoutes, WA_TEMPLATES } from "../src/wa_templates.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 600) : "")); } };

const p = buildCreatePayload("digitalchemy_site_clarity", "4::HANDLE");
const by = Object.fromEntries(p.components.map((c) => [c.type, c]));
ok(p.category === "MARKETING" && by.HEADER.format === "VIDEO" && by.HEADER.example.header_handle[0] === "4::HANDLE", "video header with the uploaded handle", JSON.stringify(p));
ok(/GoCanvas/.test(by.BODY.text) && by.BODY.example.body_text[0][0] === "Ahmed" && by.BODY.text.length <= 1024 && !/^\{\{/.test(by.BODY.text), "body names GoCanvas, has its sample, fits, does not start with a variable");
ok(by.FOOTER.text.length <= 60 && by.BUTTONS.buttons.length === 3 && by.BUTTONS.buttons.every((b) => b.text.length <= 25), "footer and three buttons within Meta's limits");
ok(buildCreatePayload("najma_log_reminder").components.length === 1, "the body-only templates are unchanged");

const calls = [];
globalThis.fetch = async (u, init) => { const s = String(u); calls.push({ s, m: init && init.method, auth: init && init.headers && init.headers.Authorization });
  if (/\/app$/.test(s)) return new Response(JSON.stringify({ id: "2144888136243876" }));
  if (/\/uploads\?/.test(s)) return new Response(JSON.stringify({ id: "upload:SESSION" }));
  if (/upload:SESSION/.test(s)) return new Response(JSON.stringify({ h: "4::HANDLE" }));
  if (/message_templates/.test(s)) { calls.at(-1).body = JSON.parse(init.body); return new Response(JSON.stringify({ id: "999", status: "PENDING" })); }
  return new Response("{}"); };
const store = new Map([["vid_site_clarity_75", new Uint8Array(1000).buffer]]);
const env = { READ_KEY: "K", WHATSAPP_TOKEN: "TOK", MEETINGS: { get: async (k) => store.get(k) || null } };
const url = new URL("https://x/wa_template_create?name=digitalchemy_site_clarity&waba=1588773749592854&confirm=yes&dry=0&key=K");
const r = await (await templateRoutes(new Request(url, { method: "POST" }), env, url, { graph: "https://graph.facebook.com/v21.0" })).json();
const order = calls.map((c) => c.s.replace("https://graph.facebook.com/v21.0", ""));
ok(r.ok && r.id === "999", "submits and returns Meta's id", JSON.stringify(r));
ok(/\/app$/.test(order[0]) && /uploads/.test(order[1]) && /upload:SESSION/.test(order[2]) && /message_templates/.test(order[3]), "app id, upload session, upload, then the template", order.join(" | "));
ok(calls[2].auth === "OAuth TOK" && calls[3].body.components[0].example.header_handle[0] === "4::HANDLE", "the upload uses OAuth auth and its handle goes into the template");
store.clear(); calls.length = 0;
const r2 = await (await templateRoutes(new Request(url, { method: "POST" }), env, url, { graph: "https://graph.facebook.com/v21.0" })).json();
ok(!r2.ok && /not stored/.test(r2.error) && !calls.length, "no stored video: refuses before calling Meta");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
