// FinTracker Expenses v2.1 - CSV + PDF import
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api.js';
import { formatUSD, formatDate } from '../lib/format.js';

export default function Expenses() {
  const [summary, setSummary]           = useState(null);
  const [categories, setCategories]     = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [monthExpenses, setMonthExpenses] = useState([]);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [showUpload, setShowUpload]     = useState(false);
  const [range, setRange]               = useState('6M');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [s, c] = await Promise.all([api.getExpensesSummary(), api.getExpenseCategories()]);
    setSummary(s);
    setCategories(c);
    if (s.months?.length) {
      const latest = s.months[s.months.length - 1];
      setSelectedMonth(latest);
      loadMonth(latest);
    }
  }

  async function loadMonth(monthKey) {
    setLoadingMonth(true);
    const [year, month] = monthKey.split('-');
    try {
      const data = await api.getExpensesByMonth(year, month);
      setMonthExpenses(data);
    } finally {
      setLoadingMonth(false);
    }
  }

  function selectMonth(m) {
    setSelectedMonth(m);
    loadMonth(m);
  }

  async function handleCategoryChange(expenseId, categoryId) {
    await api.updateExpense(expenseId, { category_id: categoryId, status: 'categorized' });
    setMonthExpenses(prev => prev.map(e => e.id === expenseId
      ? { ...e, category_id: categoryId, status: 'categorized', expense_categories: categories.find(c => c.id === categoryId) }
      : e
    ));
    setSummary(s => s); // trigger re-render
    load(); // refresh summary for chart
  }

  async function handleDelete(expenseId) {
    if (!confirm('Delete this expense?')) return;
    await api.deleteExpense(expenseId);
    setMonthExpenses(prev => prev.filter(e => e.id !== expenseId));
    load();
  }

  // Build line chart data
  const chartData = buildChartData(summary?.summary || {}, categories, range);

  const needsReview = monthExpenses.filter(e => e.status === 'needs_review');
  const categorized = monthExpenses.filter(e => e.status === 'categorized');
  const uncategorized = monthExpenses.filter(e => e.status === 'uncategorized');

  const monthTotal = monthExpenses
    .filter(e => e.status === 'categorized')
    .reduce((sum, e) => sum + e.amount_usd, 0);

  if (!summary) return <div className="spinner" />;

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          {summary.months?.length
            ? `${summary.months.length} months of data`
            : 'No expenses imported yet'}
        </div>
        <button
          onClick={() => setShowUpload(true)}
          style={{ background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <i className="ti ti-upload" style={{ fontSize: 13 }} aria-hidden="true" /> Import CSV
        </button>
      </div>

      {summary.months?.length === 0 ? (
        <EmptyState onUpload={() => setShowUpload(true)} />
      ) : (
        <>
          {/* Line chart */}
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="ph">
              <span className="pt">Spending by category</span>
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
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted2)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted2)' }} tickLine={false} axisLine={false} tickFormatter={v => `$${Math.round(v)}`} width={50} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      formatter={(v, name) => [formatUSD(v), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {categories.map(cat => (
                      <Line key={cat.id} type="monotone" dataKey={cat.name} stroke={cat.color} strokeWidth={1.5} dot={false} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  Chart will appear after importing at least 2 months of data
                </div>
              )}
            </div>
          </div>

          {/* Month tabs */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
            {[...(summary.months || [])].reverse().map(m => (
              <button key={m} onClick={() => selectMonth(m)} style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                background: selectedMonth === m ? 'var(--text)' : 'var(--surface)',
                color: selectedMonth === m ? '#fff' : 'var(--muted)'
              }}>
                {formatMonthLabel(m)}
              </button>
            ))}
          </div>

          {/* Month summary */}
          {selectedMonth && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                {formatMonthLabel(selectedMonth)} · {monthExpenses.length} transactions
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600 }}>
                {formatUSD(monthTotal)}
              </span>
            </div>
          )}

          {loadingMonth ? <div className="spinner" /> : (
            <>
              {/* Needs review section */}
              {needsReview.length > 0 && (
                <div style={{ background: 'var(--amber-bg)', border: '1px solid #f0d4a0', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="ti ti-alert-triangle" style={{ fontSize: 14 }} aria-hidden="true" />
                    Needs review — {needsReview.length} transactions
                  </div>
                  {needsReview.map(e => (
                    <ExpenseRow key={e.id} expense={e} categories={categories} onCategoryChange={handleCategoryChange} onDelete={handleDelete} highlight />
                  ))}
                </div>
              )}

              {/* Uncategorized */}
              {uncategorized.length > 0 && (
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
                    Uncategorized — {uncategorized.length} transactions
                  </div>
                  {uncategorized.map(e => (
                    <ExpenseRow key={e.id} expense={e} categories={categories} onCategoryChange={handleCategoryChange} onDelete={handleDelete} />
                  ))}
                </div>
              )}

              {/* Categorized — grouped by category */}
              {categories.map(cat => {
                const catExpenses = categorized.filter(e => e.category_id === cat.id);
                if (!catExpenses.length) return null;
                const catTotal = catExpenses.reduce((s, e) => s + e.amount_usd, 0);
                return (
                  <div key={cat.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: cat.color, display: 'inline-block' }} />
                        {cat.name}
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{catExpenses.length} transactions</span>
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>{formatUSD(catTotal)}</span>
                    </div>
                    <div style={{ padding: '0 4px' }}>
                      {catExpenses.map(e => (
                        <ExpenseRow key={e.id} expense={e} categories={categories} onCategoryChange={handleCategoryChange} onDelete={handleDelete} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onDone={() => { setShowUpload(false); load(); }}
        />
      )}
    </div>
  );
}

function ExpenseRow({ expense, categories, onCategoryChange, onDelete, highlight }) {
  const [editing, setEditing] = useState(false);
  const cat = expense.expense_categories;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--border)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
      onMouseLeave={e => e.currentTarget.style.background = ''}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{expense.merchant || expense.description}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1, display: 'flex', gap: 8 }}>
          <span>{formatDate(expense.date)}</span>
          {expense.confidence != null && expense.status === 'needs_review' && (
            <span style={{ color: 'var(--amber)' }}>confidence: {(expense.confidence * 100).toFixed(0)}%</span>
          )}
          {expense.currency_original !== 'USD' && (
            <span>{expense.amount_original.toFixed(2)} {expense.currency_original}</span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {editing ? (
          <select
            className="fi"
            style={{ fontSize: 11, padding: '3px 6px', width: 140 }}
            value={expense.category_id || ''}
            onChange={e => { onCategoryChange(expense.id, e.target.value); setEditing(false); }}
            onBlur={() => setEditing(false)}
            autoFocus
          >
            <option value="">-- select --</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : (
          <span
            onClick={() => setEditing(true)}
            style={{
              fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
              background: cat ? cat.color + '22' : 'var(--bg)',
              color: cat ? cat.color : 'var(--muted)',
              border: `1px solid ${cat ? cat.color + '44' : 'var(--border)'}`
            }}
            title="Click to change category"
          >
            {cat?.name || 'assign →'}
          </span>
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, minWidth: 72, textAlign: 'right' }}>
          {formatUSD(expense.amount_usd)}
        </span>
        <button
          onClick={() => onDelete(expense.id)}
          style={{ width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red-border)'; e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--red-bg)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'none'; }}
        >
          <i className="ti ti-trash" style={{ fontSize: 12 }} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function UploadModal({ onClose, onDone }) {
  const [profiles, setProfiles]   = useState([]);
  const [profileId, setProfileId] = useState('');
  const [file, setFile]           = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);

  useEffect(() => {
    api.getInstitutionProfiles().then(p => { setProfiles(p); if (p.length) setProfileId(p[0].id); });
  }, []);

  const selectedProfile = profiles.find(p => p.id === profileId);
  const fileType = selectedProfile?.file_type || 'csv';
  const accept = fileType === 'pdf' ? '.pdf' : '.csv,.txt';

  async function handleUpload() {
    if (!file || !profileId) return;
    setUploading(true); setError(null);
    try {
      let fileContent, detectedType;

      if (file.name.toLowerCase().endsWith('.pdf')) {
        // Read as base64 for PDF
        detectedType = 'pdf';
        fileContent = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]); // strip data:...;base64,
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else {
        detectedType = 'csv';
        fileContent = await file.text();
      }

      const summary = await api.uploadCSV(fileContent, profileId, detectedType);
      setResult(summary);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, background: 'rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: 460, padding: '24px 28px', boxShadow: '0 20px 60px rgba(0,0,0,.1)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Import statement</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>Select your institution profile and upload a CSV or PDF export from your bank or credit card.</div>

        {profiles.length === 0 ? (
          <div style={{ background: 'var(--amber-bg)', border: '1px solid #f0d4a0', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: 'var(--amber)', marginBottom: 16 }}>
            No institution profiles configured yet. Go to Settings → Institution Profiles to add one first.
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Institution profile</label>
              <select className="fi" value={profileId} onChange={e => { setProfileId(e.target.value); setFile(null); }}>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name} ({p.file_type?.toUpperCase() || 'CSV'})</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                {fileType === 'pdf' ? 'PDF statement' : 'CSV file'}
              </label>
              <input
                key={profileId} // reset when profile changes
                type="file"
                accept={accept}
                onChange={e => setFile(e.target.files[0])}
                style={{ fontSize: 12, color: 'var(--text)', width: '100%' }}
              />
              {fileType === 'pdf' && (
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
                  Text-based PDFs only. Scanned/image PDFs are not supported — use a PDF-to-CSV converter first.
                </div>
              )}
            </div>
          </>
        )}

        {error && <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--red)', marginBottom: 14 }}>{error}</div>}

        {result && (
          <div style={{ background: 'var(--teal-bg)', border: '1px solid var(--teal-border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--teal)', marginBottom: 8 }}>Import complete</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
              <span style={{ color: 'var(--muted)' }}>Total imported</span><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{result.imported}</span>
              <span style={{ color: 'var(--muted)' }}>Categorized</span><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--teal)' }}>{result.categorized}</span>
              <span style={{ color: 'var(--muted)' }}>Needs review</span><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>{result.needs_review}</span>
              <span style={{ color: 'var(--muted)' }}>Uncategorized</span><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{result.uncategorized}</span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={result ? onDone : onClose} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--muted)' }}>
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && profiles.length > 0 && (
            <button onClick={handleUpload} disabled={uploading || !file} style={{ background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: (!file || uploading) ? 0.4 : 1 }}>
              {uploading ? 'Processing…' : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onUpload }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 340, gap: 12 }}>
      <div style={{ width: 48, height: 48, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i className="ti ti-receipt" style={{ fontSize: 22, color: 'var(--muted2)' }} aria-hidden="true" />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>No expenses yet</div>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>Import a CSV to get started. Configure institution profiles in Settings first.</div>
      <button onClick={onUpload} style={{ background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', marginTop: 4 }}>
        Import CSV
      </button>
    </div>
  );
}

function buildChartData(summary, categories, range) {
  const allMonths = Object.keys(summary).sort();
  const cutoffs = { '3M': 3, '6M': 6, '1Y': 12, 'All': 9999 };
  const filtered = allMonths.slice(-cutoffs[range]);

  return filtered.map(month => {
    const row = { month: month.slice(0, 7) };
    categories.forEach(cat => {
      row[cat.name] = parseFloat((summary[month]?.[cat.id] || 0).toFixed(2));
    });
    return row;
  });
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-');
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
