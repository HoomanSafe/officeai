import type {
  ActivityLogEntry,
  EmployeeRecord,
  EmployeeState,
  OfficeSnapshot,
  RiskConfig,
  RoomId,
  ServerWsEvent,
  TaskRecord,
  TradingMode,
} from '../src/types/hq';
import {
  buildIntegrationStatuses,
  createInitialEmployees,
  INITIAL_RISK_CONFIG,
  OFFICE_ROOMS,
} from './officeData';

type Listener = (event: ServerWsEvent) => void;

export class OfficeStore {
  private readonly startedAt = Date.now();
  private mode: TradingMode = 'DEMO';
  private readonly liveLocked = true;
  private readonly liveLockReason =
    'LIVE mode is locked in Phase 1. Requires Phase 5 reconciliation tests, Phase 6 backtesting/paper validation, and explicit admin unlock.';
  private employees: EmployeeRecord[] = createInitialEmployees();
  private tasks: TaskRecord[] = [];
  private activityLog: ActivityLogEntry[] = [];
  private riskConfig: RiskConfig = { ...INITIAL_RISK_CONFIG };
  private connectedClients = 0;
  private drillRunning = false;
  private drillTimers: ReturnType<typeof setTimeout>[] = [];
  private listeners = new Set<Listener>();

  constructor() {
    this.appendLog({
      employeeId: 'system',
      employeeCode: 'HQ-CORE',
      employeeName: 'NEON HQ Orchestrator',
      roomId: 'TRADING_FLOOR',
      state: 'IDLE',
      action: 'Phase 1 Foundation Initialized',
      detail: '9 virtual rooms and 8 AI employee agents registered. Trading mode: DEMO. External exchange APIs: NOT CONNECTED.',
      category: 'SYSTEM',
    });
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ServerWsEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  public setClientCount(count: number): void {
    this.connectedClients = count;
    this.emit({
      type: 'system:status',
      payload: {
        connectedClients: this.connectedClients,
        drillRunning: this.drillRunning,
        serverTime: new Date().toISOString(),
      },
    });
  }

  public getSnapshot(): OfficeSnapshot {
    return {
      companyName: 'NEON AI TRADING HQ',
      phase: 'PHASE_1_FOUNDATION',
      mode: this.mode,
      liveLocked: this.liveLocked,
      liveLockReason: this.liveLockReason,
      serverTime: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      connectedClients: this.connectedClients,
      drillRunning: this.drillRunning,
      rooms: OFFICE_ROOMS,
      employees: this.employees,
      tasks: this.tasks.slice(0, 40),
      activityLog: this.activityLog.slice(0, 80),
      integrations: buildIntegrationStatuses(),
      riskConfig: this.riskConfig,
    };
  }

  public getEmployees(): EmployeeRecord[] {
    return this.employees;
  }

  public getRooms() {
    return OFFICE_ROOMS;
  }

  public getActivityLog(): ActivityLogEntry[] {
    return this.activityLog.slice(0, 80);
  }

  private allocateSlot(roomId: RoomId, employeeId: string) {
    const room = OFFICE_ROOMS.find((r) => r.id === roomId) ?? OFFICE_ROOMS[0];
    const occupants = this.employees.filter((e) => e.currentRoom === roomId && e.id !== employeeId);
    const slotIndex = occupants.length % room.slots.length;
    return room.slots[slotIndex];
  }

  private appendLog(input: Omit<ActivityLogEntry, 'id' | 'timestamp'>): ActivityLogEntry {
    const entry: ActivityLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...input,
    };
    this.activityLog.unshift(entry);
    if (this.activityLog.length > 200) {
      this.activityLog.length = 200;
    }
    this.emit({ type: 'activity:created', payload: entry });
    return entry;
  }

  public setMode(nextMode: TradingMode): { ok: boolean; error?: string; mode: TradingMode } {
    if (nextMode === 'LIVE') {
      this.appendLog({
        employeeId: 'emp-07',
        employeeCode: 'EMP-07',
        employeeName: 'Victor Krell',
        roomId: 'RISK_OFFICE',
        state: 'ERROR',
        action: 'LIVE Mode Blocked',
        detail: this.liveLockReason,
        category: 'RISK',
      });
      return { ok: false, error: this.liveLockReason, mode: this.mode };
    }

    if (nextMode === 'TESTNET') {
      const hasTestnet = Boolean(process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET);
      if (!hasTestnet) {
        this.mode = nextMode;
        this.emit({ type: 'mode:changed', payload: { mode: this.mode, liveLocked: this.liveLocked } });
        this.appendLog({
          employeeId: 'emp-08',
          employeeCode: 'EMP-08',
          employeeName: 'Soren Lindqvist',
          roomId: 'EXECUTION_CENTER',
          state: 'IDLE',
          action: 'Mode Switched to TESTNET (Credentials Not Connected)',
          detail: 'Switched mode selector to TESTNET. Binance Testnet API keys are NOT CONNECTED in environment; execution remains disabled.',
          category: 'MODE',
        });
        return { ok: true, mode: this.mode };
      }
    }

    this.mode = nextMode;
    this.emit({ type: 'mode:changed', payload: { mode: this.mode, liveLocked: this.liveLocked } });
    this.appendLog({
      employeeId: 'emp-01',
      employeeCode: 'EMP-01',
      employeeName: 'Marcus Vance',
      roomId: 'CEO_OFFICE',
      state: 'IDLE',
      action: `Trading Mode Changed to ${nextMode}`,
      detail: `Company operational mode updated to ${nextMode}. Phase 1 safety guardrails active.`,
      category: 'MODE',
    });
    return { ok: true, mode: this.mode };
  }

  public toggleKillSwitch(active: boolean, reason = 'Manual administrator action'): RiskConfig {
    this.riskConfig = { ...this.riskConfig, emergencyKillSwitch: active };
    if (active) {
      this.clearDrillTimers();
      this.drillRunning = false;
      for (const emp of this.employees) {
        const targetRoom = emp.homeRoom;
        emp.currentRoom = targetRoom;
        emp.targetSlot = this.allocateSlot(targetRoom, emp.id);
        emp.state = emp.id === 'emp-07' ? 'MONITORING_TRADE' : 'IDLE';
        emp.currentTask =
          emp.id === 'emp-07'
            ? 'KILL SWITCH ARMED · Blocking all new entries'
            : 'Halted by Emergency Kill Switch';
        emp.lastUpdatedAt = new Date().toISOString();
        this.emit({ type: 'employee:updated', payload: { ...emp } });
      }
    } else {
      for (const emp of this.employees) {
        emp.state = 'IDLE';
        emp.currentTask = `Standby in ${emp.currentRoom.replace(/_/g, ' ')}`;
        emp.lastUpdatedAt = new Date().toISOString();
        this.emit({ type: 'employee:updated', payload: { ...emp } });
      }
    }

    this.emit({ type: 'risk:updated', payload: this.riskConfig });
    this.emit({
      type: 'system:status',
      payload: {
        connectedClients: this.connectedClients,
        drillRunning: this.drillRunning,
        serverTime: new Date().toISOString(),
      },
    });
    this.appendLog({
      employeeId: 'emp-07',
      employeeCode: 'EMP-07',
      employeeName: 'Victor Krell',
      roomId: 'RISK_OFFICE',
      state: active ? 'ERROR' : 'COMPLETED',
      action: active ? 'Emergency Kill Switch ACTIVATED' : 'Emergency Kill Switch Cleared',
      detail: reason,
      category: 'RISK',
    });

    return this.riskConfig;
  }

  public updateRiskConfig(patch: Partial<RiskConfig>): RiskConfig {
    this.riskConfig = {
      ...this.riskConfig,
      riskPerTradePct:
        typeof patch.riskPerTradePct === 'number'
          ? Math.min(2.0, Math.max(0.05, Number(patch.riskPerTradePct.toFixed(2))))
          : this.riskConfig.riskPerTradePct,
      maxDailyLossPct:
        typeof patch.maxDailyLossPct === 'number'
          ? Math.min(5.0, Math.max(0.25, Number(patch.maxDailyLossPct.toFixed(2))))
          : this.riskConfig.maxDailyLossPct,
      maxSimultaneousPositions:
        typeof patch.maxSimultaneousPositions === 'number'
          ? Math.min(5, Math.max(1, Math.round(patch.maxSimultaneousPositions)))
          : this.riskConfig.maxSimultaneousPositions,
      targetRiskReward:
        typeof patch.targetRiskReward === 'number'
          ? Math.min(5.0, Math.max(1.2, Number(patch.targetRiskReward.toFixed(1))))
          : this.riskConfig.targetRiskReward,
      maxLeverage:
        typeof patch.maxLeverage === 'number'
          ? Math.min(10, Math.max(1, Math.round(patch.maxLeverage)))
          : this.riskConfig.maxLeverage,
    };

    this.emit({ type: 'risk:updated', payload: this.riskConfig });
    this.appendLog({
      employeeId: 'emp-07',
      employeeCode: 'EMP-07',
      employeeName: 'Victor Krell',
      roomId: 'RISK_OFFICE',
      state: 'COMPLETED',
      action: 'Deterministic Risk Parameters Updated',
      detail: `Risk/trade=${this.riskConfig.riskPerTradePct}%, MaxDailyLoss=${this.riskConfig.maxDailyLossPct}%, MaxPos=${this.riskConfig.maxSimultaneousPositions}, MaxLev=${this.riskConfig.maxLeverage}x`,
      category: 'RISK',
    });
    return this.riskConfig;
  }

  public dispatchEmployee(input: {
    employeeId: string;
    targetRoom: RoomId;
    state: EmployeeState;
    taskTitle: string;
    notes?: string;
  }): { ok: boolean; error?: string; employee?: EmployeeRecord; task?: TaskRecord } {
    if (this.riskConfig.emergencyKillSwitch && input.state === 'EXECUTING') {
      return { ok: false, error: 'Cannot transition to EXECUTING while Emergency Kill Switch is active.' };
    }

    const emp = this.employees.find((e) => e.id === input.employeeId);
    if (!emp) {
      return { ok: false, error: 'Employee not found.' };
    }

    const roomExists = OFFICE_ROOMS.some((r) => r.id === input.targetRoom);
    if (!roomExists) {
      return { ok: false, error: 'Target room not found.' };
    }

    const moved = emp.currentRoom !== input.targetRoom;
    emp.currentRoom = input.targetRoom;
    emp.targetSlot = this.allocateSlot(input.targetRoom, emp.id);
    emp.state = input.state;
    emp.currentTask = input.taskTitle;
    emp.lastUpdatedAt = new Date().toISOString();

    const task: TaskRecord = {
      id: `tsk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: input.taskTitle,
      employeeId: emp.id,
      targetRoom: input.targetRoom,
      state: input.state,
      createdAt: emp.lastUpdatedAt,
      updatedAt: emp.lastUpdatedAt,
      notes: input.notes ?? 'Phase 1 task state transition via backend orchestrator',
    };
    this.tasks.unshift(task);
    if (this.tasks.length > 80) this.tasks.length = 80;

    this.emit({ type: 'employee:updated', payload: { ...emp } });
    this.emit({ type: 'task:updated', payload: task });
    this.appendLog({
      employeeId: emp.id,
      employeeCode: emp.code,
      employeeName: emp.name,
      roomId: input.targetRoom,
      state: input.state,
      action: moved ? `Moved to ${input.targetRoom.replace(/_/g, ' ')} · ${input.state}` : `State -> ${input.state}`,
      detail: input.taskTitle,
      category: moved ? 'MOVEMENT' : 'TASK',
    });

    return { ok: true, employee: emp, task };
  }

  private clearDrillTimers(): void {
    for (const timer of this.drillTimers) {
      clearTimeout(timer);
    }
    this.drillTimers = [];
  }

  public startPhase1WorkflowDrill(): { ok: boolean; error?: string } {
    if (this.riskConfig.emergencyKillSwitch) {
      return { ok: false, error: 'Emergency Kill Switch is armed. Clear kill switch before running Phase 1 drill.' };
    }
    if (this.drillRunning) {
      return { ok: false, error: 'A Phase 1 State & Movement Verification Drill is already running.' };
    }

    this.drillRunning = true;
    this.emit({
      type: 'system:status',
      payload: {
        connectedClients: this.connectedClients,
        drillRunning: true,
        serverTime: new Date().toISOString(),
      },
    });

    this.appendLog({
      employeeId: 'emp-01',
      employeeCode: 'EMP-01',
      employeeName: 'Marcus Vance',
      roomId: 'CEO_OFFICE',
      state: 'ANALYZING',
      action: 'Started Phase 1 Workflow & Routing Drill (DEMO)',
      detail: 'Verifying backend state machine, room navigation, and WebSocket sync across all 8 employees. No market orders placed.',
      category: 'SYSTEM',
    });

    const scheduleStep = (delayMs: number, fn: () => void) => {
      const t = setTimeout(() => {
        if (!this.riskConfig.emergencyKillSwitch) fn();
      }, delayMs);
      this.drillTimers.push(t);
    };

    // Step 1: Analysts begin work in their respective labs
    scheduleStep(300, () => {
      this.dispatchEmployee({
        employeeId: 'emp-03',
        targetRoom: 'TECHNICAL_ROOM',
        state: 'ANALYZING',
        taskTitle: 'Phase 1 Drill: Verifying Technical Room workstation telemetry',
      });
      this.dispatchEmployee({
        employeeId: 'emp-04',
        targetRoom: 'SMC_ROOM',
        state: 'ANALYZING',
        taskTitle: 'Phase 1 Drill: Verifying SMC structure workspace state',
      });
      this.dispatchEmployee({
        employeeId: 'emp-05',
        targetRoom: 'ORDER_FLOW_LAB',
        state: 'RESEARCHING',
        taskTitle: 'Phase 1 Drill: Checking Order Flow feed readiness (Not Connected)',
      });
      this.dispatchEmployee({
        employeeId: 'emp-06',
        targetRoom: 'QUANT_LAB',
        state: 'RESEARCHING',
        taskTitle: 'Phase 1 Drill: Verifying Quant Lab statistical sandbox',
      });
    });

    // Step 2: Analysts + Head Trader + CEO + CRO gather in AI War Room
    scheduleStep(3200, () => {
      this.dispatchEmployee({
        employeeId: 'emp-01',
        targetRoom: 'AI_WAR_ROOM',
        state: 'DISCUSSING',
        taskTitle: 'Convening War Room briefing (Phase 1 routing verification)',
      });
      this.dispatchEmployee({
        employeeId: 'emp-02',
        targetRoom: 'AI_WAR_ROOM',
        state: 'DISCUSSING',
        taskTitle: 'Presenting directional template (NO TRADE in Phase 1)',
      });
      this.dispatchEmployee({
        employeeId: 'emp-03',
        targetRoom: 'AI_WAR_ROOM',
        state: 'DISCUSSING',
        taskTitle: 'Reporting Technical Room readiness in War Room',
      });
      this.dispatchEmployee({
        employeeId: 'emp-04',
        targetRoom: 'AI_WAR_ROOM',
        state: 'DISCUSSING',
        taskTitle: 'Reporting SMC Room readiness in War Room',
      });
      this.dispatchEmployee({
        employeeId: 'emp-07',
        targetRoom: 'AI_WAR_ROOM',
        state: 'WAITING_FOR_APPROVAL',
        taskTitle: 'Auditing deterministic risk gates in War Room',
      });
    });

    // Step 3: Risk Officer returns to Risk Office; Execution Manager verifies Execution Center
    scheduleStep(6800, () => {
      this.dispatchEmployee({
        employeeId: 'emp-07',
        targetRoom: 'RISK_OFFICE',
        state: 'COMPLETED',
        taskTitle: 'Risk Gate Check: NO TRADE enforced (Exchange Not Connected)',
      });
      this.dispatchEmployee({
        employeeId: 'emp-08',
        targetRoom: 'EXECUTION_CENTER',
        state: 'MONITORING_TRADE',
        taskTitle: 'Execution Center Dry-Run: Order router standby verified',
      });
      this.dispatchEmployee({
        employeeId: 'emp-02',
        targetRoom: 'TRADING_FLOOR',
        state: 'COMPLETED',
        taskTitle: 'Returned to Trading Floor · Drill decision logged (NO TRADE)',
      });
    });

    // Step 4: Return everyone cleanly to home desks
    scheduleStep(10200, () => {
      for (const emp of this.employees) {
        this.dispatchEmployee({
          employeeId: emp.id,
          targetRoom: emp.homeRoom,
          state: 'IDLE',
          taskTitle: `Standby in ${emp.homeRoom.replace(/_/g, ' ')} · Drill completed`,
        });
      }
      this.drillRunning = false;
      this.emit({
        type: 'system:status',
        payload: {
          connectedClients: this.connectedClients,
          drillRunning: false,
          serverTime: new Date().toISOString(),
        },
      });
      this.appendLog({
        employeeId: 'system',
        employeeCode: 'HQ-CORE',
        employeeName: 'NEON HQ Orchestrator',
        roomId: 'TRADING_FLOOR',
        state: 'COMPLETED',
        action: 'Phase 1 Workflow Drill Completed',
        detail: 'All 8 employees completed room transitions and returned to standby. Zero live orders executed.',
        category: 'SYSTEM',
      });
    });

    return { ok: true };
  }
}

export const officeStore = new OfficeStore();
