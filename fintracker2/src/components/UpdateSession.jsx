import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { formatUSD, formatDate, formatNumber } from '../lib/format.js';

export default function UpdateSession({ onClose, onSaved }) {
  const [assets, setAssets] = useState([]);
  const [values, setValues] = useState({});
  const [checked, setChecked] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fxRates, setFxRates] = useState({});

  useEffect(() => {
    api.getPortfolio().then(data => {
      setAssets(data.assets);
      setLastUpdated(data.lastUpdated);
      setFxRates(data.fxRates || {});
      const initial = {};
      data.assets.forEach(a => { initial[a.id] = a.currentValue; });
      setValues(initial);
      setLoading(false);
    });
  }, []);

  const checkedCount = Object.values(checked).filter(Boolean).length;
  const total = assets.length;
  const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

  function toggleCheck(id) {
    setChecked(c => ({ ...c, [id]: !c[id] }));
  }

  function handleValue(id, val) {
    const num = parseFloat(val.replace(/,/g, '')) || 0;
    setValues(v => ({ ...v, [id]: num }));
    setChecked(c => ({ ...c, [id]: true }));
  }

  // Preview net worth with updated values
  const previewNetWorth = assets.reduce((sum, a) => {
    const val = values[a.id] || a.currentValue;
    const rate = a.currency !== 'USD' ? (fxRates[a.currency] || 1) : 1;
    return sum + (a.currency === 'USD' ? val : val * rate);
  }, 0);

  async function handleSave() {
    setSaving(true);
    try {
      const updates = assets
        .filter(a => checked[a.id])
        .map(a => ({ id: a.id, newValue: values[a.id] ?? a.currentValue }));
      if (updates.length === 0) { onClose(); return; }
      await api.updatePortfolio(updates);
      onSaved();
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, background: 'rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: 500, maxHeight: '82vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.1)' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>Portfolio update</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {lastUpdated ? `Last updated ${formatDate(lastUpdated)}` : 'First update'}
          </div>
          <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--teal)', borderRadius: 2, transition: 'width .3s' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>{checkedCount} of {total} assets updated</div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '12px 22px', flex: 1 }}>
          {loading ? <div className="spinner" /> : assets.map(asset => (
            <div key={asset.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
              <div
                onClick={() => toggleCheck(asset.id)}
                style={{ width: 20, height: 20, borderRadius: '50%', border: checked[asset.id] ? 'none' : '1.5px solid var(--border2)', background: checked[asset.id] ? 'var(--teal)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', transition: 'all .2s' }}
              >
                {checked[asset.id] && <i className="ti ti-check" style={{ fontSize: 11, color: '#fff' }} aria-hidden="true" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{asset.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1, fontFamily: 'var(--font-mono)' }}>
                  Last: {formatNumber(asset.currentValue)} {asset.currency}
                  {asset.currency !== 'USD' && fxRates[asset.currency] && (
                    <span> → {formatUSD(asset.currentValue * fxRates[asset.currency])}</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{asset.currency}</span>
                <input
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 13, padding: '6px 10px', width: 120, textAlign: 'right', outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = 'var(--teal)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  type="text"
                  defaultValue={formatNumber(asset.currentValue)}
                  onChange={e => handleValue(asset.id, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            New net worth: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text)' }}>{formatUSD(previewNetWorth)}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || checkedCount === 0} style={{ background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: saving ? 'wait' : 'pointer', opacity: checkedCount === 0 ? 0.4 : 1 }}>
              {saving ? 'Saving…' : `Save ${checkedCount > 0 ? checkedCount : ''} update${checkedCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
