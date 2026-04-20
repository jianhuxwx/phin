import type { Tag } from '@/lib/types'

interface TagsTableProps {
  tags: Tag[]
}

export default function TagsTable({ tags }: TagsTableProps) {
  if (!tags || tags.length === 0) {
    return <p className="text-tx-muted text-sm">No tags</p>
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th style={{ width: '35%' }}>Name</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {tags.map((tag, i) => (
          <tr key={i}>
            <td className="hash text-tx-hash">{tag.name}</td>
            <td className="hash break-all">{tag.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
