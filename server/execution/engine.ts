import type {
  AccountSummary,
  ExecutionEngineState,
  ExecutionVenue,
  MarketEngineState,
  OrderRecord,
  PositionRecord,
  PositionSide,
  RiskConfig,
  TradingMode,
} from '../../src/types/hq.ts';
import {
  closeTestnetPositionOnExchange,
  fetchTestnetAccountOverview,
  fetchTestnetSymbolFilter,
  hasBinanceTestnetCredentials,
  placeTestnetEntryAndVerifyProtection,
} from './binanceTestnet.ts';
import { computeDeterministicPositionSize, roundToTick } from './riskMath.ts';

const PAPER_STARTING_EQUITY = 10000;
const PAPER_TAKER_FEE_RATE = 0.0005; // 5 bps
const PAPER_SLIPPAGE_BPS = 2;

export class ExecutionEngine {
  private paperBalanceUsd = PAPER_STARTING_EQUITY;
  private paperRealizedPnlUsd = 0;
  private paperStartingEquityUsd = PAPER_STARTING_EQUITY;
  private testnetAccount: AccountSummary = {
    venue: 'BINANCE_TESTNET',
    connected: false,
    equityUsd: 0,
    availableBalanceUsd: 0,
    realizedPnlUsd: 0,
    unrealizedPnlUsd: 0,
    dailyPnlPct: 0,
    dailyLossLimitBreached: false,
    openPositionsCount: 0,
    lastSyncedAt: null,
    errorMessage: hasBinanceTestnetCredentials()
      ? 'Credentials present; click Reconcile to sync Binance Testnet wallet.'
      : 'BINANCE_API_KEY / BINANCE_API_SECRET not set in server .env.',
  };
  private positions: PositionRecord[] = [];
  private orders: OrderRecord[] = [];
  private lastReconciledAt: string | null = null;

  constructor(
    private readonly onUpdated?: (state: ExecutionEngineState) => void,
    private readonly onTriggerKillSwitch?: (reason: string) => void,
  ) {}

  private buildPaperAccount(riskConfig: RiskConfig): AccountSummary {
    const openPaper = this.positions.filter(
      (p) => p.venue === 'PAPER_SIMULATOR' && p.status === 'OPEN',
    );
    const unrealized = Number(
      openPaper.reduce((acc, p) => acc + p.unrealizedPnlUsd, 0).toFixed(2),
    );
    const usedMargin = Number(
      openPaper.reduce((acc, p) => acc + p.initialMarginUsd, 0).toFixed(2),
    );
    const equity = Number((this.paperBalanceUsd + unrealized).toFixed(2));
    const available = Math.max(0, Number((equity - usedMargin).toFixed(2)));
    const dailyPnlPct = Number(
      (((equity - this.paperStartingEquityUsd) / this.paperStartingEquityUsd) * 100).toFixed(2),
    );

    return {
      venue: 'PAPER_SIMULATOR',
      connected: true,
      equityUsd: equity,
      availableBalanceUsd: available,
      realizedPnlUsd: Number(this.paperRealizedPnlUsd.toFixed(2)),
      unrealizedPnlUsd: unrealized,
      dailyPnlPct,
      dailyLossLimitBreached: dailyPnlPct <= -riskConfig.maxDailyLossPct,
      openPositionsCount: openPaper.length,
      lastSyncedAt: new Date().toISOString(),
      errorMessage: null,
    };
  }

  public getState(mode: TradingMode, riskConfig: RiskConfig): ExecutionEngineState {
    const activeVenue: ExecutionVenue =
      mode === 'TESTNET' ? 'BINANCE_TESTNET' : 'PAPER_SIMULATOR';
    return {
      activeVenue,
      paperAccount: this.buildPaperAccount(riskConfig),
      testnetAccount: this.testnetAccount,
      positions: this.positions.slice(0, 60),
      orders: this.orders.slice(0, 100),
      lastReconciledAt: this.lastReconciledAt,
    };
  }

  public resetPaperAccount(mode: TradingMode, riskConfig: RiskConfig): ExecutionEngineState {
    this.positions = this.positions.filter((p) => p.venue !== 'PAPER_SIMULATOR');
    this.orders = this.orders.filter((o) => o.venue !== 'PAPER_SIMULATOR');
    this.paperBalanceUsd = PAPER_STARTING_EQUITY;
    this.paperRealizedPnlUsd = 0;
    this.paperStartingEquityUsd = PAPER_STARTING_EQUITY;
    const state = this.getState(mode, riskConfig);
    this.onUpdated?.(state);
    return state;
  }

  public async reconcile(mode: TradingMode, riskConfig: RiskConfig): Promise<ExecutionEngineState> {
    this.lastReconciledAt = new Date().toISOString();
    if (hasBinanceTestnetCredentials()) {
      try {
        const overview = await fetchTestnetAccountOverview();
        this.testnetAccount = {
          venue: 'BINANCE_TESTNET',
          connected: true,
          equityUsd: Number(overview.equityUsd.toFixed(2)),
          availableBalanceUsd: Number(overview.availableBalanceUsd.toFixed(2)),
          realizedPnlUsd: 0,
          unrealizedPnlUsd: Number(overview.unrealizedPnlUsd.toFixed(2)),
          dailyPnlPct: 0,
          dailyLossLimitBreached: false,
          openPositionsCount: overview.openExchangePositions.length,
          lastSyncedAt: this.lastReconciledAt,
          errorMessage: null,
        };
      } catch (err) {
        this.testnetAccount = {
          ...this.testnetAccount,
          connected: false,
          lastSyncedAt: this.lastReconciledAt,
          errorMessage: err instanceof Error ? err.message : String(err),
        };
      }
    } else {
      this.testnetAccount = {
        ...this.testnetAccount,
        connected: false,
        lastSyncedAt: this.lastReconciledAt,
        errorMessage: 'BINANCE_API_KEY / BINANCE_API_SECRET not set in server .env.',
      };
    }

    const state = this.getState(mode, riskConfig);
    this.onUpdated?.(state);
    return state;
  }

  public onMarketTick(marketData: MarketEngineState, mode: TradingMode, riskConfig: RiskConfig): void {
    let changed = false;

    for (const pos of this.positions) {
      if (pos.status !== 'OPEN' || pos.venue !== 'PAPER_SIMULATOR') continue;
      const feed = marketData.feeds[pos.symbol];
      if (!feed || feed.markPrice === null) continue;

      const mark = feed.markPrice;
      pos.markPrice = mark;
      const dir = pos.side === 'LONG' ? 1 : -1;
      pos.unrealizedPnlUsd = Number(((mark - pos.entryPrice) * pos.quantity * dir).toFixed(2));
      changed = true;

      // Check protective Stop Loss / Take Profit trigger against live mark price
      const hitSl = pos.side === 'LONG' ? mark <= pos.stopLossPrice : mark >= pos.stopLossPrice;
      const hitTp = pos.side === 'LONG' ? mark >= pos.takeProfitPrice : mark <= pos.takeProfitPrice;

      if (hitSl || hitTp) {
        const exitPrice = hitSl ? pos.stopLossPrice : pos.takeProfitPrice;
        this.finalizePaperClose(pos, exitPrice, hitSl ? 'STOP_LOSS_TRIGGERED' : 'TAKE_PROFIT_TRIGGERED');
      }
    }

    if (changed) {
      this.onUpdated?.(this.getState(mode, riskConfig));
    }
  }

  private finalizePaperClose(pos: PositionRecord, exitPrice: number, reason: string): void {
    const dir = pos.side === 'LONG' ? 1 : -1;
    const grossPnl = (exitPrice - pos.entryPrice) * pos.quantity * dir;
    const exitFee = Number((exitPrice * pos.quantity * PAPER_TAKER_FEE_RATE).toFixed(4));
    const netPnl = Number((grossPnl - exitFee).toFixed(2));

    pos.markPrice = exitPrice;
    pos.unrealizedPnlUsd = 0;
    pos.realizedPnlUsd = netPnl;
    pos.feesPaidUsd = Number((pos.feesPaidUsd + exitFee).toFixed(4));
    pos.status = 'CLOSED';
    pos.closedAt = new Date().toISOString();
    pos.closeReason = reason;

    this.paperBalanceUsd = Number((this.paperBalanceUsd + netPnl).toFixed(2));
    this.paperRealizedPnlUsd = Number((this.paperRealizedPnlUsd + netPnl).toFixed(2));

    this.orders.unshift({
      id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      clientOrderId: `${pos.id}-CLOSE`,
      exchangeOrderId: `PAPER-${Date.now()}`,
      venue: 'PAPER_SIMULATOR',
      symbol: pos.symbol,
      side: pos.side === 'LONG' ? 'SELL' : 'BUY',
      type: reason === 'STOP_LOSS_TRIGGERED' ? 'STOP_MARKET' : reason === 'TAKE_PROFIT_TRIGGERED' ? 'TAKE_PROFIT_MARKET' : 'MARKET',
      reduceOnly: true,
      quantity: pos.quantity,
      requestedPrice: exitPrice,
      fillPrice: exitPrice,
      stopPrice: null,
      feeUsd: exitFee,
      slippageBps: 0,
      status: 'FILLED',
      createdAt: pos.closedAt,
    });
  }

  public async executeValidatedOrder(input: {
    mode: TradingMode;
    riskConfig: RiskConfig;
    marketData: MarketEngineState;
    symbol: string;
    side: PositionSide;
    entryPrice?: number;
    stopLossPrice: number;
    takeProfitPrice: number;
    debateSessionId?: string | null;
  }): Promise<{ ok: boolean; error?: string; position?: PositionRecord }> {
    const symbol = input.symbol.toUpperCase();
    const feed = input.marketData.feeds[symbol];
    const dataIsFresh = Boolean(feed && feed.status === 'CONNECTED' && !feed.isStale && feed.markPrice !== null);

    const venue: ExecutionVenue =
      input.mode === 'TESTNET' ? 'BINANCE_TESTNET' : 'PAPER_SIMULATOR';

    if (venue === 'BINANCE_TESTNET' && !hasBinanceTestnetCredentials()) {
      return {
        ok: false,
        error:
          'TESTNET mode selected, but BINANCE_API_KEY / BINANCE_API_SECRET are not configured in server .env.',
      };
    }

    // Sync testnet balance right before sizing if using Binance Testnet
    if (venue === 'BINANCE_TESTNET') {
      await this.reconcile(input.mode, input.riskConfig);
      if (!this.testnetAccount.connected) {
        return {
          ok: false,
          error: this.testnetAccount.errorMessage ?? 'Unable to connect to Binance Testnet.',
        };
      }
    }

    const activeAccount =
      venue === 'BINANCE_TESTNET' ? this.testnetAccount : this.buildPaperAccount(input.riskConfig);
    const openPositions = this.positions.filter((p) => p.venue === venue && p.status === 'OPEN');
    const hasDuplicateSymbolOpen = openPositions.some((p) => p.symbol === symbol);

    const filter =
      venue === 'BINANCE_TESTNET' ? await fetchTestnetSymbolFilter(symbol) : undefined;

    const requestedEntry = input.entryPrice && input.entryPrice > 0 ? input.entryPrice : (feed?.markPrice ?? 0);

    const sizing = computeDeterministicPositionSize({
      mode: input.mode,
      symbol,
      side: input.side,
      entryPrice: requestedEntry,
      stopLossPrice: input.stopLossPrice,
      takeProfitPrice: input.takeProfitPrice,
      equityUsd: activeAccount.equityUsd,
      availableBalanceUsd: activeAccount.availableBalanceUsd,
      dailyPnlPct: activeAccount.dailyPnlPct,
      openPositionsCount: activeAccount.openPositionsCount,
      hasDuplicateSymbolOpen,
      dataIsFresh,
      riskConfig: input.riskConfig,
      filter,
    });

    if (!sizing.approved) {
      return { ok: false, error: sizing.rejectReasons.join(' ') };
    }

    const baseId = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    if (venue === 'PAPER_SIMULATOR') {
      const slipFactor =
        input.side === 'LONG' ? 1 + PAPER_SLIPPAGE_BPS / 10000 : 1 - PAPER_SLIPPAGE_BPS / 10000;
      const fillPrice = roundToTick(sizing.roundedEntry * slipFactor, filter?.tickSize ?? 0.1);
      const entryFee = Number((fillPrice * sizing.quantity * PAPER_TAKER_FEE_RATE).toFixed(4));
      this.paperBalanceUsd = Number((this.paperBalanceUsd - entryFee).toFixed(2));

      const slId = `PAPER-SL-${Date.now()}`;
      const tpId = `PAPER-TP-${Date.now()}`;

      const position: PositionRecord = {
        id: baseId,
        debateSessionId: input.debateSessionId ?? null,
        venue: 'PAPER_SIMULATOR',
        mode: input.mode,
        marginMode: input.riskConfig.marginMode,
        symbol,
        side: input.side,
        quantity: sizing.quantity,
        entryPrice: fillPrice,
        markPrice: feed?.markPrice ?? fillPrice,
        stopLossPrice: sizing.roundedSl,
        takeProfitPrice: sizing.roundedTp,
        slOrderId: slId,
        tpOrderId: tpId,
        slTpVerified: 'VERIFIED',
        slVerificationNote: 'PAPER simulator SL & TP brackets verified on live price feed.',
        leverage: input.riskConfig.maxLeverage,
        notionalUsd: sizing.notionalUsd,
        initialMarginUsd: sizing.initialMarginUsd,
        riskAmountUsd: sizing.riskAmountUsd,
        riskPctOfEquity: sizing.riskPctOfEquity,
        unrealizedPnlUsd: 0,
        realizedPnlUsd: null,
        feesPaidUsd: entryFee,
        status: 'OPEN',
        openedAt: now,
        closedAt: null,
        closeReason: null,
      };

      this.positions.unshift(position);
      this.orders.unshift(
        {
          id: `ord-${Date.now()}-tp`,
          clientOrderId: `${baseId}-TP`,
          exchangeOrderId: tpId,
          venue: 'PAPER_SIMULATOR',
          symbol,
          side: input.side === 'LONG' ? 'SELL' : 'BUY',
          type: 'TAKE_PROFIT_MARKET',
          reduceOnly: true,
          quantity: sizing.quantity,
          requestedPrice: sizing.roundedTp,
          fillPrice: null,
          stopPrice: sizing.roundedTp,
          feeUsd: 0,
          slippageBps: 0,
          status: 'NEW',
          createdAt: now,
        },
        {
          id: `ord-${Date.now()}-sl`,
          clientOrderId: `${baseId}-SL`,
          exchangeOrderId: slId,
          venue: 'PAPER_SIMULATOR',
          symbol,
          side: input.side === 'LONG' ? 'SELL' : 'BUY',
          type: 'STOP_MARKET',
          reduceOnly: true,
          quantity: sizing.quantity,
          requestedPrice: sizing.roundedSl,
          fillPrice: null,
          stopPrice: sizing.roundedSl,
          feeUsd: 0,
          slippageBps: 0,
          status: 'NEW',
          createdAt: now,
        },
        {
          id: `ord-${Date.now()}-en`,
          clientOrderId: `${baseId}-EN`,
          exchangeOrderId: `PAPER-EN-${Date.now()}`,
          venue: 'PAPER_SIMULATOR',
          symbol,
          side: input.side === 'LONG' ? 'BUY' : 'SELL',
          type: 'MARKET',
          reduceOnly: false,
          quantity: sizing.quantity,
          requestedPrice: sizing.roundedEntry,
          fillPrice,
          stopPrice: null,
          feeUsd: entryFee,
          slippageBps: PAPER_SLIPPAGE_BPS,
          status: 'FILLED',
          createdAt: now,
        },
      );

      this.onUpdated?.(this.getState(input.mode, input.riskConfig));
      return { ok: true, position };
    }

    // REAL BINANCE TESTNET EXECUTION + MANDATORY POST-ORDER SL/TP VERIFICATION
    const res = await placeTestnetEntryAndVerifyProtection({
      symbol,
      side: input.side,
      quantity: sizing.quantity,
      stopLossPrice: sizing.roundedSl,
      takeProfitPrice: sizing.roundedTp,
      marginMode: input.riskConfig.marginMode,
      leverage: input.riskConfig.maxLeverage,
      baseClientId: baseId.slice(0, 22),
    });

    const fill = res.avgFillPrice > 0 ? res.avgFillPrice : sizing.roundedEntry;
    const position: PositionRecord = {
      id: baseId,
      debateSessionId: input.debateSessionId ?? null,
      venue: 'BINANCE_TESTNET',
      mode: input.mode,
      marginMode: input.riskConfig.marginMode,
      symbol,
      side: input.side,
      quantity: sizing.quantity,
      entryPrice: fill,
      markPrice: feed?.markPrice ?? fill,
      stopLossPrice: sizing.roundedSl,
      takeProfitPrice: sizing.roundedTp,
      slOrderId: res.slOrderId,
      tpOrderId: res.tpOrderId,
      slTpVerified: res.slVerified ? 'VERIFIED' : 'FAILED',
      slVerificationNote: res.verificationNote,
      leverage: input.riskConfig.maxLeverage,
      notionalUsd: sizing.notionalUsd,
      initialMarginUsd: sizing.initialMarginUsd,
      riskAmountUsd: sizing.riskAmountUsd,
      riskPctOfEquity: sizing.riskPctOfEquity,
      unrealizedPnlUsd: 0,
      realizedPnlUsd: res.slVerified ? null : 0,
      feesPaidUsd: 0,
      status: res.slVerified ? 'OPEN' : 'PROTECTION_FAILED',
      openedAt: now,
      closedAt: res.slVerified ? null : now,
      closeReason: res.slVerified ? null : 'EMERGENCY_FLATTEN_SL_VERIFICATION_FAILED',
    };

    this.positions.unshift(position);
    this.orders.unshift({
      id: `ord-${Date.now()}-tn`,
      clientOrderId: `${baseId.slice(0, 22)}-EN`,
      exchangeOrderId: res.entryOrderId,
      venue: 'BINANCE_TESTNET',
      symbol,
      side: input.side === 'LONG' ? 'BUY' : 'SELL',
      type: 'MARKET',
      reduceOnly: false,
      quantity: sizing.quantity,
      requestedPrice: sizing.roundedEntry,
      fillPrice: fill,
      stopPrice: null,
      feeUsd: 0,
      slippageBps: 0,
      status: 'FILLED',
      createdAt: now,
    });

    if (!res.slVerified) {
      this.onTriggerKillSwitch?.(res.verificationNote);
      this.onUpdated?.(this.getState(input.mode, input.riskConfig));
      return { ok: false, error: res.verificationNote, position };
    }

    await this.reconcile(input.mode, input.riskConfig);
    return { ok: true, position };
  }

  public async closePosition(input: {
    positionId: string;
    mode: TradingMode;
    riskConfig: RiskConfig;
    marketData: MarketEngineState;
  }): Promise<{ ok: boolean; error?: string; position?: PositionRecord }> {
    const pos = this.positions.find((p) => p.id === input.positionId);
    if (!pos) return { ok: false, error: 'Position not found.' };
    if (pos.status !== 'OPEN') return { ok: false, error: 'Position is already closed.' };

    const feed = input.marketData.feeds[pos.symbol];
    const currentPrice = feed?.markPrice ?? pos.markPrice ?? pos.entryPrice;

    if (pos.venue === 'PAPER_SIMULATOR') {
      this.finalizePaperClose(pos, currentPrice, 'MANUAL_CLOSE');
      this.onUpdated?.(this.getState(input.mode, input.riskConfig));
      return { ok: true, position: pos };
    }

    try {
      const res = await closeTestnetPositionOnExchange({
        symbol: pos.symbol,
        side: pos.side,
        quantity: pos.quantity,
        clientId: pos.id.slice(0, 22),
      });
      const fill = res.avgFillPrice > 0 ? res.avgFillPrice : currentPrice;
      const dir = pos.side === 'LONG' ? 1 : -1;
      pos.markPrice = fill;
      pos.unrealizedPnlUsd = 0;
      pos.realizedPnlUsd = Number(((fill - pos.entryPrice) * pos.quantity * dir).toFixed(2));
      pos.status = 'CLOSED';
      pos.closedAt = new Date().toISOString();
      pos.closeReason = `TESTNET_MANUAL_CLOSE (#${res.closeOrderId})`;
      await this.reconcile(input.mode, input.riskConfig);
      return { ok: true, position: pos };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
