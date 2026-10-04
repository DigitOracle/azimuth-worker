// v319 (4 Oct 2026): the single-building dossier's page-1 picture now uses our own render before the Blocks view (it already did on compare/pack cards).
// Found when the 13 approved pilot renders were published and the dossiers still showed the Blocks view or nothing.
// Order on the hero: own photo, developer photo, aimed Street View, OUR RENDER, Blocks view. The Blocks thumbnail is not even built when a render exists.
// NEGATIVE CONTROL: against release-v317 the hero line has no renderPic branch and both checks fail.
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../src/brief_docs.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const heroLine = (src.split("\n").find((l) => l.includes("const hero = rec.ownPic")) || "");
ok(/rec\.svPic \? svFigure\([^)]*\) : rec\.renderPic \? renderFigure\(rec, 702, 300\) : bvHero/.test(heroLine), "hero order: Street View, then the render, then the Blocks view");
const bvLine = (src.split("\n").find((l) => l.includes("const bvHero")) || "");
ok(/rec\.heroPic \|\| rec\.renderPic\) \? null/.test(bvLine), "the Blocks thumbnail is skipped when a render exists");
ok(/Illustration/.test(src.slice(src.indexOf("const renderCaption"), src.indexOf("const renderCaption") + 700)), "the render carries its 'Illustration' label (renderCaption)");
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
