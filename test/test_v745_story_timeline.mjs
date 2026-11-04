// v745 - 03A Building story: a worker-drawn SVG timeline (Kendall, 4 Nov 2026: "more visual timeline").
import fs from "fs";
const T = await import("../src/story_timeline.js");
const B = await import("../src/building_passports.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 600)); } };
const TODAY = "2026-11-04";
const noOverlap = (lab) => { for (let i = 0; i < lab.length; i++) for (let j = i + 1; j < lab.length; j++) { const a = lab[i].box, b = lab[j].box;
  if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) return [lab[i].label, lab[j].label]; } return null; };
const inside = (lab, W) => lab.every((m) => m.box.x >= 0 && m.box.x + m.box.w <= W);

// 1. a completed building, the events Kendall saw on the PDF (the plot record shape the builder writes, newest first)
const P = "The Example Residence project: ";
const done = { timeline: [
  { date: "2024-12-09", what: "Building permit issued by the Municipality: Apply for Buildings Drawings (permit 9001)", src: "g_dm__building_permits", s: "d" },
  { date: "2024-04-24", what: "Construction completed (Municipality) (file 377001)", src: "g_dm__project_information", s: "d" },
  ...[1, 2, 3, 4].map((i) => ({ date: "2019-04-21", what: "Building permit issued by the Municipality: Permit Application Cancellation (permit 80" + i + ")", src: "g_dm__building_permits", s: "d" })),
  { date: "2023-01-10", what: "Construction started (Municipality) (file 377001)", src: "g_dm__project_information", s: "d" },
  { date: "2017-02-15", what: P + "first rent contract registered (Ejari, the Land Department's tenancy register)", src: "chat_rent_contracts", s: "p" },
  { date: "2016-11-15", what: "Construction completed (Municipality) (file 249492)", src: "g_dm__project_information", s: "d" },
  { date: "2014-12-15", what: "Construction started (Municipality) (file 249492)", src: "g_dm__project_information", s: "d" },
  { date: "2014-08-01", what: P + "start date in the Land Department project register", src: "g_dld__projects", s: "p" },
  { date: "2014-07-30", what: "Construction file opened with the Municipality (file 249492)", src: "g_dm__project_information", s: "d" },
  { date: "2014-05-01", what: "Buildings entered in the Land Department register (3)", src: "g_dld__buildings", s: "d" },
  { date: "2014-02-20", what: P + "first sale registered with the Land Department (off-plan)", src: "chat_sales", s: "p" },
] };
const r1 = T.storySvg(done, {}, TODAY);
ok(r1 && /^<svg/.test(r1.svg) && /<\/svg>$/.test(r1.svg), "svg renders");
const L1 = r1.labels.map((m) => m.label);
for (const want of ["Registered", "Construction start", "Construction complete", "First sale (off-plan)", "First rent (Ejari)"]) ok(L1.includes(want), "milestone " + want, L1);
ok(L1.length <= 8, "at most 8 milestones", L1);
ok(!noOverlap(r1.labels), "labels do not overlap", noOverlap(r1.labels));
ok(inside(r1.labels, r1.W), "labels inside the chart width");
const cancel = r1.events.filter((e) => /Cancellation/.test(e.label));
ok(cancel.length === 1 && cancel[0].n === 4, "same-day permit cancellations collapse to one row of 4", cancel);
ok(/>4<\/text>/.test(r1.svg), "the collapsed dot shows its count");
ok(T.periods(T.storyEvents(done, {}), TODAY).length === 2, "one construction bar per Municipality file");
const sum1 = T.storySummary(r1.raw, TODAY);
ok(/^Registered 2014 · built 2014–2016 · first sale Feb 2014 \(off-plan\) · first rent Feb 2017 · latest activity Dec 2024: apply for Buildings Drawings$/.test(sum1), "summary line", sum1);
const blk1 = T.storyBlock(done, {}, TODAY);
ok(/Sources: .*Municipality building permits/.test(blk1) && /4 × Permit Application Cancellation/.test(blk1), "block: sources + compact list with count");

// 2. a real off-plan pack (v740 fixture): planned completion in the future is dashed, registration from the project record
const hado = JSON.parse(fs.readFileSync(new URL("./fixtures/v740_hado_1011305.json", import.meta.url)));
const r2 = T.storySvg(hado.pp, hado.pack, TODAY);
ok(r2 && r2.labels.some((m) => m.label === "Registered") && !noOverlap(r2.labels) && inside(r2.labels, r2.W), "hado: renders, registered milestone, no overlap", r2 && r2.labels);

// 3. a real KV pack (pp_pack_681-7149, Luma Park Views, read-only copy): start, 95% built, first rent, completion planned (now past)
const luma = JSON.parse(fs.readFileSync(new URL("./fixtures/v745_luma_681-7149.json", import.meta.url)));
const r3 = T.storySvg(luma.pp, luma.pack, TODAY);
const L3 = r3.labels.map((m) => m.label);
ok(["Construction start", "First sale", "First rent (Ejari)", "Completion was planned", "95% built"].every((x) => L3.includes(x)), "luma milestones", L3);
ok(!noOverlap(r3.labels) && inside(r3.labels, r3.W), "luma labels do not overlap", r3.labels.map((m) => m.box));
ok(/construction from 2023, 95% built at Jun 2026, completion was planned Jun 2026/.test(T.storySummary(r3.raw, TODAY)), "luma summary", T.storySummary(r3.raw, TODAY));

// 4. crowded: 30 events in one year never overlap and never exceed 8 labels
const crowd = { timeline: [] };
for (let i = 0; i < 30; i++) crowd.timeline.push({ date: "2020-0" + (1 + (i % 9)) + "-1" + (i % 9), what: i % 2 ? P + "first sale registered with the Land Department (off-plan)" : "Construction started (Municipality) (file " + i + ")", src: i % 2 ? "chat_sales" : "g_dm__project_information" });
crowd.timeline.push({ date: "2020-03-01", what: P + "first rent contract registered (Ejari)", src: "chat_rent_contracts" }, { date: "2020-03-02", what: "Construction completed (Municipality) (file 1)", src: "g_dm__project_information" });
const r4 = T.storySvg(crowd, { project: { registered: "2020-02-02" } }, TODAY);
ok(r4.labels.length <= 8 && !noOverlap(r4.labels) && inside(r4.labels, r4.W), "crowded: no overlap", r4.labels.map((m) => [m.label, m.box]));

// 5. placeholder: the writer's empty fixed-height box is filled; no box = nothing injected; prompt asks for the box
const html = '<div class="page"><div class="bpp-story" style="width:100%;height:74mm;overflow:hidden"></div></div>';
ok(T.hasStory(html) && T.placeStory(html, blk1).indexOf("<svg") > 0, "placeholder filled");
ok(T.placeStory("<div class=page></div>", blk1) === "<div class=page></div>", "no placeholder, nothing injected");
const f = B.bppFacts(luma.pp, luma.pack, TODAY);
const pr = B.bppPrompt(f, "4 Nov 2026");
// v751: the 03A story box now sits on page 2, which the worker draws (passport_pages.js); the writer writes page 1 only
ok(/write ONLY page 1/.test(pr) && /the building story/.test(pr) && pr.indexOf('class="bpp-story"') < 0, "prompt: the writer leaves the building story to the worker");
ok(/do NOT print these again/.test(pr), "the DATA story line tells the writer not to repeat it");
ok(/<\/svg>/.test(T.storyBlock({ timeline: [] }, {}, TODAY)) === false, "no events: a plain note, no svg");

console.log("v745 story timeline: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
