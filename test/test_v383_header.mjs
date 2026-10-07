// v383 - the developer profile header carries ONE Investor PDF button (the developer-level one), never a list of per-project buttons; those live on the project cards.   node test/test_v383_header.mjs
import { devmapHtml } from "../src/devmap_page.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
const m = html.match(/function pdfRowProf\([^)]*\)\{[^\n]*/);
ok(!!m, "pdfRowProf is in the page");
ok(m && !/invProjRow\(/.test(m[0]), "the profile header does not call the per-project button row", m && m[0].slice(0, 260));
ok(m && /pdfRow\(sl,\[k\],S\.screen===3,k\)/.test(m[0]), "the developer-level row (snapshot, detailed, Investor PDF) is still there");
ok(/function invCardLink\(/.test(html) && /pjw/.test(html), "project cards still carry their own Investor PDF link");
const pf = html.indexOf("function profileHtml(k)");
const body = html.slice(pf, html.indexOf("\nfunction ", pf + 30));
const iCards = body.indexOf("areaCardsHtml(p,k)"), iPdf = body.indexOf("pdfRowProf(k,p)", iCards), iPdfFirst = body.indexOf("pdfRowProf(k,p)");
ok(iCards > 0 && iPdf > iCards, "the areas and their projects come before the PDF buttons");
ok(iPdfFirst > iCards || body.slice(iPdfFirst - 120, iPdfFirst).includes("p.areas"), "the only PDF row before the cards is the no-areas fallback", body.slice(Math.max(0, iPdfFirst - 80), iPdfFirst + 20));
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
