// v690 - the morning feed carries the marketing PDF itself (Kendall 1 Nov, option 2). Offline: fake KV, stub renderer and sender.
import fs from "node:fs";
import { feedPdfAngles, feedPdfAutoSend, feedAnglesKey, FEED_PDF_AUTO_CAPTION, FEED_PDF_SETS } from "../src/feed_pdf.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const kv = () => { const m = new Map(); return { m, MEETINGS: { get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } } }; };
const D = "2026-11-01";
const five = [1, 2, 3, 4, 5].map(i => ({ hook: "Market idea " + i, figure: "AED " + i + "00", source: "DLD", buyer: "b", family: "prices" }));
const gen = [1, 2, 3, 4, 5].map(i => ({ hook: "News idea " + i, figure: "f", source: "Khaleej Times", lane: "transport" }));
const ei = [1, 2, 3, 4, 5].map(i => ({ hook: "EMOTIONAL idea " + i, figure: "f", source: "x", lane: "calm" }));
const seed = () => { const s = kv(); const now = Date.now();
  s.m.set(feedAnglesKey(D), JSON.stringify({ at: now, date: D, angles: five }));
  s.m.set("mkt_briefctx", JSON.stringify({ at: now, brief: "MARKET INSIGHT FROM A REAL CLIENT BRIEF", data: "{}", angles: [] }));   // the market brief's overwrite
  s.m.set("mkt_briefctx_general", JSON.stringify({ at: now, angles: gen }));
  s.m.set("mkt_briefctx_ei", JSON.stringify({ at: now, angles: ei }));
  return s; };
const pdf = async () => new Uint8Array([37, 80, 68, 70]);

// 1. the durable key survives the brief overwriting mkt_briefctx; EI excluded
{ const s = seed(); const r = await feedPdfAngles({ MEETINGS: s.MEETINGS }, D);
  ok(r.market === 5, "durable key gives the five even though mkt_briefctx.angles is empty");
  ok(r.angles.length === 10, "five market + five Beyond property = 10");
  ok(!r.angles.some(a => /EMOTIONAL/.test(a.hook)), "Emotional intelligence excluded");
  ok(r.angles.filter(a => a.set === "general").length === 5, "general set included");
  ok(FEED_PDF_SETS.length === 1 && FEED_PDF_SETS[0] === "general", "PDF sets = general only"); }
// fallback to mkt_briefctx.angles when no durable key
{ const s = kv(); s.m.set("mkt_briefctx", JSON.stringify({ at: Date.now(), angles: five })); const r = await feedPdfAngles({ MEETINGS: s.MEETINGS }, D);
  ok(r.market === 5, "falls back to mkt_briefctx.angles"); }
{ const s = kv(); s.m.set("mkt_briefctx", JSON.stringify({ at: Date.now() - 40 * 3600000, angles: five })); ok((await feedPdfAngles({ MEETINGS: s.MEETINGS }, D)).market === 0, "stale fallback ignored"); }

// 2. auto-send: exactly once, public link, caption; window shut sends nothing
{ const s = seed(); const sent = [], errs = [];
  const deps = { origin: "https://azimuth-2.digitalchemy.workers.dev/", renderPdf: pdf, windowOpen: async () => true,
    sendDocument: async (to, link, fn, cap) => { sent.push({ to, link, fn, cap }); return { ok: true }; }, noteErr: async (w, d) => errs.push(w + ":" + d) };
  const env = { MEETINGS: s.MEETINGS };
  const r1 = await feedPdfAutoSend(env, "971500000000", D, deps);
  const r2 = await feedPdfAutoSend(env, "971500000000", D, deps);
  ok(r1.sent && r1.count === 10, "first call sends the 10-idea PDF");
  ok(!r2.sent && r2.why === "already sent", "retried tick does not double-send");
  ok(sent.length === 1, "exactly one document");
  ok(/^https:\/\/azimuth-2\.digitalchemy\.workers\.dev\/img\/feedpdf_[0-9a-f]{24}$/.test(sent[0].link), "public origin link");
  ok(sent[0].fn === "Najma_Market_News_" + D + ".pdf" && sent[0].cap.startsWith(FEED_PDF_AUTO_CAPTION) && /Forward/.test(sent[0].cap), "filename + caption");
  ok(s.m.get("img_ct_" + r1.name) === "application/pdf", "PDF stored");
  ok(!errs.length, "no errors");
  // a fresh set ('feed again') is a different set: one more PDF
  s.m.set(feedAnglesKey(D), JSON.stringify({ at: Date.now(), angles: five.map(a => Object.assign({}, a, { hook: a.hook + " fresh" })) }));
  ok((await feedPdfAutoSend(env, "971500000000", D, deps)).sent && sent.length === 2, "feed again's new set gets its own PDF"); }
{ const s = seed(); let n = 0; const r = await feedPdfAutoSend({ MEETINGS: s.MEETINGS }, "x", D, { renderPdf: pdf, windowOpen: async () => false, sendDocument: async () => { n++; return { ok: true }; }, noteErr: async () => {} });
  ok(!r.sent && n === 0, "24-hour window shut: nothing sent"); }
{ const s = kv(); let n = 0; const r = await feedPdfAutoSend({ MEETINGS: s.MEETINGS }, "x", D, { renderPdf: pdf, sendDocument: async () => { n++; return { ok: true }; }, noteErr: async () => {} });
  ok(!r.sent && n === 0, "no market angles: nothing sent"); }

// 3. failure is logged, never thrown, never retried
{ const s = seed(); const errs = []; let n = 0;
  const deps = { renderPdf: pdf, windowOpen: async () => true, sendDocument: async () => { n++; throw new Error("boom"); }, noteErr: async (w, d) => errs.push(w + ":" + d) };
  let threw = false, r; try { r = await feedPdfAutoSend({ MEETINGS: s.MEETINGS }, "x", D, deps); } catch (e) { threw = true; }
  ok(!threw && r && !r.sent, "send failure does not throw");
  ok(errs.length === 1 && /^feed-pdf-auto:boom/.test(errs[0]), "failure logged via noteErr");
  await feedPdfAutoSend({ MEETINGS: s.MEETINGS }, "x", D, deps); ok(n === 1, "no retry loop after a failure"); }
{ const s = seed(); const errs = [];
  const r = await feedPdfAutoSend({ MEETINGS: s.MEETINGS }, "x", D, { renderPdf: pdf, sendDocument: async () => ({ ok: false, status: 400 }), noteErr: async (w, d) => errs.push(d) });
  ok(!r.sent && errs.length === 1 && /refused: 400/.test(errs[0]), "refused document logged"); }
{ const s = seed(); const errs = [];
  const r = await feedPdfAutoSend({ MEETINGS: s.MEETINGS }, "x", D, { renderPdf: async () => { throw new Error("render down"); }, sendDocument: async () => ({ ok: true }), noteErr: async (w, d) => errs.push(d) });
  ok(!r.sent && /render down/.test(errs[0] || ""), "render failure logged, not thrown"); }

// 4. wiring in the worker
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const tick = src.slice(src.indexOf("async function dailyFeedTick("), src.indexOf("async function dailyFeedTick(") + 60000);
ok(/MEETINGS\.put\(feedAnglesKey\(gstDateStr\(gstNow\(\)\)\)/.test(tick) && tick.indexOf("feedAnglesKey(") > tick.indexOf('put("mkt_briefctx"'), "dailyFeedTick writes the durable key with mkt_briefctx");
const iText = tick.indexOf("await waSend(env, env.WA_ALLOWED, bodyTxt)"), iPdf = tick.indexOf("await feedPdfAuto(env)");
ok(iText > 0 && iPdf > iText && tick.indexOf("return;", iText) < iPdf, "tick path: PDF after the feed text, only after a successful send");
const fl = src.slice(src.indexOf("async function feedFlush("), src.indexOf("async function deliveryWatch("));
ok(fl.indexOf("if (r1 && r1.ok) await feedPdfAuto(env)") > fl.indexOf("waSend(env, env.WA_ALLOWED, p.bodyTxt)"), "flush path: PDF after the held text");
ok(/feed again[\s\S]{0,900}dailyFeedTick\(env, true\)/.test(src), "feed again goes through dailyFeedTick (so it carries the PDF)");
const cmd = src.slice(src.indexOf("if (FEED_PDF_RX.test(text))"), src.indexOf("if (FEED_PDF_RX.test(text))") + 2500);
ok(cmd.includes("feedPdfAngles(env, gstDateStr(gstNow()))") && !cmd.includes("FS.SET_IDS"), "'pdf' command reads the durable key and no longer adds EI");
const helper = src.slice(src.indexOf("async function feedPdfAuto("), src.indexOf("async function feedFlush("));
ok(/ownerWindowOpen\(env\)/.test(helper) && /env\.PUBLIC_ORIGIN/.test(helper) && /catch \(e\)/.test(helper), "helper: window rule, public origin, never throws");
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
