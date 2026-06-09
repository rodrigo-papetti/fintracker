import { supabaseAdmin } from '../src/lib/supabase.js';
import { fetchFXRates } from '../src/lib/market.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = supabaseAdmin();

    const [{ data: assets }, { data: settings }, { data: history }] = await Promise.all([
      db.from('assets').select('*').order('created_at'),
      db.from('settings').select('*').eq('id', 1).single(),
      db.from('networth_history').select('*').order('recorded_at').limit(104)
    ]);

    const currencies = [...new Set(assets.filter(a => a.currency !== 'USD').map(a => a.currency))];
    const fxRates = await fetchFXRates(currencies);

    const totalNetWorth = assets.reduce((sum, a) => {
      const rate = a.currency === 'USD' ? 1 : (fxRates[a.currency] || 1);
      return sum + a.current_value * rate;
    }, 0);

    const assetsOut = assets.map(a => {
      const rate = a.currency === 'USD' ? 1 : (fxRates[a.currency] || 1);
      const usdValue = Math.round(a.current_value * rate);
      return {
        id: a.id,
        name: a.name,
        category: a.category,
        currency: a.currency,
        institution: a.institution,
        currentValue: a.current_value,
        usdValue,
        weight: parseFloat(((usdValue / totalNetWorth) * 100).toFixed(1)),
        fxRate: rate
      };
    });

    res.json({
      assets: assetsOut,
      netWorth: Math.round(totalNetWorth),
      netWorthHistory: history.map(h => ({ date: h.recorded_at, value: h.value })),
      settings: {
        baseCurrency: settings.base_currency,
        categories: settings.categories,
        watchlist: settings.watchlist
      },
      fxRates,
      lastUpdated: history.at(-1)?.recorded_at || null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
