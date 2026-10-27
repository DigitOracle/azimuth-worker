// v637 - Momo Jobs: Create CV (cvdraft) and What I do (whatido). HER KEY ONLY: the owner's insider key gets 404 on both, on the shared record's personal fields and on the CV files. FAKE data only (public repo).
// The model is stubbed at the network edge (api.anthropic.com), so these run through the real entry point, worker.fetch.
const worker = (await import("../src/index.js")).default;
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NAJ = "ins_najjuko_TESTKEY0123456789abcd", OWNER = "ins_kendall_0123456789abcdefghij";
const env = { MEETINGS: KV, INSIDER_KEY: NAJ + "," + OWNER, ANTHROPIC_API_KEY: "test-not-real" }, ctx = { waitUntil() {}, passThroughOnException() {} };
let lastUser = "", lastSys = "", modelCalls = 0, mode = "ok"; const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  if (!String(u).includes("api.anthropic.com")) return realFetch(u, o);
  modelCalls++; const b = JSON.parse(o.body); lastSys = JSON.stringify(b.system || ""); lastUser = JSON.stringify(b.messages || "");
  if (mode === "down") return new Response("x", { status: 500 });
  const out = /GENERALISE/.test(lastSys)
    ? { lines: ["Plans and runs a weekly team meeting for a ten-person group.", "Wrote a plan worth AED 2,000,000 for Sally Zehil's team.", "Coordinates content with designers and video editors.", "Plans and runs a weekly team meeting for a ten-person group."], skills: ["Planning", "Team leadership", "Sally Zehil"] }
    : { headline: "Marketing Manager", profile: "A short profile.", bullets: ["Plans and runs a weekly team meeting.", "Coordinates content with designers."], skills: ["Planning"], gaps: ["Paid search experience"] };
  return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(out) }], stop_reason: "end_turn" }), { status: 200 });
};
const call = (path, key, body) => worker.fetch(new Request("https://w" + path + "?key=" + encodeURIComponent(key), body === undefined ? {} : { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), env, ctx);
const ADVERT = "We are looking for a Marketing Manager to lead brand campaigns, manage an agency, run paid search and report on results every month. ".repeat(2);

// v639: the second key (ins_kendall_*) is a PERSON of its own: it never reaches her Work log, her record or her CV files; it has its own empty record
for (const p of ["/momo/work/jobs/whatido"]) { const r = await call(p, OWNER, { action: "suggest" }); ok(r.status === 404, "second key refused on POST " + p, r.status); }
{ const r = await call("/momo/work/jobs/whatido", OWNER); ok(r.status === 404, "second key refused on GET whatido", r.status); }
ok((await call("/momo/work/jobs", OWNER)).status === 200, "second key opens the page");
store.set("jobs_rec_najjuko", JSON.stringify({ v: 2, profile: { name: "Fake Person", bio: "A fake bio of enough length.", email: "fake@example.com", phone: "000", direct: "3", indirect: "17" }, docs: { MKT: "https://example.com/cv" } }));
const orec = await (await call("/momo/work/jobs/rec", OWNER)).json(); ok(orec.me === true && orec.canWhat === false && orec.person === "kendall" && !orec.profile.name && !orec.profile.email && !orec.profile.bio && !Object.keys(orec.docs).length, "second key reads its OWN empty record, never hers", orec);
const hrec = await (await call("/momo/work/jobs/rec", NAJ)).json(); ok(hrec.me === true && hrec.canWhat === true && hrec.profile.name === "Fake Person", "her key reads her record", hrec.me);
for (const k of ["", "wrong"]) { const r = await call("/momo/work/jobs/whatido", k); ok(r.status === 404, "no/wrong key refused: '" + k + "'", r.status); }

// What I do: empty log -> clear message, no model call
let before = modelCalls; let r = await call("/momo/work/jobs/whatido", NAJ, { action: "suggest" }); let j = await r.json(); ok(r.status === 400 && /Work log/.test(j.error) && modelCalls === before, "empty Work log: asked to log first, no model call", j);
// with entries: lines are generalised (names, money, duplicates dropped)
store.set("work_naj_2026-10-05_a", JSON.stringify({ date: "2026-10-05", created: "1", title: "Monday huddle", type: "Meeting", summary: "Ran the huddle with Sally Zehil.", kpis: [1], people: ["Sally Zehil"] }));
store.set("work_naj_2026-10-06_b", JSON.stringify({ date: "2026-10-06", created: "2", title: "Content plan", type: "Planning", summary: "Planned the week with designers.", kpis: [2] }));
r = await call("/momo/work/jobs/whatido", NAJ, { action: "suggest" }); j = await r.json();
ok(r.status === 200 && j.ok, "suggest works with entries", j);
const texts = (j.what && j.what.lines || []).map((l) => l.text);
ok(texts.length === 2 && texts.every((t) => !/Sally|AED/i.test(t)), "named / money lines dropped, duplicate merged", texts);
ok(!(j.what.skills || []).some((s) => /Sally/i.test(s)), "a named skill is dropped", j.what.skills);
ok(texts.every((t) => !/work_naj/.test(t)), "no raw keys in lines");
// keep one, save, owner cannot read it
const keep = j.what.lines.map((l, i) => Object.assign({}, l, { state: i === 0 ? "keep" : "suggested", text: l.text + (i === 0 ? " (edited)" : "") }));
r = await call("/momo/work/jobs/whatido", NAJ, { action: "save", lines: keep, skills: ["Planning", "Planning", "  "] }); j = await r.json();
ok(j.ok && j.what.lines[0].state === "keep" && /edited/.test(j.what.lines[0].text) && j.what.skills.length === 1, "keep + edit + de-duplicated skills saved", j);
ok(store.has("jobs_whatido_najjuko"), "stored under her own key");
// suggest again keeps what she kept
j = await (await call("/momo/work/jobs/whatido", NAJ, { action: "suggest" })).json(); ok(j.what.lines.filter((l) => l.state === "keep").length === 1, "a second suggest keeps her kept line", j.what && j.what.lines.length);

// Create CV
before = modelCalls; r = await call("/momo/work/jobs/cvdraft", NAJ, { title: "Marketing Manager", company: "Fake Co", desc: "too short" }); ok(r.status === 400 && modelCalls === before, "short advert refused, no model call", r.status);
r = await call("/momo/work/jobs/cvdraft", NAJ, { title: "", desc: ADVERT }); ok(r.status === 400, "no role refused", r.status);
r = await call("/momo/work/jobs/cvdraft", NAJ, { title: "Marketing Manager", company: "Fake Co", desc: ADVERT, group: "MKT" }); j = await r.json();
ok(r.status === 200 && j.ok && j.draft.headline && j.draft.bullets.length === 2 && j.draft.gaps[0] === "Paid search experience", "draft returned in the schema", j);
ok(/Fake Person/.test(lastUser) && /edited/.test(lastUser) && /Marketing Manager/.test(lastUser), "the model got HER record, her kept lines and the advert");
ok(!/Sally|fake@example\.com|000/.test(lastUser.replace(/Fake Person/g, "")), "email, phone and names stay out of the model request", lastUser.slice(0, 160));
ok(/must NOT invent/i.test(lastSys), "the no-invention rule is in the instruction");
mode = "down"; r = await call("/momo/work/jobs/cvdraft", NAJ, { title: "Marketing Manager", desc: ADVERT }); ok(r.status === 502, "model down: clear 502, nothing stored", r.status); mode = "ok";
// no facts at all
store.delete("jobs_whatido_najjuko"); store.set("jobs_rec_najjuko", JSON.stringify({ v: 2, profile: { name: "Fake Person" } }));
r = await call("/momo/work/jobs/cvdraft", NAJ, { title: "Marketing Manager", desc: ADVERT }); j = await r.json(); ok(r.status === 400 && /Approve some lines/.test(j.error), "no approved lines and no bio: asked for facts first", j);
// the feed keeps x, strips tags, caps it
const { cleanFeed } = await import("../src/work_jobs.js");
const f = cleanFeed({ jobs: [{ t: "A", c: "B", u: "https://example.com/a", x: "<p>Hello <b>world</b></p>" + "y".repeat(3000) }, { t: "C", c: "D", u: "https://example.com/b" }] });
ok(f.jobs[0].x.startsWith("Hello world") && f.jobs[0].x.length === 2000 && f.jobs[1].x === "", "feed keeps x (tags stripped, 2000 cap), optional", f.jobs.map((q) => q.x.length));
// the page for her carries the new controls, none of her data
const pg = await (await call("/momo/work/jobs", NAJ)).text(); ok(/cvdSec/.test(pg) && /whatSec/.test(pg) && /Create CV/.test(pg) && !/Fake Person/.test(pg), "page has Create CV and What I do, no personal data in code");
globalThis.fetch = realFetch; console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
