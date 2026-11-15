from typing import Optional


def detect_specialist_conflicts(reports: list[dict]) -> tuple[bool, str]:
    bullish = [r for r in reports if r.get("market_direction") == "BULLISH"]
    bearish = [r for r in reports if r.get("market_direction") == "BEARISH"]
    bad_data = [
        r for r in reports
        if r.get("data_quality") != "LIVE_VERIFIED" or r.get("market_direction") == "INSUFFICIENT_DATA"
    ]
    if bad_data:
        return True, f"{len(bad_data)} specialist(s) reported missing or stale data."
    if bullish and bearish:
        return True, "Directional conflict detected between BULLISH and BEARISH specialists."
    return False, f"Aligned consensus ({len(bullish)} bullish, {len(bearish)} bearish)."


def compute_risk_reward(
    action: str,
    entry_price: Optional[float],
    stop_loss_price: Optional[float],
    take_profit_price: Optional[float],
) -> Optional[float]:
    if action == "NO_TRADE" or entry_price is None or stop_loss_price is None or take_profit_price is None:
        return None
    risk = abs(entry_price - stop_loss_price)
    reward = abs(take_profit_price - entry_price)
    if risk <= 0:
        return None
    return round(reward / risk, 2)


def deterministic_cro_audit(
    action: str,
    entry_price: Optional[float],
    stop_loss_price: Optional[float],
    take_profit_price: Optional[float],
    confidence: float,
    min_rr: float = 2.0,
    kill_switch_active: bool = False,
    data_stale: bool = False,
    conflict_detected: bool = False,
) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    if kill_switch_active:
        reasons.append("Emergency Kill Switch is ARMED.")
    if data_stale:
        reasons.append("Market data feed is stale.")
    if action == "NO_TRADE":
        return bool(reasons), reasons or ["Head Trader proposed NO_TRADE."]
    if confidence < 0.55:
        reasons.append("Confidence below 0.55 minimum.")
    if conflict_detected and confidence < 0.72:
        reasons.append("Unresolved conflict with confidence < 0.72.")
    if entry_price is None or stop_loss_price is None or take_profit_price is None:
        reasons.append("CROSS margin requires mandatory Entry, Stop Loss, and Take Profit.")
        return True, reasons
    if action == "LONG" and not (stop_loss_price < entry_price < take_profit_price):
        reasons.append("Invalid LONG geometry.")
    if action == "SHORT" and not (take_profit_price < entry_price < stop_loss_price):
        reasons.append("Invalid SHORT geometry.")
    rr = compute_risk_reward(action, entry_price, stop_loss_price, take_profit_price)
    if rr is None or rr < min_rr:
        reasons.append(f"Risk/Reward {rr} below minimum {min_rr}.")
    return bool(reasons), reasons or [f"Cleared CRO audit (R:R={rr}:1)."]
