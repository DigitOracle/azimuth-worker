// v773: writes three local HTML pages that run the REAL served Sync script against a stubbed API, for 375 px screenshots of the pop-up series
import { SYNC_JS } from "../src/meeting_sync.js";
import { writeFileSync, mkdirSync } from "fs";
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const t0 = "2026-11-05";
const open = [
  { meeting: t0 + "_m1", title: "Weekly content huddle", date: t0, change: { id: "c0", type: "planner_move", code: "FD-12", from: "Tue 10 Nov 19:00", date: "2026-11-12", time: "18:00", quote: "moving the DAMAC Lagoons reel to Thursday at 18:00", line: 2, line_text: "We are moving the DAMAC Lagoons reel to Thursday at 18:00.", match: "FD-12 · Tue 10 Nov · 19:00 · Reel · DAMAC Lagoons launch reel (DAMAC)", certain: true, ok: true } },
  { meeting: t0 + "_m1", title: "Weekly content huddle", date: t0, change: { id: "c1", type: "planner_hold", code: "ST-03", quote: "Drop the market update story", line: 3, match: "ST-03 · Fri 7 Nov · 10:00 · story · Market update", certain: true, ok: true } },
  { meeting: t0 + "_m1", title: "Weekly content huddle", date: t0, change: { id: "c2", type: "task_update", task: "Brochure refresh", status: "Done", percent: 100, quote: "The brochure refresh is done", line: 4, certain: true, ok: true } }];
const pages = [0, 1, 2].map((skip) => {
  const stub = 'var OPEN=' + JSON.stringify(open.slice(skip)) + ';var _f=window.fetch;window.fetch=function(u,o){var b=JSON.parse((o&&o.body)||"{}");var r={ok:true};if(b.action==="sync_auto")r={ok:true,open:OPEN,badges:{"' + t0 + '_m1":OPEN.length}};else if(b.action==="sync_auto_answer"){r={ok:true,done:[b.id],failed:[],pending:[]}}return Promise.resolve({json:function(){return Promise.resolve(r)}})};';
  return '<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0;background:#FAF6EE;font-family:"IBM Plex Sans",sans-serif;padding:20px 16px}.card{border:1px solid #E7E1D6;background:#FFFDF9;border-radius:14px;padding:14px}.del{background:none;border:0;font:inherit;padding:0}</style></head><body>'
    + '<div class=card><b>Weekly content huddle</b><br><small>Meeting · ' + t0 + '</small><br><button class=del data-sy="' + t0 + '_m1" style="color:#0A4F4A;font-weight:600">Sync</button></div>'
    + '<script>' + stub + '</script><script>' + SYNC_JS + '</script></body></html>';
});
pages.forEach((h, i) => writeFileSync(out + "/popup_" + (i + 1) + ".html", h));
console.log("ok");
