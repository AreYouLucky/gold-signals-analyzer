import { Welcome } from "../welcome/welcome";

import type { Route } from "./+types/home";
import { getLiveGoldSnapshot } from "~/services/gold";

function parseOutputSize(value: string | undefined): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120;
}

export function meta({}: Route.MetaArgs): Route.MetaDescriptors {
  return [
    { title: "Gold Signals Analyzer" },
    {
      name: "description",
      content: "Analyze live or manual gold market candles with a simple trend model.",
    },
  ];
}

export async function loader(): Promise<{
  liveMarket: Awaited<ReturnType<typeof getLiveGoldSnapshot>> | null;
  liveMarketError: string | null;
  recommendedApi: {
    docsUrl: string;
    name: string;
    note: string;
  };
}> {
  const recommendedApi = {
    docsUrl: "https://twelvedata.com/docs",
    name: "Twelve Data",
    note: "Twelve Data is a strong fit here because its time_series endpoint returns OHLC candles and supports symbols like EUR/USD style pairs, which is what this analyzer needs.",
  };

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  const interval = process.env.TWELVE_DATA_INTERVAL ?? "5min";
  const outputSize = parseOutputSize(process.env.TWELVE_DATA_OUTPUT_SIZE);
  const symbol = process.env.TWELVE_DATA_SYMBOL ?? "XAU/USD";

  if (!apiKey) {
    return {
      liveMarket: null,
      liveMarketError: null,
      recommendedApi,
    };
  }

  try {
    const liveMarket = await getLiveGoldSnapshot({
      apiKey,
      interval,
      outputSize,
      symbol,
    });

    return {
      liveMarket,
      liveMarketError: null,
      recommendedApi,
    };
  } catch (error: unknown) {
    return {
      liveMarket: null,
      liveMarketError: error instanceof Error ? error.message : "Unable to load live market data.",
      recommendedApi,
    };
  }
}

export default function Home({ loaderData }: Route.ComponentProps): React.JSX.Element {
  return (
    <Welcome
      liveMarket={loaderData.liveMarket}
      liveMarketError={loaderData.liveMarketError}
      recommendedApi={loaderData.recommendedApi}
    />
  );
}
