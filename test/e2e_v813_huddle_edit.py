# v813 browser walk-through (Playwright, 375 px): on the huddle card, every section's Edit opens the text with Save and Cancel and saves nothing
# by itself; Save keeps her words; Cancel changes nothing; market is changed with the ticks. Run against a local harness:
#   python test/e2e_v813_huddle_edit.py http://localhost:8812 <shots-prefix>
import sys
from playwright.sync_api import sync_playwright
B, OUT = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "")
U = B + "/momo/work/huddle?key=ins_najjuko_TEST&date=2026-11-30"
posts, fails = [], []
def check(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 375, "height": 812}, device_scale_factor=2)
    pg.on("request", lambda r: posts.append(r.post_data or "") if r.method == "POST" else None)
    for sid in ["theme", "recognition", "announcements", "celebrations", "tip", "schedule", "mantra"]:
        pg.goto(U); pg.wait_for_timeout(500); pg.click("#sec_" + sid); pg.wait_for_timeout(250); pg.click("#efd"); pg.wait_for_timeout(250)
        n0 = len(posts); pg.click("#bedit"); pg.wait_for_timeout(300)
        check(len(posts) == n0, sid + ": tapping Edit saves nothing")
        check(pg.is_visible("#bsave") and pg.is_visible("#bcancel"), sid + ": Save and Cancel are shown")
        box = pg.query_selector("#shi textarea[data-k]:visible") or pg.query_selector("#bmed")
        check(box is not None and box.is_visible() and box.is_editable(), sid + ": the text is open for editing")
        if sid == "theme" and OUT:
            pg.screenshot(path=OUT + "theme_edit_open.png")
        pg.click("#bcancel"); pg.wait_for_timeout(250)
        check(len(posts) == n0 and pg.is_visible("#bedit"), sid + ": Cancel changes nothing")
        pg.click("#bedit"); pg.wait_for_timeout(200)
        box = pg.query_selector("#shi textarea[data-k]:visible") or pg.query_selector("#bmed")
        box.fill("Her own line for " + sid); pg.click("#bsave"); pg.wait_for_timeout(700)
        check(len(posts) == n0 + 1 and ("Her own line for " + sid) in posts[-1], sid + ": Save sends her text")
        check("done" in (pg.get_attribute("#sec_" + sid, "class") or ""), sid + ": the section turns green")
    pg.goto(U); pg.wait_for_timeout(500); pg.click("#sec_theme"); pg.wait_for_timeout(250); pg.click("#efd"); pg.wait_for_timeout(250)
    t = pg.inner_text("#shi h2 + .hs")
    check("Shown on the opening slide and the theme slide" in t, "theme says where it shows in plain words: " + t[:80])
    pg.goto(U); pg.wait_for_timeout(500); pg.click("#sec_market"); pg.wait_for_timeout(250)
    check(pg.query_selector("#bedit") is None and pg.is_visible(".tc"), "market is changed with the ticks")
    if OUT:
        pg.goto(U); pg.wait_for_timeout(500); pg.screenshot(path=OUT + "card_after_edits.png", full_page=True)
    b.close()
print("FAILED: %d" % len(fails) if fails else "all passed"); sys.exit(1 if fails else 0)
