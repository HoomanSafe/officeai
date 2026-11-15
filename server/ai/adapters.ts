import { GoogleGenAI, type Schema } from '@google/genai';
import { GEMINI_AGENT_RESPONSE_SCHEMA } from './schema.ts';

export interface ProviderCallRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  timeoutMs: number;
  responseSchema?: Schema;
}

export interface ProviderCallResponse {
  rawText: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  modelUsed: string;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}

export async function callGeminiProvider(req: ProviderCallRequest): Promise<ProviderCallResponse> {
  const rawKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || '';
  const apiKey = rawKey.replace(/^["']|["']$/g, '');
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY belum terpasang di server (.env / Secrets / Vercel).');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Ensure supported @google/genai model alias
  const model =
    req.model.startsWith('gemini-') && !req.model.includes('1.5') && !req.model.includes('2.0')
      ? req.model
      : 'gemini-4-hydrogen';

  const started = Date.now();
  const response = await withTimeout(
    ai.models.generateContent({
      model,
      contents: req.userPrompt,
      config: {
        systemInstruction: req.systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: req.responseSchema ?? GEMINI_AGENT_RESPONSE_SCHEMA,
        maxOutputTokens: req.maxTokens,
      },
    }),
    req.timeoutMs,
    'Gemini API',
  );

  const latencyMs = Date.now() - started;
  const promptTokens = response.usageMetadata?.promptTokenCount ?? 0;
  const completionTokens = response.usageMetadata?.candidatesTokenCount ?? 0;
  // Conservative blended cost estimate for budget tracking
  const estimatedCostUsd = Number(
    ((promptTokens * 0.0000003) + (completionTokens * 0.0000012)).toFixed(6),
  );

  return {
    rawText: response.text ?? '',
    promptTokens,
    completionTokens,
    estimatedCostUsd,
    latencyMs,
    modelUsed: model,
  };
}

export async function callClaudeProvider(req: ProviderCallRequest): Promise<ProviderCallResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is NOT_CONNECTED on server.');
  }

  const model = req.model.startsWith('claude-') ? req.model : 'claude-3-7-sonnet-latest';
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens,
        system: req.systemPrompt,
        messages: [{ role: 'user', content: req.userPrompt }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Claude API HTTP ${res.status}: ${errBody.slice(0, 180)}`);
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const rawText = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const promptTokens = data.usage?.input_tokens ?? 0;
    const completionTokens = data.usage?.output_tokens ?? 0;
    const estimatedCostUsd = Number(
      ((promptTokens * 0.000003) + (completionTokens * 0.000015)).toFixed(6),
    );

    return {
      rawText,
      promptTokens,
      completionTokens,
      estimatedCostUsd,
      latencyMs: Date.now() - started,
      modelUsed: model,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function callOllamaProvider(req: ProviderCallRequest): Promise<ProviderCallResponse> {
  const baseUrl = process.env.OLLAMA_BASE_URL;
  if (!baseUrl) {
    throw new Error('OLLAMA_BASE_URL is NOT_CONNECTED on server.');
  }

  const model = req.model.replace(/^ollama:/, '') || 'qwen2.5:14b';
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs);

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        messages: [
          { role: 'system', content: req.systemPrompt },
          { role: 'user', content: req.userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      rawText: data.message?.content ?? '',
      promptTokens: data.prompt_eval_count ?? 0,
      completionTokens: data.eval_count ?? 0,
      estimatedCostUsd: 0,
      latencyMs: Date.now() - started,
      modelUsed: model,
    };
  } finally {
    clearTimeout(timer);
  }
}
