// v163 — EVERY KEYED PAGE'S SCRIPT MUST PARSE.
//
// Why this file exists. Her pages are built as strings in the Worker, and the JavaScript inside them is just more string. esbuild parses
// index.js and world_page.js happily and never looks inside the quotes, so a broken concatenation ships green: green build, green suite, and
// a page that renders its headings and then does nothing at all.
//
// It has now happened twice. In v158 a splice of mine left a `+` inside a string and would have shipped a blank Find page. In v155.1 the
// Versus page got `(OWNER ? ...` inside a string literal instead of outside it, plus a line of escaped quotes that a template literal ate.
// That one DID ship: the script threw on load, so the city picker was empty, every section was empty, and the page sat there looking like an
// unfinished feature for a day. Nobody's tests caught it, because they all assert on HTML substrings and the HTML was perfect. The behaviour
// was what had gone.
//
// So this is not a test of any one page. It walks every keyed page that renders, pulls out every script, and parses it.
//
// It is careful about what counts as code, because a check that cries wolf gets loosened, and a loosened check is how a suite stops meaning
// anything. An import map and a JSON block are data and are skipped. A module cannot go through new Function because of its imports, so its
// import lines are blanked and the body — where these errors actually live — is still parsed.
import worker from "../src/index.js";

const READ = "owner_admin_key_never_in_client_links_0001";
const CLIENT = "client_key_current_abcdefghij";

const store = new Map();
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); if (t === "json") { try { return JSON.parse(v); } catch (e) { return null; } } return v; },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; },
};
globalThis.fetch = async () => new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, RESIDENTS_KEY: "r", INGEST_TOKEN: "ING", WA_ALLOWED: "971565484397",
  WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", GOOGLE_MAPS_KEY: "g", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const ctx = { waitUntil() {} };
const ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";
const call = (path, key) => worker.fetch(new Request(ORIGIN + path + (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key)), env, ctx);

store.set("img_board_devs", JSON.stringify({ developers: [{ key: "arada", name: "Arada", segment_label: "Wellness luxury", icon: "", ours: [],
  properties: [{ kind: "portfolio", name: "Bellevue Towers", area: "Downtown Dubai", url: "https://example.com/b", handover: "31-Oct-2029" }] }] }));
store.set("img_unitmix_projects", JSON.stringify({ projects: { bellevue: { district: "downtown", i: 12, sheet: 18, client_sheet: "bellevue_towers" } } }));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };

const JS_TYPE = /^(module|text\/javascript|application\/javascript)$/i;
// Top-level await is legal in a module and rejected by a plain function body, so a module is judged inside an async wrapper. Without this
// the twin came back red for code that is perfectly correct - the second false alarm this check produced before it was trustworthy.
const parseCheck = (s) => { if (s.module) new Function("return (async () => {" + s.code + "})"); else new Function(s.code); };
// Not line-based: the twin puts several imports on one line, semicolon-separated, so a per-line strip missed them and the whole module came
// back as "Cannot use import statement outside a module" — a false alarm, which is the failure mode this file is least allowed to have.
const stripImports = (src) => src
  .replace(/\bimport\s[^;]*?\sfrom\s*(["'])[^"']*\1\s*;/g, "")
  .replace(/\bimport\s*(["'])[^"']*\1\s*;/g, "");

function codeBlocks(html) {
  const out = [];
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1] || "", body = m[2] || "";
    if (!body.trim() || /\bsrc=/.test(attrs)) continue;
    const type = (attrs.match(/type\s*=\s*["']?([^"'\s>]+)/) || [])[1] || "";
    if (type && !JS_TYPE.test(type)) continue;            // an import map or a JSON block is data, not code
    out.push({ code: /^module$/i.test(type) ? stripImports(body) : body, module: /^module$/i.test(type) });
  }
  return out;
}

const PAGES = ["/find", "/dev?d=arada", "/versus", "/world", "/plans", "/clock", "/charts", "/market", "/home", "/skyline?all=1", "/map", "/avail"];

let pagesChecked = 0, scriptsChecked = 0;
for (const path of PAGES) {
  for (const [who, key] of [["owner", READ], ["client", CLIENT]]) {
    let html = "", status = 0;
    try { const r = await call(path, key); status = r.status; html = await r.text(); }
    catch (e) { ok(false, path + " (" + who + ") threw: " + String((e && e.message) || e).slice(0, 90)); continue; }
    if (status !== 200) continue;                          // not every page renders without its data; those are not this file's business
    const scripts = codeBlocks(html);
    if (!scripts.length) continue;
    pagesChecked++;
    let bad = "";
    for (const s of scripts) {
      scriptsChecked++;
      try { parseCheck(s); } catch (e) { if (!bad) bad = String((e && e.message) || e).slice(0, 110); }
    }
    ok(!bad, path + " (" + who + "): " + scripts.length + " script" + (scripts.length === 1 ? "" : "s") + " parse" + (bad ? " — " + bad : ""));
  }
}

// Without these, a regex that stopped matching would leave this file passing loudly while checking nothing.
ok(pagesChecked >= 8, "the walk actually reached pages: " + pagesChecked + " page renders carried code (expected at least 8)");
ok(scriptsChecked >= 10, "and actually parsed it: " + scriptsChecked + " scripts in total (expected at least 10)");

// Proof the parser would reject the exact shapes that have shipped, so its silence above means something.
const SHIPPED_BUGS = [
  'var a = "unclosed;',                                     // the v158 splice
  'x.innerHTML = "a" + (OWNER ? <div>b</div>" : "");',      // the v155.1 Versus bug
  'y.innerHTML = "<img src="" + u + "">";',                 // a template literal eating a backslash
];
let caught = 0;
for (const broken of SHIPPED_BUGS) { try { new Function(broken); } catch (e) { caught++; } }
ok(caught === SHIPPED_BUGS.length, "the check rejects all three shapes that have actually shipped");

// And proof it does NOT reject the two things that are legitimately not classic script, which is what made it cry wolf the first time.
ok(codeBlocks('<script type="importmap">{"imports":{"three":"x"}}</script>').length === 0, "an import map is treated as data, not as broken code");
ok(codeBlocks('<script type="module">import * as T from "three";\nconst a = 1;</script>').length === 1, "a module is still checked, with its import lines blanked");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
