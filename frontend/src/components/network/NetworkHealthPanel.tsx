'use client'

import { useMemo } from 'react'
import { useNetworkStats } from '@/lib/hooks'
import { formatBytes, formatNumber } from '@/lib/format'
import { Skeleton } from '@/components/ui/Skeleton'

const MAX_TPS = 10
const RADIUS = 38
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function tpsColor(tps: number): string {
  if (tps < 2) return '#22c55e'
  if (tps < 5) return '#f59e0b'
  return '#ef4444'
}

function blockAgeColor(seconds: number): string {
  if (seconds < 90) return '#22c55e'
  if (seconds < 180) return '#f59e0b'
  return '#ef4444'
}

function healthLabel(tps: number, blockAge: number): { label: string; color: string } {
  if (blockAge > 300) return { label: 'Stalled', color: '#ef4444' }
  if (blockAge > 180 || tps === 0) return { label: 'Slow', color: '#f59e0b' }
  return { label: 'Healthy', color: '#22c55e' }
}

export default function NetworkHealthPanel() {
  const { data, isLoading } = useNetworkStats()

  const derived = useMemo(() => {
    if (!data) return null
    const now = Date.now() / 1000
    // lastBlockTimestamp may be 0 if not yet cached — treat as unknown
    const blockAge = data.lastBlockTimestamp > 0 ? now - data.lastBlockTimestamp : null
    const tps = data.approximateTPS
    const fillFraction = Math.min(1, tps / MAX_TPS)
    const offset = CIRCUMFERENCE * (1 - fillFraction)
    const color = tpsColor(tps)
    const ageColor = blockAge !== null ? blockAgeColor(blockAge) : '#64748b'
    const agePct = blockAge !== null ? Math.min(100, (blockAge / 120) * 100) : 0
    const health = blockAge !== null ? healthLabel(tps, blockAge) : { label: 'Unknown', color: '#64748b' }
    return { tps, blockAge, fillFraction, offset, color, ageColor, agePct, health }
  }, [data])

  if (isLoading || !derived) {
    return (
      <div className="bg-bg-card border border-bg-border rounded-lg p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-tx-primary uppercase tracking-wider">Network Health</span>
        </div>
        <Skeleton className="h-28 w-28 rounded-full mx-auto" />
        <Skeleton className="h-3 w-full rounded" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-10 rounded" />
          <Skeleton className="h-10 rounded" />
        </div>
      </div>
    )
  }

  const { tps, blockAge, offset, color, ageColor, agePct, health } = derived

  const blockAgeStr =
    blockAge === null
      ? '—'
      : blockAge < 60
      ? `${Math.floor(blockAge)}s ago`
      : `${Math.floor(blockAge / 60)}m ${Math.floor(blockAge % 60)}s ago`

  return (
    <div className="bg-bg-card border border-bg-border rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-tx-primary uppercase tracking-wider">Network Health</span>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ color: health.color, backgroundColor: `${health.color}18`, border: `1px solid ${health.color}40` }}
        >
          {health.label}
        </span>
      </div>

      {/* TPS Gauge */}
      <div className="flex flex-col items-center gap-1">
        <svg viewBox="0 0 100 100" width={110} height={110}>
          {/* Track */}
          <circle
            cx={50} cy={50} r={RADIUS}
            fill="none"
            stroke="#1f1f1f"
            strokeWidth={8}
          />
          {/* Fill arc */}
          <circle
            cx={50} cy={50} r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1), stroke 0.7s ease' }}
          />
          {/* Center label */}
          <text x={50} y={46} textAnchor="middle" fill="#f1f5f9" fontSize={16} fontWeight="bold" fontFamily="monospace">
            {tps.toFixed(1)}
          </text>
          <text x={50} y={60} textAnchor="middle" fill="#64748b" fontSize={9} fontFamily="monospace">
            TPS
          </text>
        </svg>
      </div>

      {/* Block time bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-tx-muted">Last block</span>
          <span className="text-xs font-mono" style={{ color: ageColor }}>{blockAgeStr}</span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-border overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${agePct}%`, backgroundColor: ageColor }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] text-tx-muted">0s</span>
          <span className="text-[10px] text-tx-muted">2m</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-bg-border">
        <div>
          <div className="text-[10px] text-tx-muted uppercase tracking-wider mb-0.5">Block Height</div>
          <div className="text-sm font-mono font-semibold text-tx-primary">
            {data ? formatNumber(data.blockHeight) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-tx-muted uppercase tracking-wider mb-0.5">Weave Size</div>
          <div className="text-sm font-mono font-semibold text-tx-primary">
            {data && data.weaveSize !== '0' ? formatBytes(Number(data.weaveSize)) : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}
