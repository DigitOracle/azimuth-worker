// v814 (Najjuko 8 Nov: "tapping Done removes the task but nothing tells me it worked") - one toast for every one-tap action on Work home and Meetings.
// window.momoToast(text, { undo: fn, error: bool, ms }) - a cream card at the bottom of the screen; with undo it shows an Undo button for about 5 seconds.
// An error toast is red-edged and stays until tapped. Only one toast at a time; a new one replaces the old.
export const MOMO_TOAST_JS = String.raw`(function(){
if(window.momoToast)return;
var cur=null,tm=null;
window.momoToast=function(text,o){o=o||{};try{if(cur&&cur.parentNode)cur.parentNode.removeChild(cur);clearTimeout(tm);
var w=document.createElement("div");w.setAttribute("role",o.error?"alert":"status");w.className="mtst";
w.style.cssText="position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:10000;max-width:min(92vw,420px);box-sizing:border-box;display:flex;align-items:center;gap:12px;background:#FFFDF9;border:1.5px solid "+(o.error?"#B4533C":"#2F7D5B")+";color:#1C2321;border-radius:14px;padding:12px 14px;box-shadow:0 8px 24px rgba(28,35,33,.18);font:600 .92rem 'IBM Plex Sans',sans-serif";
var t=document.createElement("span");t.style.cssText="flex:1;min-width:0;overflow-wrap:anywhere";t.textContent=text;w.appendChild(t);
if(o.undo){var u=document.createElement("button");u.type="button";u.textContent="Undo";u.style.cssText="border:1.5px solid #0A4F4A;background:#fff;color:#0A4F4A;border-radius:10px;padding:7px 12px;font:600 .86rem 'IBM Plex Sans',sans-serif;cursor:pointer";
u.onclick=function(){clearTimeout(tm);if(w.parentNode)w.parentNode.removeChild(w);o.undo()};w.appendChild(u)}
if(o.error)w.onclick=function(){if(w.parentNode)w.parentNode.removeChild(w)};
document.body.appendChild(w);cur=w;if(!o.error)tm=setTimeout(function(){if(w.parentNode)w.parentNode.removeChild(w)},o.ms||5000)}catch(e){}};
})();`;
