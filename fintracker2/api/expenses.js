import { supabaseAdmin } from '../src/lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = supabaseAdmin();
  const { id, month, year } = req.query; // month = 1-12, year = 2026

  try {
    // GET - fetch expenses for a month or all months summary
    if (req.method === 'GET') {
      if (month && year) {
        // Fetch all expenses for a specific month
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // last day of month
        const { data, error } = await db
          .from('expenses')
          .select('*, expense_categories(id, name, color)')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false });
        if (error) throw error;
        return res.json(data);
      }

      // Fetch monthly summary for line chart (all months)
      const { data, error } = await db
        .from('expenses')
        .select('date, amount_usd, category_id, expense_categories(id, name, color)')
        .eq('status', 'categorized')
        .order('date');
      if (error) throw error;

      // Group by month + category
      const summary = {};
      data.forEach(e => {
        const monthKey = e.date.slice(0, 7); // YYYY-MM
        if (!summary[monthKey]) summary[monthKey] = {};
        const catId = e.category_id || 'uncategorized';
        summary[monthKey][catId] = (summary[monthKey][catId] || 0) + e.amount_usd;
      });

      // Also return available months list
      const months = [...new Set(
        (await db.from('expenses').select('date').order('date')).data?.map(e => e.date.slice(0, 7)) || []
      )].sort();

      return res.json({ summary, months });
    }

    // PUT - update a single expense (category, status, notes)
    if (req.method === 'PUT' && id) {
      const { category_id, status, notes, merchant } = req.body;
      const updates = { updated_at: new Date().toISOString() };
      if (category_id !== undefined) updates.category_id = category_id;
      if (status !== undefined) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      if (merchant !== undefined) updates.merchant = merchant;
      const { error } = await db.from('expenses').update(updates).eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    }

    // DELETE - remove a single expense
    if (req.method === 'DELETE' && id) {
      const { error } = await db.from('expenses').delete().eq('id', id);
      if (error) throw error;
      return res.json({ success: true });
    }

    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
