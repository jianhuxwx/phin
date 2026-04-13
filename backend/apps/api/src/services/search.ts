export type QueryType = 'transaction' | 'wallet' | 'block_height' | 'arns' | 'keyword';

const TX_OR_WALLET_PATTERN = /^[a-zA-Z0-9_-]{43}$/;
const BLOCK_HEIGHT_PATTERN = /^\d+$/;
const ARNS_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,50}$/;

export function detectQueryType(query: string): QueryType {
  const trimmed = query.trim();

  if (TX_OR_WALLET_PATTERN.test(trimmed)) {
    return 'transaction';
  }

  if (BLOCK_HEIGHT_PATTERN.test(trimmed)) {
    return 'block_height';
  }

  if (!trimmed.includes(' ') && ARNS_PATTERN.test(trimmed)) {
    return 'arns';
  }

  return 'keyword';
}

