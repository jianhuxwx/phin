'use client'

import { useNetworkStats } from '@/lib/hooks'
import { formatNumber, formatBytes } from '@/lib/format'

export default function NetworkStatsBar() {
  const { data } = useNetworkStats()

  const items = data
    ? [
        { label: 'Block Height', value: formatNumber(data.blockHeight) },
        { label: 'Weave Size', value: data.weaveSize === '0' ? 'N/A' : formatBytes(Number(data.weaveSize)) },
        { label: 'TPS', value: data.approximateTPS.toFixed(2) },
        { label: 'Last Block Txs', value: formatNumber(data.lastBlockTxCount) },
      ]
    : Array.from({ length: 4 }, (_, i) => ({ label: ['Block Height', 'Weave Size', 'TPS', 'Last Block Txs'][i], value: '—' }))

  return (
    <div className="border-b border-bg-border bg-bg-card">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-6 overflow-x-auto">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-tx-muted uppercase tracking-wider">{item.label}</span>
            <span className="text-sm font-mono font-medium text-tx-primary">{item.value}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-status-confirmed animate-pulse" />
          <span className="text-xs text-tx-muted">Live</span>
        </div>
      </div>
    </div>
  )
}
