// v629 - reading a recording is a JOB of short stages kept in KV, so a long meeting never looks frozen (Kendall, 26 Oct 2026: a 58-minute recording stuck on the options card).
// SYNTHETIC fixtures only (the repo is public): invented words, no real names or content.
import { REC_JS } from "../src/work_rec_page.js";
const m = await import("../src/work_log.js");
let pass = 0, fail = 0; const ok = (c, msg, extra) => { if (c) pass++; else { fail++; console.log("FAIL", msg, extra === undefined ? "" : JSON.stringify(extra).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => { const v = store.get(k); return v == null ? null : v; }, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const env = { MEETINGS: KV, AI: { run: async () => ({ text: "Synthetic words." }) } };
// a fake model: it answers by the schema it is asked for and records every call
const calls = []; let failB = 0;
const claudeJSON = async (e, sys, user, schema) => {
  const req = (schema && schema.required) || [];
  const kind = req.includes("notes") && req.length === 1 ? "condense" : req.includes("summary") ? "notes" : req.includes("decisions") && req.includes("actions") ? "minutes_full" : req.includes("decisions") ? "minutes_a" : req.includes("actions") ? "minutes_b" : "other";
  calls.push({ kind, user: String(user).length, text: String(user) });
  if (kind === "condense") return { notes: "Synthetic condensed part." };
  if (kind === "notes") return { summary: "A synthetic meeting about a synthetic plan.", topics: ["plan"], decisions: [], people: [], actions: [{ what: "Send the synthetic plan", owner: "", due: "" }] };
  if (kind === "minutes_a") return { title: "Synthetic plan", purpose: "To talk about a plan.", decisions: [{ headline: "Plan agreed", detail: "The group agreed the plan." }], discussion: [{ heading: "1. The plan", bullets: ["It was discussed."] }] };
  if (kind === "minutes_b") { if (failB > 0) { failB--; return null; } return { actions: [{ action: "Send the plan", owner: "", due: "", due_stated: false }], open_questions: ["Which date? [to confirm]"] }; }
  if (kind === "minutes_full") return { title: "Synthetic plan", purpose: "P.", decisions: [], discussion: [{ heading: "1. Topic", bullets: ["b"] }], actions: [{ action: "Do it", owner: "", due: "", due_stated: false }], open_questions: [] };
  return null;
};
const deps = { isNaj: (e, u) => u.searchParams.get("key") === "K", model: "m", page: (k, rk, b) => "<html>" + b + "</html>", claudeJSON };
const call = (path, opt) => { const u = new URL("https://w" + path + (path.includes("?") ? "&" : "?") + "key=K"); return m.workRoute(new Request(u, opt), env, u, deps); };
const api = async (o) => (await call("/momo/work/rec/api", { method: "POST", body: JSON.stringify(o) })).json();
const n0 = () => { calls.length = 0; };
const kinds = () => calls.map((c) => c.kind);
// a recording with N stored text parts of the given size (as if they had been transcribed on arrival)
const mk = async (parts, chars, secsPer = 300) => {
  const id = (await api({ action: "start", title: "Synthetic meeting" })).id;
  for (let i = 0; i < parts; i++) store.set("recs_" + id + "_" + String(i).padStart(3, "0"), JSON.stringify({ n: i, secs: secsPer, text: ("word ".repeat(Math.ceil(chars / 5))).slice(0, chars) }));
  return id;
};

// ---- a LONG recording (about 36,000 characters), notes only: condense then notes, one stage per call
{
  const id = await mk(6, 6000); n0();
  const r1 = await api({ action: "read", id, kind: "notes" });
  ok(r1.state === "reading" && r1.stage === "notes" && r1.n === 1 && r1.of === 2, "first call does ONE stage (condense) and says the notes come next", r1);
  ok(kinds().every((k) => k === "condense") && kinds().length >= 3, "the condense stage runs the parts in parallel (3+ short calls) and nothing else", kinds());
  n0(); const r2 = await api({ action: "read", id, kind: "notes" });
  ok(r2.state === "ready" && kinds().length === 1 && kinds()[0] === "notes", "second call writes the notes and is ready", { r2, k: kinds() });
  ok(!!JSON.parse(store.get("recw_" + id)).notes.summary, "the notes are stored on the recording");
  n0(); const r3 = await api({ action: "read", id, kind: "notes" });
  ok(r3.state === "ready" && calls.length === 0, "reading again is instant and makes no model call (idempotent)");
  const L = (await api({ action: "list" })).recs.find((x) => x.id === id);
  ok(L.notes === true && L.job === null, "the list shows it Ready (notes, no unfinished job)", L);
}

// ---- a LONG recording, minutes: condense -> notes -> minutes A -> minutes B, each a short request
{
  const id = await mk(6, 6000); n0();
  const seen = [];
  for (let i = 0; i < 6; i++) { const r = await api({ action: "read", id, kind: "minutes" }); seen.push(r); if (r.state !== "reading") break; }
  ok(seen.length === 4 && seen.slice(0, 3).every((r) => r.state === "reading" && r.of === 4) && seen[3].state === "ready", "four short requests: three 'reading' answers with a step count, then ready", seen);
  ok(seen.map((r) => r.n).join() === "1,2,3,4", "the step count rises 1,2,3,4 so the page can show progress", seen.map((r) => r.n));
  const ks = kinds(); ok(ks.indexOf("notes") > ks.lastIndexOf("condense") && ks.indexOf("minutes_a") > ks.indexOf("notes") && ks[ks.length - 1] === "minutes_b" && !ks.includes("minutes_full"), "order: condense, notes, minutes A, minutes B; the single huge call is not used", ks);
  const b = calls.find((c) => c.kind === "minutes_b"), a = calls.find((c) => c.kind === "minutes_a");
  ok(b.user < 8000 && /Condensed transcript/.test(b.text), "minutes B is built from the notes and the CONDENSED transcript, so it is short", b.user);
  ok(a.user > 30000, "minutes A reads the full transcript", a.user);
  const mn = JSON.parse(store.get("recw_" + id)).minutes;
  ok(mn && mn.title && mn.decisions.length === 1 && mn.discussion.length === 1 && mn.actions.length === 1 && mn.open_questions.length === 1, "the two parts merge into one full set of minutes", mn);
  const L = (await api({ action: "list" })).recs.find((x) => x.id === id); ok(L.minutes === true && L.job === null, "list: minutes ready, no job left", L);
  // a fresh draft starts a new job
  n0(); const f1 = await api({ action: "read", id, kind: "minutes", fresh: true }); ok(f1.state === "reading" && f1.stage === "minutes_b" && kinds()[0] === "minutes_a", "a fresh draft re-writes only the minutes stages", { f1, k: kinds() });
}

// ---- a SHORT recording: notes then ONE minutes call (as before)
{
  const id = await mk(2, 3000); n0();
  const r1 = await api({ action: "read", id, kind: "minutes" }); ok(r1.state === "reading" && r1.of === 2 && r1.stage === "minutes", "short meeting: two stages (notes, minutes)", r1);
  const r2 = await api({ action: "read", id, kind: "minutes" }); ok(r2.state === "ready" && kinds().includes("minutes_full"), "short meeting: one single minutes call", kinds());
}

// ---- a failed stage is a clear error, saved, and the retry carries on from that stage
{
  const id = await mk(6, 6000); failB = 1; n0();
  let r; for (let i = 0; i < 6; i++) { r = await api({ action: "read", id, kind: "minutes" }); if (r.state !== "reading") break; }
  ok(r.state === "error" && /Try again/.test(r.error) && /recording is safe/i.test(r.error) && r.stage === "minutes_b", "a failed stage answers with a plain error that says the recording is safe and to try again", r);
  ok(JSON.parse(store.get("recj_" + id + "_minutes")).state === "error", "the job state is saved as an error");
  const L = (await api({ action: "list" })).recs.find((x) => x.id === id); ok(L.job && L.job.state === "error" && L.job.kind === "minutes", "the list shows 'Needs a retry' data for it", L.job);
  n0(); const r2 = await api({ action: "read", id, kind: "minutes" });
  ok(r2.state === "ready" && kinds().length === 1 && kinds()[0] === "minutes_b", "the retry runs ONLY the failed stage (no condense, notes or A again) and finishes", { r2, k: kinds() });
  ok(!!JSON.parse(store.get("recw_" + id)).minutes, "the minutes are stored after the retry");
}

// ---- two calls at once do not run the same stage twice; Try again (takeover) always works
{
  const id = await mk(6, 6000); n0();
  await api({ action: "read", id, kind: "notes" });   // condense done
  const jk = "recj_" + id + "_notes", job = JSON.parse(store.get(jk)); job.busy_until = Date.now() + 60000; store.set(jk, JSON.stringify(job)); n0();
  const w = await api({ action: "read", id, kind: "notes" });
  ok(w.state === "reading" && w.waiting === true && calls.length === 0, "a call that arrives while a stage is being written waits and runs nothing", w);
  const t = await api({ action: "read", id, kind: "notes", takeover: true }); ok(t.state === "ready" && kinds().join() === "notes", "Try again (takeover) runs the stage even if the last request was cut off", { t, k: kinds() });
}

// ---- nothing to read yet is a clear, fatal error, never a spinner
{
  const id = (await api({ action: "start", title: "Empty" })).id;
  const r = await api({ action: "read", id, kind: "notes" }); ok(r.state === "error" && r.fatal && /no speech/i.test(r.error), "an empty recording answers with a plain error", r);
}

// ---- the lost-audio fact after Stop
{
  const id = await mk(10, 400, 300);   // ten 5-minute parts reached the server (3,000 s)
  const f = await api({ action: "finish", id, secs: 3466 });
  ok(f.ok && f.lost && f.lost.secs === 466 && f.lost.from === 3000, "finish tells how much had no sound (466 s after 3,000 s)", f);
  const id2 = await mk(4, 400, 300); const f2 = await api({ action: "finish", id: id2, secs: 1205 }); ok(f2.ok && f2.lost === null, "a few seconds of difference is not reported", f2);
  const L = (await api({ action: "list" })).recs.find((x) => x.id === id); ok(L.lost && L.lost.secs === 466, "the list keeps the lost-audio fact", L.lost);
}

// ---- deleting a recording removes its job
{
  const id = await mk(6, 6000); await api({ action: "read", id, kind: "notes" });
  ok([...store.keys()].some((k) => k.startsWith("recj_" + id)), "a job exists");
  await api({ action: "delete", id }); ok(![...store.keys()].some((k) => k.includes(id)), "delete leaves no job behind");
}

// ---- the page: wording and wiring
ok(/A long one can take two or three minutes\. You can leave this page: it will be waiting in today/.test(REC_JS), "the page says it can take two or three minutes and that she can leave");
ok(REC_JS.includes("visibilitychange") && REC_JS.includes("rdResume") && REC_JS.includes("pageshow"), "the page carries on when it comes back to the front");
ok(REC_JS.includes("data-rd=") && REC_JS.includes('data-rr="1"') && REC_JS.includes("Try again") && REC_JS.includes("Continue") && REC_JS.includes("Needs a retry") && REC_JS.includes("Ready"), "Continue / Try again / Needs a retry / Ready are on the page");
ok(REC_JS.includes("had no sound (the phone\\'s microphone stopped at") && REC_JS.includes("Everything before that was kept."), "the lost-audio sentence is on the options card");
ok(!REC_JS.includes('action:"minutes",id:'), "the page no longer sends the one big minutes request");
ok(!/`/.test(REC_JS) && !REC_JS.includes("${"), "no backticks or template holes inside the page script");
try { new Function(REC_JS); ok(true, "parses"); } catch (e) { ok(false, "the page script parses", e.message); }

// ---- the polling loop itself, run with a fake server and fake timers
{
  const a = REC_JS.indexOf("var READ={};"), tail = 'window.addEventListener("pageshow",rdResume);', b = REC_JS.indexOf(tail) + tail.length;
  const src = REC_JS.slice(a, b) + "\nreturn {rdStart, rdResume, READ};";
  const els = {}; const el = (id) => els[id] || (els[id] = { id, innerHTML: "", querySelector() { return null; } });
  const timers = []; const listeners = {};
  const run = (script) => {
    const log = [], toasts = [], answers = [...script];
    const rapi = (o) => { log.push(o); const x = answers.shift(); return Promise.resolve(x === undefined ? { state: "ready" } : x); };
    const lib = new Function("rapi", "$", "toast", "fail", "dlog", "esc2", "document", "window", "setTimeout", "minUrl", "Date", src)(
      rapi, (id) => els[id] || null, (t) => toasts.push(t), (t) => toasts.push("FAIL " + t), () => {}, (s) => String(s), { addEventListener: (e, f) => { listeners[e] = f; }, visibilityState: "visible" }, { addEventListener: (e, f) => { listeners[e] = f; } }, (f) => timers.push(f), (id) => "/min/" + id, Date);
    return { lib, log, toasts };
  };
  const flush = async () => { for (let i = 0; i < 40 && timers.length; i++) { const f = timers.shift(); f(); await new Promise((r) => setTimeout(r, 0)); } await new Promise((r) => setTimeout(r, 0)); };
  // 1) stages then ready, the page shows each step and calls done once
  el("out1"); let doneN = 0;
  let t = run([{ state: "reading", stage: "condense", label: "Reading the long recording in parts", n: 1, of: 4 }, { state: "reading", stage: "notes", label: "Writing the notes", n: 2, of: 4 }, { state: "ready", n: 4, of: 4 }]);
  t.lib.rdStart("r1", "minutes", { out: "out1", done: () => { doneN++; } }); await new Promise((r) => setTimeout(r, 0)); await flush();
  ok(t.log.length === 3 && t.log.every((o) => o.action === "read" && o.kind === "minutes" && o.id === "r1"), "the page calls read until ready (3 calls)", t.log.length);
  ok(doneN === 1, "done runs exactly once at ready");
  // 2) the page shows progress text while waiting
  el("out2"); t = run([{ state: "reading", stage: "notes", label: "Writing the notes", n: 1, of: 3 }]); t.lib.rdStart("r2", "notes", { out: "out2" }); await new Promise((r) => setTimeout(r, 0));
  ok(/Step 2 of 3: Writing the notes/.test(els.out2.innerHTML) && /two or three minutes/.test(els.out2.innerHTML), "the progress card shows the step and the reassurance", els.out2.innerHTML.slice(0, 200));
  // 3) a dropped connection keeps trying and shows a waiting message, then finishes
  el("out3"); doneN = 0; t = run([{ error: "No connection. Check the wifi and try again." }, { state: "ready" }]); t.lib.rdStart("r3", "notes", { out: "out3", done: () => { doneN++; } }); await new Promise((r) => setTimeout(r, 0));
  ok(/Waiting for the connection/.test(els.out3.innerHTML), "a dropped connection says Momo is waiting, not a blank spinner", els.out3.innerHTML.slice(0, 160));
  await flush(); ok(doneN === 1 && t.log.length === 2, "it retries by itself and finishes", { doneN, calls: t.log.length });
  // 4) a failed stage shows the error and Try again
  el("out4"); let failed = 0; t = run([{ state: "error", error: "Momo could not write the minutes just now. Your recording is safe. Tap Try again: it carries on from where it stopped.", stage: "minutes_b", n: 3, of: 4 }]);
  t.lib.rdStart("r4", "minutes", { out: "out4", fail: () => { failed++; } }); await new Promise((r) => setTimeout(r, 0)); await flush();
  ok(/Your recording is safe/.test(els.out4.innerHTML) && /data-rr="1"/.test(els.out4.innerHTML) && failed === 1, "the error is shown in the card with a Try again button, and the caller is told", els.out4.innerHTML.slice(0, 200));
  // 5) coming back to the front resumes a stalled request
  el("out5"); doneN = 0; let hold; const rapi5 = []; t = run([]);   // a loop whose first request never answers
  const never = new Promise(() => {}); let first = true;
  const lib5 = new Function("rapi", "$", "toast", "fail", "dlog", "esc2", "document", "window", "setTimeout", "minUrl", "Date", src)(
    (o) => { rapi5.push(o); if (first) { first = false; return never; } return Promise.resolve({ state: "ready" }); }, (id) => els[id] || null, () => {}, () => {}, () => {}, (s) => String(s),
    { addEventListener: (e, f) => { listeners["doc_" + e] = f; }, visibilityState: "visible" }, { addEventListener: (e, f) => { listeners["win_" + e] = f; } }, (f) => timers.push(f), (id) => "/min/" + id, { now: (() => { let t0 = 1000; return () => (t0 += 30000); })() });
  lib5.rdStart("r5", "notes", { out: "out5", done: () => { doneN++; } }); await new Promise((r) => setTimeout(r, 0));
  ok(rapi5.length === 1 && doneN === 0, "the first request is stuck (phone locked)");
  listeners.doc_visibilitychange(); await new Promise((r) => setTimeout(r, 0)); await flush();
  ok(rapi5.length === 2 && doneN === 1, "coming back to the page re-asks and finishes (resume on visibilitychange)", { n: rapi5.length, doneN });
}

console.log("v629 read job: " + pass + " passed, " + fail + " failed"); if (fail) process.exit(1);
