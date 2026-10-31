// v678 (Kendall, 31 Oct 2026: "the backdrops should be specific to the ones that she chose ... five real estate backdrops ... general news
// backdrops ... EQ or emotional, those should be different backdrops ... she should always have the option to put in her own text ...
// you have five ideas, you have 10 backdrops").
// THREE CATALOGUES OF TEN, one per morning list. Before v678 every "Picture with you" drew from the same eight real-estate scenes
// (skyline, lobby, pool deck ...), so an emotional-intelligence idea put her in front of the Burj Khalifa. A WhatsApp list holds ten
// rows, so the ten scenes fill it and her own scene is a typed line (the list says so; index.js arms fbgown_ when it sends the list).
// Each scene carries its place (the prompt the image model is given, Dubai where it belongs), its pose (how she stands in it) and the
// light it suits by default; her time-of-day choice still overrides the light.
// Option "X" stays in every catalogue so the typed-line path (fbgown_) finds it; it is never a row.
const OWN = { id: "X", name: "Your scene", note: "Tell me the scene in a line", own: true, place: "", pose: "" };
const dubai = (area) => (area ? "Dubai, " + area : "Dubai");

export function propertyBackdrops(area) {
  const where = dubai(area), A = area || "Dubai";
  return [
    { id: "A", name: "Skyline, blue hour", note: "Towers across water, lights just on",
      place: "The " + where + " skyline seen across open water or a wide boulevard at blue hour - towers in silhouette with their lights just on, calm water or empty road in the foreground",
      pose: "standing at the railing, one hand resting on it, turned three-quarters towards the camera, looking out towards the towers" },
    { id: "B", name: "Street level", note: "A real residential street, lived-in",
      place: "A residential street in " + where + " at eye level - low-rise and mid-rise buildings, mature planting along the pavement, parked cars, a shaded walkway, ordinary and lived-in rather than promotional",
      pose: "walking along the pavement towards the camera, mid-stride, relaxed" },
    { id: "C", name: "Balcony view", note: "Looking out from a furnished balcony",
      place: "The view out from a furnished apartment balcony in " + where + " - pale stone floor, a planter and a low chair in the near corner, the community and skyline beyond the rail",
      pose: "sitting in the low chair on the balcony, legs crossed, turned slightly towards the camera" },
    { id: "D", name: "Lobby", note: "Inside the entrance, warm and quiet",
      place: "The residential lobby of a new building in " + where + " - stone floor, warm timber and brass, deep seating, tall glass out to a planted forecourt, quiet and empty",
      pose: "sitting on the deep seating in the lobby, relaxed, turned slightly towards the camera" },
    { id: "E", name: "Pool deck", note: "Podium deck, loungers, late sun",
      place: "The podium pool deck of a residential tower in " + where + " - still water, loungers and umbrellas, planting along the edge, the surrounding community beyond, late afternoon",
      pose: "sitting on the edge of a lounger by the pool, relaxed, looking towards the camera" },
    { id: "F", name: "Handover site", note: "Under construction, cranes up",
      place: "A residential development under construction in " + A + ", Dubai - topped-out concrete frame with cranes still up, hoarding and site road in the foreground, the finished community behind",
      pose: "standing on the site road in front of the hoarding, looking towards the camera" },
    { id: "G", name: "Villa street", note: "Low-rise, gardens, wide pavement",
      place: "A villa street in " + A + ", Dubai - two-storey homes set back behind low walls and mature gardens, a wide pavement and street trees, cars on the drives, early morning",
      pose: "walking along the wide pavement past the gardens, mid-stride, relaxed" },
    { id: "H", name: "Waterfront walk", note: "Promenade, water, towers behind",
      place: "A waterfront promenade in " + A + ", Dubai - boardwalk and railing along the water, planting and benches, moored boats or open water across the middle distance, the towers of the community behind",
      pose: "walking along the boardwalk beside the railing, mid-stride, relaxed" },
    { id: "I", name: "Show apartment", note: "Furnished, floor-to-ceiling glass",
      place: "A furnished show apartment in " + where + " - open-plan living room, pale stone floor, a long sofa, floor-to-ceiling glass with the community beyond, soft daylight, nothing promotional in view",
      pose: "standing by the glass with one hand on the back of the sofa, turned towards the camera" },
    { id: "J", name: "Metro platform", note: "Red line station, train arriving",
      place: "A Dubai Metro station platform in " + A + ", Dubai - the curved glass and steel canopy, platform screen doors, a train just arriving, commuters at a distance, clean and bright",
      pose: "standing on the platform near the screen doors, bag on her shoulder, looking towards the camera" },
    OWN,
  ];
}
export function generalBackdrops() {
  return [
    { id: "A", name: "Creek and abras", note: "Old Dubai, water taxis, the souk side",
      place: "The Dubai Creek waterfront at Bur Dubai - wooden abras crossing, the old souk facades and wind towers behind, dhows moored along the quay, everyday life",
      pose: "standing on the quay by the abra station, turned three-quarters towards the camera" },
    { id: "B", name: "Metro carriage", note: "Inside, city sliding past the window",
      place: "Inside a Dubai Metro carriage - the pale interior, the wide window with the Sheikh Zayed Road towers sliding past, a few seated commuters at a distance",
      pose: "standing holding the overhead rail, turned towards the camera, relaxed" },
    { id: "C", name: "Airport terminal", note: "Departures hall, light and movement",
      place: "The departures hall of Dubai International Airport - tall columns, polished floor, the flight boards and the ceiling lights, travellers at a distance with their cases",
      pose: "walking with a small cabin case towards the camera, mid-stride" },
    { id: "D", name: "Gallery", note: "White walls, one big artwork",
      place: "A contemporary art gallery in Dubai, Alserkal Avenue style - white walls, concrete floor, one large abstract artwork on the wall, a skylight, quiet",
      pose: "standing a little to the side of the artwork, looking back towards the camera" },
    { id: "E", name: "Stadium", note: "Track and stands, event day",
      place: "The edge of a running track inside a Dubai stadium on an event day - the green infield, the stands rising behind, flags, floodlights, bright and open",
      pose: "standing at the trackside, turned towards the camera, relaxed and smiling" },
    { id: "F", name: "Café terrace", note: "Morning coffee, the paper open",
      place: "A café terrace in Dubai in the morning - a small marble table with a coffee and a folded newspaper, rattan chairs, planting, the street and a few passers-by beyond",
      pose: "sitting at the table with the coffee, the newspaper open, looking up towards the camera" },
    { id: "G", name: "Financial district", note: "DIFC gate and towers",
      place: "The Gate building and plaza of the Dubai International Financial Centre - stone arches, the towers behind, people in business dress at a distance, clear morning",
      pose: "walking across the plaza towards the camera, mid-stride, a folder under one arm" },
    { id: "H", name: "Beach promenade", note: "Kite Beach, runners and bikes",
      place: "The Kite Beach running track in Dubai - the rubber track, the sand and sea to one side, palms, the skyline far behind, runners and cyclists at a distance",
      pose: "walking along the track towards the camera, relaxed" },
    { id: "I", name: "Expo plaza", note: "Al Wasl dome, wide open space",
      place: "The Al Wasl plaza at Expo City Dubai - the great steel lattice dome, the gardens and the walkways beneath it, visitors at a distance, bright and clean",
      pose: "standing under the edge of the dome, turned towards the camera" },
    { id: "J", name: "Newsroom desk", note: "Screens, headlines, a studio light",
      place: "A modern newsroom in Dubai - a long desk with screens showing city skylines and charts, a studio light, glass walls with the office beyond, polished and current",
      pose: "standing at the desk with one hand on it, turned towards the camera" },
    OWN,
  ];
}
export function eiBackdrops() {
  return [
    { id: "A", name: "Zen garden", note: "Raked gravel, stone, stillness",
      place: "A Japanese-style zen garden at dawn - raked pale gravel, three dark stones, a low wooden walkway, bamboo and a single maple, soft mist, stillness",
      pose: "standing on the wooden walkway, hands loosely together, calm, turned three-quarters towards the camera" },
    { id: "B", name: "Desert sunrise", note: "Dunes, first light, long shadows",
      place: "The red dunes outside Dubai at sunrise - a ridge of soft sand, the sun just over the horizon, long gentle shadows, a few ghaf trees far away, the sky pale gold",
      pose: "standing on the ridge, looking out towards the sun, turned slightly towards the camera" },
    { id: "C", name: "Workshop room", note: "At the front, a small group listening",
      place: "A bright training room in Dubai - a whiteboard with a few hand-drawn circles and no readable words, a small group of adults at tables listening, tall windows, warm daylight",
      pose: "standing at the front beside the whiteboard, one hand open as she speaks, turned towards the camera" },
    { id: "D", name: "Café one-to-one", note: "Across a small table, listening",
      place: "A quiet café corner in Dubai - a small round table with two coffees, warm timber, a window with soft light, one other person seen from behind across the table",
      pose: "sitting at the table, leaning in slightly, listening, her face turned towards the camera" },
    { id: "E", name: "Morning desk", note: "By a window, notebook open",
      place: "A calm home desk by a tall window in Dubai in the early morning - an open notebook and a pen, a cup of tea, a plant, the city soft and out of focus outside",
      pose: "sitting at the desk with the notebook open, pen in hand, turned towards the camera" },
    { id: "F", name: "Meeting room", note: "Mid-conversation, glass walls",
      place: "A modern meeting room in Dubai - a long table, glass walls with the office beyond, two or three colleagues seen partly, a laptop closed, daylight",
      pose: "standing at the head of the table, hands resting on the back of a chair, mid-sentence, turned towards the camera" },
    { id: "G", name: "Park walk", note: "Trees, a path, early light",
      place: "A green park path in Dubai in the early morning - mature trees overhead, a curving path, lawn either side, a few walkers far away, soft light through the leaves",
      pose: "walking along the path towards the camera, unhurried" },
    { id: "H", name: "Beach at dawn", note: "Empty sand, calm sea",
      place: "An empty Dubai beach at dawn - smooth sand, the sea flat and pale, the first light on the water, the skyline faint and far along the coast",
      pose: "standing at the water's edge, barefoot on the sand, looking towards the camera" },
    { id: "I", name: "Breathing room", note: "Yoga studio, mats, soft light",
      place: "A calm yoga studio in Dubai - pale timber floor, a few rolled mats, floor cushions, a large window with sheer curtains and soft morning light, plants",
      pose: "sitting cross-legged on a mat, back straight, hands resting on her knees, eyes open, facing the camera" },
    { id: "J", name: "Stage", note: "A microphone, a soft spotlight",
      place: "A small conference stage in Dubai - a standing microphone, a soft warm spotlight, a dark backdrop with no words, the first rows of the audience in soft shadow",
      pose: "standing beside the microphone, one hand raised a little as she speaks, turned towards the camera" },
    OWN,
  ];
}
// setId: "property" (default), "general", "ei". withOwn: keep the X option in the returned list (the typed-line path needs it)
export function backdropsFor(setId, angle, area, withOwn) {
  const all = setId === "ei" ? eiBackdrops() : setId === "general" ? generalBackdrops() : propertyBackdrops(area);
  return withOwn ? all : all.filter((o) => !o.own);
}
export const backdropRows = (n, opts) => opts.filter((o) => !o.own).slice(0, 10).map((o) => ({ id: "fbg:" + n + ":" + o.id, title: o.name, description: o.note }));
export const BACKDROP_OWN_LINE = "Or type your own scene in a line and I'll build the picture around it.";
