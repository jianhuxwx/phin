import type { GraphQLClient } from 'graphql-request';
import { GatewayPool } from 'phin-gateway';
import type {
  GatewayBlock as ArweaveBlock,
  GatewayStatus,
  GatewayTransaction as ArweaveTransaction,
  GatewayWallet as ArweaveWallet
} from '../contracts';

interface GatewayConnection {
  currentUrl: string;
  client: GraphQLClient;
}

interface TransactionsConnectionResponse {
  transactions?: {
    pageInfo?: {
      hasNextPage: boolean;
    };
    edges?: Array<{
      cursor?: string;
      node: GatewayTransactionNode;
    }>;
  };
}

interface GatewayTag {
  name: string;
  value: string;
}

interface GatewayTransactionNode {
  id: string;
  anchor?: string | null;
  signature?: string | null;
  owner?: {
    address?: string | null;
  } | null;
  recipient?: string | null;
  quantity?:
    | {
        ar?: string | null;
      }
    | string
    | null;
  fee?:
    | {
        ar?: string | null;
      }
    | string
    | null;
  data?: {
    size?: string | number | null;
    type?: string | null;
  } | null;
  tags?: GatewayTag[] | null;
  block?: {
    id?: string | null;
    height?: number | null;
    timestamp?: number | null;
  } | null;
}

export interface GatewayTransactionsPage {
  data: ArweaveTransaction[];
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface GatewayBlocksPage {
  data: ArweaveBlock[];
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface GatewayDataSource {
  getLatestBlocksPage(page: number, limit: number): Promise<GatewayBlocksPage>;
  getBlockById(id: string): Promise<ArweaveBlock | null>;
  getBlockByHeight(height: number): Promise<ArweaveBlock | null>;
  getBlockTransactions(blockId: string, limit: number): Promise<GatewayTransactionsPage>;
  getTransaction(id: string): Promise<ArweaveTransaction | null>;
  getTransactionsByOwner(
    owner: string,
    page: number,
    limit: number
  ): Promise<GatewayTransactionsPage>;
  getWallet(address: string): Promise<ArweaveWallet>;
  getNetworkInfo(): Promise<{ height: number; weaveSize: string; peers: number }>;
  getGatewayStatuses(): Promise<GatewayStatus[]>;
}

interface BlocksConnectionResponse {
  blocks?: {
    pageInfo?: {
      hasNextPage: boolean;
    };
    edges?: Array<{
      cursor?: string;
      node: {
        id: string;
        height: number;
        timestamp: number;
        previous?: string | null;
      };
    }>;
  };
}

const GET_BLOCK_TRANSACTIONS = /* GraphQL */ `
  query GetBlockTransactions($blockId: ID!, $cursor: String, $limit: Int!) {
    block(id: $blockId) {
      transactions(after: $cursor, first: $limit) {
        pageInfo {
          hasNextPage
        }
        edges {
          cursor
          node {
            id
            anchor
            signature
            owner {
              address
            }
            recipient
            quantity {
              ar
            }
            fee {
              ar
            }
            data {
              size
              type
            }
            tags {
              name
              value
            }
            block {
              id
              height
              timestamp
            }
          }
        }
      }
    }
  }
`;

const GET_TRANSACTION = /* GraphQL */ `
  query GetTransaction($id: ID!) {
    transaction(id: $id) {
      id
      anchor
      signature
      owner {
        address
      }
      recipient
      quantity {
        ar
      }
      fee {
        ar
      }
      data {
        size
        type
      }
      tags {
        name
        value
      }
      block {
        id
        height
        timestamp
      }
    }
  }
`;

const GET_LATEST_BLOCKS = /* GraphQL */ `
  query GetLatestBlocks($limit: Int!, $cursor: String) {
    blocks(first: $limit, after: $cursor, sort: HEIGHT_DESC) {
      pageInfo {
        hasNextPage
      }
      edges {
        cursor
        node {
          id
          height
          timestamp
          previous
        }
      }
    }
  }
`;

const GET_BLOCK_BY_ID = /* GraphQL */ `
  query GetBlockById($id: ID!) {
    block(id: $id) {
      id
      height
      timestamp
      previous
    }
  }
`;

const GET_BLOCK_BY_HEIGHT = /* GraphQL */ `
  query GetBlockByHeight($height: Int!) {
    blocks(first: 1, sort: HEIGHT_DESC, height: { min: $height, max: $height }) {
      edges {
        node {
          id
          height
          timestamp
          previous
        }
      }
    }
  }
`;

const GET_TRANSACTIONS_BY_OWNER = /* GraphQL */ `
  query GetTransactionsByOwner($owner: String!, $cursor: String, $limit: Int!) {
    transactions(owners: [$owner], after: $cursor, first: $limit) {
      pageInfo {
        hasNextPage
      }
      edges {
        cursor
        node {
          id
          anchor
          signature
          owner {
            address
          }
          recipient
          quantity {
            ar
          }
          fee {
            ar
          }
          data {
            size
            type
          }
          tags {
            name
            value
          }
          block {
            id
            height
            timestamp
          }
        }
      }
    }
  }
`;

function normalizeGatewayBaseUrl(url: string): string {
  return url.replace(/\/graphql\/?$/, '').replace(/\/+$/, '');
}

function buildGraphqlUrl(url: string): string {
  return url.endsWith('/graphql') ? url : `${normalizeGatewayBaseUrl(url)}/graphql`;
}

function toStringNumber(value: unknown, fallback = '0'): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }
  return fallback;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function mapBlock(block: any): ArweaveBlock {
  return {
    id: block.id,
    height: block.height,
    timestamp: block.timestamp,
    txCount: toNumber(block.txCount, 0),
    weaveSize: toStringNumber(block.weaveSize, '0'),
    reward: toStringNumber(block.reward, '0'),
    miner: typeof block.miner === 'string' ? block.miner : null,
    previousBlock:
      typeof block.previous === 'string'
        ? block.previous
        : typeof block.previousBlock === 'string'
          ? block.previousBlock
          : null
  };
}

interface GatewayBlockMetadata {
  txCount: number;
  weaveSize: string;
  reward: string;
  miner: string | null;
}

function parseBlockMetadata(payload: any): GatewayBlockMetadata {
  const txs = Array.isArray(payload?.txs) ? payload.txs : [];

  return {
    txCount: toNumber(payload?.tx_count ?? payload?.txCount ?? txs.length, txs.length),
    weaveSize: toStringNumber(payload?.weave_size ?? payload?.weaveSize, '0'),
    reward: toStringNumber(payload?.reward, '0'),
    miner:
      typeof payload?.reward_addr === 'string'
        ? payload.reward_addr
        : typeof payload?.miner === 'string'
          ? payload.miner
          : null
  };
}

function mapTransaction(node: GatewayTransactionNode): ArweaveTransaction {
  return {
    id: node.id,
    anchor: node.anchor ?? undefined,
    signature: node.signature ?? undefined,
    owner: {
      address: node.owner?.address ?? ''
    },
    recipient: node.recipient ?? null,
    quantity: {
      ar: typeof node.quantity === 'string' ? node.quantity : node.quantity?.ar ?? '0'
    },
    fee: {
      ar: typeof node.fee === 'string' ? node.fee : node.fee?.ar ?? '0'
    },
    data: {
      size: toNumber(node.data?.size, 0),
      type: node.data?.type ?? null
    },
    tags: node.tags ?? [],
    block:
      node.block?.height != null && node.block.timestamp != null
        ? {
            id: node.block.id ?? null,
            height: node.block.height,
            timestamp: node.block.timestamp
          }
        : null
  };
}

export class GatewayClient implements GatewayDataSource {
  private readonly urls: string[];
  private readonly pool: GatewayPool;
  private static readonly DEGRADED_LATENCY_MS = 2_000;

  constructor(urls: string[]) {
    const uniqueUrls = Array.from(
      new Set(
        urls
          .map((url) => normalizeGatewayBaseUrl(url))
          .filter(Boolean)
      )
    );

    if (!uniqueUrls.length) {
      throw new Error('GatewayClient requires at least one gateway URL');
    }

    this.urls = uniqueUrls;
    this.pool = new GatewayPool(uniqueUrls.map((url) => buildGraphqlUrl(url)));
  }

  private getConnection(): GatewayConnection {
    const client = this.pool.getClient();
    const current = this.pool.getStatus().find((entry) => entry.active);

    if (!current) {
      throw new Error('No active gateway available');
    }

    return {
      currentUrl: current.url,
      client
    };
  }

  private async request<T>(operation: (client: GraphQLClient) => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.urls.length; attempt += 1) {
      const connection = this.getConnection();

      try {
        return await operation(connection.client);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.pool.reportFailure(connection.currentUrl);
      }
    }

    throw lastError ?? new Error('Gateway request failed');
  }

  private async fetchBlockMetadata(path: string): Promise<GatewayBlockMetadata | null> {
    for (const url of this.urls) {
      try {
        const response = await fetch(`${url}${path}`, {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(5_000)
        });

        if (!response.ok) {
          continue;
        }

        return parseBlockMetadata(await response.json());
      } catch {
        continue;
      }
    }

    return null;
  }

  private async enrichBlock(block: ArweaveBlock): Promise<ArweaveBlock> {
    const metadata =
      (await this.fetchBlockMetadata(`/block/hash/${block.id}`)) ??
      (await this.fetchBlockMetadata(`/block/height/${block.height}`));

    if (!metadata) {
      return block;
    }

    return {
      ...block,
      txCount: metadata.txCount,
      weaveSize: metadata.weaveSize,
      reward: metadata.reward,
      miner: metadata.miner ?? block.miner ?? null
    };
  }

  async getLatestBlocksPage(page: number, limit: number): Promise<GatewayBlocksPage> {
    let cursor: string | null = null;
    let currentPage = 1;
    let response: BlocksConnectionResponse = {};

    while (currentPage <= page) {
      response = await this.request<BlocksConnectionResponse>((client) =>
        client.request(GET_LATEST_BLOCKS, { limit, cursor })
      );

      if (currentPage === page) {
        break;
      }

      const lastCursor =
        response.blocks?.edges?.[response.blocks.edges.length - 1]?.cursor ?? null;
      const hasNextPage = response.blocks?.pageInfo?.hasNextPage ?? false;

      if (!hasNextPage || !lastCursor) {
        break;
      }

      cursor = lastCursor;
      currentPage += 1;
    }

    const edges = response.blocks?.edges ?? [];
    const baseBlocks = edges.map((edge) => mapBlock(edge.node));

    return {
      data: await Promise.all(baseBlocks.map((block) => this.enrichBlock(block))),
      hasNextPage: response.blocks?.pageInfo?.hasNextPage ?? false,
      nextCursor: edges[edges.length - 1]?.cursor ?? null
    };
  }

  async getBlockById(id: string): Promise<ArweaveBlock | null> {
    const response = await this.request<any>((client) =>
      client.request(GET_BLOCK_BY_ID, { id })
    );
    return response.block ? await this.enrichBlock(mapBlock(response.block)) : null;
  }

  async getBlockByHeight(height: number): Promise<ArweaveBlock | null> {
    const response = await this.request<any>((client) =>
      client.request(GET_BLOCK_BY_HEIGHT, { height })
    );
    const edge = response.blocks?.edges?.[0];
    return edge?.node ? await this.enrichBlock(mapBlock(edge.node)) : null;
  }

  async getBlockTransactions(blockId: string, limit: number): Promise<GatewayTransactionsPage> {
    const response = await this.request<any>((client) =>
      client.request(GET_BLOCK_TRANSACTIONS, { blockId, cursor: null, limit })
    );
    const page = response.block?.transactions;
    const edges = page?.edges ?? [];

    return {
      data: edges.map((edge: any) => mapTransaction(edge.node)),
      hasNextPage: page?.pageInfo?.hasNextPage ?? false,
      nextCursor: edges[edges.length - 1]?.cursor ?? null
    };
  }

  async getTransaction(id: string): Promise<ArweaveTransaction | null> {
    const response = await this.request<any>((client) =>
      client.request(GET_TRANSACTION, { id })
    );
    return response.transaction ? mapTransaction(response.transaction) : null;
  }

  async getTransactionsByOwner(
    owner: string,
    page: number,
    limit: number
  ): Promise<GatewayTransactionsPage> {
    let cursor: string | null = null;
    let currentPage = 1;
    let response: TransactionsConnectionResponse = {};

    while (currentPage <= page) {
      response = await this.request<TransactionsConnectionResponse>((client) =>
        client.request(GET_TRANSACTIONS_BY_OWNER, {
          owner,
          cursor,
          limit
        })
      );

      if (currentPage === page) {
        break;
      }

      const pageInfo = response.transactions?.pageInfo;
      const lastCursor =
        response.transactions?.edges?.[response.transactions.edges.length - 1]?.cursor ?? null;

      if (!pageInfo?.hasNextPage || !lastCursor) {
        break;
      }

      cursor = lastCursor;
      currentPage += 1;
    }

    const edges = response.transactions?.edges ?? [];

    return {
      data: edges.map((edge) => mapTransaction(edge.node)),
      hasNextPage: response.transactions?.pageInfo?.hasNextPage ?? false,
      nextCursor: edges[edges.length - 1]?.cursor ?? null
    };
  }

  async getWallet(address: string): Promise<ArweaveWallet> {
    const baseUrl = this.urls[0];
    const [balanceResponse, lastTxResponse] = await Promise.all([
      fetch(`${baseUrl}/wallet/${address}/balance`, {
        headers: { accept: 'text/plain' }
      }),
      fetch(`${baseUrl}/wallet/${address}/last_tx`, {
        headers: { accept: 'text/plain' }
      })
    ]);

    if (!balanceResponse.ok) {
      throw new Error(`Wallet balance lookup failed with ${balanceResponse.status}`);
    }

    if (!lastTxResponse.ok) {
      throw new Error(`Wallet last_tx lookup failed with ${lastTxResponse.status}`);
    }

    const balance = (await balanceResponse.text()).trim();
    const lastTransactionIdRaw = (await lastTxResponse.text()).trim();

    return {
      address,
      balance,
      lastTransactionId:
        lastTransactionIdRaw && lastTransactionIdRaw !== 'null' ? lastTransactionIdRaw : null
    };
  }

  async getNetworkInfo(): Promise<{ height: number; weaveSize: string; peers: number }> {
    const baseUrl = this.urls[0];
    const response = await fetch(`${baseUrl}/info`, {
      headers: {
        accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Network info lookup failed with ${response.status}`);
    }

    const payload = await response.json();

    return {
      height: toNumber(payload?.height, 0),
      weaveSize: toStringNumber(payload?.blocks ?? payload?.height, '0'),
      peers: toNumber(payload?.peers, 0)
    };
  }

  async getGatewayStatuses(): Promise<GatewayStatus[]> {
    const now = Date.now();

    const results = await Promise.all(
      this.urls.map(async (url) => {
        const startedAt = Date.now();

        try {
          const response = await fetch(`${url}/info`, {
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(5_000)
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const payload = await response.json();
          const latencyMs = Date.now() - startedAt;

          const status: GatewayStatus['status'] =
            latencyMs > GatewayClient.DEGRADED_LATENCY_MS ? 'degraded' : 'healthy';

          return {
            url,
            alive: true,
            latencyMs,
            blockHeight:
              typeof payload?.height === 'number' && Number.isFinite(payload.height)
                ? payload.height
                : null,
            lastCheckedAt: now,
            consecutiveFailures: 0,
            status,
            error: null
          };
        } catch (error) {
          return {
            url,
            alive: false,
            latencyMs: Date.now() - startedAt,
            blockHeight: null,
            lastCheckedAt: now,
            consecutiveFailures: 1,
            status: 'down' as const,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      })
    );

    return results;
  }
}
