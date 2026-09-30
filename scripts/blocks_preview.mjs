// BLOCKS - a standalone preview of /blocks: the SAME page code (src/blocks_page.js) with a district's blocks GeoJSON inlined, so
// it opens by double-click with no server. Links to building pages are shown but inert (they need the app and a key).
//
//   node scripts/blocks_preview.mjs [--data <blocks.json>] [--out <file.html>] [--district <slug>] [--gold <list>]
//
// The data file is what naj-market-pulse scripts/build_blocks.py writes (data/ce/<slug>/blocks.json).
import fs from "node:fs";
import { blocksPageHtml, parseGold, BLOCKS_DEFAULT_GOLD, BLOCKS_DEFAULT_DISTRICT } from "../src/blocks_page.js";

const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : d; };
const slug = arg("district", BLOCKS_DEFAULT_DISTRICT);
const data = JSON.parse(fs.readFileSync(arg("data", "C:/Dev/naj-market-pulse/data/ce/" + slug + "/blocks.json"), "utf8"));
const out = arg("out", "C:/Users/kwils/Downloads/JVC_Blocks_preview.html");
const gold = parseGold(arg("gold", BLOCKS_DEFAULT_GOLD[slug] || ""));
// in the preview every gold building with a footprint shows the (inert) building-page button; the worker decides this per id
const pages = gold.filter((g) => g.i != null).map((g) => g.i);
fs.writeFileSync(out, blocksPageHtml({ slug, name: slug === "jumeirahvillagecircle" ? "Jumeirah Village Circle" : slug, short: slug === "jumeirahvillagecircle" ? "JVC" : slug, key: "", gold, pages, data, preview: true }));
console.log("wrote " + out + " (" + Math.round(fs.statSync(out).size / 1024) + " KB, " + gold.length + " gold)");
