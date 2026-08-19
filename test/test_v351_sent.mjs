// Offline tests for v35.1 sent-items scan + own-brand guard.
import worker from "../src/index.js";

const store = new Map();
const KV = { async get(k){return store.has(k)?store.get(k):null;}, async put(k,v){store.set(k,String(v));}, async delete(k){store.delete(k);}, async list(o){const prefix=(o&&o.prefix)||"";return {keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name}))};} };

// Mock Graph: token, and sentitems returns two emails (one with a promise, one without).
let SENT = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("login.microsoftonline")||u.includes("/token")) return new Response(JSON.stringify({access_token:"t"}),{status:200});
  if (u.includes("sentitems/messages")) return new Response(JSON.stringify({value:SENT}),{status:200});
  if (u.includes("api.anthropic.com")) {
    const body = JSON.parse(init.body);
    const usr = (body.messages||[]).map(m=>typeof m.content==="string"?m.content:JSON.stringify(m.content)).join(" ");
    // return a commitment only if the body mentions "deck"
    const json = usr.includes("deck")
      ? { commitments:[{text:"Send the revised deck", counterparty:"Samir", due_hint:"Friday"}] }
      : { commitments:[] };
    return new Response(JSON.stringify({content:[{type:"text",text:JSON.stringify(json)}]}),{status:200});
  }
  if (u.includes("graph.microsoft.com")) return new Response(JSON.stringify({value:[]}),{status:200});
  return new Response("{}",{status:200});
};
function sentMsg(id,subject,body,toName){ return {id,subject,bodyPreview:body,sentDateTime:new Date().toISOString(),toRecipients:[{emailAddress:{address:toName.toLowerCase()+"@x.com",name:toName}}]}; }

const env = { MEETINGS:KV, READ_KEY:"RK", MS_CLIENT_ID:"c", MS_CLIENT_SECRET:"s", MS_TENANT_ID:"t", MAILBOXES:"ceo@x.com", ANTHROPIC_API_KEY:"sk-test" };
const get = (p) => worker.fetch(new Request("https://x"+p), env, {waitUntil(){}});

let pass=0, fail=0; const ok=(n,c)=>{ if(c){pass++;console.log("  ok -",n);}else{fail++;console.log("  FAIL -",n);} };

// 1. scan_sent extracts an owed_by_me commitment from a sent promise
SENT = [ sentMsg("s1","Proposal","Thanks Samir — I'll send the revised deck by Friday.","Samir"), sentMsg("s2","Re: lunch","Sounds good, see you then!","Ali") ];
let r = await get("/scan_sent?key=RK&mins=1440"); let j = await r.json();
ok("scan_sent ran, made 1 commitment", j.made===1 && j.scanned===2);
const cmtKey = [...store.keys()].find(k=>k.startsWith("cmt_sent_"));
ok("sent commitment written", !!cmtKey);
const cmt = JSON.parse(store.get(cmtKey));
ok("direction owed_by_me", cmt.direction==="owed_by_me");
ok("counterparty = Samir", cmt.counterparty==="Samir");
ok("due_hint carried (Friday)", cmt.due_hint==="Friday");
ok("provenance src.type = sent-email", cmt.src && cmt.src.type==="sent-email");

// 2. idempotent — re-run makes nothing new
r = await get("/scan_sent?key=RK&mins=1440"); j = await r.json();
ok("re-run idempotent (0 made)", j.made===0);

// 3. no-promise email produced nothing
ok("chit-chat email (Ali) produced no commitment", ![...store.keys()].some(k=>k.startsWith("cmt_") && k.includes("s2")));

// 4. auth
r = await get("/scan_sent?key=WRONG"); ok("scan_sent wrong key ignored (not 200 json)", r.status!==200 || !(await r.text()).includes("made"));

// 5. own-brand guard: cmtPut must reject a commitment whose counterparty is an own brand
// simulate by scanning a sent mail that promises something to "DigitalAbbot" (own brand)
SENT = [ sentMsg("s3","Internal","I'll update the deck for DigitalAbbot.","DigitalAbbot") ];
// force classifier to return a commitment for this (mentions deck) with counterparty DigitalAbbot
globalThis.fetch = (orig => async (url, init) => {
  const u = String(url);
  if (u.includes("api.anthropic.com")) return new Response(JSON.stringify({content:[{type:"text",text:JSON.stringify({commitments:[{text:"Update the deck",counterparty:"DigitalAbbot",due_hint:""}]})}]}),{status:200});
  return orig(url, init);
})(globalThis.fetch);
const before = [...store.keys()].filter(k=>k.startsWith("cmt_")).length;
r = await get("/scan_sent?key=RK&mins=1440");
const after = [...store.keys()].filter(k=>k.startsWith("cmt_")).length;
ok("own-brand counterparty (DigitalAbbot) NOT written as a commitment", after===before);

// 6. own-brand never becomes a party — seed an existing 'Abbot' commitment directly, reindex, expect no party
store.set("cmt_legacy1", JSON.stringify({id:"legacy1",text:"something",direction:"owed_to_me",counterparty:"Abbot",created:Date.now()}));
store.set("cmt_legacy2", JSON.stringify({id:"legacy2",text:"real thing",direction:"owed_by_me",counterparty:"Bhaskar Raman",created:Date.now()}));
r = await get("/people_reindex?key=RK"); j = await r.json();
r = await get("/people?key=RK&format=json"); const parties = await r.json();
ok("reindex built parties, 'Abbot' excluded", parties.some(p=>p.slug==="bhaskar-raman") && !parties.some(p=>String(p.name).toLowerCase()==="abbot"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
