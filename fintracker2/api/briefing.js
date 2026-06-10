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

    // Return cached briefing if generated today, has signals, and no refresh requested
    const { data: cache } = await db.from('briefing_cache').select('*').eq('id', 1).single();
    if (!refresh && cache?.data?.signals?.length && cache.generated_at?.startsWith(today)) {
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

    // Market data — fetch all, preserve watchlist order
    const marketData = await fetchAllMarketData(settings.watchlist);

    // Top 6 pinned indicators (watchlist order)
    const pinnedIndicators = settings.watchlist.slice(0, 6).map(w => {
      const m = marketData[w.id];
      if (!m || m.error) return `- ${w.name}: data unavailable`;
      const chg = m.changePct != null ? `${m.changePct > 0 ? '+' : ''}${m.changePct.toFixed(2)}%` : '';
      const extra = m.percentileIn30d ? ` | 30d percentile: ${m.percentileIn30d}%` : '';
      return `- ${w.name} [${w.source}/${w.symbol}]: ${typeof m.value === 'number' ? m.value.toFixed(2) : m.value} (${chg}${extra})`;
    }).join('\n');

    // All other watchlist items
    const otherIndicators = settings.watchlist.slice(6).map(w => {
      const m = marketData[w.id];
      if (!m || m.error) return `- ${w.name}: data unavailable`;
      const chg = m.changePct != null ? `${m.changePct > 0 ? '+' : ''}${m.changePct.toFixed(2)}%` : '';
      return `- ${w.name} [${w.source}/${w.symbol}]: ${typeof m.value === 'number' ? m.value.toFixed(2) : m.value} (${chg})`;
    }).join('\n');

    const prompt = `You are a personal finance analyst generating a portfolio briefing for a specific investor.

INVESTOR PORTFOLIO (last updated ${lastUpdated || 'unknown'}${daysSince ? `, ${daysSince} days ago` : ''}):
${assetsForPrompt.map(a => `- ${a.name} (${a.category}): $${a.usdValue.toLocaleString()} — ${a.weight}% of portfolio`).join('\n')}
Total net worth: $${Math.round(totalNetWorth).toLocaleString()}

PINNED INDICATORS (shown prominently in the investor's dashboard — these must drive your signals):
${pinnedIndicators}
${otherIndicators ? `\nADDITIONAL WATCHLIST DATA (use to enrich signals, not required to reference all):\n${otherIndicators}` : ''}

CRITICAL INSTRUCTIONS FOR SIGNAL GENERATION:
Each signal must do ALL of the following:
1. Start from a specific portfolio position (name it, include its current weight %)
2. Reference at least one pinned indicator by name with its actual current value and recent change
3. Draw an explicit cross-asset connection — if a position is at risk, name a specific alternative from the pinned indicators that represents a better opportunity right now (e.g. "consider rotating from X into Y which is at Z-year low / all-time high yield / etc.")
4. Be actionable: end with a concrete rebalancing question or threshold (e.g. "worth considering if yield crosses 5%", "a 5-10% allocation shift may reduce duration risk")

Example of the quality expected:
"Your US Treasury Bonds (37% of portfolio) face continued price pressure as the 10Y yield sits at 4.81%, up 42bps since your last update. Gold (GC=F) has risen 3.2% over the same period and is often inversely correlated with real yields — if you believe rates stay elevated, a partial rotation from long-duration bonds into gold or a short-duration alternative is worth evaluating."

Generate a JSON briefing with this exact structure — no markdown, no preamble, only valid JSON:
{
  "signals": [
    {
      "type": "risk" | "opportunity" | "neutral" | "watch",
      "asset": "portfolio position this signal is about (name + weight %)",
      "indicator": "the pinned indicator(s) driving this signal",
      "title": "concise headline, max 12 words",
      "body": "3-5 sentences following the 4 instructions above. Actual numbers required. No fabricated forecasts.",
      "action": "one sentence: the specific rebalancing action or threshold to watch",
      "source": "data sources referenced"
    }
  ],
  "portfolioImpact": {
    "markToMarketChange": number,
    "fxImpact": number,
    "summary": "one sentence overall assessment referencing specific indicator movements"
  },
  "questionsToConsider": [
    "question referencing a specific position AND a specific indicator",
    "question referencing a specific position AND a specific indicator",
    "question referencing a specific position AND a specific indicator"
  ]
}

Rules: 3-4 signals maximum. Every signal must reference a pinned indicator. Questions must be cross-asset. Be specific and quantitative throughout.`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    let briefing;
    try {
      briefing = JSON.parse(message.content[0].text.replace(/```json|```/g, '').trim());
    } catch {
      briefing = { error: 'Parse failed', raw: message.content[0].text };
    }

    const result = { ...briefing, marketData, watchlist: settings.watchlist, date: today, lastPortfolioUpdate: lastUpdated, daysSinceUpdate: daysSince };

    await db.from('briefing_cache').update({ data: result, generated_at: new Date().toISOString() }).eq('id', 1);

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
