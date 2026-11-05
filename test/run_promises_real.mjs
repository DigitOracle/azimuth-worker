// v782a - what the matcher proposes for the real 5 Nov Vishant meeting (read only; nothing applied)
import fs from "fs";
import { matchMeeting } from "../src/meeting_match.js";
const S = process.env.LOCALAPPDATA + "/Temp/claude/69ae2f9f80320527/dfdba7aa-873b-4c5f-b88e-7ca4eb14469d/scratchpad/";
let text = ""; for (const p of ["000", "001"]) { const t = fs.readFileSync(S + "part_" + p + ".txt", "utf8"); try { const d = JSON.parse(t); text += " " + (d.text || ""); } catch (e) { text += " " + t; } }
const d = JSON.parse(fs.readFileSync(S + "planner_data.json", "utf8"));
const team = ["Najjuko", "Vishant", "Monaza", "Liam", "Kareem", "Sousan", "Rouba"];
const P = matchMeeting(text, "2026-11-05", d.items, { team });
P.filter((x) => x.cls === "task").forEach((x) => console.log("TASK", x.promise ? "promise" : "merged", "| owner:", x.owner || "-", "| due:", x.due || "-", "|", x.task));
console.log("total proposals", P.length, "tasks", P.filter((x) => x.cls === "task").length);
