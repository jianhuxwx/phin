'use client'

import { useEffect } from 'react'
import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-6xl font-bold text-bg-border mb-4">500</p>
      <h1 className="text-xl font-semibold text-tx-primary mb-2">Something went wrong</h1>
      <p className="text-tx-muted text-sm mb-8 max-w-md">
        {error.message?.startsWith('API ')
          ? 'The explorer could not load this resource. The gateway may be unavailable.'
          : 'An unexpected error occurred.'}
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 border border-bg-border hover:border-accent/40 text-tx-muted hover:text-tx-primary text-sm rounded-lg transition-colors"
        >
          Back to Explorer
        </Link>
      </div>
    </div>
  )
}
