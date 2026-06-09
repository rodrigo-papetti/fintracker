export function formatUSD(value, decimals = 0) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

export function formatNumber(value, decimals = 0) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

export function formatPct(value, decimals = 1) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.round((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
}

export const CATEGORY_COLORS = {
  bonds:       { bg: '#eff4ff', text: '#2563eb', dot: '#2563eb', badge: 'b-bonds' },
  equity:      { bg: '#edf8f5', text: '#0f9e80', dot: '#0f9e80', badge: 'b-equity' },
  crypto:      { bg: '#fef8ee', text: '#c47a1a', dot: '#c47a1a', badge: 'b-crypto' },
  real_estate: { bg: '#f4f0ff', text: '#7c3aed', dot: '#7c3aed', badge: 'b-real' },
  cash:        { bg: '#f5f5f3', text: '#8a8a85', dot: '#8a8a85', badge: 'b-cash' }
};

export function getCategoryColor(categoryId, categories = []) {
  const custom = categories.find(c => c.id === categoryId);
  if (custom) return custom.color;
  return CATEGORY_COLORS[categoryId]?.dot || '#8a8a85';
}
