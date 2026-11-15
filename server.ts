import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createApiApp } from './server/app.ts';
import { officeStore } from './server/officeStore.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = createApiApp();
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
  const isProd = process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start';
  if (!isProd) {
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
    console.log(`[NEON AI TRADING HQ] Local:   http://localhost:${PORT}`);
    console.log(`[NEON AI TRADING HQ] Network: http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NEON AI TRADING HQ server:', err);
  process.exit(1);
});
