// v788: GGU page as clean cards - section tiles, "My graduation" built from the "My DBA:" / "My graduation:" items, grouped tasks,
// task add / edit / delete from the page through save_all (nothing else in the record may change). FAKE data only (public repo).
import { cleanGgu, gguApi, readGgu, gguMine, gguGroups, GGU_JS, GGU_BODY } from "../src/work_ggu.js";
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 400)); } };

// page shell
let parsed = true; try { new Function(GGU_JS); } catch (e) { parsed = false; console.log(e.message); }
ok(parsed, "client script parses");
ok(GGU_JS.startsWith("var __name=function(f){return f};"), "client script starts with the __name shim");
ok(!GGU_JS.includes("`") && !GGU_JS.includes("${"), "no backticks or template holes in the served script");
ok(/var gguMine=/.test(GGU_JS) && /var gguGroups=/.test(GGU_JS), "grouping helpers are served to the page");
for (const s of ["grad", "learn", "tasks", "dates", "docs", "people", "links"]) ok(GGU_BODY.includes("id=s_" + s + ">") && GGU_BODY.includes("data-s=" + s + ">") && GGU_BODY.includes("id=n_" + s + ">"), "collapsible section with a count: " + s);
for (const id of ["gnext", "gjump", "ggrad", "gchair", "glearn", "gcand", "gtk", "gdl", "gdocs", "gct", "groles", "glinks", "lsheet", "gtoast", "gtop"]) ok(GGU_BODY.includes("id=" + id), "page has #" + id);
ok(["My graduation", "My learners", "Tasks", "Dates", "Documents", "People", "Links"].every((t) => GGU_BODY.includes("<span>" + t + "</span>")), "section titles in plain words");
ok(/overflow-wrap:anywhere/.test(GGU_BODY) && /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/.test(GGU_BODY), "long paths wrap; learners are a 2-up grid");
ok(!/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(GGU_BODY + GGU_JS), "no emoji characters (inline SVG icons only)");
ok(!/#0[0-9a-f]{5}[^0-9a-f]/i.test(GGU_BODY.replace(/#0A4F4A/gi, "")), "no dark page colours beyond the identity teal");

// grouping
ok(gguMine("My DBA: order the transcript") && gguMine("My graduation: register") && gguMine("my dba: x") && !gguMine("Chair: reply") && !gguMine("Read My DBA: notes") && !gguMine(""), "own-degree prefix test");
const T = "2026-11-06";
const tasks = [
  { what: "Chair: confirm the allocation", by: "2026-11-09", done: false },      // 0 week
  { what: "My DBA: fee paid", by: "2026-11-12", done: true },                   // 1 mine
  { what: "My graduation: order regalia", by: "2027-03-01", done: false },      // 2 mine
  { what: "Reset the passwords", by: "2026-10-28", done: false },               // 3 late
  { what: "Nudge the learner", by: "2026-10-27", done: false },                 // 4 late (older)
  { what: "Confirm availability", by: "", done: false },                        // 5 nodate
  { what: "Confirm the certificates", by: "2027-01-13", done: false },          // 6 later
  { what: "Old thing", by: "2026-10-01", done: true },                          // 7 done
  { what: "Due today", by: "2026-11-06", done: false },                         // 8 week
  { what: "Due in 7 days", by: "2026-11-13", done: false },                     // 9 week (edge)
  { what: "Due in 8 days", by: "2026-11-14", done: false },                     // 10 later
];
const g = gguGroups(tasks, T), ix = (a) => a.map((e) => e.i).join(",");
ok(ix(g.mine) === "1,2", "own-degree tasks leave the general list (done or not)", ix(g.mine));
ok(ix(g.late) === "4,3", "overdue, oldest first", ix(g.late));
ok(ix(g.week) === "8,0,9", "this week = today to seven days ahead, soonest first", ix(g.week));
ok(ix(g.later) === "10,6", "later", ix(g.later));
ok(ix(g.nodate) === "5" && ix(g.done) === "7", "no date and done", [ix(g.nodate), ix(g.done)]);
ok(Object.values(g).reduce((n, a) => n + a.length, 0) === tasks.length && g.late[0].t === tasks[4], "every task lands in exactly one group and keeps its index into rec.tasks");
ok(gguGroups(undefined, T).late.length === 0, "no tasks: empty groups");

// task add / edit / delete through save_all keeps everything else
const store = {}; const env = { MEETINGS: { get: async (k) => store[k] ?? null, put: async (k, v) => { store[k] = v; } } };
const seed = cleanGgu({ roles: [{ title: "Adjunct faculty" }], candidates: [{ name: "Alex Example", due: [{ what: "Intro call", by: "2026-11-20" }] }], deadlines: [{ date: "2027-05-05", what: "My graduation: ceremony", confirmed: false }],
  documents: [{ label: "Folder", path_or_url: "C:\\Fake\\Path\\" }], portals: [{ label: "Portal", url: "https://example.org" }], contacts: [{ name: "Pat Example", role: "Registrar" }], tasks,
  ownDba: { cohort: "0000", mode: "Business Plan", completed: "Conferred 7 Aug 2026", notes: "[NOTE] kept" } });
seed.chair.learners[0].notes = "Sheet note"; seed.chair.acknowledged = true;
store.ggu_rec_kendall = JSON.stringify(seed);
const before = await readGgu(env, "kendall"), others = (r) => JSON.stringify([r.roles, r.candidates, r.deadlines, r.documents, r.portals, r.contacts, r.ownDba, r.chair]);
const copy = (r) => r.tasks.map((x) => ({ what: x.what, by: x.by, done: x.done }));
let L = copy(before); L.push({ what: "My graduation: book the flight", by: "2027-04-01", done: false });
let r = await gguApi(env, "kendall", { action: "save_all", rec: { tasks: L }, note: "Task added: My graduation: book the flight" });
ok(r.ok && r.rec.tasks.length === 12 && r.rec.tasks[11].what === "My graduation: book the flight" && r.rec.tasks[11].by === "2027-04-01", "add a task", r.rec && r.rec.tasks.length);
ok(others(r.rec) === others(before), "adding a task changes nothing else (learners, sheet notes, acknowledgment, own DBA, documents...)");
ok(r.rec.log[0].text === "Task added: My graduation: book the flight", "the log names the task edit, not an import", r.rec.log[0]);
L = copy(r.rec); L[3].what = "Reset both passwords"; L[3].by = "";
r = await gguApi(env, "kendall", { action: "save_all", rec: { tasks: L }, note: "Task edited: Reset both passwords" });
ok(r.rec.tasks[3].what === "Reset both passwords" && r.rec.tasks[3].by === "" && r.rec.tasks[1].done === true, "edit a task; ticks on the others survive");
L = copy(r.rec); L.splice(7, 1);
r = await gguApi(env, "kendall", { action: "save_all", rec: { tasks: L }, note: "Task deleted: Old thing" });
ok(r.rec.tasks.length === 11 && !r.rec.tasks.some((t) => t.what === "Old thing") && others(r.rec) === others(before), "delete a task; the rest of the record is untouched");
r = await gguApi(env, "kendall", { action: "import", rec: { candidates: [{ name: "Alex Example", stage: "Proposal" }] } });
ok(/^Imported: 0 new, 1 updated/.test(r.rec.log[0].text), "an import without a note keeps its own log line", r.rec.log[0]);
r = await gguApi(env, "kendall", { action: "set_task_done", index: 0, done: true });
ok(r.rec.tasks[0].done === true && gguGroups(r.rec.tasks, T).done.some((e) => e.i === 0), "ticking a task moves it to Done");

console.log("v788 ggu cards: " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
