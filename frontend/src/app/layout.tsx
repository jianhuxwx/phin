import type { Metadata } from 'next'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import NetworkStatsBar from '@/components/network/NetworkStatsBar'
import BlockStrip from '@/components/blocks/BlockStrip'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'phin.ar — Arweave Permaweb Explorer',
  description: 'Explore blocks, transactions, wallets, and ArNS names on the Arweave permaweb.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-tx-primary min-h-screen flex flex-col">
        <Header />
        <NetworkStatsBar />
        <BlockStrip />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
