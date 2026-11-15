import type { PositionSide, RiskConfig, TradingMode } from '../../src/types/hq.ts';

export interface SymbolExchangeFilter {
  symbol: string;
  stepSize: number;
  tickSize: number;
  minQty: number;
  minNotional: number;
}

export const DEFAULT_SYMBOL_FILTERS: Record<string, SymbolExchangeFilter> = {
  BTCUSDT: { symbol: 'BTCUSDT', stepSize: 0.001, tickSize: 0.1, minQty: 0.001, minNotional: 100 },
  ETHUSDT: { symbol: 'ETHUSDT', stepSize: 0.001, tickSize: 0.01, minQty: 0.001, minNotional: 20 },
  SOLUSDT: { symbol: 'SOLUSDT', stepSize: 0.1, tickSize: 0.01, minQty: 0.1, minNotional: 10 },
  BNBUSDT: { symbol: 'BNBUSDT', stepSize: 0.01, tickSize: 0.01, minQty: 0.01, minNotional: 10 },
};

export function floorToStep(value: number, step: number): number {
  if (step <= 0) return value;
  const decimals = Math.max(0, Math.round(-Math.log10(step)));
  const floored = Math.floor(value / step + 1e-9) * step;
  return Number(floored.toFixed(decimals));
}

export function roundToTick(value: number, tick: number): number {
  if (tick <= 0) return value;
  const decimals = Math.max(0, Math.round(-Math.log10(tick)));
  const rounded = Math.round(value / tick) * tick;
  return Number(rounded.toFixed(decimals));
}

export interface SizingValidationResult {
  approved: boolean;
  rejectReasons: string[];
  quantity: number;
  notionalUsd: number;
  initialMarginUsd: number;
  riskAmountUsd: number;
  riskPctOfEquity: number;
  riskRewardRatio: number;
  roundedEntry: number;
  roundedSl: number;
  roundedTp: number;
}

export function computeDeterministicPositionSize(input: {
  mode: TradingMode;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  equityUsd: number;
  availableBalanceUsd: number;
  dailyPnlPct: number;
  openPositionsCount: number;
  hasDuplicateSymbolOpen: boolean;
  dataIsFresh: boolean;
  riskConfig: RiskConfig;
  filter?: SymbolExchangeFilter;
}): SizingValidationResult {
  const {
    mode,
    symbol,
    side,
    entryPrice,
    stopLossPrice,
    takeProfitPrice,
    equityUsd,
    availableBalanceUsd,
    dailyPnlPct,
    openPositionsCount,
    hasDuplicateSymbolOpen,
    dataIsFresh,
    riskConfig,
  } = input;

  const filter = input.filter ?? DEFAULT_SYMBOL_FILTERS[symbol.toUpperCase()] ?? {
    symbol: symbol.toUpperCase(),
    stepSize: 0.001,
    tickSize: 0.01,
    minQty: 0.001,
    minNotional: 20,
  };

  const rejectReasons: string[] = [];

  if (riskConfig.emergencyKillSwitch) {
    rejectReasons.push('Emergency Kill Switch is ARMED.');
  }
  if (mode === 'LIVE') {
    rejectReasons.push('LIVE execution is locked until Phase 7 acceptance tests pass.');
  }
  if (mode === 'DEMO') {
    rejectReasons.push('Switch mode to PAPER or TESTNET to execute orders (DEMO is read-only).');
  }
  if (!dataIsFresh) {
    rejectReasons.push('Binance market feed is stale or disconnected.');
  }
  if (equityUsd <= 0 || availableBalanceUsd <= 0) {
    rejectReasons.push('Insufficient account equity or available margin.');
  }
  if (dailyPnlPct <= -riskConfig.maxDailyLossPct) {
    rejectReasons.push(
      `Daily loss limit reached (${dailyPnlPct.toFixed(2)}% <= -${riskConfig.maxDailyLossPct.toFixed(2)}%).`,
    );
  }
  if (openPositionsCount >= riskConfig.maxSimultaneousPositions) {
    rejectReasons.push(
      `Max simultaneous positions (${riskConfig.maxSimultaneousPositions}) already open.`,
    );
  }
  if (hasDuplicateSymbolOpen) {
    rejectReasons.push(`An open position for ${symbol} already exists (ONE_WAY mode).`);
  }

  const roundedEntry = roundToTick(entryPrice, filter.tickSize);
  const roundedSl = roundToTick(stopLossPrice, filter.tickSize);
  const roundedTp = roundToTick(takeProfitPrice, filter.tickSize);

  if (side === 'LONG' && !(roundedSl < roundedEntry && roundedEntry < roundedTp)) {
    rejectReasons.push('LONG requires StopLoss < Entry < TakeProfit.');
  }
  if (side === 'SHORT' && !(roundedTp < roundedEntry && roundedEntry < roundedSl)) {
    rejectReasons.push('SHORT requires TakeProfit < Entry < StopLoss.');
  }

  const stopDistance = Math.abs(roundedEntry - roundedSl);
  const rewardDistance = Math.abs(roundedTp - roundedEntry);
  const riskRewardRatio = stopDistance > 0 ? Number((rewardDistance / stopDistance).toFixed(2)) : 0;

  if (stopDistance <= 0) {
    rejectReasons.push('Stop Loss distance must be greater than zero.');
  } else if (riskRewardRatio < riskConfig.targetRiskReward) {
    rejectReasons.push(
      `Risk/Reward ${riskRewardRatio}:1 below minimum 1:${riskConfig.targetRiskReward.toFixed(1)}.`,
    );
  }

  const maxRiskUsd = equityUsd * (riskConfig.riskPerTradePct / 100);
  const riskBasedQty = stopDistance > 0 ? maxRiskUsd / stopDistance : 0;
  const maxNotionalAllowed = availableBalanceUsd * riskConfig.maxLeverage * 0.95;
  const leverageCappedQty = roundedEntry > 0 ? maxNotionalAllowed / roundedEntry : 0;

  const rawQty = Math.min(riskBasedQty, leverageCappedQty);
  const quantity = floorToStep(rawQty, filter.stepSize);
  const notionalUsd = Number((quantity * roundedEntry).toFixed(2));
  const initialMarginUsd = Number((notionalUsd / riskConfig.maxLeverage).toFixed(2));
  const actualRiskUsd = Number((quantity * stopDistance).toFixed(2));
  const riskPctOfEquity = equityUsd > 0 ? Number(((actualRiskUsd / equityUsd) * 100).toFixed(3)) : 0;

  if (quantity < filter.minQty) {
    rejectReasons.push(
      `Calculated quantity ${quantity} below exchange minQty ${filter.minQty} (stop distance too wide for ${riskConfig.riskPerTradePct}% risk).`,
    );
  }
  if (notionalUsd < filter.minNotional) {
    rejectReasons.push(
      `Order notional $${notionalUsd.toFixed(2)} below Binance Futures minimum $${filter.minNotional}. Adjust SL tighter or equity higher.`,
    );
  }

  return {
    approved: rejectReasons.length === 0,
    rejectReasons,
    quantity,
    notionalUsd,
    initialMarginUsd,
    riskAmountUsd: actualRiskUsd,
    riskPctOfEquity,
    riskRewardRatio,
    roundedEntry,
    roundedSl,
    roundedTp,
  };
}
