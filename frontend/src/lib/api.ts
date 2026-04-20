import type {
  PaginatedResponse,
  ApiBlockSummary,
  ApiBlockDetail,
  ApiTransactionSummary,
  ApiTransactionDetail,
  ApiWalletSummary,
  ApiNetworkStats,
  ApiArnsRecord,
  ApiGatewayStatus,
  SearchResult,
} from './types'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate: 0 } })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// Blocks
export const getBlocks = (page = 1, limit = 20) =>
  apiFetch<PaginatedResponse<ApiBlockSummary>>(`/v1/blocks?page=${page}&limit=${limit}`)

export const getBlockById = (id: string) =>
  apiFetch<ApiBlockDetail>(`/v1/blocks/${id}`)

export const getBlockByHeight = (height: number) =>
  apiFetch<ApiBlockDetail>(`/v1/blocks/height/${height}`)

export const getBlockTxs = (id: string, limit = 20) =>
  apiFetch<PaginatedResponse<ApiTransactionSummary>>(`/v1/blocks/${id}/transactions?limit=${limit}`)

// Transactions
export const getTx = (id: string) =>
  apiFetch<ApiTransactionDetail>(`/v1/transactions/${id}`)

export const getTxStatus = (id: string) =>
  apiFetch<{ confirmed: boolean; confirmations: number }>(`/v1/transactions/${id}/status`)

// Wallets
export const getWallet = (address: string) =>
  apiFetch<ApiWalletSummary>(`/v1/wallets/${address}`)

export const getWalletTxs = (address: string, page = 1, limit = 20) =>
  apiFetch<PaginatedResponse<ApiTransactionSummary>>(
    `/v1/wallets/${address}/transactions?page=${page}&limit=${limit}`
  )

export const getWalletFiles = (address: string, page = 1, limit = 20) =>
  apiFetch<PaginatedResponse<ApiTransactionSummary>>(
    `/v1/wallets/${address}/files?page=${page}&limit=${limit}`
  )

export const getWalletArns = (address: string) =>
  apiFetch<PaginatedResponse<ApiArnsRecord>>(`/v1/wallets/${address}/arns`)

// Search
export const search = (q: string) =>
  apiFetch<SearchResult>(`/v1/search?q=${encodeURIComponent(q)}`)

export const searchSuggest = (q: string) =>
  apiFetch<string[]>(`/v1/search/suggest?q=${encodeURIComponent(q)}`)

// Network
export const getNetworkStats = () =>
  apiFetch<ApiNetworkStats>('/v1/network/stats')

export const getGateways = () =>
  apiFetch<ApiGatewayStatus[]>('/v1/network/gateways')

// ArNS
export const getArns = (page = 1, limit = 20, search?: string) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (search) params.set('search', search)
  return apiFetch<PaginatedResponse<ApiArnsRecord>>(`/v1/arns?${params}`)
}

export const getArnsRecord = (name: string) =>
  apiFetch<ApiArnsRecord>(`/v1/arns/${name}`)
