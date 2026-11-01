// v684 - the Presentations card on Najjuko's Momo front door: the card gate (her key + Kendall's, nobody else), the list page,
// the public /pres/<slug> share page (Download PPTX, Open PDF, Watch), the files with the right types, merge-by-slug writes,
// a video link instead of a stored video, bad slugs, and no emoji in the source.
// Through the REAL worker entry point (src/index.js) with a fake KV. FAKE keys and FAKE data only (the worker repo is public).
import fs from "node:fs";
const worker = (await import("../src/index.js")).default;
const P = await import("../src/work_presentations.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k, t) => { if (!store.has(k)) return null; const v = store.get(k); if (t === "arrayBuffer") return typeof v === "string" ? new TextEncoder().encode(v).buffer : v; return typeof v === "string" ? v : new TextDecoder().decode(v); },
  put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NAJ = "ins_najjuko_TESTKEY0123456789abcd", KEN = "ins_kendall_TESTKEY0123456789abcd", OTHER = "ins_someoneelse_0123456789abcdefgh", READ = "readkey_TEST_0123456789abcdef";
const env = { MEETINGS: KV, INSIDER_KEY: [NAJ, KEN, OTHER].join(","), READ_KEY: READ };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const get = (path, key, h) => worker.fetch(new Request("https://w" + path + (key === undefined ? "" : (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key)), { headers: h || {} }), env, ctx);

let r = await get("/momo/work/presentations", NAJ), t = await r.text();
ok(r.status === 200 && t.includes("Presentations coming"), "empty page for Najjuko", r.status);

const PPTX = new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8]), PDF = new TextEncoder().encode("%PDF-1.7 fake"), MP4 = new Uint8Array(1000).map((_, i) => i % 251);
store.set("pres_file_high-tea-theblocks-2nov2026_pptx", PPTX.buffer); store.set("pres_file_high-tea-theblocks-2nov2026_pdf", PDF.buffer); store.set("vid_pres_high_tea_2nov", MP4.buffer);
await P.putPresEntry(env, { slug: "high-tea-theblocks-2nov2026", title: "High Tea · TheBlocks HQ", date: "2026-11-02", pptx: true, pdf: true, video_key: "pres_high_tea_2nov" });
await P.putPresEntry(env, { slug: "older-talk", title: "Older talk", date: "2026-10-01", video_url: "https://youtu.be/abc" });
await P.putPresEntry(env, { slug: "older-talk", title: "Older talk (renamed)" });
const idx = await P.readPresIndex(env);
ok(idx.length === 2, "two entries after merges", idx);
const ot = idx.find((e) => e.slug === "older-talk");
ok(ot.video_url === "https://youtu.be/abc" && ot.title === "Older talk (renamed)", "merge keeps fields not given", idx);
ok(P.mergeEntry(idx, { slug: "BAD SLUG", title: "x" }) === idx, "bad slug refused");
ok(P.cleanEntry({ slug: "a", title: "a", video_url: "javascript:alert(1)" }).video_url === undefined, "non-https video link dropped");
ok(P.presSorted(idx)[0].slug === "high-tea-theblocks-2nov2026", "newest first");
ok(P.presDate("2026-11-02") === "2 November 2026", "date words");

for (const [k, want, m] of [[NAJ, true, "Najjuko"], [KEN, true, "Kendall"], [OTHER, false, "other insider"]]) {
  r = await get("/momo", k); t = await r.text();
  ok(t.includes("id=card_pres") === want, "card on door: " + m, r.status);
}
r = await get("/momo/work/presentations", OTHER); ok(r.status === 404, "list page hidden from other insider", r.status);
r = await get("/momo/work/presentations", "wrongkey"); t = await r.text(); ok(r.status !== 200 && !t.includes("High Tea"), "list page hidden from wrong key", r.status);
r = await get("/momo/work/presentations"); ok(r.status !== 200, "list page needs a key", r.status);

r = await get("/momo/work/presentations", NAJ); t = await r.text();
ok(r.status === 200 && t.includes("High Tea · TheBlocks HQ") && t.includes("2 November 2026"), "list shows entry and date");
ok(t.indexOf("High Tea") < t.indexOf("Older talk"), "list newest first");
ok(t.includes("https://w/pres/high-tea-theblocks-2nov2026") && t.includes("Kind regards,\\nNajjuko"), "share link + her signature");
const ids = [...t.matchAll(/id=([a-z_]+)/g)].map((x) => x[1]); ok(ids.length === new Set(ids).size, "ids unique", ids);
r = await get("/momo/work/presentations", KEN); t = await r.text(); ok(t.includes("Dr. Kendall Wilson"), "Kendall's signature for Kendall");
r = await get("/momo/work/presentations/list", NAJ); const L = await r.json(); ok(Array.isArray(L) && L.length === 2, "list json", L);

r = await get("/pres/high-tea-theblocks-2nov2026"); t = await r.text();
ok(r.status === 200 && t.includes("<title>High Tea · TheBlocks HQ</title>"), "public page", r.status);
ok(t.includes('href="/pres/f/high-tea-theblocks-2nov2026.pptx" download>Download PPTX') && t.includes("/pres/f/high-tea-theblocks-2nov2026.pdf") && t.includes("Open PDF"), "pptx + pdf buttons");
ok(t.includes("<video id=pres_v") && t.includes('src="/video/pres_high_tea_2nov"') && t.includes(">Watch<"), "video player + Watch");
r = await get("/pres/older-talk"); t = await r.text();
ok(t.includes('href="https://youtu.be/abc" target=_blank') && !t.includes("<video") && !t.includes("Download PPTX"), "link-only entry");
r = await get("/pres/nope"); ok(r.status === 404, "unknown slug 404", r.status);
r = await get("/pres/f/older-talk.pptx"); ok(r.status === 404, "no pptx on that entry -> 404", r.status);
r = await get("/pres/f/high-tea-theblocks-2nov2026.pptx");
ok(r.status === 200 && r.headers.get("Content-Type").includes("presentationml") && r.headers.get("Content-Disposition").startsWith("attachment"), "pptx served", [r.status, r.headers.get("Content-Type")]);
ok(new Uint8Array(await r.arrayBuffer())[0] === 0x50, "pptx bytes");
r = await get("/pres/f/high-tea-theblocks-2nov2026.pdf");
ok(r.status === 200 && r.headers.get("Content-Type") === "application/pdf" && r.headers.get("Content-Disposition").startsWith("inline"), "pdf served inline", r.status);
r = await get("/video/pres_high_tea_2nov", undefined, { Range: "bytes=0-99" });
ok(r.status === 206 && r.headers.get("Content-Range") === "bytes 0-99/1000", "video plays with ranges", r.status);

const src = fs.readFileSync(new URL("../src/work_presentations.js", import.meta.url), "utf8");
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src), "no emoji in the source");
const isrc = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/const PRS = sheets \?/.test(isrc) && isrc.includes("+ BRK + PRS +"), "card gated like sheets, after Brokers");
console.log("v684 presentations: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
