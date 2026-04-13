import { GraphQLClient } from 'graphql-request';

export function createGatewayClient(url: string): GraphQLClient {
  const client = new GraphQLClient(url, {
    requestMiddleware: async (request) => {
      return {
        ...request,
        headers: {
          ...(request.headers instanceof Headers ? Object.fromEntries(request.headers.entries()) : request.headers),
          'user-agent': 'phin-backend',
          accept: 'application/json',
          'content-type': 'application/json'
        },
        signal: AbortSignal.timeout(10_000)
      };
    }
  });

  return client;
}

