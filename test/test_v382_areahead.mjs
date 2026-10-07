// v382 - AREA HEADINGS use each project's OWN area, never a borrowed community (Kendall, 7 Oct 2026). Offline: stubs only.
//   A a district heading is the plain Land Department name (no ' / ' join of a borrowed community); B its quiet second line is built from the projects' own areas;
//   C both windows (all years and the last 12 months) carry the project's own area (a) and its source (as); D the page draws the second line and uses ev.a on cards;
//   E the quality gate: fixtures in BOTH windows, no ' / ' in a heading, with a negative control.
//   node test/test_v382_areahead.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildIndex } from "../scripts/build_devmap_index.mjs";
import { headingName, areaCommunities, projectAreaLabel, areaDisplay, DLD_HEADING } from "../src/community_labels.js";
import { runGate } from "../scripts/check_attribution_gate.mjs";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };

console.log("A - the heading is the plain Land Department name");
ok(headingName("bukadra", "Sobha Hartland II / Bukadra") === "Bukadra", "Bukadra, not 'Sobha Hartland II / Bukadra'");
ok(headingName("rasalkhor", "Sobha One / Ras Al Khor") === "Ras Al Khor Industrial First", "Ras Al Khor Industrial First, not 'Sobha One / Ras Al Khor'");
ok(headingName("althanyahfifth", "JLT / Al Thanyah 5") === "Al Thanyah Fifth", "Al Thanyah Fifth, not 'JLT / Al Thanyah 5'");
ok(headingName("jabalalifirst", "Jebel Ali") === "Jabal Ali First", "Jabal Ali First (the Land Department name), not the old 'Jebel Ali'");
ok(headingName("wadialsafa5", "Wadi Al Safa 5") === "Wadi Al Safa 5" && headingName("dubaimarina", "Dubai Marina") === "Dubai Marina", "a district that came with a plain name keeps it");
ok(headingName("x", "A / B") === "B" && !Object.values(DLD_HEADING).some((v) => v.includes(" / ")), "a join of two names is never a heading, whatever the slug");
ok(projectAreaLabel({ slug: "bukadra", districtName: "Bukadra", salesArea: "BUKADRA", masterCommunity: "", dldAreas: ["Bukadra"], aka: ["Sobha Hartland II / Bukadra"] }).label === "Bukadra", "a project with no community of its own shows the plain district name");
ok(projectAreaLabel({ slug: "bukadra", districtName: "Bukadra", salesArea: "HORIZON", dldAreas: ["Bukadra"] }).label === "Meydan Horizon", "a project's own sales area (HORIZON) is Meydan Horizon");
ok(areaDisplay("ARABIAN RANCHES 3") === "Arabian Ranches III" && areaDisplay("Arabian Ranches Iii") === "Arabian Ranches III", "one community spelled two ways is shown once");

console.log("B - the second line comes from the data");
const P = (a, as, n) => ({ a, as, n });
const cm = areaCommunities([P("Meydan Horizon", "sales_area", 900), P("Meydan Horizon", "register_master", 100), P("Bukadra", "district", 8000), P("Sobha Hartland II", "sales_area", 4000)], "Bukadra");
ok(JSON.stringify(cm) === JSON.stringify(["Sobha Hartland II", "Meydan Horizon"]), "communities by sales, the district fallback and the heading itself left out", JSON.stringify(cm));
ok(areaCommunities([P("Bukadra", "district", 5), P("Bukadra", "sales_area", 5)], "Bukadra").length === 0, "no community in the data: no second line");
ok(areaCommunities([P("Dubai Marina", "sales_area", 10), P("Business Bay", "sales_area", 5000), P("Business Bay", "sales_area", 5000)], "Palm Jumeirah").join() === "Business Bay", "one stray project (a name lookup that landed elsewhere) is not a community of the district");
ok(areaCommunities([P("Al Furjan", "sales_area", 100)], "Jabal Ali First")[0] === "Al Furjan", "Jabal Ali First lists Al Furjan only when its projects say so");

console.log("C - the builder carries the own area in both windows");
const card = (name, developer, n, salesName) => ({ name, developer, registered_homes: 100, dld_sales: { project: salesName || name, sold_by_type: { "1 bedroom": n } }, rows: [{ type: "1 bedroom", median_aed: 1500000, median_sqm: 75 }] });
const geo = { districts: [{ slug: "bukadra", name: "Sobha Hartland II / Bukadra", corridor: "x", bbox: [0, 0, 1, 1], centre: [0, 0] }, { slug: "jabalalifirst", name: "Jebel Ali", corridor: "x", bbox: [0, 0, 1, 1], centre: [0, 0] }] };
const regdev = { bukadra: { "@wynwood horizon by imtiaz": { ar: "HORIZON" }, "@imtiaz symphony tower": { ar: "HORIZON" }, "@skyscape": { ar: "BUKADRA" }, "@claydon house by ellington": { ar: "HORIZON" } }, jabalalifirst: { "@westwood by imtiaz": { ar: "AL FURJAN", ms: "Al Furjan" }, "@indigo chambers": { ar: "Jabal Ali First" } } };
const UM = { bukadra: { 1: card("Wynwood Horizon by Imtiaz", "Imtiaz", 135), 2: card("Imtiaz Symphony Tower", "Imtiaz", 90), 3: card("Skyscape", "Sobha", 300), 4: card("Claydon House by Ellington", "Ellington", 50) }, jabalalifirst: { 1: card("Westwood by Imtiaz", "Imtiaz", 182), 2: card("Indigo Chambers", "Azizi", 20) } };
const ev12 = (name, ar, ms) => ({ b12: [[5, 20000, name]], c12: [[5, 20000, 1500000, 1]], c12e: ["V"], b12x: [{ p: 1, di: 2, dn: "X", m: "project_id", e: "REGISTER_VERIFIED", ar, ms }] });
const evidence = { meta: {}, areas: {
  bukadra: { dld: ["Bukadra"], shared: false, ev: {}, devs: { imtiaz: ev12("Wynwood Horizon by Imtiaz", "HORIZON", ""), sobha: ev12("Skyscape", "Bukadra", "") } },
  jabalalifirst: { dld: ["Jabal Ali First"], shared: false, ev: {}, devs: { imtiaz: ev12("Westwood By Imtiaz", "AL FURJAN", "Al Furjan"), azizi: ev12("Indigo Chambers", "Jabal Ali First", "") } } } };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dm382_"));
for (const [s, u] of Object.entries(UM)) fs.writeFileSync(path.join(dir, "um_" + s + ".raw"), JSON.stringify({ buildings_by_id: u }));
const idx = buildIndex({ umDir: dir, prices: { items: [] }, rent: { items: [] }, geo, outAsOf: "2026-09-09", register: { bukadra: { areas: ["Bukadra"] }, jabalalifirst: { areas: ["Jabal Ali First"] } }, regdev, evidence });
fs.rmSync(dir, { recursive: true, force: true });
const get = (slug, dev) => idx.areas[slug].devs[dev];
ok(idx.areas.bukadra.name === "Bukadra" && idx.areas.jabalalifirst.name === "Jabal Ali First", "the area headings in the index are Bukadra and Jabal Ali First", idx.areas.bukadra.name + " / " + idx.areas.jabalalifirst.name);
let a = get("bukadra", "imtiaz");
ok(a.bx[0].a === "Meydan Horizon" && a.bx[0].as === "sales_area", "all years: Wynwood Horizon reads Meydan Horizon (sales_area)", JSON.stringify(a.bx[0]));
ok(a.b12x[0].a === "Meydan Horizon" && a.b12x[0].as === "sales_area", "12 months: Wynwood Horizon reads Meydan Horizon (sales_area), not the district", JSON.stringify(a.b12x[0]));
a = get("bukadra", "sobha");
ok(a.bx[0].a === "Bukadra" && a.bx[0].as === "district" && a.b12x[0].a === "Bukadra", "a project with no community of its own shows Bukadra in both windows, never a combined label", JSON.stringify([a.bx[0], a.b12x[0]]));
a = get("jabalalifirst", "imtiaz");
ok(a.bx[0].a === "Al Furjan" && a.b12x[0].a === "Al Furjan", "Westwood By Imtiaz reads Al Furjan in both windows");
ok(get("jabalalifirst", "azizi").b12x[0].a === "Jabal Ali First", "a project whose area is the land area shows the district's Land Department name");
ok(JSON.stringify(idx.areas.bukadra.comms) === JSON.stringify(["Meydan Horizon"]), "Bukadra's second line is Meydan Horizon (what its projects say; Sobha's own projects name none)", JSON.stringify(idx.areas.bukadra.comms));
ok(JSON.stringify(idx.areas.jabalalifirst.comms) === JSON.stringify(["Al Furjan"]), "Jabal Ali First's second line is Al Furjan", JSON.stringify(idx.areas.jabalalifirst.comms));
const everything = JSON.stringify(idx);
ok(!/ \/ /.test(everything.replace(/"layout":"[^"]*"|"rule":"[^"]*"|"source":"[^"]*"|"note":"[^"]*"/g, "")), "no ' / ' join anywhere in the index data");

console.log("D - the page uses it");
const page = fs.readFileSync(new URL("../src/devmap_page.js", import.meta.url), "utf8");
ok((page.match(/subLine\(/g) || []).length >= 4, "the page draws the second line on the area card, the list card and the area heading");
ok(/esc\(q\.ev&&q\.ev\.a\?q\.ev\.a:q\.area\)/.test(page) && /esc\(ev&&ev\.a\?ev\.a:q\.area\)/.test(page), "project cards (drill-down and the Not-confirmed group) show ev.a");
ok(/e\.bx=d\.b12!==undefined\?\(d\.b12x\|\|null\)/.test(page), "the 12-month window swaps in b12x with b12");

console.log("E - the quality gate");
const gateIdx = (name12, a12) => ({ devs: {}, areas: { bukadra: { name: "Bukadra", comms: ["Meydan Horizon"], devs: { imtiaz: { n: "Imtiaz",
  b: [[10, 1, "Wynwood Horizon by Imtiaz"], [10, 1, "Imtiaz Symphony Tower"]], bx: [{ e: "REGISTER_VERIFIED", a: "Meydan Horizon", as: "sales_area", p: 1 }, { e: "REGISTER_VERIFIED", a: "Meydan Horizon", as: "sales_area", p: 2 }],
  b12: [[5, 1, name12], [5, 1, "IMTIAZ SYMPHONY TOWER"]], b12x: [{ e: "REGISTER_VERIFIED", a: a12, as: "district", p: 1 }, { e: "REGISTER_VERIFIED", a: "Meydan Horizon", as: "sales_area", p: 2 }] } } } } });
const cfg = { max_not_verified_share: 0.5, require_fixtures: false };
ok(runGate(gateIdx("Wynwood Horizon by Imtiaz", "Meydan Horizon"), cfg).ok, "gate passes when both windows read Meydan Horizon");
const bad = runGate(gateIdx("Wynwood Horizon by Imtiaz", "Sobha Hartland II / Bukadra"), cfg);
ok(!bad.ok && bad.failures.some((f) => /12 months/.test(f)) && bad.failures.some((f) => /combined area/.test(f)), "NEGATIVE CONTROL: a 12-month area of 'Sobha Hartland II / Bukadra' fails the gate", bad.failures.join("; "));
const badHead = gateIdx("Wynwood Horizon by Imtiaz", "Meydan Horizon"); badHead.areas.bukadra.name = "Sobha Hartland II / Bukadra";
ok(!runGate(badHead, cfg).ok, "NEGATIVE CONTROL: a district heading with a ' / ' join fails the gate");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
