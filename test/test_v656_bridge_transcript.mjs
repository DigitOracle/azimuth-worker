// v656 - the Momo bridge meeting route carries the transcript and the minutes in a fixed shape; a note can carry an https link. FAKE keys and FAKE data only (the worker repo is public).
const worker = (await import("../src/index.js")).default;
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NB = "brg_najjuko_FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE01", KB = "brg_kendall_FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE02", NAJ_LINK = "ins_najjuko_TESTKEY0123456789abcd";
const env = { MEETINGS: KV, INSIDER_KEY: NAJ_LINK, MOMO_BRIDGE_KEYS: "najjuko:" + NB + ", kendall:" + KB }, ctx = { waitUntil() {}, passThroughOnException() {} };
const B = "https://w/momo/bridge/v1/";
const call = async (path, { key, method = "GET", body, idem } = {}) => {
  const h = {}; if (key) h.Authorization = "Bearer " + key; if (idem) h["Idempotency-Key"] = idem; if (body) h["Content-Type"] = "application/json";
  const r = await worker.fetch(new Request(B + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined }), env, ctx);
  let j = null; try { j = await r.clone().json(); } catch (e) {} return { s: r.status, j, r };
};
const today = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10), d = today.replace(/-/g, "");
const rec = (id, extra) => store.set("recw_" + id, JSON.stringify(Object.assign({ id, date: today, started: today + "T09:00:00Z", title: "Example meeting", status: "filed", secs: 120 }, extra || {})));
const A = d + "aaaaa", N = d + "bbbbb", T = d + "ccccc";
rec(A, { minutes: { title: "Example minutes", purpose: "Example purpose", decisions: [{ headline: "Example decision", detail: "Detail" }], discussion: [{ heading: "Example topic", bullets: ["One", "Two"] }], actions: [{ action: "Example action", owner: "Example owner", due: "Friday", due_stated: true }], open_questions: ["Example question"], extra_field: "dropped" } });
store.set("recs_" + A + "_000", JSON.stringify({ n: 0, secs: 60, text: "Hello, this is an example." }));
store.set("recs_" + A + "_001", JSON.stringify({ n: 1, secs: 60, text: "Second part of the example." }));
rec(N);
rec(T); store.set("recs_" + T + "_000", JSON.stringify({ n: 0, secs: 60, text: "x".repeat(410000) }));

let r = await call("meeting?id=" + A, { key: NB });
ok(r.s === 200 && r.j.data.transcript_status === "ready" && /\[00:00\] Hello/.test(r.j.data.transcript) && /\[01:00\] Second part/.test(r.j.data.transcript) && r.j.data.transcript_chars === r.j.data.transcript.length, "transcript ready, parts in order with markers", r.j);
const mn = r.j.data.minutes;
ok(mn && Object.keys(mn).sort().join() === "actions,decisions,discussion,open_questions,purpose,title" && mn.actions[0].owner === "Example owner" && mn.discussion[0].bullets.length === 2 && mn.decisions[0].headline === "Example decision", "minutes in the fixed shape, unknown fields dropped", mn);
r = await call("meeting?id=" + N, { key: NB });
ok(r.s === 200 && r.j.data.transcript_status === "not_transcribed" && r.j.data.transcript === "" && r.j.data.minutes === null, "no transcript yet", r.j);
r = await call("meeting?id=" + T, { key: NB });
ok(r.s === 200 && r.j.data.transcript_status === "too_long_truncated" && r.j.data.transcript.length === 400000 && r.j.data.transcript_chars > 400000, "long transcript truncated at 400k", r.j && { st: r.j.data.transcript_status, n: r.j.data.transcript_chars });
ok((await call("meeting?id=" + A, { key: KB })).s === 403, "kendall key cannot read her meeting");
ok((await call("meeting?id=" + A)).s === 401, "no key: 401");

// note with a link
r = await call("note", { key: NB, method: "POST", body: { type: "meeting", id: A, text: "Minutes published.", link: { url: "https://example.vercel.app/minutes", label: "Minutes" } }, idem: "note-link-0001" });
ok(r.s === 200 && r.j.data.added_notes[0].link.url === "https://example.vercel.app/minutes" && r.j.data.added_notes[0].link.label === "Minutes", "note with an https link stored", r.j);
for (const bad of ["http://example.com/x", "javascript:alert(1)", "https://exa mple.com", "https://example.com/" + "a".repeat(500)])
  ok((await call("note", { key: NB, method: "POST", body: { type: "meeting", id: A, text: "x", link: { url: bad } }, idem: "note-bad-" + bad.length + bad.slice(0, 4) })).s === 400, "rejected link " + bad.slice(0, 30));
r = await call("note", { key: NB, method: "POST", body: { type: "meeting", id: A, text: "Long label.", link: { url: "https://example.com/a", label: "L".repeat(200) } }, idem: "note-link-0002" });
ok(r.s === 200 && r.j.data.added_notes[1].link.label.length === 80, "label capped at 80");
store.set("work_naj_" + today + "_abc123", JSON.stringify({ id: "abc123", date: today, created: today + "T08:00:00Z", title: "Example entry", type: "Meeting", summary: "x", people: [], kpis: [], scope: [], works: [], effort: "1-2 hours", text: "Notes." }));
r = await call("note", { key: NB, method: "POST", body: { type: "entry", id: today + "_abc123", text: "Brief ready.", link: { url: "https://example.com/brief", label: "Brief" } }, idem: "note-link-0003" });
ok(r.s === 200 && /Brief ready\. Brief: https:\/\/example\.com\/brief/.test(r.j.data.text), "entry note carries the link in the text", r.j);
ok((await call("note", { key: KB, method: "POST", body: { type: "meeting", id: A, text: "x", link: { url: "https://example.com" } }, idem: "note-kendall-01" })).s === 403, "kendall key cannot add a note to her meeting");

// the app's recording page shows the added notes with a tappable link
const v = await worker.fetch(new Request("https://w/momo/work/rec/view?id=" + A + "&key=" + NAJ_LINK), env, ctx), html = await v.text();
ok(v.status === 200 && /<h2>Added notes<\/h2>/.test(html) && /<a href="https:\/\/example\.vercel\.app\/minutes" target=_blank rel=noopener>Minutes<\/a>/.test(html), "recording page shows the link", v.status + " " + html.slice(0, 200));
console.log(`v656 bridge transcript: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
