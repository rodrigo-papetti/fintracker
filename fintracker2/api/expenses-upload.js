import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../src/lib/supabase.js';
import { fetchFXRates } from '../src/lib/market.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const db = supabaseAdmin();
    const { fileContent, fileType, profileId } = req.body;
    // fileContent: base64 for PDF, raw text for CSV
    // fileType: 'csv' | 'pdf'

    const { data: profile, error: profileErr } = await db
      .from('institution_profiles')
      .select('*')
      .eq('id', profileId)
      .single();
    if (profileErr || !profile) throw new Error('Institution profile not found');

    const { data: categories } = await db
      .from('expense_categories')
      .select('*')
      .order('sort_order');

    const { data: settings } = await db
      .from('settings')
      .select('expense_confidence_threshold')
      .eq('id', 1)
      .single();
    const threshold = settings?.expense_confidence_threshold ?? 0.75;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const categoryList = categories.map(c => `- ${c.name} (id: ${c.id})`).join('\n');

    let rows;

    if (fileType === 'pdf') {
      // ── PDF path: send to Claude as document, extract + categorize in one call ──
      rows = await extractAndCategorizePDF({
        anthropic, fileContent, profile, categories, categoryList, threshold
      });
    } else {
      // ── CSV path: parse locally, then batch-categorize ──
      rows = await parseCSVRows(fileContent, profile);
      if (rows.length === 0) {
        return res.json({ imported: 0, message: 'No expense transactions found after filtering.' });
      }
      rows = await categorizeRows({ anthropic, rows, profile, categoryList, threshold });
    }

    if (rows.length === 0) {
      return res.json({ imported: 0, message: 'No expense transactions found.' });
    }

    // FX conversion
    const currencies = [...new Set(rows.map(r => r.currency).filter(c => c !== 'USD'))];
    const fxRates = await fetchFXRates(currencies);

    const expenseRecords = rows.map(row => {
      const rate = row.currency === 'USD' ? 1 : (fxRates[row.currency] || 1);
      const amountUsd = row.currency === 'USD' ? row.amount : row.amount * rate;
      return {
        date: row.date,
        description: row.description,
        merchant: row.merchant || row.description,
        amount_original: row.amount,
        currency_original: row.currency,
        amount_usd: parseFloat(amountUsd.toFixed(2)),
        category_id: row.status === 'categorized' ? row.category_id : null,
        status: row.status,
        confidence: row.confidence,
        institution_profile_id: profileId
      };
    }).filter(r => r.date);

    const { error: insertErr } = await db.from('expenses').insert(expenseRecords);
    if (insertErr) throw insertErr;

    res.json({
      imported: expenseRecords.length,
      categorized: expenseRecords.filter(r => r.status === 'categorized').length,
      needs_review: expenseRecords.filter(r => r.status === 'needs_review').length,
      uncategorized: expenseRecords.filter(r => r.status === 'uncategorized').length
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// ── CSV: parse rows locally using column mapping ──────────────────────────────

function parseCSVRows(csvContent, profile) {
  const lines = csvContent.split('\n').map(l => l.trim()).filter(Boolean);
  const dataLines = lines.slice(profile.skip_rows);
  const excludeKws = profile.exclude_keywords || [];

  return dataLines.map((line, idx) => {
    const cols = parseCSVLine(line);
    const rawAmount = parseFloat((cols[profile.amount_column] || '0').replace(/[,$"]/g, ''));
    const description = (cols[profile.description_column] || '').replace(/"/g, '').trim();
    const date = (cols[profile.date_column] || '').replace(/"/g, '').trim();
    const isExpense = profile.expense_is_positive ? rawAmount > 0 : rawAmount < 0;
    const amount = Math.abs(rawAmount);
    const shouldExclude = excludeKws.some(kw => description.toUpperCase().includes(kw.toUpperCase()));
    return { idx, date: parseDate(date), description, amount, currency: profile.currency, isExpense, shouldExclude };
  }).filter(r => r.isExpense && !r.shouldExclude && r.amount > 0 && r.description && r.date);
}

// ── CSV: batch categorize parsed rows ────────────────────────────────────────

async function categorizeRows({ anthropic, rows, profile, categoryList, threshold }) {
  const transactionList = rows.map((r, i) =>
    `${i}: date=${r.date} | description="${r.description}" | amount=${r.amount} ${r.currency}`
  ).join('\n');

  const prompt = buildCategorizationPrompt({ profile, categoryList, transactionList, fileType: 'csv' });

  const message = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  });

  const categorizations = JSON.parse(message.content[0].text.replace(/```json|```/g, '').trim());

  return rows.map((row, i) => {
    const cat = categorizations.find(c => c.index === i) || { category_id: null, confidence: 0, merchant: row.description };
    const status = getStatus(cat, threshold);
    return { ...row, ...cat, status };
  });
}

// ── PDF: extract text via Claude document API, then extract + categorize ──────

async function extractAndCategorizePDF({ anthropic, fileContent, profile, categories, categoryList, threshold }) {
  const excludeList = (profile.exclude_keywords || []).join(', ') || 'none';

  const prompt = `You are processing a bank or credit card statement PDF for a personal finance tracker.

INSTITUTION: ${profile.name} (${profile.type})
CURRENCY: ${profile.currency}
EXCLUDE these transaction types (skip them entirely): transfers, ATM withdrawals, payments, credits, refunds, and any description containing: ${excludeList}

AVAILABLE EXPENSE CATEGORIES:
${categoryList}

Your task:
1. Find all expense/debit transactions in this statement
2. For each transaction extract: date, description, amount
3. Categorize each transaction and assign a confidence score

Rules:
- Only include actual spending transactions (no transfers, payments, credits, refunds, ATM)
- Amount should always be a positive number
- Date format: YYYY-MM-DD
- Confidence: 1.0=certain, 0.8=likely, 0.6=reasonable, 0.4=uncertain, 0.2=unrecognizable
- Clean merchant name: remove transaction IDs, reference numbers, noise

Respond ONLY with a valid JSON array, no markdown, no preamble:
[
  {
    "index": 0,
    "date": "2026-05-15",
    "description": "original description from statement",
    "merchant": "Clean Merchant Name",
    "amount": 45.90,
    "category_id": "uuid-or-null",
    "confidence": 0.95
  },
  ...
]`;

  const message = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: fileContent }
        },
        { type: 'text', text: prompt }
      ]
    }]
  });

  const extracted = JSON.parse(message.content[0].text.replace(/```json|```/g, '').trim());

  return extracted.map(item => ({
    date: item.date,
    description: item.description,
    merchant: item.merchant,
    amount: item.amount,
    currency: profile.currency,
    category_id: item.category_id,
    confidence: item.confidence,
    status: getStatus(item, threshold)
  })).filter(r => r.date && r.amount > 0);
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function buildCategorizationPrompt({ profile, categoryList, transactionList, fileType }) {
  return `You are categorizing personal finance transactions for a specific user.

INSTITUTION: ${profile.name} (${profile.type})
${fileType === 'csv' ? `CSV FORMAT: date=col${profile.date_column}, description=col${profile.description_column}, amount=col${profile.amount_column}` : ''}

AVAILABLE CATEGORIES:
${categoryList}

TRANSACTIONS TO CATEGORIZE (index: fields):
${transactionList}

For each transaction determine:
1. The best matching category_id from the list above
2. A confidence score 0.0–1.0: 1.0=certain, 0.8=likely, 0.6=reasonable guess, 0.4=uncertain, 0.2=unrecognizable
3. A clean merchant name (remove transaction IDs, dates, noise)

Rules:
- Mark transfers, ATM, payments, credits, refunds with category_id: null and confidence: 0
- Be consistent: same merchant always gets same category

Respond ONLY with a valid JSON array, no markdown:
[{"index": 0, "category_id": "uuid-or-null", "confidence": 0.95, "merchant": "Name"}, ...]`;
}

function getStatus(cat, threshold) {
  if (!cat.category_id || cat.confidence === 0) return 'uncategorized';
  if (cat.confidence < threshold) return 'needs_review';
  return 'categorized';
}

function parseCSVLine(line) {
  const cols = []; let current = ''; let inQuotes = false;
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
  const cleaned = raw.trim().replace(/"/g, '');
  const fmts = [/^(\d{4})-(\d{2})-(\d{2})$/, /^(\d{2})\/(\d{2})\/(\d{4})$/, /^(\d{2})-(\d{2})-(\d{4})$/];
  for (const fmt of fmts) {
    const m = cleaned.match(fmt);
    if (m) return fmt.source.startsWith('^(\\d{4})') ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[1]}-${m[2]}`;
  }
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}
