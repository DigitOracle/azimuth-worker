// v653 (Kendall for Najjuko, 27 Oct 2026: "if she sees a word or a name misspelled ... can the PDF be edited before she sends it? ... a share
// button where it goes to WhatsApp or to email"): every FN printable page (one entry, one task, one meeting, the period report, the debrief and the
// plan week/month PDFs) gets Edit (fix wording on the page, this PDF only) and Share PDF (a real PDF file made in the browser and handed to the
// phone's share sheet: WhatsApp, Mail ...). Nothing is sent by Momo: she picks the app. "Save as PDF" (the print sheet) stays.
export const HTML2PDF_SRC = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";

const TOOLS_JS = `var __name=function(f){return f};(function(){
var ed=document.getElementById("pt_ed"),sh=document.getElementById("pt_sh"),bn=document.getElementById("pt_bn"),editing=false;
function area(){return document.querySelector(".it")||document.querySelector(".page")||document.querySelector("main")||document.body}
function bar(){var b=ed&&ed.parentNode;return b}
ed.onclick=function(){editing=!editing;var a=area();a.contentEditable=editing?"true":"false";a.spellcheck=true;
 bn.style.display=editing?"block":"none";ed.textContent=editing?"Done":"Edit";if(editing)a.focus()};
function fname(){var t=(document.title||"FN").replace(/^FN\\s+/,"").replace(/[^A-Za-z0-9]+/g,"_").replace(/^_|_$/g,"").slice(0,60);
 var d=new Date(),ds=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");return "FN_"+t+"_"+ds+".pdf"}
function say(m){bn.style.display="block";bn.textContent=m;setTimeout(function(){if(!editing)bn.style.display="none";else bn.textContent=EDIT_MSG},6000)}
var EDIT_MSG=bn.textContent;
sh.onclick=function(){if(typeof html2pdf!=="function"){say("The PDF maker did not load. Check the connection and try again, or use Save as PDF.");return}
 if(editing)ed.onclick();var b=bar();b.style.visibility="hidden";bn.style.display="none";sh.disabled=true;sh.textContent="Making PDF...";
 var name=fname();
 html2pdf().set({margin:8,filename:name,image:{type:"jpeg",quality:0.95},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},pagebreak:{mode:["css","legacy"],avoid:["tr","li","h2","table.kv",".note"]}})
 .from(document.body).outputPdf("blob").then(function(blob){
  b.style.visibility="visible";sh.disabled=false;sh.textContent="Share PDF";
  var file=null;try{file=new File([blob],name,{type:"application/pdf"})}catch(e){}
  if(file&&navigator.canShare&&navigator.canShare({files:[file]})){return navigator.share({files:[file],title:document.title}).catch(function(){})}
  var u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
  say("Saved: open WhatsApp or Mail and attach "+name);
 }).catch(function(){b.style.visibility="visible";sh.disabled=false;sh.textContent="Share PDF";say("The PDF could not be made here. Use Save as PDF instead.")})};
})();`;

// The buttons replace the old single print button; the banner and the scripts ride along inside the same button bar.
export const PDF_TOOLS = '<button class=btn id=pt_ed type=button>Edit</button><button class=btn id=pt_sh type=button>Share PDF</button><button class=btn onclick="print()">Save as PDF</button>'
  + '<div id=pt_bn style="display:none;position:fixed;left:0;right:0;top:0;z-index:9;padding:7px 12px;background:#C9A97A;color:#1F2B44;font:600 12px Inter,Arial,sans-serif;text-align:center">Editing: tap any text to fix it. Changes apply to this PDF only (the saved record is not changed). Tap Done when finished.</div>'
  + '<script src="' + HTML2PDF_SRC + '"></script><script>' + TOOLS_JS + '</script>';

export const OLD_PRINT_BTN = '<button class=btn onclick="print()">Share / Save as PDF</button>';
