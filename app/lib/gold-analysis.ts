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

export type AnalysisResult = {
  last: Candle;
  ma8: number | null;
  support: number;
  resistance: number;
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

  if (isInsideBar) {
    return {
      name: "Inside Bar",
      bias: "neutral",
      score: 1,
      reason: "Compression or indecision. Wait for breakout confirmation.",
    };
  }

  return {
    name: "No strong pattern",
    bias: "neutral",
    score: 0,
    reason: "Latest candle does not match a major simple setup.",
  };
}

export function analyzeCandles(candles: Candle[]): AnalysisResult | null {
  if (candles.length < 5) {
    return null;
  }

  const closes = candles.map((candle) => candle.close);
  const last = candles[candles.length - 1];
  const ma8 = calculateSma(candles, 8);
  const recent = candles.slice(-6);
  const referenceCandles = recent.slice(0, -1);
  const resistance = Math.max(...referenceCandles.map((candle) => candle.high));
  const support = Math.min(...referenceCandles.map((candle) => candle.low));
  const pattern = detectPattern(candles);

  const higherHighs =
    closes.length >= 4 &&
    closes[closes.length - 1] > closes[closes.length - 3] &&
    closes[closes.length - 2] > closes[closes.length - 4];

  const lowerLows =
    closes.length >= 4 &&
    closes[closes.length - 1] < closes[closes.length - 3] &&
    closes[closes.length - 2] < closes[closes.length - 4];

  const movingAverageBias: Trend =
    ma8 === null ? "neutral" : last.close > ma8 ? "bullish" : "bearish";

  const trend: Trend = higherHighs || movingAverageBias === "bullish"
    ? "bullish"
    : lowerLows || movingAverageBias === "bearish"
      ? "bearish"
      : "neutral";

  const nearSupport = Math.abs(last.close - support) / last.close < 0.006;
  const nearResistance = Math.abs(last.close - resistance) / last.close < 0.006;

  let score = 0;

  if (trend === "bullish") {
    score += 1;
  }

  if (trend === "bearish") {
    score -= 1;
  }

  if (pattern.bias === "bullish") {
    score += pattern.score;
  }

  if (pattern.bias === "bearish") {
    score -= pattern.score;
  }

  if (nearSupport && pattern.bias === "bullish") {
    score += 1;
  }

  if (nearResistance && pattern.bias === "bearish") {
    score -= 1;
  }

  const direction =
    score >= 3
      ? "Bullish continuation or reversal possible"
      : score <= -3
        ? "Bearish continuation or reversal possible"
        : "Mixed market, wait for confirmation";

  return {
    last,
    ma8,
    support,
    resistance,
    trend,
    pattern,
    nearSupport,
    nearResistance,
    score,
    direction,
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
  const direction = analysis.score >= 2 ? 1 : analysis.score <= -2 ? -1 : 0;
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
