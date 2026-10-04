// v316 - Makani plot attribution in img_anchors_<d>: the Brief reads a merged anchors document with no code change.
// apply_makani_anchors.ps1 rewrites a footprint's "cluster" (the Land Department sub-community) and adds cluster_src "makani_plot:<parcel>" and
// cluster_was. This test pins what the Brief relies on: a community that had no footprints gets its homes (so it is drawn, aimed at and measured
// from), the spelling of the name in the layer does not matter, a community that loses footprints keeps the rest, and one that loses them all
// is "not placed" rather than an error.
import { areaIndex, markOf, svTarget } from "../src/brief_docs.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };

const sq = (x, y, s) => [x, y, x + s, y, x + s, y + s, x, y + s, x, y];
// footprints 3..8 (the live list starts at 3, not 0: the layer id is the anchor's own "i", never its position in the list)
const LAYER = { d: "damachills", v: 1, b: [3, 4, 5, 6, 7, 8].map((i, k) => [i, 12, sq(60 * k, 0, 40)]), s: [], rp: [], ll: [100000, 0, -5525000, 0, 110000, -2750000] };
const A = (i, cluster, extra) => Object.assign({ i, id: String(i), cluster, kind: "villa", lon: 55.25 + 0.0006 * (i - 3), lat: 25.0 }, extra || {});
const BEFORE = { district: "damachills", anchors: [
  A(3, "DAMAC HILLS - CARSON"), A(4, "DAMAC HILLS - CARSON"), A(5, "DAMAC HILLS -  RICHMOND"), A(6, "DAMAC HILLS - GOLF GATE 2"), A(7, null), A(8, "DAMAC HILLS - BROOKFIELD-2"),
] };
// what the merge writes: 3 and 4 move Carson -> Brookfield-1 (spelt as the register spells it), 7 is new (Brookfield-3), 6 loses its only community
const AFTER = JSON.parse(JSON.stringify(BEFORE));
const set = (i, cluster, parcel) => { const a = AFTER.anchors.find((x) => x.i === i); if (a.cluster) { a.cluster_was = a.cluster; } a.cluster = cluster; a.cluster_src = "makani_plot:" + parcel; };
set(3, "DAMAC HILLS - BROOKFIELD-1", 6766844); set(4, "DAMAC HILLS - BROOKFIELD-1", 6766833); set(7, "DAMAC HILLS - BROOKFIELD-3", 6767020);
AFTER.anchors.find((x) => x.i === 6).cluster = null;
AFTER.makani_plots = { by: "apply_makani_anchors.ps1", footprints_changed: 2, footprints_new: 1 };
const rec = (n) => ({ n, name: n, it: { n, i: null }, pos: null });
const placed = (idx, n) => { const r = rec(n); const ids = idx && idx.get(n.toLowerCase().replace(/[^a-z0-9]/g, "")); if (ids) r.areaIds = ids; return markOf(r, LAYER); };
const k = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const ib = areaIndex(BEFORE, null), ia = areaIndex(AFTER, null);
ok(!ib.get(k("DAMAC HILLS - BROOKFIELD-1")), "before: Brookfield-1 has no homes in the district model");
ok(JSON.stringify(ia.get(k("DAMAC HILLS - BROOKFIELD-1"))) === "[3,4]", "after: Brookfield-1 has footprints 3 and 4 (by the anchor's own i)", JSON.stringify(ia.get(k("DAMAC HILLS - BROOKFIELD-1"))));
ok(JSON.stringify(ia.get(k("DAMAC HILLS - BROOKFIELD-3"))) === "[7]", "a footprint that had no community gets one");
ok(!ia.get(k("DAMAC HILLS - CARSON")), "Carson, which lost both footprints, is no longer in the index (no empty list)");
ok(ia.get(k("DAMAC HILLS - GOLF GATE 2")) === undefined, "a community that loses its only footprint drops out cleanly");

const mb = placed(ib, "DAMAC HILLS - BROOKFIELD-1"), ma = placed(ia, "DAMAC HILLS - BROOKFIELD-1");
ok(!mb.placed, "before: Brookfield-1 is not placed on the map");
ok(ma.placed && ma.area && ma.ids.length === 2, "after: Brookfield-1 is placed (Blocks view, exact homes)", JSON.stringify(ma));
const sv = svTarget(Object.assign(rec("DAMAC HILLS - BROOKFIELD-1"), { areaIds: ia.get(k("DAMAC HILLS - BROOKFIELD-1")) }), LAYER);
ok(sv && sv.homes.length === 2 && sv.probes.length >= 1, "after: Street View has homes to aim at", JSON.stringify(sv && sv.homes.length));
const ml = placed(ia, "DAMAC HILLS - GOLF GATE 2");
ok(!ml.placed, "a community left with no homes is simply not placed (card falls back to the district view)");

// the name in the layer may be spelt with odd spacing: the Brief matches letters and digits only
const ODD = { anchors: [A(5, "DAMAC HILLS -  RICHMOND"), A(8, "DAMAC HILLS- RICHMOND")] };
ok(areaIndex(ODD, null).get(k("DAMAC HILLS - RICHMOND")).length === 2, "spelling and spacing of the name do not split a community");
ok(areaIndex(AFTER, null).get(k("DAMAC HILLS - BROOKFIELD-2")).length === 1 && !areaIndex(AFTER, null).get(k("DAMAC HILLS - BROOKFIELD-1 ")).includes(8), "Brookfield-1 and Brookfield-2 stay separate communities");
ok(AFTER.anchors.every((a) => typeof a.i === "number") && ia.size === 4, "the added fields (cluster_src, cluster_was, makani_plots) change nothing the index reads");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
