// v555 ASK NAJMA (Kendall 12 Oct 2026: "top of the start menu, use icons, build it") - a question box at the top of START. The answers
// come from the chat engine the data session is building on the lake (naj-market-pulse docs/chat/DESIGN_CHAT_ENGINE_12OCT2026.md);
// until it passes its golden set, /ask is a STUB with two canned replies, and the box shows only on the owner's links (chat_enabled
// off for clients). Contract (agreed with the data session):
//   POST /ask {question, mode: "client"|"analyst", session_id, clarification?: {mention, choice}}
//     -> {status: "answer"|"clarify"|"not_held"|"error", answer_md?, facts?: [{id, value, unit, table, as_of, n_rows, sql_hash}],
//         clarify?: {mention, options: [{label, key}]}, report_url?, disclosures: [string], as_of: {table: date}, cost_ms}
//     + trace: [{step, detail, ok}] (engine step names: understood, resolved, scoped, queried, checked, written - shown in plain words) - v555 (Kendall 12 Oct: "transparent ... it says, I'm checking A, B and C"): what the engine checked, in order
//   POST /ask/feedback {session_id, question_id, rating: 1|-1, note?}

const svg = (d, s) => '<svg viewBox="0 0 24 24" width="' + (s || 16) + '" height="' + (s || 16) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
export const ASK_ICONS = {
  send: svg('<path d="M4 12h14M13 6l6 6-6 6"/>'),
  up: svg('<path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 3 2l-1 4h6a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 1H7"/>'),
  down: svg('<path d="M7 13V4H4v9zM7 13l4 8a2 2 0 0 0 3-2l-1-4h6a2 2 0 0 0 2-2l-2-7a2 2 0 0 0-2-1H7"/>'),
  doc: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 12v5M9.5 14.5 12 17l2.5-2.5"/>'),
  spark: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
};

const ASK_CSS = '.ask{margin:4px 0 16px;position:relative;z-index:3}.askf{position:relative;z-index:3;display:flex;gap:8px;align-items:center;border:1px solid #C5A56A;border-radius:14px;padding:6px 6px 6px 12px;background:#0E1918}'
  + '.askf input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#E8E4D8;font-size:15px;font-family:inherit;padding:8px 0}.askf input::placeholder{color:#8FA39B}'
  + '.askb{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;border:0;background:#C5A56A;color:#0E1918;cursor:pointer}.askb:disabled{opacity:.5}'
  + '.asksm{font-size:11px;color:#8FA39B;margin:5px 2px 0}.askp{margin-top:10px}.askc{border:1px solid #24352F;border-radius:12px;padding:12px;margin-top:10px;background:#0E1918;color:#E8E4D8;font-size:14px;line-height:1.5}'
  + '.askq{font-size:12px;color:#8FA39B;margin-bottom:6px}.askst{display:flex;gap:8px;align-items:center;color:#C5A56A;font-size:13px}.askst svg{animation:askspin 1.4s linear infinite}@keyframes askspin{to{transform:rotate(360deg)}}'
  + '.askch{display:inline-flex;margin:8px 8px 0 0;border:1px solid #C5A56A;color:#C5A56A;background:transparent;border-radius:99px;padding:6px 12px;font-size:13px;cursor:pointer}'
  + '.askf2{color:#C5A56A;font-size:11px;vertical-align:super}.asksrc{margin-top:8px}.asksrc summary{cursor:pointer;color:#C5A56A;font-size:12px}.asksrc li{font-size:12px;color:#B9B2A3}'
  + '.askdis{font-size:11px;color:#8FA39B;margin-top:8px}.askrow{display:flex;gap:8px;align-items:center;margin-top:10px}.askic{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;border:1px solid #24352F;background:transparent;color:#B9B2A3;cursor:pointer}'
  + '.askic.on{border-color:#C5A56A;color:#C5A56A}.askdl{display:inline-flex;gap:6px;align-items:center;margin-left:auto;border:1px solid #C5A56A;border-radius:99px;padding:6px 12px;color:#C5A56A;text-decoration:none;font-size:13px}.askerr{color:#E3A08F}.asktr{border-left:2px solid #C5A56A;padding:6px 0 6px 10px;margin:4px 0 10px;font-size:12.5px;color:#B9B2A3}.asktr b{display:block;color:#C5A56A;font-weight:500;font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}.asktr div{margin:3px 0}.asktr i{font-style:normal;color:#C5A56A;margin-right:6px}.asktr .no i{color:#E3A08F}';

// the page script: no framework, no storage beyond the session (history lives in the page only)
const ASK_JS = '(function(){if(typeof document==="undefined"||!document.querySelectorAll||window.__askInit)return;window.__askInit=1;document.querySelectorAll("form.askf").forEach(function(f){var q=f.querySelector("input"),b=f.querySelector("button"),P=f.parentNode.querySelector(".askp");if(!q||!P)return;'
  + 'var KEY=f.getAttribute("data-key")||"",MODE=f.getAttribute("data-mode")||"client",SID="s"+Math.random().toString(36).slice(2,10)+Date.now().toString(36),IC=JSON.parse(f.getAttribute("data-ic")||"{}");'
  + 'function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c]})}'
  + 'function md(s){return esc(s).replace(/\\*\\*([^*]+)\\*\\*/g,"<b>$1</b>").replace(/\\[(F\\d+)\\]/g,"<span class=askf2>[$1]</span>").replace(/\\n/g,"<br>")}'
  + 'function card(){var c=document.createElement("div");c.className="askc";P.insertBefore(c,P.firstChild);return c}'
  + 'function steps(c,qq){var S=["Resolving names","Querying","Writing"],i=0;c.innerHTML="<div class=askq>"+esc(qq)+"</div><div class=asktr><b>Checking</b><div class=askst>"+IC.spark+"<span>"+S[0]+"…</span></div></div>";var t=setInterval(function(){i=Math.min(i+1,2);var e=c.querySelector(".askst span");if(e)e.textContent=S[i]+"…"},900);return t}'
  + 'function ask(qq,clar){var c=card(),t=steps(c,qq);b.disabled=true;'
  + 'fetch("/ask?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:qq,mode:MODE,session_id:SID,clarification:clar||undefined})})'
  + '.then(function(r){return r.json()}).then(function(j){clearInterval(t);b.disabled=false;show(c,qq,j)}).catch(function(){clearInterval(t);b.disabled=false;c.innerHTML="<div class=askq>"+esc(qq)+"</div><div class=askerr>Najma could not answer just now. Try again in a moment.</div>"})}'
  + 'function show(c,qq,j){var h="<div class=askq>"+esc(qq)+"</div>";if(j.trace&&j.trace.length)h+="<div class=asktr><b>What I checked</b>"+j.trace.map(function(x){var L={understood:"Understood the question",resolved:"Found the name",scoped:"Chose the sources",queried:"Ran the query",checked:"Cross-checked",written:"Wrote the answer"};return"<div"+(x.ok===false?" class=no":"")+"><i>"+(x.ok===false?"✕":"✓")+"</i>"+esc(L[x.step]||x.step)+(x.detail?" — "+esc(x.detail):"")+"</div>"}).join("")+"</div>";'
  + 'if(j.status==="clarify"&&j.clarify){h+="<div>"+esc(j.answer_md||"Which one did you mean?")+"</div>"+(j.clarify.options||[]).map(function(o,i){return"<button type=button class=askch data-i="+i+">"+esc(o.label)+"</button>"}).join("");c.innerHTML=h;'
  + 'c.querySelectorAll(".askch").forEach(function(x){x.onclick=function(){var o=j.clarify.options[+x.getAttribute("data-i")];ask(qq,{mention:j.clarify.mention,choice:o.key})}});return}'
  + 'if(j.status==="error"){c.innerHTML=h+"<div class=askerr>"+esc(j.answer_md||"Najma could not answer that.")+"</div>";return}'
  + 'h+="<div>"+md(j.answer_md||"")+"</div>";'
  + 'if(j.facts&&j.facts.length)h+="<details class=asksrc><summary>Sources ("+j.facts.length+")</summary><ul>"+j.facts.map(function(x){return"<li>["+esc(x.id)+"] "+esc(x.value)+(x.unit?" "+esc(x.unit):"")+" · "+esc(x.table)+" · as of "+esc(x.as_of)+" · "+esc(x.n_rows)+" rows</li>"}).join("")+"</ul></details>";'
  + 'var ao=j.as_of?Object.keys(j.as_of).map(function(k){return j.as_of[k]}).sort().pop():"";'
  + 'h+="<div class=askdis>"+(ao?"As of "+esc(ao)+" · ":"")+esc((j.disclosures||["Research use only"]).join(" · "))+"</div>";'
  + 'var qid="q"+Date.now().toString(36);h+="<div class=askrow><button type=button class=askic data-r=1 aria-label=\\"Helpful\\">"+IC.up+"</button><button type=button class=askic data-r=-1 aria-label=\\"Not helpful\\">"+IC.down+"</button>"'
  + '+(j.report_url?"<a class=askdl href=\\""+esc(j.report_url)+"\\" target=_blank rel=noopener>"+IC.doc+"Download report</a>":"")+"</div>";c.innerHTML=h;'
  + 'c.querySelectorAll(".askic").forEach(function(x){x.onclick=function(){c.querySelectorAll(".askic").forEach(function(y){y.classList.remove("on")});x.classList.add("on");'
  + 'fetch("/ask/feedback?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:SID,question_id:qid,rating:+x.getAttribute("data-r")})}).catch(function(){})}})}'
  + 'f.onsubmit=function(e){e.preventDefault();var v=q.value.trim();if(!v)return;q.value="";ask(v)}})})();';

export function askBoxHtml(key, mode) {
  const ic = JSON.stringify({ up: ASK_ICONS.up, down: ASK_ICONS.down, doc: ASK_ICONS.doc, spark: ASK_ICONS.spark });
  const e = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return "<style>" + ASK_CSS + "</style>"
    + '<div class=ask><form class=askf data-key="' + e(key || "") + '" data-mode="' + e(mode === "analyst" ? "analyst" : "client") + '" data-ic="' + e(ic) + '">'
    + '<input type=text autocomplete=off enterkeyhint=send maxlength=400 placeholder="Ask Najma about any building, area, developer or rent" aria-label="Ask Najma">'
    + '<button type=submit class=askb aria-label="Ask">' + ASK_ICONS.send + "</button></form>"
    + '<div class=asksm>Research use only</div><div class=askp></div></div><script src="/ask.js" defer></script>';
}

// ---- the STUB engine (replaced when the data session's engine passes its golden set) ----
const STUB_AS_OF = "2026-10-11";
export function askStub(body) {
  const q = String((body && body.question) || "").toLowerCase(), clar = body && body.clarification;
  const dis = ["Research use only", "Stub answer for testing the box - not a live figure"];
  if (/arabian\s+ranches/.test(q) && !clar)
    return { status: "clarify", trace: [{ step: "Looking up the name 'Arabian Ranches'", detail: "3 communities in the register share it", ok: true }, { step: "Asking which one you mean", ok: true }], answer_md: "Did you mean Arabian Ranches 1, 2 or 3?", clarify: { mention: "arabian ranches", options: [{ label: "Arabian Ranches 1", key: "arabianranches" }, { label: "Arabian Ranches 2", key: "arabianranches2" }, { label: "Arabian Ranches 3", key: "arabianranches3" }] }, disclosures: dis, as_of: {}, cost_ms: 5 };
  if (/arabian\s+ranches/.test(q) && clar)
    return { status: "not_held", answer_md: "The stub has no answer for " + String(clar.choice) + " yet. The live engine will answer this.", disclosures: dis, as_of: {}, cost_ms: 5 };
  if (/windsor\s+manor/.test(q))
    return { status: "answer", trace: [{ step: "Finding 'Windsor Manor'", detail: "one building, Business Bay", ok: true }, { step: "Checking the Land Department building register", detail: "floors and units", ok: true }, { step: "Checking the Municipality building permits", detail: "floors", ok: true }, { step: "Comparing the two", detail: "they disagree on floors, so both are shown", ok: true }], answer_md: "**Windsor Manor, Business Bay.** The Land Department register gives 24 floors [F1]; the Municipality records 29 [F2]. The register holds 346 units [F3].",
      facts: [{ id: "F1", value: 24, unit: "floors", table: "stub", as_of: STUB_AS_OF, n_rows: 1, sql_hash: "stub" }, { id: "F2", value: 29, unit: "floors", table: "stub", as_of: STUB_AS_OF, n_rows: 1, sql_hash: "stub" }, { id: "F3", value: 346, unit: "units", table: "stub", as_of: STUB_AS_OF, n_rows: 346, sql_hash: "stub" }],
      disclosures: dis, as_of: { stub: STUB_AS_OF }, cost_ms: 5 };
  return { status: "not_held", answer_md: "The question engine is not connected yet, so I can only answer the two test questions: Windsor Manor, and Arabian Ranches.", disclosures: dis, as_of: {}, cost_ms: 5 };
}

// POST /ask and /ask/feedback. deps.keyTier(env, url) -> "admin" | "client" | "". While the engine is a stub only the owner may ask.
export async function askRoute(request, env, url, deps) {
  if (url.pathname === "/ask.js") return new Response(ASK_FILE_JS, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300" } });   // v556.1
  if (url.pathname === "/ask/ok") return new Response(deps.keyTier(env, url) === "admin" ? "ok" : "no", { status: deps.keyTier(env, url) === "admin" ? 200 : 404, headers: { "Cache-Control": "no-store" } });   // v556 - may this link ask?
  if (url.pathname !== "/ask" && url.pathname !== "/ask/feedback") return null;
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (request.method !== "POST") return J({ status: "error", answer_md: "POST only" }, 405);
  if (deps.keyTier(env, url) !== "admin") return new Response("not found", { status: 404 });
  let body = {}; try { body = await request.json(); } catch (e) { return J({ status: "error", answer_md: "Send JSON." }, 400); }
  if (url.pathname === "/ask/feedback" && env.ASK_ENGINE_URL && env.ASK_SECRET) {   // v557
    try { await fetch(String(env.ASK_ENGINE_URL).replace(/\/+$/, "") + "/ask/feedback", { method: "POST", headers: { "Content-Type": "application/json", "X-Ask-Secret": String(env.ASK_SECRET) }, body: JSON.stringify(body) }); } catch (e) {}
  }
  if (url.pathname === "/ask/feedback") {
    const r = Number(body.rating); if (r !== 1 && r !== -1) return J({ ok: false }, 400);
    try { await env.MEETINGS.put("ask_fb_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), JSON.stringify({ session_id: String(body.session_id || "").slice(0, 40), question_id: String(body.question_id || "").slice(0, 40), rating: r, note: String(body.note || "").slice(0, 500), at: new Date().toISOString() }), { expirationTtl: 90 * 86400 }); } catch (e) {}
    return J({ ok: true });
  }
  const q = String(body.question || "").trim();
  if (!q || q.length > 400) return J({ status: "error", answer_md: "Ask a question of up to 400 characters.", disclosures: [], as_of: {}, cost_ms: 0 }, 400);
  // v557 - the real engine (data session, FastAPI on the office machine, reached through a named tunnel) once ASK_ENGINE_URL and the
  // ASK_SECRET secret are set; the stub until then. Offline or slow: an honest message, never the stub's canned figures.
  if (env.ASK_ENGINE_URL && env.ASK_SECRET) {
    const base = String(env.ASK_ENGINE_URL).replace(/\/+$/, "");
    // v558 - one retry after 2 s (an engine restart refuses connections for a few seconds); nothing is cached between requests
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) await new Promise((res) => setTimeout(res, 2000));
      try {
        const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 25000);
        const r = await fetch(base + url.pathname, { method: "POST", headers: { "Content-Type": "application/json", "X-Ask-Secret": String(env.ASK_SECRET) }, body: JSON.stringify(body), signal: ctl.signal });
        clearTimeout(tm);
        const t = await r.text();
        if (r.ok || (r.status < 500 && /"status"/.test(t))) return new Response(t, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
        console.log("ask engine", r.status, t.slice(0, 200));
      } catch (e) { console.log("ask engine fetch", String(e).slice(0, 200)); }
    }
    return J({ status: "error", answer_md: "Najma's question engine is offline right now (it runs on the office machine). Try again shortly.", disclosures: [], as_of: {}, cost_ms: 0 });
  }
  return J(askStub(body));
}

// v556 (Kendall 12 Oct: "a floating ask as well ... on every page ... bottom left-hand corner") - a round Ask button above the tab bar,
// opening a sheet with the same box. Hidden until GET /ask/ok answers 200, so a link that may not ask never sees it. On START it
// takes you to the box in the header instead.
const FLOAT_CSS = '.askfab{position:fixed;left:14px;bottom:calc(74px + env(safe-area-inset-bottom));z-index:45;display:none;align-items:center;gap:7px;height:46px;padding:0 16px 0 13px;border-radius:99px;border:1px solid #C5A56A;background:#C5A56A;color:#0E1918;font:500 14px "IBM Plex Sans",sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.35);cursor:pointer}'
  + '.askfab.on{display:inline-flex}.asksh{position:fixed;left:0;right:0;bottom:0;z-index:60;display:none;max-height:82vh;overflow:auto;background:#0C1413;border-top:1px solid #C5A56A;border-radius:18px 18px 0 0;padding:14px 14px calc(16px + env(safe-area-inset-bottom))}'
  + '.asksh.on{display:block}.askshh{display:flex;justify-content:space-between;align-items:center;color:#C5A56A;font:500 12px "IBM Plex Mono",monospace;letter-spacing:.08em;margin-bottom:10px}.askx{background:transparent;border:0;color:#8FA39B;font-size:22px;cursor:pointer}';
export function askFloatHtml(key) {
  const k = encodeURIComponent(key || "");
  return "<style>" + FLOAT_CSS + "</style>"
    + '<button type=button class=askfab aria-label="Ask Najma">' + ASK_ICONS.spark + "Ask</button>"
    + '<div class=asksh role=dialog aria-label="Ask Najma"><div class=askshh><span>ASK NAJMA</span><button type=button class=askx aria-label="Close">&times;</button></div>' + askBoxHtml(key, "analyst").replace('<script src="/ask.js" defer></script>', "") + "</div>"
    + '<script src="/ask.js" defer></script>';
}

// v556.1 - all the page code in one cached file, so no page gains an inline script (older pages' tests read their own inline script)
const FAB_JS = '(function(){if(typeof document==="undefined"||!document.querySelector)return;var fab=document.querySelector(".askfab"),sh=document.querySelector(".asksh");if(!fab||!sh)return;'
  + 'var f0=sh.querySelector("form.askf"),k=f0?f0.getAttribute("data-key"):"";fetch("/ask/ok?key="+encodeURIComponent(k||"")).then(function(r){if(r.ok)fab.classList.add("on")}).catch(function(){});'
  + 'fab.onclick=function(){var hero=document.getElementById("askhero");if(hero){hero.scrollIntoView({behavior:"smooth",block:"center"});var i=hero.querySelector("input");if(i)i.focus();return}sh.classList.add("on");var i2=sh.querySelector("input");if(i2)i2.focus()};'
  + 'var x=sh.querySelector(".askx");if(x)x.onclick=function(){sh.classList.remove("on")}})();';
export const ASK_FILE_JS = FAB_JS + "\n" + ASK_JS;
