import { supabaseAdmin } from '../src/lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PUT') return res.status(405).end();

  try {
    const db = supabaseAdmin();
    const updates = {};
    if (req.body.baseCurrency)  updates.base_currency = req.body.baseCurrency;
    if (req.body.categories)    updates.categories = req.body.categories;
    if (req.body.watchlist)     updates.watchlist = req.body.watchlist;
    updates.updated_at = new Date().toISOString();

    const { error } = await db.from('settings').update(updates).eq('id', 1);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
