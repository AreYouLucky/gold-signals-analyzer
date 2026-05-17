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

export type AnalysisResult = {
  confirmation: ConfluenceFactor;
  confluence: ConfluenceFactor[];
  confluenceSummary: string;
  last: Candle;
  ma8: number | null;
  ma20: number | null;
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
  entry: number;
  stopLoss: number | null;
  takeProfit: number | null;
  targetProfit: number;
  riskAmount: number | null;
  summary: string;
};

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
      bias: movingAverageBias,
      label: `Moving average bias is ${movingAverageBias}.`,
      score: movingAverageBias === "bullish" ? 1 : movingAverageBias === "bearish" ? -1 : 0,
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
    last,
    ma8,
    ma20,
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

export function getTradeSuggestion(candles: Candle[], targetProfit = 30): TradeSuggestion | null {
  const analysis = analyzeCandles(candles);

  if (analysis === null) {
    return null;
  }

  const entry = analysis.last.close;
  const averageRange = Math.max(getAverageRange(candles), 1);
  const riskAmount = Math.min(Math.max(averageRange * 0.55, 10), 18);

  if (analysis.score >= 3 && analysis.confirmation.score >= 0) {
    return {
      action: "buy",
      entry,
      stopLoss: entry - riskAmount,
      takeProfit: entry + targetProfit,
      targetProfit,
      riskAmount,
      summary: "Buy bias from trend, zone, pattern, and confirmation confluence. Target is kept small near $30 from entry.",
    };
  }

  if (analysis.score <= -3 && analysis.confirmation.score <= 0) {
    return {
      action: "sell",
      entry,
      stopLoss: entry + riskAmount,
      takeProfit: entry - targetProfit,
      targetProfit,
      riskAmount,
      summary: "Sell bias from trend, zone, pattern, and confirmation confluence. Target is kept small near $30 from entry.",
    };
  }

  return {
    action: "wait",
    entry,
    stopLoss: null,
    takeProfit: null,
    targetProfit,
    riskAmount: null,
    summary: "No clean confluence setup yet. Wait for trend, zone, pattern, and confirmation to align.",
  };
}

function shiftTimestamp(value: string, hoursToAdd: number): string {
  const parsedDate = new Date(value.replace(" ", "T"));

  if (Number.isNaN(parsedDate.getTime())) {
    return `${value} +${hoursToAdd}h`;
  }

  parsedDate.setHours(parsedDate.getHours() + hoursToAdd);

  return parsedDate.toISOString().slice(0, 19).replace("T", " ");
}

export function predictFutureCandles(candles: Candle[]): PredictionResult | null {
  const analysis = analyzeCandles(candles);

  if (analysis === null) {
    return null;
  }

  const last = candles[candles.length - 1];
  const averageRange = Math.max(getAverageRange(candles), 0.4);
  const averageBody = Math.max(getAverageBody(candles), averageRange * 0.28);
  const biasStrength = Math.min(Math.abs(analysis.score) / 4, 1);
  const direction = analysis.score >= 3 ? 1 : analysis.score <= -3 ? -1 : 0;
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
      time: shiftTimestamp(last.time, index + 1),
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
