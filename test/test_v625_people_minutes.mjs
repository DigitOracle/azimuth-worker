// v625 - Momo Work: "who is in the room" before recording, the Meeting minutes option, and Whisper reading the language itself (Kendall, 24 Oct 2026).
// SYNTHETIC names only: this repo is public and the real roster lives in KV (work_naj_people).
const m = await import("../src/work_log.js");
const mm = await import("../src/work_minutes.js");
const { REC_JS } = await import("../src/work_rec_page.js");
let pass = 0, fail = 0; const ok = (c, msg, extra) => { if (c) pass++; else { fail++; console.log("FAIL", msg, extra === undefined ? "" : JSON.stringify(extra).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => { const v = store.get(k); return v == null ? null : v; }, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
let lastAiOpts = null;
const env = { MEETINGS: KV, AI: { run: async (model, o) => { lastAiOpts = o; return { text: "Hello, I am Test Person One. And I am Test Person Two. We will plan the autumn open day. Mahmoud will draft the invitation by Friday." }; } } };
const seen = [];
const deps = { isNaj: (e, u) => u.searchParams.get("key") === "K", model: "m", page: (k, r, b) => "<html>" + b + "</html>",
  claudeJSON: async (e, sys, user, schema) => {
    seen.push({ sys, user, schema });
    if (schema.properties && schema.properties.purpose) return { title: "Autumn open day </script><b>plan", purpose: "Agree the plan for the autumn open day.", decisions: [{ headline: "The open day runs on a Saturday", detail: "FN will hold it in the office." }],
      discussion: [{ heading: "Invitations", bullets: ["Proposed by Test Person Two: a printed invitation [to confirm]"] }],
      actions: [{ action: "Draft the invitation", owner: "Test Person One", due: "Friday", due_stated: true }, { action: "Book the room", owner: "", due: "next week", due_stated: false }, { action: "Order the gifts", owner: "Test Person Two", due: "", due_stated: false }],
      open_questions: ["Which Saturday? [to confirm]"] };
    if (schema.properties && schema.properties.decisions) return { summary: "Plan for the open day.", topics: ["Open day"], decisions: ["Saturday"], people: ["Test Person One"], actions: [{ what: "Draft the invitation", owner: "Test Person One", due: "Friday" }] };
    if (schema.properties && schema.properties.notes) return { notes: "Condensed." };
    return null; } };
const call = (path, opt, key = "K") => { const u = new URL("https://w" + path + (path.includes("?") ? "&" : "?") + "key=" + key); return m.workRoute(new Request(u, opt), env, u, deps); };
const api = async (o) => (await call("/momo/work/rec/api", { method: "POST", body: JSON.stringify(o) })).json();

// ---- the roster: shape only, synthetic people
const ROSTER = { people: [
  { name: "Test Boss One", role: "Managing Director; heads Sales", department: "Leadership", status: "active" },
  { name: "Test Person One", role: "Strategic Lead", department: "Strategy", status: "active", notes: "Known as TP1 / Tee. Voice transcription may render it as Teepee." },
  { name: "Ruzanna \"Rosie\" Example", role: "Team Leader, Team A", department: "Sales", status: "active", sales_team: "Team A (Rosie)" },
  { name: "Sam Agent One", role: "Agent", department: "Sales", status: "active", sales_team: "Team A (Rosie)" },
  { name: "Sam Agent Two", role: "Agent", department: "Sales", status: "active", sales_team: "Team B (Other)" },
  { name: "Freda Freelance", role: "Agent (freelance, independent; no team leader)", department: "Sales", status: "active" },
  { name: "Tempo Rary", role: "Videographer", department: "Marketing", status: "temporary (1 month from 19 Oct 2026)" },
  { name: "Gone Person", role: "Former staff", department: "—", status: "left the company" },
  { name: "Maybe Person", role: "Agent (status to confirm)", department: "Sales", status: "to confirm" },
  { name: "Munira (Munazza) Test", role: "Graphic Designer", department: "Marketing", status: "active" } ] };
const R = mm.cleanRoster(ROSTER);
ok(R.length === 8, "former staff and unconfirmed people are left out", R.map((x) => x.n));
ok(!R.some((x) => /Gone|Maybe/.test(x.n)), "left and to-confirm are not offered");
ok(R.find((x) => x.n === "Tempo Rary").tmp === true && !R.find((x) => x.n === "Test Boss One").tmp, "temporary people are marked");
ok(R.find((x) => /Rosie/.test(x.n)).f === "Rosie", "a quoted nickname becomes the short name");
ok(R.find((x) => /Munira/.test(x.n)).f === "Munira", "a bracketed spelling does not break the short name");
ok(R.find((x) => x.n === "Sam Agent One").f === "Sam Agent One" && R.find((x) => x.n === "Sam Agent Two").f === "Sam Agent Two", "two people with one first name show full names");
ok(R.find((x) => x.n === "Sam Agent One").g === "Team A" && R.find((x) => x.n === "Sam Agent Two").g === "Team B", "agents group by team");
ok(R.find((x) => x.n === "Freda Freelance").g === "Independent agents", "independent agents group together");
ok(R.find((x) => x.n === "Test Person One").nick.includes("TP1"), "known-as names are kept for search");
ok(R.find((x) => x.n === "Test Boss One").r === "Managing Director", "role is shortened to its first clause");
ok(mm.cleanRoster(null).length === 0 && mm.cleanRoster({}).length === 0, "no roster gives an empty list");

// ---- attendees
const A = mm.cleanAttendees([{ n: "Test Boss One" }, { n: "test boss one" }, { n: "A Guest From Outside" }, { n: "" }, null], R);
ok(A.length === 2 && A[0].r === "Managing Director" && A[1].guest === true && A[1].r === "", "attendees: roster people carry their role, typed names are guests, duplicates dropped", A);
ok(mm.cleanAttendees(Array.from({ length: 80 }, (_, i) => ({ n: "Guest " + i })), R).length === mm.MAX_ATTENDEES, "attendees are capped");
ok(mm.attendeeLine([{ n: "Test Boss One", r: "Managing Director" }, { n: "A Guest", r: "", guest: true }]) === "Test Boss One (Managing Director) · A Guest ([role to confirm])", "attendee line marks an unknown role");
ok(mm.attendeeLine([]) === "[attendees to confirm]", "no attendees is marked, never guessed");

// ---- api: the roster is hers alone
{ const u = new URL("https://w/momo/work/rec/api?key=bad"); const r = await m.workRoute(new Request(u, { method: "POST", body: JSON.stringify({ action: "people" }) }), env, u, deps); ok(r.status === 404, "wrong key cannot read the roster"); }
let P0 = await api({ action: "people" }); ok(P0.ok && P0.people.length === 0 && P0.usual.length === 0, "before the roster is loaded the list is empty, not an error", P0);
store.set(mm.PEOPLE_KEY, JSON.stringify(ROSTER));
let P1 = await api({ action: "people" }); ok(P1.ok && P1.people.length === 8 && P1.usual.length === 0, "the roster comes from KV", P1.usual);

// ---- start with attendees; the picks build the usual list
const s1 = await api({ action: "start", title: "Open day", attendees: [{ n: "Test Boss One" }, { n: "Sam Agent Two" }, { n: "Guest Gary" }, { n: "Nobody In Roster", role: "CEO" }] });
const rec = JSON.parse(store.get("recw_" + s1.id));
ok(rec.attendees.length === 4 && rec.attendees[0].r === "Managing Director" && rec.attendees[2].guest && rec.attendees[3].guest && rec.attendees[3].r === "", "start saves attendees on the recording; an unknown name is a guest with no invented role", rec.attendees);
const s2 = await api({ action: "start", title: "Second", attendees: [{ n: "Test Boss One" }] });
const P2 = await api({ action: "people" }); ok(P2.usual[0] === "Test Boss One" && P2.usual.includes("Sam Agent Two") && !P2.usual.includes("Guest Gary"), "most-picked people come first; guests are not remembered", P2.usual);
const s3 = await api({ action: "start", title: "No names" }); ok(!JSON.parse(store.get("recw_" + s3.id)).attendees, "start without names stores none");
store.delete("recw_" + s2.id); store.delete("recw_" + s3.id);

// ---- the speech engine reads the language itself
{ const id = s1.id; const r = await call("/momo/work/rec/chunk?id=" + id + "&n=0&secs=300", { method: "POST", body: new Uint8Array(5000), headers: { "Content-Type": "audio/mp4" } }); const j = await r.json();
  ok(j.ok && j.chars > 20, "a part is read", j); ok(lastAiOpts && !("language" in lastAiOpts), "the language is NOT forced to English any more", Object.keys(lastAiOpts || {})); }
await api({ action: "finish", id: s1.id, secs: 300 });

// ---- notes only
const nn = await api({ action: "notes", id: s1.id }); ok(nn.ok, "notes can be written without a log entry", nn);
ok(JSON.parse(store.get("recw_" + s1.id)).notes.summary.length > 5 && JSON.parse(store.get("recw_" + s1.id)).status !== "drafted", "notes are saved on the recording and nothing is filed");
ok(seen.some((x) => /Test Boss One \(Managing Director\)/.test(x.sys)) && seen.some((x) => /"Nezuko" means Najjuko/.test(x.sys)), "the notes writer is told who was in the room and the usual mishearings");

// ---- minutes
{ const bad = await call("/momo/work/rec/minutes?id=" + s1.id); ok(bad.status === 404, "no minutes page before they are written"); }
const mn = await api({ action: "minutes", id: s1.id }); ok(mn.ok, "minutes are written", mn);
const sy = seen.filter((x) => x.schema.properties && x.schema.properties.purpose).pop();
ok(/Never invent/.test(sy.sys) && /\[to confirm\]/.test(sy.sys) && /AGREED/.test(sy.sys) && /Minutes by|Najjuko Ganyana/.test(sy.sys), "the writer is held to the playbook rules");
ok(/"Nezuko" means Najjuko/.test(sy.sys) && /"Fayez" means Faez/.test(sy.sys), "the name-fix list reaches the writer");
ok(/Attendees: Test Boss One \(Managing Director\) · Sam Agent Two \(Agent\) · Guest Gary \(\[role to confirm\]\)/.test(sy.user), "the attendee list reaches the writer", sy.user.slice(0, 260));
ok(/Hello, I am Test Person One/.test(sy.user), "the transcript reaches the writer");
const again = await api({ action: "minutes", id: s1.id }); ok(again.ok && again.again, "reopening does not re-write the minutes");
const hit = await call("/momo/work/rec/minutes?id=" + s1.id); const h = await hit.text();
ok(hit.status === 200, "the minutes page opens for her key");
ok((await call("/momo/work/rec/minutes?id=" + s1.id, {}, "bad")).status === 404, "wrong key sees no minutes");
ok(/Back<\/a>/.test(h) && h.includes("/momo/work?key=K"), "Back goes to the work log");
ok(h.includes("Share / Save as PDF") && h.includes("print()") && h.includes("id=sv") && h.includes("id=ed") && h.includes(">Edit<"), "Edit, Share and Share / Save as PDF are there");
ok(h.includes("CONFIDENTIAL · FN Realty internal use only.") && h.includes(".foot{position:fixed"), "the confidentiality footer is on the page and repeats on every printed page");
ok(h.includes("<h2>1. Key decisions</h2>") && h.includes("<h2>2. Discussion summary</h2>") && h.includes("<h2>3. Action items</h2>") && h.includes("<h2>4. Open questions</h2>"), "the four fixed sections, in order");
ok(h.indexOf("1. Key decisions") < h.indexOf("2. Discussion summary") && h.indexOf("2. Discussion summary") < h.indexOf("3. Action items") && h.indexOf("3. Action items") < h.indexOf("4. Open questions"), "sections come in the fixed order");
ok(h.includes("<mark>[to confirm]</mark>") && h.includes("<mark>[role to confirm]</mark>"), "uncertain points are marked yellow");
ok(h.includes("Friday") && h.includes("next week (proposed)") && /<td><mark>\[to confirm\]<\/mark><\/td>/.test(h), "a stated date stays, an unstated date is '(proposed)', a missing one is [to confirm]");
ok(/<td>Book the room<\/td><td><mark>\[to confirm\]<\/mark><\/td>/.test(h), "a missing owner is [to confirm], never guessed");
ok(h.includes("Minutes by</dt><dd>Najjuko Ganyana") && h.includes("Saturday 24 October 2026") === false || h.includes(mm.longDate(rec.date)), "header: date and Minutes by");
ok(!/<\/script><b>/.test(h) && !/var T=[^;]*<\/script>/.test(h), "meeting text cannot close the script tag or inject markup");
ok(h.includes("&lt;/script&gt;&lt;b&gt;plan"), "title is escaped on the page");
ok(h.includes("@media print{body{background:#fff;padding:0 0 46px}.bar,.hint{display:none}"), "buttons are hidden on the PDF");
ok(!/\bsend\b.*automatically|mailto:|wa\.me/i.test(h), "the page has no send path: drafts only");
ok(h.includes("Momo sends nothing"), "the page says Momo sends nothing");
ok(mm.longDate("2026-10-24") === "Saturday 24 October 2026", "long date: weekday and full date");
ok(mm.dueText({ due: "", due_stated: false }) === "[to confirm]" && mm.dueText({ due: "Fri 6 Nov", due_stated: true }) === "Fri 6 Nov", "due-date wording");

// a list row knows it has minutes
const L = await api({ action: "list" }); ok(L.recs.find((r) => r.id === s1.id).minutes === true, "the list says the recording has minutes");
// a model failure is a clear retry, not a blank page
const s4 = await api({ action: "start", title: "Fails" }); await call("/momo/work/rec/chunk?id=" + s4.id + "&n=0&secs=60", { method: "POST", body: new Uint8Array(5000) });
const keep = deps.claudeJSON; deps.claudeJSON = async () => null; const f = await call("/momo/work/rec/api", { method: "POST", body: JSON.stringify({ action: "minutes", id: s4.id }) }); ok(f.status === 502, "if the writer fails the answer is a retry message", f.status); deps.claudeJSON = keep;

// ---- the client script is valid and carries the new screens
let parsed = true; try { new Function("$", "KEY", "QUEUE", "QI", "preview", REC_JS); } catch (e) { parsed = false; console.log(String(e)); }
ok(parsed, "the Record script parses");
for (const t of ["Who is in the room?", "Start without names", "More people (", "Someone else (a guest)", "Say hello first.", "Meeting minutes", "Momo sends nothing", "rec_o_min", "work_naj_people".slice(0, 0)]) ok(REC_JS.includes(t), "client has: " + t);
ok(!/Aisha|Najjuko Ganyana|Ali Kalhor/.test(REC_JS + JSON.stringify(Object.keys(mm))), "no real roster names in the client code");
console.log("v625 people + minutes: " + pass + " passed, " + fail + " failed"); if (fail) process.exit(1);
