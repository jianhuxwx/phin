import { FastifyRequest, FastifyReply } from 'fastify';

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Optional JWT auth hook placeholder.
  void request;
  void reply;
}

