// v364 - THE DIGITAL THREAD BEHIND OUR OWN RENDERS, and the community picture slot (Kendall, 6 Oct 2026: "all our own renders mapped into
// Najma - Brief, PDFs, the digital footprint - with the data thread behind every picture").
//
// Two things live here, both READ-ONLY and both DARK-LAUNCHED: with no thread_ and no community keys in KV every page renders exactly
// as it did before (test/test_v364_thread.mjs proves it).
//
// 1. THE THREAD. One JSON record per picture, in KV under  thread_<suffix>  where <suffix> is the render key without "img_render_"
//    (businessbay-73, community-damachills-artesia, community-jumeirahvillagecircle-shamal). It is NOT under the img_ prefix, so the
//    public /img/ route can never serve it (the route also refuses a thread_ name outright). The raw record holds file paths, hashes and
//    working notes; the reader returns ONLY a short plain-language view built from a whitelist of its fields. Nothing else leaves.
// 2. THE COMMUNITY SLOT. KV img_render_community-<district-slug>-<name> (+ img_ct_ companion, written with every ingest): one picture of
//    a community for the area page and the Brief. Always an illustration, never a photograph, never satellite.
//
// Thread fields read: kind, building, subject.{height_m,height_source}, lands[].{height_basis,building_basis}, developer.check,
// caveats[] (codes below). Everything else is ignored.

const CAVEATS = {
  footprint_offset_vs_makani: "Building outlines and plot outlines come from different sources and can sit up to about one building width apart, so positions are approximate.",
  floors_assumed: "Some floor counts are an estimate, so the heights drawn are an estimate.",
  developer_design_permission: "Shown for information. It is not issued or endorsed by the developer.",
  illustration_not_as_built: "An illustration, not as built: the finished homes may differ in detail.",
};
export const CAVEAT_CODES = Object.keys(CAVEATS);
export const caveatSentence = (code) => CAVEATS[String(code)] || null;   // an unknown code says nothing (never a raw code on a client face)

const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f<>"]/g, " ").replace(/\s+/g, " ").trim().slice(0, n || 80);
const safeSuffix = (s) => { const t = String(s || "").toLowerCase(); return /^[a-z0-9][a-z0-9_-]{0,100}$/.test(t) ? t : ""; };

// the render key (img_render_<this>) for a Brief record key: "businessbay:73" -> "businessbay-73"
export const renderSuffixOfKey = (key) => String(key || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// the community render key suffix: community-<district slug>-<name slug>; the name is the part after " - " of a Land Department community
export const communitySuffix = (district, name) => {
  const d = String(district || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const n = String(name || "").split(/\s+-\s+/).pop().toLowerCase().replace(/[^a-z0-9]/g, "");
  return d && n ? "community-" + d + "-" + n : "";
};
export const districtSlugOfArea = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);

// ---- the reader -----------------------------------------------------------------------------------------------------------------
export async function loadThread(env, suffix) {
  const s = safeSuffix(suffix);
  if (!s || !env || !env.MEETINGS) return null;
  try {
    const raw = await env.MEETINGS.get("thread_" + s);
    if (!raw) return null;
    const t = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
    return t && typeof t === "object" && !Array.isArray(t) ? t : null;
  } catch (e) { return null; }
}

const isCommunityKind = (k) => /community/i.test(String(k || ""));

// the plain-language view of one thread record: { caption, estimate, community, lines: [[label, text]], notes: [sentence] }
export function threadView(t) {
  if (!t || typeof t !== "object") return null;
  const codes = Array.isArray(t.caveats) ? t.caveats.map(String) : [];
  const estimate = codes.includes("floors_assumed");
  const community = isCommunityKind(t.kind);
  const name = clean(t.building, 80);
  const lands = Array.isArray(t.lands) ? t.lands : [];
  const sub = t.subject && typeof t.subject === "object" ? t.subject : {};
  const lines = [];
  if (community) lines.push(["What it is", "An illustration of " + (name || "this community") + ", drawn by Najma. It is not a photograph."]);
  else lines.push(["What it is", "An illustration of " + (name || "this building") + ", drawn by Najma. It is not a photograph."]);
  if (/^render_exterior/.test(String(t.kind || ""))) lines.push(["Built from", "The building's own outline, raised to the height we hold for it."]);
  else if (/oblique|map/.test(String(t.kind || "")) || lands.length) lines.push(["Built from", "The outline of each plot and building in the community, drawn as simple blocks."]);
  else if (community) lines.push(["Built from", "The outline of each home in the community, at the heights the municipality permits."]);
  const h = Number(sub.height_m);
  const heightGuess = estimate || lands.some((l) => /estimate|assumed|inferred/i.test(String(l && l.height_basis || "")));
  if (heightGuess) lines.push(["Height", "An estimate: floors counted at about 3.2 m each."]);
  else if (h > 0) lines.push(["Height", "About " + Math.round(h) + " m."]);
  else if (community) lines.push(["Height", "The permitted height for each home."]);
  lines.push(["Developer check", t.developer && t.developer.check ? "Checked against the Land Department register." : "A developer is named only where the register confirms it."]);
  lines.push(["Status", "An illustration for information, not a record of the finished building."]);
  const notes = codes.map(caveatSentence).filter(Boolean);
  const base = "Illustration &middot; Najma render" + (community ? " &middot; not as built" : "");
  return { caption: base + (estimate ? " &middot; heights are an estimate" : ""), estimate, community, lines, notes };
}

// the small tap-to-open note ("About this picture"). dark: the app pages; otherwise the paper documents.
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export function aboutHtml(view, o) {
  if (!view || !view.lines) return "";
  o = o || {};
  const fg = o.dark ? "#C9D3CE" : "#2A2A2A", mut = o.dark ? "#8FA39B" : "#6B6B6B", gold = o.dark ? "#C5A56A" : "#8A6D2F", bg = o.dark ? "rgba(12,20,19,0.96)" : "rgba(255,255,255,0.97)";
  const body = view.lines.map(([k, v]) => '<div style="margin:0 0 3px 0;"><b style="color:' + gold + ';">' + esc(k) + ".</b> " + esc(v) + "</div>").join("") +
    (view.notes.length ? '<div style="margin-top:4px;color:' + mut + ';">' + view.notes.map(esc).join(" ") + "</div>" : "");
  const style = o.float ? "position:absolute;right:4px;bottom:20px;width:260px;" : "margin-top:6px;";
  return '<details class="aboutpic" style="' + (o.float ? "position:absolute;right:4px;bottom:4px;" : "margin-top:4px;") + 'font-size:' + (o.float ? "8px" : "11px") + ";line-height:1.35;color:" + fg + ';">' +
    '<summary style="cursor:pointer;list-style:none;color:' + gold + ";" + (o.float ? "background:rgba(0,0,0,0.55);color:#FFF;padding:1px 4px;border-radius:2px;display:inline-block;" : "") + '">About this picture</summary>' +
    '<div style="' + (o.float ? "position:absolute;right:0;bottom:16px;width:250px;padding:6px 8px;background:" + bg + ";border:1px solid #D9D2C3;border-radius:3px;color:" + fg + ";" : "padding:6px 8px;background:" + bg + ";border-radius:4px;") + '">' + body + "</div></details>";
}
// Chrome prints a closed <details> as just its summary, so a paper document hides the chip in print and the caption carries the estimate.
export const ABOUT_PRINT_CSS = "<style>@media print{.aboutpic{display:none!important}}</style>";

// ---- the community slot ------------------------------------------------------------------------------------------------------------
// every community picture stored for a district: [{ name: "community-<d>-<n>", label }] (bytes AND content type present). [] when none.
export async function communityPics(env, districtSlug, max) {
  const d = districtSlugOfArea(districtSlug);
  if (!d || !env || !env.MEETINGS || !env.MEETINGS.list) return [];
  const pre = "img_render_community-" + d + "-";
  const out = [];
  try {
    const l = await env.MEETINGS.list({ prefix: pre });
    for (const k of (l.keys || []).map((x) => x.name).sort()) {
      const n = k.slice(11);   // "img_render_" off the front
      if (!/^community-[a-z0-9]+-[a-z0-9]+$/.test(n)) continue;
      if (!(await env.MEETINGS.get("img_ct_render_" + n))) continue;
      const t = await loadThread(env, n);
      out.push({ name: n, label: (t && clean(t.building, 80)) || n.split("-").pop().replace(/^./, (c) => c.toUpperCase()), view: threadView(t) || threadView({ kind: "render_community_illustration", building: "", caveats: ["illustration_not_as_built"] }) });
      if (out.length >= (max || 6)) break;
    }
  } catch (e) { return []; }
  return out;
}

// the area-page block: a hero picture, the caption, the About note, then the other pictures as links. "" when there is nothing to show.
export function communityBlockHtml(pics, key) {
  if (!pics || !pics.length) return "";
  const K = encodeURIComponent(key || "");
  const src = (p) => "/render/" + encodeURIComponent(p.name) + "?key=" + K;
  const h = pics[0];
  return '<div class=card style="padding:0;overflow:hidden">' +
    '<div style="position:relative;background:#0C1413"><img src="' + src(h) + '" alt="' + esc(h.label) + ' (illustration)" loading=lazy style="display:block;width:100%;height:auto;max-height:340px;object-fit:cover">' +
    '<div style="position:absolute;left:6px;bottom:6px;background:rgba(0,0,0,0.55);color:#FFF;font-size:11px;padding:2px 6px;border-radius:3px;">' + h.view.caption + "</div></div>" +
    '<div style="padding:8px 12px 10px 12px;"><div style="font-size:.78rem;color:#C9D3CE;">' + esc(h.label) + "</div>" + aboutHtml(h.view, { dark: true }) +
    (pics.length > 1 ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">' + pics.slice(1).map((p) => '<a href="' + src(p) + '" target=_blank rel=noopener style="font-size:.72rem;color:#C5A56A;">' + esc(p.label) + "</a>").join(" &middot; ") + "</div>" : "") +
    "</div></div>";
}
