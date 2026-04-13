export const GET_LATEST_BLOCKS = /* GraphQL */ `
  query GetLatestBlocks($limit: Int!) {
    blocks(limit: $limit, sort: HEIGHT_DESC) {
      edges {
        node {
          id
          height
          timestamp
          txCount
          weaveSize
          reward
          miner
        }
      }
    }
  }
`;

export const GET_BLOCK_BY_HEIGHT = /* GraphQL */ `
  query GetBlockByHeight($height: Int!) {
    block(height: $height) {
      id
      height
      timestamp
      txCount
      weaveSize
      reward
      miner
    }
  }
`;

export const GET_BLOCK_BY_ID = /* GraphQL */ `
  query GetBlockById($id: ID!) {
    block(id: $id) {
      id
      height
      timestamp
      txCount
      weaveSize
      reward
      miner
    }
  }
`;

export const GET_BLOCK_TRANSACTIONS = /* GraphQL */ `
  query GetBlockTransactions($blockId: ID!, $cursor: String, $limit: Int!) {
    block(id: $blockId) {
      id
      height
      transactions(after: $cursor, first: $limit) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            owner
            tags {
              name
              value
            }
            quantity
            fee
            data {
              size
              type
            }
          }
        }
      }
    }
  }
`;

