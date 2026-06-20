interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function StatCard({ label, value, sub, variant = 'default' }: StatCardProps) {
  return (
    <div className={`stat-card stat-card--${variant}`}>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}
