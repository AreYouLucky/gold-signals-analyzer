import type { Candle } from "~/lib/gold-analysis";

export type LiveGoldSnapshot = {
  asOf: string | null;
  candles: Candle[];
  interval: string;
  latestPrice: number | null;
  source: "Twelve Data";
  symbol: string;
};

type TwelveDataTimeSeriesRow = {
  close: string;
  datetime: string;
  high: string;
  low: string;
  open: string;
};

type TwelveDataTimeSeriesResponse = {
  code?: number;
  message?: string;
  meta?: {
    interval?: string;
    symbol?: string;
  };
  status?: string;
  values?: TwelveDataTimeSeriesRow[];
};

type TwelveDataPriceResponse = {
  code?: number;
  message?: string;
  price?: string;
  status?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTimeSeriesRow(value: unknown): value is TwelveDataTimeSeriesRow {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.datetime === "string" &&
    typeof value.open === "string" &&
    typeof value.high === "string" &&
    typeof value.low === "string" &&
    typeof value.close === "string";
}

function toNumber(value: string): number | null {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Market data request failed with status ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

function parseTimeSeriesResponse(payload: TwelveDataTimeSeriesResponse): {
  candles: Candle[];
  interval: string;
  symbol: string;
} {
  if (payload.status === "error") {
    throw new Error(payload.message ?? "Failed to load market time series.");
  }

  const rows = Array.isArray(payload.values) ? payload.values.filter(isTimeSeriesRow) : [];
  const candles = rows
    .map((row) => {
      const open = toNumber(row.open);
      const high = toNumber(row.high);
      const low = toNumber(row.low);
      const close = toNumber(row.close);

      if (open === null || high === null || low === null || close === null) {
        return null;
      }

      return {
        time: row.datetime,
        open,
        high,
        low,
        close,
      };
    })
    .filter((candle): candle is Candle => candle !== null)
    .reverse();

  if (candles.length === 0) {
    throw new Error("No valid market candles were returned by the API.");
  }

  return {
    candles,
    interval: payload.meta?.interval ?? "1h",
    symbol: payload.meta?.symbol ?? "XAU/USD",
  };
}

function parsePriceResponse(payload: TwelveDataPriceResponse): number | null {
  if (payload.status === "error") {
    throw new Error(payload.message ?? "Failed to load live price.");
  }

  if (typeof payload.price !== "string") {
    return null;
  }

  return toNumber(payload.price);
}

export async function getLiveGoldSnapshot({
  apiKey,
  interval = "1h",
  outputSize = 60,
  symbol = "XAU/USD",
}: {
  apiKey: string;
  interval?: string;
  outputSize?: number;
  symbol?: string;
}): Promise<LiveGoldSnapshot> {
  const baseUrl = "https://api.twelvedata.com";
  const timeSeriesUrl =
    `${baseUrl}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&outputsize=${outputSize}&apikey=${encodeURIComponent(apiKey)}`;
  const priceUrl =
    `${baseUrl}/price?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;

  const [timeSeriesPayload, pricePayload] = await Promise.all([
    fetchJson<TwelveDataTimeSeriesResponse>(timeSeriesUrl),
    fetchJson<TwelveDataPriceResponse>(priceUrl),
  ]);

  const { candles, interval: resolvedInterval, symbol: resolvedSymbol } =
    parseTimeSeriesResponse(timeSeriesPayload);
  const latestPrice = parsePriceResponse(pricePayload) ?? candles[candles.length - 1]?.close ?? null;
  const asOf = candles[candles.length - 1]?.time ?? null;

  return {
    asOf,
    candles,
    interval: resolvedInterval,
    latestPrice,
    source: "Twelve Data",
    symbol: resolvedSymbol,
  };
}
