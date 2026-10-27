// v640 - the profile can flag a phone as WhatsApp (shown as a mark on the letterhead). Fake keys and numbers only.
const worker = (await import("../src/index.js")).default;
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [], list_complete: true }) };
const A = "ins_kendall_TESTKEY0123456789abcd", env = { MEETINGS: KV, INSIDER_KEY: A }, ctx = { waitUntil() {}, passThroughOnException() {} };
const post = (b) => worker.fetch(new Request("https://w/momo/work/jobs/api?key=" + A, { method: "POST", body: JSON.stringify(b), headers: { "content-type": "application/json" } }), env, ctx);
let r = await post({ action: "save_profile", profile: { name: "Test Person", phone: "+000 00 000 0000", email: "t@example.com", whatsapp: true } });
ok(r.status === 200, "save with whatsapp flag accepted", r.status);
const rec = await (await worker.fetch(new Request("https://w/momo/work/jobs/rec?key=" + A), env, ctx)).json();
ok(rec.profile && rec.profile.whatsapp === true, "flag stored true", rec.profile);
await post({ action: "save_profile", profile: { name: "Test Person", phone: "+000 00 000 0000", whatsapp: "yes please" } });
const rec2 = await (await worker.fetch(new Request("https://w/momo/work/jobs/rec?key=" + A), env, ctx)).json();
ok(rec2.profile.whatsapp === true, "any truthy value reads as true; absent reads false", rec2.profile.whatsapp);
await post({ action: "save_profile", profile: { name: "Test Person", phone: "+000 00 000 0000" } });
const rec3 = await (await worker.fetch(new Request("https://w/momo/work/jobs/rec?key=" + A), env, ctx)).json();
ok(rec3.profile.whatsapp === false, "absent flag is false", rec3.profile.whatsapp);
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
