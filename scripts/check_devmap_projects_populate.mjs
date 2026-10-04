// v326 - does every developer's project count on the picker line and the profile card match the projects the page actually lists?
//   node scripts/check_devmap_projects_populate.mjs <index file> [--min 5] [--ids a,b,c] [--page <page js file>]
// Runs the REAL page script (src/devmap_page.js) in a fake DOM for each developer, in both windows (all years, last 12 months):
//   shown  = the number on the picker line ("26 projects") and on the profile card (Scale)
//   listed = the projects the tap on a doughnut segment lists (drill-down, all four price bands added up)
// Exits 1 when any developer with at least --min projects shows a count that its drill-down does not list.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const file = args.find((a) => !a.startsWith("--") && fs.existsSync(a));
const min = Number(opt("--min", 5));
const ids = opt("--ids", "") ? opt("--ids", "").split(",") : null;
const pageFile = opt("--page", new URL("../src/devmap_page.js", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const quiet = args.includes("--quiet");
const { devmapHtml } = await import(pathToFileURL(pageFile).href);
const { DM } = await import(new URL("./build_devmap_index.mjs", import.meta.url).href);
const IDX = JSON.parse(fs.readFileSync(file, "utf8"));
const html = devmapHtml("k", { NAJ_NAV_CSS: "", NAJ_FONTS: "", najNav: () => "" });
const js = html.slice(html.indexOf("<script>", html.indexOf("maplibre-gl.js")) + 8, html.lastIndexOf("</script>"));
const cut = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
const s0 = cut("function esc(t)", "function api("), s1 = cut("function fmt(n)", "(function(){var b=new URLSearchParams(location.search).get(\"bounds\")");
const s4 = cut("var STATS={},IXC={};", "function features()") + cut("var MON=", "function barsSvg(");
const s3 = cut("var DRILLSET=null", "function devTier(k)");
const S = { prof: null, drill: null, sel: null, unit: "sqft", win: "all" };
const fn = new Function("DM", "IDX", "S", "TC", "DEFAULT_NAMES", "setSheet", "renderDetail", "refreshMap", s0 + s1 + s4 + cut("function bar(arr", "function devRow(") + s3 + "; return {ixOf:ixOf,profileHtml:profileHtml,drillHtml:drillHtml,setDrill:setDrill,prof:prof,pickNote:pickNote};");
const P = fn(DM, IDX, S, ["a", "b", "c", "d"], {}, () => {}, () => {}, () => {});
const text = (h) => h.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const TEN = ["omniyat", "nakheel", "meraas", "emaar", "imtiaz", "zaya", "ellington", "select-group", "damac"];
const rows = [];
for (const win of ["all", "l12"]) {
  S.win = win;
  const ix = P.ixOf(win);
  const list = ids || Object.keys(ix.devs);
  for (const k of list) {
    const dv = ix.devs[k]; if (!dv) { rows.push({ k, win, missing: true }); continue; }
    const row = { k, win, name: dv.name, profileProjects: dv.profile && dv.profile.projects, pick: "", card: null, listed: 0, err: null };
    try {
      row.pick = P.pickNote(k, IDX.devs[k] || dv);
      const m = /([0-9,]+) project/.exec(row.pick); row.pickN = m ? Number(m[1].replace(/,/g, "")) : null;
      const ph = text(P.profileHtml(k));
      const sc = /Scale ([0-9,]+) project/.exec(ph); row.card = sc ? Number(sc[1].replace(/,/g, "")) : null;
      for (let t = 0; t < 4; t++) DM.drillProjects(ix, k, t, null).forEach((g) => { row.listed += g.projects.length; });
      // the page's own drill-down text, band by band
      row.drillText = 0;
      for (let t = 0; t < 4; t++) { S.drill = { k, t, ar: null }; P.setDrill(S.drill); const m2 = /([0-9,]+) projects? in [0-9]+ place/.exec(text(P.drillHtml())); if (m2) row.drillText += Number(m2[1].replace(/,/g, "")); }
      S.drill = null;
      if (row.listed !== row.card) { row.why = []; for (const s of Object.keys(ix.areas)) { const d = ix.areas[s].devs[k]; if (!d || !d.b) continue; const n = (d.c || []).reduce((p, c) => p + c[0], 0); if (!n) row.why.push(s + " (" + d.b.length + " projects, no sales rows in this window)"); } }
    } catch (e) { row.err = String(e && e.message || e).slice(0, 120); }
    rows.push(row);
  }
}
const shownOf = (r) => r.pickN != null ? r.pickN : r.card;
const bad = rows.filter((r) => !r.missing && ((shownOf(r) || 0) >= min || (r.profileProjects || 0) >= min) && (r.err || r.listed !== r.pickN || r.listed !== r.card || r.drillText !== r.listed));
if (ids || !quiet) {
  console.log("developer | window | picker line | card | listed (data) | listed (page text) | error");
  for (const r of rows.filter((x) => ids ? true : false)) console.log([r.k, r.win, r.pickN, r.card, r.listed, r.drillText, r.err || ""].join(" | "));
}
console.log("developers checked per window: " + (ids ? ids.length : Object.keys(P.ixOf("all").devs).length) + "; with a mismatch (shown count not equal to listed, >= " + min + " projects): " + bad.length);
for (const r of bad.slice(0, 60)) console.log("  MISMATCH " + r.win + " " + r.k + " (" + r.name + "): picker " + r.pickN + ", card " + r.card + ", listed " + r.listed + ", page text " + r.drillText + (r.err ? ", ERROR " + r.err : "") + (r.why && r.why.length ? " | " + r.why.join("; ") : ""));
process.exit(bad.length ? 1 : 0);
