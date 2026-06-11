import { supabaseAdmin } from '../src/lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = supabaseAdmin();
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      const { data, error } = await db.from('institution_profiles').select('*').order('created_at');
      if (error) throw error;
      return res.json(data);
    }

    if (req.method === 'POST') {
      const { data, error } = await db.from('institution_profiles').insert(req.body).select().single();
      if (error) throw error;
      return res.json(data);
    }

    if (req.method === 'PUT' && id) {
      const { error } = await db.from('institution_profiles').update(req.body).eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    }

    if (req.method === 'DELETE' && id) {
      const { error } = await db.from('institution_profiles').delete().eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    }

    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
