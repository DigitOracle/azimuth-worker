# Activity Radar: UX decisions (v691, 2 Nov 2026)

**What it is for.** One question: *which plots changed on the official record this week, and how sure are we?* The reader might be an analyst or a broker standing in front of a client. Either one should understand a row without help.

**How you get there.** MORE, then ACTIVITY RADAR, then a plot card opens its Plot Passport. That is two taps to a plot, inside the three-tap budget.

## Research (sources)
- Progressive disclosure: show the short version first and keep the detail one step away ([NN/g, Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/); [NN/g video](https://www.nngroup.com/videos/progressive-disclosure/)). The row gives one line. The passport holds the evidence.
- Mobile filters: keep the filters you use most visible and one tap away. Show how many results you get after filtering, and never return an empty screen with no way out ([NN/g, Mobile Faceted Search](https://www.nngroup.com/articles/mobile-faceted-search/); [NN/g, Applying Filters](https://www.nngroup.com/articles/applying-filters/)). Bottom sheets are only worth it once there are many filters ([progressive disclosure pattern notes](https://cdn.jsdelivr.net/npm/ui-audit@1.0.2/references/21-patterns-progressive-disclosure.md)).
- Construction-lead services such as Glenigan and Barbour ABI sort projects by *stage* and filter by location, stage and sector. Glenigan now pulls planning applications straight from the Planning Portal ([Glenigan](https://www.glenigan.com); [Glenigan and Planning Portal partnership, Oct 2025](https://www.specificationonline.co.uk/articles/2025-10-21/glenigan-announces-milestone-planning-portal-partnership)). The lesson: the *stage word* is the product, so it has to be accurate.
- PlanningAlerts (Australia) gives one plain sentence per application, with the date it was found, linked to the full record ([example](https://www.planningalerts.org.au/applications/3543761)). We use the same one-line, dated pattern.
- Communicating uncertainty: say how strong the evidence is in words, next to the claim. Do not hide it in a footnote. Our label goes on every row.

## Decisions
1. **A ranked feed, not a map.** The question is "what's new". Rows are sorted by evidence strength first (strong, then medium, then weak) and newest first within each level.
2. **One plain-English sentence per row**, written by `oneLiner()`, for example "New building permit filed on 28 Oct". The wording never says construction has started. A permit or registration is paperwork, and the freshness banner says so. A project registration is marked "(project-level record)" so it is never read as a fact about the plot itself.
3. **Evidence strength is a word on a badge**: STRONG (solid fill), MEDIUM (outline), WEAK (grey). The legend underneath defines each one in a sentence.
4. **Filters are chips you can see, each one tap**: what changed, evidence, and a district picker. The count line shows the result size live, and an empty result says "Tap All to widen".
5. **Freshness comes first**: "Records checked up to 1 Nov 2026". If the data has not been built yet, the page says "not yet built" instead of showing an empty page.
6. **Cards, not lists.** Each card is a large tap target with an icon for the change type (inline SVG, no emoji) and a chevron. Results load 40 at a time behind "Show more".
7. **Light and dark** colours come from tokens that follow the phone's setting.
8. Every abbreviation is spelled out. Sources are named in full.

## Assumptions and open items
- Plot Passport route: `/najma/plot?id=<najma_plot_id>`. **ASSUMED.** It was not on `origin/dewa-screens` on 2 Nov, and the `_plotpassport` worktree had no commits yet. It is one constant (`PASSPORT_PATH`) in `src/plot_intel.js`.
- The data contract (`docs/PLOT_INTEL_VIEWS.md`) and the views did not exist in MotherDuck on 2 Nov. The builder maps column names tolerantly. See `scripts/build_plot_intel.py` in naj-market-pulse.
- Client keys: both routes sit behind the client path gate, so they are owner/insider only until someone decides to open them to clients.
