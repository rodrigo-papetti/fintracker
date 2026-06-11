import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../src/lib/supabase.js';
import { fetchFXRates } from '../src/lib/market.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const db = supabaseAdmin();
    const { csvContent, profileId } = req.body;

    // Load institution profile
    const { data: profile, error: profileErr } = await db
      .from('institution_profiles')
      .select('*')
      .eq('id', profileId)
      .single();
    if (profileErr || !profile) throw new Error('Institution profile not found');

    // Load expense categories
    const { data: categories } = await db
      .from('expense_categories')
      .select('*')
      .order('sort_order');

    // Load confidence threshold
    const { data: settings } = await db
      .from('settings')
      .select('expense_confidence_threshold')
      .eq('id', 1)
      .single();
    const threshold = settings?.expense_confidence_threshold ?? 0.75;

    // Parse CSV rows
    const lines = csvContent.split('\n').map(l => l.trim()).filter(Boolean);
    const dataLines = lines.slice(profile.skip_rows);

    // Parse each row using profile column mapping
    const rows = dataLines.map((line, idx) => {
      const cols = parseCSVLine(line);
      const rawAmount = parseFloat((cols[profile.amount_column] || '0').replace(/[,$"]/g, ''));
      const description = (cols[profile.description_column] || '').replace(/"/g, '').trim();
      const date = (cols[profile.date_column] || '').replace(/"/g, '').trim();

      // Determine if expense based on sign convention
      const isExpense = profile.expense_is_positive ? rawAmount > 0 : rawAmount < 0;
      const amount = Math.abs(rawAmount);

      // Check exclude keywords
      const excludeKws = profile.exclude_keywords || [];
      const shouldExclude = excludeKws.some(kw =>
        description.toUpperCase().includes(kw.toUpperCase())
      );

      return { idx, date, description, amount, currency: profile.currency, isExpense, shouldExclude, raw: line };
    }).filter(r => r.isExpense && !r.shouldExclude && r.amount > 0 && r.description);

    if (rows.length === 0) {
      return res.json({ imported: 0, message: 'No expense transactions found after filtering.' });
    }

    // Fetch FX rates for currency conversion
    const currencies = [...new Set(rows.map(r => r.currency).filter(c => c !== 'USD'))];
    const fxRates = await fetchFXRates(currencies);

    // Batch LLM categorization
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const categoryList = categories.map(c => `- ${c.name} (id: ${c.id})`).join('\n');
    const transactionList = rows.map((r, i) =>
      `${i}: date=${r.date} | description="${r.description}" | amount=${r.amount} ${r.currency}`
    ).join('\n');

    const prompt = `You are categorizing personal finance transactions for a specific user.

INSTITUTION: ${profile.name} (${profile.type})
CSV FORMAT: date=col${profile.date_column}, description=col${profile.description_column}, amount=col${profile.amount_column}

AVAILABLE CATEGORIES:
${categoryList}

TRANSACTIONS TO CATEGORIZE (index: fields):
${transactionList}

For each transaction, determine:
1. The best matching category_id from the list above
2. A confidence score from 0.0 to 1.0 where:
   - 1.0 = absolutely certain (e.g. "NETFLIX" → Subscriptions)
   - 0.8 = very likely (e.g. "UBER" → Transport)
   - 0.6 = reasonable guess (e.g. "AMAZON" could be Shopping or Subscriptions)
   - 0.4 = uncertain (e.g. generic merchant name)
   - 0.2 = very uncertain or unrecognizable merchant
3. A clean merchant name extracted from the description (remove transaction IDs, dates, noise)

Rules:
- Exclude any transfers, ATM withdrawals, payments, credits, or refunds — mark these with category_id: null and confidence: 0
- If you cannot determine the category, set category_id: null and confidence: 0.2 or below
- Be consistent: same merchant always gets same category

Respond ONLY with a valid JSON array, no markdown, no preamble:
[
  {"index": 0, "category_id": "uuid-or-null", "confidence": 0.95, "merchant": "Clean Merchant Name"},
  ...
]`;

    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    let categorizations;
    try {
      categorizations = JSON.parse(message.content[0].text.replace(/```json|```/g, '').trim());
    } catch {
      throw new Error('Failed to parse LLM categorization response');
    }

    // Build expense records
    const expenseRecords = rows.map((row, i) => {
      const cat = categorizations.find(c => c.index === i) || { category_id: null, confidence: 0, merchant: row.description };
      const rate = row.currency === 'USD' ? 1 : (fxRates[row.currency] || 1);
      const amountUsd = row.currency === 'USD' ? row.amount : row.amount * rate;

      let status = 'categorized';
      if (!cat.category_id || cat.confidence === 0) {
        status = 'uncategorized';
      } else if (cat.confidence < threshold) {
        status = 'needs_review';
      }

      // Parse date robustly
      const parsedDate = parseDate(row.date);

      return {
        date: parsedDate,
        description: row.description,
        merchant: cat.merchant || row.description,
        amount_original: row.amount,
        currency_original: row.currency,
        amount_usd: parseFloat(amountUsd.toFixed(2)),
        category_id: status === 'categorized' ? cat.category_id : null,
        status,
        confidence: cat.confidence,
        institution_profile_id: profileId
      };
    }).filter(r => r.date); // drop rows with unparseable dates

    // Insert all records
    const { error: insertErr } = await db.from('expenses').insert(expenseRecords);
    if (insertErr) throw insertErr;

    const summary = {
      imported: expenseRecords.length,
      categorized: expenseRecords.filter(r => r.status === 'categorized').length,
      needs_review: expenseRecords.filter(r => r.status === 'needs_review').length,
      uncategorized: expenseRecords.filter(r => r.status === 'uncategorized').length
    };

    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function parseCSVLine(line) {
  const cols = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes; continue; }
    if (line[i] === ',' && !inQuotes) { cols.push(current); current = ''; continue; }
    current += line[i];
  }
  cols.push(current);
  return cols;
}

function parseDate(raw) {
  if (!raw) return null;
  // Try common formats: MM/DD/YYYY, YYYY-MM-DD, DD/MM/YYYY, MM-DD-YYYY
  const cleaned = raw.trim().replace(/"/g, '');
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // MM/DD/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/, // MM-DD-YYYY
  ];
  for (const fmt of formats) {
    const m = cleaned.match(fmt);
    if (m) {
      if (fmt.source.startsWith('^(\\d{4})')) return `${m[1]}-${m[2]}-${m[3]}`;
      return `${m[3]}-${m[1]}-${m[2]}`;
    }
  }
  // Fallback: let JS parse it
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}
