import type {
  AIProviderName,
  AIRouterPolicy,
  AIUsageEntry,
  AgentStructuredReport,
  EmployeeRecord,
  MarketTickerData,
  RiskConfig,
} from '../../src/types/hq.ts';
import {
  callClaudeProvider,
  callGeminiProvider,
  callOllamaProvider,
  type ProviderCallRequest,
  type ProviderCallResponse,
} from './adapters.ts';
import { buildAgentSystemPrompt, buildPhase2ContextPrompt } from './prompts.ts';
import { validateAgentJsonOutput } from './schema.ts';

async function invokeSingleProvider(
  provider: AIProviderName,
  req: ProviderCallRequest,
): Promise<ProviderCallResponse> {
  if (provider === 'Deterministic Python') {
    throw new Error('Deterministic agent uses non-LLM engine; routing to LLM fallback if enabled.');
  }
  if (provider === 'Gemini') {
    return callGeminiProvider(req);
  }
  if (provider === 'Claude') {
    return callClaudeProvider(req);
  }
  return callOllamaProvider(req);
}

export async function routeEmployeeAnalysis(input: {
  employee: EmployeeRecord;
  riskConfig: RiskConfig;
  policy: AIRouterPolicy;
  mode: string;
  symbol: string;
  timeframe: string;
  taskId: string;
  marketFeed?: MarketTickerData | null;
}): Promise<{
  report: AgentStructuredReport;
  usage: AIUsageEntry;
  costAddedUsd: number;
}> {
  const startedAt = Date.now();
  const { employee, riskConfig, policy, marketFeed } = input;

  const hasFreshData =
    Boolean(marketFeed) &&
    marketFeed?.status === 'CONNECTED' &&
    !marketFeed.isStale &&
    (marketFeed.candles?.length ?? 0) >= 20;

  const isStaleFeed = Boolean(marketFeed) && marketFeed?.isStale && (marketFeed.candles?.length ?? 0) > 0;

  const systemPrompt = buildAgentSystemPrompt(employee, riskConfig);
  const userPrompt = buildPhase2ContextPrompt({
    employee,
    taskId: input.taskId,
    symbol: input.symbol,
    timeframe: input.timeframe,
    mode: input.mode,
    exchangeConnected: hasFreshData,
    marketFeed,
  });

  // Deterministic fail-closed report builder
  const buildSafeNoTradeReport = (
    reason: string,
    providerUsed: string,
    modelUsed: string,
    schemaValid: boolean,
  ): AgentStructuredReport => ({
    id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    employee_id: employee.id,
    task_id: input.taskId,
    symbol: input.symbol,
    timeframe: input.timeframe,
    timestamp: new Date().toISOString(),
    market_direction: 'INSUFFICIENT_DATA',
    findings: [reason],
    supporting_evidence: [
      hasFreshData
        ? `Exchange market feed: CONNECTED (${marketFeed?.source})`
        : isStaleFeed
          ? `Exchange market feed: STALE (${marketFeed?.ageSeconds}s old > ${marketFeed?.staleThresholdSeconds}s limit)`
          : `Exchange market feed: ${marketFeed?.status ?? 'NOT_CONNECTED'}`,
      `Risk Margin Mode: ${riskConfig.marginMode} · Max Risk/Trade: ${riskConfig.riskPerTradePct}%`,
    ],
    confidence: 0,
    invalidation_conditions: ['Requires fresh connected Binance USD-M Futures market feed and verified OHLCV data'],
    recommended_action: employee.canVeto ? 'VETO' : 'NO_TRADE',
    reasoning_summary: reason,
    data_quality: !schemaValid
      ? 'SCHEMA_FALLBACK'
      : isStaleFeed
        ? 'STALE_DATA'
        : hasFreshData
          ? 'LIVE_VERIFIED'
          : 'NO_EXCHANGE_DATA',
    provider_used: providerUsed,
    model_used: modelUsed,
    latency_ms: Date.now() - startedAt,
    schema_valid: schemaValid,
  });

  // Enforce daily AI cost limit
  if (policy.spentTodayUsd >= policy.dailyBudgetUsd) {
    const usage: AIUsageEntry = {
      id: `aiu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      employeeId: employee.id,
      employeeCode: employee.code,
      provider: employee.provider,
      model: employee.assignedModel,
      promptTokens: 0,
      completionTokens: 0,
      estimatedCostUsd: 0,
      latencyMs: 0,
      status: 'FAILED',
      errorMessage: `Daily AI budget cap ($${policy.dailyBudgetUsd.toFixed(2)}) reached.`,
    };
    return {
      report: buildSafeNoTradeReport(
        `AI call blocked: daily budget limit $${policy.dailyBudgetUsd.toFixed(2)} reached. Fail-closed to NO_TRADE.`,
        'RouterBudgetGuard',
        employee.assignedModel,
        true,
      ),
      usage,
      costAddedUsd: 0,
    };
  }

  // Build ordered provider chain (skip unconfigured optional providers, always keep Gemini fast fallback)
  const isProviderConfigured = (p: AIProviderName): boolean => {
    if (p === 'Gemini') {
      const k = (process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || '').replace(/^["']|["']$/g, '');
      return Boolean(k && k !== 'MY_GEMINI_API_KEY');
    }
    if (p === 'Claude') return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
    if (p === 'Ollama') return Boolean(process.env.OLLAMA_BASE_URL?.trim());
    return false;
  };

  const attempts: Array<{ provider: AIProviderName; model: string }> = [];
  if (isProviderConfigured(employee.provider)) {
    attempts.push({ provider: employee.provider, model: employee.assignedModel });
  }
  if (
    policy.enableFallback &&
    employee.fallbackProvider !== employee.provider &&
    isProviderConfigured(employee.fallbackProvider)
  ) {
    attempts.push({
      provider: employee.fallbackProvider,
      model: employee.fallbackProvider === 'Gemini' ? 'gemini-3.1-flash-lite' : employee.assignedModel,
    });
  }
  if (isProviderConfigured('Gemini') && !attempts.some((a) => a.provider === 'Gemini' && a.model === 'gemini-3.1-flash-lite')) {
    attempts.push({ provider: 'Gemini', model: 'gemini-3.1-flash-lite' });
  }

  let lastError =
    'GEMINI_API_KEY belum terpasang di server (.env / AI Studio Secrets / Vercel Env). Data market Binance sudah hidup, tapi LLM perlu API key.';

  for (let i = 0; i < attempts.length; i++) {
    const { provider, model } = attempts[i];
    const isFallback = i > 0;
    const retries = provider === 'Deterministic Python' ? 0 : policy.maxRetries;

    for (let tryIdx = 0; tryIdx <= retries; tryIdx++) {
      try {
        const res = await invokeSingleProvider(provider, {
          model,
          systemPrompt,
          userPrompt,
          maxTokens: policy.maxTokensPerCall,
          timeoutMs: policy.timeoutMs,
        });

        const validation = validateAgentJsonOutput(res.rawText, {
          employeeId: employee.id,
          taskId: input.taskId,
          symbol: input.symbol,
          timeframe: input.timeframe,
        });

        if (!validation.valid || !validation.report) {
          throw new Error(`Schema validation failed: ${validation.errors.join('; ')}`);
        }

        // Deterministic safety gate: force NO_TRADE / VETO if exchange data is missing or stale
        const safeReport: AgentStructuredReport = hasFreshData
          ? {
              ...validation.report,
              id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              data_quality: 'LIVE_VERIFIED',
              provider_used: provider,
              model_used: res.modelUsed,
              latency_ms: res.latencyMs,
              schema_valid: true,
            }
          : {
              ...validation.report,
              id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              market_direction: 'INSUFFICIENT_DATA',
              recommended_action: employee.canVeto ? 'VETO' : 'NO_TRADE',
              confidence: 0,
              data_quality: isStaleFeed ? 'STALE_DATA' : 'NO_EXCHANGE_DATA',
              provider_used: provider,
              model_used: res.modelUsed,
              latency_ms: res.latencyMs,
              schema_valid: true,
            };

        const usage: AIUsageEntry = {
          id: `aiu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          employeeId: employee.id,
          employeeCode: employee.code,
          provider,
          model: res.modelUsed,
          promptTokens: res.promptTokens,
          completionTokens: res.completionTokens,
          estimatedCostUsd: res.estimatedCostUsd,
          latencyMs: res.latencyMs,
          status: isFallback ? 'FALLBACK' : 'SUCCESS',
        };

        return { report: safeReport, usage, costAddedUsd: res.estimatedCostUsd };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  // All providers unavailable or failed: fail closed honestly
  const usage: AIUsageEntry = {
    id: `aiu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    employeeId: employee.id,
    employeeCode: employee.code,
    provider: employee.provider,
    model: employee.assignedModel,
    promptTokens: 0,
    completionTokens: 0,
    estimatedCostUsd: 0,
    latencyMs: Date.now() - startedAt,
    status: 'FAILED',
    errorMessage: lastError,
  };

  return {
    report: buildSafeNoTradeReport(
      `Provider fallback exhausted (${lastError}). Fail-closed safely to ${employee.canVeto ? 'VETO' : 'NO_TRADE'}.`,
      employee.provider,
      employee.assignedModel,
      false,
    ),
    usage,
    costAddedUsd: 0,
  };
}
