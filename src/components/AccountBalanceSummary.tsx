import { useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert, ShieldCheck, Wrench } from 'lucide-react';
import type { OfficeSnapshot, TradingMode } from '../types/hq';

interface AccountBalanceSummaryProps {
  snapshot: OfficeSnapshot;
  onReconcile: () => Promise<unknown>;
  onChangeMode: (mode: TradingMode) => void;
  onOpenSetupModal: () => void;
}

export function AccountBalanceSummary({
  snapshot,
  onReconcile,
  onChangeMode,
  onOpenSetupModal,
}: AccountBalanceSummaryProps) {
  const [fetching, setFetching] = useState(false);

  const isTestnet = snapshot.mode === 'TESTNET';
  const isDemo = snapshot.mode === 'DEMO';
  const activeAccount = isTestnet
    ? snapshot.execution.testnetAccount
    : snapshot.execution.paperAccount;

  const handleRefresh = async () => {
    setFetching(true);
    try {
      await onReconcile();
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (isTestnet && !snapshot.execution.testnetAccount.lastSyncedAt) {
      void handleRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTestnet]);

  return (
    <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-[var(--font-display)] text-base font-semibold text-white">
              USDⓈ-M Futures Account Balance Summary
            </h2>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                isTestnet
                  ? activeAccount.connected
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                  : snapshot.mode === 'PAPER'
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              {isTestnet
                ? activeAccount.connected
                  ? 'BINANCE TESTNET LIVE'
                  : 'TESTNET DISCONNECTED'
                : snapshot.mode === 'PAPER'
                  ? 'PAPER SIMULATOR ($10K)'
                  : 'DEMO READ-ONLY'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {isTestnet
              ? 'Queries real Binance USDⓈ-M Testnet account equity, margin, and open position risk via server-side HMAC proxy.'
              : snapshot.mode === 'PAPER'
                ? 'Live mark-to-market simulated USDⓈ-M balance synced to real Binance Futures prices.'
                : 'DEMO mode is read-only. Switch to PAPER or TESTNET to track live or simulated Futures equity.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenSetupModal}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 inline-flex items-center gap-1.5"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Configure Binance Keys & Testnet</span>
          </button>
          <button
            type="button"
            disabled={fetching}
            onClick={() => void handleRefresh()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${fetching ? 'animate-spin' : ''}`} />
            <span>{fetching ? 'Syncing Binance...' : 'Fetch Live Balance'}</span>
          </button>
        </div>
      </div>

      {isDemo && (
        <div className="bg-amber-950/30 border border-amber-500/35 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200">
          <span>
            Mode saat ini <strong>DEMO</strong>. Pindah ke <strong>PAPER</strong> (simulasi $10,000 instan) atau <strong>TESTNET</strong> (Binance Testnet API) untuk menjalankan order.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChangeMode('PAPER')}
              className="px-2.5 py-1 rounded bg-cyan-500/20 border border-cyan-500/50 text-cyan-200 font-mono"
            >
              Switch PAPER
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('TESTNET')}
              className="px-2.5 py-1 rounded bg-amber-500/20 border border-amber-500/50 text-amber-100 font-mono"
            >
              Switch TESTNET
            </button>
          </div>
        </div>
      )}

      {isTestnet && !activeAccount.connected && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-lg p-3 flex flex-wrap items-start justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-mono font-semibold text-rose-300">
                Binance Testnet Not Connected
              </div>
              <p className="text-rose-200/90 mt-0.5">
                {activeAccount.errorMessage ??
                  'BINANCE_API_KEY & BINANCE_API_SECRET belum terbaca di server .env / Secrets.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenSetupModal}
            className="px-3 py-1.5 rounded bg-rose-500/20 border border-rose-400/50 text-rose-100 font-mono shrink-0"
          >
            Open Setup Guide
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-slate-900/60 border border-slate-800/90 rounded-lg p-3">
          <div className="text-[11px] text-slate-400">Account Equity</div>
          <div className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
            {activeAccount.connected
              ? `$${activeAccount.equityUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : 'NOT CONNECTED'}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
            {activeAccount.venue}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/90 rounded-lg p-3">
          <div className="text-[11px] text-slate-400">Available Margin</div>
          <div className="mt-1 font-mono text-lg font-semibold text-cyan-300 tabular-nums">
            {activeAccount.connected
              ? `$${activeAccount.availableBalanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
            {snapshot.riskConfig.marginMode} {snapshot.riskConfig.maxLeverage}x
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/90 rounded-lg p-3">
          <div className="text-[11px] text-slate-400">Unrealized PnL</div>
          <div
            className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
              activeAccount.unrealizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {activeAccount.connected
              ? `${activeAccount.unrealizedPnlUsd >= 0 ? '+' : ''}$${activeAccount.unrealizedPnlUsd.toFixed(2)}`
              : '—'}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
            Open: {activeAccount.openPositionsCount}/{snapshot.riskConfig.maxSimultaneousPositions}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/90 rounded-lg p-3">
          <div className="text-[11px] text-slate-400">Realized PnL</div>
          <div
            className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
              activeAccount.realizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {activeAccount.connected
              ? `${activeAccount.realizedPnlUsd >= 0 ? '+' : ''}$${activeAccount.realizedPnlUsd.toFixed(2)}`
              : '—'}
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
            Daily: {activeAccount.dailyPnlPct.toFixed(2)}%
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/90 rounded-lg p-3">
          <div className="text-[11px] text-slate-400">Last Synced</div>
          <div className="mt-1 font-mono text-xs font-medium text-slate-200 flex items-center gap-1.5">
            <ShieldCheck
              className={`w-3.5 h-3.5 ${activeAccount.connected ? 'text-emerald-400' : 'text-slate-500'}`}
            />
            <span>
              {activeAccount.lastSyncedAt
                ? new Date(activeAccount.lastSyncedAt).toLocaleTimeString()
                : 'Not synced'}
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-1">
            {activeAccount.dailyLossLimitBreached ? 'DAILY LIMIT BREACHED' : 'Daily Cap OK'}
          </div>
        </div>
      </div>
    </div>
  );
}
