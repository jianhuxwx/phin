'use client'

import { useMemo } from 'react'
import { useRecentTransactions } from '@/lib/hooks'
import { Skeleton } from '@/components/ui/Skeleton'

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

export default function ContentTypeDistribution() {
  const { data, isLoading } = useRecentTransactions(5)

  const distribution = useMemo(() => {
    if (!data || data.length === 0) return null
    const counts: Record<ContentCategory, number> = {
      image: 0, json: 0, text: 0, video: 0, manifest: 0, other: 0,
    }
    for (const tx of data) {
      counts[categorize(tx.contentType)]++
    }
    const total = data.length
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([cat, count]) => ({
        cat: cat as ContentCategory,
        count,
        pct: (count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count)
  }, [data])

  return (
    <div className="bg-bg-card border border-bg-border rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-tx-primary uppercase tracking-wider">Content Types</span>
        {data && (
          <span className="text-xs text-tx-muted">{data.length} recent txs</span>
        )}
      </div>

      {isLoading ? (
        <>
          <Skeleton className="h-4 w-full rounded-full" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-16 rounded" />
            ))}
          </div>
        </>
      ) : !distribution ? (
        <p className="text-xs text-tx-muted">No data available</p>
      ) : (
        <>
          {/* Stacked bar */}
          <div className="flex h-4 rounded-full overflow-hidden gap-px">
            {distribution.map(({ cat, pct }) => (
              <div
                key={cat}
                className="h-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat] }}
                title={`${CATEGORY_LABELS[cat]}: ${pct.toFixed(1)}%`}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {distribution.map(({ cat, count, pct }) => (
              <div key={cat} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                />
                <span className="text-xs text-tx-muted">
                  {CATEGORY_LABELS[cat]}
                </span>
                <span className="text-xs font-mono text-tx-primary">
                  {pct.toFixed(0)}%
                </span>
                <span className="text-[10px] text-tx-muted">({count})</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
