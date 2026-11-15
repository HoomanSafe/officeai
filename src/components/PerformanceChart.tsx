import { useMemo } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ExecutionVenue, PositionRecord } from '../types/hq';

interface PerformanceChartProps {
  positions: PositionRecord[];
  selectedVenue: 'ALL' | ExecutionVenue;
}

export function PerformanceChart({ positions, selectedVenue }: PerformanceChartProps) {
  const chartData = useMemo(() => {
    const closed = positions
      .filter((p) => p.status !== 'OPEN' && (selectedVenue === 'ALL' || p.venue === selectedVenue))
      .sort(
        (a, b) =>
          new Date(a.closedAt ?? a.openedAt).getTime() -
          new Date(b.closedAt ?? b.openedAt).getTime(),
      );

    let cumulative = 0;
    return closed.map((pos, idx) => {
      const tradePnl = Number((pos.realizedPnlUsd ?? 0).toFixed(2));
      cumulative = Number((cumulative + tradePnl).toFixed(2));
      const ts = pos.closedAt ?? pos.openedAt;
      return {
        index: idx + 1,
        label: `#${idx + 1} ${pos.symbol.replace('USDT', '')}`,
        time: new Date(ts).toLocaleTimeString(),
        symbol: pos.symbol,
        side: pos.side,
        tradePnl,
        cumulativePnl: cumulative,
      };
    });
  }, [positions, selectedVenue]);

  if (chartData.length === 0) {
    return (
      <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5">
        <div className="mb-2">
          <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
            Cumulative Realized PnL Over Time
          </h2>
          <p className="text-xs text-slate-400">
            No closed trades recorded yet for {selectedVenue === 'ALL' ? 'all accounts' : selectedVenue}. Execute and close a PAPER or TESTNET trade to plot real cumulative PnL.
          </p>
        </div>
        <div className="h-56 w-full flex items-center justify-center border border-dashed border-slate-800 rounded-lg text-xs font-mono text-slate-500">
          0 Closed Trades · Baseline Realized PnL: $0.00
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
            Cumulative Realized PnL Over Time ({selectedVenue === 'ALL' ? 'All Accounts' : selectedVenue})
          </h2>
          <p className="text-xs text-slate-400">
            Chronological equity curve & per-trade realized PnL across {chartData.length} closed position(s)
          </p>
        </div>
        <div className="font-mono text-sm font-semibold tabular-nums">
          Total:{' '}
          <span
            className={
              chartData[chartData.length - 1].cumulativePnl >= 0
                ? 'text-emerald-400'
                : 'text-rose-400'
            }
          >
            {chartData[chartData.length - 1].cumulativePnl >= 0 ? '+' : ''}$
            {chartData[chartData.length - 1].cumulativePnl.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id="cumPnlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
            <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              tickFormatter={(v: number) => `$${v}`}
            />
            <ReferenceLine y={0} stroke="rgba(148, 163, 184, 0.35)" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0F172A',
                borderColor: 'rgba(148, 163, 184, 0.25)',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#f1f5f9',
              }}
              formatter={(value: unknown, name?: string | number) => {
                const num = Number(value ?? 0);
                const formatted = `${num >= 0 ? '+' : ''}$${num.toFixed(2)}`;
                return [formatted, String(name ?? '')];
              }}
            />
            <Bar
              dataKey="tradePnl"
              name="Trade PnL"
              fill="#8B5CF6"
              radius={[3, 3, 0, 0]}
              barSize={18}
            />
            <Area
              type="monotone"
              dataKey="cumulativePnl"
              name="Cumulative PnL"
              stroke="#06B6D4"
              strokeWidth={2}
              fill="url(#cumPnlGrad)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
