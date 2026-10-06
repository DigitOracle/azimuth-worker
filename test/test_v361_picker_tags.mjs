// v361 - the "Developers by area" picker finds the Lootah developer by its project names (Shamal ...), without merging other "Shamal" / "Lootah" developers.
//   node test/test_v361_picker_tags.mjs
// The page script's own tag map, matcher and result filter are lifted out of src/devmap_page.js and run on a hand-made index.
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { devmapHtml } from "../src/devmap_page.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const src = fs.readFileSync(new URL("../src/devmap_page.js", import.meta.url), "utf8");
const tagBlock = (src.match(/var DEV_TAGS=[\s\S]*?\n(?=function mineList)/) || [""])[0];
const resExpr = (src.match(/var tagHit=\{\},res=[^\n]*?:\[\];/) || [""])[0];
ok(tagBlock && resExpr, "tag map, matcher and result filter are in the page script");
const IDX = { devs: {
  nshama: { name: "Nshama", n: 900 },
  lootah: { name: "Lootah Real Estate Development", n: 40 },
  "shamal estates": { name: "Shamal Estates", n: 300 },
  "lootah investement": { name: "Lootah Real Estate Investement", n: 20 },
  emaar: { name: "Emaar Properties", n: 5000 } } };
function run(q, mine = {}) {
  const ctx = { IDX, S: { mine }, qq: q.toLowerCase().trim() };
  vm.createContext(ctx);
  vm.runInContext("var q=qq;" + tagBlock + ";" + resExpr + ";var out={res:res,tagHit:tagHit};", ctx);
  return ctx.out;
}
console.log("search");
ok(run("shama").res.join() === "nshama,shamal estates,lootah", "'shama': Nshama and Shamal Estates by name first (by size), Lootah after by project");
ok(run("shama").tagHit.lootah.join() === "Shamal", "'shama' shows the project line 'Shamal' on Lootah");
for (const w of ["shamal", "shamal waves", "shamal terraces", "shamal residences", "loci", "living garden", "lootah", "lootah real estate"]) ok(run(w).res.includes("lootah"), "'" + w + "' finds Lootah Real Estate Development");
ok(run("shamal").tagHit.lootah.join() === "Shamal" && run("shamal w").tagHit.lootah.join() === "Shamal Waves", "the project line names the project matched ('shamal w' gives Shamal Waves)");
ok(run("loci").tagHit.lootah.join() === "Loci" && run("living").tagHit.lootah.join() === "Living Garden", "Loci and Living Garden show their own names");
console.log("no merging");
ok(!run("shamal waves").res.includes("shamal estates") && !run("loci").res.includes("shamal estates"), "Shamal Estates (id 1273) does not appear for a Lootah project name");
ok(!run("loci").res.includes("lootah investement") && !run("shamal waves").res.includes("lootah investement"), "Lootah Real Estate Investement (id 876) does not get the Lootah project tags");
ok(!run("shamal estates").res.includes("lootah"), "'shamal estates' does not pull in Lootah");
ok(!run("shamal").tagHit["shamal estates"] && !run("shamal").tagHit["lootah investement"], "tags are attached to the Lootah key only");
ok(run("lootah").res.includes("lootah investement") && !run("lootah").tagHit.lootah, "'lootah' still lists both Lootah developers by name, with no project line for a name match");
ok(!run("sh").res.includes("lootah") && run("sha").res.includes("lootah"), "two letters do not trigger tags; three do");
ok(!run("shamal", { lootah: true }).res.includes("lootah"), "a developer already chosen is not offered again");
ok(!run("emaar").res.includes("lootah"), "an unrelated query is unaffected");
console.log("page");
const html = await devmapHtml("k", { clientOk: () => true, keyTier: () => "t", najNav: () => "", NAJ_NAV_CSS: "", NAJ_FONTS: "", clientResp: (h) => h });
const text = typeof html === "string" ? html : (html && html.body) || (html && typeof html.text === "function" ? await html.text() : "");
const code = (String(text).match(/<script>([\s\S]*?)<\/script>/g) || []).map((x) => x.replace(/<\/?script>/g, "")).join("\n");
ok(/DEV_TAGS/.test(code), "emitted page carries the tag map");
const f = path.join(os.tmpdir(), "v361_page.js"); fs.writeFileSync(f, code);
let syn = true; try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); } catch { syn = false; }
ok(syn, "emitted page script passes node --check");
ok(/class=note style="display:block;margin:0">project: '\+esc\(tagHit\[k\]/.test(src), "the row has a small 'project:' line in the same note style, stacked under the name");
ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(tagBlock), "no emoji in the new code");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
