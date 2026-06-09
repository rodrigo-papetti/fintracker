import { supabaseAdmin } from '../src/lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = supabaseAdmin();
  const { id } = req.query;

  try {
    if (req.method === 'POST') {
      const { name, category, currency, institution, currentValue } = req.body;
      const { data, error } = await db.from('assets').insert({
        name, category, currency, institution,
        current_value: parseFloat(currentValue)
      }).select().single();
      if (error) throw error;
      return res.json(data);
    }

    if (req.method === 'PUT' && id) {
      const { name, category, currency, institution, currentValue } = req.body;
      const { error } = await db.from('assets').update({
        name, category, currency, institution,
        current_value: parseFloat(currentValue),
        updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    }

    if (req.method === 'DELETE' && id) {
      const { error } = await db.from('assets').delete().eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    }

    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
