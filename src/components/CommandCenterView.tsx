import { useState } from 'react';
import type {
  CandleTimeframe,
  CredentialsStatus,
  OfficeSnapshot,
  TradingMode,
} from '../types/hq';
import type { WsStatus } from '../hooks/useHqSocket';
import { Lock, Play, ShieldAlert, ShieldCheck } from './navConfig';
import { AccountBalanceSummary } from './AccountBalanceSummary';
import { TestnetSetupModal } from './TestnetSetupModal';

const ALL_TIMEFRAMES: CandleTimeframe[] = ['5m', '15m', '1h', '4h', '1d'];

interface CommandCenterViewProps {
  snapshot: OfficeSnapshot;
  wsStatus: WsStatus;
  onChangeMode: (mode: TradingMode) => void;
  onStartDrill: () => void;
  onToggleKillSwitch: (active: boolean) => void;
  onReconcile: () => Promise<unknown>;
  onFetchCredentialsStatus: () => Promise<CredentialsStatus | null>;
  onUpdateAutoTrade: (patch: {
    enabled?: boolean;
    autoExecuteOnApproval?: boolean;
    intervalMinutes?: number;
    enabledSymbols?: string[];
    enabledTimeframes?: CandleTimeframe[];
    runImmediate?: boolean;
  }) => Promise<unknown>;
  onRunAutoTradeCycle: () => Promise<unknown>;
  onOpenOffice3D: () => void;
}

export function CommandCenterView({
  snapshot,
  wsStatus,
  onChangeMode,
  onStartDrill,
  onToggleKillSwitch,
  onReconcile,
  onFetchCredentialsStatus,
  onUpdateAutoTrade,
  onRunAutoTradeCycle,
  onOpenOffice3D,
}: CommandCenterViewProps) {
  const [setupOpen, setSetupOpen] = useState(false);
  const activeEmployees = snapshot.employees.filter((e) => e.state !== 'IDLE').length;
  const activeFeed = snapshot.marketData.feeds[snapshot.marketData.activeSymbol];
  const { execution, riskConfig, autoTrade } = snapshot;
  const targetAccount =
    snapshot.mode === 'TESTNET' ? execution.testnetAccount : execution.paperAccount;
  const isDemoMode = snapshot.mode === 'DEMO';

  const toggleSymbol = (sym: string) => {
    const exists = autoTrade.enabledSymbols.includes(sym);
    const next = exists
      ? autoTrade.enabledSymbols.filter((s) => s !== sym)
      : [...autoTrade.enabledSymbols, sym];
    if (next.length > 0) {
      void onUpdateAutoTrade({ enabledSymbols: next, runImmediate: false });
    }
  };

  const toggleTimeframe = (tf: CandleTimeframe) => {
    const exists = autoTrade.enabledTimeframes.includes(tf);
    const next = exists
      ? autoTrade.enabledTimeframes.filter((t) => t !== tf)
      : [...autoTrade.enabledTimeframes, tf];
    if (next.length > 0) {
      void onUpdateAutoTrade({ enabledTimeframes: next, runImmediate: false });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="text-xs font-mono text-cyan-400">
            {snapshot.phase.replace(/_/g, ' ')} · Server Time {new Date(snapshot.serverTime).toLocaleTimeString()}
          </div>
          <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold text-white">
            Command Center
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Authoritative company telemetry. External exchange and AI providers report honest connection status with zero fabricated metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenOffice3D}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 text-slate-200 hover:text-white hover:border-slate-600 transition-colors whitespace-nowrap shrink-0"
          >
            Open 3D Trading Office
          </button>
          <button
            type="button"
            disabled={snapshot.drillRunning || riskConfig.emergencyKillSwitch}
            onClick={onStartDrill}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{snapshot.drillRunning ? 'Drill Active' : 'Run Phase 1 Drill'}</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleKillSwitch(!riskConfig.emergencyKillSwitch)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
              riskConfig.emergencyKillSwitch
                ? 'bg-rose-600 text-white hover:bg-rose-500'
                : 'bg-slate-900 border border-rose-500/40 text-rose-300 hover:bg-rose-950/50'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>
              {riskConfig.emergencyKillSwitch ? 'Kill Switch ARMED' : 'Emergency Kill Switch'}
            </span>
          </button>
        </div>
      </div>

      {/* Dynamic USDⓈ-M Futures & PAPER Balance Summary */}
      <AccountBalanceSummary
        snapshot={snapshot}
        onReconcile={onReconcile}
        onChangeMode={onChangeMode}
        onOpenSetupModal={() => setSetupOpen(true)}
      />

      {/* Primary KPI Grid — Honest Real-Time Mode Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">
            Account Equity ({snapshot.mode === 'TESTNET' ? 'Binance Testnet' : snapshot.mode === 'PAPER' ? 'PAPER Simulator' : 'DEMO Read-Only'})
          </div>
          <div
            className={`mt-2 font-mono text-xl font-semibold tabular-nums ${
              isDemoMode
                ? 'text-slate-300'
                : targetAccount.connected
                  ? 'text-white'
                  : 'text-amber-300'
            }`}
          >
            {isDemoMode
              ? 'DEMO (Read-Only)'
              : targetAccount.connected
                ? `$${targetAccount.equityUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : 'NOT CONNECTED'}
          </div>
          <div className="mt-1 text-xs text-slate-500 truncate">
            {isDemoMode
              ? 'Switch to PAPER or TESTNET to execute'
              : targetAccount.connected
                ? `Avail Margin $${targetAccount.availableBalanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : (targetAccount.errorMessage ?? 'Binance Testnet keys required in .env')}
          </div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Active Positions / Margin Mode</div>
          <div className="mt-2 font-mono text-xl font-semibold text-slate-200 tabular-nums">
            {isDemoMode ? 0 : targetAccount.openPositionsCount} / {riskConfig.maxSimultaneousPositions} Max
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {riskConfig.marginMode} {riskConfig.maxLeverage}x · {riskConfig.positionMode}
          </div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Daily PnL / Drawdown Limit</div>
          <div
            className={`mt-2 font-mono text-xl font-semibold tabular-nums ${
              isDemoMode || !targetAccount.connected
                ? 'text-slate-200'
                : targetAccount.dailyPnlPct >= 0
                  ? 'text-emerald-400'
                  : 'text-rose-400'
            }`}
          >
            {isDemoMode || !targetAccount.connected
              ? `0.00% / -${riskConfig.maxDailyLossPct.toFixed(2)}%`
              : `${targetAccount.dailyPnlPct >= 0 ? '+' : ''}${targetAccount.dailyPnlPct.toFixed(2)}% / -${riskConfig.maxDailyLossPct.toFixed(2)}%`}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Risk per trade capped at {riskConfig.riskPerTradePct.toFixed(2)}%
          </div>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">
            {snapshot.marketData.activeSymbol} Mark Price & Regime
          </div>
          <div className="mt-2 font-mono text-xl font-semibold text-cyan-300 tabular-nums">
            {activeFeed?.markPrice
              ? `$${activeFeed.markPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : activeFeed?.status ?? 'NOT CONNECTED'}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono">
            {activeEmployees}/{snapshot.employees.length} Agents · {activeFeed?.indicators.regime ?? 'UNKNOWN'}
          </div>
        </div>
      </div>

      {/* Trading Mode Switcher + System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
              Operational Mode
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              DEMO, PAPER, TESTNET, and LIVE are strictly separated. LIVE remains locked until Phase 7 validation passes.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(['DEMO', 'PAPER', 'TESTNET', 'LIVE'] as TradingMode[]).map((mode) => {
              const active = snapshot.mode === mode;
              const isLive = mode === 'LIVE';
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChangeMode(mode)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-mono font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                    active
                      ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200'
                      : isLive
                        ? 'bg-slate-900/60 border-slate-800 text-slate-500 hover:border-rose-500/40'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {isLive && <Lock className="w-3.5 h-3.5 text-rose-400" />}
                  <span>{mode}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{snapshot.liveLockReason}</span>
          </div>

          {/* Autonomous Autopilot Loop Control */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Autonomous AI Autopilot</span>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                  autoTrade.enabled
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                {autoTrade.enabled ? `ACTIVE (${autoTrade.intervalMinutes}m)` : 'PAUSED'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={riskConfig.emergencyKillSwitch}
                onClick={() => void onUpdateAutoTrade({ enabled: !autoTrade.enabled, runImmediate: !autoTrade.enabled })}
                className={`px-3 py-2 rounded-lg text-xs font-mono font-medium border transition-colors ${
                  autoTrade.enabled
                    ? 'bg-rose-500/15 border-rose-500/50 text-rose-200 hover:bg-rose-500/25'
                    : 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500'
                }`}
              >
                {autoTrade.enabled ? 'Pause Autopilot' : 'Start Autopilot'}
              </button>
              <button
                type="button"
                disabled={snapshot.debateRunning || riskConfig.emergencyKillSwitch}
                onClick={() => void onRunAutoTradeCycle()}
                className="px-3 py-2 rounded-lg text-xs font-mono bg-slate-900 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
              >
                {snapshot.debateRunning ? 'Debating...' : 'Run Cycle Now'}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoTrade.autoExecuteOnApproval}
                  onChange={(e) =>
                    void onUpdateAutoTrade({ autoExecuteOnApproval: e.target.checked, runImmediate: false })
                  }
                  className="accent-cyan-500"
                />
                <span>Auto-Execute on CEO+CRO Approval</span>
              </label>
              <select
                value={autoTrade.intervalMinutes}
                onChange={(e) =>
                  void onUpdateAutoTrade({ intervalMinutes: Number(e.target.value), runImmediate: false })
                }
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200"
              >
                <option value={1}>1m</option>
                <option value={3}>3m</option>
                <option value={5}>5m</option>
                <option value={15}>15m</option>
              </select>
            </div>

            {/* Multi-Pair & Multi-Timeframe Autopilot Matrix */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-mono text-slate-400">
                Pairs ({autoTrade.enabledSymbols.length}):
              </div>
              <div className="flex flex-wrap gap-1">
                {snapshot.marketData.watchedSymbols.map((sym) => {
                  const selected = autoTrade.enabledSymbols.includes(sym);
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => toggleSymbol(sym)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                        selected
                          ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200'
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      {sym.replace('USDT', '')}
                    </button>
                  );
                })}
              </div>

              <div className="text-[11px] font-mono text-slate-400 pt-1">
                Timeframes ({autoTrade.enabledTimeframes.length}) · {autoTrade.enabledSymbols.length * autoTrade.enabledTimeframes.length} Slots:
              </div>
              <div className="flex flex-wrap gap-1">
                {ALL_TIMEFRAMES.map((tf) => {
                  const selected = autoTrade.enabledTimeframes.includes(tf);
                  return (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => toggleTimeframe(tf)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                        selected
                          ? 'bg-violet-500/20 border-violet-500/60 text-violet-200'
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      {tf}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-400 bg-slate-900/70 rounded p-2">
              {autoTrade.lastOutcome}
            </div>
          </div>
        </div>

        {/* Integration & Health Matrix */}
        <div className="lg:col-span-2 bg-[#0B1120] border border-slate-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
                Infrastructure & API Connection Matrix
              </h2>
              <p className="text-xs text-slate-400">
                WebSocket Stream: <span className="font-mono text-cyan-300">{wsStatus}</span> · Connected Clients:{' '}
                <span className="font-mono tabular-nums text-slate-200">{snapshot.connectedClients}</span> · Uptime:{' '}
                <span className="font-mono tabular-nums text-slate-200">{snapshot.uptimeSeconds}s</span>
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-800/80 mt-2">
            {snapshot.integrations.map((item) => (
              <div key={item.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="font-medium text-slate-100">{item.name}</div>
                  <div className="text-slate-400 truncate max-w-xl">{item.detail}</div>
                </div>
                <div className="flex items-center gap-3 font-mono shrink-0">
                  <span className="text-slate-500">{item.phaseTarget}</span>
                  <span
                    className={
                      item.status === 'CONNECTED'
                        ? 'text-emerald-400'
                        : item.status === 'STANDBY'
                          ? 'text-cyan-400'
                          : 'text-amber-400'
                    }
                  >
                    {item.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time Employee Status Table + Recent Activity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#0B1120] border border-slate-800 rounded-xl p-5 overflow-x-auto">
          <h2 className="font-[var(--font-display)] text-base font-semibold text-white pb-3 border-b border-slate-800">
            AI Employee Registry & Live Room State
          </h2>
          <table className="w-full text-left text-xs mt-2">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800/80">
                <th className="py-2.5 pr-3 font-medium">ID</th>
                <th className="py-2.5 pr-3 font-medium">Employee</th>
                <th className="py-2.5 pr-3 font-medium">Current Room</th>
                <th className="py-2.5 pr-3 font-medium">State</th>
                <th className="py-2.5 font-medium">Current Task</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {snapshot.employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-900/60">
                  <td className="py-2.5 pr-3 font-mono text-cyan-400 whitespace-nowrap">{emp.code}</td>
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    <div className="font-medium text-slate-100">{emp.name}</div>
                    <div className="text-slate-400">{emp.title}</div>
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-slate-300 whitespace-nowrap">
                    {emp.currentRoom.replace(/_/g, ' ')}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-cyan-300 whitespace-nowrap">{emp.state}</td>
                  <td className="py-2.5 text-slate-300 max-w-xs truncate">{emp.currentTask}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 flex flex-col max-h-[420px]">
          <h2 className="font-[var(--font-display)] text-base font-semibold text-white pb-3 border-b border-slate-800">
            Recent Backend Events
          </h2>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/70 mt-1">
            {snapshot.activityLog.slice(0, 15).map((entry) => (
              <div key={entry.id} className="py-2.5 text-xs">
                <div className="flex justify-between font-mono text-slate-400">
                  <span className="text-cyan-400">{entry.employeeCode}</span>
                  <span className="tabular-nums">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="mt-0.5 font-medium text-slate-100">{entry.action}</div>
                <div className="text-slate-400">{entry.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <TestnetSetupModal
        open={setupOpen}
        snapshot={snapshot}
        onClose={() => setSetupOpen(false)}
        onFetchCredentialsStatus={onFetchCredentialsStatus}
        onReconcile={onReconcile}
        onChangeMode={onChangeMode}
      />
    </div>
  );
}
