// v555 - Ask Najma at the top of START: the box, its states (thinking, clarify, answer with sources and what was checked), the stub engine
import fs from "node:fs";
import { askBoxHtml, askStub, askRoute, ASK, ASK_OFF_TEXT } from "../src/ask_najma.js";
ASK.on = true;   // v598: the switch is OFF in production; these checks exercise the code with it on
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const h = askBoxHtml("k1", "analyst");
ok(/placeholder="Ask Najma about any building, area, developer or rent"/.test(h) && /Research use only/.test(h) && /data-mode="analyst"/.test(h), "the box, its placeholder and the research-use line");
ok(!/[\u{1F44D}\u{1F44E}]/u.test(h) && /<svg/.test(h), "icons, never emoji");
const { ASK_FILE_JS } = await import("../src/ask_najma.js"); const js = ASK_FILE_JS;
try { new Function(js); pass++; } catch (e) { fail++; console.log("FAIL the box script does not parse", e.message); }
const w = askStub({ question: "Tell me about Windsor Manor" });
ok(w.status === "answer" && w.facts.length === 3 && w.facts.every((f) => f.table === "stub") && w.trace.length >= 3 && w.trace.every((t) => t.step), "Windsor Manor: an answer, three facts marked stub, and what was checked", w);
const a = askStub({ question: "rents in arabian ranches" });
ok(a.status === "clarify" && a.clarify.options.length === 3 && a.trace.length >= 1, "Arabian Ranches: asks which one", a);
ok(askStub({ question: "x", clarification: { mention: "arabian ranches", choice: "arabianranches2" } }).status === "not_held", "an unknown question says it is not held");
const req = (body, path, tier) => askRoute(new Request("https://w" + path, { method: "POST", body: JSON.stringify(body) }), { MEETINGS: { put: async () => {} } }, new URL("https://w" + path + "?key=k"), { keyTier: () => tier });
ok((await req({ question: "windsor manor" }, "/ask", "client")).status === 404, "a client key gets nothing while the engine is a stub");
const r = await (await req({ question: "windsor manor", mode: "analyst", session_id: "s" }, "/ask", "admin")).json();
ok(r.status === "answer", "the owner gets the stub answer", r);
ok((await (await req({ session_id: "s", question_id: "q", rating: 1 }, "/ask/feedback", "admin")).json()).ok === true, "thumbs are recorded");
const idx = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/startBody\(key, rk, true\)\.replace\("<div class=tag>THE BRIEF", '<div id=askhero>' \+ askBoxHtml\(key, "analyst"\)/.test(idx), "v556: the box sits in the header above THE BRIEF, owner links only");
const { askFloatHtml } = await import("../src/ask_najma.js"); const fl = askFloatHtml("k");
ok(/class=askfab/.test(fl) && /left:14px;bottom:calc\(74px/.test(fl) && /fetch\("\/ask\/ok\?key="/.test(ASK_FILE_JS) && !/<script>/.test(fl), "v556: the floating Ask, bottom-left above the tab bar, shown only when /ask/ok allows");
ok(/\+ askFloatHtml\(key\);/.test(idx), "v556: every page with the tab bar carries it");
ok((await askRoute(new Request("https://w/ask/ok"), {}, new URL("https://w/ask/ok?key=k"), { keyTier: () => "client" })).status === 404, "v556: a client link is told no, so the button stays hidden");
// v557 - the real engine when set; offline message when it does not answer
{ const calls = []; globalThis.fetch = async (u, init) => { calls.push({ u, h: init.headers }); return new Response(JSON.stringify({ status: "answer", answer_md: "live" })); };
  const env2 = { MEETINGS: { put: async () => {} }, ASK_ENGINE_URL: "https://ask.example.io/", ASK_SECRET: "s3" };
  const j = await (await askRoute(new Request("https://w/ask", { method: "POST", body: JSON.stringify({ question: "x" }) }), env2, new URL("https://w/ask?key=k"), { keyTier: () => "admin" })).json();
  ok(j.answer_md === "live" && calls[0].u === "https://ask.example.io/ask" && calls[0].h["X-Ask-Secret"] === "s3", "v557: forwards to the engine with the shared secret", calls);
  globalThis.fetch = async () => { throw new Error("down"); };
  const j2 = await (await askRoute(new Request("https://w/ask", { method: "POST", body: JSON.stringify({ question: "x" }) }), env2, new URL("https://w/ask?key=k"), { keyTier: () => "admin" })).json();
  ok(j2.status === "error" && /offline/.test(j2.answer_md) && !/24 floors/.test(j2.answer_md), "v557: engine down - says offline, never the stub figures", j2); }
// v558 - one retry after a refused connection (engine restart); a not_held answer passes through as an answer
{ let n = 0; globalThis.fetch = async () => { if (++n === 1) throw new Error("refused"); return new Response(JSON.stringify({ status: "not_held", reason_code: "no_template", answer_md: "plain" })); };
  const env3 = { MEETINGS: { put: async () => {} }, ASK_ENGINE_URL: "https://e", ASK_SECRET: "s" };
  const j3 = await (await askRoute(new Request("https://w/ask", { method: "POST", body: JSON.stringify({ question: "x" }) }), env3, new URL("https://w/ask?key=k"), { keyTier: () => "admin" })).json();
  ok(n === 2 && j3.status === "not_held" && j3.answer_md === "plain", "v558: retries once, then passes the engine's not_held answer through", j3); }
// v559 - brief answers: headline, cards, note, follow-up chips; the trace and the full report collapsed; a trace detail that is not a sentence is never shown
ok(/askhl/.test(ASK_FILE_JS) && /askcards/.test(ASK_FILE_JS) && /details_md/.test(ASK_FILE_JS) && /askfu/.test(ASK_FILE_JS), "v559: headline, cards, full report toggle and follow-up chips");
ok(/typeof x\.detail==="string"/.test(ASK_FILE_JS) && /<details class=asksrc><summary>What I checked/.test(ASK_FILE_JS), "v559: What I checked is collapsed and never shows [object Object]");
// v598: with the switch OFF (production) nothing of Ask Najma is drawn or called
ASK.on = false;
const { askFloatHtml: floatOff } = await import("../src/ask_najma.js");
ok(askBoxHtml("k", "analyst") === "" && floatOff("k") === "", "switched off: no box and no floating Ask button");
let engineCalled = false; const rf = globalThis.fetch; globalThis.fetch = async () => { engineCalled = true; return { ok: true, text: async () => "{}" }; };
const envOn = { MEETINGS: { put: async () => {} }, ASK_ENGINE_URL: "https://engine.test", ASK_SECRET: "x" };
const offR = await askRoute(new Request("https://w/ask?key=k", { method: "POST", body: JSON.stringify({ question: "rents in marina" }) }), envOn, new URL("https://w/ask?key=k"), { keyTier: () => "admin" });
const offJ = await offR.json();
ok(offJ.status === "disabled" && offJ.answer_md === ASK_OFF_TEXT && !engineCalled, "switched off: /ask answers 'disabled' and never calls the engine", offJ);
const offF = await askRoute(new Request("https://w/ask/feedback?key=k", { method: "POST", body: JSON.stringify({ rating: 1 }) }), envOn, new URL("https://w/ask/feedback?key=k"), { keyTier: () => "admin" });
ok((await offF.json()).status === "disabled" && !engineCalled, "switched off: feedback goes nowhere");
const offOk = await askRoute(new Request("https://w/ask/ok?key=k"), envOn, new URL("https://w/ask/ok?key=k"), { keyTier: () => "admin" });
ok(offOk.status === 404, "switched off: the entry-point check says no, so the button never appears");
const offJs = await (await askRoute(new Request("https://w/ask.js"), envOn, new URL("https://w/ask.js"), { keyTier: () => "admin" })).text();
ok(!/askfab|fetch\(/.test(offJs), "switched off: the page script is empty");
globalThis.fetch = rf;
console.log(`v555 ask najma: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
