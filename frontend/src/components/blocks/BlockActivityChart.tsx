'use client'

import { useState } from 'react'
import { useRecentBlocks } from '@/lib/hooks'
import { relativeTime } from '@/lib/format'
import { Skeleton } from '@/components/ui/Skeleton'

const CHART_W = 400
const CHART_H = 72
const BAR_GAP = 2

function barColor(txCount: number, maxTxCount: number): string {
  if (maxTxCount === 0) return '#6366f1'
  const ratio = txCount / maxTxCount
  if (ratio < 0.4) return '#22c55e'
  if (ratio < 0.75) return '#f59e0b'
  return '#ef4444'
}

interface TooltipData {
  x: number
  y: number
  height: number
  txCount: number
  blockHeight: number
  timestamp: number
}

export default function BlockActivityChart() {
  const { data, isLoading } = useRecentBlocks(20)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  if (isLoading) {
    return (
      <div className="bg-bg-card border border-bg-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-tx-primary uppercase tracking-wider">Block Activity</span>
        </div>
        <Skeleton className="h-20 w-full rounded" />
      </div>
    )
  }

  const blocks = [...(data?.data ?? [])].reverse() // oldest → newest left → right
  const maxTxCount = Math.max(...blocks.map((b) => b.txCount), 1)
  const count = blocks.length || 1
  const barW = (CHART_W - BAR_GAP * (count - 1)) / count

  return (
    <div className="bg-bg-card border border-bg-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-tx-primary uppercase tracking-wider">Block Activity</span>
        <span className="text-xs text-tx-muted">Last {blocks.length} blocks · tx count</span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H + 16}`}
          width="100%"
          preserveAspectRatio="none"
          className="overflow-visible"
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Baseline */}
          <line
            x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H}
            stroke="#1f1f1f" strokeWidth={1}
          />

          {/* Y-axis labels */}
          <text x={0} y={CHART_H + 14} fill="#64748b" fontSize={8} fontFamily="monospace">0</text>
          <text x={CHART_W - 4} y={10} fill="#64748b" fontSize={8} fontFamily="monospace" textAnchor="end">
            {maxTxCount}
          </text>

          {blocks.map((block, i) => {
            const barH = Math.max(2, (block.txCount / maxTxCount) * CHART_H)
            const x = i * (barW + BAR_GAP)
            const y = CHART_H - barH
            const color = barColor(block.txCount, maxTxCount)

            return (
              <g key={block.id}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  fill={color}
                  opacity={0.85}
                  rx={1}
                  className="transition-opacity duration-150 hover:opacity-100"
                  onMouseEnter={() =>
                    setTooltip({ x, y, height: barH, txCount: block.txCount, blockHeight: block.height, timestamp: block.timestamp })
                  }
                />
              </g>
            )
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-10 pointer-events-none bg-bg-card border border-bg-border rounded px-2 py-1.5 text-xs shadow-lg"
            style={{
              left: `${(tooltip.x / CHART_W) * 100}%`,
              top: 0,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-mono text-tx-primary font-semibold">#{tooltip.blockHeight}</div>
            <div className="text-tx-muted">{tooltip.txCount} txs</div>
            <div className="text-tx-muted">{relativeTime(tooltip.timestamp)}</div>
          </div>
        )}
      </div>
    </div>
  )
}
