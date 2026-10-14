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
ok(pr.entry.people.join() === "Ali Kalhor,Sally Zehil" && pr.entry.kpis.join() === "1" && pr.entry.scope.join() === "p4" && pr.entry.works.join() === "Monday Weekly Huddle", "filing keeps only known people, areas, parts and campaigns (nothing invented)", pr.entry);
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
ok(/request\.method === "POST" && url\.pathname === "\/momo\/work\/api"/.test(ix), "v564.1: her saves and filings are answered before the POST guard");
console.log(`v564 momo work log: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

