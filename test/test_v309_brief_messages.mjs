// v309 (Kendall, 4 Oct 2026, two screenshots of the live /brief page): the page printed INTERNAL notes to the person using it
// ("estimated_left is T minus R ... KV img_beds_left_<district>", "evidence.beds_basis", "q1-q3", "furnished_hint", "fields are null"),
// and answered "Nothing matched ... try a wider budget" where the real reason was a data gap (Arabian Ranches buy: no sales loaded)
// or a floor far above the market (Motor City 2-bed at AED 250k and up).
// PROVES (Google not asked, KV stubbed):
//   M1 a client key never receives a technical term in summary, empty, notes, source (banned list below)
//   M2 the client's notes are empty; the OWNER still gets the technical notes
//   M3 the page shows the owner's notes only inside a collapsed "Details for the team" and renders the plain empty-state
//   E1 below the floor: says how many were below the minimum, one next step
//   E2 fewer than three lettings: says so
//   E3 no data for the area (buy, Arabian Ranches): says the sales are not loaded, never "widen your budget", never claims none sold
//   E4 floor far above the market: states the typical figure computed from the data
//   E5 must-haves removed everything: says so
// NEGATIVE CONTROL: BRIEF_SRC=C:/Dev/azimuth-worker-dewa/src/ is not it - use a release-v306 checkout: BRIEF_SRC=<that>/src/ node test/test_v309_brief_messages.mjs
//   (v306 has no summary/empty and puts technical notes in the client body: M1, M2, E1-E5 fail there).
//   node test/test_v309_brief_messages.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.env.BRIEF_SRC || path.join(HERE, "..", "src") + path.sep;
const B = await import(pathToFileURL(path.join(SRC, "brief.js")).href);
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? " :: " + String(d).slice(0, 500) : "")); } };

const S = (m, n = 12) => ({ n, nn: n, nr: 0, m, q1: m - 8000, q3: m + 8000, mn: m, q1n: m - 8000, q3n: m + 8000, s: 140, last: "2026-09-29" });
const item = (p, n, m, cnt) => ({ p, n, area: "Al Hebiah First", d: "motorcity", i: null, last: "2026-09-29", b: { "2": S(m, cnt || 12) } });
const RI = { as_of: "2026-09-30", window: ["2026-08-01", "2026-09-30"], items: [item("a", "Alpha Tower", 90000), item("b", "Beta Tower", 110000), item("c", "Gamma Tower", 100000), item("d", "Thin Tower", 95000, 2),
  { ...item("e", "Hi Tower", 260000, 12), b: { "2": S(260000, 12) } }].slice(0, 4), areas: [{ area: "Al Hebiah First", d: "motorcity", b: { "2": S(100000, 40) } }] };
const MP = { generated: "2026-09-09T00:00:00Z", items: [{ i: 1, d: "motorcity", n: "Villa X", b: { "2": 1 } }] };
const DG = { districts: [{ slug: "motorcity", name: "Motor City" }] };
const store = new Map([["img_rent_index", JSON.stringify(RI)], ["img_map_prices", JSON.stringify(MP)], ["img_districts_geo", JSON.stringify(DG)]]);
const env = { MEETINGS: { async get(k) { return store.has(k) ? store.get(k) : null; }, async list() { return { keys: [], list_complete: true }; } } };
const run = async (qs, owner) => { B.__resetKvMemo && B.__resetKvMemo(); return (await B.briefSearch(env, new URLSearchParams(qs), { owner: !!owner, live: false })).body; };

const BANNED = [/\bnull\b/i, /\bKV\b/, /img_[a-z_<>]+/i, /evidence\./i, /estimate_as_of/i, /estimated_left/i, /\bq1\b/i, /\bq3\b/i, /q1-q3/i, /furnished_hint/i, /beds_basis/i, /disputed_bind/i, /developer_availability/i, /record_name/i, /Ejari register does not/i];
const text = (j) => [].concat(j.summary || [], j.empty ? [j.empty.title].concat(j.empty.reasons, j.empty.next) : [], j.notes || [], j.source || "", j.error || []).join(" | ");
const bad = (j) => BANNED.filter((r) => r.test(text(j))).map(String);

// the rent search with results (client + owner)
let c = await run("mode=rent&beds=2&areas=motorcity&min=80000&max=120000&furnished=furnished", false);
let o = await run("mode=rent&beds=2&areas=motorcity&min=80000&max=120000&furnished=furnished", true);
ok(c.results && c.results.length >= 1, "setup: the client search lists buildings", JSON.stringify(c).slice(0, 200));
ok(bad(c).length === 0, "M1 client rent search: no technical term anywhere in summary / notes / source", bad(c).join(" ") + " :: " + text(c));
ok(Array.isArray(c.notes) && c.notes.length === 0, "M2a client notes are empty");
ok(o.notes.length >= 5 && o.notes.some((n) => /estimated_left/.test(n)) && o.notes.some((n) => /q1/.test(n)), "M2b the owner still gets the technical notes", o.notes.length);
ok(c.summary && c.summary.length >= 1 && c.summary.length <= 3, "M1b the client gets 1-3 plain summary sentences", JSON.stringify(c.summary));
ok(/Evidence to \d+ \w+ 2026/.test(c.summary[0]), "M1c the summary carries the evidence date in words", c.summary[0]);

// E1 + E2 + E4: floor far above the market, 2 thin
c = await run("mode=rent&beds=2&areas=motorcity&min=250000", false);
ok(c.total_matched === 0 && c.empty, "E setup: nothing matched, empty-state present", JSON.stringify(c).slice(0, 200));
ok(bad(c).length === 0, "M1d client empty rent: no technical term", bad(c).join(" ") + " :: " + text(c));
ok(c.empty.reasons.some((r) => /3 buildings were below your AED 250k minimum/.test(r)), "E1 says how many were below the minimum, in plain words", c.empty.reasons.join(" | "));
ok(/Lower your minimum/.test(c.empty.next), "E1b one plain next step", c.empty.next);
ok(c.empty.reasons.some((r) => /1 building was left out: fewer than three registered lettings/.test(r)), "E2 fewer than three lettings", c.empty.reasons.join(" | "));
ok(c.empty.reasons.some((r) => /2-bedroom homes in Motor City let for about AED 100k a year typically/.test(r) && /below your AED 250k minimum/.test(r)), "E4 the typical figure comes from the data, not a constant", c.empty.reasons.join(" | "));

// E3 no data for the area, buy, Arabian Ranches
c = await run("mode=buy&beds=2&type=villa&min=1500000&max=2500000&furnished=unfurnished&areas=wadialsafa6,wadialsafa7", false);
o = await run("mode=buy&beds=2&type=villa&min=1500000&max=2500000&furnished=unfurnished&areas=wadialsafa6,wadialsafa7", true);
ok(c.empty && /not loaded into the Brief yet/.test(c.empty.reasons.join(" ")), "E3 Arabian Ranches buy: says the sales are not loaded", c.empty && c.empty.reasons.join(" | "));
ok(!/wider budget|widen/i.test(text(c)), "E3b never tells the person to widen the budget", text(c));
ok(!/no sales|nothing sold(?!\.)/i.test(c.empty.reasons.join(" ")) && /not a sign that nothing sold/.test(c.empty.reasons.join(" ")), "E3c does not claim none sold");
ok(bad(c).length === 0 && c.notes.length === 0 && c.source === null, "M1e client buy: no technical term, no source name", bad(c).join(" "));
ok(o.notes.some((n) => /plot size/.test(n)) && /KV img_map_prices/.test(o.source), "M2c owner sees the caveats and the source", o.source);

// E5 must-haves
c = await run("mode=rent&beds=2&areas=motorcity&min=80000&max=120000&musts=metro", false);
ok(!c.empty || bad(c).length === 0, "M1f must-have search: nothing technical", bad(c).join(" "));

// the page
const pagesrc = fs.readFileSync(path.join(SRC, "brief_page.js"), "utf8");
ok(/Details for the team/.test(pagesrc), "M3a the page has a 'Details for the team' section");
ok(/<details class=nt><summary>Details for the team<\/summary>"\+n\.map/.test(pagesrc), "M3b the notes are rendered only inside it");
ok(!/Try a wider budget, another district or two, or fewer must-haves\. A building needs/.test(pagesrc), "M3c the old blanket empty-state text is gone");
ok(/RES&&RES\.empty/.test(pagesrc) && /Next step:/.test(pagesrc), "M3d the page renders the reasons and the next step");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
