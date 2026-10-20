// v616 - Done on the content plan must answer (Kendall, 20 Oct 2026: "when we hit done, we didn't get confirmation ... it wouldn't show up").
// The page confirms every save with a toast, reports a failed save instead of closing silently, and makes the saved item visible:
// lifts a category filter that hides it, jumps to the month view when the date is outside the 60-day list window, scrolls to the card.
import assert from "node:assert/strict";
const m = await import("../src/work_log.js");
const store = new Map();
const KV = { get: async (k) => store.get(k) || null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const env = { MEETINGS: KV };
const deps = { isNaj: () => true, model: "m", page: (k, rk, b) => "<html>" + b + "</html>", claudeJSON: async () => null };
const url = "https://w/momo/work/plan?key=K";
const PLAN_JS = await (await m.workRoute(new Request(url), env, new URL(url), deps)).text();

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
ok(PLAN_JS.includes("function toast(msg,bad)"), "the plan page has its own toast");
ok(PLAN_JS.includes("function showItem(r,verb)"), "showItem closes the sheets, reloads, then shows the saved item");
ok(PLAN_JS.includes("function load(cb)"), "load takes a callback so the jump happens after the reload");
ok(PLAN_JS.includes('if(!vis(it)){CAT="all";SUB="all"}'), "a filter that hides the item is lifted");
ok(PLAN_JS.includes('VIEW="mon";MR=null;MONTH=ymOf(it.start)'), "a date outside the list window opens that month");
ok(PLAN_JS.includes("addDays(t,60)"), "the list window is the same 60 days the list draws");
ok(PLAN_JS.includes('scrollIntoView({block:"center"})'), "the card is scrolled into view");
ok(PLAN_JS.includes('toast((verb||"Added to the plan")+": "+it.title'), "the toast names the item");
ok(PLAN_JS.includes("function saveFail(btn,r)"), "a failed save is reported");
ok(PLAN_JS.includes('"Not saved: no connection. Try again."'), "a dropped connection is said, not swallowed");
// the Add sheet: Done disables while saving, reports errors, shows the item
const add = PLAN_JS.slice(PLAN_JS.indexOf("function addItem("), PLAN_JS.indexOf("function trendCard("));
ok(add.includes('btn.textContent="Saving…"'), "Done says Saving while the save runs");
ok(add.includes("if(!r||r.error)return saveFail(btn,r);showItem(r)"), "Add: error reported, else the item is shown");
ok(!add.includes(".then(SHEETALL)"), "Add no longer closes silently");
// the idea sheet: both saves go through showItem
const idea = PLAN_JS.slice(PLAN_JS.indexOf("function ideaSheet("), PLAN_JS.indexOf("function drawCat("));
ok(idea.includes('showItem(r,"Angle saved")'), "angle on a known item confirms");
ok(idea.includes("if(r.error)return back(r);showItem(r)"), "a new item from an idea confirms and is shown");
// a date given to a shelved idea
ok(PLAN_JS.includes('showItem(r,"Date set")'), "dating an idea confirms");
ok(!PLAN_JS.includes('api({action:"item_save",item:i}).then(SHEETALL)'), "no item save closes without a word");
console.log("test_v616_plan_add_confirm: " + n + " checks passed");
