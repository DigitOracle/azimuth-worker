// v244 — DOES THE BUILDING PAGE ACTUALLY LOAD, OR DOES IT ONLY PARSE? (22 Sep 2026.)
//
// Twice today a fix shipped that could never have fired, and twice nothing caught it. v218 and v222 changed a pointerup
// handler that the host twin had already neutralised; both passed every suite and both were inert on live. The reason is
// that our checks PARSE the page and never RUN it: a page that throws on its first statement parses perfectly.
//
// The building page is an ES module with bare imports of three.js, so it cannot be executed in-process the way the
// residents page can (test_v152_dewa runs that one on a stand-in DOM). So this does the two things that ARE possible
// without a browser and without a key, and claims nothing beyond them:
//
//   1. the page's own module is checked as a MODULE by node's parser, not by a regex
//   2. the rendered page is checked for the marks of a page built from data it did not have - "undefined" and "NaN"
//      reaching visible text, a control rendered with nothing behind it, a link promising something absent
//
// It does NOT prove the page renders correctly in a browser. Nobody should read it that way, and when a browser check
// is what is needed I say so rather than let this stand in for it.
//
//   node test/test_v244_page_loads.mjs
import worker from "../src/index.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const NAJ = process.env.NAJ_DATA || "C:/Dev/naj-market-pulse/data";
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m + (d ? "\n       " + d : "")); } };

// ---- pick one footprint WITH a stack and one WITHOUT, from the real files ------------------------------------------
const SLUG = "businessbay";
const stack = rd(NAJ + "/board/stack_" + SLUG + ".json"), umx = rd(NAJ + "/board/unitmix_" + SLUG + ".json");
if (!stack || !umx) { console.log("  skip - set NAJ_DATA to the naj-market-pulse data directory"); process.exit(0); }
const withStack = Object.keys(stack.buildings_by_id || {})[0];
const noStack = Object.keys(umx.buildings_by_id || {}).find((k) => !(stack.buildings_by_id || {})[k]);
const total = Object.keys(umx.buildings_by_id || {}).length, staged = Object.keys(stack.buildings_by_id || {}).length;
console.log("  " + SLUG + ": " + staged + " of " + total + " footprints have a stack; " + (total - staged) + " do not");

// ---- the worker, reading the real files out of KV -------------------------------------------------------------------
const store = new Map();
for (const f of fs.readdirSync(NAJ + "/board")) {
  const m = /^(stack|unitmix|bldgfacts|units|projects|plates)_(.+)\.json$/.exec(f);
  if (m && m[2] === SLUG) store.set("img_" + m[1] + "_" + m[2], fs.readFileSync(NAJ + "/board/" + f, "utf8"));
}
try { store.set("img_anchors_" + SLUG, fs.readFileSync(NAJ + "/names/anchors_" + SLUG + ".json", "utf8")); } catch {}
for (const k of ["plans_index", "pillars"]) { try { store.set("img_" + k, fs.readFileSync(NAJ + "/board/" + k + ".json", "utf8")); } catch {} }
const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : v; },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { return { keys: [...store.keys()].filter((k) => !o || !o.prefix || k.startsWith(o.prefix)).map((name) => ({ name })), list_complete: true }; } };
const READ = "owner_admin_key_never_in_client_links_0001";
const env = { MEETINGS: KV, READ_KEY: READ, PUBLIC_ORIGIN: "https://x" };
globalThis.fetch = async () => new Response("{}", { status: 200 });
const page = async (id) => { const r = await worker.fetch(new Request("https://x/building/" + SLUG + "/" + id + "?key=" + READ), env, { waitUntil() {} }); return { status: r.status, html: await r.text() }; };

// ---- 1. the module is parsed AS A MODULE, by node, not by us ----------------------------------------------------------
const a = await page(withStack);
ok(a.status === 200, "a footprint WITH a stack opens: " + a.status);
const mods = [...a.html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
ok(mods.length > 0, "the page carries a module script: " + mods.length);
let parsed = 0;
for (const [i, body] of mods.entries()) {
  const p = path.join(os.tmpdir(), "bp_mod_" + i + "_" + process.pid + ".mjs");
  fs.writeFileSync(p, body, "utf8");
  try { execFileSync(process.execPath, ["--check", p], { stdio: "pipe" }); parsed++; }
  catch (e) { ok(false, "module " + i + " does not parse", String(e.stderr || e).slice(0, 300)); }
  finally { try { fs.unlinkSync(p); } catch {} }
}
ok(parsed === mods.length, "every module on the page parses as a module (" + parsed + "/" + mods.length + ")");

// ---- 2. the marks of a page built from data it did not have ------------------------------------------------------------
const visible = (h) => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const vis = visible(a.html);
ok(!/\bundefined\b/.test(vis), "nothing on the page reads 'undefined'", vis.match(/.{0,60}undefined.{0,60}/) || "");
ok(!/\bNaN\b/.test(vis), "nor 'NaN'", vis.match(/.{0,60}NaN.{0,60}/) || "");
ok(!/\bnull\b/.test(vis), "nor 'null'", vis.match(/.{0,60}null.{0,60}/) || "");

// ---- 3. THE CASE KENDALL ASKED FOR: a footprint with NO stack --------------------------------------------------------
// 1,996 of 66,714 footprints in Dubai have a page, so this is the normal case and every tap outside it is a dead control.
if (!noStack) { console.log("  (every footprint here has a stack - nothing to check)"); }
else {
  const b = await page(noStack);
  ok(b.status === 200, "a footprint with NO stack also opens - " + SLUG + "/" + noStack + ": " + b.status,
     b.status === 404 ? "still 404: the ABOUT THE BUILDING button is dead on " + (total - staged) + " of this district's " + total + " buildings" : "");
  if (b.status === 200) {
    const vb = visible(b.html);
    ok(!/\bundefined\b|\bNaN\b/.test(vb), "and carries no 'undefined' or 'NaN' where the stack would have been", (vb.match(/.{0,60}(undefined|NaN).{0,60}/) || [""])[0]);
    // The three constraints agreed with the twin session: no empty control, no promise of a model that is not there,
    // nothing stack-sourced rendered as a zero.
    ok(!/id=fpick/.test(b.html) || /<option/.test(b.html), "the floor picker is absent rather than rendered empty");
    ok(!/0 floors|0 homes|0 units\b/.test(vb), "nothing absent is printed as a zero", (vb.match(/.{0,50}0 (floors|homes|units).{0,30}/) || [""])[0]);
    const modsB = [...b.html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    let pB = 0;
    for (const [i, body] of modsB.entries()) {
      const p = path.join(os.tmpdir(), "bp_ns_" + i + "_" + process.pid + ".mjs");
      fs.writeFileSync(p, body, "utf8");
      try { execFileSync(process.execPath, ["--check", p], { stdio: "pipe" }); pB++; } catch (e) { ok(false, "no-stack module " + i + " does not parse", String(e.stderr || e).slice(0, 300)); }
      finally { try { fs.unlinkSync(p); } catch {} }
    }
    ok(pB === modsB.length, "its module parses too (" + pB + "/" + modsB.length + ")");
    ok(/About the building/i.test(b.html), "and the ABOUT THE BUILDING button is on it");
  }
}

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
