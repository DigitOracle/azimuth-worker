// v376 - offline: facts JSON -> the three sample PDFs (+ html + audit sidecar). Uses a local Chrome/Edge in headless mode; nothing is deployed, fetched or written to KV.
//   node scripts/render_investor_samples.mjs <facts.json> <outDir> [--debug]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { buildPlan } from "../src/investor_tiers.js";
import { buildTiersHtml } from "../src/investor_tiers_page.js";

const [factsPath, outDir] = process.argv.slice(2);
const debug = process.argv.includes("--debug");
const facts = JSON.parse(fs.readFileSync(factsPath, "utf8"));
fs.mkdirSync(outDir, { recursive: true });
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const SAMPLES = [
  { file: "A_PRIME_wealthy_STANDARD", type: "prime", tier: "standard", client: "" },
  { file: "B_FAMILY_end_user_SUMMARY", type: "family", tier: "summary", client: "" },
  { file: "C_FULL_EVIDENCE", type: null, tier: "full", client: "" },
];
for (const s of SAMPLES) {
  const plan = buildPlan({ facts, type: s.type, tier: s.tier });
  const doc = buildTiersHtml(facts, plan, { client: s.client, debugOverflow: debug });
  const base = path.join(outDir, "Chelsea_" + s.file);
  fs.writeFileSync(base + ".html", doc.html);
  fs.writeFileSync(base + ".audit.json", JSON.stringify(plan.audit, null, 1));
  console.log(s.file, "pages", doc.pages, "lint", JSON.stringify(doc.lint), "covers:", plan.coverage.slice(0, 160));
  if (!CHROME) { console.log("no Chrome or Edge found: html only"); continue; }
  const url = pathToFileURL(base + ".html").href;
  if (debug) {
    const r = spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--virtual-time-budget=4000", "--dump-dom", url], { encoding: "utf8", maxBuffer: 64e6 });
    console.log("  ", (/data-overflow="([^"]*)"/.exec(r.stdout || "") || [])[1] || "no overflow report");
  } else {
    const r = spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=4000", "--print-to-pdf=" + base + ".pdf", url], { encoding: "utf8" });
    console.log("  pdf", fs.existsSync(base + ".pdf") ? fs.statSync(base + ".pdf").size + " bytes" : "FAILED " + (r.stderr || "").slice(0, 200));
  }
}
