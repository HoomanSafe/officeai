export type TradingMode = 'DEMO' | 'PAPER' | 'TESTNET' | 'LIVE';

export type MarginMode = 'CROSS' | 'ISOLATED';

export type EmployeeState =
  | 'IDLE'
  | 'ANALYZING'
  | 'RESEARCHING'
  | 'DISCUSSING'
  | 'WAITING_FOR_APPROVAL'
  | 'EXECUTING'
  | 'MONITORING_TRADE'
  | 'COMPLETED'
  | 'ERROR';

export type RoomId =
  | 'CEO_OFFICE'
  | 'TRADING_FLOOR'
  | 'TECHNICAL_ROOM'
  | 'SMC_ROOM'
  | 'ORDER_FLOW_LAB'
  | 'QUANT_LAB'
  | 'RISK_OFFICE'
  | 'EXECUTION_CENTER'
  | 'AI_WAR_ROOM';

export type ConnectionState = 'CONNECTED' | 'NOT_CONNECTED' | 'STANDBY' | 'NOT_IMPLEMENTED';

export type AIProviderName = 'Gemini' | 'Claude' | 'Ollama' | 'Deterministic Python';

export type MarketDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'INSUFFICIENT_DATA';
export type RecommendedAction = 'LONG' | 'SHORT' | 'NO_TRADE' | 'HOLD' | 'VETO';
export type DataQualityFlag = 'LIVE_VERIFIED' | 'NO_EXCHANGE_DATA' | 'STALE_DATA' | 'SCHEMA_FALLBACK';

export interface AgentStructuredReport {
  id: string;
  employee_id: string;
  task_id: string;
  symbol: string;
  timeframe: string;
  timestamp: string;
  market_direction: MarketDirection;
  findings: string[];
  supporting_evidence: string[];
  confidence: number;
  invalidation_conditions: string[];
  recommended_action: RecommendedAction;
  reasoning_summary: string;
  data_quality: DataQualityFlag;
  provider_used: string;
  model_used: string;
  latency_ms: number;
  schema_valid: boolean;
}

export interface AIUsageEntry {
  id: string;
  timestamp: string;
  employeeId: string;
  employeeCode: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  status: 'SUCCESS' | 'FALLBACK' | 'FAILED';
  errorMessage?: string;
}

export interface AIRouterPolicy {
  maxTokensPerCall: number;
  dailyBudgetUsd: number;
  spentTodayUsd: number;
  timeoutMs: number;
  maxRetries: number;
  enableFallback: boolean;
}

export type CandleTimeframe = '5m' | '15m' | '1h' | '4h' | '1d';

export type MarketRegime =
  | 'TRENDING_UP'
  | 'TRENDING_DOWN'
  | 'RANGING'
  | 'HIGH_VOLATILITY'
  | 'UNKNOWN';

export interface OhlcvCandle {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  trades: number;
  closed: boolean;
}

export interface OrderBookSummary {
  lastUpdateId: number;
  bestBid: number;
  bestAsk: number;
  spreadBps: number;
  bidVolumeTop20: number;
  askVolumeTop20: number;
  imbalanceRatio: number;
  topBids: Array<[number, number]>;
  topAsks: Array<[number, number]>;
}

export interface TechnicalIndicators {
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi14: number | null;
  macd: {
    line: number;
    signal: number;
    histogram: number;
  } | null;
  atr14: number | null;
  atrPct: number | null;
  vwap: number | null;
  regime: MarketRegime;
}

export interface MarketTickerData {
  symbol: string;
  timeframe: CandleTimeframe;
  status: 'CONNECTED' | 'STALE' | 'ERROR' | 'NOT_CONNECTED';
  source: string;
  lastFetchedAt: string | null;
  ageSeconds: number | null;
  staleThresholdSeconds: number;
  isStale: boolean;
  errorMessage: string | null;
  markPrice: number | null;
  indexPrice: number | null;
  lastPrice: number | null;
  priceChange24hPct: number | null;
  volume24hQuote: number | null;
  fundingRate: number | null;
  nextFundingTime: string | null;
  openInterest: number | null;
  openInterestValueUsd: number | null;
  candles: OhlcvCandle[];
  indicators: TechnicalIndicators;
  orderBook: OrderBookSummary | null;
}

export interface MarketEngineState {
  activeSymbol: string;
  activeTimeframe: CandleTimeframe;
  autoSyncEnabled: boolean;
  syncIntervalSeconds: number;
  staleThresholdSeconds: number;
  streamStatus: 'CONNECTED' | 'POLLING' | 'DEGRADED' | 'NOT_CONNECTED';
  lastSyncAt: string | null;
  watchedSymbols: string[];
  feeds: Record<string, MarketTickerData>;
}

export type DebateStage =
  | 'GATHERING_MARKET_DATA'
  | 'SPECIALIST_ANALYSIS'
  | 'WAR_ROOM_DEBATE'
  | 'HEAD_TRADER_PROPOSAL'
  | 'CEO_REVIEW'
  | 'RISK_AUDIT'
  | 'COMPLETED'
  | 'FAILED';

export type FinalCompanyDecision = 'APPROVED_LONG' | 'APPROVED_SHORT' | 'NO_TRADE' | 'VETOED';

export interface DebateProposal {
  action: 'LONG' | 'SHORT' | 'NO_TRADE';
  entryPrice: number | null;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  riskRewardRatio: number | null;
  confidence: number;
  thesis: string;
  invalidationConditions: string[];
}

export interface DebateSession {
  id: string;
  symbol: string;
  timeframe: CandleTimeframe;
  mode: TradingMode;
  marginMode: MarginMode;
  startedAt: string;
  completedAt: string | null;
  stage: DebateStage;
  statusText: string;
  marketMarkPrice: number | null;
  marketRegime: MarketRegime;
  specialistReports: AgentStructuredReport[];
  conflictDetected: boolean;
  conflictSummary: string;
  headTraderProposal: DebateProposal | null;
  ceoApproved: boolean | null;
  ceoReviewSummary: string | null;
  riskVetoed: boolean | null;
  riskAuditReasons: string[];
  finalDecision: FinalCompanyDecision | null;
  executionNote: string;
}

export type ExecutionVenue = 'PAPER_SIMULATOR' | 'BINANCE_TESTNET';
export type PositionSide = 'LONG' | 'SHORT';
export type PositionStatus = 'OPEN' | 'CLOSED' | 'LIQUIDATED' | 'PROTECTION_FAILED';
export type SlTpVerificationStatus = 'VERIFIED' | 'PENDING' | 'FAILED';

export interface OrderRecord {
  id: string;
  clientOrderId: string;
  exchangeOrderId: string | null;
  venue: ExecutionVenue;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
  reduceOnly: boolean;
  quantity: number;
  requestedPrice: number;
  fillPrice: number | null;
  stopPrice: number | null;
  feeUsd: number;
  slippageBps: number;
  status: 'FILLED' | 'NEW' | 'CANCELED' | 'REJECTED';
  createdAt: string;
  errorMessage?: string | null;
}

export interface PositionRecord {
  id: string;
  debateSessionId: string | null;
  venue: ExecutionVenue;
  mode: TradingMode;
  marginMode: MarginMode;
  symbol: string;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  markPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  slOrderId: string | null;
  tpOrderId: string | null;
  slTpVerified: SlTpVerificationStatus;
  slVerificationNote: string;
  leverage: number;
  notionalUsd: number;
  initialMarginUsd: number;
  riskAmountUsd: number;
  riskPctOfEquity: number;
  unrealizedPnlUsd: number;
  realizedPnlUsd: number | null;
  feesPaidUsd: number;
  status: PositionStatus;
  openedAt: string;
  closedAt: string | null;
  closeReason: string | null;
}

export interface AccountSummary {
  venue: ExecutionVenue | 'NOT_CONNECTED';
  connected: boolean;
  equityUsd: number;
  availableBalanceUsd: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  dailyPnlPct: number;
  dailyLossLimitBreached: boolean;
  openPositionsCount: number;
  lastSyncedAt: string | null;
  errorMessage: string | null;
}

export interface ExecutionEngineState {
  activeVenue: ExecutionVenue;
  paperAccount: AccountSummary;
  testnetAccount: AccountSummary;
  positions: PositionRecord[];
  orders: OrderRecord[];
  lastReconciledAt: string | null;
}

export interface AutoTradeConfig {
  enabled: boolean;
  autoExecuteOnApproval: boolean;
  intervalMinutes: number;
  enabledSymbols: string[];
  enabledTimeframes: CandleTimeframe[];
  cycleCursor: number;
  lastCycleAt: string | null;
  nextCycleAt: string | null;
  lastOutcome: string;
}

export interface CredentialsStatus {
  geminiConfigured: boolean;
  anthropicConfigured: boolean;
  ollamaConfigured: boolean;
  binanceKeyConfigured: boolean;
  binanceSecretConfigured: boolean;
  binanceTestnetFlag: boolean;
  runtime: 'vercel' | 'cloud-run' | 'local';
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface RoomSlot {
  x: number;
  z: number;
  facingYaw: number;
}

export interface RoomDefinition {
  id: RoomId;
  code: string;
  name: string;
  shortName: string;
  wing: 'North Wing' | 'Central Hub' | 'West Wing' | 'East Wing' | 'South Wing';
  purpose: string;
  center: { x: number; z: number };
  size: { w: number; d: number };
  accentColor: string;
  cameraPosition: Vec3;
  cameraTarget: Vec3;
  slots: RoomSlot[];
}

export interface EmployeeRecord {
  id: string;
  code: string;
  name: string;
  title: string;
  department: string;
  homeRoom: RoomId;
  currentRoom: RoomId;
  state: EmployeeState;
  currentTask: string;
  assignedModel: string;
  provider: AIProviderName;
  fallbackProvider: AIProviderName;
  accentColor: string;
  canVeto: boolean;
  responsibilities: string[];
  targetSlot: RoomSlot;
  lastUpdatedAt: string;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  roomId: RoomId;
  state: EmployeeState;
  action: string;
  detail: string;
  category: 'SYSTEM' | 'TASK' | 'MOVEMENT' | 'RISK' | 'MODE' | 'AI';
}

export interface TaskRecord {
  id: string;
  title: string;
  employeeId: string;
  targetRoom: RoomId;
  state: EmployeeState;
  createdAt: string;
  updatedAt: string;
  notes: string;
}

export interface IntegrationItem {
  id: string;
  name: string;
  category: 'Exchange' | 'AI Provider' | 'Infrastructure';
  status: ConnectionState;
  detail: string;
  phaseTarget: string;
}

export interface RiskConfig {
  riskPerTradePct: number;
  maxDailyLossPct: number;
  maxSimultaneousPositions: number;
  targetRiskReward: number;
  maxLeverage: number;
  marginMode: MarginMode;
  positionMode: 'ONE_WAY';
  emergencyKillSwitch: boolean;
}

export interface OfficeSnapshot {
  companyName: string;
  phase: string;
  mode: TradingMode;
  liveLocked: boolean;
  liveLockReason: string;
  serverTime: string;
  uptimeSeconds: number;
  connectedClients: number;
  drillRunning: boolean;
  rooms: RoomDefinition[];
  employees: EmployeeRecord[];
  tasks: TaskRecord[];
  activityLog: ActivityLogEntry[];
  agentReports: AgentStructuredReport[];
  aiUsage: AIUsageEntry[];
  aiRouterPolicy: AIRouterPolicy;
  integrations: IntegrationItem[];
  riskConfig: RiskConfig;
  marketData: MarketEngineState;
  debateSessions: DebateSession[];
  debateRunning: boolean;
  execution: ExecutionEngineState;
  autoTrade: AutoTradeConfig;
}

export type ServerWsEvent =
  | { type: 'office:snapshot'; payload: OfficeSnapshot }
  | { type: 'employee:updated'; payload: EmployeeRecord }
  | { type: 'activity:created'; payload: ActivityLogEntry }
  | { type: 'task:updated'; payload: TaskRecord }
  | { type: 'report:created'; payload: AgentStructuredReport }
  | { type: 'ai:usage'; payload: { entry: AIUsageEntry; policy: AIRouterPolicy } }
  | { type: 'market:updated'; payload: MarketEngineState }
  | { type: 'debate:updated'; payload: { session: DebateSession; debateRunning: boolean } }
  | { type: 'execution:updated'; payload: ExecutionEngineState }
  | { type: 'autotrade:updated'; payload: AutoTradeConfig }
  | { type: 'mode:changed'; payload: { mode: TradingMode; liveLocked: boolean } }
  | { type: 'risk:updated'; payload: RiskConfig }
  | { type: 'system:status'; payload: { connectedClients: number; drillRunning: boolean; serverTime: string } };
