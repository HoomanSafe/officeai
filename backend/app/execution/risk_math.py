"""Phase 5 deterministic risk sizing & Binance USDⓈ-M Futures filter validation (pure Python)."""

from __future__ import annotations

from dataclasses import dataclass, field
import math
from typing import Dict, List, Optional


@dataclass
class SymbolExchangeFilter:
    symbol: str
    step_size: float
    tick_size: float
    min_qty: float
    min_notional: float


DEFAULT_SYMBOL_FILTERS: Dict[str, SymbolExchangeFilter] = {
    "BTCUSDT": SymbolExchangeFilter("BTCUSDT", 0.001, 0.1, 0.001, 100.0),
    "ETHUSDT": SymbolExchangeFilter("ETHUSDT", 0.001, 0.01, 0.001, 20.0),
    "SOLUSDT": SymbolExchangeFilter("SOLUSDT", 0.1, 0.01, 0.1, 10.0),
    "BNBUSDT": SymbolExchangeFilter("BNBUSDT", 0.01, 0.01, 0.01, 10.0),
}


@dataclass
class DeterministicRiskConfig:
    risk_per_trade_pct: float = 0.15
    max_daily_loss_pct: float = 3.0
    max_simultaneous_positions: int = 3
    target_risk_reward: float = 2.0
    max_leverage: int = 5
    margin_mode: str = "CROSS"
    position_mode: str = "ONE_WAY"
    emergency_kill_switch: bool = False


@dataclass
class SizingValidationResult:
    approved: bool
    reject_reasons: List[str] = field(default_factory=list)
    quantity: float = 0.0
    notional_usd: float = 0.0
    initial_margin_usd: float = 0.0
    risk_amount_usd: float = 0.0
    risk_pct_of_equity: float = 0.0
    risk_reward_ratio: float = 0.0
    rounded_entry: float = 0.0
    rounded_sl: float = 0.0
    rounded_tp: float = 0.0


def floor_to_step(value: float, step: float) -> float:
    if step <= 0:
        return value
    decimals = max(0, round(-math.log10(step)))
    floored = math.floor(value / step + 1e-9) * step
    return round(floored, decimals)


def round_to_tick(value: float, tick: float) -> float:
    if tick <= 0:
        return value
    decimals = max(0, round(-math.log10(tick)))
    rounded = round(value / tick) * tick
    return round(rounded, decimals)


def compute_deterministic_position_size(
    *,
    mode: str,
    symbol: str,
    side: str,
    entry_price: float,
    stop_loss_price: float,
    take_profit_price: float,
    equity_usd: float,
    available_balance_usd: float,
    daily_pnl_pct: float,
    open_positions_count: int,
    has_duplicate_symbol_open: bool,
    data_is_fresh: bool,
    risk_config: DeterministicRiskConfig,
    exchange_filter: Optional[SymbolExchangeFilter] = None,
) -> SizingValidationResult:
    sym_upper = symbol.upper()
    flt = exchange_filter or DEFAULT_SYMBOL_FILTERS.get(
        sym_upper,
        SymbolExchangeFilter(sym_upper, 0.001, 0.01, 0.001, 20.0),
    )

    reject_reasons: List[str] = []

    if risk_config.emergency_kill_switch:
        reject_reasons.append("Emergency Kill Switch is ARMED.")
    if mode == "LIVE":
        reject_reasons.append("LIVE execution is locked until Phase 7 acceptance tests pass.")
    if mode == "DEMO":
        reject_reasons.append("Switch mode to PAPER or TESTNET to execute orders (DEMO is read-only).")
    if not data_is_fresh:
        reject_reasons.append("Binance market feed is stale or disconnected.")
    if equity_usd <= 0 or available_balance_usd <= 0:
        reject_reasons.append("Insufficient account equity or available margin.")
    if daily_pnl_pct <= -risk_config.max_daily_loss_pct:
        reject_reasons.append(
            f"Daily loss limit reached ({daily_pnl_pct:.2f}% <= -{risk_config.max_daily_loss_pct:.2f}%)."
        )
    if open_positions_count >= risk_config.max_simultaneous_positions:
        reject_reasons.append(
            f"Max simultaneous positions ({risk_config.max_simultaneous_positions}) already open."
        )
    if has_duplicate_symbol_open:
        reject_reasons.append(f"An open position for {symbol} already exists (ONE_WAY mode).")

    rounded_entry = round_to_tick(entry_price, flt.tick_size)
    rounded_sl = round_to_tick(stop_loss_price, flt.tick_size)
    rounded_tp = round_to_tick(take_profit_price, flt.tick_size)

    if side == "LONG" and not (rounded_sl < rounded_entry < rounded_tp):
        reject_reasons.append("LONG requires StopLoss < Entry < TakeProfit.")
    if side == "SHORT" and not (rounded_tp < rounded_entry < rounded_sl):
        reject_reasons.append("SHORT requires TakeProfit < Entry < StopLoss.")

    stop_distance = abs(rounded_entry - rounded_sl)
    reward_distance = abs(rounded_tp - rounded_entry)
    risk_reward_ratio = round(reward_distance / stop_distance, 2) if stop_distance > 0 else 0.0

    if stop_distance <= 0:
        reject_reasons.append("Stop Loss distance must be greater than zero.")
    elif risk_reward_ratio < risk_config.target_risk_reward:
        reject_reasons.append(
            f"Risk/Reward {risk_reward_ratio}:1 below minimum 1:{risk_config.target_risk_reward:.1f}."
        )

    max_risk_usd = equity_usd * (risk_config.risk_per_trade_pct / 100.0)
    risk_based_qty = max_risk_usd / stop_distance if stop_distance > 0 else 0.0
    max_notional_allowed = available_balance_usd * risk_config.max_leverage * 0.95
    leverage_capped_qty = max_notional_allowed / rounded_entry if rounded_entry > 0 else 0.0

    raw_qty = min(risk_based_qty, leverage_capped_qty)
    quantity = floor_to_step(raw_qty, flt.step_size)
    notional_usd = round(quantity * rounded_entry, 2)
    initial_margin_usd = round(notional_usd / risk_config.max_leverage, 2)
    actual_risk_usd = round(quantity * stop_distance, 2)
    risk_pct_of_equity = round((actual_risk_usd / equity_usd) * 100.0, 3) if equity_usd > 0 else 0.0

    if quantity < flt.min_qty:
        reject_reasons.append(
            f"Calculated quantity {quantity} below exchange minQty {flt.min_qty}."
        )
    if notional_usd < flt.min_notional:
        reject_reasons.append(
            f"Order notional ${notional_usd:.2f} below Binance Futures minimum ${flt.min_notional}."
        )

    return SizingValidationResult(
        approved=len(reject_reasons) == 0,
        reject_reasons=reject_reasons,
        quantity=quantity,
        notional_usd=notional_usd,
        initial_margin_usd=initial_margin_usd,
        risk_amount_usd=actual_risk_usd,
        risk_pct_of_equity=risk_pct_of_equity,
        risk_reward_ratio=risk_reward_ratio,
        rounded_entry=rounded_entry,
        rounded_sl=rounded_sl,
        rounded_tp=rounded_tp,
    )
