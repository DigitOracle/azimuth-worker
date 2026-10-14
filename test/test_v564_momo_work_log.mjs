// v564 - Momo Work: Najjuko's private FN Realty work log, filed to her five review focus areas, the scope of the role, people and campaigns
import fs from "node:fs";
import { workRoute, reportHtml, KPIS, PEOPLE, WORKS } from "../src/work_log.js";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 400)); } };
const store = new Map();
const KV = { get: async (k) => store.get(k) || null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const env = { MEETINGS: KV };
let lastSys = "";
const deps = (naj, model) => ({ isNaj: () => naj, model: "m", page: (k, rk, b) => "<page>" + b + "</page>",
  claudeJSON: async (e, sys, user) => { lastSys = sys; return model ? model(user) : null; } });
const req = (path, naj, body, model) => workRoute(new Request("https://w" + path, body ? { method: "POST", body: JSON.stringify(body) } : {}), env, new URL("https://w" + path + (path.includes("?") ? "&" : "?") + "key=k"), deps(naj, model));
// privacy
const own = await (await req("/momo/work", false)).text();
ok(/private to her link/.test(own) && !/wf/.test(own), "the owner sees only that the log is private");
ok((await req("/momo/work/api", false)).status === 404, "the owner cannot read the log's data");
ok((await req("/momo/work/report", false)).status === 404, "the owner cannot open her report");
// reference data
ok(KPIS.length === 5 && PEOPLE.some((p) => p[0] === "Sally Zehil") && PEOPLE.some((p) => p[0] === "Ali Kalhor") && WORKS.includes("Breast Cancer Awareness (October)"), "five focus areas; every agent by name (Sally Zehil); the campaigns");
// filing with the model
const huddle = (u) => ({ title: "Monday huddle", type: "Meeting", summary: "Najjuko ran the huddle.", people: ["Ali Kalhor", "Sally Zehil", "Nobody Invented"], kpis: [1, 9], scope: ["p4", "zz"], works: ["Monday Weekly Huddle", "Made Up"], deliverables: ["Huddle PowerPoint"], evidence: ["Strategy and plan shared with leadership"], next: [], questions: ["Who presented the week's numbers?"] });
const pr = await (await req("/momo/work/api", true, { action: "parse", text: "Monday huddle: built the PowerPoint with Sally, ran it with Ali.", date: "2026-10-12" }, huddle)).json();
ok(pr.entry.people.join() === "Ali Kalhor,Sally Zehil" && pr.entry.kpis.join() === "1" && pr.entry.scope.join() === "p4" && pr.entry.works[0] === "Monday Weekly Huddle", "filing keeps only known people, focus areas and parts of the role (v565: new task names are allowed)", pr.entry);
ok(pr.entry.questions.length === 1, "follow-up questions come back for her to answer");
ok(/capture EVERYTHING/.test(lastSys) && /Sally = Sally Zehil/.test(lastSys) && /Breast Cancer Awareness/.test(lastSys), "the filing instructions ask for every person and campaign");
// fallback with no model
const fb = await (await req("/momo/work/api", true, { action: "parse", text: "Breast Cancer post planned with Sally and Sousan for Instagram", date: "2026-10-13" })).json();
ok(fb.entry.check === true && fb.entry.people.includes("Sally Zehil") && fb.entry.people.includes("Sousan Khatibzadeh") && fb.entry.kpis.includes(3) && fb.entry.works.includes("Breast Cancer Awareness (October)"), "with no model, keywords still file it and ask her to check", fb.entry);
// save, list, tally
const sv = await (await req("/momo/work/api", true, { action: "save", entry: pr.entry, text: "t", date: "2026-10-12", link: "https://x/y.pptx" })).json();
ok(sv.ok && store.has("work_naj_2026-10-12_" + sv.entry.id), "saved under her prefix and date");
const wk = await (await req("/momo/work/api?week=2026-10-14", true)).json();
ok(wk.from === "2026-10-12" && wk.to === "2026-10-18" && wk.entries.length === 1 && wk.tally[0].week === 1 && wk.tally[0].term === 1, "the week runs Monday to Sunday; the tally counts it under Marketing direction", wk.tally);
// report
const rep = await (await req("/momo/work/report?from=2026-10-12&to=2026-10-18", true)).text();
ok(/WEEKLY ACTIVITY REPORT/.test(rep) && /Sally Zehil/.test(rep) && /Huddle PowerPoint/.test(rep) && /Monday Weekly Huddle/.test(rep) && /CONFIDENTIAL · FN Realty internal use only/.test(rep) && /#1F2B44/.test(rep), "the weekly report: focus areas, deliverables, campaigns, people, FN brand and the confidentiality footer");
ok(!/Claude|Anthropic|OpenAI|GPT/i.test(rep), "the report never names an AI vendor");
// edit and delete
const ed = await (await req("/momo/work/api", true, { action: "save", entry: { ...sv.entry, title: "Huddle 1" }, id: sv.entry.id, date: "2026-10-13", oldDate: "2026-10-12", created: sv.entry.created })).json();
ok(ed.ok && !store.has("work_naj_2026-10-12_" + sv.entry.id) && store.has("work_naj_2026-10-13_" + sv.entry.id), "editing the date moves the entry, never duplicates it");
await req("/momo/work/api", true, { action: "delete", id: sv.entry.id, date: "2026-10-13" });
ok(![...store.keys()].some((k) => k.startsWith("work_naj_")), "delete removes it");
// the page script parses
const js = await (await req("/momo/work.js", true)).text();
try { new Function(js); pass++; } catch (e) { fail++; console.log("FAIL the work page script does not parse", e.message); }
const ix = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/isNajjuko\(env, url\)\) return Response\.redirect\(url\.origin \+ "\/momo\/work\?key="/.test(ix), "her MOMO tab opens straight on Work");
ok(/x\.indexOf\("ins_najjuko_"\) === 0/.test(ix), "only her insider key counts as her");
// v565 - task progress over days, rough time, daily summary
{ const { tasksOf, hoursByKpi } = await import("../src/work_log.js");
  const es = [
    { date: "2026-10-13", created: "a", works: ["Breast Cancer Awareness (October)"], progress: [{ work: "Breast Cancer Awareness (October)", status: "Started", percent: 10 }], effort: "1-2 hours", kpis: [2] },
    { date: "2026-10-14", created: "b", works: ["Breast Cancer Awareness (October)", "Monday Weekly Huddle"], progress: [{ work: "Breast Cancer Awareness (October)", status: "In progress", percent: 50 }], effort: "Full day", kpis: [2, 1] },
    { date: "2026-10-16", created: "c", works: ["Breast Cancer Awareness (October)"], progress: [{ work: "Breast Cancer Awareness (October)", status: "Done", percent: 100 }], effort: "Half a day", kpis: [2] } ];
  const t = tasksOf(es), bc = t.find((x) => x.name === "Breast Cancer Awareness (October)");
  ok(bc.percent === 100 && bc.status === "Done" && bc.first === "2026-10-13" && bc.last === "2026-10-16" && bc.days === 3 && bc.hours === 9.5, "a task shows its latest percent, first day, days worked and rough hours (shared days split)", bc);
  ok(t[0].name === "Monday Weekly Huddle", "open tasks list before finished ones");
  ok(hoursByKpi(es).find((x) => x.id === 2).hours === 9.5, "time by focus area");
  const rep = reportHtml(es.map((e) => ({ ...e, title: "x", type: "Update", summary: "s", people: [], scope: [], deliverables: [], next: [] })).slice(1, 2), "2026-10-14", "2026-10-14", t);
  ok(/DAILY ACTIVITY REPORT/.test(rep) && /TASK PROGRESS/.test(rep) && /about 8 hours/.test(rep) && /Started<\/td>|13 Oct 2026/.test(rep), "a one-day report is the daily summary, with task progress and hours"); }
const pe = await (await req("/momo/work/api", true, { action: "parse", text: "Started planning the Halloween party, about half done with the concept", date: "2026-10-14" }, () => ({ title: "Halloween", type: "Organising", summary: "s", people: [], kpis: [5], scope: ["b4"], works: ["Halloween (31 Oct)", "  New office mural  "], deliverables: [], evidence: [], next: [], questions: [], effort: "Bogus", progress: [{ work: "Halloween (31 Oct)", status: "In progress", percent: 150 }] }))).json();
ok(pe.entry.works.includes("New office mural") && pe.entry.effort === "1-2 hours" && pe.entry.progress[0].percent === 100, "new tasks are kept, effort and percent are kept in range", pe.entry);
// v566 - who holds each task, department cards, longest-quiet first
{ const { tasksOf, deptBoard, deptOf } = await import("../src/work_log.js");
  ok(deptOf("Sally Zehil") === "Sales" && deptOf("Sousan Khatibzadeh") === "Marketing" && deptOf("Ali Kalhor") === "Leadership" && deptOf("Savia Gomes") === "HR, Admin & Compliance" && deptOf("Fatu") === "Sales", "every person sits in a department");
  const es = [
    { date: "2026-10-06", created: "a", works: ["Breast Cancer Awareness (October)"], people: ["Sally Zehil"], progress: [{ work: "Breast Cancer Awareness (October)", status: "Started", percent: 10, owners: ["Sally Zehil", "Sousan Khatibzadeh"] }], effort: "1-2 hours", kpis: [2] },
    { date: "2026-10-13", created: "b", works: ["Monday Weekly Huddle"], people: ["Ali Kalhor"], progress: [{ work: "Monday Weekly Huddle", status: "In progress", percent: 60, owners: [] }], effort: "Half a day", kpis: [1] },
    { date: "2026-10-12", created: "c", works: ["Org chart"], people: ["Savia Gomes"], progress: [{ work: "Org chart", status: "Done", percent: 100, owners: ["Savia Gomes"] }], effort: "Half a day", kpis: [1] } ];
  const t = tasksOf(es), b = deptBoard(t, "2026-10-14"), sales = b.find((d) => d.dept === "Sales"), mk = b.find((d) => d.dept === "Marketing"), hr = b.find((d) => d.dept === "HR, Admin & Compliance");
  ok(t.find((x) => x.name === "Breast Cancer Awareness (October)").owners.join() === "Sally Zehil,Sousan Khatibzadeh", "a task remembers who holds it");
  ok(sales.open === 1 && sales.tasks[0].who.join() === "Sally Zehil" && sales.tasks[0].quiet === 8, "Sales shows Sally's open task and how long it has been quiet", sales);
  ok(mk.open === 1 && mk.people.join() === "Sousan Khatibzadeh", "Marketing shows the same task under Sousan");
  ok(hr.open === 0, "a finished task leaves the department board");
  ok(b.find((d) => d.dept === "Leadership").tasks[0].name === "Monday Weekly Huddle", "a person touched in the entry also puts the task on their department");
  const rep = reportHtml([{ ...es[0], title: "x", type: "Update", summary: "s", scope: [], deliverables: [], next: [] }], "2026-10-06", "2026-10-06", t);
  ok(/With Sally Zehil, Sousan Khatibzadeh/.test(rep), "the report's task table says who the task is with"); }
// v569 - Prepare me: the briefing questions, the engine call, the page
{ const { prepQuestions, prepBrief } = await import("../src/work_log.js");
  const q = prepQuestions({ developer: "Imtiaz Developments", project: "Kore", area: "Arjan" });
  ok(q.length === 14 && q[0][1] === "Tell me about Kore" && q.some((x) => /Gross yield for a 1 bed in Arjan/.test(x[1])) && q.some((x) => /How many developers in Arjan/.test(x[1])) && q.some((x) => /Imtiaz Developments registered/.test(x[1])), "the briefing asks about the project, the area (prices, rents, yield, trend, comparisons, supply, schools) and the developer");
  const calls = []; globalThis.fetch = async (u, init) => { calls.push(JSON.parse(init.body).question); return new Response(JSON.stringify({ status: "answer", headline: "H", cards: [{ label: "L", value: "V" }], note: "n", as_of: { t: "2026-10-12" } })); };
  const s = await prepBrief({ ASK_ENGINE_URL: "https://e", ASK_SECRET: "s" }, { area: "Arjan" });
  ok(s.length === 11 && calls.length === 11 && s[0].headline === "H" && s[0].as_of === "2026-10-12", "each section carries the engine's headline, cards and as-of date");
  const pr = await (await req("/momo/work/api", true, { action: "parse", text: "MTI open house on Saturday, need to prepare", date: "2026-10-14" })).json();
  ok(pr.entry.prep && pr.entry.prep.needed && pr.entry.prep.developer === "Imtiaz Developments" && pr.entry.prep.event === "open house", "an open house with Imtiaz (MTI) is flagged for preparation, even without the model", pr.entry.prep);
  const pg = await (await req("/momo/work/prep?dev=Imtiaz%20Developments&event=open%20house", true)).text();
  ok(/Build my briefing/.test(pg) && /value="Imtiaz Developments"/.test(pg) && /<h1>open house<\/h1>/.test(pg), "the Prepare me page opens prefilled");
  const pj = await (await req("/momo/work/prep.js", true)).text();
  try { new Function(pj); pass++; } catch (e) { fail++; console.log("FAIL the prepare page script does not parse", e.message); }
  ok((await req("/momo/work/prep", false)).status === 404, "the briefing page is hers only"); }
ok(/request\.method === "POST" && url\.pathname === "\/momo\/work\/api"/.test(ix), "v564.1: her saves and filings are answered before the POST guard");
console.log(`v564 momo work log: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

