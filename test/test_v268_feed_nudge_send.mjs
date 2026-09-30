// v268 - /feed_nudge_send: a keyed route to send HER (never a query-overridable recipient) a custom message via the
// approved azimuth_daily template - the only thing Meta delivers outside her 24h reply window. Added so an apology or
// any other one-off notice can reach her regardless of window state, without hand-editing KV or guessing at Graph API
// calls. Mirrors /ring_test's safety shape: keyed, recipient fixed from env, dry-run available before a real send.
//
// NEGATIVE CONTROL: remove the route (or its key check, or its WA_ALLOWED-only recipient) and run this file - the
// matching assertion(s) must fail. Verified by doing so for each piece.
import worker from "../src/index.js";

const READ = "client_read_key_in_links_123";
const store = new Map();
const KV = {
  async get(k) { return store.has(k) ? store.get(k) : null; },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; },
};
const calls = [];
globalThis.fetch = async (url, init) => { calls.push({ url: String(url), body: init && init.body ? JSON.parse(init.body) : null }); return new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200 }); };
const env = { MEETINGS: KV, READ_KEY: READ, WA_ALLOWED: "971500000000", FEED_TEMPLATE: "azimuth_daily", FEED_TEMPLATE_LANG: "en_US" };
const call = (p) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p), env, { waitUntil() {} });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

// 1. no key -> unauthorized, nothing sent
{
  const r = await call("/feed_nudge_send?head=hi&body=there");
  ok(r.status === 401, "no key is unauthorized");
  ok(calls.length === 0, "an unauthorized call sends nothing");
}

// 2. missing head or body -> 400, nothing sent
{
  const r1 = await call("/feed_nudge_send?key=" + READ + "&body=there");
  ok(r1.status === 400, "missing head is rejected");
  const r2 = await call("/feed_nudge_send?key=" + READ + "&head=hi");
  ok(r2.status === 400, "missing body is rejected");
  ok(calls.length === 0, "a rejected call sends nothing");
}

// 3. dry run -> no send, but reports the real recipient/template/values it WOULD use
{
  const r = await call("/feed_nudge_send?key=" + READ + "&dry=1&head=Sorry+about+the+repeats&body=Fixing+it+now.");
  const j = await r.json();
  ok(calls.length === 0, "dry=1 sends nothing");
  ok(j.dry === true, "dry run says so");
  ok(j.to === "971500000000", "dry run shows the real recipient - env.WA_ALLOWED, not something a caller picked");
  ok(j.template === "azimuth_daily", "dry run shows the real template");
  ok(j.head === "Sorry about the repeats", "dry run shows the sanitized head");
}

// 4. a real call sends exactly one template message, to WA_ALLOWED, never overridable by a query param
{
  const r = await call("/feed_nudge_send?key=" + READ + "&head=Sorry+about+the+repeats&to=971599999999&body=We+found+the+bug+and+are+fixing+it.+Sources%3A+DLD+register%2C+Dubai+2040+plan%2C+MEED%2C+Market+Pulse.");
  const j = await r.json();
  ok(j.ok === true, "the route reports success");
  ok(calls.length === 1, "exactly one outbound call was made");
  const body = calls[0].body;
  ok(body.to === "971500000000", "sent to env.WA_ALLOWED - a ?to= query param cannot redirect who this reaches");
  ok(body.type === "template" && body.template.name === "azimuth_daily", "sent as the approved azimuth_daily template, not free text");
  ok(body.template.components[0].parameters[0].text === "Sorry about the repeats", "{{1}} carries the head");
  ok(body.template.components[0].parameters[1].text.includes("DLD register"), "{{2}} carries the body");
}

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
