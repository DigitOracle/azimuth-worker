// v157 (Kendall, 16 Sep 2026) - the client fact sheet in the worker, offline. Tests the module
// directly (src/sheets.js) rather than through index.js, because the hook into index.js is three
// lines and three sessions are editing that file today.
//
// What is actually being protected here:
//   - a sheet is built for a named client, so the preview route must be OWNER key only. Not the
//     v156 client key, not rk, not no key.
//   - the PDF must never be sent as a LINK. If Meta fetches a URL, the document has to be publicly
//     fetchable with no key, which re-opens exactly what v156 closed. The send must upload bytes and
//     send by media id.
//   - WhatsApp refuses free-form messages outside the 24-hour window. A send with the window shut
//     must be HELD and say so, not fail silently at a client's desk.
//   - a truncated or non-PDF upload must not sit in KV looking like a sheet.
import { sheetRoutes, sendSheet, sheetMeta } from "../src/sheets.js";

const READ = "owner_admin_key_never_in_client_links_0001";
const CLIENT = "client_key_current_abcdefghij";
const ING = "ingest_token_separate_from_read_key";

const store = new Map();
const KV = {
  async get(k, t) {
    if (!store.has(k)) return null;
    const v = store.get(k);
    if (t === "arrayBuffer") return v instanceof ArrayBuffer ? v : new TextEncoder().encode(String(v)).buffer;
    if (t === "json") { try { return JSON.parse(v); } catch (e) { return null; } }
    return v instanceof ArrayBuffer ? new TextDecoder().decode(v) : v;
  },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
};

let outbound = [];
globalThis.fetch = async (input, init) => {
  const u = String((input && input.url) || input);
  outbound.push({ u, init });
  if (u.includes("/media")) return new Response(JSON.stringify({ id: "media.id.0001" }), { status: 200 });
  return new Response(JSON.stringify({ messages: [{ id: "wamid.out" }] }), { status: 200 });
};

function ctEq(a, b) {
  a = String(a || ""); b = String(b || "");
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
let windowOpen = true;
let posted = [];
const deps = {
  ctEq,
  WA_GRAPH: "https://graph.facebook.com/v20.0",
  async ownerWindowOpen() { return windowOpen; },
  async waPost(env, payload, kind) { posted.push({ payload, kind }); return { ok: true, status: 200 }; },
  async noteErr() {},
};

const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: ING,
              WA_ALLOWED: "971565484397", WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p" };
const ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";

const call = (path, init) => {
  const u = new URL(ORIGIN + path);
  return sheetRoutes(new Request(u.toString(), init), env, u, deps);
};

function pdfBytes(n) {
  const b = new Uint8Array(n);
  b[0] = 0x25; b[1] = 0x50; b[2] = 0x44; b[3] = 0x46; b[4] = 0x2d;   // %PDF-
  for (let i = 5; i < n; i++) b[i] = (i * 7) & 0xff;
  return b.buffer;
}

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  <- " + extra : "")); } };

console.log("\nv157 client fact sheet\n");

// ---------------------------------------------------------------- ingest
{
  const r = await call("/ingest_sheet?slug=bellevue_towers&name=Bellevue%20Towers&pages=3",
    { method: "POST", headers: { "X-Azimuth-Ingest": "wrong" }, body: pdfBytes(4000) });
  ok("ingest refuses a wrong token", r && r.status === 401, r && r.status);
}
{
  const r = await call("/ingest_sheet?slug=bellevue_towers&name=Bellevue%20Towers&pages=3",
    { method: "POST", headers: { "X-Azimuth-Ingest": ING }, body: pdfBytes(4000) });
  const j = r && await r.json();
  ok("ingest accepts a real PDF", r && r.status === 200 && j.ok && j.bytes === 4000, r && r.status);
  ok("bytes land in KV as an ArrayBuffer", store.get("sheet_bellevue_towers") instanceof ArrayBuffer);
  const m = await sheetMeta(env, "bellevue_towers");
  ok("meta is its own small key", m && m.pages === 3 && m.name === "Bellevue Towers" && !m.hold);
  ok("meta carries a content hash", m && typeof m.sha === "string" && m.sha.length === 16);
}
{
  const notPdf = new TextEncoder().encode("<html>nope</html>".repeat(80)).buffer;
  const r = await call("/ingest_sheet?slug=junk_building",
    { method: "POST", headers: { "X-Azimuth-Ingest": ING }, body: notPdf });
  ok("a non-PDF body is refused", r && r.status === 415, r && r.status);
  ok("...and nothing was stored for it", !store.has("sheet_junk_building"));
}
{
  const r = await call("/ingest_sheet?slug=tiny_building",
    { method: "POST", headers: { "X-Azimuth-Ingest": ING }, body: pdfBytes(40) });
  ok("a truncated upload is refused", r && r.status === 400, r && r.status);
}
{
  const r = await call("/ingest_sheet?slug=sobha_skyparks&name=Sobha%20SkyParks&hold=no%20pictures%20yet",
    { method: "POST", headers: { "X-Azimuth-Ingest": ING }, body: "" });
  const m = await sheetMeta(env, "sobha_skyparks");
  ok("a held building records WHY, not just a boolean", r && r.status === 200 && m && m.hold === "no pictures yet");
  ok("...and carries no bytes", !store.has("sheet_sobha_skyparks"));
}

// ---------------------------------------------------------------- the preview route is owner-only
{
  const noKey = await call("/sheet/bellevue_towers.pdf", { method: "GET" });
  ok("preview refuses no key", noKey && noKey.status === 401, noKey && noKey.status);

  const clientKey = await call("/sheet/bellevue_towers.pdf?key=" + encodeURIComponent(CLIENT), { method: "GET" });
  ok("preview refuses the v156 CLIENT key", clientKey && clientKey.status === 401, clientKey && clientKey.status);

  const rk = await call("/sheet/bellevue_towers.pdf?rk=" + encodeURIComponent(READ), { method: "GET" });
  ok("preview ignores rk (that is the residents layer)", rk && rk.status === 401, rk && rk.status);

  const owner = await call("/sheet/bellevue_towers.pdf?key=" + encodeURIComponent(READ), { method: "GET" });
  ok("preview serves for the owner key", owner && owner.status === 200, owner && owner.status);
  ok("...as a PDF", owner && owner.headers.get("Content-Type") === "application/pdf");
  ok("...not cached and not indexed",
     owner && owner.headers.get("Cache-Control") === "no-store" && /noindex/.test(owner.headers.get("X-Robots-Tag") || ""));
  ok("...named for the building, not the slug",
     owner && /filename="Bellevue Towers.pdf"/.test(owner.headers.get("Content-Disposition") || ""),
     owner && owner.headers.get("Content-Disposition"));
}
{
  const m = await call("/sheet/bellevue_towers/meta?key=" + encodeURIComponent(READ), { method: "GET" });
  ok("meta route serves for the owner", m && m.status === 200);
  const mNo = await call("/sheet/bellevue_towers/meta", { method: "GET" });
  ok("meta route refuses no key", mNo && mNo.status === 401);
  const missing = await call("/sheet/never_built/meta?key=" + encodeURIComponent(READ), { method: "GET" });
  ok("an unbuilt building answers 404 with a reason", missing && missing.status === 404);
}
{
  const bad = await call("/sheet/..%2F..%2Fsecret.pdf?key=" + encodeURIComponent(READ), { method: "GET" });
  ok("a traversal-shaped slug is refused", bad && (bad.status === 400 || bad.status === 404), bad && bad.status);
}

// ---------------------------------------------------------------- the send
{
  outbound = []; posted = []; windowOpen = true;
  const out = await sendSheet(env, "bellevue_towers", {}, deps);
  ok("send succeeds inside the window", out && out.ok === true, JSON.stringify(out));
  const upload = outbound.find(o => o.u.includes("/media"));
  ok("the bytes are UPLOADED to WhatsApp", !!upload);
  const p = posted[0] && posted[0].payload;
  ok("the message is a document sent by media id", p && p.type === "document" && p.document && p.document.id === "media.id.0001",
     JSON.stringify(p));
  ok("NO link is ever passed to Meta", !!p && !p.document.link && !JSON.stringify(p).includes("http"),
     JSON.stringify(p));
  ok("the filename a client sees is the building", p && p.document.filename === "Bellevue Towers.pdf");
  const m = await sheetMeta(env, "bellevue_towers");
  ok("the media id is cached for re-sending", m && m.wa_media_id === "media.id.0001");
}
{
  outbound = []; posted = [];
  const out = await sendSheet(env, "bellevue_towers", {}, deps);
  ok("a second send reuses the cached media id", out && out.ok && out.reused_media === true);
  ok("...and does not re-upload", !outbound.find(o => o.u.includes("/media")));
}
{
  // Re-ingesting DIFFERENT bytes must drop the cached id, or she sends yesterday's sheet.
  await call("/ingest_sheet?slug=bellevue_towers&name=Bellevue%20Towers&pages=3",
    { method: "POST", headers: { "X-Azimuth-Ingest": ING }, body: pdfBytes(5000) });
  const m = await sheetMeta(env, "bellevue_towers");
  ok("a rebuilt sheet forgets the old media id", !m.wa_media_id, JSON.stringify(m));
}
{
  outbound = []; posted = []; windowOpen = false;
  const out = await sendSheet(env, "bellevue_towers", {}, deps);
  ok("outside the window the send is HELD, not failed", out && out.ok === false && out.held === true, JSON.stringify(out));
  ok("...with a reason she can act on", out && /24-hour/.test(out.reason || "") && !!out.hint);
  ok("...and nothing was uploaded or sent", outbound.length === 0 && posted.length === 0);
  windowOpen = true;
}
{
  const out = await sendSheet(env, "never_built", {}, deps);
  ok("sending an unbuilt sheet is refused cleanly", out && out.ok === false && /no sheet/.test(out.error || ""));
}
{
  const r = await call("/sheet_send", { method: "POST", body: JSON.stringify({ key: CLIENT, slug: "bellevue_towers" }) });
  ok("the send route refuses the client key", r && r.status === 401, r && r.status);
}
{
  windowOpen = false;
  const r = await call("/sheet_send", { method: "POST", body: JSON.stringify({ key: READ, slug: "bellevue_towers" }) });
  ok("a held send answers 409, not 200", r && r.status === 409, r && r.status);
  windowOpen = true;
}

// ---------------------------------------------------------------- the module keeps to itself
{
  const other = await call("/residents", { method: "GET" });
  ok("an unrelated path falls through to index.js", other === null);
}

console.log("\n" + pass + " passed, " + fail + " failed\n");
process.exit(fail ? 1 : 0);
