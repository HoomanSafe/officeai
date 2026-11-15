import express from 'express';
import { officeStore } from './officeStore.ts';
import type {
  AIProviderName,
  CandleTimeframe,
  EmployeeState,
  PositionSide,
  RoomId,
  TradingMode,
} from '../src/types/hq.ts';

export function createApiApp() {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    const snapshot = officeStore.getSnapshot();
    res.json({
      status: 'ok',
      service: 'neon-ai-trading-hq-gateway',
      runtime: process.env.VERCEL ? 'vercel-serverless' : 'persistent-server',
      phase: snapshot.phase,
      mode: snapshot.mode,
      marginMode: snapshot.riskConfig.marginMode,
      liveLocked: snapshot.liveLocked,
      uptimeSeconds: snapshot.uptimeSeconds,
      connectedClients: snapshot.connectedClients,
      serverTime: snapshot.serverTime,
      integrations: snapshot.integrations,
    });
  });

  app.get('/api/system/credentials-status', (_req, res) => {
    res.json({ ok: true, credentials: officeStore.getCredentialsStatus() });
  });

  app.get('/api/office/state', (_req, res) => {
    res.json(officeStore.getSnapshot());
  });

  app.get('/api/employees', (_req, res) => {
    res.json({ employees: officeStore.getEmployees() });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: officeStore.getRooms() });
  });

  app.get('/api/activity', (_req, res) => {
    res.json({ activityLog: officeStore.getActivityLog() });
  });

  app.post('/api/mode', (req, res) => {
    const mode = req.body?.mode as TradingMode | undefined;
    if (!mode || !['DEMO', 'PAPER', 'TESTNET', 'LIVE'].includes(mode)) {
      res.status(400).json({ ok: false, error: 'Invalid trading mode.' });
      return;
    }
    const result = officeStore.setMode(mode);
    res.status(result.ok ? 200 : 403).json({ ...result, snapshot: officeStore.getSnapshot() });
  });

  app.post('/api/employees/:id/dispatch', (req, res) => {
    const employeeId = req.params.id;
    const { targetRoom, state, taskTitle, notes } = req.body as {
      targetRoom: RoomId;
      state: EmployeeState;
      taskTitle: string;
      notes?: string;
    };

    if (!targetRoom || !state || !taskTitle) {
      res.status(400).json({ ok: false, error: 'targetRoom, state, and taskTitle are required.' });
      return;
    }

    const result = officeStore.dispatchEmployee({
      employeeId,
      targetRoom,
      state,
      taskTitle,
      notes,
    });
    res.status(result.ok ? 200 : 400).json({ ...result, snapshot: officeStore.getSnapshot() });
  });

  // Phase 2: Invoke individual AI employee via AIProviderRouter with structured JSON validation
  app.post('/api/agents/:id/analyze', async (req, res) => {
    const employeeId = req.params.id;
    const symbol = typeof req.body?.symbol === 'string' ? req.body.symbol : 'BTCUSDT';
    const timeframe = typeof req.body?.timeframe === 'string' ? req.body.timeframe : '1h';

    const result = await officeStore.runAgentAnalysis({ employeeId, symbol, timeframe });
    res.status(result.ok ? 200 : 400).json({ ...result, snapshot: officeStore.getSnapshot() });
  });

  app.post('/api/agents/config', (req, res) => {
    const { employeeId, provider, fallbackProvider, assignedModel } = req.body as {
      employeeId?: string;
      provider?: AIProviderName;
      fallbackProvider?: AIProviderName;
      assignedModel?: string;
    };
    if (!employeeId) {
      res.status(400).json({ ok: false, error: 'employeeId is required.' });
      return;
    }
    const result = officeStore.updateEmployeeModelConfig({
      employeeId,
      provider,
      fallbackProvider,
      assignedModel,
    });
    res.status(result.ok ? 200 : 404).json({ ...result, snapshot: officeStore.getSnapshot() });
  });

  app.post('/api/ai/policy', (req, res) => {
    const policy = officeStore.updateRouterPolicy(req.body ?? {});
    res.json({ ok: true, policy, snapshot: officeStore.getSnapshot() });
  });

  // Phase 3: Binance USDⓈ-M Public Market Data Engine
  app.get('/api/market/state', (_req, res) => {
    res.json({ ok: true, marketData: officeStore.getMarketState() });
  });

  app.post('/api/market/refresh', async (req, res) => {
    const symbol = typeof req.body?.symbol === 'string' ? req.body.symbol : undefined;
    const timeframe = typeof req.body?.timeframe === 'string' ? (req.body.timeframe as CandleTimeframe) : undefined;
    const result = await officeStore.refreshMarketData({ symbol, timeframe });
    res.status(result.ok ? 200 : 502).json({ ...result, snapshot: officeStore.getSnapshot() });
  });

  app.post('/api/market/config', async (req, res) => {
    const marketData = await officeStore.updateMarketConfig(req.body ?? {});
    res.json({ ok: true, marketData, snapshot: officeStore.getSnapshot() });
  });

  // Phase 4: Multi-Agent War Room Debate & Decision Engine
  app.get('/api/war-room/debates', (_req, res) => {
    const snap = officeStore.getSnapshot();
    res.json({ ok: true, debateRunning: snap.debateRunning, debateSessions: snap.debateSessions });
  });

  app.post('/api/war-room/debate', async (req, res) => {
    const symbol = typeof req.body?.symbol === 'string' ? req.body.symbol : undefined;
    const timeframe = typeof req.body?.timeframe === 'string' ? (req.body.timeframe as CandleTimeframe) : undefined;
    const result = await officeStore.startWarRoomDebate({ symbol, timeframe });
    res.status(result.ok ? 200 : 409).json({ ...result, snapshot: officeStore.getSnapshot() });
  });

  // Autonomous Autopilot Loop & Auto-Execution Settings
  app.post('/api/autotrade/config', (req, res) => {
    const result = officeStore.updateAutoTradeConfig(req.body ?? {});
    res.status(result.ok ? 200 : 400).json({ ...result, snapshot: officeStore.getSnapshot() });
  });

  app.post('/api/autotrade/run-now', async (_req, res) => {
    const result = await officeStore.runAutonomousCycle();
    res.status(result.ok ? 200 : 409).json({ ...result, snapshot: officeStore.getSnapshot() });
  });

  // Phase 5: Risk & Execution Engine (PAPER Simulator & Binance Testnet)
  app.get('/api/execution/state', (_req, res) => {
    res.json({ ok: true, execution: officeStore.getExecutionState() });
  });

  app.post('/api/execution/reconcile', async (_req, res) => {
    const execution = await officeStore.reconcileExecution();
    res.json({ ok: true, execution, snapshot: officeStore.getSnapshot() });
  });

  app.post('/api/execution/paper/reset', (_req, res) => {
    const execution = officeStore.resetPaperAccount();
    res.json({ ok: true, execution, snapshot: officeStore.getSnapshot() });
  });

  app.post('/api/execution/order', async (req, res) => {
    const { symbol, side, entryPrice, stopLossPrice, takeProfitPrice, debateSessionId } = req.body as {
      symbol?: string;
      side?: PositionSide;
      entryPrice?: number;
      stopLossPrice?: number;
      takeProfitPrice?: number;
      debateSessionId?: string | null;
    };

    if (!symbol || (side !== 'LONG' && side !== 'SHORT')) {
      res.status(400).json({ ok: false, error: 'Valid symbol and side (LONG/SHORT) are required.' });
      return;
    }
    if (typeof stopLossPrice !== 'number' || typeof takeProfitPrice !== 'number') {
      res.status(400).json({ ok: false, error: 'Numeric stopLossPrice and takeProfitPrice are mandatory.' });
      return;
    }

    const result = await officeStore.executeTradeOrder({
      symbol,
      side,
      entryPrice: typeof entryPrice === 'number' ? entryPrice : undefined,
      stopLossPrice,
      takeProfitPrice,
      debateSessionId,
    });
    res.status(result.ok ? 200 : 400).json({ ...result, snapshot: officeStore.getSnapshot() });
  });

  app.post('/api/execution/positions/:id/close', async (req, res) => {
    const result = await officeStore.closeExecutionPosition(req.params.id);
    res.status(result.ok ? 200 : 400).json({ ...result, snapshot: officeStore.getSnapshot() });
  });

  app.post('/api/orchestration/phase1-drill', (_req, res) => {
    const result = officeStore.startPhase1WorkflowDrill();
    res.status(result.ok ? 200 : 409).json({ ...result, snapshot: officeStore.getSnapshot() });
  });

  app.post('/api/system/kill-switch', (req, res) => {
    const active = Boolean(req.body?.active);
    const reason =
      typeof req.body?.reason === 'string' && req.body.reason.trim()
        ? req.body.reason.trim()
        : 'Administrator dashboard toggle';
    const riskConfig = officeStore.toggleKillSwitch(active, reason);
    res.json({ ok: true, riskConfig, snapshot: officeStore.getSnapshot() });
  });

  app.post('/api/risk/config', (req, res) => {
    const riskConfig = officeStore.updateRiskConfig(req.body ?? {});
    res.json({ ok: true, riskConfig, snapshot: officeStore.getSnapshot() });
  });

  return app;
}
