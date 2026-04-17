import type {
  ApiBlockDetail,
  ApiBlockSummary,
  ApiTransactionDetail,
  ApiTransactionSummary
} from '../contracts';

function getTagValue(tags: Array<{ name: string; value: string }>, name: string): string | null {
  const match = tags.find((tag) => tag.name === name);
  return match?.value ?? null;
}

export function toBlockSummary(block: {
  id: string;
  height: number;
  timestamp: number;
  txCount: number;
  weaveSize: string;
  reward: string;
}): ApiBlockSummary {
  return {
    id: block.id,
    height: block.height,
    timestamp: block.timestamp,
    txCount: block.txCount,
    weaveSize: block.weaveSize,
    reward: block.reward
  };
}

export function toBlockDetail(block: {
  id: string;
  height: number;
  timestamp: number;
  txCount: number;
  weaveSize: string;
  reward: string;
  previousBlock?: string | null;
  indexedAt?: number | null;
}): ApiBlockDetail {
  return {
    ...toBlockSummary(block),
    previousBlock: block.previousBlock ?? null,
    indexedAt: block.indexedAt ?? null
  };
}

export function toTransactionSummary(transaction: any): ApiTransactionSummary {
  const ownerAddress =
    typeof transaction.owner === 'string'
      ? transaction.owner
      : transaction.owner?.address ?? '';
  const tags = Array.isArray(transaction.tags) ? transaction.tags : [];
  const feeAr =
    typeof transaction.fee === 'string'
      ? transaction.fee
      : transaction.fee?.ar ?? '0';
  const quantityAr =
    typeof transaction.quantity === 'string'
      ? transaction.quantity
      : transaction.quantity?.ar ?? '0';

  return {
    id: transaction.id,
    ownerAddress,
    recipient: transaction.recipient ?? null,
    feeAr,
    quantityAr,
    dataSize: Number(transaction.data?.size ?? 0),
    contentType: transaction.data?.type ?? null,
    block: transaction.block ?? null,
    appName: getTagValue(tags, 'App-Name'),
    fileName: getTagValue(tags, 'File-Name')
  };
}

export function toTransactionDetail(transaction: any): ApiTransactionDetail {
  return {
    ...toTransactionSummary(transaction),
    anchor: transaction.anchor ?? null,
    signature: transaction.signature ?? null,
    tags: Array.isArray(transaction.tags) ? transaction.tags : []
  };
}
