'use client'

import { useState } from 'react'
import { useWallet, useWalletTxs, useWalletFiles, useWalletArns } from '@/lib/hooks'
import { formatAR, formatNumber } from '@/lib/format'
import Hash from '@/components/ui/Hash'
import StatCard from '@/components/ui/StatCard'
import TransactionList from '@/components/transactions/TransactionList'
import Pagination from '@/components/ui/Pagination'
import { Skeleton } from '@/components/ui/Skeleton'
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
        <StatCard label="ArNS Names" value={wallet ? formatNumber(wallet.arnsCount) : '—'} />
        <StatCard
          label="Activity"
          value={wallet ? (wallet.hasActivity ? 'Active' : 'No activity') : '—'}
        />
      </div>

      <div className="bg-bg-card border border-bg-border rounded-lg p-5 mb-6">
        <h2 className="text-xs font-semibold text-tx-muted uppercase tracking-wider mb-4">Wallet Details</h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
        ) : wallet ? (
          <dl className="grid grid-cols-1 gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2 border-b border-bg-border">
              <dt className="text-xs text-tx-muted uppercase tracking-wider w-36 shrink-0">Last Transaction</dt>
              <dd className="text-sm text-tx-primary">
                {wallet.lastTransactionId ? (
                  <Hash value={wallet.lastTransactionId} href={`/tx/${wallet.lastTransactionId}`} head={16} tail={12} />
                ) : (
                  <span className="text-tx-muted">—</span>
                )}
              </dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2">
              <dt className="text-xs text-tx-muted uppercase tracking-wider w-36 shrink-0">Recent Transactions</dt>
              <dd className="text-sm text-tx-primary">{txData ? formatNumber(txData.data.length) : '—'}</dd>
            </div>
          </dl>
        ) : null}
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
              ) : arnsData?.length ? (
                arnsData.map((record) => (
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
