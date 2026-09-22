// v233 - the scope label reaches the price block, which is the path the live route actually uses.
//
// v232 gated umxTable and left homeBlock unguarded. That mattered more than it sounds: the inflated
// figure reaches the panel through map_prices' own `u` field, which needs no id bind at all, so it is
// what the LIVE build shows. map_prices carries u=11,444 for both "Al Thamam 3" and "Al Thamam 28" in
// alhebiahfifth - a footprint the register binds at 92 units - and the facts line is the most
// prominent number on the panel, above the unit-mix table v232 was protecting.
//
// Also corrects an assumption in v232: the live plots blob ALREADY carries `units` on all 1,254
// features, so the building's registered count is available today and neither gate is inert on live.
//
//   node test/test_v233_scope_price_block.mjs
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

const srcHome = lift("homeBlock");
// v236 added a third parameter carrying the structural fact, so match the prefix rather than the
// full signature - an assertion pinned to the exact arity fails on a change that only adds to it.
ok(!!srcHome && /^function homeBlock\(it,bu[,)]/.test(srcHome), "homeBlock takes the building's registered count");
const atBU = CHROME.indexOf("var BU=(p.units!=null&&p.units>0)?p.units:null;");
const atUse = Math.max(CHROME.indexOf("homeBlock(hm,BU)"), CHROME.indexOf("homeBlock(hm,BU,WN)"));
ok(atBU >= 0, "openPanel computes the registered count once", `indexOf ${atBU}`);
ok(atUse >= 0 && atBU < atUse, "and hands it to the price block", `BU at ${atBU}, use at ${atUse}`);
ok(CHROME.indexOf("umxTable(ur,BU)") >= 0, "the unit-mix table is fed from the same value");
ok(CHROME.indexOf("umxTable(ur,(p.units") < 0, "the duplicated inline expression from v232 is gone");

const PRELUDE = `
  function esc(s){return String(s==null?"":s);}
  function fmtAed(a){return "AED "+a;}
  function bedsLabel(b){return String(b);}
  function devName(d){return String(d);}
  var KEY="";
`;
const homeBlock = new Function(PRELUDE + srcHome + "\nreturn homeBlock;")();

// The real shape: map_prices carries the PROJECT total in u.
const it = { n: "Al Thamam 3", d: "alhebiahfifth", i: 50, u: 11444, b: { 1: 621814 }, dev: null };

const flagged = homeBlock(it, 92);
ok(/11444 units across the project/.test(flagged), "an outsized price-block total is labelled", flagged.slice(0, 160));

const plain = homeBlock({ ...it, u: 772 }, 772);
ok(!/across the project/.test(plain), "a building-scoped total is not labelled");
ok(!/across the project/.test(homeBlock(it, null)), "with no registered count no claim is made");
ok(!/across the project/.test(homeBlock({ ...it, u: 100 }, 95)), "5% is rounding, not a change of scope");
ok(/across the project/.test(homeBlock({ ...it, u: 200 }, 100)), "2x is a change of scope");
ok(/AED 621814/.test(flagged), "the prices still render - only the unit total is qualified");

// ---- the live blob already carries what the gate needs ------------------------------------------------
const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(BOARD, f), "utf8")); } catch { return null; } };
const plots = rd("plots.json");
const PR = (rd("map_prices.json") || {}).items || [];
if (!plots || !PR.length) {
  console.log("  skip data checks - set NAJ_DATA to the naj-market-pulse data directory");
} else {
  const withUnits = plots.features.filter((f) => f.properties.units != null).length;
  ok(withUnits === plots.features.length,
     `every plot feature carries the registered count the gate needs (${withUnits}/${plots.features.length})`);

  // How many map_prices rows would be labelled, using each plot's own registered count.
  const bu = new Map();
  for (const f of plots.features) if (f.properties.units) bu.set(f.properties.district + "|" + f.properties.i, f.properties.units);
  let labelled = 0, seen = 0;
  for (const x of PR) {
    const k = x.d + "|" + x.i;
    if (!bu.has(k) || !x.u) continue;
    seen++;
    if (x.u > bu.get(k) * 1.15) labelled++;
  }
  console.log(`  ${seen} map_prices rows match a plot; ${labelled} would be labelled project-scoped`);
  ok(labelled > 0, `the price-block gate bites on real data (${labelled})`);
}

console.log(fails ? `\nv233: ${fails} failing` : "\nv233: all passing");
process.exit(fails ? 1 : 0);
