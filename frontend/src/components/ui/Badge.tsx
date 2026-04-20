import clsx from 'clsx'

interface BadgeProps {
  label: string
  variant?: 'default' | 'confirmed' | 'pending' | 'accent'
}

const variants = {
  default: 'bg-bg-border text-tx-muted',
  confirmed: 'bg-status-confirmed/10 text-status-confirmed border border-status-confirmed/20',
  pending: 'bg-status-pending/10 text-status-pending border border-status-pending/20',
  accent: 'bg-accent/10 text-accent border border-accent/20',
}

export default function Badge({ label, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-block px-2 py-0.5 rounded text-xs font-medium',
        variants[variant]
      )}
    >
      {label}
    </span>
  )
}
