import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ExecutionVenue, OfficeSnapshot, PositionRecord } from '../types/hq';

interface TradeHistoryViewProps {
  snapshot: OfficeSnapshot;
}

type SortKey = 'openedAt' | 'closedAt' | 'realizedPnlUsd' | 'returnPct' | 'feesPaidUsd' | 'symbol';

function calcReturnPct(pos: PositionRecord): number {
  if (!pos.initialMarginUsd || pos.initialMarginUsd <= 0) return 0;
  return Number((((pos.realizedPnlUsd ?? 0) / pos.initialMarginUsd) * 100).toFixed(2));
}

export function TradeHistoryView({ snapshot }: TradeHistoryViewProps) {
  const [venueFilter, setVenueFilter] = useState<'ALL' | ExecutionVenue>('ALL');
  const [symbolFilter, setSymbolFilter] = useState<string>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('closedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const closedPositions = useMemo(
    () => snapshot.execution.positions.filter((p) => p.status !== 'OPEN'),
    [snapshot.execution.positions],
  );

  const uniqueSymbols = useMemo(
    () => Array.from(new Set(closedPositions.map((p) => p.symbol))),
    [closedPositions],
  );

  const filtered = useMemo(() => {
    const list = closedPositions.filter((p) => {
      if (venueFilter !== 'ALL' && p.venue !== venueFilter) return false;
      if (symbolFilter !== 'ALL' && p.symbol !== symbolFilter) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'openedAt') {
        cmp = new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime();
      } else if (sortKey === 'closedAt') {
        cmp =
          new Date(a.closedAt ?? a.openedAt).getTime() -
          new Date(b.closedAt ?? b.openedAt).getTime();
      } else if (sortKey === 'realizedPnlUsd') {
        cmp = (a.realizedPnlUsd ?? 0) - (b.realizedPnlUsd ?? 0);
      } else if (sortKey === 'returnPct') {
        cmp = calcReturnPct(a) - calcReturnPct(b);
      } else if (sortKey === 'feesPaidUsd') {
        cmp = a.feesPaidUsd - b.feesPaidUsd;
      } else if (sortKey === 'symbol') {
        cmp = a.symbol.localeCompare(b.symbol);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [closedPositions, venueFilter, symbolFilter, sortKey, sortDir]);

  const metrics = useMemo(() => {
    const total = filtered.length;
    const wins = filtered.filter((p) => (p.realizedPnlUsd ?? 0) > 0);
    const losses = filtered.filter((p) => (p.realizedPnlUsd ?? 0) < 0);
    const grossProfit = wins.reduce((acc, p) => acc + (p.realizedPnlUsd ?? 0), 0);
    const grossLoss = Math.abs(losses.reduce((acc, p) => acc + (p.realizedPnlUsd ?? 0), 0));
    const netPnl = filtered.reduce((acc, p) => acc + (p.realizedPnlUsd ?? 0), 0);
    const totalFees = filtered.reduce((acc, p) => acc + p.feesPaidUsd, 0);
    const winRate = total > 0 ? (wins.length / total) * 100 : 0;
    const profitFactor =
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    return {
      total,
      wins: wins.length,
      losses: losses.length,
      netPnl,
      totalFees,
      winRate,
      profitFactor,
    };
  }, [filtered]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="w-3 h-3 text-slate-600" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-cyan-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-400" />
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="text-xs font-mono text-cyan-400">
            PHASE 5 EXECUTION LEDGER · REALIZED PNL & SL/TP AUDIT
          </div>
          <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold text-white">
            Trade History & Closed Position Analysis
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Immutable record of closed PAPER Simulator and Binance USDⓈ-M Testnet trades with fee accounting, ROI%, and close reasons. Zero fabricated trades.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {(['ALL', 'PAPER_SIMULATOR', 'BINANCE_TESTNET'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVenueFilter(v)}
              className={`px-3 py-1.5 rounded-lg border transition-colors ${
                venueFilter === v
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200 font-semibold'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
            >
              {v === 'ALL' ? 'ALL VENUES' : v === 'PAPER_SIMULATOR' ? 'PAPER' : 'TESTNET'}
            </button>
          ))}

          <select
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
          >
            <option value="ALL">All Symbols</option>
            {uniqueSymbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Closed Trades</div>
          <div className="mt-1.5 font-mono text-xl font-semibold text-white tabular-nums">
            {metrics.total}
          </div>
          <div className="text-xs font-mono text-slate-500 mt-0.5">
            {metrics.wins}W / {metrics.losses}L
          </div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Win Rate</div>
          <div className="mt-1.5 font-mono text-xl font-semibold text-cyan-300 tabular-nums">
            {metrics.winRate.toFixed(1)}%
          </div>
          <div className="text-xs font-mono text-slate-500 mt-0.5">
            From closed positions
          </div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Net Realized PnL</div>
          <div
            className={`mt-1.5 font-mono text-xl font-semibold tabular-nums ${
              metrics.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {metrics.netPnl >= 0 ? '+' : ''}${metrics.netPnl.toFixed(2)}
          </div>
          <div className="text-xs font-mono text-slate-500 mt-0.5">After taker fees</div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Profit Factor</div>
          <div className="mt-1.5 font-mono text-xl font-semibold text-white tabular-nums">
            {metrics.total === 0
              ? 'N/A'
              : metrics.profitFactor === Infinity
                ? '∞'
                : metrics.profitFactor.toFixed(2)}
          </div>
          <div className="text-xs font-mono text-slate-500 mt-0.5">Gross Win / Loss</div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Total Fees Paid</div>
          <div className="mt-1.5 font-mono text-xl font-semibold text-amber-300 tabular-nums">
            ${metrics.totalFees.toFixed(4)}
          </div>
          <div className="text-xs font-mono text-slate-500 mt-0.5">
            {snapshot.riskConfig.marginMode} Margin
          </div>
        </div>
      </div>

      {/* Sortable Closed Positions Table */}
      <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 overflow-x-auto">
        <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
            Closed Positions History ({filtered.length})
          </h2>
          <span className="text-xs font-mono text-slate-400">
            Click column headers to sort
          </span>
        </div>

        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 pt-4">
            No closed trades recorded yet for this filter. Open and close a trade in <strong>Positions</strong> (PAPER / TESTNET) or run <strong>Autopilot</strong> to inspect real PnL metrics here.
          </p>
        ) : (
          <table className="w-full text-left text-xs mt-2">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="py-2.5 pr-3 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort('symbol')}
                    className="inline-flex items-center gap-1 hover:text-white"
                  >
                    <span>Symbol / Venue</span>
                    {renderSortIcon('symbol')}
                  </button>
                </th>
                <th className="py-2.5 pr-3 font-medium">Qty · Entry → Exit</th>
                <th className="py-2.5 pr-3 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort('openedAt')}
                    className="inline-flex items-center gap-1 hover:text-white"
                  >
                    <span>Entry Date</span>
                    {renderSortIcon('openedAt')}
                  </button>
                </th>
                <th className="py-2.5 pr-3 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort('closedAt')}
                    className="inline-flex items-center gap-1 hover:text-white"
                  >
                    <span>Exit Date</span>
                    {renderSortIcon('closedAt')}
                  </button>
                </th>
                <th className="py-2.5 pr-3 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort('realizedPnlUsd')}
                    className="inline-flex items-center gap-1 hover:text-white"
                  >
                    <span>Realized PnL</span>
                    {renderSortIcon('realizedPnlUsd')}
                  </button>
                </th>
                <th className="py-2.5 pr-3 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort('returnPct')}
                    className="inline-flex items-center gap-1 hover:text-white"
                  >
                    <span>ROI %</span>
                    {renderSortIcon('returnPct')}
                  </button>
                </th>
                <th className="py-2.5 pr-3 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort('feesPaidUsd')}
                    className="inline-flex items-center gap-1 hover:text-white"
                  >
                    <span>Fees</span>
                    {renderSortIcon('feesPaidUsd')}
                  </button>
                </th>
                <th className="py-2.5 font-medium">Outcome / Guard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
              {filtered.map((pos) => {
                const pnl = pos.realizedPnlUsd ?? 0;
                const roi = calcReturnPct(pos);
                return (
                  <tr key={pos.id} className="hover:bg-slate-900/50">
                    <td className="py-2.5 pr-3">
                      <div className="text-white font-semibold">
                        {pos.symbol} ·{' '}
                        <span className={pos.side === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}>
                          {pos.side}
                        </span>
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        {pos.venue} · {pos.marginMode} {pos.leverage}x
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-200">
                      <div>{pos.quantity}</div>
                      <div className="text-slate-400 text-[11px]">
                        ${pos.entryPrice} → ${pos.markPrice}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-300 text-[11px]">
                      {new Date(pos.openedAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-300 text-[11px]">
                      {pos.closedAt ? new Date(pos.closedAt).toLocaleString() : '—'}
                    </td>
                    <td
                      className={`py-2.5 pr-3 font-semibold ${
                        pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                    </td>
                    <td
                      className={`py-2.5 pr-3 ${
                        roi >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                    </td>
                    <td className="py-2.5 pr-3 text-slate-400">${pos.feesPaidUsd.toFixed(4)}</td>
                    <td className="py-2.5 text-[11px]">
                      <div className="text-slate-200">{pos.closeReason ?? pos.status}</div>
                      <div className="text-slate-500">SL: {pos.slTpVerified}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Audit Tasks Footer */}
      {snapshot.tasks.length > 0 && (
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-300 mb-3">
            Recent Backend Dispatch & Execution Audit Tasks ({snapshot.tasks.length})
          </div>
          <div className="divide-y divide-slate-800/70">
            {snapshot.tasks.slice(0, 10).map((task) => (
              <div key={task.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-mono text-cyan-400 mr-2">{task.id}</span>
                  <span className="text-slate-200">{task.title}</span>
                </div>
                <div className="font-mono text-slate-400">
                  {task.targetRoom.replace(/_/g, ' ')} · {task.state}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
