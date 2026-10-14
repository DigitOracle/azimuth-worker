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
ok(/<em>Weekly<\/em> Report/.test(rep) && /Monday Weekly Huddle/.test(rep) && /#2A3A68/.test(rep) && /viewBox="0 0 140 140"/.test(rep), "the weekly report (v577/v580: the 15-second page): FN title, the task, the donut, FN navy");
ok(!/Claude|Anthropic|OpenAI|GPT/i.test(rep.replace(/data:image\/[^"']+/g, "")), "the report never names an AI vendor (image data excluded: base64 is random letters)");
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
  ok(/<em>Daily<\/em> Report/.test(rep) && /<div class=tile><b>8<\/b>/.test(rep), "a one-day report is the FN daily report, with the hours tile"); }
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
  ok(/with Sally Zehil, Sousan Khatibzadeh/.test(rep), "the report's task row says who the task is with"); }
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
  ok(/ACTIVITY '\+\(QI\+1\)\+' OF '\+QUEUE\.length/.test(js2) && /function nextInQueue\(\)/.test(js2) && /Skip this one/.test(js2), "the page walks her through the activities one at a time (tick saves and moves on; Skip passes one)");
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
  ok(/Is this the right one\?/.test(js3) && /Outside my role/.test(js3) && /Whose job was it\?/.test(js3) && /\["Morning","Midday","Afternoon","Evening","Unspecified"\]/.test(JSON.stringify((await (await req("/momo/work/api?week=2026-10-14", true)).json()).times)) && /\$\("wreset"\)\.onclick/.test(js3) && /var ICON=/.test(js3) && /fieldRow\("people"/.test(js3) && /class=grp>'\+esc\(g\.dept\)/.test(js3), "the page asks 'is this the right one', offers the five times of day, the outside-role picker, people by department, Start over, and icons on the labels");
  const page = await (await req("/momo/work", true)).text();
  ok(/id=wreset/.test(page) && /Start over/.test(page) && /id=wmic/.test(page), "the entry box has Start over and Speak");
  delete env.ANTHROPIC_API_KEY;
  const o1 = await (await req("/momo/work/api", true, { action: "parse", text: "Sat in the sales meeting as an agent and showed a unit to my client", date: "2026-10-14" })).json();
  ok(o1.entries.length === 1 && o1.entries[0].in_scope === false && o1.entries[0].out_role === "Sales", "work done as a sales agent is logged as outside her role, Sales", o1.entries[0]);
  const api0 = await (await req("/momo/work/api?week=2026-10-14", true)).json();
  ok(api0.out_roles.length === 7 && api0.out_roles[0][0] === "Sales" && /clause 5\.3/.test(api0.out_roles[0][1]) && api0.people_tree[0].dept === "Leadership" && api0.people_tree[0].people.includes("Ali Kalhor") && api0.people_tree[0].people.includes("Faez Noorzad") && api0.people_tree.some((g) => g.dept === "Sales" && g.people.includes("Sally Zehil")), "outside roles carry their contract line; the people tree puts Ali and Faez on top, then departments");
  try { new Function(js3); pass++; } catch (e) { fail++; console.log("FAIL the work page script does not parse after v571", e.message); }
  for (const k of [...store.keys()]) if (k.startsWith("work_naj_party_")) store.delete(k); }
// v576 - the approved screen: role segments first; within -> grid of her five areas; outside -> one row, whose job; one row per field; a tick to save
{ const js4 = await (await req("/momo/work.js", true)).text();
  const order = ['id=sw', 'id=so', 'Which part of your role?', 'fieldRow("party",PREV.out_role||"Whose job was it?"', 'fieldRow("time"', 'fieldRow("people"', 'fieldRow("type"', '<details class=more>', 'class=tick id=pv'].map((s) => js4.indexOf(s));
  ok(order.every((i) => i >= 0) && order.every((v, i) => i === 0 || v > order[i - 1]), "order: role segments, which-part grid / whose-job row, when, with, type, More, tick", order);
  ok(/data-k='\+k\.id/.test(js4) && /class=grid/.test(js4), "within her role: a one-tap grid of the five areas");
  ok(/function sheet\(title,html,onopen\)/.test(js4) && /\$\("frt"\)\.onclick=function\(\)\{sheet\("When\?"/.test(js4) && /\$\("frp"\)\.onclick=function\(\)\{sheet\("Who was there\?"/.test(js4), "each row opens a bottom sheet");
  ok(!/sel\("ssc"/.test(js4) && !/sel\("stod"/.test(js4) && !/No task linked/.test(js4) && !/confirmLine\(e\)/.test(js4), "the old dropdowns and the old confirm box are gone");
  ok(/Tap which part of your role this counts towards, or mark it outside your role\./.test(js4) && /Tap whose job it was\./.test(js4), "save insists on the root choice being complete, nothing else");
  try { new Function(js4); pass++; } catch (e) { fail++; console.log("FAIL the work page script does not parse after v576", e.message); } }
// v573 - a one-page Debrief per entry (v576: single-choice fields moved from dropdowns to bottom sheets)
{ const js5 = await (await req("/momo/work.js", true)).text();
  ok(!/data-tod=/.test(js5) && !/\[data-sc\]/.test(js5) && !/\[data-f\]/.test(js5), "no leftover pill handlers");
  ok(!/Who is responsible or helping/.test(js5) && /p\.owners=PREV\.people\.filter/.test(js5), "no second people list: the task's people are the With people");
  try { new Function(js5); pass++; } catch (e) { fail++; console.log("FAIL the work page script does not parse after v573", e.message); }
  const sv2 = await (await req("/momo/work/api", true, { action: "save", entry: { title: "Sales elevation workshop", type: "Meeting", summary: "Najjuko attended the sales elevation workshop as an agent.", people: ["Ruzanna Avanyan (Rose)"], kpis: [], scope: [], works: [], deliverables: [], evidence: [], next: ["Share the notes with Ali"], questions: [], time_of_day: "Morning", in_scope: false, out_role: "Sales", effort: "1-2 hours", progress: [] }, text: "t", date: "2026-10-14" })).json();
  const db = await req("/momo/work/debrief?id=" + sv2.entry.id + "&date=2026-10-14", true), dh = await db.text();
  ok(db.status === 200 && /<h1>DEBRIEF<\/h1>/.test(dh) && /Sales elevation workshop/.test(dh) && /Outside her role \(Sales\)/.test(dh) && /Share the notes with Ali/.test(dh) && /Wednesday 14 Oct 2026, morning/.test(dh) && /CONFIDENTIAL · FN Realty/.test(dh), "the debrief is one short page: what, when, who, role, next steps, FN footer");
  ok(!/Claude|Anthropic|GPT/i.test(dh), "the debrief never names an AI vendor");
  ok((await req("/momo/work/debrief?id=" + sv2.entry.id + "&date=2026-10-14", false)).status === 404, "only her link can open a debrief");
  await req("/momo/work/api", true, { action: "delete", id: sv2.entry.id, date: "2026-10-14" }); }
// v574 - the mic's second tap stops for certain
{ const js6 = await (await req("/momo/work.js", true)).text();
  ok(/b\.onclick=function\(\)\{if\(on\)\{stop\(\)\}else\{start\(\)\}\}/.test(js6) && /function stop\(\)\{on=false;/.test(js6) && /x\.abort\(\)/.test(js6) && /setTimeout\(stop,45000\)/.test(js6), "tap toggles; stop sets on=false first and aborts; 45 s of silence stops");
  ok(/if\(on&&r===x\)/.test(js6), "the auto-restart only fires for the live recogniser, so a stopped one cannot come back");
  try { new Function(js6); pass++; } catch (e) { fail++; console.log("FAIL the work page script does not parse after v574", e.message); } }
// v575 - Role is the root; Sales is a department (v576: the screen itself is tested above)
{ const js7 = await (await req("/momo/work.js", true)).text();
  ok(/Which part of your role\?/.test(js7) && /Whose job was it\?/.test(js7), "row 2 asks which part of her role, or whose job it was");
  try { new Function(js7); pass++; } catch (e) { fail++; console.log("FAIL the work page script does not parse after v575", e.message); }
  const api2 = await (await req("/momo/work/api?week=2026-10-14", true)).json();
  ok(api2.out_roles[0][0] === "Sales" && /not in Schedule 1/.test(api2.out_roles[0][1]) && api2.out_roles.some((r) => r[0] === "Marketing (hands-on)") && !api2.out_roles.some((r) => r[0] === "Sales agent"), "outside roles are departments; Sales carries its contract line");
  const hd = await (await req("/momo/work/api", true, { action: "parse", text: "Built the Monday huddle deck because the sales director asked me to, ran it with the sales team", date: "2026-10-13" })).json();
  ok(hd.entries[0].in_scope === false && hd.entries[0].out_role === "Sales", "a huddle deck the sales director asked for is outside her role, Sales", hd.entries[0]);
  const al = await (await req("/momo/work/api", true, { action: "parse", text: "x", date: "2026-10-13" }, () => ({ entries: [{ title: "t", type: "Meeting", summary: "s", people: [], kpis: [], scope: [], works: [], deliverables: [], evidence: [], next: [], questions: [], effort: "1-2 hours", progress: [], prep: { needed: false, developer: "", project: "", area: "", event: "" }, time_of_day: "Morning", alone: true, in_scope: false, out_role: "Sales agent", external: [] }] }))).json();
  ok(al.entries[0].out_role === "Sales", "the old 'Sales agent' label still maps to Sales"); }
// v576 - light theme on Work; the outside-role tally by department on the week view
{ ok(/function momoPage\(key, rk, body\)[\s\S]{0,400}background:#FAF7F1;color:#1C2321/.test(ix), "Momo Work is light (cream page, ink text)");
  ok(/function momoHtml\(key, rk, work\)[\s\S]{0,1600}background:#0C1413;color:#E8E4D8/.test(ix), "the Work-or-Play door and Play stay dark");
  await req("/momo/work/api", true, { action: "save", entry: { title: "a", type: "Meeting", summary: "s", people: [], kpis: [], scope: [], works: [], deliverables: [], evidence: [], next: [], questions: [], in_scope: false, out_role: "Sales", effort: "1-2 hours", progress: [], time_of_day: "Morning" }, text: "t", date: "2026-10-13" });
  await req("/momo/work/api", true, { action: "save", entry: { title: "b", type: "Update", summary: "s", people: [], kpis: [], scope: [], works: [], deliverables: [], evidence: [], next: [], questions: [], in_scope: false, out_role: "HR, Admin & Compliance", effort: "1-2 hours", progress: [], time_of_day: "Morning" }, text: "t", date: "2026-10-14" });
  await req("/momo/work/api", true, { action: "save", entry: { title: "c", type: "Update", summary: "s", people: [], kpis: [2], scope: [], works: [], deliverables: [], evidence: [], next: [], questions: [], in_scope: true, out_role: "", effort: "1-2 hours", progress: [], time_of_day: "Morning" }, text: "t", date: "2026-10-14" });
  const wk2 = await (await req("/momo/work/api?week=2026-10-14", true)).json();
  ok(wk2.outside && wk2.outside.week === 2 && wk2.outside.term === 2 && wk2.outside.by[0].n === 1 && wk2.outside.by.map((x) => x.dept).sort().join() === "HR, Admin & Compliance,Sales", "outside-role work is counted on its own, by whose job it was", wk2.outside);
  const js8 = await (await req("/momo/work.js", true)).text();
  ok(/Outside your role this week: '\+D\.outside\.week/.test(js8) && /kept for your review/.test(js8), "the week view shows the running outside-role line");
  for (const k of [...store.keys()]) if (k.startsWith("work_naj_")) store.delete(k); }
// v577 - Log / Report tabs; the 15-second report: headline tiles, donut, per-day bars, week-at-a-glance grid, tasks, outside-role line; picked days
{ const page = await (await req("/momo/work", true)).text();
  ok(/id=tlog class=on>What did you do\?<\/button><button type=button id=trep>Report</.test(page) && /data-rp=today/.test(page) && /data-rp=week/.test(page) && /data-rp=pick/.test(page) && /id=rgo/.test(page), "the first screen is two tabs; Report offers Today, This week, Pick days and one Make report button");
  const js9 = await (await req("/momo/work.js", true)).text();
  ok(/\$\("tlog"\)\.onclick/.test(js9) && /&days="\+sel\.join\(","\)/.test(js9) && /data-rd=/.test(js9), "the tab switch and the picked-days link are wired");
  try { new Function(js9); pass++; } catch (e) { fail++; console.log("FAIL the work page script does not parse after v577", e.message); }
  const E = (date, title, kp, out, eff, people) => req("/momo/work/api", true, { action: "save", entry: { title, type: "Meeting", summary: "s", people: people || [], kpis: kp ? [kp] : [], scope: [], works: ["Monday Weekly Huddle"], deliverables: [], evidence: [], next: [], questions: [], in_scope: !out, out_role: out || "", effort: eff || "1-2 hours", progress: [{ work: "Monday Weekly Huddle", status: "In progress", percent: 60, owners: [] }], time_of_day: "Morning" }, text: "t", date });
  await E("2026-10-12", "Huddle", 1, "", "Half a day", ["Ali Kalhor"]); await E("2026-10-13", "Workshop", 0, "Sales", "1-2 hours", ["Ruzanna Avanyan (Rose)"]); await E("2026-10-13", "Pink post", 2, "", "Under 1 hour", ["Sousan Khatibzadeh"]);
  const wkr = await (await req("/momo/work/report?days=2026-10-12,2026-10-13,2026-10-14", true)).text();
  ok(/<em>Activity<\/em> Report/.test(wkr) && /Mon, Tue, Wed/.test(wkr), "picked days: Mon, Tue, Wed named in the header");
  ok(/<div class=tile><b>3<\/b><span>activities/.test(wkr) && /<b>3<\/b><span>people met/.test(wkr), "headline tiles: 3 activities, 3 people met");
  ok(/<svg viewBox="0 0 140 140"/.test(wkr) && /stroke="#D9782E"/.test(wkr) && /stroke="#6FBFB4"/.test(wkr), "a donut with the validated emphasis colours (outside-role warm, area ramp)");
  ok(/aria-label="Activities per day"/.test(wkr) && /WEEK AT A GLANCE/.test(wkr) && /<table class=glance>/.test(wkr) && /<b>Mon<\/b> 12/.test(wkr) && /<b>Wed<\/b> 14/.test(wkr) && /<span class=og>1<\/span>/.test(wkr), "per-day bars and the Mon-Wed day-at-a-glance grid, with the outside-role day flagged");
  ok(/Going beyond the role: 1 activity<\/b> · as a broker 1/.test(wkr), "the beyond-the-role line names where the help went, softly");
  ok(/<h2>TASKS<\/h2>/.test(wkr) && /Monday Weekly Huddle/.test(wkr) && /60%/.test(wkr), "tasks moved, with progress bars");
  ok(!/CONFIDENTIAL/.test(wkr) && !/Outside her role/.test(wkr) && /Going beyond the role: 1 activity/.test(wkr) && /as a broker 1/.test(wkr) && /Supporting the wider team/.test(wkr), "v579: no confidentiality footer; soft language (going beyond the role, as a broker, supporting the wider team)");
  ok(/@top-left\{content:none\}/.test(wkr) && /@bottom-center\{content:none\}/.test(wkr) && /document\.title="FN Activity report 12 Oct 2026 to 14 Oct 2026"/.test(wkr) && !/navigator\.share\(\{title:document\.title,url/.test(wkr) && !/Claude|Anthropic|GPT/i.test(wkr.replace(/data:image\/[^"']+/g, "")), "v579: the print header/footer (the Azimuth link) is suppressed, the file is titled FN ... report, the link is never shared, no AI vendor named");
  ok(/<div class=fnmark><img src="data:image\/png;base64,/.test(wkr) && /<h1><em>Activity<\/em> Report<\/h1>/.test(wkr) && /<div class=latt><\/div>/.test(wkr) && /border:1px solid #C9A97A;border-radius:2px/.test(wkr) && /color:#2A3A68/.test(wkr) && !/background:#1F2B44;color:#C9A97A;margin:-24px/.test(wkr), "v580: FN's own monogram and lattice from the Company Template, inside-page frame (white, gold hairline, navy Anton title with peach lead word), no navy header bar");
  const dr = await (await req("/momo/work/report?days=2026-10-13", true)).text();
  ok(/<em>Daily<\/em> Report/.test(dr) && /Tuesday 13 Oct 2026/.test(dr) && !/WEEK AT A GLANCE/.test(dr) && /<b>2<\/b><span>activities/.test(dr), "a single day is the FN daily report: no week grid, 2 activities");
  for (const k of [...store.keys()]) if (k.startsWith("work_naj_")) store.delete(k); }
// v578 - clocked hours, where, the 15 h meter, two hours-donuts (kind of work; where)
{ const { spanOf, clockedHours, hoursOf, hoursPicture, kindOf, WHERE } = await import("../src/work_log.js");
  ok(spanOf("woke at four, from 4 till 6 I was responding to my leads").start === "04:00" && spanOf("from 4 till 6 I was responding to my leads in the morning").end === "06:00", "'from 4 till 6' in the morning = 04:00-06:00");
  ok(spanOf("open house at Imtiaz 10 to 3").start === "10:00" && spanOf("open house at Imtiaz 10 to 3").end === "15:00", "'10 to 3' at an open house = 10:00-15:00");
  ok(spanOf("sales workshop 8 until 9:30").start === "08:00" && spanOf("sales workshop 8 until 9:30").end === "09:30", "'8 until 9:30' = 08:00-09:30");
  ok(spanOf("calls between 2 and 4pm").start === "14:00" && spanOf("calls between 2 and 4pm").end === "16:00", "'between 2 and 4pm' = 14:00-16:00");
  ok(spanOf("after lunch for an hour").start === "", "no clock in the words = no clock invented");
  ok(clockedHours({ start: "04:00", end: "06:00" }) === 2 && clockedHours({ start: "08:00", end: "09:30" }) === 1.5 && clockedHours({ start: "", end: "" }) === null, "clocked hours from start and end");
  ok(hoursOf({ start: "10:00", end: "15:00", effort: "Under 1 hour" }) === 5 && hoursOf({ effort: "Half a day" }) === 4, "the clock wins over the effort bucket; the bucket is the fallback");
  const fb = await (await req("/momo/work/api", true, { action: "parse", text: "Woke at four, from 4 till 6 I was responding to my leads from home as an agent", date: "2026-10-14" })).json();
  ok(fb.entries[0].start === "04:00" && fb.entries[0].end === "06:00" && fb.entries[0].where === "Home" && fb.entries[0].in_scope === false && fb.entries[0].out_role === "Sales" && kindOf(fb.entries[0]) === "Broker", "keyword path: 4-6 at home as an agent = Broker, 2 h, Home", fb.entries[0]);
  const fo = await (await req("/momo/work/api", true, { action: "parse", text: "Open house at Imtiaz 10 to 3 with my client", date: "2026-10-18" })).json();
  ok(fo.entries[0].where === "On site" && fo.entries[0].start === "10:00" && fo.entries[0].end === "15:00", "open house at Imtiaz = On site, 10:00-15:00", fo.entries[0]);
  ok(/start and end: 24-hour HH:MM/.test(lastSys) && /where: Office \(FN's office, Prime Tower\)/.test(lastSys) && WHERE.length === 5, "the filing instructions teach start/end and where");
  const hp = hoursPicture([{ start: "04:00", end: "06:00", in_scope: false, out_role: "Sales", where: "Home" }, { start: "09:00", end: "13:00", in_scope: true, where: "Office" }, { effort: "Under 1 hour", in_scope: false, out_role: "HR, Admin & Compliance", where: "Office" }]);
  ok(hp.total === 6.5 && hp.clocked === 6 && hp.estimated === 0.5 && hp.min === 15 && hp.kinds[0].hours === 4 && hp.kinds[1].hours === 2 && hp.kinds[2].hours === 0.5 && hp.places.find((p) => p.name === "Office").hours === 4.5, "the hours picture: total, clocked vs estimated, the 15 h minimum, kind and place splits", hp);
  const E = (date, title, kp, out, start, end, where) => req("/momo/work/api", true, { action: "save", entry: { title, type: "Meeting", summary: "s", people: [], kpis: kp ? [kp] : [], scope: [], works: [], deliverables: [], evidence: [], next: [], questions: [], in_scope: !out, out_role: out || "", effort: "1-2 hours", progress: [], time_of_day: "Morning", start, end, where }, text: "t", date });
  await E("2026-10-13", "Leads", 0, "Sales", "04:00", "06:00", "Home"); await E("2026-10-13", "Strategy", 1, "", "09:00", "13:00", "Office"); await E("2026-10-14", "Pink post", 2, "", "14:00", "16:00", "Office");
  const wk3 = await (await req("/momo/work/api?week=2026-10-14", true)).json();
  ok(wk3.hoursweek.total === 8 && wk3.hoursweek.clocked === 8 && wk3.hoursweek.kinds[0].hours === 6 && wk3.hoursweek.kinds[1].hours === 2, "the week carries the hours picture", wk3.hoursweek);
  const js10 = await (await req("/momo/work.js", true)).text();
  ok(/\+D\.hoursweek\.min\+' h this week<\/b>/.test(js10) && /Clock it \(the hours that count\)/.test(js10) && /type=time id=pst/.test(js10) && /sheet\("Where were you\?"/.test(js10), "the week view has the 15 h meter; the When sheet clocks start and end; a Where sheet");
  try { new Function(js10); pass++; } catch (e) { fail++; console.log("FAIL the work page script does not parse after v578", e.message); }
  const rp = await (await req("/momo/work/report?days=2026-10-13,2026-10-14", true)).text();
  ok(/WHERE THE HOURS WENT/.test(rp) && /As Strategic Lead<b>6 h<\/b>/.test(rp) && /As a broker<b>2 h<\/b>/.test(rp) && /Office<b>6 h<\/b>/.test(rp) && /Home<b>2 h<\/b>/.test(rp) && /8 \/ 15 h/.test(rp) && /7 h short of the 15 h minimum/.test(rp) && /hours clocked/.test(rp) && /04:00–06:00/.test(rp), "the report: two hours-donuts (kind, where; soft names), the 15 h meter, clocked spans in the grid", rp.match(/WHERE THE HOURS WENT[\s\S]{0,600}/)?.[0]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
  for (const k of [...store.keys()]) if (k.startsWith("work_naj_")) store.delete(k); }
// v581 - month at a glance: Month on the Report tab; the monthly report reads week by week with the 15 h line judged per full week
{ const page = await (await req("/momo/work", true)).text();
  ok(/data-rp=month[^>]*>Month</.test(page), "the Report tab offers Month");
  const js11 = await (await req("/momo/work.js", true)).text();
  ok(/function mo\(\)/.test(js11) && /mode==="month"\?mo\(\)/.test(js11) && /to date, "\+sel\.length\+" days/.test(js11), "Month = the calendar month to date");
  try { new Function(js11); pass++; } catch (e) { fail++; console.log("FAIL the work page script does not parse after v581", e.message); }
  const E = (date, kp, out, start, end) => req("/momo/work/api", true, { action: "save", entry: { title: "x", type: "Meeting", summary: "s", people: [], kpis: kp ? [kp] : [], scope: [], works: [], deliverables: [], evidence: [], next: [], questions: [], in_scope: !out, out_role: out || "", effort: "1-2 hours", progress: [], time_of_day: "Morning", start, end, where: "Office" }, text: "t", date });
  await E("2026-10-05", 1, "", "09:00", "17:00"); await E("2026-10-07", 1, "", "09:00", "17:00"); await E("2026-10-13", 0, "Sales", "04:00", "06:00"); await E("2026-10-14", 2, "", "09:00", "12:00");
  const days = []; for (let i = 1; i <= 14; i++) days.push("2026-10-" + String(i).padStart(2, "0"));
  const mr = await (await req("/momo/work/report?days=" + days.join(","), true)).text();
  ok(/<em>Monthly<\/em> Report/.test(mr) && /October 2026 · to 14 Oct 2026/.test(mr) && /MONTH AT A GLANCE/.test(mr) && !/WEEK AT A GLANCE/.test(mr), "14 days of October is the monthly report with the month grid");
  ok(/<th>Week<\/th>/.test(mr) && /<th>Of 15 h<\/th>/.test(mr) && /<th>As a broker<\/th>/.test(mr) && /font-weight:600">met<\/span>/.test(mr) && /part week<\/td>/.test(mr), "one row per week: the week of 5 Oct met 15 h (16 h); 12-14 Oct is a part week, not judged", mr.match(/<table class=glance>[\s\S]{0,900}/)?.[0]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
  ok(/1 of 1 full weeks<\/b><span>at or above the 15 h weekly minimum/.test(mr) && /document\.title="FN Monthly report October 2026"/.test(mr), "the monthly meter counts only full weeks (one so far, met); the PDF is titled FN Monthly report October 2026");
  for (const k of [...store.keys()]) if (k.startsWith("work_naj_")) store.delete(k); }
ok(/request\.method === "POST" && url\.pathname === "\/momo\/work\/api"/.test(ix), "v564.1: her saves and filings are answered before the POST guard");
console.log(`v564 momo work log: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

