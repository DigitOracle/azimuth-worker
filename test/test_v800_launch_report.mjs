// v800: no faces (only our face-checked copies), the on-demand Najma Launch Report (cover + one page per launch, map with compass and
// distances, area today, "price as advertised" footer), Download PDF / Send on WhatsApp with a random-token public link, the card buttons
// and the "Make a report" panel (Kendall 7 Nov 2026).
import assert from "node:assert/strict";
import fs from "node:fs";
import { reportHtml, mapSvg, safePic, periodRange, pickRows, makeReportRoute, publicReportRoute, __setLrLauncher, launchPage } from "../src/launch_report.js";
import { launchesPage, launchCards } from "../src/launches_card.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const W = "https://azimuth-2.digitalchemy.workers.dev";
const today = "2026-11-07";
const row = (o) => Object.assign({ key: "ap_" + Math.random().toString(16).slice(2, 14).padEnd(12, "0"), project: "Ocean Crest", developer: "Samana", area: "Dubai Islands",
  from_aed: 2180000, units: "1BR, 2BR", sizes: "650-1,400 sq ft", plan: "40/60", handover: "Q4 2028", confidence: "medium", registered: false,
  first_seen: "2026-11-06", last_seen: "2026-11-07", kinds: ["youtube"], sources_n: 2, links: ["https://www.youtube.com/watch?v=AAAAAAAAAAA"],
  pic: W + "/img/lpic_AAAAAAAAAAA_0", pic_credit: "Some Channel", pic_link: "https://www.youtube.com/watch?v=AAAAAAAAAAA", zone: "Deira and Bur Dubai" }, o);
const entry = { pics: [{ url: W + "/img/lpic_AAAAAAAAAAA_0", credit: "Some Channel", kind: "frame" }, { url: W + "/img/lpic_AAAAAAAAAAA_1", credit: "Some Channel", kind: "frame" },
  { url: "https://i.ytimg.com/vi/AAAAAAAAAAA/hqdefault.jpg", credit: "x" }], credit: "Some Channel", source: "Video: Some Channel, YouTube", pin_basis: "district_centroid",
  near: [{ lab: "Metro", name: "Gold Souq", km: 1.2, dir: "south" }, { lab: "Mall", name: "Deira City Centre", km: 4.1, dir: "south-east" }],
  marks: [{ name: "Burj Khalifa", km: 14.2, dir: "south-west", deg: 220 }, { name: "Airport (DXB)", km: 9.8, dir: "south-east", deg: 140 }],
  pts: [["m", 0.5, -1.0], ["l", -1.2, 0.4], ["s", 0.3, 0.3], ["c", 2.0, 1.5]], area: { label: "Palm Deira", period: ["2025-10-16", "2026-10-15"], offplan: { psf: 1820, n: 640 }, ready: { psf: 1400, n: 8 } } };

// no faces: only our own copies
ok(safePic(W + "/img/lpic_AAAAAAAAAAA_0") && safePic(W + "/img/lthumb_Cx9_ab") && !safePic("https://i.ytimg.com/vi/AAAAAAAAAAA/hqdefault.jpg") && !safePic(""), "safePic: KV copies only");
const r1 = row({ key: "ap_aaaaaaaaaaaa" }), r2 = row({ key: "ap_bbbbbbbbbbbb", project: "Greenz", developer: "Danube", registered: true, from_aed: null, pic: "https://i.ytimg.com/vi/B/hqdefault.jpg" });
const html = reportHtml([r1, r2], { [r1.key]: entry, [r2.key]: { pics: [] } }, { title: "Najma Launch Report", sub: "This week · 7 Nov 2026", by: "kendall" });
ok((html.match(/<section class="?pg/g) || []).length === 3, "cover + one page per launch");
ok(!/i\.ytimg\.com/.test(html), "a raw YouTube thumbnail is never in the report");
ok(/Frame from the video/.test(html) && /Image: Some Channel/.test(html), "frames with credits");
ok(/<svg viewBox="0 0 500 290"/.test(html) && />N<\/text>/.test(html) && /1 km/.test(html) && /Burj Khalifa/.test(html), "map with rings, compass and landmarks");
ok(/Gold Souq/.test(html) && /1\.2 km S</.test(html) && /14\.2 km SW</.test(html), "distance list");
ok(/The area today/.test(html) && /AED 1,820 \/ sq ft/.test(html) && !/AED 1,400 \/ sq ft/.test(html), "area today: medians with 10+ sales only");
ok(/Prices as advertised in public videos and posts, not client prices/.test(html) && /as advertised/.test(html), "price-as-advertised footer");
ok(/On the Dubai Land Department register/.test(html) && /Launched, not yet on the Dubai Land Department register/.test(html) && !/\bDLD\b/.test(html), "status spelled out, no DLD");
ok(/najma_logo\.png/.test(html) && /DigitAlchemy® Tech Limited/.test(html), "Najma logo placeholder and Kendall's footer");
ok(/Curated by Najjuko · Dubai Decoded · WhatsApp \+971 56 548 4397/.test(reportHtml([r1], { [r1.key]: entry }, { by: "najjuko" })), "Najjuko's footer when she made it");
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html) && !/motherduck|claude|gpt|gemini/i.test(html), "no emojis, no vendor or model names");
ok(/No map point/.test(mapSvg(null)), "no pin: says so");
ok(/class="hero none"/.test(launchPage(r2, { pics: [] }, 2, 3, "", "")), "no clean picture: the initial tile");

// choosing
ok(periodRange("week", today)[0] === "2026-10-31" && periodRange("month", today)[0] === "2026-11-01" && periodRange("30", today)[0] === "2026-10-08", "periods");
ok(periodRange("custom", today, "2026-10-01", "2026-10-31")[2] === "1 Oct 2026 to 31 Oct 2026", "custom dates");
const many = Array.from({ length: 14 }, (_, i) => row({ key: "ap_" + String(i).padStart(12, "0") }));
ok(pickRows(many.concat([row({ key: "ap_bare00000000", area: "", from_aed: null })]), many.map((r) => r.key).concat(["ap_bare00000000"])).length === 10, "up to 10, bare cards never");

// routes with a fake KV
const store = new Map();
const env = { MEETINGS: { get: async (k, t) => (store.has(k) ? (t === "arrayBuffer" ? store.get(k) : store.get(k)) : null), put: async (k, v) => { store.set(k, v); } }, BROWSER: {} };
const kv = async (e, name) => (name === "launches" ? { rows: [r1, r2] } : { rows: { [r1.key]: entry } });
let res = await makeReportRoute(new Request(W + "/momo/work/launches/report?key=K&k=" + r1.key + "," + r2.key + "&period=month"), env, new URL(W + "/momo/work/launches/report?key=K&k=" + r1.key + "," + r2.key + "&period=month"), { kv, person: () => "najjuko" });
const loc = res.headers.get("Location"); const tok = (loc.match(/\/lr\/([a-f0-9]{32})$/) || [])[1];
ok(res.status === 302 && tok, "make a report: redirects to its own random link");
const rec = JSON.parse(store.get("lr_" + tok));
ok(rec.keys.length === 2 && rec.by === "najjuko" && /This month/.test(rec.sub), "the report record: launches, who, period");
res = await makeReportRoute(new Request(W + "/x"), env, new URL(W + "/momo/work/launches/report?key=K&k=" + r1.key + "&wa=1"), { kv, person: () => "kendall" });
ok(res.status === 302 && /^https:\/\/wa\.me\/\?text=/.test(res.headers.get("Location")) && /%2Flr%2F[a-f0-9]{32}/.test(res.headers.get("Location")), "Send on WhatsApp: wa.me with the report link");
ok((await makeReportRoute(new Request(W + "/x"), env, new URL(W + "/momo/work/launches/report?key=K&k=bad"), { kv })).status === 400, "no valid launch: 400");
res = await publicReportRoute(new Request(W + "/lr/" + tok), env, new URL(W + "/lr/" + tok), { kv });
const page = await res.text();
ok(res.status === 200 && /Download PDF/.test(page) && /Send on WhatsApp/.test(page) && /noindex/.test(res.headers.get("X-Robots-Tag")), "public page: buttons, noindex");
ok((await publicReportRoute(new Request(W + "/lr/" + "0".repeat(32)), env, new URL(W + "/lr/" + "0".repeat(32)), { kv })).status === 404, "unknown or expired token: 404");
ok((await publicReportRoute(new Request(W + "/lr/abc"), env, new URL(W + "/lr/abc"), { kv })) === null, "malformed token: not this route");
let rendered = 0;
__setLrLauncher(async () => ({ newPage: async () => ({ emulateMediaType: async () => {}, setContent: async () => {}, evaluate: async () => true, pdf: async () => { rendered++; return new Uint8Array([37, 80, 68, 70]); } }), close: async () => {} }));
res = await publicReportRoute(new Request(W + "/lr/" + tok + ".pdf"), env, new URL(W + "/lr/" + tok + ".pdf"), { kv });
ok(res.status === 200 && res.headers.get("Content-Type") === "application/pdf" && /attachment/.test(res.headers.get("Content-Disposition")) && rendered === 1, "PDF rendered and downloadable");
await publicReportRoute(new Request(W + "/lr/" + tok + ".pdf"), env, new URL(W + "/lr/" + tok + ".pdf"), { kv });
ok(rendered === 1, "second download comes from the stored PDF");

// the card
const card = launchCards([r1, row({ key: "ap_cccccccccccc", pic: "https://i.ytimg.com/vi/C/hqdefault.jpg" })], today, "?key=K");
ok(/lpic_AAAAAAAAAAA_0/.test(card) && !/i\.ytimg\.com\/vi\/C/.test(card) && (card.match(/class="pic none"/g) || []).length === 1, "card: our copy shown, a raw thumbnail never");
ok(/href="\/momo\/work\/launches\/report\?key=K&amp;k=ap_aaaaaaaaaaaa" aria-label="Report as PDF"/.test(card) && /k=ap_aaaaaaaaaaaa&amp;wa=1/.test(card), "card: PDF and WhatsApp buttons");
const pg = launchesPage("K", "", { generated: today, rows: [r1] }, today);
ok(/Make a report/.test(pg) && /data-p=month>This month/.test(pg) && /data-p=30>Last 30 days/.test(pg) && /data-p=custom>Custom/.test(pg) && /Tick up to 10/.test(pg) && /Send on WhatsApp/.test(pg), "the Make a report panel");
ok(/id=qs type=search/.test(pg) && /Search project, developer or area"/.test(pg) && /id=rs class=rs>Reset</.test(pg), "search box and Reset");
ok(/<input id=dv list=dvl/.test(pg) && /<datalist id=dvl><option value="Samana">/.test(pg) && !/<select id=dv/.test(pg), "developer filter is a searchable picker");
ok(/data-q="ocean crest samana dubai islands deira and bur dubai"/.test(pg), "each card carries its search words (project, developer, area, zone)");
ok(/Q\.oninput=function\(\)\{run\(\)\}/.test(pg) && /f="week"/.test(pg) && /Q\.value="";s\.value="";z\.value=""/.test(pg), "instant search; Reset clears everything back to This week");
const idx = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/\/momo\/work\/launches\/report" && \["najjuko", "kendall"\]/.test(idx) && /url\.pathname\.startsWith\("\/lr\/"\)\) \{ const _lp = await publicReportRoute/.test(idx), "routes wired: make (their keys), open (the link)");
console.log("v800 launch report:", n, "checks passed");
