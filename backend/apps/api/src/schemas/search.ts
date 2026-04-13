import { paginationSchema } from './common';

export const searchSchema = {
  querystring: {
    type: 'object',
    properties: {
      q: { type: 'string' },
      ...paginationSchema.properties
    },
    required: ['q']
  }
};

export const searchSuggestSchema = {
  querystring: {
    type: 'object',
    properties: {
      q: { type: 'string' }
    },
    required: ['q']
  }
};

