from typing import Literal
from pydantic import BaseModel, Field


class AgentStructuredReport(BaseModel):
    employee_id: str
    task_id: str
    symbol: str
    timeframe: str
    timestamp: str
    market_direction: Literal["BULLISH", "BEARISH", "NEUTRAL", "INSUFFICIENT_DATA"]
    findings: list[str]
    supporting_evidence: list[str]
    confidence: float = Field(ge=0.0, le=1.0)
    invalidation_conditions: list[str]
    recommended_action: Literal["LONG", "SHORT", "NO_TRADE", "HOLD", "VETO"]
    reasoning_summary: str = Field(min_length=1)
    data_quality: Literal["LIVE_VERIFIED", "NO_EXCHANGE_DATA", "STALE_DATA", "SCHEMA_FALLBACK"]


class RiskPolicyConfig(BaseModel):
    risk_per_trade_pct: float = Field(default=0.15, ge=0.05, le=2.0)
    max_daily_loss_pct: float = Field(default=1.0, ge=0.25, le=5.0)
    max_simultaneous_positions: int = Field(default=2, ge=1, le=5)
    target_risk_reward: float = Field(default=2.0, ge=1.2, le=5.0)
    max_leverage: int = Field(default=3, ge=1, le=10)
    margin_mode: Literal["CROSS", "ISOLATED"] = "CROSS"
    position_mode: Literal["ONE_WAY"] = "ONE_WAY"
