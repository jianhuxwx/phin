'use client'

import Link from 'next/link'
import { useArns } from '@/lib/hooks'
import Hash from '@/components/ui/Hash'
import { Skeleton } from '@/components/ui/Skeleton'

function isNew(registeredAt: string): boolean {
  const reg = new Date(registeredAt).getTime()
  return Date.now() - reg < 24 * 60 * 60 * 1000
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RecentArnsActivity() {
  const { data, isLoading } = useArns(1)
  const records = data?.data.slice(0, 8) ?? []

  return (
    <div className="bg-bg-card border border-bg-border rounded-lg flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border">
        <span className="text-sm font-semibold text-tx-primary uppercase tracking-wider">ArNS Activity</span>
        {data && (
          <Link href="/arns" className="text-xs text-accent hover:text-accent-hover transition-colors">
            View all →
          </Link>
        )}
      </div>

      <div className="flex flex-col">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-bg-border">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-3 flex-1 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            ))
          : records.length === 0
          ? (
            <p className="text-xs text-tx-muted px-4 py-6 text-center">No ArNS records found</p>
          )
          : records.map((record) => (
            <div
              key={record.name}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-bg-border hover:bg-white/[0.02] transition-colors"
            >
              {/* Name */}
              <Link
                href={`/arns/${record.name}`}
                className="text-sm font-mono text-accent hover:text-accent-hover transition-colors shrink-0 font-medium"
              >
                {record.name}
              </Link>

              {/* New badge */}
              {isNew(record.registeredAt) && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 shrink-0">
                  NEW
                </span>
              )}

              {/* Owner */}
              <span className="flex-1 min-w-0">
                <Hash value={record.ownerAddress} head={5} tail={4} />
              </span>

              {/* Date */}
              <span className="text-xs text-tx-muted shrink-0">
                {formatDate(record.registeredAt)}
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}
