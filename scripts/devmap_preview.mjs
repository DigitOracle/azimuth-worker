// Local preview of /developers_map with the REAL worker code and a stub KV (nothing is read from or written to production).
//   node scripts/devmap_preview.mjs <devmap_index.json> [district_polygons.geojson]      then open  http://localhost:8791/developers_map?key=preview_client_key_123
import http from "node:http";
import fs from "node:fs";
import worker from "../src/index.js";
const store = new Map();
store.set("img_devmap_index", fs.readFileSync(process.argv[2], "utf8"));
if (process.argv[3]) store.set("img_district_polygons", fs.readFileSync(process.argv[3], "utf8"));
const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); const ty = typeof t === "string" ? t : t && t.type; return ty === "arrayBuffer" ? new TextEncoder().encode(v).buffer : v; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
const env = { MEETINGS: KV, READ_KEY: "preview_owner_key_abcdefgh", CLIENT_KEY: "preview_client_key_123" };
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const r = await worker.fetch(new Request("http://localhost:8791" + req.url, { method: req.method, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) }), env, { waitUntil() {} });
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(8791, () => console.log("http://localhost:8791/developers_map?key=preview_client_key_123"));
