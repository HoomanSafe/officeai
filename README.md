# NEON AI TRADING HQ — Phase 1 Foundation

Autonomous AI Trading Company & 3D Virtual Headquarters for Binance USDⓈ-M Futures.

## Status Saat Ini: PHASE 1 — FOUNDATION
- 3D Virtual AI Office (Three.js PBR, 9 ruangan, 8 avatar pegawai AI interaktif)
- Real-time WebSocket state sync (`/ws`) & REST API (`/api/*`)
- Mode Selector terpisah (`DEMO`, `PAPER`, `TESTNET`, `LIVE` terkunci keras hingga Phase 7)
- Deterministic Risk Parameters & Emergency Kill Switch
- Struktur Backend Python FastAPI + 19 model SQLAlchemy PostgreSQL + Redis + Docker Compose + Nginx

## Menjalankan di Windows (Development)
1. Install dependensi Node.js & jalankan preview full-stack (Port 3000):
   ```powershell
   npm install
   npm run dev
   ```
2. Menjalankan test unit Python Phase 1:
   ```powershell
   python -m unittest backend/tests/test_phase1_foundation.py
   ```
3. Menjalankan stack Docker (PostgreSQL + Redis + FastAPI + Nginx):
   ```powershell
   copy backend\.env.example backend\.env
   docker compose up -d --build
   ```
