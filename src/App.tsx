import { useState } from 'react';
import { useHqSocket } from './hooks/useHqSocket';
import { NeonOfficeCanvas } from './office3d/NeonOfficeCanvas';
import { Office3DHud } from './components/Office3DHud';
import { CommandCenterView } from './components/CommandCenterView';
import { EmployeesView } from './components/EmployeesView';
import {
  MarketAnalysisView,
  PositionsView,
  TradeJournalView,
  WarRoomView,
} from './components/PhasePendingViews';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { AlertTriangle, NAV_ITEMS, type NavSection, X } from './components/navConfig';
import type { RoomId } from './types/hq';

export default function App() {
  const {
    snapshot,
    wsStatus,
    errorBanner,
    clearError,
    setTradingMode,
    dispatchEmployeeTask,
    startPhase1Drill,
    toggleKillSwitch,
    updateRiskConfig,
  } = useHqSocket();

  const [activeSection, setActiveSection] = useState<NavSection>('OFFICE_3D');
  const [focusedRoomId, setFocusedRoomId] = useState<RoomId | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  if (!snapshot) {
    return (
      <div className="h-screen w-screen bg-[#060913] flex items-center justify-center p-6">
        <div className="max-w-md w-full border border-slate-800 bg-[#0B1120] rounded-xl p-6 text-center space-y-2">
          <div className="font-[var(--font-display)] text-lg font-semibold text-white">
            NEON AI TRADING HQ
          </div>
          <p className="text-xs font-mono text-cyan-400">
            Connecting to backend state & WebSocket stream...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#060913] text-slate-100 overflow-hidden">
      {/* Clean Institutional Top Navigation Bar */}
      <header className="h-14 shrink-0 border-b border-slate-800/90 bg-[#070B16] px-4 lg:px-6 flex items-center justify-between gap-6 z-30">
        <div className="flex items-center gap-6 min-w-0">
          <span className="font-[var(--font-display)] text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            NEON AI TRADING HQ
          </span>

          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                    active
                      ? 'bg-cyan-500/15 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-4 text-xs font-mono shrink-0">
          <span className="text-slate-400 whitespace-nowrap">
            MODE: <span className="text-cyan-300 font-semibold">{snapshot.mode}</span>
          </span>
          <span className="text-slate-600">·</span>
          <span
            className={`whitespace-nowrap ${
              wsStatus === 'CONNECTED' ? 'text-emerald-400' : 'text-amber-300'
            }`}
          >
            WS: {wsStatus}
          </span>
        </div>
      </header>

      {/* Non-blocking System / Risk Error Banner */}
      {errorBanner && (
        <div className="shrink-0 bg-rose-950/90 border-b border-rose-500/40 px-4 py-2 flex items-center justify-between gap-3 text-xs text-rose-100 z-30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={clearError}
            aria-label="Dismiss notification"
            className="p-1 rounded hover:bg-rose-900/60"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Viewport */}
      <main className="flex-1 relative min-h-0 overflow-hidden">
        {activeSection === 'OFFICE_3D' ? (
          <div className="w-full h-full relative">
            <NeonOfficeCanvas
              rooms={snapshot.rooms}
              employees={snapshot.employees}
              focusedRoomId={focusedRoomId}
              selectedEmployeeId={selectedEmployeeId}
              onSelectRoom={(roomId) => {
                setSelectedEmployeeId(null);
                setFocusedRoomId(roomId);
              }}
              onSelectEmployee={(empId) => {
                setFocusedRoomId(null);
                setSelectedEmployeeId(empId);
              }}
            />
            <Office3DHud
              rooms={snapshot.rooms}
              employees={snapshot.employees}
              activityLog={snapshot.activityLog}
              focusedRoomId={focusedRoomId}
              selectedEmployeeId={selectedEmployeeId}
              drillRunning={snapshot.drillRunning}
              killSwitchActive={snapshot.riskConfig.emergencyKillSwitch}
              onFocusRoom={setFocusedRoomId}
              onSelectEmployee={setSelectedEmployeeId}
              onStartDrill={startPhase1Drill}
              onToggleKillSwitch={(active) => toggleKillSwitch(active, '3D Office HUD Toggle')}
            />
          </div>
        ) : (
          <div className="w-full h-full overflow-y-auto">
            {activeSection === 'COMMAND_CENTER' && (
              <CommandCenterView
                snapshot={snapshot}
                wsStatus={wsStatus}
                onChangeMode={setTradingMode}
                onStartDrill={startPhase1Drill}
                onToggleKillSwitch={(active) => toggleKillSwitch(active, 'Command Center Toggle')}
                onOpenOffice3D={() => setActiveSection('OFFICE_3D')}
              />
            )}
            {activeSection === 'EMPLOYEES' && (
              <EmployeesView
                employees={snapshot.employees}
                rooms={snapshot.rooms}
                onDispatchTask={dispatchEmployeeTask}
              />
            )}
            {activeSection === 'WAR_ROOM' && (
              <WarRoomView
                snapshot={snapshot}
                onNavigateSettings={() => setActiveSection('SETTINGS')}
              />
            )}
            {activeSection === 'MARKET_ANALYSIS' && (
              <MarketAnalysisView
                snapshot={snapshot}
                onNavigateSettings={() => setActiveSection('SETTINGS')}
              />
            )}
            {activeSection === 'POSITIONS' && (
              <PositionsView
                snapshot={snapshot}
                onNavigateSettings={() => setActiveSection('SETTINGS')}
              />
            )}
            {activeSection === 'TRADE_JOURNAL' && (
              <TradeJournalView
                snapshot={snapshot}
                onNavigateSettings={() => setActiveSection('SETTINGS')}
              />
            )}
            {activeSection === 'ANALYTICS' && <AnalyticsView snapshot={snapshot} />}
            {activeSection === 'SETTINGS' && (
              <SettingsView
                snapshot={snapshot}
                onChangeMode={setTradingMode}
                onToggleKillSwitch={toggleKillSwitch}
                onUpdateRiskConfig={updateRiskConfig}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
