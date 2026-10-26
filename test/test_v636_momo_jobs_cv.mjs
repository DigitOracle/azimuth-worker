// v636 - Momo Jobs: CVs uploaded once and kept in KV. Through worker.fetch. FAKE bytes only (a tiny made-up PDF); the public repo never holds a real CV.
const worker = (await import("../src/index.js")).default;
const { cvKind, JOBS_JS } = await Promise.all([import("../src/work_jobs.js"), import("../src/work_jobs_page.js")]).then(([a, b]) => ({ cvKind: a.cvKind, JOBS_JS: b.JOBS_JS }));
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [], list_complete: true }) };
const NAJ = "ins_najjuko_TESTKEY0123456789abcd", OWNER = "ins_owner_0123456789abcdefghijk";
const env = { MEETINGS: KV, INSIDER_KEY: NAJ + "," + OWNER }, ctx = { waitUntil() {}, passThroughOnException() {} };
const b64 = (u8) => Buffer.from(u8).toString("base64");
const FAKEPDF = new TextEncoder().encode("%PDF-1.4\nfake test file, not a real CV\n%%EOF");
const call = (path, key, body, method) => worker.fetch(new Request("https://w" + path + "?key=" + encodeURIComponent(key), body === undefined ? { method: method || "GET" } : { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), env, ctx);

let r = await call("/momo/work/jobs/cv", NAJ, { action: "put", group: "MKT", name: "Test_CV_Marketing.pdf", data: b64(FAKEPDF) }), j = await r.json();
ok(r.status === 200 && j.ok && j.cv.MKT.name === "Test_CV_Marketing.pdf" && j.cv.MKT.size === FAKEPDF.length && j.cv.MKT.type === "pdf", "her key uploads a CV", [r.status, j]);
ok(store.get("jobs_cv_najjuko_MKT") === b64(FAKEPDF) && JSON.parse(store.get("jobs_cvmeta_najjuko")).MKT.size === FAKEPDF.length, "stored as base64 with a meta record");
r = await call("/momo/work/jobs/cv/MKT", OWNER); const got = new Uint8Array(await r.arrayBuffer());
ok(r.status === 200 && r.headers.get("content-type") === "application/pdf" && /Test_CV_Marketing\.pdf/.test(r.headers.get("content-disposition")) && Buffer.compare(Buffer.from(got), Buffer.from(FAKEPDF)) === 0, "the owner's key gets the exact bytes back", [r.status, r.headers.get("content-type")]);
j = await (await call("/momo/work/jobs/cv", OWNER)).json(); ok(j.cv && j.cv.MKT && !j.cv.DIG, "the list shows what is saved");
// refusals
const bad = async (body, st, msg) => { const x = await call("/momo/work/jobs/cv", NAJ, body); ok(x.status === st, msg, x.status); };
await bad({ action: "put", group: "XX", name: "a.pdf", data: b64(FAKEPDF) }, 400, "unknown group refused");
await bad({ action: "put", group: "DIG", name: "run.exe", data: b64(FAKEPDF) }, 400, "wrong extension refused");
await bad({ action: "put", group: "DIG", name: "fake.pdf", data: b64(new TextEncoder().encode("MZ not a pdf at all")) }, 400, "a .pdf whose bytes are not a PDF is refused");
await bad({ action: "put", group: "DIG", name: "fake.docx", data: b64(FAKEPDF) }, 400, "a .docx that is really a PDF is refused");
await bad({ action: "put", group: "DIG", name: "big.pdf", data: b64(Buffer.concat([Buffer.from(FAKEPDF), Buffer.alloc(6 * 1024 * 1024)]))}, 413, "over 6 MB refused");
await bad({ action: "put", group: "DIG", name: "x.pdf", data: "!!notbase64!!" }, 400, "bad base64 refused");
await bad({ action: "wipe", group: "DIG" }, 400, "unknown action refused");
ok(!store.has("jobs_cv_najjuko_DIG"), "nothing was stored by the refused uploads");
ok(cvKind("a.docx", [0x50, 0x4b, 3, 4]) === "docx" && cvKind("a.doc", [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) === "doc" && cvKind("a.txt", [0x25, 0x50, 0x44, 0x46, 0x2d]) === "", "Word and PDF magic bytes");
// gate
for (const k of ["", "wrong", "ins_short"]) {
  const x = await call("/momo/work/jobs/cv", k, { action: "put", group: "MKT", name: "a.pdf", data: b64(FAKEPDF) }); ok(x.status === 401 || x.status === 404, "upload refused with key '" + k + "'", x.status);
  const y = await call("/momo/work/jobs/cv/MKT", k); ok(y.status === 404 || y.status === 401, "download refused with key '" + k + "'", y.status);
}
// replace, then delete
r = await call("/momo/work/jobs/cv", NAJ, { action: "put", group: "MKT", name: "Second.pdf", data: b64(FAKEPDF) }); j = await r.json(); ok(j.cv.MKT.name === "Second.pdf", "replace keeps one file");
r = await call("/momo/work/jobs/cv", NAJ, { action: "delete", group: "MKT" }); j = await r.json(); ok(j.ok && !j.cv.MKT && !store.has("jobs_cv_najjuko_MKT"), "delete removes the file and its meta");
ok((await call("/momo/work/jobs/cv/MKT", NAJ)).status === 404, "a deleted CV is gone");
// the page carries the upload and share buttons, and no CV content
const pg = await (await call("/momo/work/jobs", NAJ)).text();
ok(/id="cvfile"/.test(pg) && /data-cvup/.test(JOBS_JS) && /data-cvshare2/.test(JOBS_JS) && /navigator\.canShare/.test(JOBS_JS) && /Share CV and email/.test(JOBS_JS) && /Save CV/.test(JOBS_JS), "the page has upload, share and save");
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
