// v180 — THE EV CARD LEADS WITH BAYS, POWER, PLUG, OPERATOR AND DISTANCE (Kendall, 18 Sep 2026).
//
// The figures a driver asks for sat in a small grey line under the name. They are now tiles, read from the row's own x line
// ("Tesla · 8 bays · 250 kW · CCS"). Nothing is inferred: a figure the row does not carry gets no tile, and every number on
// the row reaches a tile. Checked against the real line shapes in the amenities data (DEWA register, OSM, OpenChargeMap).
import { readFileSync } from "fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };

const src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8").split(/\r?\n/);
const code = src.filter((l) => /'function ev(Parts|Tiles)\(/.test(l)).map((l) => (0, eval)(l.trim().replace(/^\+\s*/, "")));
ok(code.length === 2, "evParts and evTiles are in the map page");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const { evTiles } = new Function("esc", code.join("\n") + ";return {evTiles};")(esc);
const tiles = (x, d) => [...evTiles({ x }, d).matchAll(/<b>(.*?)<small>(.*?)<\/small><\/b>/g)].map((m) => m[1] + "|" + m[2]);

const t1 = tiles("Tesla · 8 bays · 250 kW · CCS", 1340);
ok(t1.join(",") === "8|bays,250 kW|max power,CCS|connector,Tesla|operator,1.3 km|away", "a supercharger row: " + t1.join(", "));
const t2 = tiles("DEWA · 3 bays · AC Type 2 · DC ChaDeMo/ComboCCS2", 620);
ok(t2.includes("AC + DC|Type 2 + CHAdeMO / CCS2"), "a DEWA row with both plugs shows BOTH, not only the last: " + t2.join(", "));
const t3 = tiles("DEWA · 16 bays · 250 kW · AC Type 2", null);
ok(t3.includes("250 kW|max power") && !t3.some((t) => /DC fast/.test(t)), "power is never labelled DC from its kW - this register row says 250 kW on AC Type 2");
ok(!t3.some((t) => /away/.test(t)), "no distance tile when no place is selected");
ok(tiles("DEWA · 2 bays · AC Type 2", 5).every((t) => !/kW|away/.test(t)), "no kW invented for a row that does not state one; no '0 m away' for the charger itself");
ok(tiles("1 bay · 5 kW · Unknown", null).join(",") === "1|bay,5 kW|max power", "'Unknown' plug is not shown and a bare count is not taken for the operator");
ok(evTiles({}, null) === "", "a charger with no details and no distance draws no tile row");

const rows = ["Tesla · 4 bays · 125 kW · NACS / Tesla Supercharger", "Tesla · 9 bays · 22 kW · Type 2", "DEWA · 1 bay · DC ChaDeMo/ComboCCS2", "VU · 5 bays", "2 bays · 90 kW · CCS"];
const lost = rows.flatMap((x) => (x.match(/\d+/g) || []).filter((n) => !evTiles({ x }, null).includes(n)).map((n) => n + " in " + x));
ok(!lost.length, "every number on the row reaches a tile" + (lost.length ? ": lost " + lost.join("; ") : ""));

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
