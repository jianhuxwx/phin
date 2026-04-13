export const GET_AO_PROCESSES = /* GraphQL */ `
  query GetAoProcesses($cursor: String, $limit: Int!) {
    transactions(
      tags: [{ name: "App-Name", values: ["ao"] }]
      after: $cursor
      first: $limit
    ) {
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

export const GET_AO_PROCESS_MESSAGES = /* GraphQL */ `
  query GetAoProcessMessages($processId: ID!, $cursor: String, $limit: Int!) {
    transactions(
      tags: [{ name: "Process-Id", values: [$processId] }]
      after: $cursor
      first: $limit
    ) {
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

