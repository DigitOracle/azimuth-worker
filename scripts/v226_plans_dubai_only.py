"""A Dubai building must never be shown another emirate's floor plans.

Found 22 Sep 2026, after the DDA session warned that collapsing project names is the Enara/Binary failure in a new costume.
The plans index holds 168 projects and 4,094 plans, and 22 projects / 1,254 plans of that are NOT IN DUBAI - Sobha Siniya
Island is in Umm Al Quwain, plus Abu Dhabi and Ras Al Khaimah. The developers sell across the emirates and their websites do
not partition by one, so another emirate's towers walked into a Dubai index.

plansFor matches a project name against a building name by two-way containment, and those names are generic. Measured against
the live stacks, FOUR Dubai buildings are being handed another emirate's plans today:

    Bayside          Dubai Marina      <- Bayside (Sobha Siniya Island)     69 plans
    Delphine W3      Dubai Marina      <- Delphine (Sobha Siniya Island)    61 plans
    Pristine by Zoya Jabal Ali First   <- Pristine (Sobha Siniya Island)    68 plans
    Aquamarine       Palm Jumeirah     <- Aquamarine (Sobha Siniya Island)  68 plans

A buyer on any of those four pages is being shown the layouts of a different building in a different emirate. That is worse
than holding no plans at all, because it looks like the answer.

So the match is now confined to Dubai: a project whose area names another emirate is skipped before any name comparison. It
is a page-side guard rather than a fix to the harvest - the question-bank session owns that index and is told - because the
page should not depend on an upstream file being clean to avoid telling a buyer something false.

  python scripts/v226_plans_dubai_only.py
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()
NL = chr(10)

OLD = """  for (const d of ((index && index.developers) || [])) {
    for (const p of (d.projects || [])) {
      const pn = norm(p.name);
      if (!pn) continue;"""
NEW = """  // 22 Sep 2026: the index carries 1,254 plans that are not in Dubai at all - Sobha Siniya Island is in Umm Al Quwain -
  // and the names are generic enough that four Dubai buildings were matching them. Another emirate's plans are worse than
  // none, because they look like the answer. Skipped before any name is compared.
  const OTHER_EMIRATE = /umm al quwain|uaq|siniya|abu dhabi|sharjah|ajman|ras al khaimah|rak\\b|fujairah/;
  for (const d of ((index && index.developers) || [])) {
    for (const p of (d.projects || [])) {
      const pn = norm(p.name);
      if (!pn) continue;
      if (OTHER_EMIRATE.test(String((p.area || "") + " " + (p.name || "")).toLowerCase())) continue;"""
assert s.count(OLD) == 1
s = s.replace(OLD, NEW)
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("plans confined to Dubai:", len(s), "chars")
