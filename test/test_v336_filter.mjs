import { devmapHtml } from "../src/devmap_page.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
const js = html.split("<script>").pop().split("</script>")[0];
const f = path.join(os.tmpdir(), "v336_page.js"); fs.writeFileSync(f, js);
let parsed = true; try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); } catch (e) { parsed = false; }
ok(parsed, "the page script parses");
ok(/function dimOf\(s\)\{[^\n]*S\.prof\|\|S\.fdev/.test(js), "a profile dims the other areas");
ok(js.includes("data-b=") && js.includes("Show all price bands"), "price bands are toggles with a show-all state");
ok(js.includes("class=prow") && js.includes("select(r.getAttribute"), "profile rows select the area");
ok(js.includes("<details class=evd") && js.includes("caret-down"), "positioning evidence is collapsible with a chevron icon");
ok(js.includes("lg.id=\"maplg\"") && js.includes("function mapLegend"), "legend overlay on the map");
ok(js.includes("dlink evc peer"), "peers are cards that open the profile");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
