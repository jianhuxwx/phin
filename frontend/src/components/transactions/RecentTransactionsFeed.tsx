'use client'

import { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRecentTransactions } from '@/lib/hooks'
import { formatBytes } from '@/lib/format'
import Hash from '@/components/ui/Hash'
import RelativeTime from '@/components/ui/RelativeTime'
import { Skeleton } from '@/components/ui/Skeleton'
import type { ApiTransactionSummary } from '@/lib/types'

type ContentCategory = 'image' | 'json' | 'text' | 'video' | 'manifest' | 'other'

const CATEGORY_COLORS: Record<ContentCategory, string> = {
  image: '#6366f1',
  json: '#f59e0b',
  text: '#22c55e',
  video: '#ef4444',
  manifest: '#06b6d4',
  other: '#64748b',
}

const CATEGORY_LABELS: Record<ContentCategory, string> = {
  image: 'Image',
  json: 'JSON',
  text: 'Text',
  video: 'Video',
  manifest: 'Manifest',
  other: 'Other',
}

function categorize(contentType: string | null): ContentCategory {
  if (!contentType) return 'other'
  if (contentType.includes('manifest')) return 'manifest'
  const [major] = contentType.split('/')
  if (major === 'image') return 'image'
  if (major === 'video') return 'video'
  if (major === 'text') return 'text'
  if (contentType === 'application/json') return 'json'
  return 'other'
}

function TxRow({ tx, isNew }: { tx: ApiTransactionSummary; isNew: boolean }) {
  const cat = categorize(tx.contentType)
  const color = CATEGORY_COLORS[cat]
  const label = CATEGORY_LABELS[cat]

  return (
    <Link
      href={`/tx/${tx.id}`}
      className={`flex items-center gap-3 px-3 py-2 border-b border-bg-border hover:bg-white/[0.02] transition-colors group${isNew ? ' tx-feed-new' : ''}`}
    >
      {/* Content type dot */}
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        title={label}
      />

      {/* TX ID */}
      <span className="shrink-0">
        <Hash value={tx.id} head={6} tail={4} />
      </span>

      {/* App name or content type */}
      <span className="text-xs text-tx-muted truncate flex-1 min-w-0">
        {tx.appName
          ? tx.appName.slice(0, 18)
          : tx.contentType
          ? tx.contentType.split('/')[1]?.slice(0, 12) ?? label
          : label}
      </span>

      {/* Size */}
      {tx.dataSize > 0 && (
        <span className="text-xs font-mono text-tx-muted shrink-0">
          {formatBytes(tx.dataSize)}
        </span>
      )}

      {/* Time */}
      {tx.block && (
        <span className="text-xs text-tx-muted shrink-0">
          <RelativeTime timestamp={tx.block.timestamp} />
        </span>
      )}
    </Link>
  )
}

export default function RecentTransactionsFeed() {
  const { data, isLoading } = useRecentTransactions(5)
  const seenIds = useRef<Set<string>>(new Set())
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!data) return
    const incoming = new Set<string>()
    for (const tx of data) {
      if (!seenIds.current.has(tx.id)) {
        incoming.add(tx.id)
        seenIds.current.add(tx.id)
      }
    }
    if (incoming.size > 0) {
      setNewIds(incoming)
      const timer = setTimeout(() => setNewIds(new Set()), 1000)
      return () => clearTimeout(timer)
    }
  }, [data])

  // Only show txs with data (dataSize > 0) first, then others; limit to 20
  const txs = data
    ? [...data].sort((a, b) => (b.dataSize > 0 ? 1 : 0) - (a.dataSize > 0 ? 1 : 0)).slice(0, 20)
    : []

  return (
    <div className="bg-bg-card border border-bg-border rounded-lg flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border">
        <span className="text-sm font-semibold text-tx-primary uppercase tracking-wider">Recent Transactions</span>
        <span className="flex items-center gap-1.5 text-xs text-tx-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-status-confirmed animate-pulse" />
          Live
        </span>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 border-b border-bg-border">
              <Skeleton className="w-2 h-2 rounded-full shrink-0" />
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-3 flex-1 rounded" />
              <Skeleton className="h-3 w-12 rounded" />
            </div>
          ))
        ) : txs.length === 0 ? (
          <p className="text-xs text-tx-muted px-4 py-6 text-center">No recent transactions</p>
        ) : (
          txs.map((tx) => (
            <TxRow key={tx.id} tx={tx} isNew={newIds.has(tx.id)} />
          ))
        )}
      </div>
    </div>
  )
}
