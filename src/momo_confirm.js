// v778 (Kendall, 5 Nov 2026): every save anywhere in Momo shows a clear confirmation, and no failure is ever silent.
// ONE shared helper, loaded on every Momo page by momoPage():
//   - window.momoConfirm(ok, title, detail): a small centred cream card with a tick ("Saved", what, where) that closes
//     after about 2 s or on tap; a failure card states the reason plainly and stays until tapped.
//   - a fetch wrapper: any POST to a Momo address that WRITES is confirmed automatically from its answer; a request that
//     fails, or answers ok:false / an error status, always shows the failure card. Read-only POSTs (previews, dry runs,
//     lookups) are left alone, so a page that only reads never flashes "Saved".
// Pages can call momoConfirm themselves for a more specific line; the wrapper then stays quiet for that request
// when the page passes the header "X-Momo-Confirm: page".
// Rules for this file: plain ES5 in the string, no backticks, no template placeholders (it is served inside HTML).
export const MOMO_CONFIRM_JS = String.raw`(function(){
if (window.momoConfirm) return;
var READ = /^(dry|simulate|flow_get|alerts|handovers|status|ck_roster|ck_team_get|preview|data|list|search|get|lookup|request_live|ck_make|ck_names)$/;
function el(t,s,h){var e=document.createElement(t);if(s)e.setAttribute("style",s);if(h!=null)e.innerHTML=h;return e}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]})}
var cur=null,timer=null;
window.momoConfirm=function(ok,title,detail){
  try{ if(cur&&cur.parentNode)cur.parentNode.removeChild(cur); clearTimeout(timer);
  var w=el("div","position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(28,40,38,.18);padding:16px");
  var ic=ok?'<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#0A4F4A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>'
    :'<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#B4533C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 16.5v.5"/></svg>';
  var c=el("div","background:#FFFDF9;border:1px solid "+(ok?"#C5A56A":"#B4533C")+";border-radius:18px;box-shadow:0 10px 34px rgba(0,0,0,.16);padding:18px 20px;max-width:340px;width:100%;text-align:center;font-family:IBM Plex Sans,sans-serif",
    ic+'<div style="font:600 1.15rem Fraunces,serif;color:'+(ok?"#0A4F4A":"#8A3E3E")+';margin:6px 0 4px">'+esc(title||(ok?"Saved":"Not saved"))+'</div>'
    +(detail?'<div style="font:500 .9rem IBM Plex Sans,sans-serif;color:#1C2826;line-height:1.35">'+esc(detail)+'</div>':'')
    +(ok?'':'<div style="font:500 .78rem IBM Plex Sans,sans-serif;color:#5F6B66;margin-top:10px">Tap to close. Nothing was changed.</div>'));
  c.setAttribute("role",ok?"status":"alert"); w.appendChild(c); w.onclick=function(){if(w.parentNode)w.parentNode.removeChild(w)};
  document.body.appendChild(w); cur=w; if(ok) timer=setTimeout(function(){if(w.parentNode)w.parentNode.removeChild(w)},2000);
  }catch(e){}
};
function what(b,j){
  var a=String((b&&b.action)||"").replace(/_/g," "), code=(j&&j.item&&j.item.code)||(b&&b.code)||"", name=(b&&(b.name||b.title))||"";
  var where="";
  if(j&&typeof j.written==="number") where=j.written+(j.written===1?" cell":" cells")+" updated in the workbook";
  else if(j&&(j.created!=null||j.updated!=null)&&b&&b.action==="import") where=(j.created||0)+" added, "+(j.updated||0)+" updated from the workbook";
  var head=code||name||"";
  if(/delete|remove/.test(a)) return ["Deleted",(head?head+" removed":"Removed")];
  return ["Saved",[head,(a&&!/^save$/.test(a)&&!head?a:""),where].filter(Boolean).join(" · ")||"Your change is saved"];
}
var of=window.fetch; if(!of) return;
window.fetch=function(u,o){
  var url=String(u&&u.url||u||""), m=String((o&&o.method)||(u&&u.method)||"GET").toUpperCase();
  if(m!=="POST"||!/\/momo\//.test(url)||/\/momo\/work\/rec\//.test(url)||/\/momo\/work\/voicetest/.test(url)) return of.apply(this,arguments);
  var body=null; try{ body=o&&typeof o.body==="string"&&o.body.charAt(0)==="{"?JSON.parse(o.body):null }catch(e){}
  var quiet=o&&o.headers&&(o.headers["X-Momo-Confirm"]==="page"||(o.headers.get&&o.headers.get("X-Momo-Confirm")==="page"));
  var isRead=body&&(READ.test(String(body.action||""))||body.apply===false||(body.action==="push"&&!body.apply)||(body.action==="import"&&!body.apply));
  return of.apply(this,arguments).then(function(r){
    if(isRead) return r;
    r.clone().text().then(function(t){var j=null;try{j=JSON.parse(t)}catch(e){}
      var bad=!r.ok||(j&&j.ok===false)||(j&&j.error&&j.ok!==true);
      if(bad){ var why=(j&&(j.error&&(j.error.message||j.error))||j&&j.message)||(r.status===401||r.status===403?"This link is not allowed to change that.":r.status===429?"Too many changes at once. Wait a moment and try again.":"The server said "+r.status+".");
        if(Array.isArray(why)) why=why.join(" "); window.momoConfirm(false,"Not saved",String(why).slice(0,220)); }
      else if(!quiet){ var w=what(body,j); window.momoConfirm(true,w[0],w[1]); }
    }).catch(function(){});
    return r;
  },function(e){ if(!isRead) window.momoConfirm(false,"Not saved","No connection. Your change did not reach Momo. Check the signal and try again."); throw e; });
};
})();`;
