import { format, LRU, subDays } from "./deps.ts";
import { getPricesById, Price } from "./price.ts";

const priceChangeCache = new LRU({ capacity: 100000 });

type PriceChangeResult = {
  type: "priceChange";
  value: Price;
};

type PriceChangeUnavailable = {
  type: "priceChangeUnavailable";
};

type PriceChange = PriceChangeUnavailable | PriceChangeResult;

export const getPriceChange = async (
  id: string,
  daysAgo: number,
): Promise<PriceChange> => {
  const cacheKey = `priceChange-${id}-${daysAgo}`;
  if (priceChangeCache.has(cacheKey)) {
    return priceChangeCache.get(cacheKey);
  }

  const now = new Date();
  const historicDate = subDays(now, daysAgo);
  const uri = `https://api.coingecko.com/api/v3/coins/${id}/history?date=${
    format(historicDate, "dd-MM-yyyy", {})
  }`;
  const res = await fetch(uri);

  if (res.status !== 200) {
    const err = await res.text();
    console.error(
      `coingecko bad response, ${res.status} ${res.statusText} - ${err}`,
    );
    throw new Error(err);
  }

  const history = await res.json();

  if (history.error !== undefined) {
    throw new Error(history.error);
  }

  if (history.market_data === undefined) {
    return { type: "priceChangeUnavailable" };
  }

  const historicPrice = {
    usd: history.market_data.current_price.usd,
    btc: history.market_data.current_price.btc,
    eth: history.market_data.current_price.eth,
  };

  const currentPrice = await getPricesById(id);

  const priceChange = {
    usd: currentPrice.usd / historicPrice.usd - 1,
    btc: currentPrice.btc / historicPrice.btc - 1,
    eth: currentPrice.eth / historicPrice.eth - 1,
  };

  priceChangeCache.set(cacheKey, priceChange);

  return { type: "priceChange", value: priceChange };
};
