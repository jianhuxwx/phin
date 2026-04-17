import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { searchSchema, searchSuggestSchema } from '../schemas/search';
import { createServices } from '../services/factory';

const searchRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/search', { schema: searchSchema }, async (request) => {
    const { search } = createServices(app);
    const query = request.query as { q: string };
    return await search.resolve(query.q);
  });

  app.get('/search/suggest', { schema: searchSuggestSchema }, async (request) => {
    const { search } = createServices(app);
    const query = request.query as { q: string };
    return await search.suggest(query.q);
  });
};

export default searchRoutes;
