// Pins "now" for a test run, to catch tests that only fail on a particular weekday (the week starts Monday):
//   MOMO_FAKE_NOW=2026-10-05T08:00:00Z node --import ./test/_fakeclock.mjs test/test_v328_fit.mjs
// Run it for every weekday and for 21:10 and 00:30 Dubai time. Not a test itself: the runner only picks up test_*.mjs.
// Only the start instant is fixed; the clock then keeps ticking, so timeouts and ordering behave normally.
const target = Date.parse(process.env.MOMO_FAKE_NOW || "");
if (Number.isFinite(target)) {
  const RealDate = Date, offset = target - RealDate.now();
  globalThis.Date = class extends RealDate {
    constructor(...a) { if (a.length === 0) super(RealDate.now() + offset); else super(...a); }
    static now() { return RealDate.now() + offset; }
  };
}
