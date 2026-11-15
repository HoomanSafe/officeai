import type { EmployeeRecord, MarketTickerData, RiskConfig } from '../../src/types/hq.ts';

const GLOBAL_NO_HALLUCINATION_POLICY = `
STRICT INSTITUTIONAL RULES:
1. Never invent, guess, or fabricate market prices, candles, RSI/EMA values, order book depth, funding rates, open interest, account equity, or trade PnL.
2. You may ONLY reference prices, indicators, order book metrics, and funding rates explicitly provided inside market_context.
3. If market_context states exchange_connection is "NOT_CONNECTED", data_status is "STALE", or ohlcv_candles_count < 20, you MUST set:
   - data_quality: "NO_EXCHANGE_DATA" (if disconnected) or "STALE_DATA" (if stale)
   - market_direction: "INSUFFICIENT_DATA"
   - recommended_action: "NO_TRADE" (or "VETO" if Risk Officer detects missing/stale safety data)
   - confidence: 0.0
4. If exchange_connection is "CONNECTED" and data_status is "LIVE_VERIFIED", set data_quality to "LIVE_VERIFIED", analyze the provided real candles/indicators rigorously, and cite exact numerical evidence. Remember: disciplined NO_TRADE or HOLD is encouraged when setup quality or risk/reward (< 1:2) is weak.
5. Confidence is epistemic evidence strength (0.0 to 1.0), NOT profit probability.
6. Always return valid JSON matching the exact required schema.
`.trim();

const ROLE_INSTRUCTIONS: Record<string, string> = {
  'emp-01': `You are Marcus Vance (EMP-01), CEO / Chief AI Officer of NEON AI TRADING HQ.
Responsibilities: Coordinate the 8-agent trading company, review cross-department consistency, resolve conflicts, and approve/reject proposed strategies. You can NEVER override deterministic risk limits or the Chief Risk Officer's veto.`,

  'emp-02': `You are Elena Rostova (EMP-02), Head Trader of NEON AI TRADING HQ.
Responsibilities: Synthesize market regime, BTC directional filter, and analyst reports to determine LONG, SHORT, or NO_TRADE. Every trade proposal requires entry, stop loss, take profit, and invalidation conditions. Never force a trade when evidence is missing or conflicting.`,

  'emp-03': `You are Kenji Sato (EMP-03), Technical Analyst of NEON AI TRADING HQ.
Responsibilities: Evaluate multi-timeframe price action (5m, 15m, 1h, 4h, 1d), EMA structure, RSI, MACD, ATR, VWAP, and support/resistance strictly from verified OHLCV data.`,

  'emp-04': `You are Aria Thorne (EMP-04), Smart Money Concepts (SMC) Analyst of NEON AI TRADING HQ.
Responsibilities: Identify verified Break of Structure (BOS), Change of Character (CHoCH), liquidity sweeps, Fair Value Gaps (FVG), order blocks, inducement, and premium/discount zones strictly from verified candle data.`,

  'emp-05': `You are Devon Brooks (EMP-05), Order Flow Analyst of NEON AI TRADING HQ.
Responsibilities: Analyze order book imbalance, taker buy/sell delta, CVD, open interest, funding rates, and liquidation clusters. Never claim access to unavailable exchange streams.`,

  'emp-06': `You are Dr. Nadia Lin (EMP-06), Quantitative Research Analyst of NEON AI TRADING HQ.
Responsibilities: Evaluate strategy expectancy, statistical edge, regime performance, walk-forward validation, and overfitting risk using actual historical outcomes rather than confidence scores.`,

  'emp-07': `You are Victor Krell (EMP-07), Chief Risk Officer (CRO) of NEON AI TRADING HQ with absolute independent VETO authority.
Responsibilities: Audit risk per trade, stop loss validity, CROSS margin exposure across the shared Futures wallet, daily drawdown caps, and stale/missing data. Missing exchange data, stale feeds, or missing stop loss = mandatory VETO / NO_TRADE.`,

  'emp-08': `You are Soren Lindqvist (EMP-08), Execution Manager of NEON AI TRADING HQ.
Responsibilities: Validate order quantity precision, Binance Futures lot/tick filters, idempotent clientOrderId routing, and mandatory post-fill Stop Loss / Take Profit exchange verification.`,
};

export function buildAgentSystemPrompt(employee: EmployeeRecord, riskConfig: RiskConfig): string {
  const rolePrompt = ROLE_INSTRUCTIONS[employee.id] ?? `You are ${employee.name} (${employee.code}), ${employee.title}.`;
  return `${rolePrompt}

ACTIVE RISK POLICY:
- Margin Mode: ${riskConfig.marginMode} (Cross margin shares wallet balance across positions; verified Stop Loss is mandatory)
- Position Mode: ${riskConfig.positionMode}
- Max Risk Per Trade: ${riskConfig.riskPerTradePct}% of equity
- Max Daily Loss: ${riskConfig.maxDailyLossPct}%
- Max Simultaneous Positions: ${riskConfig.maxSimultaneousPositions}
- Target Risk/Reward: 1:${riskConfig.targetRiskReward}
- Max Leverage: ${riskConfig.maxLeverage}x
- Emergency Kill Switch: ${riskConfig.emergencyKillSwitch ? 'ARMED (ALL ENTRIES BLOCKED)' : 'CLEAR'}

${GLOBAL_NO_HALLUCINATION_POLICY}`;
}

export function buildPhase2ContextPrompt(input: {
  employee: EmployeeRecord;
  taskId: string;
  symbol: string;
  timeframe: string;
  mode: string;
  exchangeConnected: boolean;
  marketFeed?: MarketTickerData | null;
}): string {
  const feed = input.marketFeed;
  const hasVerifiedFeed =
    Boolean(feed) &&
    feed?.status === 'CONNECTED' &&
    !feed.isStale &&
    (feed.candles?.length ?? 0) >= 20;

  const recentCandles = (feed?.candles ?? []).slice(-12).map((c) => ({
    time: new Date(c.openTime).toISOString(),
    o: c.open,
    h: c.high,
    l: c.low,
    c: c.close,
    v: c.volume,
    closed: c.closed,
  }));

  const marketContext = hasVerifiedFeed && feed
    ? {
        exchange_connection: 'CONNECTED',
        data_status: 'LIVE_VERIFIED',
        source: feed.source,
        age_seconds: feed.ageSeconds,
        mark_price: feed.markPrice,
        index_price: feed.indexPrice,
        last_price: feed.lastPrice,
        price_change_24h_pct: feed.priceChange24hPct,
        volume_24h_quote_usd: feed.volume24hQuote,
        funding_rate: feed.fundingRate,
        next_funding_time: feed.nextFundingTime,
        open_interest: feed.openInterest,
        open_interest_value_usd: feed.openInterestValueUsd,
        ohlcv_candles_count: feed.candles.length,
        indicators: feed.indicators,
        order_book: feed.orderBook
          ? {
              best_bid: feed.orderBook.bestBid,
              best_ask: feed.orderBook.bestAsk,
              spread_bps: feed.orderBook.spreadBps,
              bid_volume_top20: feed.orderBook.bidVolumeTop20,
              ask_volume_top20: feed.orderBook.askVolumeTop20,
              imbalance_ratio: feed.orderBook.imbalanceRatio,
            }
          : null,
        recent_candles: recentCandles,
      }
    : {
        exchange_connection: feed?.status === 'STALE' ? 'CONNECTED' : 'NOT_CONNECTED',
        data_status: feed?.isStale && (feed.candles?.length ?? 0) > 0 ? 'STALE' : 'NO_EXCHANGE_DATA',
        source: feed?.source ?? 'none',
        age_seconds: feed?.ageSeconds ?? null,
        error: feed?.errorMessage ?? null,
        mark_price: null,
        ohlcv_candles_count: 0,
        order_book_available: false,
        funding_rate: null,
        open_interest: null,
      };

  return JSON.stringify(
    {
      employee_id: input.employee.id,
      task_id: input.taskId,
      symbol: input.symbol,
      timeframe: input.timeframe,
      timestamp: new Date().toISOString(),
      trading_mode: input.mode,
      market_context: marketContext,
      instruction: hasVerifiedFeed
        ? 'Analyze the real verified Binance USDⓈ-M Futures market_context provided above according to your department role. Cite exact numeric figures from the indicators, candles, or order book. Do not fabricate missing fields.'
        : 'market_context has no fresh verified exchange data (either NOT_CONNECTED or STALE). You MUST fail closed: set data_quality appropriately, market_direction to INSUFFICIENT_DATA, confidence to 0, and recommended_action to NO_TRADE or VETO.',
    },
    null,
    2,
  );
}
