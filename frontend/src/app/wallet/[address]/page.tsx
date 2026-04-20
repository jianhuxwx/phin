'use client'

import { useState } from 'react'
import { useWallet, useWalletTxs, useWalletFiles, useWalletArns } from '@/lib/hooks'
import { formatAR, formatNumber } from '@/lib/format'
import Hash from '@/components/ui/Hash'
import StatCard from '@/components/ui/StatCard'
import TransactionList from '@/components/transactions/TransactionList'
import Pagination from '@/components/ui/Pagination'
import { Skeleton } from '@/components/ui/Skeleton'
import RelativeTime from '@/components/ui/RelativeTime'
import Badge from '@/components/ui/Badge'

type Tab = 'transactions' | 'files' | 'arns'

interface WalletPageProps {
  params: { address: string }
}

export default function WalletPage({ params }: WalletPageProps) {
  const { address } = params
  const [tab, setTab] = useState<Tab>('transactions')
  const [txPage, setTxPage] = useState(1)
  const [filePage, setFilePage] = useState(1)

  const { data: wallet, isLoading, error } = useWallet(address)
  const { data: txData, isLoading: txLoading } = useWalletTxs(address, txPage)
  const { data: fileData, isLoading: fileLoading } = useWalletFiles(address, filePage)
  const { data: arnsData, isLoading: arnsLoading } = useWalletArns(address)

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-tx-muted">Wallet not found: <span className="font-mono text-tx-hash">{address}</span></p>
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'transactions', label: 'Transactions' },
    { id: 'files', label: 'Files' },
    { id: 'arns', label: 'ArNS Names' },
  ]

  return (
    <div>
      <h1 className="text-xl font-bold text-tx-primary mb-2">Wallet</h1>
      <div className="mb-6">
        <Hash value={address} head={20} tail={16} className="text-base" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <StatCard label="Balance" value={wallet ? formatAR(wallet.balance) : '—'} />
        <StatCard label="Transactions" value={wallet ? formatNumber(wallet.txCount) : '—'} />
        <StatCard
          label="Last Activity"
          value={wallet?.lastActivity ? <RelativeTime timestamp={wallet.lastActivity} /> as unknown as string : '—'}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-bg-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-accent text-tx-primary'
                : 'border-transparent text-tx-muted hover:text-tx-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'transactions' && (
        <div>
          <TransactionList txs={txData?.data} loading={txLoading} />
          {txData && (
            <Pagination
              page={txPage}
              hasNextPage={txData.pagination.hasNextPage}
              onPrev={() => setTxPage((p) => Math.max(1, p - 1))}
              onNext={() => setTxPage((p) => p + 1)}
            />
          )}
        </div>
      )}

      {tab === 'files' && (
        <div>
          <TransactionList txs={fileData?.data} loading={fileLoading} />
          {fileData && (
            <Pagination
              page={filePage}
              hasNextPage={fileData.pagination.hasNextPage}
              onPrev={() => setFilePage((p) => Math.max(1, p - 1))}
              onNext={() => setFilePage((p) => p + 1)}
            />
          )}
        </div>
      )}

      {tab === 'arns' && (
        <div className="bg-bg-card border border-bg-border rounded-lg overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Transaction</th>
                <th>Registered</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {arnsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j}><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : arnsData?.data.length ? (
                arnsData.data.map((record) => (
                  <tr key={record.name}>
                    <td>
                      <a href={`/arns/${record.name}`} className="text-accent hover:text-accent-hover font-mono text-sm transition-colors">
                        {record.name}
                      </a>
                    </td>
                    <td><Hash value={record.transactionId} href={`/tx/${record.transactionId}`} /></td>
                    <td className="text-tx-muted text-sm">{new Date(record.registeredAt).toLocaleDateString()}</td>
                    <td><Badge label={record.recordType} variant="accent" /></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center text-tx-muted py-8">No ArNS names</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
