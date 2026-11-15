import { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import type { CandleTimeframe, OfficeSnapshot } from '../types/hq';

interface MarketAnalysisViewProps {
  snapshot: OfficeSnapshot;
  onRefreshMarket: (input?: { symbol?: string; timeframe?: CandleTimeframe }) => Promise<unknown>;
  onUpdateMarketConfig: (patch: {
    activeSymbol?: string;
    activeTimeframe?: CandleTimeframe;
    autoSyncEnabled?: boolean;
    staleThresholdSeconds?: number;
  }) => Promise<unknown>;
  onNavigateSettings: () => void;
}

const TIMEFRAMES: CandleTimeframe[] = ['5m', '15m', '1h', '4h', '1d'];

function computeRollingEma(values: number[], period: number): Array<number | null> {
  if (values.length < period) return values.map(() => null);
  const out: Array<number | null> = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = ema;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    out[i] = Number(ema.toFixed(2));
  }
  return out;
}

function formatUsd(val: number | null, decimals = 2): string {
  if (val === null || !Number.isFinite(val)) return '—';
  return `$${val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function MarketAnalysisView({
  snapshot,
  onRefreshMarket,
  onUpdateMarketConfig,
  onNavigateSettings,
}: MarketAnalysisViewProps) {
  const { marketData } = snapshot;
  const [syncing, setSyncing] = useState(false);

  const activeFeed = marketData.feeds[marketData.activeSymbol];

  const chartData = useMemo(() => {
    const candles = activeFeed?.candles ?? [];
    if (candles.length === 0) return [];
    const closes = candles.map((c) => c.close);
    const ema20 = computeRollingEma(closes, 20);
    const ema50 = computeRollingEma(closes, 50);

    return candles.slice(-80).map((c, idx) => {
      const fullIdx = candles.length - Math.min(80, candles.length) + idx;
      return {
        time: new Date(c.openTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        close: c.close,
        high: c.high,
        low: c.low,
        volume: Number(c.volume.toFixed(2)),
        ema20: ema20[fullIdx],
        ema50: ema50[fullIdx],
      };
    });
  }, [activeFeed]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await onRefreshMarket({
        symbol: marketData.activeSymbol,
        timeframe: marketData.activeTimeframe,
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectSymbol = async (sym: string) => {
    setSyncing(true);
    try {
      await onUpdateMarketConfig({ activeSymbol: sym });
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectTimeframe = async (tf: CandleTimeframe) => {
    setSyncing(true);
    try {
      await onUpdateMarketConfig({ activeTimeframe: tf });
    } finally {
      setSyncing(false);
    }
  };

  const statusColor =
    activeFeed?.status === 'CONNECTED'
      ? 'text-emerald-400'
      : activeFeed?.status === 'STALE'
        ? 'text-amber-300'
        : 'text-rose-400';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Feed Guard Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className={`text-xs font-mono ${statusColor}`}>
            PHASE 3 MARKET DATA ENGINE · {activeFeed?.status ?? 'NOT_CONNECTED'} ·{' '}
            {activeFeed?.source ?? 'binance-fapi-public'}
          </div>
          <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold text-white">
            Binance USDⓈ-M Market Analysis & Derivatives Feed
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Real OHLCV candles, EMA/RSI/MACD/ATR/VWAP, order book imbalance, funding rate, and open interest with automated Stale-Data Guard.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onUpdateMarketConfig({ autoSyncEnabled: !marketData.autoSyncEnabled })}
            className={`px-3 py-2 rounded-lg text-xs font-mono border transition-colors ${
              marketData.autoSyncEnabled
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            Auto-Sync: {marketData.autoSyncEnabled ? `ON (${marketData.syncIntervalSeconds}s)` : 'OFF'}
          </button>

          <button
            type="button"
            disabled={syncing}
            onClick={() => void handleManualSync()}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing Binance...' : 'Sync Live Binance Data'}</span>
          </button>

          <button
            type="button"
            onClick={onNavigateSettings}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
          >
            Risk & API Status
          </button>
        </div>
      </div>

      {/* API Clarification Note */}
      <div className="bg-[#0B1120] border border-cyan-500/30 rounded-xl px-4 py-3 flex items-start gap-3 text-xs">
        <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-slate-300 space-y-0.5">
          <div className="font-medium text-white">
            0 API Keys Required for Phase 3 Market Data · Gemini Active for AI Employees
          </div>
          <p className="text-slate-400">
            Live Futures candles, funding rates, open interest, and order book depth stream directly from public Binance endpoints without private credentials. Your Binance API Key & Secret are only needed later in Phase 5 for private order execution (configured safely in server <span className="font-mono text-slate-200">.env</span>, never in browser UI).
          </p>
        </div>
      </div>

      {/* Symbol & Timeframe Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0B1120] border border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          {marketData.watchedSymbols.map((sym) => {
            const active = sym === marketData.activeSymbol;
            return (
              <button
                key={sym}
                type="button"
                onClick={() => void handleSelectSymbol(sym)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                  active
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200 font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {sym}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {TIMEFRAMES.map((tf) => {
            const active = tf === marketData.activeTimeframe;
            return (
              <button
                key={tf}
                type="button"
                onClick={() => void handleSelectTimeframe(tf)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  active
                    ? 'bg-violet-500/25 border border-violet-500/60 text-violet-200 font-semibold'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            );
          })}
        </div>

        <div className="text-xs font-mono text-slate-400 tabular-nums">
          Feed Age:{' '}
          <span className={activeFeed?.isStale ? 'text-amber-300' : 'text-emerald-400'}>
            {activeFeed?.ageSeconds !== null && activeFeed?.ageSeconds !== undefined
              ? `${activeFeed.ageSeconds}s / ${marketData.staleThresholdSeconds}s max`
              : 'Not synced'}
          </span>
        </div>
      </div>

      {/* Error Notice if Exchange Unreachable */}
      {activeFeed?.errorMessage && (
        <div className="bg-rose-950/60 border border-rose-500/40 rounded-xl p-4 text-xs text-rose-200 font-mono">
          Exchange Sync Error: {activeFeed.errorMessage}
        </div>
      )}

      {/* Top Market Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Mark Price</div>
          <div className="mt-1.5 font-mono text-lg font-semibold text-white tabular-nums">
            {formatUsd(activeFeed?.markPrice ?? null)}
          </div>
          <div className="mt-1 text-xs font-mono text-slate-500 tabular-nums">
            Index {formatUsd(activeFeed?.indexPrice ?? null)}
          </div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">24h Change</div>
          <div
            className={`mt-1.5 font-mono text-lg font-semibold tabular-nums ${
              (activeFeed?.priceChange24hPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {activeFeed?.priceChange24hPct !== null && activeFeed?.priceChange24hPct !== undefined
              ? `${activeFeed.priceChange24hPct >= 0 ? '+' : ''}${activeFeed.priceChange24hPct.toFixed(2)}%`
              : '—'}
          </div>
          <div className="mt-1 text-xs font-mono text-slate-500 tabular-nums">
            Vol{' '}
            {activeFeed?.volume24hQuote
              ? `$${(activeFeed.volume24hQuote / 1e9).toFixed(2)}B`
              : '—'}
          </div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Funding Rate</div>
          <div className="mt-1.5 font-mono text-lg font-semibold text-cyan-300 tabular-nums">
            {activeFeed?.fundingRate !== null && activeFeed?.fundingRate !== undefined
              ? `${(activeFeed.fundingRate * 100).toFixed(4)}%`
              : '—'}
          </div>
          <div className="mt-1 text-xs font-mono text-slate-500 truncate">
            {activeFeed?.nextFundingTime
              ? `Next ${new Date(activeFeed.nextFundingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : '8h interval'}
          </div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Open Interest</div>
          <div className="mt-1.5 font-mono text-lg font-semibold text-slate-100 tabular-nums">
            {activeFeed?.openInterestValueUsd
              ? `$${(activeFeed.openInterestValueUsd / 1e9).toFixed(2)}B`
              : '—'}
          </div>
          <div className="mt-1 text-xs font-mono text-slate-500 tabular-nums">
            {activeFeed?.openInterest !== null && activeFeed?.openInterest !== undefined
              ? `${activeFeed.openInterest.toLocaleString('en-US', { maximumFractionDigits: 0 })} contracts`
              : '—'}
          </div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Market Regime</div>
          <div className="mt-1.5 font-mono text-sm font-semibold text-violet-300">
            {activeFeed?.indicators.regime ?? 'UNKNOWN'}
          </div>
          <div className="mt-1 text-xs font-mono text-slate-500 tabular-nums">
            ATR {activeFeed?.indicators.atrPct !== null && activeFeed?.indicators.atrPct !== undefined ? `${activeFeed.indicators.atrPct}%` : '—'}
          </div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Book Imbalance</div>
          <div
            className={`mt-1.5 font-mono text-lg font-semibold tabular-nums ${
              (activeFeed?.orderBook?.imbalanceRatio ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {activeFeed?.orderBook
              ? `${(activeFeed.orderBook.imbalanceRatio * 100).toFixed(1)}%`
              : '—'}
          </div>
          <div className="mt-1 text-xs font-mono text-slate-500 tabular-nums">
            Spread {activeFeed?.orderBook ? `${activeFeed.orderBook.spreadBps} bps` : '—'}
          </div>
        </div>
      </div>

      {/* Price Chart + Indicators + Order Book */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
                {marketData.activeSymbol} Perpetual ({marketData.activeTimeframe}) · Close + EMA20 / EMA50
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                {activeFeed?.candles.length ?? 0} verified OHLCV candles loaded
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-cyan-400">Close</span>
              <span className="text-amber-400">EMA 20</span>
              <span className="text-violet-400">EMA 50</span>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-xs font-mono text-slate-500 border border-dashed border-slate-800 rounded-lg">
              No verified candles loaded yet. Click Sync Live Binance Data above.
            </div>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="time"
                    stroke="#64748B"
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                    minTickGap={24}
                  />
                  <YAxis
                    yAxisId="price"
                    domain={['auto', 'auto']}
                    stroke="#64748B"
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                    width={68}
                  />
                  <YAxis yAxisId="vol" orientation="right" hide domain={[0, (max: number) => max * 4]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#070B16',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar yAxisId="vol" dataKey="volume" fill="#1E293B" opacity={0.65} />
                  <Area
                    yAxisId="price"
                    type="monotone"
                    dataKey="close"
                    stroke="#06B6D4"
                    strokeWidth={2}
                    fill="url(#priceFill)"
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="price"
                    type="monotone"
                    dataKey="ema20"
                    stroke="#F59E0B"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="price"
                    type="monotone"
                    dataKey="ema50"
                    stroke="#8B5CF6"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Computed Technical Indicators */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80 text-xs">
            <div className="bg-slate-900/70 rounded-lg p-2.5">
              <div className="text-slate-400">EMA 20 / 50</div>
              <div className="mt-1 font-mono text-slate-100 tabular-nums">
                {activeFeed?.indicators.ema20?.toFixed(2) ?? '—'} /{' '}
                {activeFeed?.indicators.ema50?.toFixed(2) ?? '—'}
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-lg p-2.5">
              <div className="text-slate-400">EMA 200 / VWAP</div>
              <div className="mt-1 font-mono text-slate-100 tabular-nums">
                {activeFeed?.indicators.ema200?.toFixed(2) ?? '—'} /{' '}
                {activeFeed?.indicators.vwap?.toFixed(2) ?? '—'}
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-lg p-2.5">
              <div className="text-slate-400">RSI (14)</div>
              <div className="mt-1 font-mono text-cyan-300 tabular-nums">
                {activeFeed?.indicators.rsi14 ?? '—'}
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-lg p-2.5">
              <div className="text-slate-400">MACD (12,26,9) Hist</div>
              <div
                className={`mt-1 font-mono tabular-nums ${
                  (activeFeed?.indicators.macd?.histogram ?? 0) >= 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {activeFeed?.indicators.macd?.histogram ?? '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Live Order Book Depth (Top 8 Bids & Asks) */}
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 flex flex-col space-y-4">
          <div className="pb-3 border-b border-slate-800">
            <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
              Order Book Snapshot (Top 20 Depth)
            </h2>
            <p className="text-xs font-mono text-slate-400">
              Best Bid {formatUsd(activeFeed?.orderBook?.bestBid ?? null)} · Best Ask{' '}
              {formatUsd(activeFeed?.orderBook?.bestAsk ?? null)}
            </p>
          </div>

          {!activeFeed?.orderBook ? (
            <div className="flex-1 flex items-center justify-center text-xs font-mono text-slate-500">
              Order book awaiting live sync.
            </div>
          ) : (
            <div className="space-y-3 text-xs font-mono tabular-nums">
              <div>
                <div className="flex justify-between text-slate-500 mb-1">
                  <span>ASK PRICE</span>
                  <span>QTY</span>
                </div>
                <div className="space-y-1">
                  {[...activeFeed.orderBook.topAsks].reverse().map(([price, qty], i) => (
                    <div key={`ask-${i}`} className="flex justify-between text-rose-300 bg-rose-950/20 px-2 py-1 rounded">
                      <span>{price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      <span>{qty.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="py-1.5 border-y border-slate-800 flex justify-between text-slate-300">
                <span>Bid Vol: {activeFeed.orderBook.bidVolumeTop20}</span>
                <span>Ask Vol: {activeFeed.orderBook.askVolumeTop20}</span>
              </div>

              <div>
                <div className="flex justify-between text-slate-500 mb-1">
                  <span>BID PRICE</span>
                  <span>QTY</span>
                </div>
                <div className="space-y-1">
                  {activeFeed.orderBook.topBids.map(([price, qty], i) => (
                    <div key={`bid-${i}`} className="flex justify-between text-emerald-300 bg-emerald-950/20 px-2 py-1 rounded">
                      <span>{price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      <span>{qty.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
