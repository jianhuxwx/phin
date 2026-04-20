interface PaginationProps {
  page: number
  hasNextPage: boolean
  onPrev: () => void
  onNext: () => void
}

export default function Pagination({ page, hasNextPage, onPrev, onNext }: PaginationProps) {
  return (
    <div className="flex items-center justify-between py-3 px-1">
      <button
        onClick={onPrev}
        disabled={page <= 1}
        className="px-3 py-1.5 text-sm rounded border border-bg-border text-tx-muted hover:text-tx-primary hover:border-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ← Prev
      </button>
      <span className="text-sm text-tx-muted">Page {page}</span>
      <button
        onClick={onNext}
        disabled={!hasNextPage}
        className="px-3 py-1.5 text-sm rounded border border-bg-border text-tx-muted hover:text-tx-primary hover:border-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Next →
      </button>
    </div>
  )
}
