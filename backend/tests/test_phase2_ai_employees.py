import unittest
from pathlib import Path
import sys
import json

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.agents.prompts import ROLE_PROMPTS, build_system_prompt
from backend.app.ai.router import RouterPolicy, validate_agent_json_payload


class Phase2AIEmployeesTests(unittest.TestCase):
    def test_all_eight_employee_prompts_exist(self):
        self.assertEqual(len(ROLE_PROMPTS), 8)
        for idx in range(1, 9):
            emp_id = f"emp-0{idx}"
            self.assertIn(emp_id, ROLE_PROMPTS)
            prompt = build_system_prompt(emp_id, margin_mode="CROSS")
            self.assertIn("CROSS", prompt)

    def test_valid_structured_json_passes_validation(self):
        payload = json.dumps({
            "employee_id": "emp-03",
            "task_id": "tsk-1",
            "symbol": "BTCUSDT",
            "timeframe": "1h",
            "timestamp": "2026-11-15T08:00:00Z",
            "market_direction": "INSUFFICIENT_DATA",
            "findings": ["Exchange data feed not connected"],
            "supporting_evidence": ["No live candles available"],
            "confidence": 0.0,
            "invalidation_conditions": ["Connect Binance market stream"],
            "recommended_action": "NO_TRADE",
            "reasoning_summary": "Fail closed without exchange data.",
            "data_quality": "NO_EXCHANGE_DATA",
        })
        ok, data, errors = validate_agent_json_payload(payload)
        self.assertTrue(ok)
        self.assertEqual(errors, [])
        self.assertEqual(data["recommended_action"], "NO_TRADE")

    def test_malformed_json_is_rejected(self):
        ok, data, errors = validate_agent_json_payload("{not valid json")
        self.assertFalse(ok)
        self.assertIsNone(data)
        self.assertTrue(len(errors) > 0)

    def test_router_policy_defaults(self):
        policy = RouterPolicy()
        self.assertTrue(policy.enable_fallback)
        self.assertGreater(policy.daily_budget_usd, 0)


if __name__ == "__main__":
    unittest.main()
