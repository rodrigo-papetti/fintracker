export default function Expenses() {
  return (
    <div className="empty-state">
      <div className="empty-icon"><i className="ti ti-receipt" aria-hidden="true" /></div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Expenses tracker</div>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>Manual entry + categorization coming in v2</div>
      <span className="pill">Planned for v2</span>
    </div>
  );
}
