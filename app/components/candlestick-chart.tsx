import { useEffect, useRef, useState } from "react";

import type { Candle } from "~/lib/gold-analysis";

type CandlestickChartProps = {
  candles: Candle[];
  futureCandles?: Candle[];
  height?: number;
  title?: string;
};

type ChartCandle = Candle & {
  bodyHeight: number;
  bodyY: number;
  highY: number;
  isFuture: boolean;
  lowY: number;
  wickX: number;
  width: number;
  x: number;
};

function formatPrice(value: number): string {
  return value.toFixed(2);
}

function formatTimeLabel(value: string): string {
  const parsedDate = new Date(value.replace(" ", "T"));

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    month: "short",
  }).format(parsedDate);
}

function getChartCandles(
  historyCandles: Candle[],
  futureCandles: Candle[],
  width: number,
  height: number,
): {
  chartCandles: ChartCandle[];
  maxPrice: number;
  minPrice: number;
  priceRange: number;
} {
  const combinedCandles = [...historyCandles, ...futureCandles];
  const maxPrice = Math.max(...combinedCandles.map((candle) => candle.high));
  const minPrice = Math.min(...combinedCandles.map((candle) => candle.low));
  const padding = Math.max((maxPrice - minPrice) * 0.08, 0.5);
  const chartMaxPrice = maxPrice + padding;
  const chartMinPrice = minPrice - padding;
  const priceRange = Math.max(chartMaxPrice - chartMinPrice, 1);
  const gap = width / Math.max(combinedCandles.length, 1);
  const bodyWidth = Math.max(Math.min(gap * 0.62, 22), 8);

  const getY = (price: number): number => {
    const normalized = (price - chartMinPrice) / priceRange;

    return height - normalized * height;
  };

  const chartCandles = combinedCandles.map((candle, index) => {
    const x = index * gap + (gap - bodyWidth) / 2;
    const openY = getY(candle.open);
    const closeY = getY(candle.close);
    const highY = getY(candle.high);
    const lowY = getY(candle.low);
    const bodyY = Math.min(openY, closeY);
    const bodyHeight = Math.max(Math.abs(closeY - openY), 2);

    return {
      ...candle,
      bodyHeight,
      bodyY,
      highY,
      isFuture: index >= historyCandles.length,
      lowY,
      wickX: x + bodyWidth / 2,
      width: bodyWidth,
      x,
    };
  });

  return {
    chartCandles,
    maxPrice: chartMaxPrice,
    minPrice: chartMinPrice,
    priceRange,
  };
}

export function CandlestickChart({
  candles,
  futureCandles = [],
  height = 460,
  title = "Candlestick View",
}: CandlestickChartProps): React.JSX.Element {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const innerHeight = height - 56;
  const historyCandles = candles;
  const candleSlotWidth = 28 * zoomLevel;
  const chartPaddingWidth = 180;
  const width = Math.max(
    1180,
    (historyCandles.length + futureCandles.length) * candleSlotWidth + chartPaddingWidth,
  );

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (container === null) {
      return;
    }

    container.scrollLeft = container.scrollWidth;
  }, [historyCandles.length, futureCandles.length]);

  if (historyCandles.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-zinc-300 bg-zinc-50/80 p-5 text-sm text-zinc-600">
        No candles available for chart rendering yet.
      </div>
    );
  }

  const { chartCandles, maxPrice, minPrice, priceRange } = getChartCandles(
    historyCandles,
    futureCandles,
    width,
    innerHeight,
  );
  const lastClose = historyCandles[historyCandles.length - 1]?.close ?? null;
  const priceTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const price = maxPrice - priceRange * ratio;
    const y = (innerHeight * index) / 4;

    return {
      price,
      y,
    };
  });
  const historyCount = historyCandles.length;
  const futureStartIndex = historyCount;
  const forecastLineX = futureCandles.length > 0
    ? chartCandles[futureStartIndex - 1]?.wickX ?? null
    : null;
  const canZoomOut = zoomLevel > 0.6;
  const canZoomIn = zoomLevel < 2.4;

  return (
    <div className="rounded-[2rem] border border-white/70 bg-white/95 p-6 shadow-xl shadow-zinc-200/60 backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-950">{title}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Showing {historyCount} recent candles
            {futureCandles.length > 0 ? ` and ${futureCandles.length} projected candles` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
          <div className="mr-1 flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2 py-1 normal-case tracking-normal text-zinc-700">
            <button
              type="button"
              onClick={() => setZoomLevel((currentZoom) => Math.max(0.6, currentZoom - 0.2))}
              disabled={!canZoomOut}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-sm font-semibold transition hover:border-amber-300 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-45"
              aria-label="Zoom out candlestick chart"
            >
              -
            </button>
            <span className="min-w-20 text-center text-sm font-medium">
              Zoom {zoomLevel.toFixed(1)}x
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((currentZoom) => Math.min(2.4, currentZoom + 0.2))}
              disabled={!canZoomIn}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-sm font-semibold transition hover:border-amber-300 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-45"
              aria-label="Zoom in candlestick chart"
            >
              +
            </button>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
            Bullish
          </span>
          <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">
            Bearish
          </span>
          {futureCandles.length > 0 ? (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">
              Forecast zone
            </span>
          ) : null}
          {lastClose !== null ? (
            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-zinc-700">
              Last close {formatPrice(lastClose)}
            </span>
          ) : null}
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-zinc-700">
            Scroll for history
          </span>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="mt-6 overflow-x-auto rounded-[1.5rem] border border-zinc-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-3"
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[1180px]"
          role="img"
          aria-label="Gold candlestick chart with forecast candles"
        >
          <defs>
            <linearGradient id="forecast-zone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.12" />
            </linearGradient>
          </defs>

          <rect
            x="0"
            y="0"
            width={width}
            height={innerHeight}
            rx="28"
            fill="#f8fafc"
          />

          {futureCandles.length > 0 && forecastLineX !== null ? (
            <rect
              x={forecastLineX}
              y="0"
              width={width - forecastLineX}
              height={innerHeight}
              fill="url(#forecast-zone)"
            />
          ) : null}

          {priceTicks.map((tick) => (
            <g key={tick.y}>
              <line
                x1="0"
                y1={tick.y}
                x2={width}
                y2={tick.y}
                stroke="#d7dde5"
                strokeDasharray="6 8"
              />
              <text
                x={width - 10}
                y={tick.y - 8}
                textAnchor="end"
                fontSize="14"
                fill="#52525b"
              >
                {formatPrice(tick.price)}
              </text>
            </g>
          ))}

          {futureCandles.length > 0 && forecastLineX !== null ? (
            <line
              x1={forecastLineX}
              y1="0"
              x2={forecastLineX}
              y2={innerHeight}
              stroke="#0f172a"
              strokeDasharray="10 10"
              strokeOpacity="0.45"
            />
          ) : null}

          {chartCandles.map((candle) => {
            const isBullish = candle.close >= candle.open;
            const fill = isBullish ? "#10b981" : "#f43f5e";
            const stroke = isBullish ? "#047857" : "#be123c";

            return (
              <g key={`${candle.time}-${candle.open}-${candle.close}`}>
                <line
                  x1={candle.wickX}
                  y1={candle.highY}
                  x2={candle.wickX}
                  y2={candle.lowY}
                  stroke={stroke}
                  strokeWidth={candle.isFuture ? "2.5" : "3"}
                  strokeLinecap="round"
                  strokeOpacity={candle.isFuture ? "0.65" : "0.95"}
                />
                <rect
                  x={candle.x}
                  y={candle.bodyY}
                  width={candle.width}
                  height={candle.bodyHeight}
                  rx="5"
                  fill={fill}
                  opacity={candle.isFuture ? "0.45" : "0.92"}
                  stroke={stroke}
                  strokeWidth={candle.isFuture ? "1.5" : "1"}
                  strokeDasharray={candle.isFuture ? "8 5" : undefined}
                />
              </g>
            );
          })}

          {chartCandles.map((candle, index) => {
            const markers = [
              0,
              Math.floor(historyCount / 3),
              Math.floor((historyCount * 2) / 3),
              historyCount - 1,
              chartCandles.length - 1,
            ];
            const shouldShowLabel = markers.includes(index);

            if (!shouldShowLabel) {
              return null;
            }

            return (
              <text
                key={`label-${candle.time}-${index}`}
                x={candle.wickX}
                y={height - 10}
                textAnchor="middle"
                fontSize="13"
                fill={candle.isFuture ? "#0369a1" : "#52525b"}
              >
                {formatTimeLabel(candle.time)}
              </text>
            );
          })}

          {futureCandles.length > 0 && forecastLineX !== null ? (
            <text
              x={forecastLineX + 14}
              y="24"
              fontSize="13"
              fill="#075985"
              fontWeight="600"
            >
              Forecast candles
            </text>
          ) : null}
        </svg>
      </div>
    </div>
  );
}

export default CandlestickChart;
