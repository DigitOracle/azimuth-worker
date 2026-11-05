// v781: local pages that run the REAL served Sync script against the matcher's cards for the real Vishant meeting (stubbed API), for 375 px shots
import { SYNC_JS } from "../src/meeting_sync.js";
import { writeFileSync, mkdirSync, readFileSync } from "fs";
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const S = process.env.LOCALAPPDATA + "/Temp/claude/69ae2f9f80320527/dfdba7aa-873b-4c5f-b88e-7ca4eb14469d/scratchpad/";
const open = JSON.parse(readFileSync(S + "v781_open.json", "utf8"));
const pick = (cls, code) => open.findIndex((o) => o.change.cls === cls && (!code || o.change.code === code));
const shots = [["1_likely_FD-1106-1", pick("likely", "FD-1106-1")], ["2_conflict_FD-1107-1", pick("conflict", "FD-1107-1")], ["3_sure_ST-1108-2", pick("sure", "ST-1108-2")], ["4_recurring", pick("recurring")], ["5_new_event", pick("new")], ["6_task", pick("task")]];
for (const [name, i] of shots) {
  if (i < 0) { console.log("skip", name); continue; }
  const list = [open[i]].concat(open.filter((_, j) => j !== i));
  const stub = 'var OPEN=' + JSON.stringify(list) + ';window.fetch=function(u,o){var b=JSON.parse((o&&o.body)||"{}");var r={ok:true};if(b.action==="sync_auto")r={ok:true,open:OPEN,badges:{}};return Promise.resolve(new Response(JSON.stringify(r),{headers:{"Content-Type":"application/json"}}))};';
  const h = '<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0;background:#FAF6EE;font-family:"IBM Plex Sans",sans-serif}</style></head><body>'
    + '<script>history.replaceState(null,"","?key=k");' + stub + '</script><script>' + SYNC_JS + '</script></body></html>';
  writeFileSync(out + "/v781_" + name + ".html", h);
}
console.log("ok");
