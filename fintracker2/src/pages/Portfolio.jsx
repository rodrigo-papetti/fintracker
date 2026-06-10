import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api.js';
import { formatUSD, formatPct, formatDate, daysSince, getCategoryColor } from '../lib/format.js';

export default function Portfolio({ onOpenUpdate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState('6M');

  useEffect(() => {
    api.getPortfolio()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;
  if (error) return <div style={{ padding: 20, color: 'var(--red)' }}>Error: {error}</div>;
  if (!data) return null;

  const { assets, netWorth, netWorthHistory, lastUpdated, settings } = data;
  const ds = daysSince(lastUpdated);

  const filteredHistory = (() => {
    if (!netWorthHistory?.length) return [];
    const cutoffs = { '3M': 90, '6M': 180, '1Y': 365, 'All': 99999 };
    const days = cutoffs[range] || 180;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return netWorthHistory.filter(h => h.date >= cutoff);
  })();

  // Group by category for allocation chart
  const byCategory = {};
  assets.forEach(a => {
    byCategory[a.category] = (byCategory[a.category] || 0) + a.usdValue;
  });
  const totalCheck = Object.values(byCategory).reduce((s, v) => s + v, 0);

  // Donut data
  const donutSegments = Object.entries(byCategory).map(([cat, val]) => ({
    category: cat,
    value: val,
    pct: ((val / totalCheck) * 100).toFixed(1),
    color: getCategoryColor(cat, settings?.categories)
  })).sort((a, b) => b.value - a.value);

  const brlRate = data.fxRates?.BRL ? 1 / data.fxRates.BRL : null;
  const netWorthBRL = brlRate ? netWorth * brlRate : null;

  return (
    <div>
      {/* Metrics row */}
      <div className="metrics-row">
        <div className="mc">
          <div className="mc-label">Net worth</div>
          <div className="mc-val">{formatUSD(netWorth)}</div>
          {netWorthBRL && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--muted)', marginTop: 2 }}>
              R$ {formatNumber(Math.round(netWorthBRL))}
            </div>
          )}
          <div className="mc-sub" style={{ color: 'var(--muted)', marginTop: 3 }}>
            {lastUpdated ? `Updated ${formatDate(lastUpdated)}${ds ? ` · ${ds}d ago` : ''}` : 'Not yet updated'}
          </div>
        </div>
        {donutSegments.slice(0, 3).map(seg => (
          <div className="mc" key={seg.category}>
            <div className="mc-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: seg.color, display: 'inline-block' }} />
              {settings?.categories?.find(c => c.id === seg.category)?.name || seg.category}
            </div>
            <div className="mc-val">{formatUSD(seg.value)}</div>
            {netWorthBRL && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                R$ {formatNumber(Math.round(seg.value * brlRate))}
              </div>
            )}
            <div className="mc-sub">{seg.pct}% of portfolio</div>
          </div>
        ))}
      </div>

      <div className="two-col">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Chart */}
          <div className="panel">
            <div className="ph">
              <span className="pt">Net worth over time</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {['3M', '6M', '1Y', 'All'].map(r => (
                  <button key={r} onClick={() => setRange(r)} style={{
                    background: range === r ? 'var(--teal-bg)' : 'none',
                    color: range === r ? 'var(--teal)' : 'var(--muted)',
                    border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 500,
                    padding: '3px 8px', cursor: 'pointer'
                  }}>{r}</button>
                ))}
              </div>
            </div>
            <div className="pb">
              {filteredHistory.length > 1 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={filteredHistory} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted2)' }} tickLine={false} axisLine={false} tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      formatter={v => [formatUSD(v), 'Net worth']}
                      labelFormatter={l => formatDate(l)}
                    />
                    <Line type="monotone" dataKey="value" stroke="var(--teal)" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  Chart will appear after your first portfolio update
                </div>
              )}
            </div>
          </div>

          {/* Asset table */}
          <div className="panel">
            <div className="ph">
              <span className="pt">Assets</span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{assets.length} assets · USD base</span>
            </div>
            <div style={{ padding: '0 4px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Asset', 'Category', 'Value (USD)', 'Weight'].map(h => (
                      <th key={h} style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, letterSpacing: '.05em', textTransform: 'uppercase', padding: '7px 8px', borderBottom: '1px solid var(--border)', textAlign: h === 'Value (USD)' || h === 'Weight' ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assets.map(asset => {
                    const catColor = getCategoryColor(asset.category, settings?.categories);
                    const catName = settings?.categories?.find(c => c.id === asset.category)?.name || asset.category;
                    return (
                      <tr key={asset.id} style={{ cursor: 'default' }} onMouseEnter={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = 'var(--surface2)')} onMouseLeave={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = '')}>
                        <td style={{ padding: '9px 8px', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{asset.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{asset.institution} · {asset.currency}</div>
                        </td>
                        <td style={{ padding: '9px 8px', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ background: catColor + '22', color: catColor, fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 4 }}>{catName}</span>
                        </td>
                        <td style={{ padding: '9px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500 }}>
                          {formatUSD(asset.usdValue)}
                          {asset.currency !== 'USD' && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{formatNumber(asset.currentValue)} {asset.currency}</div>}
                        </td>
                        <td style={{ padding: '9px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>{asset.weight}%</span>
                          <div style={{ width: 48, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', display: 'inline-block', verticalAlign: 'middle', marginLeft: 5 }}>
                            <div style={{ width: `${asset.weight}%`, height: '100%', background: catColor, borderRadius: 2 }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Allocation donut */}
          <div className="panel">
            <div className="ph"><span className="pt">Allocation</span></div>
            <div className="pb">
              <DonutChart segments={donutSegments} total={netWorth} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 14 }}>
                {donutSegments.map(seg => (
                  <div key={seg.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, display: 'inline-block', flexShrink: 0 }} />
                      {settings?.categories?.find(c => c.id === seg.category)?.name || seg.category}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{seg.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick signal preview */}
          <QuickSignalPreview />
        </div>
      </div>
    </div>
  );
}

function formatNumber(v) {
  return new Intl.NumberFormat('en-US').format(v);
}

function DonutChart({ segments, total }) {
  const R = 54, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" width={120} height={120} style={{ display: 'block', margin: '0 auto' }}>
      {segments.map(seg => {
        const dash = (parseFloat(seg.pct) / 100) * C;
        const el = (
          <circle key={seg.category} cx={70} cy={70} r={R} fill="none"
            stroke={seg.color} strokeWidth={20}
            strokeDasharray={`${dash} ${C}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 70 70)"
          />
        );
        offset += dash;
        return el;
      })}
      <text x={70} y={66} textAnchor="middle" fill="var(--text)" fontSize={13} fontWeight={600} fontFamily="JetBrains Mono,monospace">
        {formatUSD(total, 0).replace('$', '$')}
      </text>
      <text x={70} y={80} textAnchor="middle" fill="var(--muted)" fontSize={9} fontFamily="Inter,sans-serif">net worth</text>
    </svg>
  );
}

function QuickSignalPreview() {
  const [briefing, setBriefing] = useState(null);

  useEffect(() => {
    api.getBriefing().then(setBriefing).catch(() => {});
  }, []);

  if (!briefing?.signals?.length) return (
    <div className="panel">
      <div className="ph"><span className="pt">Control room signal</span></div>
      <div className="pb" style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '20px 16px' }}>
        Generate your first briefing in the Control Room
      </div>
    </div>
  );

  const top2 = briefing.signals.slice(0, 2);
  const typeStyle = { risk: { bg: 'var(--red-bg)', border: 'var(--red-border)', tag: 'var(--red)' }, opportunity: { bg: 'var(--teal-bg)', border: 'var(--teal-border)', tag: 'var(--teal)' }, neutral: { bg: 'var(--surface2)', border: 'var(--border)', tag: 'var(--muted)' }, watch: { bg: 'var(--amber-bg)', border: '#f0c4a0', tag: 'var(--amber)' } };

  return (
    <div className="panel">
      <div className="ph"><span className="pt">Control room signal</span></div>
      <div className="pb" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {top2.map((sig, i) => {
          const s = typeStyle[sig.type] || typeStyle.neutral;
          return (
            <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: s.tag, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{sig.type}</div>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>{sig.title}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
