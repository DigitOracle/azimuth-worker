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

export const LAB_HELP = "Desk lab: every new WhatsApp feature, tried here first.\n" +
  "brief: the client brief, asked in the chat\nbrief form: the client brief as a form (test only)\nlab carousel: swipeable cards\nlab list: a list menu\nlab link: a link button\nlab location: share your location\n" +
  "lab typing: read ticks and typing\nlab qr: a QR code that opens this chat with a message typed\nlab profile: this number's business profile\n" +
  "lab setup momo template <account id>: submit the Momo day message to Meta";

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
export const typingPayload = (messageId) => ({ messaging_product: "whatsapp", status: "read", message_id: messageId, typing_indicator: { type: "text" } });

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
