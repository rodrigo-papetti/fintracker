import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { formatUSD, formatDate } from '../lib/format.js';

const TYPE_STYLE = {
  risk:        { bg: 'var(--red-bg)',    border: 'var(--red-border)',   tag: 'var(--red)',    label: 'Risk'        },
  opportunity: { bg: 'var(--teal-bg)',   border: 'var(--teal-border)',  tag: 'var(--teal)',   label: 'Opportunity' },
  neutral:     { bg: 'var(--surface2)',  border: 'var(--border)',       tag: 'var(--muted)',  label: 'Neutral'     },
  watch:       { bg: 'var(--amber-bg)',  border: '#f0d4a0',             tag: 'var(--amber)',  label: 'Watch'       }
};

export default function ControlRoom() {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [refreshError, setRefreshError] = useState(null);

  useEffect(() => { load(); }, []);

  async function load(refresh = false) {
    try {
      if (refresh) { setRefreshing(true); setRefreshError(null); }
      else setLoading(true);
      const data = await api.getBriefing(refresh);
      setBriefing(data);
    } catch (e) {
      if (refresh) setRefreshError(e.message);
      else setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  if (loading) return <div className="spinner" />;
  if (error) return <div style={{ padding: 20, color: 'var(--red)' }}>Error: {error}</div>;

  const mkt = briefing?.marketData || {};
  const watchlist = briefing?.watchlist || [];

  // Top 6 in watchlist order — matches what user pinned in Settings
  const mktItems = watchlist
    .slice(0, 6)
    .map(w => mkt[w.id])
    .filter(Boolean);

  return (
    <div>
      {/* Market strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
        {mktItems.map((m, i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>{m.name}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 600 }}>
              {typeof m.value === 'number' ? m.value.toFixed(m.value > 100 ? 0 : 2) : '—'}
            </div>
            {m.changePct != null && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: 3, color: m.changePct >= 0 ? 'var(--teal)' : 'var(--red)' }}>
                {m.changePct >= 0 ? '▲' : '▼'} {Math.abs(m.changePct).toFixed(2)}% vs last visit
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="two-col">
        {/* Briefing */}
        <div className="panel">
          <div className="ph">
            <span className="pt">
              Briefing
              {briefing?.lastPortfolioUpdate && (
                <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>
                  — since {formatDate(briefing.lastPortfolioUpdate)}
                </span>
              )}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {refreshError && (
                <span style={{ fontSize: 11, color: 'var(--red)', maxWidth: 200, lineHeight: 1.4 }}>
                  {refreshError}
                </span>
              )}
              <button
                onClick={() => load(true)}
                disabled={refreshing}
                style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 6, padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <i className={`ti ti-refresh ${refreshing ? 'spin' : ''}`} style={{ fontSize: 12 }} aria-hidden="true" />
                {refreshing ? 'Generating…' : 'Refresh'}
              </button>
            </div>
          </div>
          <div className="pb">
            {briefing?.signals?.length ? briefing.signals.map((sig, i) => {
              const s = TYPE_STYLE[sig.type] || TYPE_STYLE.neutral;
              return (
                <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: i < briefing.signals.length - 1 ? 10 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: s.tag, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      {s.label}{sig.asset ? ` · ${sig.asset}` : ''}
                    </div>
                    {sig.indicator && (
                      <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>
                        {sig.indicator}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{sig.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.65, marginBottom: sig.action ? 8 : 0 }}>{sig.body}</div>
                  {sig.action && (
                    <div style={{ fontSize: 12, color: s.tag, fontWeight: 500, borderTop: `1px solid ${s.border}`, paddingTop: 8, lineHeight: 1.5 }}>
                      → {sig.action}
                    </div>
                  )}
                  {sig.source && <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 8 }}>{sig.source} — {formatDate(briefing.date)}</div>}
                </div>
              );
            }) : (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)', fontSize: 13 }}>
                No briefing yet. Click Refresh to generate.
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {briefing?.portfolioImpact && (
            <div className="panel">
              <div className="ph"><span className="pt">Portfolio impact</span></div>
              <div className="pb">
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>Mark-to-market Δ</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: briefing.portfolioImpact.markToMarketChange >= 0 ? 'var(--teal)' : 'var(--red)' }}>
                    {briefing.portfolioImpact.markToMarketChange >= 0 ? '+' : ''}{formatUSD(briefing.portfolioImpact.markToMarketChange)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>FX impact</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: briefing.portfolioImpact.fxImpact >= 0 ? 'var(--teal)' : 'var(--red)' }}>
                    {briefing.portfolioImpact.fxImpact >= 0 ? '+' : ''}{formatUSD(briefing.portfolioImpact.fxImpact)}
                  </span>
                </div>
                {briefing.portfolioImpact.summary && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, paddingTop: 10 }}>
                    {briefing.portfolioImpact.summary}
                  </div>
                )}
              </div>
            </div>
          )}

          {briefing?.questionsToConsider?.length > 0 && (
            <div className="panel">
              <div className="ph"><span className="pt">Questions to consider</span></div>
              <div className="pb" style={{ display: 'flex', flexDirection: 'column' }}>
                {briefing.questionsToConsider.map((q, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, padding: '8px 0', borderBottom: i < briefing.questionsToConsider.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    {q}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, color: 'var(--muted2)', lineHeight: 1.6, padding: '0 4px' }}>
            Briefing generated by AI using live market data. Not financial advice. Verify before acting.
          </div>
        </div>
      </div>
    </div>
  );
}
