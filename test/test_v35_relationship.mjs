// Offline tests for v35 relationship memory: resolution, reindex, assemble, routes, intents, prep brief.
import worker from "../src/index.js";

const store = new Map();
const KV = { async get(k){return store.has(k)?store.get(k):null;}, async put(k,v){store.set(k,String(v));}, async delete(k){store.delete(k);}, async list({prefix}){return {keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name}))};} };

const waSent = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("graph.microsoft.com")||u.includes("login.microsoftonline")) return new Response(JSON.stringify({value:[],access_token:"t"}),{status:200});
  if (u.includes("graph.facebook.com")) { waSent.push(JSON.parse(init.body)); return new Response(JSON.stringify({messages:[{id:"x"}]}),{status:200}); }
  return new Response("{}",{status:200});
};
const D = 86400000, now = Date.now();
function cmt(id,text,dir,cp,ageDays){ store.set("cmt_"+id, JSON.stringify({id,text,direction:dir,counterparty:cp,due_hint:"",created:now-ageDays*D})); }
function evt(id,summary,ageDays){ store.set("evt_"+id, JSON.stringify({summary,start_iso:new Date(now-ageDays*D+4*3600*1000).toISOString().slice(0,19)+"+04:00",location:"",outlook_id:id})); }

// Seed: Bhaskar Raman (2 owed-by-me + 1 owed-to-me), "Bhaskar" alias, one past meeting titled only "Bhaskar"; Sara (different).
cmt("1","Bluebeam role confirmation","owed_by_me","Bhaskar Raman",12);
cmt("2","Send the connector one-pager","owed_by_me","Bhaskar",3);
cmt("3","Sign-off on the connector list","owed_to_me","Bhaskar Raman",8);
cmt("4","Review the Trojan BRD","owed_by_me","Sara",2);
evt("m1","Bluebeam discovery with Bhaskar",5);

const env = { MEETINGS:KV, READ_KEY:"RK", WHATSAPP_TOKEN:"tok", WA_PHONE_ID:"1", WA_ALLOWED:"971562276093" };
const get = (p) => worker.fetch(new Request("https://x"+p), env, {waitUntil(){}});
const waText = (body,id) => worker.fetch(new Request("https://x/wa",{method:"POST",headers:{"X-Azimuth-Forward":"FT","Content-Type":"application/json"},body:JSON.stringify({entry:[{changes:[{value:{messages:[{from:"971562276093",id:"wamid."+id,type:"text",text:{body}}]}}]}]})}), {...env, WA_FORWARD_TOKEN:"FT"}, {waitUntil(){}});

let pass=0, fail=0; const ok=(n,c)=>{ if(c){pass++;console.log("  ok -",n);}else{fail++;console.log("  FAIL -",n);} };

// 1. reindex + resolution
let r = await get("/people_reindex?key=RK"); let j = await r.json();
ok("reindex ran: 4 commitments, 1 meeting", j.commitments===4 && j.meetings===1);
ok("Bhaskar + Bhaskar Raman merged into ONE party (2 parties total: bhaskar-raman, sara)", j.parties===2);

// 2. /people roster
r = await get("/people?key=RK&format=json"); const parties = await r.json();
const bh = parties.find(p=>p.slug==="bhaskar-raman");
ok("bhaskar-raman party exists", !!bh);
ok("party has 3 commitments (2 mine + 1 theirs)", bh && bh.commitment_ids.length===3);
ok("meeting linked despite title saying only 'Bhaskar'", bh && bh.meeting_refs.length===1);
ok("aliases include 'bhaskar' and 'bhaskar-raman'", bh && bh.aliases.includes("bhaskar") && bh.aliases.includes("bhaskar-raman"));
ok("Sara is a separate party", parties.some(p=>p.slug==="sara"));

// 3. assembleParty via /person
r = await get("/person?key=RK&id=bhaskar-raman&format=json"); const o = await r.json();
ok("owe_them has 2, aged (12 first)", o.owe_them.length===2 && o.owe_them[0].age===12);
ok("owe_me has 1 (8d)", o.owe_me.length===1 && o.owe_me[0].age===8);
ok("last meeting present", !!o.last && o.last.summary.includes("Bluebeam"));
ok("thread has topic words", o.thread.includes("connector"));

// 4. /person HTML
r = await get("/person?key=RK&id=bhaskar-raman"); const html = await r.text();
ok("person page renders name + You owe + Owed to you", html.includes("Bhaskar Raman") && html.includes("You owe them") && html.includes("Owed to you"));
r = await get("/person?key=RK&id=nonexistent"); ok("unknown party -> 404", r.status===404);
r = await get("/people?key=WRONG"); ok("/people wrong key -> 401", r.status===401);

// 5. WhatsApp intents
waSent.length=0; await waText("status Bhaskar", 1);
ok("'status Bhaskar' replies with a brief mentioning Bluebeam", waSent.length===1 && JSON.stringify(waSent[0]).includes("Bluebeam"));
waSent.length=0; await waText("what do i owe", 2);
ok("'what do i owe' lists owed-by-me (Bluebeam + one-pager)", waSent.length===1 && JSON.stringify(waSent[0]).includes("Bluebeam"));
waSent.length=0; await waText("who owes me", 3);
ok("'who owes me' lists owed-to-me (sign-off)", waSent.length===1 && JSON.stringify(waSent[0]).toLowerCase().includes("sign-off"));

// 6. merge command: create a stray "B. Raman" party then merge
cmt("5","Extra thing","owed_by_me","B Raman",1);
await get("/people_reindex?key=RK");
r = await get("/people?key=RK&format=json"); let pc = (await r.json()).length;
ok("stray 'B Raman' made a 3rd party", pc===3);
waSent.length=0; await waText("merge B Raman into Bhaskar Raman", 4);
r = await get("/people?key=RK&format=json"); const after = await r.json();
ok("after merge, back to 2 parties", after.length===2);
ok("merge persists across reindex (palias)", !!store.get("palias_b-raman"));

// 7. meeting-prep brief injection — check meetingPrepBrief indirectly via nudge_run would need a live meeting; test the helper via /person is covered. Confirm party count stable after a reindex.
r = await get("/people_reindex?key=RK"); j = await r.json();
ok("reindex stable at 2 parties after merge", j.parties===2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
