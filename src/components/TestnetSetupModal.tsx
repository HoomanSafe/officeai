import { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import type { CredentialsStatus, OfficeSnapshot, TradingMode } from '../types/hq';

interface TestnetSetupModalProps {
  open: boolean;
  snapshot: OfficeSnapshot;
  onClose: () => void;
  onFetchCredentialsStatus: () => Promise<CredentialsStatus | null>;
  onReconcile: () => Promise<unknown>;
  onChangeMode: (mode: TradingMode) => Promise<unknown> | void;
}

const ENV_TEMPLATE = `GEMINI_API_KEY="paste_your_gemini_api_key_here"
BINANCE_TESTNET="true"
BINANCE_API_KEY="paste_your_binance_futures_testnet_key_here"
BINANCE_API_SECRET="paste_your_binance_futures_testnet_secret_here"`;

export function TestnetSetupModal({
  open,
  snapshot,
  onClose,
  onFetchCredentialsStatus,
  onReconcile,
  onChangeMode,
}: TestnetSetupModalProps) {
  const [status, setStatus] = useState<CredentialsStatus | null>(null);
  const [envTab, setEnvTab] = useState<'aistudio' | 'local' | 'vercel'>('aistudio');
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadStatus = async () => {
    const res = await onFetchCredentialsStatus();
    if (res) setStatus(res);
  };

  useEffect(() => {
    if (open) {
      void loadStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ENV_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in some iframe policies
    }
  };

  const handleVerifyTestnet = async () => {
    setTesting(true);
    try {
      await loadStatus();
      await onReconcile();
    } finally {
      setTesting(false);
    }
  };

  const testnetAccount = snapshot.execution.testnetAccount;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0B1120] border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-mono text-cyan-400">
              SERVER-SIDE CREDENTIALS & TESTNET WIZARD
            </div>
            <h2 className="font-[var(--font-display)] text-lg font-semibold text-white">
              Step-by-Step: Configure Gemini & Binance Futures Testnet
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close setup wizard"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {/* Live Server Diagnostic */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold text-slate-200">
                Live Server Environment Check (Zero Secrets Exposed to Browser)
              </span>
              <button
                type="button"
                onClick={() => void loadStatus()}
                className="text-cyan-400 hover:text-cyan-300 font-mono inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Re-check</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
              {[
                { label: 'GEMINI_API_KEY', ok: status?.geminiConfigured ?? false },
                { label: 'BINANCE_API_KEY', ok: status?.binanceKeyConfigured ?? false },
                { label: 'BINANCE_API_SECRET', ok: status?.binanceSecretConfigured ?? false },
                { label: 'TESTNET VERIFIED', ok: testnetAccount.connected },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`px-2.5 py-2 rounded-lg border flex items-center gap-1.5 ${
                    item.ok
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  }`}
                >
                  {item.ok ? (
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step 1 */}
          <div className="space-y-1.5">
            <div className="font-mono font-semibold text-cyan-300">
              STEP 1 — Siapkan API Key (Binance Testnet vs Mainnet)
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-300">
              <li>
                <strong>Gemini AI Agents</strong>: Ambil API Key dari Google AI Studio untuk 8 AI employees (`GEMINI_API_KEY`). Jika ini belum dipasang di server, War Room akan fail-closed ke `NO_TRADE` (`SCHEMA_FALLBACK`).
              </li>
              <li>
                <strong>Binance Futures Testnet</strong>: Gunakan API Key & Secret khusus dari{' '}
                <span className="font-mono text-cyan-300">testnet.binancefuture.com</span> (bukan key Mainnet `binance.com`, karena key Mainnet ditolak oleh server Testnet dengan error `-2015`).
              </li>
            </ul>
          </div>

          {/* Step 2 */}
          <div className="space-y-2.5">
            <div className="font-mono font-semibold text-cyan-300">
              STEP 2 — Pasang Variabel di Sisi Server (Bukan Form Browser)
            </div>
            <div className="flex gap-1.5">
              {[
                { id: 'aistudio', label: 'AI Studio Secrets' },
                { id: 'local', label: 'Laptop / PC (.env)' },
                { id: 'vercel', label: 'Vercel Env Vars' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setEnvTab(tab.id as typeof envTab)}
                  className={`px-3 py-1.5 rounded-lg font-mono border ${
                    envTab === tab.id
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
              {envTab === 'aistudio' && (
                <p className="text-slate-300">
                  Buka panel <strong>Secrets / Environment Variables</strong> di UI AI Studio sebelah kiri, lalu tambahkan 4 variabel berikut, kemudian restart preview app:
                </p>
              )}
              {envTab === 'local' && (
                <p className="text-slate-300">
                  Buat atau edit file <span className="font-mono text-cyan-300">.env</span> di folder root project Anda (<span className="font-mono">C:\Users\USER\Downloads\kantorai\.env</span>), tempel isi berikut, lalu jalankan ulang <span className="font-mono">npm run dev</span>:
                </p>
              )}
              {envTab === 'vercel' && (
                <p className="text-slate-300">
                  Di dashboard Vercel, masuk ke <strong>Project Settings → Environment Variables</strong>, masukkan ke-4 key di bawah untuk Production & Preview, lalu klik <strong>Redeploy</strong>:
                </p>
              )}

              <div className="relative">
                <pre className="bg-[#070B16] border border-slate-800 rounded p-3 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                  {ENV_TEMPLATE}
                </pre>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="absolute top-2 right-2 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[11px] inline-flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Step 3 & Step 4 */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800">
            <div className="font-mono font-semibold text-cyan-300">
              STEP 3 & 4 — Uji Koneksi & Aktifkan Mode TESTNET / PAPER
            </div>

            {testnetAccount.errorMessage && !testnetAccount.connected && (
              <div className="bg-rose-950/40 border border-rose-500/40 rounded-lg p-2.5 font-mono text-rose-200">
                Last Binance Check: {testnetAccount.errorMessage}
              </div>
            )}

            {testnetAccount.connected && (
              <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-lg p-2.5 font-mono text-emerald-200">
                Connected to Binance Futures Testnet! Equity: ${testnetAccount.equityUsd.toFixed(2)} · Available: ${testnetAccount.availableBalanceUsd.toFixed(2)}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={testing}
                onClick={() => void handleVerifyTestnet()}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium inline-flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Checking Binance...' : 'Verify Binance Testnet'}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await onChangeMode('TESTNET');
                  await handleVerifyTestnet();
                }}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                Switch to TESTNET Mode
              </button>

              <button
                type="button"
                onClick={async () => {
                  await onChangeMode('PAPER');
                  onClose();
                }}
                className="px-4 py-2 rounded-lg bg-cyan-600/20 border border-cyan-500/50 text-cyan-200 hover:bg-cyan-600/30 font-medium"
              >
                Use PAPER Simulator ($10k)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
