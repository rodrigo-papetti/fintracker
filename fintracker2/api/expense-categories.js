import { supabaseAdmin } from '../src/lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = supabaseAdmin();
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      const { data, error } = await db
        .from('expense_categories')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return res.json(data);
    }

    if (req.method === 'POST') {
      const { name, color } = req.body;
      const { data: existing } = await db.from('expense_categories').select('sort_order').order('sort_order', { ascending: false }).limit(1);
      const sort_order = (existing?.[0]?.sort_order || 0) + 1;
      const { data, error } = await db.from('expense_categories').insert({ name, color, sort_order }).select().single();
      if (error) throw error;
      return res.json(data);
    }

    if (req.method === 'PUT' && id) {
      const { name, color } = req.body;
      const { error } = await db.from('expense_categories').update({ name, color }).eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    }

    if (req.method === 'DELETE' && id) {
      const { error } = await db.from('expense_categories').delete().eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    }

    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
