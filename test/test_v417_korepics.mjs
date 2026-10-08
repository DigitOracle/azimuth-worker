// v417 - the developer's own pictures (KORE by Imtiaz: 2 renders of the building, a pool render, 7 brochure pages) on the Client sheet and on the investor report, with the permission on file.
// Offline: the documents are built through a stand-in KV. The old investor module (v415) is read from git to prove that a registered project's report is byte-identical.
//   node test/test_v417_korepics.mjs
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildDocument, parseQuery } from "../src/brief_docs.js";
import { buildInvestorTiersPdf } from "../src/investor_tiers_page.js";
import { DEV_CLAIMS } from "../src/dev_claims_data.js";
import { permissionOnFile, PICTURES_WITHHELD } from "../src/dev_claims.js";
import { NOT_PUBLISHED } from "../src/dev_pics.js";
import { EMOJI_RX, lintText } from "../src/investor_tiers.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const KORE = J("test/fixtures/v411_kore_facts.json"), REGS = J("test/fixtures/v411_registered_samples.json"), CLAIMS = J("data/developer_claims/kore_launch_brochure.json");
const text = (h) => h.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&ndash;/g, "-").replace(/&rsquo;/g, "'").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&middot;/g, ".").replace(/&#8226;/g, "-").replace(/\s+/g, " ").trim();
const FORBID_VENDOR = /openai|chatgpt|gemini|anthropic|claude|perplexity|deepseek|copilot|propertyfinder|property finder|bayut|dubizzle|satellite/i;
const FORBID_INTERNAL = /plot sale|mortgage|dewa|land sale|first-year|first year pricing|DLRC|1BR comparison|brand group/i;
const FORBID_INTERNAL_INV = /plot sale|dewa|land sale|first-year|first year pricing|DLRC|1BR comparison|brand group/i;   // the report's own fixed "cannot tell you" list names mortgage terms (v376), so mortgage is not checked here
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 3, 232, 6, 64, 3, 1, 34, 0, 2, 17, 1, 3, 17, 1, 0xff, 0xd9]);
const regRec = Object.values(REGS.records)[0];

const mkEnv = (published) => {
  const store = {
    investor_tiers_index: { projects: [{ id: "kore-by-imtiaz-offregister", name: "KORE by Imtiaz", district: "wadialsafa5", project_number: null }, { id: regRec.project.id, name: regRec.project.name, district: "regdist", project_number: regRec.project.project_number }] },
    investor_tiers_facts_wadialsafa5: { projects: { "kore-by-imtiaz-offregister": KORE } },
    investor_tiers_facts_regdist: { projects: { [regRec.project.id]: regRec } },
  };
  const extra = {};
  if (published) for (const r of CLAIMS.renders) { extra["img_" + r.kv] = jpg.buffer; extra["img_ct_" + r.kv] = "image/jpeg"; }
  // a picture of a registered project must never be drawn from these keys: publish a stand-in under the renders' own kv names only
  return { MEETINGS: { async get(k) { if (k.startsWith("img_") && store[k.slice(4)] !== undefined) return JSON.stringify(store[k.slice(4)]); if (extra[k] !== undefined) return extra[k]; return null; } } };
};
const sheetQ = (x) => parseQuery(new URL("https://x/brief_pdf?kind=dossier&keys=dev:kore&mode=buy&beds=all&format=html&client=Test" + (x || "")));
const inv = (id, tier) => ({ kind: "investor_tiers", key: "k", client: "Test", inv: { project: id, tier: tier || "standard", type: "prime", segs: ["market_history", "unit_mix_prices", "amenities"], flags: [], lang: "en" } });
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
const imgSrcs = (h) => [...h.matchAll(/<img [^>]*src="([^"]+)"/g)].map((m) => m[1]).filter((s) => /dev_render_/.test(s));
const withPending = async (fn) => { const c = DEV_CLAIMS.kore, was = c.render_permission.status; try { c.render_permission.status = "pending"; return await fn(); } finally { c.render_permission.status = was; } };

console.log("A - the record: ten pictures, captions, groups, keys");
ok(permissionOnFile(DEV_CLAIMS.kore) && CLAIMS.renders.length === 10, "permission on file and ten pictures are registered");
ok(CLAIMS.renders.every((r, i) => r.n === i + 1 && r.kv === "dev_render_kore_" + (i + 1) && /^kore\/page_\d\d_[a-z_]+\.jpg$/.test(r.file)), "each picture is page_NN_<name>.jpg with the key dev_render_kore_<n>");
ok(CLAIMS.renders.every((r) => r.caption === "Developer's render, KORE launch brochure received 6 October 2026" || r.caption === "Developer's brochure page, KORE launch brochure received 6 October 2026"), "every caption is the developer's render or the developer's brochure page, with the source and the received date");
ok(CLAIMS.renders.filter((r) => r.exterior).map((r) => r.what.split(",")[0]).join("|") === "building elevation|aerial view" && CLAIMS.renders.filter((r) => r.group === "hero").length === 2 && CLAIMS.renders.filter((r) => r.group === "strip").length === 4 && CLAIMS.renders.filter((r) => r.group === "ref").length === 4, "exterior flag on the elevation and the aerial; groups hero 2, strip 4, reference 4");
ok(CLAIMS.renders_not_stored.length === 0 && /lifted/.test(CLAIMS.renders_note) && /8 October 2026/.test(CLAIMS.renders_note) && !/are not used anywhere/.test(CLAIMS.not_used) && !/renders are not used/.test(CLAIMS.not_used), "renders_not_stored is cleared with a note, and 'not_used' no longer says the pictures are not used");
{
  const r = spawnSync("python", ["-c", "import sys,json; sys.path.insert(0,'scripts'); import publish_dev_renders as p; c=p.load_claims('kore'); p.check_permission(c); items=p.validate(c); print('KV='+json.dumps([n for n,_,_ in items]))"], { cwd: ROOT, encoding: "utf8" });
  const m = /KV=(\[.*\])/.exec(r.stdout || ""), keys = m ? JSON.parse(m[1]) : [];
  ok(r.status === 0 && keys.length === 10 && keys.join() === CLAIMS.renders.map((x) => x.kv).join(), "the publisher's list (validated offline) is exactly the ten keys the documents read", (r.stdout || "") + (r.stderr || ""));
}
const bytes = CLAIMS.renders.map((r) => fs.statSync(path.join(ROOT, "data/developer_claims", r.file)).size);
ok(Math.max(...bytes) < 450 * 1024 && bytes.reduce((a, b) => a + b, 0) < 2.6 * 1024 * 1024, "each picture is under 450 KB and all ten together about 2.4 MB (" + bytes.map((b) => Math.round(b / 1024)).join("/") + " KB)");

console.log("B - the Client sheet with the pictures published");
const sheet = await buildDocument(mkEnv(true), sheetQ(), { origin: "https://w.example" });
const SH = sheet.html || "", ST = text(SH);
ok(sheet.status === 200 && sheet.pages === 4, "four pages (facts and hero pictures; plans and amenities; the developer's pictures; the brochure pages)");
ok(imgSrcs(SH).length === 10 && new Set(imgSrcs(SH)).size === 10 && CLAIMS.renders.every((r) => imgSrcs(SH).includes("https://w.example/img/" + r.kv)), "all ten pictures are on the sheet, once each, read through /img/dev_render_kore_<n>");
ok(!ST.includes(PICTURES_WITHHELD) && !/withheld/i.test(ST) && !ST.includes(NOT_PUBLISHED), "no 'withheld' line and no 'not yet published' line");
ok((ST.match(/Developer's render, KORE launch brochure received 6 October 2026/g) || []).length === 3 && (ST.match(/Developer's brochure page, KORE launch brochure received 6 October 2026/g) || []).length === 3 && (ST.match(/Developer's brochure page: /g) || []).length === 4, "every picture carries its caption (3 renders, 3 strip pages, 4 reference thumbnails)");
ok(/The developer's pictures/.test(ST) && /The developer's brochure pages/.test(ST) && /developer says, not registered facts/.test(ST) && /Pictures: the developer's own renders and brochure pages, shown with the developer's permission/.test(ST), "page 3 and page 4 headings, the developer-says note on the brochure pages and the small-print picture line");
ok(/<div class="sheet page">/.test(SH) && (SH.match(/class="sheet page"/g) || []).length === 4, "four sheet pages in the markup");
ok(!EMOJI_RX.test(ST) && !FORBID_VENDOR.test(ST) && !FORBID_INTERNAL.test(ST), "no emoji, no vendor or portal name, no internal item", (ST.match(FORBID_VENDOR) || ST.match(FORBID_INTERNAL) || [""])[0]);
ok(/Curated by Najjuko . Dubai Decoded/.test(ST) && /\+971 56 548 4397/.test(ST), "legal footer and WhatsApp line kept");
{
  const hide = await buildDocument(mkEnv(true), sheetQ("&hide=photos"), { origin: "https://w.example" });
  ok(hide.pages === 2 && imgSrcs(hide.html).length === 0, "hide=photos leaves every picture out (two pages)");
  const inl = await buildDocument(mkEnv(true), sheetQ(), {});
  ok(imgSrcs(inl.html).length === 0 && (inl.html.match(/src="data:image\/jpeg;base64,/g) || []).length === 10, "with no origin the pictures are inlined (ten data URIs)");
}

console.log("C - a missing key falls back to the caption line, never a failed PDF");
{
  const none = await buildDocument(mkEnv(false), sheetQ(), { origin: "https://w.example" }), T0 = text(none.html);
  ok(none.status === 200 && none.pages === 4 && (T0.match(new RegExp(NOT_PUBLISHED, "g")) || []).length === 10 && imgSrcs(none.html).length === 0, "client sheet: nothing published: status 200, ten 'Picture not yet published' lines");
  ok((T0.match(/Developer's render, KORE launch brochure received 6 October 2026/g) || []).length === 3, "client sheet: the captions are still printed under the empty boxes");
  const env = mkEnv(true), get0 = env.MEETINGS.get; env.MEETINGS.get = async (k) => (k === "img_dev_render_kore_3" || k === "img_ct_dev_render_kore_3" ? null : get0(k));
  const one = await buildDocument(env, sheetQ(), { origin: "https://w.example" });
  ok(one.status === 200 && (text(one.html).match(new RegExp(NOT_PUBLISHED, "g")) || []).length === 1 && imgSrcs(one.html).length === 9, "client sheet: one key missing: that one box says 'Picture not yet published', the other nine are drawn");
  const ir = await buildInvestorTiersPdf(mkEnv(false), inv("kore-by-imtiaz-offregister"), { origin: "https://w.example" });
  ok(ir.status === 200 && (text(ir.html).match(new RegExp(NOT_PUBLISHED, "g")) || []).length === 10, "investor report: nothing published: status 200, ten fallback lines");
}

console.log("D - the investor report for KORE");
const kr = await buildInvestorTiersPdf(mkEnv(true), inv("kore-by-imtiaz-offregister"), { origin: "https://w.example" });
const KH = kr.html || "", KT = text(KH);
ok(kr.status === 200 && imgSrcs(KH).length === 10 && new Set(imgSrcs(KH)).size === 10, "the KORE report carries all ten pictures, once each");
ok(/Developer's pictures/.test(KT) && /Developer's pictures: the building and its amenities/.test(KT) && /Developer's brochure pages/.test(KT) && /Shown with the developer's permission/.test(KT) && /developer says, not registered facts/.test(KT), "the compact block, the strip and the reference pages, labelled developer says");
ok((KT.match(/Developer's render, KORE launch brochure received 6 October 2026/g) || []).length === 3 && (KT.match(/Developer's brochure page, KORE launch brochure received 6 October 2026/g) || []).length === 3 && (KT.match(/Developer's brochure page: /g) || []).length === 4, "every picture has its caption");
{
  const first = KH.indexOf("dev_render_kore_1"), core = KH.indexOf("Who is the registered developer");
  ok(first > 0 && core > first && KH.indexOf("dev_render_kore_2") < core, "the elevation and the aerial come first, before the locked core");
  ok(kr.pages >= 4 && kr.pages <= 8, "sane page count (" + kr.pages + ")");
}
ok(!EMOJI_RX.test(KT) && lintText(KT).length === 0 && !FORBID_VENDOR.test(KT) && !FORBID_INTERNAL_INV.test(KT), "no emoji, forecast wording, vendor or internal item", (KT.match(FORBID_VENDOR) || KT.match(FORBID_INTERNAL_INV) || [""])[0]);
ok(/Figures the developer states/.test(KT), "the developer-says last-page line is kept");

console.log("E - every other report is byte-identical to v415");
{
  const tmp = path.join(ROOT, "src", "_v417_old_inv.mjs");
  try {
    fs.writeFileSync(tmp, execFileSync("git", ["-C", ROOT, "show", "3217206:src/investor_tiers_page.js"], { maxBuffer: 1 << 26 }).toString("utf8"));
    const OLD = await import("../src/_v417_old_inv.mjs");
    for (const tier of ["summary", "standard", "full"]) {
      const a = await buildInvestorTiersPdf(mkEnv(true), inv(regRec.project.id, tier), {}), b = await OLD.buildInvestorTiersPdf(mkEnv(true), inv(regRec.project.id, tier), {});
      ok(a.status === 200 && a.html === b.html && sha(a.html) === sha(b.html), "registered sample, " + tier + ": the report is byte-identical to v415 even with the pictures published (" + sha(a.html) + ")");
    }
    const pa = await withPending(() => buildInvestorTiersPdf(mkEnv(true), inv("kore-by-imtiaz-offregister"), {})), pb = await OLD.buildInvestorTiersPdf(mkEnv(true), inv("kore-by-imtiaz-offregister"), {});
    ok(pa.html === pb.html && imgSrcs(pa.html).length === 0, "negative: with the permission flipped to pending the KORE report is byte-identical to v415 (no pictures)");
  } finally { try { fs.unlinkSync(tmp); } catch (e) {} }
}

console.log("F - negative: pending copy of the record");
{
  const r = await withPending(async () => ({ s: await buildDocument(mkEnv(true), sheetQ(), { origin: "https://w.example" }) }));
  ok(r.s.pages === 2 && imgSrcs(r.s.html).length === 0 && text(r.s.html).includes(PICTURES_WITHHELD), "client sheet: pending: two pages, no picture, 'Pictures withheld ...' line");
}

console.log("G - sizes (offline build, real file sizes)");
{
  const real = Object.assign({}, mkEnv(true));
  const store = new Map(CLAIMS.renders.map((r) => [r.kv, fs.readFileSync(path.join(ROOT, "data/developer_claims", r.file))]));
  const g0 = real.MEETINGS.get; real.MEETINGS.get = async (k, t) => { const n = k.replace(/^img_(ct_)?/, ""); if (store.has(n)) { if (/^img_ct_/.test(k)) return "image/jpeg"; const b = store.get(n); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } return g0(k, t); };
  const s = await buildDocument(real, sheetQ(), {}), i = await buildInvestorTiersPdf(real, inv("kore-by-imtiaz-offregister"), {});
  console.log("       client sheet HTML with every picture inlined: " + Math.round(s.html.length / 1024) + " KB; investor report: " + Math.round(i.html.length / 1024) + " KB; linked (origin) client sheet HTML: " + Math.round(SH.length / 1024) + " KB");
  ok(imgSrcs(s.html).length === 0 && s.html.length > 2.5e6 && s.html.length < 3.6e6, "inlined, the client sheet is the ten pictures (about 2.4 MB of bytes, base64 about 3.2 MB) plus text");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
