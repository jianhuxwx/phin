export const GET_TRANSACTION = /* GraphQL */ `
  query GetTransaction($id: ID!) {
    transaction(id: $id) {
      id
      owner
      recipient
      quantity
      fee
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

export const GET_TRANSACTIONS_BY_OWNER = /* GraphQL */ `
  query GetTransactionsByOwner($owner: String!, $cursor: String, $limit: Int!) {
    transactions(owners: [$owner], after: $cursor, first: $limit) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          recipient
          quantity
          fee
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

export const GET_TRANSACTIONS_BY_TAG = /* GraphQL */ `
  query GetTransactionsByTag($name: String!, $values: [String!]!, $cursor: String, $limit: Int!) {
    transactions(tags: [{ name: $name, values: $values }], after: $cursor, first: $limit) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          owner
          recipient
          quantity
          fee
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

