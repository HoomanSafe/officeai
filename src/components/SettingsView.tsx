import { useState } from 'react';
import type { AIRouterPolicy, MarginMode, OfficeSnapshot, RiskConfig, TradingMode } from '../types/hq';
import { Lock, ShieldAlert, ShieldCheck } from './navConfig';

interface SettingsViewProps {
  snapshot: OfficeSnapshot;
  onChangeMode: (mode: TradingMode) => void;
  onToggleKillSwitch: (active: boolean, reason?: string) => Promise<unknown>;
  onUpdateRiskConfig: (patch: Partial<RiskConfig>) => Promise<unknown>;
  onUpdateRouterPolicy: (patch: Partial<AIRouterPolicy>) => Promise<unknown>;
}

export function SettingsView({
  snapshot,
  onChangeMode,
  onToggleKillSwitch,
  onUpdateRiskConfig,
  onUpdateRouterPolicy,
}: SettingsViewProps) {
  const [marginMode, setMarginMode] = useState<MarginMode>(snapshot.riskConfig.marginMode);
  const [riskPerTrade, setRiskPerTrade] = useState(snapshot.riskConfig.riskPerTradePct);
  const [maxDailyLoss, setMaxDailyLoss] = useState(snapshot.riskConfig.maxDailyLossPct);
  const [maxPositions, setMaxPositions] = useState(snapshot.riskConfig.maxSimultaneousPositions);
  const [targetRR, setTargetRR] = useState(snapshot.riskConfig.targetRiskReward);
  const [maxLev, setMaxLev] = useState(snapshot.riskConfig.maxLeverage);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const [maxTokens, setMaxTokens] = useState(snapshot.aiRouterPolicy.maxTokensPerCall);
  const [dailyBudget, setDailyBudget] = useState(snapshot.aiRouterPolicy.dailyBudgetUsd);
  const [timeoutMs, setTimeoutMs] = useState(snapshot.aiRouterPolicy.timeoutMs);
  const [enableFallback, setEnableFallback] = useState(snapshot.aiRouterPolicy.enableFallback);

  const handleSaveRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateRiskConfig({
      marginMode,
      riskPerTradePct: Number(riskPerTrade),
      maxDailyLossPct: Number(maxDailyLoss),
      maxSimultaneousPositions: Number(maxPositions),
      targetRiskReward: Number(targetRR),
      maxLeverage: Number(maxLev),
    });
    setSavedNotice(`Risk parameters saved (${marginMode} margin mode active).`);
    setTimeout(() => setSavedNotice(null), 3500);
  };

  const handleSaveRouter = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateRouterPolicy({
      maxTokensPerCall: Number(maxTokens),
      dailyBudgetUsd: Number(dailyBudget),
      timeoutMs: Number(timeoutMs),
      enableFallback,
    });
    setSavedNotice('AI Provider Router budget & fallback policy updated.');
    setTimeout(() => setSavedNotice(null), 3500);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="pb-4 border-b border-slate-800/80">
        <div className="text-xs font-mono text-cyan-400">Company Configuration, CROSS Margin & AI Router</div>
        <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold text-white">
          System Settings & Risk Controls
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          API credentials are strictly server-side environment variables. Configure risk rules, margin mode (CROSS default), and AI provider token/cost limits here.
        </p>
      </div>

      {/* Clear Server API Credentials Guide (No API Key Inputs in Browser) */}
      <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div>
          <div className="font-mono text-emerald-400 font-semibold">1. Binance Public Data (Phase 3)</div>
          <p className="mt-1 text-slate-400">
            0 API keys needed. Candlestick, mark price, funding rate, and order book stream directly via Binance public REST API.
          </p>
        </div>
        <div>
          <div className="font-mono text-cyan-300 font-semibold">2. AI Engine (Phase 2)</div>
          <p className="mt-1 text-slate-400">
            Gemini API runs automatically on the server. Claude (<span className="font-mono">ANTHROPIC_API_KEY</span>) and Ollama are strictly optional.
          </p>
        </div>
        <div>
          <div className="font-mono text-amber-300 font-semibold">3. Binance Trading Key (Phase 5)</div>
          <p className="mt-1 text-slate-400">
            Keep your Binance API Key & Secret ONLY in server <span className="font-mono text-slate-200">.env</span> (<span className="font-mono text-slate-200">BINANCE_API_KEY</span>). Never enter exchange secrets in browser UI.
          </p>
        </div>
      </div>

      {savedNotice && (
        <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl px-4 py-2.5 text-xs text-emerald-200">
          {savedNotice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deterministic Risk Parameters */}
        <form onSubmit={handleSaveRisk} className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
              Deterministic Risk Engine Parameters
            </h2>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="space-y-1.5 text-xs">
            <label className="block text-slate-400">Binance Margin Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {(['CROSS', 'ISOLATED'] as MarginMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMarginMode(m)}
                  className={`py-2 px-3 rounded-lg font-mono border text-xs transition-colors ${
                    marginMode === m
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {m} {m === 'CROSS' ? '(Recommended)' : ''}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-amber-300/90 leading-relaxed pt-1">
              Note: CROSS margin shares your entire USDⓈ-M wallet balance across positions. Verified exchange Stop Loss + {riskPerTrade}% max risk/trade are strictly mandatory so a single losing trade cannot threaten the shared wallet.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Risk Per Trade (%)</label>
              <input
                type="number"
                step="0.05"
                min="0.05"
                max="2.0"
                value={riskPerTrade}
                onChange={(e) => setRiskPerTrade(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 font-mono text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Max Daily Loss (%)</label>
              <input
                type="number"
                step="0.25"
                min="0.25"
                max="5.0"
                value={maxDailyLoss}
                onChange={(e) => setMaxDailyLoss(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 font-mono text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Max Simultaneous Positions</label>
              <input
                type="number"
                step="1"
                min="1"
                max="5"
                value={maxPositions}
                onChange={(e) => setMaxPositions(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 font-mono text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Target Risk/Reward (1:X)</label>
              <input
                type="number"
                step="0.1"
                min="1.2"
                max="5.0"
                value={targetRR}
                onChange={(e) => setTargetRR(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 font-mono text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Max Leverage (x)</label>
              <input
                type="number"
                step="1"
                min="1"
                max="10"
                value={maxLev}
                onChange={(e) => setMaxLev(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 font-mono text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Position Mode</label>
              <div className="bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-300">
                {snapshot.riskConfig.positionMode}
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
          >
            Save Risk Parameters
          </button>
        </form>

        {/* Trading Mode, AI Router Policy & Kill Switch */}
        <div className="space-y-6">
          <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
              Trading Mode Selection
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {(['DEMO', 'PAPER', 'TESTNET', 'LIVE'] as TradingMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChangeMode(mode)}
                  className={`py-2.5 px-3 rounded-lg text-xs font-mono border flex items-center justify-center gap-1.5 ${
                    snapshot.mode === mode
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {mode === 'LIVE' && <Lock className="w-3.5 h-3.5 text-rose-400" />}
                  <span>{mode}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">{snapshot.liveLockReason}</p>
          </div>

          <form onSubmit={handleSaveRouter} className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3 text-xs">
            <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
              AI Provider Router Limits (Phase 2)
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Max Tokens</label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Daily Budget ($)</label>
                <input
                  type="number"
                  step="0.25"
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Timeout (ms)</label>
                <input
                  type="number"
                  step="1000"
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-100"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-slate-300 pt-1">
              <input
                type="checkbox"
                checked={enableFallback}
                onChange={(e) => setEnableFallback(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900"
              />
              <span>Enable automatic provider fallback on timeout/error</span>
            </label>
            <button
              type="submit"
              className="w-full py-2 px-4 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white transition-colors"
            >
              Update AI Router Policy
            </button>
          </form>

          <div className="bg-[#0B1120] border border-rose-500/30 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
                Emergency Trading Kill Switch
              </h2>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <button
              type="button"
              onClick={() =>
                onToggleKillSwitch(
                  !snapshot.riskConfig.emergencyKillSwitch,
                  'Administrator toggle from Settings Console',
                )
              }
              className={`w-full py-2.5 px-4 rounded-lg text-xs font-medium transition-colors ${
                snapshot.riskConfig.emergencyKillSwitch
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
              }`}
            >
              {snapshot.riskConfig.emergencyKillSwitch
                ? 'Clear Emergency Kill Switch'
                : 'Activate Emergency Kill Switch'}
            </button>
          </div>
        </div>
      </div>

      {/* Real AI Usage Ledger */}
      <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 overflow-x-auto">
        <h2 className="font-[var(--font-display)] text-base font-semibold text-white pb-3 border-b border-slate-800">
          AI Provider Usage & Cost Audit Ledger ({snapshot.aiUsage.length})
        </h2>
        {snapshot.aiUsage.length === 0 ? (
          <p className="text-xs text-slate-400 pt-3">
            No AI provider calls recorded yet. Invoke an agent in the Employees tab to record real token usage and latency.
          </p>
        ) : (
          <table className="w-full text-left text-xs mt-2">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-3 font-medium">Employee</th>
                <th className="py-2 pr-3 font-medium">Provider / Model</th>
                <th className="py-2 pr-3 font-medium">Tokens (In/Out)</th>
                <th className="py-2 pr-3 font-medium">Latency</th>
                <th className="py-2 pr-3 font-medium">Est. Cost</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {snapshot.aiUsage.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 pr-3 font-mono text-cyan-300">{u.employeeCode}</td>
                  <td className="py-2 pr-3 font-mono text-slate-200">
                    {u.provider} · {u.model}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-slate-300">
                    {u.promptTokens} / {u.completionTokens}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-slate-300">{u.latencyMs}ms</td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-slate-300">
                    ${u.estimatedCostUsd.toFixed(5)}
                  </td>
                  <td className="py-2 font-mono text-slate-300">
                    {u.status}
                    {u.errorMessage ? ` — ${u.errorMessage}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
