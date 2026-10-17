// v605 - COLLAPSIBLE PANELS on the Developers-by-area page (Kendall, 17 Oct 2026: "i need the left and the right to be collapsible"): a small tab on the inner edge of the left sheet and of the right
// panel hides or shows it, and the map takes the room (map.resize() runs after each change). The choice is kept per browser in localStorage (devmap_panels), wrapped in try/catch because the
// store can be missing or refuse writes. Nothing is stored on the server.
// The collapse rules only apply where the panel is a side panel: the left sheet from 761 px (below that it is the bottom sheet with its own grab bar) and the right panel from 1101 px (below that it
// is already hidden and the centre card carries its content), and the tabs are hidden below those widths, so a saved choice can never hide the only way in on a phone.
// String.raw, no substitutions and no backticks (the rule src/devmap_page.js keeps); checked with node --check by test/test_v605_panels.mjs.
const CHEV = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>';
export const PANELS_HTML = '<button type=button id=tglL class=ptg aria-expanded=true aria-label="Hide the left panel" title="Hide the left panel">' + CHEV + '</button>'
  + '<button type=button id=tglR class=ptg aria-expanded=true aria-label="Hide the right panel" title="Hide the right panel">' + CHEV + '</button>';

export const PANELS_CSS = String.raw`
.ptg{position:fixed;top:50%;margin-top:-28px;width:20px;height:56px;padding:0;border:1px solid var(--line);background:var(--panel);color:var(--muted);cursor:pointer;z-index:5;display:flex;align-items:center;justify-content:center}
.ptg:hover,.ptg:focus-visible{color:var(--gold);border-color:var(--gold);outline:0}
.ptg svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#tglL{left:340px;border-left:0;border-radius:0 8px 8px 0}
#tglR{right:400px;border-right:0;border-radius:8px 0 0 8px}
#tglR svg{transform:scaleX(-1)}
@media(min-width:761px){body.colL #side{display:none}body.colL #map{left:0}body.colL #tglL{left:0}body.colL #tglL svg{transform:scaleX(-1)}}
@media(min-width:1101px){body.colR #detail{display:none}body.colR #map{right:0}body.colR #tglR{right:0}body.colR #tglR svg{transform:none}}
@media(max-width:1100px){#tglR{display:none}}
@media(max-width:760px){#tglL{display:none}}
`;

export const PANELS_JS = String.raw`
var PANELS=(function(){
var K="devmap_panels",st={L:0,R:0};
function save(){try{localStorage.setItem(K,JSON.stringify(st))}catch(e){}}
function read(){try{var o=JSON.parse(localStorage.getItem(K)||"null");if(o){st.L=o.L?1:0;st.R=o.R?1:0}}catch(e){}}
function lab(el,side,on){if(!el)return;var t=(on?"Show":"Hide")+" the "+side+" panel";el.setAttribute("aria-expanded",on?"false":"true");el.setAttribute("aria-label",t);el.title=t}
function paint(){
  var b=document.body;b.classList.toggle("colL",!!st.L);b.classList.toggle("colR",!!st.R);
  lab(document.getElementById("tglL"),"left",!!st.L);lab(document.getElementById("tglR"),"right",!!st.R);
  if(typeof map!=="undefined"&&map&&map.resize){try{map.resize()}catch(e){}}}
function flip(side){st[side]=st[side]?0:1;save();paint()}
function init(){
  read();var l=document.getElementById("tglL"),r=document.getElementById("tglR");
  if(l)l.addEventListener("click",function(){flip("L")});
  if(r)r.addEventListener("click",function(){flip("R")});
  paint()}
return {init:init,flip:flip,state:function(){return {L:st.L,R:st.R}}}
})();
`;
