// v414 - the developer's own launch material (data/developer_claims/*.json, bundled as src/dev_claims_data.js) for projects that are NOT on the project register.
// Everything here is DEVELOPER_CLAIMED: "developer says", with the source and the received date. Nothing is invented, nothing is a registered figure.
// Used by: the Project details panel (headline, Client and Broker buttons: DEVSAYS_JS below), the Client sheet built from a developer-says record (src/devsays_dossier.js),
// and the Broker sheet (src/devmap_pdf.js, the 'confirmed and developer says' note). Nothing here reads or writes KV.
//
// THE PICTURE PERMISSION GATE: a claims file carries render_permission {status, note, set_by, date}. A developer's render may be shown on any client-facing document
// (the Client sheet, the Broker sheet, any PDF the owner can send out) ONLY when status === "on_file". While it is "pending" the Client sheet is still built (a facts sheet)
// and says "Pictures withheld until the developer's written permission is on file." The render publisher (scripts/publish_dev_renders.py) refuses to write img_dev_render_* unless it is "on_file".
import { DEV_CLAIMS } from "./dev_claims_data.js";

export const PICTURES_WITHHELD = "Pictures withheld until the developer's written permission is on file.";
export const permissionOnFile = (c) => !!(c && c.render_permission && c.render_permission.status === "on_file");
export const claimsFor = (slug) => (DEV_CLAIMS[String(slug || "").toLowerCase().replace(/[^a-z0-9_-]/g, "")] || null);
export const allClaims = () => Object.values(DEV_CLAIMS);
export const nk = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, "");
export const money = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// the lowest stated launch price: { aed, type, rows } (the cheapest row, whatever the type); null when the record states none
export function launchFrom(c) {
  const rows = c && c.price_from && Array.isArray(c.price_from.rows) ? c.price_from.rows.filter((r) => Number(r.from_aed) > 0) : [];
  if (!rows.length) return null;
  const lo = rows.reduce((a, r) => (r.from_aed < a.from_aed ? r : a), rows[0]);
  return { aed: lo.from_aed, type: lo.type, rows };
}
export const launchHeadline = (c) => { const l = launchFrom(c); return l ? "Launch price from AED " + money(l.aed) + " (developer says)" : ""; };
export const NOT_A_SALE = "Not a registered sale: no unit of this project has sold on the register";
export const receivedLong = (c) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(c && c.source && c.source.received || "")); const M = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]; return m ? Number(m[3]) + " " + M[Number(m[2]) - 1] + " " + m[1] : ""; };

// the compact list the page loads (GET /developers_map_api?what=devsays): no pictures, no plan rows; only what the panel needs to name, price-head and route the project.
export function devsaysApi() {
  const p = [];
  for (const c of allClaims()) {
    const l = launchFrom(c), pr = c.project || {};
    if (!pr.name) continue;
    p.push({ k: c.key, n: pr.name, b: pr.brand || "", f: l ? l.aed : 0, ft: l ? l.type : "", pid: pr.register_project_id || 0, i: pr.facts_id || "", r: receivedLong(c), x: ((c.renders || []).some((r) => r.exterior)) ? 1 : 0 });
  }
  return { v: 1, p };
}

// ---------------------------------------------------------------------------------------------------------- the page module (String.raw, no backticks, no substitutions)
export const DEVSAYS_JS = String.raw`
var DEVSAYS=(function(){
  var D=null;
  function nk(s){return String(s==null?"":s).toLowerCase().replace(/[^a-z0-9]+/g,"")}
  function pk(s){return String(s==null?"":s).toLowerCase().replace(/\s+by\s+.*$/,"").replace(/[^a-z0-9]+/g,"")}
  function money(n){return String(Math.round(Number(n)||0)).replace(/\B(?=(\d{3})+(?!\d))/g,",")}
  function load(j){D=null;if(!j||!j.p||!j.p.length)return 0;D=j.p;return D.length}
  // the developer-says record of a card: never for a register-verified project; the name must match AND the brand (or the register project id) must agree
  function find(d){if(!D||!d||!d.name)return null;var e=d.ev||{};if(e.e==="REGISTER_VERIFIED")return null;var k=pk(d.name),i,x,b;
    for(i=0;i<D.length;i++){x=D[i];if(pk(x.n)!==k)continue;b=nk(e.br||e.dn||"");if((x.pid&&e.p!=null&&Number(e.p)===x.pid)||(b&&nk(x.b)&&(b===nk(x.b)||b.indexOf(nk(x.b))===0)))return x}
    return null}
  // the two lines under the panel title for a project with no price per area: the developer's launch price, and (only when nothing has sold) that it is not a sale
  function head(d){var x=find(d);if(!x||!x.f)return null;return {l1:"Launch price from AED "+money(x.f)+" (developer says)",l2:(d.n>0?"":"Not a registered sale: no unit of this project has sold on the register")}}
  function clientHref(x,key){return "/doc_client?keys="+encodeURIComponent("dev:"+x.k)+"&mode=buy&beds=all&key="+encodeURIComponent(key)}
  return {load:load,find:find,head:head,clientHref:clientHref,nk:nk}
})();
`;
