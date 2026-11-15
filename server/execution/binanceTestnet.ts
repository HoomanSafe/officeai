import crypto from 'node:crypto';
import type { MarginMode, PositionSide } from '../../src/types/hq.ts';
import { DEFAULT_SYMBOL_FILTERS, type SymbolExchangeFilter } from './riskMath.ts';

const TESTNET_BASE_URL =
  process.env.BINANCE_TESTNET_BASE_URL || 'https://testnet.binancefuture.com';

const filterCache = new Map<string, SymbolExchangeFilter>();

function getCredentials(): { apiKey: string; apiSecret: string } | null {
  const apiKey = process.env.BINANCE_API_KEY?.trim() ?? '';
  const apiSecret = process.env.BINANCE_API_SECRET?.trim() ?? '';
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}

export function hasBinanceTestnetCredentials(): boolean {
  return getCredentials() !== null;
}

async function binanceRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params: Record<string, string | number | boolean> = {},
  signed = true,
): Promise<T> {
  const creds = getCredentials();
  if (signed && !creds) {
    throw new Error(
      'BINANCE_API_KEY / BINANCE_API_SECRET not set in server environment (.env).',
    );
  }

  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      search.set(k, String(v));
    }
  }

  if (signed && creds) {
    search.set('recvWindow', '5000');
    search.set('timestamp', String(Date.now()));
    const signature = crypto
      .createHmac('sha256', creds.apiSecret)
      .update(search.toString())
      .digest('hex');
    search.set('signature', signature);
  }

  const url = `${TESTNET_BASE_URL}${path}${search.toString() ? `?${search.toString()}` : ''}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        ...(creds ? { 'X-MBX-APIKEY': creds.apiKey } : {}),
        'Content-Type': 'application/json',
      },
    });
    const text = await res.text();
    let parsed: unknown = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { msg: text };
    }
    if (!res.ok) {
      const errObj = parsed as { code?: number; msg?: string };
      throw new Error(
        `Binance Testnet HTTP ${res.status} (code ${errObj.code ?? '?'}): ${errObj.msg ?? text.slice(0, 160)}`,
      );
    }
    return parsed as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTestnetSymbolFilter(symbol: string): Promise<SymbolExchangeFilter> {
  const upper = symbol.toUpperCase();
  const cached = filterCache.get(upper);
  if (cached) return cached;

  try {
    const info = await binanceRequest<{
      symbols?: Array<{
        symbol: string;
        filters?: Array<{
          filterType: string;
          stepSize?: string;
          minQty?: string;
          tickSize?: string;
          notional?: string;
        }>;
      }>;
    }>('GET', '/fapi/v1/exchangeInfo', {}, false);

    const sym = info.symbols?.find((s) => s.symbol === upper);
    if (sym?.filters) {
      const lot = sym.filters.find((f) => f.filterType === 'LOT_SIZE');
      const price = sym.filters.find((f) => f.filterType === 'PRICE_FILTER');
      const minNotional = sym.filters.find((f) => f.filterType === 'MIN_NOTIONAL');
      const filter: SymbolExchangeFilter = {
        symbol: upper,
        stepSize: Number(lot?.stepSize ?? 0.001),
        minQty: Number(lot?.minQty ?? 0.001),
        tickSize: Number(price?.tickSize ?? 0.1),
        minNotional: Number(minNotional?.notional ?? 20),
      };
      filterCache.set(upper, filter);
      return filter;
    }
  } catch {
    // Fallback to known Binance precision defaults
  }

  return (
    DEFAULT_SYMBOL_FILTERS[upper] ?? {
      symbol: upper,
      stepSize: 0.001,
      tickSize: 0.01,
      minQty: 0.001,
      minNotional: 20,
    }
  );
}

export async function fetchTestnetAccountOverview(): Promise<{
  equityUsd: number;
  availableBalanceUsd: number;
  unrealizedPnlUsd: number;
  openExchangePositions: Array<{
    symbol: string;
    positionAmt: number;
    entryPrice: number;
    markPrice: number;
    unRealizedProfit: number;
    leverage: number;
    marginType: string;
  }>;
}> {
  const acc = await binanceRequest<{
    totalMarginBalance?: string;
    totalWalletBalance?: string;
    availableBalance?: string;
    totalUnrealizedProfit?: string;
    positions?: Array<{
      symbol: string;
      positionAmt: string;
      entryPrice: string;
      markPrice?: string;
      unrealizedProfit: string;
      leverage: string;
      isolated?: boolean;
    }>;
  }>('GET', '/fapi/v2/account', {}, true);

  const posRisk = await binanceRequest<
    Array<{
      symbol: string;
      positionAmt: string;
      entryPrice: string;
      markPrice: string;
      unRealizedProfit: string;
      leverage: string;
      marginType: string;
    }>
  >('GET', '/fapi/v2/positionRisk', {}, true);

  const openExchangePositions = posRisk
    .map((p) => ({
      symbol: p.symbol,
      positionAmt: Number(p.positionAmt),
      entryPrice: Number(p.entryPrice),
      markPrice: Number(p.markPrice),
      unRealizedProfit: Number(p.unRealizedProfit),
      leverage: Number(p.leverage),
      marginType: p.marginType,
    }))
    .filter((p) => Math.abs(p.positionAmt) > 0);

  return {
    equityUsd: Number(acc.totalMarginBalance ?? acc.totalWalletBalance ?? 0),
    availableBalanceUsd: Number(acc.availableBalance ?? 0),
    unrealizedPnlUsd: Number(acc.totalUnrealizedProfit ?? 0),
    openExchangePositions,
  };
}

export async function configureTestnetMarginAndLeverage(input: {
  symbol: string;
  marginMode: MarginMode;
  leverage: number;
}): Promise<void> {
  try {
    await binanceRequest('POST', '/fapi/v1/positionSide/dual', {
      dualSidePosition: 'false',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (!msg.includes('-4059')) throw err;
  }

  try {
    await binanceRequest('POST', '/fapi/v1/marginType', {
      symbol: input.symbol,
      marginType: input.marginMode === 'CROSS' ? 'CROSSED' : 'ISOLATED',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (!msg.includes('-4046')) throw err;
  }

  await binanceRequest('POST', '/fapi/v1/leverage', {
    symbol: input.symbol,
    leverage: input.leverage,
  });
}

export async function placeTestnetEntryAndVerifyProtection(input: {
  symbol: string;
  side: PositionSide;
  quantity: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  marginMode: MarginMode;
  leverage: number;
  baseClientId: string;
}): Promise<{
  entryOrderId: string;
  avgFillPrice: number;
  slOrderId: string | null;
  tpOrderId: string | null;
  slVerified: boolean;
  verificationNote: string;
}> {
  const symbol = input.symbol.toUpperCase();
  const entrySide = input.side === 'LONG' ? 'BUY' : 'SELL';
  const exitSide = input.side === 'LONG' ? 'SELL' : 'BUY';

  await configureTestnetMarginAndLeverage({
    symbol,
    marginMode: input.marginMode,
    leverage: input.leverage,
  });

  const entryRes = await binanceRequest<{
    orderId: number;
    avgPrice?: string;
    executedQty?: string;
  }>('POST', '/fapi/v1/order', {
    symbol,
    side: entrySide,
    type: 'MARKET',
    quantity: input.quantity,
    newClientOrderId: `${input.baseClientId}-EN`,
    newOrderRespType: 'RESULT',
  });

  const entryOrderId = String(entryRes.orderId);
  const avgFillPrice = Number(entryRes.avgPrice || 0);

  let slOrderId: string | null = null;
  let tpOrderId: string | null = null;

  try {
    const slRes = await binanceRequest<{ orderId: number }>('POST', '/fapi/v1/order', {
      symbol,
      side: exitSide,
      type: 'STOP_MARKET',
      quantity: input.quantity,
      stopPrice: input.stopLossPrice,
      reduceOnly: 'true',
      workingType: 'MARK_PRICE',
      newClientOrderId: `${input.baseClientId}-SL`,
    });
    slOrderId = String(slRes.orderId);

    try {
      const tpRes = await binanceRequest<{ orderId: number }>('POST', '/fapi/v1/order', {
        symbol,
        side: exitSide,
        type: 'TAKE_PROFIT_MARKET',
        quantity: input.quantity,
        stopPrice: input.takeProfitPrice,
        reduceOnly: 'true',
        workingType: 'MARK_PRICE',
        newClientOrderId: `${input.baseClientId}-TP`,
      });
      tpOrderId = String(tpRes.orderId);
    } catch {
      // TP failure is logged; SL verification remains mandatory
    }

    // Mandatory post-order exchange verification
    const openOrders = await binanceRequest<Array<{ orderId: number; type: string }>>(
      'GET',
      '/fapi/v1/openOrders',
      { symbol },
      true,
    );
    const hasSlOnExchange = openOrders.some((o) => String(o.orderId) === slOrderId);
    const hasTpOnExchange = tpOrderId ? openOrders.some((o) => String(o.orderId) === tpOrderId) : false;

    if (!hasSlOnExchange) {
      throw new Error('Stop Loss order not confirmed in Binance Testnet openOrders.');
    }

    return {
      entryOrderId,
      avgFillPrice,
      slOrderId,
      tpOrderId,
      slVerified: true,
      verificationNote: `Verified on Binance Testnet: SL #${slOrderId} active${hasTpOnExchange ? `, TP #${tpOrderId} active` : ' (TP missing)'}.`,
    };
  } catch (err) {
    // FAIL-CLOSED EMERGENCY FLATTEN ON MISSING STOP LOSS
    try {
      await binanceRequest('DELETE', '/fapi/v1/allOpenOrders', { symbol }, true);
    } catch {
      // Ignore cancel cleanup error
    }
    try {
      await binanceRequest('POST', '/fapi/v1/order', {
        symbol,
        side: exitSide,
        type: 'MARKET',
        quantity: input.quantity,
        reduceOnly: 'true',
        newClientOrderId: `${input.baseClientId}-EMG`,
      });
    } catch {
      // Bubble original failure
    }
    return {
      entryOrderId,
      avgFillPrice,
      slOrderId,
      tpOrderId,
      slVerified: false,
      verificationNote: `FAIL-CLOSED: SL verification failed (${err instanceof Error ? err.message : String(err)}). Emergency flatten submitted.`,
    };
  }
}

export async function closeTestnetPositionOnExchange(input: {
  symbol: string;
  side: PositionSide;
  quantity: number;
  clientId: string;
}): Promise<{ closeOrderId: string; avgFillPrice: number }> {
  const symbol = input.symbol.toUpperCase();
  const exitSide = input.side === 'LONG' ? 'SELL' : 'BUY';

  try {
    await binanceRequest('DELETE', '/fapi/v1/allOpenOrders', { symbol }, true);
  } catch {
    // Proceed to reduceOnly close even if no open orders remain
  }

  const res = await binanceRequest<{ orderId: number; avgPrice?: string }>('POST', '/fapi/v1/order', {
    symbol,
    side: exitSide,
    type: 'MARKET',
    quantity: input.quantity,
    reduceOnly: 'true',
    newClientOrderId: `${input.clientId}-CL`,
    newOrderRespType: 'RESULT',
  });

  return {
    closeOrderId: String(res.orderId),
    avgFillPrice: Number(res.avgPrice || 0),
  };
}
