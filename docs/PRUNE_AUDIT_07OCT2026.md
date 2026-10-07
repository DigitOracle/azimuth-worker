# Prune audit, 7 Oct 2026 (v374)

Rule applied (Kendall, 7 Oct 2026): if a fact cannot be said from a government register (Land Department, Dubai Municipality, RTA, KHDA, DEWA, Makani) and cannot be shown with a real picture, it is not offered. No "not known" placeholders. Kept five he named (metro, schools, gym, parking spaces, balcony) only where a register backs them for that building.

Data table: `PRUNE_AUDIT_DATA_07OCT2026.csv` (five largest districts in `naj-market-pulse/data/amenities/amenities_<district>_strict.json`: JVC 264 homes, Dubai Marina 183, Business Bay 134, Jabal Ali First 118, Burj Khalifa/Downtown 103).

## Audit table

"Known" = the amenity facts file holds a yes or a no for the home. Percentages in order JVC / Marina / Business Bay / Jabal Ali / Downtown. The Brief also computes metro and schools live from the RTA station list and the amenity layer for any home with a map position, so those two are better known in the product than in this file.

| Item | Where it appeared | Backing field | Source | % known (5 districts) | Picture | Verdict |
|---|---|---|---|---|---|---|
| Private pool | brief.js BRIEF_CRITERIA, brief_page.js chip, brief_docs.js AM_ROWS | crit.private_pool | developer page text only (5 homes of 2,954) | 0 / 0 / 0 / 1 / 0 | none | PULL |
| Community pool | same, plus compare "Pools" row, amenity card | crit.community_pool | 94% Land Dept buildings register (pool count), rest developer / OSM | 74 / 38 / 67 / 51 / 45 | OSM / Places photo on the card | PULL (Kendall's list; see decisions) |
| Pet-friendly | chip, compare "Parks and dog-friendly spaces", dog-park card | crit.pets | developer pages and OSM, community level; no register | 100 / 100 / 100 / 0 / 100 (a community claim copied to every home) | Places photo on the card | PULL |
| Newer or modern | chip, compare "Newest completion", PDF "Newer build" row | crit.modern | Dubai Municipality year, only where the DM record exists | 0 / 5 / 0 / 0 / 22 | none | PULL (Kendall's list) |
| Long-term stay | chip | crit.long_term | none; "Not scored" | 0 everywhere | none | PULL |
| Furnished | step 4 of the form, summary text, API param, PDF row, owner hint | q.furnished, furnished_hint | no register; listing-site adverts (owner only) | 0 | none | PULL |
| Near a metro | chip, metro card | crit.metro | RTA station list, straight line 1 km | 0 / 5 / 100 / 0 / 100 in file; live: any home with a position | station card | KEEP |
| Schools nearby | chip, compare row, schools card | crit.schools | KHDA register on the amenity layer, 1 km | 100 / 0 / 0 / 0 / 100 in file; live as above | schools card | KEEP |
| Gym | chip, gym card, live Google fill | crit.gym | WEAK: Land Dept units register for 50 buildings of 2,954; the rest are master-developer or developer web pages; Google Places live fill | 8 / 4 / 22 / 6 / 1 | gym card with Places photo | KEEP as Kendall named it; source weak, see decisions |
| Parking | chip, building page "Parking N bays" | crit.parking, car_parks | Land Dept buildings register (1,774 of 2,106 yes); developer page for the rest | 82 / 39 / 83 / 63 / 48 | none | KEEP |
| Balcony | chip, building page "sq ft balcony" | crit.balcony | Land Dept units register (1,823 of 2,012 yes) | 83 / 52 / 81 / 46 / 55 | none | KEEP (strongest of the five) |
| Townhouse (home type) | home-type chip, criteria row | crit.townhouse | project name says "townhouse"; register files townhouses as Villa | not known for most | none | KEPT, unsure |
| Dog park, playground, padel, concierge, beach, mall, view | no chip in Brief; dog_park / park / beach exist as amenity-card types; mall is a register field on the building page | amenity_cards.js, building_page.js `sales.mall` | OSM / Overture / Places; mall from Land Dept sales register | not in facts file | Places / Street View photo on cards | cards only open from kept must-haves now; building-page mall KEEP |

## Decisions for Kendall

1. Community pool is 94% backed by the Land Department buildings register (pool count). It is pulled because you listed it, but it is the one pulled item a register does answer for about half the homes. Say the word and it returns as a register-only row.
2. Gym is weak: only 50 buildings carry a Land Department units-register gymnasium; the rest are developer or master-developer claims or a live Google answer. Kept because you named it. Say if it should go.
3. The amenity-card route (`/amenity_cards`) still knows dog parks, parks, pools with a Places photo. No Brief control opens them now. A "dog parks nearby" picture card could return as a picture-backed card, not a question.
4. The developer's own amenity list printed on the PDF building page (for example "Swimming pool", "Kids' play area") is developer wording with the developer named; left as is.
5. Broker checklist (`src/checklist.js`) still asks Najjuko about pets, private pool, community pool and furnished. Internal data entry, nothing client-facing; not touched.
6. "Not known" wording remains in the rent figures ("not known (under 3 contracts)") and in owner notes; only criteria, comparison cells and the Brief page strings were cleared.
7. Townhouse as a home-type chip (register files townhouses as Villa) was left; the "not known" row it produced is no longer printed.

Underlying data and the fact-file code paths are untouched; nothing is deleted.
