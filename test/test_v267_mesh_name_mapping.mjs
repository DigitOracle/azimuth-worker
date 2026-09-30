// v267 - mesh->footprint mapping in paintDevs() (byFp) was nearest-centroid only, which misjudges adjacent small
// buildings. Assigned after the coverage sweep (Kendall, 29 Sep 2026: "all buildings clickable, with data connected").
// v3 tiles name meshes b<i>_<class>_s<status>, v4/v5 name them b<i>_<class>; a multi-part building's several meshes
// (walls, bands, crown) all share the same b<i> prefix. A mesh whose name parses to a real footprint id in this
// district's anchor set now wins outright; nearest-centre-within-30m stays as the fallback for a mesh with no such
// name - the goldensymphony pilot's unnamed mesh_CityEngineMaterial* nodes are the one tile that still needs it.
//
// NOTE: a second change (making the map/twin building panel's "the building" tab render unconditionally) was built
// and then reverted in this same v267 pass - test_v223_building_tab.mjs failed against it, and v223's own comment
// ("no dead control") shows the hasB gate was a deliberate fix, not the defect the coverage-sweep audit described.
// Left for "Building wiring audit" to confirm before anyone touches it again.
//
// NEGATIVE CONTROL: revert the byFp change (position-only, no name check) and run this file - the matching
// assertion(s) must fail. Verified by doing so.
import { readFileSync } from "node:fs";
const SRC = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ok = (c, w) => { if (c) { pass++; console.log("  ok - " + w); } else { fail++; console.log("  FAIL - " + w); } };

// --- source shape ---
ok(SRC.includes('const _nm=MESHES[i].name||"",_mm=/^b(\\d+)/.exec(_nm);'), "each mesh's name is parsed for a leading b<digits> id");
ok(SRC.includes('if(_mm&&fpSet.has(_mm[1])){(byFp[_mm[1]]=byFp[_mm[1]]||[]).push(i);byName++;continue}'),
  "a name match that resolves to a real footprint in this district wins outright, before any distance is measured");
const posFallbackIdx = SRC.indexOf('let bi=-1,bd=1e9;for(const f of fps){if(f[1]==null)continue;');
const nameCheckIdx = SRC.indexOf('if(_mm&&fpSet.has(_mm[1]))');
ok(nameCheckIdx > 0 && posFallbackIdx > nameCheckIdx, "the name check runs BEFORE the position fallback, not after (order decides which one wins)");

// --- real behaviour, the byFp loop extracted and run against synthetic meshes/anchors ---
const startTag = "const fps=ANCH.fps||ANCH.anchors.map";
const endTag = 'console.log("[byFp] ${slugName}: "';
const s0 = SRC.indexOf(startTag), s1 = SRC.indexOf(endTag);
ok(s0 > 0 && s1 > s0, "the byFp-building block is present and extractable for a real run");
const loopSrc = SRC.slice(s0, s1);
const run = (MESHES, cents, ANCH) => {
  const fn = new Function("MESHES", "cents", "ANCH", loopSrc + "\nreturn byFp;");
  return fn(MESHES, cents, ANCH);
};
{
  // three named meshes belonging to one multi-part building (b501: walls/band/crown, v4-style names), one named mesh
  // for a NEIGHBOUR building (b502) sitting just 5m away (would have been the nearest centroid for a naive mismeasure),
  // and one UNNAMED mesh (the goldensymphony case) that must fall back to nearest-centre.
  const MESHES = [
    { name: "b501_render" }, { name: "b501_render" }, { name: "b501_render" },
    { name: "b502_render" },
    { name: "mesh_CityEngineMaterial3" },
  ];
  const cents = [[0, 0], [0.5, 0.5], [1, 1], [5, 5], [100, 100]];
  const ANCH = { fps: [[501, 0, 0], [502, 100, 100]] };   // note: 502's REAL position is far away; only its NAME is nearby-looking in the mesh list
  const byFp = run(MESHES, cents, ANCH);
  ok(Array.isArray(byFp[501]) && byFp[501].length === 3, "all three of b501's multi-part meshes are grouped under footprint 501 by name");
  ok(Array.isArray(byFp[502]) && byFp[502].includes(3), "b502's named mesh is assigned to 502 even though the naive nearest-centroid would have picked 501");
  ok(Array.isArray(byFp[502]) && byFp[502].includes(4), "the unnamed mesh (no b<i> prefix) falls back to nearest-centre and lands on 502, whose anchor sits at [100,100] - exactly where the unnamed mesh's own centroid is");
}
{
  // a mesh named with a b<i> id that is NOT one of this district's own footprints (a stray/foreign id) must not be
  // trusted blindly - it falls through to the position fallback like an unnamed mesh would.
  const MESHES = [{ name: "b9999_render" }];
  const cents = [[10, 10]];
  const ANCH = { fps: [[1, 10, 10]] };
  const byFp = run(MESHES, cents, ANCH);
  ok(Array.isArray(byFp[1]) && byFp[1].length === 1, "a mesh named for a footprint id absent from this district's own anchor set falls back to position, not a wrong forced id");
}

ok(SRC.includes('console.log("[byFp] ${slugName}: "+byName+" by name, "+byPos+" by proximity fallback ("'),
  "the fallback rate is logged per-district (by name), not just as an overall count - a district running high signals a bad export, not a bad mapping");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
