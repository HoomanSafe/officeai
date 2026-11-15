import type {
  CandleTimeframe,
  MarketTickerData,
  OhlcvCandle,
  OrderBookSummary,
} from '../../src/types/hq.ts';
import { calculateTechnicalIndicators } from './indicators.ts';

const DEFAULT_FAPI_BASE = process.env.BINANCE_FAPI_BASE_URL || 'https://fapi.binance.com';

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Binance HTTP ${res.status}: ${body.slice(0, 160)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function parseKlines(raw: unknown[]): OhlcvCandle[] {
  const now = Date.now();
  return raw
    .filter((row): row is unknown[] => Array.isArray(row) && row.length >= 9)
    .map((row) => {
      const openTime = Number(row[0]);
      const closeTime = Number(row[6]);
      return {
        openTime,
        closeTime,
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
        quoteVolume: Number(row[7]),
        trades: Number(row[8]),
        closed: closeTime <= now,
      };
    })
    .filter((c) => Number.isFinite(c.open) && Number.isFinite(c.close) && c.close > 0);
}

function parseOrderBook(raw: {
  lastUpdateId?: number;
  bids?: Array<[string, string]>;
  asks?: Array<[string, string]>;
}): OrderBookSummary | null {
  const bids = (raw.bids ?? [])
    .slice(0, 20)
    .map(([p, q]) => [Number(p), Number(q)] as [number, number])
    .filter(([p, q]) => Number.isFinite(p) && Number.isFinite(q) && p > 0 && q >= 0);

  const asks = (raw.asks ?? [])
    .slice(0, 20)
    .map(([p, q]) => [Number(p), Number(q)] as [number, number])
    .filter(([p, q]) => Number.isFinite(p) && Number.isFinite(q) && p > 0 && q >= 0);

  if (bids.length === 0 || asks.length === 0) return null;

  const bestBid = bids[0][0];
  const bestAsk = asks[0][0];
  const mid = (bestBid + bestAsk) / 2;
  const spreadBps = mid > 0 ? Number((((bestAsk - bestBid) / mid) * 10000).toFixed(2)) : 0;

  const bidVolumeTop20 = Number(bids.reduce((acc, [, q]) => acc + q, 0).toFixed(4));
  const askVolumeTop20 = Number(asks.reduce((acc, [, q]) => acc + q, 0).toFixed(4));
  const totalVol = bidVolumeTop20 + askVolumeTop20;
  const imbalanceRatio = totalVol > 0 ? Number(((bidVolumeTop20 - askVolumeTop20) / totalVol).toFixed(4)) : 0;

  return {
    lastUpdateId: Number(raw.lastUpdateId ?? 0),
    bestBid,
    bestAsk,
    spreadBps,
    bidVolumeTop20,
    askVolumeTop20,
    imbalanceRatio,
    topBids: bids.slice(0, 8),
    topAsks: asks.slice(0, 8),
  };
}

export async function fetchBinancePublicMarketSnapshot(input: {
  symbol: string;
  timeframe: CandleTimeframe;
  staleThresholdSeconds: number;
}): Promise<MarketTickerData> {
  const symbol = input.symbol.toUpperCase();
  const candidateBases = Array.from(
    new Set([
      DEFAULT_FAPI_BASE.replace(/\/$/, ''),
      'https://fapi.binance.com',
      'https://fapi1.binance.com',
      'https://fapi2.binance.com',
      ...(process.env.BINANCE_TESTNET === 'true' ? ['https://testnet.binancefuture.com'] : []),
    ]),
  );

  let lastErr: unknown = null;
  let lastSource = 'binance-fapi-public';

  for (const baseUrl of candidateBases) {
    const sourceLabel = baseUrl.includes('testnet')
      ? 'binance-testnet-fapi-public'
      : 'binance-fapi-public';
    lastSource = sourceLabel;

    try {
      const [klinesRaw, premiumRaw, tickerRaw, oiRaw, depthRaw] = await Promise.all([
        fetchJsonWithTimeout<unknown[]>(
          `${baseUrl}/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(input.timeframe)}&limit=210`,
        ),
        fetchJsonWithTimeout<{
          markPrice?: string;
          indexPrice?: string;
          lastFundingRate?: string;
          nextFundingTime?: number;
        }>(`${baseUrl}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`),
        fetchJsonWithTimeout<{
          lastPrice?: string;
          priceChangePercent?: string;
          quoteVolume?: string;
        }>(`${baseUrl}/fapi/v1/ticker/24hr?symbol=${encodeURIComponent(symbol)}`),
        fetchJsonWithTimeout<{
          openInterest?: string;
        }>(`${baseUrl}/fapi/v1/openInterest?symbol=${encodeURIComponent(symbol)}`),
        fetchJsonWithTimeout<{
          lastUpdateId?: number;
          bids?: Array<[string, string]>;
          asks?: Array<[string, string]>;
        }>(`${baseUrl}/fapi/v1/depth?symbol=${encodeURIComponent(symbol)}&limit=20`),
      ]);

      const candles = parseKlines(klinesRaw);
      if (candles.length === 0) {
        throw new Error(`Binance returned 0 valid OHLCV candles for ${symbol} ${input.timeframe}.`);
      }

      const markPrice = Number(premiumRaw.markPrice);
      const indexPrice = Number(premiumRaw.indexPrice);
      const lastPrice = Number(tickerRaw.lastPrice ?? candles[candles.length - 1].close);
      const priceChange24hPct = Number(tickerRaw.priceChangePercent ?? 0);
      const volume24hQuote = Number(tickerRaw.quoteVolume ?? 0);
      const fundingRate = Number(premiumRaw.lastFundingRate ?? 0);
      const nextFundingTime =
        typeof premiumRaw.nextFundingTime === 'number' && premiumRaw.nextFundingTime > 0
          ? new Date(premiumRaw.nextFundingTime).toISOString()
          : null;
      const openInterest = Number(oiRaw.openInterest ?? 0);
      const openInterestValueUsd =
        Number.isFinite(openInterest) && Number.isFinite(markPrice)
          ? Number((openInterest * markPrice).toFixed(2))
          : null;

      const indicators = calculateTechnicalIndicators(candles);
      const orderBook = parseOrderBook(depthRaw);
      const fetchedIso = new Date().toISOString();

      return {
        symbol,
        timeframe: input.timeframe,
        status: 'CONNECTED',
        source: sourceLabel,
        lastFetchedAt: fetchedIso,
        ageSeconds: 0,
        staleThresholdSeconds: input.staleThresholdSeconds,
        isStale: false,
        errorMessage: null,
        markPrice: Number.isFinite(markPrice) ? markPrice : null,
        indexPrice: Number.isFinite(indexPrice) ? indexPrice : null,
        lastPrice: Number.isFinite(lastPrice) ? lastPrice : null,
        priceChange24hPct: Number.isFinite(priceChange24hPct) ? priceChange24hPct : null,
        volume24hQuote: Number.isFinite(volume24hQuote) ? volume24hQuote : null,
        fundingRate: Number.isFinite(fundingRate) ? fundingRate : null,
        nextFundingTime,
        openInterest: Number.isFinite(openInterest) ? openInterest : null,
        openInterestValueUsd,
        candles,
        indicators,
        orderBook,
      };
    } catch (err) {
      lastErr = err;
    }
  }

  {
    const rawMsg = lastErr instanceof Error ? lastErr.message : String(lastErr ?? 'Binance unreachable');
    const message = rawMsg.includes('451')
      ? `${rawMsg} | Server IP geo-blocked by Binance (Vercel US default iad1). Pastikan Vercel Function Region = Singapore (sin1) di vercel.json & redeploy, atau jalankan dari PC/VPS non-US.`
      : rawMsg;
    return {
      symbol,
      timeframe: input.timeframe,
      status: 'ERROR',
      source: lastSource,
      lastFetchedAt: null,
      ageSeconds: null,
      staleThresholdSeconds: input.staleThresholdSeconds,
      isStale: true,
      errorMessage: message,
      markPrice: null,
      indexPrice: null,
      lastPrice: null,
      priceChange24hPct: null,
      volume24hQuote: null,
      fundingRate: null,
      nextFundingTime: null,
      openInterest: null,
      openInterestValueUsd: null,
      candles: [],
      indicators: calculateTechnicalIndicators([]),
      orderBook: null,
    };
  }
}
