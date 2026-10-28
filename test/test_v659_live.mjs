// v659 - the live room: public QR pages (scale, board, vote, wall), screen behind the event's screen key, one answer per phone. FAKE data only (public repo).
const worker = (await import("../src/index.js")).default;
const { cleanAnswer, summarise } = await import("../src/live_poll.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix }) => ({ keys: Array.from(store.keys()).filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const env = { MEETINGS: KV }, ctx = { waitUntil() {}, passThroughOnException() {} };
const cfg = { title: "Fake Workshop", screenKey: "scr_TESTKEY_abcdef", activities: [
  { id: "curve", kind: "scale", title: "Where are you?", max: 5, labels: ["Never used it", "Built an agent"] },
  { id: "board", kind: "board", title: "Tool relay", maxVotes: 2 },
  { id: "vote", kind: "vote", title: "Safe or not", items: [{ id: "s1", text: "Upload a contract to a free tool" }, { id: "s2", text: "Draft an email" }] },
  { id: "wall", kind: "wall", title: "Commit" } ] };
store.set("live_cfg_fake", JSON.stringify(cfg));
const req = (p, o) => worker.fetch(new Request("https://w" + p, o), env, ctx);
const post = (p, b, cookie) => req(p, { method: "POST", headers: Object.assign({ "content-type": "application/json", "CF-Connecting-IP": "1.1.1." + Math.floor(Math.random() * 200) }, cookie ? { Cookie: "live_pid=" + cookie } : {}), body: JSON.stringify(b) });
// pages
ok((await req("/live/fake")).status === 200 && /Fake Workshop/.test(await (await req("/live/fake")).text()), "event index");
ok(/Never used it/.test(await (await req("/live/fake/curve")).text()), "scale page shows labels");
ok(/not open/.test(await (await req("/live/nothere/x")).text()), "unknown event");
ok((await req("/live/fake/curve/screen")).status === 401 && (await req("/live/fake/curve/screen?k=wrong")).status === 401, "screen needs the key");
ok(/answered/.test(await (await req("/live/fake/curve/screen?k=scr_TESTKEY_abcdef")).text()), "screen opens with the key");
ok((await req("/live/fake/curve/data")).status === 401, "data needs the key");
// scale: one phone, one answer, overwritten
let r = await post("/live/fake/curve/api", { value: 4 }, "phoneaaa1");
ok(r.status === 200 && (await r.json()).ok, "scale answer");
await post("/live/fake/curve/api", { value: 2 }, "phoneaaa1"); await post("/live/fake/curve/api", { value: 5 }, "phonebbb2");
let d = await (await req("/live/fake/curve/data?k=scr_TESTKEY_abcdef")).json();
ok(d.summary.total === 2 && d.summary.counts.join() === "0,1,0,0,1", "second tap replaced the first; counts", d.summary);
ok((await post("/live/fake/curve/api", { value: 9 }, "phoneccc3")).status === 400, "out of range refused");
// board + votes
await post("/live/fake/board/api", { text: "ChatGPT wrote a 3-line email", table: "Table 1" }, "t1phone00");
await post("/live/fake/board/api", { text: "Claude asked two questions first", table: "Table 2" }, "t2phone00");
r = await post("/live/fake/board/api", { voteFor: "t2phone00" }, "t1phone00"); ok((await r.json()).ok, "vote");
r = await post("/live/fake/board/api", { voteFor: "t1phone00" }, "t1phone00"); ok(r.status === 400, "cannot vote for yourself");
let p = await (await req("/live/fake/board/posts")).json();
ok(p.posts.length === 2 && p.posts[0].table === "Table 2" && p.posts[0].votes === 1, "board posts sorted by votes, votes kept", p);
d = await (await req("/live/fake/board/data?k=scr_TESTKEY_abcdef")).json(); ok(d.summary.posts[0].votes === 1, "screen sees the vote");
// vote
await post("/live/fake/vote/api", { answers: { s1: "off-limits", s2: "safe", s9: "safe" } }, "v1");
await post("/live/fake/vote/api", { answers: { s1: "risky" } }, "v2");
d = await (await req("/live/fake/vote/data?k=scr_TESTKEY_abcdef")).json();
ok(d.summary.items[0].counts["off-limits"] === 1 && d.summary.items[0].counts.risky === 1 && d.summary.items[1].counts.safe === 1, "vote counts", d.summary);
ok((await post("/live/fake/vote/api", { answers: { s1: "maybe" } }, "v3")).status === 400, "unknown option refused");
// wall + sanitising
await post("/live/fake/wall/api", { text: "  Try an agent for   invoices <b>x</b> " }, "w1");
d = await (await req("/live/fake/wall/data?k=scr_TESTKEY_abcdef")).json();
ok(d.summary.posts[0].text === "Try an agent for invoices <b>x</b>" && /&lt;b&gt;/.test(await (await req("/live/fake/wall/screen?k=scr_TESTKEY_abcdef")).text()) === false, "wall text trimmed; screen escapes at draw time");
ok((await post("/live/fake/wall/api", { text: "x" }, "w2")).status === 400, "too short refused");
// closed
store.set("live_cfg_fake", JSON.stringify(Object.assign({}, cfg, { closed: true })));
ok((await post("/live/fake/wall/api", { text: "late one" }, "w3")).status === 403, "closed room refuses");
// no cookie: a pid is issued
r = await post("/live/fake/curve/api", { value: 3 }); ok(r.status === 403, "closed applies to all");
ok(cleanAnswer({ kind: "scale", max: 5 }, { value: "3" }).value === 3 && cleanAnswer({ kind: "nope" }, {}) === null, "cleanAnswer");
ok(summarise({ kind: "scale", max: 3 }, [{ value: 1 }, { value: 3 }]).counts.join() === "1,0,1", "summarise scale");
console.log(pass + " passed, " + fail + " failed"); if (fail) process.exit(1);
