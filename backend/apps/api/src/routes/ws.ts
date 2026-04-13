import { FastifyInstance, FastifyPluginAsync } from 'fastify';

const wsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get(
    '/ws',
    { websocket: true },
    (connection /*, request */) => {
      connection.socket.send(
        JSON.stringify({
          type: 'connected',
          channels: []
        })
      );

      connection.socket.on('message', (message) => {
        try {
          const parsed = JSON.parse(message.toString());
          console.log('Received WS message', parsed);
        } catch {
          console.warn('Received invalid WS message');
        }
      });
    }
  );
};

export default wsRoutes;

