// v617 - RECORD a meeting in Momo Work: parts are read on arrival, a failed part is retried on Stop, notes and a drafted entry come back, nothing leaks without her key.
import assert from "node:assert/strict";
const m = await import("../src/work_log.js");
let pass = 0, fail = 0; const ok = (c, msg, extra) => { if (c) pass++; else { fail++; console.log("FAIL", msg, extra === undefined ? "" : JSON.stringify(extra).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k, t) => { const v = store.get(k); return v == null ? null : v; }, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
let aiCalls = 0, aiFailOn = new Set();
const env = { MEETINGS: KV, AI: { run: async (model, o) => { if (model.includes("nova")) throw new Error("no diarizer in this test (v663: falls back to Whisper)"); aiCalls++; if (aiFailOn.has(aiCalls)) throw new Error("engine down"); ok(model.includes("whisper"), "the speech model is Whisper", model); ok(o.audio && o.audio.length > 100, "audio sent as base64"); return { text: "Good morning. Ali wants the content calendar confirmed by Thursday. Najjuko will draft the posts for the designer and Sultan confirms the budget." }; } } };
const seen = [];
const deps = { isNaj: (e, u) => u.searchParams.get("key") === "K", model: "m", page: (k, rk, b) => "<html>" + b + "</html>",
  claudeJSON: async (e, sys, user, schema) => {
    seen.push({ sys, user, schema });
    if (schema.properties && schema.properties.decisions) return { summary: "Briefing on the November plan.", topics: ["Content calendar", "Budget"], decisions: ["Calendar confirmed by Thursday"], people: ["Ali Al Mansoori", "Sultan"], actions: [{ what: "Draft the posts", owner: "Najjuko", due: "Thursday" }, { what: "Confirm the paid budget", owner: "Sultan", due: "" }] };
    if (schema.properties && schema.properties.notes) return { notes: "Condensed part." };
    if (schema.properties && schema.properties.entries) return { entries: [{ title: "Monday briefing with Ali", type: "Meeting", summary: "Briefing on the November plan.", people: ["Ali Al Mansoori"], kpis: [1], scope: [], works: ["Social content pillars and calendar"], deliverables: [], evidence: [], next: ["Draft the posts"], effort: "1-2 hours", time_of_day: "Unspecified", alone: false, in_scope: true, broker: false, broker_tasks: [], start: "", end: "", where: "Office", out_role: "", external: [], prep: { needed: false }, progress: [], questions: [] }] };
    return null; } };
const call = (path, opt) => { const u = new URL("https://w" + path + (path.includes("?") ? "&" : "?") + "key=K"); return m.workRoute(new Request(u, opt), env, u, deps); };
const api = async (o) => (await call("/momo/work/rec/api", { method: "POST", body: JSON.stringify(o) })).json();
const part = (n, secs, bytes = 5000) => call("/momo/work/rec/chunk?id=" + currentId + "&n=" + n + "&secs=" + secs, { method: "POST", body: new Uint8Array(bytes), headers: { "Content-Type": "audio/mp4" } }).then((r) => r.json());
let currentId = "";

// no key: the room does not exist
{ const u = new URL("https://w/momo/work/rec/api?key=bad"); const r = await m.workRoute(new Request(u, { method: "POST", body: "{}" }), env, u, deps); ok(r.status === 404, "wrong key gets 404", r.status); }
{ const u = new URL("https://w/momo/work/rec/view?key=bad&id=x"); const r = await m.workRoute(new Request(u), env, u, deps); ok(r.status === 404, "wrong key cannot read a transcript"); }

// start
const s = await api({ action: "start", title: "Monday briefing" }); currentId = s.id;
ok(s.ok && /^\d{8}[a-z0-9]+$/.test(s.id), "start returns an id that carries the date", s);
// part 0 ok, part 1 fails once (engine down), part 2 ok
let r0 = await part(0, 300); ok(r0.ok && r0.chars > 20, "part 0 read on arrival", r0);
aiFailOn.add(aiCalls + 1); let r1 = await part(1, 300); ok(r1.ok && r1.pending, "part 1: engine down, audio kept for retry", r1);
ok([...store.keys()].some((k) => k.startsWith("reca_" + currentId)), "failed part's audio is kept");
let r2 = await part(2, 240); ok(r2.ok && !r2.pending, "part 2 read", r2);
let again = await part(0, 300); ok(again.ok && again.again, "a re-sent part is not read twice");
ok((await part(3, 10, 100)).error === "That part was empty.", "an empty part is refused");
{ const big = await call("/momo/work/rec/chunk?id=" + currentId + "&n=9&secs=1", { method: "POST", body: new Uint8Array(8 * 1024 * 1024 + 10) }); ok(big.status === 413, "over 8 MB is refused", big.status); }
ok((await call("/momo/work/rec/chunk?id=nonexistent&n=0", { method: "POST", body: new Uint8Array(5000) })).status === 404, "a part for an unknown recording is refused");

// list before finish: shows as recording
let L = await api({ action: "list" }); ok(L.recs.length === 1 && L.recs[0].status === "recording" && L.recs[0].parts === 3, "list shows the recording and its parts", L);

// finish: the pending part is retried and read
const f = await api({ action: "finish", id: currentId, secs: 840 });
ok(f.ok && f.parts === 3 && f.missing.length === 0 && f.secs === 840, "finish retries the failed part; none missing", f);
ok(![...store.keys()].some((k) => k.startsWith("reca_" + currentId)), "retried audio is deleted once read");
L = await api({ action: "list" }); ok(L.recs[0].status === "transcribed", "status is transcribed after finish", L.recs[0]);

// entries
const e = await api({ action: "entries", id: currentId });
ok(e.ok && e.entries.length === 1 && e.entries[0].title === "Monday briefing with Ali" && e.notes, "entries drafted from notes", e);
ok(/^\d\d:\d\d$/.test(e.entries[0].start) && /^\d\d:\d\d$/.test(e.entries[0].end) || e.entries[0].start === "", "entry carries the recorded clock when long enough", [e.entries[0].start, e.entries[0].end]);
ok(e.entries[0].time_of_day !== "Unspecified" || e.entries[0].start === "", "time of day filled from the clock");
ok(seen.some((x) => /Never invent/.test(x.sys)), "the notes prompt forbids invention");
ok(seen.some((x) => /Ali Kalhor/.test(x.sys)), "team names offered for mis-heard spellings");
L = await api({ action: "list" }); ok(L.recs[0].status === "drafted", "status drafted", L.recs[0]);

// the transcript page
{ const v = await call("/momo/work/rec/view?id=" + currentId); const h = await v.text(); ok(v.status === 200 && h.includes("Monday briefing") && h.includes("Decisions") && h.includes("Calendar confirmed") && h.includes("[00:00]") && h.includes("[05:00]"), "notes and transcript page", h.slice(0, 200)); ok(/noindex/.test(h), "page is noindex"); }

// saving the entry marks the recording filed
{ const sv = await api2(); async function api2() { return (await call("/momo/work/api", { method: "POST", body: JSON.stringify({ action: "save", entry: e.entries[0], date: s.date, text: "x", rec: currentId }) })).json(); } ok(sv.ok, "entry saved", sv); }
L = await api({ action: "list" }); ok(L.recs[0].status === "filed", "recording marked filed after the entry is saved", L.recs[0]);

// a long meeting is condensed in parts first
{ const s2 = await api({ action: "start", title: "Long" }); currentId = s2.id; for (let i = 0; i < 3; i++) await part(i, 300);
  // make the transcript long by stuffing the stored parts
  for (let i = 0; i < 3; i++) store.set("recs_" + currentId + "_" + String(i).padStart(3, "0"), JSON.stringify({ n: i, secs: 300, text: "word ".repeat(5500) }));
  await api({ action: "finish", id: currentId, secs: 900 }); seen.length = 0; const e2 = await api({ action: "entries", id: currentId });
  ok(e2.ok, "long meeting still drafts", e2); ok(seen.filter((x) => x.schema.properties && x.schema.properties.notes).length >= 2, "long transcript is condensed part by part first", seen.length); }

// engine totally down: finish says so honestly; entries fall back to a keyword draft when the writer is down
{ const s3 = await api({ action: "start", title: "Silent" }); currentId = s3.id; const before = aiCalls; for (let k = 1; k <= 4; k++) aiFailOn.add(before + k); await part(0, 100); const f3 = await api({ action: "finish", id: currentId, secs: 100 }); aiFailOn.clear(); ok(f3.error && /could not hear|No part/.test(f3.error), "no speech: honest error, nothing invented", f3); }
{ const s4 = await api({ action: "start", title: "NoWriter" }); currentId = s4.id; await part(0, 300); await api({ action: "finish", id: currentId, secs: 300 }); const keep = deps.claudeJSON; deps.claudeJSON = async () => null; const e4 = await api({ action: "entries", id: currentId }); deps.claudeJSON = keep; ok(e4.ok && e4.entries.length === 1 && e4.entries[0].title, "writer down: a plain keyword draft, not a failure", e4); }

// delete removes the recording, its parts and any audio
{ await api({ action: "delete", id: currentId }); ok(![...store.keys()].some((k) => k.includes(currentId)), "delete removes every key of the recording"); ok((await api({ action: "entries", id: currentId })).error, "a deleted recording cannot be read"); }

// the page: button, banner, script parse, and the key behaviours are in the script
{ const u = new URL("https://w/momo/work?key=K"); const pg = await (await m.workRoute(new Request(u), env, u, deps)).text(); ok(pg.includes("id=wrec") && pg.includes("id=wrecbn"), "page has the Record button and banner");
  const uj = new URL("https://w/momo/work.js?key=K"); const js = await (await m.workRoute(new Request(uj), env, uj, deps)).text(); let parses = true; try { new Function(js); } catch (x) { parses = false; } ok(parses, "work script parses with the recorder inside it");
  for (const frag of ["audio/mp4", "audio/webm;codecs=opus", "navigator.wakeLock", "SEG_MS=300000", "beforeunload", "Tell the people in the room you are recording", "/momo/work/rec/chunk", "Stop and make my entry", "Make entry", "rec:PREV.src_rec"]) ok(js.includes(frag), "script has: " + frag);
  ok(!/\$\{/.test(js.slice(js.indexOf("v617 RECORD"))), "no template interpolation in the recorder script"); }
// v618 - ids: the recorder's element ids must be unique on the page (v617 reused "rgo", the Report tab's link, so Start did nothing)
{ const u = new URL("https://w/momo/work?key=K"); const pg = await (await m.workRoute(new Request(u), env, u, deps)).text();
  const uj = new URL("https://w/momo/work.js?key=K"); const js = await (await m.workRoute(new Request(uj), env, uj, deps)).text();
  const i0 = js.indexOf("// ---- v617 RECORD"), i1 = js.indexOf("load();resumeDraft()})();");
  const rec = js.slice(i0, i1), rest = pg + js.slice(0, i0) + js.slice(i1);
  const idsOf = (t) => new Set([...t.matchAll(/id=["']?([A-Za-z][\w-]*)/g)].map((x) => x[1]).concat([...t.matchAll(/\.id=["']([A-Za-z][\w-]*)["']/g)].map((x) => x[1])));
  const mine = idsOf(rec), theirs = idsOf(rest), clash = [...mine].filter((x) => theirs.has(x));
  ok(mine.size >= 10, "the recorder declares its ids", [...mine]); ok(clash.length === 0, "no recorder id is also used elsewhere on the page", clash);
  ok(!/\$\("rgo"\)/.test(rec), "the recorder does not touch the Report tab's rgo");
  ok(rec.includes("Recording started") && rec.includes("Recording stopped") && rec.includes("Starting"), "start and stop are confirmed on screen"); }
// v620 - pause is visible, stop reports progress, uploads time out and are traced; the page's step trail is stored (names and sizes only)
{ const uj = new URL("https://w/momo/work.js?key=K"); const js = await (await m.workRoute(new Request(uj), env, uj, deps)).text(); const rec = js.slice(js.indexOf("// ---- v617 RECORD"));
  for (const frag of ["id=rec_state", "Paused. Tap Resume", "Stopped. Saving", "AbortController", "Sending the last part", "Still working, keep this page open", "function dlog(", 'action:"log"', "upload part", "tries>=6"]) ok(rec.includes(frag), "v620 script has: " + frag);
  const s5 = await api({ action: "start", title: "Trail" }); currentId = s5.id;
  const lg = await api({ action: "log", id: currentId, ev: ["0s part 0 ended: 5000 bytes, 5s, type audio/mp4", "0s upload part 0 start (5000 bytes, try 1)", "bad charshere"] });
  ok(lg.ok, "log action accepted", lg); const mm = JSON.parse(store.get("recw_" + currentId)); ok(mm.log.length === 3 && !/[ -]/.test(mm.log[2]), "trail stored, control characters stripped", mm.log);
  ok((await api({ action: "log", id: "nonexistent", ev: ["x"] })).error, "log for an unknown recording is refused"); }
// v621 - a dead microphone must never be silent (Kendall 21 Oct: a 55-minute recording came back as twelve parts of 0 bytes and nothing warned her)
{ const uj = new URL("https://w/momo/work.js?key=K"); const js = await (await m.workRoute(new Request(uj), env, uj, deps)).text(); const rec = js.slice(js.indexOf("// ---- v617 RECORD"));
  for (const frag of ["function alarm(msg)", "id=rec_alert", "navigator.vibrate", "trk.onmute", "trk.onended", "Date.now()-R.lastSound>45000", "page hidden: banking the current part", "NOTHING WAS RECORDED", "came back EMPTY", "tk.readyState"]) ok(rec.includes(frag), "v621 script has: " + frag);
  const s9 = await api({ action: "start", title: "Empty" }); currentId = s9.id; const f9 = await api({ action: "finish", id: currentId, secs: 600 });
  ok(f9.error && /empty audio/.test(f9.error), "finish on a recording with no parts says the phone sent empty audio", f9);
  const e9 = await api({ action: "entries", id: currentId }); ok(e9.error && /no audio/.test(e9.error) && /Delete it/.test(e9.error), "Make entry on an audio-less recording explains it and says what to do", e9); }
console.log("v617 record: " + pass + " passed, " + fail + " failed"); if (fail) process.exit(1);
