import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../src/lib/supabase.js';
import { fetchAllMarketData, fetchFXRates } from '../src/lib/market.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = supabaseAdmin();
    const today = new Date().toISOString().split('T')[0];
    const refresh = req.query.refresh === '1';

    // Return cached briefing if generated today and no refresh requested
    const { data: cache } = await db.from('briefing_cache').select('*').eq('id', 1).single();
    if (!refresh && cache?.data && cache.generated_at?.startsWith(today)) {
      return res.json(cache.data);
    }

    // Fetch portfolio + settings
    const [{ data: assets }, { data: settings }, { data: history }] = await Promise.all([
      db.from('assets').select('*'),
      db.from('settings').select('*').eq('id', 1).single(),
      db.from('networth_history').select('*').order('recorded_at', { ascending: false }).limit(1)
    ]);

    const lastUpdated = history[0]?.recorded_at || null;
    const daysSince = lastUpdated ? Math.round((new Date(today) - new Date(lastUpdated)) / 86400000) : null;

    // FX + weights
    const currencies = [...new Set(assets.filter(a => a.currency !== 'USD').map(a => a.currency))];
    const fxRates = await fetchFXRates(currencies);
    const totalNetWorth = assets.reduce((sum, a) => {
      const rate = a.currency === 'USD' ? 1 : (fxRates[a.currency] || 1);
      return sum + a.current_value * rate;
    }, 0);
    const assetsForPrompt = assets.map(a => {
      const rate = a.currency === 'USD' ? 1 : (fxRates[a.currency] || 1);
      const usdValue = Math.round(a.current_value * rate);
      return { name: a.name, category: a.category, usdValue, weight: ((usdValue / totalNetWorth) * 100).toFixed(1) };
    });

    // Market data
    const marketData = await fetchAllMarketData(settings.watchlist);

    const prompt = `You are a personal finance analyst generating a portfolio briefing for a specific investor.

INVESTOR PORTFOLIO (last updated ${lastUpdated || 'unknown'}${daysSince ? `, ${daysSince} days ago` : ''}):
${assetsForPrompt.map(a => `- ${a.name} (${a.category}): $${a.usdValue.toLocaleString()} — ${a.weight}% of portfolio`).join('\n')}
Total net worth: $${Math.round(totalNetWorth).toLocaleString()}

CURRENT MARKET DATA (changes vs ~1 week ago):
${Object.values(marketData).map(m => {
  if (m.error) return `- ${m.name}: data unavailable`;
  const chg = m.changePct != null ? `${m.changePct > 0 ? '+' : ''}${m.changePct.toFixed(2)}%` : '';
  const extra = m.percentileIn30d ? ` | 30d percentile: ${m.percentileIn30d}%` : '';
  return `- ${m.name}: ${typeof m.value === 'number' ? m.value.toFixed(2) : m.value} (${chg}${extra})`;
}).join('\n')}

Generate a JSON briefing with this exact structure — no markdown, no preamble, only valid JSON:
{
  "signals": [
    {
      "type": "risk" | "opportunity" | "neutral" | "watch",
      "asset": "which portfolio asset or category this relates to (include weight %)",
      "title": "concise headline, max 10 words",
      "body": "2-4 sentences. Reference actual numbers, actual % changes, actual dollar impact where possible. Never fabricate price forecasts.",
      "source": "data sources used"
    }
  ],
  "portfolioImpact": {
    "markToMarketChange": number,
    "fxImpact": number,
    "summary": "one sentence overall assessment"
  },
  "questionsToConsider": ["question 1", "question 2", "question 3"]
}

Rules: max 4 signals. Only signals relevant to this investor's actual positions. Be specific and quantitative.`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    let briefing;
    try {
      briefing = JSON.parse(message.content[0].text.replace(/```json|```/g, '').trim());
    } catch {
      briefing = { error: 'Parse failed', raw: message.content[0].text };
    }

    const result = { ...briefing, marketData, date: today, lastPortfolioUpdate: lastUpdated, daysSinceUpdate: daysSince };

    await db.from('briefing_cache').update({ data: result, generated_at: new Date().toISOString() }).eq('id', 1);

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
