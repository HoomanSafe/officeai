// server.ts
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express2 from "express";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";

// server/app.ts
import express from "express";

// server/officeData.ts
var OFFICE_ROOMS = [
  {
    id: "CEO_OFFICE",
    code: "RM-01",
    name: "CEO Office",
    shortName: "CEO Suite",
    wing: "North Wing",
    purpose: "Executive command, company-level coordination, strategy approval, and performance oversight.",
    center: { x: -11, z: -9.5 },
    size: { w: 8.5, d: 7 },
    accentColor: "#8B5CF6",
    cameraPosition: { x: -16.5, y: 8.5, z: -2 },
    cameraTarget: { x: -11, y: 1, z: -9.5 },
    slots: [
      { x: -11, z: -10.5, facingYaw: 0 },
      { x: -9.2, z: -8.3, facingYaw: Math.PI }
    ]
  },
  {
    id: "AI_WAR_ROOM",
    code: "RM-09",
    name: "AI War Room / Conference Room",
    shortName: "War Room",
    wing: "North Wing",
    purpose: "Multi-agent structured briefing, conflicting thesis debate, CEO review, and CRO veto check.",
    center: { x: 0, z: -9.5 },
    size: { w: 10, d: 7 },
    accentColor: "#06B6D4",
    cameraPosition: { x: 0, y: 9.5, z: -1.5 },
    cameraTarget: { x: 0, y: 1, z: -9.5 },
    slots: [
      { x: 0, z: -11.2, facingYaw: 0 },
      { x: -1.9, z: -10.5, facingYaw: 0.6 },
      { x: 1.9, z: -10.5, facingYaw: -0.6 },
      { x: -2.2, z: -8.7, facingYaw: 2.1 },
      { x: 2.2, z: -8.7, facingYaw: -2.1 },
      { x: -1.1, z: -7.7, facingYaw: Math.PI - 0.3 },
      { x: 1.1, z: -7.7, facingYaw: Math.PI + 0.3 },
      { x: 0, z: -7.5, facingYaw: Math.PI }
    ]
  },
  {
    id: "RISK_OFFICE",
    code: "RM-07",
    name: "Risk Management Office",
    shortName: "Risk Office",
    wing: "North Wing",
    purpose: "Independent risk validation, position sizing, daily drawdown limits, and emergency kill switch.",
    center: { x: 11, z: -9.5 },
    size: { w: 8.5, d: 7 },
    accentColor: "#F59E0B",
    cameraPosition: { x: 16.5, y: 8.5, z: -2 },
    cameraTarget: { x: 11, y: 1, z: -9.5 },
    slots: [
      { x: 11, z: -10.4, facingYaw: 0 },
      { x: 9.3, z: -8.3, facingYaw: Math.PI }
    ]
  },
  {
    id: "TECHNICAL_ROOM",
    code: "RM-03",
    name: "Technical Analysis Room",
    shortName: "Technical",
    wing: "West Wing",
    purpose: "Multi-timeframe price action (5m\u20131d), EMA/RSI/MACD/ATR/VWAP, and volatility structure.",
    center: { x: -11.5, z: 0 },
    size: { w: 8, d: 7.5 },
    accentColor: "#38BDF8",
    cameraPosition: { x: -18.5, y: 8, z: 6.5 },
    cameraTarget: { x: -11.5, y: 1, z: 0 },
    slots: [
      { x: -12.4, z: -0.2, facingYaw: -Math.PI / 2 },
      { x: -10, z: 1.4, facingYaw: Math.PI / 2 }
    ]
  },
  {
    id: "TRADING_FLOOR",
    code: "RM-02",
    name: "Trading Floor",
    shortName: "Trading Floor",
    wing: "Central Hub",
    purpose: "Central market operations, Head Trader command desk, BTC directional filter, and live telemetry.",
    center: { x: 0, z: 0 },
    size: { w: 11, d: 8 },
    accentColor: "#06B6D4",
    cameraPosition: { x: 0, y: 11.5, z: 11 },
    cameraTarget: { x: 0, y: 0.8, z: 0 },
    slots: [
      { x: 0, z: 0.8, facingYaw: Math.PI },
      { x: -2.5, z: -0.5, facingYaw: Math.PI / 2 },
      { x: 2.5, z: -0.5, facingYaw: -Math.PI / 2 },
      { x: 0, z: -2, facingYaw: 0 }
    ]
  },
  {
    id: "ORDER_FLOW_LAB",
    code: "RM-05",
    name: "Order Flow Lab",
    shortName: "Order Flow",
    wing: "East Wing",
    purpose: "Order book imbalance, taker volume delta, open interest, funding rates, and liquidation clusters.",
    center: { x: 11.5, z: 0 },
    size: { w: 8, d: 7.5 },
    accentColor: "#2DD4BF",
    cameraPosition: { x: 18.5, y: 8, z: 6.5 },
    cameraTarget: { x: 11.5, y: 1, z: 0 },
    slots: [
      { x: 12.4, z: -0.2, facingYaw: Math.PI / 2 },
      { x: 10, z: 1.4, facingYaw: -Math.PI / 2 }
    ]
  },
  {
    id: "SMC_ROOM",
    code: "RM-04",
    name: "Smart Money Concepts Room",
    shortName: "SMC Room",
    wing: "West Wing",
    purpose: "BOS/CHoCH market structure, liquidity sweeps, fair value gaps, order blocks, and premium/discount zones.",
    center: { x: -11.5, z: 9.2 },
    size: { w: 8, d: 7 },
    accentColor: "#A855F7",
    cameraPosition: { x: -18, y: 8.5, z: 16 },
    cameraTarget: { x: -11.5, y: 1, z: 9.2 },
    slots: [
      { x: -12.2, z: 9.4, facingYaw: -Math.PI / 2 },
      { x: -10, z: 8, facingYaw: Math.PI / 2 }
    ]
  },
  {
    id: "EXECUTION_CENTER",
    code: "RM-08",
    name: "Execution Center",
    shortName: "Execution",
    wing: "South Wing",
    purpose: "Deterministic Binance USD\u24C8-M Futures order routing, SL/TP verification, and exchange reconciliation.",
    center: { x: 0, z: 9.2 },
    size: { w: 10, d: 7 },
    accentColor: "#10B981",
    cameraPosition: { x: 0, y: 9, z: 18 },
    cameraTarget: { x: 0, y: 1, z: 9.2 },
    slots: [
      { x: 0, z: 9.8, facingYaw: 0 },
      { x: -2, z: 8.2, facingYaw: Math.PI }
    ]
  },
  {
    id: "QUANT_LAB",
    code: "RM-06",
    name: "Quantitative Research Lab",
    shortName: "Quant Lab",
    wing: "East Wing",
    purpose: "Strategy expectancy, statistical validation, walk-forward backtesting, and overfitting detection.",
    center: { x: 11.5, z: 9.2 },
    size: { w: 8, d: 7 },
    accentColor: "#6366F1",
    cameraPosition: { x: 18, y: 8.5, z: 16 },
    cameraTarget: { x: 11.5, y: 1, z: 9.2 },
    slots: [
      { x: 12.2, z: 9.4, facingYaw: Math.PI / 2 },
      { x: 10, z: 8, facingYaw: -Math.PI / 2 }
    ]
  }
];
function createInitialEmployees() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const slotOf = (roomId, idx = 0) => {
    const room = OFFICE_ROOMS.find((r) => r.id === roomId);
    return room.slots[idx] ?? room.slots[0];
  };
  return [
    {
      id: "emp-01",
      code: "EMP-01",
      name: "Marcus Vance",
      title: "CEO / Chief AI Officer",
      department: "Executive Command",
      homeRoom: "CEO_OFFICE",
      currentRoom: "CEO_OFFICE",
      state: "IDLE",
      currentTask: "Standby in CEO Office \xB7 Phase 1 Registry Active",
      assignedModel: "gemini-2.5-pro (Planned Phase 2)",
      provider: "Gemini",
      accentColor: "#8B5CF6",
      canVeto: false,
      responsibilities: [
        "Coordinate the AI trading organization and assign department tasks",
        "Review cross-department reports and resolve conflicting recommendations",
        "Approve or reject proposed strategies without overriding risk controls"
      ],
      targetSlot: slotOf("CEO_OFFICE", 0),
      lastUpdatedAt: now
    },
    {
      id: "emp-02",
      code: "EMP-02",
      name: "Elena Rostova",
      title: "Head Trader",
      department: "Trading Desk",
      homeRoom: "TRADING_FLOOR",
      currentRoom: "TRADING_FLOOR",
      state: "IDLE",
      currentTask: "Standby on Trading Floor \xB7 Awaiting Phase 3 Market Data",
      assignedModel: "claude-3-7-sonnet (Planned Phase 2)",
      provider: "Claude",
      accentColor: "#06B6D4",
      canVeto: false,
      responsibilities: [
        "Determine final directional bias: LONG, SHORT, or NO TRADE",
        "Define entry zone, stop loss, take profit, and invalidation criteria",
        "Synthesize market regime and BTC directional filter"
      ],
      targetSlot: slotOf("TRADING_FLOOR", 0),
      lastUpdatedAt: now
    },
    {
      id: "emp-03",
      code: "EMP-03",
      name: "Kenji Sato",
      title: "Technical Analyst",
      department: "Technical Analysis",
      homeRoom: "TECHNICAL_ROOM",
      currentRoom: "TECHNICAL_ROOM",
      state: "IDLE",
      currentTask: "Standby in Technical Room \xB7 Multi-timeframe pipeline queued",
      assignedModel: "gemini-2.5-flash (Planned Phase 2)",
      provider: "Gemini",
      accentColor: "#38BDF8",
      canVeto: false,
      responsibilities: [
        "Analyze 5m, 15m, 1h, 4h, and 1d price action",
        "Compute EMA, RSI, MACD, ATR, VWAP, and key S/R levels",
        "Detect volatility expansion and momentum shifts"
      ],
      targetSlot: slotOf("TECHNICAL_ROOM", 0),
      lastUpdatedAt: now
    },
    {
      id: "emp-04",
      code: "EMP-04",
      name: "Aria Thorne",
      title: "Smart Money Concepts Analyst",
      department: "Market Structure",
      homeRoom: "SMC_ROOM",
      currentRoom: "SMC_ROOM",
      state: "IDLE",
      currentTask: "Standby in SMC Room \xB7 Structure detector queued",
      assignedModel: "claude-3-7-sonnet (Planned Phase 2)",
      provider: "Claude",
      accentColor: "#A855F7",
      canVeto: false,
      responsibilities: [
        "Identify verified BOS, CHoCH, order blocks, and fair value gaps",
        "Detect liquidity sweeps, inducement, and premium/discount zones",
        "Validate institutional footprint strictly from real OHLCV data"
      ],
      targetSlot: slotOf("SMC_ROOM", 0),
      lastUpdatedAt: now
    },
    {
      id: "emp-05",
      code: "EMP-05",
      name: "Devon Brooks",
      title: "Order Flow Analyst",
      department: "Liquidity & Flow",
      homeRoom: "ORDER_FLOW_LAB",
      currentRoom: "ORDER_FLOW_LAB",
      state: "IDLE",
      currentTask: "Standby in Order Flow Lab \xB7 Stream adapter not connected",
      assignedModel: "qwen2.5:14b via Ollama (Planned Phase 2)",
      provider: "Ollama",
      accentColor: "#2DD4BF",
      canVeto: false,
      responsibilities: [
        "Measure order book imbalance and taker buy/sell delta",
        "Monitor funding rate, open interest, and liquidation events",
        "Flag missing or stale exchange feed data without hallucinating"
      ],
      targetSlot: slotOf("ORDER_FLOW_LAB", 0),
      lastUpdatedAt: now
    },
    {
      id: "emp-06",
      code: "EMP-06",
      name: "Dr. Nadia Lin",
      title: "Quantitative Research Analyst",
      department: "Quant Research",
      homeRoom: "QUANT_LAB",
      currentRoom: "QUANT_LAB",
      state: "IDLE",
      currentTask: "Standby in Quant Lab \xB7 Backtest engine scheduled for Phase 6",
      assignedModel: "gemini-2.5-pro (Planned Phase 2)",
      provider: "Gemini",
      accentColor: "#6366F1",
      canVeto: false,
      responsibilities: [
        "Evaluate strategy expectancy, Sharpe, and regime-conditioned edge",
        "Conduct walk-forward validation and detect overfitting",
        "Benchmark historical outcomes rather than confidence scores"
      ],
      targetSlot: slotOf("QUANT_LAB", 0),
      lastUpdatedAt: now
    },
    {
      id: "emp-07",
      code: "EMP-07",
      name: "Victor Krell",
      title: "Chief Risk Officer",
      department: "Risk Management",
      homeRoom: "RISK_OFFICE",
      currentRoom: "RISK_OFFICE",
      state: "IDLE",
      currentTask: "Standby in Risk Office \xB7 Deterministic guardrails armed",
      assignedModel: "Deterministic Python + Gemini Audit",
      provider: "Deterministic Python",
      accentColor: "#F59E0B",
      canVeto: true,
      responsibilities: [
        "Independently audit every proposed trade with absolute VETO authority",
        "Enforce 0.15% risk/trade, 1.0% max daily drawdown, max 2 positions",
        "Trigger emergency kill switch on unverified stop loss or stale data"
      ],
      targetSlot: slotOf("RISK_OFFICE", 0),
      lastUpdatedAt: now
    },
    {
      id: "emp-08",
      code: "EMP-08",
      name: "Soren Lindqvist",
      title: "Execution Manager",
      department: "Execution & Reconciliation",
      homeRoom: "EXECUTION_CENTER",
      currentRoom: "EXECUTION_CENTER",
      state: "IDLE",
      currentTask: "Standby in Execution Center \xB7 Binance API Not Connected",
      assignedModel: "Deterministic Python Engine",
      provider: "Deterministic Python",
      accentColor: "#10B981",
      canVeto: false,
      responsibilities: [
        "Validate exchange lot/tick precision and place idempotent orders",
        "Verify actual Stop Loss and Take Profit orders on Binance",
        "Reconcile internal state against live exchange positions"
      ],
      targetSlot: slotOf("EXECUTION_CENTER", 0),
      lastUpdatedAt: now
    }
  ];
}
var INITIAL_RISK_CONFIG = {
  riskPerTradePct: 0.15,
  maxDailyLossPct: 1,
  maxSimultaneousPositions: 2,
  targetRiskReward: 2,
  maxLeverage: 3,
  marginMode: "ISOLATED",
  positionMode: "ONE_WAY",
  emergencyKillSwitch: false
};
function buildIntegrationStatuses() {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY");
  const hasClaude = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasBinanceTestnet = Boolean(process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET && process.env.BINANCE_TESTNET !== "false");
  const hasBinanceLive = Boolean(process.env.BINANCE_LIVE_API_KEY && process.env.BINANCE_LIVE_API_SECRET);
  const hasPostgres = Boolean(process.env.DATABASE_URL);
  const hasRedis = Boolean(process.env.REDIS_URL);
  return [
    {
      id: "int-binance-testnet",
      name: "Binance USD\u24C8-M Futures (Testnet)",
      category: "Exchange",
      status: hasBinanceTestnet ? "STANDBY" : "NOT_CONNECTED",
      detail: hasBinanceTestnet ? "Credentials present in backend env; Phase 5 execution engine not enabled yet." : "Not configured in environment. Phase 5 required.",
      phaseTarget: "Phase 5"
    },
    {
      id: "int-binance-live",
      name: "Binance USD\u24C8-M Futures (LIVE)",
      category: "Exchange",
      status: hasBinanceLive ? "STANDBY" : "NOT_CONNECTED",
      detail: "Locked by policy until backtesting, paper trading, and reconciliation pass acceptance tests.",
      phaseTarget: "Phase 7"
    },
    {
      id: "int-gemini",
      name: "Gemini AI Provider",
      category: "AI Provider",
      status: hasGemini ? "STANDBY" : "NOT_CONNECTED",
      detail: hasGemini ? "Server env key detected; agent reasoning router activates in Phase 2." : "GEMINI_API_KEY not configured on server.",
      phaseTarget: "Phase 2"
    },
    {
      id: "int-claude",
      name: "Anthropic Claude Provider",
      category: "AI Provider",
      status: hasClaude ? "STANDBY" : "NOT_CONNECTED",
      detail: hasClaude ? "Server env key detected; router activates in Phase 2." : "ANTHROPIC_API_KEY not configured on server.",
      phaseTarget: "Phase 2"
    },
    {
      id: "int-ollama",
      name: "Ollama Local Model Runtime",
      category: "AI Provider",
      status: "NOT_CONNECTED",
      detail: "Local Ollama endpoint not connected in preview sandbox (configured for Windows/VPS Docker).",
      phaseTarget: "Phase 2"
    },
    {
      id: "int-postgres",
      name: "PostgreSQL Persistent Store",
      category: "Infrastructure",
      status: hasPostgres ? "STANDBY" : "NOT_CONNECTED",
      detail: "Schema & SQLAlchemy models scaffolded in backend/ for Docker/VPS; preview uses authoritative Node memory store.",
      phaseTarget: "Phase 1 VPS"
    },
    {
      id: "int-redis",
      name: "Redis Cache & PubSub Queue",
      category: "Infrastructure",
      status: hasRedis ? "STANDBY" : "NOT_CONNECTED",
      detail: "Configured in docker-compose.yml for VPS deployment; preview uses direct WebSocket broadcast.",
      phaseTarget: "Phase 1 VPS"
    }
  ];
}

// server/officeStore.ts
var OfficeStore = class {
  constructor() {
    this.startedAt = Date.now();
    this.mode = "DEMO";
    this.liveLocked = true;
    this.liveLockReason = "LIVE mode is locked in Phase 1. Requires Phase 5 reconciliation tests, Phase 6 backtesting/paper validation, and explicit admin unlock.";
    this.employees = createInitialEmployees();
    this.tasks = [];
    this.activityLog = [];
    this.riskConfig = { ...INITIAL_RISK_CONFIG };
    this.connectedClients = 0;
    this.drillRunning = false;
    this.drillTimers = [];
    this.listeners = /* @__PURE__ */ new Set();
    this.appendLog({
      employeeId: "system",
      employeeCode: "HQ-CORE",
      employeeName: "NEON HQ Orchestrator",
      roomId: "TRADING_FLOOR",
      state: "IDLE",
      action: "Phase 1 Foundation Initialized",
      detail: "9 virtual rooms and 8 AI employee agents registered. Trading mode: DEMO. External exchange APIs: NOT CONNECTED.",
      category: "SYSTEM"
    });
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(event) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
  setClientCount(count) {
    this.connectedClients = count;
    this.emit({
      type: "system:status",
      payload: {
        connectedClients: this.connectedClients,
        drillRunning: this.drillRunning,
        serverTime: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  }
  getSnapshot() {
    return {
      companyName: "NEON AI TRADING HQ",
      phase: "PHASE_1_FOUNDATION",
      mode: this.mode,
      liveLocked: this.liveLocked,
      liveLockReason: this.liveLockReason,
      serverTime: (/* @__PURE__ */ new Date()).toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1e3),
      connectedClients: this.connectedClients,
      drillRunning: this.drillRunning,
      rooms: OFFICE_ROOMS,
      employees: this.employees,
      tasks: this.tasks.slice(0, 40),
      activityLog: this.activityLog.slice(0, 80),
      integrations: buildIntegrationStatuses(),
      riskConfig: this.riskConfig
    };
  }
  getEmployees() {
    return this.employees;
  }
  getRooms() {
    return OFFICE_ROOMS;
  }
  getActivityLog() {
    return this.activityLog.slice(0, 80);
  }
  allocateSlot(roomId, employeeId) {
    const room = OFFICE_ROOMS.find((r) => r.id === roomId) ?? OFFICE_ROOMS[0];
    const occupants = this.employees.filter((e) => e.currentRoom === roomId && e.id !== employeeId);
    const slotIndex = occupants.length % room.slots.length;
    return room.slots[slotIndex];
  }
  appendLog(input) {
    const entry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      ...input
    };
    this.activityLog.unshift(entry);
    if (this.activityLog.length > 200) {
      this.activityLog.length = 200;
    }
    this.emit({ type: "activity:created", payload: entry });
    return entry;
  }
  setMode(nextMode) {
    if (nextMode === "LIVE") {
      this.appendLog({
        employeeId: "emp-07",
        employeeCode: "EMP-07",
        employeeName: "Victor Krell",
        roomId: "RISK_OFFICE",
        state: "ERROR",
        action: "LIVE Mode Blocked",
        detail: this.liveLockReason,
        category: "RISK"
      });
      return { ok: false, error: this.liveLockReason, mode: this.mode };
    }
    if (nextMode === "TESTNET") {
      const hasTestnet = Boolean(process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET);
      if (!hasTestnet) {
        this.mode = nextMode;
        this.emit({ type: "mode:changed", payload: { mode: this.mode, liveLocked: this.liveLocked } });
        this.appendLog({
          employeeId: "emp-08",
          employeeCode: "EMP-08",
          employeeName: "Soren Lindqvist",
          roomId: "EXECUTION_CENTER",
          state: "IDLE",
          action: "Mode Switched to TESTNET (Credentials Not Connected)",
          detail: "Switched mode selector to TESTNET. Binance Testnet API keys are NOT CONNECTED in environment; execution remains disabled.",
          category: "MODE"
        });
        return { ok: true, mode: this.mode };
      }
    }
    this.mode = nextMode;
    this.emit({ type: "mode:changed", payload: { mode: this.mode, liveLocked: this.liveLocked } });
    this.appendLog({
      employeeId: "emp-01",
      employeeCode: "EMP-01",
      employeeName: "Marcus Vance",
      roomId: "CEO_OFFICE",
      state: "IDLE",
      action: `Trading Mode Changed to ${nextMode}`,
      detail: `Company operational mode updated to ${nextMode}. Phase 1 safety guardrails active.`,
      category: "MODE"
    });
    return { ok: true, mode: this.mode };
  }
  toggleKillSwitch(active, reason = "Manual administrator action") {
    this.riskConfig = { ...this.riskConfig, emergencyKillSwitch: active };
    if (active) {
      this.clearDrillTimers();
      this.drillRunning = false;
      for (const emp of this.employees) {
        const targetRoom = emp.homeRoom;
        emp.currentRoom = targetRoom;
        emp.targetSlot = this.allocateSlot(targetRoom, emp.id);
        emp.state = emp.id === "emp-07" ? "MONITORING_TRADE" : "IDLE";
        emp.currentTask = emp.id === "emp-07" ? "KILL SWITCH ARMED \xB7 Blocking all new entries" : "Halted by Emergency Kill Switch";
        emp.lastUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
        this.emit({ type: "employee:updated", payload: { ...emp } });
      }
    } else {
      for (const emp of this.employees) {
        emp.state = "IDLE";
        emp.currentTask = `Standby in ${emp.currentRoom.replace(/_/g, " ")}`;
        emp.lastUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
        this.emit({ type: "employee:updated", payload: { ...emp } });
      }
    }
    this.emit({ type: "risk:updated", payload: this.riskConfig });
    this.emit({
      type: "system:status",
      payload: {
        connectedClients: this.connectedClients,
        drillRunning: this.drillRunning,
        serverTime: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    this.appendLog({
      employeeId: "emp-07",
      employeeCode: "EMP-07",
      employeeName: "Victor Krell",
      roomId: "RISK_OFFICE",
      state: active ? "ERROR" : "COMPLETED",
      action: active ? "Emergency Kill Switch ACTIVATED" : "Emergency Kill Switch Cleared",
      detail: reason,
      category: "RISK"
    });
    return this.riskConfig;
  }
  updateRiskConfig(patch) {
    this.riskConfig = {
      ...this.riskConfig,
      riskPerTradePct: typeof patch.riskPerTradePct === "number" ? Math.min(2, Math.max(0.05, Number(patch.riskPerTradePct.toFixed(2)))) : this.riskConfig.riskPerTradePct,
      maxDailyLossPct: typeof patch.maxDailyLossPct === "number" ? Math.min(5, Math.max(0.25, Number(patch.maxDailyLossPct.toFixed(2)))) : this.riskConfig.maxDailyLossPct,
      maxSimultaneousPositions: typeof patch.maxSimultaneousPositions === "number" ? Math.min(5, Math.max(1, Math.round(patch.maxSimultaneousPositions))) : this.riskConfig.maxSimultaneousPositions,
      targetRiskReward: typeof patch.targetRiskReward === "number" ? Math.min(5, Math.max(1.2, Number(patch.targetRiskReward.toFixed(1)))) : this.riskConfig.targetRiskReward,
      maxLeverage: typeof patch.maxLeverage === "number" ? Math.min(10, Math.max(1, Math.round(patch.maxLeverage))) : this.riskConfig.maxLeverage
    };
    this.emit({ type: "risk:updated", payload: this.riskConfig });
    this.appendLog({
      employeeId: "emp-07",
      employeeCode: "EMP-07",
      employeeName: "Victor Krell",
      roomId: "RISK_OFFICE",
      state: "COMPLETED",
      action: "Deterministic Risk Parameters Updated",
      detail: `Risk/trade=${this.riskConfig.riskPerTradePct}%, MaxDailyLoss=${this.riskConfig.maxDailyLossPct}%, MaxPos=${this.riskConfig.maxSimultaneousPositions}, MaxLev=${this.riskConfig.maxLeverage}x`,
      category: "RISK"
    });
    return this.riskConfig;
  }
  dispatchEmployee(input) {
    if (this.riskConfig.emergencyKillSwitch && input.state === "EXECUTING") {
      return { ok: false, error: "Cannot transition to EXECUTING while Emergency Kill Switch is active." };
    }
    const emp = this.employees.find((e) => e.id === input.employeeId);
    if (!emp) {
      return { ok: false, error: "Employee not found." };
    }
    const roomExists = OFFICE_ROOMS.some((r) => r.id === input.targetRoom);
    if (!roomExists) {
      return { ok: false, error: "Target room not found." };
    }
    const moved = emp.currentRoom !== input.targetRoom;
    emp.currentRoom = input.targetRoom;
    emp.targetSlot = this.allocateSlot(input.targetRoom, emp.id);
    emp.state = input.state;
    emp.currentTask = input.taskTitle;
    emp.lastUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const task = {
      id: `tsk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: input.taskTitle,
      employeeId: emp.id,
      targetRoom: input.targetRoom,
      state: input.state,
      createdAt: emp.lastUpdatedAt,
      updatedAt: emp.lastUpdatedAt,
      notes: input.notes ?? "Phase 1 task state transition via backend orchestrator"
    };
    this.tasks.unshift(task);
    if (this.tasks.length > 80) this.tasks.length = 80;
    this.emit({ type: "employee:updated", payload: { ...emp } });
    this.emit({ type: "task:updated", payload: task });
    this.appendLog({
      employeeId: emp.id,
      employeeCode: emp.code,
      employeeName: emp.name,
      roomId: input.targetRoom,
      state: input.state,
      action: moved ? `Moved to ${input.targetRoom.replace(/_/g, " ")} \xB7 ${input.state}` : `State -> ${input.state}`,
      detail: input.taskTitle,
      category: moved ? "MOVEMENT" : "TASK"
    });
    return { ok: true, employee: emp, task };
  }
  clearDrillTimers() {
    for (const timer of this.drillTimers) {
      clearTimeout(timer);
    }
    this.drillTimers = [];
  }
  startPhase1WorkflowDrill() {
    if (this.riskConfig.emergencyKillSwitch) {
      return { ok: false, error: "Emergency Kill Switch is armed. Clear kill switch before running Phase 1 drill." };
    }
    if (this.drillRunning) {
      return { ok: false, error: "A Phase 1 State & Movement Verification Drill is already running." };
    }
    this.drillRunning = true;
    this.emit({
      type: "system:status",
      payload: {
        connectedClients: this.connectedClients,
        drillRunning: true,
        serverTime: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    this.appendLog({
      employeeId: "emp-01",
      employeeCode: "EMP-01",
      employeeName: "Marcus Vance",
      roomId: "CEO_OFFICE",
      state: "ANALYZING",
      action: "Started Phase 1 Workflow & Routing Drill (DEMO)",
      detail: "Verifying backend state machine, room navigation, and WebSocket sync across all 8 employees. No market orders placed.",
      category: "SYSTEM"
    });
    const scheduleStep = (delayMs, fn) => {
      const t = setTimeout(() => {
        if (!this.riskConfig.emergencyKillSwitch) fn();
      }, delayMs);
      this.drillTimers.push(t);
    };
    scheduleStep(300, () => {
      this.dispatchEmployee({
        employeeId: "emp-03",
        targetRoom: "TECHNICAL_ROOM",
        state: "ANALYZING",
        taskTitle: "Phase 1 Drill: Verifying Technical Room workstation telemetry"
      });
      this.dispatchEmployee({
        employeeId: "emp-04",
        targetRoom: "SMC_ROOM",
        state: "ANALYZING",
        taskTitle: "Phase 1 Drill: Verifying SMC structure workspace state"
      });
      this.dispatchEmployee({
        employeeId: "emp-05",
        targetRoom: "ORDER_FLOW_LAB",
        state: "RESEARCHING",
        taskTitle: "Phase 1 Drill: Checking Order Flow feed readiness (Not Connected)"
      });
      this.dispatchEmployee({
        employeeId: "emp-06",
        targetRoom: "QUANT_LAB",
        state: "RESEARCHING",
        taskTitle: "Phase 1 Drill: Verifying Quant Lab statistical sandbox"
      });
    });
    scheduleStep(3200, () => {
      this.dispatchEmployee({
        employeeId: "emp-01",
        targetRoom: "AI_WAR_ROOM",
        state: "DISCUSSING",
        taskTitle: "Convening War Room briefing (Phase 1 routing verification)"
      });
      this.dispatchEmployee({
        employeeId: "emp-02",
        targetRoom: "AI_WAR_ROOM",
        state: "DISCUSSING",
        taskTitle: "Presenting directional template (NO TRADE in Phase 1)"
      });
      this.dispatchEmployee({
        employeeId: "emp-03",
        targetRoom: "AI_WAR_ROOM",
        state: "DISCUSSING",
        taskTitle: "Reporting Technical Room readiness in War Room"
      });
      this.dispatchEmployee({
        employeeId: "emp-04",
        targetRoom: "AI_WAR_ROOM",
        state: "DISCUSSING",
        taskTitle: "Reporting SMC Room readiness in War Room"
      });
      this.dispatchEmployee({
        employeeId: "emp-07",
        targetRoom: "AI_WAR_ROOM",
        state: "WAITING_FOR_APPROVAL",
        taskTitle: "Auditing deterministic risk gates in War Room"
      });
    });
    scheduleStep(6800, () => {
      this.dispatchEmployee({
        employeeId: "emp-07",
        targetRoom: "RISK_OFFICE",
        state: "COMPLETED",
        taskTitle: "Risk Gate Check: NO TRADE enforced (Exchange Not Connected)"
      });
      this.dispatchEmployee({
        employeeId: "emp-08",
        targetRoom: "EXECUTION_CENTER",
        state: "MONITORING_TRADE",
        taskTitle: "Execution Center Dry-Run: Order router standby verified"
      });
      this.dispatchEmployee({
        employeeId: "emp-02",
        targetRoom: "TRADING_FLOOR",
        state: "COMPLETED",
        taskTitle: "Returned to Trading Floor \xB7 Drill decision logged (NO TRADE)"
      });
    });
    scheduleStep(10200, () => {
      for (const emp of this.employees) {
        this.dispatchEmployee({
          employeeId: emp.id,
          targetRoom: emp.homeRoom,
          state: "IDLE",
          taskTitle: `Standby in ${emp.homeRoom.replace(/_/g, " ")} \xB7 Drill completed`
        });
      }
      this.drillRunning = false;
      this.emit({
        type: "system:status",
        payload: {
          connectedClients: this.connectedClients,
          drillRunning: false,
          serverTime: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
      this.appendLog({
        employeeId: "system",
        employeeCode: "HQ-CORE",
        employeeName: "NEON HQ Orchestrator",
        roomId: "TRADING_FLOOR",
        state: "COMPLETED",
        action: "Phase 1 Workflow Drill Completed",
        detail: "All 8 employees completed room transitions and returned to standby. Zero live orders executed.",
        category: "SYSTEM"
      });
    });
    return { ok: true };
  }
};
var officeStore = new OfficeStore();

// server/app.ts
function createApiApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });
  app.get("/api/health", (_req, res) => {
    const snapshot = officeStore.getSnapshot();
    res.json({
      status: "ok",
      service: "neon-ai-trading-hq-gateway",
      runtime: process.env.VERCEL ? "vercel-serverless" : "persistent-server",
      phase: snapshot.phase,
      mode: snapshot.mode,
      liveLocked: snapshot.liveLocked,
      uptimeSeconds: snapshot.uptimeSeconds,
      connectedClients: snapshot.connectedClients,
      serverTime: snapshot.serverTime,
      integrations: snapshot.integrations
    });
  });
  app.get("/api/office/state", (_req, res) => {
    res.json(officeStore.getSnapshot());
  });
  app.get("/api/employees", (_req, res) => {
    res.json({ employees: officeStore.getEmployees() });
  });
  app.get("/api/rooms", (_req, res) => {
    res.json({ rooms: officeStore.getRooms() });
  });
  app.get("/api/activity", (_req, res) => {
    res.json({ activityLog: officeStore.getActivityLog() });
  });
  app.post("/api/mode", (req, res) => {
    const mode = req.body?.mode;
    if (!mode || !["DEMO", "PAPER", "TESTNET", "LIVE"].includes(mode)) {
      res.status(400).json({ ok: false, error: "Invalid trading mode." });
      return;
    }
    const result = officeStore.setMode(mode);
    res.status(result.ok ? 200 : 403).json({ ...result, snapshot: officeStore.getSnapshot() });
  });
  app.post("/api/employees/:id/dispatch", (req, res) => {
    const employeeId = req.params.id;
    const { targetRoom, state, taskTitle, notes } = req.body;
    if (!targetRoom || !state || !taskTitle) {
      res.status(400).json({ ok: false, error: "targetRoom, state, and taskTitle are required." });
      return;
    }
    const result = officeStore.dispatchEmployee({
      employeeId,
      targetRoom,
      state,
      taskTitle,
      notes
    });
    res.status(result.ok ? 200 : 400).json({ ...result, snapshot: officeStore.getSnapshot() });
  });
  app.post("/api/orchestration/phase1-drill", (_req, res) => {
    const result = officeStore.startPhase1WorkflowDrill();
    res.status(result.ok ? 200 : 409).json({ ...result, snapshot: officeStore.getSnapshot() });
  });
  app.post("/api/system/kill-switch", (req, res) => {
    const active = Boolean(req.body?.active);
    const reason = typeof req.body?.reason === "string" && req.body.reason.trim() ? req.body.reason.trim() : "Administrator dashboard toggle";
    const riskConfig = officeStore.toggleKillSwitch(active, reason);
    res.json({ ok: true, riskConfig, snapshot: officeStore.getSnapshot() });
  });
  app.post("/api/risk/config", (req, res) => {
    const riskConfig = officeStore.updateRiskConfig(req.body ?? {});
    res.json({ ok: true, riskConfig, snapshot: officeStore.getSnapshot() });
  });
  return app;
}

// server.ts
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var PORT = Number(process.env.PORT || 3e3);
async function startServer() {
  const app = createApiApp();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });
  const broadcast = (data) => {
    const encoded = JSON.stringify(data);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(encoded);
      }
    }
  };
  officeStore.subscribe((event) => {
    broadcast(event);
  });
  wss.on("connection", (socket) => {
    officeStore.setClientCount(wss.clients.size);
    socket.send(
      JSON.stringify({
        type: "office:snapshot",
        payload: officeStore.getSnapshot()
      })
    );
    socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ping") {
          socket.send(JSON.stringify({ type: "pong", serverTime: (/* @__PURE__ */ new Date()).toISOString() }));
        } else if (msg.type === "office:sync") {
          socket.send(JSON.stringify({ type: "office:snapshot", payload: officeStore.getSnapshot() }));
        }
      } catch {
      }
    });
    socket.on("close", () => {
      officeStore.setClientCount(wss.clients.size);
    });
  });
  const isProd = process.env.NODE_ENV === "production" || process.env.npm_lifecycle_event === "start";
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express2.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[NEON AI TRADING HQ] Local:   http://localhost:${PORT}`);
    console.log(`[NEON AI TRADING HQ] Network: http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start NEON AI TRADING HQ server:", err);
  process.exit(1);
});
