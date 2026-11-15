"""Phase 5 deterministic execution & risk math unit tests."""

import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.execution.risk_math import (  # noqa: E402
    DeterministicRiskConfig,
    compute_deterministic_position_size,
    floor_to_step,
    round_to_tick,
)


class Phase5ExecutionEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.cfg = DeterministicRiskConfig(
            risk_per_trade_pct=0.15,
            max_daily_loss_pct=3.0,
            max_simultaneous_positions=3,
            target_risk_reward=2.0,
            max_leverage=5,
            margin_mode="CROSS",
        )

    def test_step_and_tick_rounding(self) -> None:
        self.assertEqual(floor_to_step(0.02399, 0.001), 0.023)
        self.assertEqual(round_to_tick(65123.46, 0.1), 65123.5)

    def test_valid_paper_long_cross_margin_sizing(self) -> None:
        # Equity = $10,000, risk = 0.15% ($15.00), entry = 90000, SL = 89500 (dist 500) -> qty = 0.030
        res = compute_deterministic_position_size(
            mode="PAPER",
            symbol="BTCUSDT",
            side="LONG",
            entry_price=90000.0,
            stop_loss_price=89500.0,
            take_profit_price=91100.0,  # R:R = 1100/500 = 2.2
            equity_usd=10000.0,
            available_balance_usd=10000.0,
            daily_pnl_pct=0.0,
            open_positions_count=0,
            has_duplicate_symbol_open=False,
            data_is_fresh=True,
            risk_config=self.cfg,
        )
        self.assertTrue(res.approved, msg=res.reject_reasons)
        self.assertEqual(res.quantity, 0.03)
        self.assertAlmostEqual(res.risk_amount_usd, 15.0, places=2)
        self.assertEqual(res.risk_reward_ratio, 2.2)

    def test_rejects_demo_and_live_modes(self) -> None:
        for blocked_mode in ("DEMO", "LIVE"):
            res = compute_deterministic_position_size(
                mode=blocked_mode,
                symbol="BTCUSDT",
                side="LONG",
                entry_price=90000.0,
                stop_loss_price=89500.0,
                take_profit_price=91100.0,
                equity_usd=10000.0,
                available_balance_usd=10000.0,
                daily_pnl_pct=0.0,
                open_positions_count=0,
                has_duplicate_symbol_open=False,
                data_is_fresh=True,
                risk_config=self.cfg,
            )
            self.assertFalse(res.approved)

    def test_rejects_invalid_sl_and_low_rr(self) -> None:
        # LONG with SL above entry
        bad_sl = compute_deterministic_position_size(
            mode="PAPER",
            symbol="BTCUSDT",
            side="LONG",
            entry_price=90000.0,
            stop_loss_price=90200.0,
            take_profit_price=91000.0,
            equity_usd=10000.0,
            available_balance_usd=10000.0,
            daily_pnl_pct=0.0,
            open_positions_count=0,
            has_duplicate_symbol_open=False,
            data_is_fresh=True,
            risk_config=self.cfg,
        )
        self.assertFalse(bad_sl.approved)

        # R:R = 1.0 < 2.0
        bad_rr = compute_deterministic_position_size(
            mode="TESTNET",
            symbol="BTCUSDT",
            side="SHORT",
            entry_price=90000.0,
            stop_loss_price=90500.0,
            take_profit_price=89500.0,
            equity_usd=10000.0,
            available_balance_usd=10000.0,
            daily_pnl_pct=0.0,
            open_positions_count=0,
            has_duplicate_symbol_open=False,
            data_is_fresh=True,
            risk_config=self.cfg,
        )
        self.assertFalse(bad_rr.approved)
        self.assertTrue(any("Risk/Reward" in r for r in bad_rr.reject_reasons))

    def test_rejects_daily_loss_breach_and_kill_switch(self) -> None:
        daily_breach = compute_deterministic_position_size(
            mode="PAPER",
            symbol="BTCUSDT",
            side="LONG",
            entry_price=90000.0,
            stop_loss_price=89500.0,
            take_profit_price=91100.0,
            equity_usd=9600.0,
            available_balance_usd=9600.0,
            daily_pnl_pct=-3.1,
            open_positions_count=0,
            has_duplicate_symbol_open=False,
            data_is_fresh=True,
            risk_config=self.cfg,
        )
        self.assertFalse(daily_breach.approved)

        kill_cfg = DeterministicRiskConfig(emergency_kill_switch=True)
        killed = compute_deterministic_position_size(
            mode="PAPER",
            symbol="BTCUSDT",
            side="LONG",
            entry_price=90000.0,
            stop_loss_price=89500.0,
            take_profit_price=91100.0,
            equity_usd=10000.0,
            available_balance_usd=10000.0,
            daily_pnl_pct=0.0,
            open_positions_count=0,
            has_duplicate_symbol_open=False,
            data_is_fresh=True,
            risk_config=kill_cfg,
        )
        self.assertFalse(killed.approved)


if __name__ == "__main__":
    unittest.main()
