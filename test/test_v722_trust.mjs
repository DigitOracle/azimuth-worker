// Offline tests for v72.2 — developer trust check (option A: MEED counts + official DLD doors, no PARCEL).
import worker from "../src/index.js";
const store = new Map();
const KV = { async get(k){return store.has(k)?store.get(k):null;}, async put(k,v){store.set(k,String(v));}, async delete(k){store.delete(k);}, async list(o){const prefix=(o&&o.prefix)||"";return {keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name}))};} };
const INTENT = JSON.stringify({developer:"Imtiaz",area:"Business Bay",roomType:"1 B/R",priceAed:1200000,pricePsfAed:null,handoverYear:2027,roiClaimPct:8});
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes("api.anthropic.com")) return new Response(JSON.stringify({content:[{type:"text",text:INTENT}]}),{status:200});
  return new Response("{}",{status:200});
};
const env = { MEETINGS:KV, READ_KEY:"RK", INGEST_TOKEN:"ING", ANTHROPIC_API_KEY:"sk-test", MAILBOXES:"" };
const get = (p) => worker.fetch(new Request("https://x"+p), env, {waitUntil(){}});
let pass=0, fail=0; const ok=(n,c)=>{ if(c){pass++;console.log("  ok -",n);}else{fail++;console.log("  FAIL -",n);} };
const URLS = ["approved-real-estate-developers","real-estate-project-status-landing","validate-real-estate-licenses-and-permits","rvs-contractual-disputes-overview","certified-escrow-agents","apps.apple.com/us/app/dubai-rest","play.google.com/store/apps/details?id=ae.gov.dubailand.selfregistration"];

// 0. ingest a developer index with a generatedAt -> snapshot date stored
const devs = Array.from({length:25},(_,i)=>({d:"Dev "+i,n:1,complete:1,construction:0,cancelled:0,onhold:0,active:0,valueUsdM:10}));
devs[3] = {d:"Imtiaz Developments",n:12,complete:7,construction:3,cancelled:1,onhold:1,active:4,valueUsdM:850};
let r = await worker.fetch(new Request("https://x/ingest_market",{method:"POST",headers:{"X-Azimuth-Ingest":"ING","Content-Type":"application/json"},body:JSON.stringify({generatedAt:"2026-08-19T06:00:00Z",developerIndex:devs})}), env, {waitUntil(){}});
ok("ingest developerIndex accepted", r.status===200);
ok("snapshot date stored", store.get("mkt_devindex_at")==="2026-08-19T06:00:00Z");

// 1. /trust_test: matched developer
r = await get("/trust_test?key=RK&q=Imtiaz"); let t = await r.text();
ok("trust: header names the matched developer", t.includes("🛡 Developer trust check — Imtiaz Developments"));
ok("trust: MEED counts present (7 completed, 1 cancelled)", t.includes("7 completed") && t.includes("1 cancelled"));
ok("trust: snapshot date carried", t.includes("snapshot 2026-08-19"));
ok("trust: all 7 official doors present", URLS.every(u => t.includes(u)));
ok("trust: no PARCEL anywhere", !/parcel/i.test(t));
ok("trust: 'not a rating' disclaimer", t.includes("not a rating"));

// 2. unknown developer still gets the doors
r = await get("/trust_test?key=RK&q=Nobody+Holdings"); t = await r.text();
ok("trust: unmatched -> honest 'no developer matched'", t.includes("no developer matched"));
ok("trust: unmatched still carries all doors", URLS.every(u => t.includes(u)));

// 3. guards
ok("trust: wrong key -> 401", (await get("/trust_test?key=BAD&q=Imtiaz")).status===401);
ok("trust: no q -> 400", (await get("/trust_test?key=RK")).status===400);

// 4. launch check carries the trust block after the brief
r = await get("/launch_test?key=RK&q=launch:+Imtiaz+in+Business+Bay,+1-bed+from+1.2M,+claims+8%25+ROI"); t = await r.text();
ok("launch: brief present", t.includes("🏗 Launch check"));
ok("launch: trust block appended", t.includes("🛡 Developer trust check — Imtiaz Developments"));
ok("launch: trust block AFTER the brief", t.indexOf("🏗 Launch check") < t.indexOf("🛡 Developer trust check"));

// 5. availability drill page shows the verify section
store.set("img_drill_imtiaz", JSON.stringify({title:"Imtiaz (all projects)",district:"Business Bay",rooms:[{r:"1 B/R",n:5,med:1000000,psm:20000}],latest:[]}));
r = await get("/avail?d=imtiaz&key=RK"); t = await r.text();
ok("drill: 200 HTML", r.status===200 && t.startsWith("<!doctype html>"));
ok("drill: 'Verify the developer' section", t.includes("Verify the developer"));
ok("drill: MEED counts rendered", t.includes("7 completed") && t.includes("1 cancelled"));
ok("drill: official doors linked", URLS.every(u => t.includes(u)));
ok("drill: no PARCEL", !/parcel/i.test(t));
ok("drill: section sits above 'Latest registered'", t.indexOf("Verify the developer") < t.indexOf("Latest registered"));

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
