"""v758: screenshot the Content Planner served by test/render_v758_planner.mjs at 375 px. Usage: python render_v758_planner.py <out_dir>"""
import sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1]
with sync_playwright() as pw:
    br = pw.chromium.launch(channel="chrome", headless=True)
    pg = br.new_context(viewport={"width": 375, "height": 812}, device_scale_factor=2).new_page()
    pg.goto("http://127.0.0.1:8799/momo/work/planner?key=k", wait_until="networkidle"); pg.wait_for_timeout(600)
    pg.evaluate("""() => { const b = document.querySelector('[data-day="1"]'); if (b) b.click(); }"""); pg.wait_for_timeout(400)
    pg.screenshot(path=OUT + "/01_day_thu5nov.png", full_page=True)
    for n, v in (("02_week", "week"), ("03_month", "month"), ("04_queue", "queue"), ("05_workflow", "flow"), ("06_reports", "rep")):
        pg.click("[data-v=%s]" % v); pg.wait_for_timeout(300); pg.screenshot(path="%s/%s.png" % (OUT, n), full_page=True)
    pg.click("[data-v=day]"); pg.wait_for_timeout(300); pg.click('[data-open="FEED-W1-04"] .n'); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT + "/07_item_panel.png")
    pg.evaluate("() => document.getElementById('sheet').scrollTo(0, 99999)"); pg.wait_for_timeout(200); pg.screenshot(path=OUT + "/08_item_panel_steps.png")
    br.close()
print("saved", OUT)
