// v675 - Product data sheets through the Momo bridge: GET sheets, POST sheet (picture or PDF from a person's own Claude Code), POST sheet/delete.
// Through the REAL worker entry point (src/index.js) with a fake KV. FAKE keys and FAKE data only (the worker repo is public).
import zlib from "node:zlib";
const worker = (await import("../src/index.js")).default;
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map(); let puts = 0;
const KV = { get: async (k, t) => { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" ? (typeof v === "string" ? new TextEncoder().encode(v).buffer : v) : v; },
  put: async (k, v) => { puts++; store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NB = "brg_najjuko_FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE01", KB = "brg_kendall_FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE02";
const NAJ_LINK = "ins_najjuko_TESTKEY0123456789abcd", KEN_LINK = "ins_kendall_TESTKEY0123456789abcd";
const env = { MEETINGS: KV, INSIDER_KEY: NAJ_LINK + "," + KEN_LINK, MOMO_BRIDGE_KEYS: "najjuko:" + NB + ",kendall:" + KB }, ctx = { waitUntil() {}, passThroughOnException() {} };
const B = "https://w/momo/bridge/v1/";
const call = async (path, { key, method = "GET", body, idem, headers = {} } = {}) => {
  const h = Object.assign({}, headers); if (key) h.Authorization = "Bearer " + key; if (idem) h["Idempotency-Key"] = idem; if (body) h["Content-Type"] = "application/json";
  const r = await worker.fetch(new Request(B + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined }), env, ctx);
  let j = null; try { j = await r.clone().json(); } catch (e) {} return { s: r.status, j, r };
};
const page = (path, key) => worker.fetch(new Request("https://w" + path + "?key=" + encodeURIComponent(key)), env, ctx);

// a real 1x1 PNG (so the public route and the page serve something a browser can draw)
function png1x1() {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.from(type), len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.from([0, 0x0a, 0x4f, 0x4a]))), chunk("IEND", Buffer.alloc(0))]);
}
const PNG = png1x1(), PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"), JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x10, 0, 0, 0]), Buffer.from("WEBPVP8 "), Buffer.alloc(8)]);
const up = (key, body, idem) => call("sheet", { key, method: "POST", body, idem });
const b64 = (b) => b.toString("base64");

// seed: three loaded sheets (as load_pds.py writes them: no uploaded_by)
const SEED = [{ slug: "najma-master", title: "Najma: Dubai property intelligence", group: "Najma", kind: "pdf", thumb: true },
  { slug: "najma-brief", title: "Najma: The Brief", group: "Najma deep dives", kind: "pdf", thumb: true },
  { slug: "kitchen-pic", title: "Kitchen picture", group: "Kitchens", kind: "image", ext: "jpg" }];
store.set("pds_index", JSON.stringify(SEED)); for (const e of SEED) { store.set("pds_file_" + e.slug, "x"); if (e.thumb) store.set("pds_thumb_" + e.slug, "t"); }

// 1. auth
ok((await call("sheets")).s === 401, "GET sheets without a key: 401");
ok((await call("sheets", { key: "brg_najjuko_wrongwrongwrongwrongwrongwrong99" })).s === 401, "wrong key: 401");
ok((await worker.fetch(new Request(B + "sheets?key=" + NB), env, ctx)).status === 400, "key in the URL is refused");
ok((await worker.fetch(new Request(B + "sheet?key=" + NB, { method: "POST", headers: { Authorization: "Bearer " + NB, "Idempotency-Key": "k-in-url-0001" }, body: "{}" }), env, ctx)).status === 400, "POST sheet with ?key= refused even with the header");
ok((await call("sheet", { method: "POST", body: { title: "x" }, idem: "nokey-0001-aaaa" })).s === 401, "POST sheet without a key: 401");
ok((await call("sheet", { key: NB, method: "POST", body: { title: "x", content_b64: b64(PNG) } })).s === 400, "POST sheet without Idempotency-Key: 400");
ok((await call("sheet", { key: NB })).s === 404, "GET /sheet (the POST route by GET) is 404");
{ const w = await call("whoami", { key: NB }); ok(w.j.data.routes.includes("GET " + B.replace("https://w", "") + "sheets") && w.j.data.routes.includes("POST " + B.replace("https://w", "") + "sheet") && w.j.data.routes.includes("POST " + B.replace("https://w", "") + "sheet/delete"), "whoami lists the three sheet routes", w.j.data.routes); }

// 2. list before: the three loaded sheets, shaped
{ const r = await call("sheets", { key: NB }); const l = r.j && r.j.data && r.j.data.sheets;
  ok(r.s === 200 && Array.isArray(l) && l.length === 3, "GET sheets lists the three loaded sheets", r.j);
  const e = l && l.find((x) => x.slug === "najma-master");
  ok(e && e.title && e.group === "Najma" && e.kind === "pdf" && e.ext === "pdf" && e.share === "https://w/pds/najma-master" && e.file === "https://w/pds/f/najma-master.pdf" && e.thumb === "https://w/pds/t/najma-master.jpg" && e.uploaded_by === null && e.added_at === null, "a loaded sheet carries slug,title,group,kind,ext,share,file,thumb,uploaded_by,added_at", e);
  const k = l && l.find((x) => x.slug === "kitchen-pic"); ok(k && k.thumb === null && k.file === "https://w/pds/f/kitchen-pic.jpg", "a picture without a thumb has thumb null (the tile and share page use the file)", k);
  ok(!JSON.stringify(r.j).includes("pb_") && !("briefs" in (r.j.data || {})), "Product briefs (pb_*) are not in scope"); }

// 3. a PNG upload (its filename claims .pdf: the magic bytes win)
let slugA;
{ const before = puts; const r = await up(NB, { title: "Marina View Kitchen", group: "Kitchens", filename: "marina.pdf", kind: "pdf", content_b64: b64(PNG) }, "sheet-0001-aaaa");
  ok(r.s === 200 && r.j.ok && r.j.slug === "marina-view-kitchen" && r.j.share === "https://w/pds/marina-view-kitchen" && r.j.file === "https://w/pds/f/marina-view-kitchen.png", "upload returns ok, slug, share, file", r.j);
  ok(r.j.kind === "image" && r.j.ext === "png", "a PNG named .pdf is stored as an image (sniffed, the claim ignored)", r.j);
  slugA = r.j.slug;
  const idx = JSON.parse(store.get("pds_index")); const e = idx.find((x) => x.slug === slugA);
  ok(idx.length === 4 && SEED.every((s) => idx.some((x) => x.slug === s.slug)), "index merge keeps the three loaded entries: seed 3, add 1, expect 4", idx.map((x) => x.slug));
  ok(e && e.uploaded_by === "najjuko" && /^\d{4}-\d{2}-\d{2}T/.test(e.added_at) && e.kind === "image" && e.ext === "png", "the index entry carries uploaded_by and added_at", e);
  ok(store.has("pds_file_" + slugA) && !store.has("pds_thumb_" + slugA), "the file is stored, no separate thumb for a bridge picture (CSS scales the file)");
  const stored = store.get("pds_file_" + slugA); ok(stored && (stored.byteLength || stored.length) === PNG.length, "stored bytes are the decoded file", stored && (stored.byteLength || stored.length));
  const writes = puts - before; ok(writes >= 2, "first upload writes file + index", writes);
  // idempotent repeat
  const again = await up(NB, { title: "Marina View Kitchen", group: "Kitchens", filename: "marina.pdf", content_b64: b64(PNG) }, "sheet-0001-aaaa");
  ok(again.s === 200 && again.r.headers.get("Idempotent-Replay") === "true" && again.j.slug === slugA, "idempotent repeat returns the same slug", again.j);
  ok(JSON.parse(store.get("pds_index")).length === 4 && !store.has("pds_file_marina-view-kitchen-2"), "the repeat writes nothing (still 4 entries, no -2 file)"); }

// 4. slug uniqueness: same title with a NEW idempotency key -> -2, then -3
{ const r2 = await up(NB, { title: "Marina View Kitchen", content_b64: b64(JPG), filename: "a.jpg" }, "sheet-0002-aaaa");
  ok(r2.s === 200 && r2.j.slug === "marina-view-kitchen-2" && r2.j.ext === "jpg", "second sheet with the same title gets -2", r2.j);
  const r3 = await up(NB, { title: "  Marina   View Kitchen! ", content_b64: b64(WEBP) }, "sheet-0003-aaaa");
  ok(r3.s === 200 && r3.j.slug === "marina-view-kitchen-3" && r3.j.ext === "webp", "third gets -3 (title whitespace and punctuation normalised), webp accepted", r3.j);
  const long = await up(NB, { title: "A".repeat(120), content_b64: b64(PNG) }, "sheet-0004-aaaa");
  ok(long.s === 200 && long.j.slug.length <= 40 && /^[a-z0-9-]+$/.test(long.j.slug), "a long title gives a slug within the public route's 40 characters", long.j.slug); }

// 5. PDF upload: kind pdf, no thumb, badge on the page
{ const r = await up(NB, { title: "Spec sheet", group: "Specs", filename: "spec.png", content_base64: b64(PDF) }, "sheet-0005-aaaa");
  ok(r.s === 200 && r.j.kind === "pdf" && r.j.file.endsWith("/pds/f/spec-sheet.pdf"), "a PDF named .png is stored as a PDF (content_base64 accepted too)", r.j);
  const f = await worker.fetch(new Request("https://w/pds/f/spec-sheet.pdf"), env, ctx); ok(f.status === 200 && f.headers.get("content-type") === "application/pdf", "public PDF 200"); }

// 6. refusals: size, type, empty, bad base64, no title
{ const big = Buffer.concat([PNG, Buffer.alloc(12 * 1024 * 1024 + 1 - PNG.length)]);
  const r = await up(NB, { title: "Too big", content_b64: b64(big) }, "sheet-0006-aaaa"); ok(r.s === 413 && r.j.code === "too_big", "over 12 MB decoded is refused with 413", [r.s, r.j]);
  ok(!store.has("pds_file_too-big") && !JSON.parse(store.get("pds_index")).some((x) => x.slug === "too-big"), "nothing stored for the refused upload");
  const just = Buffer.concat([PNG, Buffer.alloc(12 * 1024 * 1024 - PNG.length)]);
  const r2 = await up(NB, { title: "Just fits", content_b64: b64(just) }, "sheet-0007-aaaa"); ok(r2.s === 200, "exactly 12 MB is accepted", [r2.s, r2.j]);
  ok((await up(NB, { title: "Text file", content_b64: b64(Buffer.from("hello world, this is not a picture")) }, "sheet-0008-aaaa")).s === 415, "a text file is refused (415)");
  ok((await up(NB, { title: "GIF", content_b64: b64(Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(20)])) }, "sheet-0009-aaaa")).s === 415, "a GIF is refused (not in the four accepted types)");
  ok((await up(NB, { title: "Empty", content_b64: "" }, "sheet-0010-aaaa")).s === 400, "empty content is 400");
  ok((await up(NB, { title: "Bad b64", content_b64: "!!!not base64!!!" }, "sheet-0011-aaaa")).s === 400, "bad base64 is 400");
  ok((await up(NB, { content_b64: b64(PNG) }, "sheet-0012-aaaa")).s === 400, "no title is 400");
  ok((await up(NB, { title: "Data URL", content_b64: "data:image/png;base64," + b64(PNG) }, "sheet-0013-aaaa")).s === 200, "a data: URL prefix is tolerated"); }

// 7. public routes after upload
{ const f = await worker.fetch(new Request("https://w/pds/f/" + slugA + ".png"), env, ctx);
  ok(f.status === 200 && f.headers.get("content-type") === "image/png" && (await f.arrayBuffer()).byteLength === PNG.length, "public /pds/f/<slug>.png is 200 with the PNG bytes");
  ok((await worker.fetch(new Request("https://w/pds/f/" + slugA + ".pdf"), env, ctx)).status === 404, "the same slug with .pdf is 404");
  ok((await worker.fetch(new Request("https://w/pds/f/marina-view-kitchen-3.webp"), env, ctx)).status === 200, "public .webp served");
  const sp = await worker.fetch(new Request("https://w/pds/" + slugA), env, ctx); const h = await sp.text();
  ok(sp.status === 200 && h.includes('og:image" content="https://w/pds/f/' + slugA + '.png"') && h.includes("Marina View Kitchen"), "the share page previews the uploaded picture");
  ok((await worker.fetch(new Request("https://w/pds/t/" + slugA + ".jpg"), env, ctx)).status === 404, "no thumb route for a bridge picture (the page uses the file)"); }

// 8. kendall: sees the loaded sheets, not hers; may upload his own; cannot delete hers
{ const r = await call("sheets", { key: KB }); const l = r.j.data.sheets;
  ok(r.s === 200 && l.length === 3 && !l.some((x) => x.uploaded_by), "kendall sees the three loaded sheets and none of Najjuko's uploads", l.map((x) => x.slug));
  const k = await up(KB, { title: "Kendall test sheet", content_b64: b64(PNG) }, "ken-sheet-0001"); ok(k.s === 200 && k.j.slug === "kendall-test-sheet", "kendall uploads his own", k.j);
  const n = await call("sheets", { key: NB }); ok(!n.j.data.sheets.some((x) => x.slug === "kendall-test-sheet") && n.j.data.sheets.filter((x) => x.uploaded_by === "najjuko").length === 7, "Najjuko does not see his, sees her seven", n.j.data.sheets.map((x) => x.slug));
  const d = await call("sheet/delete", { key: KB, method: "POST", body: { slug: slugA }, idem: "ken-del-0001-aaaa" }); ok(d.s === 403 && d.j.code === "not_yours", "kendall cannot delete her upload", d.j);
  ok(store.has("pds_file_" + slugA), "her file is still there after his refused delete"); }

// 9. delete by owner; loaded sheets cannot be deleted
{ const d = await call("sheet/delete", { key: NB, method: "POST", body: { slug: "najma-master" }, idem: "naj-del-0001-aaaa" }); ok(d.s === 403, "a loaded sheet is not deletable through the bridge", d.j);
  ok((await call("sheet/delete", { key: NB, method: "POST", body: { slug: "nothing-here" }, idem: "naj-del-0002-aaaa" })).s === 404, "unknown slug 404");
  ok((await call("sheet/delete", { key: NB, method: "POST", body: {}, idem: "naj-del-0003-aaaa" })).s === 400, "no slug 400");
  const before = JSON.parse(store.get("pds_index")).length;
  const d2 = await call("sheet/delete", { key: NB, method: "POST", body: { slug: "marina-view-kitchen-2" }, idem: "naj-del-0004-aaaa" }); ok(d2.s === 200 && d2.j.deleted, "owner deletes her own", d2.j);
  ok(!store.has("pds_file_marina-view-kitchen-2") && JSON.parse(store.get("pds_index")).length === before - 1 && !JSON.parse(store.get("pds_index")).some((x) => x.slug === "marina-view-kitchen-2"), "file and index entry gone, the rest kept");
  ok((await worker.fetch(new Request("https://w/pds/f/marina-view-kitchen-2.jpg"), env, ctx)).status === 404, "the public file is gone too");
  const rep = await call("sheet/delete", { key: NB, method: "POST", body: { slug: "marina-view-kitchen-2" }, idem: "naj-del-0004-aaaa" }); ok(rep.s === 200 && rep.r.headers.get("Idempotent-Replay") === "true", "delete retry replays"); }

// 10. index merge is from a RE-READ, never a stale copy: a loader writes between two bridge uploads and its entry survives
{ const idx = JSON.parse(store.get("pds_index")); idx.unshift({ slug: "loader-new", title: "Loaded meanwhile", group: "Najma", kind: "pdf", thumb: true }); store.set("pds_index", JSON.stringify(idx)); store.set("pds_file_loader-new", "%PDF");
  const r = await up(NB, { title: "After the loader", content_b64: b64(PNG) }, "sheet-0020-aaaa");
  const now = JSON.parse(store.get("pds_index")); ok(r.s === 200 && now.some((x) => x.slug === "loader-new") && now.some((x) => x.slug === "after-the-loader"), "an entry written by the loader between calls is kept", now.map((x) => x.slug)); }

// 11. the card page lists the upload with the tag; the loaded tiles unchanged; Kendall's page shows no tag on hers
{ const r = await page("/momo/work/sheets", NAJ_LINK); const h = await r.text();
  ok(r.status === 200 && h.includes("Marina View Kitchen") && h.includes('data-f="https://w/pds/f/' + slugA + '.png"') && h.includes('src="/pds/f/' + slugA + '.png"'), "her card page lists the bridge upload as a tile with the file as its picture");
  ok(h.includes("added by you"), "the tile carries the 'added by you' tag");
  ok(h.includes("Najma: The Brief") && h.includes('data-s="https://w/pds/najma-master"'), "the loaded tiles are unchanged");
  ok(h.includes("<summary>Kitchens") && h.includes("<summary>Specs"), "the upload's group is a group on the page");
  ok(h.includes('data-f="https://w/pds/f/spec-sheet.pdf"') && h.includes("<span class=pdf>PDF</span>"), "a bridge PDF shows the PDF badge");
  ok(!h.includes("kendall-test-sheet"), "his upload is not on her page");
  for (const id of ["pds_w", "pds_e", "pds_c", "pds_o"]) ok(h.includes("id=" + id), "share sheet has " + id);
  const kp = await (await page("/momo/work/sheets", KEN_LINK)).text();
  ok(kp.includes("kendall-test-sheet") && !kp.includes(slugA) && (kp.match(/added by you/g) || []).length === 1, "Kendall's page: his upload tagged once, hers absent");
  const l = await (await page("/momo/work/sheets/list", NAJ_LINK)).json(); ok(l.some((x) => x.slug === slugA) && !l.some((x) => x.slug === "kendall-test-sheet"), "her list endpoint matches"); }

// 12. logs carry route + status only, never the content or the base64
{ const logs = [...store.keys()].filter((k) => k.startsWith("brg_log_najjuko_")).map((k) => store.get(k));
  ok(logs.some((v) => JSON.parse(v).route === "post:sheet" && JSON.parse(v).status === 200) && logs.some((v) => JSON.parse(v).route === "post:sheet/delete"), "sheet calls are logged by route and status");
  ok(logs.every((v) => Object.keys(JSON.parse(v)).sort().join() === "at,person,route,status") && !logs.some((v) => /Marina|iVBOR|base64/.test(v)), "logs never hold a title or the content"); }

console.log("v675 bridge sheets: " + pass + " passed, " + fail + " failed"); if (fail) process.exit(1);
