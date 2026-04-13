export const CacheKeys = {
  block: (id: string) => `block:${id}`,
  blockByHeight: (height: number) => `block:height:${height}`,
  transaction: (id: string) => `tx:${id}`,
  wallet: (address: string) => `wallet:${address}`,
  walletTxs: (address: string, page: number) => `wallet:${address}:txs:${page}`,
  walletFiles: (address: string) => `wallet:${address}:files`,
  networkStats: () => `network:stats`,
  gatewayStatus: () => `network:gateways`,
  gatewayActive: () => `gateway:active`,
  search: (query: string, page: number) => `search:${query}:${page}`,
  arns: (name: string) => `arns:${name}`,
  preview: (txId: string) => `preview:${txId}`,
  rateLimit: (ip: string, endpoint: string) => `ratelimit:${ip}:${endpoint}`,
  apiKey: (keyId: string) => `apikey:${keyId}`
};

