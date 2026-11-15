import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.ai.debate import (
    compute_risk_reward,
    detect_specialist_conflicts,
    deterministic_cro_audit,
)


class Phase4DebateEngineTests(unittest.TestCase):
    def test_conflict_detector_catches_bull_vs_bear(self):
        reports = [
            {"employee_id": "emp-03", "market_direction": "BULLISH", "data_quality": "LIVE_VERIFIED"},
            {"employee_id": "emp-04", "market_direction": "BEARISH", "data_quality": "LIVE_VERIFIED"},
        ]
        conflict, summary = detect_specialist_conflicts(reports)
        self.assertTrue(conflict)
        self.assertIn("conflict", summary.lower())

    def test_cro_vetoes_missing_stop_loss_under_cross_margin(self):
        vetoed, reasons = deterministic_cro_audit(
            action="LONG",
            entry_price=65000.0,
            stop_loss_price=None,
            take_profit_price=67000.0,
            confidence=0.80,
        )
        self.assertTrue(vetoed)
        self.assertTrue(any("stop loss" in r.lower() for r in reasons))

    def test_cro_vetoes_poor_risk_reward(self):
        rr = compute_risk_reward("LONG", 65000.0, 64000.0, 66000.0)
        self.assertEqual(rr, 1.0)
        vetoed, _ = deterministic_cro_audit(
            action="LONG",
            entry_price=65000.0,
            stop_loss_price=64000.0,
            take_profit_price=66000.0,
            confidence=0.85,
            min_rr=2.0,
        )
        self.assertTrue(vetoed)

    def test_cro_clears_valid_two_to_one_short(self):
        vetoed, _ = deterministic_cro_audit(
            action="SHORT",
            entry_price=65000.0,
            stop_loss_price=65500.0,
            take_profit_price=63900.0,
            confidence=0.82,
            min_rr=2.0,
        )
        self.assertFalse(vetoed)


if __name__ == "__main__":
    unittest.main()
