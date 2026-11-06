// v787a - the recording OUTBOX, shared: every finished part is kept on the phone (IndexedDB "momo_rec"/"parts", the same store and key
// "<id>_<n>" as the v779 full Work recorder, so either page resumes the other's parts) until the server confirms it; uploads retry with a
// growing wait for as long as the page is open; unsent parts upload again when Momo opens, comes back online or becomes visible.
// Used by the simple meeting page (src/work_simple.js). Served as a plain script, so no template placeholders and no backticks inside.
export const REC_OUTBOX_JS = String.raw`(function(){
if(window.MomoOutbox)return;
window.MomoOutbox=function(KEY,H){H=H||{};
 var Q=[],BUSY=false,IDB=null,WAKE=null,DONE={};
 function idb(){if(IDB)return IDB;IDB=new Promise(function(res,rej){try{var q=indexedDB.open("momo_rec",1);q.onupgradeneeded=function(){q.result.createObjectStore("parts",{keyPath:"k"})};q.onsuccess=function(){res(q.result)};q.onerror=function(){rej(q.error)}}catch(e){rej(e)}});return IDB}
 function put(it){return idb().then(function(db){return new Promise(function(res,rej){var tx=db.transaction("parts","readwrite");tx.objectStore("parts").put({k:it.id+"_"+it.n,id:it.id,n:it.n,blob:it.blob,secs:it.secs,type:it.blob&&it.blob.type,label:it.label||"",at:Date.now()});tx.oncomplete=function(){res()};tx.onerror=function(){rej(tx.error)}})}).catch(function(){})}
 function del(it){return idb().then(function(db){db.transaction("parts","readwrite").objectStore("parts").delete(it.id+"_"+it.n)}).catch(function(){})}
 function all(){return idb().then(function(db){return new Promise(function(res){var out=[],tx=db.transaction("parts","readonly"),cu=tx.objectStore("parts").openCursor();cu.onsuccess=function(){var c=cu.result;if(c){out.push(c.value);c.continue()}else res(out)};cu.onerror=function(){res(out)}})}).catch(function(){return []})}
 function wait(t){return Math.min(60000,2000*Math.pow(2,Math.min(5,t)))}
 function wake(){try{if(navigator.wakeLock&&!WAKE)navigator.wakeLock.request("screen").then(function(l){WAKE=l;l.addEventListener("release",function(){WAKE=null})}).catch(function(){})}catch(e){}}
 function sleep(){try{if(WAKE)WAKE.release()}catch(e){}WAKE=null}
 function changed(){if(H.onChange)try{H.onChange(Q.length,Q[0]||null)}catch(e){}}
 function pump(){if(BUSY||!Q.length){if(!Q.length)sleep();changed();return}BUSY=true;var it=Q[0],ac=window.AbortController?new AbortController():null,to=setTimeout(function(){if(ac)ac.abort()},90000);wake();changed();
  fetch("/momo/work/rec/chunk?key="+encodeURIComponent(KEY)+"&id="+encodeURIComponent(it.id)+"&n="+it.n+"&secs="+it.secs,{method:"POST",headers:{"Content-Type":it.blob.type||"application/octet-stream"},body:it.blob,signal:ac?ac.signal:undefined})
  .then(function(r){clearTimeout(to);return r.json().catch(function(){return {error:"The server answered "+r.status}})})
  .then(function(j){BUSY=false;if(j&&j.ok){Q.shift();del(it);if(H.onSent)try{H.onSent(it,j)}catch(e){}if(it.resumed&&!Q.some(function(x){return x.id===it.id})&&!DONE[it.id]){DONE[it.id]=1;if(H.onResumedDone)try{H.onResumedDone(it)}catch(e){}}pump();return}
    it.tries++;if(j&&j.error&&/too big|no recording|empty/i.test(j.error)){Q.shift();del(it);if(H.onDropped)try{H.onDropped(it,j.error)}catch(e){}pump();return}changed();setTimeout(pump,wait(it.tries))})
  .catch(function(){clearTimeout(to);BUSY=false;it.tries++;changed();setTimeout(pump,wait(it.tries))})}
 function add(id,n,blob,secs,label){var it={id:id,n:n,blob:blob,secs:secs,tries:0,label:label||""};Q.push(it);put(it).then(pump,pump)}
 function resume(){all().then(function(rows){var have={};Q.forEach(function(x){have[x.id+"_"+x.n]=1});var n=0;rows.sort(function(a,b){return a.id===b.id?a.n-b.n:(a.id<b.id?-1:1)}).forEach(function(r){if(have[r.k]||!r.blob)return;Q.push({id:r.id,n:r.n,blob:r.blob,secs:r.secs||0,tries:0,label:r.label,resumed:1});n++});if(n)pump();else changed()})}
 window.addEventListener("online",function(){pump()});document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")resume()});
 setTimeout(resume,1200);
 return {add:add,resume:resume,pump:pump,left:function(){return Q.length},busy:function(){return BUSY||Q.length>0},leftFor:function(id){return Q.filter(function(x){return x.id===id}).length}};
};
})();`;
