// v358 - two PDF defects found on the Lootah / Jumeirah Village Circle sheets (5 Oct 2026). Synthetic data only; nothing live is read.
//   1. the "Where in Dubai" locator label was cut to "Jumeirah..." (wraps onto a second line now)
//   2. the focused footprint legend said "Entry band: 3 projects" while the buildings list had 4: the developer's projects with no outline yet are counted too
import { wrapLabel, blocksPicture, outlinePanels } from "../src/devmap_pdf.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

console.log("wrapLabel");
{
  ok(wrapLabel("Jumeirah Village Circle", 17, 2).join("|") === "Jumeirah Village|Circle", "'Jumeirah Village Circle' at 17 characters wraps to two lines, not 'Jumeirah…'");
  ok(wrapLabel("Marsa Dubai", 17, 2).join("|") === "Marsa Dubai", "a name that fits stays on one line");
  ok(wrapLabel("Jumeirah Village Circle", 40, 2).length === 1, "plenty of room: one line");
  const t = wrapLabel("Dubai Investments Park Second Extension", 12, 2);
  ok(t.length === 2 && /…$/.test(t[1]), "more than two lines: the last is cut with an ellipsis, never more than two lines");
  ok(wrapLabel("Supercalifragilisticexpialidocious", 10, 2).every((l) => l.length <= 10 + 1), "a single long word is trimmed");
  ok(wrapLabel("", 10, 2).length === 0, "empty name: no lines");
}

console.log("the locator panel carries the whole name");
{
  // a mid-map area (the label has about 17 characters of room on one side), Jumeirah Village Circle shaped like the live case
  const sq = (x0, y0, x1, y1) => ({ type: "Polygon", coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] });
  const geo = { features: [
    { properties: { slug: "west" }, geometry: sq(55.0, 25.0, 55.1, 25.1) },
    { properties: { slug: "jvc" }, geometry: sq(55.19, 25.04, 55.21, 25.06) },
    { properties: { slug: "east" }, geometry: sq(55.35, 25.1, 55.45, 25.2) },
  ] };
  const html = outlinePanels({ geo, slug: "jvc", area: { bbox: [55.19, 25.04, 55.21, 25.06] }, names: { plain: "Jumeirah Village Circle" } });
  const label = (html.match(/<text[\s\S]*?<\/text>/) || [""])[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  ok(/Jumeirah/.test(label) && /Circle/.test(label), "the label reads 'Jumeirah Village Circle' (got: " + label + ")");
  ok(!/Jumeirah…/.test(label) && !/Jumeirah\.\.\./.test(label), "no 'Jumeirah…' cut");
}

console.log("the focused legend counts the developer's unplaced projects");
{
  // one layer of six simple buildings; three projects of the focus developer have outlines, one has none, one belongs to another developer
  const sq = (x, y) => [x, y, x + 20, y, x + 20, y + 20, x, y + 20];
  const layer = { b: [[1, 12, sq(0, 0)], [2, 12, sq(40, 0)], [3, 12, sq(80, 0)], [4, 12, sq(0, 40)], [5, 12, sq(40, 40)], [6, 12, sq(80, 40)]] };
  const M = { layer, projects: [
    { k: "lootah", name: "A", ids: [1], tier: 3, n: 10 }, { k: "lootah", name: "B", ids: [2], tier: 3, n: 9 }, { k: "lootah", name: "C", ids: [3], tier: 3, n: 8 },
    { k: "lootah", name: "D", ids: null, tier: 3, n: 7 }, { k: "other", name: "E", ids: [4], tier: 1, n: 30 },
  ] };
  const C = { names: { plain: "Test Area" } };
  const pic = blocksPicture(C, M, 702, 255, "fit", "lootah");
  ok(pic && /Entry band: 3 projects/.test(pic.key), "three projects are drawn: 'Entry band: 3 projects'");
  ok(/Not yet on the map: 1 project/.test(pic.key), "the fourth is counted: 'Not yet on the map: 1 project'");
  ok(/Other developers: 1 project/.test(pic.key), "other developers still counted");
  const all = blocksPicture(C, M, 702, 255, "fit");
  ok(all && !/Not yet on the map/.test(all.key), "the unfocused area picture is unchanged (no 'Not yet on the map' line)");
  const none = blocksPicture(C, { layer, projects: M.projects.slice(0, 3) }, 702, 255, "fit", "lootah");
  ok(none && !/Not yet on the map/.test(none.key), "a developer with every project on the map shows no extra line");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
