export interface GetLatestBlocksVariables {
  limit: number;
}

export interface GetBlockByHeightVariables {
  height: number;
}

export interface GetBlockByIdVariables {
  id: string;
}

export interface GetBlockTransactionsVariables {
  blockId: string;
  cursor?: string;
  limit: number;
}

export interface GetTransactionVariables {
  id: string;
}

export interface GetTransactionsByOwnerVariables {
  owner: string;
  cursor?: string;
  limit: number;
}

export interface GetTransactionsByTagVariables {
  name: string;
  values: string[];
  cursor?: string;
  limit: number;
}

export interface GetAoProcessesVariables {
  cursor?: string;
  limit: number;
}

export interface GetAoProcessMessagesVariables {
  processId: string;
  cursor?: string;
  limit: number;
}

