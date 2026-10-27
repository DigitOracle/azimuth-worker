// v649 - Momo Speaking: the DNA record, "Write it for me" and "Add from invite". Kendall's key only. FAKE data only (public repo).
// The model and the OCR service are stubbed at the network edge, so these run through the real entry point, worker.fetch.
const worker = (await import("../src/index.js")).default;
const { stripVendors, cleanDna, SPK_JS } = await import("../src/work_speaking.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NAJ = "ins_najjuko_TESTKEY0123456789abcd", OWNER = "ins_kendall_0123456789abcdefghij";
const env = { MEETINGS: KV, INSIDER_KEY: NAJ + "," + OWNER, ANTHROPIC_API_KEY: "test-not-real", MISTRAL_API_KEY: "test-not-real" }, ctx = { waitUntil() {}, passThroughOnException() {} };
let lastSys = "", lastUser = "", modelCalls = 0, ocrCalls = 0, writeReplies = [], inviteReply = null; const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  if (String(u).includes("api.mistral.ai")) { ocrCalls++; return new Response(JSON.stringify({ pages: [{ markdown: "Example Forum. Panel. Friday 6 November, 6:30 PM. Example Hotel, Ballroom." }] }), { status: 200 }); }
  if (!String(u).includes("api.anthropic.com")) return realFetch(u, o);
  modelCalls++; const b = JSON.parse(o.body); lastSys = JSON.stringify(b.system || ""); lastUser = JSON.stringify(b.messages || "");
  const out = /INVITATION/.test(lastUser) ? inviteReply : { text: writeReplies.shift() || "A plain bio." };
  return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(out) }], stop_reason: "end_turn" }), { status: 200 });
};
const call = (path, key, body) => worker.fetch(new Request("https://w" + path + "?key=" + encodeURIComponent(key), body === undefined ? {} : { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), env, ctx);
const API = "/momo/work/speaking/api";

// gate: Kendall's key only
for (const k of [NAJ, "", "wrong"]) {
  ok((await call("/momo/work/speaking/dna", k)).status === 404, "DNA GET refused for '" + k.slice(0, 12) + "'");
  const r = await call(API, k, { action: "write", id: "x", kind: "bio" }); ok(r.status === 404 || r.status === 401, "write refused for '" + k.slice(0, 12) + "'", r.status);
}
// DNA: empty, save (sanitised), read back
ok((await (await call("/momo/work/speaking/dna", OWNER)).json()).dna.name === "", "empty DNA before saving");
let r = await (await call(API, OWNER, { action: "save_dna", dna: { name: "Dr. Test Speaker", titles: ["Adjunct Example", 5, ""], employersNamed: ["ExampleCo", "SampleCorp"], teaching: ["Example AI 2.0: Beyond ChatGPT masterclass"],
  roles: [{ title: "Example Lead", org: "Example Org", from: "2024", to: "2026" }, { junk: 1 }], bios: { medium: "Medium fake bio.", evil: "x" }, rules: ["Never name FORBIDDENCO"], extra: "dropped" } })).json();
ok(r.ok && r.dna.name === "Dr. Test Speaker" && r.dna.titles.length === 2 && r.dna.roles.length === 1 && !("extra" in r.dna) && !("evil" in r.dna.bios), "save_dna sanitises", r.dna);
ok(cleanDna({ titles: new Array(50).fill("t") }).titles.length === 12, "titles capped at 12");
// an engagement to write for
await call(API, OWNER, { action: "save_item", item: { id: "ev-1", title: "Example AI 2.0: Beyond ChatGPT masterclass", organiser: "Example Academy", type: "masterclass", date: "2030-01-02", audience: "Business owners" } });
await call(API, OWNER, { action: "set_due", id: "ev-1", due: [{ what: "Send short bio to organiser", by: "2030-01-01" }] });
// write: happy path, rules in the prompt, vendor names stripped except inside the event title
writeReplies = ["Dr. Test Speaker teaches the Example AI 2.0: Beyond ChatGPT masterclass and has worked with Claude and OpenAI tools at ExampleCo."];
r = await (await call(API, OWNER, { action: "write", id: "ev-1", kind: "bio" })).json();
ok(r.ok && r.kind === "bio" && /Beyond ChatGPT masterclass/.test(r.text) && !/Claude|OpenAI/.test(r.text), "write returns text, vendors stripped, event title kept", r.text);
ok(/confidential government developer/.test(lastSys) && /ExampleCo, SampleCorp/.test(lastSys) && /Never name FORBIDDENCO/.test(lastSys) && /SPEAKER RECORD/.test(lastUser) && /Medium fake bio/.test(lastUser), "prompt carries the rules, employers and DNA");
// MODON rejection: first answer names it, the retry is clean
modelCalls = 0; writeReplies = ["He led delivery at MODON Holdings.", "He led delivery at a confidential government developer."];
r = await (await call(API, OWNER, { action: "write", id: "ev-1", kind: "abstract" })).json();
ok(r.ok && modelCalls === 2 && !/modon/i.test(r.text) && /STRICT/.test(lastSys), "a banned name triggers one stricter retry", { calls: modelCalls, text: r.text });
// both answers banned -> error, never the banned text
modelCalls = 0; writeReplies = ["MODON again.", "Still modon."];
const bad = await call(API, OWNER, { action: "write", id: "ev-1", kind: "intro" }); const bj = await bad.json();
ok(bad.status === 502 && !JSON.stringify(bj).toLowerCase().includes("modon") && modelCalls === 2, "two banned answers give an error, not the text", bj);
// write: unknown event, no DNA
ok((await call(API, OWNER, { action: "write", id: "nope", kind: "bio" })).status === 404, "write for an unknown event is 404");
const saved = store.get("dna_rec_kendall"); store.delete("dna_rec_kendall");
ok((await call(API, OWNER, { action: "write", id: "ev-1", kind: "bio" })).status === 400, "write without a DNA asks to load it"); store.set("dna_rec_kendall", saved);
// parse_invite from text
inviteReply = { title: "Example Forum panel", organiser: "Example Forum", type: "panel", date: "2030-11-06", start: "18:30", end: "", venue: "Example Hotel, Ballroom", city: "Dubai", format: "in-person", role: "panelist", audience: "", summary: "A panel on design and AI.", due: [{ what: "Send a headshot", by: "2030-11-01" }] };
r = await (await call(API, OWNER, { action: "parse_invite", text: "Example Forum ... panelist ... 6 Nov 6:30 PM" })).json();
ok(r.ok && r.draft.title === "Example Forum panel" && r.draft.type === "panel" && r.draft.start === "18:30" && r.draft.end === "" && /Role: panelist/.test(r.draft.summary) && r.draft.due.length === 1 && r.draft.status === "proposed", "parse_invite fills a draft and leaves unknowns empty", r.draft);
ok(/Today is \d{4}-\d{2}-\d{2}/.test(lastSys) && /never guess/.test(lastSys), "invite prompt anchors today (GST) and forbids guessing");
ok(!(JSON.parse(store.get("speaking_rec_kendall")).items.some((i) => i.title === "Example Forum panel")), "parse_invite saves nothing by itself");
// parse_invite: bad values are cleaned
inviteReply = { title: "X", type: "party", format: "teleport", date: "6 Nov", start: "6:30 PM" };
r = await (await call(API, OWNER, { action: "parse_invite", text: "x" })).json();
ok(r.ok && r.draft.type === "talk" && r.draft.format === "in-person" && r.draft.date === "" && r.draft.start === "", "invalid type/format/date/time are cleaned", r.draft);
// parse_invite from a photo (OCR stubbed)
inviteReply = { title: "Example Forum panel", type: "panel", date: "2030-11-06" }; ocrCalls = 0;
r = await (await call(API, OWNER, { action: "parse_invite", image: { name: "flyer.jpg", type: "image/jpeg", data: "aGVsbG8=" } })).json();
ok(r.ok && ocrCalls === 1 && /Example Hotel/.test(lastUser), "a photo goes through OCR then the reader", { ocrCalls });
ok((await call(API, OWNER, { action: "parse_invite", image: { name: "x.exe", type: "application/x-msdownload", data: "aGVsbG8=" } })).status === 400, "non-image files are refused");
ok((await call(API, OWNER, { action: "parse_invite", text: "" })).status === 400, "empty invite is refused");
// page: the shim, the invite box and the write menu are present, and the script parses
const page = await (await call("/momo/work/speaking", OWNER)).text();
ok(page.includes("Add from invite") && page.includes("id=iv_go") && SPK_JS.includes("Write it for me") && SPK_JS.startsWith("var __name=function(f){return f};"), "page has the invite box, write menu and the __name shim");
let parses = true; try { new Function(SPK_JS); } catch (e) { parses = false; } ok(parses, "page script parses");
ok(stripVendors("Uses Gemini (and Copilot) daily.", []) === "Uses daily." || !/Gemini|Copilot/.test(stripVendors("Uses Gemini (and Copilot) daily.", [])), "stripVendors removes vendor names");
globalThis.fetch = realFetch;
console.log("v649 speaking write/invite: " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
