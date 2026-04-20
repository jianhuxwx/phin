'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ApiBlockSummary } from '@/lib/types'
import { getWsClient } from '@/lib/ws'
import { useBlocks } from '@/lib/hooks'
import BlockList from './BlockList'
import Pagination from '@/components/ui/Pagination'

export default function LiveBlockFeed() {
  const [page, setPage] = useState(1)
  const { data, isLoading, mutate } = useBlocks(page)

  // Subscribe to WebSocket for live updates on page 1
  useEffect(() => {
    if (page !== 1) return
    const client = getWsClient()
    if (!client) return
    const unsub = client.subscribe(() => {
      mutate() // re-fetch when a new block arrives
    })
    return unsub
  }, [page, mutate])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-tx-primary uppercase tracking-wider">Latest Blocks</h2>
        <span className="flex items-center gap-1.5 text-xs text-tx-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-status-confirmed animate-pulse" />
          Live
        </span>
      </div>
      <BlockList blocks={data?.data} loading={isLoading} />
      {data && (
        <Pagination
          page={page}
          hasNextPage={data.pagination.hasNextPage}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      )}
    </div>
  )
}
