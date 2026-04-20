import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-6xl font-bold text-bg-border mb-4">404</p>
      <h1 className="text-xl font-semibold text-tx-primary mb-2">Page not found</h1>
      <p className="text-tx-muted text-sm mb-8">
        The block, transaction, wallet, or ArNS name you're looking for doesn't exist.
      </p>
      <Link
        href="/"
        className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg transition-colors"
      >
        Back to Explorer
      </Link>
    </div>
  )
}
