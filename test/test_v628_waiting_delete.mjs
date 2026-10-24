// v628 - a recording waiting to become an entry can be deleted from the My work log card; synthetic data only.
import { REC_JS } from "../src/work_rec_page.js";
let pass = 0, fail = 0; const ok = (c, msg, extra) => { if (c) pass++; else { fail++; console.log("FAIL", msg, extra === undefined ? "" : JSON.stringify(extra).slice(0, 300)); } };
ok(/data-wdel=/.test(REC_JS), "each waiting row has a Delete button");
ok(/data-wq=/.test(REC_JS) && /Delete this recording and its transcript\? This cannot be undone\./.test(REC_JS), "a soft question sits under each row");
ok(/Delete it/.test(REC_JS) && /Keep it/.test(REC_JS), "the question has Delete it and Keep it");
ok(/data-wdel[\s\S]{0,160}Delete<\/button><button[^>]*data-mk/.test(REC_JS), "Delete sits beside Make entry");
ok(/rapi\(\{action:"delete",id:id\}\)/.test(REC_JS), "it uses the existing delete action");
ok(/GONE\[id\]=1/.test(REC_JS), "a deleted row never comes back in this session");
ok(!/confirm\(/.test(REC_JS.slice(REC_JS.indexOf("data-wdel"), REC_JS.indexOf("// ---- recording ----"))), "no browser confirm on the waiting card");
ok(/flex-wrap:wrap/.test(REC_JS) && /flex:1 1 150px/.test(REC_JS), "the row wraps at narrow widths");
ok(/min-height:40px/.test(REC_JS), "buttons are thumb-sized");
ok(!/`|\$\{/.test(REC_JS.slice(REC_JS.indexOf("function drawBanner"), REC_JS.indexOf("// ---- recording ----"))), "no backtick or template hole inside the String.raw script");
try { new Function(REC_JS.replace(/^[\s\S]*?$/, (x) => x)); ok(true, "script parses"); } catch (e) { ok(false, "script parses", String(e)); }

// v628 - the minutes footer is part of the page flow (a tfoot), never position:fixed, so it cannot overprint a heading on any engine
const { renderMinutes, FOOTER } = await import("../src/work_minutes.js");
const mm = { id: "x", date: "2026-10-24", title: "Synthetic", attendees: [] };
const mnn = { title: "Synthetic", purpose: "p", decisions: [{ headline: "D", detail: "d" }], discussion: [{ heading: "T", bullets: ["b"] }], actions: [], open_questions: ["q?"] };
const html = renderMinutes(mm, mnn, "K");
ok(!/position:\s*fixed/.test(html.slice(html.indexOf("<style>"), html.indexOf("</style>"))), "no position:fixed anywhere in the minutes styles");
ok(/<tfoot><tr><td><div class=foot>/.test(html) && html.split("<div class=foot>").length === 2, "the confidentiality footer is one tfoot, once in the markup");
ok(/\.pg>tfoot\{display:table-footer-group\}/.test(html), "the footer group repeats at the foot of each printed page");
ok(/h2,h3\{break-after:avoid\}/.test(html) && /li,table table tr,\.det tr\{break-inside:avoid\}/.test(html), "headings keep their first item; rows and list items do not split");
ok(/@page\{size:A4;margin:16mm\}/.test(html), "A4 with an even 16 mm margin");
ok(html.includes(FOOTER.slice(0, 30)), "footer text present");

console.log("v628 waiting delete: " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
