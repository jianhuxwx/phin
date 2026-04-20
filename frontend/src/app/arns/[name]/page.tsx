'use client'

import { useArnsRecord } from '@/lib/hooks'
import Hash from '@/components/ui/Hash'
import Badge from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
import { Skeleton } from '@/components/ui/Skeleton'

interface ArnsNamePageProps {
  params: { name: string }
}

export default function ArnsNamePage({ params }: ArnsNamePageProps) {
  const { name } = params
  const { data: record, isLoading, error } = useArnsRecord(name)

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-tx-muted">ArNS name not found: <span className="font-mono text-tx-hash">{name}</span></p>
      </div>
    )
  }

  const registeredDate = record
    ? new Date(record.registeredAt).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      })
    : '—'

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-tx-primary">ArNS Record</h1>
        {record ? (
          <span className="font-mono text-accent text-lg">{record.name}</span>
        ) : (
          <Skeleton className="h-6 w-32" />
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <StatCard label="Record Type" value={record?.recordType ?? '—'} />
        <StatCard label="Undernames" value={record?.undernameLimit ?? '—'} />
        <StatCard label="Expires" value={record?.expiresAt ? new Date(record.expiresAt).toLocaleDateString() : 'Never'} />
      </div>

      {/* Detail card */}
      <div className="bg-bg-card border border-bg-border rounded-lg p-5">
        <h2 className="text-xs font-semibold text-tx-muted uppercase tracking-wider mb-4">Details</h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
        ) : record ? (
          <dl className="grid grid-cols-1 gap-0">
            {[
              { label: 'Name', value: <span className="font-mono text-tx-primary">{record.name}</span> },
              { label: 'Owner', value: <Hash value={record.ownerAddress} href={`/wallet/${record.ownerAddress}`} head={16} tail={12} /> },
              { label: 'Transaction', value: <Hash value={record.transactionId} href={`/tx/${record.transactionId}`} head={16} tail={12} /> },
              { label: 'Registered', value: registeredDate },
              { label: 'Type', value: <Badge label={record.recordType} variant="accent" /> },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2.5 border-b border-bg-border last:border-0">
                <dt className="text-xs text-tx-muted uppercase tracking-wider w-36 shrink-0">{label}</dt>
                <dd className="text-sm text-tx-primary">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </div>
  )
}
