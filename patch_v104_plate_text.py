"""v104 (8 Sep 2026) - the background plate carries the figure.

Naj's report (8 Sep, 07:27): the plate prompt Azimuth sends after every draft produces a picture with no
data on it. That was v83's intent (a clean plate she overlays her twin on; the data rode on the separate
angle card) - but the card renderer had been dead since 5 Sep, so she was left with an empty plate. The
plate now renders THE DIGEST masthead, the figure, the headline and the source as editorial text in the
RIGHT two thirds, and still keeps the left third clear for her avatar. Angles without a figure keep the
old text-free plate.
"""
import io, re, sys
P = r"C:\Dev\azimuth-worker\src\index.js"
src = io.open(P, encoding="utf-8").read()

START = "// v83 — BACKGROUND PLATE prompt:"
END = "\nfunction visualPromptBlock(angle) {"
a = src.index(START); b = src.index(END)
assert src.count(START) == 1 and src.count(END) == 1

NEW = r'''// v83 — BACKGROUND PLATE prompt: she composites her own digital twin and outfit on top, so the plate must contain NO people
// and must leave her somewhere to stand. Light direction, eye level and lens are stated so the overlay sits believably.
// Everything she needs is inside the one code block — she copies it whole, pastes it into ChatGPT, and gets the plate back.
// v104 (8 Sep) — the plate CARRIES THE DATA. Naj: "it gives me an image without the data or information". The figure, the
// headline and the source are now rendered as editorial text in the RIGHT two thirds (masthead THE DIGEST), verbatim and
// once each, while the LEFT third stays clear for her avatar. An angle with no figure keeps the old text-free plate.
function bgPromptBlock(angle, place) {
  let H = String(angle.hook || "").replace(/"/g, "'").replace(/\s+/g, " ").trim();
  if (H.length > 120) { const cut = H.slice(0, 120); H = cut.slice(0, Math.max(cut.lastIndexOf(" "), 80)).replace(/[\s,;:—–-]+$/, ""); }   // image models garble long lines
  const F = String(angle.figure || "").replace(/"/g, "'").trim();
  const S = String(angle.source || "").replace(/"/g, "'").replace(/\s+/g, " ").trim();
  const camp = !!angle.campaign;
  const withText = !!(F || H);
  const where = place || (camp ? "The Valley by Emaar, Dubai — a low-rise family community on the Al Ain road: sand-coloured townhouses with dark window frames, wide green lawns, young trees, a community sports court, a shaded pergola walk, open desert sky at the horizon"
                              : "Dubai — the skyline or the street that matches the subject of the headline below, real and specific, never a generic city");
  const strings = ['"THE DIGEST"'].concat(F ? ['"' + F + '"'] : [], H ? ['"' + H + '"'] : [], S ? ['"' + S + '"'] : []).join(", ");
  return "🎨 *" + (withText ? "Cover plate" : "Background plate") + " — paste this whole block into ChatGPT (make an image)*\n" +
    (withText ? "_The figure and the headline are ON the picture, in the right two thirds. The left third is left clear for your own avatar and outfit._\n\n```"
              : "_You then drop your own avatar and outfit on top. The plate has nobody in it and a clear space on the left for you._\n\n```") +
    "Create a photorealistic BACKGROUND PLATE" + (withText ? " WITH EDITORIAL TEXT" : "") + " for a social post. This is a plate, not a finished picture: a real person will be composited into the LEFT THIRD afterwards, so follow the empty-space, lighting" + (withText ? " and text-placement" : "") + " rules exactly.\n\n" +
    "SIZE: make it 1080x1920 (vertical 9:16) first. I will then ask you for the same plate at 1920x1080 (16:9).\n\n" +
    "PLACE: " + where + ".\n\n" +
    "THE PICTURE: shot on a full-frame camera with a 35mm lens at f/4, camera at standing eye level (about 1.6 m from the ground), horizon level and roughly a third up the frame. Late afternoon, about an hour before sunset: warm low sun coming from the RIGHT of frame at a shallow angle, long soft shadows falling to the LEFT, gentle haze in the distance, no harsh midday contrast. Natural colour, no filter, no HDR crunch, no vignette.\n\n" +
    "COMPOSITION — this matters most: leave the LEFT THIRD of the frame open and uncluttered as a standing area — clean ground, no furniture, no signage, no plants, no text and no strong lines crossing it, so a person can be placed there later. Put the visual interest" + (withText ? " and all of the text" : "") + " in the right two thirds. Keep the ground plane visible and continuous across the bottom of the frame so a composited figure has somewhere to stand and cast a shadow.\n\n" +
    "ABSOLUTELY NO PEOPLE anywhere in the frame — no figures, no silhouettes, no crowds, no people in windows or in the far distance. No animals. No logos, no brand names, no watermarks, no signage with words" + (withText ? ", and no text of any kind other than the strings listed under TEXT below.\n\n" : ", no text, no captions, no numbers.\n\n") +
    (withText ?
      "TEXT — this is the point of the picture, do not leave it out. All of it sits in the RIGHT two thirds and never crosses into the left third. Across the top right, the masthead \"THE DIGEST\" small, beige #E8DCC8, uppercase, wide letter-spacing. Below it a stacked cover-line, upper-right to mid-right: " +
      (F ? "the figure \"" + F + "\" set LARGE in warm gold #C5A56A, bold condensed sans-serif; " : "") +
      (H ? "the headline \"" + H + "\" in smaller beige #E8DCC8 sans-serif, over a soft dark translucent band so it stays legible on the photograph; " : "") +
      (S ? "under a thin gold rule the kicker \"" + S + "\" small in beige. " : "") +
      "Render " + strings + " verbatim, exactly once each, perfectly legible — no extra characters, no duplicated or garbled text, no invented words or numbers. Keep the ground line under the text clear.\n\n"
      : "") +
    "NEGATIVE: no CGI or video-game look, no plastic sheen, no over-saturated sky, no lens flare, no tilt-shift, no fisheye, no illustration or painting style, no collage, no floating objects, no duplicated or warped architecture, no impossible geometry" + (withText ? ", no gibberish text" : "") + "." +
    (withText ? "" : "\n\nCONTEXT (do not render any of this as text — it is only so you choose the right place and mood): the post says \"" + H + "\", the figure quoted is " + F + ", sourced from " + S + ".") +
    "```\n\n" +
    "👉 Ask ChatGPT “*now the same plate at 1920x1080*” for the LinkedIn version. Then place your avatar in the left third, feet on the ground line, with the light on your right cheek so it matches the sun in the plate." +
    (F ? " Before posting, check the figure reads exactly “" + F + "”." : "");
}
'''
out = src[:a] + NEW + src[b:]
io.open(P, "w", encoding="utf-8", newline="\n").write(out)
print("patched: bgPromptBlock replaced,", len(out) - len(src), "bytes delta")
