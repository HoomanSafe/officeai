import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ExecutionVenue, OfficeSnapshot } from '../types/hq';
import { PerformanceChart } from './PerformanceChart';

interface AnalyticsViewProps {
  snapshot: OfficeSnapshot;
}

export function AnalyticsView({ snapshot }: AnalyticsViewProps) {
  const [selectedVenue, setSelectedVenue] = useState<'ALL' | ExecutionVenue>(
    snapshot.mode === 'TESTNET' ? 'BINANCE_TESTNET' : 'ALL',
  );

  const closedTrades = useMemo(
    () =>
      snapshot.execution.positions.filter(
        (p) =>
          p.status !== 'OPEN' &&
          (selectedVenue === 'ALL' || p.venue === selectedVenue),
      ),
    [snapshot.execution.positions, selectedVenue],
  );

  const metrics = useMemo(() => {
    const count = closedTrades.length;
    const wins = closedTrades.filter((p) => (p.realizedPnlUsd ?? 0) > 0);
    const losses = closedTrades.filter((p) => (p.realizedPnlUsd ?? 0) < 0);
    const grossProfit = wins.reduce((acc, p) => acc + (p.realizedPnlUsd ?? 0), 0);
    const grossLoss = Math.abs(losses.reduce((acc, p) => acc + (p.realizedPnlUsd ?? 0), 0));
    const netPnl = closedTrades.reduce((acc, p) => acc + (p.realizedPnlUsd ?? 0), 0);
    const winRate = count > 0 ? (wins.length / count) * 100 : 0;
    const profitFactor =
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const expectancy = count > 0 ? netPnl / count : 0;

    // Max realized equity drawdown across chronological trades
    const sorted = [...closedTrades].sort(
      (a, b) =>
        new Date(a.closedAt ?? a.openedAt).getTime() -
        new Date(b.closedAt ?? b.openedAt).getTime(),
    );
    let peak = 0;
    let equityDelta = 0;
    let maxDdUsd = 0;
    for (const pos of sorted) {
      equityDelta += pos.realizedPnlUsd ?? 0;
      if (equityDelta > peak) peak = equityDelta;
      const dd = peak - equityDelta;
      if (dd > maxDdUsd) maxDdUsd = dd;
    }

    return {
      count,
      wins: wins.length,
      losses: losses.length,
      winRate,
      profitFactor,
      expectancy,
      maxDdUsd,
      netPnl,
    };
  }, [closedTrades]);

  const roomActivityData = snapshot.rooms.map((room) => ({
    room: room.shortName,
    events: snapshot.activityLog.filter((l) => l.roomId === room.id).length,
    occupants: snapshot.employees.filter((e) => e.currentRoom === room.id).length,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="text-xs font-mono text-cyan-400">
            REALIZED PERFORMANCE ANALYTICS & TELEMETRY
          </div>
          <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold text-white">
            Performance & Operational Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Cumulative realized PnL, Profit Factor, and Expectancy computed strictly from closed PAPER Simulator and Binance USDⓈ-M Testnet positions.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          {(['ALL', 'PAPER_SIMULATOR', 'BINANCE_TESTNET'] as const).map((venue) => (
            <button
              key={venue}
              type="button"
              onClick={() => setSelectedVenue(venue)}
              className={`px-3 py-1.5 rounded-lg border transition-colors ${
                selectedVenue === venue
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200 font-semibold'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
            >
              {venue === 'ALL' ? 'ALL MODES' : venue === 'PAPER_SIMULATOR' ? 'PAPER' : 'TESTNET'}
            </button>
          ))}
        </div>
      </div>

      {/* Real Closed-Trade Performance KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Win Rate</div>
          <div className="mt-2 font-mono text-xl font-semibold text-white tabular-nums">
            {metrics.winRate.toFixed(2)}%
          </div>
          <div className="mt-1 text-xs text-slate-400 font-mono">
            {metrics.count} Completed ({metrics.wins}W / {metrics.losses}L)
          </div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Profit Factor</div>
          <div className="mt-2 font-mono text-xl font-semibold text-cyan-300 tabular-nums">
            {metrics.count === 0
              ? 'N/A'
              : metrics.profitFactor === Infinity
                ? '∞'
                : metrics.profitFactor.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-mono">
            Gross Profit / Gross Loss
          </div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Realized Expectancy</div>
          <div
            className={`mt-2 font-mono text-xl font-semibold tabular-nums ${
              metrics.expectancy >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {metrics.count === 0
              ? 'N/A'
              : `${metrics.expectancy >= 0 ? '+' : ''}$${metrics.expectancy.toFixed(2)} / trade`}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-mono">
            Net PnL: {metrics.netPnl >= 0 ? '+' : ''}${metrics.netPnl.toFixed(2)}
          </div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Max Realized Drawdown</div>
          <div className="mt-2 font-mono text-xl font-semibold text-amber-300 tabular-nums">
            -${metrics.maxDdUsd.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-mono">
            Daily Cap: -{snapshot.riskConfig.maxDailyLossPct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Cumulative Realized PnL Performance Chart (Recharts) */}
      <PerformanceChart positions={snapshot.execution.positions} selectedVenue={selectedVenue} />

      {/* Real Activity Distribution Chart */}
      <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5">
        <div className="mb-4">
          <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
            Live Backend Activity Events & Occupancy by Office Room
          </h2>
          <p className="text-xs text-slate-400">
            Measured directly from authoritative server activity log ({snapshot.activityLog.length} total recorded events)
          </p>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={roomActivityData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
              <XAxis dataKey="room" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: 'rgba(148, 163, 184, 0.25)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#f1f5f9',
                }}
              />
              <Bar dataKey="events" name="Backend Events" fill="#06B6D4" radius={[4, 4, 0, 0]} />
              <Bar dataKey="occupants" name="Current Occupants" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
