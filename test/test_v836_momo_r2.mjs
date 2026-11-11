// v836: large Momo files in R2 (MOMO_FILES): Range reads from R2, KV fallback unchanged, upload routes write R2 + a KV marker and attach to the event; page JS parses.
import assert from "node:assert";
import { fileResponse, speakingRoute, SPK_JS, fileKind } from "../src/work_speaking.js";
new Function(SPK_JS);
const blob = new Uint8Array(1000).map((_, i) => i % 256);
const r2 = new Map(), kv = new Map(), mp = new Map();
const R2 = {
  async head(k) { const o = r2.get(k); return o ? { size: o.b.length, httpMetadata: o.h, customMetadata: o.c } : null; },
  async get(k, opt) { const o = r2.get(k); if (!o) return null; const b = opt && opt.range ? o.b.slice(opt.range.offset, opt.range.offset + opt.range.length) : o.b; return { body: b, size: o.b.length, arrayBuffer: async () => b.buffer }; },
  async put(k, body, opt) { const b = body instanceof Uint8Array ? body : new Uint8Array(await new Response(body).arrayBuffer()); r2.set(k, { b, h: opt.httpMetadata, c: opt.customMetadata }); },
  async createMultipartUpload(k, opt) { mp.set("u1", { k, opt, parts: [] }); return { uploadId: "u1" }; },
  resumeMultipartUpload(k, u) { const m = mp.get(u); return { async uploadPart(n, body) { m.parts[n - 1] = new Uint8Array(await new Response(body).arrayBuffer()); return { partNumber: n, etag: "e" + n }; }, async abort() {}, async complete(parts) { const b = new Uint8Array(m.parts.reduce((a, x) => a.concat([...x]), [])); r2.set(k, { b, h: m.opt.httpMetadata, c: m.opt.customMetadata }); return { size: b.length }; } }; },
};
const env = { MOMO_FILES: R2, MEETINGS: { async get(k) { return kv.has(k) ? kv.get(k).v : null; }, async getWithMetadata(k) { return kv.has(k) ? { value: kv.get(k).v, metadata: kv.get(k).m } : { value: null }; }, async put(k, v, o) { kv.set(k, { v, m: o && o.metadata }); } } };
kv.set("speaking_rec_kendall", { v: JSON.stringify({ items: [{ id: "ev1", title: "Talk" }] }) });
const req = (range) => ({ headers: { get: (h) => (h === "Range" ? range : null) } });
r2.set("big", { b: blob, h: { contentType: "video/mp4" }, c: {} });
let r = await fileResponse(env, "big", req("bytes=0-1")); assert.equal(r.status, 206); assert.equal(r.headers.get("Content-Range"), "bytes 0-1/1000");
r = await fileResponse(env, "big", req(null)); assert.equal(r.status, 200); assert.equal(r.headers.get("Content-Length"), "1000");
assert.equal((await fileResponse(env, "big", req("bytes=5000-"))).status, 416);
kv.set("old", { v: btoa("hi"), m: { type: "image/jpeg" } }); r = await fileResponse(env, "old", req(null)); assert.equal(await r.text(), "hi");
const deps = { person: () => "kendall", page: () => "" };
const call = (path, body, headers) => { const u = new URL("https://x.dev" + path + (path.includes("?") ? "&" : "?") + "key=k"); return speakingRoute(new Request(u, { method: "POST", body, headers }), env, u, deps).then((x) => x.json()); };
let j = await call("/momo/work/speaking/upload?id=ev1&name=deck.pdf&type=application/pdf", new Uint8Array(10), { "Content-Length": "10" });
assert.ok(j.ok && j.kind === "file"); const key = "speaking_file_kendall_" + j.f; assert.ok(r2.has(key)); assert.equal(kv.get(key).m.r2, 1); assert.equal(j.rec.items[0].materials.length, 1);
j = await call("/momo/work/speaking/upload?id=ev1&name=p.jpg&type=image/jpeg", new Uint8Array(4), { "Content-Length": "4" }); assert.ok(!r2.has("speaking_file_kendall_" + j.f)); assert.equal(j.rec.items[0].photos.length, 1);
j = await call("/momo/work/speaking/upload?id=nope&name=a&type=video/mp4", new Uint8Array(4), { "Content-Length": "4" }); assert.ok(j.error);
const c = await call("/momo/work/speaking/mpu/create", JSON.stringify({ id: "ev1", name: "film.mp4", type: "video/mp4", size: 8 }));
const p1 = await call("/momo/work/speaking/mpu/part?f=" + c.f + "&u=" + c.uploadId + "&n=1", new Uint8Array([1, 2, 3, 4]));
const p2 = await call("/momo/work/speaking/mpu/part?f=" + c.f + "&u=" + c.uploadId + "&n=2", new Uint8Array([5, 6, 7, 8]));
j = await call("/momo/work/speaking/mpu/complete?f=" + c.f + "&u=" + c.uploadId, JSON.stringify({ id: "ev1", name: "film.mp4", type: "video/mp4", parts: [p1.part, p2.part] }));
assert.ok(j.ok && j.kind === "video"); assert.equal(r2.get("speaking_file_kendall_" + c.f).b.length, 8); assert.equal(kv.get("speaking_file_kendall_" + c.f).m.size, 8); assert.equal(j.rec.items[0].videos.length, 1);
assert.equal(fileKind("image/png"), "photo");
const other = { person: () => "someone", page: () => "" }, u2 = new URL("https://x.dev/momo/work/speaking/upload?id=ev1&key=z");
assert.equal((await speakingRoute(new Request(u2, { method: "POST", body: "x" }), env, u2, other)).status, 404);
console.log("v836 momo r2: checks passed");
