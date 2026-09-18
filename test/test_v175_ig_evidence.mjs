// v175 — HER OWN ACCOUNT, FED BACK INTO HER MORNING (Kendall, 18 Sep 2026: "we have the instagram data, but what
// have we done with it?"). The answer was: pulled it daily since 16 Sep and read it back to nobody. 119 posts with
// reach, interactions, follows and watch time, one unlinked report, and a morning digest that picked her five angles
// from market data without once looking at what her audience does.
//
// The check that matters here is NOT that the numbers come out. It is that the WEAK end is ranked by how many people
// responded, not by rate. Ranked by rate, her furthest-travelling post of the year — 4,332 reached, about 77
// interactions, twenty times her median reach — came out as one of her four worst, below posts that reached a
// hundred people. Teaching the angle picker that her biggest post was a failure would have been worse than telling
// it nothing, and it read as perfectly sensible output until the reach column was looked at.
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const a = src.indexOf("async function igEvidence(env) {");
const b = src.indexOf("async function dailyFeedTick(env, force, dry) {");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };

ok(a >= 0 && b > a, "igEvidence exists, and above the morning tick that uses it");
const igEvidence = eval("(" + src.slice(a, b).replace(/^async function igEvidence\(env\)/, "async function (env)") + ")");

const envOf = (media, followers, account) => ({ MEETINGS: { async get(k) {
  return k === "ig_media" ? JSON.stringify(media)
    : k === "ig_followers" ? JSON.stringify(followers || [])
    : k === "ig_account" ? JSON.stringify(account || null) : null;
} } });

const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
const post = (id, reach, inter, product, caption, age) => [id, {
  id, at: day(age == null ? 10 : age), product, type: "VIDEO", caption,
  m: { reach, total_interactions: inter },
}];

// --- it says nothing when it has too little to say -------------------------------------------------
const few = Object.fromEntries([...Array(8)].map((_, i) => post("f" + i, 100, 10, "FEED", "a post", 5)));
ok(await igEvidence(envOf(few)) === null, "under a dozen posts it returns null - too little to describe what works, so it says nothing rather than guess");
ok(await igEvidence({ MEETINGS: { async get() { return null; } } }) === null, "and with no Instagram data at all it returns null rather than throwing");

// --- the ranking fault this test exists for --------------------------------------------------------
const rows = [...Array(14)].map((_, i) => post("p" + i, 120, 12, "REELS", "ordinary post " + i, 20 + i));
rows.push(post("viral", 4332, 77, "REELS", "flooded roads, and still headed to that meeting", 30));   // widest of the year, low RATE
rows.push(post("dud", 203, 1, "REELS", "Just launched: a tower, from AED 2.8M, 1 2 and 3 bedrooms", 40)); // genuinely ignored
const out = await igEvidence(envOf(Object.fromEntries(rows), [{ day: "2026-09-18", n: 393 }]));

ok(!!out, "with a year of posts it produces evidence");
const ignored = (out.herIgnored || []).map((r) => r.said);
ok(ignored.some((s) => /Just launched/.test(s)), "the launch announcement that 1 person responded to IS in herIgnored");
ok(!ignored.some((s) => /flooded roads/.test(s)), "but her FURTHEST-travelling post is NOT - 77 people responded, more than any other post here, and rate alone called it a failure");
ok((out.herFurthest || []).some((r) => /flooded roads/.test(r.said)), "it appears in herFurthest instead, where reach is the point");
ok((out.herFurthest || [])[0].reach === 4332, "herFurthest is ordered by reach, widest first");
ok(out.herIgnored.every((r, i, A) => !i || A[i - 1].interactions <= r.interactions), "herIgnored is ordered by people who responded, not by rate");
ok(out.herBest.every((r, i, A) => !i || A[i - 1].engagementPer1000 >= r.engagementPer1000), "herBest is ordered by engagement rate, strongest first");

// --- it must never carry a credential into a prompt ------------------------------------------------
ok(!/ig_auth|access_token|IGQ/.test(JSON.stringify(out)), "the evidence carries no token or auth field - it is about to be put in a prompt");
ok(JSON.stringify(out).length < 8000, "and it stays small enough to sit in the morning prompt beside everything else");

// --- the prompt has to actually USE it, and must not licence a bent figure -------------------------
const sys = src.slice(src.indexOf('const sys = "You pick FIVE distinct'), src.indexOf("Return JSON only."));
ok(/instagram: await igEvidence\(env\)/.test(src), "the evidence is added to the data the morning picker is given");
ok(/Read herBest, herFurthest and herIgnored/.test(sys), "the prompt tells it to read all three lists, not just the flattering one");
ok(/decides the SHAPE of an angle and NEVER a figure/.test(sys), "and that this governs the shape of an angle, never a number");
ok(/licenses no change to any number/.test(sys), "the no-bending rule is restated where the new evidence is introduced, not left to the paragraph above");
ok(/a low rate on a very wide post is not a failure/.test(sys), "the prompt says outright that a wide post with a low rate is not a failure");
ok(/Where the instagram block is absent, ignore this paragraph/.test(sys), "and if the block is missing it is ignored rather than imagined");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
