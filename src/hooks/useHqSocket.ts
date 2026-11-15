import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  EmployeeState,
  OfficeSnapshot,
  RiskConfig,
  RoomId,
  ServerWsEvent,
  TradingMode,
} from '../types/hq';

export type WsStatus = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';

export function useHqSocket() {
  const [snapshot, setSnapshot] = useState<OfficeSnapshot | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>('CONNECTING');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const fetchInitialState = useCallback(async () => {
    try {
      const res = await fetch('/api/office/state');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as OfficeSnapshot;
      if (mountedRef.current) {
        setSnapshot(data);
        setErrorBanner(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setErrorBanner(err instanceof Error ? err.message : 'Failed to load HQ state');
      }
    }
  }, []);

  const connectWs = useCallback(() => {
    if (!mountedRef.current) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    setWsStatus((prev) => (prev === 'DISCONNECTED' ? 'RECONNECTING' : 'CONNECTING'));
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setWsStatus('CONNECTED');
      setErrorBanner(null);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data) as ServerWsEvent;
        if (msg.type === 'office:snapshot') {
          setSnapshot(msg.payload);
        } else if (msg.type === 'employee:updated') {
          setSnapshot((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              employees: prev.employees.map((e) => (e.id === msg.payload.id ? msg.payload : e)),
            };
          });
        } else if (msg.type === 'activity:created') {
          setSnapshot((prev) => {
            if (!prev) return prev;
            if (prev.activityLog.some((item) => item.id === msg.payload.id)) {
              return prev;
            }
            return {
              ...prev,
              activityLog: [msg.payload, ...prev.activityLog].slice(0, 80),
            };
          });
        } else if (msg.type === 'task:updated') {
          setSnapshot((prev) => {
            if (!prev) return prev;
            const exists = prev.tasks.some((t) => t.id === msg.payload.id);
            const tasks = exists
              ? prev.tasks.map((t) => (t.id === msg.payload.id ? msg.payload : t))
              : [msg.payload, ...prev.tasks].slice(0, 40);
            return { ...prev, tasks };
          });
        } else if (msg.type === 'mode:changed') {
          setSnapshot((prev) =>
            prev ? { ...prev, mode: msg.payload.mode, liveLocked: msg.payload.liveLocked } : prev,
          );
        } else if (msg.type === 'risk:updated') {
          setSnapshot((prev) => (prev ? { ...prev, riskConfig: msg.payload } : prev));
        } else if (msg.type === 'system:status') {
          setSnapshot((prev) =>
            prev
              ? {
                  ...prev,
                  connectedClients: msg.payload.connectedClients,
                  drillRunning: msg.payload.drillRunning,
                  serverTime: msg.payload.serverTime,
                }
              : prev,
          );
        }
      } catch {
        // Ignore malformed frame
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setWsStatus('RECONNECTING');
      reconnectTimerRef.current = window.setTimeout(connectWs, 2200);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchInitialState();
    connectWs();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [fetchInitialState, connectWs]);

  const setTradingMode = useCallback(async (mode: TradingMode) => {
    const res = await fetch('/api/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok && data.error) {
      setErrorBanner(data.error);
    } else {
      setErrorBanner(null);
    }
    return data;
  }, []);

  const dispatchEmployeeTask = useCallback(
    async (input: {
      employeeId: string;
      targetRoom: RoomId;
      state: EmployeeState;
      taskTitle: string;
    }) => {
      const res = await fetch(`/api/employees/${encodeURIComponent(input.employeeId)}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok && data.error) setErrorBanner(data.error);
      else setErrorBanner(null);
      return data;
    },
    [],
  );

  const startPhase1Drill = useCallback(async () => {
    const res = await fetch('/api/orchestration/phase1-drill', { method: 'POST' });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok && data.error) setErrorBanner(data.error);
    else setErrorBanner(null);
    return data;
  }, []);

  const toggleKillSwitch = useCallback(async (active: boolean, reason?: string) => {
    const res = await fetch('/api/system/kill-switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active, reason }),
    });
    return res.json();
  }, []);

  const updateRiskConfig = useCallback(async (patch: Partial<RiskConfig>) => {
    const res = await fetch('/api/risk/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return res.json();
  }, []);

  return {
    snapshot,
    wsStatus,
    errorBanner,
    clearError: () => setErrorBanner(null),
    setTradingMode,
    dispatchEmployeeTask,
    startPhase1Drill,
    toggleKillSwitch,
    updateRiskConfig,
  };
}
