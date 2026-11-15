export type TradingMode = 'DEMO' | 'PAPER' | 'TESTNET' | 'LIVE';

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
  provider: 'Gemini' | 'Claude' | 'Ollama' | 'Deterministic Python';
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
  category: 'SYSTEM' | 'TASK' | 'MOVEMENT' | 'RISK' | 'MODE';
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
  marginMode: 'ISOLATED';
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
  integrations: IntegrationItem[];
  riskConfig: RiskConfig;
}

export type ServerWsEvent =
  | { type: 'office:snapshot'; payload: OfficeSnapshot }
  | { type: 'employee:updated'; payload: EmployeeRecord }
  | { type: 'activity:created'; payload: ActivityLogEntry }
  | { type: 'task:updated'; payload: TaskRecord }
  | { type: 'mode:changed'; payload: { mode: TradingMode; liveLocked: boolean } }
  | { type: 'risk:updated'; payload: RiskConfig }
  | { type: 'system:status'; payload: { connectedClients: number; drillRunning: boolean; serverTime: string } };
