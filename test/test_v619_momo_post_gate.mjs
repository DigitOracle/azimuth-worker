// v619 - THE REAL WORKER ENTRY: the Momo Work POST addresses must reach their handlers (v564-v618 only let /momo/work/api through the POST guard, so on the live
// worker the content plan saves, "I have an idea" and the whole recorder answered 401 while every local test, which skipped the entry point, passed).
import assert from "node:assert/strict";
const worker = (await import("../src/index.js")).default;
let pass = 0, fail = 0; const ok = (c, msg, extra) => { if (c) pass++; else { fail++; console.log("FAIL", msg, extra === undefined ? "" : JSON.stringify(extra).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const KEY = "ins_najjuko_TESTKEY0123456789abcd", OTHER = "ins_someoneelse_0123456789abcdefgh";
const env = { MEETINGS: KV, INSIDER_KEY: KEY + "," + OTHER, AI: { run: async () => ({ text: "Test speech. Ali wants the calendar confirmed by Thursday." }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const post = (path, key, body, ct) => worker.fetch(new Request("https://w" + path + "?key=" + encodeURIComponent(key), { method: "POST", body, headers: { "content-type": ct || "application/json" } }), env, ctx);

for (const [path, body] of [["/momo/work/api", { action: "parties" }], ["/momo/work/plan/api", { action: "item_save", item: { title: "Gate test item", start: "2026-12-18", pillar: "market", format: "post" } }],
  ["/momo/work/rec/api", { action: "start", title: "Gate test" }], ["/momo/work/rec/api", { action: "list" }]]) {
  const r = await post(path, KEY, JSON.stringify(body)); const j = await r.json().catch(() => null);
  ok(r.status === 200 && j && !j.error, "Najjuko's POST to " + path + " (" + body.action + ") reaches its handler", [r.status, j]);
}
// a recorder part goes through the entry point too
{ const s = await (await post("/momo/work/rec/api", KEY, JSON.stringify({ action: "start", title: "Parts" }))).json();
  const r = await worker.fetch(new Request("https://w/momo/work/rec/chunk?key=" + KEY + "&id=" + s.id + "&n=0&secs=60", { method: "POST", body: new Uint8Array(4000), headers: { "content-type": "audio/mp4" } }), env, ctx);
  const j = await r.json(); ok(r.status === 200 && j.ok && j.chars > 10, "a recorded part is accepted and read through the entry point", [r.status, j]); }
// the plan item really saved
ok([...store.keys()].some((k) => /plan|plp|item/i.test(k)), "the plan item was written to the store", [...store.keys()].slice(0, 8));
// security: nobody else, and no key, gets in
for (const path of ["/momo/work/api", "/momo/work/plan/api", "/momo/work/rec/api", "/momo/work/rec/chunk"]) {
  for (const k of ["", "wrong", OTHER]) { const r = await post(path, k, JSON.stringify({ action: "list" })); ok(r.status === 401 || r.status === 404, "POST " + path + " with key '" + k.slice(0, 12) + "' is refused", r.status); }
}
// unrelated POSTs stay under the guard
{ const r = await post("/momo/work/other", KEY, "{}"); ok(r.status === 401 || r.status === 404, "an unlisted Momo POST address is still refused", r.status); }
console.log("v619 momo post gate: " + pass + " passed, " + fail + " failed"); if (fail) process.exit(1);
