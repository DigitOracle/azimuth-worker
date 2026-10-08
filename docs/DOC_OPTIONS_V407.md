# Document options pages (v407)

One page shell (`src/doc_options_page.js`) serves the three documents that a project panel offers: Investor, Client, Broker. The user chooses the options first; the PDF is made by the existing generator with the choices mapped to its parameters. The defaults reproduce the old one-click links.

## How the Investor selector works (unchanged, now a configuration of the shell)

- Page: `GET /developers_pdf?kind=investor_selector&project=<id>&format=html&key=...` (`selectorHtml`, `src/investor_tiers_page.js`). Facts come from the district shard `img_investor_tiers_facts_<district>` (`src/investor_facts.js`).
- PDF: `GET /developers_pdf?kind=investor_tiers&project=&type=&tier=&segs=&flags=&client=&key=` (`buildInvestorTiersPdf`, `buildPlan` in `src/investor_tiers.js`).
- Locked core (`CORE_IDS`, cannot be chosen or dropped; `buildPlan` warns and ignores any attempt): developer, delivery record, status and handover, sales so far, price plan and fees, plus the last page "What this report cannot tell you" and the coverage line.
- Options, in order:
  1. Who is it for: 11 presets (investment and end-user groups; some marked draft, awaiting official check).
  2. How deep: Summary, Standard, Full evidence.
  3. Segments (each checked against the project's own evidence; status ok, annotated, blocked or unavailable, with the reasons shown): market history, comparables, yield and rent, area story, city context, price charts, developer detail, amenities, demand momentum, delivery progress, unit mix and prices, buyer protections, residency rule, payment plan and cash, resale activity, resale conditions, supply nearby. Full evidence switches all supported ones on.
  4. Order notes (optional flags).
- Every segment line carries an evidence label; blocked segments are greyed with the reason. Tests: test_v339, v351, v366, v376, v379.
- v407 changed no byte of this page or of any investor PDF (fingerprints in test_v407 section A).

## The shell

`optFrame` (head, title, subtitle, body, script) and `OPT_CSS` are the Investor page's own markup. `optionsHtml(cfg, icon)` draws the declarative pages with `optRuntime`: cards you press (single choice), cards you tick (several, listed as `omit` or `include` in one link parameter), text boxes, link cards (`nav`), a locked "Always included" block (plain cards, no control, no parameter), one Generate link. A card is greyed with its reason when its data is missing (`off`) or when the choice it depends on is not made (`when`).

## Client sheet: `GET /doc_client?keys=<district:index>[&mode=][&beds=]&key=`

Generate opens `/brief_pdf?kind=dossier&keys=...` (`src/brief_docs.js`). Facts: `clientFacts` reads the building through `loadContext` in rent and in buy mode.

| Section | Options | Greyed when |
| --- | --- | --- |
| Rent or buy (`mode`) | Rent, Buy | Rent: no rent contracts. Buy: fewer than three settled sales of any type |
| Which homes (`beds`) | Every home type, Studio, 1, 2, 3 or more | A type is offered in the mode where its evidence exists; greyed when neither a rent record nor three sales exist |
| Budget (`min`, `max`) | From, Up to (AED) | Until one home type is chosen |
| Includes (`hide=` lists what is unticked) | Amenities, where it is, nearby (`amen`); developer photographs (`photos`); layouts table (`layouts`) | No amenity or position record; the developer page has no photographs; the units register does not cover the building |
| Offered when evidence supports it | Walking times, payment plan, rent yield, shortlist of comparable projects, Arabic | Always today, each with its reason (walking times need a person's on-site check; the dossier carries no payment plan or yield; a shortlist needs several buildings; English only). The yield reason names the missing evidence |
| Prepared for (`client`) | Name, default "the reader of this sheet" | never |

Locked core: registered facts; the figure with its evidence line (sales recorded at the Land Department, not asking prices); pictures labelled (developer photograph, else aimed Street View, else our own illustration marked as one, never satellite); the prepared-for line; the legal footer (Curated by Najjuko, Dubai Decoded, WhatsApp +971 56 548 4397).

New dossier parameters (absent = today's document): `hide=amen,photos,layouts`, `client=<name>`.

## Broker sheet: `GET /doc_broker?area=<slug>&developers=a,b[&kind=][&window=][&mode=]&key=`

Generate opens `/developers_pdf?kind=snapshot|detailed&area=...` (`src/devmap_pdf.js`).

| Section | Options | Greyed when |
| --- | --- | --- |
| How much (`kind`) | Snapshot, Detailed | Detailed: fewer than three settled sales in the area |
| Sales window (`window`) | Last 12 months, All years | 12 months: the area has no record by year |
| Buy or rent (`mode`) | Buy, Rent | Rent: no rent contracts for these developers here |
| Area | this area, other areas where the chosen developers also sell (links to their own options page) | n/a |
| Developers (`developers`) | every developer on the register in the area | no settled sale here |
| Price band (`min`, `max`, `basis=sqm`) | Any, Top, Upper, Middle, Entry band (the register's own band edges) | Not Buy; not enough sales to set bands |
| Bedrooms for the band (`beds`) | Any, studio, 1, 2, 3 | Until a band is chosen |
| Off-plan or ready | Off-plan only, Ready only | Always today: sales are not split by handover status |
| Add to the sheet | Broker contact block (`contact=1`); projects not yet confirmed as their own group | the group is greyed always today (unconfirmed projects stay out of every number) |
| Prepared for (`client`) | Name | never |

Locked core: registered facts with the register date and window; evidence labels (sales behind each figure, none shown under three); only confirmed projects in the numbers; the prepared-for line; the legal footer (permit reminder, page numbers, past facts only).

New snapshot parameters (absent = today's document): `contact=1`, and `client=` now prints a "Prepared for" line in the header.

## Buttons

`docRow` (`src/devmap_page.js`): Investor unchanged, Client opens `/doc_client`, Broker opens `/doc_broker`. The developer-level `pdfRow` Snapshot and Detailed open `/doc_broker` with the kind chosen; its Investor link is unchanged. Both new routes are in the Worker next to `/developers_pdf` and open to a client key like it.
