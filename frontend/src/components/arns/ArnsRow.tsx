import Link from 'next/link'
import type { ApiArnsRecord } from '@/lib/types'
import Hash from '@/components/ui/Hash'
import Badge from '@/components/ui/Badge'

interface ArnsRowProps {
  record: ApiArnsRecord
}

export default function ArnsRow({ record }: ArnsRowProps) {
  const registeredDate = new Date(record.registeredAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  return (
    <tr>
      <td>
        <Link href={`/arns/${record.name}`} className="text-accent hover:text-accent-hover font-mono text-sm font-medium transition-colors">
          {record.name}
        </Link>
      </td>
      <td>
        <Hash value={record.ownerAddress} href={`/wallet/${record.ownerAddress}`} />
      </td>
      <td className="text-tx-muted text-sm">{registeredDate}</td>
      <td>
        <Badge label={record.recordType} variant="accent" />
      </td>
      <td className="text-tx-muted text-sm font-mono">{record.undernameLimit}</td>
    </tr>
  )
}
