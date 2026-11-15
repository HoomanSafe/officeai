import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { officeStore } from './server/officeStore';
import type { EmployeeState, RoomId, TradingMode } from './src/types/hq';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  app.use(express.json());

  // Phase 1 Backend REST API
  app.get('/api/health', (_req, res) => {
    const snapshot = officeStore.getSnapshot();
    res.json({
      status: 'ok',
      service: 'neon-ai-trading-hq-gateway',
      phase: snapshot.phase,
      mode: snapshot.mode,
      liveLocked: snapshot.liveLocked,
      uptimeSeconds: snapshot.uptimeSeconds,
      connectedClients: snapshot.connectedClients,
      serverTime: snapshot.serverTime,
      integrations: snapshot.integrations,
    });
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
    res.status(result.ok ? 200 : 403).json(result);
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
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.post('/api/orchestration/phase1-drill', (_req, res) => {
    const result = officeStore.startPhase1WorkflowDrill();
    res.status(result.ok ? 200 : 409).json(result);
  });

  app.post('/api/system/kill-switch', (req, res) => {
    const active = Boolean(req.body?.active);
    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim()
      ? req.body.reason.trim()
      : 'Administrator dashboard toggle';
    const riskConfig = officeStore.toggleKillSwitch(active, reason);
    res.json({ ok: true, riskConfig });
  });

  app.post('/api/risk/config', (req, res) => {
    const riskConfig = officeStore.updateRiskConfig(req.body ?? {});
    res.json({ ok: true, riskConfig });
  });

  const server = http.createServer(app);

  // Real-time WebSocket server on /ws
  const wss = new WebSocketServer({ server, path: '/ws' });

  const broadcast = (data: unknown) => {
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

  wss.on('connection', (socket) => {
    officeStore.setClientCount(wss.clients.size);
    socket.send(
      JSON.stringify({
        type: 'office:snapshot',
        payload: officeStore.getSnapshot(),
      }),
    );

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string };
        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong', serverTime: new Date().toISOString() }));
        } else if (msg.type === 'office:sync') {
          socket.send(JSON.stringify({ type: 'office:snapshot', payload: officeStore.getSnapshot() }));
        }
      } catch {
        // Ignore malformed client frames safely
      }
    });

    socket.on('close', () => {
      officeStore.setClientCount(wss.clients.size);
    });
  });

  // Vite dev middleware or production static serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[NEON AI TRADING HQ] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NEON AI TRADING HQ server:', err);
  process.exit(1);
});
