// v325 - DEVELOPER ATTRIBUTION tests (4 Oct 2026). Kendall opened Town Square and saw Imtiaz with one project, "Symphony": the register says Nshama.
// Includes NEGATIVE CONTROLS: the old rule (trust the card's developer field first) is re-created here and must reproduce the Symphony error, so the assertions are known to bite.
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildArea } from "../scripts/build_devmap_index.mjs";
import { decide, isGenericName, brandInName, COMMON_WORDS, MASTER_LIKE } from "../src/devattr.js";
import { canonicalOf } from "../src/devcross.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.equal(a, b, m + " -> got " + JSON.stringify(a)); n++; };

const card = (name, extra = {}) => ({ name, rows: [{ type: "1 bedroom", median_aed: 1000000, median_sqm: 70 }], dld_sales: { sold_by_type: { "1 bedroom": 40 }, project: name }, ...extra });
const build = (cards, regDev) => buildArea({ buildings_by_id: cards }, "alyelayiss2", {}, {}, [], {}, null, null, regDev);
const slotsOf = (devs) => Object.keys(devs).filter((k) => devs[k].c.length);

// the OLD rule, verbatim from v323: the card's developer field first, whatever it was built from
const oldDev = (c, projDev = {}) => c.developer || (c.dld && projDev[c.dld.project]) || null;

// 1. THE CASE. A register-built card "Symphony", developer 'imtiaz' from the crosswalk table by name (the exact card in img_unitmix_alyelayiss2).
const symphony = card("Symphony", { synthetic: true, status: "register", developer: "imtiaz", developer_basis: "crosswalk project_developer" });
eq(oldDev(symphony), "imtiaz", "NEGATIVE CONTROL: the v323 rule reproduces the error (Symphony -> Imtiaz)");
{ // 1a. no register available (offline build): a bare common-word name with a name-table developer is NOT recorded
  const d = build({ 900001: symphony }, null);
  ok(!d.imtiaz, "1a: Imtiaz must not appear for Symphony without register evidence");
  ok(d._ && d._.c.length === 1, "1a: it is 'Developer not recorded'");
}
{ // 1b. with the register: Nshama, VERIFIED
  const reg = { symphony: { c: "nshama", d: "NSHAMA PROPERTIES OWNED BY NSHMI DEVELOPMENT ONE PERSON COMPANY L.L.C", p: 2786, s: 1, lo: false } };
  const d = build({ 900001: symphony }, reg);
  ok(!d.imtiaz && d.nshama, "1b: Nshama holds Symphony");
  eq(d.nshama.n, "Nshama", "1b: display name");
  eq(JSON.stringify(d.nshama.q), "[40,0]", "1b: all 40 sales verified by the register");
}
{ // 1c. the real Imtiaz building keeps Imtiaz (the brand is in the name), marked inferred when the register is silent
  const t = card("Imtiaz Symphony Tower", { synthetic: true, developer: "imtiaz", developer_basis: "crosswalk project_developer" });
  const d = build({ 900002: t }, null);
  ok(d.imtiaz, "1c: Imtiaz Symphony Tower stays with Imtiaz");
  eq(JSON.stringify(d.imtiaz.q), "[0,40]", "1c: inferred, not verified");
}

// 2. the register wins over a card whenever it names a developer the crosswalk knows as a brand
{
  const c = card("Terra Heights", { developer: "Emaar" });                       // curated card field says Emaar
  const reg = { "terra heights": { c: "damac", d: "DAMAC PROPERTIES CO (L.L.C)", p: 1, s: 1, lo: false } };
  const d = build({ 1: c }, reg); ok(d.damac && !d.emaar, "2: register DAMAC overrides card Emaar");
  const d2 = build({ 1: c }, { "terra heights": { c: "emaar", d: "EMAAR PROPERTIES (P.J.S.C)", p: 1, s: 1, lo: false } }); eq(JSON.stringify(d2.emaar.q), "[40,0]", "2: register agrees -> verified");
}
// 3. a land owner / master-plan company is never a contradiction and never replaces a name
{
  const c = card("Park Ridge", { developer: "Emaar" });
  const d = build({ 1: c }, { "park ridge": { c: "dubai-hills-estate", d: "DUBAI HILLS ESTATE L.L.C", p: 9, s: 1, lo: false } });
  ok(d.emaar && !d["dubai-hills-estate"], "3: Emaar kept over the Dubai Hills Estate vehicle"); eq(JSON.stringify(d.emaar.q), "[0,40]", "3: inferred");
  const d2 = build({ 1: card("Beach Gate", { developer: "Beyond" }) }, { "beach gate": { c: "nakheel", d: "NAKHEEL .(P J S C)", p: 5, s: 1, lo: true } });
  ok(d2.beyond, "3: Nakheel as land owner never replaces Beyond");
  ok(MASTER_LIKE.has("nakheel") && MASTER_LIKE.has("meydan"), "3: master-like set");
}
// 4. a register project company (SPV, not a brand) gives way to a curated brand on a CARD field, but is used when there is nothing else
{
  const d = build({ 1: card("Harbour Gate", { developer: "Emaar" }) }, { "harbour gate": { c: "the-lagoons-phase-one", d: "THE LAGOONS PHASE ONE L.L.C", p: 7, s: 1, lo: false } });
  ok(!d.emaar && d._, "4 (v373b): a card brand is NOT kept over an unrelated register project company: the name link is dropped, the project is left out of Emaar");
  const d2 = build({ 1: card("Aurora Dune") }, { "aurora dune": { c: "aurora-spv-3", d: "AURORA SPV 3 L.L.C", p: 8, s: 1, lo: false } });
  ok(d["aurora-spv-3"] || d2["aurora-spv-3"], "4: register project company is the developer of record when nothing else exists");
}
// 5. a weak match (several project numbers share the name) is ignored: register silent
{
  const d = build({ 1: card("Symphony", { developer: "imtiaz", synthetic: true }) }, { symphony: { c: "nshama", d: "NSHAMA", p: 1, s: 0.4, lo: false } });
  ok(!d.imtiaz, "5: weak register match: still not Imtiaz (generic name)");
}

// 6. COMMON-WORD LIST: every shared name Kendall listed, alone and in a pair, with a name-table developer and no register, must not carry a developer
const WORDS = "Symphony Marina Park Tower Residence Heights Creek Bay Gate Vista Horizon Sky Grand Palm Beach Boulevard Central Sunset Pearl Cove Wynwood Westwood".split(" ");
for (const w of WORDS) {
  ok(COMMON_WORDS.has(w.toLowerCase()) || /^(wynwood|westwood)$/i.test(w), "6: listed word known " + w);
  if (/^(wynwood|westwood)$/i.test(w)) continue;           // Imtiaz's own project names: distinctive, handled by 'brand in name' / register, not the common-word rule
  const r = decide({ names: [w], cand: "Imtiaz", candDisplay: "Imtiaz", nameOnly: true, regd: null });
  eq(r.dev, "", "6: bare name '" + w + "' carries no developer");
  const r2 = decide({ names: [w + " Tower"], cand: "Imtiaz", candDisplay: "Imtiaz", nameOnly: true, regd: null });
  eq(r2.dev, "", "6: '" + w + " Tower' carries no developer");
}
ok(isGenericName("Park Central") && isGenericName("Grand Horizon") && isGenericName("Tower 2"), "6: pairs of common words");
ok(!isGenericName("Elvira") && !isGenericName("Imtiaz Symphony Tower") && !isGenericName("Wynwood Horizon by Imtiaz"), "6: distinctive names are not generic");
ok(brandInName("Wynwood Horizon by Imtiaz", "imtiaz", "Imtiaz") && brandInName("Binghatti Vintage", "binghatti", "Binghatti") && !brandInName("Symphony", "imtiaz", "Imtiaz"), "6: brand in name");
// the same names WITH the register: the register's developer, verified
for (const w of ["Marina", "Park", "Horizon", "Symphony", "Central"]) {
  const r = decide({ names: [w], cand: "Imtiaz", candDisplay: "Imtiaz", nameOnly: true, regd: { c: "nshama", d: "NSHAMA PROPERTIES", s: 1, lo: false } });
  eq(canonicalOf(r.dev), "nshama", "6: '" + w + "' follows the register"); eq(r.q, "v", "6: verified");
}
// a distinctive name with a name-table developer and a silent register is kept, marked inferred
{ const r = decide({ names: ["Elvira"], cand: "Emaar", candDisplay: "Emaar", nameOnly: true, regd: null }); eq(r.dev, "Emaar", "7: distinctive name kept"); eq(r.q, "i", "7: inferred"); }

// 8. the Python side reads the SAME word list from this module (parity by construction) - check the literal parses to the exported set
{
  const src = fs.readFileSync(new URL("../src/devattr.js", import.meta.url), "utf8");
  const m = src.match(/COMMON_WORDS = new Set\(\((.*?)\)\.split/s);
  ok(m, "8: word list literal found");
  const words = new Set([...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]).join("").split(" ").filter(Boolean));
  eq(words.size, COMMON_WORDS.size, "8: python-parsable literal equals the exported set");
}
// 9. the page carries the confidence note and the index builder writes q
{
  const page = fs.readFileSync(new URL("../src/devmap_page.js", import.meta.url), "utf8");
  ok(page.includes("function qNote(") && page.includes("matched by project name") && page.includes("e.q=d.q12||null"), "9: the page says when a developer is matched by project name");
}
console.log("test_v325_attribution: " + n + " assertions passed");
