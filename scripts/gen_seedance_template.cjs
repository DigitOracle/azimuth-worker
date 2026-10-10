const fs = require("fs");
const tpl = fs.readFileSync(process.argv[2], "utf8");
const ex = fs.readFileSync(process.argv[3], "utf8");
const body = ex.slice(ex.indexOf("PROJECT:"), ex.indexOf("END OF PASTE BODY")).replace(/-{20,}\s*$/,"").trim();
const out = "// v476 - GENERATED from Kendall's HeyGen library (Visualization_Engine/00_reference/master_prompt_template.md and\n// 01_prompts/62b_still_water_v1_HEYGEN_PASTE.txt, the latest worked example). Regenerate when the library changes:\n// node scripts/gen_seedance_template.cjs <template.md> <example.txt>\nexport const SEEDANCE_TEMPLATE = " + JSON.stringify(tpl) + ";\nexport const SEEDANCE_EXAMPLE = " + JSON.stringify(body) + ";\n";
fs.writeFileSync("src/seedance_template.js", out);
console.log("template", tpl.length, "example body", body.length);