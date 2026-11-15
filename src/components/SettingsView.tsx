import { useState } from 'react';
import type { OfficeSnapshot, RiskConfig, TradingMode } from '../types/hq';
import { Lock, ShieldAlert, ShieldCheck } from './navConfig';

interface SettingsViewProps {
  snapshot: OfficeSnapshot;
  onChangeMode: (mode: TradingMode) => void;
  onToggleKillSwitch: (active: boolean, reason?: string) => Promise<unknown>;
  onUpdateRiskConfig: (patch: Partial<RiskConfig>) => Promise<unknown>;
}

export function SettingsView({
  snapshot,
  onChangeMode,
  onToggleKillSwitch,
  onUpdateRiskConfig,
}: SettingsViewProps) {
  const [riskPerTrade, setRiskPerTrade] = useState(snapshot.riskConfig.riskPerTradePct);
  const [maxDailyLoss, setMaxDailyLoss] = useState(snapshot.riskConfig.maxDailyLossPct);
  const [maxPositions, setMaxPositions] = useState(snapshot.riskConfig.maxSimultaneousPositions);
  const [targetRR, setTargetRR] = useState(snapshot.riskConfig.targetRiskReward);
  const [maxLev, setMaxLev] = useState(snapshot.riskConfig.maxLeverage);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleSaveRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateRiskConfig({
      riskPerTradePct: Number(riskPerTrade),
      maxDailyLossPct: Number(maxDailyLoss),
      maxSimultaneousPositions: Number(maxPositions),
      targetRiskReward: Number(targetRR),
      maxLeverage: Number(maxLev),
    });
    setSavedNotice('Deterministic risk parameters updated on backend.');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="pb-4 border-b border-slate-800/80">
        <div className="text-xs font-mono text-cyan-400">Company Configuration & Risk Policy</div>
        <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold text-white">
          System Settings & Risk Controls
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          API secrets must never be pasted into the browser. Configure Binance, Gemini, and Anthropic keys exclusively via backend environment variables.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deterministic Risk Parameters */}
        <form onSubmit={handleSaveRisk} className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
              Deterministic Risk Engine Parameters
            </h2>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
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
              <label className="block text-slate-400 mb-1">Margin & Position Mode</label>
              <div className="bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-300">
                {snapshot.riskConfig.marginMode} · {snapshot.riskConfig.positionMode}
              </div>
            </div>
          </div>

          {savedNotice && <div className="text-xs text-emerald-400 font-medium">{savedNotice}</div>}

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
          >
            Save Risk Parameters
          </button>
        </form>

        {/* Trading Mode & Kill Switch */}
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

          <div className="bg-[#0B1120] border border-rose-500/30 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
                Emergency Trading Kill Switch
              </h2>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-xs text-slate-400">
              Immediately halts active orchestration workflows, blocks any new order execution, and stations the Chief Risk Officer in protective monitoring mode.
            </p>
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
    </div>
  );
}
