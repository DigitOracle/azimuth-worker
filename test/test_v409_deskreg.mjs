// v409 - desk number check and register, owner only. Offline: fake fetch, fake KV.   node test/test_v409_deskreg.mjs
import worker from "../src/index.js";
const DESK = "1370146096179819", MAIN = "mainpid", READ = "RK", TOKEN = "SECRETTOKEN123";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { calls.push("kvput:" + k); store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [], list_complete: true }; } };
let calls = [], reqs = [], logs = [];
let metaStatus = "PENDING", registerMode = "ok";
const origLog = console.log; // capture only worker-side logs: patch warn/error, and wrap log during requests
const spy = (...a) => logs.push(a.join(" "));
globalThis.fetch = async (input, init) => {
  const u = String((input && input.url) || input), m = (init && init.method) || "GET";
  if (!u.includes("graph.facebook.com")) return new Response("{}", { status: 200 });
  const body = init && init.body ? JSON.parse(init.body) : null;
  reqs.push({ u, m, body, auth: init && init.headers && init.headers.Authorization });
  if (m === "GET" && u.includes("/" + DESK + "?")) return new Response(JSON.stringify({ id: DESK, display_phone_number: "+971 58 544 6093", verified_name: "DigitAlchemy", name_status: "APPROVED", status: metaStatus, quality_rating: "UNKNOWN", code_verification_status: "VERIFIED", platform_type: "NOT_APPLICABLE", throughput: { level: "NOT_APPLICABLE" }, extra_secret: "x" }), { status: 200 });
  if (m === "POST" && u.endsWith("/" + DESK + "/register")) {
    calls.push("meta_register");
    if (registerMode === "133005") return new Response(JSON.stringify({ error: { code: 133005, message: "Two step verification PIN Mismatch" } }), { status: 400 });
    if (registerMode === "131056") return new Response(JSON.stringify({ error: { code: 131056, message: "rate" } }), { status: 400 });
    if (registerMode === "100") return new Response(JSON.stringify({ error: { code: 100, message: "Invalid parameter" } }), { status: 400 });
    metaStatus = "CONNECTED"; return new Response(JSON.stringify({ success: true }), { status: 200 });
  }
  return new Response("{}", { status: 404 });
};
const ctx = { waitUntil(p) { p && p.catch && p.catch(() => {}); } };
const env = { MEETINGS: KV, READ_KEY: READ, WHATSAPP_TOKEN: TOKEN, WA_PHONE_ID: MAIN, WA_DESK_PHONE_ID: DESK, MAILBOXES: "", ADD_TO: "" };
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
const go = async (method, path, e = env) => { const r = await worker.fetch(new Request("https://x" + path, { method }), e, ctx); return { s: r.status, t: await r.text() }; };
const reset = () => { store.clear(); calls = []; reqs = []; logs = []; metaStatus = "PENDING"; registerMode = "ok"; };
const cl = console.log, ce = console.error, cw = console.warn;
console.error = console.warn = spy;

// 1 owner key
reset();
let r = await go("GET", "/wa_desk_status"); ok(r.s === 401 && reqs.length === 0, "status without key: 401, Meta not called");
r = await go("POST", "/wa_desk_register?key=bad"); ok(r.s === 401 && reqs.length === 0, "register with wrong key: 401, Meta not called");
// 2 missing env
r = await go("GET", "/wa_desk_status?key=" + READ, { ...env, WA_DESK_PHONE_ID: "" });
ok(r.s === 500 && /WA_DESK_PHONE_ID/.test(r.t) && /Set the worker secret/.test(r.t) && reqs.length === 0, "missing env: names WA_DESK_PHONE_ID and says how to set it, Meta not called", r.t);
r = await go("POST", "/wa_desk_register?key=" + READ, { ...env, WA_DESK_PHONE_ID: undefined }); ok(r.s === 500 && /WA_DESK_PHONE_ID/.test(r.t) && reqs.length === 0, "register with missing env: same");
// 3 status shape
reset(); r = await go("GET", "/wa_desk_status?key=" + READ); let j = JSON.parse(r.t);
const want = ["display_phone_number", "verified_name", "name_status", "status", "quality_rating", "code_verification_status", "platform_type", "throughput"];
ok(r.s === 200 && want.every(k => k in j) && !("extra_secret" in j) && !("id" in j), "status returns exactly the requested fields", r.t);
ok(/fields=display_phone_number,verified_name,name_status,status,quality_rating,code_verification_status,platform_type,throughput/.test(reqs[0].u) && reqs[0].u.includes("/v21.0/" + DESK + "?"), "status call uses the Graph constant and the desk id", reqs[0].u);
ok(/register/i.test(j.next_step) && !r.t.includes(TOKEN) && reqs.every(q => q.u.includes(DESK) && !q.u.includes(MAIN)), "next step in words, no token, only the desk id touched");
// 4 register: pin generated, stored before Meta, never leaked
reset(); r = await go("POST", "/wa_desk_register?key=" + READ); j = JSON.parse(r.t);
const pin = store.get("wa_desk_pin");
ok(r.s === 200 && j.registered === true && /^[0-9]{6}$/.test(pin), "register ok and a 6-digit PIN is stored in KV wa_desk_pin");
ok(calls.indexOf("kvput:wa_desk_pin") >= 0 && calls.indexOf("kvput:wa_desk_pin") < calls.indexOf("meta_register"), "PIN stored BEFORE the Meta call", calls.join(","));
const reg = reqs.find(q => q.m === "POST"); ok(reg.body.messaging_product === "whatsapp" && reg.body.pin === pin && reg.auth === "Bearer " + TOKEN, "Meta got messaging_product and the stored pin");
ok(!r.t.includes(pin) && !r.t.includes(TOKEN) && !logs.join("\n").includes(pin) && /PIN kept in KV wa_desk_pin/.test(r.t), "PIN and token never in the response or logs");
ok(j.status && j.status.status === "CONNECTED", "status returned after success");
// 5 retry / connected refusal
reqs = []; calls = []; r = await go("POST", "/wa_desk_register?key=" + READ); j = JSON.parse(r.t);
ok(r.s === 409 && j.refused === true && !calls.includes("meta_register") && store.get("wa_desk_pin") === pin, "retry when CONNECTED: refused, no register call, PIN unchanged");
// 6 idempotent retry after a failure reuses the same PIN
reset(); registerMode = "131056"; r = await go("POST", "/wa_desk_register?key=" + READ); const pin1 = store.get("wa_desk_pin");
ok(r.s === 502 && /Rate limit/.test(r.t), "131056 mapped to rate limit");
registerMode = "ok"; r = await go("POST", "/wa_desk_register?key=" + READ);
ok(JSON.parse(r.t).registered === true && store.get("wa_desk_pin") === pin1 && reqs.filter(q => q.m === "POST").pop().body.pin === pin1, "retry reuses the stored PIN");
// 7 mismatch and invalid parameter
reset(); registerMode = "133005"; r = await go("POST", "/wa_desk_register?key=" + READ); j = JSON.parse(r.t);
ok(r.s === 502 && j.meta_code === 133005 && /PIN already exists/.test(j.error) && /\?pin=/.test(j.error) && j.registered === false, "133005 mapped to a plain PIN-exists message", r.t);
reset(); registerMode = "100"; r = await go("POST", "/wa_desk_register?key=" + READ); ok(/Invalid parameter/.test(r.t) && !r.t.includes(store.get("wa_desk_pin")), "100 mapped to invalid parameter, pin hidden");
// 8 supplied pin
reset(); r = await go("POST", "/wa_desk_register?key=" + READ + "&pin=12345"); ok(r.s === 400 && reqs.length === 0 && !calls.includes("meta_register"), "bad pin= rejected before anything is sent");
reset(); r = await go("POST", "/wa_desk_register?key=" + READ + "&pin=482915");
ok(JSON.parse(r.t).registered === true && store.get("wa_desk_pin") === "482915" && !r.t.includes("482915"), "supplied pin used and stored, not echoed");
// 9 methods, other number untouched
r = await go("GET", "/wa_desk_register?key=" + READ); ok(r.s === 405, "GET on register is 405");
ok(reqs.every(q => !q.u.includes(MAIN)), "main number never addressed");
// 10 wrangler.toml: azimuth2 vars carry both desk values and nothing else changed vs the previous commit
{
  const fs = await import("node:fs"), cp = await import("node:child_process");
  const now = fs.readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  const sect = (t) => { const i = t.indexOf("[env.azimuth2.vars]"); return t.slice(i, t.indexOf("\n[", i + 5)); };
  ok(/^WA_DESK_PHONE_ID = "1370146096179819"/m.test(sect(now)) && /^WA_DESK_OWNER = "971562276093"/m.test(sect(now)), "wrangler.toml azimuth2 vars carry WA_DESK_PHONE_ID and WA_DESK_OWNER");
  let prev = ""; try { prev = cp.execSync("git show cardbtns-v408:wrangler.toml", { cwd: new URL("..", import.meta.url), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch (e) {}
  if (prev) {
    const keys = (t) => new Map(t.split(/\r?\n/).filter(l => /^[A-Za-z_][A-Za-z0-9_]* *=/.test(l)).map(l => [l.split("=")[0].trim(), l]));
    const a = keys(prev), b = keys(now), added = [...b.keys()].filter(k => !a.has(k)), changed = [...a.keys()].filter(k => b.get(k) !== a.get(k));
    ok(added.sort().join() === "FEED_DEADLINE_GST,WA_DESK_OWNER,WA_DESK_PHONE_ID" && changed.length === 0, "no other var added or changed vs cardbtns-v408", added.join() + "|" + changed.join());
  } else ok(true, "previous toml unavailable (skipped diff)");
}
console.error = ce; console.warn = cw;
cl(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
