import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { getCategoryColor } from '../lib/format.js';
import { randomUUID } from '../lib/uuid.js';

const TABS = [
  { id: 'assets',     icon: 'ti-database',        label: 'Assets'     },
  { id: 'categories', icon: 'ti-tag',              label: 'Categories' },
  { id: 'currency',   icon: 'ti-currency-dollar',  label: 'Currencies' },
  { id: 'watchlist',  icon: 'ti-radar',            label: 'Watchlist'  }
];

const CURRENCIES = ['USD', 'BRL', 'KRW', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'];

export default function Settings({ onRefresh }) {
  const [tab, setTab] = useState('assets');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPortfolio().then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="spinner" />;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', minHeight: 500, display: 'grid', gridTemplateColumns: '180px 1fr' }}>
      <div style={{ borderRight: '1px solid var(--border)', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', textAlign: 'left',
            background: tab === t.id ? 'var(--teal-bg)' : 'none',
            color: tab === t.id ? 'var(--teal)' : 'var(--muted)',
            fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <i className={`ti ${t.icon}`} style={{ fontSize: 15 }} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ padding: 20, overflowY: 'auto' }}>
        {tab === 'assets'     && <AssetsTab data={data} setData={setData} onRefresh={onRefresh} />}
        {tab === 'categories' && <CategoriesTab data={data} setData={setData} />}
        {tab === 'currency'   && <CurrencyTab data={data} />}
        {tab === 'watchlist'  && <WatchlistTab data={data} setData={setData} />}
      </div>
    </div>
  );
}

function SectionHeading({ title, children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      {title}
      {children}
    </div>
  );
}

function AddBtn({ onClick, label = 'Add' }) {
  return (
    <button onClick={onClick} style={{ background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
      <i className="ti ti-plus" style={{ fontSize: 11 }} aria-hidden="true" /> {label}
    </button>
  );
}

function AssetsTab({ data, setData, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'equity', currency: 'USD', institution: '', currentValue: '' });
  const [saving, setSaving] = useState(false);

  async function addAsset() {
    if (!form.name || !form.currentValue) return;
    setSaving(true);
    try {
      await api.addAsset({ ...form, currentValue: parseFloat(form.currentValue.replace(/,/g, '')) });
      const updated = await api.getPortfolio();
      setData(updated);
      onRefresh();
      setShowForm(false);
      setForm({ name: '', category: 'equity', currency: 'USD', institution: '', currentValue: '' });
    } finally { setSaving(false); }
  }

  async function deleteAsset(id) {
    if (!confirm('Delete this asset?')) return;
    await api.deleteAsset(id);
    const updated = await api.getPortfolio();
    setData(updated);
    onRefresh();
  }

  return (
    <div>
      <SectionHeading title="Asset registry">
        <AddBtn onClick={() => setShowForm(v => !v)} label="Add asset" />
      </SectionHeading>

      {showForm && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <Field label="Asset name"><input className="fi" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Nasdaq ETF" /></Field>
            <Field label="Category">
              <select className="fi" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {data.settings.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Native currency">
              <select className="fi" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Institution / notes"><input className="fi" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} placeholder="e.g. Fidelity" /></Field>
            <Field label={`Current value (${form.currency})`}><input className="fi" value={form.currentValue} onChange={e => setForm(f => ({ ...f, currentValue: e.target.value }))} placeholder="0" /></Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', color: 'var(--muted)' }}>Cancel</button>
            <button onClick={addAsset} disabled={saving} style={{ background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Add asset'}</button>
          </div>
        </div>
      )}

      {data.assets.map(asset => {
        const catColor = getCategoryColor(asset.category, data.settings.categories);
        const catName = data.settings.categories.find(c => c.id === asset.category)?.name || asset.category;
        return (
          <div key={asset.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
            <i className="ti ti-grip-vertical" style={{ color: 'var(--muted2)', fontSize: 14, cursor: 'grab' }} aria-hidden="true" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{asset.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{catName} · {asset.currency} · {asset.institution || 'Manual'}</div>
            </div>
            <span style={{ background: catColor + '22', color: catColor, fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 4, marginRight: 8 }}>{catName}</span>
            <button onClick={() => deleteAsset(asset.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red-border)'; e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--red-bg)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}>
              <i className="ti ti-trash" style={{ fontSize: 14 }} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function CategoriesTab({ data, setData }) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#2563eb');

  async function addCategory() {
    if (!newName.trim()) return;
    const updated = { ...data.settings, categories: [...data.settings.categories, { id: newName.toLowerCase().replace(/\s+/g, '_'), name: newName, color: newColor }] };
    await api.updateSettings(updated);
    setData(d => ({ ...d, settings: updated }));
    setNewName('');
  }

  return (
    <div>
      <SectionHeading title="Categories" />
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>Categories group assets in the portfolio view. Each category gets a color used in charts and badges.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {data.settings.categories.map(cat => (
          <div key={cat.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: '1px solid var(--border)', background: 'var(--surface2)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: cat.color, display: 'inline-block' }} />
            {cat.name}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <Field label="New category name"><input className="fi" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Commodities" /></Field>
        <Field label="Color"><input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 36, height: 36, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2 }} /></Field>
        <button onClick={addCategory} style={{ background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', marginBottom: 1 }}>Add</button>
      </div>
    </div>
  );
}

function CurrencyTab({ data }) {
  const nonUSD = data.assets.filter(a => a.currency !== 'USD').map(a => a.currency);
  const uniqueCurrencies = [...new Set(nonUSD)];
  return (
    <div>
      <SectionHeading title="Currencies & FX" />
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>Asset values are automatically converted to your base currency at session open. Exchange rates are fetched live from Yahoo Finance.</p>
      <div style={{ background: 'var(--teal-bg)', border: '1px solid var(--teal-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--teal)' }}>Base currency</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>All values displayed in this currency</div>
        </div>
        <span style={{ background: 'var(--teal-bg)', color: 'var(--teal)', border: '1px solid var(--teal-border)', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 5 }}>{data.settings.baseCurrency || 'USD'}</span>
      </div>
      {uniqueCurrencies.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Active exchange rates</div>
          {uniqueCurrencies.map(currency => {
            const rate = data.fxRates?.[currency];
            const usedBy = data.assets.filter(a => a.currency === currency).map(a => a.name).join(', ');
            return (
              <div key={currency} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{currency}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Used by: {usedBy}</div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--teal)' }}>
                  {rate ? `1 ${currency} = $${rate.toFixed(4)}` : 'Fetching…'}
                </span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function WatchlistTab({ data, setData }) {
  const [form, setForm] = useState({ name: '', source: 'Yahoo', symbol: '', type: 'index' });
  const [showForm, setShowForm] = useState(false);

  async function addItem() {
    if (!form.name || !form.symbol) return;
    const newItem = { id: form.symbol.toLowerCase().replace(/[^a-z0-9]/g, ''), ...form };
    const updated = { ...data.settings, watchlist: [...data.settings.watchlist, newItem] };
    await api.updateSettings(updated);
    setData(d => ({ ...d, settings: updated }));
    setShowForm(false);
    setForm({ name: '', source: 'Yahoo', symbol: '', type: 'index' });
  }

  async function removeItem(id) {
    const updated = { ...data.settings, watchlist: data.settings.watchlist.filter(w => w.id !== id) };
    await api.updateSettings(updated);
    setData(d => ({ ...d, settings: updated }));
  }

  return (
    <div>
      <SectionHeading title="Control room watchlist">
        <AddBtn onClick={() => setShowForm(v => !v)} label="Add market" />
      </SectionHeading>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>Markets monitored in the Control Room briefing. The AI interprets movements against your current positions.</p>

      {showForm && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <Field label="Display name"><input className="fi" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Gold" /></Field>
            <Field label="Source">
              <select className="fi" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                <option>Yahoo</option><option>FRED</option><option>CoinGecko</option>
              </select>
            </Field>
            <Field label="Symbol / ID"><input className="fi" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} placeholder="e.g. GC=F or DGS10" /></Field>
            <Field label="Type">
              <select className="fi" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="index">Index</option><option value="macro">Macro</option><option value="crypto">Crypto</option><option value="fx">FX</option><option value="commodity">Commodity</option>
              </select>
            </Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--muted)' }}>Cancel</button>
            <button onClick={addItem} style={{ background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Add</button>
          </div>
        </div>
      )}

      {data.settings.watchlist.map(item => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{item.source} · {item.symbol} · {item.type}</div>
          </div>
          <button onClick={() => removeItem(item.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red-border)'; e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--red-bg)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}>
            <i className="ti ti-trash" style={{ fontSize: 14 }} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', letterSpacing: '.02em' }}>{label}</label>
      {children}
    </div>
  );
}
