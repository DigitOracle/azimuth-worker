// v826 - writes 375 px screenshot harnesses for the Plot Passport Prices tab (building-level sales cards). Stored bsales rows; the rest of the plot is a stub.
import fs from "node:fs";
const P = await import("../src/plot_passport.js");
const N = await import("../src/passport_neighbourhood.js");
const out = process.argv[2] || ".";
const MCU = { sales: 7680, sales_12m: 379, median_aed_per_m2: 8191.0, median_aed_per_m2_12m: 10279.0, last_sale: "2026-10-15", building_names_n: 46, names: ["ABBEY CRESCENT 1", "ABBEY CRESCENT 2", "BARTON HOUSE 1", "BARTON HOUSE 2", "BENNETT HOUSE 1", "BENNETT HOUSE 2", "CLAVERTON HOUSE 1", "CLAVERTON HOUSE 2"] };
const THIN = { sales: 23, sales_12m: 1, median_aed_per_m2: 12628.0, median_aed_per_m2_12m: 33056.0, last_sale: "2026-10-06", building_names_n: 1, names: ["THE RESIDENCES II - BOULEVARD VILLAS"] };
const PROJ = { plot_level: false, plots_in_project: 12, project_sales: 9100, project_sales_12m: 410, project_median_aed_per_m2: 9050, last_sale: "2026-10-15" };
const cases = { multi: { id: "naj:plot:6740299", parcel: "6740299", area_name: "Motor City", facts: { bsales: MCU } },
  both: { id: "naj:plot:3450823", parcel: "3450823", area_name: "Burj Khalifa", facts: { bsales: THIN, bind: PROJ } },
  project_only: { id: "naj:plot:9990001", parcel: "9990001", area_name: "Example district", facts: { bind: PROJ } } };
for (const k in cases) {
  const c = cases[k], plot = { id: c.id, parcel: c.parcel, area_name: c.area_name, buildings: [], projects: [], permits: [], timeline: [], flats: { items: [] }, prices: null, sales_cards: N.bsalesCardsHtml(N.bsalesView(c.facts)) };
  const stub = "<script>try{localStorage.setItem('naj_thm','light')}catch(e){};window.fetch=function(u){var j=/\\/p\\?/.test(u)?{ok:true,plot:" + JSON.stringify(plot).replace(/</g, "\\u003c") + "}:{districts:[]};return Promise.resolve({json:function(){return Promise.resolve(j)}})};history.replaceState(null,'','?id=" + c.id + "');"
    + "setTimeout(function(){var b=document.getElementById('pptab-prices');if(b)b.click();var p=document.getElementById('pppanel');if(p)p.scrollIntoView()},300)</script>";
  const html = P.plotPassportHtml("k", "", { as_of: "2026-11-08", plots: 1 }, {}).replace("<head>", "<head>" + stub);
  fs.writeFileSync(out + "/v826_" + k + ".html", html);
}
console.log("wrote", Object.keys(cases).length);
