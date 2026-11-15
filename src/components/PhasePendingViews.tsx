import type { OfficeSnapshot } from '../types/hq';
import { Lock, ShieldCheck } from './navConfig';

interface PendingViewProps {
  snapshot: OfficeSnapshot;
  onNavigateSettings: () => void;
}

export function WarRoomView({ snapshot }: PendingViewProps) {
  const warRoomOccupants = snapshot.employees.filter((e) => e.currentRoom === 'AI_WAR_ROOM');

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="pb-4 border-b border-slate-800/80">
        <div className="text-xs font-mono text-amber-300">NOT IMPLEMENTED · Scheduled for Phase 2 & Phase 4</div>
        <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold text-white">
          AI War Room & Multi-Agent Debate Engine
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Structured JSON reports, conflicting evidence resolution, CEO review, and independent Chief Risk Officer veto logs will appear here once Phase 2 AI Providers and Phase 4 Debate Engine are active.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
            Current War Room Occupancy (Live Phase 1 State)
          </h2>
          {warRoomOccupants.length === 0 ? (
            <p className="text-xs text-slate-400">
              0 employees currently stationed in AI War Room. Run the Phase 1 Routing Drill from the 3D Office or Command Center to observe live War Room assembly.
            </p>
          ) : (
            <div className="divide-y divide-slate-800">
              {warRoomOccupants.map((emp) => (
                <div key={emp.id} className="py-2.5 flex justify-between text-xs">
                  <div>
                    <div className="font-medium text-slate-100">{emp.name}</div>
                    <div className="text-slate-400">{emp.title}</div>
                  </div>
                  <span className="font-mono text-cyan-300">{emp.state}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
            Required Structured Decision Pipeline (Phase 4)
          </h2>
          <ol className="text-xs text-slate-400 space-y-2 list-decimal pl-4">
            <li>Market Snapshot & Regime Verification (Rejects Stale Data)</li>
            <li>Independent Technical, SMC, Order Flow & Quant Structured JSON Reports</li>
            <li>Debate Engine Conflict Detection (No Blind Majority Voting)</li>
            <li>Head Trader Proposal (LONG / SHORT / NO TRADE) & CEO Review</li>
            <li>Chief Risk Officer Independent Veto & Deterministic Python Guardrail Audit</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export function MarketAnalysisView({ onNavigateSettings }: PendingViewProps) {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="text-xs font-mono text-amber-300">NOT CONNECTED · Scheduled for Phase 3</div>
          <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold text-white">
            Market Analysis & Binance Data Engine
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            No fabricated candles, simulated order books, or fake funding rates are rendered. Connect Binance USDⓈ-M Market Data Engine in Phase 3 to stream real BTCUSDT / ETHUSDT data.
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigateSettings}
          className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:text-white"
        >
          Inspect Connection Status
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'BTCUSDT Perpetual Feed', status: 'NOT CONNECTED', note: 'Binance Futures WebSocket pending Phase 3' },
          { label: 'ETHUSDT Perpetual Feed', status: 'NOT CONNECTED', note: 'OHLCV 5m–1d candle store pending Phase 3' },
          { label: 'Order Book / Funding / OI', status: 'NOT CONNECTED', note: 'Stale-data guard active (blocks blind analysis)' },
        ].map((item) => (
          <div key={item.label} className="bg-[#0B1120] border border-slate-800 rounded-xl p-5">
            <div className="text-xs text-slate-400">{item.label}</div>
            <div className="mt-2 font-mono text-lg font-semibold text-amber-300">{item.status}</div>
            <div className="mt-1 text-xs text-slate-500">{item.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PositionsView({ snapshot }: PendingViewProps) {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="pb-4 border-b border-slate-800/80">
        <div className="text-xs font-mono text-amber-300">
          NOT IMPLEMENTED · Scheduled for Phase 5 · Current Mode: {snapshot.mode}
        </div>
        <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold text-white">
          Positions & Protective Order Verification
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Open positions, unrealized PnL, and mandatory post-fill Binance Stop Loss / Take Profit verification records will populate here once the Phase 5 Execution Engine is active.
        </p>
      </div>

      <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 space-y-1.5">
            <div className="font-semibold text-white text-sm">
              Zero Unverified Exposure Policy (Fail-Closed)
            </div>
            <p className="text-slate-400 leading-relaxed">
              Every executed position must pass post-order exchange verification confirming Stop Loss existence, quantity parity, trigger price, and Take Profit status on Binance USDⓈ-M Futures. If verification fails, new entries are immediately blocked and emergency protection triggers.
            </p>
          </div>
        </div>
        <div className="pt-3 border-t border-slate-800 flex flex-wrap gap-6 text-xs font-mono text-slate-400">
          <span>Active Positions: 0 / {snapshot.riskConfig.maxSimultaneousPositions}</span>
          <span>Margin Mode: {snapshot.riskConfig.marginMode}</span>
          <span>Position Mode: {snapshot.riskConfig.positionMode}</span>
          <span className="inline-flex items-center gap-1 text-rose-300">
            <Lock className="w-3.5 h-3.5" /> LIVE Execution Locked
          </span>
        </div>
      </div>
    </div>
  );
}

export function TradeJournalView({ snapshot }: PendingViewProps) {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="pb-4 border-b border-slate-800/80">
        <div className="text-xs font-mono text-amber-300">NOT IMPLEMENTED · Scheduled for Phase 5 & Phase 6</div>
        <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold text-white">
          Trade Journal & Audit Trail
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Complete immutable audit records linking market snapshots, analyst reports, CEO approvals, Risk Officer vetoes, slippage, fees, and final outcomes. Zero fake trades displayed.
        </p>
      </div>

      <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5">
        <div className="text-xs font-medium text-slate-300 mb-3">
          Phase 1 Dispatched Backend Tasks ({snapshot.tasks.length})
        </div>
        {snapshot.tasks.length === 0 ? (
          <p className="text-xs text-slate-500">
            No Phase 1 routing tasks dispatched yet. Use Employees or the 3D Office Drill to verify backend task persistence.
          </p>
        ) : (
          <div className="divide-y divide-slate-800/70">
            {snapshot.tasks.slice(0, 12).map((task) => (
              <div key={task.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-mono text-cyan-400 mr-2">{task.id}</span>
                  <span className="text-slate-100">{task.title}</span>
                </div>
                <div className="font-mono text-slate-400">
                  {task.targetRoom.replace(/_/g, ' ')} · {task.state}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
