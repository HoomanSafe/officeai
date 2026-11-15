import { Type, type Schema } from '@google/genai';
import type {
  AIProviderName,
  AIRouterPolicy,
  AIUsageEntry,
  AgentStructuredReport,
  DebateProposal,
  EmployeeRecord,
  MarketTickerData,
  RiskConfig,
} from '../../src/types/hq.ts';
import { callClaudeProvider, callGeminiProvider, callOllamaProvider, type ProviderCallResponse } from './adapters.ts';

const HEAD_TRADER_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, enum: ['LONG', 'SHORT', 'NO_TRADE'] },
    entry_price: { type: Type.NUMBER, nullable: true },
    stop_loss_price: { type: Type.NUMBER, nullable: true },
    take_profit_price: { type: Type.NUMBER, nullable: true },
    confidence: { type: Type.NUMBER },
    thesis: { type: Type.STRING },
    invalidation_conditions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['action', 'confidence', 'thesis', 'invalidation_conditions'],
};

const CEO_REVIEW_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    approved: { type: Type.BOOLEAN },
    summary: { type: Type.STRING },
  },
  required: ['approved', 'summary'],
};

const CRO_AUDIT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    vetoed: { type: Type.BOOLEAN },
    reasons: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['vetoed', 'reasons'],
};

async function invokeStructuredSynthesis(input: {
  employee: EmployeeRecord;
  policy: AIRouterPolicy;
  systemPrompt: string;
  userPrompt: string;
  schema: Schema;
}): Promise<{ rawText: string; usage: AIUsageEntry; costAddedUsd: number }> {
  const isConfigured = (p: AIProviderName): boolean => {
    if (p === 'Gemini') {
      const k = (process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || '').replace(/^["']|["']$/g, '');
      return Boolean(k && k !== 'MY_GEMINI_API_KEY');
    }
    if (p === 'Claude') return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
    if (p === 'Ollama') return Boolean(process.env.OLLAMA_BASE_URL?.trim());
    return false;
  };

  const attempts: Array<{ provider: AIProviderName; model: string }> = [];
  if (isConfigured(input.employee.provider)) {
    attempts.push({ provider: input.employee.provider, model: input.employee.assignedModel });
  }
  if (
    input.policy.enableFallback &&
    input.employee.fallbackProvider !== input.employee.provider &&
    isConfigured(input.employee.fallbackProvider)
  ) {
    attempts.push({
      provider: input.employee.fallbackProvider,
      model: input.employee.fallbackProvider === 'Gemini' ? 'gemini-3.1-flash-lite' : input.employee.assignedModel,
    });
  }
  if (isConfigured('Gemini') && !attempts.some((a) => a.provider === 'Gemini' && a.model === 'gemini-3.1-flash-lite')) {
    attempts.push({ provider: 'Gemini', model: 'gemini-3.1-flash-lite' });
  }

  let lastErr = 'No AI provider available';
  for (let i = 0; i < attempts.length; i++) {
    const { provider, model } = attempts[i];
    if (provider === 'Deterministic Python') continue;

    try {
      let res: ProviderCallResponse;
      const req = {
        model,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        maxTokens: input.policy.maxTokensPerCall,
        timeoutMs: input.policy.timeoutMs,
        responseSchema: input.schema,
      };
      if (provider === 'Gemini') res = await callGeminiProvider(req);
      else if (provider === 'Claude') res = await callClaudeProvider(req);
      else res = await callOllamaProvider(req);

      const usage: AIUsageEntry = {
        id: `aiu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        employeeId: input.employee.id,
        employeeCode: input.employee.code,
        provider,
        model: res.modelUsed,
        promptTokens: res.promptTokens,
        completionTokens: res.completionTokens,
        estimatedCostUsd: res.estimatedCostUsd,
        latencyMs: res.latencyMs,
        status: i > 0 ? 'FALLBACK' : 'SUCCESS',
      };
      return { rawText: res.rawText, usage, costAddedUsd: res.estimatedCostUsd };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(lastErr);
}

export function detectSpecialistConflicts(reports: AgentStructuredReport[]): {
  conflictDetected: boolean;
  conflictSummary: string;
} {
  const bullish = reports.filter((r) => r.market_direction === 'BULLISH');
  const bearish = reports.filter((r) => r.market_direction === 'BEARISH');
  const schemaFallback = reports.filter((r) => r.data_quality === 'SCHEMA_FALLBACK');
  const noMarketData = reports.filter(
    (r) =>
      r.data_quality === 'NO_EXCHANGE_DATA' ||
      r.data_quality === 'STALE_DATA' ||
      (r.data_quality !== 'SCHEMA_FALLBACK' && r.market_direction === 'INSUFFICIENT_DATA'),
  );

  if (schemaFallback.length > 0) {
    return {
      conflictDetected: true,
      conflictSummary: `${schemaFallback.length} specialist(s) entered AI fallback (${schemaFallback.map((r) => r.employee_id).join(', ')}): AI provider API key (GEMINI_API_KEY) is not configured or timed out on server.`,
    };
  }

  if (noMarketData.length > 0) {
    return {
      conflictDetected: true,
      conflictSummary: `${noMarketData.length} specialist(s) reported missing or stale Binance exchange data (${noMarketData.map((r) => r.employee_id).join(', ')}).`,
    };
  }

  if (bullish.length > 0 && bearish.length > 0) {
    return {
      conflictDetected: true,
      conflictSummary: `Directional conflict detected: ${bullish.map((r) => r.employee_id).join(', ')} BULLISH vs ${bearish.map((r) => r.employee_id).join(', ')} BEARISH. Majority voting prohibited; Head Trader & CEO must resolve.`,
    };
  }

  const actions = new Set(reports.map((r) => r.recommended_action));
  if (actions.has('NO_TRADE') && (actions.has('LONG') || actions.has('SHORT'))) {
    return {
      conflictDetected: true,
      conflictSummary: `Conviction divergence: some analysts see directional setup while peers recommend NO_TRADE.`,
    };
  }

  return {
    conflictDetected: false,
    conflictSummary: `Aligned specialist consensus (${bullish.length} BULLISH, ${bearish.length} BEARISH, ${reports.length - bullish.length - bearish.length} NEUTRAL).`,
  };
}

export function computeProposalRiskReward(proposal: DebateProposal): number | null {
  if (
    proposal.action === 'NO_TRADE' ||
    proposal.entryPrice === null ||
    proposal.stopLossPrice === null ||
    proposal.takeProfitPrice === null
  ) {
    return null;
  }
  const risk = Math.abs(proposal.entryPrice - proposal.stopLossPrice);
  const reward = Math.abs(proposal.takeProfitPrice - proposal.entryPrice);
  if (risk <= 0) return null;
  return Number((reward / risk).toFixed(2));
}

export function deterministicRiskAudit(input: {
  proposal: DebateProposal;
  marketFeed: MarketTickerData;
  riskConfig: RiskConfig;
  conflictDetected: boolean;
}): { vetoed: boolean; reasons: string[] } {
  const { proposal, marketFeed, riskConfig, conflictDetected } = input;
  const reasons: string[] = [];

  if (riskConfig.emergencyKillSwitch) {
    reasons.push('Emergency Kill Switch is ARMED.');
  }
  if (marketFeed.status !== 'CONNECTED' || marketFeed.isStale) {
    reasons.push(`Market data is ${marketFeed.status} (stale=${marketFeed.isStale}).`);
  }

  if (proposal.action === 'NO_TRADE') {
    return { vetoed: false, reasons: ['Head Trader proposed NO_TRADE — capital preservation verified.'] };
  }

  if (proposal.confidence < 0.55) {
    reasons.push(`Proposal confidence ${proposal.confidence.toFixed(2)} below 0.55 institutional threshold.`);
  }

  if (conflictDetected && proposal.confidence < 0.72) {
    reasons.push('Specialist directional conflict unresolved with insufficient confidence (< 0.72).');
  }

  if (
    proposal.entryPrice === null ||
    proposal.stopLossPrice === null ||
    proposal.takeProfitPrice === null
  ) {
    reasons.push('CROSS margin requires mandatory numeric Entry, Stop Loss, and Take Profit levels.');
    return { vetoed: true, reasons };
  }

  if (proposal.action === 'LONG') {
    if (!(proposal.stopLossPrice < proposal.entryPrice && proposal.entryPrice < proposal.takeProfitPrice)) {
      reasons.push('Invalid LONG geometry: requires StopLoss < Entry < TakeProfit.');
    }
  } else if (proposal.action === 'SHORT') {
    if (!(proposal.takeProfitPrice < proposal.entryPrice && proposal.entryPrice < proposal.stopLossPrice)) {
      reasons.push('Invalid SHORT geometry: requires TakeProfit < Entry < StopLoss.');
    }
  }

  const rr = computeProposalRiskReward(proposal);
  if (rr === null || rr < riskConfig.targetRiskReward) {
    reasons.push(
      `Risk/Reward ${rr ?? 0}:1 violates minimum 1:${riskConfig.targetRiskReward.toFixed(1)} institutional rule.`,
    );
  }

  if (marketFeed.markPrice && Math.abs(proposal.entryPrice - marketFeed.markPrice) / marketFeed.markPrice > 0.05) {
    reasons.push('Proposed entry price deviates >5% from live Binance mark price.');
  }

  if (reasons.length === 0) {
    return {
      vetoed: false,
      reasons: [
        `Passed CROSS margin audit: SL verified, R:R=${rr}:1 >= ${riskConfig.targetRiskReward}, max risk ${riskConfig.riskPerTradePct}%/trade, max ${riskConfig.maxLeverage}x lev.`,
      ],
    };
  }
  return { vetoed: true, reasons };
}

export async function runHeadTraderSynthesis(input: {
  employee: EmployeeRecord;
  policy: AIRouterPolicy;
  riskConfig: RiskConfig;
  marketFeed: MarketTickerData;
  btcFeed: MarketTickerData | null;
  specialistReports: AgentStructuredReport[];
  conflictSummary: string;
}): Promise<{ proposal: DebateProposal; usage: AIUsageEntry; costAddedUsd: number }> {
  const systemPrompt = `You are Elena Rostova (EMP-02), Head Trader at NEON AI TRADING HQ.
Synthesize the 4 specialist reports, BTC macro directional context, and conflict analysis into a disciplined trade proposal (LONG, SHORT, or NO_TRADE).
STRICT RULES:
- Never force a trade if specialists conflict weakly or R:R < 1:${input.riskConfig.targetRiskReward}.
- If proposing LONG or SHORT, you MUST provide realistic numeric entry_price, stop_loss_price, and take_profit_price anchored strictly near the supplied live markPrice (${input.marketFeed.markPrice}) and ATR (${input.marketFeed.indicators.atr14}) so Risk/Reward >= 1:${input.riskConfig.targetRiskReward}.
- Margin mode is ${input.riskConfig.marginMode}: Stop Loss is mandatory.`;

  const userPrompt = JSON.stringify({
    symbol: input.marketFeed.symbol,
    timeframe: input.marketFeed.timeframe,
    live_mark_price: input.marketFeed.markPrice,
    indicators: input.marketFeed.indicators,
    btc_macro_filter: input.btcFeed
      ? {
          mark_price: input.btcFeed.markPrice,
          regime: input.btcFeed.indicators.regime,
          rsi14: input.btcFeed.indicators.rsi14,
        }
      : null,
    conflict_summary: input.conflictSummary,
    specialist_reports: input.specialistReports.map((r) => ({
      employee_id: r.employee_id,
      direction: r.market_direction,
      action: r.recommended_action,
      confidence: r.confidence,
      findings: r.findings,
      invalidation_conditions: r.invalidation_conditions,
    })),
  });

  const res = await invokeStructuredSynthesis({
    employee: input.employee,
    policy: input.policy,
    systemPrompt,
    userPrompt,
    schema: HEAD_TRADER_SCHEMA,
  });

  const parsed = JSON.parse(res.rawText) as {
    action: 'LONG' | 'SHORT' | 'NO_TRADE';
    entry_price?: number | null;
    stop_loss_price?: number | null;
    take_profit_price?: number | null;
    confidence: number;
    thesis: string;
    invalidation_conditions: string[];
  };

  const proposal: DebateProposal = {
    action: parsed.action,
    entryPrice: typeof parsed.entry_price === 'number' ? Number(parsed.entry_price.toFixed(2)) : null,
    stopLossPrice: typeof parsed.stop_loss_price === 'number' ? Number(parsed.stop_loss_price.toFixed(2)) : null,
    takeProfitPrice: typeof parsed.take_profit_price === 'number' ? Number(parsed.take_profit_price.toFixed(2)) : null,
    riskRewardRatio: null,
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0))),
    thesis: parsed.thesis,
    invalidationConditions: Array.isArray(parsed.invalidation_conditions)
      ? parsed.invalidation_conditions
      : [],
  };
  proposal.riskRewardRatio = computeProposalRiskReward(proposal);

  return { proposal, usage: res.usage, costAddedUsd: res.costAddedUsd };
}

export async function runCeoReview(input: {
  employee: EmployeeRecord;
  policy: AIRouterPolicy;
  proposal: DebateProposal;
  conflictSummary: string;
  specialistReports: AgentStructuredReport[];
}): Promise<{ approved: boolean; summary: string; usage: AIUsageEntry; costAddedUsd: number }> {
  const systemPrompt = `You are Marcus Vance (EMP-01), CEO / Chief AI Officer of NEON AI TRADING HQ.
Review the Head Trader's proposal and how conflicts among specialists were addressed. Approve only if the thesis is coherent, invalidation criteria are explicit, and capital discipline is respected. You cannot override the Chief Risk Officer.`;

  const userPrompt = JSON.stringify({
    conflict_summary: input.conflictSummary,
    head_trader_proposal: input.proposal,
    specialist_summary: input.specialistReports.map((r) => ({
      id: r.employee_id,
      dir: r.market_direction,
      action: r.recommended_action,
      conf: r.confidence,
    })),
  });

  const res = await invokeStructuredSynthesis({
    employee: input.employee,
    policy: input.policy,
    systemPrompt,
    userPrompt,
    schema: CEO_REVIEW_SCHEMA,
  });

  const parsed = JSON.parse(res.rawText) as { approved: boolean; summary: string };
  return {
    approved: Boolean(parsed.approved),
    summary: parsed.summary || 'CEO review completed.',
    usage: res.usage,
    costAddedUsd: res.costAddedUsd,
  };
}

export async function runCroAiAudit(input: {
  employee: EmployeeRecord;
  policy: AIRouterPolicy;
  riskConfig: RiskConfig;
  proposal: DebateProposal;
  marketFeed: MarketTickerData;
  deterministicAudit: { vetoed: boolean; reasons: string[] };
}): Promise<{ vetoed: boolean; reasons: string[]; usage: AIUsageEntry; costAddedUsd: number }> {
  const systemPrompt = `You are Victor Krell (EMP-07), Chief Risk Officer of NEON AI TRADING HQ with absolute independent VETO authority.
Audit the trade proposal under ${input.riskConfig.marginMode} margin policy (max risk ${input.riskConfig.riskPerTradePct}%, max leverage ${input.riskConfig.maxLeverage}x, min R:R 1:${input.riskConfig.targetRiskReward}).
Note: if deterministic_audit already flagged vetoed=true, you MUST keep vetoed=true.`;

  const userPrompt = JSON.stringify({
    proposal: input.proposal,
    market_regime: input.marketFeed.indicators.regime,
    atr_pct: input.marketFeed.indicators.atrPct,
    deterministic_audit: input.deterministicAudit,
  });

  const res = await invokeStructuredSynthesis({
    employee: input.employee,
    policy: input.policy,
    systemPrompt,
    userPrompt,
    schema: CRO_AUDIT_SCHEMA,
  });

  const parsed = JSON.parse(res.rawText) as { vetoed: boolean; reasons: string[] };
  const finalVetoed = input.deterministicAudit.vetoed || Boolean(parsed.vetoed);
  const mergedReasons = Array.from(
    new Set([...input.deterministicAudit.reasons, ...(Array.isArray(parsed.reasons) ? parsed.reasons : [])]),
  );

  return {
    vetoed: finalVetoed,
    reasons: mergedReasons,
    usage: res.usage,
    costAddedUsd: res.costAddedUsd,
  };
}
