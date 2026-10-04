// Local preview of the v306 BUY documents from a directory of cached KV values (real reads; Google is not called).
//   KVDIR=<dir with img_<name>[.json] files> OUT=<dir> node test/render_v306_buy.mjs
// Writes one HTML file per document into OUT. Not a test (the name has no test_ prefix).
import fs from "node:fs";
import path from "node:path";
import { buildDocument, parseQuery } from "../src/brief_docs.js";

const KVDIR = process.env.KVDIR, OUT = process.env.OUT || ".";
if (!KVDIR) { console.error("set KVDIR"); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const readKv = (k) => { for (const f of [k, k + ".json"]) { const p = path.join(KVDIR, f); if (fs.existsSync(p)) return fs.readFileSync(p); } return null; };
const KV = { async get(k, t) { const b = readKv(k); if (!b) return null; return t === "arrayBuffer" ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) : b.toString("utf8"); }, async list() { return { keys: [] }; } };
const env = { MEETINGS: KV };
const JOBS = [
  ["emaar_marina_dossier", "kind=dossier&keys=dubaimarina:10&beds=2&min=1800000&max=2500000&num=1&of=3"],
  ["emaar_downtown_dossier", "kind=dossier&keys=burjkhalifa:67&beds=2&min=4000000&max=5500000&num=2&of=3"],
  ["damac_businessbay_dossier", "kind=dossier&keys=businessbay:7&beds=1&min=1500000&max=2500000&num=3&of=3"],
  ["compare_three", "kind=compare&keys=dubaimarina:10,burjkhalifa:67,businessbay:7&beds=2&min=1800000&max=5500000&compare=1&areas=dubaimarina,burjkhalifa,businessbay"],
];
for (const [name, qs] of JOBS) {
  const url = new URL("https://x/brief_pdf?mode=buy&" + qs);
  const doc = await buildDocument(env, parseQuery(url), { origin: "" });
  if (doc.status !== 200) { console.log(name, doc.status, JSON.stringify(doc.body)); continue; }
  fs.writeFileSync(path.join(OUT, name + ".html"), doc.html);
  console.log(name, "pages", doc.pages, doc.fname);
}
