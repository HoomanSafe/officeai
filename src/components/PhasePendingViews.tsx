import type { OfficeSnapshot } from '../types/hq';
import { Lock, ShieldCheck } from './navConfig';

interface PendingViewProps {
  snapshot: OfficeSnapshot;
  onNavigateSettings: () => void;
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
