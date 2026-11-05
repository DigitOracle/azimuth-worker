// v768 - a LOCAL preview server, NOT a test and never deployed: serves the worker's own Building Passports page, its search, the one-pager
// and the public /bp/ files on http://localhost:8799, reading the LIVE stored rows (wrangler, cached in <cache dir>). Writes stay in memory.
// Used to capture the Orchid A walkthrough at phone size without anyone's key.   node test/serve_v768_passports.mjs <cache dir>
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
const B = await import("../src/building_passports.js");
const PP = await import("../src/plot_passport.js");
const { WORK_CSS } = await import("../src/work_log.js");
const KVD = process.argv[2] || "./v768_kv"; fs.mkdirSync(KVD, { recursive: true });
const NS = "2cdf36a27f834b5f9c726294d36770fb", PUT = {}, FRESH = new Set(["bpp_index", "bpp_requests"]);
function kvGet(k, bin) {
  const f = path.join(KVD, k.replace(/[^a-zA-Z0-9_.-]/g, "_") + (bin ? ".bin" : ".txt"));
  if (!FRESH.has(k) && fs.existsSync(f)) { const v = fs.readFileSync(f); if (v.length === 1 && v[0] === 0) return null; return bin ? v : v.toString("utf8"); }
  let v = null;
  try { v = execFileSync("cmd", ["/c", "npx", "wrangler", "kv", "key", "get", k, "--namespace-id", NS].concat(bin ? [] : ["--text"]), { encoding: bin ? "buffer" : "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 256 * 1024 * 1024, env: Object.assign({}, process.env, { NODE_OPTIONS: "--dns-result-order=ipv4first" }) }); } catch (e) { v = null; }
  if (v != null && !bin && /^\s*(\{"error|Value not found|$)/.test(v)) v = null;
  if (v != null && bin && v.length < 64 && /Value not found/.test(v.toString())) v = null;
  fs.writeFileSync(f, v == null ? Buffer.from([0]) : v); return v;
}
const env = { MEETINGS: {
  get: async (k, t) => { const bin = t === "arrayBuffer" || (t && t.type === "arrayBuffer"); if (k in PUT) return PUT[k]; const v = kvGet(k, bin); if (v == null) return null; if (bin) return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength); return t === "json" ? JSON.parse(v) : v; },
  put: async (k, v) => { PUT[k] = v; }, delete: async (k) => { PUT[k] = null; }, list: async () => ({ keys: [] }) } };
// the page shell exactly as the worker writes it (momoPage, NAJ_FONTS, NAJ_NAV_CSS, najNav are lifted from src/index.js text)
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const grab = (name) => { const m = new RegExp("^const " + name + " = [\\s\\S]*?;\\r?$", "m").exec(src); return m ? m[0] : ""; };
let shell = null;
try { shell = new Function("WORK_CSS", "const askFloatHtml = () => \"\";\n" + grab("NAJ_ICONS") + "\n" + grab("najIcon") + "\n" + (/^const OWNER_LINK_RE = .*$/m.exec(src) || [""])[0] + "\n" + grab("NAJ_FONTS") + "\n" + grab("NAJ_NAV_CSS") + "\n" + (/^const najNav = [\s\S]*?^};\r?$/m.exec(src) || [""])[0] + "\n" + (/^function momoPage\(key, rk, body\) \{[\s\S]*?^\}\r?$/m.exec(src) || [""])[0] + "\nreturn momoPage;")(WORK_CSS); } catch (e) { console.log("shell fallback:", e.message); }
const page = (k, rk, b) => (shell ? shell(k, rk, b) : '<!doctype html><html><head><meta name=viewport content="width=device-width,initial-scale=1"></head><body style="background:#FAF7F1;font-family:sans-serif;padding:22px 14px"><div style="max-width:560px;margin:0 auto">' + b + "</div></body></html>");
const deps = { person: () => "kendall", isNaj: () => true, page, clientOk: () => true, clientResp: (e, u, h, o) => new Response(h, o), residentsKeyOf: () => "", najNav: () => "", NAJ_NAV_CSS: "", NAJ_FONTS: "" };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost:8799"); let body = null;
    if (req.method === "POST") body = await new Promise((ok) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => ok(d)); });
    const request = new Request(url, { method: req.method, headers: { "Content-Type": "application/json" }, body });
    let r = null;
    if (url.pathname.startsWith("/bp/")) r = await B.bppPublic(request, env, url);
    else if (url.pathname.startsWith("/plot_passport")) r = await PP.plotPassportRoutes(request, env, url, deps);
    else if (url.pathname.startsWith("/momo/work/passports")) r = await B.bppRoute(request, env, url, deps);
    if (!r) { res.writeHead(404); res.end("not here"); return; }
    const buf = Buffer.from(await r.arrayBuffer()); const h = {}; r.headers.forEach((v, k) => (h[k] = v)); res.writeHead(r.status, h); res.end(buf);
  } catch (e) { res.writeHead(500); res.end(String(e && e.stack || e)); }
}).listen(8799, () => console.log("ready http://localhost:8799/momo/work/passports?key=preview"));
