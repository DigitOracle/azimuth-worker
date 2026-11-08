// v814: "Who's who?" - she names each speaker from her organogram; the transcript, summary, minutes and draft tasks then use the names.
// Made-up lines and a stand-in roster person ("Liam Carter"); no real transcript.
import assert from "node:assert/strict";
import { workRoute, recEnsureForms, BRIDGE_LOG as L } from "../src/work_log.js";
import { suggest, samples, whoWhoHtml } from "../src/whos_who.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
function kv() { const m = new Map(); return { m, get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => m.delete(k), list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix || "")).sort().map((name) => ({ name })), list_complete: true }) }; }
const store = kv(), env = { MEETINGS: store };
const today = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10), id = today.replace(/-/g, "") + "whoaa";
await store.put("work_naj_people", JSON.stringify({ people: [{ name: "Liam Carter", role: "Videographer", status: "Current" }] }));
const seg = { n: 0, secs: 120, text: "", utts: [{ t: 0, s: 0, x: "Good morning everyone, thanks for coming in today." }, { t: 5, s: 0, x: "Thanks, Liam, over to you for the shoot plan." }, { t: 9, s: 1, x: "Sure, the video for the launch is ready for Monday morning." }, { t: 20, s: 1, x: "I need one more day for the drone shots over the site." }] };
await store.put("recs_" + id + "_000", JSON.stringify(seg));
const m0 = { id, date: today, title: "Shoot planning", status: "filed", secs: 120, speakers: { groups: [{ id: "A", labels: ["P0-S0"], name: "", confirmed: false }, { id: "B", labels: ["P0-S1"], name: "", confirmed: false }] },
  minutes: { title: "Shoot", purpose: "p", decisions: [], discussion: [{ heading: "Shoot", bullets: ["Speaker B asked for one more day"] }], actions: [{ action: "Send the drone shots", owner: "Speaker B", due: "", due_stated: false }], open_questions: [] },
  summary_full: { paragraphs: ["Speaker B asked for one more day for the drone shots."], bullets: ["a team member (check name) owns the shoot"], topics: [], decisions: [], figures: [], open_questions: [], unclear: [], actions: [], hr: false },
  draft_tasks: [{ id: "d1", text: "Send the drone shots", owner: "", owner_said: "Speaker B", start: "", due: "", owner_needed: true, needs_dates: true, state: "draft" }] };
await store.put("recw_" + id, JSON.stringify(m0));
const roster = ["Ali Kalhor", "Liam Carter", "Faez Noorzad"];

// the card: samples, a suggestion that is never applied by itself
const sm = samples(m0, [seg], 3);
ok(sm.A.length === 2 && sm.B.length === 2, "2-3 sample lines per speaker");
ok(suggest(m0, [seg], roster).B === "Liam Carter", "suggests Liam for the speaker who answers 'Thanks, Liam'");
const card = whoWhoHtml(m0, [seg], roster, {}, "K");
ok(card.includes("Who's who?") && card.includes("Sounds like Liam Carter?") && card.includes("Me (Najjuko)") && card.includes("Guest: type name") && card.includes("Not sure"), "the picker: organogram, Me, Guest, Not sure; a suggestion with Use this");
ok(!JSON.parse(store.m.get("recw_" + id)).speakers.groups.some((g) => g.name), "the suggestion is not applied by itself");
const deps = { isNaj: () => true, isAny: () => true, person: () => "najjuko", page: (k, r, b) => "<html><body>" + b + "</body></html>" };
const get = async (path) => { const u = new URL("https://x" + path + "&key=K"); return (await workRoute(new Request(u), env, u, deps)).text(); };
const post = async (body) => { const u = new URL("https://x/momo/work/rec/api?key=K"); return (await workRoute(new Request(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), env, u, deps)).json(); };
let page = await get("/momo/work/rec/view?id=" + id);
ok(page.includes("id=whowho") && page.includes("Speaker A") && page.includes("Speaker B"), "the meeting page shows the Who's who? card");

// Save: names on the speakers, transcript shows them, Speaker X replaced, owners on drafts, regeneration queued, hint stored
const j = await post({ action: "who", id, map: { A: { kind: "me", name: "" }, B: { kind: "person", name: "Liam Carter" } } });
const m1 = JSON.parse(store.m.get("recw_" + id));
ok(j.ok && m1.speaker_map.B.name === "Liam Carter" && m1.speakers.groups.find((g) => g.id === "B").name === "Liam Carter" && m1.speakers.groups.find((g) => g.id === "A").name === "Najjuko", "speaker_map stored; speakers named");
ok(L.recTranscriptText([seg], true, m1).includes("Liam Carter: Sure, the video"), "the transcript shows real names");
ok(m1.summary_full.paragraphs[0].startsWith("Liam Carter asked") && m1.minutes.discussion[0].bullets[0].startsWith("Liam Carter asked"), "Speaker B becomes Liam in the summary and the minutes at once");
ok(m1.draft_tasks[0].owner === "Liam Carter" && !m1.draft_tasks[0].owner_needed, "the draft task gets its owner");
ok(m1.regen_names === true && JSON.parse(store.m.get("rec_speaker_hints"))["Liam Carter"] === 1, "summary and minutes queued again; a name hint stored for later meetings");
// the sweep writes them again with the names (stub model)
const stub = { claudeJSON: async (e, sys, user, schema) => { const p = (schema && schema.properties) || {};
  if (p.paragraphs) return { paragraphs: [/Liam Carter/.test(user) ? "Liam Carter owns the shoot." : "?"], bullets: [], topics: [], decisions: [], figures: [], open_questions: [], unclear: [], hr: false, actions: [{ action: "Send the drone shots to Ali", owner: "Liam Carter", due: "" }] };
  if (p.discussion || (p.decisions && p.purpose)) return { title: "Shoot", purpose: "p", decisions: [], discussion: [{ heading: "Shoot", bullets: [/Liam Carter/.test(user) ? "Liam Carter asked for a day" : "?"] }], actions: [{ action: "Send the drone shots to Ali", owner: "Liam Carter", due: "", due_stated: false }], open_questions: [] };
  if (p.summary) return { summary: "Notes.", topics: [], decisions: [], actions: [], people: [] }; return {}; }, model: "stub" };
for (let i = 0; i < 6; i++) { const r = await recEnsureForms(env, stub, Date.now()); if (process.env.DBG) console.error(JSON.stringify(r)); }
const m2 = JSON.parse(store.m.get("recw_" + id));
ok(!m2.regen_names && m2.summary_full.paragraphs[0] === "Liam Carter owns the shoot." && m2.minutes.discussion[0].bullets[0] === "Liam Carter asked for a day", "the summary and minutes are written again from the named transcript");
if (process.env.DBG) console.error("DT", JSON.stringify(m2.draft_tasks), JSON.stringify(m2.minutes.actions));
ok(m2.draft_tasks.some((d) => d.owner === "Liam Carter"), "the drafts from the new minutes carry the owner");
page = await get("/momo/work/rec/view?id=" + id);
ok(page.includes("Everyone is named. You can change it."), "she can reopen and edit who's who later");
ok((await post({ action: "who", id: id, map: { B: { kind: "unsure", name: "" } } })).ok && !JSON.parse(store.m.get("recw_" + id)).speakers.groups.find((g) => g.id === "B").name, "Not sure clears a name");
console.log("test_v814_whos_who: " + n + " checks passed");
