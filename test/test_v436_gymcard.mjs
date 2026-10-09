// v436 - Momo gym session card + progress per machine: the page code run against a tiny fake DOM.   node test/test_v436_gymcard.mjs
import { FIT_JS } from "../src/fit_page.js";
import vm from "node:vm";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + d : "")); } };
const src = String(FIT_JS);
const pick = (name) => { const i = src.indexOf("function " + name + "("); let d = 0, k = src.indexOf("{", i); for (; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}" && !--d) break; } return src.slice(i, k + 1); };
const rx = src.match(/var LIFT_RX=[^;]+;/)[0];
class N { constructor(t, c, x) { this.tag = t; this.className = c || ""; this.kids = []; this.text = x || ""; this.attrs = {}; this.style = {}; } appendChild(n) { this.kids.push(n); return n; } setAttribute(k, v) { this.attrs[k] = v; } set textContent(v) { this.kids = []; this.text = v; } get textContent() { return this.text + this.kids.map((k) => k.textContent).join(" "); } }
const nodes = { gs: new N("div"), gp: new N("div") };
const ctx = { $: (id) => nodes[id], el: (t, c, x) => new N(t, c, x), fm: (m) => m + " min", dlab: (d) => d, document: { createElementNS: (ns, t) => new N(t) } };
vm.createContext(ctx);
vm.runInContext(rx + pick("spark") + pick("gymDraw"), ctx);
const j = { today: "2026-10-09", groups: ["legs", "back"], entries: [
  { k: "ex", x: "Leg Press 3×12 @ 60 kg", m: 9 }, { k: "ex", x: "Lat Pulldown 4×10 @ 45 kg", m: 12 }, { k: "ex", x: "Run - 20 min", m: 20 }, { k: "food", x: "Bottle of water" }],
  machines: [{ name: "Leg Press", best: 60, d: "2026-10-09", s: [["2026-10-01", 50, 36], ["2026-10-05", 55, 36], ["2026-10-09", 60, 36]] }, { name: "Seated Row", best: 40, d: "2026-10-02", s: [["2026-10-02", 40, 30]] }] };
ctx.gymDraw(j);
const card = nodes.gs.textContent, prog = nodes.gp.textContent;
ok(/GYM SESSION/.test(card) && /2 machines/.test(card), "the session card counts the two machines, not the run", card.slice(0, 200));
ok(/7 sets/.test(card.replace(/\s+/g, " ")) || (/\b7\b/.test(card) && /sets/.test(card)), "sets add up to 7");
ok(/3,960 kg/.test(card), "weight moved = 3x12x60 + 4x10x45 = 3,960 kg", card);
ok(/legs/.test(card) && /back/.test(card), "the body parts trained today are shown");
ok(/MY MACHINES/.test(prog) && /\+10 kg since 2026-10-01/.test(prog) && /first time: 40 kg/.test(prog), "progress shows the gain since the first time, and a first-timer", prog);
ok(nodes.gp.kids[0].kids.filter((k) => k.kids && k.kids.some((x) => x.tag === "svg")).length === 2, "each machine has its own chart");
nodes.gs.textContent = ""; ctx.gymDraw({ today: "2026-10-09", entries: [{ k: "ex", x: "Walk - 30 min", m: 30 }], machines: [] });
ok(nodes.gs.kids.length === 0 && nodes.gp.kids.length === 0, "no gym work and no machines: nothing is drawn");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
