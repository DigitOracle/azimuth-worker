// v632 - the Momo front door has three cards: Work, Play, Future (the job search). Fake keys only.
const worker = (await import("../src/index.js")).default;
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const KV = { get: async () => null, put: async () => {}, delete: async () => {}, list: async () => ({ keys: [], list_complete: true }) };
const NAJ = "ins_najjuko_TESTKEY0123456789abcd", OWNER = "ins_owner_0123456789abcdefghijk";
const env = { MEETINGS: KV, INSIDER_KEY: NAJ + "," + OWNER }, ctx = { waitUntil() {}, passThroughOnException() {} };
for (const k of [NAJ, OWNER]) {
  const r = await worker.fetch(new Request("https://w/momo?door=1&key=" + k), env, ctx), h = await r.text();
  ok(r.status === 200 && /<b>Work<\/b>/.test(h) && /<b>Play<\/b>/.test(h) && /<b>Future<\/b>/.test(h), "door shows Work, Play, Future for " + k.slice(0, 8), r.status);
  ok(h.includes("/momo/work/jobs?key=" + k), "Future opens the Jobs page", h.slice(0, 80));
}
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
