'use client'

import { useTx } from '@/lib/hooks'
import { formatAR, formatBytes, formatDate } from '@/lib/format'
import Hash from '@/components/ui/Hash'
import Badge from '@/components/ui/Badge'
import TagsTable from '@/components/ui/TagsTable'
import StatCard from '@/components/ui/StatCard'
import { Skeleton } from '@/components/ui/Skeleton'

interface TxPageProps {
  params: { id: string }
}

export default function TxPage({ params }: TxPageProps) {
  const { id } = params
  const { data: tx, isLoading, error } = useTx(id)

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-tx-muted">Transaction not found: <span className="font-mono text-tx-hash">{id}</span></p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-tx-primary">Transaction</h1>
        {tx ? (
          <Badge
            label={tx.block ? 'Confirmed' : 'Pending'}
            variant={tx.block ? 'confirmed' : 'pending'}
          />
        ) : null}
      </div>

      <div className="mb-4">
        {isLoading ? (
          <Skeleton className="h-5 w-96" />
        ) : tx ? (
          <Hash value={tx.id} head={20} tail={16} className="text-base" />
        ) : null}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Quantity" value={tx ? formatAR(tx.quantityAr) : '—'} />
        <StatCard label="Fee" value={tx ? formatAR(tx.feeAr) : '—'} />
        <StatCard label="Data Size" value={tx ? formatBytes(tx.dataSize) : '—'} />
        <StatCard label="Block" value={tx?.block ? `#${tx.block.height}` : 'Pending'} />
      </div>

      {/* Detail card */}
      <div className="bg-bg-card border border-bg-border rounded-lg p-5 mb-6">
        <h2 className="text-xs font-semibold text-tx-muted uppercase tracking-wider mb-4">Details</h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
        ) : tx ? (
          <dl className="grid grid-cols-1 gap-0">
            {[
              { label: 'From', value: <Hash value={tx.ownerAddress} href={`/wallet/${tx.ownerAddress}`} head={16} tail={12} /> },
              { label: 'To', value: tx.recipient ? <Hash value={tx.recipient} href={`/wallet/${tx.recipient}`} head={16} tail={12} /> : <span className="text-tx-muted">—</span> },
              { label: 'Block', value: tx.block?.id ? <a href={`/block/${tx.block.id}`} className="hash text-accent hover:text-accent-hover">{tx.block.id.slice(0, 16)}…</a> : <span className="text-tx-muted">Pending</span> },
              { label: 'Timestamp', value: tx.block ? formatDate(tx.block.timestamp) : 'Pending' },
              { label: 'Content Type', value: tx.contentType ? <Badge label={tx.contentType} /> : <span className="text-tx-muted">—</span> },
              { label: 'App', value: tx.appName ?? <span className="text-tx-muted">—</span> },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2.5 border-b border-bg-border last:border-0">
                <dt className="text-xs text-tx-muted uppercase tracking-wider w-36 shrink-0">{label}</dt>
                <dd className="text-sm text-tx-primary">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      {/* Tags */}
      <div className="bg-bg-card border border-bg-border rounded-lg p-5">
        <h2 className="text-xs font-semibold text-tx-muted uppercase tracking-wider mb-4">Tags</h2>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
          </div>
        ) : tx ? (
          <TagsTable tags={tx.tags} />
        ) : null}
      </div>
    </div>
  )
}
