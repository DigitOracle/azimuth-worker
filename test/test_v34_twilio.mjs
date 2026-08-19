// Offline tests for v34 Twilio ring: request shape, TwiML, auth, gating, /call_test.
import worker from "../src/index.js";

const store = new Map();
const KV = { async get(k){return store.has(k)?store.get(k):null;}, async put(k,v){store.set(k,String(v));}, async delete(k){store.delete(k);}, async list({prefix}){return {keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name}))};} };

let twilioReq = null;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("api.twilio.com")) { twilioReq = { url: u, init }; return new Response(JSON.stringify({sid:"CA123",status:"queued"}),{status:201}); }
  return new Response("{}",{status:200});
};

const base = () => ({ MEETINGS:KV, READ_KEY:"RK", WA_ALLOWED:"971562276093" });
const twil = () => ({ ...base(), TWILIO_SID:"ACxxx", TWILIO_TOKEN:"tok_secret", TWILIO_FROM:"+15550001111" });
const get = (p,env) => worker.fetch(new Request("https://x"+p), env, {waitUntil(){}});

let pass=0, fail=0;
const ok=(n,c)=>{ if(c){pass++;console.log("  ok -",n);}else{fail++;console.log("  FAIL -",n);} };

// 1. call_configured reflects Twilio
let r = await get("/nudge_test?key=RK", twil()); let j = await r.json();
ok("call_configured true with Twilio", j.call_configured===true && j.call_provider==="twilio");
r = await get("/nudge_test?key=RK", base()); j = await r.json();
ok("call_configured false without provider", j.call_configured===false);

// 2. /call_test fires a Twilio call with correct shape
twilioReq = null;
r = await get("/call_test?key=RK&text=" + encodeURIComponent("Sharjah meeting in 15 minutes"), twil());
j = await r.json();
ok("/call_test returns twilio result ok", j.result && j.result.provider==="twilio" && j.result.ok===true);
ok("hits the Calls.json endpoint for the SID", twilioReq && twilioReq.url === "https://api.twilio.com/2010-04-01/Accounts/ACxxx/Calls.json");
ok("POST method", twilioReq.init.method==="POST");
const auth = twilioReq.init.headers["Authorization"];
ok("Basic auth = base64(SID:token)", auth === "Basic " + Buffer.from("ACxxx:tok_secret").toString("base64"));
const body = new URLSearchParams(twilioReq.init.body);
ok("To = target with +", body.get("To")==="+971562276093");
ok("From = Twilio number", body.get("From")==="+15550001111");
ok("TwiML has Say with the text", body.get("Twiml").includes("<Say") && body.get("Twiml").includes("Sharjah meeting in 15 minutes"));
ok("TwiML well-formed Response wrapper", /^<Response><Say[^>]*>.*<\/Say><\/Response>$/.test(body.get("Twiml")));

// 3. XML escaping of dangerous chars in meeting title
twilioReq = null;
r = await get("/call_test?key=RK&text=" + encodeURIComponent('A&B <script> "x"'), twil());
await r.json();
const tw = new URLSearchParams(twilioReq.init.body).get("Twiml");
ok("escapes & < > in TwiML", tw.includes("A&amp;B") && tw.includes("&lt;script&gt;") && !tw.includes("<script>"));

// 4. deploy-safe: no provider -> no call, skipped
twilioReq = null;
r = await get("/call_test?key=RK", base());
j = await r.json();
ok("no provider -> skipped, no twilio call", j.result.skipped==="unconfigured" && twilioReq===null);

// 5. generic CALL_URL fallback still works
let genReq=null;
globalThis.fetch = async (url, init) => { const u=String(url); if(u.includes("callprovider")){genReq=u;return new Response("ok",{status:200});} return new Response("{}",{status:200}); };
let envGen = { ...base(), CALL_URL:"https://callprovider.test/c?to={phone}&msg={text}" };
r = await get("/call_test?key=RK&text=hello", envGen);
j = await r.json();
ok("generic CALL_URL fallback fires", genReq && genReq.includes("971562276093") && genReq.includes("hello"));

// 6. auth
r = await get("/call_test?key=WRONG", twil());
ok("/call_test wrong key -> 401", r.status===401);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
