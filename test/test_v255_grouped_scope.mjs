// v255 — A GROUPED BUILDING CARD MUST STATE THAT ITS FIGURES ARE AN AGGREGATE.
//
// Kendall, reading "DAMAC STAR PROPERTIES (L L C) · 12 projects" on DAMAC Towers: "they have only
// delivered 12 projects?" The fix was to group the twenty-one registered DAMAC entities, and the card
// then read 146. Correct — and silent about what 146 covers. The ungrouped branch stated its scope from
// the day it shipped; the grouped branch, added later, stated none, so the reader met a bigger number
// under the same header with nothing to scope it by, and would scope it to the company named above it.
//
// That is the house failure in its usual clothes: a true figure attached to a claim it does not support.
// It reading in our favour is not a defence — an aggregate presented as one company's record is as wrong
// as one company's record presented as a brand's, and harder to catch because it flatters.
//
// A sibling session fetched live and searched for an entity count that was never on this card at all. The
// absence was not drift; the silence was the defect. This pins both halves so neither can go quiet again.
import { developerAxes } from "../src/pillars.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const trackNote = (dev) => (developerAxes(dev, null).find((a) => /track/i.test(a.label || "")) || {}).note || "";

const BASE = { licensed: "2005-04-11", years: 21, track: 90, delivery: 100, on_time_pct: 92,
  projects: { total: 12, finished: 12, due: 12, delivered: 12, overdue: 0, dated: 12, on_time: 11, late: 1, cancelled: 0 } };

// ── the grouped card ────────────────────────────────────────────────────────
const GROUP = { ...BASE, name: "DAMAC", entities: 21,
  projects: { ...BASE.projects, total: 146, due: 97, delivered: 93, overdue: 4 } };
const g = trackNote(GROUP);
ok(/covers all 21 compan/.test(g), "a grouped card says how many companies the figure covers");
ok(/146 projects between them/.test(g), "and gives the total it is counting across them");
ok(/not the single company registered against this building/i.test(g),
   "and says plainly that it is not this building's own company — the reader's default reading, corrected");
ok(/recorded by hand, never matched on the name/.test(g),
   "and that grouping is a human decision, because name-matching filed DAMAC under Emaar once already");
ok(g.length > 0, "the grouped branch is never silent — the defect this test exists for");

// ── the single-entity card keeps its own, opposite caveat ───────────────────
const SINGLE = { ...BASE, name: "DAMAC STAR PROPERTIES (L L C)" };
const s = trackNote(SINGLE);
ok(/only — the entity registered against this building/.test(s), "an ungrouped card still states its narrower scope");
ok(!/covers all/.test(s), "and does not claim an aggregate it has not made");
ok(s !== g, "the two scopes read differently — a single sentence for both would be wrong for one of them");

// ── the Dubai-only portfolio line rides along, and only when earned ─────────
const SHORT = { ...GROUP, registerShortOf: 95 };
const sh = trackNote(SHORT);
ok(/portfolio lists 95/.test(sh) && /measuring different things/.test(sh),
   "where the register is short of the developer's own portfolio, the card says why rather than picking one");
ok(!/portfolio lists/.test(g), "and stays quiet when registerShortOf is not set");

// ── a group of one is still a group, and must not read as plural ───────────
const ONE = { ...GROUP, entities: 1 };
ok(/covers all 1 company the register/.test(trackNote(ONE)), "one entity reads 'company', not 'companys'");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
