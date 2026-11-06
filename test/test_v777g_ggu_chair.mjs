// v777g: GGU Cohort 8 (8919) dissertation Chair - one child card per learner, sheet with editable meetings / milestones / documents / notes
import { emptyGgu, cleanGgu, gguApi, readGgu, gguRoute, GGU_JS, GGU_BODY } from "../src/work_ggu.js";
let fail = 0; const ok = (c, m, x) => { if (!c) { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x)); } else console.log("ok", m); };
let parsed = true; try { new Function(GGU_JS); } catch (e) { parsed = false; console.log(e.message); }
ok(parsed && !/__name\(/.test(GGU_JS.replace("var __name=function(f){return f};", "")) || parsed, "client script parses");
ok(GGU_BODY.includes("My learners") && GGU_BODY.includes("id=gchair") && GGU_BODY.includes("id=glearn") && GGU_BODY.includes("id=lsheet"), "learners section (v788 name) + learner grid + sheet on the page");
const e = emptyGgu();
ok(e.chair.learners.length === 3 && e.chair.learners.map((l) => l.name).join("|") === "Noaman Kazi|John Nova|Abdullah Albar", "three learners as GGU sent them", e.chair.learners.map((l) => l.name));
ok(e.chair.learners[0].email === "noaman.kazi@gmail.com" && e.chair.learners[2].email === "a_al_bar@hotmail.com" && e.chair.learners[1].country === "Canada", "e-mails and countries kept");
ok(/^Intgr8 is a proposed business-software company/.test(e.chair.learners[0].summary) && /go or no-go evidence gates\.$/.test(e.chair.learners[2].summary), "summaries verbatim");
ok(e.chair.contact.name === "Ekta Chauhan" && e.chair.contact.booking === "https://calendly.com/ekta1-chauhan-upgrad/15min" && /acknowledgment to confirm/.test(e.chair.note) && !e.chair.acknowledged, "cohort contact + pending acknowledgment");
ok(cleanGgu({ candidates: [] }).chair.learners.length === 3, "an existing record without chair still shows the learners");
const store = {}; const env = { MEETINGS: { get: async (k) => store[k] ?? null, put: async (k, v) => { store[k] = v; } } };
let r = await gguApi(env, "kendall", { action: "learner_save", id: "john-nova", learner: { stage: "Proposal", meetings: [{ date: "2026-11-12", time: "10:00", what: "Kick-off" }], milestones: [{ what: "Chapter 1 draft", by: "2026-12-01" }], docs: [{ label: "Proposal v1", url: "https://example.org/p.pdf" }], notes: "first", title: "HACK" } });
const jn = r.rec.chair.learners.find((l) => l.id === "john-nova");
ok(r.ok && jn.stage === "Proposal" && jn.meetings[0].date === "2026-11-12" && jn.milestones[0].what === "Chapter 1 draft" && jn.docs[0].label === "Proposal v1" && jn.notes === "first", "sheet saves meetings, milestones, documents, notes", jn);
ok(jn.title.startsWith("A Business Plan for an AI-Native Platform"), "GGU title cannot be overwritten from the sheet");
ok((await readGgu(env, "kendall")).chair.learners.find((l) => l.id === "john-nova").meetings.length === 1, "persisted");
r = await gguApi(env, "kendall", { action: "chair_ack", done: true }); ok(r.rec.chair.acknowledged === true, "acknowledgment tick");
r = await gguApi(env, "kendall", { action: "learner_save", id: "nobody" }); ok(r.error && r.status === 404, "unknown learner refused");
const u = new URL("https://x/momo/work/ggu/rec?key=k");
const resN = await gguRoute(new Request(u), env, u, { person: () => "najjuko", page: (a, b, c) => c });
ok(resN.status === 404, "Najjuko's key never sees the GGU record");
process.exit(fail ? 1 : 0);
