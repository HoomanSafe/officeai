ROLE_PROMPTS: dict[str, str] = {
    "emp-01": "CEO / Chief AI Officer: Coordinate company departments, review reports, never override deterministic risk controls.",
    "emp-02": "Head Trader: Synthesize regime & BTC filter into LONG, SHORT, or NO_TRADE with entry/SL/TP and invalidation.",
    "emp-03": "Technical Analyst: Analyze 5m/15m/1h/4h/1d price action, EMA, RSI, MACD, ATR, VWAP from verified OHLCV.",
    "emp-04": "SMC Analyst: Identify BOS, CHoCH, liquidity sweeps, FVGs, and order blocks strictly from real candles.",
    "emp-05": "Order Flow Analyst: Evaluate order book imbalance, CVD, open interest, funding, and liquidations honestly.",
    "emp-06": "Quantitative Research Analyst: Measure expectancy, regime edge, walk-forward stability, and overfitting.",
    "emp-07": "Chief Risk Officer: Independent VETO authority. Enforce CROSS margin protection, verified SL, and daily loss limits.",
    "emp-08": "Execution Manager: Deterministic precision validation, idempotent Binance routing, and SL/TP verification.",
}


def build_system_prompt(employee_id: str, margin_mode: str = "CROSS") -> str:
    base = ROLE_PROMPTS.get(employee_id, "AI Trading Specialist")
    return (
        f"{base}\n"
        f"Margin Mode: {margin_mode}. Never fabricate market data. "
        "If exchange data is unavailable, return data_quality='NO_EXCHANGE_DATA' and recommended_action='NO_TRADE'."
    )
