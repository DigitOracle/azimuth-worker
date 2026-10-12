// v542 - pictures of Kendall start from a reference with his glasses on and his face clear (Kendall 12 Oct 2026: "use a glasses reference")
import { pickRefs, refClassify } from "../src/desk_post.js";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const kv = new Map();
const env = { MEETINGS: { get: async (k, t) => { const v = kv.get(k); if (v == null) return null; return t === "arrayBuffer" ? v : (typeof v === "string" ? v : JSON.stringify(v)); }, put: async (k, v) => { kv.set(k, v); }, delete: async (k) => kv.delete(k) } };
const buf = (n) => new Uint8Array([n]).buffer;
kv.set("desk_ref_index", JSON.stringify([1, 2, 3, 4]));
const looks = { 1: "ONE NOGLASSES CLEAR", 2: "ONE GLASSES UNCLEAR", 3: "ONE GLASSES CLEAR", 4: "MANY GLASSES CLEAR" };
for (const n of [1, 2, 3, 4]) { kv.set("desk_ref_" + n, JSON.stringify({ n, key: "desk_refimg_" + n, tag: "general", approved: true })); kv.set("desk_refimg_" + n, buf(n)); }
const deps = { vision: async (e, b) => looks[new Uint8Array(b)[0]] };
const r = await refClassify(env, deps);
ok(r.refs === 4 && r.glasses_and_clear === 1, "each reference looked at once: one has glasses and a clear face", r);
ok(JSON.parse(kv.get("desk_ref_1")).look.glasses === false && JSON.parse(kv.get("desk_ref_2")).look.face === false && JSON.parse(kv.get("desk_ref_4")).look.one === false, "NOGLASSES, UNCLEAR and MANY (a crowd or a poster) are read the right way round");
for (let k = 0; k < 4; k++) { kv.set("desk_ref_cursor", String(k)); const p = await pickRefs(env, "records", "speaking"); ok(new Uint8Array(p.bufs[0])[0] === 3, "cursor " + k + ": the first reference is the glasses, clear-face photo", new Uint8Array(p.bufs[0])[0]); }
const r2 = await refClassify(env, deps);
ok(r2.rows.every((x) => x.cached), "a second pass does not look again");
console.log(`v542 glasses reference: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
