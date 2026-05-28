import { useEffect, useMemo, useState } from "react";
import { useRevalidator } from "react-router";

import { CandlestickChart } from "~/components/candlestick-chart";
import {
  analyzeCandles,
  candlesToCsv,
  getTradeSuggestion,
  getMovingAverageOverlay,
  parseCsv,
  predictFutureCandles,
} from "~/lib/gold-analysis";
import type { LiveGoldSnapshot } from "~/services/gold";

type WelcomeProps = {
  liveMarket: LiveGoldSnapshot | null;
  liveMarketError: string | null;
  recommendedApi: {
    docsUrl: string;
    name: string;
    note: string;
  };
};

type DataMode = "live" | "manual";

const sampleData = `time,open,high,low,close
2026-01-01,2340,2354,2332,2350
2026-01-02,2350,2366,2348,2361
2026-01-03,2361,2373,2355,2368
2026-01-04,2368,2375,2348,2352
2026-01-05,2352,2357,2329,2335
2026-01-06,2335,2355,2328,2351
2026-01-07,2351,2368,2346,2364
2026-01-08,2364,2382,2359,2378
2026-01-09,2378,2386,2360,2364
2026-01-10,2364,2370,2336,2342`;

function getScoreTone(score: number): {
  badgeClassName: string;
  panelClassName: string;
} {
  if (score >= 3) {
    return {
      badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
      panelClassName: "border-emerald-200 bg-emerald-50",
    };
  }

  if (score <= -3) {
    return {
      badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
      panelClassName: "border-rose-200 bg-rose-50",
    };
  }

  return {
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    panelClassName: "border-amber-200 bg-amber-50",
  };
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/85 p-3 shadow-sm shadow-zinc-200/70 backdrop-blur">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1.5 text-lg font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

function getLiveCsv(liveMarket: LiveGoldSnapshot | null): string | null {
  if (liveMarket === null || liveMarket.candles.length === 0) {
    return null;
  }

  return candlesToCsv(liveMarket.candles);
}

function getDataSourceLabel(liveMarket: LiveGoldSnapshot | null): string {
  if (liveMarket === null) {
    return "Sample CSV";
  }

  return `${liveMarket.source} ${liveMarket.symbol}`;
}

function formatPrice(value: number | null): string {
  return value === null ? "Wait" : value.toFixed(2);
}

function getTradeActionTone(action: "buy" | "sell" | "wait"): {
  badgeClassName: string;
  panelClassName: string;
  title: string;
} {
  if (action === "buy") {
    return {
      badgeClassName: "border-emerald-200 bg-white text-emerald-700",
      panelClassName: "border-emerald-200 bg-emerald-50/80",
      title: "Buy setup",
    };
  }

  if (action === "sell") {
    return {
      badgeClassName: "border-rose-200 bg-white text-rose-700",
      panelClassName: "border-rose-200 bg-rose-50/80",
      title: "Sell setup",
    };
  }

  return {
    badgeClassName: "border-amber-200 bg-white text-amber-700",
    panelClassName: "border-amber-200 bg-amber-50/80",
    title: "Wait setup",
  };
}

export function Welcome({
  liveMarket,
  liveMarketError,
  recommendedApi,
}: WelcomeProps): React.JSX.Element {
  const { revalidate, state } = useRevalidator();
  const liveCsv = useMemo(() => getLiveCsv(liveMarket), [liveMarket]);
  const [dataMode, setDataMode] = useState<DataMode>(liveCsv === null ? "manual" : "live");
  const [csv, setCsv] = useState<string>(liveCsv ?? sampleData);
  const candles = useMemo(() => parseCsv(csv), [csv]);
  const candleInterval = liveMarket?.interval;
  const result = useMemo(() => analyzeCandles(candles), [candles]);
  const movingAverageOverlay = useMemo(() => getMovingAverageOverlay(candles), [candles]);
  const prediction = useMemo(() => predictFutureCandles(candles, candleInterval), [candles, candleInterval]);
  const tradeSuggestion = useMemo(() => getTradeSuggestion(candles, undefined, candleInterval), [candles, candleInterval]);
  const scoreTone = result ? getScoreTone(result.score) : null;
  const tradeTone = tradeSuggestion ? getTradeActionTone(tradeSuggestion.action) : null;
  const isRefreshing = state === "loading";
  const hasLiveFeed = liveMarket !== null;
  const isUsingLiveCandles = dataMode === "live" && liveCsv !== null;

  useEffect(() => {
    if (dataMode === "live" && liveCsv !== null) {
      setCsv(liveCsv);
    }
  }, [dataMode, liveCsv]);

  useEffect(() => {
    if (!hasLiveFeed) {
      return;
    }

    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        revalidate();
      }
    }, 10_000);

    return () => {
      window.clearInterval(refreshTimer);
    };
  }, [hasLiveFeed, revalidate]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#fffdf8_48%,#f8fafc_100%)] px-3 py-6 text-zinc-900 sm:px-5 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[1800px] flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-amber-100/40 backdrop-blur sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-600">
                Gold Signals Analyzer
              </p>
              <h1 className="mt-2.5 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
                Analyze live and manual gold candles with a simple trend model.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                This screen can now ingest live gold market candles and run the same
                rule-based analysis on them. It suggests a probable direction from
                recent price action, but it does not predict the future with
                certainty and should not be treated as trading advice.
              </p>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4 xl:min-w-[640px]">
              <MetricCard label="Rows parsed" value={String(candles.length)} />
              <MetricCard
                label="Pattern"
                value={result?.pattern.name ?? "Waiting"}
              />
              <MetricCard
                label="Structure"
                value={result?.marketStructure.label ?? "Waiting"}
              />
              <MetricCard
                label="Source"
                value={hasLiveFeed ? "Live feed" : "Manual"}
              />
            </div>
          </div>
        </section>

        <section className="flex flex-1 flex-col gap-6">
          <CandlestickChart
            candles={candles}
            futureCandles={prediction?.projectedCandles ?? []}
            height={620}
            movingAverages={movingAverageOverlay}
            title="Live Candlestick Visualization"
          />

          <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
            <section className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-lg shadow-zinc-200/60 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-950">Live market feed</h2>
                  <p className="mt-0.5 text-sm text-zinc-500">
                    {recommendedApi.name}
                  </p>
                  {hasLiveFeed ? (
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-400">
                      Auto-refreshes every 10 seconds
                    </p>
                  ) : null}
                </div>

                {hasLiveFeed ? (
                  <button
                    type="button"
                    onClick={() => revalidate()}
                    disabled={isRefreshing}
                    className="inline-flex shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-amber-300 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRefreshing ? "Refreshing..." : "Refresh live feed"}
                  </button>
                ) : null}
              </div>

              {hasLiveFeed ? (
                <div className="mt-4 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div>
                      <p className="text-sm font-medium text-emerald-800">Live feed connected</p>
                      <p className="mt-1 text-2xl font-semibold text-emerald-950">
                        {liveMarket.latestPrice?.toFixed(2) ?? "N/A"}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm text-emerald-900 sm:text-right">
                      <p>{liveMarket.symbol} | {liveMarket.interval}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">
                        {liveMarket.asOf ?? "Unknown"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-emerald-800">
                    Server-side OHLC feed from{" "}
                    <a
                      href={recommendedApi.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold underline decoration-emerald-300 underline-offset-4"
                    >
                      {recommendedApi.name}
                    </a>
                    .
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/80 p-4 text-sm leading-7 text-zinc-600">
                  <p>
                    Add{" "}
                    <span className="font-semibold text-zinc-900">TWELVE_DATA_API_KEY</span>{" "}
                    and optionally{" "}
                    <span className="font-semibold text-zinc-900">TWELVE_DATA_SYMBOL</span>{" "}
                    for <span className="font-semibold text-zinc-900">XAU/USD</span>.
                  </p>
                  <p className="mt-2">
                    {liveMarketError ?? recommendedApi.note}{" "}
                    <a
                      href={recommendedApi.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-amber-700 underline decoration-amber-300 underline-offset-4"
                    >
                      View docs
                    </a>
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-lg shadow-zinc-200/60 backdrop-blur">
              <h2 className="text-xl font-semibold text-zinc-950">Analysis</h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                Current dataset: {getDataSourceLabel(liveMarket)}
              </p>

              {result ? (
                <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1.1fr_1.35fr_0.95fr]">
                  <div className={`flex min-h-44 flex-col rounded-[1.5rem] border p-4 ${scoreTone?.panelClassName ?? ""}`}>
                    <p className="text-sm font-medium text-zinc-600">Trend read</p>
                    <p className="mt-1.5 text-lg font-semibold leading-tight text-zinc-950">
                      {result.direction}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">
                      {result.confluenceSummary}
                    </p>
                    <div className="mt-auto flex flex-wrap gap-2 pt-3">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${scoreTone?.badgeClassName ?? ""}`}
                      >
                        Score {result.score}
                      </span>
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">
                        Trend {result.trend}
                      </span>
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">
                        {result.marketStructure.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex min-h-44 flex-col rounded-[1.5rem] border border-zinc-200 bg-zinc-50/80 p-4">
                    <p className="text-sm font-medium text-zinc-700">Signal checks</p>
                    <div className="mt-2 space-y-2 text-sm leading-5 text-zinc-600">
                      <p>
                        <span className="font-medium text-zinc-800">Pattern:</span> {result.pattern.reason}
                      </p>
                      <p>
                        <span className="font-medium text-zinc-800">Confirmation:</span> {result.confirmation.label}
                      </p>
                      <p>
                        <span className="font-medium text-zinc-800">EMA:</span> {result.movingAverageSignal.label}
                      </p>
                      <p>
                        <span className="font-medium text-zinc-800">Fibonacci:</span> {result.fibonacci.label}
                      </p>
                    </div>
                    <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
                      <div className="rounded-2xl bg-white/80 px-3 py-2">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                          Near support
                        </p>
                        <p className="mt-1 font-semibold text-zinc-950">
                          {result.nearSupport ? "Yes" : "No"}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white/80 px-3 py-2">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                          Near resistance
                        </p>
                        <p className="mt-1 font-semibold text-zinc-950">
                          {result.nearResistance ? "Yes" : "No"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {tradeSuggestion && tradeTone ? (
                    <div className={`flex min-h-44 flex-col rounded-[1.5rem] border p-4 ${tradeTone.panelClassName}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-zinc-800">
                            Entry + Brackets
                          </p>
                          <p className="mt-0.5 text-xs leading-5 text-zinc-600">
                            Two pullback entries with compact safe and faster brackets.
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${tradeTone.badgeClassName}`}
                        >
                          {tradeTone.title}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-2xl bg-white/80 px-3 py-3">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                              Aggressive
                            </p>
                            <p className="mt-1 text-base font-semibold text-zinc-950">
                              {formatPrice(tradeSuggestion.aggressiveEntry)}
                            </p>
                            <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                              SL {formatPrice(tradeSuggestion.flexiblePlan.stopLoss)} | TP {formatPrice(tradeSuggestion.flexiblePlan.takeProfit)}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white/80 px-3 py-3">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                              Safe
                            </p>
                            <p className="mt-1 text-base font-semibold text-zinc-950">
                              {formatPrice(tradeSuggestion.safeEntry)}
                            </p>
                            <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                              SL {formatPrice(tradeSuggestion.safePlan.stopLoss)} | TP {formatPrice(tradeSuggestion.safePlan.takeProfit)}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs leading-5 text-zinc-600">
                          <p className="rounded-2xl bg-white/70 px-3 py-2">
                            Safe risk: ${tradeSuggestion.safePlan.riskAmount?.toFixed(2) ?? "N/A"}
                          </p>
                          <p className="rounded-2xl bg-white/70 px-3 py-2">
                            Fast risk: ${tradeSuggestion.flexiblePlan.riskAmount?.toFixed(2) ?? "N/A"}
                          </p>
                        </div>
                      </div>

                      <p className="mt-auto pt-3 text-sm leading-5 text-zinc-700">
                        {tradeSuggestion.summary}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-zinc-500">
                        {isUsingLiveCandles
                          ? `These TP and SL levels refresh with the live candle feed every 10 seconds${liveMarket?.asOf ? ` from ${liveMarket.asOf}` : ""}.`
                          : "These TP and SL levels stay fixed until you change the CSV or switch back to live candles."}
                      </p>
                    </div>
                  ) : null}

                  {prediction ? (
                    <div className="flex min-h-44 flex-col rounded-[1.5rem] border border-sky-200 bg-sky-50/80 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-sky-900">
                          Forecast
                        </p>
                        <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                          {prediction.confidenceLabel}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-5 text-sky-900">
                        {prediction.summary}
                      </p>
                      <p className="mt-auto pt-3 text-xs leading-5 text-sky-800">
                        Illustrative projection from recent range, body size, and score bias.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/80 p-5 text-sm leading-7 text-zinc-600">
                  Add at least 5 valid candles to generate an analysis card.
                </div>
              )}
            </section>
          </div>

          <section className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-lg shadow-zinc-200/60 backdrop-blur">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-zinc-950">Levels And Retracements</h2>
                <p className="text-sm text-zinc-500">
                  Compact readout for price structure, EMA stack, and Fib swing levels.
                </p>
              </div>
            </div>

            {result ? (
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-6">
                <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
                  <span className="text-sm text-zinc-500">Last close</span>
                  <span className="font-semibold text-zinc-950">
                    {result.last.close.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
                  <span className="text-sm text-zinc-500">Support</span>
                  <span className="font-semibold text-zinc-950">
                    {result.support.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
                  <span className="text-sm text-zinc-500">Resistance</span>
                  <span className="font-semibold text-zinc-950">
                    {result.resistance.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
                  <span className="text-sm text-zinc-500">EMA 9</span>
                  <span className="font-semibold text-zinc-950">
                    {result.movingAverageSignal.ema9?.toFixed(2) ?? "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
                  <span className="text-sm text-zinc-500">EMA 21</span>
                  <span className="font-semibold text-zinc-950">
                    {result.movingAverageSignal.ema21?.toFixed(2) ?? "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
                  <span className="text-sm text-zinc-500">EMA 50</span>
                  <span className="font-semibold text-zinc-950">
                    {result.movingAverageSignal.ema50?.toFixed(2) ?? "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
                  <span className="text-sm text-zinc-500">Fib 38.2%</span>
                  <span className="font-semibold text-zinc-950">
                    {result.fibonacci.level382?.toFixed(2) ?? "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
                  <span className="text-sm text-zinc-500">Fib 50%</span>
                  <span className="font-semibold text-zinc-950">
                    {result.fibonacci.level500?.toFixed(2) ?? "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
                  <span className="text-sm text-zinc-500">Fib 61.8%</span>
                  <span className="font-semibold text-zinc-950">
                    {result.fibonacci.level618?.toFixed(2) ?? "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
                  <span className="text-sm text-zinc-500">Swing high</span>
                  <span className="font-semibold text-zinc-950">
                    {result.fibonacci.swingHigh?.toFixed(2) ?? "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
                  <span className="text-sm text-zinc-500">Swing low</span>
                  <span className="font-semibold text-zinc-950">
                    {result.fibonacci.swingLow?.toFixed(2) ?? "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
                  <span className="text-sm text-zinc-500">Target model</span>
                  <span className="font-semibold text-zinc-950">
                    ${tradeSuggestion?.targetProfit.toFixed(0) ?? "N/A"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-7 text-zinc-600">
                Once enough candles are present, the compact levels and retracement readout will appear here.
              </p>
            )}
          </section>

          <div className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-lg shadow-zinc-200/60 backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-zinc-950">OHLC CSV Input</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Required columns: <span className="font-medium">time, open, high, low, close</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDataMode("manual");
                    setCsv(sampleData);
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-amber-300 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
                >
                  Load sample
                </button>
                {liveCsv ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDataMode("live");
                      setCsv(liveCsv);
                    }}
                    className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-amber-300 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
                  >
                    Use live candles
                  </button>
                ) : null}
              </div>
            </div>

            <textarea
              value={csv}
              onChange={(event) => {
                setDataMode("manual");
                setCsv(event.target.value);
              }}
              className="mt-5 min-h-[22rem] w-full rounded-[1.5rem] border border-zinc-200 bg-zinc-50/80 px-4 py-4 font-mono text-sm leading-6 text-zinc-800 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
              aria-label="Gold OHLC CSV input"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

export default Welcome;
