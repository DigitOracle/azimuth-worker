// DEVELOPER PROFILE (v614) - the lower half of the START card, /developer_profile and /developer_profile_pdf.
//
// Kendall, 20 Oct 2026: split the START box (Developers by area on top, Developer profile below); the profile is three pages at most
// with a PDF to download.
//
// What this proves:
//   1. cleanIndex: only well-formed ids, a name, pages clamped to 0..3 (three is a ceiling), ready profiles first, a bad file = nothing
//   2. imageInfo reads the size of a PNG and a JPEG (the PDF page takes its proportions from the first picture)
//   3. through the real worker (KV stubbed): the key gate (none, wrong, POST), the roster, the developer page ("1 OF 3" .. "3 OF 3", a PDF
//      button), "In preparation" for a developer with no pictures, an id that is not in the roster reads nothing
//   4. the pictures are keyed: /img/devprofile_* is 401 without a key and served with a client key
//   5. the PDF: at most three pages even when a fourth picture sits in KV, one picture per page, the page shaped like the picture,
//      the file named for the developer and date, 404 when nothing is published, 503 without Browser Rendering, 429 when busy
//   6. the START card: one box, two halves, the top half still goes to /developers_map and the bottom half to /developer_profile
// NEGATIVE CONTROLS: (a) put "/developer_profile" back out of CLIENT_PATHS and the client-key checks fail with 401; (b) remove the
//   devprofile_ line from the /img gate and the keyless-picture check fails.
//
//   node test/test_v614_devprofile.mjs
import worker from "../src/index.js";
import { cleanIndex, imageInfo, MAX_PAGES } from "../src/devprofile.js";
import { __setLauncher } from "../src/brief_docs.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d !== undefined ? "\n         " + String(typeof d === "object" ? JSON.stringify(d) : d).slice(0, 400) : "")); } };

// ---- 1. the index ---------------------------------------------------------------------------------------------------------------
const messy = { as_of: "2026-10-20", developers: [
  { id: "Sobha", name: "Sobha", pages: 3, updated: "2026-10-20" },
  { id: "damac", name: "DAMAC", pages: 0 },
  { id: "emaar", name: "Emaar", pages: 9, updated: "2026-10-19T08:00:00Z", as_of: "2026-06-15" },
  { id: "emaar", name: "Emaar again", pages: 3 },
  { id: "bad id!", name: "Bad", pages: 3 },
  { id: "x", name: "Too short id", pages: 3 },
  { id: "azizi", name: "  ", pages: 3 },
  { id: "ellington", name: "<b>Ellington</b>", pages: "2" },
  null, 7,
] };
const ci = cleanIndex(messy);
ok(ci && ci.developers.map((d) => d.id).join() === "ellington,emaar,sobha,damac", "index: bad ids, a blank name and a duplicate are dropped; ready profiles first, then by name", ci && ci.developers.map((d) => d.id));
ok(ci.developers.find((d) => d.id === "emaar").pages === MAX_PAGES && MAX_PAGES === 3, "index: pages 9 is clamped to 3 (three is a ceiling)");
ok(!/[<>]/.test(ci.developers.find((d) => d.id === "ellington").name), "index: angle brackets are stripped from a name");
ok(ci.developers.find((d) => d.id === "ellington").pages === 2 && ci.developers.find((d) => d.id === "emaar").updated === "2026-10-19" && ci.developers.find((d) => d.id === "emaar").as_of === "2026-06-15", "index: a numeric string page count is read; dates are cut to the day");
ok(cleanIndex(null) === null && cleanIndex({}) === null && cleanIndex({ developers: "x" }) === null, "index: a missing or malformed file reads as nothing published");

// ---- 2. image sizes -------------------------------------------------------------------------------------------------------------
const pngBytes = (w, h) => { const b = new Uint8Array(33); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); const dv = new DataView(b.buffer); dv.setUint32(16, w); dv.setUint32(20, h); return b; };
const jpgBytes = (w, h) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);
const pi = imageInfo(pngBytes(1024, 1536)), ji = imageInfo(jpgBytes(1280, 1920));
ok(pi && pi.w === 1024 && pi.h === 1536 && pi.type === "image/png", "imageInfo: a PNG", pi);
ok(ji && ji.w === 1280 && ji.h === 1920 && ji.type === "image/jpeg", "imageInfo: a JPEG (size read past the APP0 segment)", ji);
ok(imageInfo(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])) === null, "imageInfo: anything else is null");

// ---- 3. through the worker ------------------------------------------------------------------------------------------------------
const READ = "owner_read_key_abcdefghijklmnop", CLIENT = "client_key_current_abcdefghij";
const store = new Map();
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); const ty = typeof t === "string" ? t : t && t.type;
    if (ty === "arrayBuffer") return typeof v === "string" ? new TextEncoder().encode(v).buffer : v.buffer ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : v;
    if (ty === "json") return JSON.parse(typeof v === "string" ? v : new TextDecoder().decode(v));
    return typeof v === "string" ? v : new TextDecoder().decode(v); },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })) }; },
};
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const call = (p, init, e) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p, init), e || env, { waitUntil() {} });

let r = await call("/developer_profile");
ok(r.status === 401, "/developer_profile with no key: 401");
r = await call("/developer_profile?key=not_a_key_at_all_xx");
ok(r.status === 401, "a wrong key: 401");
r = await call("/developer_profile?key=" + CLIENT, { method: "POST", body: "{}" });
ok(r.status === 405, "a POST: 405");
r = await call("/developer_profile_pdf?id=emaar");
ok(r.status === 401, "/developer_profile_pdf with no key: 401");

r = await call("/developer_profile?key=" + CLIENT);
let html = await r.text();
ok(r.status === 200 && /text\/html/.test(r.headers.get("Content-Type") || "") && /No developer profiles are published yet/.test(html), "no index yet: the page opens and says so, plainly");

// publish: emaar (3 pictures + a stray fourth), sobha (2), damac (none yet)
const EM = jpgBytes(1024, 1536);
store.set("img_devprofile_index", JSON.stringify({ as_of: "2026-10-20", developers: [
  { id: "emaar", name: "Emaar", pages: 3, updated: "2026-10-20", as_of: "2026-06-15" },
  { id: "sobha", name: "Sobha", pages: 2, updated: "2026-10-20" },
  { id: "damac", name: "DAMAC", pages: 0 },
  { id: "azizi", name: "Azizi", pages: 1, updated: "2026-10-20" },
] }));
store.set("img_devprofile_azizi_1", jpgBytes(1024, 1536));
for (let n = 1; n <= 4; n++) store.set("img_devprofile_emaar_" + n, EM);
for (let n = 1; n <= 2; n++) store.set("img_devprofile_sobha_" + n, pngBytes(1000, 1500));

r = await call("/developer_profile?key=" + CLIENT);
html = await r.text();
ok(r.status === 200 && html.includes("Emaar") && html.includes("Sobha") && html.includes("DAMAC"), "the roster lists every developer");
ok(html.indexOf("Emaar") < html.indexOf("DAMAC") && html.indexOf("Sobha") < html.indexOf("DAMAC"), "ready profiles come before the ones in preparation");
ok(/3 pages/.test(html) && /2 pages/.test(html) && /In preparation/.test(html), "each card says its page count, or In preparation");
ok(html.includes("/developer_profile?id=emaar&amp;key=" + CLIENT), "a card links to the developer page with the same key");
ok(!/\b(claude|chatgpt|gpt-?\d|openai|gemini|anthropic)\b/i.test(html) && !/bayut|propertyfinder|property finder|dubizzle/i.test(html), "no LLM and no listing portal is named on the page");

r = await call("/developer_profile?id=emaar&key=" + CLIENT);
html = await r.text();
ok(r.status === 200 && /1 OF 3/.test(html) && /2 OF 3/.test(html) && /3 OF 3/.test(html) && !/4 OF/.test(html), "the developer page shows the pages as 1 OF 3, 2 OF 3, 3 OF 3, and no fourth");
ok((html.match(/<img /g) || []).length === 3 && html.includes('src="/img/devprofile_emaar_1?key=' + CLIENT + '"'), "three pictures, each through the keyed /img/ route");
ok(html.includes("/developer_profile_pdf?id=emaar&amp;key=" + CLIENT) && /Download PDF/.test(html), "a Download PDF button");
ok(/as of 15 June 2026/.test(html) && /never a balance/.test(html), "the source line carries the register date and the escrow rule");
r = await call("/developer_profile?id=sobha&key=" + CLIENT);
html = await r.text();
ok(/1 OF 2/.test(html) && /2 OF 2/.test(html) && /2 pages/.test(html), "a two-page profile says 1 OF 2 and 2 OF 2");
r = await call("/developer_profile?id=azizi&key=" + CLIENT);
html = await r.text();
ok(r.status === 200 && (html.match(/<img /g) || []).length === 1 && !/ OF \d/.test(html) && /Download PDF · 1 page</.test(html), "a one-picture profile: one picture, no '1 OF 1' label, 'Download PDF · 1 page'");
r = await call("/developer_profile?id=damac&key=" + CLIENT);
html = await r.text();
ok(r.status === 200 && /being prepared/.test(html) && !/Download PDF/.test(html) && !/<img /.test(html), "a developer with no pictures: 'being prepared', no PDF button");
r = await call("/developer_profile?id=nobody&key=" + CLIENT);
ok(r.status === 404, "an id that is not in the roster: 404");
store.set("img_devprofile_secret_1", EM);
r = await call("/developer_profile_pdf?id=secret&key=" + CLIENT + "&format=html");
ok(r.status === 404, "pictures in KV under an id the roster does not list are never read");
r = await call("/developer_profile?id=emaar&key=" + READ);
ok(r.status === 200, "and the owner key opens it too");

// ---- 4. the pictures are keyed --------------------------------------------------------------------------------------------------
store.set("img_ct_devprofile_emaar_1", "image/jpeg");
r = await call("/img/devprofile_emaar_1");
ok(r.status === 401, "/img/devprofile_emaar_1 with no key: 401 (the other /img/ pictures stay keyless, these do not)");
r = await call("/img/devprofile_emaar_1?key=" + CLIENT);
ok(r.status === 200 && /private|no-store/.test(r.headers.get("Cache-Control") || ""), "with a client key it is served, and never cached by a shared cache");

// ---- 5. the PDF -----------------------------------------------------------------------------------------------------------------
let sent = null, launches = 0;
__setLauncher(async () => { launches++; return { newPage: async () => ({ setViewport: async () => {}, setContent: async (h) => { sent = h; }, evaluate: async () => true, pdf: async () => new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]) }), close: async () => {} }; });
const envB = Object.assign({}, env, { BROWSER: {} });
r = await call("/developer_profile_pdf?id=emaar&key=" + CLIENT, undefined, envB);
const pdf = new Uint8Array(await r.arrayBuffer());
ok(r.status === 200 && r.headers.get("Content-Type") === "application/pdf" && pdf[0] === 0x25 && pdf[1] === 0x50, "the PDF route returns a PDF");
ok(r.headers.get("X-Brief-Pages") === "3", "three pages: the stray fourth picture in KV is never read", r.headers.get("X-Brief-Pages"));
ok((sent.match(/class=pg>/g) || []).length === 3 && (sent.match(/data:image\/jpeg;base64,/g) || []).length === 3, "one picture per page, three pages", (sent.match(/class=pg>/g) || []).length);
ok(/@page\{size:210mm 315\.00mm;margin:0\}/.test(sent), "the page is shaped like the picture (2:3 -> 210 x 315 mm)", (/@page\{[^}]*\}/.exec(sent) || [])[0]);
ok(/filename="Emaar_Developer_Profile_20OCT2026\.pdf"/.test(r.headers.get("Content-Disposition") || ""), "the file is named for the developer and the date", r.headers.get("Content-Disposition"));
r = await call("/developer_profile_pdf?id=sobha&key=" + CLIENT, undefined, envB);
ok(r.status === 200 && r.headers.get("X-Brief-Pages") === "2" && /data:image\/png;base64,/.test(sent), "a two-picture PNG profile makes a two-page PDF");
r = await call("/developer_profile_pdf?id=azizi&key=" + CLIENT, undefined, envB);
ok(r.status === 200 && r.headers.get("X-Brief-Pages") === "1" && (sent.match(/class=pg>/g) || []).length === 1, "a one-picture profile makes a one-page PDF");
r = await call("/developer_profile_pdf?id=damac&key=" + CLIENT, undefined, envB);
ok(r.status === 404 && (await r.json()).ok === false, "no pictures published: 404, never an empty PDF");
r = await call("/developer_profile_pdf?key=" + CLIENT, undefined, envB);
ok(r.status === 400, "no id: 400");
r = await call("/developer_profile_pdf?id=emaar&key=" + CLIENT);
ok(r.status === 503, "without Browser Rendering: 503 (format=html still works)");
r = await call("/developer_profile_pdf?id=emaar&format=html&key=" + CLIENT);
ok(r.status === 200 && /text\/html/.test(r.headers.get("Content-Type")) && (await r.text()).includes("@page"), "format=html shows the document that would be rendered");
__setLauncher(async () => { throw new Error("429 Too Many Requests"); });
r = await call("/developer_profile_pdf?id=emaar&key=" + CLIENT, undefined, envB);
ok(r.status === 429 && /busy/.test((await r.json()).reason), "Browser Rendering rate limit: 429, said as busy");
__setLauncher(async () => { throw new Error("boom"); });
r = await call("/developer_profile_pdf?id=emaar&key=" + CLIENT, undefined, envB);
ok(r.status === 502, "any other render failure: 502");
__setLauncher(null);

// ---- 6. the START card ----------------------------------------------------------------------------------------------------------
r = await call("/start?key=" + CLIENT);
const sh = await r.text();
ok(r.status === 200 && /class="ejc suc dvsplit"/.test(sh), "/start: the DEVELOPERS box is one card");
const iTop = sh.indexOf("/developers_map?key="), iBot = sh.indexOf("/developer_profile?key=");
ok(iTop > 0 && iBot > iTop, "top half: Developers by area (still /developers_map); bottom half: Developer profile (/developer_profile)");
ok(/<b>Developers by area<\/b>/.test(sh) && /<b>Developer profile<\/b>/.test(sh) && /DEVELOPERS</.test(sh) && !/DEVELOPERS BY AREA</.test(sh), "the two titles are on the card and the box label is DEVELOPERS");
ok(/\.dvsplit\{/.test(sh) && /\.dvsplit \.dvp\{border-top/.test(sh), "the split card's rules are in the START stylesheet");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
