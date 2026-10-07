// v396 - a TOOL, not a test (run_all only runs test_*.mjs): the real local files through the real page code.
// Loads the Ejari files from naj-market-pulse/data/dld/ejari_daily and the sales files from data/sales_filed into a stub KV (read only),
// then answers the fixtures of the v396 brief with ejariAnswer + salesAnswer and renders the page through ejariRoutes.
//   node test/render_v396_fixtures.mjs [outdir]        prints the numbers; writes <outdir>/<name>.html when an outdir is given
import fs from "node:fs";
import path from "node:path";
import { ejariAnswer, ejariPageHtml, ejariQuery, ejariRoutes, ejariCacheReset } from "../src/ejari_page.js";
import { salesAnswer } from "../src/sales_view.js";

const EJ = process.env.EJARI_DIR || "C:/Dev/naj-market-pulse/data/dld/ejari_daily";
const SA = process.env.SALES_DIR || new URL("../data/sales_filed", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const store = new Map();
for (const f of fs.readdirSync(EJ)) {
  if (!/^ejari_.*\.json$/.test(f)) continue;
  const stem = f.slice(0, -5);
  if (/^ejari_daily_(?!dubai)/.test(stem)) continue;          // the 400-day start files are not read by the page's default path; recent_* and filed_* are
  store.set("img_" + stem, fs.readFileSync(path.join(EJ, f), "utf8"));
}
for (const f of fs.existsSync(SA) ? fs.readdirSync(SA) : []) if (/^sales_filed_.*\.json$/.test(f)) store.set("img_" + f.slice(0, -5), fs.readFileSync(path.join(SA, f), "utf8"));
const env = { MEETINGS: { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" ? new TextEncoder().encode(v).buffer : v; } } };
const H = { clientOk: () => true, clientResp: (e, u, html, init) => new Response(html, init), residentsKeyOf: () => "", najNav: () => "", NAJ_NAV_CSS: "", NAJ_FONTS: "" };
const outdir = process.argv[2] || "";
if (outdir) fs.mkdirSync(outdir, { recursive: true });
const text = (h) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const hl = (h) => text((h.match(/<div class=hl id=ejhl>(.*?)<\/div>/) || [, ""])[1]);

async function page(name, qs) {
  ejariCacheReset();
  const r = await ejariRoutes(new Request("https://x/contracts?" + qs), env, new URL("https://x/contracts?" + qs), H);
  const html = await r.text();
  if (outdir) fs.writeFileSync(path.join(outdir, name + ".html"), html);
  return html;
}
async function numbers(label, qs) {
  const st = ejariQuery(new URLSearchParams(qs));
  const A = await ejariAnswer(env, st);
  if (!A || A.notFound) { console.log(label.padEnd(44), "rentals: notFound -", A && A.why); return null; }
  const raw = (k) => { if (!store.has(k)) return Promise.resolve(null); return Promise.resolve(JSON.parse(store.get(k))); };
  const S = await salesAnswer(raw, st, A, {});
  console.log(label.padEnd(44), "rentals", A.count.n, "(new", A.count.nw + ", renewed", A.count.rn + ") filed to", A.asOf, "| sales", S ? (S.missing ? "missing: " + S.missing : S.n + " (off-plan " + S.count.off + ", ready " + S.count.rdy + ", mortgages " + S.count.mort + ", plot sales " + S.count.land + ") window " + S.from + ".." + S.to + " sales to " + S.asOf) : "none");
  return { A, S };
}
const out = {};
console.log("== the fixtures (window as the rentals feed anchors it) ==");
// Imtiaz: nine registered companies carry the name; sum them
const imtiazIds = [["1129", "IMTIAZ REAL ESTATE INVESTMENT & DEVELOPMENT"], ["2275", "IMTIAZ COVE"], ["2259", "IMTIAZ LUXURY"], ["1641", "IMTIAZ GHD"], ["2323", "IMTIAZ GI"], ["2579", "IMTIAZ SOUTH"], ["2212", "IMTIAZ UG"], ["2157", "IMTIAZ SUNSET"], ["2067", "IMTIAZ BWG"]];
for (const [from, to, tag] of [["2026-09-29", "2026-10-05", "29 Sep to 5 Oct"], ["2026-10-01", "2026-10-07", "1 to 7 Oct"]]) {
  let r = 0, s = 0, off = 0, mort = 0, land = 0;
  for (const [id, nm] of imtiazIds) {
    const x = await numbers("Imtiaz " + id + " " + nm.slice(0, 20) + " " + tag, "kind=developer&id=" + id + "&range=custom&from=" + from + "&to=" + to);
    if (x) { r += x.A.count.n; if (x.S && !x.S.missing) { s += x.S.n; off += x.S.count.off; mort += x.S.count.mort; land += x.S.count.land; } }
  }
  console.log("  >> IMTIAZ (all nine registered companies) " + tag + ": rentals " + r + ", sales " + s + " (off-plan " + off + "), mortgages " + mort + ", plot sales " + land);
  out["imtiaz_" + from] = { r, s, off };
}
for (const [from, to, tag] of [["2026-09-29", "2026-10-05", "29 Sep to 5 Oct"], ["2026-10-01", "2026-10-07", "1 to 7 Oct"]]) {
  await numbers("Dubai Maritime City " + tag, "kind=district&id=dubaimaritimecity&range=custom&from=" + from + "&to=" + to);
  await numbers("Business Bay " + tag, "kind=district&id=businessbay&range=custom&from=" + from + "&to=" + to);
}
await numbers("Chelsea Residences by DAMAC (dld key)", "kind=building&id=dld:chelsearesidencesbydamac&d=dubaimaritimecity&range=month");
const kore = await numbers("KORE by Imtiaz, July 2026", "kind=building&id=dld:korebyimtiaz&d=wadialsafa5&range=custom&from=2026-07-01&to=2026-07-31");
await numbers("All of Dubai, last 7 days", "kind=dubai&id=dubai&range=week");
console.log("\n== the page, as a person sees it ==");
for (const [name, qs] of [
  ["imtiaz_both_week", "q=imtiaz&range=custom&from=2026-09-29&to=2026-10-05"],
  ["imtiaz_both_oct1", "q=imtiaz&range=custom&from=2026-10-01&to=2026-10-07"],
  ["imtiaz_one_company_1129", "kind=developer&id=1129&range=custom&from=2026-09-29&to=2026-10-05"],
  ["imtiaz_sales_only", "kind=developer&id=1129&range=week&view=sales"],
  ["maritime_both", "kind=district&id=dubaimaritimecity&range=week"],
  ["businessbay_both", "kind=district&id=businessbay&range=week"],
  ["businessbay_rentals", "kind=district&id=businessbay&range=week&view=rentals"],
  ["kore_both_july", "kind=building&id=dld:korebyimtiaz&d=wadialsafa5&range=custom&from=2026-07-01&to=2026-07-31"],
  ["chelsea_both", "kind=building&id=dld:chelsearesidencesbydamac&d=dubaimaritimecity&range=month"],
  ["dubai_both", "kind=dubai&id=dubai&range=week"],
  ["search_imtiaz", "q=imtiaz"]
]) {
  const h = await page(name, qs);
  console.log(name.padEnd(22), h.length + " bytes |", hl(h) || text((h.match(/<div class=(?:nt|hd)[^>]*>(.*?)<\/div>/) || [, "(no headline)"])[1]).slice(0, 200));
}
