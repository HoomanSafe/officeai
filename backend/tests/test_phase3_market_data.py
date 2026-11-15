import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.market_data.indicators import (
    classify_regime,
    compute_atr_14,
    compute_ema_series,
    compute_rsi_14,
)
from backend.app.market_data.binance_public import is_feed_stale


class Phase3MarketDataTests(unittest.TestCase):
    def test_ema_and_rsi_on_uptrend(self):
        closes = [100.0 + i * 1.5 for i in range(60)]
        ema20 = compute_ema_series(closes, 20)[-1]
        ema50 = compute_ema_series(closes, 50)[-1]
        rsi = compute_rsi_14(closes, 14)

        self.assertIsNotNone(ema20)
        self.assertIsNotNone(ema50)
        self.assertGreater(ema20, ema50)
        self.assertEqual(rsi, 100.0)

        regime = classify_regime(closes[-1], ema20, ema50, 0.8, rsi)
        self.assertEqual(regime, "TRENDING_UP")

    def test_atr_calculation_positive(self):
        candles = [
            {"high": 102.0 + i, "low": 98.0 + i, "close": 100.0 + i}
            for i in range(25)
        ]
        atr = compute_atr_14(candles, 14)
        self.assertIsNotNone(atr)
        self.assertGreater(atr, 0)

    def test_stale_data_guard_flags_old_feeds(self):
        now = datetime(2026, 11, 15, 8, 40, 0, tzinfo=timezone.utc)
        fresh_iso = (now - timedelta(seconds=12)).isoformat()
        stale_iso = (now - timedelta(seconds=90)).isoformat()

        stale_fresh, age_fresh = is_feed_stale(fresh_iso, 45, now_utc=now)
        stale_old, age_old = is_feed_stale(stale_iso, 45, now_utc=now)
        stale_missing, age_missing = is_feed_stale(None, 45, now_utc=now)

        self.assertFalse(stale_fresh)
        self.assertEqual(age_fresh, 12)
        self.assertTrue(stale_old)
        self.assertEqual(age_old, 90)
        self.assertTrue(stale_missing)
        self.assertIsNone(age_missing)


if __name__ == "__main__":
    unittest.main()
