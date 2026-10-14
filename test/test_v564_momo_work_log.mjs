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
const huddle = (u) => ({ entries: [{ title: "Monday huddle", type: "Meeting", summary: "Najjuko ran the huddle.", people: ["Ali Kalhor", "Sally Zehil", "Nobody Invented"], kpis: [1, 9], scope: ["p4", "zz"], works: ["Monday Weekly Huddle", "Made Up"], deliverables: ["Huddle PowerPoint"], evidence: ["Strategy and plan shared with leadership"], next: [], questions: ["Who presented the week's numbers?"] }] });
const pr = await (await req("/momo/work/api", true, { action: "parse", text: "Monday huddle: built the PowerPoint with Sally, ran it with Ali.", date: "2026-10-12" }, huddle)).json();
ok(pr.entry.people.join() === "Ali Kalhor,Sally Zehil" && pr.entry.kpis.join() === "1" && pr.entry.scope.join() === "p4" && pr.entry.works[0] === "Monday Weekly Huddle", "filing keeps only known people, focus areas and parts of the role (v565: new task names are allowed)", pr.entry);
ok(pr.entry.questions.length === 1, "follow-up questions come back for her to answer");
ok(/capture EVERYTHING/.test(lastSys) && /Sally = Sally Zehil/.test(lastSys) && /Breast Cancer Awareness/.test(lastSys), "the filing instructions ask for every person and campaign");
// fallback with no model
const fb = await (await req("/momo/work/api", true, { action: "parse", text: "Breast Cancer post planned with Sally and Sousan for Instagram", date: "2026-10-13" })).json();
ok(fb.entry.check === true && fb.entry.people.includes("Sally Zehil") && fb.entry.people.includes("Sousan Khatibzadeh") && !fb.entry.people.includes("Syed Ali Mudassir") && fb.entry.kpis.includes(3) && fb.entry.works.includes("Breast Cancer Awareness (October)"), "with no model, keywords still file it and ask her to check (whole-word names only)", fb.entry);
{ const h = await (await req("/momo/work/api", true, { action: "parse", text: "Huddle with Ali and the agents, about 40% through the week plan", date: "2026-10-13" })).json();
  ok(h.entry.people.includes("Ali Kalhor") && h.entry.people.includes("All sales agents") && !h.entry.people.includes("Syed Ali Mudassir") && !h.entry.people.includes("Hussien Alfayadh") && h.entry.progress[0] && h.entry.progress[0].percent === 40 && h.entry.progress[0].status === "In progress", "v570.1: 'Ali' is Ali Kalhor, not Syed Ali; a huddle adds the agents; a stated percent is used", h.entry); }
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
const pe = await (await req("/momo/work/api", true, { action: "parse", text: "Started planning the Halloween party, about half done with the concept", date: "2026-10-14" }, () => ({ entries: [{ title: "Halloween", type: "Organising", summary: "s", people: [], kpis: [5], scope: ["b4"], works: ["Halloween (31 Oct)", "  New office mural  "], deliverables: [], evidence: [], next: [], questions: [], effort: "Bogus", progress: [{ work: "Halloween (31 Oct)", status: "In progress", percent: 150 }] }] }))).json();
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
// v570 - a whole day typed at once is split into one entry per activity
{ const { splitDay } = await import("../src/work_log.js");
  const day = "Monday huddle with Ali and the agents, laid out the week.\n- Called Sousan about the Breast Cancer post\n- Chased Vishant for the Halloween visuals. Then met Nousheen about the PR launch for Faez.";
  const parts = splitDay(day);
  ok(parts.length === 4 && /huddle/.test(parts[0]) && /Sousan/.test(parts[1]) && /Vishant/.test(parts[2]) && /Nousheen/.test(parts[3]), "lines, bullets and 'then' split a day into four activities", parts);
  ok(splitDay("One meeting with Ali about the strategy.").length === 1, "a single activity stays one entry");
  let gotSchema = null;
  const multi = await (await req("/momo/work/api", true, { action: "parse", text: day, date: "2026-10-13" }, (u) => ({ entries: [
    { title: "Huddle", type: "Meeting", summary: "s1", people: ["Ali Kalhor"], kpis: [1], scope: ["p4"], works: ["Monday Weekly Huddle"], deliverables: [], evidence: [], next: [], questions: [], effort: "Half a day", progress: [], prep: { needed: false, developer: "", project: "", area: "", event: "" } },
    { title: "Breast Cancer call", type: "Update", summary: "s2", people: ["Sousan Khatibzadeh"], kpis: [2], scope: ["m2"], works: ["Breast Cancer Awareness (October)"], deliverables: [], evidence: [], next: [], questions: [], effort: "Under 1 hour", progress: [], prep: { needed: false, developer: "", project: "", area: "", event: "" } } ] }))).json();
  ok(multi.entries.length === 2 && multi.entries[1].people[0] === "Sousan Khatibzadeh" && multi.entry.title === "Huddle", "the model returns one entry per activity and the page gets the list", multi.entries.map((e) => e.title));
  ok(/SPLIT it: one entry per distinct activity/.test(lastSys), "the filing instructions say to split the day");
  const fb2 = await (await req("/momo/work/api", true, { action: "parse", text: day, date: "2026-10-13" })).json();
  ok(fb2.entries.length === 4 && fb2.entries.every((e) => e.check) && fb2.entries[2].people.includes("Vishant Singh"), "without the model the day is still split and each part filed by keyword", fb2.entries.map((e) => e.people));
  const js2 = await (await req("/momo/work.js", true)).text();
  ok(/ACTIVITY '\+\(QI\+1\)\+' OF '\+QUEUE\.length/.test(js2) && /Save and next/.test(js2), "the page walks her through the activities one at a time");
  try { new Function(js2); pass++; } catch (e) { fail++; console.log("FAIL the work page script does not parse after v570", e.message); } }
// v571 - time of day, alone, in/outside scope, outside parties looked up once and remembered after she confirms
{ const { TIMES } = await import("../src/work_log.js");
  ok(TIMES.length === 5 && /time_of_day: from the entry/.test(lastSys) && /external: companies, organisations or outside people NOT on the FN staff/.test(lastSys), "the filing instructions ask for time of day, alone, scope and outside parties");
  const fb3 = await (await req("/momo/work/api", true, { action: "parse", text: "In the morning I drafted the content calendar by myself. After lunch covered reception for an hour, not my job.", date: "2026-10-14" })).json();
  ok(fb3.entries.length === 2 && fb3.entries[0].time_of_day === "Morning" && fb3.entries[0].alone === true && fb3.entries[0].in_scope === true && fb3.entries[1].time_of_day === "Afternoon" && fb3.entries[1].in_scope === false, "keyword path reads morning/afternoon, alone, and outside scope", fb3.entries.map((e) => [e.time_of_day, e.alone, e.in_scope]));
  // an outside party: first time it is looked up (web search stubbed), she confirms, then it is known next time
  globalThis.fetch = async (u, init) => new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ found: true, name: "Al Jalila Foundation", kind: "charity", what: "Dubai healthcare charity.", where: "Dubai", site: "https://www.aljalilafoundation.ae", confidence: "high" }) }] }), { status: 200 });
  env.ANTHROPIC_API_KEY = "test";
  const model = () => ({ entries: [{ title: "Site visit", type: "Event", summary: "s", people: [], kpis: [5], scope: ["b4"], works: ["Breast Cancer Awareness (October)"], deliverables: [], evidence: [], next: [], questions: [], effort: "Half a day", progress: [], prep: { needed: false, developer: "", project: "", area: "", event: "" }, time_of_day: "Afternoon", alone: false, in_scope: true, external: [{ name: "Al Jalila", kind: "charity", person: "" }] }] });
  const e1 = (await (await req("/momo/work/api", true, { action: "parse", text: "Visited Al Jalila about the pink walk", date: "2026-10-14" }, model)).json()).entries[0];
  ok(e1.external[0].suggested === "Al Jalila Foundation" && e1.external[0].confirmed === false && /healthcare charity/.test(e1.external[0].what), "a new outside party is looked up and offered for her to confirm", e1.external[0]);
  const c = await (await req("/momo/work/api", true, { action: "party_confirm", name: "Al Jalila Foundation", typed: "Al Jalila", kind: "charity", what: "Dubai healthcare charity.", where: "Dubai", site: "https://www.aljalilafoundation.ae" })).json();
  ok(c.ok && store.has("work_naj_party_al-jalila-foundation") && c.party.aliases.includes("Al Jalila"), "confirming remembers the organisation with the name she typed as an alias");
  globalThis.fetch = async () => { throw new Error("no web search should run for a known party"); };
  const e2 = (await (await req("/momo/work/api", true, { action: "parse", text: "Follow-up call with Al Jalila", date: "2026-10-15" }, model)).json()).entries[0];
  ok(e2.external[0].known === true && e2.external[0].confirmed === true && e2.external[0].name === "Al Jalila Foundation", "next time the name is recognised without asking or searching", e2.external[0]);
  ok(![...store.keys()].some((k) => k.startsWith("work_naj_party_") && !k.includes("al-jalila")), "nothing else was remembered");
  const js3 = await (await req("/momo/work.js", true)).text();
  ok(/Is this the right one\?/.test(js3) && /Outside your role/.test(js3) && /sel\("sor"/.test(js3) && /\["Morning","Midday","Afternoon","Evening","Unspecified"\]/.test(JSON.stringify((await (await req("/momo/work/api?week=2026-10-14", true)).json()).times)) && /class=pdp/.test(js3) && /\$\("wreset"\)\.onclick/.test(js3) && /var ICON=/.test(js3) && /lab\("people","With"\)/.test(js3), "the page asks 'is this the right one', offers the five times of day, the outside-role picker, people by department, Start over, and icons on the labels");
  const page = await (await req("/momo/work", true)).text();
  ok(/id=wreset/.test(page) && /Start over/.test(page) && /id=wmic/.test(page), "the entry box has Start over and Speak");
  delete env.ANTHROPIC_API_KEY;
  const o1 = await (await req("/momo/work/api", true, { action: "parse", text: "Sat in the sales meeting as an agent and showed a unit to my client", date: "2026-10-14" })).json();
  ok(o1.entries.length === 1 && o1.entries[0].in_scope === false && o1.entries[0].out_role === "Sales agent", "work done as a sales agent is logged as outside her role, Sales agent", o1.entries[0]);
  const api0 = await (await req("/momo/work/api?week=2026-10-14", true)).json();
  ok(api0.out_roles.length === 7 && api0.out_roles[0][0] === "Sales agent" && /clause 5\.3/.test(api0.out_roles[0][1]) && api0.people_tree[0].dept === "Leadership" && api0.people_tree[0].people.includes("Ali Kalhor") && api0.people_tree[0].people.includes("Faez Noorzad") && api0.people_tree.some((g) => g.dept === "Sales" && g.people.includes("Sally Zehil")), "outside roles carry their contract line; the people tree puts Ali and Faez on top, then departments");
  try { new Function(js3); pass++; } catch (e) { fail++; console.log("FAIL the work page script does not parse after v571", e.message); }
  for (const k of [...store.keys()]) if (k.startsWith("work_naj_party_")) store.delete(k); }
// v572 - simpler check box: outside-role work needs no focus area or task; the rest folds under More
{ const js4 = await (await req("/momo/work.js", true)).text();
  ok(/No focus area or task applies\./.test(js4) && !/No task linked: pick one below/.test(js4), "outside-role work is not told to pick a task or focus area");
  ok(/<details class=more><summary>/.test(js4) && /More \(part of the role, how long, task progress, questions\)/.test(js4), "the less-used rows fold under one More toggle");
  const order = ["lab(\"title\",\"What\")", "sel(\"stod\"", "lab(\"people\",\"With\")", "lab(\"role\",\"Role\")", "<details class=more>"].map((s) => js4.indexOf(s));
  ok(order.every((i) => i >= 0) && order.every((v, i) => i === 0 || v > order[i - 1]), "the first card is What, When, With, Role, then More", order);
  try { new Function(js4); pass++; } catch (e) { fail++; console.log("FAIL the work page script does not parse after v572", e.message); } }
// v573 - dropdowns for single-choice fields; a one-page Debrief per entry
{ const js5 = await (await req("/momo/work.js", true)).text();
  ok(/sel\("st",D\.types/.test(js5) && /sel\("stod"/.test(js5) && /sel\("ssc"/.test(js5) && /sel\("sor"/.test(js5) && /sel\("sef"/.test(js5) && !/data-tod=/.test(js5) && !/\[data-sc\]/.test(js5), "type, time, role, which-role and how-long are dropdowns, no leftover pill handlers");
  ok(!/Who is responsible or helping/.test(js5) && /p\.owners=PREV\.people\.filter/.test(js5), "no second people list: the task's people are the With people");
  try { new Function(js5); pass++; } catch (e) { fail++; console.log("FAIL the work page script does not parse after v573", e.message); }
  const sv2 = await (await req("/momo/work/api", true, { action: "save", entry: { title: "Sales elevation workshop", type: "Meeting", summary: "Najjuko attended the sales elevation workshop as an agent.", people: ["Ruzanna Avanyan (Rose)"], kpis: [], scope: [], works: [], deliverables: [], evidence: [], next: ["Share the notes with Ali"], questions: [], time_of_day: "Morning", in_scope: false, out_role: "Sales agent", effort: "1-2 hours", progress: [] }, text: "t", date: "2026-10-14" })).json();
  const db = await req("/momo/work/debrief?id=" + sv2.entry.id + "&date=2026-10-14", true), dh = await db.text();
  ok(db.status === 200 && /<h1>DEBRIEF<\/h1>/.test(dh) && /Sales elevation workshop/.test(dh) && /Outside her role \(Sales agent\)/.test(dh) && /Share the notes with Ali/.test(dh) && /Wednesday 14 Oct 2026, morning/.test(dh) && /CONFIDENTIAL · FN Realty/.test(dh), "the debrief is one short page: what, when, who, role, next steps, FN footer");
  ok(!/Claude|Anthropic|GPT/i.test(dh), "the debrief never names an AI vendor");
  ok((await req("/momo/work/debrief?id=" + sv2.entry.id + "&date=2026-10-14", false)).status === 404, "only her link can open a debrief");
  await req("/momo/work/api", true, { action: "delete", id: sv2.entry.id, date: "2026-10-14" }); }
ok(/request\.method === "POST" && url\.pathname === "\/momo\/work\/api"/.test(ix), "v564.1: her saves and filings are answered before the POST guard");
console.log(`v564 momo work log: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

