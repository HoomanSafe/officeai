import { useState } from 'react';
import type { ActivityLogEntry, EmployeeRecord, RoomDefinition, RoomId } from '../types/hq';
import { ChevronDown, ChevronUp, Play, RotateCcw, ShieldAlert, X } from './navConfig';

interface Office3DHudProps {
  rooms: RoomDefinition[];
  employees: EmployeeRecord[];
  activityLog: ActivityLogEntry[];
  focusedRoomId: RoomId | null;
  selectedEmployeeId: string | null;
  drillRunning: boolean;
  killSwitchActive: boolean;
  onFocusRoom: (roomId: RoomId | null) => void;
  onSelectEmployee: (empId: string | null) => void;
  onStartDrill: () => void;
  onToggleKillSwitch: (active: boolean) => void;
}

export function Office3DHud({
  rooms,
  employees,
  activityLog,
  focusedRoomId,
  selectedEmployeeId,
  drillRunning,
  killSwitchActive,
  onFocusRoom,
  onSelectEmployee,
  onStartDrill,
  onToggleKillSwitch,
}: Office3DHudProps) {
  const [dockExpanded, setDockExpanded] = useState(true);
  const [logOpen, setLogOpen] = useState(false);

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId) ?? null;
  const focusedRoom = rooms.find((r) => r.id === focusedRoomId) ?? null;

  return (
    <>
      {/* Focused Room or Selected Employee Inspector (compact top-left, never center) */}
      {(selectedEmployee || focusedRoom) && (
        <div className="absolute top-4 left-4 z-20 w-80 bg-[#0B1120]/95 border border-slate-700/70 rounded-xl p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {selectedEmployee ? (
                <>
                  <div className="text-xs font-mono text-cyan-400">
                    {selectedEmployee.code} · {selectedEmployee.department}
                  </div>
                  <h3 className="mt-0.5 font-[var(--font-display)] text-base font-semibold text-white truncate">
                    {selectedEmployee.name}
                  </h3>
                  <div className="text-xs text-slate-400">{selectedEmployee.title}</div>
                </>
              ) : focusedRoom ? (
                <>
                  <div className="text-xs font-mono text-cyan-400">
                    {focusedRoom.code} · {focusedRoom.wing}
                  </div>
                  <h3 className="mt-0.5 font-[var(--font-display)] text-base font-semibold text-white truncate">
                    {focusedRoom.name}
                  </h3>
                </>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                onSelectEmployee(null);
                onFocusRoom(null);
              }}
              aria-label="Close inspector"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {selectedEmployee ? (
            <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">State</span>
                <span className="font-mono text-cyan-300">{selectedEmployee.state}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Location</span>
                <span className="font-mono text-slate-200">
                  {selectedEmployee.currentRoom.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Provider</span>
                <span className="font-mono text-slate-300">{selectedEmployee.provider}</span>
              </div>
              <p className="text-slate-300 leading-relaxed pt-1">{selectedEmployee.currentTask}</p>
            </div>
          ) : focusedRoom ? (
            <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-xs">
              <p className="text-slate-300 leading-relaxed">{focusedRoom.purpose}</p>
              <div className="pt-1 flex justify-between text-slate-400">
                <span>Occupants</span>
                <span className="font-mono tabular-nums text-slate-200">
                  {employees.filter((e) => e.currentRoom === focusedRoom.id).length} Active
                </span>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Optional Slide-over Activity Feed Drawer (bottom-right toggle only) */}
      {logOpen && (
        <div className="absolute top-4 right-4 bottom-24 z-20 w-96 max-w-[calc(100vw-2rem)] bg-[#0B1120]/95 border border-slate-700/70 rounded-xl flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div>
              <h3 className="font-[var(--font-display)] text-sm font-semibold text-white">
                Live Backend Activity Log
              </h3>
              <p className="text-xs text-slate-400">Authoritative server events via WebSocket</p>
            </div>
            <button
              type="button"
              onClick={() => setLogOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 px-4">
            {activityLog.map((entry) => (
              <div key={entry.id} className="py-3 text-xs">
                <div className="flex items-center justify-between gap-2 text-slate-400 font-mono">
                  <span className="text-cyan-400">{entry.employeeCode}</span>
                  <span className="tabular-nums">
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
                <div className="mt-1 font-medium text-slate-100">{entry.action}</div>
                <div className="mt-0.5 text-slate-400 leading-relaxed">{entry.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsible Unified Bottom Control Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(980px,95vw)] flex flex-col items-center pointer-events-none">
        <button
          type="button"
          onClick={() => setDockExpanded((v) => !v)}
          className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-t-lg bg-[#0B1120]/95 border border-b-0 border-slate-700/70 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          {dockExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          <span>{dockExpanded ? 'Hide Office Controls' : 'Show Office Controls'}</span>
        </button>

        {dockExpanded && (
          <div className="pointer-events-auto w-full bg-[#0B1120]/95 border border-slate-700/70 rounded-xl p-3 shadow-2xl space-y-2.5">
            {/* Row 1: Camera Presets (Overview + 9 Rooms) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => {
                  onSelectEmployee(null);
                  onFocusRoom(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                  focusedRoomId === null && selectedEmployeeId === null
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>HQ Overview</span>
              </button>

              {rooms.map((room) => {
                const active = focusedRoomId === room.id;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => {
                      onSelectEmployee(null);
                      onFocusRoom(room.id);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-100'
                    }`}
                  >
                    {room.shortName}
                  </button>
                );
              })}
            </div>

            {/* Row 2: 8 Employee Quick Jump + Phase 1 Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/90">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {employees.map((emp) => {
                  const selected = selectedEmployeeId === emp.id;
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => onSelectEmployee(selected ? null : emp.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                        selected
                          ? 'bg-purple-500/25 text-purple-200 border border-purple-400/50'
                          : 'bg-slate-900/90 text-slate-400 border border-slate-800 hover:text-white'
                      }`}
                    >
                      {emp.code}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setLogOpen((v) => !v)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-slate-200 border border-slate-700 hover:border-slate-600 transition-colors whitespace-nowrap shrink-0"
                >
                  {logOpen ? 'Hide Activity Log' : `Activity Log (${activityLog.length})`}
                </button>

                <button
                  type="button"
                  disabled={drillRunning || killSwitchActive}
                  onClick={onStartDrill}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{drillRunning ? 'Drill Running...' : 'Run Phase 1 Routing Drill'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleKillSwitch(!killSwitchActive)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                    killSwitchActive
                      ? 'bg-rose-600 text-white hover:bg-rose-500'
                      : 'bg-slate-900 text-rose-300 border border-rose-500/40 hover:bg-rose-950/60'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{killSwitchActive ? 'Reset Kill Switch' : 'Kill Switch'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
