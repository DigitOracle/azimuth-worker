// v663 - Momo recorder: speaker separation. Nova-3 diarization with a Whisper fallback, per-part labels linked across parts, rename everywhere,
// per-person isolation (najjuko vs kendall), the bridge meeting shape, and old transcripts unchanged. FAKE keys, FAKE names and FAKE words only (public repo).
const worker = (await import("../src/index.js")).default;
const W = await import("../src/work_log.js");
const S = await import("../src/work_speakers.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 400)); } };
const store = new Map();
const KV = { get: async (k, t) => { const v = store.has(k) ? store.get(k) : null; return v; }, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NAJ = "ins_najjuko_TESTKEY0123456789abcd", KEN = "ins_kendall_TESTKEY0123456789abcd";
const NB = "brg_najjuko_FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE01", KB = "brg_kendall_FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE02";
// fake diarized response in the documented shape (results.channels[0].alternatives[0].words), speaker per word
const w = (word, start, speaker) => ({ word, punctuated_word: word, start, end: start + 0.4, confidence: 0.9, speaker });
const novaPart = [
  { results: { channels: [{ alternatives: [{ transcript: "x", words: [w("Hello,", 1, 0), w("I", 1.5, 0), w("am", 2, 0), w("Alpha.", 2.5, 0), w("Thanks", 5, 1), w("Alpha,", 5.5, 1), w("budget", 6, 1), w("first.", 6.5, 1)] }] }] } },
  { results: { channels: [{ alternatives: [{ transcript: "x", words: [w("Budget", 3, 0), w("is", 3.4, 0), w("agreed.", 3.8, 0), w("Beta", 10, 1), w("sends", 10.4, 1), w("the", 10.8, 1), w("draft.", 11.2, 1)] }] }] } }
];
let aiCalls = [], novaFail = false, nPart = 0;
const env = { MEETINGS: KV, INSIDER_KEY: [NAJ, KEN].join(","), MOMO_BRIDGE_KEYS: "najjuko:" + NB + ",kendall:" + KB,
  AI: { run: async (model, o) => {
    aiCalls.push(model);
    if (model === S.DIAR_MODEL) {
      ok(o.diarize === true && o.audio && o.audio.body && typeof o.audio.contentType === "string" && /^audio\//.test(o.audio.contentType), "Nova-3 gets audio {body, contentType} and diarize", { ct: o.audio && o.audio.contentType });
      if (novaFail) throw new Error("diarizer down");
      return novaPart[(nPart++) % 2];
    }
    return { text: "Fallback words from the older engine." };
  } } };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const U = (path, key) => "https://w" + path + (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key);
let lastMatchUser = "";
const deps = { isNaj: (e, u) => u.searchParams.get("key") === NAJ, person: (e, u) => ({ [NAJ]: "najjuko", [KEN]: "kendall" })[u.searchParams.get("key")] || "", model: "m",
  page: (k, rk, b) => "<html>" + b + "</html>",
  claudeJSON: async (e, sys, user, schema) => {
    const pr = schema && schema.properties ? schema.properties : {};
    if (pr.groups) {   // the match step: link P0-S1 and P1-S0 (same person); name one from the room list, one invented name that must be dropped, one bad pair from the same part
      lastMatchUser = user;
      return { groups: [{ labels: ["P0-S0"], name: "Example Alpha", confidence: 0.9 }, { labels: ["P0-S1", "P1-S0"], name: "Invented Person", confidence: 0.95 }, { labels: ["P1-S1", "P1-S0", "P9-S9"], name: "Example Beta", confidence: 0.4 }] };
    }
    if (pr.decisions && pr.topics) { e.__notesUser = user; e.__notesSys = sys; return { summary: "Example summary.", topics: ["Budget"], decisions: ["Budget agreed"], people: [], actions: [{ what: "Send the draft", owner: "Example Beta", due: "" }] }; }
    if (pr.purpose || pr.discussion || pr.open_questions) { e.__minSys = sys; e.__minUser = user; return { title: "Example minutes", purpose: "Budget.", decisions: [{ headline: "Budget agreed", detail: "" }], discussion: [], actions: [{ action: "Send the draft", owner: "Example Beta", due: "", due_stated: false }], open_questions: [] }; }
    return null; } };
const call = (path, key, body, headers) => { const u = new URL(U(path, key)); return W.workRoute(new Request(u, body !== undefined ? { method: "POST", body: typeof body === "string" || body instanceof Uint8Array ? body : JSON.stringify(body), headers: headers || { "Content-Type": "application/json" } } : {}), env, u, deps); };
const api = async (key, o) => (await call("/momo/work/rec/api", key, o)).json();
const part = async (key, id, n, secs) => (await call("/momo/work/rec/chunk?id=" + id + "&n=" + n + "&secs=" + secs, key, new Uint8Array(5000), { "Content-Type": "audio/webm;codecs=opus" })).json();

// --- unit: the reader and the fallback
{ const u = S.uttsFromNova(novaPart[0]); ok(u.length === 2 && u[0].s === 0 && u[1].s === 1 && u[0].x === "Hello, I am Alpha." && u[1].t === 5, "words grouped into utterances by speaker", u); }
{ const u = S.uttsFromNova({ results: { utterances: [{ start: 2, end: 3, transcript: "Hi.", speaker: 1 }] } }); ok(u.length === 1 && u[0].s === 1 && u[0].t === 2, "results.utterances used when present", u); }
ok(S.uttsFromNova({ text: "x" }) === null && S.uttsFromNova({ results: { channels: [] } }) === null, "no words = nothing usable");

// --- najjuko records a two-part meeting with two people in the room
const st = await api(NAJ, { action: "start", title: "Example meeting", attendees: [{ n: "Example Alpha" }, { n: "Example Beta" }] });
ok(st.ok, "start", st);
const id = st.id;
let r = await part(NAJ, id, 0, 300); ok(r.ok && r.engine === "nova-3" && r.speakers === 2, "part 0 read by Nova-3, two speakers", r);
r = await part(NAJ, id, 1, 300); ok(r.ok && r.engine === "nova-3", "part 1 read by Nova-3", r);
const seg0 = JSON.parse(store.get("recs_" + id + "_000"));
ok(seg0.engine === "nova-3" && seg0.utts.length === 2 && seg0.text.includes("Alpha"), "part stores engine, utterances and plain text", seg0);
ok(![...store.keys()].some((k) => k.startsWith("reca_" + id)), "no audio kept after a successful read");
// a third part with the diarizer down: Whisper reads it, engine recorded
novaFail = true; const callsBefore = aiCalls.length;
r = await part(NAJ, id, 2, 60); ok(r.ok && r.engine === "whisper" && !r.pending, "Nova-3 down: Whisper fallback reads the part", r);
ok(aiCalls.slice(callsBefore).join() === S.DIAR_MODEL + ",@cf/openai/whisper-large-v3-turbo", "tried Nova-3 then Whisper", aiCalls.slice(callsBefore));
ok(JSON.parse(store.get("recs_" + id + "_002")).engine === "whisper" && !JSON.parse(store.get("recs_" + id + "_002")).utts, "fallback part has no speaker data");
novaFail = false;

// --- finish runs the match step
const f = await api(NAJ, { action: "finish", id, secs: 660 }); ok(f.ok, "finish", f);
const m1 = JSON.parse(store.get("recw_" + id));
const g = m1.speakers && m1.speakers.groups;
ok(g && g.length === 3, "three people after linking (P0-S1 = P1-S0)", g);
ok(/Example Alpha/.test(lastMatchUser) && /P0-S0/.test(lastMatchUser) && /P1-S1/.test(lastMatchUser), "the match prompt has the room list and excerpts per part label");
const gA = g.find((x) => x.labels.includes("P0-S0")), gB = g.find((x) => x.labels.includes("P0-S1")), gC = g.find((x) => x.labels.includes("P1-S1"));
ok(gA.name === "Example Alpha" && gA.id === "A", "a confident name from the room list is kept", gA);
ok(gB.labels.join() === "P0-S1,P1-S0" && gB.name === "" && gB.id === "B", "an invented name is dropped; the link across parts is kept", gB);
ok(gC.name === "" && gC.labels.join() === "P1-S1", "low confidence: no name; a label already used and an unknown label are dropped", gC);

// transcript page: named lines with offsets
let h = await (await call("/momo/work/rec/view?id=" + id, NAJ)).text();
ok(/\[00:01\] Example Alpha: Hello, I am Alpha\./.test(h) && /\[00:05\] Speaker B: Thanks Alpha/.test(h), "part 0 lines: [mm:ss] Name: text", h.slice(h.indexOf("class=tx"), h.indexOf("class=tx") + 300));
ok(/\[05:03\] Speaker B: Budget is agreed\./.test(h) && /\[05:10\] Speaker C: Beta sends the draft\./.test(h), "part 1 offset by the part's start, same speaker linked", "");
ok(/\[10:00\] Fallback words/.test(h), "a Whisper part renders the old way");
ok(/data-sp="A"/.test(h) && /Suggest the speakers again/.test(h), "speaker panel on the transcript page");
for (const sc of [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((x) => x[1])) { try { new Function(sc); ok(true); } catch (e) { ok(false, "transcript page script parses", e.message); } }

// rename applies everywhere in the meeting
r = await api(NAJ, { action: "speakers", id, op: "rename", group: "C", name: "Example Beta" });
ok(r.ok && r.speakers.find((x) => x.id === "C").confirmed && r.speakers.find((x) => x.id === "C").shown_as === "Example Beta", "rename confirms the speaker", r);
r = await api(NAJ, { action: "speakers", id, op: "merge", group: "C", into: "B" });
ok(r.ok && r.speakers.length === 2 && r.speakers.find((x) => x.id === "B").labels.length === 3, "merge joins two speakers", r);
r = await api(NAJ, { action: "speakers", id, op: "rename", group: "B", name: "Example Beta" });
h = await (await call("/momo/work/rec/view?id=" + id, NAJ)).text();
ok(/\[00:05\] Example Beta: Thanks/.test(h) && /\[05:03\] Example Beta: Budget/.test(h) && /\[05:10\] Example Beta: Beta sends/.test(h) && !/Speaker B:/.test(h), "the new name is on every line of that speaker");
ok((await api(NAJ, { action: "speakers", id, op: "rename", group: "Q", name: "x" })).error, "an unknown letter is refused");
// match again keeps confirmed choices
r = await api(NAJ, { action: "speakers", id, op: "match" });
ok(r.ok && r.speakers.some((x) => x.name === "Example Beta" && x.confirmed && x.labels.length === 3), "suggest again never undoes a confirmed speaker", r.speakers);

// notes and minutes see named speakers; owners by name
r = await api(NAJ, { action: "read", id, kind: "minutes" }); while (r.state === "reading") r = await api(NAJ, { action: "read", id, kind: "minutes" });
ok(r.state === "ready", "minutes job finishes", r);
ok(/Example Beta: Budget is agreed/.test(env.__notesUser || "") && /never guess/.test(env.__notesSys || ""), "the notes prompt gets named lines and the speaker rule");
ok(/Example Beta:/.test(env.__minUser || "") && /never guess/.test(env.__minSys || ""), "the minutes prompt gets named lines and the speaker rule");
ok(JSON.parse(store.get("recw_" + id)).minutes.actions[0].owner === "Example Beta", "minutes action carries an owner by name");

// bridge meeting route: speakers + named transcript
{ const br = await worker.fetch(new Request("https://w/momo/bridge/v1/meeting?id=" + id, { headers: { Authorization: "Bearer " + NB } }), env, ctx); const j = await br.json();
  ok(br.status === 200 && Array.isArray(j.data.speakers) && j.data.speakers.every((s) => "id" in s && "name" in s && "shown_as" in s && "confidence" in s && "confirmed" in s && Array.isArray(s.labels)), "bridge returns speakers in a fixed shape", j.data && j.data.speakers);
  ok(/\[00:01\] Example Alpha: Hello/.test(j.data.transcript), "bridge transcript carries names", j.data && j.data.transcript && j.data.transcript.slice(0, 120)); }

// --- isolation: kendall's recorder runs on his own keys; neither sees the other's speakers
const sk = await api(KEN, { action: "start", title: "His example" }); ok(sk.ok, "kendall starts", sk);
r = await part(KEN, sk.id, 0, 300); ok(r.ok && r.engine === "nova-3", "kendall's part read with speakers", r);
await api(KEN, { action: "finish", id: sk.id, secs: 300 });
ok(store.has("kendall_recw_" + sk.id) && !store.has("recw_" + sk.id) && store.has("kendall_recs_" + sk.id + "_000"), "his recording and parts are on his parallel keys");
ok(JSON.parse(store.get("kendall_recw_" + sk.id)).speakers.groups.every((x) => x.name === ""), "no room list: no names on his speakers", JSON.parse(store.get("kendall_recw_" + sk.id)).speakers);
ok((await api(KEN, { action: "speakers", id })).error && (await api(NAJ, { action: "speakers", id: sk.id })).error, "neither can open the other's speakers");
ok((await call("/momo/work/rec/view?id=" + id, KEN)).status === 404, "he cannot read her transcript");
{ const br = await worker.fetch(new Request("https://w/momo/bridge/v1/meeting?id=" + id, { headers: { Authorization: "Bearer " + KB } }), env, ctx); ok(br.status === 404, "his bridge key cannot read her meeting", br.status); }

// --- old format: a recording with plain parts and no speaker data still renders unchanged
const old = id.slice(0, 8) + "oldfmt"; store.set("recw_" + old, JSON.stringify({ id: old, date: m1.date, title: "Old example", status: "transcribed", secs: 120 }));
store.set("recs_" + old + "_000", JSON.stringify({ n: 0, secs: 60, text: "Old words one." })); store.set("recs_" + old + "_001", JSON.stringify({ n: 1, secs: 60, text: "Old words two." }));
h = await (await call("/momo/work/rec/view?id=" + old, NAJ)).text();
ok(/\[00:00\] Old words one\.<br><br>\[01:00\] Old words two\./.test(h) && !/Speakers<\/h2>/.test(h), "old transcript renders as before, no speaker panel");
ok(W.BRIDGE_LOG.recTranscriptText([{ n: 0, secs: 60, text: "A." }, { n: 1, secs: 60, text: "B." }], true) === "[00:00] A.\n\n[01:00] B.", "old transcript text identical");
ok((await api(NAJ, { action: "speakers", id: old, op: "match" })).error, "match on an old recording says there is no speaker data");
{ const br = await worker.fetch(new Request("https://w/momo/bridge/v1/meeting?id=" + old, { headers: { Authorization: "Bearer " + NB } }), env, ctx); const j = await br.json(); ok(Array.isArray(j.data.speakers) && j.data.speakers.length === 0 && /Old words one/.test(j.data.transcript), "bridge: old meeting has speakers [] and the old transcript"); }

// every page script the Work page serves still parses
for (const pth of ["/momo/work.js", "/momo/work/prep.js"]) { const t = await (await call(pth, NAJ)).text(); try { new Function(t); ok(true); } catch (e) { ok(false, pth + " parses", e.message); } }
console.log("v663 speakers: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
