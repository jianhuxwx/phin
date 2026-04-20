export default function Footer() {
  return (
    <footer className="border-t border-bg-border mt-16">
      <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
        <span className="text-sm text-tx-muted">
          phin<span className="text-accent">.</span>ar · Arweave Permaweb Explorer
        </span>
        <span className="text-xs text-tx-muted">
          Powered by{' '}
          <a
            href="https://ar.io"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-tx-primary transition-colors"
          >
            ar.io
          </a>
        </span>
      </div>
    </footer>
  )
}
