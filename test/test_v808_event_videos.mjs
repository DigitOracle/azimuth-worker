// v808: event cards carry videos; a raw-byte video is served with byte ranges so phones can play and seek.
import assert from "node:assert";
import { fileResponse } from "../src/work_speaking.js";
const bytes = new Uint8Array(1000).map((_, i) => i % 256);
const env = { MEETINGS: { async getWithMetadata(k, t) { return k === "v" ? { value: bytes.buffer, metadata: { type: "video/mp4", raw: 1 } } : null; } } };
const req = (range) => ({ headers: { get: (h) => (h === "Range" ? range : null) } });
let r = await fileResponse(env, "v", req(null)); assert.equal(r.status, 200); assert.equal(r.headers.get("Accept-Ranges"), "bytes"); assert.equal((await r.arrayBuffer()).byteLength, 1000);
r = await fileResponse(env, "v", req("bytes=0-1")); assert.equal(r.status, 206); assert.equal(r.headers.get("Content-Range"), "bytes 0-1/1000"); assert.equal((await r.arrayBuffer()).byteLength, 2);
r = await fileResponse(env, "v", req("bytes=990-")); assert.equal(r.status, 206); assert.equal((await r.arrayBuffer()).byteLength, 10);
r = await fileResponse(env, "v", req("bytes=5000-")); assert.equal(r.status, 416);
assert.equal((await fileResponse(env, "nope", req(null))).status, 404);
console.log("v808 event videos: 9 checks passed");
