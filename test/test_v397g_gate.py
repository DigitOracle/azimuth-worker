"""v397g - the completeness gate as a HARD STOP in front of the publish scripts. Offline: synthetic data, no network, no KV, no deploy.
   python test/test_v397g_gate.py        (npm test runs it through test/test_v397g_gate.mjs)
Cases: the gate passes on a good candidate; blocks a candidate that removes KORE; blocks a candidate that drops coverage under its threshold; --skip-gate warns loudly and does not read anything;
a block exits 1 on --apply and only reports on a dry run; a guard that cannot run fails CLOSED; every publish script that writes KV is wired (or is on the documented exemption list)."""
import contextlib, io, json, os, re, subprocess, sys, tempfile, unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(os.path.dirname(HERE), "scripts")
sys.path.insert(0, SCRIPTS)
import completeness_core as C
import check_completeness as K
import gate_guard as G

N = 20                                         # universe: register projects 1..20
ROWS = [{"key": "PN%d" % i, "source": "register_extract_2026-06-15", "project_number": str(i), "name": "Project %d" % i, "name_alt": "", "developer_canon": "damac", "area": "Area", "master": "",
         "sales_all": "5", "parcels": "", "reg_bound_props": ""} for i in range(1, N + 1)]
FIX = [{"id": "kore", "name": "KORE", "pn": None, "names": ["KORE"], "must": ["S3"], "dev": "imtiaz", "not_dev": []}]
CFG = {"thresholds": {"S3": 70.0}, "baseline": {}}


def index_with(pns):
    b = [[0, 0, "Project %d" % p] for p in pns]
    bx = [{"p": p, "e": "REGISTER_VERIFIED"} for p in pns]
    return {"areas": {"area": {"devs": {"damac": {"n": "DAMAC", "b": b, "bx": bx}}}}}


def nosales_file(pns, kore=True):
    ents = [{"p": p, "n": "Project %d" % p, "e": "REGISTER_VERIFIED"} for p in pns]
    if kore:
        ents.append({"p": None, "n": "KORE", "e": "DEVELOPER_CLAIMED"})
    return {"meta": {}, "d": {"damac": {"area": ents}}} if not kore else {"meta": {}, "d": {"damac": {"area": ents[:-1]}, "imtiaz": {"area": [ents[-1]]}}}


def live_kv():
    """live: cards for projects 1..10 on the index, and the live nosales layer holds 11..14 and KORE -> S3 = 14 of 20 = 70% (the threshold)."""
    kv = {"devmap_index": index_with(range(1, 11)), "search_index": {"items": []}, "plots": {"features": []}, "plot_positions": {"p": {}}, "community_positions": {"p": {}, "c": {}},
          "investor_tiers_index": {"projects": []}, "map_prices": {"items": []}, "buy_extra": None, "rent_index": None, "districts_geo": {"districts": []}, "_slugs": [], "_fast": True,
          "_layer_src": {n: ("live", None) for n in C.LAYER_KEYS}}
    kv["_layer_src"]["nosales"] = ("live", nosales_file(range(11, 15)))
    return kv


class Gate(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.kv = live_kv()

    def cand(self, pns, kore=True, name="nosales.json"):
        p = os.path.join(self.tmp, name)
        with open(p, "w", encoding="utf-8") as fh:
            json.dump(nosales_file(pns, kore), fh)
        return p

    def run_check(self, layers, **kw):
        buf = io.StringIO()
        ok, blocks = G.check(layers, self.kv, ROWS, CFG, fast=True, fixtures=FIX, out=lambda s: buf.write(s + "\n"), **kw)
        return ok, blocks, buf.getvalue()

    def test_0_live_baseline_is_at_the_threshold_and_kore_passes(self):
        m = K.measure(self.kv, ROWS, CFG, True, fixtures=FIX)
        self.assertAlmostEqual(m["pct"]["S3"], 70.0)
        self.assertTrue(m["fixtures"][0]["ok"], m["fixtures"])

    def test_1_good_candidate_passes(self):
        ok, blocks, out = self.run_check({"nosales": self.cand(range(11, 19))})          # a superset of live: 11..18 and KORE
        self.assertTrue(ok, blocks)
        self.assertIn("S3", out)
        self.assertNotIn("BLOCK", out)

    def test_2_candidate_without_kore_is_blocked(self):
        ok, blocks, out = self.run_check({"nosales": self.cand(range(11, 19), kore=False)})
        self.assertFalse(ok)
        self.assertTrue(any("fixture KORE passed live and FAILS" in b for b in blocks), blocks)
        self.assertIn("BLOCK", out)

    def test_3_candidate_that_drops_coverage_under_the_threshold_is_blocked(self):
        ok, blocks, out = self.run_check({"nosales": self.cand([11], kore=True)})        # KORE kept, 12..14 dropped: S3 = 11 of 20 = 55% < 70
        self.assertFalse(ok)
        self.assertTrue(any(b.startswith("coverage S3") and "below the threshold" in b for b in blocks), blocks)
        self.assertIn("WARN: S3: 3 project(s)", out)                   # the lost projects are named, never silent

    def test_4_unknown_layer_and_missing_file_are_errors_not_passes(self):
        with self.assertRaises(ValueError):
            G.substitute(self.kv, {"nope": self.cand([11])})
        with self.assertRaises(FileNotFoundError):
            G.substitute(self.kv, {"nosales": os.path.join(self.tmp, "absent.json")})

    def _enforce(self, layers, apply, skip=False, load=None):
        up = os.path.join(self.tmp, "u.csv")
        import csv
        with open(up, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(ROWS[0])); w.writeheader(); w.writerows(ROWS)
        cp = os.path.join(self.tmp, "c.json")
        with open(cp, "w", encoding="utf-8") as fh:
            json.dump(CFG, fh)
        buf, err = io.StringIO(), io.StringIO()
        with mock.patch.object(C, "load_live", side_effect=load or (lambda *a, **k: self.kv)), mock.patch.object(C, "FIXTURES", FIX), \
                contextlib.redirect_stdout(buf), contextlib.redirect_stderr(err):
            try:
                r = G.enforce(layers, apply=apply, skip=skip, universe=up, config=cp)
                code = 0 if r else "returned False"
            except SystemExit as e:
                code = e.code
        return code, buf.getvalue(), err.getvalue()

    def test_5_apply_exits_1_on_a_block_and_a_dry_run_only_reports(self):
        bad = {"nosales": self.cand(range(11, 19), kore=False)}
        code, out, _ = self._enforce(bad, apply=True)
        self.assertEqual(code, 1)
        self.assertIn("GATE GUARD: BLOCKED", out)
        self.assertIn("Nothing was written", out)
        code, out, _ = self._enforce(bad, apply=False)
        self.assertEqual(code, "returned False")                       # the dry run carries on, and says so
        self.assertIn("WOULD BE BLOCKED", out)
        code, out, _ = self._enforce({"nosales": self.cand(range(11, 19))}, apply=True)
        self.assertEqual(code, 0)
        self.assertIn("GATE GUARD: PASS", out)

    def test_6_skip_gate_warns_loudly_on_both_streams_and_reads_nothing(self):
        def boom(*a, **k):
            raise AssertionError("the live store must not be read when the gate is skipped")
        code, out, err = self._enforce({"nosales": self.cand(range(11, 19), kore=False)}, apply=True, skip=True, load=boom)
        self.assertEqual(code, 0)
        for stream in (out, err):
            self.assertIn("COMPLETENESS GATE SKIPPED", stream)
            self.assertIn("UNGATED", stream)

    def test_7_a_guard_that_cannot_run_fails_closed(self):
        def down(*a, **k):
            raise RuntimeError("could not read devmap_index from the live store")
        code, out, _ = self._enforce({"nosales": self.cand(range(11, 19))}, apply=True, load=down)
        self.assertEqual(code, 1)
        self.assertIn("treated as BLOCKED", out)

    def test_8_cli_skip_gate_exits_0_with_the_warning(self):
        r = subprocess.run([sys.executable, os.path.join(SCRIPTS, "gate_guard.py"), "--layer", "nosales", "--file", self.cand([11]), "--skip-gate"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("COMPLETENESS GATE SKIPPED", r.stdout)
        self.assertIn("COMPLETENESS GATE SKIPPED", r.stderr)


class Wiring(unittest.TestCase):
    """Every publish script that writes KV calls the guard, or is on this list WITH its reason. A new publisher that is neither fails here."""
    EXEMPT = {
        "publish_centres2040.py": "img_centres2040 is not read by any gate surface (the centres layer of the 2040 map)",
        "publish_devmap_delivery.ps1": "img_devmap_delivery feeds the investor PDF only; no gate surface reads it",
    }

    WRAPPERS = {"publish_devmap_profile_v321.ps1": "publish_devmap_offplan.ps1"}      # a wrapper that runs another publisher: it must pass -SkipGate through, and the inner one is wired

    def test_every_kv_publisher_is_wired_or_exempt(self):
        names = sorted(f for f in os.listdir(SCRIPTS) if f.startswith("publish_") and f.endswith((".py", ".ps1")))
        self.assertGreater(len(names), 15)
        for f in names:
            with open(os.path.join(SCRIPTS, f), encoding="utf-8") as fh:
                txt = fh.read()
            if f in self.EXEMPT:
                self.assertNotIn("gate_guard", txt, f + " is exempt but wired: remove it from EXEMPT")
                continue
            self.assertIn("gate_guard", txt, f + " writes KV and has no completeness gate: wire it (scripts/gate_guard.py) or add it to EXEMPT with the reason")
            if f in self.WRAPPERS:
                self.assertIn("$ia += \"-SkipGate\"", txt, f)
                self.assertIn(self.WRAPPERS[f], txt, f)
                self.assertIn(self.WRAPPERS[f], names)
                continue
            if f.endswith(".py"):
                self.assertRegex(txt, r'"--skip-gate"', f)
                self.assertRegex(txt, r"gate_guard\.enforce\(", f)
                # the guard runs after validate() and before the live store is touched or anything is put
                self.assertIn('"put"', txt, f)
                self.assertLess(txt.index("gate_guard.enforce("), txt.rindex('"put"'), f)
            else:
                self.assertRegex(txt, r"\[switch\]\$SkipGate", f)
                self.assertRegex(txt, r"COMPLETENESS GATE SKIPPED", f)
                self.assertRegex(txt, r"blocked the publish", f)
                first_put = min([m.start() for m in re.finditer(r"^\s*Put-Kv ", txt, re.M)] or [len(txt)])
                self.assertLess(txt.index("gate_guard.py"), first_put, f + ": the guard must run before the first Put-Kv")

    def test_the_gate_data_is_what_the_guard_expects(self):
        with open(os.path.join(SCRIPTS, "completeness_gate.json"), encoding="utf-8") as fh:
            cfg = json.load(fh)
        self.assertEqual(sorted(cfg["thresholds"]), sorted(K.MEASURE))
        ids = [f["id"] for f in C.FIXTURES]
        for need in ("kore", "archive", "burjazizi", "trumptower", "tamaniarts", "sobhasanctuary", "cposp100"):
            self.assertIn(need, ids)
        self.assertEqual(len(ids), len(set(ids)))


if __name__ == "__main__":
    unittest.main(verbosity=2)
