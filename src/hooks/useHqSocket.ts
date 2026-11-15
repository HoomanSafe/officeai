import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AIProviderName,
  AIRouterPolicy,
  CandleTimeframe,
  CredentialsStatus,
  EmployeeState,
  OfficeSnapshot,
  PositionSide,
  RiskConfig,
  RoomId,
  ServerWsEvent,
  TradingMode,
} from '../types/hq';

export type WsStatus = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'HTTP_POLLING' | 'DISCONNECTED';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const EXPLICIT_WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? '';

export function useHqSocket() {
  const [snapshot, setSnapshot] = useState<OfficeSnapshot | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>('CONNECTING');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const wsFailuresRef = useRef(0);
  const everOpenedWsRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/office/state`);
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

  const startHttpPolling = useCallback(() => {
    if (pollTimerRef.current !== null) return;
    setWsStatus('HTTP_POLLING');
    pollTimerRef.current = window.setInterval(() => {
      void fetchState();
    }, 4000);
  }, [fetchState]);

  const connectWs = useCallback(() => {
    if (!mountedRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = EXPLICIT_WS_URL || `${protocol}//${window.location.host}/ws`;

    setWsStatus((prev) => (prev === 'DISCONNECTED' ? 'RECONNECTING' : 'CONNECTING'));
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      everOpenedWsRef.current = true;
      wsFailuresRef.current = 0;
      if (pollTimerRef.current !== null) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
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
        } else if (msg.type === 'report:created') {
          setSnapshot((prev) => {
            if (!prev) return prev;
            if (prev.agentReports.some((r) => r.id === msg.payload.id)) return prev;
            return {
              ...prev,
              agentReports: [msg.payload, ...prev.agentReports].slice(0, 30),
            };
          });
        } else if (msg.type === 'ai:usage') {
          setSnapshot((prev) => {
            if (!prev) return prev;
            const exists = prev.aiUsage.some((u) => u.id === msg.payload.entry.id);
            return {
              ...prev,
              aiRouterPolicy: msg.payload.policy,
              aiUsage: exists ? prev.aiUsage : [msg.payload.entry, ...prev.aiUsage].slice(0, 40),
            };
          });
        } else if (msg.type === 'market:updated') {
          setSnapshot((prev) => (prev ? { ...prev, marketData: msg.payload } : prev));
        } else if (msg.type === 'debate:updated') {
          setSnapshot((prev) => {
            if (!prev) return prev;
            const exists = prev.debateSessions.some((s) => s.id === msg.payload.session.id);
            const debateSessions = exists
              ? prev.debateSessions.map((s) => (s.id === msg.payload.session.id ? msg.payload.session : s))
              : [msg.payload.session, ...prev.debateSessions].slice(0, 20);
            return {
              ...prev,
              debateRunning: msg.payload.debateRunning,
              debateSessions,
            };
          });
        } else if (msg.type === 'execution:updated') {
          setSnapshot((prev) => (prev ? { ...prev, execution: msg.payload } : prev));
        } else if (msg.type === 'autotrade:updated') {
          setSnapshot((prev) => (prev ? { ...prev, autoTrade: msg.payload } : prev));
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
      wsFailuresRef.current += 1;

      // On Vercel Serverless (no persistent WS endpoint), switch cleanly to HTTP polling after 2 handshakes fail
      if (!everOpenedWsRef.current && wsFailuresRef.current >= 2) {
        startHttpPolling();
        return;
      }

      setWsStatus('RECONNECTING');
      reconnectTimerRef.current = window.setTimeout(connectWs, 2200);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [startHttpPolling]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchState();
    connectWs();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (pollTimerRef.current !== null) {
        clearInterval(pollTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [fetchState, connectWs]);

  const applySnapshotIfPresent = (data: { snapshot?: OfficeSnapshot }) => {
    if (data.snapshot && mountedRef.current) {
      setSnapshot(data.snapshot);
    }
  };

  const setTradingMode = useCallback(async (mode: TradingMode) => {
    const res = await fetch(`${API_BASE}/api/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string; snapshot?: OfficeSnapshot };
    applySnapshotIfPresent(data);
    if (!data.ok && data.error) setErrorBanner(data.error);
    else setErrorBanner(null);
    return data;
  }, []);

  const dispatchEmployeeTask = useCallback(
    async (input: {
      employeeId: string;
      targetRoom: RoomId;
      state: EmployeeState;
      taskTitle: string;
    }) => {
      const res = await fetch(`${API_BASE}/api/employees/${encodeURIComponent(input.employeeId)}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; snapshot?: OfficeSnapshot };
      applySnapshotIfPresent(data);
      if (!data.ok && data.error) setErrorBanner(data.error);
      else setErrorBanner(null);
      return data;
    },
    [],
  );

  const startPhase1Drill = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/orchestration/phase1-drill`, { method: 'POST' });
    const data = (await res.json()) as { ok: boolean; error?: string; snapshot?: OfficeSnapshot };
    applySnapshotIfPresent(data);
    if (!data.ok && data.error) setErrorBanner(data.error);
    else setErrorBanner(null);
    return data;
  }, []);

  const toggleKillSwitch = useCallback(async (active: boolean, reason?: string) => {
    const res = await fetch(`${API_BASE}/api/system/kill-switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active, reason }),
    });
    const data = (await res.json()) as { ok: boolean; snapshot?: OfficeSnapshot };
    applySnapshotIfPresent(data);
    return data;
  }, []);

  const updateRiskConfig = useCallback(async (patch: Partial<RiskConfig>) => {
    const res = await fetch(`${API_BASE}/api/risk/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = (await res.json()) as { ok: boolean; snapshot?: OfficeSnapshot };
    applySnapshotIfPresent(data);
    return data;
  }, []);

  const runAgentAnalysis = useCallback(
    async (input: { employeeId: string; symbol?: string; timeframe?: string }) => {
      try {
        const res = await fetch(
          `${API_BASE}/api/agents/${encodeURIComponent(input.employeeId)}/analyze`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              symbol: input.symbol ?? 'BTCUSDT',
              timeframe: input.timeframe ?? '1h',
            }),
          },
        );
        const data = (await res.json()) as { ok: boolean; error?: string; snapshot?: OfficeSnapshot };
        applySnapshotIfPresent(data);
        if (!data.ok && data.error) setErrorBanner(data.error);
        else setErrorBanner(null);
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to run agent analysis';
        setErrorBanner(msg);
        return { ok: false, error: msg };
      }
    },
    [],
  );

  const updateAgentConfig = useCallback(
    async (input: {
      employeeId: string;
      provider?: AIProviderName;
      fallbackProvider?: AIProviderName;
      assignedModel?: string;
    }) => {
      const res = await fetch(`${API_BASE}/api/agents/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; snapshot?: OfficeSnapshot };
      applySnapshotIfPresent(data);
      if (!data.ok && data.error) setErrorBanner(data.error);
      else setErrorBanner(null);
      return data;
    },
    [],
  );

  const updateRouterPolicy = useCallback(async (patch: Partial<AIRouterPolicy>) => {
    const res = await fetch(`${API_BASE}/api/ai/policy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = (await res.json()) as { ok: boolean; error?: string; snapshot?: OfficeSnapshot };
    applySnapshotIfPresent(data);
    if (!data.ok && data.error) setErrorBanner(data.error);
    else setErrorBanner(null);
    return data;
  }, []);

  const refreshMarketData = useCallback(
    async (input?: { symbol?: string; timeframe?: CandleTimeframe }) => {
      try {
        const res = await fetch(`${API_BASE}/api/market/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input ?? {}),
        });
        const data = (await res.json()) as {
          ok: boolean;
          feed?: { errorMessage?: string | null };
          snapshot?: OfficeSnapshot;
        };
        applySnapshotIfPresent(data);
        if (!data.ok && data.feed?.errorMessage) setErrorBanner(data.feed.errorMessage);
        else setErrorBanner(null);
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to refresh Binance market data';
        setErrorBanner(msg);
        return { ok: false, error: msg };
      }
    },
    [],
  );

  const updateMarketConfig = useCallback(
    async (patch: {
      activeSymbol?: string;
      activeTimeframe?: CandleTimeframe;
      autoSyncEnabled?: boolean;
      staleThresholdSeconds?: number;
    }) => {
      const res = await fetch(`${API_BASE}/api/market/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; snapshot?: OfficeSnapshot };
      applySnapshotIfPresent(data);
      if (!data.ok && data.error) setErrorBanner(data.error);
      else setErrorBanner(null);
      return data;
    },
    [],
  );

  const startWarRoomDebate = useCallback(
    async (input?: { symbol?: string; timeframe?: CandleTimeframe }) => {
      try {
        const res = await fetch(`${API_BASE}/api/war-room/debate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input ?? {}),
        });
        const data = (await res.json()) as { ok: boolean; error?: string; snapshot?: OfficeSnapshot };
        applySnapshotIfPresent(data);
        if (!data.ok && data.error) setErrorBanner(data.error);
        else setErrorBanner(null);
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to run War Room debate';
        setErrorBanner(msg);
        return { ok: false, error: msg };
      }
    },
    [],
  );

  const reconcileExecution = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/execution/reconcile`, { method: 'POST' });
    const data = (await res.json()) as { ok: boolean; snapshot?: OfficeSnapshot };
    applySnapshotIfPresent(data);
    return data;
  }, []);

  const resetPaperAccount = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/execution/paper/reset`, { method: 'POST' });
    const data = (await res.json()) as { ok: boolean; snapshot?: OfficeSnapshot };
    applySnapshotIfPresent(data);
    return data;
  }, []);

  const executeTradeOrder = useCallback(
    async (input: {
      symbol: string;
      side: PositionSide;
      entryPrice?: number;
      stopLossPrice: number;
      takeProfitPrice: number;
      debateSessionId?: string | null;
    }) => {
      try {
        const res = await fetch(`${API_BASE}/api/execution/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const data = (await res.json()) as { ok: boolean; error?: string; snapshot?: OfficeSnapshot };
        applySnapshotIfPresent(data);
        if (!data.ok && data.error) setErrorBanner(data.error);
        else setErrorBanner(null);
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Order execution failed';
        setErrorBanner(msg);
        return { ok: false, error: msg };
      }
    },
    [],
  );

  const closeExecutionPosition = useCallback(async (positionId: string) => {
    const res = await fetch(
      `${API_BASE}/api/execution/positions/${encodeURIComponent(positionId)}/close`,
      { method: 'POST' },
    );
    const data = (await res.json()) as { ok: boolean; error?: string; snapshot?: OfficeSnapshot };
    applySnapshotIfPresent(data);
    if (!data.ok && data.error) setErrorBanner(data.error);
    else setErrorBanner(null);
    return data;
  }, []);

  const updateAutoTrade = useCallback(
    async (patch: {
      enabled?: boolean;
      autoExecuteOnApproval?: boolean;
      intervalMinutes?: number;
      enabledSymbols?: string[];
      enabledTimeframes?: CandleTimeframe[];
      runImmediate?: boolean;
    }) => {
      const res = await fetch(`${API_BASE}/api/autotrade/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; snapshot?: OfficeSnapshot };
      applySnapshotIfPresent(data);
      if (!data.ok && data.error) setErrorBanner(data.error);
      else setErrorBanner(null);
      return data;
    },
    [],
  );

  const runAutoTradeCycle = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/autotrade/run-now`, { method: 'POST' });
      const data = (await res.json()) as { ok: boolean; error?: string; snapshot?: OfficeSnapshot };
      applySnapshotIfPresent(data);
      if (!data.ok && data.error) setErrorBanner(data.error);
      else setErrorBanner(null);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Autopilot cycle failed';
      setErrorBanner(msg);
      return { ok: false, error: msg };
    }
  }, []);

  const fetchCredentialsStatus = useCallback(async (): Promise<CredentialsStatus | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/system/credentials-status`);
      const data = (await res.json()) as { ok: boolean; credentials?: CredentialsStatus };
      return data.credentials ?? null;
    } catch {
      return null;
    }
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
    runAgentAnalysis,
    updateAgentConfig,
    updateRouterPolicy,
    refreshMarketData,
    updateMarketConfig,
    startWarRoomDebate,
    reconcileExecution,
    resetPaperAccount,
    executeTradeOrder,
    closeExecutionPosition,
    updateAutoTrade,
    runAutoTradeCycle,
    fetchCredentialsStatus,
  };
}
