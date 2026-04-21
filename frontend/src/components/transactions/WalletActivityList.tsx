import type { ApiTransactionSummary } from '@/lib/types'
import { formatBytes, formatDate } from '@/lib/format'
import Hash from '@/components/ui/Hash'
import Badge from '@/components/ui/Badge'
import RelativeTime from '@/components/ui/RelativeTime'
import { Skeleton } from '@/components/ui/Skeleton'

interface WalletActivityListProps {
  txs?: ApiTransactionSummary[]
  loading?: boolean
}

interface WalletActivityGroup {
  key: string
  ownerAddress: string
  timestamp: number | null
  transactions: ApiTransactionSummary[]
}

function groupWalletActivity(txs: ApiTransactionSummary[]): WalletActivityGroup[] {
  const groups: WalletActivityGroup[] = []

  for (const tx of txs) {
    const timestamp = tx.block?.timestamp ?? null
    const previous = groups[groups.length - 1]

    if (
      previous &&
      previous.ownerAddress === tx.ownerAddress &&
      previous.timestamp === timestamp
    ) {
      previous.transactions.push(tx)
      continue
    }

    groups.push({
      key: `${tx.ownerAddress}:${timestamp ?? 'pending'}:${tx.id}`,
      ownerAddress: tx.ownerAddress,
      timestamp,
      transactions: [tx],
    })
  }

  return groups
}

export default function WalletActivityList({ txs, loading }: WalletActivityListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-bg-card border border-bg-border rounded-lg p-4 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (!txs?.length) {
    return (
      <div className="bg-bg-card border border-bg-border rounded-lg px-6 py-10 text-center text-tx-muted">
        No transactions
      </div>
    )
  }

  const groups = groupWalletActivity(txs)

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const recipients = Array.from(
          new Set(group.transactions.map((tx) => tx.recipient).filter(Boolean))
        ) as string[]
        const totalSize = group.transactions.reduce((sum, tx) => sum + tx.dataSize, 0)

        return (
          <section
            key={group.key}
            className="bg-bg-card border border-bg-border rounded-lg overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-bg-border bg-white/[0.02]">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-tx-primary">
                      {group.transactions.length > 1
                        ? `${group.transactions.length} transactions grouped`
                        : '1 transaction'}
                    </span>
                    <Badge label={group.timestamp ? 'Confirmed batch' : 'Pending'} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-tx-muted">
                    <span>
                      From <Hash value={group.ownerAddress} href={`/wallet/${group.ownerAddress}`} />
                    </span>
                    <span>{formatBytes(totalSize)} total</span>
                    <span>
                      {recipients.length > 0
                        ? `${recipients.length} recipient${recipients.length === 1 ? '' : 's'}`
                        : 'No recipient'}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-tx-muted md:text-right">
                  {group.timestamp ? (
                    <>
                      <div>
                        <RelativeTime timestamp={group.timestamp} />
                      </div>
                      <div className="text-xs">{formatDate(group.timestamp)}</div>
                    </>
                  ) : (
                    <span>Pending</span>
                  )}
                </div>
              </div>
            </div>

            <div className="divide-y divide-bg-border">
              {group.transactions.map((tx) => (
                <div key={tx.id} className="px-4 py-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_auto_auto] md:items-center">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-wider text-tx-muted mb-1">Transaction</div>
                      <Hash value={tx.id} href={`/tx/${tx.id}`} head={16} tail={10} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-wider text-tx-muted mb-1">Recipient</div>
                      {tx.recipient ? (
                        <Hash value={tx.recipient} href={`/wallet/${tx.recipient}`} head={16} tail={10} />
                      ) : (
                        <span className="text-sm text-tx-muted">—</span>
                      )}
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-tx-muted mb-1">Size</div>
                      <span className="text-sm font-mono text-tx-primary">{formatBytes(tx.dataSize)}</span>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-tx-muted mb-1">Type</div>
                      {tx.contentType ? (
                        <Badge label={tx.contentType.split('/')[1] ?? tx.contentType} />
                      ) : (
                        <span className="text-sm text-tx-muted">—</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
