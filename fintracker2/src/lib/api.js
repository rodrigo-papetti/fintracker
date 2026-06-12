async function req(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export const api = {
  getPortfolio:     ()          => req('/api/portfolio'),
  updatePortfolio:  (updates)   => req('/api/portfolio-update', { method: 'POST', body: JSON.stringify({ updates }) }),
  addAsset:         (asset)     => req('/api/assets', { method: 'POST', body: JSON.stringify(asset) }),
  editAsset:        (id, asset) => req(`/api/assets?id=${id}`, { method: 'PUT', body: JSON.stringify(asset) }),
  deleteAsset:      (id)        => req(`/api/assets?id=${id}`, { method: 'DELETE' }),
  updateSettings:   (settings)  => req('/api/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  getMarketData:    ()          => req('/api/market'),
  getBriefing:      (refresh)   => req(`/api/briefing${refresh ? '?refresh=1' : ''}`),

  // Expense categories
  getExpenseCategories:    ()         => req('/api/expense-categories'),
  addExpenseCategory:      (cat)      => req('/api/expense-categories', { method: 'POST', body: JSON.stringify(cat) }),
  editExpenseCategory:     (id, cat)  => req(`/api/expense-categories?id=${id}`, { method: 'PUT', body: JSON.stringify(cat) }),
  deleteExpenseCategory:   (id)       => req(`/api/expense-categories?id=${id}`, { method: 'DELETE' }),

  // Institution profiles
  getInstitutionProfiles:  ()         => req('/api/institution-profiles'),
  addInstitutionProfile:   (p)        => req('/api/institution-profiles', { method: 'POST', body: JSON.stringify(p) }),
  editInstitutionProfile:  (id, p)    => req(`/api/institution-profiles?id=${id}`, { method: 'PUT', body: JSON.stringify(p) }),
  deleteInstitutionProfile:(id)       => req(`/api/institution-profiles?id=${id}`, { method: 'DELETE' }),

  // Expenses
  getExpensesSummary:      ()                    => req('/api/expenses'),
  getExpensesByMonth:      (year, month)         => req(`/api/expenses?year=${year}&month=${month}`),
  updateExpense:           (id, data)            => req(`/api/expenses?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense:           (id)                  => req(`/api/expenses?id=${id}`, { method: 'DELETE' }),
  uploadCSV: (fileContent, profileId, fileType = 'csv') => req('/api/expenses-upload', { method: 'POST', body: JSON.stringify({ fileContent, profileId, fileType }) }),
};
