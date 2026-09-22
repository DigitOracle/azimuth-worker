// v231 - an id bind is published only when the building's own name does not contradict the plot's.
//
// Why this exists. v228 resolved a tapped plot to its building by footprint index, which took name
// matching out of the lookup and resolution from 90.5% to 100%. It also inherited a disagreement one
// layer below: for some footprints, the binding that placed the plot label and the name on the
// unit-mix record refer to DIFFERENT buildings. Over the 1,267 plot features - 1,137 corroborate,
// 48 unnamed, 82 contradict.
//
// The case that forced this gate: dubaisportscity #6 is labelled "Binghatti Haven" by the register
// binding, and the record at that index is "The Community-Sports Arena" - status verified, four real
// unit rows, bldgs=1 so the multi-building caveat never fires. Ungated, the panel renders an arena's
// unit mix under a residential tower's plot with no hedge.
//
// So the name is not the weaker alternative to the id. It is the only INDEPENDENT check ON the id.
// Do not delete corrob() as redundant because "we bind by id now" - binding by id is why it is needed.
//
//   node test/test_v231_corroboration.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "..", "src", "index.js");
const BOARD = path.join(process.env.NAJ_DATA || "C:/Dev/naj-market-pulse/data", "board");

let fails = 0;
const ok = (c, name, detail) => {
  if (c) return console.log("  ok   " + name);
  fails++;
  console.log("  FAIL " + name + (detail ? "\n         " + detail : ""));
};

const lines = fs.readFileSync(SRC, "utf8").split("\n");
const start = lines.findIndex((l) => /^const MAP_CHROME_JS\s*=\s*''\s*$/.test(l));
const cont = (l) => /^\s*\+/.test(l) || /^\s*\/\//.test(l) || /^\s*$/.test(l);
let end = start + 1;
while (end < lines.length && cont(lines[end])) end++;
const scope = new Proxy({}, { has: () => true, get: (t, k) => (k in t ? t[k] : k in globalThis ? globalThis[k] : ""), set: (t, k, v) => ((t[k] = v), true) });
const CHROME = new Function("scope", "with(scope){" + lines.slice(start, end).join("\n").replace(/^const /, "var ") + ";\nreturn MAP_CHROME_JS;}")(scope);

function lift(name) {
  const at = CHROME.indexOf("function " + name + "(");
  if (at < 0) return null;
  let d = 0;
  for (let i = CHROME.indexOf("{", at); i < CHROME.length; i++) {
    if (CHROME[i] === "{") d++;
    else if (CHROME[i] === "}" && --d === 0) return CHROME.slice(at, i + 1);
  }
  return null;
}

// ---- the gate is wired, not merely present -------------------------------------------------------
ok(!!lift("corrob"), "corrob() is defined in the page");
ok(/if\(ur&&!corrob\(p\.name,ur\.name\)\)ur=null;/.test(CHROME), "openPanel refuses a contradicted record");
// Both positions must EXIST before comparing them: on an ungated build indexOf returns -1 for the
// gate and the comparison passes vacuously, which is a test that goes green on broken code.
const atGate = CHROME.indexOf("if(ur&&!corrob");
const atTwin = CHROME.indexOf("var twinI=");
ok(atGate >= 0 && atTwin >= 0 && atGate < atTwin, "the gate runs before the record is used",
   `gate at ${atGate}, twinI at ${atTwin}`);

const srcCorrob = lift("corrob");
const srcNtok = lift("ntok");
if (!srcCorrob || !srcNtok) {
  console.log("\nv231: " + (fails || 1) + " failing");
  process.exit(1);
}
const corrob = new Function(srcNtok + srcCorrob + "\nreturn corrob;")();

// ---- the behaviour ---------------------------------------------------------------------------------
ok(corrob("Grande", "Grande") === true, "identical names corroborate");
ok(corrob("Golf Grand", "Golf Grand Apartments") === true, "a longer register name still corroborates");
ok(corrob("Binghatti Haven", null) === true, "an unnamed record passes - nothing to check is not a contradiction");
ok(corrob("Binghatti Haven", "") === true, "an empty record name passes");
ok(corrob("", "The Community-Sports Arena") === true, "a placeless name cannot contradict, so it passes");

// The five that forced this. Each is a different building of a different kind, not a near miss.
const REAL = [
  ["Binghatti Haven", "The Community-Sports Arena"],
  ["Samana Barari Heights", "Al Rabia Tower"],
  ["Golf Grand", "Golfville Block A"],
  ["THE SERENE", "Al Waha 17"],
  ["REMRAAM", "Al Thamam 3"],
];
for (const [plot, rec] of REAL) ok(corrob(plot, rec) === false, `refuses "${plot}" -> "${rec}"`);

// ---- the honest cost -------------------------------------------------------------------------------
// ntok() strips "tower/towers/the/by/at/residences/dubai" and words of 2 letters or fewer, so a
// spelling difference across a word boundary reads as a contradiction. These are the SAME building and
// the gate refuses them. That is the price of the gate and it is paid deliberately: a refusal shows no
// building, which is recoverable, while a wrong bind shows another building's verified unit rows.
ok(corrob("LAKE SHORE TOWER", "Lakeshore Tower 1") === false, "known cost: a word-boundary spelling difference is refused");

// ---- against the real files --------------------------------------------------------------------------
const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(BOARD, f), "utf8")); } catch { return null; } };
const plots = rd("plots.json");
if (!plots) {
  console.log("  skip data checks - set NAJ_DATA to the naj-market-pulse data directory");
} else {
  const cache = {};
  const umx = (s) => (cache[s] ??= (rd("unitmix_" + s + ".json") || {}).buildings_by_id || {});
  let pub = 0, refused = 0, unnamed = 0;
  const examples = [];
  for (const f of plots.features) {
    const p = f.properties;
    const r = umx(p.district)[String(p.i)];
    if (!r) continue;
    if (!r.name) { unnamed++; pub++; continue; }
    if (corrob(p.name, r.name)) pub++;
    else { refused++; if (examples.length < 4) examples.push(`${p.name} -> ${r.name}`); }
  }
  const n = plots.features.length;
  console.log(`  ${n} plots: ${pub} published (${unnamed} of them unnamed, unchecked), ${refused} refused`);
  ok(pub + refused === n, "every plot is either published or refused, none silently dropped");
  ok(refused > 0, `the gate actually bites (${refused} refusals)`, examples.join("; "));
  ok(pub > 1147, `still ahead of the pre-v228 name-only baseline of 1,147 (${pub})`);
  // The arena must not be among the published, by name, in the real data.
  const arena = plots.features.find((f) => f.properties.district === "dubaisportscity" && f.properties.i === 6);
  if (arena) {
    const r = umx("dubaisportscity")["6"];
    ok(r && !corrob(arena.properties.name, r.name), "dubaisportscity #6 is refused against the live files", `${arena.properties.name} -> ${r && r.name}`);
  }
}

console.log(fails ? `\nv231: ${fails} failing` : "\nv231: all passing");
process.exit(fails ? 1 : 0);
