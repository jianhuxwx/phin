export interface ArweaveTag {
  name: string;
  value: string;
}

export interface ArweaveOwner {
  address: string;
}

export interface ArweaveBlockRef {
  id?: string | null;
  height: number;
  timestamp: number;
}

export interface ArweaveDataInfo {
  size: number;
  type: string | null;
}

export interface ArweaveTransaction {
  id: string;
  anchor?: string;
  signature?: string;
  owner: ArweaveOwner;
  recipient?: string | null;
  quantity?: {
    ar: string;
  } | null;
  fee?: {
    ar: string;
  } | null;
  data: ArweaveDataInfo;
  tags: ArweaveTag[];
  block: ArweaveBlockRef | null;
}

export interface ArweaveBlock {
  id: string;
  height: number;
  timestamp: number;
  txCount: number;
  weaveSize: string;
  reward: string;
  miner?: string | null;
  previousBlock?: string | null;
}

export interface ArweaveWallet {
  address: string;
  balance: string;
  lastTransactionId: string | null;
}

export interface ArNSRecord {
  name: string;
  ownerAddress: string;
  transactionId: string;
  registeredAt: Date;
  expiresAt: Date | null;
  recordType: string;
  undernameLimit: number;
  resolvedUrl: string;
  controllerAddress: string | null;
  processId: string | null;
  targetId: string | null;
  targetKind: 'transaction' | 'process' | null;
  ttlSeconds: number | null;
  registeredBlockHeight: number | null;
  lastUpdatedAt: Date;
  lastUpdateTxId: string;
  purchasePrice: string | null;
  purchaseCurrency: string | null;
  rawTags: Record<string, string>;
}

export interface ArNSUndername {
  parentName: string;
  undername: string;
  fullName: string;
  targetId: string | null;
  targetKind: 'transaction' | 'process' | null;
  ttlSeconds: number | null;
  updatedAt: Date;
  updateTxId: string;
}

export interface ArNSEvent {
  eventTxId: string;
  name: string;
  eventType:
    | 'register'
    | 'purchase'
    | 'lease_start'
    | 'renewal'
    | 'transfer'
    | 'target_update'
    | 'controller_update'
    | 'undername_set'
    | 'undername_limit_update'
    | 'update';
  ownerAddress: string | null;
  controllerAddress: string | null;
  targetId: string | null;
  targetKind: 'transaction' | 'process' | null;
  ttlSeconds: number | null;
  expiresAt: Date | null;
  purchasePrice: string | null;
  purchaseCurrency: string | null;
  blockHeight: number | null;
  blockTimestamp: Date;
  rawTags: Record<string, string>;
}

export interface AOProcess {}

export interface AOMessage {}

export interface NetworkStats {
  blockHeight: number;
  weaveSize: string;
  lastBlockTimestamp: number;
  approximateTPS: number;
  lastBlockTxCount: number;
  updatedAt: number;
}

export type GatewayHealthStatus = 'healthy' | 'degraded' | 'down';

export interface GatewayStatus {
  url: string;
  alive: boolean;
  latencyMs: number;
  blockHeight: number | null;
  lastCheckedAt: number;
  consecutiveFailures: number;
  status: GatewayHealthStatus;
  error: string | null;
}

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

export interface ApiError {
  error: string;
  statusCode: number;
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
  block: ArweaveBlockRef | null;
  appName: string | null;
  fileName: string | null;
}

export interface ApiTransactionDetail extends ApiTransactionSummary {
  anchor: string | null;
  signature: string | null;
  tags: ArweaveTag[];
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

export interface ApiWalletFile extends ApiTransactionSummary {}

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
  ownerAddress: string | null;
  displayName: string | null;
  logo: string | null;
  description: string | null;
  keywords: string[];
  updatedAt: string;
  updateTxId: string;
}

export interface ApiArnsDetail extends ApiArnsRecord {
  resolvedUrl: string;
  controllerAddress: string | null;
  processOwnerAddress: string | null;
  controllerAddresses: string[];
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

export interface ApiSearchResolution {
  type:
    | 'transaction'
    | 'wallet'
    | 'block'
    | 'arns'
    | 'unsupported'
    | 'not_found';
  query: string;
  target: string | null;
}

export interface SearchResult extends ApiSearchResolution {
  detail?: Record<string, unknown>;
}

export type WSEventType =
  | 'new_block'
  | 'new_transaction'
  | 'stats_update'
  | 'gateway_status';

export interface WSEvent<T = unknown> {
  type: WSEventType;
  timestamp?: number;
  data: T;
}

export interface ApiKey {}
