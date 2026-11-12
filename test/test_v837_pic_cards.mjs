// v837 - picture cards on the Momo front door (Kendall 12 Nov 2026): "Najma logo pictures" (Najjuko + Kendall) and "Dr. Kendall pictures"
// (Kendall only, only his own uploads). Pictures are pds_index images by group; the Product data sheets card no longer shows those groups.
// Runs through the REAL worker entry point (src/index.js).
const worker = (await import("../src/index.js")).default;
let pass = 0, fail = 0; const ok = (c, msg, extra) => { if (c) pass++; else { fail++; console.log("FAIL", msg, extra === undefined ? "" : JSON.stringify(extra).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k, t) => { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" ? (typeof v === "string" ? new TextEncoder().encode(v).buffer : v) : v; },
  put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NAJ = "ins_najjuko_TESTKEY0123456789abcd", KEN = "ins_kendall_TESTKEY0123456789abcd", OTHER = "ins_someoneelse_0123456789abcdefgh";
const env = { MEETINGS: KV, INSIDER_KEY: [NAJ, KEN, OTHER].join(",") };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const get = (path, key) => worker.fetch(new Request("https://w" + path + (key === undefined ? "" : (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key))), env, ctx);
const cards = (h) => [...h.matchAll(/<a class=card[^>]*href="([^"]+)"[^>]*>.*?<b>([^<]+)<\/b><\/a>/g)].map((m) => [m[1], m[2]]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 0]).buffer;
store.set("pds_index", JSON.stringify([
  { slug: "sheet-a", title: "Sheet A", kind: "pdf" },
  { slug: "najma-logo-holding-glow", title: "Najjuko holding the Najma logo", group: "Najma logo pictures", kind: "image", ext: "png", thumb: true },
  { slug: "najma-logo-leaning-dubai", title: "Leaning Dubai", group: "Najma logo pictures", kind: "image", ext: "png", thumb: true },
]));
store.set("pds_file_najma-logo-holding-glow", png); store.set("pds_thumb_najma-logo-holding-glow", png);

// 1. Najjuko: own card with the first picture as cover; Kendall's private card absent
{ const h = await (await get("/momo", NAJ)).text(), c = cards(h);
  ok(c.some((x) => x[1] === "Najma logo pictures" && x[0].startsWith("/momo/work/pics/najma-logo?key=")), "Najjuko has the Najma logo pictures card", c.map((x) => x[1]));
  ok(h.includes('src="/pds/t/najma-logo-holding-glow.jpg"'), "cover = first picture thumbnail");
  ok(!c.some((x) => x[1] === "Dr. Kendall pictures"), "Kendall's card is not on hers");
  ok(c[0][1] === "Product sheets", "Product sheets stays first", c[0]); }
// 2. Kendall: both cards; his is empty with the icon
{ const h = await (await get("/momo", KEN)).text(), c = cards(h).map((x) => x[1]);
  ok(c.includes("Najma logo pictures") && c.includes("Dr. Kendall pictures"), "Kendall has both cards", c);
  ok(/card_pics_kendall-pictures[^>]*><svg/.test(h), "empty card shows the placeholder icon"); }
// 3. Others: neither card
{ const r = await get("/momo", OTHER), h = r.status === 200 ? await r.text() : ""; ok(!h.includes("card_pics_"), "another insider has no picture cards"); }
// 4. The card page: Najjuko sees both pictures, titled, with picture wording
{ const r = await get("/momo/work/pics/najma-logo", NAJ), h = await r.text();
  ok(r.status === 200 && h.includes("<h1>Najma logo pictures</h1>"), "card page opens with its title", r.status);
  ok(h.includes("Najjuko holding the Najma logo") && h.includes("Leaning Dubai"), "both pictures listed");
  ok(!h.includes("Sheet A"), "no data sheets on the picture page");
  ok(h.includes('WHAT="picture"'), "share wording says picture"); }
// 5. The Product data sheets page no longer shows the picture group (page AND list)
{ const h = await (await get("/momo/work/sheets", NAJ)).text();
  ok(h.includes("Sheet A") && !h.includes("Najjuko holding the Najma logo"), "sheets page excludes the picture group");
  const l = await (await get("/momo/work/sheets/list", NAJ)).json(); ok(l.length === 1 && l[0].slug === "sheet-a", "sheets list excludes it too", l); }
// 6. Kendall's private card: gate + only his own uploads
{ ok((await get("/momo/work/pics/kendall-pictures", NAJ)).status === 404, "Najjuko cannot open Kendall's card");
  ok((await get("/momo/work/pics/kendall-pictures", OTHER)).status === 404, "another insider cannot");
  ok((await get("/momo/work/pics/najma-logo", OTHER)).status === 404, "another insider cannot open hers");
  ok((await get("/momo/work/pics/najma-logo")).status === 404, "no key: refused");
  const idx = JSON.parse(store.get("pds_index"));
  idx.push({ slug: "dsc00415", title: "DSC00415", group: "Kendall pictures", kind: "image", ext: "jpg", thumb: true, uploaded_by: "kendall" },
    { slug: "fake-k", title: "Not his", group: "Kendall pictures", kind: "image", ext: "jpg" });
  store.set("pds_index", JSON.stringify(idx));
  const h = await (await get("/momo/work/pics/kendall-pictures", KEN)).text();
  ok(h.includes("DSC00415") && !h.includes("Not his"), "Kendall's card shows only his own uploads");
  const n = await (await get("/momo", NAJ)).text(); ok(!n.includes("DSC00415"), "his picture appears nowhere on hers");
  const s = await (await get("/momo/work/sheets", KEN)).text(); ok(!s.includes("DSC00415"), "and not in his sheets card");
  ok((await get("/momo/work/pics/nope", KEN)).status === 404, "unknown card 404"); }
// 7. the page script parses (page and script together)
{ const h = await (await get("/momo/work/pics/najma-logo", NAJ)).text(); const js = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let bad = 0; for (const j of js) { try { new Function(j); } catch (e) { bad++; console.log(e.message); } } ok(js.length > 0 && !bad, "every script on the picture page parses", js.length); }
console.log("v837 pic cards: " + pass + " passed, " + fail + " failed"); if (fail) process.exit(1);
