import Link from 'next/link'
import type { ApiTransactionSummary } from '@/lib/types'
import { formatBytes } from '@/lib/format'
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
        <Hash value={tx.ownerAddress} href={`/wallet/${tx.ownerAddress}`} />
      </td>
      <td>
        {tx.recipient ? (
          <Hash value={tx.recipient} href={`/wallet/${tx.recipient}`} />
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
        {tx.block ? <RelativeTime timestamp={tx.block.timestamp} /> : 'Pending'}
      </td>
    </tr>
  )
}
