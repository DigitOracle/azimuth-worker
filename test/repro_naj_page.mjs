// Builds a local HTML file: her real Work page + its script, with fetch answered from her real data (no network).
import fs from "fs";
import { workRoute } from "../src/work_log.js";
const S = process.env.LOCALAPPDATA + "/Temp/claude/69ae2f9f80320527/dfdba7aa-873b-4c5f-b88e-7ca4eb14469d/scratchpad/";
const store = {};
for (const f of fs.readdirSync(S + "ent")) store[f.replace(/\.json$/, "")] = fs.readFileSync(S + "ent/" + f, "utf8");
for (const f of fs.readdirSync(S + "tk")) store[f.replace(/\.json$/, "")] = fs.readFileSync(S + "tk/" + f, "utf8");
const env = { INSIDER_KEY: "ins_najjuko_TESTKEY0123456789abcd", MEETINGS: { get: async (k) => store[k] ?? null, put: async () => {}, delete: async () => {},
  list: async ({ prefix }) => ({ keys: Object.keys(store).filter((k) => k.startsWith(prefix || "")).map((name) => ({ name })), list_complete: true }) } };
const deps = { isNaj: () => true, isAny: () => true, person: () => "najjuko", page: (k, r, b) => b };
const go = async (path) => { const u = new URL("https://x" + path + (path.includes("?") ? "&" : "?") + "key=ins_najjuko_TESTKEY0123456789abcd"); const r = await workRoute(new Request(u), env, u, deps); return r ? r.text() : ""; };
let body = await go("/momo/work"), js = await go("/momo/work.js"), data = await go("/momo/work/api?from=2026-11-02&to=2026-11-08");
body = body.replace(/<script src="?\/momo\/work\.js[^>]*><\/script>/g, "").replace(/<script src="?\/momo\/checkin\.js[^>]*><\/script>/g, "");
const shim = "<script>window.__ERR=[];window.onerror=function(m,s,l,c,e){window.__ERR.push(m+' @'+l+':'+c+' '+(e&&e.stack||''))};var DATA=" + JSON.stringify(data) + ";window.fetch=function(u,o){return Promise.resolve(new Response(String(u).indexOf('/momo/work/api')>=0&&(!o||o.method!=='POST')?DATA:'{\"ok\":true}',{headers:{'Content-Type':'application/json'}}))};try{localStorage}catch(e){}</script>";
const html = "<!doctype html><html><head><meta charset=utf-8></head><body>" + shim + body + "<script>" + js + "</script></body></html>";
fs.writeFileSync("C:/Users/kwils/Downloads/repro_naj_work.html", html);
console.log("written", html.length, "body", body.length, "js", js.length);
