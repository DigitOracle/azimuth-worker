// Score every building in a district against the Symphony template (naj-market-pulse/docs/BUILDING_PAGE_TEMPLATE.md).
//
// Kendall, 21 Sep 2026: "these kind of things should not be ad hoc. We have worked through an entire building where we've done
// everything ... that needs to be the template as you roll this out across all of Dubai."
//
// It runs the page's OWN buildingData() over the register files on disk, so what it scores is what the page will render - the
// audit cannot drift from the page the way a hand-written checklist would. Every building is scored on the data; the three
// largest are also rendered in full through the worker, and the audit fails loudly if a section the data says is present does
// not actually appear in the HTML.
//
//   node test/audit_building_pages.mjs businessbay [more districts…]
//
// Writes C:/Dev/naj-market-pulse/data/board/audit_<district>.json and prints the district's coverage table.
import worker from "../src/index.js";
import { buildingData } from "../src/building_page.js";
import fs from "node:fs";

const NAJ = process.env.NAJ_DATA || "C:/Dev/naj-market-pulse/data";
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; } };

// The sixteen sections of the contract, each with the rule the page itself uses to decide whether it renders, and the marker
// that must then appear in the HTML. `soft` sections are the ones a register can legitimately not hold for a building.
const SECTIONS = [
  ["name", "Name and developer", (D) => !!D.name && D.name !== "building", null],
  ["model", "The model", (D) => D.x != null && D.z != null, null],
  ["floors", "Floors are reachable", (D) => (D.floors || []).length > 0, "id=fpick"],
  ["plate", "The floor plate", (D) => !!(D.plate && D.plate.floors && Object.keys(D.plate.floors).length), null],
  ["flats", "The flats on the floor", (D) => !!(D.flats && D.flats.floors && Object.keys(D.flats.floors).length), null],
  ["sells", "What it sells for", (D) => (D.register || []).some((t) => t.median), null],
  ["lets", "What it lets for", (D) => !!D.rent, "What it lets for"],
  ["sold", "What has sold here", (D) => !!D.sold, "What has sold here"],
  ["construction", "Construction", (D) => !!D.project, "<h3>Construction"],
  ["plans", "The plans", (D) => !!D.plans, "The plans"],
  ["plot", "The plot", (D) => !!D.land, "The plot"],
  ["facts", "The building facts", (D) => (D.facts || []).length >= 3, "The building</h3>"],
  ["around", "Around it", (D) => (D.around || []).length > 0 || (D.schools || []).length > 0 || (D.transit || []).length > 0, null],
  ["people", "Who lives here", (D) => !!D.people, "Who lives here"],
  ["views", "What it sees over", (D) => !!D.openFrom, "What it sees over"],
  ["sourced", "Every claim sourced", (D) => !!D.asOf, null],
];

// why a section is missing, so the gap list says what to go and get rather than only that something is absent
function because(k, D) {
  const m = {
    model: "no anchor: this footprint is not in the district's model",
    plate: D.fits === false ? "the footprint is read as a podium" : "no plate built for this building",
    flats: "the units register does not reach this building (no parent property id)",
    sells: "the register prices none of this building's types",
    lets: "no Ejari record binds to this scheme",
    sold: "no registered sale binds to this name",
    construction: "no row in the project register",
    plans: "no plans held for this project",
    plot: "the land registry cut has no row for this parcel",
    around: "the district has no amenities cut",
    people: "the community is below the disclosure floor, or is not in the resident mix",
    views: "no neighbours modelled round this footprint",
  };
  return m[k] || "no data";
}

async function renderCheck(slug, id, store) {
  const KV = {
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
    async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })) }; },
  };
  globalThis.fetch = async () => new Response("{}", { status: 200 });
  const KEY = "client_read_key_for_the_audit_1";
  const r = await worker.fetch(new Request("https://x/building/" + slug + "/" + id + "?key=" + KEY),
    { MEETINGS: KV, READ_KEY: KEY, INGEST_TOKEN: "ING" }, { waitUntil() {} });
  return r.status === 200 ? await r.text() : null;
}

async function district(slug) {
  const stack = rd(NAJ + "/board/stack_" + slug + ".json");
  const umx = rd(NAJ + "/board/unitmix_" + slug + ".json");
  if (!stack || !umx) return { slug, error: "no stack or unitmix on disk" };
  const bf = rd(NAJ + "/board/bldgfacts_" + slug + ".json");
  const anchors = rd(NAJ + "/names/anchors_" + slug + ".json");
  const units = rd(NAJ + "/board/units_" + slug + ".json");
  const plates = rd(NAJ + "/board/plates_" + slug + ".json");
  const plans = rd(NAJ + "/board/plans_index.json");
  const people = rd(NAJ + "/internal/community_resident_mix.json");

  const ids = Object.keys(stack.buildings_by_id || {});
  const have = {}, why = {}, rows = [];
  for (const [k] of SECTIONS.map((s) => [s[0]])) { have[k] = 0; why[k] = {}; }
  for (const id of ids) {
    const D = buildingData(slug, id, stack, umx, bf, anchors, people, stack.district || slug, plans,
      (units && units.buildings_by_id) ? units.buildings_by_id[id] : null,
      plates ? { buildings: plates.buildings, note: plates.note } : null);
    if (!D) continue;
    const got = [];
    for (const [k, , test] of SECTIONS) {
      if (test(D)) { have[k]++; got.push(k); }
      else { const r = because(k, D); why[k][r] = (why[k][r] || 0) + 1; }
    }
    rows.push({ id, name: D.name, floors: (D.floors || []).length, score: got.length, has: got });
  }
  if (!rows.length) return { slug, error: "no building met both registers" };

  // the render check: the three biggest buildings, through the real worker, so a section the data claims is really on the page
  const store = new Map();
  const put = (k, f) => { try { store.set("img_" + k, fs.readFileSync(f, "utf8")); } catch (e) {} };
  put("stack_" + slug, NAJ + "/board/stack_" + slug + ".json");
  put("unitmix_" + slug, NAJ + "/board/unitmix_" + slug + ".json");
  put("bldgfacts_" + slug, NAJ + "/board/bldgfacts_" + slug + ".json");
  put("anchors_" + slug, NAJ + "/names/anchors_" + slug + ".json");
  put("plans_index", NAJ + "/board/plans_index.json");
  put("units_" + slug, NAJ + "/board/units_" + slug + ".json");
  const drift = [];
  for (const row of rows.slice().sort((a, b) => b.floors - a.floors).slice(0, 3)) {
    if (plates && plates.buildings && plates.buildings[row.id]) {
      store.set("img_plate_" + slug + "_" + row.id, JSON.stringify({ note: plates.note, building: plates.buildings[row.id] }));
    }
    const html = await renderCheck(slug, row.id, store);
    if (!html) { drift.push(row.id + " (" + row.name + "): the route did not return a page"); continue; }
    // three "The dossier" buttons shipped because a patch script was run three times and its anchor survived each insert.
    // A control that must appear once is checked here, where a re-applied patch shows up before a person does.
    for (const [id, label] of [["id=dossbtn", "the dossier button"], ["id=plansbtn", "the plans button"],
                               ["id=fpick", "the floor picker"], ["class=dossier", "the dossier link on the About card"]]) {
      const n = html.split(id).length - 1;
      if (n > 1) drift.push(row.id + " (" + row.name + "): " + n + " copies of " + label + " on one page");
    }
    for (const [k, label, , marker] of SECTIONS) {
      if (marker && row.has.includes(k) && !html.includes(marker)) drift.push(row.id + " (" + row.name + "): " + label + " is in the data but not on the page");
    }
  }
  const cover = {};
  for (const [k, label] of SECTIONS) {
    cover[k] = { label, n: have[k], pct: Math.round((have[k] / rows.length) * 100), why: Object.entries(why[k]).sort((a, b) => b[1] - a[1]).slice(0, 2) };
  }
  const full = rows.filter((r) => r.score === SECTIONS.length).length;
  return { slug, generated: new Date().toISOString().slice(0, 16).replace("T", " "), buildings: rows.length,
    sections: SECTIONS.length, full, median: rows.map((r) => r.score).sort((a, b) => a - b)[Math.floor(rows.length / 2)],
    cover, drift, worst: rows.slice().sort((a, b) => a.score - b.score).slice(0, 5).map((r) => [r.id, r.name, r.score]),
    // per building, so a specific one can be checked before it is filmed or sent: which of the sixteen it carries
    buildings_by_id: Object.fromEntries(rows.map((r) => [r.id, { name: r.name, score: r.score, has: r.has }])) };
}

let bad = 0;
for (const slug of (process.argv.slice(2).length ? process.argv.slice(2) : ["businessbay"])) {
  const a = await district(slug);
  // nothing to score is not a failure: Al Thanyah Fifth shares its registers with JLT North, and the industrial districts
  // hold no building that meets both. A non-zero exit means DRIFT - the page not rendering what the data says it holds.
  if (a.error) { console.log(slug + ": " + a.error + " (skipped)"); continue; }
  fs.writeFileSync(NAJ + "/board/audit_" + slug + ".json", JSON.stringify(a, null, 1));
  console.log("\n" + slug + " - " + a.buildings + " buildings, " + a.full + " carry all " + a.sections +
    " sections, median " + a.median + "/" + a.sections);
  for (const [k, v] of Object.entries(a.cover)) {
    const w = v.pct === 100 ? "" : "   " + (v.why[0] ? v.why[0][0] + " (" + v.why[0][1] + ")" : "");
    console.log("  " + String(v.pct).padStart(3) + "%  " + v.label.padEnd(24) + w);
  }
  if (a.drift.length) { bad++; console.log("  DRIFT - the page does not render what the data holds:"); for (const d of a.drift) console.log("    ! " + d); }
}
process.exit(bad ? 1 : 0);
