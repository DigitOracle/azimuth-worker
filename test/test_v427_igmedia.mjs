// v427 - /ig_media/<id> must answer the stored picture to a request with NO key (WhatsApp and Instagram fetch it that way).
// Until v427 the v149 "/ig_" insights prefix caught it first and answered 401, so desk previews showed no picture.   node test/test_v427_igmedia.mjs
import worker from "../src/index.js";

const store = new Map();
const KV = { async get(k, t) { const v = store.has(k) ? store.get(k) : null; if (v == null) return null; if (t === "arrayBuffer") return v instanceof ArrayBuffer ? v : new TextEncoder().encode(String(v)).buffer; return v instanceof ArrayBuffer ? new TextDecoder().decode(v) : v; },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
globalThis.fetch = async () => new Response("{}", { status: 200 });
const ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";
const env = { MEETINGS: KV, READ_KEY: "RK_owner_key_123456", IG_APP_ID: "3591427797679606", IG_APP_SECRET: "S", PUBLIC_ORIGIN: ORIGIN, WA_ALLOWED: "971565484397", MAILBOXES: "", ADD_TO: "" };
const ctx = { waitUntil(p) { p && p.catch && p.catch(() => {}); } };
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]).buffer;
store.set("igm_qxssh8g60wgt6fnz98", JPEG); store.set("igm_ct_qxssh8g60wgt6fnz98", "image/jpeg");
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
const get = (p) => worker.fetch(new Request(ORIGIN + p), env, ctx);

let r = await get("/ig_media/qxssh8g60wgt6fnz98");
const b = new Uint8Array(await r.arrayBuffer());
ok(r.status === 200 && r.headers.get("Content-Type") === "image/jpeg" && b[0] === 0xff && b.length === 9, "a stored picture is served with no key", r.status + " " + r.headers.get("Content-Type"));
r = await get("/ig_media/doesnotexist");
ok(r.status === 404, "a missing picture is 404, not 401", r.status);
r = await get("/ig/status");
ok(r.status !== 200, "the Instagram insights pages still refuse a request with no key", r.status);
r = await get("/ig_media/../ig_status");
ok(r.status !== 200 || (r.headers.get("Content-Type") || "").startsWith("image/"), "a path trick does not reach the insights pages through the picture route", r.status);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
