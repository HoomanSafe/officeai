import type {
  AIProviderName,
  AIRouterPolicy,
  AIUsageEntry,
  ActivityLogEntry,
  AgentStructuredReport,
  AutoTradeConfig,
  CandleTimeframe,
  CredentialsStatus,
  DebateProposal,
  DebateSession,
  EmployeeRecord,
  EmployeeState,
  ExecutionEngineState,
  FinalCompanyDecision,
  MarketEngineState,
  MarketTickerData,
  OfficeSnapshot,
  PositionRecord,
  PositionSide,
  RiskConfig,
  RoomId,
  ServerWsEvent,
  TaskRecord,
  TradingMode,
} from '../src/types/hq.ts';
import {
  buildIntegrationStatuses,
  createInitialEmployees,
  INITIAL_AI_ROUTER_POLICY,
  INITIAL_RISK_CONFIG,
  OFFICE_ROOMS,
} from './officeData.ts';
import { routeEmployeeAnalysis } from './ai/router.ts';
import {
  deterministicRiskAudit,
  detectSpecialistConflicts,
  runCeoReview,
  runCroAiAudit,
  runHeadTraderSynthesis,
} from './ai/debateEngine.ts';
import { MarketDataEngine } from './market/engine.ts';
import { ExecutionEngine } from './execution/engine.ts';

type Listener = (event: ServerWsEvent) => void;

export class OfficeStore {
  private readonly startedAt = Date.now();
  private mode: TradingMode = 'DEMO';
  private readonly liveLocked = true;
  private readonly liveLockReason =
    'LIVE mode is locked until Phase 3 Market Data, Phase 5 Binance Testnet SL/TP verification, Phase 6 Backtesting, and Phase 7 Acceptance Tests pass.';
  private employees: EmployeeRecord[] = createInitialEmployees();
  private tasks: TaskRecord[] = [];
  private activityLog: ActivityLogEntry[] = [];
  private agentReports: AgentStructuredReport[] = [];
  private aiUsage: AIUsageEntry[] = [];
  private aiRouterPolicy: AIRouterPolicy = { ...INITIAL_AI_ROUTER_POLICY };
  private riskConfig: RiskConfig = { ...INITIAL_RISK_CONFIG };
  private connectedClients = 0;
  private drillRunning = false;
  private debateSessions: DebateSession[] = [];
  private debateRunning = false;
  private drillTimers: ReturnType<typeof setTimeout>[] = [];
  private listeners = new Set<Listener>();
  private readonly marketEngine: MarketDataEngine;
  private readonly executionEngine: ExecutionEngine;
  private loggedMarketConnect = false;
  private autoTrade: AutoTradeConfig = {
    enabled: false,
    autoExecuteOnApproval: true,
    intervalMinutes: 3,
    enabledSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'],
    enabledTimeframes: ['5m', '15m', '1h', '4h', '1d'],
    cycleCursor: 0,
    lastCycleAt: null,
    nextCycleAt: null,
    lastOutcome:
      'Autopilot OFF. Pilih pair & timeframe, pindah ke mode PAPER/TESTNET, lalu klik Start Autopilot.',
  };
  private autoTradeTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.executionEngine = new ExecutionEngine(
      (execState) => {
        this.emit({ type: 'execution:updated', payload: execState });
      },
      (reason) => {
        this.toggleKillSwitch(true, reason);
      },
    );

    this.marketEngine = new MarketDataEngine((state) => {
      this.emit({ type: 'market:updated', payload: state });
      this.executionEngine.onMarketTick(state, this.mode, this.riskConfig);
      const activeFeed = state.feeds[state.activeSymbol];
      if (activeFeed?.status === 'CONNECTED' && !this.loggedMarketConnect) {
        this.loggedMarketConnect = true;
        this.appendLog({
          employeeId: 'emp-03',
          employeeCode: 'EMP-03',
          employeeName: 'Kenji Sato',
          roomId: 'TECHNICAL_ROOM',
          state: 'ANALYZING',
          action: `Binance Futures Public Feed Connected (${activeFeed.symbol} ${activeFeed.timeframe})`,
          detail: `Mark=$${activeFeed.markPrice?.toFixed(2) ?? '—'} · Regime=${activeFeed.indicators.regime} · 0 API keys required`,
          category: 'SYSTEM',
        });
      }
    });
    this.marketEngine.startBackgroundSync();

    this.appendLog({
      employeeId: 'system',
      employeeCode: 'HQ-CORE',
      employeeName: 'NEON HQ Orchestrator',
      roomId: 'TRADING_FLOOR',
      state: 'IDLE',
      action: 'Phase 5 Risk & Execution Engine Active (PAPER & TESTNET Ready)',
      detail:
        'Deterministic CROSS margin position sizer, PAPER live mark-to-market simulator, and Binance Testnet SL/TP verifier armed.',
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
    const marketData = this.marketEngine.getState();
    const execution = this.executionEngine.getState(this.mode, this.riskConfig);
    return {
      companyName: 'NEON AI TRADING HQ',
      phase: 'PHASE_5_EXECUTION_ENGINE',
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
      agentReports: this.agentReports.slice(0, 30),
      aiUsage: this.aiUsage.slice(0, 40),
      aiRouterPolicy: this.aiRouterPolicy,
      integrations: buildIntegrationStatuses(
        marketData.streamStatus,
        execution.testnetAccount.connected,
      ),
      riskConfig: this.riskConfig,
      marketData,
      debateSessions: this.debateSessions.slice(0, 20),
      debateRunning: this.debateRunning,
      execution,
      autoTrade: { ...this.autoTrade },
    };
  }

  public getExecutionState(): ExecutionEngineState {
    return this.executionEngine.getState(this.mode, this.riskConfig);
  }

  public getCredentialsStatus(): CredentialsStatus {
    const geminiKey = (process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || '').replace(/^["']|["']$/g, '');
    return {
      geminiConfigured: Boolean(geminiKey && geminiKey !== 'MY_GEMINI_API_KEY'),
      anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
      ollamaConfigured: Boolean(process.env.OLLAMA_BASE_URL?.trim()),
      binanceKeyConfigured: Boolean(process.env.BINANCE_API_KEY?.trim()),
      binanceSecretConfigured: Boolean(process.env.BINANCE_API_SECRET?.trim()),
      binanceTestnetFlag: process.env.BINANCE_TESTNET === 'true',
      runtime: process.env.VERCEL
        ? 'vercel'
        : process.env.K_SERVICE
          ? 'cloud-run'
          : 'local',
    };
  }

  public async reconcileExecution(): Promise<ExecutionEngineState> {
    const state = await this.executionEngine.reconcile(this.mode, this.riskConfig);
    this.appendLog({
      employeeId: 'emp-08',
      employeeCode: 'EMP-08',
      employeeName: 'Soren Lindqvist',
      roomId: 'EXECUTION_CENTER',
      state: 'COMPLETED',
      action: `Account Reconciliation (${state.activeVenue})`,
      detail: state.testnetAccount.connected
        ? `Binance Testnet Equity: $${state.testnetAccount.equityUsd.toFixed(2)}`
        : state.testnetAccount.errorMessage ?? 'PAPER simulator active.',
      category: 'SYSTEM',
    });
    return state;
  }

  public resetPaperAccount(): ExecutionEngineState {
    const state = this.executionEngine.resetPaperAccount(this.mode, this.riskConfig);
    this.appendLog({
      employeeId: 'emp-08',
      employeeCode: 'EMP-08',
      employeeName: 'Soren Lindqvist',
      roomId: 'EXECUTION_CENTER',
      state: 'IDLE',
      action: 'PAPER Account Reset to $10,000.00',
      detail: 'Cleared simulated paper positions & orders.',
      category: 'SYSTEM',
    });
    return state;
  }

  public async executeTradeOrder(input: {
    symbol: string;
    side: PositionSide;
    entryPrice?: number;
    stopLossPrice: number;
    takeProfitPrice: number;
    debateSessionId?: string | null;
  }): Promise<{ ok: boolean; error?: string; position?: PositionRecord }> {
    const symbol = input.symbol.toUpperCase();
    const activeTf = this.marketEngine.getState().activeTimeframe;
    const feed = this.marketEngine.getFreshFeed(symbol, activeTf);
    if (!feed || feed.isStale || feed.status !== 'CONNECTED') {
      await this.marketEngine.refreshSymbol(symbol, activeTf);
    }

    this.dispatchEmployee({
      employeeId: 'emp-08',
      targetRoom: 'EXECUTION_CENTER',
      state: 'EXECUTING',
      taskTitle: `Executing ${input.side} ${symbol} (${this.mode}) with mandatory SL/TP verification`,
    });

    const result = await this.executionEngine.executeValidatedOrder({
      mode: this.mode,
      riskConfig: this.riskConfig,
      marketData: this.marketEngine.getState(),
      symbol,
      side: input.side,
      entryPrice: input.entryPrice,
      stopLossPrice: input.stopLossPrice,
      takeProfitPrice: input.takeProfitPrice,
      debateSessionId: input.debateSessionId,
    });

    if (result.ok && result.position) {
      this.dispatchEmployee({
        employeeId: 'emp-08',
        targetRoom: 'EXECUTION_CENTER',
        state: 'MONITORING_TRADE',
        taskTitle: `Monitoring ${result.position.side} ${result.position.symbol} · SL Verified`,
      });
      this.appendLog({
        employeeId: 'emp-08',
        employeeCode: 'EMP-08',
        employeeName: 'Soren Lindqvist',
        roomId: 'EXECUTION_CENTER',
        state: 'MONITORING_TRADE',
        action: `Order Filled & SL Verified (${result.position.venue})`,
        detail: `${result.position.side} ${result.position.quantity} ${result.position.symbol} @ $${result.position.entryPrice} · SL $${result.position.stopLossPrice} · TP $${result.position.takeProfitPrice}`,
        category: 'TASK',
      });
    } else {
      this.dispatchEmployee({
        employeeId: 'emp-07',
        targetRoom: 'RISK_OFFICE',
        state: 'ERROR',
        taskTitle: `Execution Rejected: ${result.error ?? 'Risk guardrail violation'}`,
      });
    }

    return result;
  }

  public async closeExecutionPosition(
    positionId: string,
  ): Promise<{ ok: boolean; error?: string; position?: PositionRecord }> {
    const res = await this.executionEngine.closePosition({
      positionId,
      mode: this.mode,
      riskConfig: this.riskConfig,
      marketData: this.marketEngine.getState(),
    });
    if (res.ok && res.position) {
      this.appendLog({
        employeeId: 'emp-08',
        employeeCode: 'EMP-08',
        employeeName: 'Soren Lindqvist',
        roomId: 'EXECUTION_CENTER',
        state: 'COMPLETED',
        action: `Closed ${res.position.symbol} (${res.position.venue})`,
        detail: `Realized PnL: $${(res.position.realizedPnlUsd ?? 0).toFixed(2)} · ${res.position.closeReason}`,
        category: 'TASK',
      });
    }
    return res;
  }

  public getMarketState(): MarketEngineState {
    return this.marketEngine.getState();
  }

  public async refreshMarketData(input?: {
    symbol?: string;
    timeframe?: CandleTimeframe;
  }): Promise<{ ok: boolean; feed: MarketTickerData; marketData: MarketEngineState }> {
    const feed = await this.marketEngine.refreshSymbol(input?.symbol, input?.timeframe);
    if (feed.status === 'ERROR') {
      this.appendLog({
        employeeId: 'emp-05',
        employeeCode: 'EMP-05',
        employeeName: 'Devon Brooks',
        roomId: 'ORDER_FLOW_LAB',
        state: 'ERROR',
        action: `Market Feed Sync Failed (${feed.symbol})`,
        detail: feed.errorMessage ?? 'Unable to reach Binance public API',
        category: 'SYSTEM',
      });
    }
    return {
      ok: feed.status === 'CONNECTED',
      feed,
      marketData: this.marketEngine.getState(),
    };
  }

  public async updateMarketConfig(patch: {
    activeSymbol?: string;
    activeTimeframe?: CandleTimeframe;
    autoSyncEnabled?: boolean;
    staleThresholdSeconds?: number;
  }): Promise<MarketEngineState> {
    const next = await this.marketEngine.updateConfig(patch);
    this.appendLog({
      employeeId: 'emp-03',
      employeeCode: 'EMP-03',
      employeeName: 'Kenji Sato',
      roomId: 'TECHNICAL_ROOM',
      state: 'ANALYZING',
      action: `Market Stream Target: ${next.activeSymbol} (${next.activeTimeframe})`,
      detail: `AutoSync=${next.autoSyncEnabled ? 'ON' : 'OFF'} · StaleLimit=${next.staleThresholdSeconds}s · Status=${next.streamStatus}`,
      category: 'SYSTEM',
    });
    return next;
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

    this.mode = nextMode;
    this.emit({ type: 'mode:changed', payload: { mode: this.mode, liveLocked: this.liveLocked } });
    this.appendLog({
      employeeId: 'emp-01',
      employeeCode: 'EMP-01',
      employeeName: 'Marcus Vance',
      roomId: 'CEO_OFFICE',
      state: 'IDLE',
      action: `Trading Mode Changed to ${nextMode}`,
      detail: `Company operational mode updated to ${nextMode}. LIVE remains locked until Phase 7.`,
      category: 'MODE',
    });
    return { ok: true, mode: this.mode };
  }

  public toggleKillSwitch(active: boolean, reason = 'Manual administrator action'): RiskConfig {
    this.riskConfig = { ...this.riskConfig, emergencyKillSwitch: active };
    if (active) {
      this.clearDrillTimers();
      this.drillRunning = false;
      if (this.autoTradeTimer) {
        clearInterval(this.autoTradeTimer);
        this.autoTradeTimer = null;
      }
      if (this.autoTrade.enabled) {
        this.autoTrade = {
          ...this.autoTrade,
          enabled: false,
          nextCycleAt: null,
          lastOutcome: 'Autopilot halted automatically by Emergency Kill Switch.',
        };
        this.emit({ type: 'autotrade:updated', payload: { ...this.autoTrade } });
      }
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
    const nextMarginMode =
      patch.marginMode === 'CROSS' || patch.marginMode === 'ISOLATED'
        ? patch.marginMode
        : this.riskConfig.marginMode;

    this.riskConfig = {
      ...this.riskConfig,
      marginMode: nextMarginMode,
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
      action: `Risk Policy Updated (${this.riskConfig.marginMode} Margin)`,
      detail: `Margin=${this.riskConfig.marginMode}, Risk/trade=${this.riskConfig.riskPerTradePct}%, MaxDailyLoss=${this.riskConfig.maxDailyLossPct}%, MaxPos=${this.riskConfig.maxSimultaneousPositions}, MaxLev=${this.riskConfig.maxLeverage}x`,
      category: 'RISK',
    });
    return this.riskConfig;
  }

  public updateEmployeeModelConfig(input: {
    employeeId: string;
    provider?: AIProviderName;
    fallbackProvider?: AIProviderName;
    assignedModel?: string;
  }): { ok: boolean; error?: string; employee?: EmployeeRecord } {
    const emp = this.employees.find((e) => e.id === input.employeeId);
    if (!emp) return { ok: false, error: 'Employee not found.' };

    if (input.provider) emp.provider = input.provider;
    if (input.fallbackProvider) emp.fallbackProvider = input.fallbackProvider;
    if (input.assignedModel && input.assignedModel.trim()) {
      emp.assignedModel = input.assignedModel.trim();
    }
    emp.lastUpdatedAt = new Date().toISOString();

    this.emit({ type: 'employee:updated', payload: { ...emp } });
    this.appendLog({
      employeeId: emp.id,
      employeeCode: emp.code,
      employeeName: emp.name,
      roomId: emp.currentRoom,
      state: emp.state,
      action: `AI Provider Configured (${emp.provider} / ${emp.assignedModel})`,
      detail: `Fallback provider set to ${emp.fallbackProvider}.`,
      category: 'AI',
    });
    return { ok: true, employee: emp };
  }

  public updateRouterPolicy(patch: Partial<AIRouterPolicy>): AIRouterPolicy {
    this.aiRouterPolicy = {
      ...this.aiRouterPolicy,
      maxTokensPerCall:
        typeof patch.maxTokensPerCall === 'number'
          ? Math.min(8192, Math.max(256, Math.round(patch.maxTokensPerCall)))
          : this.aiRouterPolicy.maxTokensPerCall,
      dailyBudgetUsd:
        typeof patch.dailyBudgetUsd === 'number'
          ? Math.min(100, Math.max(0.25, Number(patch.dailyBudgetUsd.toFixed(2))))
          : this.aiRouterPolicy.dailyBudgetUsd,
      timeoutMs:
        typeof patch.timeoutMs === 'number'
          ? Math.min(60000, Math.max(3000, Math.round(patch.timeoutMs)))
          : this.aiRouterPolicy.timeoutMs,
      maxRetries:
        typeof patch.maxRetries === 'number'
          ? Math.min(4, Math.max(0, Math.round(patch.maxRetries)))
          : this.aiRouterPolicy.maxRetries,
      enableFallback:
        typeof patch.enableFallback === 'boolean'
          ? patch.enableFallback
          : this.aiRouterPolicy.enableFallback,
    };

    this.appendLog({
      employeeId: 'system',
      employeeCode: 'AI-ROUTER',
      employeeName: 'AI Provider Router',
      roomId: 'CEO_OFFICE',
      state: 'COMPLETED',
      action: 'AI Router Budget & Retry Policy Updated',
      detail: `MaxTokens=${this.aiRouterPolicy.maxTokensPerCall}, Budget=$${this.aiRouterPolicy.dailyBudgetUsd}/day, Timeout=${this.aiRouterPolicy.timeoutMs}ms, Fallback=${this.aiRouterPolicy.enableFallback}`,
      category: 'AI',
    });
    return this.aiRouterPolicy;
  }

  public async runAgentAnalysis(input: {
    employeeId: string;
    symbol?: string;
    timeframe?: string;
  }): Promise<{ ok: boolean; error?: string; report?: AgentStructuredReport; usage?: AIUsageEntry }> {
    if (this.riskConfig.emergencyKillSwitch) {
      return { ok: false, error: 'Emergency Kill Switch is armed. Clear kill switch before invoking AI agents.' };
    }

    const emp = this.employees.find((e) => e.id === input.employeeId);
    if (!emp) return { ok: false, error: 'Employee not found.' };

    const symbol = (input.symbol || 'BTCUSDT').toUpperCase();
    const timeframe = (input.timeframe || '1h') as CandleTimeframe;
    const taskId = `tsk-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    let marketFeed = this.marketEngine.getFreshFeed(symbol, timeframe);
    if (!marketFeed || marketFeed.isStale || marketFeed.status !== 'CONNECTED') {
      marketFeed = await this.marketEngine.refreshSymbol(symbol, timeframe);
    }

    this.dispatchEmployee({
      employeeId: emp.id,
      targetRoom: emp.homeRoom,
      state: emp.id === 'emp-05' || emp.id === 'emp-06' ? 'RESEARCHING' : 'ANALYZING',
      taskTitle: `AI Evaluation (${symbol} ${timeframe}) · Feed=${marketFeed.status}`,
      notes: 'Invoking AI Provider Router with Phase 3 Binance market snapshot',
    });

    const result = await routeEmployeeAnalysis({
      employee: emp,
      riskConfig: this.riskConfig,
      policy: this.aiRouterPolicy,
      mode: this.mode,
      symbol,
      timeframe,
      taskId,
      marketFeed,
    });

    this.agentReports.unshift(result.report);
    if (this.agentReports.length > 60) this.agentReports.length = 60;

    this.aiUsage.unshift(result.usage);
    if (this.aiUsage.length > 80) this.aiUsage.length = 80;

    this.aiRouterPolicy = {
      ...this.aiRouterPolicy,
      spentTodayUsd: Number((this.aiRouterPolicy.spentTodayUsd + result.costAddedUsd).toFixed(6)),
    };

    emp.state = result.usage.status === 'FAILED' ? 'ERROR' : 'COMPLETED';
    emp.currentTask = `${result.report.recommended_action} (${result.report.data_quality}) · ${result.report.provider_used}`;
    emp.lastUpdatedAt = new Date().toISOString();

    this.emit({ type: 'employee:updated', payload: { ...emp } });
    this.emit({ type: 'report:created', payload: result.report });
    this.emit({ type: 'ai:usage', payload: { entry: result.usage, policy: this.aiRouterPolicy } });

    this.appendLog({
      employeeId: emp.id,
      employeeCode: emp.code,
      employeeName: emp.name,
      roomId: emp.currentRoom,
      state: emp.state,
      action: `AI Report: ${result.report.recommended_action} (${result.report.provider_used})`,
      detail: result.report.reasoning_summary,
      category: 'AI',
    });

    return { ok: true, report: result.report, usage: result.usage };
  }

  private recordUsage(usage: AIUsageEntry, costAddedUsd: number): void {
    this.aiUsage.unshift(usage);
    if (this.aiUsage.length > 80) this.aiUsage.length = 80;
    this.aiRouterPolicy = {
      ...this.aiRouterPolicy,
      spentTodayUsd: Number((this.aiRouterPolicy.spentTodayUsd + costAddedUsd).toFixed(6)),
    };
    this.emit({ type: 'ai:usage', payload: { entry: usage, policy: this.aiRouterPolicy } });
  }

  private emitDebate(session: DebateSession): void {
    const idx = this.debateSessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) this.debateSessions[idx] = { ...session };
    else this.debateSessions.unshift({ ...session });
    if (this.debateSessions.length > 25) this.debateSessions.length = 25;
    this.emit({
      type: 'debate:updated',
      payload: { session: { ...session }, debateRunning: this.debateRunning },
    });
  }

  public async startWarRoomDebate(input?: {
    symbol?: string;
    timeframe?: CandleTimeframe;
  }): Promise<{ ok: boolean; error?: string; session?: DebateSession }> {
    if (this.riskConfig.emergencyKillSwitch) {
      return { ok: false, error: 'Emergency Kill Switch is ARMED. Clear kill switch before convening War Room.' };
    }
    if (this.debateRunning) {
      return { ok: false, error: 'A Multi-Agent War Room Debate is already in progress.' };
    }

    const symbol = (input?.symbol || this.marketEngine.getState().activeSymbol || 'BTCUSDT').toUpperCase();
    const timeframe = (input?.timeframe || this.marketEngine.getState().activeTimeframe || '1h') as CandleTimeframe;

    this.debateRunning = true;
    const session: DebateSession = {
      id: `deb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      symbol,
      timeframe,
      mode: this.mode,
      marginMode: this.riskConfig.marginMode,
      startedAt: new Date().toISOString(),
      completedAt: null,
      stage: 'GATHERING_MARKET_DATA',
      statusText: `Syncing live Binance Futures snapshot for ${symbol} (${timeframe}) & BTC filter...`,
      marketMarkPrice: null,
      marketRegime: 'UNKNOWN',
      specialistReports: [],
      conflictDetected: false,
      conflictSummary: '',
      headTraderProposal: null,
      ceoApproved: null,
      ceoReviewSummary: null,
      riskVetoed: null,
      riskAuditReasons: [],
      finalDecision: null,
      executionNote: 'Phase 5 Execution Engine pending (no real orders placed in Phase 4).',
    };

    try {
      this.emitDebate(session);

      // Stage 1: Fresh verified market data + BTC directional filter
      const marketFeed = await this.marketEngine.refreshSymbol(symbol, timeframe);
      const btcFeed =
        symbol === 'BTCUSDT' ? marketFeed : await this.marketEngine.refreshSymbol('BTCUSDT', timeframe);

      session.marketMarkPrice = marketFeed.markPrice;
      session.marketRegime = marketFeed.indicators.regime;

      if (marketFeed.status !== 'CONNECTED' || marketFeed.isStale || marketFeed.candles.length < 20) {
        session.stage = 'COMPLETED';
        session.completedAt = new Date().toISOString();
        session.conflictDetected = true;
        session.conflictSummary = 'Market feed missing or stale — debate aborted fail-closed.';
        session.riskVetoed = true;
        session.riskAuditReasons = [
          marketFeed.errorMessage ?? `Binance feed status ${marketFeed.status} (stale=${marketFeed.isStale})`,
        ];
        session.finalDecision = 'VETOED';
        session.statusText = 'Aborted safely by Stale-Data Guard.';
        this.emitDebate(session);
        return { ok: true, session };
      }

      // Stage 2: Parallel Specialist Analysis (Technical, SMC, Order Flow, Quant)
      session.stage = 'SPECIALIST_ANALYSIS';
      session.statusText = 'Running 4 independent specialist evaluations (Technical, SMC, Order Flow, Quant)...';
      this.emitDebate(session);

      const specialistIds = ['emp-03', 'emp-04', 'emp-05', 'emp-06'];
      for (const empId of specialistIds) {
        const emp = this.employees.find((e) => e.id === empId);
        if (emp) {
          this.dispatchEmployee({
            employeeId: emp.id,
            targetRoom: emp.homeRoom,
            state: empId === 'emp-05' || empId === 'emp-06' ? 'RESEARCHING' : 'ANALYZING',
            taskTitle: `War Room Prep: Independent ${symbol} ${timeframe} evaluation`,
          });
        }
      }

      const specialistResults = await Promise.all(
        specialistIds.map(async (empId) => {
          const emp = this.employees.find((e) => e.id === empId)!;
          return routeEmployeeAnalysis({
            employee: emp,
            riskConfig: this.riskConfig,
            policy: this.aiRouterPolicy,
            mode: this.mode,
            symbol,
            timeframe,
            taskId: `${session.id}-${empId}`,
            marketFeed,
          });
        }),
      );

      for (const res of specialistResults) {
        this.agentReports.unshift(res.report);
        this.emit({ type: 'report:created', payload: res.report });
        this.recordUsage(res.usage, res.costAddedUsd);
      }
      if (this.agentReports.length > 60) this.agentReports.length = 60;

      session.specialistReports = specialistResults.map((r) => r.report);

      // Stage 3: Assemble in AI War Room & Run Conflict Detection
      session.stage = 'WAR_ROOM_DEBATE';
      const conflict = detectSpecialistConflicts(session.specialistReports);
      session.conflictDetected = conflict.conflictDetected;
      session.conflictSummary = conflict.conflictSummary;
      session.statusText = 'Specialists assembled in AI War Room · Conflict audit complete.';
      this.emitDebate(session);

      for (const empId of ['emp-01', 'emp-02', 'emp-03', 'emp-04', 'emp-05', 'emp-06', 'emp-07']) {
        this.dispatchEmployee({
          employeeId: empId,
          targetRoom: 'AI_WAR_ROOM',
          state: 'DISCUSSING',
          taskTitle: `War Room Debate (${symbol} ${timeframe}): ${conflict.conflictDetected ? 'Resolving Conflict' : 'Consensus Check'}`,
        });
      }

      // Stage 4: Head Trader Proposal
      session.stage = 'HEAD_TRADER_PROPOSAL';
      session.statusText = 'Head Trader synthesizing trade proposal (Entry / SL / TP)...';
      this.emitDebate(session);

      const headTrader = this.employees.find((e) => e.id === 'emp-02')!;
      let proposal: DebateProposal;
      try {
        const htRes = await runHeadTraderSynthesis({
          employee: headTrader,
          policy: this.aiRouterPolicy,
          riskConfig: this.riskConfig,
          marketFeed,
          btcFeed,
          specialistReports: session.specialistReports,
          conflictSummary: session.conflictSummary,
        });
        proposal = htRes.proposal;
        this.recordUsage(htRes.usage, htRes.costAddedUsd);
      } catch (err) {
        proposal = {
          action: 'NO_TRADE',
          entryPrice: null,
          stopLossPrice: null,
          takeProfitPrice: null,
          riskRewardRatio: null,
          confidence: 0,
          thesis: `Head Trader synthesis failed safely (${err instanceof Error ? err.message : String(err)}).`,
          invalidationConditions: ['Manual retry required'],
        };
      }
      session.headTraderProposal = proposal;
      this.emitDebate(session);

      // Stage 5: CEO Executive Review
      session.stage = 'CEO_REVIEW';
      session.statusText = 'CEO reviewing proposal alignment & conflict resolution...';
      this.emitDebate(session);

      const ceo = this.employees.find((e) => e.id === 'emp-01')!;
      this.dispatchEmployee({
        employeeId: ceo.id,
        targetRoom: 'AI_WAR_ROOM',
        state: 'WAITING_FOR_APPROVAL',
        taskTitle: `CEO Reviewing ${proposal.action} proposal for ${symbol}`,
      });

      try {
        const ceoRes = await runCeoReview({
          employee: ceo,
          policy: this.aiRouterPolicy,
          proposal,
          conflictSummary: session.conflictSummary,
          specialistReports: session.specialistReports,
        });
        session.ceoApproved = ceoRes.approved;
        session.ceoReviewSummary = ceoRes.summary;
        this.recordUsage(ceoRes.usage, ceoRes.costAddedUsd);
      } catch (err) {
        session.ceoApproved = false;
        session.ceoReviewSummary = `CEO review fell back to reject (${err instanceof Error ? err.message : String(err)}).`;
      }
      this.emitDebate(session);

      // Stage 6: Chief Risk Officer Independent Veto & Deterministic Audit
      session.stage = 'RISK_AUDIT';
      session.statusText = 'Chief Risk Officer auditing CROSS margin SL, R:R & drawdown limits...';
      this.emitDebate(session);

      const cro = this.employees.find((e) => e.id === 'emp-07')!;
      const detAudit = deterministicRiskAudit({
        proposal,
        marketFeed,
        riskConfig: this.riskConfig,
        conflictDetected: session.conflictDetected,
      });

      try {
        const croRes = await runCroAiAudit({
          employee: cro,
          policy: this.aiRouterPolicy,
          riskConfig: this.riskConfig,
          proposal,
          marketFeed,
          deterministicAudit: detAudit,
        });
        session.riskVetoed = croRes.vetoed;
        session.riskAuditReasons = croRes.reasons;
        this.recordUsage(croRes.usage, croRes.costAddedUsd);
      } catch {
        session.riskVetoed = detAudit.vetoed;
        session.riskAuditReasons = detAudit.reasons;
      }

      let finalDecision: FinalCompanyDecision = 'NO_TRADE';
      if (session.riskVetoed) {
        finalDecision = 'VETOED';
      } else if (proposal.action === 'NO_TRADE' || !session.ceoApproved) {
        finalDecision = 'NO_TRADE';
      } else if (proposal.action === 'LONG') {
        finalDecision = 'APPROVED_LONG';
      } else if (proposal.action === 'SHORT') {
        finalDecision = 'APPROVED_SHORT';
      }

      session.finalDecision = finalDecision;
      session.stage = 'COMPLETED';
      session.completedAt = new Date().toISOString();
      session.statusText = `Final Company Decision: ${finalDecision}`;

      // Phase 5 Auto-Execution Hook: When CEO + CRO approve a trade and autoExecuteOnApproval is active
      if (
        (finalDecision === 'APPROVED_LONG' || finalDecision === 'APPROVED_SHORT') &&
        proposal.stopLossPrice !== null &&
        proposal.takeProfitPrice !== null
      ) {
        if (!this.autoTrade.autoExecuteOnApproval) {
          session.executionNote = `Approved (${finalDecision}). Auto-Execute is OFF — click Execute Approved manually.`;
        } else if (this.mode === 'DEMO') {
          session.executionNote = `Approved (${finalDecision}), skipped auto-execution because mode is DEMO (read-only). Switch to PAPER or TESTNET for autonomous execution.`;
        } else if (this.mode === 'LIVE') {
          session.executionNote = `Approved (${finalDecision}), blocked because LIVE mode is locked until Phase 7.`;
        } else {
          const execSide: PositionSide = finalDecision === 'APPROVED_LONG' ? 'LONG' : 'SHORT';
          const execResult = await this.executeTradeOrder({
            symbol,
            side: execSide,
            entryPrice: proposal.entryPrice ?? undefined,
            stopLossPrice: proposal.stopLossPrice,
            takeProfitPrice: proposal.takeProfitPrice,
            debateSessionId: session.id,
          });
          if (execResult.ok && execResult.position) {
            session.executionNote = `AUTO-EXECUTED (${execResult.position.venue}): ${execResult.position.side} ${execResult.position.quantity} ${symbol} @ $${execResult.position.entryPrice} · SL Guard ${execResult.position.slTpVerified}`;
            session.statusText = `Auto-Executed ${execResult.position.side} ${symbol} (${execResult.position.venue})`;
          } else {
            session.executionNote = `Approved by War Room, rejected by Execution Guard: ${execResult.error ?? 'Unknown error'}`;
          }
        }
      } else {
        session.executionNote = 'No order requested. Capital preservation enforced.';
      }

      // Return employees to their home stations with final status
      for (const empId of ['emp-01', 'emp-02', 'emp-03', 'emp-04', 'emp-05', 'emp-06', 'emp-07']) {
        const emp = this.employees.find((e) => e.id === empId);
        if (emp) {
          this.dispatchEmployee({
            employeeId: emp.id,
            targetRoom: emp.homeRoom,
            state: 'COMPLETED',
            taskTitle: `War Room Complete (${symbol}): ${finalDecision}`,
          });
        }
      }

      this.appendLog({
        employeeId: 'emp-07',
        employeeCode: 'EMP-07',
        employeeName: 'Victor Krell',
        roomId: 'RISK_OFFICE',
        state: finalDecision === 'VETOED' ? 'ERROR' : 'COMPLETED',
        action: `War Room Verdict: ${finalDecision} (${symbol} ${timeframe})`,
        detail: session.executionNote,
        category: 'RISK',
      });

      this.autoTrade = {
        ...this.autoTrade,
        lastCycleAt: new Date().toISOString(),
        lastOutcome: `${symbol} ${timeframe}: ${session.executionNote}`,
      };
      this.emit({ type: 'autotrade:updated', payload: { ...this.autoTrade } });

      this.emitDebate(session);
      return { ok: true, session };
    } catch (err) {
      session.stage = 'FAILED';
      session.completedAt = new Date().toISOString();
      session.finalDecision = 'NO_TRADE';
      session.statusText = `Debate failed safely: ${err instanceof Error ? err.message : String(err)}`;
      this.emitDebate(session);
      return { ok: false, error: session.statusText, session };
    } finally {
      this.debateRunning = false;
      this.emit({
        type: 'debate:updated',
        payload: { session, debateRunning: false },
      });
    }
  }

  public updateAutoTradeConfig(patch: {
    enabled?: boolean;
    autoExecuteOnApproval?: boolean;
    intervalMinutes?: number;
    enabledSymbols?: string[];
    enabledTimeframes?: CandleTimeframe[];
    runImmediate?: boolean;
  }): { ok: boolean; error?: string; autoTrade: AutoTradeConfig } {
    if (patch.enabled === true && this.riskConfig.emergencyKillSwitch) {
      return {
        ok: false,
        error: 'Emergency Kill Switch is ARMED. Clear kill switch before enabling Autopilot.',
        autoTrade: { ...this.autoTrade },
      };
    }

    const intervalMinutes =
      typeof patch.intervalMinutes === 'number'
        ? Math.min(60, Math.max(1, Math.round(patch.intervalMinutes)))
        : this.autoTrade.intervalMinutes;
    const enabled =
      typeof patch.enabled === 'boolean' ? patch.enabled : this.autoTrade.enabled;
    const autoExecuteOnApproval =
      typeof patch.autoExecuteOnApproval === 'boolean'
        ? patch.autoExecuteOnApproval
        : this.autoTrade.autoExecuteOnApproval;

    const allowedTimeframes: CandleTimeframe[] = ['5m', '15m', '1h', '4h', '1d'];
    const enabledSymbols =
      Array.isArray(patch.enabledSymbols) && patch.enabledSymbols.length > 0
        ? Array.from(new Set(patch.enabledSymbols.map((s) => s.trim().toUpperCase()).filter(Boolean)))
        : this.autoTrade.enabledSymbols;
    const enabledTimeframes =
      Array.isArray(patch.enabledTimeframes) && patch.enabledTimeframes.length > 0
        ? Array.from(new Set(patch.enabledTimeframes.filter((tf) => allowedTimeframes.includes(tf))))
        : this.autoTrade.enabledTimeframes;

    if (this.autoTradeTimer) {
      clearInterval(this.autoTradeTimer);
      this.autoTradeTimer = null;
    }

    this.autoTrade = {
      ...this.autoTrade,
      enabled,
      autoExecuteOnApproval,
      intervalMinutes,
      enabledSymbols,
      enabledTimeframes,
      nextCycleAt: enabled ? new Date(Date.now() + intervalMinutes * 60_000).toISOString() : null,
    };

    if (enabled) {
      this.autoTradeTimer = setInterval(() => {
        this.autoTrade = {
          ...this.autoTrade,
          nextCycleAt: new Date(Date.now() + this.autoTrade.intervalMinutes * 60_000).toISOString(),
        };
        void this.runAutonomousCycle();
      }, intervalMinutes * 60_000);
    }

    this.emit({ type: 'autotrade:updated', payload: { ...this.autoTrade } });
    this.appendLog({
      employeeId: 'emp-01',
      employeeCode: 'EMP-01',
      employeeName: 'Marcus Vance',
      roomId: 'CEO_OFFICE',
      state: enabled ? 'ANALYZING' : 'IDLE',
      action: `Autopilot ${enabled ? 'ENABLED' : 'PAUSED'} (${enabledSymbols.length} Pairs × ${enabledTimeframes.length} TF · Every ${intervalMinutes}m)`,
      detail:
        enabled && this.mode === 'DEMO'
          ? 'Note: Mode is DEMO (read-only). Switch to PAPER or TESTNET so approved setups execute orders.'
          : `Pairs: ${enabledSymbols.join(', ')} · TFs: ${enabledTimeframes.join(', ')}`,
      category: 'SYSTEM',
    });

    if (enabled && patch.runImmediate !== false && !this.debateRunning) {
      void this.runAutonomousCycle();
    }

    return { ok: true, autoTrade: { ...this.autoTrade } };
  }

  public async runAutonomousCycle(): Promise<{
    ok: boolean;
    error?: string;
    session?: DebateSession;
  }> {
    if (this.riskConfig.emergencyKillSwitch) {
      return { ok: false, error: 'Emergency Kill Switch is ARMED.' };
    }
    if (this.debateRunning) {
      return { ok: false, error: 'A War Room Debate is already running.' };
    }

    const marketState = this.marketEngine.getState();
    const execState = this.executionEngine.getState(this.mode, this.riskConfig);
    const activeVenue = this.mode === 'TESTNET' ? 'BINANCE_TESTNET' : 'PAPER_SIMULATOR';
    const openForVenue = execState.positions.filter(
      (p) => p.venue === activeVenue && p.status === 'OPEN',
    );

    if (openForVenue.length >= this.riskConfig.maxSimultaneousPositions) {
      const msg = `Max simultaneous positions (${this.riskConfig.maxSimultaneousPositions}) already open — monitoring existing SL/TP instead of opening new debate.`;
      this.autoTrade = {
        ...this.autoTrade,
        lastCycleAt: new Date().toISOString(),
        lastOutcome: msg,
      };
      this.emit({ type: 'autotrade:updated', payload: { ...this.autoTrade } });
      return { ok: false, error: msg };
    }

    const symbolPool =
      this.autoTrade.enabledSymbols.length > 0
        ? this.autoTrade.enabledSymbols
        : marketState.watchedSymbols;
    const tfPool: CandleTimeframe[] =
      this.autoTrade.enabledTimeframes.length > 0
        ? this.autoTrade.enabledTimeframes
        : [marketState.activeTimeframe];

    const availableSymbols = symbolPool.filter(
      (sym) => !openForVenue.some((p) => p.symbol === sym),
    );
    const activeSymbols = availableSymbols.length > 0 ? availableSymbols : symbolPool;
    const matrix: Array<{ symbol: string; timeframe: CandleTimeframe }> = [];
    for (const sym of activeSymbols) {
      for (const tf of tfPool) {
        matrix.push({ symbol: sym, timeframe: tf });
      }
    }

    const slotIdx = this.autoTrade.cycleCursor % Math.max(1, matrix.length);
    const target = matrix[slotIdx] ?? { symbol: 'BTCUSDT', timeframe: '1h' as CandleTimeframe };

    this.autoTrade = {
      ...this.autoTrade,
      cycleCursor: (this.autoTrade.cycleCursor + 1) % Math.max(1, matrix.length),
      lastOutcome: `Scanning ${target.symbol} ${target.timeframe} (Slot ${slotIdx + 1}/${matrix.length})...`,
    };
    this.emit({ type: 'autotrade:updated', payload: { ...this.autoTrade } });

    return this.startWarRoomDebate({
      symbol: target.symbol,
      timeframe: target.timeframe,
    });
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
      notes: input.notes ?? 'Task state transition via backend orchestrator',
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
      return { ok: false, error: 'Emergency Kill Switch is armed. Clear kill switch before running workflow drill.' };
    }
    if (this.drillRunning) {
      return { ok: false, error: 'A Workflow & Routing Drill is already running.' };
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
      action: 'Started Office Workflow & Routing Drill (DEMO)',
      detail: 'Verifying state machine, room navigation, and WebSocket sync across all 8 employees. No market orders placed.',
      category: 'SYSTEM',
    });

    const scheduleStep = (delayMs: number, fn: () => void) => {
      const t = setTimeout(() => {
        if (!this.riskConfig.emergencyKillSwitch) fn();
      }, delayMs);
      this.drillTimers.push(t);
    };

    scheduleStep(300, () => {
      this.dispatchEmployee({
        employeeId: 'emp-03',
        targetRoom: 'TECHNICAL_ROOM',
        state: 'ANALYZING',
        taskTitle: 'Technical Room: Phase 2 schema ready (Exchange Not Connected)',
      });
      this.dispatchEmployee({
        employeeId: 'emp-04',
        targetRoom: 'SMC_ROOM',
        state: 'ANALYZING',
        taskTitle: 'SMC Room: Structure prompt armed (Awaiting Phase 3 OHLCV)',
      });
      this.dispatchEmployee({
        employeeId: 'emp-05',
        targetRoom: 'ORDER_FLOW_LAB',
        state: 'RESEARCHING',
        taskTitle: 'Order Flow Lab: Feed status Not Connected',
      });
      this.dispatchEmployee({
        employeeId: 'emp-06',
        targetRoom: 'QUANT_LAB',
        state: 'RESEARCHING',
        taskTitle: 'Quant Lab: Backtest datastore pending Phase 6',
      });
    });

    scheduleStep(3200, () => {
      this.dispatchEmployee({
        employeeId: 'emp-01',
        targetRoom: 'AI_WAR_ROOM',
        state: 'DISCUSSING',
        taskTitle: 'Convening War Room briefing (Phase 2 readiness review)',
      });
      this.dispatchEmployee({
        employeeId: 'emp-02',
        targetRoom: 'AI_WAR_ROOM',
        state: 'DISCUSSING',
        taskTitle: 'Presenting NO_TRADE (Phase 3 Market Data pending)',
      });
      this.dispatchEmployee({
        employeeId: 'emp-03',
        targetRoom: 'AI_WAR_ROOM',
        state: 'DISCUSSING',
        taskTitle: 'Submitting Technical schema check in War Room',
      });
      this.dispatchEmployee({
        employeeId: 'emp-04',
        targetRoom: 'AI_WAR_ROOM',
        state: 'DISCUSSING',
        taskTitle: 'Submitting SMC schema check in War Room',
      });
      this.dispatchEmployee({
        employeeId: 'emp-07',
        targetRoom: 'AI_WAR_ROOM',
        state: 'WAITING_FOR_APPROVAL',
        taskTitle: 'Auditing CROSS margin & SL risk gates in War Room',
      });
    });

    scheduleStep(6800, () => {
      this.dispatchEmployee({
        employeeId: 'emp-07',
        targetRoom: 'RISK_OFFICE',
        state: 'COMPLETED',
        taskTitle: 'Risk VETO Gate: NO TRADE enforced (Exchange Not Connected)',
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
        taskTitle: 'Returned to Trading Floor · Drill decision logged (NO_TRADE)',
      });
    });

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
        action: 'Workflow Routing Drill Completed',
        detail: 'All 8 employees completed room transitions and returned to standby. Zero live orders executed.',
        category: 'SYSTEM',
      });
    });

    return { ok: true };
  }
}

export const officeStore = new OfficeStore();
