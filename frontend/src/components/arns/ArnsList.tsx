'use client'

import { useState, useCallback } from 'react'
import { useArns } from '@/lib/hooks'
import ArnsRow from './ArnsRow'
import Pagination from '@/components/ui/Pagination'
import { SkeletonRows } from '@/components/ui/Skeleton'

interface ArnsListProps {
  initialSearch?: string
}

export default function ArnsList({ initialSearch = '' }: ArnsListProps) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(initialSearch)
  const [inputVal, setInputVal] = useState(initialSearch)

  const { data, isLoading } = useArns(page, search || undefined)

  const handleSearch = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSearch(inputVal)
    setPage(1)
  }, [inputVal])

  return (
    <div>
      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Search ArNS names…"
          className="flex-1 bg-bg-card border border-bg-border rounded-lg px-4 py-2 text-sm text-tx-primary placeholder-tx-muted outline-none focus:border-accent transition-colors font-mono"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg transition-colors"
        >
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); setInputVal(''); setPage(1) }}
            className="px-3 py-2 text-sm text-tx-muted hover:text-tx-primary border border-bg-border rounded-lg transition-colors"
          >
            Clear
          </button>
        )}
      </form>

      <div className="bg-bg-card border border-bg-border rounded-lg overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Owner</th>
              <th>Registered</th>
              <th>Type</th>
              <th>Undernames</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <SkeletonRows rows={15} cols={5} />
            ) : data?.data.length ? (
              data.data.map((record) => <ArnsRow key={record.name} record={record} />)
            ) : (
              <tr>
                <td colSpan={5} className="text-center text-tx-muted py-10">
                  {search ? `No results for "${search}"` : 'No ArNS records found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <Pagination
          page={page}
          hasNextPage={data.pagination.hasNextPage}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      )}
    </div>
  )
}
