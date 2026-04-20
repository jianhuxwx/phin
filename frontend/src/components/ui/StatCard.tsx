interface StatCardProps {
  label: string
  value: string | number
  sub?: string
}

export default function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="bg-bg-card border border-bg-border rounded-lg px-4 py-3">
      <p className="text-xs text-tx-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-semibold text-tx-primary leading-tight">{value}</p>
      {sub && <p className="text-xs text-tx-muted mt-0.5">{sub}</p>}
    </div>
  )
}
