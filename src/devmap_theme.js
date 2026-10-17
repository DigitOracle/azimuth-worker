// v612 - LIGHT AND DARK INTERFACE on the Developers-by-area page (Kendall, 17 Oct 2026: "I still need the light and dark interface ... a button ... that shows a dark interface, and then I can
// switch to a light interface"). A sun/moon button on the map (under the zoom control) switches the page's colour tokens (html[data-theme=light] redefines the :root set) and the basemap
// (CARTO dark-matter <-> positron); the choice is kept per browser in localStorage (devmap_theme), dark unless chosen otherwise. The page creates its map with THEME.style() and hands THEME a
// callback (onStyle) that swaps the style and rebuilds the layers; nothing here touches the page's private map variable.
// String.raw, no substitutions and no backticks (the rule src/devmap_page.js keeps); checked with node --check by test/test_v612_theme.mjs.
export const THEME_CSS = String.raw`
html[data-theme=light]{--ground:#f3efe6;--panel:#ffffff;--raise:#f1ede4;--ink:#16211f;--muted:#5f6b66;--line:#e2dccf;--teal:#0a4f4a;--gold:#b98b3e}
html[data-theme=light] body{background:var(--ground);color:var(--ink)}
html[data-theme=light] #lockchips .chip{background:#ffffff;color:#16211f;border-color:#e2dccf}
html[data-theme=light] .maplibregl-popup-content{background:#ffffff;color:#16211f;border-color:#e2dccf}
html[data-theme=light] .maplibregl-popup-tip{border-top-color:#ffffff;border-bottom-color:#ffffff}
html[data-theme=light] #plchip,html[data-theme=light] #plhov{background:rgba(255,255,255,.96);color:#16211f}
html[data-theme=light] #pjdet,html[data-theme=light] #bsnap{background:#ffffff;color:#16211f}
html[data-theme=light] .ptg{box-shadow:0 0 0 3px rgba(255,255,255,.6)}
#thm{position:absolute;top:92px;right:10px;z-index:5;width:36px;height:36px;padding:0;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--gold);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px rgba(0,0,0,.08)}
#thm:hover,#thm:focus-visible{border-color:var(--gold);outline:0}
#thm svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
`;

export const THEME_JS = String.raw`
var THEME=(function(){
var K="devmap_theme",cur="dark",CB=null;
var STYLES={dark:"https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",light:"https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"};
var SUN='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
var MOON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
function read(){try{var v=localStorage.getItem(K);if(v==="light"||v==="dark")cur=v}catch(e){}}
function save(){try{localStorage.setItem(K,cur)}catch(e){}}
function paint(){
  try{document.documentElement.setAttribute("data-theme",cur)}catch(e){}
  var b=document.getElementById("thm");if(!b)return;
  b.innerHTML=cur==="dark"?SUN:MOON;var t=cur==="dark"?"Switch to the light interface":"Switch to the dark interface";b.setAttribute("aria-label",t);b.title=t}
function style(){return STYLES[cur]}
function set(v,quiet){cur=v==="light"?"light":"dark";save();paint();if(!quiet&&CB){try{CB(style())}catch(e){}}}
function onStyle(fn){CB=typeof fn==="function"?fn:null}
function init(){
  read();var m=document.getElementById("map");
  if(m&&!document.getElementById("thm")){var b=document.createElement("button");b.type="button";b.id="thm";b.addEventListener("click",function(){set(cur==="dark"?"light":"dark")});m.appendChild(b)}
  paint();return style()}
return {init:init,set:set,get:function(){return cur},style:style,onStyle:onStyle,toggle:function(){set(cur==="dark"?"light":"dark")}}
})();
`;
