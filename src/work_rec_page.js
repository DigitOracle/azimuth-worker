// v617 - Momo Work: RECORD a meeting, briefing or interview, then turn it into a pre-filled log entry (Kendall, 21 Oct 2026).
// She taps Record, the browser records in self-contained 5-minute parts (Safari on the Mac gives AAC in MP4, Chrome gives Opus in WebM: the speech engine reads both),
// each part is sent as soon as it ends and transcribed on arrival, so a long meeting is never one big upload and nothing is lost if the page is closed.
// On Stop the server writes the notes and drafts the log entry; she checks it on the same screen as any other entry (Accept / edit / reject).
// This string runs INSIDE the Momo Work script (it uses $, KEY, QUEUE, QI, preview from there).
export const REC_BTN = '<div style="margin:2px 0 10px"><button type=button id=wrec class=ghost style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px"><svg viewBox="0 0 24 24" width=17 height=17 fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span>Record a meeting or briefing</span></button><div id=wrecbn></div></div>';

export const REC_JS = String.raw`
// ---- v617 RECORD ---------------------------------------------------------------------------------------------------------------------------
(function(){
var SEG_MS=300000,MAXH=4;   // five-minute parts; one recording up to four hours
var R=null,UPQ=[],UPBUSY=false,OV=null,TICK=null,LOCK=null,AC=null,AN=null,LISTED=[];
function rapi(o){return fetch("/momo/work/rec/api?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}).then(function(r){return r.json().then(function(j){if(!r.ok&&!j.error)j.error="The server answered "+r.status+".";return j})})}
function fmt(s){s=Math.max(0,Math.round(s));var h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+":"+String(m).padStart(2,"0"):m)+":"+String(x).padStart(2,"0")}
function mins(s){if(s<60)return "under a minute";s=Math.round(s/60);return s>=60?Math.floor(s/60)+" h "+(s%60)+" min":s+" min"}
function pickMime(){var c=["audio/mp4","audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus"];if(!window.MediaRecorder)return "";for(var i=0;i<c.length;i++){try{if(MediaRecorder.isTypeSupported(c[i]))return c[i]}catch(e){}}return ""}
function toast(msg,bad){var old=$("rtoast");if(old)old.remove();var t=document.createElement("div");t.id="rtoast";t.setAttribute("role","status");t.textContent=msg;t.style.cssText="position:fixed;left:12px;right:12px;top:calc(12px + env(safe-area-inset-top));z-index:120;padding:14px 16px;border-radius:14px;font:600 .95rem 'IBM Plex Sans',sans-serif;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.25);text-align:center;background:"+(bad?"#B04A3A":"#0A4F4A");document.body.appendChild(t);setTimeout(function(){if(t.parentNode)t.remove()},bad?9000:4500)}
function openOv(){if(OV)return OV;OV=document.createElement("div");OV.style.cssText="position:fixed;inset:0;z-index:100;background:#FAF7F1;overflow:auto;padding:18px 14px 90px";OV.innerHTML='<div style="max-width:560px;margin:0 auto" id=rbox></div>';document.body.appendChild(OV);return OV}
function closeOv(){if(OV){OV.remove();OV=null}}
function esc2(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]})}

// ---- the list of today's recordings (also the banner under the log box) ----
function loadList(cb){rapi({action:"list"}).then(function(j){LISTED=(j&&j.recs)||[];drawBanner();if(cb)cb()}).catch(function(){if(cb)cb()})}
function drawBanner(){var el=$("wrecbn");if(!el)return;var todo=LISTED.filter(function(r){return r.status!=="filed"&&r.status!=="recording"});
 el.innerHTML=todo.length?'<div class=ent style="margin:8px 0 0;padding:12px"><div class=line style="margin:0 0 6px"><b>'+todo.length+(todo.length===1?" recording":" recordings")+' waiting to become '+(todo.length===1?"an entry":"entries")+'</b></div>'+todo.map(function(r){return '<div style="display:flex;gap:8px;align-items:center;margin:6px 0"><div style="flex:1;font-size:.9rem">'+esc2(r.title||"Recording")+' <span style="color:#626B78">· '+esc2(r.started_hm)+' · '+mins(r.secs)+'</span></div><button type=button class=gold data-mk="'+r.id+'" style="width:auto;padding:9px 14px">Make entry</button></div>'}).join("")+'</div>':"";
 el.querySelectorAll("[data-mk]").forEach(function(b){b.onclick=function(){makeEntries(b.getAttribute("data-mk"),b)}})}

// ---- recording ----
function levelLoop(){if(!AN||!R)return;var d=new Uint8Array(AN.fftSize);AN.getByteTimeDomainData(d);var m=0;for(var i=0;i<d.length;i++){var v=Math.abs(d[i]-128);if(v>m)m=v}var el=$("rlvl");if(el)el.style.width=Math.min(100,Math.round(m*220/128))+"%";requestAnimationFrame(levelLoop)}
function startSeg(){if(!R||!R.stream)return;var rec;try{rec=new MediaRecorder(R.stream,R.mime?{mimeType:R.mime,audioBitsPerSecond:32000}:{audioBitsPerSecond:32000})}catch(e){try{rec=new MediaRecorder(R.stream)}catch(e2){fail("This browser cannot record. Use Safari or Chrome on your Mac.");return}}
 var chunks=[],my=rec,t0=Date.now(),RR=R;R.curT0=t0;rec.ondataavailable=function(ev){if(ev.data&&ev.data.size)chunks.push(ev.data)};
 rec.onstop=function(){var blob=new Blob(chunks,{type:(chunks[0]&&chunks[0].type)||RR.mime||"audio/mp4"}),secs=Math.round((Date.now()-t0)/1000);if(blob.size>2000)enqueue(RR.n++,blob,secs);else RR.n++;RR.segSecs+=secs;if(R===RR&&RR.stopping&&RR.cur===my){RR.cur=null;finishAll()}};
 rec.start();R.cur=rec;R.segTimer=setTimeout(function(){if(!R||R.cur!==my||R.paused||R.stopping)return;var old=my;startSeg();try{old.stop()}catch(e){}},SEG_MS)}
function enqueue(n,blob,secs){UPQ.push({n:n,blob:blob,secs:secs,tries:0});pump()}
function pump(){if(UPBUSY||!UPQ.length||!R&&!R_ID())return;UPBUSY=true;var it=UPQ[0];
 fetch("/momo/work/rec/chunk?key="+encodeURIComponent(KEY)+"&id="+encodeURIComponent(R_ID())+"&n="+it.n+"&secs="+it.secs,{method:"POST",headers:{"Content-Type":it.blob.type||"application/octet-stream"},body:it.blob}).then(function(r){return r.json()}).then(function(j){UPBUSY=false;if(j&&j.ok){UPQ.shift();if(R){R.sent++;if(j.pending)R.pending++}paint()}else{it.tries++;if(j&&j.error&&/too big|no recording/i.test(j.error))UPQ.shift();paint();setTimeout(pump,Math.min(30000,3000*it.tries));return}pump()}).catch(function(){UPBUSY=false;it.tries++;paint();setTimeout(pump,Math.min(30000,3000*it.tries))})}
function R_ID(){return R?R.id:LASTID}
var LASTID="";
function elapsed(){if(!R)return 0;return R.segSecs+(R.cur&&!R.paused?(Date.now()-R.curT0)/1000:0)}
function paint(){var b=$("rbox");if(!b||!R)return;var t=$("rtime");if(t)t.textContent=fmt(R.baseSecs()); var s=$("rstat");if(s){var waiting=UPQ.length;s.innerHTML=(R.sent?'<b>'+R.sent+'</b> '+(R.sent===1?"part":"parts")+' saved and read':"First part saves after five minutes")+(waiting?' · <span style="color:#B04A3A">'+waiting+' waiting to send'+(UPQ[0]&&UPQ[0].tries?" (retrying)":"")+'</span>':"")+(R.pending?' · <span style="color:#B04A3A">'+R.pending+' to retry on Stop</span>':"")}}
async function wakeLock(){try{if(navigator.wakeLock){LOCK=await navigator.wakeLock.request("screen");LOCK.addEventListener("release",function(){LOCK=null})}}catch(e){}}
document.addEventListener("visibilitychange",function(){if(R&&!R.stopping&&document.visibilityState==="visible"&&!LOCK)wakeLock()});
window.addEventListener("beforeunload",function(ev){if(R||UPQ.length){ev.preventDefault();ev.returnValue="";return ""}});

function drawStart(){openOv();var b=$("rbox");
 b.innerHTML='<a class=back id=rclose href="#" style="display:inline-block;margin-bottom:8px">&#8592; Back to the log</a><div class=tag>MOMO · WORK</div><h1 style="margin:4px 0 6px">Record</h1>'
 +'<div class=line style="margin:0 0 10px">A meeting, a briefing, an interview. It records in the background of this page and turns it into a log entry for you to check.</div>'
 +'<input id=rtitle placeholder="What is it? (optional, e.g. Monday briefing with Ali)" style="width:100%;box-sizing:border-box;padding:13px;border:1px solid #E3DDD1;border-radius:12px;font:inherit;margin-bottom:10px">'
 +'<button type=button id=rgo class=gold style="font-size:1.05rem;padding:16px">Start recording</button>'
 +'<div class=line style="margin:12px 0;color:#8A6F3E"><b>Tell the people in the room you are recording.</b> Keep this page open and your Mac awake and on power; closing the lid stops the recording. Parts already sent are safe.</div>'
 +'<div id=rlist></div>';
 $("rclose").onclick=function(e){e.preventDefault();closeOv()};$("rgo").onclick=function(){start($("rtitle").value.trim())};drawList()}
function drawList(){var el=$("rlist");if(!el)return;var L=LISTED;el.innerHTML=L.length?'<h2 style="font-size:.95rem;margin:16px 0 6px;color:#8A6F3E">Today\'s recordings</h2>'+L.map(function(r){var st=r.status==="filed"?"Filed":r.status==="drafted"?"Entry drafted":r.status==="recording"?"Never finished":"Read, no entry yet";
  return '<div class=ent style="padding:12px;margin:0 0 8px"><div style="font-weight:600">'+esc2(r.title||"Recording")+'</div><div class=m>'+esc2(r.started_hm)+' · '+mins(r.secs)+' · '+st+' · '+r.parts+(r.parts===1?" part":" parts")+'</div><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button type=button class=gold data-mk="'+r.id+'" style="width:auto;padding:9px 14px">'+(r.status==="recording"?"Finish and make entry":"Make entry")+'</button><a class=ghost target=_blank href="/momo/work/rec/view?key='+encodeURIComponent(KEY)+'&id='+r.id+'" style="text-decoration:none;padding:9px 14px;border-radius:12px;font-size:.9rem">Notes and transcript</a><button type=button class=ghost data-del="'+r.id+'" style="width:auto;padding:9px 14px">Delete</button></div></div>'}).join(""):"";
 el.querySelectorAll("[data-mk]").forEach(function(x){x.onclick=function(){makeEntries(x.getAttribute("data-mk"),x)}});
 el.querySelectorAll("[data-del]").forEach(function(x){x.onclick=function(){if(!confirm("Delete this recording and its transcript? This cannot be undone."))return;rapi({action:"delete",id:x.getAttribute("data-del")}).then(function(){loadList(drawList)})}})}
function fail(msg){toast(msg,true)}
async function start(title){
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){fail("This browser cannot record. Use Safari or Chrome on your Mac.");return}
 var stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})}catch(e){fail("Allow the microphone for this page (Safari: Settings for this website, Microphone: Allow), then tap Start again.");return}
 var s=await rapi({action:"start",title:title,date:$("wd")&&$("wd").value||""});if(!s||s.error){stream.getTracks().forEach(function(t){t.stop()});fail((s&&s.error)||"Could not start. Check the connection.");return}
 R={id:s.id,stream:stream,mime:pickMime(),n:0,sent:0,pending:0,segSecs:0,paused:false,stopping:false,cur:null,curT0:Date.now(),started:Date.now()};LASTID=s.id;
 R.baseSecs=function(){return R.segSecs+(R.cur&&!R.paused?(Date.now()-R.curT0)/1000:0)};
 try{AC=new (window.AudioContext||window.webkitAudioContext)();var src=AC.createMediaStreamSource(stream);AN=AC.createAnalyser();AN.fftSize=512;src.connect(AN);if(AC.resume)AC.resume()}catch(e){AN=null}
 wakeLock();drawRecording();R.curT0=Date.now();startSeg();TICK=setInterval(function(){if(!R)return;paint();if(R.baseSecs()>MAXH*3600&&!R.stopping)stop()},1000);levelLoop()}
function drawRecording(){var b=$("rbox");b.innerHTML='<div class=tag>MOMO · WORK</div><h1 style="margin:4px 0 10px">Recording<span id=rdot style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#B04A3A;margin-left:10px;vertical-align:middle"></span></h1>'
 +'<div style="font:600 3rem/1.1 \'IBM Plex Sans\',sans-serif;color:#0A4F4A;margin:6px 0" id=rtime>0:00</div><div style="height:8px;background:#E8E2D6;border-radius:6px;overflow:hidden;margin:6px 0 12px"><div id=rlvl style="height:100%;width:0;background:#15665C;transition:width .1s"></div></div>'
 +'<div class=line id=rstat style="margin:0 0 14px"></div>'
 +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><button type=button id=rpause class=ghost style="padding:15px">Pause</button><button type=button id=rstop class=gold style="padding:15px">Stop and make my entry</button></div>'
 +'<div class=line style="margin:14px 0;color:#8A6F3E">Keep this page open. Tell people you are recording.</div>';
 $("rpause").onclick=function(){if(!R)return;if(!R.paused){R.paused=true;clearTimeout(R.segTimer);var c=R.cur;R.cur=null;if(c){try{c.stop()}catch(e){}}$("rpause").textContent="Resume";$("rdot").style.opacity=".25"}else{R.paused=false;R.curT0=Date.now();startSeg();$("rpause").textContent="Pause";$("rdot").style.opacity="1"}};
 $("rstop").onclick=stop}
function stop(){if(!R||R.stopping)return;R.stopping=true;clearTimeout(R.segTimer);$("rstop").disabled=true;$("rstop").textContent="Saving…";$("rpause").disabled=true;
 var c=R.cur;if(c&&c.state!=="inactive"){try{c.stop()}catch(e){R.cur=null;finishAll()}}else{R.cur=null;finishAll()}}
function finishAll(){var b=$("rbox");if(b)b.querySelector("h1").textContent="Saving the last part…";if(R&&R.stream)R.stream.getTracks().forEach(function(t){t.stop()});clearInterval(TICK);try{if(AC)AC.close()}catch(e){}AC=null;AN=null;try{if(LOCK)LOCK.release()}catch(e){}
 var secs=Math.round(R.segSecs),id=R.id;R=null;waitSent(function(){var b2=$("rbox");if(b2)b2.querySelector("h1").textContent="Reading your meeting…";var st=$("rstat");if(st)st.textContent="This takes about a minute for a long meeting. Please wait.";
  rapi({action:"finish",id:id,secs:secs}).then(function(j){if(!j||j.error){fail((j&&j.error)||"Could not finish. Try Make entry from the list.");loadList(function(){drawStart()});return}makeEntries(id,null,j)}).catch(function(){fail("Lost the connection. The recording is saved: tap Make entry when you are back online.");loadList(function(){drawStart()})})})}
function waitSent(cb){if(!UPQ.length&&!UPBUSY){cb();return}var st=$("rstat");if(st)st.innerHTML='Sending the last parts: <b>'+UPQ.length+'</b> left';setTimeout(function(){waitSent(cb)},800)}

// ---- the entry ----
function makeEntries(id,btn,fin){if(btn){btn.disabled=true;btn.textContent="Reading…"}
 var b=$("rbox");if(b&&!fin){var h=b.querySelector("h1");if(h)h.textContent="Reading your meeting…"}
 rapi({action:"entries",id:id}).then(function(j){if(btn){btn.disabled=false;btn.textContent="Make entry"}
  if(!j||j.error){fail((j&&j.error)||"Could not read it just now. Your recording is safe: try again from the list.");loadList(function(){if($("rbox"))drawStart()});return}
  QUEUE=(j.entries||[]).map(function(e){e.src=(e.summary||"")+"\n\n[from a recording: "+(j.title||"meeting")+"]";e.src_file="Recording: "+(j.title||"meeting");e.src_rec=id;return e});QI=0;
  if(!QUEUE.length){fail("Nothing to file from that recording.");return}
  closeOv();$("wt").value="Recording read ("+mins(j.secs)+"): "+QUEUE.length+(QUEUE.length===1?" activity":" activities")+". Check each one. Notes and transcript: tap Record, then the recording in today's list.";
  preview(QUEUE[0]);scrollTo(0,0);toast("Meeting read. Check the entry below and save it.");loadList()}).catch(function(){if(btn){btn.disabled=false;btn.textContent="Make entry"}fail("Could not read it just now. Your recording is safe: try again from the list.")})}
$("wrec").onclick=function(){loadList(function(){drawStart()});drawStart()};
loadList();
})();
`;
