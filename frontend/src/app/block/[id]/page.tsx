'use client'

import { useEffect, useState } from 'react'
import { useBlock, useBlockTxs } from '@/lib/hooks'
import { formatNumber, formatAR, formatBytes, formatDate } from '@/lib/format'
import Hash from '@/components/ui/Hash'
import Badge from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
import TransactionList from '@/components/transactions/TransactionList'
import Pagination from '@/components/ui/Pagination'
import { Skeleton } from '@/components/ui/Skeleton'

interface BlockPageProps {
  params: { id: string }
}

export default function BlockPage({ params }: BlockPageProps) {
  const { id } = params
  const { data: block, isLoading, error } = useBlock(id)
  const [txPage, setTxPage] = useState(1)
  const { data: txData, isLoading: txLoading } = useBlockTxs(
    block?.id ?? '',
    txPage,
    20,
    block?.height
  )

  useEffect(() => {
    setTxPage(1)
  }, [block?.id])

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-tx-muted">Block not found: <span className="font-mono text-tx-hash">{id}</span></p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-tx-primary">Block</h1>
        {block ? (
          <span className="font-mono text-accent text-lg">#{formatNumber(block.height)}</span>
        ) : (
          <Skeleton className="h-6 w-24" />
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Height" value={block ? formatNumber(block.height) : '—'} />
        <StatCard label="Transactions" value={block ? block.txCount : '—'} />
        <StatCard label="Reward" value={block ? formatAR(block.reward) : '—'} />
        <StatCard label="Weave Size" value={block ? formatBytes(Number(block.weaveSize)) : '—'} />
      </div>

      {/* Detail card */}
      <div className="bg-bg-card border border-bg-border rounded-lg p-5 mb-6">
        <h2 className="text-xs font-semibold text-tx-muted uppercase tracking-wider mb-4">Block Details</h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
        ) : block ? (
          <dl className="grid grid-cols-1 gap-3">
            {[
              { label: 'Block Hash', value: <Hash value={block.id} head={16} tail={12} /> },
              { label: 'Previous Block', value: block.previousBlock ? <Hash value={block.previousBlock} href={`/block/${block.previousBlock}`} head={16} tail={12} /> : <span className="text-tx-muted">—</span> },
              { label: 'Timestamp', value: formatDate(block.timestamp) },
              { label: 'Indexed At', value: block.indexedAt ? formatDate(block.indexedAt / 1000) : <span className="text-tx-muted">Live gateway</span> },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2 border-b border-bg-border last:border-0">
                <dt className="text-xs text-tx-muted uppercase tracking-wider w-36 shrink-0">{label}</dt>
                <dd className="text-sm text-tx-primary">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      {/* Transactions */}
      <div>
        <h2 className="text-sm font-semibold text-tx-primary uppercase tracking-wider mb-3">
          Transactions {block ? `(${block.txCount})` : ''}
        </h2>
        <TransactionList txs={txData?.data} loading={txLoading} />
        {txData && (
          <Pagination
            page={txPage}
            hasNextPage={txData.pagination.hasNextPage}
            onPrev={() => setTxPage((p) => Math.max(1, p - 1))}
            onNext={() => setTxPage((p) => p + 1)}
          />
        )}
      </div>
    </div>
  )
}
