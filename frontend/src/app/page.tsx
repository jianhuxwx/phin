import LiveBlockFeed from '@/components/blocks/LiveBlockFeed'
import BlockActivityChart from '@/components/blocks/BlockActivityChart'
import NetworkHealthPanel from '@/components/network/NetworkHealthPanel'
import GatewayStatusPanel from '@/components/network/GatewayStatusPanel'
import RecentTransactionsFeed from '@/components/transactions/RecentTransactionsFeed'
import ContentTypeDistribution from '@/components/transactions/ContentTypeDistribution'
import RecentArnsActivity from '@/components/arns/RecentArnsActivity'

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-tx-primary mb-1">Arweave Permaweb Explorer</h1>
        <p className="text-tx-muted text-sm">
          Explore blocks, transactions, wallets, and ArNS names on the permanent web.
        </p>
      </div>

      {/* Row 1: Network health + Block activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <NetworkHealthPanel />
        </div>
        <div className="lg:col-span-2">
          <BlockActivityChart />
        </div>
      </div>

      {/* Row 2: Recent transactions + Gateway status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RecentTransactionsFeed />
        </div>
        <div className="lg:col-span-1">
          <GatewayStatusPanel />
        </div>
      </div>

      {/* Row 3: Content type distribution + ArNS activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ContentTypeDistribution />
        <RecentArnsActivity />
      </div>

      {/* Row 4: Live block feed */}
      <LiveBlockFeed />
    </div>
  )
}
