import { useState } from 'react';
import type {
  AIProviderName,
  AIRouterPolicy,
  AgentStructuredReport,
  EmployeeRecord,
  EmployeeState,
  RoomDefinition,
  RoomId,
} from '../types/hq';

interface EmployeesViewProps {
  employees: EmployeeRecord[];
  rooms: RoomDefinition[];
  agentReports: AgentStructuredReport[];
  aiRouterPolicy: AIRouterPolicy;
  onDispatchTask: (input: {
    employeeId: string;
    targetRoom: RoomId;
    state: EmployeeState;
    taskTitle: string;
  }) => Promise<unknown>;
  onRunAgentAnalysis: (input: {
    employeeId: string;
    symbol?: string;
    timeframe?: string;
  }) => Promise<unknown>;
  onUpdateAgentConfig: (input: {
    employeeId: string;
    provider?: AIProviderName;
    fallbackProvider?: AIProviderName;
    assignedModel?: string;
  }) => Promise<unknown>;
}

const ALL_STATES: EmployeeState[] = [
  'IDLE',
  'ANALYZING',
  'RESEARCHING',
  'DISCUSSING',
  'WAITING_FOR_APPROVAL',
  'EXECUTING',
  'MONITORING_TRADE',
  'COMPLETED',
  'ERROR',
];

const MODEL_PRESETS: Array<{ label: string; provider: AIProviderName; model: string }> = [
  { label: 'Gemini 4 Hydrogen (Default)', provider: 'Gemini', model: 'gemini-4-hydrogen' },
  { label: 'Gemini 3.1 Flash Lite (Fast)', provider: 'Gemini', model: 'gemini-3.1-flash-lite' },
  { label: 'Anthropic Claude 3.7 Sonnet', provider: 'Claude', model: 'claude-3-7-sonnet-latest' },
  { label: 'Ollama Qwen 2.5 14B (Local)', provider: 'Ollama', model: 'ollama:qwen2.5:14b' },
  { label: 'Deterministic Python Engine', provider: 'Deterministic Python', model: 'deterministic-exec-v1' },
];

export function EmployeesView({
  employees,
  rooms,
  agentReports,
  aiRouterPolicy,
  onDispatchTask,
  onRunAgentAnalysis,
  onUpdateAgentConfig,
}: EmployeesViewProps) {
  const [selectedId, setSelectedId] = useState<string>(employees[0]?.id ?? 'emp-01');
  const selected = employees.find((e) => e.id === selectedId) ?? employees[0];

  const [targetRoom, setTargetRoom] = useState<RoomId>(selected?.currentRoom ?? 'AI_WAR_ROOM');
  const [nextState, setNextState] = useState<EmployeeState>('ANALYZING');
  const [taskTitle, setTaskTitle] = useState<string>('Station inspection and readiness check');
  const [symbol, setSymbol] = useState<string>('BTCUSDT');
  const [timeframe, setTimeframe] = useState<string>('1h');
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const latestReport = agentReports.find((r) => r.employee_id === selected?.id) ?? null;

  const handleSelectEmployee = (emp: EmployeeRecord) => {
    setSelectedId(emp.id);
    setTargetRoom(emp.currentRoom);
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !taskTitle.trim()) return;
    setSubmitting(true);
    try {
      await onDispatchTask({
        employeeId: selected.id,
        targetRoom,
        state: nextState,
        taskTitle: taskTitle.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunAiCheck = async () => {
    if (!selected) return;
    setAnalyzing(true);
    try {
      await onRunAgentAnalysis({
        employeeId: selected.id,
        symbol,
        timeframe,
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="text-xs font-mono text-cyan-400">
            Phase 2 AI Employees · 8 Agents · Strict JSON Schema Router
          </div>
          <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold text-white">
            AI Employee Management & Provider Router
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Configure each agent&apos;s AI provider/model, invoke real Phase 2 structured JSON evaluations, or dispatch room movements synchronized with the 3D Virtual Office.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-400 text-right">
          <div>
            Daily AI Spend:{' '}
            <span className="text-cyan-300 tabular-nums">
              ${aiRouterPolicy.spentTodayUsd.toFixed(4)} / ${aiRouterPolicy.dailyBudgetUsd.toFixed(2)}
            </span>
          </div>
          <div>Max Tokens/Call: {aiRouterPolicy.maxTokensPerCall}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee Roster */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 h-fit">
          {employees.map((emp) => {
            const isSelected = emp.id === selected?.id;
            const empReport = agentReports.find((r) => r.employee_id === emp.id);
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() => handleSelectEmployee(emp)}
                className={`text-left p-4 rounded-xl border transition-colors ${
                  isSelected
                    ? 'bg-[#11192E] border-cyan-500/60'
                    : 'bg-[#0B1120] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-mono">
                  <span className="text-cyan-400">
                    {emp.code} · {emp.department}
                  </span>
                  <span className="text-slate-300">{emp.state}</span>
                </div>
                <div className="mt-1.5 font-[var(--font-display)] text-base font-semibold text-white">
                  {emp.name}
                </div>
                <div className="text-xs text-slate-400">
                  {emp.title}
                  {emp.canVeto ? ' · VETO Authority' : ''}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Current Room</span>
                    <span className="font-mono text-slate-200">{emp.currentRoom.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Primary Model</span>
                    <span className="font-mono text-slate-300 truncate max-w-[180px]">
                      {emp.provider} · {emp.assignedModel}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Latest Report</span>
                    <span className="font-mono text-cyan-300">
                      {empReport ? `${empReport.recommended_action} (${empReport.data_quality})` : 'Not Run Yet'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Profile, Phase 2 AI Invocation & Manual Dispatcher */}
        {selected && (
          <div className="space-y-4">
            <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
              <div>
                <div className="text-xs font-mono text-cyan-400">
                  {selected.code} · Primary: {selected.provider} · Fallback: {selected.fallbackProvider}
                </div>
                <h2 className="mt-1 font-[var(--font-display)] text-lg font-semibold text-white">
                  {selected.name}
                </h2>
                <p className="text-xs text-slate-400">{selected.title}</p>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-medium text-slate-300">Core Responsibilities</div>
                <ul className="space-y-1 text-xs text-slate-400 list-disc pl-4">
                  {selected.responsibilities.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              {/* Phase 2 Model Selection */}
              <div className="pt-3 border-t border-slate-800 space-y-2.5 text-xs">
                <div className="font-medium text-white">AI Provider & Model Assignment</div>
                <select
                  value={`${selected.provider}|${selected.assignedModel}`}
                  onChange={(e) => {
                    const [provider, assignedModel] = e.target.value.split('|') as [AIProviderName, string];
                    void onUpdateAgentConfig({
                      employeeId: selected.id,
                      provider,
                      assignedModel,
                    });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                >
                  {MODEL_PRESETS.map((p) => (
                    <option key={`${p.provider}|${p.model}`} value={`${p.provider}|${p.model}`}>
                      {p.label}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-100"
                  >
                    <option value="BTCUSDT">BTCUSDT</option>
                    <option value="ETHUSDT">ETHUSDT</option>
                  </select>
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-100"
                  >
                    <option value="5m">5m</option>
                    <option value="15m">15m</option>
                    <option value="1h">1h</option>
                    <option value="4h">4h</option>
                    <option value="1d">1d</option>
                  </select>
                </div>

                <button
                  type="button"
                  disabled={analyzing}
                  onClick={handleRunAiCheck}
                  className="w-full py-2.5 px-4 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white transition-colors"
                >
                  {analyzing ? 'Invoking AI Provider Router...' : 'Run Phase 2 Structured AI Evaluation'}
                </button>
              </div>

              {/* Latest Structured JSON Output */}
              {latestReport && (
                <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between font-mono text-cyan-300">
                    <span>{latestReport.recommended_action}</span>
                    <span>
                      {latestReport.provider_used} · {latestReport.latency_ms}ms
                    </span>
                  </div>
                  <div className="text-slate-400">
                    Direction: <span className="font-mono text-slate-200">{latestReport.market_direction}</span> ·
                    Quality: <span className="font-mono text-amber-300">{latestReport.data_quality}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{latestReport.reasoning_summary}</p>
                  <pre className="bg-[#060913] border border-slate-800 rounded-lg p-2.5 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48">
                    {JSON.stringify(latestReport, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Manual Room & State Dispatch */}
            <form onSubmit={handleDispatch} className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="text-xs font-medium text-white">Manual Room & State Dispatch</div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Target Room</label>
                <select
                  value={targetRoom}
                  onChange={(e) => setTargetRoom(e.target.value as RoomId)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} — {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Employee State</label>
                <select
                  value={nextState}
                  onChange={(e) => setNextState(e.target.value as EmployeeState)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100"
                >
                  {ALL_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Task Description</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 px-4 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white transition-colors"
              >
                {submitting ? 'Dispatching...' : 'Move Avatar & Update State'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
