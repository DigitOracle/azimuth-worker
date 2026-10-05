// v343 (Kendall, 5 Oct 2026) - the small 3D model of buildings that was called "Blocks" is shown as the DIGITAL FOOTPRINT.
// Only the words people read changed; routes (/blocks, /brief_blocks), KV keys, CSS classes and JS names are untouched.
//
//   node test/test_v343_digital_footprint_wording.mjs
import fs from "node:fs";
import { BLOCKS_JS, blocksPageHtml } from "../src/blocks_page.js";
import { MAP_BLOCKS_JS, TWIN_BLOCKS_JS } from "../src/twin_blocks.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };

// the user-facing modules, comments removed (whole-line comments, block comments and trailing " // ..." comments)
const MODS = ["blocks_page", "twin_blocks", "brief_docs", "brief_page", "building_page", "checklist", "checklist_data", "tapcards",
  "ejari_page", "feed_ledger", "devmap_pdf", "devmap_investor", "devmap_page", "start_page", "wa_templates", "index"];
const strip = (s) => s.replace(/\r/g, "").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*\/\//.test(l)).map((l) => l.replace(/[ \t]\/\/ .*$/, "")).join("\n");
const SRC = Object.fromEntries(MODS.map((m) => [m, strip(fs.readFileSync(new URL("../src/" + m + ".js", import.meta.url), "utf8"))]));

const BAD = [/Blocks view/i, /\bin blocks\b/i, /\bmaquette\b/i, /See them in blocks/i, /⬚\s*BLOCKS/, /⬚\s*Blocks/, /3D blocks/i, /blocks for this district/i, /Grey blocks/];
for (const m of MODS) {
  const hits = BAD.filter((r) => r.test(SRC[m]));
  ok(hits.length === 0, "src/" + m + ".js: no visible template string says 'Blocks view', 'in blocks', 'BLOCKS' or 'maquette'", hits.join(" "));
}
ok(![BLOCKS_JS, MAP_BLOCKS_JS, TWIN_BLOCKS_JS].some((s) => BAD.some((r) => r.test(s.replace(/\/\*[\s\S]*?\*\//g, "")))), "the page scripts (BLOCKS_JS, MAP_BLOCKS_JS, TWIN_BLOCKS_JS) carry none of the old wording");

// the new wording is where it should be
ok(SRC.index.includes("⬚ DIGITAL FOOTPRINT</a>"), "the /map button reads DIGITAL FOOTPRINT");
ok(SRC.building_page.includes("⬚ Digital footprint — on its plot"), "the building page link reads 'Digital footprint - on its plot'");
ok(SRC.devmap_pdf.includes("The area&rsquo;s digital footprint"), "the area PDF heading reads 'The area's digital footprint'");
ok(SRC.brief_docs.includes("is a digital footprint of the buildings, not a photograph"), "the Brief says the picture is a digital footprint of the buildings, not a photograph");
const html = blocksPageHtml({ slug: "jumeirahvillagecircle", name: "Jumeirah Village Circle", short: "JVC", key: "k", gold: [], pages: {}, have: false });
ok(/<title>JVC digital footprint<\/title>/.test(html) || html.includes("JVC digital footprint"), "the /blocks page title is 'JVC digital footprint'");
// one meaning for the term: a building's ground outline is called a building outline in visible text
ok(!/Footprints and streets/.test(SRC.brief_docs + SRC.devmap_pdf + SRC.blocks_page), "attributions say 'Building outlines and streets', not 'Footprints and streets'");
// internal names and routes are unchanged
ok(SRC.index.includes('"/blocks"') && SRC.brief_docs.includes('"/brief_blocks"'), "the /blocks and /brief_blocks routes still exist");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
