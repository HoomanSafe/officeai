import json
from dataclasses import dataclass


@dataclass
class RouterPolicy:
    max_tokens_per_call: int = 2048
    daily_budget_usd: float = 5.0
    spent_today_usd: float = 0.0
    timeout_ms: int = 25000
    max_retries: int = 2
    enable_fallback: bool = True


REQUIRED_REPORT_KEYS = {
    "employee_id",
    "task_id",
    "symbol",
    "timeframe",
    "timestamp",
    "market_direction",
    "findings",
    "supporting_evidence",
    "confidence",
    "invalidation_conditions",
    "recommended_action",
    "reasoning_summary",
    "data_quality",
}

VALID_DIRECTIONS = {"BULLISH", "BEARISH", "NEUTRAL", "INSUFFICIENT_DATA"}
VALID_ACTIONS = {"LONG", "SHORT", "NO_TRADE", "HOLD", "VETO"}
VALID_QUALITY = {"LIVE_VERIFIED", "NO_EXCHANGE_DATA", "STALE_DATA", "SCHEMA_FALLBACK"}


def validate_agent_json_payload(raw_text: str) -> tuple[bool, dict | None, list[str]]:
    try:
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].strip()
        data = json.loads(cleaned)
    except Exception:
        return False, None, ["Malformed JSON response"]

    if not isinstance(data, dict):
        return False, None, ["Root payload must be a JSON object"]

    missing = REQUIRED_REPORT_KEYS - set(data.keys())
    if missing:
        return False, None, [f"Missing required fields: {sorted(missing)}"]

    errors: list[str] = []
    if data.get("market_direction") not in VALID_DIRECTIONS:
        errors.append("Invalid market_direction")
    if data.get("recommended_action") not in VALID_ACTIONS:
        errors.append("Invalid recommended_action")
    if data.get("data_quality") not in VALID_QUALITY:
        errors.append("Invalid data_quality")

    try:
        conf = float(data["confidence"])
        if conf < 0.0 or conf > 1.0:
            errors.append("confidence out of [0.0, 1.0] bounds")
    except Exception:
        errors.append("confidence must be numeric")

    if errors:
        return False, None, errors
    return True, data, []
