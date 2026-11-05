// Reproduce Najjuko's Work page with her REAL stored records (downloaded to the scratchpad), to find why MY TASKS renders empty.
import fs from "fs";
import { workRoute } from "../src/work_log.js";
const S = process.env.LOCALAPPDATA + "/Temp/claude/69ae2f9f80320527/dfdba7aa-873b-4c5f-b88e-7ca4eb14469d/scratchpad/";
const store = {};
for (const f of fs.readdirSync(S + "ent")) store[f.replace(/\.json$/, "")] = fs.readFileSync(S + "ent/" + f, "utf8");
for (const f of fs.readdirSync(S + "tk")) store[f.replace(/\.json$/, "")] = fs.readFileSync(S + "tk/" + f, "utf8");
const env = { INSIDER_KEY: "ins_najjuko_TESTKEY0123456789abcd", MEETINGS: {
  get: async (k) => store[k] ?? null, put: async () => {}, delete: async () => {},
  list: async ({ prefix }) => ({ keys: Object.keys(store).filter((k) => k.startsWith(prefix || "")).map((name) => ({ name })), list_complete: true }) } };
const deps = { isNaj: () => true, isAny: () => true, person: () => "najjuko", page: (k, r, b) => b };
const go = async (path, method) => { const u = new URL("https://x" + path + (path.includes("?") ? "&" : "?") + "key=ins_najjuko_TESTKEY0123456789abcd"); const r = await workRoute(new Request(u, { method: method || "GET" }), env, u, deps); return r ? r.text() : null; };
const js = await go("/momo/work.js");
fs.writeFileSync(S + "repro_work.js", js || "");
for (const p of ["/momo/work/api?from=2026-11-02&to=2026-11-08", "/momo/work/data?from=2026-11-02&to=2026-11-08", "/momo/work/week?from=2026-11-02&to=2026-11-08"]) {
  const t = await go(p); if (t && t.startsWith("{")) { fs.writeFileSync(S + "repro_data.json", t); const j = JSON.parse(t); console.log("data from", p, "tasks", (j.tasks || []).length); break; } else console.log(p, "->", String(t).slice(0, 60));
}
