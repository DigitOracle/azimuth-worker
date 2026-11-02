# Data checks: the data discrepancy report (UX record)

2 Nov 2026. Built in `src/plot_reconcile.js` (route `/data_checks`, Najma More -> YOURS -> DATA CHECKS). Approved to build by Dr. Kendall Wilson; not deployed.

## What we are delivering, and to whom

One question answered: **"For which plots do the Land Department and the Municipality records disagree, and why might that be?"**

- Non-technical reader (Najjuko, a client in the room): sees four plain-English cards with a count each, taps one, reads a plot card that says what each office holds side by side and the usual innocent reasons for the gap.
- Technical reader (data team, Dr. Kendall Wilson): the same path, plus a CSV with the plot id, parcel id, both sides' fields, the reasons and every source with its date, ready to load into a spreadsheet or back into MotherDuck.

Three clicks to what they need:

| Click | Screen | What it answers |
|---|---|---|
| 1 | Summary: four kind cards, district filter, sources and dates | How many, of what kind, where |
| 2 | One kind: plot cards, side by side, reasons, search, show more | Which plots, and what each register says |
| 3 | Open the plot in PLOT PASSPORT, or DOWNLOAD CSV / SAVE AS PDF | Everything about one plot, or the list to take away |

## Research (sources) and what we took from each

| Source | What it says | Decision it drove |
|---|---|---|
| [GOV.UK Design System, Error message](https://design-system.service.gov.uk/components/error-message/) | Summarise at the top, then detail at the item; say what is wrong and how to resolve it; same words in both places; no "invalid", no jokes; read it aloud | Summary cards first, item cards second, the same title in both; every kind carries one line saying what it means; reasons say how to look further |
| [GOV.UK Tag](https://design-system.service.gov.uk/components/tag/) and its [colour discussion](https://github.com/alphagov/govuk-design-system/discussions/6046/) | Tags are for status only; red and green are hard to tell apart for colour-blind readers | No red/amber/green severity on the cards; one gold accent for everything; status is carried by words |
| [Scottish Government status tag](https://designsystem.gov.scot/components/status-tag) | Colour never alone; same colour for the same status everywhere | Every card has a text title and an icon; no meaning carried by colour |
| [NN/g, Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/) | Visible, plain language, constructive, redundant cues (not colour alone) | Plain language at a reading age a client can follow; icon + word + number on each card |
| [NN/g, Hostile patterns in error messages](https://www.nngroup.com/articles/hostile-error-messages/) | Blaming or alarming words make people defensive; do not over-signal | Neutral vocabulary only: "research flag", "do not agree", "no permit found"; a test refuses violation / illegal / breach / offence / unlawful / fraud |
| [NN/g, 10 heuristics for complex applications](https://www.nngroup.com/articles/usability-heuristics-complex-applications/) | Help experts and novices on the same screen; progressive disclosure | Reasons collapsed behind chips on each card (tap to read); full list of reasons once per kind at the top |
| [Reconciliation screen UI patterns (AppMaster)](https://appmaster.io/blog/reconciliation-screen-ui-patterns) and [Oracle Account Reconciliation, unmatched items](https://docs.oracle.com/en/cloud/saas/readiness/epm/2025/epm-feb25/25feb-epm-wn-f37096.htm) | Two sides side by side (bank vs book); exceptions in their own view with named categories such as "timing difference" | Each plot card shows LAND DEPARTMENT and MUNICIPALITY side by side; the kinds are named categories; "updated on different days" is the reconciliation world's timing difference |
| [Workday bank reconciliation](https://doc.workday.com/admin-guide/en-us/financial-management/cash/bank-account-reconciliation-processing/dan1370796824934.html) | Show the share of exceptions by reason up front | The summary's counts by kind, filtered by district |
| [Linear, filters](https://linear.app/docs/filters) and [issue grouping](https://linear.app/changelog/2021-02-12-issue-grouping) | Group a long list by one property, filter by another, keep the view in the address | Grouped by kind (the cards), filtered by district; state lives in the address (`#t=..&d=..`) so back works and a view can be shared |
| [Monte Carlo incident triage tour](https://info.montecarlodata.com/product-tour/triage-incidents) | Incidents rolled up so the feed is not noise; owner and status per incident | Thousands of flags are rolled up to four kinds; no per-row severity, because none is earned by the data |

## Decisions

1. **Name and place.** "DATA CHECKS" in More under YOURS (owner key only). The handover of 2 Nov says the plot thread is research use only, so a client key gets nothing (401 at the client gate, 404 at the route).
2. **Neutral by rule.** Each item is called a *research flag*. Titles describe what each register holds, never what anybody did. The neutral-word check is a test (`prNeutral`).
3. **No severity colours.** The four kinds are not ranked; a count is not a risk score. Gold accent only, teal for information notes.
4. **Side by side.** LAND DEPARTMENT on the left, MUNICIPALITY on the right, only fields that hold a value; an empty side says "Nothing held", never blank.
5. **Why it may differ.** Plain reasons per kind (timing, renaming, merged or split plots, villas not on the buildings register, typical floors versus all levels, older buildings permitted on paper). Shown once at the top, and per card behind chips.
6. **Cards, never lists** (Kendall, 4 Oct): 2-up kind cards at 375 px, plot cards one per row at 375 px and two per row on a desktop.
7. **No acronyms on screen.** "Land Department", "Municipality", "plot passport"; sources spelled out with their dates. The CSV column names are plain words too.
8. **Plot-level keys only.** The derived flags join parcel id to parcel id. Project-level links (via_project) are never used as a plot fact. No DEWA data, no Google content.
9. **Exports carry provenance.** The CSV's first line says these are research flags; every row carries the sources and their dates. SAVE AS PDF prints all loaded cards with a header line giving the kind, district and sources with dates (browser print, light ink).
10. **Caps said out loud.** The city-wide list holds 1,500 per kind and says so; a district list holds up to 10,000 (largest district 6,511 on 2 Nov).
11. **Light and dark** follow the app's own `naj_thm` setting, with a toggle; the navigation bar stays Najma's.
12. **Passport link** goes to `/plot_passport?key=..&id=<najma_plot_id>`, the route in the parallel Plot Passport workstream (`src/plot_passport.js`, not yet on dewa-screens). A flag for a plot not in today's register has no passport and says so.

13. **Two families, two headings.** The published `v_plot_exceptions` (contract `plot-intel-v1 2026-11-02`) carries four flags about how well records are tied to a plot; it does not compare the Land Department with Municipality permits. So the summary has two headed groups: LAND DEPARTMENT AND MUNICIPALITY (four kinds derived by the builder, parcel id to parcel id) and HOW WELL THE RECORDS ARE TIED TO THE PLOT (the view's four flags, side titles LAND REGISTER / OTHER RECORD). The view's own sentence is shown as "What it says", with "DLD" spelled out.

## Data

Builder: `naj-market-pulse/scripts/build_plot_reconcile.py` (reads MotherDuck `najma`, writes `kv_bulk_*.json`, never calls wrangler).

- From `v_plot_exceptions` (materialised once; about four minutes): `building_project_differs_from_register`, `empty_list_vs_building_evidence`, `no_link_beyond_register`, `project_level_only`, each enriched from `lk_plot_master`.
- Derived here from `lk_plot_master`, `g_dld__buildings`, `g_dm__building_permits`, `g_dm__building_summary_information`: `bld_no_permit`, `permit_no_bld`, `permit_no_plot`, `floors_differ` (floor gap of three or more, because the Municipality counts typical floors only).
- `v_plot_evidence` is not read: the plot card links to PLOT PASSPORT, which shows the evidence per plot.

KV: `pr_sum`, `pr_l_<kind>_<district>`, `pr_l_<kind>_all` (binding MEETINGS).
