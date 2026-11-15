import { Type } from '@google/genai';
import type {
  AgentStructuredReport,
  DataQualityFlag,
  MarketDirection,
  RecommendedAction,
} from '../../src/types/hq.ts';

const VALID_DIRECTIONS = new Set<MarketDirection>([
  'BULLISH',
  'BEARISH',
  'NEUTRAL',
  'INSUFFICIENT_DATA',
]);
const VALID_ACTIONS = new Set<RecommendedAction>([
  'LONG',
  'SHORT',
  'NO_TRADE',
  'HOLD',
  'VETO',
]);
const VALID_DATA_QUALITY = new Set<DataQualityFlag>([
  'LIVE_VERIFIED',
  'NO_EXCHANGE_DATA',
  'STALE_DATA',
  'SCHEMA_FALLBACK',
]);

export const GEMINI_AGENT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    employee_id: { type: Type.STRING },
    task_id: { type: Type.STRING },
    symbol: { type: Type.STRING },
    timeframe: { type: Type.STRING },
    timestamp: { type: Type.STRING },
    market_direction: {
      type: Type.STRING,
      enum: ['BULLISH', 'BEARISH', 'NEUTRAL', 'INSUFFICIENT_DATA'],
    },
    findings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    supporting_evidence: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    confidence: { type: Type.NUMBER },
    invalidation_conditions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    recommended_action: {
      type: Type.STRING,
      enum: ['LONG', 'SHORT', 'NO_TRADE', 'HOLD', 'VETO'],
    },
    reasoning_summary: { type: Type.STRING },
    data_quality: {
      type: Type.STRING,
      enum: ['LIVE_VERIFIED', 'NO_EXCHANGE_DATA', 'STALE_DATA', 'SCHEMA_FALLBACK'],
    },
  },
  required: [
    'employee_id',
    'task_id',
    'symbol',
    'timeframe',
    'timestamp',
    'market_direction',
    'findings',
    'supporting_evidence',
    'confidence',
    'invalidation_conditions',
    'recommended_action',
    'reasoning_summary',
    'data_quality',
  ],
};

export interface ValidatedReportResult {
  valid: boolean;
  errors: string[];
  report?: Omit<AgentStructuredReport, 'id' | 'provider_used' | 'model_used' | 'latency_ms' | 'schema_valid'>;
}

export function validateAgentJsonOutput(
  rawText: string,
  expected: { employeeId: string; taskId: string; symbol: string; timeframe: string },
): ValidatedReportResult {
  let parsed: Record<string, unknown>;
  try {
    const cleaned = rawText
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '');
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return { valid: false, errors: ['Response is not valid JSON.'] };
  }

  const errors: string[] = [];
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valid: false, errors: ['Root JSON payload must be an object.'] };
  }

  const strField = (key: string) => (typeof parsed[key] === 'string' && parsed[key].trim().length > 0);
  const strArrayField = (key: string) =>
    Array.isArray(parsed[key]) && (parsed[key] as unknown[]).every((v) => typeof v === 'string');

  if (!strField('reasoning_summary')) errors.push('Missing reasoning_summary string');
  if (!strArrayField('findings')) errors.push('findings must be string[]');
  if (!strArrayField('supporting_evidence')) errors.push('supporting_evidence must be string[]');
  if (!strArrayField('invalidation_conditions')) errors.push('invalidation_conditions must be string[]');

  const dir = parsed.market_direction as MarketDirection;
  if (!VALID_DIRECTIONS.has(dir)) errors.push(`Invalid market_direction: ${String(parsed.market_direction)}`);

  const action = parsed.recommended_action as RecommendedAction;
  if (!VALID_ACTIONS.has(action)) errors.push(`Invalid recommended_action: ${String(parsed.recommended_action)}`);

  const dq = parsed.data_quality as DataQualityFlag;
  if (!VALID_DATA_QUALITY.has(dq)) errors.push(`Invalid data_quality: ${String(parsed.data_quality)}`);

  const conf = Number(parsed.confidence);
  if (Number.isNaN(conf) || conf < 0 || conf > 1) {
    errors.push('confidence must be a number between 0.0 and 1.0');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    report: {
      employee_id: expected.employeeId,
      task_id: expected.taskId,
      symbol: typeof parsed.symbol === 'string' && parsed.symbol ? parsed.symbol : expected.symbol,
      timeframe:
        typeof parsed.timeframe === 'string' && parsed.timeframe ? parsed.timeframe : expected.timeframe,
      timestamp:
        typeof parsed.timestamp === 'string' && parsed.timestamp
          ? parsed.timestamp
          : new Date().toISOString(),
      market_direction: dir,
      findings: parsed.findings as string[],
      supporting_evidence: parsed.supporting_evidence as string[],
      confidence: Number(conf.toFixed(3)),
      invalidation_conditions: parsed.invalidation_conditions as string[],
      recommended_action: action,
      reasoning_summary: String(parsed.reasoning_summary),
      data_quality: dq,
    },
  };
}
