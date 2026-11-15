import type { MarketRegime, OhlcvCandle, TechnicalIndicators } from '../../src/types/hq.ts';

export function computeEmaSeries(values: number[], period: number): Array<number | null> {
  if (values.length < period) {
    return values.map(() => null);
  }
  const result: Array<number | null> = new Array(values.length).fill(null);
  const k = 2 / (period + 1);

  let sma = 0;
  for (let i = 0; i < period; i++) {
    sma += values[i];
  }
  let ema = sma / period;
  result[period - 1] = ema;

  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

export function computeRsi14(closes: number[], period = 14): number | null {
  if (closes.length <= period) return null;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}

export function computeMacd(closes: number[]): { line: number; signal: number; histogram: number } | null {
  if (closes.length < 35) return null;
  const ema12 = computeEmaSeries(closes, 12);
  const ema26 = computeEmaSeries(closes, 26);

  const macdValues: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const fast = ema12[i];
    const slow = ema26[i];
    if (fast !== null && slow !== null) {
      macdValues.push(fast - slow);
    }
  }
  if (macdValues.length < 9) return null;
  const signalSeries = computeEmaSeries(macdValues, 9);
  const lastLine = macdValues[macdValues.length - 1];
  const lastSignal = signalSeries[signalSeries.length - 1];
  if (lastSignal === null) return null;

  return {
    line: Number(lastLine.toFixed(4)),
    signal: Number(lastSignal.toFixed(4)),
    histogram: Number((lastLine - lastSignal).toFixed(4)),
  };
}

export function computeAtr14(candles: OhlcvCandle[], period = 14): number | null {
  if (candles.length <= period) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prevClose),
      Math.abs(cur.low - prevClose),
    );
    trs.push(tr);
  }
  if (trs.length < period) return null;
  let atr = trs.slice(0, period).reduce((acc, v) => acc + v, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return Number(atr.toFixed(4));
}

export function computeVwap(candles: OhlcvCandle[], windowSize = 48): number | null {
  if (candles.length === 0) return null;
  const slice = candles.slice(-windowSize);
  let pvSum = 0;
  let volSum = 0;
  for (const c of slice) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    pvSum += typicalPrice * c.volume;
    volSum += c.volume;
  }
  if (volSum <= 0) return null;
  return Number((pvSum / volSum).toFixed(4));
}

export function classifyMarketRegime(input: {
  lastClose: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  atrPct: number | null;
  rsi14: number | null;
}): MarketRegime {
  const { lastClose, ema20, ema50, ema200, atrPct, rsi14 } = input;
  if (lastClose === null || ema20 === null || ema50 === null) {
    return 'UNKNOWN';
  }
  if (atrPct !== null && atrPct >= 2.2) {
    return 'HIGH_VOLATILITY';
  }
  const spread20_50 = Math.abs(ema20 - ema50) / ema50;
  if (ema20 > ema50 && lastClose > ema20 && (ema200 === null || ema50 >= ema200 * 0.995) && (rsi14 === null || rsi14 >= 50)) {
    return spread20_50 > 0.0025 ? 'TRENDING_UP' : 'RANGING';
  }
  if (ema20 < ema50 && lastClose < ema20 && (ema200 === null || ema50 <= ema200 * 1.005) && (rsi14 === null || rsi14 <= 50)) {
    return spread20_50 > 0.0025 ? 'TRENDING_DOWN' : 'RANGING';
  }
  return 'RANGING';
}

export function calculateTechnicalIndicators(candles: OhlcvCandle[]): TechnicalIndicators {
  if (candles.length === 0) {
    return {
      ema20: null,
      ema50: null,
      ema200: null,
      rsi14: null,
      macd: null,
      atr14: null,
      atrPct: null,
      vwap: null,
      regime: 'UNKNOWN',
    };
  }

  const closes = candles.map((c) => c.close);
  const ema20Series = computeEmaSeries(closes, 20);
  const ema50Series = computeEmaSeries(closes, 50);
  const ema200Series = computeEmaSeries(closes, 200);

  const ema20Raw = ema20Series[ema20Series.length - 1];
  const ema50Raw = ema50Series[ema50Series.length - 1];
  const ema200Raw = ema200Series[ema200Series.length - 1];

  const ema20 = ema20Raw !== null ? Number(ema20Raw.toFixed(4)) : null;
  const ema50 = ema50Raw !== null ? Number(ema50Raw.toFixed(4)) : null;
  const ema200 = ema200Raw !== null ? Number(ema200Raw.toFixed(4)) : null;
  const rsi14 = computeRsi14(closes, 14);
  const macd = computeMacd(closes);
  const atr14 = computeAtr14(candles, 14);
  const lastClose = closes[closes.length - 1] ?? null;
  const atrPct =
    atr14 !== null && lastClose !== null && lastClose > 0
      ? Number(((atr14 / lastClose) * 100).toFixed(3))
      : null;
  const vwap = computeVwap(candles, 48);

  const regime = classifyMarketRegime({
    lastClose,
    ema20,
    ema50,
    ema200,
    atrPct,
    rsi14,
  });

  return {
    ema20,
    ema50,
    ema200,
    rsi14,
    macd,
    atr14,
    atrPct,
    vwap,
    regime,
  };
}
