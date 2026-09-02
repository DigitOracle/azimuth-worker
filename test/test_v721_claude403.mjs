// Offline tests for v72.1 — Anthropic 403 accounting via /health and /claude_ping.
import worker from "../src/index.js";
const store = new Map();
const KV = { async get(k){return store.has(k)?store.get(k):null;}, async put(k,v){store.set(k,String(v));}, async delete(k){store.delete(k);}, async list(o){const prefix=(o&&o.prefix)||"";return {keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name}))};} };
let anthropicCalls = 0; let plan = [];   // plan = list of statuses to return in order; then 200
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes("api.anthropic.com")) {
    anthropicCalls++;
    const st = plan.length ? plan.shift() : 200;
    if (st === 200) return new Response(JSON.stringify({content:[{type:"text",text:"1"}]}),{status:200});
    return new Response(JSON.stringify({error:{type:"forbidden",message:"Request not allowed"}}),{status:st});
  }
  if (u.includes("graph.facebook.com")) return new Response(JSON.stringify({display_phone_number:"+971 58"}),{status:200});
  return new Response("{}",{status:200});
};
const env = { MEETINGS:KV, READ_KEY:"RK", ANTHROPIC_API_KEY:"sk-test", WHATSAPP_TOKEN:"t", WA_PHONE_ID:"1", MAILBOXES:"" };
const get = (p) => worker.fetch(new Request("https://x"+p), env, {waitUntil(){}});
let pass=0, fail=0; const ok=(n,c)=>{ if(c){pass++;console.log("  ok -",n);}else{fail++;console.log("  FAIL -",n);} };
const today = new Date().toISOString().slice(0,10);

// 1. one transient 403 then success: health says ok, counter = 1, no total failure
plan = [403]; anthropicCalls = 0;
let j = await (await get("/health?key=RK")).json();
ok("health: claude ok after one retried 403", j.dependencies.claude === "ok");
ok("health: retried 403 counted once", j.claude_403 && j.claude_403.retried_403s_today === 1);
ok("health: no total failure recorded", j.claude_403.last_total_failure === null);
ok("health: retry actually happened (2 calls)", anthropicCalls === 2);

// 2. four 403s in a row: health reports FAILED, counter = 5, total failure recorded with status 403
plan = [403,403,403,403]; anthropicCalls = 0;
j = await (await get("/health?key=RK")).json();
ok("health: FAILED after 4 attempts", /FAILED after 4 attempts/.test(j.dependencies.claude));
ok("health: counter accumulates (5)", j.claude_403.retried_403s_today === 5);
ok("health: last_total_failure has status 403", j.claude_403.last_total_failure && j.claude_403.last_total_failure.last_status === 403);
ok("health: exactly 4 attempts made", anthropicCalls === 4);
ok("KV key is date-scoped", store.get("diag_claude403_" + today) === "5");

// 3. /claude_ping goes through the retry path too
plan = [403]; anthropicCalls = 0;
j = await (await get("/claude_ping?key=RK")).json();
ok("ping: fast tier HTTP 200 after retry", /HTTP 200/.test(j.fast));
ok("ping: smart tier HTTP 200", /HTTP 200/.test(j.smart));
plan = [403,403,403,403];
j = await (await get("/claude_ping?key=RK")).json();
ok("ping: fast tier reports FAILED after 4 attempts", /FAILED after 4 attempts/.test(j.fast));

// 4. a 401 is NOT retried and NOT counted as a 403
const before = store.get("diag_claude403_" + today); plan = [401]; anthropicCalls = 0;
j = await (await get("/health?key=RK")).json();
ok("health: 401 surfaces as HTTP 401", j.dependencies.claude === "HTTP 401");
ok("health: 401 not retried (1 call)", anthropicCalls === 1);
ok("health: 401 not counted as 403", store.get("diag_claude403_" + today) === before);

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
