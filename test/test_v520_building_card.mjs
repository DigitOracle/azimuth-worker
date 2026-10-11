// v520 - #3 the building card: tap a building in a chosen district (or pick one in search / the advertised list) and ONE clean pop-up
// opens: name, district and floors, the register's status (completed / under construction with % built and due date / not yet built),
// advertised to rent now by bedroom type, and buttons for the fact sheet (PDF) and the building page. Kendall 11 Oct 2026: "use the
// existing, and it should be a pop up so it is clean".
import fs from "node:fs";
import { stackFacts } from "../src/city_bldg.js";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };

// 1. the index carries the register's word per building
const items = [{ k: "businessbay:647", d: "businessbay" }, { k: "businessbay:9", d: "businessbay" }, { k: null, d: "businessbay" }];
stackFacts(items, { businessbay: { buildings_by_id: { "647": { project: { status: "active", pct: 77.48, end: "2026-02-01" }, floors: new Array(56).fill({}) } } } });
ok(items[0].s === "ACTIVE" && items[0].p === 77 && items[0].e === "2026-02" && items[0].fl === 56, "status, % built, due month and floors from the stack", items[0]);
ok(items[1].s === undefined && items[2].s === undefined, "no stack record (or no key): nothing invented");

// 2. the card in the twin
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const start = src.indexOf("// ===== v520 THE BUILDING CARD"), end = src.indexOf("// ===== v520 THE BUILDING CARD - end");
const card = src.slice(start, end);
ok(start > 0 && end > start, "the card block ships in the city module");
ok(!/\\"/.test(card), "no backslash-quote inside the template literal");
// run statusLine on its own
const sl = new Function(card.slice(card.indexOf("const MON="), card.indexOf("let INSTIT=")) + "; return statusLine;")();
ok(sl({ s: "FINISHED", e: "2019-06" }) === "Completed Jun 2019", "finished: Completed <month year>", sl({ s: "FINISHED", e: "2019-06" }));
ok(sl({ s: "ACTIVE", p: 77, e: "2026-02" }) === "Under construction · 77% built · was due Feb 2026", "active and overdue: says 'was due'", sl({ s: "ACTIVE", p: 77, e: "2026-02" }));
ok(sl({ s: "ACTIVE", p: 12, e: "2029-12" }) === "Under construction · 12% built · due Dec 2029", "active, future: 'due'");
ok(sl({ s: "NOT_STARTED", e: "2028-09" }) === "Not yet built · due Sep 2028" && sl({}) === "", "not started: 'Not yet built'; unknown: nothing");
ok(/<div class=bcbtn><a target=_blank rel=noopener href="\/brief_pdf\?kind=dossier&keys='\+encodeURIComponent\(it\.k\)/.test(card) && /'">The building \\u2192<\/a><\/div>'/.test(card), "buttons: the fact sheet PDF (the building's dossier) and the building page");
ok(/flat'\+\(it\.f===1\?'':'s'\)\+' advertised to rent now<\/span>/.test(card) && /No Property Finder adverts for this building today\./.test(card), "advertised to rent now, or says there are none");
ok(/No register record we hold names this building\./.test(card), "a building with no record gets an honest small card");
ok(/bTip=function\(it\)\{bCard\(it,it\.inst\)\};/.test(card) && /let bTip=function\(it\)\{/.test(src), "search picks and the advertised list open the same card");
ok(/canvas\.addEventListener\("pointerup",\(ev\)=>\{if\(AMDIST<0\|\|Date\.now\(\)-bDown>260\)return;const i=hitInst\(ev\);if\(i<0\|\|di\[i\]!==AMDIST\)return;ev\.stopImmediatePropagation\(\);/.test(card), "a tap opens the card only inside the chosen district (the first tap still picks the district) and wins over the district fly");
ok(/BC\.onclick=\(e\)=>\{if\(e\.target===BC\|\|e\.target\.classList\.contains\("bcx"\)\)BC\.classList\.remove\("on"\)\}/.test(card) && /if\(e\.key==="Escape"\)BC\.classList\.remove\("on"\)/.test(card), "closes with the cross, a tap outside, or Escape");
ok(/#bcard\{position:fixed;inset:0;z-index:60;/.test(src), "the pop-up sits over everything");

ok(!/\\'/.test(card), "no backslash-apostrophe inside the template literal either (it reached the browser as a bare quote and broke the page)");
// framing and ghosts (Kendall 11 Oct: Meydan One supermarkets out of view; "it shouldn't disappear ... forty or fifty percent transparent")
ok(/const GHOST=new THREE\.InstancedMesh\(mesh\.geometry,new THREE\.MeshStandardMaterial\(\{color:0xC9D4CD,transparent:true,opacity:\.5,depthWrite:false/.test(src), "a see-through copy holds the district's other buildings");
ok(/if\(AMDIST>=0&&\(ks\.length\|\|ADV\.on\)\)for\(const i of AMHID\)\{if\(di\[i\]!==AMDIST\)continue;/.test(src), "only the chosen district's buildings are ghosted; other districts stay gone");
ok(/function amFrame\(\)\{/.test(src) && /flyPoint\(\(x0\+x1\)\/2,\(z0\+z1\)\/2,Math\.max\(1400,ext\*0\.9\+500\)\)/.test(src), "what is chosen is framed, never inside the handover distance");
ok(/AMFRAME=!!AMON\[k\];amRecalc\(\)/.test(src) && /cbLoad\(\)\.then\(\(\)=>\{AMFRAME=true;amRecalc\(\)\}\)/.test(src) && /if\(AMFRAME\)\{AMFRAME=false;amFrame\(\)\}/.test(src), "turning on a kind or the advertised filter moves the view; other recomputes leave the camera alone");

console.log(`v520 building card: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
