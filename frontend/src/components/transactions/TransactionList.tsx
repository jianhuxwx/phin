import type { ApiTransactionSummary } from '@/lib/types'
import TransactionRow from './TransactionRow'
import { SkeletonRows } from '@/components/ui/Skeleton'

interface TransactionListProps {
  txs?: ApiTransactionSummary[]
  loading?: boolean
}

export default function TransactionList({ txs, loading }: TransactionListProps) {
  return (
    <div className="bg-bg-card border border-bg-border rounded-lg overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            <th>TX ID</th>
            <th>From</th>
            <th>To</th>
            <th>Size</th>
            <th>Type</th>
            <th>Age</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows rows={10} cols={6} />
          ) : txs && txs.length > 0 ? (
            txs.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
          ) : (
            <tr>
              <td colSpan={6} className="text-center text-tx-muted py-8">
                No transactions
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
