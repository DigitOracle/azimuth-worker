// v428 - THE DESK LAB (Kendall 9 Oct 2026: "we want to do all of this for DigitAlchemy first as a test ... don't send it to her until we
// fully test it"). Every new WhatsApp message type is tried HERE, on the desk number, to Kendall only, before any of it reaches Najjuko.
// One command per feature; when Meta refuses one, its own error text comes back to the desk so we learn exactly why.
//   lab              the menu
//   brief            the client brief as a WhatsApp FORM (Flow); its answers run the real Brief search          (feature 1)
//   lab carousel     swipeable cards, one picture and one link button each                                       (feature 2)
//   lab list         a list menu (up to 10 rows); the reply comes back as a list_reply                          (feature 3)
//   lab link         a link button (cta_url) instead of a pasted link                                           (feature 4)
//   lab location     "share your location"; the location he sends back is answered                             (feature 5)
//   lab typing       read ticks + "typing..." for a few seconds, then the answer                                (feature 6)
//   lab qr           a QR code that opens the desk with a message already typed                                  (feature 7)
//   lab profile      the desk's WhatsApp business profile as WhatsApp holds it                                   (feature 8)
// Everything goes to WA_DESK_OWNER from WA_DESK_PHONE_ID; nothing here can address anyone else.
import { sendBriefFlow, flowReply, briefFlowJson, FLOW_KEY, FLOW_NAME, FLOW_DRAFT_KEY } from "./wa_flows.js";
import { briefChatRoute } from "./brief_chat.js";   // v455 - the client brief as a chat (lists, buttons, typed answers)
import { momoTemplateDef } from "./fit.js";   // v453 - the Momo day template the desk submits

export const LAB_HELP = "Desk lab: every new WhatsApp feature, tried here first.\nmenu: tap-to-choose list for your videos (Reel, Status, broadcast)\nlinkedin: connect LinkedIn (one tap) so videos can post there too\n" +
  "brief: the client brief, asked in the chat\nbrief form: the client brief as a form (test only)\nlab carousel: swipeable cards\nlab list: a list menu\nlab link: a link button\nlab location: share your location\n" +
  "lab typing: read ticks and typing\nlab qr: a QR code that opens this chat with a message typed\nlab profile: this number's business profile\n" +
  "lab setup momo template <account id>: submit the Momo day message to Meta\nlab meta admins: who runs the business on Meta (names, login emails, roles)\nstatus <mp4 link>: a video sent here ready to forward to your Status\nreel <mp4 link> [: caption]: post a video to Instagram as a Reel, after you tap Post it\nOr just send a video here (as a video or a document, up to 25 MB) with the caption reel: <caption>, status: <caption> or broadcast";

const meta = (r) => (r && r.error ? " Meta said: " + String(r.error.message || r.error.error_user_msg || JSON.stringify(r.error)).slice(0, 300) : "");

// payload builders (exported for the tests)
export function listPayload(to, body, button, rows, header) {
  return { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "list",
    ...(header ? { header: { type: "text", text: String(header).slice(0, 60) } } : {}),
    body: { text: String(body).slice(0, 1024) }, action: { button: String(button).slice(0, 20),
      sections: [{ title: "Choose one", rows: rows.slice(0, 10).map((r) => ({ id: String(r.id).slice(0, 200), title: String(r.title).slice(0, 24), ...(r.description ? { description: String(r.description).slice(0, 72) } : {}) })) }] } } };
}
export function ctaPayload(to, body, label, url, header) {
  return { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "cta_url",
    ...(header ? { header: { type: "text", text: String(header).slice(0, 60) } } : {}),
    body: { text: String(body).slice(0, 1024) }, action: { name: "cta_url", parameters: { display_text: String(label).slice(0, 20), url } } } };
}
export function locationRequestPayload(to, body) {
  return { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "location_request_message", body: { text: String(body).slice(0, 1024) }, action: { name: "send_location" } } };
}
// media-card carousel (non-template, inside the 24-hour window): 2 to 10 cards, each an image header, body text and ONE link button
export function carouselPayload(to, body, cards) {
  return { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "carousel", body: { text: String(body).slice(0, 1024) },
    action: { cards: cards.slice(0, 10).map((c, i) => ({ card_index: i, type: "cta_url",
      header: { type: "image", image: { link: c.image } }, body: { text: String(c.text).slice(0, 160) },
      action: { name: "cta_url", parameters: { display_text: String(c.label).slice(0, 20), url: c.url } } })) } } };
}
// v458 (Kendall 10 Oct: "add it to the desk") - WhatsApp's business API cannot post a Status, so the desk sends the finished clip
// to Kendall with the steps, and posting it is one forward from his phone.
// v460 (10 Oct: a forwarded video KEEPS its caption, so the steps showed on his public Status) - the clip carries only the PUBLIC caption;
// the steps go as a separate text that is never forwarded.
export const STATUS_CAPTION = "Ready for your Status: open the video above, tap Forward, choose My status. Its caption is what viewers see. (Status splits clips over 60 seconds.)";
export const STATUS_PUBLIC = { site_clarity_75: "On site, the costly problems are the ones nobody sees in time. DigitAlchemy, with our partner GoCanvas. Complexity into clarity." };
// v460 - captions Kendall approved for a hosted clip, used when "reel <link>" has no caption of its own
export const REEL_CAPTIONS = {
  site_clarity_75: "On site, the costly problems are the ones nobody sees in time.\n\nTogether with our partner GoCanvas, DigitAlchemy brings drawings, digital inspections, progress and the market into one live view, so the site team, the commercial team and the client work from the same facts, on the same day.\n\nComplexity into clarity.\n\n#construction #digitalinspections #GoCanvas #DigitAlchemy #Dubai #constructiontech #BIM",
};
export function statusVideoPayload(to, link, note) {
  const pub = (note ? String(note).slice(0, 300) : "") || STATUS_PUBLIC[String(link).split("/").pop()] || "";
  return { messaging_product: "whatsapp", to, type: "video", video: pub ? { link, caption: pub } : { link } };
}
export const typingPayload =(messageId) => ({ messaging_product: "whatsapp", status: "read", message_id: messageId, typing_indicator: { type: "text" } });

// deps: { owner, pid, raw(env,payload,kind) -> {error?}, send(env,text), image(env,link,cap), graph, origin(env), briefLink(env,sp), sleep(ms) }
export async function deskLabRoute(env, msg, text, deps) {
  const t = String(text || "").trim(), to = deps.owner;
  const send = (s) => deps.send(env, s);
  // feature 1 - the form and its answers
  // v455 - "brief" is now the chat brief (lists, buttons, typed answers); the form stays reachable as "brief form" (desk-only test)
  if (/^\/?brief\s+form$/i.test(t)) { await sendBriefFlow(env, to, { send: (e, _to, s) => deps.send(e, s), post: (e, p, k) => deps.raw(e, p, k) }); return true; }
  if (await briefChatRoute(env, to, msg, { raw: deps.raw, send: (e, s) => deps.send(e, s), briefLink: deps.briefLink, search: deps.briefSearch })) return true;
  if (msg.type === "interactive" && msg.interactive && msg.interactive.nfm_reply) return flowReply(env, to, msg, { send: (e, _to, s) => deps.send(e, s), briefLink: deps.briefLink });
  // feature 5 - the location he shared back
  if (msg.type === "location" && msg.location && await env.MEETINGS.get("desk_lab_loc")) {
    await env.MEETINGS.delete("desk_lab_loc");
    const L = msg.location;
    await send("Got your location: " + Number(L.latitude).toFixed(5) + ", " + Number(L.longitude).toFixed(5) + (L.name ? " (" + L.name + ")" : "") + ". This is where Naj's version will answer with the nearest buildings, metro, schools and rents.");
    return true;
  }
  // feature 3 - a row picked from the lab list
  if (msg.type === "interactive" && msg.interactive && msg.interactive.list_reply && /^lab:/.test(String(msg.interactive.list_reply.id || ""))) {
    await send("You picked: " + msg.interactive.list_reply.title + " (id " + msg.interactive.list_reply.id + "). The list menu works."); return true;
  }
  // v458 - status <https link to an mp4> [: note]  -> the clip, ready to forward to Status
  const sm = t.match(/^\/?status\s+(https:\/\/\S+)(?:\s*:?\s*([\s\S]*))?$/i);
  if (sm) {
    const r = await deps.raw(env, statusVideoPayload(to, sm[1], (sm[2] || "").trim()), "status-video");
    if (r && r.error) await send("Could not send the clip." + meta(r) + " The link must be a public https link straight to an .mp4 under 16 MB.");
    else await send(STATUS_CAPTION);
    return true;
  }
  // v461 (Kendall 10 Oct: "when I'm only in the DigitAlchemy WhatsApp, on my mobile") - a VIDEO sent to the desk, as a video or as a
  // document. Caption "reel: ..." / "status: ..." / "broadcast" acts at once; no caption asks with buttons. Stored as vid_desk_<n> and served at
  // /video/desk_<n>, so it then runs through the same reel and status steps as a link. The worker cannot compress: over 25 MB is refused.
  const vm = deskVideoOf(msg);
  if (vm) {
    const info = deps.mediaInfo ? await deps.mediaInfo(env, vm.id) : {};
    const size = Number(info && info.file_size) || 0;
    if (size > VIDEO_KEEP_MAX) { await send("That video is " + mb(size) + " MB; I can keep up to 25 MB. In HeyGen download it at 540p (an 80-second clip is then about 10-15 MB) and send it again."); return true; }
    let got = null; try { got = await deps.fetchMedia(env, vm.id); } catch (e) {}
    if (!got || !got.bytes || !got.bytes.byteLength) { await send("I could not download that video from WhatsApp. Send it again."); return true; }
    if (got.bytes.byteLength > VIDEO_KEEP_MAX) { await send("That video is " + mb(got.bytes.byteLength) + " MB; I can keep up to 25 MB. Download it at 540p and send it again."); return true; }
    const n = Number((await env.MEETINGS.get("desk_vid_seq")) || 0) + 1;
    await env.MEETINGS.put("desk_vid_seq", String(n));
    const key = "desk_" + n, bytes = got.bytes.byteLength;
    await env.MEETINGS.put("vid_" + key, got.bytes, { expirationTtl: 60 * 86400 });
    await env.MEETINGS.put("desk_vid_last", JSON.stringify({ key, bytes, at: Date.now() }), { expirationTtl: 60 * 86400 });
    const link = origin0(deps, env) + "/video/" + key;
    const cap = vm.caption, cm = cap.match(/^\s*(reel|status|broadcast)\b\s*:?\s*([\s\S]*)$/i);
    if (cm) return videoAction(env, deps, to, cm[1].toLowerCase(), link, key, bytes, cm[2].trim());
    await deps.raw(env, { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", body: { text: "Got your video (" + mb(bytes) + " MB, saved as " + key + "). What should I do with it?" },
      action: { buttons: [{ type: "reply", reply: { id: "dv:reel:" + key, title: "Instagram Reel" } }, { type: "reply", reply: { id: "dv:status:" + key, title: "Status" } }, { type: "reply", reply: { id: "dv:broadcast:" + key, title: "Save for broadcast" } }] } } }, "video-ask");
    return true;
  }
  // v462 (Kendall 10 Oct: "make those captions buttons ... it's hard to type all that in") - every choice is a tap: a button or a menu row
  const tapId = msg.type === "interactive" && msg.interactive && String((msg.interactive.button_reply && msg.interactive.button_reply.id) || (msg.interactive.list_reply && msg.interactive.list_reply.id) || "");
  const dv = tapId && tapId.match(/^dv:(reel|status|broadcast):((?:desk_\d+)|(?:[a-z0-9_]+))$/);
  if (dv) {
    const bytes = await videoBytes(env, dv[2]);
    if (dv[1] === "broadcast") return videoAction(env, deps, to, "broadcast", origin0(deps, env) + "/video/" + dv[2], dv[2], bytes, "");
    await captionChoices(env, deps, to, dv[1], dv[2]); return true;
  }
  const dc = tapId && tapId.match(/^dc:(ai|last|type|none|again):(reel|status):([a-z0-9_]+)$/);
  if (dc) {
    const [, how, what, key] = dc, link = origin0(deps, env) + "/video/" + key, bytes = await videoBytes(env, key);
    if (how === "type") { await env.MEETINGS.put("desk_cap_wait", JSON.stringify({ what, key }), { expirationTtl: 3600 }); await send("Type the " + (what === "reel" ? "Instagram" : "Status") + " caption as your next message."); return true; }
    if (how === "none") return videoAction(env, deps, to, what, link, key, bytes, "");
    if (how === "last") { const c = await env.MEETINGS.get("desk_last_cap_" + what); return videoAction(env, deps, to, what, link, key, bytes, c || ""); }
    const c = await draftCaption(env, deps, what);
    if (!c) { await send("I could not write one just now. Tap I'll type it, or try Write it for me again."); return true; }
    return videoAction(env, deps, to, what, link, key, bytes, c);
  }
  if (msg.type === "text" && t && !/^(\/|lab\b|reel\b|status\b|menu\b|brief\b|post\b|linkedin\b|music\b|morning\b|feed\b|events?\b)/i.test(t)) {
    let w = null; try { w = JSON.parse((await env.MEETINGS.get("desk_cap_wait")) || "null"); } catch (e) {}
    if (w) { await env.MEETINGS.delete("desk_cap_wait"); return videoAction(env, deps, to, w.what, origin0(deps, env) + "/video/" + w.key, w.key, await videoBytes(env, w.key), t); }
  }
  // v462 - "menu": everything the desk does with videos, as a list to tap
  if (/^\/?menu$/i.test(t)) {
    let last = null; try { last = JSON.parse((await env.MEETINGS.get("desk_vid_last")) || "null"); } catch (e) {}
    const k = (last && last.key) || "site_clarity_75";
    // row ids must be unique (Meta refuses the whole list otherwise, #131009): the site-clarity rows only when the latest video is another one
    const rows = [
      { id: "dv:reel:" + k, title: "Post to Instagram", description: "As a Reel, after you tap Post it" },
      { id: "dv:status:" + k, title: "Send for my Status", description: "Comes back here ready to forward" },
      { id: "dv:broadcast:" + k, title: "Save for broadcast", description: "Nothing is sent until you approve" }];
    if (k !== "site_clarity_75") rows.push({ id: "dv:reel:site_clarity_75", title: "Site clarity: Reel", description: "The GoCanvas video" }, { id: "dv:status:site_clarity_75", title: "Site clarity: Status", description: "The GoCanvas video" });
    const r = await deps.raw(env, listPayload(to, "Latest video: " + k + ". Pick what to do. To use a new video, just send it here (no caption needed).", "Open menu", rows, "Desk menu"), "menu");
    if (r && r.error) await send("The menu was refused." + meta(r));
    return true;
  }
  // v460 - reel <https mp4 link> [: caption] -> the clip and caption come back with Post / Cancel; nothing goes to Instagram until Post
  const rm = t.match(/^\/?reel\s+(https:\/\/\S+)(?:\s*:\s*([\s\S]+))?$/i);
  if (rm) {
    const caption = (rm[2] || "").trim() || REEL_CAPTIONS[rm[1].split("/").pop()] || "";
    if (!caption) { await send("Add the caption after a colon: reel <link> : <caption>."); return true; }
    await env.MEETINGS.put("desk_reel_pending", JSON.stringify({ url: rm[1], caption, at: Date.now() }), { expirationTtl: 2 * 86400 });
    await deps.raw(env, { messaging_product: "whatsapp", to, type: "video", video: { link: rm[1], caption: "Reel for Instagram (@digitalabbotuae). Caption:\n\n" + caption.slice(0, 900) } }, "reel-preview");
    await deps.raw(env, { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", body: { text: "Post this reel to Instagram?" }, action: { buttons: [{ type: "reply", reply: { id: "dr:ok", title: "Post it" } }, { type: "reply", reply: { id: "dr:no", title: "Cancel" } }] } } }, "reel-buttons");
    return true;
  }
  const br = tapId || "";   // v469: list rows count as taps too
  if (br === "dr:no") { await env.MEETINGS.delete("desk_reel_pending"); await send("Cancelled. Nothing was posted."); return true; }
  // v464 - Post it asks WHERE when LinkedIn is connected: Instagram / LinkedIn / Both. Without LinkedIn it goes to Instagram as before.
  if (br === "dr:ok" || br === "dr:ig" || br === "dr:li" || br === "dr:both") {
    let p = null; try { p = JSON.parse((await env.MEETINGS.get("desk_reel_pending")) || "null"); } catch (e) {}
    if (!p) { await send("No video is waiting (it may already be posted or cancelled)."); return true; }
    const liOn = deps.liConnected ? await deps.liConnected(env) : false;
    if (br === "dr:ok" && liOn) {
      await deps.raw(env, { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", body: { text: "Post where?" },
        action: { buttons: [{ type: "reply", reply: { id: "dr:ig", title: "Instagram" } }, { type: "reply", reply: { id: "dr:li", title: "LinkedIn" } }, { type: "reply", reply: { id: "dr:both", title: "Both" } }] } } }, "post-where");
      return true;
    }
    const toIg = br === "dr:ok" || br === "dr:ig" || br === "dr:both", toLi = br === "dr:li" || br === "dr:both";
    if (toLi) {
      let q = null; try { q = JSON.parse((await env.MEETINGS.get("desk_li_pending")) || "null"); } catch (e) {}
      const key = String(p.url).split("/").pop();
      if (q && q.posted && q.key === key && q.caption === p.caption) await send("Already on LinkedIn: " + (q.url || q.id));
      else {
        const keep = q && q.key === key && q.video ? q.video : undefined;   // the same video already uploaded: never upload twice
        await env.MEETINGS.put("desk_li_pending", JSON.stringify({ key, caption: p.caption, approved: true, video: keep, at: Date.now() }), { expirationTtl: 3 * 86400 });
        await send("Uploading to LinkedIn. It processes the video first; I post it the moment it is ready.");
        if (deps.liStep) await deps.liStep(env);
      }
    }
    if (toIg) {
      if (p.posted) { await send("Already on Instagram: " + (p.permalink || p.id)); return true; }
      if (!deps.reel) { await send("Reel posting is not wired on this worker."); return true; }
      p.approved = true;
      await send("Uploading to Instagram. Video processing takes a minute or two; I post it the moment it is ready.");
      await reelStep(env, p, deps, 3);
    }
    return true;
  }
  // v464 - "linkedin": the one-tap sign-in link (and the status of the connection)
  if (/^\/?linkedin$/i.test(t)) {
    if (!deps.liLink) { await send("LinkedIn is not wired on this worker."); return true; }
    const r = await deps.liLink(env);
    if (r.err) { await send("Cannot make the link: " + r.err); return true; }
    const res = await deps.raw(env, ctaPayload(to, (r.connected ? "LinkedIn is connected" + (r.until ? " until " + r.until : "") + ". Tap to renew the sign-in." : "Connect LinkedIn so the desk can post your videos there (your personal profile).") + " The link works for 15 minutes.", "Sign in", r.link, "LinkedIn"), "li-link");
    if (res && res.error) await send("Sign-in link: " + r.link);
    return true;
  }
  if (/^\/?status$/i.test(t)) { await send("Send: status <link to the .mp4> (optionally : a note). I send the clip back here ready to forward to your Status."); return true; }
  if (!/^lab\b/i.test(t)) return false;
  const sub = t.replace(/^lab\b\s*/i, "").toLowerCase();
  const origin = deps.origin(env);
  if (!sub) { await send(LAB_HELP); return true; }
  if (sub === "list") {
    const r = await deps.raw(env, listPayload(to, "Pick a picture for the post. (This is the menu the feed will use.)", "Choose picture", [
      { id: "lab:site", title: "You on site", description: "Hard hat, hi-vis, on a construction site" },
      { id: "lab:speaking", title: "You speaking or teaching", description: "Mid-talk, as at a workshop" },
      { id: "lab:scene", title: "A scene, no person", description: "Calm illustration, no faces" },
      { id: "lab:slides", title: "Infographic slides", description: "A carousel of text slides" }], "Desk lab: list menu"), "lab-list");
    if (r && r.error) await send("The list menu was refused." + meta(r)); return true;
  }
  if (sub === "link") {
    const r = await deps.raw(env, ctaPayload(to, "One tap opens the page: no long link pasted in the chat.", "Open the Brief", origin + "/brief", "Desk lab: link button"), "lab-cta");
    if (r && r.error) await send("The link button was refused." + meta(r)); return true;
  }
  if (sub === "location") {
    await env.MEETINGS.put("desk_lab_loc", "1", { expirationTtl: 3600 });
    const r = await deps.raw(env, locationRequestPayload(to, "Share your location and I'll tell you what is around you. (Desk lab: location request.)"), "lab-loc");
    if (r && r.error) await send("The location request was refused." + meta(r)); return true;
  }
  if (sub === "typing") {
    if (msg.id) { const r = await deps.raw(env, typingPayload(msg.id), "lab-typing"); if (r && r.error) { await send("Read ticks and typing were refused." + meta(r)); return true; } }
    await deps.sleep(4000);
    await send("Done. You should have seen blue ticks on your message and \"typing...\" for about 4 seconds before this arrived.");
    return true;
  }
  if (sub === "carousel") {
    const pics = await labPictures(env, origin);
    if (pics.length < 2) { await send("The carousel needs at least 2 stored pictures and I found " + pics.length + ". Make a feed post first, then try again."); return true; }
    const cards = pics.slice(0, 3).map((p, i) => ({ image: p, text: ["Card one: a post idea with its picture", "Card two: swipe sideways", "Card three: each card has its own button"][i] || "Card", label: "Open", url: origin + "/brief" }));
    const r = await deps.raw(env, carouselPayload(to, "Desk lab: swipeable cards. Swipe left and right.", cards), "lab-carousel");
    if (r && r.error) await send("The carousel was refused." + meta(r) + " (If it is the message format, the carousel goes through an approved template instead; I will set that up.)");
    return true;
  }
  if (sub === "qr") {
    let j = null;
    try {
      j = await (await fetch(deps.graph + "/" + deps.pid + "/message_qrdls?prefilled_message=" + encodeURIComponent("Send me the digital footprint demo") + "&generate_qr_image=PNG",
        { method: "POST", headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN } })).json();
    } catch (e) {}
    if (!j || j.error || !j.qr_image_url) { await send("The QR code was refused." + meta(j)); return true; }
    await env.MEETINGS.put("desk_lab_qr", JSON.stringify({ code: j.code, link: j.deep_link_url, at: new Date().toISOString() }), { expirationTtl: 90 * 86400 });
    await deps.image(env, j.qr_image_url, "Desk lab: scan this and WhatsApp opens this chat with \"Send me the digital footprint demo\" already typed. Link: " + j.deep_link_url);
    return true;
  }
  // v430 - register the brief form with Meta from the desk (the owner is the authority here; no key in a link). "lab setup brief <waba>" is a
  // dry run that shows what will be created; "lab setup brief <waba> go" creates and publishes it and stores its id.
  // v443 (9 Oct: the reply was cut at 300 characters, right at the APP entity) - one line per entity, the blocked ones with Meta's own errors
  const healthSay = (hs) => [].concat(hs.entities || []).map((e) => "- " + (e.entity_type || "?") + " " + (e.id || "") + ": " + (e.can_send_message || "?")
    + (e.errors && e.errors.length ? " - " + e.errors.map((x) => [x.error_code, x.error_description, x.possible_solution].filter(Boolean).join(": ")).join("; ") : "")
    + (e.additional_info && e.additional_info.length ? " (" + [].concat(e.additional_info).join("; ") + ")" : "")).join("\n").slice(0, 1500) || JSON.stringify(hs).slice(0, 1500);
  if (/^setup brief\b/.test(sub)) {
    const m = sub.match(/^setup brief\s+(\d{8,20})(\s+go)?$/);
    if (!m) { await send("Send: lab setup brief <WhatsApp Business Account id>  (add go at the end to create it)."); return true; }
    const json = briefFlowJson();
    if (!m[2]) { await send("Dry run. I will create the form \"" + FLOW_NAME + "\" (2 screens, " + json.screens[0].layout.children.length + " + " + json.screens[1].layout.children.length + " parts) on account " + m[1] + " and publish it. Nothing has been created. Send: lab setup brief " + m[1] + " go"); return true; }
    // v431 (9 Oct: "Publishing attempt failed", no reason given): create OR reuse the draft, upload the JSON, read Meta's itemised
    // validation errors, and publish only when there are none. Every refusal is reported with Meta's own detail.
    const H = { Authorization: "Bearer " + env.WHATSAPP_TOKEN }, G = deps.graph;
    const j_ = async (u, init) => { try { return await (await fetch(u, Object.assign({ headers: H }, init || {}))).json(); } catch (e) { return { error: { message: "Meta did not answer" } }; } };
    const errList = (v) => (v || []).slice(0, 8).map((x) => (x.error_type ? x.error_type + ": " : "") + (x.message || JSON.stringify(x)) + (x.pointers && x.pointers[0] ? " (" + [x.pointers[0].path || "", x.pointers[0].line_start ? "line " + x.pointers[0].line_start : ""].filter(Boolean).join(", ") + ")" : "")).join("\n- ");
    const list = await j_(G + "/" + m[1] + "/flows?fields=id,name,status");
    const prior = list && Array.isArray(list.data) ? list.data.find((f) => f.name === FLOW_NAME) : null;
    let id = prior ? String(prior.id) : "";
    if (prior && prior.status === "PUBLISHED") { await env.MEETINGS.put(FLOW_KEY, id); await send("The form is already published (id " + id + "). Stored. Send brief to try it."); return true; }
    let ve = [];
    if (!id) {
      const fd = new FormData(); fd.append("name", FLOW_NAME); fd.append("categories", JSON.stringify(["LEAD_GENERATION"])); fd.append("flow_json", JSON.stringify(json));
      const c = await j_(G + "/" + m[1] + "/flows", { method: "POST", body: fd });
      if (!c || !c.id) { await send("Meta did not create the form." + meta(c) + (c && c.error && c.error.error_data ? " Details: " + JSON.stringify(c.error.error_data).slice(0, 400) : "")); return true; }
      id = String(c.id); ve = c.validation_errors || [];
    } else {
      const fd = new FormData(); fd.append("file", new Blob([JSON.stringify(json)], { type: "application/json" }), "flow.json"); fd.append("name", "flow.json"); fd.append("asset_type", "FLOW_JSON");
      const u = await j_(G + "/" + id + "/assets", { method: "POST", body: fd });
      if (u && u.error) { await send("Meta refused the updated form (draft " + id + ")." + meta(u)); return true; }
      ve = (u && u.validation_errors) || [];
    }
    if (ve.length) { await send("The form is saved as a draft (id " + id + ") but Meta found problems, so it is not published:\n- " + errList(ve) + "\nTell me and I will fix them."); return true; }
    const pub = await j_(G + "/" + id + "/publish", { method: "POST" });
    if (!pub || !pub.success) {
      await env.MEETINGS.put(FLOW_DRAFT_KEY, id);   // v433: brief opens this draft in test mode until Meta publishes it
      const st = await j_(G + "/" + id + "?fields=status,validation_errors,health_status");
      await send("Meta did not publish the form (draft " + id + ")." + meta(pub) + (st && st.validation_errors && st.validation_errors.length ? "\nProblems:\n- " + errList(st.validation_errors) : "") + (st && st.health_status ? "\nHealth:\n" + healthSay(st.health_status) : "") + (st && st.status ? "\nStatus: " + st.status : ""));
      return true;
    }
    await env.MEETINGS.put(FLOW_KEY, id);
    await send("Form published and stored (id " + id + "). Send brief to try it.");
    return true;
  }
  // v453 - submit the Momo day template (momo_day_check) to Meta from the desk. "lab setup momo template <waba>" is a dry run that shows exactly what will be
  // submitted; "... go" POSTs it to /<waba>/message_templates and reports Meta's answer verbatim. When it already exists, its current status is read back.
  if (/^setup momo template\b/.test(sub)) {
    const m = sub.match(/^setup momo template\s+(\d{8,20})(\s+go)?$/);
    if (!m) { await send("Send: lab setup momo template <WhatsApp Business Account id>  (add go at the end to submit it)."); return true; }
    const def = momoTemplateDef(), body = def.components[0], btn = def.components[1].buttons[0];
    if (!m[2]) {
      await send("Dry run. I will submit this template to Meta on account " + m[1] + ":\nName: " + def.name + "\nCategory: " + def.category + "\nLanguage: " + def.language +
        "\nBody: " + body.text + "\nExample: {{1}} = " + body.example.body_text[0][0] + ", {{2}} = " + body.example.body_text[0][1] + "\nButton (quick reply): " + btn.text +
        "\nNothing has been submitted. Send: lab setup momo template " + m[1] + " go");
      return true;
    }
    const H = { Authorization: "Bearer " + env.WHATSAPP_TOKEN }, G = deps.graph;
    let r = null;
    try { r = await (await fetch(G + "/" + m[1] + "/message_templates", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify(def) })).json(); } catch (e) { r = { error: { message: "Meta did not answer" } }; }
    if (r && r.id) { await send("Meta took the template " + def.name + " (id " + r.id + "). Status: " + (r.status || "?") + ". Category: " + (r.category || "?") + ". Once it says APPROVED, it can be switched on."); return true; }
    const e = (r && r.error) || {}, verb = [e.message, e.error_user_title, e.error_user_msg].filter(Boolean).join(" | ") || JSON.stringify(r).slice(0, 400);
    let st = null;
    try { st = await (await fetch(G + "/" + m[1] + "/message_templates?name=" + encodeURIComponent(def.name) + "&fields=name,status,category,language,rejected_reason", { headers: H })).json(); } catch (e2) {}
    const have = st && Array.isArray(st.data) ? st.data.filter((x) => x.name === def.name) : [];
    await send("Meta did not take the template. Meta said: " + verb.slice(0, 600) + (have.length ? "\nAlready on the account: " + have.map((x) => x.name + " (" + (x.language || "?") + "): " + (x.status || "?") + (x.category ? ", " + x.category : "") + (x.rejected_reason && x.rejected_reason !== "NONE" ? ", rejected: " + x.rejected_reason : "")).join("; ") : ""));
    return true;
  }
  // v456 (Kendall 10 Oct: logged out of Facebook, cannot find which login runs the business) - ask Meta, with the token the worker
  // already holds, who the PEOPLE on the business portfolio are (name, email, role) and which business owns the WhatsApp account.
  // Owner-only (the desk), read-only, the token is never shown. A missing permission comes back as Meta's own words.
  if (/^meta admins\b/.test(sub)) {
    const BIZ = "1730729287953659", WABA = "1588773749592854";
    const H = { Authorization: "Bearer " + env.WHATSAPP_TOKEN }, G = deps.graph;
    const get = async (u) => { try { return await (await fetch(G + u, { headers: H })).json(); } catch (e) { return { error: { message: "Meta did not answer" } }; } };
    const L = ["Who runs the business on Meta (portfolio " + BIZ + "):"];
    const users = await get("/" + BIZ + "/business_users?fields=name,email,role,first_name,last_name&limit=50");
    if (users && Array.isArray(users.data)) {
      if (!users.data.length) L.push("No people listed.");
      users.data.forEach((u, i) => L.push((i + 1) + ". " + (u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || "(no name)") + " - " + (u.email || "no email shown") + " - " + (u.role || "role not shown")));
    } else L.push("People: not readable." + meta(users));
    const sys = await get("/" + BIZ + "/system_users?fields=name,role&limit=20");
    if (sys && Array.isArray(sys.data) && sys.data.length) L.push("System users (the app's own logins, not people): " + sys.data.map((u) => (u.name || "?") + " (" + (u.role || "?") + ")").join(", "));
    const waba = await get("/" + WABA + "?fields=name,owner_business_info");
    if (waba && !waba.error) L.push("WhatsApp account " + WABA + ": " + (waba.name || "") + "; owned by " + ((waba.owner_business_info && (waba.owner_business_info.name + " (" + waba.owner_business_info.id + ")")) || "not shown"));
    else L.push("WhatsApp account: not readable." + meta(waba));
    const assigned = await get("/" + WABA + "/assigned_users?business=" + BIZ + "&fields=name,tasks");
    if (assigned && Array.isArray(assigned.data) && assigned.data.length) L.push("People assigned to the WhatsApp account: " + assigned.data.map((u) => u.name + (u.tasks ? " [" + u.tasks.join(", ") + "]" : "")).join("; "));
    L.push("Log in at facebook.com/login/identify with the email of an ADMIN above.");
    await send(L.join("\n"));
    return true;
  }
  if (sub === "profile") {
    let j = null;
    try { j = await (await fetch(deps.graph + "/" + deps.pid + "/whatsapp_business_profile?fields=about,address,description,email,websites,vertical,profile_picture_url", { headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN } })).json(); } catch (e) {}
    if (!j || j.error) { await send("Could not read the profile." + meta(j)); return true; }
    const p = (j.data && j.data[0]) || {};
    await send("This number's WhatsApp business profile:\nAbout: " + (p.about || "(empty)") + "\nDescription: " + (p.description || "(empty)") + "\nEmail: " + (p.email || "(empty)") + "\nWebsites: " + ((p.websites || []).join(", ") || "(none)") + "\nAddress: " + (p.address || "(empty)") + "\nCategory: " + (p.vertical || "(none)") + "\nPhoto: " + (p.profile_picture_url ? "set" : "none") + "\nTell me what each should say and I will set them.");
    return true;
  }
  await send("Unknown lab command.\n" + LAB_HELP); return true;
}

// v461 - a video sent to the desk
export const VIDEO_KEEP_MAX = 25 * 1024 * 1024, WA_VIDEO_MAX = 16 * 1024 * 1024;
const mb = (b) => (b / 1048576).toFixed(1);
const origin0 = (deps, env) => (deps.origin ? deps.origin(env) : "");
export function deskVideoOf(msg) {
  if (!msg) return null;
  if (msg.type === "video" && msg.video && msg.video.id) return { id: msg.video.id, caption: String(msg.video.caption || "") };
  const d = msg.type === "document" && msg.document;
  if (d && d.id && (/^video\//i.test(String(d.mime_type || "")) || /\.(mp4|mov|m4v)$/i.test(String(d.filename || "")))) return { id: d.id, caption: String(d.caption || "") };
  return null;
}
// v462 - caption choices as buttons. "Same as last" only when there is a last one; Status may go with no caption.
async function videoBytes(env, key) {
  let last = null; try { last = JSON.parse((await env.MEETINGS.get("desk_vid_last")) || "null"); } catch (e) {}
  return last && last.key === key ? last.bytes : 0;
}
async function captionChoices(env, deps, to, what, key) {
  const known = what === "reel" ? REEL_CAPTIONS[key] : STATUS_PUBLIC[key];
  if (known) return videoAction(env, deps, to, what, deps.origin(env) + "/video/" + key, key, await videoBytes(env, key), known);
  const last = await env.MEETINGS.get("desk_last_cap_" + what);
  const b = [{ id: "dc:ai:" + what + ":" + key, title: "Write it for me" }];
  if (last) b.push({ id: "dc:last:" + what + ":" + key, title: "Same as last" });
  b.push(what === "status" && !last ? { id: "dc:none:status:" + key, title: "No caption" } : { id: "dc:type:" + what + ":" + key, title: "I'll type it" });
  await deps.raw(env, { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button",
    body: { text: (what === "reel" ? "Instagram caption" : "Status caption") + " for " + key + "?" + (last ? "\n\nLast one: " + last.slice(0, 300) : "") }, action: { buttons: b.map((x) => ({ type: "reply", reply: x })) } } }, "caption-ask");
}
async function draftCaption(env, deps, what) {
  if (!deps.llm) return "";
  const sys = "You write captions for DigitAlchemy, a Dubai construction-technology company (digital inspections with partner GoCanvas, drawings and models, site progress, the property market in one live view; tagline: Complexity into clarity). Audience: contractors, developers, consultants. Plain, confident, no hype, no emojis, never name any AI tool or model. Reply with the caption only.";
  const ask = what === "reel" ? "An Instagram Reel caption: two or three short sentences, the tagline, then 5 to 7 hashtags including #GoCanvas and #DigitAlchemy." : "A WhatsApp Status caption: one or two short sentences, under 200 characters, ending with Complexity into clarity.";
  try { const c = String((await deps.llm(env, sys, ask, 400)) || "").trim().replace(/^["']|["']$/g, ""); return c.slice(0, what === "reel" ? 2000 : 300); } catch (e) { return ""; }
}
async function videoAction(env, deps, to, what, link, key, bytes, text) {
  const send = (s) => deps.send(env, s);
  if (text && what !== "broadcast") { try { await env.MEETINGS.put("desk_last_cap_" + what, text); } catch (e) {} }
  if (what === "reel") {
    const caption = text || REEL_CAPTIONS[key] || "";
    if (!caption) { await captionChoices(env, deps, to, "reel", key); return true; }
    await env.MEETINGS.put("desk_reel_pending", JSON.stringify({ url: link, caption, at: Date.now() }), { expirationTtl: 2 * 86400 });
    await deps.raw(env, { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", body: { text: "Reel for Instagram (@digitalabbotuae), caption:\n\n" + caption.slice(0, 900) }, action: { buttons: [{ type: "reply", reply: { id: "dr:ok", title: "Post it" } }, { type: "reply", reply: { id: "dc:ai:reel:" + key, title: "Rewrite caption" } }, { type: "reply", reply: { id: "dr:no", title: "Cancel" } }] } } }, "reel-buttons");
    return true;
  }
  if (what === "status") {
    if (bytes > WA_VIDEO_MAX) { await send("Saved, but it is " + mb(bytes) + " MB and WhatsApp sends videos only up to 16 MB, so I cannot send it back for Status. Download it at 540p and send it again. (It can still go to Instagram: reel " + link + " : <caption>)"); return true; }
    const r = await deps.raw(env, statusVideoPayload(to, link, text), "status-video");
    if (r && r.error) await send("Could not send the clip." + meta(r)); else await send(STATUS_CAPTION);
    return true;
  }
  // broadcast: remembered as the campaign video; nothing is sent to anyone from here
  await env.MEETINGS.put("desk_broadcast_video", JSON.stringify({ key, link, bytes, at: Date.now() }));
  await send("Saved as the broadcast video (" + key + (bytes ? ", " + mb(bytes) + " MB" : "") + ")." + (bytes > WA_VIDEO_MAX ? " Note: it is over WhatsApp's 16 MB, so it must be re-sent at 540p before it can go out." : "") + " Nothing is sent to anyone until you approve the list.");
  return true;
}

// v460 - one step of an approved reel: start or continue the upload, publish when Instagram has finished processing. A webhook only waits
// a few polls; the minute tick (deskReelTick) carries on. "Still processing" is silent; posted and refused are told to the desk once.
async function reelStep(env, p, deps, polls) {
  const save = (ttl) => env.MEETINGS.put("desk_reel_pending", JSON.stringify(p), { expirationTtl: ttl || 2 * 86400 });
  const r = await deps.reel(env, { approved: true, videoUrl: p.url, caption: p.caption, container: p.container, polls,
    onContainer: async (id) => { p.container = id; await save(); } });
  if (r.container) p.container = r.container;
  if (r.ok) { p.posted = true; p.id = r.id; p.permalink = r.permalink; await save(7 * 86400); await deps.send(env, "Posted to Instagram." + (r.permalink ? " " + r.permalink : "")); return; }
  if (/still processing/.test(r.err || "")) { p.tries = (p.tries || 0) + 1; if (p.tries > 20) { p.approved = false; await deps.send(env, "Instagram is still processing after 20 minutes. Not posted; tap Post it to try again."); } await save(); return; }
  p.approved = false; if (!/could not process|container refused/.test(r.err || "")) {} else p.container = undefined;
  await save(); await deps.send(env, "Not posted: " + r.err + ". Tap Post it to try again.");
}
export async function deskReelTick(env, deps) {
  let p = null; try { p = JSON.parse((await env.MEETINGS.get("desk_reel_pending")) || "null"); } catch (e) {}
  if (!p || p.posted || !p.approved || !deps.reel) return;
  await reelStep(env, p, deps, 2);
}

// up to 3 recent desk pictures (the desk's own generated post pictures), as public /ig_media links
async function labPictures(env, origin) {
  const out = [];
  let ix = []; try { ix = JSON.parse((await env.MEETINGS.get("postplan_index")) || "[]"); } catch (e) {}
  for (const id of ix.slice().reverse()) {
    let p = null; try { p = JSON.parse((await env.MEETINGS.get("postplan_" + id)) || "null"); } catch (e) {}
    for (const s of (p && p.slides) || []) if (s.img_key && out.length < 3) out.push(origin + "/ig_media/" + s.img_key);
    if (out.length >= 3) break;
  }
  return out;
}
