from typing import Optional


def compute_ema_series(values: list[float], period: int) -> list[Optional[float]]:
    if len(values) < period:
        return [None] * len(values)
    result: list[Optional[float]] = [None] * len(values)
    k = 2.0 / (period + 1)
    ema = sum(values[:period]) / period
    result[period - 1] = ema
    for i in range(period, len(values)):
        ema = values[i] * k + ema * (1.0 - k)
        result[i] = ema
    return result


def compute_rsi_14(closes: list[float], period: int = 14) -> Optional[float]:
    if len(closes) <= period:
        return None
    gains = 0.0
    losses = 0.0
    for i in range(1, period + 1):
        diff = closes[i] - closes[i - 1]
        if diff >= 0:
            gains += diff
        else:
            losses += abs(diff)
    avg_gain = gains / period
    avg_loss = losses / period

    for i in range(period + 1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gain = diff if diff > 0 else 0.0
        loss = abs(diff) if diff < 0 else 0.0
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100.0 - (100.0 / (1.0 + rs)), 2)


def compute_atr_14(candles: list[dict], period: int = 14) -> Optional[float]:
    if len(candles) <= period:
        return None
    trs: list[float] = []
    for i in range(1, len(candles)):
        cur = candles[i]
        prev_close = candles[i - 1]["close"]
        tr = max(
            cur["high"] - cur["low"],
            abs(cur["high"] - prev_close),
            abs(cur["low"] - prev_close),
        )
        trs.append(tr)
    if len(trs) < period:
        return None
    atr = sum(trs[:period]) / period
    for i in range(period, len(trs)):
        atr = (atr * (period - 1) + trs[i]) / period
    return round(atr, 4)


def classify_regime(
    last_close: Optional[float],
    ema20: Optional[float],
    ema50: Optional[float],
    atr_pct: Optional[float],
    rsi14: Optional[float],
) -> str:
    if last_close is None or ema20 is None or ema50 is None:
        return "UNKNOWN"
    if atr_pct is not None and atr_pct >= 2.2:
        return "HIGH_VOLATILITY"
    spread = abs(ema20 - ema50) / ema50
    if ema20 > ema50 and last_close > ema20 and (rsi14 is None or rsi14 >= 50):
        return "TRENDING_UP" if spread > 0.0025 else "RANGING"
    if ema20 < ema50 and last_close < ema20 and (rsi14 is None or rsi14 <= 50):
        return "TRENDING_DOWN" if spread > 0.0025 else "RANGING"
    return "RANGING"
