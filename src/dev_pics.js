// v417 - the developer's own pictures (its renders and the pages of its brochure) on our documents, shared by the Client sheet (src/devsays_dossier.js) and the investor report (src/investor_tiers_page.js).
// Permission: Kendall Wilson stated in chat on 8 October 2026 that the developer approves the use of all of its renders and brochure pages (data/developer_claims/<slug>_*.json render_permission, status "on_file").
// The pictures live in KV as img_dev_render_<slug>_<n> (+ img_ct_...), published by scripts/publish_dev_renders.py. A picture whose key is not published shows its caption and the line
// 'Picture not yet published' in the same box; it never fails the document. Every picture carries its caption: "Developer's render, ..." or "Developer's brochure page, ...".
// Nothing here is drawn, generated or taken from a map or a portal. Prices and payment plans on a brochure page stay 'developer says'.
import { PAGE_KIT, BRIEF_KIT, esc } from "./brief_docs.js";
import { permissionOnFile } from "./dev_claims.js";

export const NOT_PUBLISHED = "Picture not yet published";
export const REF_NOTE = "Prices and payment plans on these pages are the developer's own figures: developer says, not registered facts.";

// Every registered picture of a developer's record with its stored bytes (or null when the key is not published). Empty when the permission is not on file.
export async function loadDevPics(env, c, origin) {
  if (!c || !permissionOnFile(c)) return [];
  const out = [];
  for (const r of c.renders || []) out.push({ r, p: await PAGE_KIT.kvPic(env, r.kv, origin) });
  return out;
}
export const picGroup = (pics, g) => pics.filter((x) => x.r.group === g);


// one picture in a w x h box with its caption (and, optionally, what it shows). Missing key: a dashed box with the caption line.
export function picFigure(x, w, h, o) {
  const op = o || {}, cap = op.caption != null ? op.caption : x.r.caption, fs = op.fs || 9;
  const box = x.p ? PAGE_KIT.fitImg(x.p, w, h, x.r.what, op.posY == null ? 0.5 : op.posY)
    : '<div style="width:' + w + "px;height:" + h + 'px;box-sizing:border-box;border:1px dashed #DED9D0;display:flex;align-items:center;justify-content:center;font-size:' + fs + 'px;color:' + BRIEF_KIT.MUTED + ';text-align:center;padding:6px;">' + esc(NOT_PUBLISHED) + "</div>";
  return '<div style="width:' + w + 'px;display:flex;flex-direction:column;gap:2px;">' + box + '<div style="font-size:' + fs + "px;color:" + BRIEF_KIT.MUTED + ';line-height:1.3;">' + (op.what ? "<b>" + esc(op.what) + ".</b> " : "") + esc(cap) + "</div></div>";
}
// a row/grid of pictures: n columns of width w each
export function picGrid(list, cols, w, h, o) {
  return '<div style="display:grid;grid-template-columns:repeat(' + cols + ',' + w + 'px);gap:' + ((o && o.gap) || 8) + 'px;">' + list.map((x) => picFigure(x, w, h, (o && o.ref) ? { caption: "Developer's brochure page: " + x.r.what, fs: o.fs } : { what: o && o.withWhat ? x.r.what : "", fs: o && o.fs })).join("") + "</div>";
}
