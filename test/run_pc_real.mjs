// run the v782b planner checks on a saved copy of her real planner data (read-only)
import fs from "fs";
import { plannerChecks } from "../src/planner_checks.js";
const S = process.env.LOCALAPPDATA + "/Temp/claude/69ae2f9f80320527/dfdba7aa-873b-4c5f-b88e-7ca4eb14469d/scratchpad/";
const d = JSON.parse(fs.readFileSync(S + "planner_data.json", "utf8"));
const r = plannerChecks(d.items, d.settings, d.today, { nowHm: "16:00" });
console.log(r.line, "| posting days", r.posting_days);
const c = {}; r.list.forEach((p) => { const k = p.lvl + ": " + p.what.replace(/\b[A-Z]{2}-\d{4}-\d\b/g, "").replace(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+ \w+/g, "<day>").replace(/\[[^\]]*\]/g, "[..]").replace(/\d+/g, "#").slice(0, 60); c[k] = (c[k] || 0) + 1; });
console.log(c);
r.list.filter((p) => p.date === r.from).forEach((p) => console.log("TOMORROW", p.lvl, p.code, p.what, "->", p.fix));
