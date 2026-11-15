
from datetime import datetime, timezone
from urllib.request import urlopen

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from backend.app.api.registry import (
    EMPLOYEES_REGISTRY,
    ROOMS_REGISTRY,
    get_honest_integration_status,
)
from backend.app.config import settings


app = FastAPI(
    title="NEON AI TRADING HQ — Phase 2 Backend",
    version="0.2.0",
    description="Autonomous AI Trading Company Foundation & AI Employees (Phase 2)",
)


# ============================================================
# REQUEST MODELS
# ============================================================

class DispatchPayload(BaseModel):
    target_room: str
    state: str
    task_title: str


class ModePayload(BaseModel):
    mode: str


# ============================================================
# WEBSOCKET CONNECTION MANAGER
# ============================================================

class ConnectionManager:
    def __init__(self) -> None:
        self.active: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active:
            self.active.remove(websocket)

    async def broadcast(self, message: dict) -> None:
        for ws in list(self.active):
            await ws.send_json(message)


ws_manager = ConnectionManager()


# ============================================================
# NETWORK DIAGNOSTICS
# ============================================================

@app.get("/api/check-ip")
async def check_ip():
    """
    Detect the outbound public IP used by this backend runtime.

    This endpoint is intended for temporary network diagnostics.
    The detected IP is not guaranteed to be static.
    """
    try:
        with urlopen("https://api.ipify.org", timeout=10) as response:
            ip = response.read().decode("utf-8").strip()

        return {
            "status": "success",
            "outbound_ip": ip,
            "note": "IP detected from backend runtime. It may not be static."
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to detect outbound IP: {str(e)}"
        )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "phase": "PHASE_2_AI_EMPLOYEES",
        "mode": settings.trading_mode,
        "margin_mode": settings.default_margin_mode,
        "live_locked": not settings.live_trading_enabled,
        "server_time": datetime.now(timezone.utc).isoformat(),
        "integrations": get_honest_integration_status(),
    }


# ============================================================
# ROOMS
# ============================================================

@app.get("/api/rooms")
async def list_rooms():
    return {"rooms": ROOMS_REGISTRY}


# ============================================================
# EMPLOYEES
# ============================================================

@app.get("/api/employees")
async def list_employees():
    return {"employees": EMPLOYEES_REGISTRY}


# ============================================================
# TRADING MODE
# ============================================================

@app.post("/api/mode")
async def update_mode(payload: ModePayload):
    mode = payload.mode.upper()

    if mode not in {"DEMO", "PAPER", "TESTNET", "LIVE"}:
        raise HTTPException(
            status_code=400,
            detail="Unsupported trading mode."
        )

    if mode == "LIVE" and not settings.live_trading_enabled:
        raise HTTPException(
            status_code=403,
            detail="LIVE mode is strictly locked until Phase 5-7 validation passes.",
        )

    return {
        "ok": True,
        "mode": mode,
        "live_locked": not settings.live_trading_enabled
    }


# ============================================================
# EMPLOYEE DISPATCH
# ============================================================

@app.post("/api/employees/{employee_id}/dispatch")
async def dispatch_employee(employee_id: str, payload: DispatchPayload):
    emp = next(
        (e for e in EMPLOYEES_REGISTRY if e["id"] == employee_id),
        None
    )

    if emp is None:
        raise HTTPException(
            status_code=404,
            detail="Employee not found."
        )

    if not any(r["id"] == payload.target_room for r in ROOMS_REGISTRY):
        raise HTTPException(
            status_code=400,
            detail="Target room not found."
        )

    emp["current_room"] = payload.target_room
    emp["state"] = payload.state

    await ws_manager.broadcast({
        "type": "employee:updated",
        "payload": emp
    })

    return {
        "ok": True,
        "employee": emp,
        "task_title": payload.task_title
    }


# ============================================================
# WEBSOCKET
# ============================================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)

    await websocket.send_json({
        "type": "office:snapshot",
        "payload": {
            "rooms": ROOMS_REGISTRY,
            "employees": EMPLOYEES_REGISTRY,
            "mode": settings.trading_mode,
        },
    })

    try:
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
