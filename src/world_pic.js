// v164 - THE VERSUS PICTURE, MADE THE WAY THE MORNING PICTURES ARE MADE.
//
// Kendall, 17 Sep 2026: "this should be using the same model that we're using for the morning thing... there's kind of a
// process that we go through and it gives her some control over the picture that is made. Deep dive into that and adjust
// making a picture to that a bit."
//
// WHAT THE MORNING DOES, and what this file brings across. She picks an angle, and before a penny is spent she is asked
// which backdrop, what time of day and which photo of her; then she is shown, in her own language, the picture that is
// about to be made, with Make it and Change it. Change it takes one line in her words and that line overrides everything
// above it. Nothing is charged until she taps Make it. The Versus picture had none of that: one tap, one fixed prompt,
// charged on the spot, no way to steer it and no way to stop it.
//
// THREE THINGS WERE WRONG, not one.
//   1. It called the OLD image model by name, hard-coded, ignoring SCENE_MODEL - the setting Kendall moved azimuth-2 to on
//      13 Sep. The morning pictures had been on the new model for four days; this one had never left the old one.
//   2. It asked the image service to DRAW THE TWO PRICES as text inside the picture. The morning work refuses to do this
//      on purpose - its own note says the figure "is always drawn by us and never redrawn by the image service" - because
//      image models garble digits. That prompt could put a wrong Monaco price on a public Instagram post under her name,
//      and the approve-from-WhatsApp step would not catch it: she would be approving a number she has no reason to doubt.
//      So the plate is made WORDLESS here, and the figures are set on top afterwards by the card engine, from src/world.js.
//   3. She had no say in it at all.
//
// TWO SHAPES, because Kendall asked for both (17 Sep 2026): "put me in it" is her standing in Dubai the way the morning
// scene cards place her, and "just the two cities" is the split frame. The comparison itself always lives in the type we
// draw, never in the picture - so nothing in either shape has to be invented, and neither can misquote a price.
import { worldCity, worldFacts, USD_AED } from "./world.js";

// The same five times of day the morning offers, by the same ids, so one question is learned once. The morning's own
// SCENE_TIMES carries her lighting; these are the lines for a city seen wide rather than a person lit in a scene.
export const WORLD_LIGHT = {
  em: { say: "Early morning, soft low sun", sky: "early morning - a low sun, long gentle shadows, a pale fresh sky, the air still clear" },
  md: { say: "Midday, bright sun and a clear sky", sky: "midday - bright sun high in a clear sky, crisp short shadows, clean vivid colour" },
  la: { say: "Late afternoon, warm golden light", sky: "late afternoon - a warm low sun, long soft shadows, a gentle golden haze" },
  ss: { say: "Sunset, a warm golden glow", sky: "sunset - the sun just above the horizon, a warm golden glow and soft haze across the whole frame" },
  nt: { say: "Night, the lights on under a deep blue sky", sky: "night - a deep blue sky, lit windows and warm street lamps, reflections on the water" },
};
const lightOf = (tid) => WORLD_LIGHT[tid] || WORLD_LIGHT.la;

// What each city is recognisably itself by. Landmarks only - a skyline nobody can place is not a comparison anyone reads.
const LANDMARK = {
  monaco: "the Monte Carlo harbour, yachts moored below the rock and the casino terraces above",
  hongkong: "the Victoria Harbour skyline seen from the water, the peak behind it",
  geneva: "the Jet d'Eau on Lake Geneva, the old town and the Alps beyond",
  newyork: "the Manhattan skyline, the Empire State Building standing clear of it",
  paris: "the Eiffel Tower over Haussmann rooftops and their zinc chimneys",
  london: "the Palace of Westminster and Big Ben along the Thames",
  sydney: "the Sydney Opera House and the Harbour Bridge across the water",
  singapore: "Marina Bay Sands and the bay towers behind it",
  miami: "the South Beach art deco front, palms along Ocean Drive",
  mumbai: "Marine Drive curving along the bay, the Gateway of India at its end",
};

// WHERE SHE STANDS, for "put me in it". Dubai, always - she is a Dubai broker and the comparison is carried by the type,
// so nothing here has to pretend she was somewhere she was not. Six, the way the morning offers eight: enough to choose
// from, few enough to read on a phone.
export function worldBackdrops() {
  return [
    { id: "A", name: "Skyline, across water", note: "Towers over the creek or marina",
      place: "the Dubai skyline across open water - towers rising beyond calm water, a broad promenade in the near ground" },
    { id: "B", name: "Downtown", note: "The Burj Khalifa behind you",
      place: "Downtown Dubai with the Burj Khalifa rising behind, the boulevard and its planting in the near ground" },
    { id: "C", name: "Balcony view", note: "Looking out from a furnished balcony",
      place: "a furnished apartment balcony high over Dubai - pale stone floor, a planter and a low chair, the city beyond the rail" },
    { id: "D", name: "Marina walk", note: "Boardwalk, boats, towers behind",
      place: "the Dubai Marina promenade - boardwalk and railing along the water, moored boats, the towers of the marina behind" },
    { id: "E", name: "Palm frond", note: "Villas, water, the sea beyond",
      place: "a frond of the Palm Jumeirah - low villas along the water, private moorings, the open sea and the skyline beyond" },
    { id: "F", name: "Lobby", note: "Inside the entrance, warm and quiet",
      place: "the residential lobby of a new Dubai tower - stone floor, warm timber and brass, deep seating, tall glass out to a planted forecourt" },
  ];
}
export const worldBackdrop = (id) => worldBackdrops().find(o => o.id === String(id || "").toUpperCase()) || null;

// THE PLATE, WORDLESS. Both shapes start here. Not one word, digit, sign or logo is asked of the image service: every
// figure on the finished card is drawn afterwards by the card engine from src/world.js.
const NO_WORDS = "No text, no words, no numbers, no signs, no logos and no watermarks anywhere in the image.";

// "Just the two cities": the split frame. Same composition as before - Dubai left, the other city right, a gold divider -
// but now lit to her chosen hour and carrying no type at all.
export function worldPlatePrompt(cityKey, tid, extra) {
  const c = worldCity(cityKey); if (!c || c.base) return null;
  const L = lightOf(tid);
  const out = ["Editorial split-frame illustration for a property broker's social post, square, no people."];
  out.push("Left half: Dubai - the Burj Khalifa and the Palm Jumeirah.");
  out.push("Right half: " + c.name + " - " + (LANDMARK[cityKey] || (c.name + "'s skyline")) + ".");
  out.push("Both halves are seen at the same hour, " + L.sky + ", so the two cities are compared in the same light.");
  out.push("A thin vertical gold line divides the two halves down the exact centre.");
  out.push("Palette: warm beige and gold dominant, deep green as the only accent. Flat, painterly, premium.");
  out.push("Leave the lower third of the frame calm and uncluttered, so type can be set over it afterwards.");
  out.push(NO_WORDS);
  return withChanges(out, extra);
}

// "Put me in it": the scene she stands in, made wordless and empty of people, for the card engine to place her over -
// the same way a morning scene card is built, so the two look like they came from the same hand.
export function worldScenePrompt(cityKey, option, tid, extra) {
  const c = worldCity(cityKey); if (!c || c.base) return null;
  const opt = option && option.place ? option : worldBackdrops()[0];
  const L = lightOf(tid);
  const out = ["A realistic photograph of " + opt.place + ", empty of people."];
  out.push("The light is " + L.sky + ".");
  out.push("Eye-level camera, the composition open on the right so a standing figure can be placed there later.");
  out.push("Natural, lived-in and premium rather than promotional.");
  out.push(NO_WORDS);
  return withChanges(out, extra);
}

// Her changes win over everything above them - the rule the morning prompt already follows, kept word for word so the
// two behave the same when she asks for the same thing.
function withChanges(out, extra) {
  const ch = (extra || []).map(x => String(x || "").trim()).filter(Boolean);
  if (ch.length) {
    out.push("Where a change below conflicts with anything above, follow the change.");
    for (const t of ch) { const s = t.charAt(0).toUpperCase() + t.slice(1); out.push("Change: " + (/[.!?]$/.test(s) ? s : s + ".")); }
  }
  return out.join(" ");
}

// WHAT SHE IS SHOWN BEFORE IT IS MADE. Her words, not the prompt: the morning shows her the picture in plain English and
// so does this. A prompt she cannot read is not a choice she can make.
export function worldPicSay(cityKey, mode, option, tid, extra) {
  const c = worldCity(cityKey); if (!c || c.base) return "";
  const L = lightOf(tid);
  let s;
  if (mode === "me") {
    const opt = option && option.place ? option : worldBackdrops()[0];
    s = "You, standing in " + opt.place + ". " + L.say + ". Your face, hair and outfit exactly as in your photo."
      + "\n\nAcross the top: DUBAI vs " + c.name.toUpperCase() + ", with both prices underneath.";
  } else {
    s = "Dubai on the left, " + c.name + " on the right, a thin gold line down the middle. " + L.say + ". No people."
      + "\n\nAcross the top: DUBAI vs " + c.name.toUpperCase() + ", with both prices underneath.";
  }
  s += "\nI draw the prices myself, so they are always the published ones.";
  const ch = (extra || []).map(x => String(x || "").trim()).filter(Boolean);
  if (ch.length) s += "\n\n" + ch.map(x => "Your change: " + x).join("\n");
  return s;
}

// THE WORDS WE DRAW. These go to the card engine, which sets them in real type over the finished picture - so the two
// prices on a public post are the fact base's own, never the image service's reading of them.
export function worldCardFields(cityKey) {
  const c = worldCity(cityKey); if (!c || c.base) return null;
  const f = worldFacts(cityKey, "sqft"); if (!f) return null;
  const aed = (n) => "AED " + Number(n).toLocaleString("en-US");
  // Monaco is not in the world cities index, so it must not be credited to it - the same correction the caption carries.
  const src = c.price_source ? "Savills Monaco spotlight and IMSEE, 2025" : (f.sources.prices.name + ", " + f.sources.prices.period);
  return {
    n: 0,
    masthead: "Dubai vs " + c.name,
    hook: "Dubai or " + c.name + "? Expensive compared to what.",
    figure: aed(f.dubai.prime_aed_per_sqft) + " vs " + aed(f.other.prime_aed_per_sqft),
    source: "prime, a square foot · " + src,
  };
}

// The size each shape is made at. The split frame is square because both halves must be seen; she is made tall, the way
// every morning scene card is, because a person in a 1:1 frame is either cropped or lost.
export const worldPicSize = (mode) => (mode === "me" ? "1024x1536" : "1024x1024");

export { USD_AED };
