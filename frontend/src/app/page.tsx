import LiveBlockFeed from '@/components/blocks/LiveBlockFeed'

export default function HomePage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-tx-primary mb-1">Arweave Permaweb Explorer</h1>
        <p className="text-tx-muted text-sm">
          Explore blocks, transactions, wallets, and ArNS names on the permanent web.
        </p>
      </div>

      <LiveBlockFeed />
    </div>
  )
}
