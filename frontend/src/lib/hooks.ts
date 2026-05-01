import useSWR from 'swr'
import * as api from './api'

// Network
export function useNetworkStats() {
  return useSWR('network/stats', api.getNetworkStats, { refreshInterval: 10_000 })
}

export function useGateways() {
  return useSWR('network/gateways', api.getGateways, { refreshInterval: 30_000 })
}

// Blocks
export function useBlocks(page = 1) {
  return useSWR(['blocks', page], () => api.getBlocks(page), { refreshInterval: 15_000 })
}

export function useBlock(id: string) {
  const isHeight = /^\d+$/.test(id)
  return useSWR(
    id ? ['block', id] : null,
    () => (isHeight ? api.getBlockByHeight(Number(id)) : api.getBlockById(id))
  )
}

export function useBlockTxs(id: string, page = 1, limit = 20, height?: number) {
  return useSWR(
    id ? ['block-txs', id, page, limit, height] : null,
    () => api.getBlockTxs(id, page, limit, height)
  )
}

export function useRecentBlocks(limit = 15) {
  return useSWR(
    ['blocks-recent', limit],
    () => api.getBlocks(1, limit),
    { refreshInterval: 15_000 }
  )
}

// Transactions
export function useTx(id: string) {
  return useSWR(id ? ['tx', id] : null, () => api.getTx(id))
}

// Wallets
export function useWallet(address: string) {
  return useSWR(address ? ['wallet', address] : null, () => api.getWallet(address))
}

export function useWalletTxs(address: string, page = 1) {
  return useSWR(
    address ? ['wallet-txs', address, page] : null,
    () => api.getWalletTxs(address, page),
    { refreshInterval: 30_000 }
  )
}

export function useWalletFiles(address: string, page = 1) {
  return useSWR(
    address ? ['wallet-files', address, page] : null,
    () => api.getWalletFiles(address, page)
  )
}

export function useWalletArns(address: string) {
  return useSWR(address ? ['wallet-arns', address] : null, () => api.getWalletArns(address))
}

// ArNS
export function useArns(page = 1, search?: string) {
  return useSWR(['arns', page, search], () => api.getArns(page, 20, search), {
    refreshInterval: 60_000,
  })
}

export function useArnsRecord(name: string) {
  return useSWR(name ? ['arns-record', name] : null, () => api.getArnsRecord(name))
}
