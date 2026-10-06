// v369 - KORE-map treatment on the Najma map + district twin: icon markers instead of dots, 1/3/5 km rings (+2/10 on the chip), caption, legend.
// NEGATIVE CONTROL: in src/index.js change the KORE branch's `type:"symbol",source:"amen"` back to `type:"circle"` - assertion 1 must fail.
import { readFileSync } from "node:fs";
const SRC = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ok = (c, w) => { if (c) { pass++; console.log("  ok - " + w); } else { fail++; console.log("  FAIL - " + w); } };

// the pure runtime helpers, executed for real
const m = SRC.match(/const KORE_JS = String\.raw`([\s\S]*?)\n`;/);
ok(!!m, "KORE_JS block is present");
const KJS = m ? m[1] : "";
const MI = JSON.parse(SRC.match(/const MAP_ICONS = (\{.*\});/)[1]);
const AMEN = { school: ["schools", "", "#8FC7B9"], hospital: ["hospitals", "", "#E08A8A"], clinic: ["clinics", "", "#E8B49A"], pharmacy: ["pharmacies", "", "#A8C4A2"], metro: ["metro", "", "#9FB8E8"], mall: ["malls", "", "#D98F5A"], supermarket: ["supermarkets", "", "#C9B37E"], park: ["parks", "", "#8FD3A0"], beach: ["beach", "", "#7FC7D9"], ev: ["EV charging", "", "#C9A0E8"] };
const mkEnv = (extra = {}) => {
  const win = {}; const doc = { documentElement: { classList: { add() {} } }, getElementById: () => null };
  const f = new Function("location", "localStorage", "window", "document", "ICON", "AMEN", "map", "AM", "ON", "MODE", "RKM", "refPoint", "within", KJS + "; return {KORE,koreRadii,koreRingOn,koreInRing,koreRing,koreRingsFC,koreBandIdx,koreImgId,koreBadge,koreRefresh,koreRings,koreLegend,koreNums,koreAddImages,KCAP,KCRED,KSCH};");
  const store = {};
  return f({ search: extra.search || "" }, { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }, win, doc, MI, AMEN, null, null, {}, "dist", 3, () => null, () => true);
};
const K = mkEnv({ search: "?key=x&kore=1" });
ok(K.KORE === true && mkEnv({ search: "?kore=0" }).KORE === false && mkEnv().KORE === false, "flag: ?kore=1 on, ?kore=0 and default off");

// 1. no dot/circle markers in the KORE amenity layer; the circle survives only in the legacy else-branch
const kb = SRC.indexOf('if(KORE){koreAddImages()');
const kEnd = SRC.indexOf("else map.addLayer({id:\"am-dot\",type:\"circle\"", kb);
const koreBranch = SRC.slice(kb, kEnd);
ok(kb > 0 && kEnd > kb, "am-dot has a KORE branch and a legacy else-branch");
ok(/id:"am-dot",type:"symbol",source:"amen"/.test(koreBranch) && !/type:"circle"/.test(koreBranch), "KORE am-dot is a symbol (icon) layer, no circle in the branch");
ok(/"icon-image":\["get","img"\]/.test(koreBranch), "marker icon comes from the per-feature img");
ok(/id:"am-num",type:"symbol"/.test(koreBranch) && !/text-font/.test(koreBranch), "numbers and ring labels are image layers (a glyph layer stalls the whole tile)");
ok(/_STYLE=\{"am-dot":"am"/.test(SRC) && /d\.className="tm am kore"/.test(SRC), "twin: am-dot DOM marker becomes a kore badge");
ok(/\.tm\.am\.kore\{width:44px;height:44px;border:0;border-radius:0;background:none!important\}/.test(SRC), "twin badge has no dot styling and a 44 px tap box");

// 2. an icon per class, from the project's own MAP_ICONS, no emoji
Object.keys(AMEN).forEach((k) => ok(typeof MI[k] === "string" && MI[k].startsWith("<svg"), "MAP_ICONS has an inline SVG for " + k));
Object.keys(AMEN).forEach((k) => { const b = K.koreBadge(k, AMEN[k][2], 0, -1); ok(/^<svg/.test(b) && b.indexOf(MI[k].replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")) > 0, "badge for " + k + " embeds that class's icon"); });
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;   // the (c) sign is not an emoji
ok(!EMOJI.test(KJS) && !EMOJI.test(SRC.match(/const KORE_CSS = '([^\n]*)';/)[1]), "no emoji characters in the KORE helpers or CSS");
ok(!EMOJI.test(Object.keys(AMEN).map((k) => K.koreBadge(k, "#fff", 0, 2)).join("")), "no emoji in any rendered badge");
const sb = K.koreBadge("school", "#8FC7B9", 0, 0);
ok(sb.indexOf("#2E9E6B") > 0 && K.koreBadge("school", "#8FC7B9", 0, -1).indexOf("#2E9E6B") < 0, "school badge carries the KHDA-band ring only when a band is known");
ok(K.koreBadge("park", "#8FD3A0", 1, -1).indexOf("stroke-dasharray") > 0, "approximate position draws a dashed badge");
ok(K.koreBandIdx({ k: "school", x: "Very good" }) === 1 && K.koreBandIdx({ k: "school", x: "Outstanding" }) === 0 && K.koreBandIdx({ k: "school", x: "Good" }) === 2 && K.koreBandIdx({ k: "mall", x: "good" }) === -1 && K.koreBandIdx({ k: "school" }) === -1, "KHDA band parse (very good is not good)");
ok(K.koreImgId({ k: "school", x: "Weak", ap: 1 }) === "amb-school-4-a" && K.koreImgId({ k: "mall" }) === "amb-mall", "image ids");

// 3. chip radius logic and ring radii
ok(JSON.stringify(K.koreRadii("dist", 3)) === "[1,3,5]" && JSON.stringify(K.koreRadii("dist", 1)) === "[1,3,5]" && JSON.stringify(K.koreRadii("dist", 5)) === "[1,3,5]", "rings are 1, 3, 5 km");
ok(JSON.stringify(K.koreRadii("dist", 2)) === "[1,2,3,5]" && JSON.stringify(K.koreRadii("dist", 10)) === "[1,3,5,10]", "2 and 10 km rings appear only when that chip is selected");
ok(JSON.stringify(K.koreRadii("area", 2)) === "[1,3,5]", "community chip adds no extra ring");
ok(K.koreRingOn("dist", 3, 3) && !K.koreRingOn("dist", 3, 5) && !K.koreRingOn("area", 3, 3), "the selected chip radius is the highlighted ring");
ok(K.koreInRing(2999, 3) && !K.koreInRing(3001, 3), "inside/outside the chip radius");
const C = [55.25, 25.05];
const R = K.koreRing(C, 3, 72);
const dm = (a, b) => { const t = Math.PI / 180, dx = (b[0] - a[0]) * t * Math.cos((a[1] + b[1]) * 0.5 * t), dy = (b[1] - a[1]) * t; return Math.sqrt(dx * dx + dy * dy) * 6371000; };
ok(R.length === 73 && R.every((p) => Math.abs(dm(C, p) - 3000) < 15), "ring points sit 3 km from the centre (+-15 m)");
const fc = K.koreRingsFC(C, "dist", 2);
const lines = fc.features.filter((f) => f.geometry.type === "LineString"), labs = fc.features.filter((f) => f.geometry.type === "Point");
ok(lines.length === 4 && labs.length === 4 && labs.map((f) => f.properties.lab).join() === "1 km,2 km,3 km,5 km", "ring lines + labels for 1,2,3,5");
ok(lines.filter((f) => f.properties.on === 1).length === 1 && lines.find((f) => f.properties.on === 1).properties.km === 2, "exactly one ring highlighted: the chip's");

// 4. caption + credits + legend honesty
ok(K.KCAP === "Straight-line distances, not drive times. Counts depend on each source's coverage.", "caption text exact");
ok(/OpenStreetMap contributors/.test(K.KCRED) && /KHDA/.test(K.KCRED) && /DHA/.test(K.KCRED) && /RTA/.test(K.KCRED), "source credits: OSM contributors, KHDA, DHA, RTA");
ok(/approximate: coordinates rounded to two decimals/.test(K.KSCH), "school position note");
ok(/ON\.school\?" "\+KSCH:""/.test(KJS), "school note is shown only when schools are on");
ok(/"not in our data"/.test(KJS), "a class with no coordinates is labelled 'not in our data', no markers invented");

// legend renders with real data and says not-in-our-data for an empty class
{
  const host = { innerHTML: "", querySelector: () => null };
  const doc = { documentElement: { classList: { add() {} } }, getElementById: (id) => (id === "kleg" ? host : null) };
  const f = new Function("location", "localStorage", "window", "document", "ICON", "AMEN", "map", "AM", "ON", "MODE", "RKM", "refPoint", "within", KJS + "; return koreLegend;");
  const leg = f({ search: "?kore=1" }, { getItem: () => null, setItem() {} }, {}, doc, MI, AMEN, null, { items: [{ k: "school", lon: 55.25, lat: 25.05, x: "Good" }, { k: "mall", lon: 55.26, lat: 25.05 }] }, { school: true }, "dist", 3, () => C, () => true);
  leg();
  ok(/Straight-line distances/.test(host.innerHTML) && /schools<small>1 within 3 km/.test(host.innerHTML) && /EV charging<small>not in our data/.test(host.innerHTML) && /KHDA band/.test(host.innerHTML), "legend: counts for present classes, 'not in our data' for absent ones, KHDA key when schools exist");
  ok(/class=kc kx>/.test(host.innerHTML.replace(/"/g, "")) || /kc kx/.test(host.innerHTML), "absent classes are dimmed");
}

// 5. absent data is a no-op, never a throw
{
  let threw = false;
  try { K.koreRefresh(); K.koreRings(); K.koreLegend(); K.koreNums([]); K.koreAddImages(); ok(JSON.stringify(K.koreRingsFC(null, "dist", 3).features) === "[]", "no centre -> no rings"); } catch (e) { threw = true; console.log(e); }
  ok(!threw, "helpers do nothing, quietly, with no map / no data");
}
ok(/if\(KORE\)\{koreRings\(\);koreLegend\(\)\}/.test(SRC), "drawAm only touches rings/legend under the flag");
ok(/try\{_drawKRings\(\)\}catch\(e\)\{\}/.test(SRC) && /if\(!window\.__KORE\)return;/.test(SRC), "twin ring overlay is guarded and flag-gated");

// 6. mobile first
ok(/\.kc\{[^}]*min-height:76px/.test(SRC) && /\.kgrid\{display:grid;grid-template-columns:repeat\(3,1fr\)/.test(SRC), "legend is a grid of cards, not a list");
ok(/\.kore \.scw button\{min-height:40px\}/.test(SRC), "chip tap height >= 40 px under the flag");
ok(/width='88' height='88'/.test(K.koreBadge("park", "#fff", 0, -1)) && /pixelRatio:2/.test(KJS), "marker image is a 44 px tap box (88 px at 2x)");
ok(/\(KORE\?\\'<b class=kn>\\'\+\(ix\+1\)/.test(SRC) && /koreNums\(rows\)/.test(SRC), "list cards are numbered and the markers take the same numbers");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
