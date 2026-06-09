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
  getBriefing:      (refresh)   => req(`/api/briefing${refresh ? '?refresh=1' : ''}`)
};
