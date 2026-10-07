// v379 - offline: a SAMPLE of investor PDFs from a folder of shards (scripts/build_investor_facts.py). Same Chrome route as scripts/render_investor_samples.mjs: local Chrome or Edge, headless;
// nothing is deployed, fetched or written to KV.
//   node scripts/render_investor_facts_samples.mjs <shards folder> <outDir> [id:tier:type ...]
// With no list it renders the eight review samples (the ids below). type may be empty (id:full:).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { buildPlan } from "../src/investor_tiers.js";
import { buildTiersHtml } from "../src/investor_tiers_page.js";

const [folder, outDir, ...list] = process.argv.slice(2);
if (!folder || !outDir) { console.error("usage: node scripts/render_investor_facts_samples.mjs <shards folder> <outDir> [id:tier:type ...]"); process.exit(2); }
const SAMPLES = list.length ? list : [
  "chelsea-residences-2-by-damac-3743:standard:prime",       // the DAMAC brand against its registered company, a project with 869 sales that is not started
  "kore-by-imtiaz-offregister:standard:first_timer",         // off the project register: developer says, status unknown, zero sales, a developer plan
  "marina-pinnacle-817:full:",                               // delivered, many sales
  "marwa-homes-iii-2804:summary:",                           // thin: under construction, no registered sale
  "boulevard-point-1405:standard:yield",                     // Emaar
  "pearl-house-ii-by-imtiaz-2777:full:",                     // Imtiaz, with the developer's own payment plan
  "the-edge-2611:standard:prime",                            // Select Group
  "the-opus-by-omniyat-1177:standard:prime",                 // Omniyat
];
const facts = {};
for (const f of fs.readdirSync(folder)) if (/^investor_tiers_facts_.+\.json$/.test(f)) Object.assign(facts, JSON.parse(fs.readFileSync(path.join(folder, f), "utf8")).projects);
fs.mkdirSync(outDir, { recursive: true });
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
for (const s of SAMPLES) {
  const [id, tier, type] = s.split(":");
  const f = facts[id];
  if (!f) { console.log("NO SUCH ID", id); process.exitCode = 1; continue; }
  const plan = buildPlan({ facts: f, type: type || null, tier });
  const doc = buildTiersHtml(f, plan, { client: "" });
  const base = path.join(outDir, id.replace(/[^a-z0-9-]/g, "_") + "_" + tier + (type ? "_" + type : ""));
  fs.writeFileSync(base + ".html", doc.html);
  fs.writeFileSync(base + ".audit.json", JSON.stringify(plan.audit, null, 1));
  console.log(id, tier, type || "-", "pages", doc.pages, "lint", JSON.stringify(doc.lint));
  if (!CHROME) { console.log("no Chrome or Edge found: html only"); continue; }
  const r = spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=4000", "--print-to-pdf=" + base + ".pdf", pathToFileURL(base + ".html").href], { encoding: "utf8" });
  console.log("  pdf", fs.existsSync(base + ".pdf") ? fs.statSync(base + ".pdf").size + " bytes" : "FAILED " + (r.stderr || "").slice(0, 200));
}
