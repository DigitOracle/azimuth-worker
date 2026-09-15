// v153 - question notes (15 Sep 2026): what Naj is asked that the app cannot answer, noted from the app (typed or hold-to-talk), from WhatsApp
// ("?..." or a voice note starting "question") and from empty FIND searches; stored as qn_ records with personal details out and never a key;
// read only through /questions/export with the ingest token. Through the real worker with KV, Workers AI and the WhatsApp API stubbed; the
// helpers are also lifted out of the source and checked on their own. Nothing leaves this machine.
import worker from "../src/index.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const parses = (code, ext) => { const f = path.join(os.tmpdir(), "v153_" + Math.random().toString(36).slice(2) + ext); fs.writeFileSync(f, code); try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); return true; } catch (e) { console.log(String(e.stderr || e.message).slice(0, 600)); return false; } finally { try { fs.unlinkSync(f); } catch (e) {} } };
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");

const READ = "client_read_key_in_links_123";
const RES = "residents_private_key_0123456789abcdef";
const ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";
const mkKV = () => {
  const store = new Map();
  return { store, async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
    async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).sort().map(name => ({ name })), list_complete: true }; } };
};
const aiCalls = []; let aiText = "", aiThrow = false;
const AI = { async run(model, input) { aiCalls.push([model, input]); if (aiThrow) throw new Error("model busy"); return { text: aiText }; } };
const graph = [];
globalThis.fetch = async (u, init) => {
  const s = String((u && u.url) || u);
  graph.push({ url: s, init });
  if (/graph\.facebook\.com\/v[\d.]+\/MEDIA_VOICE_\d$/.test(s)) return new Response(JSON.stringify({ url: "https://lookaside.example/" + s.slice(-13) }));
  if (s.startsWith("https://lookaside.example/")) return new Response(new Uint8Array(5000).fill(7));
  if (s.endsWith("/messages")) return new Response(JSON.stringify({ messages: [{ id: "wamid.OUT" }] }));
  return new Response("{}");
};
const kvNaj = mkKV(), kvKen = mkKV();
const envNaj = { MEETINGS: kvNaj, READ_KEY: READ, RESIDENTS_KEY: RES, INGEST_TOKEN: "ING", WA_FORWARD_TOKEN: "FWD_TOKEN_1234", WA_ALLOWED: "971565484397", WHATSAPP_TOKEN: "T", WA_PHONE_ID: "PHONE", AI, MAILBOXES: "", ADD_TO: "", PUBLIC_ORIGIN: ORIGIN };
const ctx = { waitUntil() {} };
const call = (p, init, e) => worker.fetch(new Request(ORIGIN + p, init), e || envNaj, ctx);
const sig = (key, who) => crypto.createHmac("sha256", key).update("azq1|" + who).digest("hex");
const cookieNaj = "azq=naj." + sig(RES, "naj");
const qnKeys = (kv) => [...kv.store.keys()].filter(k => k.startsWith("qn_")).sort();
const lastNote = (kv) => { const k = [...kv.store.keys()].filter(x => x.startsWith("qn_")).at(-1); return k ? JSON.parse(kv.store.get(k)) : null; };   // the newest written (ids in one second sort by their random tail)

// 1. the helpers on their own
const b0 = src.indexOf("// v153 - QUESTION NOTES"), b1 = src.indexOf("// The button and its strip, added straight after <body>");
ok(b0 > 0 && b1 > b0, "source: the question-notes block is where the tests expect it");
const Q = new Function("rid", "ctEq", "residentsKeyOf", "STT", "noteErr", "waPost", "waSend", src.slice(b0, b1) + "\nreturn { QN_PEOPLE, QN_CTX, QN_PAGE, QN_NOISE, qnOwner, qnScrub, qnClean, qnPath, qnFilters, qnRecord, qnWhatsAppText };")(
  () => "k3j9x2ab", (a, b) => String(a) === String(b), () => "", "@cf/openai/whisper-large-v3-turbo", async () => {}, async () => {}, async () => {});
const scrubbed = Q.qnScrub("Call +971 50 123 4567, 050 123 4567, 00971501234567, 55 987 6543 or 04 123 4567; mail naj.test@example.co.ae; EID 784-1990-1234567-1 / 784199012345671; card 4111 1111 1111 1111");
ok(!/\d{3}/.test(scrubbed.replace(/\[[a-z ]+\]/g, "")) && (scrubbed.match(/\[phone\]/g) || []).length === 5 && scrubbed.includes("[email]") && (scrubbed.match(/\[emirates id\]/g) || []).length === 2 && scrubbed.includes("[number]"), "scrub: UAE and international phone numbers, emails, Emirates IDs and long digit runs come out");
const keep = "Is AED 1,250,000 fair for a 2 bed, unit 1204, plot 6457896, handover Q4 2027, service charge AED 18.5 per sq ft, viewing 15.09.2026?";
ok(Q.qnScrub(keep) === keep, "scrub: prices with commas, bedrooms, unit and plot numbers, years and dates are left alone");
ok(Q.qnClean(envNaj, "see /map?key=" + READ + "&rk=" + RES + "\n\n and  token=abc", 200) === "see /map?key=[key]&rk=[key] and token=[key]" && !Q.qnClean(envNaj, "x " + RES).includes(RES), "clean: key values and key= / rk= / token= parameters never survive; whitespace collapses");
ok(Q.qnPath("/r/0123456789abcdef01234567?x=1") === "/r/:id" && Q.qnPath("/area/Dubai%20Hills%20Estate") === "/area/Dubai%20Hills%20Estate" && Q.qnPath("/map?key=" + READ) === "/map" && Q.qnPath("skyline/jltnorth#b") === "/skyline/jltnorth", "path: no query or fragment, and an id-like segment (a client briefing) is masked");
ok(Q.QN_PAGE.test("/find") && Q.QN_PAGE.test("/skyline/jltnorth") && Q.QN_PAGE.test("/area/JVC") && Q.QN_PAGE.test("/residents") && !Q.QN_PAGE.test("/r/0123456789abcdef01234567") && !Q.QN_PAGE.test("/img/x") && !Q.QN_PAGE.test("/wa") && !Q.QN_PAGE.test("/questions/export"), "pages: the app's rooms get the button; client briefings, images, webhooks and the question routes never do");
const rec = Q.qnRecord(envNaj, { by: "someone", via: "fax", kind: "shout", text: "  What is the  DEWA deposit? ring 050 123 4567 ", askedBy: "Investor",
  context: { tab: "map", path: "/map?key=" + READ, community: "Jumeirah Village Circle", comm: "914<x>", project: "Binghatti Crest", project_id: 6457896, unit: { x: 1 }, search: "rk=" + RES, filters: { budget: "AED 1.5M to AED 3M", near_public_beach: true, key: READ, rk: "x", "Bad Key!": "v", n: 3 }, district: "jvc", extra: "dropped" } });
ok(JSON.stringify(Object.keys(rec)) === JSON.stringify(["id", "at", "by", "via", "kind", "text", "askedBy", "context"]) && JSON.stringify(Object.keys(rec.context)) === JSON.stringify(Q.QN_CTX), "record: exactly the agreed fields, every context field present");
ok(/^qn_\d{8}T\d{6}Z_k3j9x2$/.test(rec.id) && !isNaN(Date.parse(rec.at)) && rec.id.slice(3, 11) === rec.at.slice(0, 10).replace(/-/g, ""), "record: id qn_<utc>_<rand> from the same instant as at");
ok(rec.by === "naj" && rec.via === "app" && rec.kind === "typed" && rec.askedBy === "investor" && rec.text === "What is the DEWA deposit? ring [phone]", "record: unknown who/via/kind fall back (the instance owner, app, typed); askedBy normalised; text trimmed and scrubbed");
ok(rec.context.path === "/map" && rec.context.comm === "914x" && rec.context.project_id === "6457896" && rec.context.unit === null && rec.context.search === "rk=[key]" && rec.context.district === "jvc" && !("extra" in rec.context), "record: context cleaned field by field; objects where text belongs become null; unknown fields dropped");
ok(JSON.stringify(rec.context.filters) === JSON.stringify({ budget: "AED 1.5M to AED 3M", near_public_beach: true, badkey: "v", n: 3 }), "record: filters keep plain values under tidy names and never a key");
ok(Q.qnRecord(envNaj, { text: "   " }) === null && Q.qnRecord(envNaj, { text: "x", askedBy: "cousin" }).askedBy === null && Q.qnOwner({ WA_ALLOWED: "971562276093" }) === "kendall" && Q.qnOwner({ WA_ALLOWED: "971565484397" }) === "naj", "record: nothing to say is no note; askedBy is one of the four or null; the owner follows the instance's number");
ok(Q.qnWhatsAppText("text", "? Can a tenant break the lease early?") === "Can a tenant break the lease early?" && Q.qnWhatsAppText("text", "??what about chillers") === "what about chillers" && Q.qnWhatsAppText("text", "?") === "" && Q.qnWhatsAppText("text", "Is this right?") === "", "WhatsApp: a text starting ? is a note without the ?; a bare ? or a question mark later is not");
ok(Q.qnWhatsAppText("audio", "Question, what is the DEWA deposit for a villa?") === "what is the DEWA deposit for a villa?" && Q.qnWhatsAppText("audio", "question: chiller fees in JLT") === "chiller fees in JLT" && Q.qnWhatsAppText("audio", "Questions about the handover.") === "about the handover." && Q.qnWhatsAppText("audio", "Meeting tomorrow with a question list") === "" && Q.qnWhatsAppText("text", "question about x") === "", "WhatsApp: a voice note whose words start with question is a note; the word anywhere else is not; typed 'question' needs the ?");
ok(Q.QN_NOISE.test("Thank you.") && Q.QN_NOISE.test("you") && !Q.QN_NOISE.test("Thank you, what is the service charge?"), "voice: what speech-to-text makes of silence is not a note");

// 2. the button only on Kendall's and Naj's devices
let r = await call("/map?key=" + READ);
let html = await r.text();
ok(r.status === 200 && !html.includes("azq") && !r.headers.get("Set-Cookie"), "client MAP: no button, no cookie");
r = await call("/map?key=" + READ + "&rk=" + RES);
html = await r.text();
const setc = r.headers.get("Set-Cookie") || "";
ok(r.status === 200 && setc.startsWith(cookieNaj + ";") && /; HttpOnly/.test(setc) && /; Secure/.test(setc) && /; SameSite=Lax/.test(setc) && /; Path=\//.test(setc) && /Max-Age=\d{7,}/.test(setc) && !setc.includes(RES), "private MAP: the residents key issues the device cookie (signed, HttpOnly, Secure, Lax), which holds nothing of the key");
ok((html.match(/id=azq-b /g) || []).length === 1 && html.indexOf("<style id=azq-css>") > html.indexOf("<body") && html.indexOf("<style id=azq-css>") < html.indexOf("<div class=top>") && html.includes("Asked by") && html.includes("Hold to talk"), "private MAP: one button, straight after <body>, with its strip (Asked by, hold to talk)");
const strip = (html.match(/<script id=azq-js>([\s\S]*?)<\/script>/) || [])[1] || "";
ok(strip.length > 4000 && parses(strip, ".js") && !strip.includes(READ) && !strip.includes(RES), "the strip's script parses and carries no key");
ok(/"\/questions\/note"/.test(strip) && /"X-Azimuth-Q":"1"/.test(strip) && /credentials:"same-origin"/.test(strip) && /localStorage\.setItem\(QK/.test(strip) && /addEventListener\("online",flush\)/.test(strip), "the strip posts same-origin with its header, and keeps notes on the device when offline until it is back online");
ok(/getUserMedia/.test(strip) && /\["pointerup","pointercancel","lostpointercapture"\]/.test(strip) && /s>=45\)stopRec/.test(strip) && /ms<900/.test(strip) && /visibilitychange[\s\S]{0,80}stopRec\(true\)/.test(strip) && /t\.stop\(\)/.test(strip), "hold-to-talk: records only while held, stops at 45 s, drops a slip under a second or when the page is hidden, and releases the microphone");
ok(/\[S,K\]\.forEach[\s\S]{0,320}stopPropagation/.test(strip) && /B\.addEventListener\(ev,function\(e\)\{e\.stopPropagation\(\)\}\)/.test(strip) && !/location\.(reload|href\s*=)/.test(strip) && !/new Audio|\.play\(/.test(strip), "page state untouched: the strip keeps its taps and keys to itself, never navigates, never makes a sound");
r = await call("/find?key=" + READ, { headers: { Cookie: "other=1; " + cookieNaj } });
html = await r.text();
ok(r.status === 200 && html.includes("id=azq-b") && !r.headers.get("Set-Cookie") && html.includes("window.__qnFind(q.value,rows.length,T)"), "FIND on her device (cookie, no key in the address): the button, and empty searches reach the note hook");
r = await call("/find?key=" + READ);
html = await r.text();
ok(!html.includes("azq") && !html.includes("Asked by") && html.includes("if(window.__qnFind)"), "FIND on a client link: no button and no note code; the hook call does nothing there");
for (const [label, cookie, e] of [["a forged signature", "azq=naj." + "0".repeat(64), null], ["signed with another residents key", "azq=kendall." + sig("some_other_residents_key_000000", "kendall"), null], ["a name that is not Kendall or Naj", "azq=client." + sig(RES, "client"), null], ["the residents key removed from the instance", cookieNaj, Object.assign({}, envNaj, { RESIDENTS_KEY: "" })]]) {
  r = await call("/home?key=" + READ, { headers: { Cookie: cookie } }, e);
  ok(!(await r.text()).includes("azq"), "no button with " + label);
}
r = await call("/map?key=" + READ + "&rk=" + RES + "&me=kendall");
ok((r.headers.get("Set-Cookie") || "").startsWith("azq=kendall." + sig(RES, "kendall") + ";"), "?me=kendall on the private link marks Kendall's device");
r = await call("/map?key=" + READ + "&rk=" + RES, { headers: { Cookie: "azq=kendall." + sig(RES, "kendall") } });
ok((r.headers.get("Set-Cookie") || "").startsWith("azq=kendall."), "a device keeps its owner when the private link is opened again without ?me");
r = await call("/skyline/jltnorth?key=" + READ + "&film=1", { headers: { Cookie: cookieNaj } });
ok(!(await r.text()).includes("azq-b"), "film recordings (?film=1) never show the button");
r = await call("/residents/data?rk=" + RES, { headers: { Cookie: cookieNaj } });
ok(!(r.headers.get("Content-Type") || "").includes("html") && !(await r.text()).includes("azq"), "data routes stay as they are");
ok(src.includes('(window.__qnParts=window.__qnParts||[]).push(function(){if(!state.sel)return {};return {community:nameOf(state.sel).label,comm:String(state.sel)}});') && /var QNH=null;\(window\.__qnParts=window\.__qnParts\|\|\[\]\)\.push/.test(src) && /push\(\(\)=>\{const c=\{district:"\$\{slugName\}"\};/.test(src) && /push\(function\(\)\{if\(!HB\.on\)return \{\};/.test(src) && /window\.__qnCtx=' \+ JSON\.stringify\(/.test(src), "context: the residents page, MAP chrome, district twin, HOMES filters and floor plans each say what is open");
ok(/document\.querySelector\("#panel\.on #rpx"\)/.test(strip) && !/state\.nats|RS\.nats/.test(strip) && !/nats/.test(src.slice(src.indexOf("(window.__qnParts=window.__qnParts||[]).push(function(){if(!state.sel)"), src.indexOf("(window.__qnParts=window.__qnParts||[]).push(function(){if(!state.sel)") + 200)), "context: the residents community only while its detail is open, never the nationality filters");

// 3. POST /questions/note
const noteReq = (body, headers) => call("/questions/note", { method: "POST", headers: Object.assign({ "Content-Type": "application/json", "X-Azimuth-Q": "1", Cookie: cookieNaj }, headers || {}), body: JSON.stringify(body) });
for (const [label, h] of [["no cookie", { Cookie: "" }], ["no X-Azimuth-Q header", { "X-Azimuth-Q": "" }], ["a forged cookie", { Cookie: "azq=naj." + "f".repeat(64) }]]) {
  r = await noteReq({ text: "x" }, h);
  ok(r.status === 404 && !qnKeys(kvNaj).length, "note: " + label + " gets 404 and stores nothing");
}
r = await call("/questions/note", { headers: { Cookie: cookieNaj, "X-Azimuth-Q": "1" } });
ok(r.status === 404, "note: GET is not a way in");
r = await noteReq({ text: "Can the buyer get a Golden Visa at AED 2,000,000? he left 050 123 4567 and a@b.ae", askedBy: "buyer", kind: "typed", context: { tab: "homes", path: "/dev", project: "Sobha Hartland II", search: "key=" + READ, filters: { developer: "sobha" } } });
let j = await r.json();
let note = lastNote(kvNaj);
ok(r.status === 200 && j.ok && j.id === note.id && note.by === "naj" && note.via === "app" && note.kind === "typed" && note.askedBy === "buyer" && note.text === "Can the buyer get a Golden Visa at AED 2,000,000? he left [phone] and [email]" && note.context.search === "key=[key]" && note.context.filters.developer === "sobha", "note: typed, from Naj's device, scrubbed, with its context");
ok(![...kvNaj.store.values()].some(v => typeof v === "string" && (v.includes(READ) || v.includes(RES) || v.includes("050 123 4567"))), "note: no key and no phone number anywhere in the store");
r = await noteReq({ text: "   " });
ok(r.status === 400, "note: an empty note is refused");
const before = qnKeys(kvNaj).length;
r = await noteReq({ text: "Emaar Beach  Vista", kind: "empty_search", askedBy: "buyer", context: { tab: "find", path: "/find", search: "Emaar Beach Vista" } });
j = await r.json(); note = lastNote(kvNaj);
ok(r.status === 200 && j.ok && !j.dup && qnKeys(kvNaj).length === before + 1 && note.via === "auto_search" && note.kind === "empty_search" && note.askedBy === null && note.text === "Emaar Beach Vista" && note.context.tab === "find", "empty FIND search: one note, via auto_search, no asked-by");
r = await noteReq({ text: "emaar beach vista ", kind: "empty_search", context: { tab: "find" } });
j = await r.json();
ok(j.ok && j.dup === true && qnKeys(kvNaj).length === before + 1, "empty FIND search: the same search again that day is not noted twice");
r = await noteReq({ text: "em", kind: "empty_search" });
ok(r.status === 400 && qnKeys(kvNaj).length === before + 1, "empty FIND search: under three letters is not a search");

// 4. POST /questions/voice
const voiceReq = (bytes, meta, headers) => { const fd = new FormData(); fd.append("audio", new Blob([bytes], { type: "audio/webm;codecs=opus" }), "note.webm"); fd.append("meta", JSON.stringify(meta || {})); return call("/questions/voice", { method: "POST", headers: Object.assign({ "X-Azimuth-Q": "1", Cookie: cookieNaj }, headers || {}), body: fd }); };
const audio = new Uint8Array(6000).map((_, i) => (i * 31) % 251);
aiText = "Is the service charge negotiable? Call me on 050 123 4567.";
const kvBefore = new Set(kvNaj.store.keys());
r = await voiceReq(audio, { askedBy: "tenant", context: { tab: "twin", path: "/skyline/jltnorth", project: "Laguna Tower", district: "jltnorth" } });
j = await r.json(); note = lastNote(kvNaj);
ok(r.status === 200 && j.ok && note.kind === "voice" && note.via === "app" && note.askedBy === "tenant" && note.text === "Is the service charge negotiable? Call me on [phone]." && note.context.project === "Laguna Tower", "voice: transcribed in the request and noted like a typed one");
ok(aiCalls.at(-1)[0] === "@cf/openai/whisper-large-v3-turbo" && aiCalls.at(-1)[1].audio === Buffer.from(audio).toString("base64"), "voice: the recording goes to speech-to-text as it was recorded");
const added = [...kvNaj.store.keys()].filter(k => !kvBefore.has(k));
ok(added.every(k => /^qn_|^qnc_/.test(k)) && ![...kvNaj.store.values()].some(v => (typeof v !== "string") || v.includes(Buffer.from(audio).toString("base64").slice(0, 200))), "voice: the audio is not kept anywhere, only the words");
const n0 = qnKeys(kvNaj).length;
aiText = "Thank you.";
r = await voiceReq(audio);
j = await r.json();
ok(r.status === 200 && j.ok === false && j.heard === "" && qnKeys(kvNaj).length === n0, "voice: silence (what the model makes of it) is not a note, and the strip says it did not catch that");
r = await voiceReq(new Uint8Array(100));
j = await r.json();
ok(j.ok === false && j.heard === "" && qnKeys(kvNaj).length === n0, "voice: a slip of a recording is not sent for transcription");
aiThrow = true; aiText = "anything";
r = await voiceReq(audio);
ok(r.status === 502 && qnKeys(kvNaj).length === n0, "voice: a transcription failure is a 502 (the device keeps it and tries again), no note");
aiThrow = false;
r = await voiceReq(audio, {}, { Cookie: "" });
ok(r.status === 404, "voice: no device cookie, no way in");

// 5. GET /questions/export
r = await call("/questions/export");
ok(r.status === 401, "export: no ingest token, 401");
r = await call("/questions/export", { headers: { "X-Azimuth-Ingest": "wrong" } });
ok(r.status === 401, "export: a wrong token, 401");
r = await call("/questions/export", { headers: { Cookie: cookieNaj, "X-Azimuth-Q": "1" } });
ok(r.status === 401, "export: the device cookie is not a way to read notes");
const old = { id: "qn_20260901T080000Z_aaaaaa", at: "2026-09-01T08:00:00.000Z", by: "naj", via: "app", kind: "typed", text: "older one", askedBy: null, context: {} };
kvNaj.store.set(old.id, JSON.stringify(old));
r = await call("/questions/export", { headers: { "X-Azimuth-Ingest": "ING" } });
j = await r.json();
const ats = j.notes.map(x => x.at);
ok(r.status === 200 && JSON.stringify(Object.keys(j)) === '["notes"]' && j.notes.length === qnKeys(kvNaj).length && j.notes[0].id === old.id && ats.every((a, i) => i === 0 || ats[i - 1] <= a), "export: every note, oldest first, as {notes:[...]}");
ok(j.notes.every(x => !("audio" in x)) && !j.notes.some(x => JSON.stringify(x).includes(RES) || JSON.stringify(x).includes(READ)), "export: no audio, no keys");
r = await call("/questions/export?since=" + encodeURIComponent("2026-09-10T00:00:00Z"), { headers: { "X-Azimuth-Ingest": "ING" } });
j = await r.json();
ok(j.notes.length === qnKeys(kvNaj).length - 1 && !j.notes.some(x => x.id === old.id), "export: since leaves out what came before it");
r = await call("/questions/export?since=" + encodeURIComponent(old.at), { headers: { "X-Azimuth-Ingest": "ING" } });
j = await r.json();
ok(j.notes[0].id === old.id, "export: since is inclusive (dedupe on id)");
r = await call("/questions/export?since=yesterday", { headers: { "X-Azimuth-Ingest": "ING" } });
ok(r.status === 400, "export: a since that is not a time is refused");
r = await call("/img/" + old.id);
ok(r.status === 404, "notes are never served under /img");

// 6. WhatsApp
const waBody = (msg) => JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "PHONE" }, messages: [msg] } }] }] });
const wa = (msg, e) => worker.fetch(new Request(ORIGIN + "/wa", { method: "POST", headers: { "Content-Type": "application/json", "X-Azimuth-Forward": e.WA_FORWARD_TOKEN }, body: waBody(msg) }), e, ctx);
graph.length = 0;
const nWa = qnKeys(kvNaj).length;
r = await wa({ from: "971565484397", id: "wamid.Q1", type: "text", text: { body: "? Can a tenant break the lease early? her number is 055 987 6543" } }, envNaj);
note = lastNote(kvNaj);
const sends = graph.filter(g => g.url.endsWith("/messages")).map(g => JSON.parse(g.init.body));
ok(r.status === 200 && qnKeys(kvNaj).length === nWa + 1 && note.by === "naj" && note.via === "whatsapp" && note.kind === "typed" && note.text === "Can a tenant break the lease early? her number is [phone]", "WhatsApp ?: Naj's text becomes a note without the ?, scrubbed");
ok(sends.length === 1 && sends[0].type === "reaction" && sends[0].to === "971565484397" && sends[0].reaction.message_id === "wamid.Q1" && sends[0].reaction.emoji === "✅", "WhatsApp ?: acknowledged with a reaction on her message, and nothing else sent");
ok(!(kvNaj.store.get("wa_inbox") || "").includes("987 6543"), "WhatsApp ?: the inbox log keeps the note without the phone number");
graph.length = 0; aiText = "Question, what is the DEWA deposit for a villa?";
r = await wa({ from: "971565484397", id: "wamid.Q2", type: "audio", audio: { id: "MEDIA_VOICE_1" } }, envNaj);
note = lastNote(kvNaj);
ok(note.kind === "voice" && note.via === "whatsapp" && note.text === "what is the DEWA deposit for a villa?" && graph.filter(g => g.url.endsWith("/messages")).length === 1 && JSON.parse(graph.filter(g => g.url.endsWith("/messages"))[0].init.body).type === "reaction", "WhatsApp voice: a voice note starting 'question' is a voice note without the word, acknowledged the same way");
ok(![...kvNaj.store.values()].some(v => typeof v !== "string"), "WhatsApp voice: the audio is not kept");
// Kendall's instance hands his notes to azimuth-2, and keeps one itself only when that fails
const envKen = Object.assign({}, envNaj, { MEETINGS: kvKen, WA_ALLOWED: "971562276093", QN_STORE: "AZIMUTH_2", AZIMUTH_2: { fetch: (req) => worker.fetch(req, envNaj, ctx) } });
graph.length = 0;
const nNaj = qnKeys(kvNaj).length;
r = await wa({ from: "971562276093", id: "wamid.K1", type: "text", text: { body: "?What do developers charge for a title deed transfer" } }, envKen);
note = lastNote(kvNaj);
ok(qnKeys(kvNaj).length === nNaj + 1 && !qnKeys(kvKen).length && note.by === "kendall" && note.via === "whatsapp" && note.text === "What do developers charge for a title deed transfer", "WhatsApp from Kendall: the note lands in the one store the export reads, marked his");
ok(graph.filter(g => g.url.endsWith("/messages")).length === 1 && JSON.parse(graph.filter(g => g.url.endsWith("/messages"))[0].init.body).to === "971562276093", "WhatsApp from Kendall: his reaction comes from his instance");
const envKenDown = Object.assign({}, envKen, { AZIMUTH_2: { fetch: async () => { throw new Error("unreachable"); } } });
r = await wa({ from: "971562276093", id: "wamid.K2", type: "text", text: { body: "? backup path" } }, envKenDown);
ok(qnKeys(kvKen).length === 1 && JSON.parse(kvKen.store.get(qnKeys(kvKen)[0])).text === "backup path" && qnKeys(kvNaj).length === nNaj + 1, "WhatsApp from Kendall: if azimuth-2 cannot take it, his instance keeps it (and still acknowledges)");
r = await call("/questions/forwarded", { method: "POST", headers: { "X-Azimuth-Forward": "nope", "Content-Type": "application/json" }, body: JSON.stringify({ by: "kendall", text: "x" }) });
ok(r.status === 401, "forwarded notes need the forward token");

// 7. the question bank
r = await call("/ingest_private", { method: "POST", headers: { "X-Azimuth-Ingest": "wrong" }, body: JSON.stringify({ name: "question_bank", json: { questions: [] } }) });
ok(r.status === 401, "question bank: the ingest token is needed");
const bank = { version: 1, questions: [{ id: "q001", text: "What is the service charge per sq ft?", audience: ["buyer", "investor"], tags: ["costs"] }, { id: "q002", text: "Who do I call? 050 123 4567", weight: 2, active: true }] };
r = await call("/ingest_private", { method: "POST", headers: { "X-Azimuth-Ingest": "ING" }, body: JSON.stringify({ name: "question_bank", json: bank }) });
j = await r.json();
const stored = JSON.parse(kvNaj.store.get("priv_question_bank") || "null");
ok(r.status === 200 && j.ok && j.name === "question_bank" && j.scrubbed === 1 && stored.questions[0].text === bank.questions[0].text && stored.questions[1].text === "Who do I call? [phone]" && stored.questions[1].weight === 2 && stored.questions[1].active === true && !!kvNaj.store.get("priv_at_question_bank"), "question bank: stored as sent, with the same scrub, and the reply says how many strings it changed");
r = await call("/img/priv_question_bank");
ok(r.status === 404, "question bank: not served under /img");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
