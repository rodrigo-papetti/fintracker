import axios from 'axios';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// --- FRED (Federal Reserve) ---
export async function fetchFRED(seriesId) {
  const { data } = await axios.get(FRED_BASE, {
    params: {
      series_id: seriesId,
      api_key: process.env.FRED_API_KEY,
      file_type: 'json',
      limit: 30,
      sort_order: 'desc'
    }
  });
  const obs = data.observations.filter(o => o.value !== '.');
  const latest = obs[0];
  const prev = obs[7] || obs[obs.length - 1]; // ~1 week ago
  return {
    symbol: seriesId,
    value: parseFloat(latest.value),
    previousValue: parseFloat(prev.value),
    date: latest.date,
    change: parseFloat(latest.value) - parseFloat(prev.value),
    changePct: ((parseFloat(latest.value) - parseFloat(prev.value)) / Math.abs(parseFloat(prev.value))) * 100
  };
}

// --- Yahoo Finance (via unofficial quote endpoint) ---
export async function fetchYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const { data } = await axios.get(url, {
    params: { interval: '1d', range: '1mo' },
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const meta = data.chart.result[0].meta;
  const closes = data.chart.result[0].indicators.quote[0].close.filter(Boolean);
  const current = meta.regularMarketPrice;
  const weekAgo = closes[closes.length - 8] || closes[0];
  return {
    symbol,
    value: current,
    previousValue: weekAgo,
    change: current - weekAgo,
    changePct: ((current - weekAgo) / weekAgo) * 100,
    date: new Date().toISOString().split('T')[0]
  };
}

// --- CoinGecko ---
export async function fetchCoinGecko(coinId) {
  const { data } = await axios.get(`${COINGECKO_BASE}/coins/${coinId}/market_chart`, {
    params: { vs_currency: 'usd', days: 30, interval: 'daily' }
  });
  const prices = data.prices;
  const current = prices[prices.length - 1][1];
  const weekAgo = prices[prices.length - 8]?.[1] || prices[0][1];
  const fiveYearLow = Math.min(...prices.map(p => p[1]));
  const fiveYearHigh = Math.max(...prices.map(p => p[1]));
  const percentile = ((current - fiveYearLow) / (fiveYearHigh - fiveYearLow)) * 100;
  return {
    symbol: coinId,
    value: current,
    previousValue: weekAgo,
    change: current - weekAgo,
    changePct: ((current - weekAgo) / weekAgo) * 100,
    percentileIn30d: percentile.toFixed(1),
    date: new Date().toISOString().split('T')[0]
  };
}

// --- FX rates for portfolio conversion ---
export async function fetchFXRates(currencies) {
  const rates = { USD: 1 };
  const nonUSD = currencies.filter(c => c !== 'USD');
  if (!nonUSD.length) return rates;

  // Fetch all FX rates in parallel
  await Promise.all(nonUSD.map(async currency => {
    try {
      const result = await fetchYahoo(`${currency}=X`);
      rates[currency] = 1 / result.value;
    } catch {
      rates[currency] = null;
    }
  }));
  return rates;
}

// --- Fetch all watchlist items in parallel with 8s per-item timeout ---
export async function fetchAllMarketData(watchlist) {
  const TIMEOUT_MS = 8000;

  function withTimeout(promise) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS))
    ]);
  }

  const entries = await Promise.all(
    watchlist.map(async item => {
      try {
        let result;
        if (item.source === 'FRED') {
          result = await withTimeout(fetchFRED(item.symbol));
        } else if (item.source === 'CoinGecko') {
          result = await withTimeout(fetchCoinGecko(item.symbol));
        } else if (item.source === 'Yahoo') {
          result = await withTimeout(fetchYahoo(item.symbol));
        } else {
          return [item.id, { name: item.name, error: 'Unknown source' }];
        }
        return [item.id, { ...result, name: item.name, type: item.type }];
      } catch (e) {
        return [item.id, { name: item.name, type: item.type, error: e.message }];
      }
    })
  );

  return Object.fromEntries(entries);
}
