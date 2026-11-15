import { useState } from 'react';
import type { EmployeeRecord, EmployeeState, RoomDefinition, RoomId } from '../types/hq';

interface EmployeesViewProps {
  employees: EmployeeRecord[];
  rooms: RoomDefinition[];
  onDispatchTask: (input: {
    employeeId: string;
    targetRoom: RoomId;
    state: EmployeeState;
    taskTitle: string;
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

export function EmployeesView({ employees, rooms, onDispatchTask }: EmployeesViewProps) {
  const [selectedId, setSelectedId] = useState<string>(employees[0]?.id ?? 'emp-01');
  const selected = employees.find((e) => e.id === selectedId) ?? employees[0];

  const [targetRoom, setTargetRoom] = useState<RoomId>(selected?.currentRoom ?? 'AI_WAR_ROOM');
  const [nextState, setNextState] = useState<EmployeeState>('ANALYZING');
  const [taskTitle, setTaskTitle] = useState<string>('Phase 1 station inspection and readiness check');
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="pb-4 border-b border-slate-800/80">
        <div className="text-xs font-mono text-cyan-400">8 Independent AI Agents · Phase 1 Registry</div>
        <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold text-white">
          AI Employee Management
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Inspect employee roles, model assignments, and dispatch backend state/room transitions synchronized in real time with the 3D Virtual Office.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee Roster */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {employees.map((emp) => {
            const isSelected = emp.id === selected?.id;
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
                    <span className="text-slate-500">AI Model</span>
                    <span className="font-mono text-slate-300 truncate max-w-[190px]">{emp.assignedModel}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Scorecard</span>
                    <span className="font-mono text-amber-300">Phase 6 Pending</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Profile & Live Backend Dispatcher */}
        {selected && (
          <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-5 h-fit">
            <div>
              <div className="text-xs font-mono text-cyan-400">
                {selected.code} · {selected.provider}
              </div>
              <h2 className="mt-1 font-[var(--font-display)] text-lg font-semibold text-white">
                {selected.name}
              </h2>
              <p className="text-xs text-slate-400">{selected.title}</p>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-300">Core Responsibilities</div>
              <ul className="space-y-1.5 text-xs text-slate-400 list-disc pl-4">
                {selected.responsibilities.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <form onSubmit={handleDispatch} className="pt-4 border-t border-slate-800 space-y-3">
              <div className="text-xs font-medium text-white">
                Dispatch Room & State Transition (Phase 1 Backend)
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Target Room</label>
                <select
                  value={targetRoom}
                  onChange={(e) => setTargetRoom(e.target.value as RoomId)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  placeholder="Describe verification or room task..."
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white transition-colors"
              >
                {submitting ? 'Dispatching...' : 'Dispatch to Backend & Move Avatar'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
