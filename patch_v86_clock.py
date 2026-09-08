# v86 - world clock room for Najma: Dubai anchor, scrub the day, see who is awake.
# Adds: clock icon, CLOCK nav door, renderClock(), /clock route.
import io, sys, re

P = "src/index.js"
s = io.open(P, encoding="utf-8").read()
orig = s

# ---------------------------------------------------------------- 1. icon
if "clock:" not in s.split("const NAJ_ICONS")[1][:6200]:
    anchor = 'const NAJ_ICONS = { search:'
    i = s.index(anchor)
    icon = ('const NAJ_ICONS = { clock: "M128 24a104 104 0 1 1 0 208 104 104 0 0 1 0-208zm0 26a78 78 0 1 0 0 156 78 78 0 0 0 0-156z '
            'M120 68h16v62l44 26-8 14-52-31z",  search:')
    s = s[:i] + icon + s[i + len(anchor):]
    print("icon added")
else:
    print("icon already present")

# ---------------------------------------------------------------- 2. nav door
navold = '["board", "/board", "house", "BOARD"]];'
navnew = '["board", "/board", "house", "BOARD"], ["clock", "/clock", "clock", "TIME"]];   // v86 - world clock, one tap from anywhere'
if navold in s and '"/clock"' not in s:
    s = s.replace(navold, navnew, 1)
    print("nav door added")
else:
    print("nav door already present or anchor moved")

# ---------------------------------------------------------------- 3. route
routeold = '      if (url.pathname === "/find") {'
routenew = '''      if (url.pathname === "/clock") {                        // v86 - world clock: Dubai anchor, scrub the day, see who is awake
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        return new Response(renderClock(url.searchParams.get("key") || ""), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/find") {'''
if "renderClock(" not in s:
    s = s.replace(routeold, routenew, 1)
    print("route added")

# ---------------------------------------------------------------- 4. renderClock
FN = r'''
// v86 - the world clock room. Dubai is home; every other city is shown against it.
// Intl carries the daylight-saving rules, so nothing here needs a table of offsets to go stale.
function renderClock(key) {
  const K = JSON.stringify(key || "");
  return '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name=robots content=noindex><title>Time — Najma</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">'
   + NAJ_FONTS
   + '<style>:root{--bg:#0C1413;--card:#131F1D;--card2:#1A2725;--line:#24352F;--text:#E8E4D8;--mut:#8FA39B;--gold:#C5A56A;--teal:#8FC7B9;--night:#18231F;--edge:#4C6A5E;--work:#C5A56A;--eve:#8A7A56}'
   + '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:"IBM Plex Sans",system-ui,sans-serif;padding:calc(14px + env(safe-area-inset-top)) 14px 96px}'
   + 'h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.6rem;margin:6px 0 2px;color:var(--gold)}'
   + '.sub{font-family:"IBM Plex Mono",monospace;font-size:.68rem;letter-spacing:.06em;color:var(--mut);text-transform:uppercase;margin-bottom:14px}'
   + '.panel{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px}'
   + '.eyebrow{font-family:"IBM Plex Mono",monospace;font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--mut)}'
   + '.big{font-family:"IBM Plex Mono",monospace;font-size:clamp(2.6rem,13vw,3.5rem);font-weight:500;letter-spacing:-.03em;line-height:1;color:var(--gold);margin:6px 0 2px;font-variant-numeric:tabular-nums}'
   + '.hc{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.1rem}'
   + '.hm{font-family:"IBM Plex Mono",monospace;font-size:.66rem;color:var(--mut);letter-spacing:.02em}'
   + '.htop{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap}'
   + '.hdate{text-align:right;font-family:"IBM Plex Mono",monospace;font-size:.66rem;color:var(--mut)}.hdate b{display:block;font-family:"IBM Plex Sans",system-ui,sans-serif;font-weight:500;font-size:.9rem;color:var(--text);letter-spacing:0}'
   + '.scrub{margin-top:16px;padding-top:14px;border-top:1px solid var(--line)}'
   + '.shead{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}'
   + '.slab{font-size:.8rem;color:var(--mut)}'
   + 'input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:26px;background:transparent;display:block;cursor:pointer;margin:0}'
   + 'input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:linear-gradient(90deg,var(--night) 0 25%,var(--edge) 25% 37.5%,var(--work) 37.5% 71%,var(--eve) 71% 87.5%,var(--night) 87.5% 100%)}'
   + 'input[type=range]::-moz-range-track{height:6px;border-radius:3px;background:linear-gradient(90deg,var(--night) 0 25%,var(--edge) 25% 37.5%,var(--work) 37.5% 71%,var(--eve) 71% 87.5%,var(--night) 87.5% 100%)}'
   + 'input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:var(--teal);border:3px solid var(--card);margin-top:-6px}'
   + 'input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:var(--teal);border:3px solid var(--card)}'
   + '.ticks{display:flex;justify-content:space-between;font-family:"IBM Plex Mono",monospace;font-size:.58rem;color:var(--mut)}'
   + 'button,select,input[type=date]{font-family:"IBM Plex Mono",monospace;font-size:.66rem;letter-spacing:.04em;color:var(--text);background:var(--card2);border:1px solid var(--line);border-radius:99px;padding:7px 12px;cursor:pointer}'
   + 'button.on{border-color:var(--gold);color:var(--gold)}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--teal);outline-offset:2px}'
   + '.acts{display:flex;gap:6px;flex-wrap:wrap}'
   + '.grp{font-family:"IBM Plex Mono",monospace;font-size:.66rem;letter-spacing:.14em;color:var(--mut);text-transform:uppercase;margin:18px 0 8px;display:flex;justify-content:space-between;align-items:center;gap:8px}'
   + '.row{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:11px 13px;margin-bottom:8px;display:grid;grid-template-columns:1fr auto;gap:9px 12px;align-items:center}'
   + '.rn{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.05rem;line-height:1.2}'
   + '.rm{font-family:"IBM Plex Mono",monospace;font-size:.62rem;color:var(--mut);margin-top:3px;letter-spacing:.02em}'
   + '.rr{display:flex;align-items:center;gap:10px;justify-self:end}'
   + '.rt{font-family:"IBM Plex Mono",monospace;font-size:1.4rem;font-weight:500;letter-spacing:-.02em;line-height:1;font-variant-numeric:tabular-nums}'
   + '.rd{font-family:"IBM Plex Mono",monospace;font-size:.58rem;color:var(--mut);text-align:right;margin-top:4px;white-space:nowrap}'
   + '.pill{font-family:"IBM Plex Mono",monospace;font-size:.58rem;letter-spacing:.04em;border:1px solid var(--line);border-radius:99px;padding:4px 9px;color:var(--mut);white-space:nowrap}'
   + '.pill.ok{border-color:var(--teal);color:var(--teal)}.pill.warn{border-color:var(--gold);color:var(--gold)}'
   + '.x{border:0;background:transparent;color:var(--mut);font-size:1rem;padding:4px 6px;border-radius:8px}'
   + '.band{grid-column:1/-1;position:relative;height:13px;border-radius:4px;overflow:hidden;background:var(--night)}'
   + '.band i{position:absolute;top:0;bottom:0}.band i.mk{top:-2px;bottom:-2px;width:2px;background:var(--teal)}'
   + '.add{display:flex;gap:6px;margin-top:6px}.add select{flex:1;border-radius:14px;text-align:left}'
   + '.leg{display:flex;gap:12px;flex-wrap:wrap;margin-top:14px;font-family:"IBM Plex Mono",monospace;font-size:.58rem;color:var(--mut)}'
   + '.leg span{display:flex;align-items:center;gap:5px}.leg i{width:11px;height:11px;border-radius:3px}'
   + '.note{font-family:"IBM Plex Mono",monospace;font-size:.6rem;color:var(--mut);margin-top:18px;line-height:1.7}'
   + '.toast{position:fixed;left:50%;bottom:80px;transform:translateX(-50%) translateY(10px);background:var(--gold);color:#0C1413;font-family:"IBM Plex Mono",monospace;font-size:.66rem;padding:8px 15px;border-radius:99px;opacity:0;pointer-events:none;transition:opacity .18s,transform .18s;z-index:50}.toast.on{opacity:1;transform:translateX(-50%) translateY(0)}'
   + '@media(max-width:430px){.row{grid-template-columns:1fr}.rr{justify-self:start;width:100%;justify-content:space-between}.hdate{text-align:left}}'
   + '@media(prefers-reduced-motion:reduce){*{transition:none!important}}'
   + NAJ_NAV_CSS + '</style></head><body>'
   + '<h1>World clock</h1><div class=sub>dubai is home · everyone else is measured against it</div>'
   + '<div class=panel><div class=htop><div><div class=eyebrow>Home</div><div class=big id=bt>--:--</div><div class=hc id=bc>Dubai</div><div class=hm id=bm>United Arab Emirates</div></div>'
   + '<div class=hdate><b id=bd>—</b><span id=bz>—</span></div></div>'
   + '<div class=scrub><div class=shead><span class=slab id=sl>Showing the time right now</span><div class=acts><input type=date id=dp aria-label="Date in Dubai"><button id=nb type=button>back to now</button></div></div>'
   + '<input type=range id=sc min=0 max=1439 step=5 value=0 aria-label="Time of day in Dubai">'
   + '<div class=ticks><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div></div></div>'
   + '<div class=grp><span>Everywhere else</span><div class=acts><button id=fm type=button>12h</button><button id=cp type=button>copy list</button></div></div>'
   + '<div id=rows></div>'
   + '<div class=add><select id=pk aria-label="Add a city"></select><button id=ab type=button>add</button></div>'
   + '<div class=leg><span><i style="background:var(--night)"></i>asleep</span><span><i style="background:var(--edge)"></i>early or late</span><span><i style="background:var(--work)"></i>working</span><span><i style="background:var(--eve)"></i>evening</span><span><i style="background:var(--teal);width:3px;border-radius:1px"></i>the time shown</span></div>'
   + '<div class=note>Daylight saving is handled for you — London, New York and Sydney shift on their own dates, and this follows them. Your city list is remembered on this phone.</div>'
   + '<div class=toast id=ts role=status aria-live=polite></div>'
   + najNav(key, "clock")
   + '<script>(function(){var KEY=' + K + ';'
   + 'var C=[["Dubai","United Arab Emirates","Asia/Dubai"],["Abu Dhabi","United Arab Emirates","Asia/Dubai"],["Kampala","Uganda","Africa/Kampala"],["Nairobi","Kenya","Africa/Nairobi"],["Dar es Salaam","Tanzania","Africa/Dar_es_Salaam"],["Kigali","Rwanda","Africa/Kigali"],["Addis Ababa","Ethiopia","Africa/Addis_Ababa"],["Lagos","Nigeria","Africa/Lagos"],["Abuja","Nigeria","Africa/Lagos"],["Accra","Ghana","Africa/Accra"],["Cairo","Egypt","Africa/Cairo"],["Johannesburg","South Africa","Africa/Johannesburg"],["Cape Town","South Africa","Africa/Johannesburg"],["Lusaka","Zambia","Africa/Lusaka"],["Harare","Zimbabwe","Africa/Harare"],["Casablanca","Morocco","Africa/Casablanca"],["Tunis","Tunisia","Africa/Tunis"],["Algiers","Algeria","Africa/Algiers"],["Port Louis","Mauritius","Indian/Mauritius"],["Victoria","Seychelles","Indian/Mahe"],'
   + '["London","United Kingdom","Europe/London"],["Manchester","United Kingdom","Europe/London"],["Dublin","Ireland","Europe/Dublin"],["Lisbon","Portugal","Europe/Lisbon"],["Madrid","Spain","Europe/Madrid"],["Paris","France","Europe/Paris"],["Brussels","Belgium","Europe/Brussels"],["Amsterdam","Netherlands","Europe/Amsterdam"],["Frankfurt","Germany","Europe/Berlin"],["Berlin","Germany","Europe/Berlin"],["Zurich","Switzerland","Europe/Zurich"],["Milan","Italy","Europe/Rome"],["Rome","Italy","Europe/Rome"],["Vienna","Austria","Europe/Vienna"],["Warsaw","Poland","Europe/Warsaw"],["Stockholm","Sweden","Europe/Stockholm"],["Oslo","Norway","Europe/Oslo"],["Copenhagen","Denmark","Europe/Copenhagen"],["Helsinki","Finland","Europe/Helsinki"],["Athens","Greece","Europe/Athens"],["Istanbul","Turkey","Europe/Istanbul"],["Moscow","Russia","Europe/Moscow"],["Kyiv","Ukraine","Europe/Kyiv"],'
   + '["Riyadh","Saudi Arabia","Asia/Riyadh"],["Jeddah","Saudi Arabia","Asia/Riyadh"],["Doha","Qatar","Asia/Qatar"],["Kuwait City","Kuwait","Asia/Kuwait"],["Manama","Bahrain","Asia/Bahrain"],["Muscat","Oman","Asia/Muscat"],["Amman","Jordan","Asia/Amman"],["Beirut","Lebanon","Asia/Beirut"],["Tel Aviv","Israel","Asia/Jerusalem"],["Baghdad","Iraq","Asia/Baghdad"],["Tehran","Iran","Asia/Tehran"],["Baku","Azerbaijan","Asia/Baku"],["Tbilisi","Georgia","Asia/Tbilisi"],["Almaty","Kazakhstan","Asia/Almaty"],["Tashkent","Uzbekistan","Asia/Tashkent"],["Karachi","Pakistan","Asia/Karachi"],["Lahore","Pakistan","Asia/Karachi"],["Mumbai","India","Asia/Kolkata"],["New Delhi","India","Asia/Kolkata"],["Bengaluru","India","Asia/Kolkata"],["Kochi","India","Asia/Kolkata"],["Colombo","Sri Lanka","Asia/Colombo"],["Kathmandu","Nepal","Asia/Kathmandu"],["Dhaka","Bangladesh","Asia/Dhaka"],["Male","Maldives","Indian/Maldives"],'
   + '["Bangkok","Thailand","Asia/Bangkok"],["Ho Chi Minh City","Vietnam","Asia/Ho_Chi_Minh"],["Jakarta","Indonesia","Asia/Jakarta"],["Bali","Indonesia","Asia/Makassar"],["Kuala Lumpur","Malaysia","Asia/Kuala_Lumpur"],["Singapore","Singapore","Asia/Singapore"],["Manila","Philippines","Asia/Manila"],["Hong Kong","Hong Kong","Asia/Hong_Kong"],["Shanghai","China","Asia/Shanghai"],["Beijing","China","Asia/Shanghai"],["Shenzhen","China","Asia/Shanghai"],["Taipei","Taiwan","Asia/Taipei"],["Seoul","South Korea","Asia/Seoul"],["Tokyo","Japan","Asia/Tokyo"],["Perth","Australia","Australia/Perth"],["Brisbane","Australia","Australia/Brisbane"],["Sydney","Australia","Australia/Sydney"],["Melbourne","Australia","Australia/Melbourne"],["Auckland","New Zealand","Pacific/Auckland"],'
   + '["Honolulu","United States","Pacific/Honolulu"],["Anchorage","United States","America/Anchorage"],["Los Angeles","United States","America/Los_Angeles"],["San Francisco","United States","America/Los_Angeles"],["Seattle","United States","America/Los_Angeles"],["Denver","United States","America/Denver"],["Chicago","United States","America/Chicago"],["Houston","United States","America/Chicago"],["Atlanta","United States","America/New_York"],["Miami","United States","America/New_York"],["Washington DC","United States","America/New_York"],["Boston","United States","America/New_York"],["New York","United States","America/New_York"],["Toronto","Canada","America/Toronto"],["Vancouver","Canada","America/Vancouver"],["Mexico City","Mexico","America/Mexico_City"],["Bogota","Colombia","America/Bogota"],["Lima","Peru","America/Lima"],["Santiago","Chile","America/Santiago"],["Buenos Aires","Argentina","America/Argentina/Buenos_Aires"],["Sao Paulo","Brazil","America/Sao_Paulo"]];'
   + 'var HOME="Dubai",SK="najma.clock.v1";'
   + 'var st={list:["Kampala","London","New York","Singapore"],live:true,min:0,day:"",h12:false};'
   + 'var $=function(i){return document.getElementById(i)};'
   + 'var cb=function(n){for(var i=0;i<C.length;i++){if(C[i][0]===n)return C[i]}return null};'
   + 'var HZ=cb(HOME)[2];'
   + 'var pt=function(d,z){var f=new Intl.DateTimeFormat("en-GB",{timeZone:z,hour12:false,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"});var o={},a=f.formatToParts(d);for(var i=0;i<a.length;i++)o[a[i].type]=a[i].value;if(o.hour==="24")o.hour="00";return o};'
   + 'var om=function(d,z){var p=pt(d,z);return Math.round((Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)-Math.floor(d.getTime()/1000)*1000)/60000)};'
   + 'var ol=function(d,z){var m=om(d,z),s=m<0?"-":"+";m=Math.abs(m);var h=Math.floor(m/60),n=m%60;return "UTC"+s+h+(n?":"+(n<10?"0":"")+n:"")};'
   + 'var inst=function(y,mo,da,hh,mi,z){var t=Date.UTC(y,mo-1,da,hh,mi,0),g=t;for(var i=0;i<4;i++){var n=t-om(new Date(g),z)*60000;if(n===g)break;g=n}return new Date(g)};'
   + 'var ft=function(p){var h=+p.hour;if(!st.h12)return p.hour+":"+p.minute;var a=h<12?"am":"pm",x=h%12;if(!x)x=12;return x+":"+p.minute+" "+a};'
   + 'var di=function(p){return Date.UTC(+p.year,+p.month-1,+p.day)/86400000};'
   + 'var bc=function(h){return h<6||h>=22?"var(--night)":(h<9||h>=21?"var(--edge)":(h<18?"var(--work)":"var(--eve)"))};'
   + 'var stt=function(h){return h<6||h>=23?["","asleep"]:(h<9?["warn","early"]:(h<18?["ok","working"]:(h<21?["ok","evening"]:["warn","late"])))};'
   + 'var dfmt=function(d,z){return new Intl.DateTimeFormat("en-GB",{timeZone:z,weekday:"short",day:"numeric",month:"short"}).format(d)};'
   + 'var now=function(){if(st.live)return new Date();var a=st.day.split("-");return inst(+a[0],+a[1],+a[2],Math.floor(st.min/60),st.min%60,HZ)};'
   + 'var sync=function(){var p=pt(new Date(),HZ);st.min=+p.hour*60+ +p.minute;st.day=p.year+"-"+p.month+"-"+p.day};'
   + 'var save=function(){try{localStorage.setItem(SK,JSON.stringify({list:st.list,h12:st.h12}))}catch(e){}fill()};'
   + 'var load=function(){try{var r=localStorage.getItem(SK);if(r){var o=JSON.parse(r);if(o&&o.list&&o.list.length)st.list=o.list.filter(cb);st.h12=!!(o&&o.h12)}}catch(e){}};'
   + 'var toast=function(m){var t=$("ts");t.textContent=m;t.classList.add("on");clearTimeout(t._h);t._h=setTimeout(function(){t.classList.remove("on")},1900)};'
   + 'var copy=function(x,m){var ok=function(){toast(m)};var bad=function(){var a=document.createElement("textarea");a.value=x;a.style.position="fixed";a.style.left="-9999px";document.body.appendChild(a);a.select();try{document.execCommand("copy");toast(m)}catch(e){toast("could not copy")}document.body.removeChild(a)};'
   + 'try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(x).then(ok,bad)}else bad()}catch(e){bad()}};'
   + 'var fill=function(){var s=$("pk");s.innerHTML="";var u={};u[HOME]=1;st.list.forEach(function(n){u[n]=1});C.forEach(function(c){if(u[c[0]])return;var o=document.createElement("option");o.value=c[0];o.textContent=c[0]+" — "+c[1];s.appendChild(o)})};'
   + 'var draw=function(){var d=now(),hp=pt(d,HZ),hi=di(hp),ho=om(d,HZ);'
   + '$("bt").textContent=ft(hp);$("bd").textContent=new Intl.DateTimeFormat("en-GB",{timeZone:HZ,weekday:"long",day:"numeric",month:"long"}).format(d);$("bz").textContent=ol(d,HZ);'
   + '$("sl").textContent=st.live?"Showing the time right now":"Showing "+ft(hp)+" in Dubai";$("sc").value=st.min;$("dp").value=st.day;$("nb").style.display=st.live?"none":"";'
   + 'var rs=$("rows");rs.innerHTML="";'
   + 'if(!st.list.length){rs.innerHTML="<div class=note style=text-align:center>No cities yet. Add one below and it will be shown against Dubai.</div>";return}'
   + 'var es=st.list.map(cb).filter(Boolean).map(function(c){return{c:c,o:om(d,c[2])}}).sort(function(a,b){return a.o-b.o});'
   + 'es.forEach(function(e){var c=e.c,p=pt(d,c[2]),h=+p.hour,df=(e.o-ho)/60,dd=di(p)-hi,s2=stt(h);'
   + 'var w=document.createElement("div");w.className="row";'
   + 'var L=document.createElement("div");var n=document.createElement("div");n.className="rn";n.textContent=c[0];'
   + 'var m=document.createElement("div");m.className="rm";'
   + 'm.textContent=c[1]+" · "+ol(d,c[2])+" · "+(df===0?"same time as Dubai":(df>0?"+":"")+(Math.round(df*10)/10)+"h from Dubai");'
   + 'L.appendChild(n);L.appendChild(m);'
   + 'var R=document.createElement("div");R.className="rr";var tb=document.createElement("div");'
   + 'var t=document.createElement("div");t.className="rt";t.textContent=ft(p);'
   + 'var dl=document.createElement("div");dl.className="rd";dl.textContent=(dd===0?"same day":dd>0?"next day":"day before")+" · "+dfmt(d,c[2]);'
   + 'tb.appendChild(t);tb.appendChild(dl);'
   + 'var pl=document.createElement("span");pl.className="pill "+s2[0];pl.textContent=s2[1];'
   + 'var x=document.createElement("button");x.type="button";x.className="x";x.textContent="×";x.setAttribute("aria-label","Remove "+c[0]);'
   + 'x.onclick=function(){st.list=st.list.filter(function(v){return v!==c[0]});save();draw()};'
   + 'R.appendChild(tb);R.appendChild(pl);R.appendChild(x);'
   + 'var b=document.createElement("div");b.className="band";'
   + 'for(var i=0;i<24;i++){var g=document.createElement("i");g.style.left=(i/24*100)+"%";g.style.width=(100/24)+"%";g.style.background=bc(i);b.appendChild(g)}'
   + 'var k=document.createElement("i");k.className="mk";k.style.left=((h*60+ +p.minute)/1440*100)+"%";b.appendChild(k);'
   + 'w.appendChild(L);w.appendChild(R);w.appendChild(b);rs.appendChild(w)})};'
   + '$("sc").addEventListener("input",function(){st.live=false;st.min=+this.value;draw()});'
   + '$("dp").addEventListener("change",function(){if(!this.value)return;st.live=false;st.day=this.value;draw()});'
   + '$("nb").addEventListener("click",function(){st.live=true;sync();draw()});'
   + '$("ab").addEventListener("click",function(){var v=$("pk").value;if(!v)return;st.list.push(v);save();draw();toast(v+" added")});'
   + '$("fm").addEventListener("click",function(){st.h12=!st.h12;this.textContent=st.h12?"24h":"12h";this.classList.toggle("on",st.h12);save();draw()});'
   + '$("cp").addEventListener("click",function(){var d=now(),L=["Dubai  "+ft(pt(d,HZ))+"  ("+dfmt(d,HZ)+")"];'
   + 'st.list.map(cb).filter(Boolean).sort(function(a,b){return om(d,a[2])-om(d,b[2])}).forEach(function(c){L.push(c[0]+"  "+ft(pt(d,c[2]))+"  ("+dfmt(d,c[2])+")")});'
   + 'copy(L.join("\\n"),"times copied")});'
   + 'load();if(st.h12){$("fm").textContent="24h";$("fm").classList.add("on")}sync();fill();draw();'
   + 'setInterval(function(){if(st.live){sync();draw()}},1000);})();</script></body></html>';
}

'''

if "function renderClock" not in s:
    anchor = "\nfunction renderFind(key, q0) {"
    i = s.index(anchor)
    s = s[:i] + "\n" + FN.strip("\n") + "\n" + s[i:]
    print("renderClock added")
else:
    print("renderClock already present")

if s == orig:
    print("NO CHANGES")
    sys.exit(1)

io.open(P, "w", encoding="utf-8", newline="\n").write(s)
print("written, %d -> %d bytes" % (len(orig), len(s)))
