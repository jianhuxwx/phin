'use client'

import { useState } from 'react'
import { useArnsRecord } from '@/lib/hooks'
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

function targetHref(targetId: string | null, targetKind: 'transaction' | 'process' | null): string | undefined {
  if (!targetId) return undefined
  return targetKind === 'transaction' ? `/tx/${targetId}` : undefined
}

const UNDERNAMES_PER_PAGE = 20

export default function ArnsNamePage({ params }: ArnsNamePageProps) {
  const name = decodeURIComponent(params.name)
  const [undernamePage, setUndernamePage] = useState(1)
  const { data: record, isLoading, error } = useArnsRecord(name)
  const undernameCount = record?.undernames.length ?? 0
  const undernamePageCount = Math.max(1, Math.ceil(undernameCount / UNDERNAMES_PER_PAGE))
  const safeUndernamePage = Math.min(undernamePage, undernamePageCount)
  const undernamePageStart = (safeUndernamePage - 1) * UNDERNAMES_PER_PAGE
  const visibleUndernames =
    record?.undernames.slice(undernamePageStart, undernamePageStart + UNDERNAMES_PER_PAGE) ?? []

  const typeSummary = (() => {
    if (!record) return '—'
    if (record.recordType === 'undername') {
      return 'Undername record'
    }
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
          {record ? <Badge label={record.recordType === 'undername' ? 'Undername' : record.recordType === 'lease' ? 'Lease' : 'Permanent'} variant="accent" /> : null}
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
                label: 'Process Owner',
                value: record.processOwnerAddress ? (
                  <Hash value={record.processOwnerAddress} href={`/wallet/${record.processOwnerAddress}`} head={16} tail={12} />
                ) : '—',
              },
              {
                label: 'Controllers',
                value: record.controllerAddresses.length ? (
                  <span className="flex flex-col gap-1">
                    {record.controllerAddresses.map((controller) => (
                      <Hash key={controller} value={controller} href={`/wallet/${controller}`} head={16} tail={12} />
                    ))}
                  </span>
                ) : '—',
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
            {record
              ? `${formatNumber(record.undernameCount)} current${
                  undernameCount ? ` · showing ${formatNumber(undernamePageStart + 1)}-${formatNumber(undernamePageStart + visibleUndernames.length)}` : ''
                }`
              : '—'}
          </p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Undername</th>
              <th>Full Name</th>
              <th>Target</th>
              <th>Owner</th>
              <th>Metadata</th>
              <th>TTL</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j}><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : visibleUndernames.length ? (
              visibleUndernames.map((undername) => (
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
                  <td>
                    {undername.ownerAddress ? (
                      <Hash value={undername.ownerAddress} href={`/wallet/${undername.ownerAddress}`} />
                    ) : (
                      <span className="text-tx-muted">ANT owner</span>
                    )}
                  </td>
                  <td className="text-sm">
                    {undername.displayName || undername.description || undername.keywords.length ? (
                      <div className="flex flex-col gap-1">
                        {undername.displayName ? <span className="text-tx-primary">{undername.displayName}</span> : null}
                        {undername.description ? <span className="text-tx-muted">{undername.description}</span> : null}
                        {undername.keywords.length ? (
                          <span className="text-xs text-tx-muted">{undername.keywords.join(', ')}</span>
                        ) : null}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="text-tx-muted text-sm">
                    {undername.ttlSeconds != null ? formatTTL(undername.ttlSeconds) : '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-center text-tx-muted py-8">No undernames indexed</td>
              </tr>
            )}
          </tbody>
        </table>
        {undernameCount > UNDERNAMES_PER_PAGE ? (
          <div className="p-4 border-t border-bg-border">
            <Pagination
              page={safeUndernamePage}
              hasNextPage={safeUndernamePage < undernamePageCount}
              onPrev={() => setUndernamePage(Math.max(1, safeUndernamePage - 1))}
              onNext={() => setUndernamePage(Math.min(undernamePageCount, safeUndernamePage + 1))}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
