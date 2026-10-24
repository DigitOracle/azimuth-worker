// v627 - Start over on a recording's screen can delete the recording; deleting leaves no part, no retry audio and no record behind; a deleted recording never comes back.
import { REC_JS } from "../src/work_rec_page.js";
const m = await import("../src/work_log.js");
let pass = 0, fail = 0; const ok = (c, msg, extra) => { if (c) pass++; else { fail++; console.log("FAIL", msg, extra === undefined ? "" : JSON.stringify(extra).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => { const v = store.get(k); return v == null ? null : v; }, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
let aiFail = false;
const env = { MEETINGS: KV, AI: { run: async () => { if (aiFail) throw new Error("engine down"); return { text: "Synthetic words spoken in a synthetic meeting about a synthetic plan." }; } } };
const deps = { isNaj: (e, u) => u.searchParams.get("key") === "K", model: "m", page: (k, rk, b) => "<html>" + b + "</html>", claudeJSON: async () => null };
const call = (path, opt) => { const u = new URL("https://w" + path + (path.includes("?") ? "&" : "?") + "key=K"); return m.workRoute(new Request(u, opt), env, u, deps); };
const api = async (o) => (await call("/momo/work/rec/api", { method: "POST", body: JSON.stringify(o) })).json();
const part = (id, n, secs) => call("/momo/work/rec/chunk?id=" + id + "&n=" + n + "&secs=" + secs, { method: "POST", body: new Uint8Array(5000), headers: { "Content-Type": "audio/mp4" } }).then((r) => r.json());
const keysOf = (id) => [...store.keys()].filter((k) => k.includes(id));

// two recordings: A will be deleted, B must stay exactly as it is
const A = (await api({ action: "start", title: "Test meeting A" })).id;
const B = (await api({ action: "start", title: "Test meeting B" })).id;
ok(A && B && A !== B, "two recordings start");
await part(A, 0, 60); await part(A, 1, 60);
aiFail = true; const pend = await part(A, 2, 30); aiFail = false;
ok(pend.pending, "one part of A failed and its audio is kept for a retry", pend);
await part(B, 0, 60);
store.set("reca_" + A + "_007", "orphan audio");          // a retry audio with no matching text part
store.set("recs_" + A + "_009", JSON.stringify({ n: 9, secs: 5, text: "orphan text" }));   // a text part the list of parts would not find in order
const bBefore = JSON.stringify(keysOf(B).sort().map((k) => [k, store.get(k)]));
ok(keysOf(A).length >= 6, "A holds its record, parts and retry audio", keysOf(A));

// the list shows both
let L = await api({ action: "list" }); ok(L.recs.length === 2, "the list shows both recordings", L.recs.length);

// delete A
const d = await api({ action: "delete", id: A }); ok(d.ok, "delete answers ok", d);
ok(keysOf(A).length === 0, "nothing of A is left in storage (record, parts, retry audio, orphans)", keysOf(A));
ok(JSON.stringify(keysOf(B).sort().map((k) => [k, store.get(k)])) === bBefore, "B is untouched");
L = await api({ action: "list" }); ok(L.recs.length === 1 && L.recs[0].id === B, "A is gone from today's list", L.recs.map((r) => r.id));
ok((await call("/momo/work/rec/view?id=" + A)).status === 404, "A's notes page is gone");
ok((await call("/momo/work/rec/chunk?id=" + A + "&n=5&secs=1", { method: "POST", body: new Uint8Array(5000) })).status === 404, "a late part for A is refused and creates nothing");
ok(keysOf(A).length === 0, "the late part wrote nothing");
ok((await api({ action: "finish", id: A, secs: 10 })).error === "I cannot find that recording.", "A cannot be finished");
ok((await api({ action: "delete", id: A })).error === "I cannot find that recording.", "deleting twice is a clear 404, not a crash");

// a purge that was cut short (record still there, flagged deleted) is still invisible everywhere
store.set("recw_" + B, JSON.stringify({ ...JSON.parse(store.get("recw_" + B)), deleted: true }));
L = await api({ action: "list" }); ok(L.recs.length === 0, "a record flagged deleted never shows in the list", L.recs.length);
ok((await call("/momo/work/rec/view?id=" + B)).status === 404, "a flagged record's page is gone");
ok((await api({ action: "finish", id: B, secs: 10 })).error, "a flagged record cannot be finished");

// a key that is not hers deletes nothing
{ const C = (await api({ action: "start", title: "C" })).id; const u = new URL("https://w/momo/work/rec/api?key=bad"); const r = await m.workRoute(new Request(u, { method: "POST", body: JSON.stringify({ action: "delete", id: C }) }), env, u, deps); ok(r.status === 404 && keysOf(C).length === 1, "a wrong key deletes nothing", r.status); }

// the page: the Start over choice, the recording's own Delete, and no browser confirm for the two-way question
const rv = await (await call("/momo/work/rec/view?id=" + (await api({ action: "start", title: "V" })).id)).text();
ok(/id=dl>Delete this recording</.test(rv) && /id=dy>Delete it</.test(rv) && /id=dn>Keep it</.test(rv), "the recording's own page has a small Delete with a Keep option");
ok(/\.bar,\.no\{display:none\}/.test(rv), "the Delete control does not print");
ok(rv.includes("action:'delete'") && !rv.includes("</script><script>alert("), "the page deletes through the same API");
const pg = await (await call("/momo/work.js")).text();
ok(pg.includes("window.recStartOver") && pg.includes("src_rec") && pg.includes("function resetAll()"), "Momo Work wires Start over to the recording");
ok(pg.includes("Delete recording and start over") && pg.includes("Keep the recording and start over"), "the two choices are worded as asked");
ok(/rec_so/.test(REC_JS) && !/recStartOver=function[^}]*confirm\(/.test(REC_JS), "the choice is a card, not a browser confirm");
let parsed = true; try { new Function("$", "KEY", "QUEUE", "QI", "preview", REC_JS); } catch (e) { parsed = false; console.log(String(e)); }
ok(parsed, "the Record script parses");
let wparsed = true; try { new Function(pg); } catch (e) { wparsed = false; console.log(String(e)); }
ok(wparsed, "the whole Momo Work script parses with the new Start over");
// a typed-text screen (no recording behind it) keeps the old confirm path
ok(pg.includes('if(srcRec&&window.recStartOver)'), "only a recording-sourced queue gets the new question");

// the minutes document: the real FN monogram, the title block, the gold rule, the blush details table, the footer on every printed page
{
  const { renderMinutes, FN_MONOGRAM, FOOTER } = await import("../src/work_minutes.js");
  const fs = await import("node:fs");
  const pngPath = process.env.FN_MONOGRAM_PNG;   // optional: the exact file, when the test runs where it exists
  if (pngPath && fs.existsSync(pngPath)) ok(Buffer.from(FN_MONOGRAM.split(",")[1], "base64").equals(fs.readFileSync(pngPath)), "the embedded monogram is the supplied PNG byte for byte");
  const png = Buffer.from(FN_MONOGRAM.split(",")[1], "base64");
  ok(FN_MONOGRAM.startsWith("data:image/png;base64,") && png.subarray(1, 4).toString() === "PNG", "the monogram is a PNG data URI");
  ok(png.readUInt32BE(16) === 240 && png.length < 40000, "the monogram is the web-sized 240 px PNG", { w: png.readUInt32BE(16), bytes: png.length });
  const mm = { date: "2026-10-24", attendees: [{ n: "Alex Sample", l: "Alex" }], title: "" };
  const mn = { title: "Synthetic Topic", purpose: "Align a synthetic plan.", decisions: [{ headline: "Plan agreed", detail: "Synthetic detail." }], discussion: [{ heading: "Topic one", bullets: ["A synthetic point."] }], actions: [{ action: "Draft the plan", owner: "Alex", due: "Fri 30 Oct", due_stated: false }], open_questions: ["A synthetic question?"] };
  const html = renderMinutes(mm, mn, "K");
  ok(html.includes('<img class=mono src="data:image/png;base64,') && html.includes('alt="FN"'), "the page carries the FN monogram image");
  ok(html.includes("<h1>Meeting Minutes: Synthetic Topic</h1>") && html.includes("<div class=org>FN Realty · Internal</div>"), "bold title and the 'FN Realty · Internal' line sit beside the monogram");
  ok(html.includes("class=rule") && html.includes("#C9A97A"), "a thin gold rule sits under the title block");
  ok(/class=det><tr><th>Date<\/th>.*<th>Attendees<\/th>.*<th>Purpose<\/th>.*<th>Minutes by<\/th>/.test(html) && html.includes("#F9F1EF"), "Date, Attendees, Purpose, Minutes by are a blush-shaded table");
  ok(/font:15px\/1\.5 Arial,Inter/.test(html), "the document uses the Arial/Inter stack, not the Momo teal face");
  const docCss = html.slice(html.indexOf("#sheet{"), html.indexOf("@page"));
  ok(!docCss.includes("#0A4F4A"), "no Momo teal inside the minutes document styles", docCss.match(/#0A4F4A/g));
  ok(html.includes(".bk{color:#0A4F4A") && html.includes("Back</a>") && html.includes(">Edit<") && html.includes("Share / Save as PDF"), "the Back / Edit / Share bar stays in Momo style");
  ok(html.includes("@page{size:A4") && html.includes(".bar,.hint{display:none}") && html.includes("<tfoot>") && !html.includes("position:fixed"), "A4 print: bar hidden, footer in the page flow (tfoot), not fixed");
  ok(html.includes(FOOTER.slice(0, 60)) && /zigzag|lattice/i.test(html) === false, "the confidentiality footer is present; no zigzag or lattice pattern");
  ok((html.match(/<img /g) || []).length === 1, "the monogram is the only image on the page");
}

console.log(`v627 start over: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
