// v786: her real Work page + work.js + today.js, fetch answered from her real data (no network). Writes Downloads/repro_today_full.html
import fs from "fs";
import { workRoute } from "../src/work_log.js";
import { todayFullRoute, todayFullData } from "../src/today_full.js";
const S = process.env.LOCALAPPDATA + "/Temp/claude/69ae2f9f80320527/dfdba7aa-873b-4c5f-b88e-7ca4eb14469d/scratchpad/";
const store = {};
for (const d of ["ent", "tk"]) for (const f of fs.readdirSync(S + d)) store[f.replace(/\.json$/, "")] = fs.readFileSync(S + d + "/" + f, "utf8");
const today = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
// sample broker data so every section draws
store.naj_leads = JSON.stringify(["a1", "a2", "a3"]);
store.naj_lead_a1 = JSON.stringify({ id: "a1", name: "Sara Ahmed", phone: "0501234567", wants: "2 bed, JVC", project: "Binghatti Phantom", stage: "Viewing", last_contact: "2026-10-25" });
store.naj_lead_a2 = JSON.stringify({ id: "a2", name: "Omar K", stage: "Offer", next: "Send the offer", due: today, last_contact: today });
store.naj_lead_a3 = JSON.stringify({ id: "a3", name: "Lina", stage: "Lead", last_contact: today });
store["naj_visits_" + today] = JSON.stringify([{ id: "v1", time: "15:00", kind: "Developer", with: "Sobha" }]);
store.camp_handover_index = JSON.stringify([{ kind: "follow_up", cid: "c1", d: "d1", name: "Ahmed (owner, Unit 1204)", answers: ["Call me after 4"], opened: "2026-11-04" }]);
const env = { INSIDER_KEY: "ins_najjuko_TESTKEY0123456789abcd", MEETINGS: { get: async (k) => store[k] ?? null, put: async () => {}, delete: async () => {},
  list: async ({ prefix }) => ({ keys: Object.keys(store).filter((k) => k.startsWith(prefix || "")).map((name) => ({ name })), list_complete: true }) } };
const deps = { isNaj: () => true, isAny: () => true, person: () => "najjuko", page: (k, r, b) => b };
const go = async (path) => { const u = new URL("https://x" + path + (path.includes("?") ? "&" : "?") + "key=ins_najjuko_TESTKEY0123456789abcd"); const r = await workRoute(new Request(u), env, u, deps); return r.text(); };
let body = await go("/momo/work"), js = await go("/momo/work.js"), data = await go("/momo/work/api");
const tu = new URL("https://x/momo/today.js"); const tjs = await (await todayFullRoute(new Request(tu), env, tu, deps)).text();
const _td = await todayFullData(env); if (process.env.CAL) _td.cal = { connected: true, events: [{ time: "11:00", title: "Sobha Realty sales gallery visit", where: "Sobha Hartland" }, { time: "18:00", title: "Viewing with client Sara", where: "JVC" }] }; const tdata = JSON.stringify({ ok: true, ..._td });
body = body.replace(/<script src="?\/momo\/[^>]*><\/script>/g, "");
const shim = "<script>window.__ERR=[];window.onerror=function(m,s,l,c,e){window.__ERR.push(m+' @'+l+':'+c)};var DATA=" + JSON.stringify(data) + ",TD=" + JSON.stringify(tdata)
  + ";window.fetch=function(u,o){u=String(u);var b=u.indexOf('/momo/work/today/data')>=0?TD:(u.indexOf('/momo/work/api')>=0&&(!o||o.method!=='POST'))?DATA:'{\"ok\":true,\"saved\":\"test\"}';return Promise.resolve(new Response(b,{headers:{'Content-Type':'application/json'}}))};</script>";
const html = "<!doctype html><html><head><meta charset=utf-8><meta name=viewport content='width=device-width'></head><body>" + shim + body + "<script>" + js + "</script><script>" + tjs + "</script></body></html>";
fs.writeFileSync("C:/Users/kwils/Downloads/repro_today_full.html", html);
console.log("written", html.length, JSON.parse(tdata).quiet.length, "quiet", JSON.parse(tdata).calls.length, "calls");
