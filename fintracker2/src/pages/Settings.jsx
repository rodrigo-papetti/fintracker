import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { getCategoryColor } from '../lib/format.js';

const TABS = [
  { id: 'assets',       icon: 'ti-database',        label: 'Assets'        },
  { id: 'categories',   icon: 'ti-tag',              label: 'Categories'    },
  { id: 'currency',     icon: 'ti-currency-dollar',  label: 'Currencies'    },
  { id: 'watchlist',    icon: 'ti-radar',            label: 'Watchlist'     },
  { id: 'exp-cats',     icon: 'ti-receipt',          label: 'Exp. Categories' },
  { id: 'institutions', icon: 'ti-building-bank',    label: 'Institutions'  },
  { id: 'exp-settings', icon: 'ti-adjustments',      label: 'Exp. Settings' }
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
        {tab === 'assets'       && <AssetsTab data={data} setData={setData} onRefresh={onRefresh} />}
        {tab === 'categories'   && <CategoriesTab data={data} setData={setData} />}
        {tab === 'currency'     && <CurrencyTab data={data} />}
        {tab === 'watchlist'    && <WatchlistTab data={data} setData={setData} />}
        {tab === 'exp-cats'     && <ExpenseCategoriesTab />}
        {tab === 'institutions' && <InstitutionsTab />}
        {tab === 'exp-settings' && <ExpenseSettingsTab data={data} setData={setData} />}
      </div>
    </div>
  );
}

function SectionHeading({ title, children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      {title}{children}
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

function IconBtn({ icon, onClick, danger }) {
  return (
    <button onClick={onClick}
      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flexShrink: 0 }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = danger ? 'var(--red-border)' : 'var(--border2)'; e.currentTarget.style.color = danger ? 'var(--red)' : 'var(--text)'; if (danger) e.currentTarget.style.background = 'var(--red-bg)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}>
      <i className={`ti ${icon}`} style={{ fontSize: 14 }} aria-hidden="true" />
    </button>
  );
}

function InlineForm({ fields, onSave, onCancel, saveLabel = 'Save', saving }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {fields}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onCancel} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', color: 'var(--muted)' }}>Cancel</button>
        <button onClick={onSave} disabled={saving} style={{ background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{saving ? 'Saving…' : saveLabel}</button>
      </div>
    </>
  );
}

// ─── Assets Tab ───────────────────────────────────────────────────────────────

function AssetsTab({ data, setData, onRefresh }) {
  const [showAdd, setShowAdd]   = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm]         = useState({ name: '', category: 'equity', currency: 'USD', institution: '', currentValue: '' });
  const [saving, setSaving]     = useState(false);

  const EMPTY = { name: '', category: 'equity', currency: 'USD', institution: '', currentValue: '' };

  function openAdd() { setForm(EMPTY); setEditingId(null); setShowAdd(true); }
  function openEdit(asset) {
    setForm({ name: asset.name, category: asset.category, currency: asset.currency, institution: asset.institution || '', currentValue: String(asset.currentValue) });
    setEditingId(asset.id);
    setShowAdd(false);
  }
  function closeForm() { setShowAdd(false); setEditingId(null); }

  async function saveAsset() {
    if (!form.name || !form.currentValue) return;
    setSaving(true);
    try {
      const payload = { ...form, currentValue: parseFloat(String(form.currentValue).replace(/,/g, '')) };
      if (editingId) {
        await api.editAsset(editingId, payload);
      } else {
        await api.addAsset(payload);
      }
      const updated = await api.getPortfolio();
      setData(updated);
      onRefresh();
      closeForm();
    } finally { setSaving(false); }
  }

  async function deleteAsset(id) {
    if (!confirm('Delete this asset? This cannot be undone.')) return;
    await api.deleteAsset(id);
    const updated = await api.getPortfolio();
    setData(updated);
    onRefresh();
  }

  const valueHint = form.currency ? `Enter the current value in ${form.currency}, numbers only. Example: ${form.currency === 'BRL' ? '772000' : form.currency === 'KRW' ? '23490000' : '184500'}` : 'Numbers only, no currency symbols or commas. Example: 184500';

  function formFields(f, setF) {
    return [
      <Field key="name" label="Asset name"><input className="fi" value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Nasdaq ETF" /></Field>,
      <Field key="cat" label="Category">
        <select className="fi" value={f.category} onChange={e => setF(p => ({ ...p, category: e.target.value }))}>
          {data.settings.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>,
      <Field key="cur" label="Native currency">
        <select className="fi" value={f.currency} onChange={e => setF(p => ({ ...p, currency: e.target.value }))}>
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>,
      <Field key="inst" label="Institution / notes"><input className="fi" value={f.institution} onChange={e => setF(p => ({ ...p, institution: e.target.value }))} placeholder="e.g. Fidelity" /></Field>,
      <Field key="val" label={`Current value (${f.currency})`} hint={valueHint}>
        <input className="fi" value={f.currentValue} onChange={e => setF(p => ({ ...p, currentValue: e.target.value }))} placeholder={f.currency === 'BRL' ? '772000' : f.currency === 'KRW' ? '23490000' : '184500'} />
      </Field>
    ];
  }

  return (
    <div>
      <SectionHeading title="Asset registry">
        <AddBtn onClick={openAdd} label="Add asset" />
      </SectionHeading>

      {showAdd && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.04em' }}>New asset</div>
          <InlineForm fields={formFields(form, setForm)} onSave={saveAsset} onCancel={closeForm} saveLabel="Add asset" saving={saving} />
        </div>
      )}

      {data.assets.map(asset => {
        const catColor = getCategoryColor(asset.category, data.settings.categories);
        const catName  = data.settings.categories.find(c => c.id === asset.category)?.name || asset.category;
        const isEditing = editingId === asset.id;
        return (
          <div key={asset.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: isEditing ? 'none' : '1px solid var(--border)' }}>
              <i className="ti ti-grip-vertical" style={{ color: 'var(--muted2)', fontSize: 14, cursor: 'grab' }} aria-hidden="true" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{asset.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{catName} · {asset.currency} · {asset.institution || 'Manual'}</div>
              </div>
              <span style={{ background: catColor + '22', color: catColor, fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 4, marginRight: 4 }}>{catName}</span>
              <IconBtn icon="ti-edit"  onClick={() => isEditing ? closeForm() : openEdit(asset)} />
              <IconBtn icon="ti-trash" onClick={() => deleteAsset(asset.id)} danger />
            </div>
            {isEditing && (
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--teal)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.04em' }}>Editing: {asset.name}</div>
                <InlineForm fields={formFields(form, setForm)} onSave={saveAsset} onCancel={closeForm} saveLabel="Save changes" saving={saving} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

function CategoriesTab({ data, setData }) {
  const [newName, setNewName]   = useState('');
  const [newColor, setNewColor] = useState('#2563eb');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  async function saveCategories(categories) {
    await api.updateSettings({ ...data.settings, categories });
    setData(d => ({ ...d, settings: { ...d.settings, categories } }));
  }

  async function addCategory() {
    if (!newName.trim()) return;
    const id = newName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await saveCategories([...data.settings.categories, { id, name: newName.trim(), color: newColor }]);
    setNewName(''); setNewColor('#2563eb');
  }

  function startEdit(cat) { setEditingId(cat.id); setEditName(cat.name); setEditColor(cat.color); }
  function cancelEdit()   { setEditingId(null); }

  async function saveEdit() {
    const updated = data.settings.categories.map(c => c.id === editingId ? { ...c, name: editName, color: editColor } : c);
    await saveCategories(updated);
    setEditingId(null);
  }

  async function deleteCategory(id) {
    const inUse = data.assets?.some(a => a.category === id);
    if (inUse) { alert('This category is used by one or more assets. Reassign those assets first.'); return; }
    if (!confirm('Delete this category?')) return;
    await saveCategories(data.settings.categories.filter(c => c.id !== id));
  }

  return (
    <div>
      <SectionHeading title="Categories" />
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>Categories group assets in the portfolio view. Each category gets a color used in charts and badges. You cannot delete a category that is currently assigned to assets.</p>

      {data.settings.categories.map(cat => (
        <div key={cat.id} style={{ borderBottom: '1px solid var(--border)' }}>
          {editingId === cat.id ? (
            <div style={{ padding: '10px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} style={{ width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2, flexShrink: 0 }} />
              <input className="fi" value={editName} onChange={e => setEditName(e.target.value)} style={{ flex: 1 }} />
              <button onClick={saveEdit}   style={{ background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Save</button>
              <button onClick={cancelEdit} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--muted)' }}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0' }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: cat.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{cat.name}</span>
              <IconBtn icon="ti-edit"  onClick={() => startEdit(cat)} />
              <IconBtn icon="ti-trash" onClick={() => deleteCategory(cat.id)} danger />
            </div>
          )}
        </div>
      ))}

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>Add new category</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <Field label="Name"><input className="fi" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Commodities" onKeyDown={e => e.key === 'Enter' && addCategory()} /></Field>
          <Field label="Color"><input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 36, height: 36, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2 }} /></Field>
          <button onClick={addCategory} style={{ background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', marginBottom: 1 }}>Add</button>
        </div>
      </div>
    </div>
  );
}

// ─── Currency Tab ─────────────────────────────────────────────────────────────

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
            const rate  = data.fxRates?.[currency];
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

// ─── Watchlist presets ────────────────────────────────────────────────────────

const PRESETS = [
  // US Equity Indexes
  { group: 'US Indexes',    name: 'S&P 500',            source: 'Yahoo',     symbol: '^GSPC',    type: 'index'     },
  { group: 'US Indexes',    name: 'Nasdaq Composite',   source: 'Yahoo',     symbol: '^IXIC',    type: 'index'     },
  { group: 'US Indexes',    name: 'Dow Jones',          source: 'Yahoo',     symbol: '^DJI',     type: 'index'     },
  { group: 'US Indexes',    name: 'Russell 2000',       source: 'Yahoo',     symbol: '^RUT',     type: 'index'     },
  { group: 'US Indexes',    name: 'VIX (Volatility)',   source: 'Yahoo',     symbol: '^VIX',     type: 'index'     },
  // US Bonds & Rates
  { group: 'US Bonds',      name: 'US 2Y Treasury',     source: 'FRED',      symbol: 'DGS2',     type: 'macro'     },
  { group: 'US Bonds',      name: 'US 10Y Treasury',    source: 'FRED',      symbol: 'DGS10',    type: 'macro'     },
  { group: 'US Bonds',      name: 'US 30Y Treasury',    source: 'FRED',      symbol: 'DGS30',    type: 'macro'     },
  { group: 'US Bonds',      name: 'Fed Funds Rate',     source: 'FRED',      symbol: 'FEDFUNDS', type: 'macro'     },
  // US Macro
  { group: 'US Macro',      name: 'US CPI (Inflation)', source: 'FRED',      symbol: 'CPIAUCSL', type: 'macro'     },
  { group: 'US Macro',      name: 'US Unemployment',    source: 'FRED',      symbol: 'UNRATE',   type: 'macro'     },
  { group: 'US Macro',      name: 'US GDP Growth',      source: 'FRED',      symbol: 'A191RL1Q225SBEA', type: 'macro' },
  { group: 'US Macro',      name: 'US National Debt',   source: 'FRED',      symbol: 'GFDEBTN',  type: 'macro'     },
  { group: 'US Macro',      name: 'Yield Curve (10Y-2Y)',source: 'FRED',     symbol: 'T10Y2Y',   type: 'macro'     },
  // Global Indexes
  { group: 'Global Indexes',name: 'MSCI World ETF',     source: 'Yahoo',     symbol: 'URTH',     type: 'index'     },
  { group: 'Global Indexes',name: 'MSCI Emerging Mkts', source: 'Yahoo',     symbol: 'EEM',      type: 'index'     },
  { group: 'Global Indexes',name: 'Nikkei 225',         source: 'Yahoo',     symbol: '^N225',    type: 'index'     },
  { group: 'Global Indexes',name: 'KOSPI (Korea)',       source: 'Yahoo',     symbol: '^KS11',    type: 'index'     },
  { group: 'Global Indexes',name: 'Ibovespa (Brazil)',  source: 'Yahoo',     symbol: '^BVSP',    type: 'index'     },
  { group: 'Global Indexes',name: 'DAX (Germany)',      source: 'Yahoo',     symbol: '^GDAXI',   type: 'index'     },
  { group: 'Global Indexes',name: 'FTSE 100 (UK)',      source: 'Yahoo',     symbol: '^FTSE',    type: 'index'     },
  // FX
  { group: 'FX',            name: 'USD / BRL',          source: 'Yahoo',     symbol: 'BRL=X',    type: 'fx'        },
  { group: 'FX',            name: 'USD / KRW',          source: 'Yahoo',     symbol: 'KRW=X',    type: 'fx'        },
  { group: 'FX',            name: 'USD / EUR',          source: 'Yahoo',     symbol: 'EURUSD=X', type: 'fx'        },
  { group: 'FX',            name: 'USD / JPY',          source: 'Yahoo',     symbol: 'JPY=X',    type: 'fx'        },
  { group: 'FX',            name: 'USD / GBP',          source: 'Yahoo',     symbol: 'GBPUSD=X', type: 'fx'        },
  { group: 'FX',            name: 'DXY (Dollar Index)', source: 'Yahoo',     symbol: 'DX-Y.NYB', type: 'fx'        },
  // Crypto
  { group: 'Crypto',        name: 'Bitcoin (BTC)',      source: 'CoinGecko', symbol: 'bitcoin',  type: 'crypto'    },
  { group: 'Crypto',        name: 'Ethereum (ETH)',     source: 'CoinGecko', symbol: 'ethereum', type: 'crypto'    },
  { group: 'Crypto',        name: 'Solana (SOL)',       source: 'CoinGecko', symbol: 'solana',   type: 'crypto'    },
  // Commodities
  { group: 'Commodities',   name: 'Gold',               source: 'Yahoo',     symbol: 'GC=F',     type: 'commodity' },
  { group: 'Commodities',   name: 'Silver',             source: 'Yahoo',     symbol: 'SI=F',     type: 'commodity' },
  { group: 'Commodities',   name: 'Crude Oil (WTI)',    source: 'Yahoo',     symbol: 'CL=F',     type: 'commodity' },
  { group: 'Commodities',   name: 'Brent Crude',        source: 'Yahoo',     symbol: 'BZ=F',     type: 'commodity' },
  { group: 'Commodities',   name: 'Natural Gas',        source: 'Yahoo',     symbol: 'NG=F',     type: 'commodity' },
  { group: 'Commodities',   name: 'Copper',             source: 'Yahoo',     symbol: 'HG=F',     type: 'commodity' },
  // Tech Stocks
  { group: 'Tech Stocks',   name: 'Apple (AAPL)',       source: 'Yahoo',     symbol: 'AAPL',     type: 'equity'    },
  { group: 'Tech Stocks',   name: 'Nvidia (NVDA)',      source: 'Yahoo',     symbol: 'NVDA',     type: 'equity'    },
  { group: 'Tech Stocks',   name: 'Microsoft (MSFT)',   source: 'Yahoo',     symbol: 'MSFT',     type: 'equity'    },
  { group: 'Tech Stocks',   name: 'Coupang (CPNG)',     source: 'Yahoo',     symbol: 'CPNG',     type: 'equity'    },
];

const PRESET_GROUPS = [...new Set(PRESETS.map(p => p.group))];

// ─── Watchlist Tab ────────────────────────────────────────────────────────────

function WatchlistTab({ data, setData }) {
  const EMPTY_FORM = { name: '', source: 'Yahoo', symbol: '', type: 'index' };
  const [mode, setMode]         = useState(null); // null | 'preset' | 'manual'
  const [search, setSearch]     = useState('');
  const [activeGroup, setActiveGroup] = useState(PRESET_GROUPS[0]);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);

  const alreadyAdded = new Set(data.settings.watchlist.map(w => w.symbol));

  const filteredPresets = search.trim()
    ? PRESETS.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.symbol.toLowerCase().includes(search.toLowerCase()))
    : PRESETS.filter(p => p.group === activeGroup);

  function selectPreset(preset) {
    setForm({ name: preset.name, source: preset.source, symbol: preset.symbol, type: preset.type });
    setMode('manual'); // drop into the form with fields pre-filled
  }

  async function addItem() {
    if (!form.name || !form.symbol) return;
    setSaving(true);
    try {
      const newItem = { id: form.symbol.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now(), ...form };
      const updated = { ...data.settings, watchlist: [...data.settings.watchlist, newItem] };
      await api.updateSettings(updated);
      setData(d => ({ ...d, settings: updated }));
      setMode(null);
      setForm(EMPTY_FORM);
      setSearch('');
    } finally { setSaving(false); }
  }

  async function removeItem(id) {
    const updated = { ...data.settings, watchlist: data.settings.watchlist.filter(w => w.id !== id) };
    await api.updateSettings(updated);
    setData(d => ({ ...d, settings: updated }));
  }

  function cancel() { setMode(null); setForm(EMPTY_FORM); setSearch(''); }

  const sourceColor = { Yahoo: 'var(--blue)', FRED: 'var(--teal)', CoinGecko: 'var(--amber)' };
  const sourceBg    = { Yahoo: 'var(--blue-bg)', FRED: 'var(--teal-bg)', CoinGecko: 'var(--amber-bg)' };

  return (
    <div>
      <SectionHeading title="Control room watchlist">
        {!mode && (
          <div style={{ display: 'flex', gap: 6 }}>
            <AddBtn onClick={() => setMode('preset')} label="Browse presets" />
            <button onClick={() => setMode('manual')} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>Manual entry</button>
          </div>
        )}
      </SectionHeading>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>Markets monitored in the Control Room briefing. The AI interprets movements against your current positions.</p>

      {/* Preset browser */}
      {mode === 'preset' && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Browse preset markets</div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--muted)' }} aria-hidden="true" />
            <input className="fi" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search markets… e.g. Gold, KOSPI, CPI" style={{ paddingLeft: 30 }} />
          </div>

          {/* Group tabs — hidden when searching */}
          {!search && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
              {PRESET_GROUPS.map(g => (
                <button key={g} onClick={() => setActiveGroup(g)} style={{
                  padding: '4px 10px', borderRadius: 5, border: '1px solid var(--border)', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                  background: activeGroup === g ? 'var(--text)' : 'none',
                  color: activeGroup === g ? '#fff' : 'var(--muted)'
                }}>{g}</button>
              ))}
            </div>
          )}

          {/* Preset list */}
          <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filteredPresets.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted)', padding: '12px 0', textAlign: 'center' }}>
                No presets match "{search}" — use Manual entry to add it directly.
              </div>
            )}
            {filteredPresets.map(p => {
              const added = alreadyAdded.has(p.symbol);
              return (
                <div key={p.symbol} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 7, background: added ? 'var(--surface2)' : 'var(--surface)', border: '1px solid var(--border)', opacity: added ? 0.5 : 1 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1, fontFamily: 'var(--font-mono)' }}>{p.symbol}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: sourceBg[p.source], color: sourceColor[p.source] }}>{p.source}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)', minWidth: 60 }}>{p.type}</span>
                  {added
                    ? <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>Added</span>
                    : <button onClick={() => selectPreset(p)} style={{ background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>Select</button>
                  }
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Can't find what you need?</span>
            <button onClick={() => { setMode('manual'); setSearch(''); }} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>Switch to manual entry</button>
          </div>
        </div>
      )}

      {/* Manual entry form — also used for pre-filled preset selection */}
      {mode === 'manual' && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{form.name ? `Adding: ${form.name}` : 'Manual entry'}</span>
            <button onClick={() => setMode('preset')} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--teal)', cursor: 'pointer', fontWeight: 500 }}>← Back to presets</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <Field label="Display name">
              <input className="fi" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Gold" />
            </Field>
            <Field label="Source" hint="Yahoo Finance for stocks/ETFs/FX/commodities · FRED for US macro · CoinGecko for crypto">
              <select className="fi" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                <option>Yahoo</option><option>FRED</option><option>CoinGecko</option>
              </select>
            </Field>
            <Field label="Symbol / ID" hint={
              form.source === 'Yahoo'     ? 'Yahoo Finance ticker. Examples: GC=F (Gold), ^GSPC (S&P 500), AAPL (Apple), BRL=X (USD/BRL)' :
              form.source === 'FRED'      ? 'FRED series ID. Examples: DGS10 (10Y yield), CPIAUCSL (CPI), UNRATE (unemployment)' :
              form.source === 'CoinGecko' ? 'CoinGecko coin ID (lowercase). Examples: bitcoin, ethereum, solana' : ''
            }>
              <input className="fi" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))}
                placeholder={form.source === 'Yahoo' ? 'e.g. GC=F' : form.source === 'FRED' ? 'e.g. DGS10' : 'e.g. bitcoin'} />
            </Field>
            <Field label="Type">
              <select className="fi" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="index">Index</option>
                <option value="macro">Macro</option>
                <option value="crypto">Crypto</option>
                <option value="fx">FX</option>
                <option value="commodity">Commodity</option>
                <option value="equity">Equity</option>
              </select>
            </Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={cancel} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--muted)' }}>Cancel</button>
            <button onClick={addItem} disabled={saving || !form.name || !form.symbol} style={{ background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: (!form.name || !form.symbol) ? 0.4 : 1 }}>
              {saving ? 'Adding…' : 'Add to watchlist'}
            </button>
          </div>
        </div>
      )}

      {/* Current watchlist — drag to reorder, first 6 shown in Control Room */}
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className="ti ti-grip-vertical" style={{ fontSize: 13 }} aria-hidden="true" />
        Drag to reorder — first 6 appear in the Control Room top strip
      </div>
      {data.settings.watchlist.map((item, idx) => (
        <div
          key={item.id}
          draggable
          onDragStart={e => { e.dataTransfer.setData('text/plain', idx); e.currentTarget.style.opacity = '0.4'; }}
          onDragEnd={e => { e.currentTarget.style.opacity = '1'; }}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = 'var(--teal-bg)'; }}
          onDragLeave={e => { e.currentTarget.style.background = ''; }}
          onDrop={async e => {
            e.preventDefault();
            e.currentTarget.style.background = '';
            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
            const toIdx = idx;
            if (fromIdx === toIdx) return;
            const newList = [...data.settings.watchlist];
            const [moved] = newList.splice(fromIdx, 1);
            newList.splice(toIdx, 0, moved);
            const updated = { ...data.settings, watchlist: newList };
            await api.updateSettings(updated);
            setData(d => ({ ...d, settings: updated }));
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)', cursor: 'grab', borderRadius: 4, transition: 'background .1s' }}
        >
          <i className="ti ti-grip-vertical" style={{ color: 'var(--muted2)', fontSize: 14, flexShrink: 0 }} aria-hidden="true" />
          <div style={{ width: 20, height: 20, borderRadius: 4, background: idx < 6 ? 'var(--teal-bg)' : 'var(--bg)', border: `1px solid ${idx < 6 ? 'var(--teal-border)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: idx < 6 ? 'var(--teal)' : 'var(--muted2)', fontFamily: 'var(--font-mono)' }}>{idx + 1}</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1, fontFamily: 'var(--font-mono)' }}>{item.symbol}</div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: sourceBg[item.source] || 'var(--bg)', color: sourceColor[item.source] || 'var(--muted)' }}>{item.source}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 60 }}>{item.type}</span>
          {idx < 6 && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.04em', minWidth: 32 }}>Pinned</span>}
          <IconBtn icon="ti-trash" onClick={() => removeItem(item.id)} danger />
        </div>
      ))}
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', letterSpacing: '.02em' }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: 10, color: 'var(--muted2)', lineHeight: 1.5 }}>{hint}</span>}
    </div>
  );
}

// ─── Expense Categories Tab ───────────────────────────────────────────────────

function ExpenseCategoriesTab() {
  const [cats, setCats]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [newName, setNewName]   = useState('');
  const [newColor, setNewColor] = useState('#0f9e80');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  useEffect(() => { api.getExpenseCategories().then(c => { setCats(c); setLoading(false); }); }, []);

  async function add() {
    if (!newName.trim()) return;
    const cat = await api.addExpenseCategory({ name: newName.trim(), color: newColor });
    setCats(c => [...c, cat]);
    setNewName(''); setNewColor('#0f9e80');
  }

  async function saveEdit() {
    await api.editExpenseCategory(editingId, { name: editName, color: editColor });
    setCats(c => c.map(x => x.id === editingId ? { ...x, name: editName, color: editColor } : x));
    setEditingId(null);
  }

  async function del(id) {
    if (!confirm('Delete this expense category? Existing expenses assigned to it will become uncategorized.')) return;
    await api.deleteExpenseCategory(id);
    setCats(c => c.filter(x => x.id !== id));
  }

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <SectionHeading title="Expense categories" />
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
        Categories used to classify your expenses. The LLM uses these names to categorize transactions — clear, descriptive names improve accuracy.
      </p>
      {cats.map(cat => (
        <div key={cat.id} style={{ borderBottom: '1px solid var(--border)' }}>
          {editingId === cat.id ? (
            <div style={{ padding: '10px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} style={{ width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2, flexShrink: 0 }} />
              <input className="fi" value={editName} onChange={e => setEditName(e.target.value)} style={{ flex: 1 }} />
              <button onClick={saveEdit} style={{ background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditingId(null)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--muted)' }}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0' }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: cat.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{cat.name}</span>
              <IconBtn icon="ti-edit"  onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditColor(cat.color); }} />
              <IconBtn icon="ti-trash" onClick={() => del(cat.id)} danger />
            </div>
          )}
        </div>
      ))}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>Add new category</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <Field label="Name"><input className="fi" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Entertainment" onKeyDown={e => e.key === 'Enter' && add()} /></Field>
          <Field label="Color"><input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 36, height: 36, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2 }} /></Field>
          <button onClick={add} style={{ background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', marginBottom: 1 }}>Add</button>
        </div>
      </div>
    </div>
  );
}

// ─── Institution Profiles Tab ─────────────────────────────────────────────────

const PROFILE_TYPES = ['credit_card', 'checking', 'savings', 'investment'];

function InstitutionsTab() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const EMPTY = { name: '', type: 'credit_card', file_type: 'csv', currency: 'USD', date_column: 0, description_column: 1, amount_column: 2, expense_is_positive: true, skip_rows: 1, exclude_keywords: 'TRANSFER,ATM,WITHDRAWAL,PAYMENT' };
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);

  useEffect(() => { api.getInstitutionProfiles().then(p => { setProfiles(p); setLoading(false); }); }, []);

  function openAdd()    { setForm(EMPTY); setEditId(null); setShowForm(true); }
  function openEdit(p)  { setForm({ ...p, exclude_keywords: (p.exclude_keywords || []).join(',') }); setEditId(p.id); setShowForm(true); }
  function closeForm()  { setShowForm(false); setEditId(null); }

  async function save() {
    if (!form.name) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        date_column: parseInt(form.date_column),
        description_column: parseInt(form.description_column),
        amount_column: parseInt(form.amount_column),
        skip_rows: parseInt(form.skip_rows),
        expense_is_positive: form.expense_is_positive === true || form.expense_is_positive === 'true',
        exclude_keywords: form.exclude_keywords.split(',').map(k => k.trim()).filter(Boolean)
      };
      if (editId) {
        await api.editInstitutionProfile(editId, payload);
        setProfiles(p => p.map(x => x.id === editId ? { ...x, ...payload } : x));
      } else {
        const created = await api.addInstitutionProfile(payload);
        setProfiles(p => [...p, created]);
      }
      closeForm();
    } finally { setSaving(false); }
  }

  async function del(id) {
    if (!confirm('Delete this institution profile?')) return;
    await api.deleteInstitutionProfile(id);
    setProfiles(p => p.filter(x => x.id !== id));
  }

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <SectionHeading title="Institution profiles">
        <AddBtn onClick={openAdd} label="Add profile" />
      </SectionHeading>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6 }}>
        Configure how to read CSV exports from each of your banks or credit cards. Column indices are zero-based (first column = 0).
      </p>

      {showForm && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: editId ? 'var(--teal)' : 'var(--muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            {editId ? `Editing: ${form.name}` : 'New institution profile'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <Field label="Institution name"><input className="fi" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Chase Credit Card" /></Field>
            <Field label="Type">
              <select className="fi" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {PROFILE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="File format" hint="CSV = column mapping required. PDF = Claude reads the statement directly.">
              <select className="fi" value={form.file_type} onChange={e => setForm(f => ({ ...f, file_type: e.target.value }))}>
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
              </select>
            </Field>
            <Field label="Currency">
              <select className="fi" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            {form.file_type === 'csv' && (<>
            <Field label="Header rows to skip" hint="Usually 1 (skip the column header row)">
              <input className="fi" type="number" min="0" value={form.skip_rows} onChange={e => setForm(f => ({ ...f, skip_rows: e.target.value }))} />
            </Field>
            <Field label="Date column index" hint="0 = first column"><input className="fi" type="number" min="0" value={form.date_column} onChange={e => setForm(f => ({ ...f, date_column: e.target.value }))} /></Field>
            <Field label="Description column index"><input className="fi" type="number" min="0" value={form.description_column} onChange={e => setForm(f => ({ ...f, description_column: e.target.value }))} /></Field>
            <Field label="Amount column index"><input className="fi" type="number" min="0" value={form.amount_column} onChange={e => setForm(f => ({ ...f, amount_column: e.target.value }))} /></Field>
            <Field label="Expense sign convention">
              <select className="fi" value={String(form.expense_is_positive)} onChange={e => setForm(f => ({ ...f, expense_is_positive: e.target.value === 'true' }))}>
                <option value="true">Positive = expense (e.g. Chase, Nubank)</option>
                <option value="false">Negative = expense (e.g. some bank statements)</option>
              </select>
            </Field>
            </>)}
            <Field label="Exclude keywords" hint="Comma-separated. Rows containing these are skipped." style={{ gridColumn: '1 / -1' }}>
              <input className="fi" value={form.exclude_keywords} onChange={e => setForm(f => ({ ...f, exclude_keywords: e.target.value }))} placeholder="TRANSFER,ATM,WITHDRAWAL,PAYMENT" />
            </Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={closeForm} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--muted)' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{saving ? 'Saving…' : editId ? 'Save changes' : 'Add profile'}</button>
          </div>
        </div>
      )}

      {profiles.length === 0 && !showForm && (
        <div style={{ fontSize: 13, color: 'var(--muted)', padding: '20px 0', textAlign: 'center' }}>No profiles yet. Add one to start importing CSVs.</div>
      )}

      {profiles.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
              {p.type.replace('_', ' ')} · {p.currency} · date=col{p.date_column}, desc=col{p.description_column}, amt=col{p.amount_column} · {p.expense_is_positive ? '+' : '−'}=expense · skip {p.skip_rows} row{p.skip_rows !== 1 ? 's' : ''}
            </div>
          </div>
          <IconBtn icon="ti-edit"  onClick={() => openEdit(p)} />
          <IconBtn icon="ti-trash" onClick={() => del(p.id)} danger />
        </div>
      ))}
    </div>
  );
}

// ─── Expense Settings Tab ─────────────────────────────────────────────────────

function ExpenseSettingsTab({ data, setData }) {
  const [threshold, setThreshold] = useState(
    data?.settings?.expense_confidence_threshold ?? 0.75
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.updateSettings({ expense_confidence_threshold: parseFloat(threshold) });
      setData(d => ({ ...d, settings: { ...d.settings, expense_confidence_threshold: parseFloat(threshold) } }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  return (
    <div>
      <SectionHeading title="Expense settings" />
      <div style={{ maxWidth: 400 }}>
        <Field
          label="Confidence threshold"
          hint={`Transactions with confidence below this value are flagged for review. Current: ${(threshold * 100).toFixed(0)}%. Lower = flag more (fewer false positives). Higher = flag less (more false negatives).`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="range" min="0.5" max="0.95" step="0.05"
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
              style={{ flex: 1 }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, minWidth: 40 }}>
              {(threshold * 100).toFixed(0)}%
            </span>
          </div>
        </Field>
        <div style={{ marginTop: 6, display: 'flex', gap: 20, fontSize: 11, color: 'var(--muted)' }}>
          <span>50% — flag almost everything</span>
          <span style={{ marginLeft: 'auto' }}>95% — flag almost nothing</span>
        </div>
        <button
          onClick={save}
          disabled={saving}
          style={{ marginTop: 16, background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}
