// v791 (Kendall 6 Nov 2026, promised to Najjuko on their call): a Quick task button on EVERY Work screen. She taps it, types or
// speaks the task, optionally says who it is for and when it is due, and it is on her task list at once: no log entry, no hours.
// Loaded by momoPage() on every Momo page; it only shows itself under /momo/work. The server side is the task_quick action in
// work_log.js (quickTaskRecord). Rules for this file: plain ES5 in the string, no backticks, no template placeholders.
export const QUICK_TASK_JS = String.raw`(function(){
if (window.momoQuickTask || location.pathname.indexOf("/momo/work") !== 0) return;
var q = new URLSearchParams(location.search), KEY = q.get("key") || ""; if (!KEY) return;
function el(t, s, h) { var e = document.createElement(t); if (s) e.setAttribute("style", s); if (h != null) e.innerHTML = h; return e; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]; }); }
function api(o) { return fetch("/momo/work/api?key=" + encodeURIComponent(KEY), { method: "POST", headers: { "Content-Type": "application/json", "X-Momo-Confirm": "page" }, body: JSON.stringify(o) })
  .then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "The server answered " + r.status; return j; }, function () { return { error: "The server answered " + r.status }; }); }); }
var PLUS = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
var MIC = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></svg>';
var btn = el("button", "position:fixed;right:14px;bottom:92px;z-index:900;display:flex;align-items:center;gap:7px;border:0;border-radius:999px;background:#0A4F4A;color:#FFFDF9;padding:12px 16px;font:600 .92rem IBM Plex Sans,sans-serif;box-shadow:0 6px 18px rgba(10,79,74,.28);cursor:pointer;min-height:46px", PLUS + "<span>Quick task</span>");
btn.type = "button"; btn.id = "qt_btn"; btn.setAttribute("aria-label", "Add a quick task");
var people = null, open = null;
function shut() { if (open && open.parentNode) open.parentNode.removeChild(open); open = null; }
function show() {
  shut();
  var o = el("div", "position:fixed;inset:0;z-index:2147482500;background:rgba(28,40,38,.3);display:flex;align-items:flex-end;justify-content:center;padding:12px");
  var IN = "width:100%;box-sizing:border-box;border:1px solid #D8D1C4;border-radius:12px;padding:11px;font:500 1rem IBM Plex Sans,sans-serif;background:#fff;color:#1C2826";
  var LB = "display:block;font:600 .72rem IBM Plex Mono,monospace;letter-spacing:.08em;color:#8A6F3E;margin:12px 0 5px";
  o.innerHTML = '<div role="dialog" aria-modal="true" aria-label="Quick task" style="background:#FFFDF9;border:1px solid #C5A56A;border-radius:18px;padding:16px;width:100%;max-width:440px;font-family:IBM Plex Sans,sans-serif;color:#1C2826;max-height:92vh;overflow:auto">'
    + '<div style="font:600 1.2rem Fraunces,serif;color:#0A4F4A">Quick task</div><div style="font:500 .85rem IBM Plex Sans,sans-serif;color:#5F6B66;margin-top:2px">Type it or tap the microphone and say it.</div>'
    + '<div style="display:flex;gap:8px;align-items:flex-start;margin-top:12px"><textarea id="qt_text" rows="3" maxlength="400" placeholder="What needs doing?" style="' + IN + ';resize:vertical;flex:1"></textarea>'
    + '<button type="button" id="qt_mic" aria-label="Speak the task" style="flex:0 0 48px;height:48px;border-radius:14px;border:1px solid #C5A56A;background:#FAF7F1;color:#0A4F4A;display:flex;align-items:center;justify-content:center;cursor:pointer">' + MIC + '</button></div>'
    + '<div id="qt_hint" style="font:500 .78rem IBM Plex Sans,sans-serif;color:#5F6B66;min-height:1.1em;margin-top:4px"></div>'
    + '<label style="' + LB + '" for="qt_who">WHO IS IT FOR</label><select id="qt_who" style="' + IN + '"><option value="">Me</option></select>'
    + '<label style="' + LB + '" for="qt_due">DUE (IF THERE IS A DATE)</label><input id="qt_due" type="date" style="' + IN + '">'
    + '<div style="display:flex;gap:8px;margin-top:16px"><button type="button" id="qt_save" style="flex:1;min-height:46px;border:0;border-radius:12px;background:#0A4F4A;color:#FFFDF9;font:600 1rem IBM Plex Sans,sans-serif;cursor:pointer">Add task</button>'
    + '<button type="button" id="qt_x" style="min-height:46px;border:1px solid #D8D1C4;border-radius:12px;background:#FAF7F1;color:#1C2826;font:600 1rem IBM Plex Sans,sans-serif;padding:0 16px;cursor:pointer">Cancel</button></div></div>';
  document.body.appendChild(o); open = o;
  var T = o.querySelector("#qt_text"), H = o.querySelector("#qt_hint"), W = o.querySelector("#qt_who"), M = o.querySelector("#qt_mic"), S = o.querySelector("#qt_save");
  function fill() { (people || []).forEach(function (n) { var op = document.createElement("option"); op.value = n; op.textContent = n; W.appendChild(op); }); }
  if (people) fill(); else api({ action: "task_quick", peek: true }).then(function (j) { if (j && j.people) { people = j.people; if (open === o) fill(); } }).catch(function () {});
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null, on = false, base = "";
  function stop() { on = false; M.style.background = "#FAF7F1"; M.style.color = "#0A4F4A"; try { if (rec) rec.stop(); } catch (e) {} }
  if (!SR) { M.onclick = function () { H.textContent = "This browser cannot listen here. Tap the box and use the microphone on your keyboard."; T.focus(); }; }
  else M.onclick = function () {
    if (on) { stop(); H.textContent = ""; return; }
    try { rec = new SR(); rec.lang = "en-GB"; rec.interimResults = true; rec.continuous = false; base = T.value ? T.value.replace(/\s+$/, "") + " " : "";
      rec.onresult = function (ev) { var s = ""; for (var i = 0; i < ev.results.length; i++) s += ev.results[i][0].transcript; T.value = (base + s).slice(0, 400); };
      rec.onerror = function (ev) { stop(); H.textContent = ev && ev.error === "not-allowed" ? "The microphone is blocked for this page. Type it instead, or allow the microphone." : "I did not catch that. Tap the microphone and try again."; };
      rec.onend = function () { if (on) { stop(); H.textContent = T.value ? "Got it. Check the words, then Add task." : ""; } };
      rec.start(); on = true; M.style.background = "#0A4F4A"; M.style.color = "#FFFDF9"; H.textContent = "Listening... tap again to stop.";
    } catch (e) { stop(); H.textContent = "The microphone did not start. Type it instead."; }
  };
  o.onclick = function (ev) { if (ev.target === o || ev.target.id === "qt_x") { stop(); shut(); } };
  S.onclick = function () {
    var text = (T.value || "").replace(/\s+/g, " ").trim(); if (text.length < 3) { H.textContent = "Type or say the task first."; T.focus(); return; }
    stop(); S.disabled = true; S.textContent = "Adding...";
    api({ action: "task_quick", text: text, who: W.value, due: o.querySelector("#qt_due").value }).then(function (j) {
      if (!j.ok) { S.disabled = false; S.textContent = "Add task"; H.textContent = j.error || "Not added. Try again."; return; }
      shut(); var d = j.task.name + (j.task.owners && j.task.owners.length ? " · for " + j.task.owners[0] : "") + (j.task.due ? " · due " + j.task.due : "");
      if (window.momoConfirm) window.momoConfirm(true, "Task added", d);
      if (location.pathname === "/momo/work" || location.pathname === "/momo/work/") setTimeout(function () { location.reload(); }, 1500);
    }).catch(function () { S.disabled = false; S.textContent = "Add task"; H.textContent = "No connection: not added. Your words are still here."; });
  };
  setTimeout(function () { try { T.focus(); } catch (e) {} }, 60);
}
btn.onclick = show; window.momoQuickTask = show;
function mount() { if (document.body && !document.getElementById("qt_btn")) document.body.appendChild(btn); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();`;
