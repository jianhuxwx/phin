import { FastifyRequest, FastifyReply } from 'fastify';
import { detectQueryType } from '../services/search';

export async function detectQueryTypeMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  void reply;
  const query = (request.query as Record<string, unknown>)?.q;
  if (typeof query === 'string') {
    const type = detectQueryType(query);
    (request as any).queryType = type;
  }
}

