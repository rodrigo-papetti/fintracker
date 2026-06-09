import { supabaseAdmin } from '../src/lib/supabase.js';
import { fetchAllMarketData } from '../src/lib/market.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = supabaseAdmin();
    const { data: settings } = await db.from('settings').select('watchlist').eq('id', 1).single();
    const marketData = await fetchAllMarketData(settings.watchlist);
    res.json(marketData);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
