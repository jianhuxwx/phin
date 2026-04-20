import Link from 'next/link'
import type { ApiTransactionSummary } from '@/lib/types'
import { formatBytes, formatAR } from '@/lib/format'
import Hash from '@/components/ui/Hash'
import Badge from '@/components/ui/Badge'
import RelativeTime from '@/components/ui/RelativeTime'

interface TransactionRowProps {
  tx: ApiTransactionSummary
}

export default function TransactionRow({ tx }: TransactionRowProps) {
  return (
    <tr>
      <td>
        <Hash value={tx.id} href={`/tx/${tx.id}`} />
      </td>
      <td>
        <Hash value={tx.owner} href={`/wallet/${tx.owner}`} />
      </td>
      <td>
        {tx.target ? (
          <Hash value={tx.target} href={`/wallet/${tx.target}`} />
        ) : (
          <span className="text-tx-muted text-sm">—</span>
        )}
      </td>
      <td className="text-tx-muted text-sm font-mono">{formatBytes(tx.dataSize)}</td>
      <td>
        {tx.contentType ? (
          <Badge label={tx.contentType.split('/')[1] ?? tx.contentType} />
        ) : (
          <span className="text-tx-muted text-sm">—</span>
        )}
      </td>
      <td className="text-tx-muted text-sm">
        <RelativeTime timestamp={tx.timestamp} />
      </td>
    </tr>
  )
}
