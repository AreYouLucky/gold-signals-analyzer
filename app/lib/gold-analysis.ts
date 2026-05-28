export type SignalBias = "bullish" | "bearish" | "neutral";
export type Trend = SignalBias;

export type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type PatternResult = {
  name: string;
  bias: SignalBias;
  score: number;
  reason: string;
};

export type MarketStructure = {
  label: "uptrend" | "downtrend" | "range";
  reason: string;
  score: number;
};

export type PriceZone = {
  bottom: number;
  label: string;
  top: number;
};

export type ConfluenceFactor = {
  bias: SignalBias;
  label: string;
  score: number;
};

export type MovingAverageSignal = {
  alignment: Trend;
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  label: string;
  preferredEntry: number | null;
  score: number;
};

export type MovingAverageOverlay = {
  ema9: Array<number | null>;
  ema21: Array<number | null>;
  ema50: Array<number | null>;
};

export type FibonacciRetracement = {
  direction: Trend;
  level382: number | null;
  level500: number | null;
  level618: number | null;
  swingHigh: number | null;
  swingLow: number | null;
  label: string;
  score: number;
};

export type EntryLevels = {
  aggressive: number | null;
  safe: number | null;
};

export type TradeBracket = {
  entry: number | null;
  riskAmount: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
};

export type AnalysisResult = {
  confirmation: ConfluenceFactor;
  confluence: ConfluenceFactor[];
  confluenceSummary: string;
  fibonacci: FibonacciRetracement;
  entryLevels: EntryLevels;
  last: Candle;
  ma8: number | null;
  ma20: number | null;
  movingAverageSignal: MovingAverageSignal;
  marketStructure: MarketStructure;
  support: number;
  supportZone: PriceZone;
  resistance: number;
  resistanceZone: PriceZone;
  trend: Trend;
  pattern: PatternResult;
  nearSupport: boolean;
  nearResistance: boolean;
  score: number;
  direction: string;
};

export type PredictionResult = {
  confidenceLabel: "high" | "medium" | "low";
  projectedCandles: Candle[];
  summary: string;
};

export type TradeSuggestion = {
  action: "buy" | "sell" | "wait";
  aggressiveEntry: number | null;
  aggressivePlan: TradeBracket;
  entry: number;
  flexiblePlan: TradeBracket;
  stopLoss: number | null;
  safeEntry: number | null;
  safePlan: TradeBracket;
  takeProfit: number | null;
  targetProfit: number;
  riskAmount: number | null;
  summary: string;
};

function parseTimestamp(value: string): Date | null {
  const normalizedValue = value.includes("T") ? value : value.replace(" ", "T");
  const parsedDate = new Date(normalizedValue);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function parseIntervalToMinutes(interval: string): number | null {
  const match = interval.trim().toLowerCase().match(/^(\d+)\s*(min|minute|minutes|h|hour|hours|day|days|week|weeks|month|months)$/);

  if (match === null) {
    return null;
  }

  const value = Number(match[1]);
  const unit = match[2];

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (unit.startsWith("min")) {
    return value;
  }

  if (unit.startsWith("h")) {
    return value * 60;
  }

  if (unit.startsWith("day")) {
    return value * 60 * 24;
  }

  if (unit.startsWith("week")) {
    return value * 60 * 24 * 7;
  }

  if (unit.startsWith("month")) {
    return value * 60 * 24 * 30;
  }

  return null;
}

function inferIntervalMinutes(candles: Candle[]): number | null {
  if (candles.length < 2) {
    return null;
  }

  const intervals = candles
    .slice(-6)
    .map((candle) => parseTimestamp(candle.time))
    .filter((date): date is Date => date !== null)
    .map((date) => date.getTime());

  if (intervals.length < 2) {
    return null;
  }

  const deltas = intervals
    .slice(1)
    .map((value, index) => Math.round((value - intervals[index]) / 60000))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (deltas.length === 0) {
    return null;
  }

  const total = deltas.reduce((sum, value) => sum + value, 0);

  return Math.round(total / deltas.length);
}

function getCandleIntervalMinutes(candles: Candle[], interval?: string): number | null {
  return interval ? parseIntervalToMinutes(interval) ?? inferIntervalMinutes(candles) : inferIntervalMinutes(candles);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getDynamicTargetProfit(candles: Candle[], interval?: string): number {
  const averageRange = Math.max(getAverageRange(candles), 0.1);
  const intervalMinutes = getCandleIntervalMinutes(candles, interval);

  if (intervalMinutes !== null && intervalMinutes <= 5) {
    return clamp(averageRange * 1.8, 4, 12);
  }

  if (intervalMinutes !== null && intervalMinutes <= 15) {
    return clamp(averageRange * 2.1, 6, 18);
  }

  if (intervalMinutes !== null && intervalMinutes <= 60) {
    return clamp(averageRange * 2.4, 10, 24);
  }

  return clamp(averageRange * 3, 14, 30);
}

function isIntradayInterval(intervalMinutes: number | null): boolean {
  return intervalMinutes !== null && intervalMinutes <= 15;
}

function getTradeGuardReason(
  analysis: AnalysisResult,
  intervalMinutes: number | null,
): string | null {
  if (!isIntradayInterval(intervalMinutes)) {
    return null;
  }

  if (analysis.marketStructure.label === "range") {
    return "5-minute filter blocked the trade because market structure is still ranging.";
  }

  if (analysis.score > 0) {
    if (analysis.score < 5) {
      return "5-minute filter blocked the buy because the bullish score is not strong enough yet.";
    }

    if (analysis.confirmation.score <= 0) {
      return "5-minute filter blocked the buy because the confirmation candle is not strong enough.";
    }

    if (analysis.trend !== "bullish" || analysis.pattern.bias !== "bullish" || !analysis.nearSupport) {
      return "5-minute filter blocked the buy because trend, pattern, and demand-zone location are not fully aligned.";
    }
  }

  if (analysis.score < 0) {
    if (analysis.score > -5) {
      return "5-minute filter blocked the sell because the bearish score is not strong enough yet.";
    }

    if (analysis.confirmation.score >= 0) {
      return "5-minute filter blocked the sell because the confirmation candle is not strong enough.";
    }

    if (analysis.trend !== "bearish" || analysis.pattern.bias !== "bearish" || !analysis.nearResistance) {
      return "5-minute filter blocked the sell because trend, pattern, and supply-zone location are not fully aligned.";
    }
  }

  return null;
}

function formatShiftedTimestamp(date: Date, template: string): string {
  if (!template.includes(":")) {
    return date.toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function parseCsv(text: string): Candle[] {
  return text
    .trim()
    .split(/\n+/)
    .slice(1)
    .map((row) => {
      const [time, open, high, low, close] = row.split(",").map((value) => value.trim());

      return {
        time,
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
      };
    })
    .filter((candle) =>
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close),
    );
}

export function candlesToCsv(candles: Candle[]): string {
  const rows = candles.map((candle) =>
    [
      candle.time,
      candle.open.toFixed(2),
      candle.high.toFixed(2),
      candle.low.toFixed(2),
      candle.close.toFixed(2),
    ].join(","),
  );

  return ["time,open,high,low,close", ...rows].join("\n");
}

function calculateSma(candles: Candle[], period = 8): number | null {
  if (candles.length < period) {
    return null;
  }

  const recentCandles = candles.slice(-period);
  const total = recentCandles.reduce((sum, candle) => sum + candle.close, 0);

  return total / period;
}

function calculateEmaSeries(candles: Candle[], period: number): Array<number | null> {
  if (period <= 0) {
    return candles.map(() => null);
  }

  const multiplier = 2 / (period + 1);
  const emaValues: Array<number | null> = [];
  let rollingSum = 0;
  let previousEma: number | null = null;

  candles.forEach((candle, index) => {
    rollingSum += candle.close;

    if (index < period - 1) {
      emaValues.push(null);
      return;
    }

    if (previousEma === null) {
      previousEma = rollingSum / period;
      emaValues.push(previousEma);
      return;
    }

    previousEma = (candle.close - previousEma) * multiplier + previousEma;
    emaValues.push(previousEma);
  });

  return emaValues;
}

function getLatestDefinedValue(values: Array<number | null>): number | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function averageDefinedValues(values: Array<number | null>): number | null {
  const definedValues = values.filter((value): value is number => value !== null);

  if (definedValues.length === 0) {
    return null;
  }

  return definedValues.reduce((sum, value) => sum + value, 0) / definedValues.length;
}

export function getMovingAverageOverlay(candles: Candle[]): MovingAverageOverlay {
  return {
    ema9: calculateEmaSeries(candles, 9),
    ema21: calculateEmaSeries(candles, 21),
    ema50: calculateEmaSeries(candles, 50),
  };
}

function getAverageRange(candles: Candle[]): number {
  const recentCandles = candles.slice(-8);
  const totalRange = recentCandles.reduce(
    (sum, candle) => sum + Math.abs(candle.high - candle.low),
    0,
  );

  return recentCandles.length > 0 ? totalRange / recentCandles.length : 0;
}

function getAverageBody(candles: Candle[]): number {
  const recentCandles = candles.slice(-8);
  const totalBody = recentCandles.reduce(
    (sum, candle) => sum + Math.abs(candle.close - candle.open),
    0,
  );

  return recentCandles.length > 0 ? totalBody / recentCandles.length : 0;
}

function getCandleStats(candle: Candle): {
  body: number;
  range: number;
  upper: number;
  lower: number;
  bullish: boolean;
  bearish: boolean;
} {
  const body = Math.abs(candle.close - candle.open);
  const range = Math.max(candle.high - candle.low, 0.0001);
  const upper = candle.high - Math.max(candle.open, candle.close);
  const lower = Math.min(candle.open, candle.close) - candle.low;

  return {
    body,
    range,
    upper,
    lower,
    bullish: candle.close > candle.open,
    bearish: candle.close < candle.open,
  };
}

function detectPattern(candles: Candle[]): PatternResult {
  if (candles.length < 3) {
    return {
      name: "Need more candles",
      bias: "neutral",
      score: 0,
      reason: "Add at least 3 candles.",
    };
  }

  const first = candles[candles.length - 3];
  const previous = candles[candles.length - 2];
  const last = candles[candles.length - 1];
  const previousStats = getCandleStats(previous);
  const lastStats = getCandleStats(last);
  const firstStats = getCandleStats(first);
  const averageRange = Math.max(getAverageRange(candles), 0.0001);
  const tweezerTolerance = Math.max(averageRange * 0.12, last.close * 0.00035);

  const isBullishEngulfing =
    lastStats.bullish &&
    previousStats.bearish &&
    last.open <= previous.close &&
    last.close >= previous.open;

  const isBearishEngulfing =
    lastStats.bearish &&
    previousStats.bullish &&
    last.open >= previous.close &&
    last.close <= previous.open;

  const isBullishPin =
    lastStats.lower >= lastStats.body * 2 &&
    lastStats.upper <= lastStats.body * 1.2 &&
    lastStats.body / lastStats.range <= 0.4;

  const isBearishPin =
    lastStats.upper >= lastStats.body * 2 &&
    lastStats.lower <= lastStats.body * 1.2 &&
    lastStats.body / lastStats.range <= 0.4;

  const isInsideBar = last.high < previous.high && last.low > previous.low;
  const isBullishHarami =
    previousStats.bearish &&
    lastStats.bullish &&
    last.open > previous.close &&
    last.close < previous.open;

  const isBearishHarami =
    previousStats.bullish &&
    lastStats.bearish &&
    last.open < previous.close &&
    last.close > previous.open;

  const isPiercingLine =
    previousStats.bearish &&
    lastStats.bullish &&
    last.open < previous.close &&
    last.close > (previous.open + previous.close) / 2 &&
    last.close < previous.open;

  const isDarkCloudCover =
    previousStats.bullish &&
    lastStats.bearish &&
    last.open > previous.close &&
    last.close < (previous.open + previous.close) / 2 &&
    last.close > previous.open;

  const isDoji = lastStats.body / lastStats.range <= 0.12;
  const isDragonflyDoji =
    isDoji &&
    lastStats.lower / lastStats.range >= 0.6 &&
    lastStats.upper / lastStats.range <= 0.12;
  const isGravestoneDoji =
    isDoji &&
    lastStats.upper / lastStats.range >= 0.6 &&
    lastStats.lower / lastStats.range <= 0.12;
  const isBullishMarubozu =
    lastStats.bullish &&
    lastStats.body / lastStats.range >= 0.82 &&
    lastStats.upper / lastStats.range <= 0.12 &&
    lastStats.lower / lastStats.range <= 0.12;

  const isBearishMarubozu =
    lastStats.bearish &&
    lastStats.body / lastStats.range >= 0.82 &&
    lastStats.upper / lastStats.range <= 0.12 &&
    lastStats.lower / lastStats.range <= 0.12;

  const isMorningStar =
    firstStats.bearish &&
    previousStats.body / previousStats.range < 0.35 &&
    lastStats.bullish &&
    last.close > (first.open + first.close) / 2;

  const isEveningStar =
    firstStats.bullish &&
    previousStats.body / previousStats.range < 0.35 &&
    lastStats.bearish &&
    last.close < (first.open + first.close) / 2;
  const isTweezersTop =
    Math.abs(last.high - previous.high) <= tweezerTolerance &&
    previousStats.bullish &&
    lastStats.bearish;
  const isTweezersBottom =
    Math.abs(last.low - previous.low) <= tweezerTolerance &&
    previousStats.bearish &&
    lastStats.bullish;
  const isInsideBarFalseBreakoutBullish =
    previous.high < first.high &&
    previous.low > first.low &&
    last.low < first.low &&
    last.close > previous.high;
  const isInsideBarFalseBreakoutBearish =
    previous.high < first.high &&
    previous.low > first.low &&
    last.high > first.high &&
    last.close < previous.low;

  if (isMorningStar) {
    return {
      name: "Morning Star",
      bias: "bullish",
      score: 3,
      reason: "Three-candle bullish reversal pattern.",
    };
  }

  if (isEveningStar) {
    return {
      name: "Evening Star",
      bias: "bearish",
      score: 3,
      reason: "Three-candle bearish reversal pattern.",
    };
  }

  if (isInsideBarFalseBreakoutBullish) {
    return {
      name: "Bullish Inside Bar False Breakout",
      bias: "bullish",
      score: 3,
      reason: "Price swept below the mother bar, failed to continue lower, and closed back above the inside bar high.",
    };
  }

  if (isInsideBarFalseBreakoutBearish) {
    return {
      name: "Bearish Inside Bar False Breakout",
      bias: "bearish",
      score: 3,
      reason: "Price swept above the mother bar, failed to continue higher, and closed back below the inside bar low.",
    };
  }

  if (isBullishEngulfing) {
    return {
      name: "Bullish Engulfing",
      bias: "bullish",
      score: 2,
      reason: "Buyers engulfed the previous bearish candle.",
    };
  }

  if (isBearishEngulfing) {
    return {
      name: "Bearish Engulfing",
      bias: "bearish",
      score: 2,
      reason: "Sellers engulfed the previous bullish candle.",
    };
  }

  if (isBullishPin) {
    return {
      name: "Bullish Pin Bar / Hammer",
      bias: "bullish",
      score: 2,
      reason: "Long lower wick shows rejection of lower prices.",
    };
  }

  if (isBearishPin) {
    return {
      name: "Bearish Pin Bar / Shooting Star",
      bias: "bearish",
      score: 2,
      reason: "Long upper wick shows rejection of higher prices.",
    };
  }

  if (isPiercingLine) {
    return {
      name: "Piercing Line",
      bias: "bullish",
      score: 2,
      reason: "Buyers recovered more than half of the previous bearish candle.",
    };
  }

  if (isDarkCloudCover) {
    return {
      name: "Dark Cloud Cover",
      bias: "bearish",
      score: 2,
      reason: "Sellers pushed price below the midpoint of the previous bullish candle.",
    };
  }

  if (isBullishHarami) {
    return {
      name: "Bullish Harami",
      bias: "bullish",
      score: 1,
      reason: "Small bullish candle inside the previous bearish body shows selling pressure slowing.",
    };
  }

  if (isBearishHarami) {
    return {
      name: "Bearish Harami",
      bias: "bearish",
      score: 1,
      reason: "Small bearish candle inside the previous bullish body shows buying pressure slowing.",
    };
  }

  if (isBullishMarubozu) {
    return {
      name: "Bullish Marubozu",
      bias: "bullish",
      score: 2,
      reason: "Large bullish body with very small wicks shows strong buyer control.",
    };
  }

  if (isBearishMarubozu) {
    return {
      name: "Bearish Marubozu",
      bias: "bearish",
      score: 2,
      reason: "Large bearish body with very small wicks shows strong seller control.",
    };
  }

  if (isInsideBar) {
    return {
      name: "Inside Bar",
      bias: "neutral",
      score: 1,
      reason: "Compression or indecision. Wait for breakout confirmation.",
    };
  }

  if (isTweezersBottom) {
    return {
      name: "Tweezers Bottom",
      bias: "bullish",
      score: 2,
      reason: "Matching lows show rejection of lower prices and a possible bullish reversal.",
    };
  }

  if (isTweezersTop) {
    return {
      name: "Tweezers Top",
      bias: "bearish",
      score: 2,
      reason: "Matching highs show rejection of higher prices and a possible bearish reversal.",
    };
  }

  if (isDragonflyDoji) {
    return {
      name: "Dragonfly Doji",
      bias: "bullish",
      score: 2,
      reason: "Long lower rejection with a doji body shows buyers defended lower prices.",
    };
  }

  if (isGravestoneDoji) {
    return {
      name: "Gravestone Doji",
      bias: "bearish",
      score: 2,
      reason: "Long upper rejection with a doji body shows sellers defended higher prices.",
    };
  }

  if (isDoji) {
    return {
      name: "Doji",
      bias: "neutral",
      score: 1,
      reason: "Small body shows indecision. Wait for the next candle to confirm direction.",
    };
  }

  return {
    name: "No strong pattern",
    bias: "neutral",
    score: 0,
    reason: "Latest candle does not match a major simple setup.",
  };
}

function getMarketStructure(candles: Candle[]): MarketStructure {
  if (candles.length < 8) {
    return {
      label: "range",
      reason: "Need more candles to confirm market structure.",
      score: 0,
    };
  }

  const recentCandles = candles.slice(-8);
  const firstHalf = recentCandles.slice(0, 4);
  const secondHalf = recentCandles.slice(4);
  const firstHigh = Math.max(...firstHalf.map((candle) => candle.high));
  const secondHigh = Math.max(...secondHalf.map((candle) => candle.high));
  const firstLow = Math.min(...firstHalf.map((candle) => candle.low));
  const secondLow = Math.min(...secondHalf.map((candle) => candle.low));
  const firstCloseAverage =
    firstHalf.reduce((sum, candle) => sum + candle.close, 0) / firstHalf.length;
  const secondCloseAverage =
    secondHalf.reduce((sum, candle) => sum + candle.close, 0) / secondHalf.length;
  const rangePadding = Math.max(getAverageRange(candles) * 0.2, 0.5);

  if (
    secondHigh > firstHigh + rangePadding &&
    secondLow > firstLow - rangePadding &&
    secondCloseAverage > firstCloseAverage
  ) {
    return {
      label: "uptrend",
      reason: "Recent candles are building higher value with pressure toward higher prices.",
      score: 2,
    };
  }

  if (
    secondLow < firstLow - rangePadding &&
    secondHigh < firstHigh + rangePadding &&
    secondCloseAverage < firstCloseAverage
  ) {
    return {
      label: "downtrend",
      reason: "Recent candles are building lower value with pressure toward lower prices.",
      score: -2,
    };
  }

  return {
    label: "range",
    reason: "Price is moving sideways, so candle signals need stronger confirmation.",
    score: 0,
  };
}

function getZone(label: string, level: number, width: number): PriceZone {
  return {
    bottom: level - width,
    label,
    top: level + width,
  };
}

function isInsideZone(price: number, zone: PriceZone): boolean {
  return price >= zone.bottom && price <= zone.top;
}

function getConfirmation(candles: Candle[], supportZone: PriceZone, resistanceZone: PriceZone): ConfluenceFactor {
  if (candles.length < 2) {
    return {
      bias: "neutral",
      label: "No confirmation candle yet",
      score: 0,
    };
  }

  const previous = candles[candles.length - 2];
  const last = candles[candles.length - 1];
  const lastStats = getCandleStats(last);
  const rejectedSupport =
    last.low <= supportZone.top &&
    last.close > supportZone.top &&
    lastStats.lower > lastStats.body;
  const rejectedResistance =
    last.high >= resistanceZone.bottom &&
    last.close < resistanceZone.bottom &&
    lastStats.upper > lastStats.body;

  if (last.close > previous.high) {
    return {
      bias: "bullish",
      label: "Bullish confirmation above previous high",
      score: 2,
    };
  }

  if (last.close < previous.low) {
    return {
      bias: "bearish",
      label: "Bearish confirmation below previous low",
      score: -2,
    };
  }

  if (rejectedSupport) {
    return {
      bias: "bullish",
      label: "Support rejection candle",
      score: 1,
    };
  }

  if (rejectedResistance) {
    return {
      bias: "bearish",
      label: "Resistance rejection candle",
      score: -1,
    };
  }

  return {
    bias: "neutral",
    label: "No strong confirmation candle",
    score: 0,
  };
}

function getRangeFilter(candles: Candle[]): ConfluenceFactor {
  const averageRange = getAverageRange(candles);
  const averageBody = getAverageBody(candles);
  const bodyEfficiency = averageRange > 0 ? averageBody / averageRange : 0;

  if (bodyEfficiency < 0.28) {
    return {
      bias: "neutral",
      label: "Choppy candles, lower confidence",
      score: -1,
    };
  }

  return {
    bias: "neutral",
    label: "Clean enough candle movement",
    score: 1,
  };
}

function getMovingAverageSignal(candles: Candle[]): MovingAverageSignal {
  const overlay = getMovingAverageOverlay(candles);
  const ema9 = getLatestDefinedValue(overlay.ema9);
  const ema21 = getLatestDefinedValue(overlay.ema21);
  const ema50 = getLatestDefinedValue(overlay.ema50);
  const last = candles[candles.length - 1];
  const averageRange = Math.max(getAverageRange(candles), 0.1);

  if (ema9 === null || ema21 === null) {
    return {
      alignment: "neutral",
      ema9,
      ema21,
      ema50,
      label: "Not enough candles yet for the EMA trend stack.",
      preferredEntry: null,
      score: 0,
    };
  }

  const hasFullBullishStack = ema50 !== null && last.close > ema9 && ema9 > ema21 && ema21 > ema50;
  const hasFullBearishStack = ema50 !== null && last.close < ema9 && ema9 < ema21 && ema21 < ema50;
  const hasFastBullishBias = last.close > ema9 && ema9 >= ema21;
  const hasFastBearishBias = last.close < ema9 && ema9 <= ema21;
  const bullishEntry = last.close - ema9 <= averageRange * 0.9 ? ema9 : ema21;
  const bearishEntry = ema9 - last.close <= averageRange * 0.9 ? ema9 : ema21;

  if (hasFullBullishStack) {
    return {
      alignment: "bullish",
      ema9,
      ema21,
      ema50,
      label: "EMA stack is bullish. TradingView-style pullbacks into EMA 9 or EMA 21 are favored for long entries.",
      preferredEntry: bullishEntry,
      score: 2,
    };
  }

  if (hasFullBearishStack) {
    return {
      alignment: "bearish",
      ema9,
      ema21,
      ema50,
      label: "EMA stack is bearish. TradingView-style pullbacks into EMA 9 or EMA 21 are favored for short entries.",
      preferredEntry: bearishEntry,
      score: -2,
    };
  }

  if (hasFastBullishBias) {
    return {
      alignment: "bullish",
      ema9,
      ema21,
      ema50,
      label: "Fast EMAs lean bullish, but the full trend stack is not fully aligned yet.",
      preferredEntry: ema9,
      score: 1,
    };
  }

  if (hasFastBearishBias) {
    return {
      alignment: "bearish",
      ema9,
      ema21,
      ema50,
      label: "Fast EMAs lean bearish, but the full trend stack is not fully aligned yet.",
      preferredEntry: ema9,
      score: -1,
    };
  }

  return {
    alignment: "neutral",
    ema9,
    ema21,
    ema50,
    label: "EMA stack is mixed, so entries should wait for clearer alignment.",
    preferredEntry: null,
    score: 0,
  };
}

function getFibonacciRetracement(candles: Candle[], trend: Trend): FibonacciRetracement {
  const swingCandles = candles.slice(-24);

  if (swingCandles.length < 6 || trend === "neutral") {
    return {
      direction: "neutral",
      level382: null,
      level500: null,
      level618: null,
      swingHigh: null,
      swingLow: null,
      label: "Fibonacci retracement is waiting for a clearer directional swing.",
      score: 0,
    };
  }

  const swingHigh = Math.max(...swingCandles.map((candle) => candle.high));
  const swingLow = Math.min(...swingCandles.map((candle) => candle.low));
  const swingRange = swingHigh - swingLow;

  if (swingRange <= 0) {
    return {
      direction: "neutral",
      level382: null,
      level500: null,
      level618: null,
      swingHigh: null,
      swingLow: null,
      label: "Fibonacci retracement could not be derived from the current swing.",
      score: 0,
    };
  }

  if (trend === "bullish") {
    return {
      direction: "bullish",
      level382: swingHigh - swingRange * 0.382,
      level500: swingHigh - swingRange * 0.5,
      level618: swingHigh - swingRange * 0.618,
      swingHigh,
      swingLow,
      label: "Bullish Fibonacci retracement is active. Pullbacks into 38.2%, 50%, and 61.8% can improve long entries.",
      score: 0,
    };
  }

  return {
    direction: "bearish",
    level382: swingLow + swingRange * 0.382,
    level500: swingLow + swingRange * 0.5,
    level618: swingLow + swingRange * 0.618,
    swingHigh,
    swingLow,
    label: "Bearish Fibonacci retracement is active. Pullbacks into 38.2%, 50%, and 61.8% can improve short entries.",
    score: 0,
  };
}

function getFibonacciConfluence(
  fibonacci: FibonacciRetracement,
  lastClose: number,
  averageRange: number,
): ConfluenceFactor {
  const watchedLevels = [fibonacci.level500, fibonacci.level618].filter((value): value is number => value !== null);
  const isNearWatchedLevel = watchedLevels.some((value) => Math.abs(lastClose - value) <= averageRange * 0.75);

  if (fibonacci.direction === "bullish" && isNearWatchedLevel) {
    return {
      bias: "bullish",
      label: "Price is pulling back into bullish Fibonacci value zones.",
      score: 1,
    };
  }

  if (fibonacci.direction === "bearish" && isNearWatchedLevel) {
    return {
      bias: "bearish",
      label: "Price is pulling back into bearish Fibonacci value zones.",
      score: -1,
    };
  }

  return {
    bias: "neutral",
    label: fibonacci.label,
    score: 0,
  };
}

function getEntryLevels(
  trend: Trend,
  movingAverageSignal: MovingAverageSignal,
  fibonacci: FibonacciRetracement,
): EntryLevels {
  if (trend === "bullish") {
    return {
      aggressive: averageDefinedValues([movingAverageSignal.ema9, fibonacci.level382]),
      safe: averageDefinedValues([movingAverageSignal.ema21, fibonacci.level500, fibonacci.level618]),
    };
  }

  if (trend === "bearish") {
    return {
      aggressive: averageDefinedValues([movingAverageSignal.ema9, fibonacci.level382]),
      safe: averageDefinedValues([movingAverageSignal.ema21, fibonacci.level500, fibonacci.level618]),
    };
  }

  return {
    aggressive: movingAverageSignal.preferredEntry,
    safe: averageDefinedValues([movingAverageSignal.ema21, fibonacci.level500]),
  };
}

function createWaitPlan(entry: number | null): TradeBracket {
  return {
    entry,
    riskAmount: null,
    stopLoss: null,
    takeProfit: null,
  };
}

function createBuyPlan(
  entry: number,
  stopLoss: number,
  takeProfit: number,
): TradeBracket {
  return {
    entry,
    riskAmount: Math.max(entry - stopLoss, 0.1),
    stopLoss,
    takeProfit,
  };
}

function createSellPlan(
  entry: number,
  stopLoss: number,
  takeProfit: number,
): TradeBracket {
  return {
    entry,
    riskAmount: Math.max(stopLoss - entry, 0.1),
    stopLoss,
    takeProfit,
  };
}

function getConfluenceSummary(score: number, confluence: ConfluenceFactor[]): string {
  const supportiveFactors = confluence.filter((factor) => factor.score > 0).length;
  const defensiveFactors = confluence.filter((factor) => factor.score < 0).length;

  if (score >= 5) {
    return `Strong bullish setup with ${supportiveFactors} bullish confluence factors.`;
  }

  if (score <= -5) {
    return `Strong bearish setup with ${defensiveFactors} bearish confluence factors.`;
  }

  if (score >= 3) {
    return "Bullish setup, but wait for clean execution around the marked zone.";
  }

  if (score <= -3) {
    return "Bearish setup, but wait for clean execution around the marked zone.";
  }

  return "Mixed setup. Pattern alone is not enough, so waiting is preferred.";
}

export function analyzeCandles(candles: Candle[]): AnalysisResult | null {
  if (candles.length < 5) {
    return null;
  }

  const closes = candles.map((candle) => candle.close);
  const last = candles[candles.length - 1];
  const ma8 = calculateSma(candles, 8);
  const ma20 = calculateSma(candles, 20);
  const recent = candles.slice(-12);
  const referenceCandles = recent.slice(0, -1);
  const resistance = Math.max(...referenceCandles.map((candle) => candle.high));
  const support = Math.min(...referenceCandles.map((candle) => candle.low));
  const zoneWidth = Math.max(getAverageRange(candles) * 0.35, last.close * 0.002);
  const supportZone = getZone("Demand zone", support, zoneWidth);
  const resistanceZone = getZone("Supply zone", resistance, zoneWidth);
  const pattern = detectPattern(candles);
  const marketStructure = getMarketStructure(candles);
  const confirmation = getConfirmation(candles, supportZone, resistanceZone);
  const rangeFilter = getRangeFilter(candles);
  const movingAverageSignal = getMovingAverageSignal(candles);

  const higherHighs =
    closes.length >= 4 &&
    closes[closes.length - 1] > closes[closes.length - 3] &&
    closes[closes.length - 2] > closes[closes.length - 4];

  const lowerLows =
    closes.length >= 4 &&
    closes[closes.length - 1] < closes[closes.length - 3] &&
    closes[closes.length - 2] < closes[closes.length - 4];

  const movingAverageBias: Trend =
    ma8 === null || ma20 === null
      ? ma8 === null ? "neutral" : last.close > ma8 ? "bullish" : "bearish"
      : last.close > ma8 && ma8 >= ma20
        ? "bullish"
        : last.close < ma8 && ma8 <= ma20
          ? "bearish"
          : "neutral";

  const trend: Trend = marketStructure.label === "uptrend" || higherHighs || movingAverageBias === "bullish"
    ? "bullish"
    : marketStructure.label === "downtrend" || lowerLows || movingAverageBias === "bearish"
      ? "bearish"
      : "neutral";
  const fibonacci = getFibonacciRetracement(candles, trend);
  const fibonacciConfluence = getFibonacciConfluence(fibonacci, last.close, Math.max(getAverageRange(candles), 0.1));
  const entryLevels = getEntryLevels(trend, movingAverageSignal, fibonacci);

  const nearSupport = isInsideZone(last.close, supportZone);
  const nearResistance = isInsideZone(last.close, resistanceZone);

  let score = 0;
  const confluence: ConfluenceFactor[] = [
    {
      bias: marketStructure.label === "uptrend"
        ? "bullish"
        : marketStructure.label === "downtrend"
          ? "bearish"
          : "neutral",
      label: marketStructure.reason,
      score: marketStructure.score,
    },
    {
      bias: movingAverageSignal.alignment,
      label: movingAverageSignal.label,
      score: movingAverageSignal.score,
    },
    {
      bias: pattern.bias,
      label: pattern.reason,
      score: pattern.bias === "bullish"
        ? pattern.score
        : pattern.bias === "bearish"
          ? -pattern.score
          : 0,
    },
    fibonacciConfluence,
    confirmation,
    rangeFilter,
  ];

  score = confluence.reduce((total, factor) => total + factor.score, 0);

  if (nearSupport && pattern.bias === "bullish") {
    score += 2;
    confluence.push({
      bias: "bullish",
      label: "Bullish candle formed around the demand zone.",
      score: 2,
    });
  }

  if (nearResistance && pattern.bias === "bearish") {
    score -= 2;
    confluence.push({
      bias: "bearish",
      label: "Bearish candle formed around the supply zone.",
      score: -2,
    });
  }

  const direction =
    score >= 5
      ? "High-confluence bullish setup"
      : score >= 3
        ? "Bullish setup, wait for clean entry"
        : score <= -5
          ? "High-confluence bearish setup"
          : score <= -3
            ? "Bearish setup, wait for clean entry"
            : "Mixed market, wait for confirmation";

  return {
    confirmation,
    confluence,
    confluenceSummary: getConfluenceSummary(score, confluence),
    fibonacci,
    entryLevels,
    last,
    ma8,
    ma20,
    movingAverageSignal,
    marketStructure,
    support,
    supportZone,
    resistance,
    resistanceZone,
    trend,
    pattern,
    nearSupport,
    nearResistance,
    score,
    direction,
  };
}

export function getTradeSuggestion(
  candles: Candle[],
  targetProfit?: number,
  interval?: string,
): TradeSuggestion | null {
  const analysis = analyzeCandles(candles);

  if (analysis === null) {
    return null;
  }

  const entry = analysis.last.close;
  const aggressiveEntry = analysis.entryLevels.aggressive ?? analysis.movingAverageSignal.preferredEntry ?? entry;
  const safeEntry = analysis.entryLevels.safe ?? aggressiveEntry;
  const suggestedEntry = safeEntry;
  const averageRange = Math.max(getAverageRange(candles), 0.1);
  const intervalMinutes = getCandleIntervalMinutes(candles, interval);
  const resolvedTargetProfit = targetProfit ?? getDynamicTargetProfit(candles, interval);
  const riskAmount = intervalMinutes !== null && intervalMinutes <= 15
    ? clamp(averageRange * 1.05, 2.5, 9)
    : intervalMinutes !== null && intervalMinutes <= 60
      ? clamp(averageRange * 1.05, 5, 13)
      : clamp(averageRange * 0.9, 10, 18);
  const zoneBuffer = averageRange * (isIntradayInterval(intervalMinutes) ? 0.35 : 0.25);
  const buyStopLoss = Math.min(suggestedEntry - riskAmount, analysis.supportZone.bottom - zoneBuffer);
  const sellStopLoss = Math.max(suggestedEntry + riskAmount, analysis.resistanceZone.top + zoneBuffer);
  const buyRisk = suggestedEntry - buyStopLoss;
  const sellRisk = sellStopLoss - suggestedEntry;
  const tradeGuardReason = getTradeGuardReason(analysis, intervalMinutes);
  const minimumRewardRisk = isIntradayInterval(intervalMinutes) ? 0.8 : 0.9;
  const safeRewardMultiplier = isIntradayInterval(intervalMinutes) ? 1.45 : 1.7;
  const flexibleRewardMultiplier = isIntradayInterval(intervalMinutes) ? 1.05 : 1.2;
  const aggressiveBuyStopLoss = Math.min(aggressiveEntry - riskAmount * 0.75, analysis.supportZone.bottom - zoneBuffer * 0.45);
  const aggressiveSellStopLoss = Math.max(aggressiveEntry + riskAmount * 0.75, analysis.resistanceZone.top + zoneBuffer * 0.45);
  const flexibleBuyPlan = createBuyPlan(
    aggressiveEntry,
    aggressiveBuyStopLoss,
    aggressiveEntry + Math.max(resolvedTargetProfit * flexibleRewardMultiplier, resolvedTargetProfit),
  );
  const flexibleSellPlan = createSellPlan(
    aggressiveEntry,
    aggressiveSellStopLoss,
    aggressiveEntry - Math.max(resolvedTargetProfit * flexibleRewardMultiplier, resolvedTargetProfit),
  );
  const safeBuyPlan = createBuyPlan(
    safeEntry,
    buyStopLoss,
    safeEntry + Math.max(resolvedTargetProfit * safeRewardMultiplier, buyRisk * minimumRewardRisk),
  );
  const safeSellPlan = createSellPlan(
    safeEntry,
    sellStopLoss,
    safeEntry - Math.max(resolvedTargetProfit * safeRewardMultiplier, sellRisk * minimumRewardRisk),
  );

  if (tradeGuardReason !== null) {
    const previewPlan = analysis.score >= 0 ? safeBuyPlan : safeSellPlan;
    const previewFlexiblePlan = analysis.score >= 0 ? flexibleBuyPlan : flexibleSellPlan;

    return {
      action: "wait",
      aggressiveEntry,
      aggressivePlan: previewFlexiblePlan,
      entry: suggestedEntry,
      flexiblePlan: previewFlexiblePlan,
      stopLoss: previewPlan.stopLoss,
      safeEntry,
      safePlan: previewPlan,
      takeProfit: previewPlan.takeProfit,
      targetProfit: resolvedTargetProfit,
      riskAmount: previewPlan.riskAmount,
      summary: `${tradeGuardReason} Preview brackets are shown, but waiting is still safer.`,
    };
  }

  if (analysis.score >= 3 && analysis.confirmation.score >= 0) {
    if (resolvedTargetProfit / buyRisk < minimumRewardRisk) {
      return {
        action: "wait",
        aggressiveEntry,
        aggressivePlan: flexibleBuyPlan,
        entry: suggestedEntry,
        flexiblePlan: flexibleBuyPlan,
        stopLoss: safeBuyPlan.stopLoss,
        safeEntry,
        safePlan: safeBuyPlan,
        takeProfit: safeBuyPlan.takeProfit,
        targetProfit: resolvedTargetProfit,
        riskAmount: safeBuyPlan.riskAmount,
        summary: "Buy setup is not fully cleared yet, but preview SL/TP brackets are shown with looser reward-to-risk rules.",
      };
    }

    return {
      action: "buy",
      aggressiveEntry,
      aggressivePlan: flexibleBuyPlan,
      entry: suggestedEntry,
      flexiblePlan: flexibleBuyPlan,
      stopLoss: buyStopLoss,
      safeEntry,
      safePlan: safeBuyPlan,
      takeProfit: safeBuyPlan.takeProfit,
      targetProfit: resolvedTargetProfit,
      riskAmount: safeBuyPlan.riskAmount,
      summary: "Buy bias from trend, pattern, EMA stack, and Fibonacci pullback confluence. The safe entry leans toward deeper value, while the aggressive entry leans toward an earlier pullback.",
    };
  }

  if (analysis.score <= -3 && analysis.confirmation.score <= 0) {
    if (resolvedTargetProfit / sellRisk < minimumRewardRisk) {
      return {
        action: "wait",
        aggressiveEntry,
        aggressivePlan: flexibleSellPlan,
        entry: suggestedEntry,
        flexiblePlan: flexibleSellPlan,
        stopLoss: safeSellPlan.stopLoss,
        safeEntry,
        safePlan: safeSellPlan,
        takeProfit: safeSellPlan.takeProfit,
        targetProfit: resolvedTargetProfit,
        riskAmount: safeSellPlan.riskAmount,
        summary: "Sell setup is not fully cleared yet, but preview SL/TP brackets are shown with looser reward-to-risk rules.",
      };
    }

    return {
      action: "sell",
      aggressiveEntry,
      aggressivePlan: flexibleSellPlan,
      entry: suggestedEntry,
      flexiblePlan: flexibleSellPlan,
      stopLoss: sellStopLoss,
      safeEntry,
      safePlan: safeSellPlan,
      takeProfit: safeSellPlan.takeProfit,
      targetProfit: resolvedTargetProfit,
      riskAmount: safeSellPlan.riskAmount,
      summary: "Sell bias from trend, pattern, EMA stack, and Fibonacci pullback confluence. The safe entry leans toward deeper value, while the aggressive entry leans toward an earlier pullback.",
    };
  }

  return {
    action: "wait",
    aggressiveEntry,
    aggressivePlan: analysis.score >= 0 ? flexibleBuyPlan : flexibleSellPlan,
    entry: suggestedEntry,
    flexiblePlan: analysis.score >= 0 ? flexibleBuyPlan : flexibleSellPlan,
    stopLoss: analysis.score >= 0 ? safeBuyPlan.stopLoss : safeSellPlan.stopLoss,
    safeEntry,
    safePlan: analysis.score >= 0 ? safeBuyPlan : safeSellPlan,
    takeProfit: analysis.score >= 0 ? safeBuyPlan.takeProfit : safeSellPlan.takeProfit,
    targetProfit: resolvedTargetProfit,
    riskAmount: analysis.score >= 0 ? safeBuyPlan.riskAmount : safeSellPlan.riskAmount,
    summary: "No clean confluence setup yet. Watch the suggested brackets, but wait for the rest of the signals to align before treating them as active trade plans.",
  };
}

function shiftTimestamp(value: string, stepsToAdd: number, intervalMinutes: number): string {
  const parsedDate = parseTimestamp(value);

  if (parsedDate === null) {
    return `${value} +${stepsToAdd * intervalMinutes}m`;
  }

  parsedDate.setMinutes(parsedDate.getMinutes() + stepsToAdd * intervalMinutes);

  return formatShiftedTimestamp(parsedDate, value);
}

export function predictFutureCandles(candles: Candle[], interval?: string): PredictionResult | null {
  const analysis = analyzeCandles(candles);

  if (analysis === null) {
    return null;
  }

  const last = candles[candles.length - 1];
  const averageRange = Math.max(getAverageRange(candles), 0.4);
  const averageBody = Math.max(getAverageBody(candles), averageRange * 0.28);
  const biasStrength = Math.min(Math.abs(analysis.score) / 4, 1);
  const direction = analysis.score >= 3 ? 1 : analysis.score <= -3 ? -1 : 0;
  const intervalMinutes = getCandleIntervalMinutes(candles, interval) ?? 60;
  const projectedCandles: Candle[] = [];

  let previousClose = last.close;

  for (let index = 0; index < 3; index += 1) {
    const open = previousClose;
    const drift =
      direction === 0
        ? (index % 2 === 0 ? 1 : -1) * averageBody * 0.18
        : direction * averageBody * (0.55 + biasStrength * 0.45 - index * 0.08);
    const close = open + drift;
    const wickPadding = averageRange * (0.28 + (1 - biasStrength) * 0.18);
    const high = Math.max(open, close) + wickPadding;
    const low = Math.min(open, close) - wickPadding;

    projectedCandles.push({
      time: shiftTimestamp(last.time, index + 1, intervalMinutes),
      open,
      high,
      low,
      close,
    });

    previousClose = close;
  }

  const confidenceLabel =
    Math.abs(analysis.score) >= 3 ? "high" : Math.abs(analysis.score) >= 2 ? "medium" : "low";
  const summary =
    direction > 0
      ? "Projection leans bullish from the current pattern, moving average bias, and recent momentum."
      : direction < 0
        ? "Projection leans bearish from the current pattern, moving average bias, and recent momentum."
        : "Projection is mixed, so the model shows a flatter path with low conviction.";

  return {
    confidenceLabel,
    projectedCandles,
    summary,
  };
}
