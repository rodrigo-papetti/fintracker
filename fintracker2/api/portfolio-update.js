import { supabaseAdmin } from '../src/lib/supabase.js';
import { fetchFXRates } from '../src/lib/market.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const db = supabaseAdmin();
    const { updates } = req.body; // [{ id, newValue }]
    const today = new Date().toISOString().split('T')[0];

    // Fetch current assets to snapshot history
    const { data: assets } = await db.from('assets').select('*');

    // Write history entries for updated assets
    const historyRows = updates.map(u => ({
      asset_id: u.id,
      value: u.newValue,
      recorded_at: today
    }));
    await db.from('asset_history').insert(historyRows);

    // Update current values
    for (const u of updates) {
      await db.from('assets').update({ current_value: u.newValue, updated_at: new Date().toISOString() }).eq('id', u.id);
    }

    // Snapshot net worth
    const updatedMap = Object.fromEntries(updates.map(u => [u.id, u.newValue]));
    const currencies = [...new Set(assets.filter(a => a.currency !== 'USD').map(a => a.currency))];
    const fxRates = await fetchFXRates(currencies);

    const netWorth = assets.reduce((sum, a) => {
      const val = updatedMap[a.id] ?? a.current_value;
      const rate = a.currency === 'USD' ? 1 : (fxRates[a.currency] || 1);
      return sum + val * rate;
    }, 0);

    await db.from('networth_history').insert({ value: Math.round(netWorth), recorded_at: today });

    res.json({ success: true, netWorth: Math.round(netWorth) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
