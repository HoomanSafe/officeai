import { useState } from 'react';
import { Play, Rocket, ShieldAlert, ShieldCheck } from 'lucide-react';
import type {
  CandleTimeframe,
  DebateSession,
  DebateStage,
  OfficeSnapshot,
  PositionSide,
  TradingMode,
} from '../types/hq';

interface WarRoomViewProps {
  snapshot: OfficeSnapshot;
  onStartDebate: (input?: { symbol?: string; timeframe?: CandleTimeframe }) => Promise<unknown>;
  onExecuteApproved?: (input: {
    symbol: string;
    side: PositionSide;
    entryPrice?: number;
    stopLossPrice: number;
    takeProfitPrice: number;
    debateSessionId?: string | null;
  }) => Promise<unknown>;
  onUpdateAutoTrade?: (patch: {
    enabled?: boolean;
    autoExecuteOnApproval?: boolean;
    intervalMinutes?: number;
    runImmediate?: boolean;
  }) => Promise<unknown>;
  onChangeMode?: (mode: TradingMode) => void;
  onOpenPositions?: () => void;
  onOpenOffice3D: () => void;
}

const STAGES: Array<{ id: DebateStage; label: string }> = [
  { id: 'GATHERING_MARKET_DATA', label: '1. Market & BTC Filter' },
  { id: 'SPECIALIST_ANALYSIS', label: '2. 4 Specialists' },
  { id: 'WAR_ROOM_DEBATE', label: '3. Conflict Audit' },
  { id: 'HEAD_TRADER_PROPOSAL', label: '4. Head Trader' },
  { id: 'CEO_REVIEW', label: '5. CEO Review' },
  { id: 'RISK_AUDIT', label: '6. CRO Veto Gate' },
];

function decisionStyle(decision: DebateSession['finalDecision']): string {
  if (decision === 'APPROVED_LONG') return 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300';
  if (decision === 'APPROVED_SHORT') return 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300';
  if (decision === 'VETOED') return 'bg-rose-500/20 border-rose-500/60 text-rose-300';
  return 'bg-amber-500/15 border-amber-500/50 text-amber-300';
}

export function WarRoomView({
  snapshot,
  onStartDebate,
  onExecuteApproved,
  onUpdateAutoTrade,
  onChangeMode,
  onOpenPositions,
  onOpenOffice3D,
}: WarRoomViewProps) {
  const [symbol, setSymbol] = useState(snapshot.marketData.activeSymbol || 'BTCUSDT');
  const [timeframe, setTimeframe] = useState<CandleTimeframe>(
    snapshot.marketData.activeTimeframe || '1h',
  );
  const [submitting, setSubmitting] = useState(false);
  const [executingTrade, setExecutingTrade] = useState(false);

  const warRoomOccupants = snapshot.employees.filter((e) => e.currentRoom === 'AI_WAR_ROOM');
  const activeSession = snapshot.debateSessions[0] ?? null;
  const isBusy = snapshot.debateRunning || submitting;

  const canExecuteApproved = Boolean(
    onExecuteApproved &&
      activeSession &&
      (activeSession.finalDecision === 'APPROVED_LONG' ||
        activeSession.finalDecision === 'APPROVED_SHORT') &&
      activeSession.headTraderProposal?.stopLossPrice &&
      activeSession.headTraderProposal?.takeProfitPrice &&
      !snapshot.riskConfig.emergencyKillSwitch,
  );

  const handleRunDebate = async () => {
    setSubmitting(true);
    try {
      await onStartDebate({ symbol, timeframe });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteApproved = async () => {
    if (!onExecuteApproved || !activeSession?.headTraderProposal) return;
    const { stopLossPrice, takeProfitPrice, entryPrice } = activeSession.headTraderProposal;
    if (!stopLossPrice || !takeProfitPrice) return;
    const side: PositionSide =
      activeSession.finalDecision === 'APPROVED_LONG' ? 'LONG' : 'SHORT';
    setExecutingTrade(true);
    try {
      const res = (await onExecuteApproved({
        symbol: activeSession.symbol,
        side,
        entryPrice: entryPrice ?? undefined,
        stopLossPrice,
        takeProfitPrice,
        debateSessionId: activeSession.id,
      })) as { ok?: boolean } | undefined;
      if (res?.ok && onOpenPositions) {
        onOpenPositions();
      }
    } finally {
      setExecutingTrade(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="text-xs font-mono text-cyan-400">
            PHASE 4 MULTI-AGENT DEBATE & DECISION ENGINE · {snapshot.riskConfig.marginMode} MARGIN
          </div>
          <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold text-white">
            AI War Room & Institutional Decision Pipeline
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Convenes Technical, SMC, Order Flow, and Quant analysts on live Binance data, detects conflicting theses, routes Head Trader proposal through CEO review, and enforces independent Chief Risk Officer VETO rules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100"
          >
            {snapshot.marketData.watchedSymbols.map((sym) => (
              <option key={sym} value={sym}>
                {sym}
              </option>
            ))}
          </select>

          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as CandleTimeframe)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100"
          >
            {(['5m', '15m', '1h', '4h', '1d'] as CandleTimeframe[]).map((tf) => (
              <option key={tf} value={tf}>
                {tf}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={isBusy || snapshot.riskConfig.emergencyKillSwitch}
            onClick={() => void handleRunDebate()}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white inline-flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isBusy ? 'War Room Convened...' : 'Convene AI War Room Debate'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenOffice3D}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
          >
            Watch in 3D Office
          </button>
        </div>
      </div>

      {/* Autonomous Trading Loop & Auto-Execution Status */}
      {onUpdateAutoTrade && (
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 font-mono">
              <span
                className={`px-2 py-0.5 rounded border font-semibold ${
                  snapshot.autoTrade.enabled
                    ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                AUTOPILOT: {snapshot.autoTrade.enabled ? `ON (${snapshot.autoTrade.intervalMinutes}m)` : 'OFF'}
              </span>
              <span className="text-slate-300">
                Scan:{' '}
                <strong className="text-cyan-300">
                  {snapshot.autoTrade.enabledSymbols.map((s) => s.replace('USDT', '')).join('/')}
                </strong>{' '}
                ×{' '}
                <strong className="text-violet-300">
                  {snapshot.autoTrade.enabledTimeframes.join(', ')}
                </strong>
              </span>
              <span className="text-slate-400">
                · Mode: <strong className="text-white">{snapshot.mode}</strong>
              </span>
            </div>
            <div className="text-slate-400 font-mono truncate max-w-3xl">
              {snapshot.autoTrade.lastOutcome}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {snapshot.mode === 'DEMO' && onChangeMode && (
              <button
                type="button"
                onClick={() => onChangeMode('PAPER')}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-200 font-mono"
              >
                Switch to PAPER (Auto-Trade)
              </button>
            )}
            <button
              type="button"
              disabled={snapshot.riskConfig.emergencyKillSwitch}
              onClick={() =>
                void onUpdateAutoTrade({
                  enabled: !snapshot.autoTrade.enabled,
                  autoExecuteOnApproval: true,
                  runImmediate: !snapshot.autoTrade.enabled,
                })
              }
              className={`px-3 py-1.5 rounded-lg font-mono font-medium border ${
                snapshot.autoTrade.enabled
                  ? 'bg-rose-500/15 border-rose-500/50 text-rose-200'
                  : 'bg-emerald-600 border-emerald-500 text-white'
              }`}
            >
              {snapshot.autoTrade.enabled ? 'Pause Autopilot' : 'Enable Autopilot'}
            </button>
          </div>
        </div>
      )}

      {/* Live 3D War Room Occupancy + Pipeline Status */}
      <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-mono text-slate-300">
            War Room Occupancy: <span className="text-cyan-300">{warRoomOccupants.length}/8 Agents</span>
            {activeSession ? ` · Session ${activeSession.id} (${activeSession.symbol} ${activeSession.timeframe})` : ''}
          </div>
          {activeSession?.finalDecision && (
            <span
              className={`px-3 py-1 rounded border text-xs font-mono font-semibold ${decisionStyle(activeSession.finalDecision)}`}
            >
              VERDICT: {activeSession.finalDecision}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {STAGES.map((st, idx) => {
            const currentIdx = activeSession
              ? STAGES.findIndex((s) => s.id === activeSession.stage)
              : -1;
            const completed =
              activeSession?.stage === 'COMPLETED' || (currentIdx >= 0 && idx < currentIdx);
            const active = activeSession?.stage === st.id;
            return (
              <div
                key={st.id}
                className={`px-3 py-2 rounded-lg border text-xs font-mono ${
                  active
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200'
                    : completed
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-900/70 border-slate-800 text-slate-500'
                }`}
              >
                {st.label}
              </div>
            );
          })}
        </div>

        {activeSession && (
          <div className="text-xs font-mono text-slate-300 pt-1">
            Status: <span className="text-cyan-300">{activeSession.statusText}</span>
            {activeSession.marketMarkPrice !== null && (
              <span className="text-slate-400">
                {' '}
                · Mark Price ${activeSession.marketMarkPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({activeSession.marketRegime})
              </span>
            )}
          </div>
        )}
      </div>

      {!activeSession ? (
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-8 text-center space-y-2">
          <div className="font-[var(--font-display)] text-base font-semibold text-white">
            No War Room Debate Executed Yet
          </div>
          <p className="text-xs text-slate-400 max-w-xl mx-auto">
            Click <span className="text-cyan-300 font-medium">Convene AI War Room Debate</span> above to send Technical, SMC, Order Flow, and Quant analysts to gather live Binance USDⓈ-M data, debate conflicts in the 3D War Room, and run Head Trader + CEO + Chief Risk Officer checks.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Conflict Audit Banner */}
          <div
            className={`border rounded-xl p-4 flex items-start gap-3 text-xs ${
              activeSession.conflictDetected
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
            }`}
          >
            {activeSession.conflictDetected ? (
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-mono font-semibold">
                Conflict Detector: {activeSession.conflictDetected ? 'DIVERGENCE DETECTED' : 'ALIGNED'}
              </div>
              <p className="mt-0.5 text-slate-300">{activeSession.conflictSummary}</p>
            </div>
          </div>

          {/* 4 Specialist Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeSession.specialistReports.map((rep) => {
              const emp = snapshot.employees.find((e) => e.id === rep.employee_id);
              return (
                <div key={rep.id} className="bg-[#0B1120] border border-slate-800 rounded-xl p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-cyan-400 font-semibold">
                      {emp?.code ?? rep.employee_id}
                    </span>
                    <span className="font-mono text-slate-400">{rep.data_quality}</span>
                  </div>
                  <div>
                    <div className="font-medium text-white">{emp?.name ?? rep.employee_id}</div>
                    <div className="text-slate-400">{emp?.title}</div>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-y border-slate-800 font-mono">
                    <span className="text-slate-300">{rep.market_direction}</span>
                    <span className="text-cyan-300 font-semibold">{rep.recommended_action}</span>
                    <span className="text-slate-400 tabular-nums">{(rep.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{rep.reasoning_summary}</p>
                </div>
              );
            })}
          </div>

          {/* Head Trader + CEO + Chief Risk Officer Triad */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Head Trader Proposal */}
            <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
                  EMP-02 · Head Trader Proposal
                </h2>
                <span className="font-mono text-cyan-300 font-semibold">
                  {activeSession.headTraderProposal?.action ?? 'PENDING'}
                </span>
              </div>

              {activeSession.headTraderProposal ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
                    <div className="bg-slate-900/70 rounded p-2">
                      <div className="text-slate-500">Entry</div>
                      <div className="text-slate-100">
                        {activeSession.headTraderProposal.entryPrice ?? '—'}
                      </div>
                    </div>
                    <div className="bg-slate-900/70 rounded p-2">
                      <div className="text-slate-500">Stop Loss</div>
                      <div className="text-rose-300">
                        {activeSession.headTraderProposal.stopLossPrice ?? '—'}
                      </div>
                    </div>
                    <div className="bg-slate-900/70 rounded p-2">
                      <div className="text-slate-500">Take Profit</div>
                      <div className="text-emerald-300">
                        {activeSession.headTraderProposal.takeProfitPrice ?? '—'}
                      </div>
                    </div>
                    <div className="bg-slate-900/70 rounded p-2">
                      <div className="text-slate-500">Risk : Reward</div>
                      <div className="text-cyan-300">
                        {activeSession.headTraderProposal.riskRewardRatio
                          ? `1 : ${activeSession.headTraderProposal.riskRewardRatio}`
                          : '—'}
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {activeSession.headTraderProposal.thesis}
                  </p>

                  {canExecuteApproved && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-2">
                      <button
                        type="button"
                        disabled={executingTrade || snapshot.mode === 'DEMO'}
                        onClick={() => void handleExecuteApproved()}
                        className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium inline-flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Rocket className="w-3.5 h-3.5" />
                        <span>
                          {executingTrade
                            ? 'Executing & Verifying SL/TP...'
                            : `Execute Approved ${activeSession.finalDecision === 'APPROVED_LONG' ? 'LONG' : 'SHORT'} (${snapshot.mode})`}
                        </span>
                      </button>
                      {snapshot.mode === 'DEMO' && (
                        <div className="text-[11px] font-mono text-amber-300">
                          Mode DEMO is read-only. Switch to PAPER or TESTNET in Positions / Command Center to execute.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-500">Awaiting synthesis...</p>
              )}
            </div>

            {/* CEO Review */}
            <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
                  EMP-01 · CEO Executive Review
                </h2>
                <span
                  className={`font-mono font-semibold ${
                    activeSession.ceoApproved === true
                      ? 'text-emerald-400'
                      : activeSession.ceoApproved === false
                        ? 'text-amber-300'
                        : 'text-slate-500'
                  }`}
                >
                  {activeSession.ceoApproved === null
                    ? 'PENDING'
                    : activeSession.ceoApproved
                      ? 'APPROVED'
                      : 'REJECTED'}
                </span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                {activeSession.ceoReviewSummary ?? 'Awaiting CEO alignment check...'}
              </p>
              <div className="pt-2 border-t border-slate-800/80 text-slate-400 font-mono">
                {activeSession.executionNote}
              </div>
            </div>

            {/* Chief Risk Officer Independent Veto */}
            <div className="bg-[#0B1120] border border-amber-500/30 rounded-xl p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
                  EMP-07 · CRO Independent Veto
                </h2>
                <span
                  className={`font-mono font-semibold ${
                    activeSession.riskVetoed === true
                      ? 'text-rose-400'
                      : activeSession.riskVetoed === false
                        ? 'text-emerald-400'
                        : 'text-slate-500'
                  }`}
                >
                  {activeSession.riskVetoed === null
                    ? 'AUDITING'
                    : activeSession.riskVetoed
                      ? 'VETOED'
                      : 'CLEARED'}
                </span>
              </div>

              <ul className="space-y-1.5 text-slate-300 list-disc pl-4">
                {activeSession.riskAuditReasons.length === 0 ? (
                  <li className="text-slate-500">Awaiting deterministic & CRO audit...</li>
                ) : (
                  activeSession.riskAuditReasons.map((r, idx) => <li key={idx}>{r}</li>)
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Historical Debate Sessions */}
      {snapshot.debateSessions.length > 1 && (
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
            War Room Session Archive ({snapshot.debateSessions.length})
          </h2>
          <div className="divide-y divide-slate-800/70 text-xs">
            {snapshot.debateSessions.map((s) => (
              <div key={s.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 font-mono">
                <div>
                  <span className="text-cyan-400 mr-2">{s.symbol} {s.timeframe}</span>
                  <span className="text-slate-400">{new Date(s.startedAt).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-300">Proposal: {s.headTraderProposal?.action ?? '—'}</span>
                  <span className="text-white font-semibold">{s.finalDecision ?? s.stage}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
