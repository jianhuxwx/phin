'use client'

import { useState } from 'react'
import { useArnsHistory, useArnsRecord } from '@/lib/hooks'
import { formatNumber, formatTTL } from '@/lib/format'
import Hash from '@/components/ui/Hash'
import Badge from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
import Pagination from '@/components/ui/Pagination'
import { Skeleton } from '@/components/ui/Skeleton'

interface ArnsNamePageProps {
  params: { name: string }
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function eventLabel(eventType: string): string {
  switch (eventType) {
    case 'target_update':
      return 'Target Update'
    case 'controller_update':
      return 'Controller Update'
    case 'undername_set':
      return 'Undername Set'
    case 'renewal':
      return 'Renewal'
    case 'transfer':
      return 'Transfer'
    case 'register':
      return 'Registration'
    case 'purchase':
      return 'Purchase'
    default:
      return 'Update'
  }
}

function targetHref(targetId: string | null, targetKind: 'transaction' | 'process' | null): string | undefined {
  if (!targetId) return undefined
  return targetKind === 'transaction' ? `/tx/${targetId}` : undefined
}

export default function ArnsNamePage({ params }: ArnsNamePageProps) {
  const { name } = params
  const [historyPage, setHistoryPage] = useState(1)
  const { data: record, isLoading, error } = useArnsRecord(name)
  const { data: historyData, isLoading: historyLoading } = useArnsHistory(name, historyPage, 20)

  const typeSummary = (() => {
    if (!record) return '—'
    if (record.recordType === 'lease') {
      const expires = record.expiresAt ? new Date(record.expiresAt).toLocaleDateString() : 'Unknown'
      const days = record.daysRemaining != null ? `${record.daysRemaining}d remaining` : 'Days unknown'
      return `Lease · ${expires} · ${days}`
    }
    return 'Permanent purchase'
  })()

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-tx-muted">ArNS name not found: <span className="font-mono text-tx-hash">{name}</span></p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-tx-primary">ArNS Record</h1>
          {record ? (
            <span className="font-mono text-accent text-lg">{record.name}</span>
          ) : (
            <Skeleton className="h-6 w-32" />
          )}
          {record ? <Badge label={record.recordType === 'lease' ? 'Lease' : 'Permanent'} variant="accent" /> : null}
        </div>
        <p className="text-sm text-tx-muted">
          {record ? record.resolvedUrl : 'Loading resolved URL…'}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Record Type" value={record ? typeSummary : '—'} />
        <StatCard
          label="TTL"
          value={record?.ttlSeconds != null ? formatTTL(record.ttlSeconds) : '—'}
        />
        <StatCard
          label="Undernames"
          value={record ? `${formatNumber(record.undernameCount)} / ${formatNumber(record.undernameLimit)}` : '—'}
          sub={record?.undernameLimitHit ? 'Limit hit' : undefined}
        />
        <StatCard
          label="Purchase Price"
          value={
            record?.purchasePrice
              ? `${record.purchasePrice}${record.purchaseCurrency ? ` ${record.purchaseCurrency}` : ''}`
              : '—'
          }
        />
      </div>

      <div className="bg-bg-card border border-bg-border rounded-lg p-5">
        <h2 className="text-xs font-semibold text-tx-muted uppercase tracking-wider mb-4">Current Record</h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
        ) : record ? (
          <dl className="grid grid-cols-1 gap-0">
            {[
              { label: 'Name', value: <span className="font-mono text-tx-primary">{record.name}</span> },
              { label: 'Resolved URL', value: <span className="font-mono text-tx-primary">{record.resolvedUrl}</span> },
              { label: 'Owner', value: <Hash value={record.ownerAddress} href={`/wallet/${record.ownerAddress}`} head={16} tail={12} /> },
              {
                label: 'Controller',
                value:
                  record.controllerAddress && record.controllerAddress !== record.ownerAddress ? (
                    <Hash value={record.controllerAddress} href={`/wallet/${record.controllerAddress}`} head={16} tail={12} />
                  ) : (
                    <span className="text-tx-muted">Same as owner</span>
                  ),
              },
              {
                label: 'Target',
                value: record.targetId ? (
                  <Hash value={record.targetId} href={targetHref(record.targetId, record.targetKind)} head={16} tail={12} />
                ) : (
                  <span className="text-tx-muted">—</span>
                ),
              },
              {
                label: 'Process ID',
                value: record.processId ? <Hash value={record.processId} head={16} tail={12} /> : '—',
              },
              {
                label: 'Registered',
                value: (
                  <span>
                    {formatDateTime(record.registeredAt)}
                    {record.registeredBlockHeight != null ? ` · block ${formatNumber(record.registeredBlockHeight)}` : ''}
                  </span>
                ),
              },
              {
                label: 'Last Updated',
                value: (
                  <span className="flex flex-col gap-1 sm:flex-row sm:items-center">
                    <span>{formatDateTime(record.lastUpdatedAt)}</span>
                    <Hash value={record.lastUpdateTxId} href={`/tx/${record.lastUpdateTxId}`} head={14} tail={10} />
                  </span>
                ),
              },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2.5 border-b border-bg-border last:border-0">
                <dt className="text-xs text-tx-muted uppercase tracking-wider w-36 shrink-0">{label}</dt>
                <dd className="text-sm text-tx-primary break-all">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      <div className="bg-bg-card border border-bg-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold text-tx-muted uppercase tracking-wider">Undernames</h2>
            {record?.undernameLimitHit ? <p className="text-xs text-status-pending mt-1">Undername limit has been hit.</p> : null}
          </div>
          <p className="text-sm text-tx-muted">
            {record ? `${formatNumber(record.undernameCount)} current` : '—'}
          </p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Undername</th>
              <th>Full Name</th>
              <th>Target</th>
              <th>TTL</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <td key={j}><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : record?.undernames.length ? (
              record.undernames.map((undername) => (
                <tr key={undername.fullName}>
                  <td className="font-mono text-tx-primary">{undername.undername}</td>
                  <td>
                    <a href={`/arns/${undername.fullName}`} className="text-accent hover:text-accent-hover font-mono text-sm transition-colors">
                      {undername.fullName}
                    </a>
                  </td>
                  <td>
                    {undername.targetId ? (
                      <Hash value={undername.targetId} href={targetHref(undername.targetId, undername.targetKind)} />
                    ) : '—'}
                  </td>
                  <td className="text-tx-muted text-sm">
                    {undername.ttlSeconds != null ? formatTTL(undername.ttlSeconds) : '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center text-tx-muted py-8">No undernames indexed</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-bg-card border border-bg-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-border">
          <h2 className="text-xs font-semibold text-tx-muted uppercase tracking-wider">History</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Timestamp</th>
              <th>Owner / Controller</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {historyLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <td key={j}><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : historyData?.data.length ? (
              historyData.data.map((event) => (
                <tr key={`${event.eventTxId}-${event.eventType}`}>
                  <td>
                    <div className="flex flex-col gap-1">
                      <Badge label={eventLabel(event.eventType)} variant="accent" />
                      <Hash value={event.eventTxId} href={`/tx/${event.eventTxId}`} />
                    </div>
                  </td>
                  <td className="text-sm text-tx-primary">
                    <div>{formatDateTime(event.blockTimestamp)}</div>
                    <div className="text-xs text-tx-muted">
                      {event.blockHeight != null ? `Block ${formatNumber(event.blockHeight)}` : 'Unconfirmed'}
                    </div>
                  </td>
                  <td className="text-sm text-tx-primary">
                    <div>
                      {event.ownerAddress ? (
                        <Hash value={event.ownerAddress} href={`/wallet/${event.ownerAddress}`} />
                      ) : '—'}
                    </div>
                    {event.controllerAddress && event.controllerAddress !== event.ownerAddress ? (
                      <div className="mt-1">
                        <Hash value={event.controllerAddress} href={`/wallet/${event.controllerAddress}`} />
                      </div>
                    ) : null}
                  </td>
                  <td className="text-sm text-tx-primary">
                    {event.targetId ? (
                      <Hash value={event.targetId} href={targetHref(event.targetId, event.targetKind)} />
                    ) : event.purchasePrice ? (
                      `${event.purchasePrice}${event.purchaseCurrency ? ` ${event.purchaseCurrency}` : ''}`
                    ) : event.expiresAt ? (
                      `Expires ${formatDateTime(event.expiresAt)}`
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center text-tx-muted py-8">No ArNS history indexed</td>
              </tr>
            )}
          </tbody>
        </table>
        {historyData ? (
          <div className="p-4 border-t border-bg-border">
            <Pagination
              page={historyPage}
              hasNextPage={historyData.pagination.hasNextPage}
              onPrev={() => setHistoryPage((page) => Math.max(1, page - 1))}
              onNext={() => setHistoryPage((page) => page + 1)}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
