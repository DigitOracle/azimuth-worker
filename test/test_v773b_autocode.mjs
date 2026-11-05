// v773b: her content calendar has no code column - Momo makes stable codes from the date and the order on that date
import { rowsToItems } from "../src/content_planner.js";
let fail = 0; const ok = (c, m, x) => { if (!c) { fail++; console.log("FAIL", m, JSON.stringify(x)); } else console.log("ok", m); };
const feed = [["Feed"], ["x"], ["c"], [], ["Wk", "Date", "Day", "Time", "Slot", "Format", "Pillar", "Series", "Topic", "CTA", "Account", "Who's in it"], ["W2 band"],
  ["W2", "Mon 2 Nov", "Mon", "", "Flex", "", "", "", "[Flex]", "", "FN"], ["W2", "Tue 3 Nov", "Tue", "10:00", "Planned", "Reel", "Trending", "Dubai Moments", "UAE Flag Day", "Follow", "FN"]];
const st = [["S"], ["x"], ["c"], [], ["Wk", "Date", "Day", "Story #", "Type", "Day anchor", "Story idea", "Project", "Who's in it", "Asset needed", "Made by"], ["band"],
  ["W2", "Mon 2 Nov", "Mon", "1", "Commercial", "Hot", "Hot project", "", "", "", ""], ["W2", "Mon 2 Nov", "Mon", "2", "Trending", "Hot", "Movember", "", "", "", ""]];
const a = rowsToItems(feed, "feed", "Feed (posts)").items, b = rowsToItems(st, "story", "Stories").items;
console.log(a.map((i) => [i.code, i.date, i.time, i.format, i.topic]), b.map((i) => [i.code, i.date, i.story_type, i.topic]));
ok(a.length === 2 && a[0].code === "FD-1102-1" && a[1].code === "FD-1103-1" && a[1].date === "2026-11-03" && a[1].time === "10:00" && a[1].format === "Reel", "feed rows get codes", a);
ok(b.length === 2 && b[0].code === "ST-1102-1" && b[1].code === "ST-1102-2" && b[1].topic === "Movember" && b[0].story_type === "Commercial", "stories use Story # and Story idea", b);
process.exit(fail ? 1 : 0);
