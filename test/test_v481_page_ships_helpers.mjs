// v481.1 - the building page ships its view as SOURCE TEXT; every helper the view calls must be in the page too.
// Regression: v480 called dewaVisual() from the view, which existed only in the worker, so the About card threw in the browser.
import { buildingPageHtml } from "../src/building_page.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
let html = "";
try { html = buildingPageHtml({ slug: "jumeirahvillagecircle", id: "1490", name: "Binghatti Nova", district: "Jumeirah Village Circle", register: [], floors: [] }, "k", ""); } catch (e) { html = "THREW " + e.message; }
const script = (html.match(/<script type="module">([\s\S]*)<\/script>/) || [])[1] || "";
ok(script.length > 1000, "the page carries its module script", html.slice(0, 200));
ok(/function dewaVisual\(/.test(script) && /const DEWA_CSS=/.test(script), "dewaVisual and its CSS travel with the view");
// every bare call in the view to a name defined at module level must be shipped: check the known helpers
for (const fn of ["dewaVisual"]) ok(script.indexOf(fn + "(") > script.indexOf("function " + fn + "("), fn + " is defined before the view runs");
// the shipped helper must run in a browser-like scope with nothing from the module
const fnSrc = script.slice(script.indexOf("const DEWA_CSS="), script.indexOf(";(function") > 0 ? script.indexOf(";(function") : undefined);
let out = "";
try { out = new Function(fnSrc.replace(/;\s*\(\s*function[\s\S]*$/, "") + ";return dewaVisual({connections:483,first:'2014-09',y2024:81,y2025:137,residential:471,commercial:12},null);")(); } catch (e) { out = "THREW " + e.message; }
ok(/When it filled up/.test(out), "the shipped dewaVisual runs on its own", out.slice(0, 200));
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
