# Land Scanner: UX decisions (v691, 2 Nov 2026)

**What it is for.** *Which plots have nothing on them, and why do we think so?* The answer is sorted into four groups a non-technical reader can say out loud. The page also states what we do **not** know: whether a plot is for sale.

**How you get there.** MORE, then LAND SCANNER (tap 1), then a group card (tap 2), then a plot card opens its Plot Passport (tap 3). Filters are optional and add no required taps.

## Research (sources)
- Land and parcel tools (Regrid, LandVision, Reonomy) open on a map plus a filtered list. Their filters are land use, size and location, and the parcel record is one tap away. We already have the map: the developers map's *Empty plots* layer, so the scanner links to it ("See the empty plots on the map", which opens `/developers_map?empty=all`) instead of building a second map.
- Counts before lists: summary cards with counts let people pick the slice that matters before they scan rows ([NN/g, Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)).
- Mobile filters: a few visible dropdowns, a live result count, and an empty state with a way out ([NN/g, Mobile Faceted Search](https://www.nngroup.com/articles/mobile-faceted-search/); [NN/g, Applying Filters](https://www.nngroup.com/articles/applying-filters/)).
- Lead products such as Glenigan and Barbour ABI group projects by stage ([Glenigan](https://www.glenigan.com)). We group plots by *what the records say*, never by what we would like them to say.

## Decisions
1. **Four big group cards with counts.** Each card is a 2-up card at 375 px and carries an icon, the count, the group name and one plain sentence:
   - *No development activity found*
   - *Registered project, no verified start*
   - *Permits suggest upcoming work*. The card itself says a permit is not proof that work has begun.
   - *Looked empty, newer records disagree*. This is the stale-register problem from 1 Nov (8,932 of 9,716 old "empty" plots were under active projects), shown openly and not hidden.
2. **The list appears only after you pick a group.** Until then the page shows a prompt ("Pick a group above"), so the first screen is never a wall of rows. The list is sorted largest plot first, because size is the first question a land buyer asks.
3. **Three filters**: district, plot size (under 1,000 / 1,000 to 5,000 / over 5,000 square metres) and land type, as native dropdowns. At 375 px they sit in a 1 + 2 grid. The count line updates live.
4. **Freshness and availability come first**: "Records checked up to … **Whether a plot is for sale is not known.** Most land in these groups is held by a developer."
5. **A project-level record is never shown as a plot fact.** The footnote says a registered project does not tell you what is built on the plot.
6. **A deep link** like `?g=permits` opens a group directly. A message or the Brief can point straight at it.
7. Each plot card shows the plot number, district, area in square metres and square feet, land type, and the reason when there is one. A chevron opens the Plot Passport.
8. Icons are inline SVG, with no emoji. Light and dark colours come from tokens. There is no horizontal scroll at 375 px (checked in a browser: scrollWidth equals clientWidth).

## Change outside the module
`src/centres2040_page.js`: one line added to `CF.load` reads `?empty=all|res|com|oth|bare` and turns on the Empty plots layer. This makes "See on map" land on the layer and not on a blank map.

## Assumptions and open items
- Plot Passport route `/najma/plot?id=` is **assumed** (see ACTIVITY_RADAR_UX.md).
- The page holds at most 6,000 plots (`MAX_LAND` in the builder); the rest are the smallest plots.
- The views are not in MotherDuck yet, so the counts on screen will be zero until `build_plot_intel.py` runs.
