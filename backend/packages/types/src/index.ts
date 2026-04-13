// Arweave primitives
export interface ArweaveBlock {}
export interface ArweaveTransaction {}
export interface ArweaveTag {}
export interface ArweaveWallet {}

// ArNS
export interface ArNSRecord {
  name: string;
  ownerAddress: string;
  transactionId: string;
  registeredAt: Date;
  expiresAt: Date | null;
  recordType: string;
  undernameLimit: number;
  rawTags: Record<string, string>;
}

// AO
export interface AOProcess {}
export interface AOMessage {}

// Network
export interface NetworkStats {}

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

// API
export interface PaginatedResponse<T> {}
export interface ApiError {}
export interface SearchResult {}

// WebSocket events
export type WSEventType =
  | 'new_block'
  | 'new_transaction'
  | 'stats_update'
  | 'gateway_status';

export interface WSEvent<T = unknown> {}

// API Key / Auth
export interface ApiKey {}

