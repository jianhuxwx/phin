export interface PaginationMeta {
  page: number;
  limit: number;
  hasNextPage: boolean;
  nextCursor?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface GatewayBlockRef {
  id?: string | null;
  height: number;
  timestamp: number;
}

export interface GatewayTag {
  name: string;
  value: string;
}

export interface GatewayTransaction {
  id: string;
  anchor?: string;
  signature?: string;
  owner: {
    address: string;
  };
  recipient?: string | null;
  quantity?: {
    ar: string;
  } | null;
  fee?: {
    ar: string;
  } | null;
  data: {
    size: number;
    type: string | null;
  };
  tags: GatewayTag[];
  block: GatewayBlockRef | null;
}

export interface GatewayBlock {
  id: string;
  height: number;
  timestamp: number;
  txCount: number;
  weaveSize: string;
  reward: string;
  miner?: string | null;
  previousBlock?: string | null;
}

export interface GatewayWallet {
  address: string;
  balance: string;
  lastTransactionId: string | null;
}

export interface GatewayArnsResolution {
  name: string;
  processId: string;
  txId: string;
  resolvedAt: number | null;
  ttlSeconds: number | null;
  undernameLimit: number;
}

export interface NetworkStats {
  blockHeight: number;
  weaveSize: string;
  lastBlockTimestamp: number;
  approximateTPS: number;
  lastBlockTxCount: number;
  updatedAt: number;
}

export interface GatewayStatus {
  url: string;
  alive: boolean;
  latencyMs: number;
  blockHeight: number | null;
  lastCheckedAt: number;
  consecutiveFailures: number;
  status: 'healthy' | 'degraded' | 'down';
  error: string | null;
}

export interface ApiBlockSummary {
  id: string;
  height: number;
  timestamp: number;
  txCount: number;
  weaveSize: string;
  reward: string;
}

export interface ApiBlockDetail extends ApiBlockSummary {
  previousBlock: string | null;
  indexedAt: number | null;
}

export interface ApiTransactionSummary {
  id: string;
  ownerAddress: string;
  recipient: string | null;
  feeAr: string;
  quantityAr: string;
  dataSize: number;
  contentType: string | null;
  block: GatewayBlockRef | null;
  appName: string | null;
  fileName: string | null;
}

export interface ApiTransactionDetail extends ApiTransactionSummary {
  anchor: string | null;
  signature: string | null;
  tags: GatewayTag[];
}

export interface ApiTransactionStatus {
  id: string;
  confirmed: boolean;
  blockHeight: number | null;
  blockTimestamp: number | null;
}

export interface ApiWalletSummary {
  address: string;
  balance: string;
  lastTransactionId: string | null;
  arnsCount: number;
  hasActivity: boolean;
}

export type ApiWalletFile = ApiTransactionSummary;

export interface ApiArnsRecord {
  name: string;
  ownerAddress: string;
  transactionId: string;
  registeredAt: string;
  expiresAt: string | null;
  recordType: string;
  undernameLimit: number;
}

export interface ApiArnsUndername {
  undername: string;
  fullName: string;
  targetId: string | null;
  targetKind: 'transaction' | 'process' | null;
  ttlSeconds: number | null;
  updatedAt: string;
  updateTxId: string;
}

export interface ApiArnsHistoryEvent {
  eventTxId: string;
  eventType:
    | 'register'
    | 'purchase'
    | 'lease_start'
    | 'renewal'
    | 'transfer'
    | 'target_update'
    | 'controller_update'
    | 'undername_set'
    | 'update';
  ownerAddress: string | null;
  controllerAddress: string | null;
  targetId: string | null;
  targetKind: 'transaction' | 'process' | null;
  ttlSeconds: number | null;
  expiresAt: string | null;
  purchasePrice: string | null;
  purchaseCurrency: string | null;
  blockHeight: number | null;
  blockTimestamp: string;
}

export interface ApiArnsDetail extends ApiArnsRecord {
  resolvedUrl: string;
  controllerAddress: string | null;
  processId: string | null;
  targetId: string | null;
  targetKind: 'transaction' | 'process' | null;
  ttlSeconds: number | null;
  registeredBlockHeight: number | null;
  lastUpdatedAt: string;
  lastUpdateTxId: string;
  purchasePrice: string | null;
  purchaseCurrency: string | null;
  undernameCount: number;
  undernameLimitHit: boolean;
  daysRemaining: number | null;
  undernames: ApiArnsUndername[];
}

export interface SearchResult {
  type: 'transaction' | 'wallet' | 'block' | 'arns' | 'unsupported' | 'not_found';
  query: string;
  target: string | null;
  detail?: Record<string, unknown>;
}
