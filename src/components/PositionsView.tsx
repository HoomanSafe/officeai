import { useState } from 'react';
import { RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { OfficeSnapshot, PositionSide, TradingMode } from '../types/hq';

interface PositionsViewProps {
  snapshot: OfficeSnapshot;
  onChangeMode: (mode: TradingMode) => void;
  onReconcile: () => Promise<unknown>;
  onResetPaper: () => Promise<unknown>;
  onExecuteOrder: (input: {
    symbol: string;
    side: PositionSide;
    entryPrice?: number;
    stopLossPrice: number;
    takeProfitPrice: number;
  }) => Promise<unknown>;
  onClosePosition: (positionId: string) => Promise<unknown>;
}

export function PositionsView({
  snapshot,
  onChangeMode,
  onReconcile,
  onResetPaper,
  onExecuteOrder,
  onClosePosition,
}: PositionsViewProps) {
  const { execution, marketData, riskConfig } = snapshot;
  const activeAccount =
    snapshot.mode === 'TESTNET' ? execution.testnetAccount : execution.paperAccount;

  const [symbol, setSymbol] = useState(marketData.activeSymbol || 'BTCUSDT');
  const liveFeed = marketData.feeds[symbol];
  const liveMark = liveFeed?.markPrice ?? 65000;

  const [side, setSide] = useState<PositionSide>('LONG');
  const [slInput, setSlInput] = useState(() => Number((liveMark * 0.99).toFixed(2)));
  const [tpInput, setTpInput] = useState(() => Number((liveMark * 1.022).toFixed(2)));
  const [submitting, setSubmitting] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const handleSymbolChange = (nextSym: string) => {
    setSymbol(nextSym);
    const nextMark = marketData.feeds[nextSym]?.markPrice ?? 100;
    if (side === 'LONG') {
      setSlInput(Number((nextMark * 0.99).toFixed(2)));
      setTpInput(Number((nextMark * 1.022).toFixed(2)));
    } else {
      setSlInput(Number((nextMark * 1.01).toFixed(2)));
      setTpInput(Number((nextMark * 0.978).toFixed(2)));
    }
  };

  const handleSideChange = (nextSide: PositionSide) => {
    setSide(nextSide);
    const refMark = marketData.feeds[symbol]?.markPrice ?? liveMark;
    if (nextSide === 'LONG') {
      setSlInput(Number((refMark * 0.99).toFixed(2)));
      setTpInput(Number((refMark * 1.022).toFixed(2)));
    } else {
      setSlInput(Number((refMark * 1.01).toFixed(2)));
      setTpInput(Number((refMark * 0.978).toFixed(2)));
    }
  };

  const riskDist = Math.abs(liveMark - slInput);
  const rewardDist = Math.abs(tpInput - liveMark);
  const previewRr = riskDist > 0 ? Number((rewardDist / riskDist).toFixed(2)) : 0;
  const previewRiskUsd = Number(
    (activeAccount.equityUsd * (riskConfig.riskPerTradePct / 100)).toFixed(2),
  );
  const previewQty = riskDist > 0 ? Number((previewRiskUsd / riskDist).toFixed(4)) : 0;

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onExecuteOrder({
        symbol,
        side,
        entryPrice: liveFeed?.markPrice ?? undefined,
        stopLossPrice: Number(slInput),
        takeProfitPrice: Number(tpInput),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      await onReconcile();
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="text-xs font-mono text-cyan-400">
            PHASE 5 RISK & EXECUTION ENGINE · MODE: {snapshot.mode} · VENUE: {execution.activeVenue}
          </div>
          <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold text-white">
            Positions, Execution Router & SL/TP Verification
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Execute deterministic {riskConfig.marginMode} margin trades in PAPER Simulator or Binance USDⓈ-M Testnet with mandatory post-order Stop Loss verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['DEMO', 'PAPER', 'TESTNET'] as TradingMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChangeMode(m)}
              className={`px-3 py-2 rounded-lg text-xs font-mono border transition-colors ${
                snapshot.mode === m
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200 font-semibold'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
            >
              {m}
            </button>
          ))}
          <button
            type="button"
            disabled={reconciling}
            onClick={() => void handleReconcile()}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:text-white inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reconciling ? 'animate-spin' : ''}`} />
            <span>Reconcile Testnet</span>
          </button>
          <button
            type="button"
            onClick={() => void onResetPaper()}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
          >
            Reset PAPER ($10k)
          </button>
        </div>
      </div>

      {/* Mode Warning if DEMO */}
      {snapshot.mode === 'DEMO' && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 flex items-center justify-between gap-4 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Currently in <strong>DEMO</strong> mode (read-only). Switch to <strong>PAPER</strong> (instant virtual $10,000 simulator using live Binance prices) or <strong>TESTNET</strong> (requires Binance Futures Testnet API keys in server <span className="font-mono">.env</span>) to test order execution.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onChangeMode('PAPER')}
            className="px-3 py-1.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-100 font-mono whitespace-nowrap"
          >
            Switch to PAPER
          </button>
        </div>
      )}

      {/* Testnet Connection Note if TESTNET */}
      {snapshot.mode === 'TESTNET' && !execution.testnetAccount.connected && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-4 text-xs text-rose-200 space-y-1">
          <div className="font-mono font-semibold text-rose-300">
            BINANCE TESTNET STATUS: NOT CONNECTED
          </div>
          <p>{execution.testnetAccount.errorMessage}</p>
          <p className="text-slate-400">
            Note: Binance Futures Testnet (<span className="font-mono">testnet.binancefuture.com</span>) uses Testnet-specific API keys set in server <span className="font-mono">BINANCE_API_KEY</span> & <span className="font-mono">BINANCE_API_SECRET</span>.
          </p>
        </div>
      )}

      {/* Account Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">
            {snapshot.mode === 'TESTNET' ? 'Testnet Equity' : 'PAPER Equity'}
          </div>
          <div className="mt-1.5 font-mono text-xl font-semibold text-white tabular-nums">
            {activeAccount.connected ? `$${activeAccount.equityUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'NOT CONNECTED'}
          </div>
          <div className="mt-1 text-xs font-mono text-slate-500">
            Avail ${activeAccount.availableBalanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Unrealized PnL</div>
          <div
            className={`mt-1.5 font-mono text-xl font-semibold tabular-nums ${
              activeAccount.unrealizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {activeAccount.unrealizedPnlUsd >= 0 ? '+' : ''}${activeAccount.unrealizedPnlUsd.toFixed(2)}
          </div>
          <div className="mt-1 text-xs font-mono text-slate-500">
            Open: {activeAccount.openPositionsCount} / {riskConfig.maxSimultaneousPositions}
          </div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Realized PnL</div>
          <div
            className={`mt-1.5 font-mono text-xl font-semibold tabular-nums ${
              activeAccount.realizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {activeAccount.realizedPnlUsd >= 0 ? '+' : ''}${activeAccount.realizedPnlUsd.toFixed(2)}
          </div>
          <div className="mt-1 text-xs font-mono text-slate-500">
            Daily PnL: {activeAccount.dailyPnlPct.toFixed(2)}%
          </div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Risk Budget / Trade</div>
          <div className="mt-1.5 font-mono text-xl font-semibold text-cyan-300 tabular-nums">
            ${previewRiskUsd.toFixed(2)}
          </div>
          <div className="mt-1 text-xs font-mono text-slate-500">
            {riskConfig.riskPerTradePct}% · {riskConfig.marginMode} {riskConfig.maxLeverage}x
          </div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Zero Unverified Exposure</div>
          <div className="mt-1.5 font-mono text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>SL VERIFIER ARMED</span>
          </div>
          <div className="mt-1 text-xs font-mono text-slate-500">
            Min R:R 1:{riskConfig.targetRiskReward.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Deterministic Risk-Gated Order Ticket + Positions Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleExecute} className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
          <div className="pb-2 border-b border-slate-800">
            <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
              Risk-Audited Execution Ticket
            </h2>
            <p className="text-slate-400">
              Position quantity is computed deterministically from your Stop Loss distance & {riskConfig.riskPerTradePct}% equity risk cap.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Symbol</label>
              <select
                value={symbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 font-mono text-slate-100"
              >
                {marketData.watchedSymbols.map((sym) => (
                  <option key={sym} value={sym}>
                    {sym}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Side</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['LONG', 'SHORT'] as PositionSide[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSideChange(s)}
                    className={`py-2 rounded-lg font-mono border ${
                      side === s
                        ? s === 'LONG'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold'
                          : 'bg-rose-500/20 border-rose-500 text-rose-300 font-semibold'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/70 rounded-lg p-3 flex justify-between font-mono tabular-nums">
            <span className="text-slate-400">Live Mark Price</span>
            <span className="text-white font-semibold">
              {liveFeed?.markPrice ? `$${liveFeed.markPrice.toFixed(2)}` : 'Syncing...'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Mandatory Stop Loss ($)</label>
              <input
                type="number"
                step="0.01"
                value={slInput}
                onChange={(e) => setSlInput(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 font-mono text-rose-300"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Take Profit ($)</label>
              <input
                type="number"
                step="0.01"
                value={tpInput}
                onChange={(e) => setTpInput(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 font-mono text-emerald-300"
              />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 space-y-1 font-mono tabular-nums">
            <div className="flex justify-between">
              <span className="text-slate-400">Est. Qty ({symbol.replace('USDT', '')})</span>
              <span className="text-slate-100">{previewQty}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Risk : Reward</span>
              <span className={previewRr >= riskConfig.targetRiskReward ? 'text-emerald-400' : 'text-rose-400'}>
                1 : {previewRr} (Min {riskConfig.targetRiskReward})
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || snapshot.mode === 'DEMO' || riskConfig.emergencyKillSwitch}
            className="w-full py-2.5 px-4 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white transition-colors"
          >
            {submitting
              ? 'Routing & Verifying SL/TP...'
              : `Execute ${side} in ${snapshot.mode}`}
          </button>
        </form>

        {/* Positions Table */}
        <div className="lg:col-span-2 bg-[#0B1120] border border-slate-800 rounded-xl p-5 overflow-x-auto">
          <h2 className="font-[var(--font-display)] text-base font-semibold text-white pb-3 border-b border-slate-800">
            Positions & Exchange Stop Loss Verification ({execution.positions.length})
          </h2>

          {execution.positions.length === 0 ? (
            <p className="text-xs text-slate-400 pt-4">
              No positions opened yet. Switch to PAPER or TESTNET and submit a risk-verified ticket or execute an approved War Room proposal.
            </p>
          ) : (
            <table className="w-full text-left text-xs mt-2">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="py-2 pr-3 font-medium">Symbol / Venue</th>
                  <th className="py-2 pr-3 font-medium">Qty / Entry</th>
                  <th className="py-2 pr-3 font-medium">Mark / SL / TP</th>
                  <th className="py-2 pr-3 font-medium">SL Guard</th>
                  <th className="py-2 pr-3 font-medium">PnL</th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {execution.positions.map((pos) => {
                  const pnl = pos.status === 'OPEN' ? pos.unrealizedPnlUsd : (pos.realizedPnlUsd ?? 0);
                  return (
                    <tr key={pos.id}>
                      <td className="py-2.5 pr-3 font-mono">
                        <div className="text-white font-semibold">
                          {pos.symbol} ·{' '}
                          <span className={pos.side === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}>
                            {pos.side}
                          </span>
                        </div>
                        <div className="text-slate-500">
                          {pos.venue} · {pos.marginMode} {pos.leverage}x
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-200">
                        <div>{pos.quantity}</div>
                        <div className="text-slate-400">${pos.entryPrice}</div>
                      </td>
                      <td className="py-2.5 pr-3 font-mono tabular-nums">
                        <div className="text-slate-200">Mark ${pos.markPrice}</div>
                        <div className="text-rose-300">SL ${pos.stopLossPrice}</div>
                        <div className="text-emerald-300">TP ${pos.takeProfitPrice}</div>
                      </td>
                      <td className="py-2.5 pr-3 font-mono">
                        <span
                          className={
                            pos.slTpVerified === 'VERIFIED' ? 'text-emerald-400' : 'text-rose-400'
                          }
                        >
                          {pos.slTpVerified}
                        </span>
                        <div className="text-slate-500 text-[11px]">{pos.status}</div>
                      </td>
                      <td
                        className={`py-2.5 pr-3 font-mono tabular-nums font-semibold ${
                          pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                      </td>
                      <td className="py-2.5">
                        {pos.status === 'OPEN' ? (
                          <button
                            type="button"
                            onClick={() => void onClosePosition(pos.id)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white text-xs font-mono transition-colors"
                          >
                            Close
                          </button>
                        ) : (
                          <span className="text-slate-500 font-mono">{pos.closeReason}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Orders Audit Ledger */}
      <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 overflow-x-auto">
        <h2 className="font-[var(--font-display)] text-base font-semibold text-white pb-3 border-b border-slate-800">
          Order Execution & Protection Audit Ledger ({execution.orders.length})
        </h2>
        {execution.orders.length === 0 ? (
          <p className="text-xs text-slate-400 pt-3">No orders dispatched yet.</p>
        ) : (
          <table className="w-full text-left text-xs mt-2">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-3 font-medium">Client Order ID</th>
                <th className="py-2 pr-3 font-medium">Venue / Symbol</th>
                <th className="py-2 pr-3 font-medium">Type / Side</th>
                <th className="py-2 pr-3 font-medium">Qty / Price</th>
                <th className="py-2 pr-3 font-medium">Fee</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
              {execution.orders.slice(0, 20).map((o) => (
                <tr key={o.id}>
                  <td className="py-2 pr-3 text-cyan-400">{o.clientOrderId}</td>
                  <td className="py-2 pr-3 text-slate-300">
                    {o.venue} · {o.symbol}
                  </td>
                  <td className="py-2 pr-3 text-slate-200">
                    {o.type} · {o.side} {o.reduceOnly ? '(RO)' : ''}
                  </td>
                  <td className="py-2 pr-3 text-slate-200">
                    {o.quantity} @ ${o.fillPrice ?? o.stopPrice ?? o.requestedPrice}
                  </td>
                  <td className="py-2 pr-3 text-slate-400">${o.feeUsd.toFixed(4)}</td>
                  <td className="py-2 text-emerald-400">{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
