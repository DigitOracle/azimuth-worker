// v780: a finished recording gets notes -> minutes -> a work-log Meeting entry automatically, one model stage per tick
import { recAutoFile } from "../src/work_log.js";
let fail = 0; const ok = (c, m, x) => { if (!c) { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("ok", m); };
const now = Date.parse("2026-11-05T10:40:00Z"), store = {};
store["recw_20261105bgpbid1n"] = JSON.stringify({ id: "20261105bgpbid1n", date: "2026-11-05", title: "", started_hm: "13:01", started: "2026-11-05T09:01:38Z", status: "transcribed", secs: 600, expect_parts: 4, expect_override: 2, stopped_at: "2026-11-05T09:20:51Z", ended_hm: "13:11", attendees: [{ n: "Vishant Singh", r: "Head Editor" }], log: [] });
const t0 = "Friday the sixth we are doing mortgage and Ellington. Sunday we do Diwali. Monday market update from Monaza in the morning. ".repeat(6);
store["recs_20261105bgpbid1n_000"] = JSON.stringify({ n: 0, secs: 300, text: t0, utts: [{ s: "P0-S0", t: t0 }] });
store["recs_20261105bgpbid1n_001"] = JSON.stringify({ n: 1, secs: 300, text: t0, utts: [{ s: "P0-S1", t: t0 }] });
const env = { MEETINGS: { get: async (k) => store[k] ?? null, put: async (k, v) => { store[k] = v; }, delete: async (k) => { delete store[k]; },
  list: async ({ prefix }) => ({ keys: Object.keys(store).filter((k) => k.startsWith(prefix || "")).map((name) => ({ name })), list_complete: true }) } };
let calls = 0;
const claudeJSON = async (e, sys, prompt, schema) => { calls++;
  const p = JSON.stringify(schema || {});
  if (/entries/.test(p)) return { entries: [{ title: "Content plan with Vishant", type: "Meeting", summary: "Agreed the posting plan from Fri 6 Nov.", kpis: [], people: ["Vishant Singh"], works: [], progress: [], deliverables: [], external: [], in_scope: true, time_of_day: "Afternoon" }] };
  return { summary: "Posting plan agreed.", topics: ["posting plan"], decisions: ["Diwali on Sunday"], actions: [{ what: "Market update Monday morning", owner: "Monaza", due: "Mon" }], questions: [], attendees: [], discussion: [{ topic: "plan", points: ["Friday mortgage and Ellington"] }], decisions_made: [], action_items: [], open_questions: [], next_steps: [] }; };
const deps = { claudeJSON, model: "x" };
let steps = [];
for (let i = 0; i < 8; i++) { const r = await recAutoFile(env, deps, now + i * 60000); steps.push(r.map((x) => x.step + ":" + (x.state || x.entries || x.error || "")).join(",")); if (r.some((x) => x.step === "filed")) break; }
console.log(steps);
const m = JSON.parse(store["recw_20261105bgpbid1n"]);
const entries = Object.keys(store).filter((k) => k.startsWith("work_naj_2026-11-05_"));
ok(m.status === "filed" && !!m.auto_filed, "recording filed automatically", m.status);
ok(entries.length >= 1, "a work-log entry exists for the day", entries);
const e = entries.length ? JSON.parse(store[entries[0]]) : {};
ok(e.type === "Meeting" && Array.isArray(e.deliverables) && e.rec === "20261105bgpbid1n", "the entry is a Meeting, full shape, linked to the recording", e);
const again = await recAutoFile(env, deps, now + 3600e3);
ok(!again.length, "never filed twice");
process.exit(fail ? 1 : 0);
