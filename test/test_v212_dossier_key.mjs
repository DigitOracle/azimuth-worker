// v212 — A CLIENT KEY MAY OPEN A BUILDING DOSSIER, AND NOTHING ELSE ON THE RAIL (Kendall, 21 Sep 2026).
//
// The video session needs the dossier click on camera without the owner key in the address bar. A b_<district>_<id> dossier
// carries no client's name, and every figure in it is already on the building page, which has been a client page since v187.
// The rest of the sheet rail keeps the v157 rule: a client is handed a fact sheet as a file, never the route that lists them.
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };
globalThis.fetch = async () => new Response("{}", { status: 200 });

const READ = "owner_admin_key_never_in_client_links_0001";
const CLIENT = "azimuth2_rd_client_key_for_naj_to_forward";
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34].concat(new Array(400).fill(0x20)));
const store = new Map([
  ["sheet_b_businessbay_1", pdf.buffer], ["sheetm_b_businessbay_1", JSON.stringify({ name: "The Symphony", pages: 16, bytes: pdf.length })],
  ["sheet_najjuko_client_one", pdf.buffer], ["sheetm_najjuko_client_one", JSON.stringify({ name: "A client fact sheet", pages: 3, bytes: pdf.length })]]);
const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" ? v : (t === "json" ? JSON.parse(v) : v); },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [...store.keys()].map((name) => ({ name })), list_complete: true }; } };
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, PUBLIC_ORIGIN: "https://x" };
const get = async (p) => { const r = await worker.fetch(new Request("https://x" + p), env, { waitUntil() {} }); return { status: r.status, type: r.headers.get("Content-Type") || "" }; };

const a = await get("/sheet/b_businessbay_1.pdf?key=" + CLIENT);
ok(a.status === 200 && /pdf/.test(a.type), "a CLIENT key opens a building dossier: " + a.status + " " + a.type);
const b = await get("/sheet/b_businessbay_1.pdf?key=" + READ);
ok(b.status === 200, "the owner key still opens it: " + b.status);
const c = await get("/sheet/najjuko_client_one.pdf?key=" + CLIENT);
ok(c.status === 401, "but a client key still cannot open a CLIENT FACT SHEET - the v157 rule stands: " + c.status);
const d = await get("/sheet/najjuko_client_one.pdf?key=" + READ);
ok(d.status === 200, "while the owner still can: " + d.status);
const e = await get("/sheet/b_businessbay_1/meta?key=" + CLIENT);
ok(e.status === 401, "a client key cannot read a dossier's meta either, only the file: " + e.status);
const f = await get("/sheet/b_businessbay_1.pdf");
ok(f.status === 401, "and no key opens nothing: " + f.status);
const g = await get("/sheet/b_businessbay_1.pdf?key=not-a-key");
ok(g.status === 401, "nor a wrong one: " + g.status);
const h = await get("/sheet/b_businessbay_99.pdf?key=" + CLIENT);
ok(h.status === 404, "a dossier that does not exist is a plain 404, the same as the owner sees: " + h.status);

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
