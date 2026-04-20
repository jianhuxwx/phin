import Link from 'next/link'
import type { ApiBlockSummary } from '@/lib/types'
import { formatNumber, formatAR } from '@/lib/format'
import Hash from '@/components/ui/Hash'
import RelativeTime from '@/components/ui/RelativeTime'

interface BlockRowProps {
  block: ApiBlockSummary
}

export default function BlockRow({ block }: BlockRowProps) {
  return (
    <tr>
      <td>
        <Link href={`/block/${block.height}`} className="text-accent hover:text-accent-hover font-mono font-medium transition-colors">
          {formatNumber(block.height)}
        </Link>
      </td>
      <td>
        <Hash value={block.id} href={`/block/${block.id}`} />
      </td>
      <td className="text-tx-muted text-sm">
        <RelativeTime timestamp={block.timestamp} />
      </td>
      <td className="text-tx-primary text-sm">{block.txCount}</td>
      <td className="text-tx-muted text-sm font-mono">{formatAR(block.reward)}</td>
    </tr>
  )
}
