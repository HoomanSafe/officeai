import type {
  CandleTimeframe,
  MarketEngineState,
  MarketTickerData,
} from '../../src/types/hq.ts';
import { fetchBinancePublicMarketSnapshot } from './binancePublic.ts';
import { calculateTechnicalIndicators } from './indicators.ts';

const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];

function createEmptyFeed(symbol: string, timeframe: CandleTimeframe, staleThresholdSeconds: number): MarketTickerData {
  return {
    symbol,
    timeframe,
    status: 'NOT_CONNECTED',
    source: 'binance-fapi-public',
    lastFetchedAt: null,
    ageSeconds: null,
    staleThresholdSeconds,
    isStale: true,
    errorMessage: null,
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

export class MarketDataEngine {
  private activeSymbol = 'BTCUSDT';
  private activeTimeframe: CandleTimeframe = '1h';
  private autoSyncEnabled = !process.env.VERCEL;
  private syncIntervalSeconds = 15;
  private staleThresholdSeconds = 45;
  private lastSyncAt: string | null = null;
  private watchedSymbols = [...DEFAULT_SYMBOLS];
  private feeds: Record<string, MarketTickerData> = {};
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;

  constructor(private readonly onUpdated?: (state: MarketEngineState) => void) {
    for (const sym of this.watchedSymbols) {
      this.feeds[sym] = createEmptyFeed(sym, this.activeTimeframe, this.staleThresholdSeconds);
    }
  }

  public startBackgroundSync(): void {
    if (process.env.VERCEL || this.syncTimer) return;
    // Kick off initial sync shortly after server boot
    setTimeout(() => {
      if (this.autoSyncEnabled) {
        void this.refreshSymbol(this.activeSymbol, this.activeTimeframe);
      }
    }, 800);

    this.syncTimer = setInterval(() => {
      if (this.autoSyncEnabled && !this.refreshing) {
        void this.refreshSymbol(this.activeSymbol, this.activeTimeframe);
      }
    }, this.syncIntervalSeconds * 1000);
  }

  public stopBackgroundSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private evaluateFeedFreshness(feed: MarketTickerData): MarketTickerData {
    if (!feed.lastFetchedAt) {
      return {
        ...feed,
        ageSeconds: null,
        staleThresholdSeconds: this.staleThresholdSeconds,
        isStale: true,
      };
    }
    const ageSeconds = Math.max(
      0,
      Math.round((Date.now() - new Date(feed.lastFetchedAt).getTime()) / 1000),
    );
    const isStale = ageSeconds > this.staleThresholdSeconds;
    const status =
      feed.errorMessage && feed.candles.length === 0
        ? 'ERROR'
        : isStale
          ? 'STALE'
          : 'CONNECTED';
    return {
      ...feed,
      ageSeconds,
      staleThresholdSeconds: this.staleThresholdSeconds,
      isStale,
      status,
    };
  }

  public getState(): MarketEngineState {
    const evaluatedFeeds: Record<string, MarketTickerData> = {};
    for (const sym of this.watchedSymbols) {
      const current = this.feeds[sym] ?? createEmptyFeed(sym, this.activeTimeframe, this.staleThresholdSeconds);
      evaluatedFeeds[sym] = this.evaluateFeedFreshness(current);
    }

    const activeFeed = evaluatedFeeds[this.activeSymbol];
    let streamStatus: MarketEngineState['streamStatus'] = 'NOT_CONNECTED';
    if (activeFeed?.status === 'CONNECTED') {
      streamStatus = this.autoSyncEnabled ? 'CONNECTED' : 'POLLING';
    } else if (activeFeed?.status === 'STALE' || activeFeed?.status === 'ERROR') {
      streamStatus = 'DEGRADED';
    }

    return {
      activeSymbol: this.activeSymbol,
      activeTimeframe: this.activeTimeframe,
      autoSyncEnabled: this.autoSyncEnabled,
      syncIntervalSeconds: this.syncIntervalSeconds,
      staleThresholdSeconds: this.staleThresholdSeconds,
      streamStatus,
      lastSyncAt: this.lastSyncAt,
      watchedSymbols: this.watchedSymbols,
      feeds: evaluatedFeeds,
    };
  }

  public getFreshFeed(symbol: string, timeframe?: CandleTimeframe): MarketTickerData | null {
    const upper = symbol.toUpperCase();
    const raw = this.feeds[upper];
    if (!raw) return null;
    if (timeframe && raw.timeframe !== timeframe) return null;
    return this.evaluateFeedFreshness(raw);
  }

  public async refreshSymbol(
    symbol = this.activeSymbol,
    timeframe: CandleTimeframe = this.activeTimeframe,
  ): Promise<MarketTickerData> {
    const upper = symbol.toUpperCase();
    if (!this.watchedSymbols.includes(upper)) {
      this.watchedSymbols.push(upper);
    }

    this.refreshing = true;
    try {
      const prev = this.feeds[upper];
      const next = await fetchBinancePublicMarketSnapshot({
        symbol: upper,
        timeframe,
        staleThresholdSeconds: this.staleThresholdSeconds,
      });

      if (next.status === 'CONNECTED') {
        this.feeds[upper] = next;
        this.lastSyncAt = next.lastFetchedAt;
      } else if (prev && prev.candles.length > 0) {
        // Keep previous historical candles visible ONLY while explicitly marking feed ERROR/STALE
        this.feeds[upper] = {
          ...prev,
          status: 'ERROR',
          isStale: true,
          errorMessage: next.errorMessage,
        };
      } else {
        this.feeds[upper] = next;
      }

      const snapshot = this.getState();
      this.onUpdated?.(snapshot);
      return snapshot.feeds[upper];
    } finally {
      this.refreshing = false;
    }
  }

  public async updateConfig(patch: {
    activeSymbol?: string;
    activeTimeframe?: CandleTimeframe;
    autoSyncEnabled?: boolean;
    staleThresholdSeconds?: number;
  }): Promise<MarketEngineState> {
    let shouldRefresh = false;

    if (patch.activeSymbol && patch.activeSymbol.trim()) {
      const nextSym = patch.activeSymbol.trim().toUpperCase();
      if (!this.watchedSymbols.includes(nextSym)) {
        this.watchedSymbols.push(nextSym);
        this.feeds[nextSym] = createEmptyFeed(nextSym, this.activeTimeframe, this.staleThresholdSeconds);
      }
      if (this.activeSymbol !== nextSym) {
        this.activeSymbol = nextSym;
        shouldRefresh = true;
      }
    }

    if (
      patch.activeTimeframe &&
      ['5m', '15m', '1h', '4h', '1d'].includes(patch.activeTimeframe) &&
      this.activeTimeframe !== patch.activeTimeframe
    ) {
      this.activeTimeframe = patch.activeTimeframe;
      shouldRefresh = true;
    }

    if (typeof patch.autoSyncEnabled === 'boolean') {
      this.autoSyncEnabled = patch.autoSyncEnabled;
    }

    if (typeof patch.staleThresholdSeconds === 'number') {
      this.staleThresholdSeconds = Math.min(300, Math.max(10, Math.round(patch.staleThresholdSeconds)));
    }

    const activeFeed = this.getFreshFeed(this.activeSymbol, this.activeTimeframe);
    if (shouldRefresh || !activeFeed || activeFeed.isStale) {
      await this.refreshSymbol(this.activeSymbol, this.activeTimeframe);
    } else {
      this.onUpdated?.(this.getState());
    }

    return this.getState();
  }
}
