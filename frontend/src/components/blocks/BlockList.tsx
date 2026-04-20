import type { ApiBlockSummary } from '@/lib/types'
import BlockRow from './BlockRow'
import { SkeletonRows } from '@/components/ui/Skeleton'

interface BlockListProps {
  blocks?: ApiBlockSummary[]
  loading?: boolean
}

export default function BlockList({ blocks, loading }: BlockListProps) {
  return (
    <div className="bg-bg-card border border-bg-border rounded-lg overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            <th>Height</th>
            <th>Hash</th>
            <th>Age</th>
            <th>Txs</th>
            <th>Reward</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows rows={10} cols={5} />
          ) : (
            blocks?.map((block) => <BlockRow key={block.id} block={block} />)
          )}
        </tbody>
      </table>
    </div>
  )
}
