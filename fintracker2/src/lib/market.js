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
  for (const currency of currencies) {
    if (currency === 'USD') continue;
    try {
      const symbol = `${currency}=X`;
      const result = await fetchYahoo(symbol);
      // Yahoo BRL=X, KRW=X returns units of foreign currency per 1 USD — invert it
      rates[currency] = 1 / result.value;
    } catch {
      rates[currency] = null;
    }
  }
  return rates;
}

// --- Fetch all watchlist items ---
export async function fetchAllMarketData(watchlist) {
  const results = {};
  for (const item of watchlist) {
    try {
      if (item.source === 'FRED') {
        results[item.id] = { ...await fetchFRED(item.symbol), name: item.name, type: item.type };
      } else if (item.source === 'CoinGecko') {
        results[item.id] = { ...await fetchCoinGecko(item.symbol), name: item.name, type: item.type };
      } else if (item.source === 'Yahoo') {
        results[item.id] = { ...await fetchYahoo(item.symbol), name: item.name, type: item.type };
      }
    } catch (e) {
      results[item.id] = { name: item.name, error: e.message };
    }
  }
  return results;
}
