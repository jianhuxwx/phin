import { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';

export async function registerWebsocket(app: FastifyInstance): Promise<void> {
  await app.register(websocket);
}

