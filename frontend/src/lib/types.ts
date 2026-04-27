// API contract types matching the actual backend response shapes

export interface Tag {
  name: string
  value: string
}

export interface PaginationMeta {
  page: number
  limit: number
  hasNextPage: boolean
  nextCursor?: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}

export interface ApiBlockSummary {
  id: string
  height: number
  timestamp: number
  txCount: number
  weaveSize: string
  reward: string
}

export interface ApiBlockDetail extends ApiBlockSummary {
  previousBlock: string
  indexedAt: number
}

export interface ApiTransactionSummary {
  id: string
  ownerAddress: string
  recipient: string | null
  feeAr: string
  quantityAr: string
  dataSize: number
  contentType: string | null
  block: {
    id?: string | null
    height: number
    timestamp: number
  } | null
  appName: string | null
  fileName: string | null
}

export interface ApiTransactionDetail extends ApiTransactionSummary {
  anchor: string | null
  signature: string | null
  tags: Tag[]
}

export interface ApiTransactionStatus {
  id: string
  confirmed: boolean
  blockHeight: number | null
  blockTimestamp: number | null
}

export interface ApiWalletSummary {
  address: string
  balance: string
  lastTransactionId: string | null
  arnsCount: number
  hasActivity: boolean
}

export interface ApiNetworkStats {
  blockHeight: number
  weaveSize: string
  lastBlockTimestamp: number
  approximateTPS: number
  lastBlockTxCount: number
  updatedAt: number
}

export interface ApiArnsRecord {
  name: string
  ownerAddress: string
  transactionId: string
  registeredAt: string
  expiresAt: string | null
  recordType: string
  undernameLimit: number
}

export interface ApiArnsUndername {
  undername: string
  fullName: string
  targetId: string | null
  targetKind: 'transaction' | 'process' | null
  ttlSeconds: number | null
  updatedAt: string
  updateTxId: string
}

export interface ApiArnsHistoryEvent {
  eventTxId: string
  eventType:
    | 'register'
    | 'purchase'
    | 'lease_start'
    | 'renewal'
    | 'transfer'
    | 'target_update'
    | 'controller_update'
    | 'undername_set'
    | 'update'
  ownerAddress: string | null
  controllerAddress: string | null
  targetId: string | null
  targetKind: 'transaction' | 'process' | null
  ttlSeconds: number | null
  expiresAt: string | null
  purchasePrice: string | null
  purchaseCurrency: string | null
  blockHeight: number | null
  blockTimestamp: string
}

export interface ApiArnsDetail extends ApiArnsRecord {
  resolvedUrl: string
  controllerAddress: string | null
  processId: string | null
  targetId: string | null
  targetKind: 'transaction' | 'process' | null
  ttlSeconds: number | null
  registeredBlockHeight: number | null
  lastUpdatedAt: string
  lastUpdateTxId: string
  purchasePrice: string | null
  purchaseCurrency: string | null
  undernameCount: number
  undernameLimitHit: boolean
  daysRemaining: number | null
  undernames: ApiArnsUndername[]
}

export interface ApiGatewayStatus {
  url: string
  healthy: boolean
  latencyMs: number | null
  lastChecked: number
}

export interface SearchResult {
  type: 'transaction' | 'wallet' | 'block' | 'arns' | 'not_found'
  query: string
  target: string | null
  detail?: unknown
}
