import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { OfficeSnapshot } from '../types/hq';

interface AnalyticsViewProps {
  snapshot: OfficeSnapshot;
}

export function AnalyticsView({ snapshot }: AnalyticsViewProps) {
  const roomActivityData = snapshot.rooms.map((room) => ({
    room: room.shortName,
    events: snapshot.activityLog.filter((l) => l.roomId === room.id).length,
    occupants: snapshot.employees.filter((e) => e.currentRoom === room.id).length,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="pb-4 border-b border-slate-800/80">
        <div className="text-xs font-mono text-cyan-400">
          Phase 1 Operational Telemetry · Trading Backtest Analytics Pending Phase 6
        </div>
        <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold text-white">
          Performance & Operational Analytics
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Trading metrics remain empty until real paper/testnet execution and Phase 6 backtesting run. Below chart reflects real backend room events from this session.
        </p>
      </div>

      {/* Honest Trading Analytics Placeholders */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Win Rate', value: '0.00%', sub: '0 Completed Trades (Phase 6)' },
          { label: 'Profit Factor', value: 'N/A', sub: 'Not Implemented (Phase 6)' },
          { label: 'Strategy Expectancy', value: 'N/A', sub: 'Walk-Forward Pending' },
          { label: 'Max Drawdown', value: '0.00%', sub: 'Limit: -1.00% Daily' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400">{kpi.label}</div>
            <div className="mt-2 font-mono text-xl font-semibold text-slate-200 tabular-nums">
              {kpi.value}
            </div>
            <div className="mt-1 text-xs text-amber-300/90">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Real Phase 1 Activity Distribution Chart */}
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
