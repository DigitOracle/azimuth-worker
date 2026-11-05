// v781: the matcher on the REAL Vishant transcript (first 10 min) against her REAL planner items (downloaded, read only)
import fs from "fs";
import { matchMeeting } from "../src/meeting_match.js";
const S = process.env.LOCALAPPDATA + "/Temp/claude/69ae2f9f80320527/dfdba7aa-873b-4c5f-b88e-7ca4eb14469d/scratchpad/";
const part = (p) => { const t = fs.readFileSync(S + "part_" + p + ".txt", "utf8"); try { const d = JSON.parse(t); return d.text || ""; } catch (e) { return t; } };
const text = part("000") + " " + part("001");
const items = JSON.parse(fs.readFileSync(S + "cp_items.json", "utf8"));
const P = matchMeeting(text, "2026-11-05", items);
for (const p of P) console.log(p.cls.padEnd(9), (p.code || "-").padEnd(10), (p.date || "").padEnd(11), (p.fields && p.fields.topic || p.task || p.rule || "").slice(0, 44).padEnd(45), "| now:", p.current ? (p.current.topic || "").slice(0, 34) : "");
const want = { "FD-1106-1": ["likely", "sure"], "FD-1107-1": ["conflict"], "ST-1108-2": ["sure"], "ST-1109-3": ["sure"], "FD-1109-1": ["likely", "sure"], "FD-1110-1": ["sure"], "FD-1111-1": ["conflict"], "FD-1112-1": ["conflict"], "FD-1113-1": ["sure"], "FD-1114-1": ["sure"], "FD-1117-1": ["sure"], "FD-1118-1": ["likely", "sure"] };
let fail = 0;
for (const [code, cls] of Object.entries(want)) { const p = P.find((x) => x.code === code); const ok = p && cls.includes(p.cls); console.log(ok ? "ok" : "FAIL", code, p ? p.cls : "missing"); if (!ok) fail++; }
const hasNew = P.some((x) => x.cls === "new"), hasTask = P.some((x) => x.cls === "task"), hasRec = P.some((x) => x.cls === "recurring");
console.log(hasNew ? "ok" : "FAIL", "a new item (the 11 Nov event video)"); if (!hasNew) fail++;
console.log(hasTask ? "ok" : "FAIL", "a task (arrange visits)"); if (!hasTask) fail++;
console.log(hasRec ? "ok" : "FAIL", "the Monday market-update rule"); if (!hasRec) fail++;
console.log("matched", 12 - fail >= 0 ? Object.keys(want).length - P.filter((x) => !want[x.code] && x.code).length : 0, "proposals", P.length);
process.exit(fail ? 1 : 0);
