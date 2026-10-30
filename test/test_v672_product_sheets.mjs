// v672 - Product data sheets: the FIRST card on Najjuko's Momo front door (Kendall's too, after Product briefs), its own KV keys (pds_*),
// its own gate (Najjuko + Kendall only), the empty "Sheets coming" state, PDF and image tiles with WhatsApp / Email / Copy link, and public /pds/ files.
// Runs through the REAL worker entry point (src/index.js), not just the module.
const worker = (await import("../src/index.js")).default;
let pass = 0, fail = 0; const ok = (c, msg, extra) => { if (c) pass++; else { fail++; console.log("FAIL", msg, extra === undefined ? "" : JSON.stringify(extra).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k, t) => { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" ? (typeof v === "string" ? new TextEncoder().encode(v).buffer : v) : v; },
  put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NAJ = "ins_najjuko_TESTKEY0123456789abcd", KEN = "ins_kendall_TESTKEY0123456789abcd", OTHER = "ins_someoneelse_0123456789abcdefgh", READ = "readkey_TEST_0123456789abcdef";
const env = { MEETINGS: KV, INSIDER_KEY: [NAJ, KEN, OTHER].join(","), READ_KEY: READ };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const get = (path, key) => worker.fetch(new Request("https://w" + path + (key === undefined ? "" : (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key))), env, ctx);
const cards = (h) => [...h.matchAll(/<a class=card[^>]*href="([^"]+)"[^>]*>.*?<b>([^<]+)<\/b><\/a>/g)].map((m) => [m[1], m[2]]);

// 1. Najjuko's front door: Product data sheets is the FIRST card
{ const r = await get("/momo", NAJ); const h = await r.text(); const c = cards(h);
  ok(r.status === 200, "Najjuko's front door opens", r.status);
  ok(c.length && c[0][1] === "Product data sheets" && c[0][0].startsWith("/momo/work/sheets?key="), "Product data sheets is her first card", c.slice(0, 3));
  ok(!c.some((x) => x[1] === "Product briefs"), "Kendall's Product briefs card is not on hers", c.map((x) => x[1]));
  ok(!/[\u{1F300}-\u{1FAFF}]/u.test(h), "no emoji on the front door"); }
// 2. Kendall's front door: briefs first, sheets second
{ const h = await (await get("/momo", KEN)).text(); const c = cards(h).map((x) => x[1]);
  ok(c[0] === "Product briefs" && c[1] === "Product data sheets", "Kendall sees Product briefs then Product data sheets", c.slice(0, 3)); }
// 3. Nobody else gets the card
{ const r = await get("/momo", OTHER); const h = r.status === 200 ? await r.text() : "";
  ok(!h.includes("Product data sheets"), "another insider's front door has no sheets card", r.status); }

// 4. the page: empty state for both people
for (const [who, k] of [["Najjuko", NAJ], ["Kendall", KEN]]) {
  const r = await get("/momo/work/sheets", k); const h = await r.text();
  ok(r.status === 200 && h.includes("<h1>Product data sheets</h1>"), who + " opens the sheets page", r.status);
  ok(h.includes("Sheets coming") && h.includes("id=pds_empty"), who + " sees the friendly 'Sheets coming' state while the index is empty");
}
// 5. the gate: wrong key, no key, another insider, the admin read key -> refused
for (const [lbl, k] of [["no key", ""], ["wrong key", "wrong"], ["another insider", OTHER], ["admin read key", READ]]) {
  for (const path of ["/momo/work/sheets", "/momo/work/sheets/list"]) { const r = await get(path, k); ok(r.status === 401 || r.status === 404, path + " refuses " + lbl, r.status); }
}

// 6. separate KV keys: briefs in pb_index never show here, sheets in pds_index never show in briefs
store.set("pb_index", JSON.stringify([{ slug: "kendall-brief", title: "Kendall Brief Only", group: "SketchUp", phone: true }]));
store.set("pds_index", JSON.stringify([{ slug: "test-pdf", title: "Test PDF Sheet", group: "Kitchens", kind: "pdf" },
  { slug: "test-pic", title: "Test Picture Sheet", group: "Kitchens", kind: "image", ext: "jpg" }, { slug: "BAD SLUG", title: "x", kind: "pdf" }, { slug: "no-kind", title: "y" }]));
store.set("pds_file_test-pdf", "%PDF-1.4 test"); store.set("pds_file_test-pic", "JPEGDATA");
{ const h = await (await get("/momo/work/sheets", NAJ)).text();
  ok(h.includes("Test PDF Sheet") && h.includes("Test Picture Sheet"), "her sheets show as tiles");
  ok(!h.includes("Kendall Brief Only"), "a product brief never shows among her sheets");
  ok(!h.includes("Sheets coming"), "the empty state goes once sheets exist");
  ok(h.includes('data-f="https://w/pds/f/test-pdf.pdf"') && h.includes("data-d=1"), "the PDF tile opens the PDF");
  ok(h.includes('data-f="https://w/pds/f/test-pic.jpg"'), "the picture tile opens the picture");
  for (const id of ["pds_w", "pds_e", "pds_c", "pds_o"]) ok(h.includes("id=" + id), "share sheet has " + id);
  ok(h.includes("https://wa.me/?text=") && h.includes("mailto:?subject=") && h.includes("navigator.clipboard.writeText"), "WhatsApp, Email and Copy link are wired");
  ok(h.includes("Kind regards,\\nNajjuko") && !h.includes("Kendall Wilson"), "her email is signed by her, not Kendall");
  ok(!h.includes("BAD SLUG") && !h.includes(">y<"), "malformed index rows are ignored");
  const l = await (await get("/momo/work/sheets/list", NAJ)).json(); ok(Array.isArray(l) && l.length === 2, "the list endpoint returns the two good sheets", l); }
{ const h = await (await get("/momo/work/briefs", KEN)).text(); ok(!h.includes("Test PDF Sheet"), "her sheets never show in Kendall's Product briefs"); }
{ const r = await get("/momo/work/briefs", NAJ); ok(r.status === 404, "Product briefs stays Kendall-only", r.status); }

// 7. public files and share pages (no key: what she sends)
{ const r = await get("/pds/f/test-pdf.pdf"); ok(r.status === 200 && r.headers.get("content-type") === "application/pdf", "the PDF is public", r.status); }
{ const r = await get("/pds/f/test-pic.jpg"); ok(r.status === 200 && r.headers.get("content-type") === "image/jpeg", "the picture is public", r.status); }
{ const r = await get("/pds/f/test-pdf.png"); ok(r.status === 404, "a wrong extension is not served", r.status); }
{ const r = await get("/pds/f/nothing.pdf"); ok(r.status === 404, "an unknown sheet is 404", r.status); }
{ const r = await get("/pds/test-pdf"); const h = await r.text(); ok(r.status === 200 && h.includes("Open the PDF") && h.includes('og:title" content="Test PDF Sheet"'), "the PDF share page", r.status); }
{ const r = await get("/pds/test-pic"); const h = await r.text(); ok(r.status === 200 && h.includes('og:image" content="https://w/pds/f/test-pic.jpg"'), "the picture share page previews the picture", r.status); }
{ const r = await get("/pds/kendall-brief"); ok(r.status === 404, "a brief slug is not a sheet", r.status); }

console.log("v672 product data sheets: " + pass + " passed, " + fail + " failed"); if (fail) process.exit(1);
