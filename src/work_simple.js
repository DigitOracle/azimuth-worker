// v671 - SIMPLE MOMO for Kendall (29 Oct 2026: "momo needs to be a bit simpler, just record meeting minutes ... record, then distribute").
// His /momo/work opens this page instead of the full Work log (the full log is still there at ?full=1). Three things only: Record a meeting,
// Momo writes the minutes, Send them (WhatsApp, Email, Copy, PDF). It drives the same recorder endpoints as the full page (rec/api start ->
// rec/chunk five-minute parts -> finish -> read kind=minutes, one stage per call), so recordings, transcripts and minutes are the same records.
// No logo on the minutes (his wrapper removes the FN monogram and swaps the internal-only footer for a participants footer).
export const SIMPLE_BODY = (key) => '<div class=tag>MOMO · MEETINGS</div><h1>Record, minutes, send</h1>'
  + '<div class=ent style="padding:14px"><input id=st placeholder="Meeting name (optional), e.g. Bluebeam · Engineering Office" style="width:100%;box-sizing:border-box;margin:0 0 10px">'
  + '<button type=button id=sgo class=gold style="width:100%;min-height:56px;font-size:1.05rem">&#9679; Record</button>'
  + '<div id=sbox style="display:none;text-align:center;margin-top:12px"><div id=stime style="font-size:2rem;font-weight:700;color:#0A4F4A">0:00</div><div id=sstat class=line style="margin:4px 0 10px">Recording. Keep Momo open and the screen on.</div>'
  + '<button type=button id=sstop class=gold style="width:100%;min-height:52px">&#9632; Stop and write the minutes</button></div>'
  + '<div id=smsg class=line style="margin-top:10px"></div></div>'
  + '<h2 style="margin:18px 0 8px">Meetings</h2><div id=slist class=line>Loading…</div>'
  + '<p style="margin-top:22px;font-size:.8rem"><a href="/momo/work?full=1&key=' + encodeURIComponent(key) + '" style="color:#626B78">Full work log</a></p>'
  + '<script>var KEY=' + JSON.stringify(key).replace(/</g, "\\u003c") + ';</script><script src="/momo/work/simple.js?key=' + encodeURIComponent(key) + '"></script>';

export const SIMPLE_JS = String.raw`(function(){
function $(i){return document.getElementById(i)}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]})}
function api(o){return fetch("/momo/work/rec/api?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}).then(function(r){return r.json().catch(function(){return {error:"The server answered "+r.status}})})}
function fmt(s){s=Math.max(0,Math.round(s));var h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+":"+String(m).padStart(2,"0"):m)+":"+String(x).padStart(2,"0")}
function minUrl(id){return "/momo/work/rec/minutes?key="+encodeURIComponent(KEY)+"&id="+encodeURIComponent(id)}
var SEG=300000,R=null,Q=[],BUSY=false,LOCK=null;
function pick(){var c=["audio/mp4","audio/webm;codecs=opus","audio/webm"];if(!window.MediaRecorder)return "";for(var i=0;i<c.length;i++)if(MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(c[i]))return c[i];return ""}
function seg(){var rec;try{rec=R.mime?new MediaRecorder(R.stream,{mimeType:R.mime,audioBitsPerSecond:32000}):new MediaRecorder(R.stream)}catch(e){msg("This browser cannot record. Use Safari or Chrome.");return}
 var ch=[],t0=Date.now(),me=rec,RR=R;RR.t0=t0;rec.ondataavailable=function(e){if(e.data&&e.data.size)ch.push(e.data)};
 rec.onstop=function(){var b=new Blob(ch,{type:(ch[0]&&ch[0].type)||RR.mime||"audio/mp4"}),secs=Math.round((Date.now()-t0)/1000);RR.done+=secs;if(b.size>=1000)Q.push({n:RR.n,b:b,secs:secs,tries:0});RR.n++;pump();if(RR.stopping&&RR.cur===me){RR.cur=null;finish()}};
 rec.start();R.cur=rec;R.timer=setTimeout(function(){if(!R||R.cur!==me||R.stopping)return;seg();try{me.stop()}catch(e){}},SEG)}
function pump(){if(BUSY||!Q.length)return;BUSY=true;var it=Q[0];
 fetch("/momo/work/rec/chunk?key="+encodeURIComponent(KEY)+"&id="+encodeURIComponent(R0)+"&n="+it.n+"&secs="+it.secs,{method:"POST",headers:{"Content-Type":it.b.type||"application/octet-stream"},body:it.b}).then(function(r){return r.json().catch(function(){return {}})}).then(function(j){BUSY=false;if(j&&j.ok){Q.shift();sent++;stat()}else{it.tries++;if(it.tries>=6)Q.shift();setTimeout(pump,3000*it.tries);return}pump()}).catch(function(){BUSY=false;it.tries++;if(it.tries>=6)Q.shift();setTimeout(pump,3000*it.tries)})}
var R0="",sent=0,TK=null;
function stat(){var s=$("sstat");if(s&&R&&!R.stopping)s.textContent=(sent?sent+(sent===1?" part":" parts")+" saved · ":"")+"Recording. Keep Momo open and the screen on."}
function msg(t){$("smsg").innerHTML=t}
function start(){if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){msg("This browser cannot record.");return}
 $("sgo").disabled=true;msg("Starting…");
 navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}}).then(function(stream){
  return api({action:"start",title:$("st").value}).then(function(j){if(!j||!j.ok){stream.getTracks().forEach(function(t){t.stop()});$("sgo").disabled=false;msg(esc((j&&j.error)||"Could not start."));return}
   R0=j.id;sent=0;R={stream:stream,mime:pick(),n:0,done:0,stopping:false};seg();$("sgo").style.display="none";$("sbox").style.display="block";msg("");
   try{if(navigator.wakeLock)navigator.wakeLock.request("screen").then(function(l){LOCK=l}).catch(function(){})}catch(e){}
   TK=setInterval(function(){if(R)$("stime").textContent=fmt(R.done+(R.cur?(Date.now()-R.t0)/1000:0))},500)})
 }).catch(function(){$("sgo").disabled=false;msg("Momo needs the microphone. Allow it and tap Record again.")})}
function stop(){if(!R)return;R.stopping=true;$("sstop").disabled=true;$("sstat").textContent="Saving the last part…";clearTimeout(R.timer);try{R.cur.stop()}catch(e){finish()}}
function finish(){var total=R.done;R.stream.getTracks().forEach(function(t){t.stop()});clearInterval(TK);if(LOCK)try{LOCK.release()}catch(e){}
 (function wait(){if(Q.length||BUSY){$("sstat").textContent="Sending "+Q.length+" part(s)…";setTimeout(wait,1500);return}
  $("sstat").textContent="Reading the meeting…";
  api({action:"finish",id:R0,secs:total}).then(function(j){if(j&&j.error){$("sstat").textContent=j.error;reset();return}write(R0,$("sstat"))})})()}
function reset(){R=null;$("sstop").disabled=false;setTimeout(function(){$("sbox").style.display="none";$("sgo").style.display="";$("sgo").disabled=false;$("st").value="";load()},4000)}
function write(id,el){(function step(){api({action:"read",id:id,kind:"minutes"}).then(function(j){
  if(j.state==="ready"){el.innerHTML="Minutes ready. <a href='"+minUrl(id)+"'>Open and send</a>";if(R){R=null;$("sstop").disabled=false;$("sbox").style.display="none";$("sgo").style.display="";$("sgo").disabled=false;$("st").value="";msg("Minutes ready. <a href='"+minUrl(id)+"'>Open and send</a>")}load();return}
  if(j.state==="error"){el.innerHTML=esc(j.error||"Momo could not finish.")+" <button type=button class=ghost data-w='"+id+"' style='width:auto;padding:6px 10px'>Try again</button>";if(R){R=null;$("sbox").style.display="none";$("sgo").style.display="";$("sgo").disabled=false}return}
  el.textContent=(j.label||"Writing the minutes")+(j.of?" ("+(j.n+1)+" of "+j.of+")":"")+"…";setTimeout(step,j.waiting?5000:800)}).catch(function(){setTimeout(step,5000)})})()}
function load(){api({action:"archive"}).then(function(j){var rs=(j&&j.recs)||[];if(!rs.length){$("slist").textContent="No meetings yet. Tap Record.";return}
 $("slist").innerHTML=rs.slice(0,40).map(function(r){return "<div class=ent style='padding:12px;margin:0 0 8px'><div style='font-weight:600'>"+esc(r.title||"Meeting")+"</div><div class=line style='margin:2px 0 8px'>"+esc(r.date)+" · "+esc(r.started_hm)+" · "+Math.round((r.secs||0)/60)+" min</div><div id='w"+r.id+"' class=line>"
  +(r.minutes?"<a class=gold href='"+minUrl(r.id)+"' style='display:inline-block;text-decoration:none;padding:9px 14px;width:auto'>Minutes · Send</a>":"<button type=button class=ghost data-w='"+r.id+"' style='width:auto;padding:9px 14px'>Write the minutes</button>")+"</div></div>"}).join("")})}
document.addEventListener("click",function(e){var t=e.target.closest&&e.target.closest("[data-w]");if(t){var id=t.getAttribute("data-w"),el=t.parentNode;el.textContent="Writing the minutes…";write(id,el)}});
window.addEventListener("beforeunload",function(e){if(R||Q.length){e.preventDefault();e.returnValue=""}});
$("sgo").onclick=start;$("sstop").onclick=stop;load();
})();`;

// the minutes page for Kendall: no logo, a participants footer instead of "internal use only", and one-tap WhatsApp / Email beside Share and PDF
export function simpleMinutesPage(html) {
  return String(html).replace(/<img class=mono[^>]*>/, "")
    .replace(/CONFIDENTIAL · [^<]*?All rights reserved\./g, "CONFIDENTIAL · Prepared by DigitAlchemy® Tech Limited for the participants of this meeting. Not to be shared further without prior written approval. contact@digitalabbot.io · +971 56 227 6093 · © 2026 DigitAlchemy® Tech Limited.")
    .replace("<button class=bt id=sv>Share</button>", "<button class=bt id=wa>WhatsApp</button><button class=bt id=em>Email</button><button class=bt id=sv>Share</button>")
    .replace("</body>", "<script>(function(){function t(){var s=document.getElementById('sheet');return (s&&s.innerText)||T}document.getElementById('wa').onclick=function(){location.href='https://wa.me/?text='+encodeURIComponent(t().slice(0,3500))};document.getElementById('em').onclick=function(){location.href='mailto:?subject='+encodeURIComponent(document.title)+'&body='+encodeURIComponent(t().slice(0,1800)+(t().length>1800?'\\n\\n[Full minutes attached as PDF]':''))}})()</script></body>");
}
