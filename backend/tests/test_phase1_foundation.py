import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.api.registry import EMPLOYEES_REGISTRY, ROOMS_REGISTRY


class Phase1FoundationTests(unittest.TestCase):
    def test_nine_virtual_rooms_registered(self):
        self.assertEqual(len(ROOMS_REGISTRY), 9)
        room_ids = {r["id"] for r in ROOMS_REGISTRY}
        expected = {
            "CEO_OFFICE",
            "TRADING_FLOOR",
            "TECHNICAL_ROOM",
            "SMC_ROOM",
            "ORDER_FLOW_LAB",
            "QUANT_LAB",
            "RISK_OFFICE",
            "EXECUTION_CENTER",
            "AI_WAR_ROOM",
        }
        self.assertEqual(room_ids, expected)

    def test_eight_employees_registered_with_single_veto_cro(self):
        self.assertEqual(len(EMPLOYEES_REGISTRY), 8)
        veto_holders = [e for e in EMPLOYEES_REGISTRY if e["can_veto"]]
        self.assertEqual(len(veto_holders), 1)
        self.assertEqual(veto_holders[0]["id"], "emp-07")

    def test_all_employees_start_in_valid_home_rooms(self):
        room_ids = {r["id"] for r in ROOMS_REGISTRY}
        for emp in EMPLOYEES_REGISTRY:
            self.assertIn(emp["home_room"], room_ids)
            self.assertEqual(emp["current_room"], emp["home_room"])


if __name__ == "__main__":
    unittest.main()
