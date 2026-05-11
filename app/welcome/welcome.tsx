import { useEffect, useMemo, useState } from "react";
import { useRevalidator } from "react-router";

import { CandlestickChart } from "~/components/candlestick-chart";
import {
  analyzeCandles,
  candlesToCsv,
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
    <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm shadow-zinc-200/70 backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-zinc-900">{value}</p>
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

export function Welcome({
  liveMarket,
  liveMarketError,
  recommendedApi,
}: WelcomeProps): React.JSX.Element {
  const { revalidate, state } = useRevalidator();
  const liveCsv = useMemo(() => getLiveCsv(liveMarket), [liveMarket]);
  const [csv, setCsv] = useState<string>(liveCsv ?? sampleData);
  const candles = useMemo(() => parseCsv(csv), [csv]);
  const result = useMemo(() => analyzeCandles(candles), [candles]);
  const prediction = useMemo(() => predictFutureCandles(candles), [candles]);
  const scoreTone = result ? getScoreTone(result.score) : null;
  const isRefreshing = state === "loading";
  const hasLiveFeed = liveMarket !== null;

  useEffect(() => {
    if (liveCsv !== null) {
      setCsv(liveCsv);
    }
  }, [liveCsv]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#fffdf8_48%,#f8fafc_100%)] px-3 py-6 text-zinc-900 sm:px-5 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[1800px] flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-amber-100/40 backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-600">
                Gold Signals Analyzer
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
                Analyze live and manual gold candles with a simple trend model.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">
                This screen can now ingest live gold market candles and run the same
                rule-based analysis on them. It suggests a probable direction from
                recent price action, but it does not predict the future with
                certainty and should not be treated as trading advice.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:min-w-[720px]">
              <MetricCard label="Rows parsed" value={String(candles.length)} />
              <MetricCard
                label="Pattern"
                value={result?.pattern.name ?? "Waiting"}
              />
              <MetricCard
                label="Source"
                value={hasLiveFeed ? "Live feed" : "Manual"}
              />
              <MetricCard
                label="Forecast"
                value={prediction?.confidenceLabel ?? "Pending"}
              />
            </div>
          </div>
        </section>

        <section className="grid flex-1 gap-6 xl:grid-cols-[1.45fr_0.75fr]">
          <div className="flex flex-col gap-6">
            <CandlestickChart
              candles={candles}
              futureCandles={prediction?.projectedCandles ?? []}
              height={540}
              title="Live Candlestick Visualization"
            />

            <div className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-lg shadow-zinc-200/60 backdrop-blur">
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
                    onClick={() => setCsv(sampleData)}
                    className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-amber-300 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
                  >
                    Load sample
                  </button>
                  {liveCsv ? (
                    <button
                      type="button"
                      onClick={() => setCsv(liveCsv)}
                      className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-amber-300 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
                    >
                      Use live candles
                    </button>
                  ) : null}
                </div>
              </div>

              <textarea
                value={csv}
                onChange={(event) => setCsv(event.target.value)}
                className="mt-5 min-h-[22rem] w-full rounded-[1.5rem] border border-zinc-200 bg-zinc-50/80 px-4 py-4 font-mono text-sm leading-6 text-zinc-800 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
                aria-label="Gold OHLC CSV input"
              />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-lg shadow-zinc-200/60 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-950">Live market feed</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Recommended API: {recommendedApi.name}
                  </p>
                </div>

                {hasLiveFeed ? (
                  <button
                    type="button"
                    onClick={() => revalidate()}
                    disabled={isRefreshing}
                    className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-amber-300 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRefreshing ? "Refreshing..." : "Refresh live feed"}
                  </button>
                ) : null}
              </div>

              {hasLiveFeed ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-medium text-emerald-800">
                      Live feed connected
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-950">
                      {liveMarket.latestPrice?.toFixed(2) ?? "N/A"}
                    </p>
                    <p className="mt-2 text-sm text-emerald-900">
                      {liveMarket.symbol} | {liveMarket.interval} candles
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-emerald-700">
                      Last candle {liveMarket.asOf ?? "Unknown"}
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50/80 p-4 text-sm leading-7 text-zinc-600">
                    {recommendedApi.note}{" "}
                    <a
                      href={recommendedApi.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-amber-700 underline decoration-amber-300 underline-offset-4"
                    >
                      View docs
                    </a>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/80 p-5 text-sm leading-7 text-zinc-600">
                  <p>
                    Live feed is not active yet. Add a server env var named{" "}
                    <span className="font-semibold text-zinc-900">TWELVE_DATA_API_KEY</span>{" "}
                    and optionally{" "}
                    <span className="font-semibold text-zinc-900">TWELVE_DATA_SYMBOL</span>{" "}
                    such as <span className="font-semibold text-zinc-900">XAU/USD</span>.
                  </p>
                  <p className="mt-3">
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

            <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-lg shadow-zinc-200/60 backdrop-blur">
              <h2 className="text-xl font-semibold text-zinc-950">Analysis</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Current dataset: {getDataSourceLabel(liveMarket)}
              </p>

              {result ? (
                <div className="mt-4 space-y-4">
                  <div className={`rounded-[1.5rem] border p-4 ${scoreTone?.panelClassName ?? ""}`}>
                    <p className="text-sm font-medium text-zinc-600">Probable trend read</p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-950">
                      {result.direction}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${scoreTone?.badgeClassName ?? ""}`}
                      >
                        Score {result.score}
                      </span>
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">
                        Trend {result.trend}
                      </span>
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">
                        {result.pattern.name}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50/80 p-4">
                    <p className="text-sm font-medium text-zinc-700">Pattern explanation</p>
                    <p className="mt-2 text-sm leading-7 text-zinc-600">
                      {result.pattern.reason}
                    </p>
                  </div>

                  {prediction ? (
                    <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50/80 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-medium text-sky-900">
                          Future candlestick analysis prediction
                        </p>
                        <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                          {prediction.confidenceLabel} confidence
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-sky-900">
                        {prediction.summary}
                      </p>
                      <p className="mt-2 text-xs leading-6 text-sky-800">
                        Projected candles are derived from recent candle range,
                        body size, and the current score bias. They are illustrative,
                        not live market data.
                      </p>
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricCard
                      label="Near support"
                      value={result.nearSupport ? "Yes" : "No"}
                    />
                    <MetricCard
                      label="Near resistance"
                      value={result.nearResistance ? "Yes" : "No"}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/80 p-5 text-sm leading-7 text-zinc-600">
                  Add at least 5 valid candles to generate an analysis card.
                </div>
              )}
            </section>

            <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-lg shadow-zinc-200/60 backdrop-blur">
              <h2 className="text-xl font-semibold text-zinc-950">Key levels</h2>

              {result ? (
                <div className="mt-4 space-y-3">
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
                    <span className="text-sm text-zinc-500">8 SMA</span>
                    <span className="font-semibold text-zinc-950">
                      {result.ma8?.toFixed(2) ?? "N/A"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-7 text-zinc-600">
                  Once enough candles are present, support, resistance, and moving
                  average values will appear here.
                </p>
              )}
            </section>

            <section className="rounded-[2rem] border border-amber-200 bg-amber-50/90 p-6 shadow-sm shadow-amber-100">
              <h2 className="text-lg font-semibold text-amber-950">Risk note</h2>
              <p className="mt-2 text-sm leading-7 text-amber-900">
                A live data feed makes the app fresher, but it still remains a
                rule-based estimator. The future trend suggestion is an inference
                from recent candles, not a guaranteed forecast.
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Welcome;
