import Link from 'next/link'
import SearchBar from '@/components/search/SearchBar'

export default function Header() {
  return (
    <header className="border-b border-bg-border bg-bg-card sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold text-tx-primary tracking-tight">
            phin<span className="text-accent">.</span>ar
          </span>
        </Link>

        <div className="flex-1">
          <SearchBar />
        </div>

        <nav className="hidden md:flex items-center gap-4 shrink-0">
          <Link href="/" className="text-sm text-tx-muted hover:text-tx-primary transition-colors">
            Blocks
          </Link>
          <Link href="/arns" className="text-sm text-tx-muted hover:text-tx-primary transition-colors">
            ArNS
          </Link>
        </nav>
      </div>
    </header>
  )
}
